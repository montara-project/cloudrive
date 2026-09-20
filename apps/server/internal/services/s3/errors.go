package s3

import (
	"encoding/xml"
	"errors"
	"fmt"
	"time"
)

// s3Error is the standard S3 error response shape.
type s3Error struct {
	XMLName   xml.Name `xml:"Error"`
	Code      string   `xml:"Code"`
	Message   string   `xml:"Message"`
	Resource  string   `xml:"Resource"`
	RequestID string   `xml:"RequestId"`
}

type apiError struct {
	code    string
	message string
	status  int
	cause   error
}

func (e apiError) Error() string {
	if e.cause != nil {
		return fmt.Sprintf("%s: %v", e.code, e.cause)
	}
	return e.code
}

// Canonical S3 error constructors the gateway raises.
var (
	errAccessDenied    = apiError{code: "AccessDenied", status: 403, message: "Access Denied"}
	errNoSuchBucket    = apiError{code: "NoSuchBucket", status: 404, message: "The specified bucket does not exist"}
	errNoSuchKey       = apiError{code: "NoSuchKey", status: 404, message: "The specified key does not exist."}
	errNoSuchUpload    = apiError{code: "NoSuchUpload", status: 404, message: "The specified upload does not exist."}
	errInvalidBucketName = apiError{code: "InvalidBucketName", status: 400, message: "The specified bucket is not valid."}
	errInvalidAccessKey  = apiError{code: "InvalidAccessKeyId", status: 403, message: "The AWS Access Key Id you provided does not exist in our records."}
	errSignatureMismatch = apiError{code: "SignatureDoesNotMatch", status: 403, message: "The request signature we calculated does not match the signature you provided."}
	errMalformedXML    = apiError{code: "MalformedXML", status: 400, message: "The XML you provided was not well-formed or did not validate against our published schema"}
	errInvalidPart     = apiError{code: "InvalidPart", status: 400, message: "One or more of the specified parts could not be found."}
	errNotImplemented  = apiError{code: "NotImplemented", status: 501, message: "A header or query you provided implies functionality that is not implemented."}
	errInvalidArgument = apiError{code: "InvalidArgument", status: 400, message: "Invalid Argument"}
)

// mapError normalizes any error into an apiError for the XML response.
// Unknown errors collapse to InternalError (message stays generic; the
// detail is only logged).
func mapError(err error) apiError {
	var ae apiError
	if errors.As(err, &ae) {
		return ae
	}

	switch {
	case errors.Is(err, errAccessDenied):
		return errAccessDenied
	case errors.Is(err, errNoSuchBucket):
		return errNoSuchBucket
	case errors.Is(err, errNoSuchKey):
		return apiError{code: "NoSuchKey", status: 404, message: "The specified key does not exist."}
	case errors.Is(err, errNoSuchUpload):
		return errNoSuchUpload
	case errors.Is(err, errSignatureMismatch):
		return apiError{code: "SignatureDoesNotMatch", status: 403, message: "The request signature we calculated does not match the signature you provided."}
	case errors.Is(err, errInvalidAccessKey):
		return apiError{code: "InvalidAccessKeyId", status: 403, message: "The AWS Access Key Id you provided does not exist in our records."}
	case errors.Is(err, errInvalidBucketName):
		return apiError{code: "InvalidBucketName", status: 400, message: "The specified bucket is not valid."}
	case errors.Is(err, errMalformedXML):
		return errMalformedXML
	case errors.Is(err, errInvalidPart):
		return errInvalidPart
	case errors.Is(err, errNotImplemented):
		return errNotImplemented
	default:
		return apiError{code: "InternalError", status: 500, message: "We encountered an internal error. Please try again.", cause: err}
	}
}

// --- XML response models (only what clients need) ---

type listAllMyBucketsResult struct {
	XMLName xml.Name  `xml:"ListAllMyBucketsResult"`
	Xmlns   string    `xml:"xmlns,attr"`
	Owner   owner     `xml:"Owner"`
	Buckets []bucketX `xml:"Buckets>Bucket"`
}

type owner struct {
	ID          string `xml:"ID"`
	DisplayName string `xml:"DisplayName"`
}

type bucketX struct {
	Name         string    `xml:"Name"`
	CreationDate time.Time `xml:"CreationDate"`
}

type listBucketResult struct {
	XMLName               xml.Name  `xml:"ListBucketResult"`
	Name                  string    `xml:"Name"`
	Prefix                string    `xml:"Prefix"`
	Delimiter             string    `xml:"Delimiter,omitempty"`
	KeyCount              int       `xml:"KeyCount"`
	MaxKeys               int       `xml:"MaxKeys"`
	IsTruncated           bool      `xml:"IsTruncated"`
	ContinuationToken     string    `xml:"ContinuationToken,omitempty"`
	NextContinuationToken string    `xml:"NextContinuationToken,omitempty"`
	Contents              []objectX `xml:"Contents"`
	CommonPrefixes        []prefixX `xml:"CommonPrefixes"`
}

type objectX struct {
	Key          string    `xml:"Key"`
	Size         int64     `xml:"Size"`
	ETag         string    `xml:"ETag"`
	StorageClass string    `xml:"StorageClass"`
	LastModified time.Time `xml:"LastModified"`
}

type prefixX struct {
	Prefix string `xml:"Prefix"`
}

type initiateMultipartUploadResult struct {
	XMLName  xml.Name `xml:"InitiateMultipartUploadResult"`
	Bucket   string   `xml:"Bucket"`
	Key      string   `xml:"Key"`
	UploadID string   `xml:"UploadId"`
}

type completeMultipartUploadResult struct {
	XMLName  xml.Name `xml:"CompleteMultipartUploadResult"`
	Location string   `xml:"Location"`
	Bucket   string   `xml:"Bucket"`
	Key      string   `xml:"Key"`
	ETag     string   `xml:"ETag"`
}

type completeMultipartUpload struct {
	XMLName xml.Name        `xml:"CompleteMultipartUpload"`
	Parts   []completePartX `xml:"Part"`
}

type completePartX struct {
	PartNumber int    `xml:"PartNumber"`
	ETag       string `xml:"ETag"`
}
