/**
 * Standalone email-template builders for auth flows.
 * Kept in a separate module so they can be unit-tested without importing the
 * full Express router or the database layer.
 */

import { esc, safeUrl } from "./html-escape";

export function buildOtpEmail(
  name: string,
  otp: string,
  verifyLink?: string,
): { html: string; text: string } {
  // One-click button block (shown only when a verify link is provided, i.e. email channel)
  const buttonBlock = verifyLink
    ? `
          <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 20px">
            اضغط على الزر أدناه لتأكيد بريدك الإلكتروني والدخول إلى المنصة مباشرة:
          </p>
          <div style="text-align:center;margin:0 0 28px">
            <a href="${safeUrl(verifyLink)}"
               style="display:inline-block;background:linear-gradient(135deg,#1e5238,#2a6647);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:16px;font-weight:900;letter-spacing:0.5px">
              تأكيد البريد الإلكتروني
            </a>
          </div>
          <p style="font-size:13px;color:#888;text-align:center;margin:0 0 24px">
            الرابط صالح لمدة <strong>30 دقيقة</strong> ويمكن استخدامه مرة واحدة فقط.
          </p>
          <hr style="border:none;border-top:1px solid #ebebeb;margin:0 0 24px"/>
          <p style="font-size:13px;color:#888;text-align:center;margin:0 0 12px">
            إذا لم يعمل الزر، يمكنك استخدام رمز التحقق التالي يدوياً:
          </p>`
    : `
          <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 28px">شكراً لتسجيلك في منصة حصاد. أدخل الرمز التالي لتفعيل حسابك:</p>`;

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;direction:rtl">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <tr><td style="background:linear-gradient(135deg,#1e5238,#2a6647);padding:32px 40px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900">منصة حصاد</h1>
        </td></tr>
        <tr><td style="padding:40px">
          <p style="font-size:16px;color:#1a1a1a;margin:0 0 8px">مرحباً ${esc(name)}،</p>
          ${buttonBlock}
          <div style="text-align:center;margin:0 0 28px">
            <div style="display:inline-block;background:#f0f9f0;border:2px solid #1e5238;border-radius:12px;padding:16px 40px">
              <span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#1e5238;font-family:monospace">${esc(otp)}</span>
            </div>
          </div>
          <p style="font-size:13px;color:#888;text-align:center;margin:0">هذا الرمز صالح لمدة <strong>30 دقيقة</strong>. لا تشاركه مع أحد.</p>
        </td></tr>
        <tr><td style="background:#f8f8f8;padding:20px 40px;text-align:center">
          <p style="font-size:12px;color:#aaa;margin:0">منصة حصاد التعليمية</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textLink = verifyLink
    ? `\nرابط التحقق المباشر (صالح 30 دقيقة، مرة واحدة):\n${verifyLink}\n\nأو استخدم رمز التحقق يدوياً:\n`
    : `\nرمز التحقق:\n`;

  const text = `مرحباً ${name}،\n\nشكراً لتسجيلك في منصة حصاد.${textLink}\n${otp}\n\nهذا الرمز صالح لمدة 30 دقيقة. لا تشاركه مع أحد.`;
  return { html, text };
}

export function buildPasswordChangedEmail(
  name: string,
  changedAt: Date,
  context: "reset" | "change",
): { html: string; text: string } {
  const safeName = name || "أستاذنا الكريم";
  const formatter = new Intl.DateTimeFormat("ar", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kuwait",
  });
  const when = formatter.format(changedAt);
  const action =
    context === "reset"
      ? "إعادة تعيين كلمة المرور عبر رابط الاستعادة"
      : "تغيير كلمة المرور من صفحة الإعدادات";
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="font-family: -apple-system, Segoe UI, Tahoma, sans-serif; background:#f6f7fb; padding:24px; color:#1f2937;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:16px; padding:28px; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <h1 style="margin:0 0 12px; font-size:20px; color:#0f172a;">تنبيه أمني: تم تغيير كلمة المرور</h1>
      <p style="margin:0 0 16px; line-height:1.7;">مرحباً ${esc(safeName)}،</p>
      <p style="margin:0 0 16px; line-height:1.7;">
        نُعلمك بأنه تم ${action} لحسابك في منصة حصاد بتاريخ:
      </p>
      <p style="margin:0 0 16px; line-height:1.7; background:#f1f5f9; padding:10px 14px; border-radius:8px; font-weight:bold; color:#0f172a;">
        ${when}
      </p>
      <p style="margin:0 0 16px; line-height:1.7;">
        ${
          context === "reset"
            ? "كما تم تسجيل الخروج من جميع الجلسات النشطة كإجراء احترازي، وستحتاج إلى تسجيل الدخول من جديد على جميع الأجهزة."
            : "كما تم تسجيل الخروج من جميع الجلسات الأخرى على الأجهزة الأخرى كإجراء احترازي، مع الإبقاء على جلستك الحالية."
        }
      </p>
      <p style="margin:18px 0 0; line-height:1.7; font-size:14px; color:#b91c1c; font-weight:bold;">
        إذا لم تكن أنت من قام بهذا التغيير، يرجى التواصل مع المسؤول فوراً وإعادة تعيين كلمة المرور مرة أخرى لتأمين حسابك.
      </p>
    </div>
  </body>
</html>`;
  const sessionsText =
    context === "reset"
      ? "تم تسجيل الخروج من جميع الجلسات النشطة."
      : "تم تسجيل الخروج من جميع الجلسات الأخرى.";
  const text = `مرحباً ${safeName}،\n\nتم ${action} لحسابك في منصة حصاد بتاريخ: ${when}\n\n${sessionsText}\n\nإذا لم تكن أنت من قام بهذا التغيير، يرجى التواصل مع المسؤول فوراً.`;
  return { html, text };
}

export function buildNewDeviceLoginEmail(
  name: string,
  loginAt: Date,
  ipAddress: string,
  userAgent: string,
  sessionsLink: string,
): { html: string; text: string } {
  const safeName = name || "أستاذنا الكريم";
  const formatter = new Intl.DateTimeFormat("ar", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kuwait",
  });
  const when = formatter.format(loginAt);
  const browser = describeUserAgent(userAgent);
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="font-family: -apple-system, Segoe UI, Tahoma, sans-serif; background:#f6f7fb; padding:24px; color:#1f2937;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:28px; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <h1 style="margin:0 0 12px; font-size:20px; color:#0f172a;">تنبيه أمني: تسجيل دخول من جهاز جديد</h1>
      <p style="margin:0 0 16px; line-height:1.7;">مرحباً ${esc(safeName)}،</p>
      <p style="margin:0 0 16px; line-height:1.7;">
        رصدنا تسجيل دخول جديد إلى حسابك في منصة حصاد من جهاز أو متصفح لم نتعرف عليه سابقاً.
      </p>
      <table style="width:100%; border-collapse:collapse; background:#f1f5f9; border-radius:8px; overflow:hidden; margin:0 0 18px;">
        <tr><td style="padding:10px 14px; font-weight:bold; color:#0f172a; width:35%;">الوقت</td><td style="padding:10px 14px;">${esc(when)}</td></tr>
        <tr><td style="padding:10px 14px; font-weight:bold; color:#0f172a; background:#e2e8f0;">عنوان IP</td><td style="padding:10px 14px; background:#e2e8f0;">${esc(ipAddress)}</td></tr>
        <tr><td style="padding:10px 14px; font-weight:bold; color:#0f172a;">المتصفح/الجهاز</td><td style="padding:10px 14px;">${esc(browser)}</td></tr>
      </table>
      <p style="margin:0 0 16px; line-height:1.7;">
        إذا كنت أنت من قام بتسجيل الدخول، فلا حاجة لأي إجراء.
      </p>
      <p style="margin:0 0 16px; line-height:1.7;">
        إذا لم يكن هذا أنت، افتح صفحة الجلسات النشطة وأنهِ هذه الجلسة فوراً.
      </p>
      <p style="text-align:center; margin:24px 0;">
        <a href="${safeUrl(sessionsLink)}" style="display:inline-block; background:#dc2626; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:10px; font-weight:bold;">
          مراجعة الجلسات النشطة
        </a>
      </p>
      <p style="margin:0 0 8px; line-height:1.7; font-size:13px; color:#475569;">
        إذا لم يعمل الزر، انسخ الرابط التالي والصقه في المتصفح:
      </p>
      <p style="word-break:break-all; font-size:12px; color:#334155; background:#f1f5f9; padding:10px; border-radius:8px;">${esc(sessionsLink)}</p>
      <p style="margin:18px 0 0; line-height:1.7; font-size:13px; color:#b91c1c;">
        ننصح أيضاً بتغيير كلمة المرور إذا شككت بأي نشاط مريب على حسابك.
      </p>
    </div>
  </body>
</html>`;
  const text = `مرحباً ${safeName}،\n\nتم تسجيل دخول إلى حسابك من جهاز جديد:\n- الوقت: ${when}\n- عنوان IP: ${ipAddress}\n- المتصفح/الجهاز: ${browser}\n\nإذا لم يكن هذا أنت، افتح صفحة الجلسات النشطة وأنهِ الجلسة:\n${sessionsLink}\n\nننصح أيضاً بتغيير كلمة المرور إذا شككت بأي نشاط مريب.`;
  return { html, text };
}

export function buildResetEmail(
  name: string,
  link: string,
): { html: string; text: string } {
  const safeName = name || "أستاذنا الكريم";
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="font-family: -apple-system, Segoe UI, Tahoma, sans-serif; background:#f6f7fb; padding:24px; color:#1f2937;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:16px; padding:28px; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <h1 style="margin:0 0 12px; font-size:20px; color:#0f172a;">استعادة كلمة المرور</h1>
      <p style="margin:0 0 16px; line-height:1.7;">مرحباً ${esc(safeName)}،</p>
      <p style="margin:0 0 16px; line-height:1.7;">
        لقد طلبت إعادة تعيين كلمة المرور الخاصة بحسابك في منصة حصاد. اضغط على الزر أدناه لاختيار كلمة مرور جديدة. هذا الرابط صالح لمدة ساعة واحدة فقط ويمكن استخدامه مرة واحدة.
      </p>
      <p style="text-align:center; margin:24px 0;">
        <a href="${safeUrl(link)}" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:10px; font-weight:bold;">
          إعادة تعيين كلمة المرور
        </a>
      </p>
      <p style="margin:0 0 8px; line-height:1.7; font-size:13px; color:#475569;">
        إذا لم يعمل الزر، انسخ الرابط التالي والصقه في المتصفح:
      </p>
      <p style="word-break:break-all; font-size:12px; color:#334155; background:#f1f5f9; padding:10px; border-radius:8px;">${esc(link)}</p>
      <p style="margin:18px 0 0; line-height:1.7; font-size:13px; color:#64748b;">
        إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة وستبقى كلمة مرورك كما هي.
      </p>
    </div>
  </body>
</html>`;
  const text = `مرحباً ${safeName}،\n\nطلبت إعادة تعيين كلمة المرور لحسابك في منصة حصاد.\nاستخدم الرابط التالي خلال ساعة واحدة لاختيار كلمة مرور جديدة:\n\n${link}\n\nإذا لم تطلب ذلك، تجاهل هذه الرسالة.`;
  return { html, text };
}

// ---------------------------------------------------------------------------
// Internal helpers (not exported — used by the builders above)
// ---------------------------------------------------------------------------

function describeUserAgent(ua: string): string {
  if (!ua || ua === "unknown") return "متصفح غير معروف";
  let browser = "متصفح غير معروف";
  if (/Edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Google Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = "Safari";
  let os = "";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return os ? `${browser} على ${os}` : browser;
}
