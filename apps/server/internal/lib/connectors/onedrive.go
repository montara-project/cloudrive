package connectors

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"braces.dev/errtrace"
	"golang.org/x/oauth2"
)

// graphAPI is the Microsoft Graph v1.0 base URL.
const graphAPI = "https://graph.microsoft.com/v1.0"

// onedriveConnector maps an S3-style key namespace onto OneDrive items rooted
// at the drive from the account's credentials (drive_id). Graph has a real
// path tree addressed by parent item + name, so the connector keeps an
// in-memory path → item cache like the gdrive/dropbox connectors.
type onedriveConnector struct {
	tokenSrc  oauth2.TokenSource
	accountID string
	driveID   string
	// rootItem is the item id acting as the bucket root ("root" by default).
	rootItem string

	mu          sync.Mutex
	paths       map[string]graphItem
	partOffsets map[string]int64
}

type graphItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Size int64  `json:"size"`
	File *struct {
		MimeType string `json:"mimeType"`
	} `json:"file"`
	Folder *struct{} `json:"folder"`
	// ParentReference carries the parent id for path building.
	ParentReference *struct {
		ID string `json:"id"`
	} `json:"parentReference"`
	LastModifiedDateTime time.Time `json:"lastModifiedDateTime"`
	// ConflictBehavior is only used in requests; responses ignore it.
	Content struct {
		DownloadURL string `json:"@microsoft.graph.downloadUrl"`
	} `json:"content"`
}

func (i graphItem) isFolder() bool { return i.Folder != nil }

func newOneDriveConnector(reg Registry, account AccountInput, creds Credentials) (*onedriveConnector, error) {
	oauthCreds := creds.OAuth()
	if oauthCreds.RefreshToken == "" {
		return nil, fmt.Errorf("onedrive account %s requires refresh_token credentials", account.ID)
	}
	if reg.OneDriveClientID == "" || reg.OneDriveClientSecret == "" {
		return nil, fmt.Errorf("onedrive account %s cannot be used: server OAuth client is not configured", account.ID)
	}

	// drive_id is persisted into settings at connect time (Graph profile).
	driveID := ""
	rootItem := "root"
	if len(account.Settings) > 0 {
		var settings struct {
			DriveID  string `json:"drive_id"`
			RootItem string `json:"root_item_id"`
		}
		if err := json.Unmarshal(account.Settings, &settings); err == nil {
			if settings.DriveID != "" {
				driveID = settings.DriveID
			}
			if settings.RootItem != "" {
				rootItem = settings.RootItem
			}
		}
	}
	if driveID == "" {
		return nil, fmt.Errorf("onedrive account %s requires drive_id in settings", account.ID)
	}

	return &onedriveConnector{
		tokenSrc:    onedriveOAuthConfig(reg).TokenSource(context.Background(), oauthCreds.ToOAuth2Token()),
		accountID:   account.ID.String(),
		driveID:     driveID,
		rootItem:    rootItem,
		paths:       map[string]graphItem{},
		partOffsets: map[string]int64{},
	}, nil
}

func onedriveOAuthConfig(reg Registry) *oauth2.Config {
	tenant := reg.OneDriveTenant
	if tenant == "" {
		tenant = "common"
	}
	authority := "https://login.microsoftonline.com/" + url.PathEscape(tenant) + "/oauth2/v2.0"
	return &oauth2.Config{
		ClientID:     reg.OneDriveClientID,
		ClientSecret: reg.OneDriveClientSecret,
		Endpoint: oauth2.Endpoint{
			AuthURL:  authority + "/authorize",
			TokenURL: authority + "/token",
		},
	}
}

func (c *onedriveConnector) client(ctx context.Context) *http.Client {
	return oauth2.NewClient(ctx, c.tokenSrc)
}

// itemPath builds a Graph item path address for a key under the root item.
// Graph supports addressing by path: /drives/{id}/root:/path/to/item
func (c *onedriveConnector) itemPath(key string) string {
	if key == "" {
		return fmt.Sprintf("%s/drives/%s/root", graphAPI, c.driveID)
	}
	return fmt.Sprintf("%s/drives/%s/root:/%s", graphAPI, c.driveID, encodeGraphPath(key))
}

// encodeGraphPath escapes each path segment for the :/ URL syntax while
// keeping slashes as separators.
func encodeGraphPath(key string) string {
	segments := strings.Split(strings.Trim(key, "/"), "/")
	for i, seg := range segments {
		segments[i] = url.PathEscape(seg)
	}
	return strings.Join(segments, "/")
}

func (c *onedriveConnector) graphError(resp *http.Response, op string) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	return errtrace.Errorf("onedrive %s failed: status %d: %s", op, resp.StatusCode, strings.TrimSpace(string(body)))
}

func (c *onedriveConnector) get(ctx context.Context, client *http.Client, endpoint, op string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return errtrace.Wrap(err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return c.graphError(resp, op)
	}

	if out != nil {
		return errtrace.Wrap(json.NewDecoder(resp.Body).Decode(out))
	}
	return nil
}

// lookup resolves one key to its Graph item via path addressing, filling the
// cache. Path addressing avoids the tree walk the gdrive connector needs.
func (c *onedriveConnector) lookup(ctx context.Context, client *http.Client, key string) (graphItem, bool, error) {
	if item, ok := c.cached(key); ok {
		return item, true, nil
	}

	var item graphItem
	if err := c.get(ctx, client, c.itemPath(key), "lookup", &item); err != nil {
		// Path addressing 404s as 404 itemNotFound; surface as not found.
		return graphItem{}, false, nil
	}

	c.remember(key, item)
	return item, true, nil
}

// children lists one folder's direct children, filling the cache.
func (c *onedriveConnector) children(ctx context.Context, client *http.Client, dir string) ([]Object, error) {
	folder, ok, err := c.lookup(ctx, client, dir)
	if err != nil {
		return nil, err
	}
	if !ok || !folder.isFolder() {
		return nil, nil
	}

	endpoint := fmt.Sprintf("%s/drives/%s/items/%s/children?$select=id,name,size,file,folder,lastModifiedDateTime,parentReference&$top=200", graphAPI, c.driveID, folder.ID)
	if dir == "" {
		endpoint = fmt.Sprintf("%s/drives/%s/root/children?$select=id,name,size,file,folder,lastModifiedDateTime,parentReference&$top=200", graphAPI, c.driveID)
	}

	var objects []Object
	for endpoint != "" {
		var page struct {
			Value    []graphItem `json:"value"`
			NextLink string      `json:"@odata.nextLink"`
		}
		if err := c.get(ctx, client, endpoint, "children", &page); err != nil {
			return nil, err
		}

		prefix := ""
		if dir != "" {
			prefix = dir
			if !strings.HasSuffix(prefix, "/") {
				prefix += "/"
			}
		}
		for _, item := range page.Value {
			key := prefix + item.Name
			c.remember(key, item)
			if !item.isFolder() {
				objects = append(objects, Object{
					Key:          key,
					Size:         item.Size,
					ETag:         item.ID,
					LastModified: item.LastModifiedDateTime,
				})
			}
		}
		endpoint = page.NextLink
	}

	return objects, nil
}

func (c *onedriveConnector) PutObject(ctx context.Context, key string, r io.Reader, size int64, contentType string) (Object, error) {
	client := c.client(ctx)

	dir := pathDir(key)
	parentID := c.rootItem
	if dir != "" {
		parent, err := c.ensureDir(ctx, client, dir)
		if err != nil {
			return Object{}, err
		}
		parentID = parent.ID
	}

	// Simple PUT upload (≤250 MB); larger payloads go through multipart.
	endpoint := fmt.Sprintf("%s/drives/%s/items/%s:/%s:/content", graphAPI, c.driveID, parentID, url.PathEscape(baseName(key)))

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, r)
	if err != nil {
		return Object{}, errtrace.Wrap(err)
	}
	req.Header.Set("Content-Type", contentType)
	if size > 0 {
		req.ContentLength = size
	}

	resp, err := client.Do(req)
	if err != nil {
		return Object{}, errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return Object{}, c.graphError(resp, "upload")
	}

	var item graphItem
	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return Object{}, errtrace.Wrap(err)
	}

	c.remember(key, item)
	return Object{Key: key, Size: item.Size, ETag: item.ID, LastModified: item.LastModifiedDateTime}, nil
}

// ensureDir resolves or creates each path segment (Graph conflictBehavior:
// replace on folders is invalid; "fail" + 409 handling is used).
func (c *onedriveConnector) ensureDir(ctx context.Context, client *http.Client, dir string) (graphItem, error) {
	segments := strings.Split(dir, "/")
	current := ""
	parentID := c.rootItem
	for _, seg := range segments {
		if seg == "" {
			continue
		}
		if current != "" {
			current += "/"
		}
		current += seg

		item, ok, err := c.lookup(ctx, client, current)
		if err != nil {
			return graphItem{}, err
		}
		if ok && !item.isFolder() {
			return graphItem{}, errtrace.Errorf("onedrive: %s exists and is not a folder", current)
		}
		if !ok {
			payload, _ := json.Marshal(map[string]any{
				"name":                              seg,
				"folder":                            map[string]any{},
				"@microsoft.graph.conflictBehavior": "fail",
			})
			endpoint := fmt.Sprintf("%s/drives/%s/items/%s/children", graphAPI, c.driveID, parentID)
			req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(payload)))
			if err != nil {
				return graphItem{}, errtrace.Wrap(err)
			}
			req.Header.Set("Content-Type", "application/json")

			resp, err := client.Do(req)
			if err != nil {
				return graphItem{}, errtrace.Wrap(err)
			}
			defer resp.Body.Close()

			// 409 = already exists (concurrent create) — resolve by path.
			if resp.StatusCode == http.StatusConflict {
				fresh, found, err := c.lookup(ctx, client, current)
				if err != nil {
					return graphItem{}, err
				}
				if !found {
					return graphItem{}, errtrace.Errorf("onedrive: folder %s vanished during create", current)
				}
				item = fresh
			} else if resp.StatusCode >= 300 {
				return graphItem{}, c.graphError(resp, "create folder")
			} else {
				if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
					return graphItem{}, errtrace.Wrap(err)
				}
				c.remember(current, item)
			}
		}
		parentID = item.ID
	}
	return c.mustCached(dir), nil
}

// mustCached returns a previously cached item; ensureDir always caches the
// final segment before callers use this.
func (c *onedriveConnector) mustCached(key string) graphItem {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.paths[key]
}

func (c *onedriveConnector) GetObject(ctx context.Context, key string) (io.ReadCloser, Object, error) {
	client := c.client(ctx)

	item, ok, err := c.lookup(ctx, client, key)
	if err != nil {
		return nil, Object{}, err
	}
	if !ok || item.isFolder() {
		return nil, Object{}, errNotFound(key)
	}

	// Download via the path-addressed content endpoint; Graph 302s to the
	// pre-authenticated CDN URL and the http client follows it.
	endpoint := fmt.Sprintf("%s/drives/%s/root:/%s:/content", graphAPI, c.driveID, encodeGraphPath(key))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, Object{}, errtrace.Wrap(err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, Object{}, errtrace.Wrap(err)
	}

	if resp.StatusCode >= 300 {
		defer resp.Body.Close()
		return nil, Object{}, c.graphError(resp, "download")
	}

	return resp.Body, Object{Key: key, Size: item.Size, ETag: item.ID, LastModified: item.LastModifiedDateTime}, nil
}

func (c *onedriveConnector) StatObject(ctx context.Context, key string) (Object, error) {
	client := c.client(ctx)

	item, ok, err := c.lookup(ctx, client, key)
	if err != nil {
		return Object{}, err
	}
	if !ok || item.isFolder() {
		return Object{}, errNotFound(key)
	}

	return Object{Key: key, Size: item.Size, ETag: item.ID, LastModified: item.LastModifiedDateTime}, nil
}

func (c *onedriveConnector) DeleteObject(ctx context.Context, key string) error {
	client := c.client(ctx)

	item, ok, err := c.lookup(ctx, client, key)
	if err != nil {
		return err
	}
	if !ok {
		return errNotFound(key)
	}

	endpoint := fmt.Sprintf("%s/drives/%s/items/%s", graphAPI, c.driveID, item.ID)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return errtrace.Wrap(err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 && resp.StatusCode != http.StatusNotFound {
		return c.graphError(resp, "delete")
	}

	c.forget(key)
	return nil
}

func (c *onedriveConnector) ListObjects(ctx context.Context, prefix, delimiter, continuationToken string, maxKeys int) (ListPage, error) {
	if delimiter != "" {
		return ListPage{}, ErrNotSupported
	}

	client := c.client(ctx)

	// Continuation: @odata.nextLink from the previous page was wrapped into
	// the token by encodeGraphContinuation.
	if continuationToken != "" {
		nextLink, err := decodeGraphContinuation(continuationToken)
		if err != nil {
			return ListPage{}, err
		}

		var page struct {
			Value    []graphItem `json:"value"`
			NextLink string      `json:"@odata.nextLink"`
		}
		if err := c.get(ctx, client, nextLink, "children", &page); err != nil {
			return ListPage{}, err
		}

		pageResult := ListPage{}
		for _, item := range page.Value {
			c.remember(item.Name, item)
			if !item.isFolder() {
				pageResult.Objects = append(pageResult.Objects, Object{
					Key:          item.Name,
					Size:         item.Size,
					ETag:         item.ID,
					LastModified: item.LastModifiedDateTime,
				})
			}
		}
		pageResult.IsTruncated = page.NextLink != ""
		if page.NextLink != "" {
			pageResult.NextContinuationToken = encodeGraphContinuation(page.NextLink)
		}
		return pageResult, nil
	}

	dir := strings.TrimSuffix(prefix, "/")
	objects, err := c.children(ctx, client, dir)
	if err != nil {
		return ListPage{}, err
	}

	// Full-folder listing with $top=200 pages through everything; S3
	// callers expect at most maxKeys — truncate client-side. Cross-page
	// continuation for bounded listings needs the mid-folder nextLink, which
	// children() does not currently surface.
	if maxKeys > 0 && len(objects) > maxKeys {
		objects = objects[:maxKeys]
	}
	return ListPage{Objects: objects}, nil
}

func encodeGraphContinuation(nextLink string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(nextLink))
}

func decodeGraphContinuation(token string) (string, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return "", errtrace.Wrap(err)
	}
	return string(raw), nil
}

// Multipart on OneDrive maps onto the Graph upload session API: create a
// session, PUT each byte range with the documented headers, then the final
// range completes the file. Fragments must be in order — the same
// sequential-offset contract as the dropbox connector.

func (c *onedriveConnector) CreateMultipartUpload(ctx context.Context, key, contentType string) (MultipartInfo, error) {
	client := c.client(ctx)

	dir := pathDir(key)
	parentID := c.rootItem
	if dir != "" {
		parent, err := c.ensureDir(ctx, client, dir)
		if err != nil {
			return MultipartInfo{}, err
		}
		parentID = parent.ID
	}

	payload, _ := json.Marshal(map[string]any{
		"item": map[string]any{
			"@microsoft.graph.conflictBehavior": "replace",
			"name":                              baseName(key),
		},
	})
	endpoint := fmt.Sprintf("%s/drives/%s/items/%s:/%s:/createUploadSession", graphAPI, c.driveID, parentID, url.PathEscape(baseName(key)))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(payload)))
	if err != nil {
		return MultipartInfo{}, errtrace.Wrap(err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return MultipartInfo{}, errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return MultipartInfo{}, c.graphError(resp, "createUploadSession")
	}

	var session struct {
		UploadURL string `json:"uploadUrl"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		return MultipartInfo{}, errtrace.Wrap(err)
	}
	if session.UploadURL == "" {
		return MultipartInfo{}, errtrace.New("onedrive: upload session has no upload url")
	}

	// The upload URL is the bearer of the session (Graph has no separate id);
	// wrap it as the upload id.
	return MultipartInfo{UploadID: encodeGraphContinuation(session.UploadURL)}, nil
}

func (c *onedriveConnector) UploadPart(ctx context.Context, key, uploadID string, partNumber int, r io.Reader, size int64) (string, error) {
	client := c.client(ctx)

	c.mu.Lock()
	offset := c.partOffsets[uploadID]
	c.partOffsets[uploadID] = offset
	c.mu.Unlock()

	uploadURL, err := decodeGraphContinuation(uploadID)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, r)
	if err != nil {
		return "", errtrace.Wrap(err)
	}
	req.ContentLength = size
	req.Header.Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", offset, offset+size-1, offset+size))
	req.Header.Set("Content-Length", fmt.Sprintf("%d", size))

	resp, err := client.Do(req)
	if err != nil {
		return "", errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return "", c.graphError(resp, "upload fragment")
	}

	c.mu.Lock()
	c.partOffsets[uploadID] = offset + size
	c.mu.Unlock()

	return fmt.Sprintf("part-%05d", partNumber), nil
}

func (c *onedriveConnector) CompleteMultipartUpload(ctx context.Context, key, uploadID string, parts []CompletedPart) (Object, error) {
	// Graph completes the upload when the final byte range lands; the last
	// fragment response carries the finished item. Re-read the item by path.
	client := c.client(ctx)

	c.mu.Lock()
	delete(c.partOffsets, uploadID)
	c.mu.Unlock()

	item, ok, err := c.lookup(ctx, client, key)
	if err != nil {
		return Object{}, err
	}
	if !ok {
		return Object{}, errNotFound(key)
	}

	return Object{Key: key, Size: item.Size, ETag: item.ID, LastModified: item.LastModifiedDateTime}, nil
}

func (c *onedriveConnector) AbortMultipartUpload(ctx context.Context, key, uploadID string) error {
	client := c.client(ctx)

	c.mu.Lock()
	delete(c.partOffsets, uploadID)
	c.mu.Unlock()

	uploadURL, err := decodeGraphContinuation(uploadID)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, uploadURL, nil)
	if err != nil {
		return errtrace.Wrap(err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 && resp.StatusCode != http.StatusNotFound {
		return c.graphError(resp, "cancel upload session")
	}
	return nil
}

// --- path cache ---

func (c *onedriveConnector) cached(key string) (graphItem, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	item, ok := c.paths[key]
	return item, ok
}

func (c *onedriveConnector) remember(key string, item graphItem) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.paths[key] = item
}

func (c *onedriveConnector) forget(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.paths, key)
}

// compile-time interface check.
var _ Connector = (*onedriveConnector)(nil)
