const BRAND = {
  green: "#1E4D35",
  greenLight: "#2d7050",
  gold: "#C9A050",
  bg: "#F7F5F1",
  cardBg: "#FFFFFF",
  text: "#1a1a1a",
  muted: "#666666",
  border: "#e5e0d8",
};

import { esc } from "./html-escape";

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${BRAND.bg}; font-family: 'Tajawal', Arial, sans-serif; direction: rtl; color: ${BRAND.text}; }
    .wrapper { max-width: 600px; margin: 0 auto; background: ${BRAND.cardBg}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: ${BRAND.green}; padding: 24px 32px; }
    .header-logo { font-size: 22px; font-weight: 800; color: ${BRAND.gold}; letter-spacing: 1px; }
    .header-sub { font-size: 12px; color: rgba(255,255,255,0.65); margin-top: 2px; }
    .body { padding: 32px; }
    .label { font-size: 11px; font-weight: 700; color: ${BRAND.muted}; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
    .info-grid { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
    .info-item { background: ${BRAND.bg}; border: 1px solid ${BRAND.border}; border-radius: 10px; padding: 12px 16px; flex: 1; min-width: 130px; }
    .info-item .label { margin-bottom: 4px; }
    .info-item .value { font-size: 15px; font-weight: 500; color: ${BRAND.text}; }
    .divider { border: none; border-top: 1px solid ${BRAND.border}; margin: 20px 0; }
    .message-box { background: #FAFAF8; border: 1px solid ${BRAND.border}; border-right: 4px solid ${BRAND.gold}; border-radius: 10px; padding: 20px; font-size: 15px; line-height: 1.75; color: ${BRAND.text}; white-space: pre-wrap; margin-bottom: 28px; }
    .reply-box { background: #f0f7f3; border: 1px solid #b5d4c3; border-radius: 10px; padding: 20px; font-size: 15px; line-height: 1.75; white-space: pre-wrap; margin-bottom: 24px; }
    .cta-btn { display: inline-block; background: ${BRAND.green}; color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 12px; text-align: center; }
    .footer { background: ${BRAND.bg}; padding: 20px 32px; text-align: center; font-size: 12px; color: ${BRAND.muted}; border-top: 1px solid ${BRAND.border}; }
    .gold { color: ${BRAND.gold}; font-weight: 800; }
  </style>
</head>
<body>
  <div style="padding: 24px 16px;">
    <div class="wrapper">
      <div class="header">
        <img src="https://hasaadx.com/images/logo-hasaad.png" alt="حصاد" height="48" style="display:block; margin-bottom:6px; max-height:48px; width:auto;" />
        <div class="header-sub">منصة التعليم التفاعلي</div>
      </div>
      ${content}
      <div class="footer">© 2026 منصة حصاد · hasaadx.com<br/>هذا البريد أُرسل تلقائياً — يرجى عدم الرد المباشر عليه</div>
    </div>
  </div>
</body>
</html>`;
}

interface ParentMessageEmailParams {
  teacherName: string; studentName: string; studentClass: string;
  gradeLevel: string; subject: string; body: string; portalUrl: string; parentName?: string;
}

export function buildParentMessageEmail(p: ParentMessageEmailParams): string {
  const greeting = p.parentName ? `عزيزي/عزيزتي ${esc(p.parentName)}،` : "ولي الأمر الكريم،";
  const classInfo = esc([p.gradeLevel, p.studentClass].filter(Boolean).join(" — "));
  return emailShell(`
    <div class="body">
      <p style="font-size:16px; font-weight:700; margin-bottom:20px; color:${BRAND.green}">${greeting}</p>
      <p style="font-size:15px; margin-bottom:24px; color:${BRAND.muted}; line-height:1.6">
        يتواصل معك المعلم <strong style="color:${BRAND.text}">${esc(p.teacherName)}</strong> بخصوص الطالب/ة:
      </p>
      <div class="info-grid">
        <div class="info-item"><div class="label">اسم الطالب</div><div class="value">${esc(p.studentName)}</div></div>
        ${classInfo ? `<div class="info-item"><div class="label">الصف</div><div class="value">${classInfo}</div></div>` : ""}
        <div class="info-item"><div class="label">المعلم</div><div class="value">${esc(p.teacherName)}</div></div>
      </div>
      <div class="label" style="margin-bottom:10px">الموضوع</div>
      <p style="font-size:16px; font-weight:700; margin-bottom:16px; color:${BRAND.green}">${esc(p.subject)}</p>
      <div class="label" style="margin-bottom:10px">الرسالة</div>
      <div class="message-box">${esc(p.body)}</div>
      <div style="text-align:center; margin-bottom:24px;">
        <a href="${esc(p.portalUrl)}" class="cta-btn">الرد على المعلم ←</a>
      </div>
      <hr class="divider"/>
      <p style="font-size:12px; color:${BRAND.muted}; text-align:center; line-height:1.6">
        هذا الرابط صالح لمدة 30 يوماً · <a href="${esc(p.portalUrl)}" style="color:${BRAND.green}">${esc(p.portalUrl)}</a>
      </p>
    </div>
  `);
}

interface TeacherReplyNotificationParams {
  teacherName: string; studentName: string; parentName: string; replyText: string; inboxUrl: string;
}

export function buildTeacherReplyNotificationEmail(p: TeacherReplyNotificationParams): string {
  return emailShell(`
    <div class="body">
      <p style="font-size:16px; font-weight:700; margin-bottom:16px; color:${BRAND.green}">أستاذ/ة ${esc(p.teacherName)}،</p>
      <p style="font-size:15px; margin-bottom:24px; color:${BRAND.muted}; line-height:1.6">
        ردّ <strong style="color:${BRAND.text}">${esc(p.parentName)}</strong> ولي أمر الطالب/ة
        <strong class="gold">${esc(p.studentName)}</strong> على رسالتك:
      </p>
      <div class="label" style="margin-bottom:10px">نص الرد</div>
      <div class="reply-box">${esc(p.replyText)}</div>
      <div style="text-align:center; margin-bottom:24px;">
        <a href="${esc(p.inboxUrl)}" class="cta-btn">عرض المحادثة كاملة ←</a>
      </div>
    </div>
  `);
}

interface ParentThreadReplyParams {
  teacherName: string; parentName?: string; replyText: string; portalUrl: string;
}

export function buildParentThreadReplyEmail(p: ParentThreadReplyParams): string {
  const greeting = p.parentName ? `عزيزي/عزيزتي ${esc(p.parentName)}،` : "ولي الأمر الكريم،";
  return emailShell(`
    <div class="body">
      <p style="font-size:16px; font-weight:700; margin-bottom:16px; color:${BRAND.green}">${greeting}</p>
      <p style="font-size:15px; margin-bottom:24px; color:${BRAND.muted}; line-height:1.6">
        ردّ المعلم <strong style="color:${BRAND.text}">${esc(p.teacherName)}</strong> على رسالتك:
      </p>
      <div class="label" style="margin-bottom:10px">رد المعلم</div>
      <div class="message-box">${esc(p.replyText)}</div>
      <div style="text-align:center; margin-bottom:24px;">
        <a href="${esc(p.portalUrl)}" class="cta-btn">الرد والمتابعة ←</a>
      </div>
    </div>
  `);
}
