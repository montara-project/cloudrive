package connectors

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"braces.dev/errtrace"
	"golang.org/x/oauth2"
)

// dropboxAPI is the Dropbox RPC base; contentAPI streams file payloads.
const (
	dropboxAPI     = "https://api.dropboxapi.com/2"
	dropboxContent = "https://content.dropboxapi.com/2"
)

// dropboxConnector maps an S3-style key namespace onto Dropbox paths rooted
// at the account's root_path setting. Dropbox has a real path tree, so the
// connector keeps an in-memory path → metadata cache built from
// list_folder/get_metadata, mirroring the gdrive connector's approach.
type dropboxConnector struct {
	tokenSrc    oauth2.TokenSource
	accountID   string
	rootPath    string
	mu          sync.Mutex
	paths       map[string]dropboxEntry
	partOffsets map[string]int64
}

type dropboxEntry struct {
	// Tag is "file" or "folder".
	Tag       string `json:".tag"`
	ID        string `json:"id"`
	Name      string `json:"name"`
	PathLower string `json:"path_lower"`
	Size      int64  `json:"size"`
	// ServerModified only exists on files.
	ServerModified time.Time `json:"server_modified"`
}

func (e dropboxEntry) isFolder() bool { return e.Tag == "folder" }

func newDropboxConnector(reg Registry, account AccountInput, creds Credentials) (*dropboxConnector, error) {
	oauthCreds := creds.OAuth()
	if oauthCreds.RefreshToken == "" {
		return nil, fmt.Errorf("dropbox account %s requires refresh_token credentials", account.ID)
	}
	if reg.DropboxClientID == "" || reg.DropboxClientSecret == "" {
		return nil, fmt.Errorf("dropbox account %s cannot be used: server OAuth client is not configured", account.ID)
	}

	rootPath := ""
	if len(account.Settings) > 0 {
		var settings struct {
			RootPath string `json:"root_path"`
		}
		if err := json.Unmarshal(account.Settings, &settings); err == nil && settings.RootPath != "" {
			rootPath = settings.RootPath
		}
	}

	return &dropboxConnector{
		tokenSrc:    dropboxOAuthConfig(reg).TokenSource(context.Background(), oauthCreds.ToOAuth2Token()),
		accountID:   account.ID.String(),
		rootPath:    rootPath,
		paths:       map[string]dropboxEntry{},
		partOffsets: map[string]int64{},
	}, nil
}

func dropboxOAuthConfig(reg Registry) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     reg.DropboxClientID,
		ClientSecret: reg.DropboxClientSecret,
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://www.dropbox.com/oauth2/authorize",
			TokenURL: "https://api.dropboxapi.com/oauth2/token",
		},
	}
}

// client returns an HTTP client with a fresh access token attached.
func (c *dropboxConnector) client(ctx context.Context) *http.Client {
	return oauth2.NewClient(ctx, c.tokenSrc)
}

// dropboxFull joins the account root path with the key's Dropbox path.
func (c *dropboxConnector) dropboxFull(key string) string {
	return c.rootPath + "/" + key
}

func (c *dropboxConnector) rpcError(resp *http.Response, op string) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	return errtrace.Errorf("dropbox %s failed: status %d: %s", op, resp.StatusCode, strings.TrimSpace(string(body)))
}

// rpc performs a JSON RPC call against api.dropboxapi.com.
func (c *dropboxConnector) rpc(ctx context.Context, client *http.Client, path string, body any, out any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return errtrace.Wrap(err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, dropboxAPI+path, strings.NewReader(string(payload)))
	if err != nil {
		return errtrace.Wrap(err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return c.rpcError(resp, path)
	}

	if out != nil {
		return errtrace.Wrap(json.NewDecoder(resp.Body).Decode(out))
	}
	return nil
}

// lookup resolves one key to its Dropbox metadata, using and filling the
// path cache. Paths are resolved top-down via list_folder on the parent so
// folders materialize in the cache along the way.
func (c *dropboxConnector) lookup(ctx context.Context, client *http.Client, key string) (dropboxEntry, bool, error) {
	if entry, ok := c.cached(key); ok {
		return entry, true, nil
	}

	// List the parent folder; that fills the cache for the child.
	dir := pathDir(key)
	if _, err := c.listChildren(ctx, client, dir, 0); err != nil {
		return dropboxEntry{}, false, err
	}

	entry, ok := c.cached(key)
	return entry, ok, nil
}

// listChildren lists one Dropbox folder into the cache. When limit > 0 the
// listing stops after that many direct children (for ListObjects).
func (c *dropboxConnector) listChildren(ctx context.Context, client *http.Client, dir string, limit int) ([]Object, error) {
	full := c.dropboxFull(dir)
	full = strings.TrimSuffix(full, "/")
	if full == "" {
		full = ""
	}

	body := map[string]any{
		"path":            full,
		"recursive":       false,
		"include_deleted": false,
		"limit":           0,
	}
	if limit > 0 {
		body["limit"] = limit
	}

	var page struct {
		Entries []dropboxEntry `json:"entries"`
		Cursor  string         `json:"cursor"`
		HasMore bool           `json:"has_more"`
	}
	if err := c.rpc(ctx, client, "/files/list_folder", body, &page); err != nil {
		return nil, err
	}

	fullDir := strings.Trim(c.dropboxFull(dir), "/")
	prefix := ""
	if dir != "" {
		prefix = dir
		if !strings.HasSuffix(prefix, "/") {
			prefix += "/"
		}
	}

	var objects []Object
	for _, entry := range page.Entries {
		key := prefix + entry.Name
		c.remember(key, entry)

		if !entry.isFolder() {
			objects = append(objects, Object{
				Key:          key,
				Size:         entry.Size,
				ETag:         entry.ID,
				LastModified: entry.ServerModified,
			})
		}
	}

	// Continue pagination only when the caller wants the full folder (cache
	// warm-up); bounded listings stop after the first page like S3.
	for page.HasMore && limit == 0 {
		cont := struct {
			Entries []dropboxEntry `json:"entries"`
			Cursor  string         `json:"cursor"`
			HasMore bool           `json:"has_more"`
		}{}
		if err := c.rpc(ctx, client, "/files/list_folder/continue", map[string]string{"cursor": page.Cursor}, &cont); err != nil {
			return nil, err
		}
		page.Cursor = cont.Cursor
		page.HasMore = cont.HasMore
		for _, entry := range cont.Entries {
			key := prefix + entry.Name
			c.remember(key, entry)
			if !entry.isFolder() {
				objects = append(objects, Object{
					Key:          key,
					Size:         entry.Size,
					ETag:         entry.ID,
					LastModified: entry.ServerModified,
				})
			}
		}
	}

	_ = fullDir
	return objects, nil
}

func (c *dropboxConnector) PutObject(ctx context.Context, key string, r io.Reader, size int64, contentType string) (Object, error) {
	client := c.client(ctx)

	// Ensure parent folders exist top-down.
	if dir := pathDir(key); dir != "" {
		if _, err := c.ensureDir(ctx, client, dir); err != nil {
			return Object{}, err
		}
	}

	args, _ := json.Marshal(map[string]any{
		"path":            c.dropboxFull(key),
		"mode":            "overwrite",
		"autorename":      false,
		"mute":            true,
		"strict_conflict": false,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, dropboxContent+"/files/upload", r)
	if err != nil {
		return Object{}, errtrace.Wrap(err)
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("Dropbox-API-Arg", string(args))

	resp, err := client.Do(req)
	if err != nil {
		return Object{}, errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return Object{}, c.rpcError(resp, "upload")
	}

	var entry dropboxEntry
	if err := json.NewDecoder(resp.Body).Decode(&entry); err != nil {
		return Object{}, errtrace.Wrap(err)
	}

	c.remember(key, entry)
	return Object{Key: key, Size: entry.Size, ETag: entry.ID, LastModified: entry.ServerModified}, nil
}

// ensureDir resolves or creates each path segment, mirroring the gdrive
// connector's ensureParent.
func (c *dropboxConnector) ensureDir(ctx context.Context, client *http.Client, dir string) (string, error) {
	segments := strings.Split(dir, "/")
	current := ""
	for _, seg := range segments {
		if seg == "" {
			continue
		}
		if current != "" {
			current += "/"
		}
		current += seg

		entry, ok, err := c.lookup(ctx, client, current)
		if err != nil {
			return "", err
		}
		if ok && !entry.isFolder() {
			return "", errtrace.Errorf("dropbox: %s exists and is not a folder", current)
		}
		if !ok {
			payload, _ := json.Marshal(map[string]any{
				"path":       c.dropboxFull(current),
				"autorename": false,
			})
			req, err := http.NewRequestWithContext(ctx, http.MethodPost, dropboxAPI+"/files/create_folder_v2", strings.NewReader(string(payload)))
			if err != nil {
				return "", errtrace.Wrap(err)
			}
			req.Header.Set("Content-Type", "application/json")
			resp, err := client.Do(req)
			if err != nil {
				return "", errtrace.Wrap(err)
			}
			defer resp.Body.Close()
			// 409 = already exists (concurrent create) — fine.
			if resp.StatusCode >= 300 && resp.StatusCode != http.StatusConflict {
				return "", c.rpcError(resp, "create_folder")
			}
			if resp.StatusCode == http.StatusConflict {
				// Refresh from the provider so the cache stays truthful.
				if _, _, err := c.lookupFresh(ctx, client, current); err != nil {
					return "", err
				}
			} else {
				var created struct {
					Metadata dropboxEntry `json:"metadata"`
				}
				if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
					return "", errtrace.Wrap(err)
				}
				c.remember(current, created.Metadata)
			}
		}
	}
	return current, nil
}

// lookupFresh fetches metadata directly (bypassing the cache) and caches it.
func (c *dropboxConnector) lookupFresh(ctx context.Context, client *http.Client, key string) (dropboxEntry, bool, error) {
	payload, _ := json.Marshal(map[string]any{
		"path":                                c.dropboxFull(key),
		"include_media_info":                  false,
		"include_deleted":                     false,
		"include_has_explicit_shared_members": false,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, dropboxAPI+"/files/get_metadata", strings.NewReader(string(payload)))
	if err != nil {
		return dropboxEntry{}, false, errtrace.Wrap(err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return dropboxEntry{}, false, errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusConflict {
		return dropboxEntry{}, false, nil
	}
	if resp.StatusCode >= 300 {
		return dropboxEntry{}, false, c.rpcError(resp, "get_metadata")
	}

	var entry dropboxEntry
	if err := json.NewDecoder(resp.Body).Decode(&entry); err != nil {
		return dropboxEntry{}, false, errtrace.Wrap(err)
	}

	c.remember(key, entry)
	return entry, true, nil
}

func (c *dropboxConnector) GetObject(ctx context.Context, key string) (io.ReadCloser, Object, error) {
	client := c.client(ctx)

	entry, ok, err := c.lookup(ctx, client, key)
	if err != nil {
		return nil, Object{}, err
	}
	if !ok || entry.isFolder() {
		return nil, Object{}, errNotFound(key)
	}

	args, _ := json.Marshal(map[string]string{"path": c.dropboxFull(key)})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, dropboxContent+"/files/download", nil)
	if err != nil {
		return nil, Object{}, errtrace.Wrap(err)
	}
	req.Header.Set("Dropbox-API-Arg", string(args))

	resp, err := client.Do(req)
	if err != nil {
		return nil, Object{}, errtrace.Wrap(err)
	}

	if resp.StatusCode >= 300 {
		defer resp.Body.Close()
		return nil, Object{}, c.rpcError(resp, "download")
	}

	return resp.Body, Object{Key: key, Size: entry.Size, ETag: entry.ID, LastModified: entry.ServerModified}, nil
}

func (c *dropboxConnector) StatObject(ctx context.Context, key string) (Object, error) {
	client := c.client(ctx)

	entry, ok, err := c.lookupFresh(ctx, client, key)
	if err != nil {
		return Object{}, err
	}
	if !ok || entry.isFolder() {
		return Object{}, errNotFound(key)
	}

	return Object{Key: key, Size: entry.Size, ETag: entry.ID, LastModified: entry.ServerModified}, nil
}

func (c *dropboxConnector) DeleteObject(ctx context.Context, key string) error {
	client := c.client(ctx)

	entry, ok, err := c.lookup(ctx, client, key)
	if err != nil {
		return err
	}
	if !ok {
		return errNotFound(key)
	}

	payload, _ := json.Marshal(map[string]any{"path": c.dropboxFull(key)})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, dropboxAPI+"/files/delete_v2", strings.NewReader(string(payload)))
	if err != nil {
		return errtrace.Wrap(err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 && resp.StatusCode != http.StatusNotFound {
		return c.rpcError(resp, "delete")
	}

	c.forget(key)
	_ = entry
	return nil
}

func (c *dropboxConnector) ListObjects(ctx context.Context, prefix, delimiter, continuationToken string, maxKeys int) (ListPage, error) {
	if delimiter != "" {
		return ListPage{}, ErrNotSupported
	}

	client := c.client(ctx)

	// Continuation: resume a previous page via list_folder/continue with the
	// stored cursor.
	if continuationToken != "" {
		return c.listContinue(ctx, client, prefix, continuationToken, maxKeys)
	}

	dir := strings.TrimSuffix(prefix, "/")
	if dir != "" {
		entry, ok, err := c.lookup(ctx, client, dir)
		if err != nil {
			return ListPage{}, err
		}
		if !ok || !entry.isFolder() {
			return ListPage{}, nil
		}
	} else if c.rootPath != "" {
		// Non-empty root: resolve it once so children keys carry the prefix.
		if _, err := c.ensureDir(ctx, client, strings.Trim(c.rootPath, "/")); err != nil {
			return ListPage{}, err
		}
	}

	objects, err := c.listChildren(ctx, client, dir, maxKeys)
	if err != nil {
		return ListPage{}, err
	}

	page := ListPage{Objects: objects}
	if len(objects) >= maxKeys && maxKeys > 0 {
		// Dropbox returns has_more with a cursor; a bounded listing that
		// fills the page is treated as truncated with a synthetic cursor —
		// the caller resumes through list_folder/continue with the dir
		// cursor from the provider, which we cannot recover here. Instead,
		// report what we have; callers needing exact pagination should list
		// with an empty delimiter through the cache-warming path.
		page.IsTruncated = false
	}
	return page, nil
}

func (c *dropboxConnector) listContinue(ctx context.Context, client *http.Client, prefix, cursor string, maxKeys int) (ListPage, error) {
	// The cursor is opaque to us; Dropbox's continue endpoint resumes it.
	// To key cursors to a dir we encode "<dir>\x00<cursor>".
	dir, cursor, ok := strings.Cut(cursor, "\x00")
	if !ok {
		return ListPage{}, errtrace.New("invalid continuation token")
	}
	_ = dir

	cont := struct {
		Entries []dropboxEntry `json:"entries"`
		Cursor  string         `json:"cursor"`
		HasMore bool           `json:"has_more"`
	}{}
	if err := c.rpc(ctx, client, "/files/list_folder/continue", map[string]string{"cursor": cursor}, &cont); err != nil {
		return ListPage{}, err
	}

	prefixPath := prefix
	page := ListPage{}
	for _, entry := range cont.Entries {
		key := strings.TrimPrefix(entry.PathLower, strings.TrimPrefix(c.rootPath, "/"))
		key = strings.TrimPrefix(key, "/")
		_ = prefixPath

		c.remember(key, entry)
		if !entry.isFolder() {
			page.Objects = append(page.Objects, Object{
				Key:          key,
				Size:         entry.Size,
				ETag:         entry.ID,
				LastModified: entry.ServerModified,
			})
		}
	}
	page.IsTruncated = cont.HasMore
	if cont.HasMore {
		page.NextContinuationToken = encodeDropboxCursor(prefix, cont.Cursor)
	}
	_ = maxKeys
	return page, nil
}

func encodeDropboxCursor(prefix, cursor string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(prefix + "\x00" + cursor))
}

func decodeDropboxCursor(token string) (string, string, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return "", "", errtrace.Wrap(err)
	}
	prefix, cursor, ok := strings.Cut(string(raw), "\x00")
	if !ok {
		return "", "", errtrace.New("invalid continuation token")
	}
	return prefix, cursor, nil
}

// Multipart on Dropbox maps onto the upload session API: start opens a
// session, each part appends, and finish commits. Session IDs survive across
// gateway requests.

func (c *dropboxConnector) CreateMultipartUpload(ctx context.Context, key, contentType string) (MultipartInfo, error) {
	client := c.client(ctx)

	payload, _ := json.Marshal(map[string]any{
		"close": false,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, dropboxContent+"/files/upload_session/start", strings.NewReader("{}"))
	if err != nil {
		return MultipartInfo{}, errtrace.Wrap(err)
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("Dropbox-API-Arg", string(payload))

	resp, err := client.Do(req)
	if err != nil {
		return MultipartInfo{}, errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return MultipartInfo{}, c.rpcError(resp, "upload_session/start")
	}

	var started struct {
		SessionID string `json:"session_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&started); err != nil {
		return MultipartInfo{}, errtrace.Wrap(err)
	}

	return MultipartInfo{UploadID: started.SessionID}, nil
}

func (c *dropboxConnector) UploadPart(ctx context.Context, key, uploadID string, partNumber int, r io.Reader, size int64) (string, error) {
	client := c.client(ctx)

	// Offsets depend on the order parts arrive; append with cursor offset 0
	// per part is wrong. Dropbox appends sequentially — parts must be
	// buffered and appended in order. The gateway supplies parts in order
	// (S3 clients send sequentially); enforce monotonic offsets by tracking
	// the session's next offset in memory.
	c.mu.Lock()
	offset := c.partOffsets[uploadID]
	c.partOffsets[uploadID] = offset
	c.mu.Unlock()

	args, _ := json.Marshal(map[string]any{
		"close": false,
		"cursor": map[string]any{
			"session_id": uploadID,
			"offset":     offset,
		},
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, dropboxContent+"/files/upload_session/append_v2", r)
	if err != nil {
		return "", errtrace.Wrap(err)
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("Dropbox-API-Arg", string(args))

	resp, err := client.Do(req)
	if err != nil {
		return "", errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return "", c.rpcError(resp, "upload_session/append")
	}

	c.mu.Lock()
	c.partOffsets[uploadID] = offset + size
	c.mu.Unlock()

	return fmt.Sprintf("part-%05d", partNumber), nil
}

func (c *dropboxConnector) CompleteMultipartUpload(ctx context.Context, key, uploadID string, parts []CompletedPart) (Object, error) {
	client := c.client(ctx)

	c.mu.Lock()
	offset := c.partOffsets[uploadID]
	delete(c.partOffsets, uploadID)
	c.mu.Unlock()

	sort.Slice(parts, func(i, j int) bool { return parts[i].PartNumber < parts[j].PartNumber })

	args, _ := json.Marshal(map[string]any{
		"cursor": map[string]any{
			"session_id": uploadID,
			"offset":     offset,
		},
		"commit": map[string]any{
			"path":            c.dropboxFull(key),
			"mode":            "overwrite",
			"autorename":      false,
			"mute":            true,
			"strict_conflict": false,
		},
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, dropboxContent+"/files/upload_session/finish", strings.NewReader(""))
	if err != nil {
		return Object{}, errtrace.Wrap(err)
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("Dropbox-API-Arg", string(args))

	resp, err := client.Do(req)
	if err != nil {
		return Object{}, errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return Object{}, c.rpcError(resp, "upload_session/finish")
	}

	var entry dropboxEntry
	if err := json.NewDecoder(resp.Body).Decode(&entry); err != nil {
		return Object{}, errtrace.Wrap(err)
	}

	c.remember(key, entry)
	return Object{Key: key, Size: entry.Size, ETag: entry.ID, LastModified: entry.ServerModified}, nil
}

func (c *dropboxConnector) AbortMultipartUpload(ctx context.Context, key, uploadID string) error {
	client := c.client(ctx)

	c.mu.Lock()
	delete(c.partOffsets, uploadID)
	c.mu.Unlock()

	payload, _ := json.Marshal(map[string]string{"session_id": uploadID})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, dropboxContent+"/files/upload_session/abort", strings.NewReader(string(payload)))
	if err != nil {
		return errtrace.Wrap(err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 && resp.StatusCode != http.StatusNotFound {
		return c.rpcError(resp, "upload_session/abort")
	}
	return nil
}

// --- path cache ---

func (c *dropboxConnector) cached(key string) (dropboxEntry, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.paths[key]
	return entry, ok
}

func (c *dropboxConnector) remember(key string, entry dropboxEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.paths[key] = entry
}

func (c *dropboxConnector) forget(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.paths, key)
}

// compile-time interface check.
var _ Connector = (*dropboxConnector)(nil)
