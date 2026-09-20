package s3api

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"

	"braces.dev/errtrace"
)

// errMalformedChunk signals a broken aws-chunked body.
var errMalformedChunk = errors.New("malformed aws-chunked payload")

// awsChunkedReader decodes the S3 streaming-signature wire format:
//
//	<hex-size>[;chunk-signature=<64 hex>]\r\n
//	<size bytes of payload>\r\n
//	... repeated ...
//	0[;chunk-signature=...]\r\n
//	[trailer headers\r\n]*
//	\r\n
//
// The chunk signatures are already covered by the seed-signature check in
// the sigv4 verifier; this reader only extracts the payload bytes so the
// connectors receive the raw object content.
type awsChunkedReader struct {
	src     *bufio.Reader
	payload io.Reader // current chunk's payload (limited)
	done    bool
}

func newAWSChunkedReader(r io.Reader) *awsChunkedReader {
	return &awsChunkedReader{src: bufio.NewReader(r)}
}

// isAWSChunked reports whether the request body uses streaming-signature
// chunk encoding.
func isAWSChunked(contentSHA256, contentEncoding string) bool {
	if strings.HasPrefix(contentSHA256, "STREAMING-AWS4-HMAC-SHA256") {
		return true
	}
	for _, enc := range strings.Split(contentEncoding, ",") {
		if strings.TrimSpace(enc) == "aws-chunked" {
			return true
		}
	}
	return false
}

// decodedContentLength returns the payload length declared by the client,
// or -1 when absent.
func decodedContentLength(header string) int64 {
	if header == "" {
		return -1
	}
	n, err := strconv.ParseInt(header, 10, 64)
	if err != nil {
		return -1
	}
	return n
}

func (r *awsChunkedReader) Read(p []byte) (int, error) {
	for {
		if r.done {
			return 0, io.EOF
		}
		if r.payload != nil {
			n, err := r.payload.Read(p)
			if err == io.EOF {
				r.payload = nil
				// Consume the CRLF terminating the chunk payload.
				if _, cerr := r.src.Discard(2); cerr != nil && cerr != io.EOF {
					return 0, cerr
				}
				if n == 0 {
					continue
				}
				return n, nil
			}
			return n, err
		}

		// Read the chunk header line.
		line, err := readLine(r.src)
		if err != nil {
			if err == io.EOF {
				r.done = true
				return 0, io.EOF
			}
			return 0, err
		}

		sizePart, _, _ := strings.Cut(line, ";")
		size, perr := strconv.ParseInt(sizePart, 16, 64)
		if perr != nil {
			return 0, errtrace.Wrap(fmt.Errorf("%w: %q", errMalformedChunk, line))
		}

		if size == 0 {
			// Trailer headers may follow until the blank line; drain them.
			r.done = true
			return 0, io.EOF
		}

		r.payload = io.LimitReader(r.src, size)
	}
}

// readLine reads one CRLF-terminated header line.
func readLine(src *bufio.Reader) (string, error) {
	var b bytes.Buffer
	for {
		chunk, err := src.ReadSlice('\n')
		b.Write(chunk)
		if err == bufio.ErrBufferFull {
			continue
		}
		if err != nil {
			if err == io.EOF && b.Len() > 0 {
				return strings.TrimSuffix(b.String(), "\n"), nil
			}
			return "", err
		}
		return strings.TrimRight(b.String(), "\r\n"), nil
	}
}
