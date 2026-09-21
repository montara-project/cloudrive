package sigv4

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func mustTime(amzDate string) time.Time {
	tm, err := time.Parse(timeFormat, amzDate)
	if err != nil {
		panic(err)
	}
	return tm
}

// nowAmzDate produces a current signed-time string for live-verification tests.
func nowAmzDate() string {
	return time.Now().UTC().Format(timeFormat)
}

// Test vectors from AWS docs "Signature Calculations for the Authorization
// Header: Transferring Payload in a Single Chunk" (GET, secret
// wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY) and the presigned URL example in
// "Authenticating Requests: Using Query Parameters (AWS Signature Version 4)".

const testSecret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

// The AWS GET example signs this exact request shape against us-east-1/s3.
func TestVerifyHeaderGETExample(t *testing.T) {
	// Build the request, then re-sign it with our own implementation to
	// confirm the canonical pipeline reproduces AWS's documented signature.
	amzDate := "20130524T000000Z"

	r := httptest.NewRequest("GET", "https://examplebucket.s3.amazonaws.com/test.txt", nil)
	r.Host = "examplebucket.s3.amazonaws.com"
	r.Header.Set("Range", "bytes=0-9")
	r.Header.Set("X-Amz-Date", amzDate)
	r.Header.Set("X-Amz-Content-Sha256", emptyPayload)

	canonical := canonicalRequest(r, "host;range;x-amz-content-sha256;x-amz-date", emptyPayload)
	// The documented canonical request for this example:
	const docCanonical = "GET\n/test.txt\n\nhost:examplebucket.s3.amazonaws.com\nrange:bytes=0-9\n" +
		"x-amz-content-sha256:" + emptyPayload + "\nx-amz-date:20130524T000000Z\n\n" +
		"host;range;x-amz-content-sha256;x-amz-date\n" + emptyPayload
	if canonical != docCanonical {
		t.Fatalf("canonical request mismatch:\n got: %q\nwant: %q", canonical, docCanonical)
	}

	// Documented string-to-sign and final signature:
	sts := stringToSign(amzDate, "us-east-1", "s3", canonical)
	const docSTS = "AWS4-HMAC-SHA256\n20130524T000000Z\n20130524/us-east-1/s3/aws4_request\n" +
		"7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972"
	if sts != docSTS {
		t.Fatalf("string-to-sign mismatch:\n got: %q\nwant: %q", sts, docSTS)
	}

	sig := hmacSHA256Hex(deriveSigningKey([]byte(testSecret), mustTime(amzDate), "us-east-1", "s3"), sts)
	// Documented signature for the GET example.
	const docSig = "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"
	if sig != docSig {
		t.Fatalf("signature mismatch: got %s want %s", sig, docSig)
	}

	// Full end-to-end: attach the Authorization header and run Verify. The
	// documented example date is decades old, so re-sign with a current
	// X-Amz-Date to pass the clock-skew check.
	now := nowAmzDate()
	r.Header.Set("X-Amz-Date", now)
	canonicalNow := canonicalRequest(r, "host;range;x-amz-content-sha256;x-amz-date", emptyPayload)
	sigNow := hmacSHA256Hex(
		deriveSigningKey([]byte(testSecret), mustTime(now), "us-east-1", "s3"),
		stringToSign(now, "us-east-1", "s3", canonicalNow),
	)
	r.Header.Set("Authorization",
		"AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/"+now[:8]+"/us-east-1/s3/aws4_request,"+
			"SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,Signature="+sigNow)

	res, err := Verify(r, []byte(testSecret))
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}
	if res.AccessKeyID != "AKIAIOSFODNN7EXAMPLE" || res.Region != "us-east-1" || res.Service != "s3" {
		t.Fatalf("unexpected result: %+v", res)
	}
}

// The AWS PUT example (single chunk, hash of "Welcome to Amazon S3.").
func TestVerifyHeaderPUTExample(t *testing.T) {
	amzDate := "20130524T000000Z"
	payloadHashValue := "44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072"

	r := httptest.NewRequest("PUT", "https://examplebucket.s3.amazonaws.com/test%24file.text", nil)
	r.Host = "examplebucket.s3.amazonaws.com"
	r.Header.Set("Date", "Fri, 24 May 2013 00:00:00 GMT")
	r.Header.Set("X-Amz-Date", amzDate)
	r.Header.Set("X-Amz-Storage-Class", "REDUCED_REDUNDANCY")
	r.Header.Set("X-Amz-Content-Sha256", payloadHashValue)

	canonical := canonicalRequest(r, "date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class", payloadHashValue)
	docCanonical := "PUT\n/test%24file.text\n\ndate:Fri, 24 May 2013 00:00:00 GMT\n" +
		"host:examplebucket.s3.amazonaws.com\nx-amz-content-sha256:" + payloadHashValue +
		"\nx-amz-date:20130524T000000Z\nx-amz-storage-class:REDUCED_REDUNDANCY\n\n" +
		"date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class\n" + payloadHashValue
	if canonical != docCanonical {
		t.Fatalf("canonical request mismatch:\n got: %q\nwant: %q", canonical, docCanonical)
	}

	sig := hmacSHA256Hex(
		deriveSigningKey([]byte(testSecret), mustTime(amzDate), "us-east-1", "s3"),
		stringToSign(amzDate, "us-east-1", "s3", canonical),
	)
	// Documented signature for the PUT example.
	const docSig = "98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd"
	if sig != docSig {
		t.Fatalf("signature mismatch: got %s want %s", sig, docSig)
	}
}

func TestVerifyPresignedGET(t *testing.T) {
	// Construct a presigned URL with our own signer logic and verify it, plus
	// expiry handling.
	amzDate := "20130524T000000Z"
	r := httptest.NewRequest("GET", "https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256"+
		"&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request"+
		"&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host", nil)
	r.Host = "examplebucket.s3.amazonaws.com"

	canonical := canonicalPresignedRequest(r, "host")
	sig := hmacSHA256Hex(
		deriveSigningKey([]byte(testSecret), mustTime(amzDate), "us-east-1", "s3"),
		stringToSign(amzDate, "us-east-1", "s3", canonical),
	)

	q := r.URL.Query()
	q.Set("X-Amz-Signature", sig)
	r.URL.RawQuery = q.Encode()

	// The example date is decades in the past, so verification must report
	// expiry, not a signature error.
	_, err := Verify(r, []byte(testSecret))
	if err == nil || !strings.Contains(err.Error(), "expired") {
		t.Fatalf("expected expiry error, got: %v", err)
	}
}

func TestVerifyRejectsTamperedSignature(t *testing.T) {
	amzDate := nowAmzDate()
	r := httptest.NewRequest("GET", "https://gw.example.com/mybucket/mykey", nil)
	r.Host = "gw.example.com"
	r.Header.Set("X-Amz-Date", amzDate)
	r.Header.Set("X-Amz-Content-Sha256", emptyPayload)
	r.Header.Set("Authorization",
		"AWS4-HMAC-SHA256 Credential=AKID/20130524/us-east-1/s3/aws4_request,"+
			"SignedHeaders=host;x-amz-content-sha256;x-amz-date,Signature=deadbeef")

	if _, err := Verify(r, []byte(testSecret)); err != ErrSignatureMismatch {
		t.Fatalf("expected signature mismatch, got: %v", err)
	}
}
