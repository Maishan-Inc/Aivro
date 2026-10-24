package service

import (
	"bytes"
	"html"
	"mime/multipart"
	"mime/quotedprintable"
	"net/textproto"
	"strconv"
	"strings"
	"time"
)

func buildVerificationMailMessage(from string, to string, subject string, plain string, template string, email string, purpose string, code string, expireMinutes int, context MailTemplateContext) []byte {
	var content bytes.Buffer
	writer := multipart.NewWriter(&content)
	writeMailPart(writer, "text/plain; charset=UTF-8", plain)
	writeMailPart(writer, "text/html; charset=UTF-8", renderVerificationMailHTML(template, email, purpose, code, expireMinutes, context))
	_ = writer.Close()
	headers := strings.Join([]string{
		"From: " + from,
		"To: " + to,
		"Subject: " + mimeHeader(subject),
		"MIME-Version: 1.0",
		"Content-Type: multipart/alternative; boundary=\"" + writer.Boundary() + "\"",
		"",
		"",
	}, "\r\n")
	return append([]byte(headers), content.Bytes()...)
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

func renderVerificationMailHTML(template string, email string, purpose string, code string, expireMinutes int, context MailTemplateContext) string {
	context = normalizeMailTemplateContext(context)
	template = strings.ReplaceAll(template, "{{code}}", "\x00AIVRO_CODE\x00")
	rendered := strings.NewReplacer(
		"{{email}}", html.EscapeString(email),
		"{{expireMinutes}}", strconv.Itoa(expireMinutes),
		"{{siteName}}", "Aivro",
		"{{ip}}", html.EscapeString(context.IP),
		"{{country}}", html.EscapeString(context.Country),
		"{{region}}", html.EscapeString(context.Region),
	).Replace(html.EscapeString(template))
	// Replace only the protected code token after escaping the editable template.
	body := strings.ReplaceAll(rendered, "\x00AIVRO_CODE\x00", mailCodeBoxes(code))
	body = strings.ReplaceAll(body, "\r\n", "\n")
	lines := strings.Split(body, "\n")
	for index, line := range lines {
		if line == "" {
			lines[index] = `<div style="height:12px;line-height:12px;">&nbsp;</div>`
		} else if strings.Contains(line, "<table ") {
			lines[index] = line
		} else {
			lines[index] = `<p class="aivro-email-secondary" style="margin:0;font-size:14px;line-height:1.95;color:#454545;">` + line + `</p>`
		}
	}
	title, eyebrow := "验证邮箱，完成注册", "WELCOME TO AIVRO"
	if purpose == "reset" {
		title, eyebrow = "重置你的账号密码", "PASSWORD RESET"
	} else if purpose == "metamask" {
		title, eyebrow = "验证 MetaMask 登录邮箱", "CONFIRM YOUR EMAIL"
	}
	siteURL := normalizedConfiguredOrigin()
	brand := `<span class="aivro-email-text" style="font:700 27px/1.5 Arial,sans-serif;letter-spacing:-1px;color:#000000;">Aivro</span>`
	if siteURL != "" {
		logoURL := html.EscapeString(siteURL + "/logo-mail-dark.png")
		brand = `<picture><source srcset="` + html.EscapeString(siteURL+"/logo-mail-light.png") + `" media="(prefers-color-scheme: dark)" /><img src="` + logoURL + `" width="30" height="30" alt="" style="display:inline-block;vertical-align:middle;border:0;" /></picture> <span class="aivro-email-text" style="display:inline-block;vertical-align:middle;font:700 27px/30px Arial,sans-serif;letter-spacing:-1px;color:#000000;">Aivro</span>`
		brand = `<a href="` + html.EscapeString(siteURL) + `" style="text-decoration:none;">` + brand + `</a>`
	}
	footer := `<span class="aivro-email-secondary" style="color:#454545;font-size:11px;">Aivro © ` + strconv.Itoa(time.Now().Year()) + `</span>`
	if siteURL != "" {
		footer = `<a class="aivro-email-secondary" href="` + html.EscapeString(siteURL) + `" style="color:#454545;font-size:11px;text-decoration:none;">Aivro © ` + strconv.Itoa(time.Now().Year()) + `</a>`
	}
	document := `<div class="aivro-email-root" lang="zh-CN" style="margin:0;padding:24px 12px;background:#f4f4f3;font-family:Arial,'Microsoft YaHei',sans-serif;word-break:break-word;color:#000000;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;">你的验证码已准备就绪，` + strconv.Itoa(expireMinutes) + ` 分钟内有效。</div>
<table role="presentation" class="aivro-email-card" width="100%" align="center" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dcdcdc;border-radius:8px;table-layout:fixed;">
<tr><td class="aivro-email-pad" style="padding:30px 42px 0;"><table role="presentation" class="aivro-email-line" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-bottom:1px solid #e6e6e6;"><tr><td style="padding-bottom:26px;white-space:nowrap;">` + brand + `</td><td align="right" class="aivro-email-category aivro-email-muted" style="padding:0 0 26px 12px;text-align:right;color:#737373;font-size:10px;">账号安全</td></tr></table></td></tr>
<tr><td class="aivro-email-pad" style="padding:32px 42px;">
<p class="aivro-email-muted" style="margin:0 0 12px;font:10px/1.6 Arial,sans-serif;letter-spacing:1.6px;color:#737373;">` + eyebrow + `</p>
<h2 class="aivro-email-title aivro-email-text" style="margin:0 0 20px;font-size:29px;line-height:1.4;font-weight:700;letter-spacing:-0.5px;color:#000000;">` + title + `</h2>` + strings.Join(lines, "") + `<p class="aivro-email-muted aivro-email-line" style="margin:28px 0 0;padding-top:19px;border-top:1px solid #e6e6e6;font-size:12px;line-height:1.85;color:#737373;">此邮件由系统自动发送，请勿直接回复。若非本人操作，请忽略此邮件，不要输入或分享验证码。</p></td></tr>
<tr><td class="aivro-email-pad aivro-email-line" style="padding:22px 42px 25px;border-top:1px solid #e6e6e6;">` + footer + `</td></tr></table></div>`
	return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>Aivro</title><style>` + mailStyles + `</style></head><body style="margin:0;padding:0;">` + document + `</body></html>`
}

func mailCodeBoxes(code string) string {
	if len(code) != 6 || strings.IndexFunc(code, func(char rune) bool { return char < '0' || char > '9' }) >= 0 {
		return html.EscapeString(code)
	}
	var cells strings.Builder
	cells.WriteString(`<table role="presentation" class="aivro-email-code-grid" width="480" cellspacing="0" cellpadding="0" style="width:480px;max-width:100%;margin:20px 0;table-layout:fixed;border-collapse:collapse;"><tr>`)
	for _, digit := range code {
		cells.WriteString(`<td class="aivro-email-code-cell" style="padding:0 4px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;"><tr><td class="aivro-email-code aivro-email-soft aivro-email-text aivro-email-line" align="center" height="70" style="height:70px;padding:0;text-align:center;border:1px solid #dcdcdc;border-radius:5px;background:#f7f7f6;color:#000000;font:600 44px/70px Consolas,monospace;">`)
		cells.WriteRune(digit)
		cells.WriteString(`</td></tr></table></td>`)
	}
	cells.WriteString(`</tr></table>`)
	return cells.String()
}

const mailStyles = `
@media only screen and (max-width:520px) {
 .aivro-email-root {padding:12px 8px!important;}
 .aivro-email-root .aivro-email-pad {padding-left:18px!important;padding-right:18px!important;}
 .aivro-email-root .aivro-email-title {font-size:25px!important;}
 .aivro-email-root .aivro-email-category {display:none!important;}
 .aivro-email-root .aivro-email-code-grid {width:264px!important;}
 .aivro-email-root .aivro-email-code-cell {padding:0 2px!important;}
 .aivro-email-root .aivro-email-code {height:38px!important;font-size:34px!important;line-height:38px!important;}
}
@media only screen and (min-width:360px) and (max-width:520px) {
 .aivro-email-root .aivro-email-code-grid {width:300px!important;}
 .aivro-email-root .aivro-email-code {height:44px!important;line-height:44px!important;}
}
@media (prefers-color-scheme:dark) {
 .aivro-email-root {background:#111111!important;color:#ffffff!important;}
 .aivro-email-root .aivro-email-card {background:#000000!important;border-color:#353535!important;}
 .aivro-email-root .aivro-email-text {color:#ffffff!important;}
 .aivro-email-root .aivro-email-secondary {color:#c4c4c4!important;}
 .aivro-email-root .aivro-email-muted {color:#a0a0a0!important;}
 .aivro-email-root .aivro-email-soft {background:#111111!important;}
 .aivro-email-root .aivro-email-line {border-color:#303030!important;}
}`
