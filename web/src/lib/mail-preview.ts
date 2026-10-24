const escapeHTML = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);

function previewCodeBoxes() {
    return `<table role="presentation" class="code-grid" width="480" cellspacing="0" cellpadding="0" style="width:480px;max-width:100%;margin:20px 0;table-layout:fixed;border-collapse:collapse;"><tr>${[1, 2, 3, 4, 5, 6].map((digit) => `<td class="code-cell" style="padding:0 4px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;"><tr><td class="code soft text line" align="center" height="70" style="height:70px;padding:0;text-align:center;border:1px solid #dcdcdc;border-radius:5px;background:#f7f7f6;color:#000000;font:600 44px/70px Consolas,monospace;">${digit}</td></tr></table></td>`).join("")}</tr></table>`;
}

export function renderMailPreviewHTML(template: string, purpose: "register" | "reset" | "metamask", expireMinutes: number) {
    const token = "\u0000AIVRO_CODE\u0000";
    const body = escapeHTML(template.replaceAll("{{code}}", token))
        .replaceAll("{{email}}", "user@example.com")
        .replaceAll("{{expireMinutes}}", String(expireMinutes))
        .replaceAll("{{siteName}}", "Aivro")
        .replaceAll("{{ip}}", "203.0.113.8")
        .replaceAll("{{country}}", "CN")
        .replaceAll("{{region}}", "Shanghai")
        .replaceAll(token, previewCodeBoxes())
        .replaceAll("\r\n", "\n")
        .split("\n")
        .map((line) => line === "" ? '<div style="height:12px;line-height:12px;">&nbsp;</div>' : line.includes("<table ") ? line : `<p class="secondary" style="margin:0;font-size:14px;line-height:1.95;color:#454545;">${line}</p>`)
        .join("");
    const title = purpose === "reset" ? "重置你的账号密码" : purpose === "metamask" ? "验证 MetaMask 登录邮箱" : "验证邮箱，完成注册";
    const eyebrow = purpose === "reset" ? "PASSWORD RESET" : purpose === "metamask" ? "CONFIRM YOUR EMAIL" : "WELCOME TO AIVRO";
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>
@media only screen and (max-width:520px){.root{padding:12px 8px!important}.pad{padding-left:18px!important;padding-right:18px!important}.title{font-size:25px!important}.category{display:none!important}.code-grid{width:264px!important}.code-cell{padding:0 2px!important}.code{height:38px!important;font-size:34px!important;line-height:38px!important}}
@media only screen and (min-width:360px) and (max-width:520px){.code-grid{width:300px!important}.code{height:44px!important;line-height:44px!important}}
@media (prefers-color-scheme:dark){.root{background:#111!important;color:#fff!important}.card{background:#000!important;border-color:#353535!important}.text{color:#fff!important}.secondary{color:#c4c4c4!important}.muted{color:#a0a0a0!important}.soft{background:#111!important}.line{border-color:#303030!important}}
</style></head><body style="margin:0;padding:0"><div class="root" style="margin:0;padding:24px 12px;background:#f4f4f3;font-family:Arial,'Microsoft YaHei',sans-serif;word-break:break-word;color:#000">
<table class="card" role="presentation" width="100%" align="center" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;margin:0 auto;background:#fff;border:1px solid #dcdcdc;border-radius:8px;table-layout:fixed"><tr><td class="pad" style="padding:30px 42px 0"><table class="line" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-bottom:1px solid #e6e6e6"><tr><td style="padding-bottom:26px;white-space:nowrap"><picture><source srcset="/logo-mail-light.png" media="(prefers-color-scheme: dark)"><img src="/logo-mail-dark.png" width="30" height="30" alt="" style="display:inline-block;vertical-align:middle"></picture> <span class="text" style="display:inline-block;vertical-align:middle;font:700 27px/30px Arial,sans-serif;letter-spacing:-1px;color:#000">Aivro</span></td><td align="right" class="category muted" style="padding:0 0 26px 12px;text-align:right;color:#737373;font-size:10px">账号安全</td></tr></table></td></tr>
<tr><td class="pad" style="padding:32px 42px"><p class="muted" style="margin:0 0 12px;font:10px/1.6 Arial,sans-serif;letter-spacing:1.6px;color:#737373">${eyebrow}</p><h2 class="title text" style="margin:0 0 20px;font-size:29px;line-height:1.4;font-weight:700;letter-spacing:-.5px;color:#000">${title}</h2>${body}<p class="muted line" style="margin:28px 0 0;padding-top:19px;border-top:1px solid #e6e6e6;font-size:12px;line-height:1.85;color:#737373">此邮件由系统自动发送，请勿直接回复。若非本人操作，请忽略此邮件，不要输入或分享验证码。</p></td></tr>
<tr><td class="pad line" style="padding:22px 42px 25px;border-top:1px solid #e6e6e6"><span class="secondary" style="color:#454545;font-size:11px">Aivro © ${new Date().getFullYear()}</span></td></tr></table></div></body></html>`;
}
