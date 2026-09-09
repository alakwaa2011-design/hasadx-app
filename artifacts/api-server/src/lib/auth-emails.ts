/**
 * Standalone email-template builders for auth flows.
 * Kept in a separate module so they can be unit-tested without importing the
 * full Express router or the database layer.
 */

import {
  emailCode,
  emailFacts,
  emailHighlight,
  renderHasaadEmail,
} from "./email-design";
import { safeUrl } from "./html-escape";

export function buildOtpEmail(
  name: string,
  otp: string,
  verifyLink?: string,
): { html: string; text: string } {
  const html = renderHasaadEmail({
    title: "تأكيد البريد الإلكتروني",
    preheader: "أكمل تفعيل حسابك في حصاد خلال 30 دقيقة.",
    tone: "default",
    recipientName: name,
    bodyHtml: verifyLink
      ? `<p style="margin:0">استخدم الزر أو رمز التحقق أدناه لتفعيل حسابك. كلاهما صالح لمدة 30 دقيقة ولمرة واحدة.</p>
         ${emailCode(otp)}
         <p style="margin:0;color:#718078;font-size:13px">لا تشارك رمز التحقق مع أحد.</p>`
      : `<p style="margin:0">أدخل رمز التحقق التالي لتفعيل حسابك خلال 30 دقيقة.</p>
         ${emailCode(otp)}
         <p style="margin:0;color:#718078;font-size:13px">لا تشارك رمز التحقق مع أحد.</p>`,
    cta: verifyLink
      ? { label: "تأكيد البريد الإلكتروني", url: safeUrl(verifyLink) }
      : undefined,
  });

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
  const formatter = new Intl.DateTimeFormat("ar-KW-u-nu-latn", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kuwait",
  });
  const when = formatter.format(changedAt);
  const action =
    context === "reset"
      ? "إعادة تعيين كلمة المرور عبر رابط الاستعادة"
      : "تغيير كلمة المرور من صفحة الإعدادات";
  const sessions =
    context === "reset"
      ? "تم تسجيل الخروج من جميع الجلسات النشطة، وستحتاج إلى تسجيل الدخول مجددًا."
      : "تم تسجيل الخروج من الجلسات الأخرى مع الإبقاء على جلستك الحالية.";
  const html = renderHasaadEmail({
    title: "تم تغيير كلمة المرور",
    preheader: "تأكيد تغيير كلمة مرور حسابك في حصاد.",
    tone: "security",
    recipientName: safeName,
    bodyHtml: `<p style="margin:0">تم تحديث كلمة مرور حسابك بنجاح.</p>
      ${emailFacts([
        { label: "الإجراء", value: action },
        { label: "التاريخ والوقت", value: when },
      ])}
      <p style="margin:0">${sessions}</p>
      ${emailHighlight(
        "إذا لم تكن أنت من أجرى هذا التغيير، فتواصل مع المسؤول فورًا وأعد تعيين كلمة المرور لتأمين حسابك.",
        "security",
      )}`,
  });
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
  const formatter = new Intl.DateTimeFormat("ar-KW-u-nu-latn", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kuwait",
  });
  const when = formatter.format(loginAt);
  const browser = describeUserAgent(userAgent);
  const html = renderHasaadEmail({
    title: "تسجيل دخول من جهاز جديد",
    preheader: "راجع تفاصيل تسجيل الدخول الجديد إلى حسابك.",
    tone: "security",
    recipientName: safeName,
    bodyHtml: `<p style="margin:0">رصدنا دخولًا إلى حسابك من جهاز أو متصفح جديد.</p>
      ${emailFacts([
        { label: "الوقت", value: when },
        { label: "عنوان IP", value: ipAddress },
        { label: "المتصفح والجهاز", value: browser },
      ])}
      ${emailHighlight(
        "إذا لم تكن أنت، أنهِ الجلسة فورًا وغيّر كلمة المرور. وإن كنت أنت، فلا يلزمك أي إجراء.",
        "security",
      )}`,
    cta: {
      label: "مراجعة الجلسات النشطة",
      url: safeUrl(sessionsLink),
    },
  });
  const text = `مرحباً ${safeName}،\n\nتم تسجيل دخول إلى حسابك من جهاز جديد:\n- الوقت: ${when}\n- عنوان IP: ${ipAddress}\n- المتصفح/الجهاز: ${browser}\n\nإذا لم يكن هذا أنت، افتح صفحة الجلسات النشطة وأنهِ الجلسة:\n${sessionsLink}\n\nننصح أيضاً بتغيير كلمة المرور إذا شككت بأي نشاط مريب.`;
  return { html, text };
}

export function buildResetEmail(
  name: string,
  link: string,
): { html: string; text: string } {
  const safeName = name || "أستاذنا الكريم";
  const html = renderHasaadEmail({
    title: "استعادة كلمة المرور",
    preheader: "اختر كلمة مرور جديدة لحسابك في حصاد.",
    tone: "default",
    recipientName: safeName,
    bodyHtml:
      '<p style="margin:0">استخدم الزر لاختيار كلمة مرور جديدة خلال ساعة واحدة. يعمل الرابط مرة واحدة فقط، ويمكنك تجاهل الرسالة إن لم تطلبها.</p>',
    cta: {
      label: "إعادة تعيين كلمة المرور",
      url: safeUrl(link),
    },
  });
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
