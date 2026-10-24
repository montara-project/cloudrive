package email

import (
	"bytes"
	"errors"
	"fmt"
	"html/template"

	"github.com/resend/resend-go/v4"
)

// Service sends transactional mail through Resend.
type Service struct {
	AppName   string
	APIKey    string
	FromEmail string
}

type SendEmailParams struct {
	Subject      string
	To           string
	Data         interface{}
	HtmlTemplate string
}

func (s Service) SendEmail(value SendEmailParams) (string, error) {
	client := resend.NewClient(s.APIKey)

	// Load the HTML template
	htmlStr, err := ParseTemplate(value.HtmlTemplate, value.Data)
	if err != nil {
		return "", fmt.Errorf("error loading template: %w", err)
	}

	params := &resend.SendEmailRequest{
		From:    fmt.Sprintf("%s <%s>", s.AppName, s.FromEmail),
		To:      []string{value.To},
		Html:    htmlStr,
		Subject: value.Subject,
	}

	sent, err := client.Emails.Send(params)
	if err != nil {
		fmt.Printf("Error sending email: %s\n", err.Error())
		return "", err
	}
	fmt.Printf("Email sent with ID: %s\n", sent.Id)
	return sent.Id, nil
}

// Parse Template from file path
func ParseTemplate(filename string, data interface{}) (string, error) {
	tmpl, err := template.ParseFiles(filename)
	if err != nil {
		return "", errors.New("error parsing template: " + err.Error())
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", errors.New("error executing template: " + err.Error())
	}

	return buf.String(), nil
}
