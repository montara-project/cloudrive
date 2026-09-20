package s3api

import (
	"io"
	"strings"
	"testing"
)

func TestAWSChunkedDecoder(t *testing.T) {
	// minio-go/aws-cli wire format: size hex + chunk signature, CRLF,
	// payload, CRLF; final zero chunk, then optional trailer, blank line.
	body := "10000;chunk-signature=ad80c748a21e07fbb04388fe1a2eb4b8d0a6a13386033a22b0e8b0db6b635e6b\r\n" +
		strings.Repeat("a", 0x10000) + "\r\n" +
		"0;chunk-signature=5f2a4c1c1e3f2b2f1e0d0c0b0a09080706050403020100ffeeddccbbaa998877\r\n\r\n"

	r := newAWSChunkedReader(strings.NewReader(body))
	got, err := io.ReadAll(r)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if len(got) != 0x10000 || strings.Count(string(got), "a") != 0x10000 {
		t.Fatalf("decoded %d bytes, want %d", len(got), 0x10000)
	}
}

func TestAWSChunkedDecoderMultiChunk(t *testing.T) {
	var b strings.Builder
	for i := 0; i < 3; i++ {
		b.WriteString("4;chunk-signature=00\r\nabcd\r\n")
	}
	b.WriteString("0;chunk-signature=00\r\n\r\n")

	got, err := io.ReadAll(newAWSChunkedReader(strings.NewReader(b.String())))
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if string(got) != "abcdabcdabcd" {
		t.Fatalf("got %q", got)
	}
}

func TestAWSChunkedDecoderTrailer(t *testing.T) {
	body := "4;chunk-signature=00\r\nabcd\r\n" +
		"0;chunk-signature=00\r\n" +
		"x-amz-checksum-crc32c:AAAAAA==\r\n\r\n"

	got, err := io.ReadAll(newAWSChunkedReader(strings.NewReader(body)))
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if string(got) != "abcd" {
		t.Fatalf("got %q", got)
	}
}
