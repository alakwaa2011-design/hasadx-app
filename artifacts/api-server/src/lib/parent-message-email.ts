import { esc } from "./html-escape";

const G = {
  green:  "#1E4D35",
  greenL: "#2d7050",
  gold:   "#C9A050",
  bg:     "#F5F3EF",
  card:   "#FFFFFF",
  text:   "#1a1a1a",
  muted:  "#666666",
  border: "#E2DDD5",
};

/** Format a JS Date as Arabic locale date string for email display */
function arabicDate(d: Date = new Date()): string {
  return d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Outer shell — table-based 600px wrapper compatible with Gmail, Outlook, Apple Mail.
 * `subjectText` is for the preview text (not shown in the HTML, but used by email clients).
 */
function emailShell(body: string, _subjectText?: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>رسالة من منصة حصاد</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    body { margin:0; padding:0; background-color:${G.bg}; font-family:'Tajawal',Arial,sans-serif; direction:rtl; }
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
    @media only screen and (max-width:620px) {
      .wrapper { width:100% !important; }
      .info-td { display:block !important; width:100% !important; padding:8px 0 !important; }
      .btn-td { text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${G.bg};direction:rtl;">
  <!-- Outer wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:${G.bg};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <!-- Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="wrapper"
               style="max-width:600px;background-color:${G.card};border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          ${body}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Reusable header row with logo */
function headerRow(): string {
  return `
          <!-- HEADER -->
          <tr>
            <td align="center"
                style="background-color:${G.green};padding:14px 32px 0;border-bottom:3px solid ${G.gold};">
              <!--[if mso]><table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0"><tr><td valign="middle" style="padding-left:22px;"><![endif]-->
              <!-- Logo+Name block — centred, logo on right, text on left (RTL) -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                     align="center" dir="rtl"
                     style="margin:0 auto;border-collapse:collapse;">
                <tr>
                  <!-- Logo (right side in RTL) -->
                  <td valign="middle" style="padding:0 0 14px 22px;">
                    <img src="https://hasaadx.com/images/logo-hasaad.png" alt="حصاد"
                         height="60" width="auto"
                         style="display:block;height:60px;width:auto;border:0;outline:none;" />
                  </td>
                  <!-- Text (left side in RTL) -->
                  <td valign="middle" dir="rtl"
                      style="text-align:right;padding:0 0 14px 0;">
                    <p style="margin:0;font-size:17px;font-weight:800;color:#FFFFFF;
                               font-family:'Tajawal',Arial,sans-serif;
                               line-height:1.3;white-space:nowrap;letter-spacing:0.01em;">
                      منصة حصاد التعليمية
                    </p>
                    <p style="margin:5px 0 0;font-size:12px;font-weight:400;
                               color:rgba(255,255,255,0.72);
                               font-family:'Tajawal',Arial,sans-serif;
                               white-space:nowrap;line-height:1.4;">
                      تواصل فعّال بين المدرسة والأسرة
                    </p>
                  </td>
                </tr>
              </table>
              <!--[if mso]></td></tr></table><![endif]-->
            </td>
          </tr>`;
}

/** Reusable footer row */
function footerRow(studentName: string): string {
  return `
          <!-- FOOTER -->
          <tr>
            <td style="background-color:${G.bg};border-top:1px solid ${G.border};padding:20px 32px;text-align:center;direction:rtl;">
              <p style="margin:0 0 6px;font-size:12px;color:${G.muted};font-family:'Tajawal',Arial,sans-serif;line-height:1.6;">
                وصلتك هذه الرسالة لأن بريدك مسجّل كولي أمر للطالب/ة <strong>${esc(studentName)}</strong>.
              </p>
              <p style="margin:0;font-size:11px;color:#999;font-family:'Tajawal',Arial,sans-serif;">
                يرجى عدم الرد مباشرة على هذا البريد — استخدم زر عرض الرسالة والرد.
                &nbsp;·&nbsp; hasaadx.com
              </p>
            </td>
          </tr>`;
}

/** Info card table (responsive — 2-per-row on desktop, stacks on mobile) */
function infoCards(cards: { label: string; value: string }[]): string {
  const cells = cards.map(c => `
              <td class="info-td" valign="top"
                  style="padding:0 6px 12px;width:${Math.round(100 / Math.min(cards.length, 3))}%;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="background-color:${G.bg};border:1px solid ${G.border};border-radius:10px;
                                padding:12px 14px;direction:rtl;">
                      <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:${G.muted};
                                 text-transform:uppercase;letter-spacing:0.06em;font-family:'Tajawal',Arial,sans-serif;">
                        ${c.label}
                      </p>
                      <p style="margin:0;font-size:14px;font-weight:600;color:${G.text};
                                 font-family:'Tajawal',Arial,sans-serif;word-break:break-word;">
                        ${c.value}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>`).join("");
  return `
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>${cells}</tr>
            </table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Teacher → Parent: new message
// ─────────────────────────────────────────────────────────────────────────────
/** Optional school identity bar shown below the header when teacher has set school info */
function schoolBannerRow(schoolName: string, schoolLogoUrl?: string): string {
  return `
          <!-- SCHOOL BANNER -->
          <tr>
            <td style="background-color:#FFFFFF;padding:12px 32px;border-bottom:1px solid ${G.border};">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                     align="center" dir="rtl" style="margin:0 auto;">
                <tr>
                  ${schoolLogoUrl ? `
                  <td valign="middle" style="padding:0 0 0 12px;">
                    <img src="${schoolLogoUrl}" alt="${esc(schoolName)}"
                         height="36" width="auto"
                         style="display:block;height:36px;width:auto;max-width:80px;border:0;border-radius:6px;object-fit:contain;" />
                  </td>` : ""}
                  <td valign="middle" dir="rtl" style="text-align:right;">
                    <p style="margin:0;font-size:13px;font-weight:700;color:${G.text};
                               font-family:'Tajawal',Arial,sans-serif;white-space:nowrap;">
                      ${esc(schoolName)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

export interface AttachmentMeta { name: string; url: string; contentType: string; size: number; }

export interface ParentMessageEmailParams {
  teacherName: string;
  studentName: string;
  studentClass: string;
  gradeLevel: string;
  subject: string;
  body: string;
  portalUrl: string;
  parentName?: string;
  schoolName?: string;
  schoolLogoUrl?: string;
  attachments?: AttachmentMeta[];
}

export function buildParentMessageEmail(p: ParentMessageEmailParams): string {
  const classLabel = [p.gradeLevel, p.studentClass].filter(Boolean).join(" — ");
  const sentDate   = arabicDate();

  const cards = [
    { label: "الطالب/ة",  value: esc(p.studentName)  },
    { label: "الصف",      value: esc(classLabel || "—") },
    { label: "المعلم/ة",  value: esc(p.teacherName)  },
    ...(p.schoolName ? [{ label: "المدرسة", value: esc(p.schoolName) }] : []),
    { label: "تاريخ الإرسال", value: esc(sentDate) },
  ];

  return emailShell(`
          ${headerRow()}
          ${p.schoolName ? schoolBannerRow(p.schoolName, p.schoolLogoUrl) : ""}

          <!-- BODY -->
          <tr>
            <td style="padding:32px 32px 8px;direction:rtl;">

              <!-- Greeting -->
              <p style="margin:0 0 6px;font-size:13px;color:${G.muted};font-family:'Tajawal',Arial,sans-serif;">
                السلام عليكم ورحمة الله وبركاته،
              </p>
              <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:${G.green};font-family:'Tajawal',Arial,sans-serif;">
                ولي أمر الطالب/ة ${esc(p.studentName)} المحترم،
              </p>

              <!-- Intro -->
              <p style="margin:0 0 24px;font-size:15px;color:${G.muted};line-height:1.65;font-family:'Tajawal',Arial,sans-serif;">
                لديكم رسالة جديدة من المعلم/ة
                <strong style="color:${G.text};">${esc(p.teacherName)}</strong>
                بخصوص الطالب/ة
                <strong style="color:${G.text};">${esc(p.studentName)}</strong>.
              </p>

              <!-- Info cards -->
              ${infoCards(cards)}

              <!-- Subject -->
              <p style="margin:16px 0 6px;font-size:11px;font-weight:700;color:${G.muted};text-transform:uppercase;
                         letter-spacing:0.06em;font-family:'Tajawal',Arial,sans-serif;">
                الموضوع
              </p>
              <p style="margin:0 0 20px;font-size:17px;font-weight:800;color:${G.green};font-family:'Tajawal',Arial,sans-serif;">
                ${esc(p.subject)}
              </p>

              <!-- Message box -->
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${G.muted};text-transform:uppercase;
                         letter-spacing:0.06em;font-family:'Tajawal',Arial,sans-serif;">
                رسالة المعلم
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="background-color:#FAFAF8;border:1px solid ${G.border};border-right:4px solid ${G.gold};
                              border-radius:10px;padding:20px;direction:rtl;">
                    <p style="margin:0;font-size:15px;line-height:1.8;color:${G.text};
                               font-family:'Tajawal',Arial,sans-serif;white-space:pre-wrap;word-break:break-word;">
                      ${esc(p.body)}
                    </p>
                  </td>
                </tr>
              </table>

              ${p.attachments && p.attachments.length > 0 ? `
              <!-- Attachments -->
              <p style="margin:20px 0 8px;font-size:11px;font-weight:700;color:${G.muted};text-transform:uppercase;
                         letter-spacing:0.06em;font-family:'Tajawal',Arial,sans-serif;">
                المرفقات (${p.attachments.length})
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                     style="background:#FAFAF8;border:1px solid ${G.border};border-radius:10px;padding:4px 0;">
                ${p.attachments.map(att => {
                  const icon = att.contentType.startsWith("image/") ? "🖼️"
                    : att.contentType === "application/pdf" ? "📄"
                    : att.contentType.includes("word") ? "📝"
                    : att.contentType.includes("sheet") || att.contentType.includes("excel") ? "📊"
                    : att.contentType.includes("presentation") || att.contentType.includes("powerpoint") ? "📑"
                    : "📎";
                  const sizeKb = att.size < 1024 * 1024
                    ? `${Math.round(att.size / 1024)} KB`
                    : `${(att.size / (1024 * 1024)).toFixed(1)} MB`;
                  return `
                <tr>
                  <td style="padding:10px 16px;border-bottom:1px solid ${G.border};direction:rtl;">
                    <a href="${esc(att.url)}" target="_blank"
                       style="text-decoration:none;display:block;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td width="28" valign="middle" style="font-size:18px;padding-left:10px;">${icon}</td>
                          <td valign="middle">
                            <span style="font-size:13px;font-weight:700;color:${G.green};
                                         font-family:'Tajawal',Arial,sans-serif;word-break:break-all;">
                              ${esc(att.name)}
                            </span>
                            <span style="font-size:11px;color:${G.muted};font-family:'Tajawal',Arial,sans-serif;
                                         margin-right:8px;">${esc(sizeKb)}</span>
                          </td>
                          <td width="60" align="left" valign="middle"
                              style="font-size:11px;color:${G.green};font-family:'Tajawal',Arial,sans-serif;
                                     white-space:nowrap;padding-right:4px;">
                            ⬇ تحميل
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>`;
                }).join("")}
              </table>` : ""}

              <!-- Security notice -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:20px;">
                <tr>
                  <td style="background-color:#f0f4f2;border:1px solid #c6dbd0;border-radius:8px;
                              padding:10px 16px;direction:rtl;">
                    <p style="margin:0;font-size:12px;color:#2d6b4a;font-family:'Tajawal',Arial,sans-serif;">
                      هذه رسالة رسمية أُرسلت عبر منصة حصاد التعليمية.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:24px 32px 8px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:12px;background-color:${G.green};">
                    <a href="${esc(p.portalUrl)}"
                       target="_blank"
                       style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;
                              color:#FFFFFF;text-decoration:none;font-family:'Tajawal',Arial,sans-serif;
                              border-radius:12px;mso-padding-alt:14px 36px;">
                      عرض الرسالة والرد
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding:20px 32px 28px;direction:rtl;border-top:1px solid ${G.border};margin-top:12px;">
              <p style="margin:0 0 2px;font-size:13px;color:${G.muted};font-family:'Tajawal',Arial,sans-serif;">
                مع خالص التقدير،
              </p>
              <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:${G.text};font-family:'Tajawal',Arial,sans-serif;">
                ${esc(p.teacherName)}
              </p>
              <p style="margin:0;font-size:12px;color:${G.muted};font-family:'Tajawal',Arial,sans-serif;">
                عبر منصة حصاد التعليمية
              </p>
            </td>
          </tr>

          ${footerRow(p.studentName)}
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Parent reply → Teacher notification
// ─────────────────────────────────────────────────────────────────────────────
export interface TeacherReplyNotificationParams {
  teacherName: string;
  studentName: string;
  parentName: string;
  replyText: string;
  inboxUrl: string;
}

export function buildTeacherReplyNotificationEmail(p: TeacherReplyNotificationParams): string {
  return emailShell(`
          ${headerRow()}

          <tr>
            <td style="padding:32px 32px 8px;direction:rtl;">
              <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:${G.green};font-family:'Tajawal',Arial,sans-serif;">
                أستاذ/ة ${esc(p.teacherName)}،
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:${G.muted};line-height:1.65;font-family:'Tajawal',Arial,sans-serif;">
                ردّ ولي الأمر <strong style="color:${G.text};">${esc(p.parentName)}</strong>
                على رسالتك بخصوص الطالب/ة
                <strong style="color:${G.gold};font-weight:800;">${esc(p.studentName)}</strong>.
              </p>

              <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${G.muted};text-transform:uppercase;
                         letter-spacing:0.06em;font-family:'Tajawal',Arial,sans-serif;">
                نص الرد
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="background-color:#f0f7f3;border:1px solid #b5d4c3;border-radius:10px;
                              padding:20px;direction:rtl;">
                    <p style="margin:0;font-size:15px;line-height:1.8;color:${G.text};
                               font-family:'Tajawal',Arial,sans-serif;white-space:pre-wrap;word-break:break-word;">
                      ${esc(p.replyText)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:24px 32px 28px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:12px;background-color:${G.green};">
                    <a href="${esc(p.inboxUrl)}"
                       target="_blank"
                       style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;
                              color:#FFFFFF;text-decoration:none;font-family:'Tajawal',Arial,sans-serif;
                              border-radius:12px;">
                      عرض المحادثة كاملة
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${footerRow(p.studentName)}
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Teacher reply → Parent notification
// ─────────────────────────────────────────────────────────────────────────────
export interface ParentThreadReplyParams {
  teacherName: string;
  studentName?: string;
  parentName?: string;
  replyText: string;
  portalUrl: string;
}

export function buildParentThreadReplyEmail(p: ParentThreadReplyParams): string {
  const studentName = p.studentName ?? "";
  return emailShell(`
          ${headerRow()}

          <tr>
            <td style="padding:32px 32px 8px;direction:rtl;">
              <p style="margin:0 0 6px;font-size:13px;color:${G.muted};font-family:'Tajawal',Arial,sans-serif;">
                السلام عليكم ورحمة الله وبركاته،
              </p>
              <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:${G.green};font-family:'Tajawal',Arial,sans-serif;">
                ${p.parentName ? `${esc(p.parentName)} المحترم/ة،` : "ولي الأمر الكريم،"}
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:${G.muted};line-height:1.65;font-family:'Tajawal',Arial,sans-serif;">
                ردّ المعلم/ة <strong style="color:${G.text};">${esc(p.teacherName)}</strong> على رسالتك.
              </p>

              <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${G.muted};text-transform:uppercase;
                         letter-spacing:0.06em;font-family:'Tajawal',Arial,sans-serif;">
                رد المعلم
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="background-color:#FAFAF8;border:1px solid ${G.border};border-right:4px solid ${G.gold};
                              border-radius:10px;padding:20px;direction:rtl;">
                    <p style="margin:0;font-size:15px;line-height:1.8;color:${G.text};
                               font-family:'Tajawal',Arial,sans-serif;white-space:pre-wrap;word-break:break-word;">
                      ${esc(p.replyText)}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Security notice -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:20px;">
                <tr>
                  <td style="background-color:#f0f4f2;border:1px solid #c6dbd0;border-radius:8px;padding:10px 16px;direction:rtl;">
                    <p style="margin:0;font-size:12px;color:#2d6b4a;font-family:'Tajawal',Arial,sans-serif;">
                      هذه رسالة رسمية أُرسلت عبر منصة حصاد التعليمية.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:24px 32px 8px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:12px;background-color:${G.green};">
                    <a href="${esc(p.portalUrl)}"
                       target="_blank"
                       style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;
                              color:#FFFFFF;text-decoration:none;font-family:'Tajawal',Arial,sans-serif;
                              border-radius:12px;">
                      عرض الرسالة والرد
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding:20px 32px 28px;direction:rtl;border-top:1px solid ${G.border};">
              <p style="margin:0 0 2px;font-size:13px;color:${G.muted};font-family:'Tajawal',Arial,sans-serif;">مع خالص التقدير،</p>
              <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:${G.text};font-family:'Tajawal',Arial,sans-serif;">${esc(p.teacherName)}</p>
              <p style="margin:0;font-size:12px;color:${G.muted};font-family:'Tajawal',Arial,sans-serif;">عبر منصة حصاد التعليمية</p>
            </td>
          </tr>

          ${footerRow(studentName)}
  `);
}
