import { esc, safeUrl } from "./html-escape";

export type EmailTone = "default" | "reward" | "security" | "message" | "admin";

const toneColors: Record<EmailTone, { accent: string; soft: string; label: string }> = {
  default: { accent: "#225739", soft: "#EEF5F0", label: "إشعار من حصاد" },
  reward: { accent: "#A9781D", soft: "#FFF7E3", label: "مكافأة من حصاد" },
  security: { accent: "#9B3B35", soft: "#FFF2F0", label: "تنبيه أمني" },
  message: { accent: "#316A58", soft: "#F0F7F4", label: "رسالة جديدة" },
  admin: { accent: "#765B2B", soft: "#FAF5EA", label: "تنبيه إداري" },
};

export interface HasaadEmailOptions {
  title: string;
  bodyHtml: string;
  preheader?: string;
  eyebrow?: string;
  tone?: EmailTone;
  recipientName?: string;
  cta?: { label: string; url: string };
  footer?: string;
}

export function renderHasaadEmail(options: HasaadEmailOptions): string {
  const tone = toneColors[options.tone ?? "default"];
  const preheader = options.preheader ?? options.title;
  const eyebrow = options.eyebrow ?? tone.label;
  const greeting = options.recipientName
    ? `<p style="margin:0 0 14px;color:#607068;font-size:14px;line-height:1.7">مرحبًا ${esc(options.recipientName)}،</p>`
    : "";
  const cta = options.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px auto 4px">
        <tr><td style="border-radius:12px;background:${tone.accent};text-align:center">
          <a href="${safeUrl(options.cta.url)}" style="display:inline-block;padding:13px 28px;color:#fff;text-decoration:none;font-size:14px;font-weight:800;border-radius:12px">${esc(options.cta.label)}</a>
        </td></tr>
      </table>`
    : "";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <title>${esc(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F1EA;color:#17352B;font-family:Tahoma,Arial,sans-serif;direction:rtl">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}&#847; &zwnj; &#847; &zwnj;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#F4F1EA">
    <tr><td align="center" style="padding:30px 12px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:580px;border:1px solid #E2DCCF;border-radius:22px;background:#FFFEFB;overflow:hidden;box-shadow:0 12px 34px rgba(34,87,57,.09)">
        <tr><td style="height:5px;background:linear-gradient(90deg,#225739,#C9A050,#225739);font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:22px 30px 18px;border-bottom:1px solid #ECE6DA">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="text-align:right">
                <p style="margin:0;color:#225739;font-size:18px;font-weight:900;letter-spacing:.01em">حصاد</p>
                <p style="margin:4px 0 0;color:#829087;font-size:11px">منصة تعليمية للمعلم العربي</p>
              </td>
              <td width="48" align="left">
                <table role="presentation" width="42" height="42" cellspacing="0" cellpadding="0" style="width:42px;height:42px;border:1px solid #DDBF78;border-radius:13px;background:#FFF4D5">
                  <tr><td align="center" valign="middle" style="color:#225739;font-size:19px;font-weight:900">ح</td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:30px">
          <p style="margin:0 0 8px;color:${tone.accent};font-size:11px;font-weight:800;letter-spacing:.04em">${esc(eyebrow)}</p>
          <h1 style="margin:0 0 18px;color:#17352B;font-size:24px;line-height:1.45;font-weight:900">${esc(options.title)}</h1>
          ${greeting}
          <div style="color:#354B42;font-size:15px;line-height:1.85">${options.bodyHtml}</div>
          ${cta}
        </td></tr>
        <tr><td style="padding:17px 30px;background:${tone.soft};border-top:1px solid #E8E1D5;text-align:center">
          <p style="margin:0;color:#718078;font-size:11px;line-height:1.7">${esc(options.footer ?? "هذه رسالة خدمية من منصة حصاد التعليمية.")}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailHighlight(contentHtml: string, tone: EmailTone = "default"): string {
  const color = toneColors[tone];
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0">
    <tr><td style="padding:16px 18px;border:1px solid ${color.accent}33;border-right:4px solid ${color.accent};border-radius:12px;background:${color.soft};color:#243F35;line-height:1.8">${contentHtml}</td></tr>
  </table>`;
}

export function emailFacts(rows: Array<{ label: string; value: string }>): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #E4DED3;border-radius:12px;overflow:hidden">
    ${rows.map((row, index) => `<tr>
      <td style="padding:10px 14px;color:#738078;font-size:12px;${index ? "border-top:1px solid #ECE7DE;" : ""}">${esc(row.label)}</td>
      <td style="padding:10px 14px;color:#203D32;font-size:13px;font-weight:700;text-align:left;${index ? "border-top:1px solid #ECE7DE;" : ""}">${esc(row.value)}</td>
    </tr>`).join("")}
  </table>`;
}

export function emailCode(code: string): string {
  return `<div dir="ltr" style="margin:20px 0;padding:16px 12px;border:1px solid #C8D9CF;border-radius:13px;background:#F1F7F3;color:#225739;text-align:center;font-family:Consolas,monospace;font-size:32px;font-weight:900;letter-spacing:7px">${esc(code)}</div>`;
}