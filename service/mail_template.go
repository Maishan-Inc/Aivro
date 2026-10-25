package service

import (
	"bytes"
	_ "embed"
	"html/template"
	"mime/multipart"
	"mime/quotedprintable"
	"net/textproto"
	"strconv"
	"strings"
	"time"

	"github.com/basketikun/aivro/model"
)

//go:embed templates/verification.html
var verificationMailDocument string

var verificationMailHTML = template.Must(template.New("verification").Parse(verificationMailDocument))

type RenderedMail struct {
	Subject string `json:"subject"`
	Text    string `json:"text"`
	HTML    string `json:"html"`
	Locale  string `json:"locale"`
}

type MailPreviewInput struct {
	Template      model.MailTemplate `json:"template"`
	Purpose       string             `json:"purpose"`
	Locale        string             `json:"locale"`
	CodeExpireMin int                `json:"codeExpireMin"`
}

func PreviewMail(input MailPreviewInput) (RenderedMail, error) {
	locale := resolveMailLocale(input.Locale, "zh-CN")
	templates := model.MailTemplates{Register: input.Template, Reset: input.Template, MetaMask: input.Template}
	setting := model.MailSetting{CodeExpireMin: input.CodeExpireMin, Templates: map[string]model.MailTemplates{locale: templates}}
	return renderVerificationMail(setting, "user@example.com", input.Purpose, "123456", MailTemplateContext{
		Locale: locale, IP: "203.0.113.8", Country: "CN", Region: "Shanghai", Test: true,
	})
}

func renderVerificationMail(setting model.MailSetting, email string, purpose string, code string, context MailTemplateContext) (RenderedMail, error) {
	setting = normalizeMailSetting(setting)
	context.Locale = resolveMailLocale(context.Locale, setting.DefaultLocale)
	context = normalizeMailTemplateContext(context)
	words := mailTranslations[context.Locale]
	scene, ok := words.Scenes[purpose]
	if !ok {
		return RenderedMail{}, safeMessageError{message: "验证码用途无效"}
	}
	templates := setting.Templates[context.Locale]
	content := templates.Register
	if purpose == "reset" {
		content = templates.Reset
	} else if purpose == "metamask" {
		content = templates.MetaMask
	}
	subject := renderMailTemplate(content.Subject, email, code, setting.CodeExpireMin, context)
	body := renderMailTemplate(content.Body, email, code, setting.CodeExpireMin, context)
	expiry := renderMailTemplate(words.Expiry, email, code, setting.CodeExpireMin, context)
	preheader := scene.Title + " · " + expiry
	if context.Test {
		subject = "[" + words.TestLabel + "] " + subject
		preheader = words.TestNote
	}
	siteURL := normalizedConfiguredOrigin()
	visitURL := ""
	if siteURL != "" {
		visitURL = siteURL + "/" + context.Locale
	}
	copyright := "© " + strconv.Itoa(time.Now().Year()) + " Maishan Inc. · Aivro. All rights reserved."
	plain := []string{scene.Title, body}
	if context.Test {
		plain = append(plain, words.TestNote)
	}
	if purpose == "reset" {
		plain = append(plain, "01 "+words.VerifyStep+" → 02 "+words.PasswordStep)
	}
	plain = append(plain, words.Code+": "+code, expiry, scene.Hint,
		words.RequestDetails, words.Recipient+": "+email, words.IP+": "+context.IP,
		words.Location+": "+context.Country+" / "+context.Region, words.Safety+": "+scene.Note, words.Footer)
	if visitURL != "" {
		plain = append(plain, words.Visit+": "+visitURL)
	}
	plain = append(plain, copyright)
	data := struct {
		Words                                          mailWords
		Scene                                          mailScene
		Context                                        MailTemplateContext
		Subject, Preheader, Expiry, Email, Code, Purpose string
		SiteURL, VisitURL, Copyright                    string
		Body, Digits                                   []string
		OutlookStart, OutlookEnd                       template.HTML
	}{
		Words: words, Scene: scene, Context: context, Subject: subject, Preheader: preheader,
		Expiry: expiry, Email: email, Code: code, Purpose: purpose, SiteURL: siteURL,
		VisitURL: visitURL, Copyright: copyright, Body: strings.Split(strings.ReplaceAll(body, "\r\n", "\n"), "\n"),
		Digits: strings.Split(code, ""),
		// These fixed layout comments must survive html/template's comment stripping.
		OutlookStart: template.HTML(`<!--[if mso]><table role="presentation" width="640" align="center" cellspacing="0" cellpadding="0"><tr><td><![endif]-->`),
		OutlookEnd:   template.HTML(`<!--[if mso]></td></tr></table><![endif]-->`),
	}
	var html bytes.Buffer
	if err := verificationMailHTML.Execute(&html, data); err != nil {
		return RenderedMail{}, err
	}
	return RenderedMail{Subject: subject, Text: strings.Join(plain, "\n\n"), HTML: html.String(), Locale: context.Locale}, nil
}

func buildVerificationMailMessage(from string, to string, content RenderedMail) []byte {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	writeMailPart(writer, "text/plain; charset=UTF-8", content.Text)
	writeMailPart(writer, "text/html; charset=UTF-8", content.HTML)
	_ = writer.Close()
	headers := strings.Join([]string{
		"From: " + from,
		"To: " + to,
		"Subject: " + mimeHeader(content.Subject),
		"MIME-Version: 1.0",
		"Content-Language: " + content.Locale,
		"Content-Type: multipart/alternative; boundary=\"" + writer.Boundary() + "\"",
		"", "",
	}, "\r\n")
	return append([]byte(headers), body.Bytes()...)
}

func writeMailPart(writer *multipart.Writer, contentType string, body string) {
	part, err := writer.CreatePart(textproto.MIMEHeader{
		"Content-Type":              {contentType},
		"Content-Transfer-Encoding": {"quoted-printable"},
	})
	if err != nil {
		return
	}
	encoded := quotedprintable.NewWriter(part)
	_, _ = encoded.Write([]byte(body))
	_ = encoded.Close()
}
