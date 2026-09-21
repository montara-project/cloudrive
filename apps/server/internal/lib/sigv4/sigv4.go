// Package sigv4 verifies AWS Signature Version 4 requests (header-based and
// presigned-query variants) against Cloudrive-issued access keys.
//
// The gateway receives the raw *http.Request plus the caller's secret; the
// canonical request is rebuilt exactly as the client built it (AWS docs:
// "Signature Calculations for the Authorization Header" and "Creating
// Presigned URLs"). Payload hashing supports UNSIGNED-PAYLOAD for presigned
// PUTs; the streaming variant STREAMING-AWS4-HMAC-SHA256-PAYLOAD is verified
// against the seed signature of the first chunk (the exact payload hash is
// unknowable before reading the stream, so S3-compatible gateways commonly
// accept it this way — MinIO included).
package sigv4

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	algorithm        = "AWS4-HMAC-SHA256"
	timeFormat       = "20060102T150405Z"
	dateFormat       = "20060102"
	unsignedPayload  = "UNSIGNED-PAYLOAD"
	streamingPayload = "STREAMING-AWS4-HMAC-SHA256-PAYLOAD"
	emptyPayload     = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
	// amzMaxClockSkew allows for client/server clock drift on signed requests.
	amzMaxClockSkew = 15 * time.Minute
)

var (
	ErrMalformedAuthorization = errors.New("malformed Authorization header")
	ErrUnsupportedAlgorithm   = errors.New("unsupported signing algorithm")
	ErrSignatureMismatch      = errors.New("signature does not match")
	ErrExpired                = errors.New("request signature expired")
	ErrClockSkew              = errors.New("request time too skewed")
)

// Result carries what verification resolved from the request.
type Result struct {
	AccessKeyID string
	Region      string
	Service     string
	// Presigned is true when the signature came from the query string
	// (X-Amz-Signature) rather than the Authorization header.
	Presigned bool
}

// hopByHopHeaders are never part of the canonical headers; some proxies add
// or rewrite them.
var hopByHopHeaders = map[string]bool{
	"connection": true, "keep-alive": true, "proxy-authenticate": true,
	"proxy-authorization": true, "te": true, "trailers": true,
	"transfer-encoding": true, "upgrade": true, "user-agent": true,
	"content-length": true, "expect": true, "authorization": true,
}

// Verify checks the request's SigV4 signature against secretKey.
func Verify(r *http.Request, secretKey []byte) (Result, error) {
	if sig := r.URL.Query().Get("X-Amz-Signature"); sig != "" {
		return verifyPresigned(r, secretKey)
	}
	return verifyHeader(r, secretKey)
}

// --- header-based (Authorization header) ---

func verifyHeader(r *http.Request, secretKey []byte) (Result, error) {
	res := Result{}

	auth := r.Header.Get("Authorization")
	credential, signedHeaders, providedSig, err := parseAuthorization(auth)
	if err != nil {
		return res, err
	}

	// credential: <access-key>/<date>/<region>/<service>/aws4_request
	credParts := strings.Split(credential, "/")
	if len(credParts) != 5 || credParts[4] != "aws4_request" {
		return res, ErrMalformedAuthorization
	}
	res.AccessKeyID, res.Region, res.Service = credParts[0], credParts[2], credParts[3]

	amzDate := r.Header.Get("X-Amz-Date")
	if amzDate == "" {
		return res, ErrMalformedAuthorization
	}

	signedTime, err := time.Parse(timeFormat, amzDate)
	if err != nil {
		return res, ErrMalformedAuthorization
	}
	if skew := time.Since(signedTime); skew > amzMaxClockSkew || skew < -amzMaxClockSkew {
		return res, ErrClockSkew
	}

	canonical := canonicalRequest(r, signedHeaders, payloadHash(r))
	stringToSign := stringToSign(amzDate, res.Region, res.Service, canonical)
	expected := hmacSHA256Hex(deriveSigningKey(secretKey, signedTime, res.Region, res.Service), stringToSign)

	if !hmac.Equal([]byte(expected), []byte(providedSig)) {
		return res, ErrSignatureMismatch
	}

	return res, nil
}

func parseAuthorization(auth string) (credential, signedHeaders, signature string, err error) {
	const prefix = algorithm + " "
	if !strings.HasPrefix(auth, prefix) {
		return "", "", "", ErrUnsupportedAlgorithm
	}

	fields := map[string]string{}
	for _, part := range strings.Split(strings.TrimPrefix(auth, prefix), ",") {
		k, v, found := strings.Cut(strings.TrimSpace(part), "=")
		if !found {
			return "", "", "", ErrMalformedAuthorization
		}
		fields[k] = v
	}

	credential = fields["Credential"]
	signedHeaders = fields["SignedHeaders"]
	signature = fields["Signature"]
	if credential == "" || signedHeaders == "" || signature == "" {
		return "", "", "", ErrMalformedAuthorization
	}

	return credential, signedHeaders, signature, nil
}

// --- presigned (query string) ---

func verifyPresigned(r *http.Request, secretKey []byte) (Result, error) {
	res := Result{Presigned: true}
	q := r.URL.Query()

	res.AccessKeyID = q.Get("X-Amz-Credential")
	// X-Amz-Credential is <access-key>/<date>/<region>/<service>/aws4_request.
	credParts := strings.Split(res.AccessKeyID, "/")
	if len(credParts) != 5 || credParts[4] != "aws4_request" {
		return res, ErrMalformedAuthorization
	}
	res.AccessKeyID, res.Region, res.Service = credParts[0], credParts[2], credParts[3]

	signedHeaders := q.Get("X-Amz-SignedHeaders")
	amzDate := q.Get("X-Amz-Date")
	providedSig := q.Get("X-Amz-Signature")
	if signedHeaders == "" || amzDate == "" || providedSig == "" {
		return res, ErrMalformedAuthorization
	}

	signedTime, err := time.Parse(timeFormat, amzDate)
	if err != nil {
		return res, ErrMalformedAuthorization
	}

	// Presigned URLs must expire: X-Amz-Expires seconds after signing.
	expires, err := strconv.ParseInt(q.Get("X-Amz-Expires"), 10, 64)
	if err != nil || expires < 1 || expires > 604800 {
		return res, ErrMalformedAuthorization
	}
	if time.Since(signedTime) > time.Duration(expires)*time.Second {
		return res, ErrExpired
	}

	// The signature is computed over the query without X-Amz-Signature.
	canonical := canonicalPresignedRequest(r, signedHeaders)
	stringToSign := stringToSign(amzDate, res.Region, res.Service, canonical)
	expected := hmacSHA256Hex(deriveSigningKey(secretKey, signedTime, res.Region, res.Service), stringToSign)

	if !hmac.Equal([]byte(expected), []byte(providedSig)) {
		return res, ErrSignatureMismatch
	}

	return res, nil
}

// --- canonical request construction ---

func payloadHash(r *http.Request) string {
	if h := r.Header.Get("X-Amz-Content-Sha256"); h != "" {
		return h
	}
	if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodDelete {
		return emptyPayload
	}
	// Body-bearing requests without an explicit hash: S3 clients PUT with
	// either the computed hash or the streaming header; treat the streaming
	// header's value as authoritative (it is the only verifiable option
	// without buffering the whole body).
	return streamingPayload
}

func canonicalRequest(r *http.Request, signedHeaders, payloadHashValue string) string {
	var b strings.Builder
	b.WriteString(r.Method)
	b.WriteByte('\n')

	b.WriteString(canonicalURI(r))
	b.WriteByte('\n')

	b.WriteString(canonicalQuery(r))
	b.WriteByte('\n')

	b.WriteString(canonicalHeaders(r, signedHeaders))
	b.WriteByte('\n')

	b.WriteString(signedHeaders)
	b.WriteByte('\n')

	b.WriteString(payloadHashValue)
	return b.String()
}

// canonicalPresignedRequest is the presigned variant: the payload hash slot
// is always UNSIGNED-PAYLOAD and the query excludes X-Amz-Signature.
func canonicalPresignedRequest(r *http.Request, signedHeaders string) string {
	var b strings.Builder
	b.WriteString(r.Method)
	b.WriteByte('\n')
	b.WriteString(canonicalURI(r))
	b.WriteByte('\n')
	b.WriteString(canonicalQueryExcludingSignature(r))
	b.WriteByte('\n')
	b.WriteString(canonicalHeaders(r, signedHeaders))
	b.WriteByte('\n')
	b.WriteString(signedHeaders)
	b.WriteByte('\n')
	b.WriteString(unsignedPayload)
	return b.String()
}

func canonicalURI(r *http.Request) string {
	// S3 path-style: the URI is the raw, un-normalized path, URI-encoded once
	// (every segment character except unreserved set). Go's URL.EscapedPath
	// preserves the original encoding, which is what the client signed.
	path := r.URL.EscapedPath()
	if path == "" {
		return "/"
	}
	return path
}

func canonicalQuery(r *http.Request) string {
	return encodeQuery(r.URL.Query(), false)
}

func canonicalQueryExcludingSignature(r *http.Request) string {
	q := r.URL.Query()
	q.Del("X-Amz-Signature")
	return encodeQuery(q, false)
}

// encodeQuery sorts keys (then values) and URI-encodes per RFC 3986
// (strict: space and everything outside the unreserved set must be %XX).
func encodeQuery(q url.Values, _ bool) string {
	keys := make([]string, 0, len(q))
	for k := range q {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var b strings.Builder
	for _, k := range keys {
		ek := uriEncode(k, true)
		values := append([]string{}, q[k]...)
		sort.Strings(values)
		for _, v := range values {
			if b.Len() > 0 {
				b.WriteByte('&')
			}
			b.WriteString(ek)
			b.WriteByte('=')
			b.WriteString(uriEncode(v, true))
		}
	}
	return b.String()
}

func canonicalHeaders(r *http.Request, signedHeaders string) string {
	var b strings.Builder
	for _, name := range strings.Split(signedHeaders, ";") {
		lower := strings.ToLower(name)
		if hopByHopHeaders[lower] {
			// Some clients sign content-length; honor what was signed for
			// known-safe headers but skip proxy-injected hop-by-hop ones.
			if lower != "content-length" {
				continue
			}
		}
		values := r.Header.Values(http.CanonicalHeaderKey(name))
		if lower == "host" && len(values) == 0 {
			values = []string{r.Host}
		}
		trimmed := make([]string, 0, len(values))
		for _, v := range values {
			trimmed = append(trimmed, collapseSpaces(strings.TrimSpace(v)))
		}
		b.WriteString(lower)
		b.WriteByte(':')
		b.WriteString(strings.Join(trimmed, ","))
		b.WriteByte('\n')
	}
	return b.String()
}

// collapseSpaces trims and collapses internal runs of spaces per SigV4 rules.
func collapseSpaces(s string) string {
	fields := strings.Fields(s)
	return strings.Join(fields, " ")
}

func stringToSign(amzDate, region, service, canonical string) string {
	scope := strings.Join([]string{amzDate[:8], region, service, "aws4_request"}, "/")
	var b strings.Builder
	b.WriteString(algorithm)
	b.WriteByte('\n')
	b.WriteString(amzDate)
	b.WriteByte('\n')
	b.WriteString(scope)
	b.WriteByte('\n')
	b.WriteString(sha256Hex([]byte(canonical)))
	return b.String()
}

func deriveSigningKey(secret []byte, signed time.Time, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+string(secret)), signed.Format(dateFormat))
	kRegion := hmacSHA256(kDate, region)
	kService := hmacSHA256(kRegion, service)
	return hmacSHA256(kService, "aws4_request")
}

// --- crypto helpers ---

func hmacSHA256(key []byte, data string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(data))
	return h.Sum(nil)
}

func hmacSHA256Hex(key []byte, data string) string {
	return hex.EncodeToString(hmacSHA256(key, data))
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// uriEncode percent-encodes every byte except the RFC 3986 unreserved set.
// encodeSlash controls whether '/' becomes %2F (true for query components).
func uriEncode(s string, encodeSlash bool) string {
	const hexDigits = "0123456789ABCDEF"
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		ch := s[i]
		switch {
		case ch >= 'A' && ch <= 'Z', ch >= 'a' && ch <= 'z', ch >= '0' && ch <= '9',
			ch == '-', ch == '_', ch == '.', ch == '~':
			b.WriteByte(ch)
		case ch == '/' && !encodeSlash:
			b.WriteByte(ch)
		default:
			b.WriteByte('%')
			b.WriteByte(hexDigits[ch>>4])
			b.WriteByte(hexDigits[ch&0x0f])
		}
	}
	return b.String()
}
