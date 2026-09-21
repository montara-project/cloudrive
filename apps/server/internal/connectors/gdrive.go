package connectors

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"braces.dev/errtrace"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

func randRead(b []byte) (int, error) {
	return rand.Read(b)
}

func errNotFound(key string) error {
	return errors.New("not found: " + key)
}

// Google Drive REST endpoint.
const driveAPI = "https://www.googleapis.com/drive/v3"

// gdriveConnector maps an S3-style key namespace onto a flat Google Drive
// folder: the key "a/b/c.txt" becomes the file "a/b/c.txt" inside the folder
// identified by the account's root_folder_id setting. Drive has no real path
// tree, so the connector keeps an in-memory path → file-id cache built lazily
// from Drive's name-based search.
type gdriveConnector struct {
	reg        Registry
	accountID  string
	rootFolder string // Drive folder id acting as the bucket root
	tokenSrc   oauth2.TokenSource

	mu    sync.Mutex
	paths map[string]driveFile // key → resolved file/folder
}

type driveFile struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	MimeType string    `json:"mimeType"`
	Size     int64     `json:"size,string,omitempty"`
	ModTime  time.Time `json:"modifiedTime,omitempty"`
}

func newGoogleDriveConnector(reg Registry, account AccountInput, creds Credentials) (*gdriveConnector, error) {
	refreshToken := creds.string("refresh_token")
	if refreshToken == "" {
		return nil, fmt.Errorf("google_drive account %s requires refresh_token credentials", account.ID)
	}
	if reg.GoogleClientID == "" || reg.GoogleClientSecret == "" {
		return nil, fmt.Errorf("google_drive account %s cannot be used: server OAuth client is not configured", account.ID)
	}

	rootFolder := "root"
	if len(account.Settings) > 0 {
		var settings struct {
			RootFolderID string `json:"root_folder_id"`
		}
		if err := json.Unmarshal(account.Settings, &settings); err == nil && settings.RootFolderID != "" {
			rootFolder = settings.RootFolderID
		}
	}

	conf := &oauth2.Config{
		ClientID:     reg.GoogleClientID,
		ClientSecret: reg.GoogleClientSecret,
		Endpoint:     google.Endpoint,
	}

	token := &oauth2.Token{RefreshToken: refreshToken, Expiry: time.Now().Add(-time.Minute)}

	return &gdriveConnector{
		reg:        reg,
		accountID:  account.ID.String(),
		rootFolder: rootFolder,
		tokenSrc:   conf.TokenSource(context.Background(), token),
		paths:      map[string]driveFile{},
	}, nil
}

// client returns an HTTP client with a fresh access token attached.
func (c *gdriveConnector) client(ctx context.Context) (*http.Client, error) {
	client := oauth2.NewClient(ctx, c.tokenSrc)
	return client, nil
}

func (c *gdriveConnector) driveError(resp *http.Response, op string) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	return errtrace.Errorf("drive %s failed: status %d: %s", op, resp.StatusCode, strings.TrimSpace(string(body)))
}

// PutObject uploads the payload as one Drive file via the simple media
// upload. Streaming multipart against Drive is delegated to the gateway's
// staging path (CompleteMultipartUpload after buffering parts locally).
func (c *gdriveConnector) PutObject(ctx context.Context, key string, r io.Reader, size int64, contentType string) (Object, error) {
	client, err := c.client(ctx)
	if err != nil {
		return Object{}, err
	}

	parentID, err := c.ensureParent(ctx, client, key)
	if err != nil {
		return Object{}, err
	}

	name := baseName(key)
	meta, _ := json.Marshal(map[string]any{"name": name, "parents": []string{parentID}})

	uploadURL := driveAPI + "/files?uploadType=multipart"
	body := &bytes.Buffer{}
	body.WriteString("--crboundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n")
	body.Write(meta)
	body.WriteString("\r\n--crboundary\r\nContent-Type: ")
	body.WriteString(contentType)
	body.WriteString("\r\n\r\n")
	if _, err := io.Copy(body, r); err != nil {
		return Object{}, errtrace.Wrap(err)
	}
	body.WriteString("\r\n--crboundary--")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, body)
	if err != nil {
		return Object{}, errtrace.Wrap(err)
	}
	req.Header.Set("Content-Type", "multipart/related; boundary=crboundary")

	resp, err := client.Do(req)
	if err != nil {
		return Object{}, errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return Object{}, c.driveError(resp, "upload")
	}

	var file driveFile
	if err := json.NewDecoder(resp.Body).Decode(&file); err != nil {
		return Object{}, errtrace.Wrap(err)
	}

	c.remember(key, file)

	return Object{Key: key, Size: file.Size, ETag: file.ID, LastModified: file.ModTime}, nil
}

// resolve walks the key's path segments, creating missing folders, and
// returns the id of the immediate parent folder.
func (c *gdriveConnector) ensureParent(ctx context.Context, client *http.Client, key string) (string, error) {
	segments := strings.Split(pathDir(key), "/")
	parent := c.rootFolder

	current := ""
	for _, seg := range segments {
		if seg == "" {
			continue
		}
		if current != "" {
			current += "/"
		}
		current += seg

		file, ok, err := c.lookup(ctx, client, current, parent)
		if err != nil {
			return "", err
		}
		if !ok {
			created, err := c.createFolder(ctx, client, parent, seg)
			if err != nil {
				return "", err
			}
			file = created
		}
		parent = file.ID
		c.remember(current, file)
	}

	return parent, nil
}

// lookup searches Drive for an entry with the exact name under the parent.
func (c *gdriveConnector) lookup(ctx context.Context, client *http.Client, key, parentID string) (driveFile, bool, error) {
	if file, ok := c.cached(key); ok {
		return file, true, nil
	}

	q := fmt.Sprintf("name = %q and %q in parents and trashed = false", baseName(key), parentID)
	endpoint := driveAPI + "/files?q=" + url.QueryEscape(q) + "&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=2"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return driveFile{}, false, errtrace.Wrap(err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return driveFile{}, false, errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return driveFile{}, false, c.driveError(resp, "lookup")
	}

	var result struct {
		Files []driveFile `json:"files"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return driveFile{}, false, errtrace.Wrap(err)
	}

	if len(result.Files) == 0 {
		return driveFile{}, false, nil
	}

	c.remember(key, result.Files[0])
	return result.Files[0], true, nil
}

func (c *gdriveConnector) createFolder(ctx context.Context, client *http.Client, parentID, name string) (driveFile, error) {
	meta, _ := json.Marshal(map[string]any{
		"name":     name,
		"parents":  []string{parentID},
		"mimeType": "application/vnd.google-apps.folder",
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, driveAPI+"/files?fields=id,name,mimeType", bytes.NewReader(meta))
	if err != nil {
		return driveFile{}, errtrace.Wrap(err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return driveFile{}, errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return driveFile{}, c.driveError(resp, "create folder")
	}

	var file driveFile
	if err := json.NewDecoder(resp.Body).Decode(&file); err != nil {
		return driveFile{}, errtrace.Wrap(err)
	}

	return file, nil
}

func (c *gdriveConnector) GetObject(ctx context.Context, key string) (io.ReadCloser, Object, error) {
	client, err := c.client(ctx)
	if err != nil {
		return nil, Object{}, err
	}

	file, ok, err := c.lookup(ctx, client, key, c.rootFolder)
	if err != nil {
		return nil, Object{}, err
	}
	if !ok {
		return nil, Object{}, errNotFound(key)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, driveAPI+"/files/"+file.ID+"?alt=media", nil)
	if err != nil {
		return nil, Object{}, errtrace.Wrap(err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, Object{}, errtrace.Wrap(err)
	}

	if resp.StatusCode >= 300 {
		defer resp.Body.Close()
		return nil, Object{}, c.driveError(resp, "download")
	}

	return resp.Body, Object{Key: key, Size: file.Size, ETag: file.ID, LastModified: file.ModTime}, nil
}

func (c *gdriveConnector) StatObject(ctx context.Context, key string) (Object, error) {
	client, err := c.client(ctx)
	if err != nil {
		return Object{}, err
	}

	file, ok, err := c.lookup(ctx, client, key, c.rootFolder)
	if err != nil {
		return Object{}, err
	}
	if !ok {
		return Object{}, errNotFound(key)
	}

	return Object{Key: key, Size: file.Size, ETag: file.ID, LastModified: file.ModTime}, nil
}

func (c *gdriveConnector) DeleteObject(ctx context.Context, key string) error {
	client, err := c.client(ctx)
	if err != nil {
		return err
	}

	file, ok, err := c.lookup(ctx, client, key, c.rootFolder)
	if err != nil {
		return err
	}
	if !ok {
		return errNotFound(key)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, driveAPI+"/files/"+file.ID, nil)
	if err != nil {
		return errtrace.Wrap(err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return c.driveError(resp, "delete")
	}

	c.forget(key)
	return nil
}

// ListObjects lists files directly under the key prefix using Drive's parent
// query. Only the immediate children of the prefix's folder are returned;
// delimiter semantics ("directories") do not map cleanly onto Drive, so the
// gateway callers should pass an empty delimiter for this backend.
func (c *gdriveConnector) ListObjects(ctx context.Context, prefix, delimiter, continuationToken string, maxKeys int) (ListPage, error) {
	client, err := c.client(ctx)
	if err != nil {
		return ListPage{}, err
	}

	folderID := c.rootFolder
	if prefix != "" {
		file, ok, err := c.lookup(ctx, client, strings.TrimSuffix(prefix, "/"), c.rootFolder)
		if err != nil {
			return ListPage{}, err
		}
		if ok {
			folderID = file.ID
		} else {
			return ListPage{}, nil
		}
	}

	q := fmt.Sprintf("%q in parents and trashed = false", folderID)
	if maxKeys <= 0 {
		maxKeys = 1000
	}
	endpoint := fmt.Sprintf("%s/files?q=%s&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime)&pageSize=%d", driveAPI, url.QueryEscape(q), maxKeys)
	if continuationToken != "" {
		endpoint += "&pageToken=" + url.QueryEscape(continuationToken)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return ListPage{}, errtrace.Wrap(err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return ListPage{}, errtrace.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return ListPage{}, c.driveError(resp, "list")
	}

	var result struct {
		NextPageToken string      `json:"nextPageToken"`
		Files         []driveFile `json:"files"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return ListPage{}, errtrace.Wrap(err)
	}

	page := ListPage{IsTruncated: result.NextPageToken != "", NextContinuationToken: result.NextPageToken}
	for _, f := range result.Files {
		key := f.Name
		if prefix != "" && !strings.HasSuffix(prefix, "/") {
			key = prefix + "/" + f.Name
		} else if prefix != "" {
			key = prefix + f.Name
		}
		c.remember(key, f)

		obj := Object{Key: key, ETag: f.ID, LastModified: f.ModTime}
		if f.MimeType != "application/vnd.google-apps.folder" {
			obj.Size = f.Size
		}
		page.Objects = append(page.Objects, obj)
	}

	return page, nil
}

// Multipart on Drive is staged locally: parts are written to StagingDir and
// joined on Complete, then uploaded as one file. Staging files survive across
// gateway requests because the upload ID doubles as the staging directory
// name.

type gdriveStagingKey struct {
	UploadID string
}

func (c *gdriveConnector) stagingDir(uploadID string) string {
	base := c.reg.StagingDir
	if base == "" {
		base = os.TempDir()
	}
	return filepath.Join(base, "cloudrive-gdrive-multipart", uploadID)
}

func (c *gdriveConnector) CreateMultipartUpload(ctx context.Context, key, contentType string) (MultipartInfo, error) {
	uploadID, err := newUploadID()
	if err != nil {
		return MultipartInfo{}, err
	}

	dir := c.stagingDir(uploadID)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return MultipartInfo{}, errtrace.Wrap(err)
	}

	if err := os.WriteFile(filepath.Join(dir, "key"), []byte(key), 0o600); err != nil {
		return MultipartInfo{}, errtrace.Wrap(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "content_type"), []byte(contentType), 0o600); err != nil {
		return MultipartInfo{}, errtrace.Wrap(err)
	}

	return MultipartInfo{UploadID: uploadID}, nil
}

func (c *gdriveConnector) UploadPart(ctx context.Context, key, uploadID string, partNumber int, r io.Reader, size int64) (string, error) {
	dir := c.stagingDir(uploadID)
	path := filepath.Join(dir, fmt.Sprintf("part-%05d", partNumber))

	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return "", errtrace.Wrap(err)
	}
	defer f.Close()

	written, err := io.Copy(f, r)
	if err != nil {
		return "", errtrace.Wrap(err)
	}

	// The etag returned to the client is the staging filename's checksum-free
	// identifier; completeness is verified by part presence on Complete.
	return fmt.Sprintf("part-%05d", partNumber), validatePartSize(written, size)
}

func (c *gdriveConnector) CompleteMultipartUpload(ctx context.Context, key, uploadID string, parts []CompletedPart) (Object, error) {
	dir := c.stagingDir(uploadID)

	storedKey, err := os.ReadFile(filepath.Join(dir, "key"))
	if err != nil {
		return Object{}, errtrace.Errorf("unknown upload id %s", uploadID)
	}
	if string(storedKey) != key {
		return Object{}, errtrace.Errorf("upload id %s does not match key %q", uploadID, key)
	}

	sort.Slice(parts, func(i, j int) bool { return parts[i].PartNumber < parts[j].PartNumber })

	joined, err := os.CreateTemp(dir, "joined-*")
	if err != nil {
		return Object{}, errtrace.Wrap(err)
	}
	defer os.Remove(joined.Name())
	defer joined.Close()

	var total int64
	for _, p := range parts {
		partPath := filepath.Join(dir, fmt.Sprintf("part-%05d", p.PartNumber))
		partFile, err := os.Open(partPath)
		if err != nil {
			return Object{}, errtrace.Errorf("missing part %d", p.PartNumber)
		}
		n, err := io.Copy(joined, partFile)
		partFile.Close()
		if err != nil {
			return Object{}, errtrace.Wrap(err)
		}
		total += n
	}

	if _, err := joined.Seek(0, io.SeekStart); err != nil {
		return Object{}, errtrace.Wrap(err)
	}

	contentTypeBytes, err := os.ReadFile(filepath.Join(dir, "content_type"))
	if err != nil {
		contentTypeBytes = []byte("application/octet-stream")
	}

	obj, err := c.PutObject(ctx, key, joined, total, string(contentTypeBytes))
	if err != nil {
		return Object{}, err
	}

	_ = os.RemoveAll(dir)
	return obj, nil
}

func (c *gdriveConnector) AbortMultipartUpload(ctx context.Context, key, uploadID string) error {
	return errtrace.Wrap(os.RemoveAll(c.stagingDir(uploadID)))
}

// --- path helpers and the path → file cache ---

func (c *gdriveConnector) cached(key string) (driveFile, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	file, ok := c.paths[key]
	return file, ok
}

func (c *gdriveConnector) remember(key string, file driveFile) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.paths[key] = file
}

func (c *gdriveConnector) forget(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.paths, key)
}

func baseName(key string) string {
	if i := strings.LastIndex(key, "/"); i >= 0 {
		return key[i+1:]
	}
	return key
}

func pathDir(key string) string {
	if i := strings.LastIndex(key, "/"); i >= 0 {
		return key[:i]
	}
	return ""
}

func validatePartSize(written, expected int64) error {
	if expected > 0 && written != expected {
		return errtrace.Errorf("part size mismatch: expected %d bytes, read %d", expected, written)
	}
	return nil
}

func newUploadID() (string, error) {
	b := make([]byte, 16)
	if _, err := randRead(b); err != nil {
		return "", errtrace.Wrap(err)
	}
	return fmt.Sprintf("%x", b), nil
}
