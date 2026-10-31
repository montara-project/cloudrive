package connectors

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net"
	"os"
	"path"
	"sort"
	"strings"
	"time"

	smb2 "github.com/cloudsoda/go-smb2"
)

// smbDialTimeout bounds the TCP connect to the SMB server. Negotiation,
// authentication, and every file operation ride on the request context
// instead, so a wedded server cannot pin gateway goroutines forever.
const smbDialTimeout = 10 * time.Second

// smbConnector maps an S3-style key namespace ("/"-separated keys) onto one
// SMB share ("\"-separated paths): the key "a/b/c.txt" becomes the file
// "a\b\c.txt" on \\host\share, optionally under a root_prefix subdirectory.
//
// The connector is created per request by the Registry. SMB sessions cannot
// be shared across goroutines of different requests anyway, so every
// operation dials, mounts, and logs off on its own — except GetObject, whose
// returned reader owns the session and tears it down on Close.
type smbConnector struct {
	accountID string
	host      string
	port      string
	share     string // share name only; the \\host\ prefix is added on mount
	username  string // empty for guest/anonymous where the server allows it
	password  string
	domain    string
	// rootPrefix is a subdirectory of the share acting as the bucket root,
	// in gateway form ("/"-separated, no leading/trailing slash).
	rootPrefix string
	stagingDir string // multipart staging base (Registry.StagingDir)
}

func newSMBConnector(account AccountInput, creds Credentials, stagingDir string) (*smbConnector, error) {
	host := creds.string("host")
	share := creds.string("share")
	if host == "" || share == "" {
		return nil, fmt.Errorf("smb account %s requires host and share credentials", account.ID)
	}
	if strings.ContainsAny(share, `\/`) {
		return nil, fmt.Errorf("smb account %s has an invalid share name %q", account.ID, share)
	}

	port := creds.string("port")
	if port == "" {
		port = "445"
	}

	// The share and root prefix can be overridden in settings, like the S3
	// bucket override, so one set of credentials can serve several accounts
	// on the same server.
	shareOverride := creds.string("share")
	rootPrefix := ""
	if len(account.Settings) > 0 {
		var settings struct {
			Share      *string `json:"share"`
			RootPrefix string  `json:"root_prefix"`
		}
		if err := json.Unmarshal(account.Settings, &settings); err == nil {
			if settings.Share != nil && *settings.Share != "" {
				shareOverride = *settings.Share
			}
			rootPrefix = strings.Trim(settings.RootPrefix, "/")
		}
	}
	if shareOverride != "" {
		if strings.ContainsAny(shareOverride, `\/`) {
			return nil, fmt.Errorf("smb account %s has an invalid share name %q", account.ID, shareOverride)
		}
		share = shareOverride
	}

	return &smbConnector{
		accountID:  account.ID.String(),
		host:       host,
		port:       port,
		share:      share,
		username:   creds.string("username"),
		password:   creds.string("password"),
		domain:     creds.string("domain"),
		rootPrefix: rootPrefix,
		stagingDir: stagingDir,
	}, nil
}

// smbSession is one live SMB connection: a TCP transport, an authenticated
// session, and one mounted tree share. close is idempotent enough — every
// step ignores its error.
type smbSession struct {
	conn    net.Conn
	session *smb2.Session
	share   *smb2.Share
}

// dial connects to the server, authenticates, and mounts the share.
func (c *smbConnector) dial(ctx context.Context) (*smbSession, error) {
	address := net.JoinHostPort(c.host, c.port)
	conn, err := net.DialTimeout("tcp", address, smbDialTimeout)
	if err != nil {
		return nil, fmt.Errorf("smb connect %s: %w", address, err)
	}

	d := &smb2.Dialer{
		Initiator: &smb2.NTLMInitiator{User: c.username, Password: c.password, Domain: c.domain},
	}
	session, err := d.DialConn(ctx, conn, address)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("smb handshake %s: %w", address, err)
	}

	share, err := session.Mount(`\\` + c.host + `\` + c.share)
	if err != nil {
		session.Logoff()
		conn.Close()
		return nil, fmt.Errorf("smb mount \\%s: %w", c.share, err)
	}

	return &smbSession{conn: conn, session: session, share: share.WithContext(ctx)}, nil
}

func (m *smbSession) close() {
	_ = m.share.Umount()
	_ = m.session.Logoff()
	_ = m.conn.Close()
}

// toSMBPath converts a gateway object key ("/"-separated) into a
// share-relative SMB path ("\"-separated), rejecting traversal and separator
// smuggles so a crafted key can never escape the share — or the root prefix —
// it is scoped to. The library also normalizes "/" on its side, but by
// validating here the guarantee does not depend on the client's behavior.
func toSMBPath(key string) (string, error) {
	if key == "" {
		return "", fmt.Errorf("empty object key")
	}
	segments := strings.Split(key, "/")
	for _, seg := range segments {
		switch seg {
		case "", ".", "..":
			return "", fmt.Errorf("invalid object key %q", key)
		}
		// "\" would be treated as a separator by the server, ":" selects
		// alternate data streams on Windows shares, NUL terminates nothing
		// good.
		if strings.ContainsAny(seg, `\:`) || strings.ContainsRune(seg, 0) {
			return "", fmt.Errorf("invalid object key %q", key)
		}
	}
	return strings.Join(segments, `\`), nil
}

// fullKey joins the root prefix with the gateway object key and renders it as
// a share-relative SMB path.
func (c *smbConnector) fullKey(key string) (string, error) {
	if c.rootPrefix != "" {
		key = c.rootPrefix + "/" + strings.TrimPrefix(key, "/")
	}
	return toSMBPath(key)
}

// fullDir maps a gateway listing prefix ("" = root) onto the share directory
// whose entries ListObjects returns. "." normalizes to the share root.
func (c *smbConnector) fullDir(prefix string) (string, error) {
	p := strings.Trim(prefix, "/")
	if p == "" {
		if c.rootPrefix == "" {
			return ".", nil
		}
		p = c.rootPrefix
	} else if c.rootPrefix != "" {
		p = c.rootPrefix + "/" + p
	}
	return toSMBPath(p)
}

func etagFor(info os.FileInfo) string {
	// SMB has no ETags; size + mtime is the stable fingerprint the gateway
	// clients compare against.
	return fmt.Sprintf("%x-%x", info.ModTime().Unix(), info.Size())
}

func contentTypeFor(key string) string {
	if t := mime.TypeByExtension(path.Ext(key)); t != "" {
		return t
	}
	return "application/octet-stream"
}

func smbOpError(op string, key string, err error) error {
	return fmt.Errorf("smb %s %q: %w", op, key, err)
}

func (c *smbConnector) PutObject(ctx context.Context, key string, r io.Reader, size int64, contentType string) (Object, error) {
	smbPath, err := c.fullKey(key)
	if err != nil {
		return Object{}, err
	}

	m, err := c.dial(ctx)
	if err != nil {
		return Object{}, err
	}
	defer m.close()

	if dir := smbDirOf(smbPath); dir != "" {
		if err := m.share.MkdirAll(dir, 0o755); err != nil {
			return Object{}, smbOpError("mkdir", dir, err)
		}
	}

	f, err := m.share.OpenFile(smbPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return Object{}, smbOpError("put", key, err)
	}
	defer f.Close()

	if _, err := io.Copy(f, r); err != nil {
		return Object{}, smbOpError("put", key, err)
	}

	info, err := f.Stat()
	if err != nil {
		return Object{}, smbOpError("stat", key, err)
	}

	return Object{
		Key:          key,
		Size:         info.Size(),
		ETag:         etagFor(info),
		ContentType:  contentType,
		LastModified: info.ModTime(),
	}, nil
}

// smbObjectReader is a GetObject stream that owns its session: closing it
// closes the file, unmounts the share, and logs off, so the connection cannot
// outlive the response that streams it.
type smbObjectReader struct {
	*smb2.File
	session *smbSession
}

func (r *smbObjectReader) Close() error {
	err := r.File.Close()
	r.session.close()
	return err
}

func (c *smbConnector) GetObject(ctx context.Context, key string) (io.ReadCloser, Object, error) {
	smbPath, err := c.fullKey(key)
	if err != nil {
		return nil, Object{}, err
	}

	m, err := c.dial(ctx)
	if err != nil {
		return nil, Object{}, err
	}

	f, err := m.share.OpenFile(smbPath, os.O_RDONLY, 0)
	if err != nil {
		m.close()
		if os.IsNotExist(err) {
			return nil, Object{}, errNotFound(key)
		}
		return nil, Object{}, smbOpError("get", key, err)
	}

	info, err := f.Stat()
	if err != nil {
		f.Close()
		m.close()
		return nil, Object{}, smbOpError("stat", key, err)
	}
	if info.IsDir() {
		f.Close()
		m.close()
		return nil, Object{}, errNotFound(key)
	}

	return &smbObjectReader{File: f, session: m}, Object{
		Key:          key,
		Size:         info.Size(),
		ETag:         etagFor(info),
		ContentType:  contentTypeFor(key),
		LastModified: info.ModTime(),
	}, nil
}

func (c *smbConnector) StatObject(ctx context.Context, key string) (Object, error) {
	smbPath, err := c.fullKey(key)
	if err != nil {
		return Object{}, err
	}

	m, err := c.dial(ctx)
	if err != nil {
		return Object{}, err
	}
	defer m.close()

	info, err := m.share.Stat(smbPath)
	if err != nil {
		if os.IsNotExist(err) {
			return Object{}, errNotFound(key)
		}
		return Object{}, smbOpError("stat", key, err)
	}
	// Directories are not objects; HEAD on a folder key misses like S3 does.
	if info.IsDir() {
		return Object{}, errNotFound(key)
	}

	return Object{
		Key:          key,
		Size:         info.Size(),
		ETag:         etagFor(info),
		ContentType:  contentTypeFor(key),
		LastModified: info.ModTime(),
	}, nil
}

func (c *smbConnector) DeleteObject(ctx context.Context, key string) error {
	smbPath, err := c.fullKey(strings.TrimSuffix(key, "/"))
	if err != nil {
		return err
	}

	m, err := c.dial(ctx)
	if err != nil {
		return err
	}
	defer m.close()

	info, err := m.share.Stat(smbPath)
	if err != nil {
		if os.IsNotExist(err) {
			// S3 DeleteObject succeeds on missing keys.
			return nil
		}
		return smbOpError("stat", key, err)
	}

	// A "folder" key deletes the whole subtree: the S3 API has no recursive
	// delete, so folder deletes from clients arrive as this single call.
	if info.IsDir() {
		return m.share.RemoveAll(smbPath)
	}
	return m.share.Remove(smbPath)
}

// ListObjects lists the immediate children of the prefix's folder. SMB has no
// server-side listing cursor — ReadDir returns a directory's entries in one
// round-trip — so the continuation token is an offset into that list, and
// delimiter semantics collapse to the same folder listing for both values
// (the gdrive connector makes the same simplification).
func (c *smbConnector) ListObjects(ctx context.Context, prefix, delimiter, continuationToken string, maxKeys int) (ListPage, error) {
	if maxKeys <= 0 {
		maxKeys = 1000
	}

	offset := 0
	if continuationToken != "" {
		var err error
		if offset, err = decodeSMBListOffset(continuationToken); err != nil {
			return ListPage{}, err
		}
	}

	dir, err := c.fullDir(prefix)
	if err != nil {
		return ListPage{}, err
	}

	m, err := c.dial(ctx)
	if err != nil {
		return ListPage{}, err
	}
	defer m.close()

	infos, err := m.share.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			// An unknown prefix lists empty, like S3.
			return ListPage{}, nil
		}
		return ListPage{}, smbOpError("readdir", dir, err)
	}

	base := ""
	if prefix != "" {
		base = strings.TrimSuffix(prefix, "/") + "/"
	}

	entries := infos
	if offset > 0 {
		if offset >= len(infos) {
			return ListPage{}, nil
		}
		entries = infos[offset:]
	}

	page := ListPage{}
	consumed := 0
	for _, info := range entries {
		if consumed == maxKeys {
			break
		}
		if info.IsDir() {
			page.CommonPrefixes = append(page.CommonPrefixes, base+info.Name()+"/")
		} else {
			page.Objects = append(page.Objects, Object{
				Key:          base + info.Name(),
				Size:         info.Size(),
				ETag:         etagFor(info),
				ContentType:  contentTypeFor(info.Name()),
				LastModified: info.ModTime(),
			})
		}
		consumed++
	}

	page.IsTruncated = consumed < len(entries)
	if page.IsTruncated {
		page.NextContinuationToken = encodeSMBListOffset(offset + consumed)
	}

	return page, nil
}

// --- multipart uploads, staged locally like on Google Drive ---
//
// SMB has no multipart concept: parts are buffered in StagingDir and joined
// into one PutObject on complete. Staging files survive across gateway
// requests because the upload ID doubles as the staging directory name.

func (c *smbConnector) multipartDir(uploadID string) (string, error) {
	if !uploadIDPattern.MatchString(uploadID) {
		return "", fmt.Errorf("invalid upload id")
	}
	base := c.stagingDir
	if base == "" {
		base = os.TempDir()
	}
	return path.Join(base, "cloudrive-smb-multipart", uploadID), nil
}

func (c *smbConnector) CreateMultipartUpload(ctx context.Context, key, contentType string) (MultipartInfo, error) {
	uploadID, err := newUploadID()
	if err != nil {
		return MultipartInfo{}, err
	}

	dir, err := c.multipartDir(uploadID)
	if err != nil {
		return MultipartInfo{}, err
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return MultipartInfo{}, err
	}

	if err := os.WriteFile(path.Join(dir, "key"), []byte(key), 0o600); err != nil {
		return MultipartInfo{}, err
	}
	if err := os.WriteFile(path.Join(dir, "content_type"), []byte(contentType), 0o600); err != nil {
		return MultipartInfo{}, err
	}

	return MultipartInfo{UploadID: uploadID}, nil
}

func (c *smbConnector) UploadPart(ctx context.Context, key, uploadID string, partNumber int, r io.Reader, size int64) (string, error) {
	dir, err := c.multipartDir(uploadID)
	if err != nil {
		return "", err
	}

	f, err := os.OpenFile(path.Join(dir, fmt.Sprintf("part-%05d", partNumber)), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return "", err
	}
	defer f.Close()

	written, err := io.Copy(f, r)
	if err != nil {
		return "", err
	}

	// The etag returned to the client is the staging part's identifier;
	// completeness is verified by part presence on complete.
	return fmt.Sprintf("part-%05d", partNumber), validatePartSize(written, size)
}

func (c *smbConnector) CompleteMultipartUpload(ctx context.Context, key, uploadID string, parts []CompletedPart) (Object, error) {
	dir, err := c.multipartDir(uploadID)
	if err != nil {
		return Object{}, err
	}

	storedKey, err := os.ReadFile(path.Join(dir, "key"))
	if err != nil {
		return Object{}, fmt.Errorf("unknown upload id %s", uploadID)
	}
	if string(storedKey) != key {
		return Object{}, fmt.Errorf("upload id %s does not match key %q", uploadID, key)
	}

	sort.Slice(parts, func(i, j int) bool { return parts[i].PartNumber < parts[j].PartNumber })

	joined, err := os.CreateTemp(dir, "joined-*")
	if err != nil {
		return Object{}, err
	}
	defer os.Remove(joined.Name())
	defer joined.Close()

	var total int64
	for _, p := range parts {
		partFile, err := os.Open(path.Join(dir, fmt.Sprintf("part-%05d", p.PartNumber)))
		if err != nil {
			return Object{}, fmt.Errorf("missing part %d", p.PartNumber)
		}
		n, err := io.Copy(joined, partFile)
		partFile.Close()
		if err != nil {
			return Object{}, err
		}
		total += n
	}

	if _, err := joined.Seek(0, io.SeekStart); err != nil {
		return Object{}, err
	}

	contentType, err := os.ReadFile(path.Join(dir, "content_type"))
	if err != nil {
		contentType = []byte("application/octet-stream")
	}

	obj, err := c.PutObject(ctx, key, joined, total, string(contentType))
	if err != nil {
		return Object{}, err
	}

	_ = os.RemoveAll(dir)
	return obj, nil
}

func (c *smbConnector) AbortMultipartUpload(ctx context.Context, key, uploadID string) error {
	dir, err := c.multipartDir(uploadID)
	if err != nil {
		return err
	}
	return os.RemoveAll(dir)
}

// smbDirOf returns the parent directory of a share path ("\"-separated), or
// "" when the path is a share-root child.
func smbDirOf(p string) string {
	if i := strings.LastIndex(p, `\`); i >= 0 {
		return p[:i]
	}
	return ""
}

// --- continuation tokens ---

// The SMB list continuation token is an offset wrapped in JSON and base64url
// encoded without padding, so it stays opaque to S3 clients and tolerates
// being round-tripped through any XML response.
type smbListToken struct {
	Offset int `json:"offset"`
}

func encodeSMBListOffset(offset int) string {
	b, _ := json.Marshal(smbListToken{Offset: offset})
	return base64.RawURLEncoding.EncodeToString(b)
}

func decodeSMBListOffset(token string) (int, error) {
	b, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return 0, fmt.Errorf("invalid continuation token")
	}
	var t smbListToken
	if err := json.Unmarshal(b, &t); err != nil || t.Offset < 0 {
		return 0, fmt.Errorf("invalid continuation token")
	}
	return t.Offset, nil
}
