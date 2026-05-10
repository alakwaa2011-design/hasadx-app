import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db, pool, teachersTable, passwordResetTokensTable, trustedDevicesTable } from "@workspace/db";
import { eq, or, and, isNull, gt } from "drizzle-orm";
import {
  RegisterTeacherBody,
  LoginTeacherBody,
} from "@workspace/api-zod";
import { z } from "zod";

const PHONE_REGEX = /^\+\d{7,15}$/;
const LEGACY_PHONE_REGEX = /^\d{7,15}$/;

const UpdateProfileSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    email: z.string().email().max(320).optional().or(z.literal("")),
    phone: z
      .string()
      .max(20)
      .regex(/^(\+\d{7,15}|\d{7,15})$/)
      .optional()
      .or(z.literal("")),
  })
  .strict();

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(6).max(200),
  })
  .strict();

const ForgotPasswordSchema = z
  .object({
    identifier: z.string().min(1).max(320),
  })
  .strict();

const ResetPasswordSchema = z
  .object({
    token: z.string().min(1).max(500),
    newPassword: z.string().min(6).max(200),
  })
  .strict();

const RevokeDeviceSchema = z
  .object({
    token: z.string().min(1).max(500).optional(),
  })
  .partial();
import { authLimiter, registerLimiter } from "../lib/rate-limiter";
import { sendEmail, getAppBaseUrl } from "../lib/email";
import { isSmsConfigured, sendSms } from "../lib/sms";
import { parseUserAgent, lookupIpLocations } from "../lib/device-info";
import { logIslamicEvent } from "../lib/islamicEvents";
import { logActivity } from "../lib/activity-logger";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_GENERIC_RESPONSE = {
  message: "إذا كان الحساب موجوداً، فسيتم إرسال تعليمات الاستعادة قريباً",
};

function buildPasswordChangedEmail(
  name: string,
  changedAt: Date,
  context: "reset" | "change",
) {
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
      <p style="margin:0 0 16px; line-height:1.7;">مرحباً ${safeName}،</p>
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
      ? "تم تسجيل الخروج من جميع الجلسات النشطة كإجراء احترازي."
      : "تم تسجيل الخروج من جميع الجلسات الأخرى على الأجهزة الأخرى مع الإبقاء على جلستك الحالية.";
  const text = `مرحباً ${safeName}،\n\nتم ${action} لحسابك في منصة حصاد بتاريخ ${when}.\n${sessionsText}\n\nإذا لم تكن أنت، تواصل مع المسؤول فوراً وأعد تعيين كلمة المرور.`;
  return { html, text };
}

async function revokeTeacherSessions(
  teacherId: number,
  exceptSid: string | null,
  log: { error: (obj: any, msg?: string) => void; info: (obj: any, msg?: string) => void },
) {
  try {
    if (exceptSid) {
      await pool.query(
        `DELETE FROM "session" WHERE (sess->>'teacherId')::int = $1 AND sid <> $2`,
        [teacherId, exceptSid],
      );
    } else {
      await pool.query(
        `DELETE FROM "session" WHERE (sess->>'teacherId')::int = $1`,
        [teacherId],
      );
    }
  } catch (err) {
    log.error({ err, teacherId }, "Failed to revoke teacher sessions");
  }
}

async function sendPasswordChangedNotification(
  teacherId: number,
  context: "reset" | "change",
  log: { error: (obj: any, msg?: string) => void; info: (obj: any, msg?: string) => void },
) {
  try {
    const [teacher] = await db
      .select()
      .from(teachersTable)
      .where(eq(teachersTable.id, teacherId))
      .limit(1);
    if (!teacher || !teacher.email) {
      log.info({ teacherId }, "Password change notification skipped: no email on file");
      return;
    }
    const { html, text } = buildPasswordChangedEmail(teacher.name, new Date(), context);
    const result = await sendEmail({
      to: teacher.email,
      subject: "تنبيه أمني: تم تغيير كلمة المرور - منصة حصاد",
      html,
      text,
    });
    if (!result.delivered) {
      log.info(
        { teacherId, reason: result.reason, context },
        "Password change notification not delivered",
      );
    } else {
      log.info({ teacherId, context }, "Password change notification sent");
    }
  } catch (err) {
    log.error({ err, teacherId, context }, "Failed to send password change notification");
  }
}

function getClientIp(req: any): string {
  // Express resolves req.ip per the configured "trust proxy" setting
  // (see app.set("trust proxy", 1) in app.ts), so it cannot be spoofed by
  // arbitrary client-supplied X-Forwarded-For headers beyond the trusted hop.
  const ip = req.ip || req.socket?.remoteAddress;
  return ip ? String(ip) : "unknown";
}

function getUserAgent(req: any): string {
  const ua = req.headers?.["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 512) : "unknown";
}

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

function normalizeIpForFingerprint(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  // Strip IPv6 zone id and IPv4-mapped prefix.
  const cleaned = ip.replace(/%.*$/, "").replace(/^::ffff:/i, "");
  // IPv4 → /24 (network)
  const v4 = cleaned.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  // IPv6 → /48 (first three hextets)
  if (cleaned.includes(":")) {
    const parts = cleaned.split(":").filter(Boolean);
    return parts.slice(0, 3).join(":") + "::/48";
  }
  return cleaned;
}

function computeFingerprint(userAgent: string, ipAddress: string): string {
  const network = normalizeIpForFingerprint(ipAddress);
  return crypto.createHash("sha256").update(`ua:${userAgent}|net:${network}`).digest("hex");
}

function buildNewDeviceLoginEmail(
  name: string,
  loginAt: Date,
  ipAddress: string,
  userAgent: string,
  sessionsLink: string,
) {
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
      <p style="margin:0 0 16px; line-height:1.7;">مرحباً ${safeName}،</p>
      <p style="margin:0 0 16px; line-height:1.7;">
        رصدنا تسجيل دخول جديد إلى حسابك في منصة حصاد من جهاز أو متصفح لم نتعرف عليه سابقاً.
      </p>
      <table style="width:100%; border-collapse:collapse; background:#f1f5f9; border-radius:8px; overflow:hidden; margin:0 0 18px;">
        <tr><td style="padding:10px 14px; font-weight:bold; color:#0f172a; width:35%;">الوقت</td><td style="padding:10px 14px;">${when}</td></tr>
        <tr><td style="padding:10px 14px; font-weight:bold; color:#0f172a; background:#e2e8f0;">عنوان IP</td><td style="padding:10px 14px; background:#e2e8f0;">${ipAddress}</td></tr>
        <tr><td style="padding:10px 14px; font-weight:bold; color:#0f172a;">المتصفح/الجهاز</td><td style="padding:10px 14px;">${browser}</td></tr>
      </table>
      <p style="margin:0 0 16px; line-height:1.7;">
        إذا كنت أنت من قام بتسجيل الدخول، فلا حاجة لأي إجراء.
      </p>
      <p style="margin:0 0 16px; line-height:1.7;">
        إذا لم يكن هذا أنت، افتح صفحة الجلسات النشطة وأنهِ هذه الجلسة فوراً.
      </p>
      <p style="text-align:center; margin:24px 0;">
        <a href="${sessionsLink}" style="display:inline-block; background:#dc2626; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:10px; font-weight:bold;">
          مراجعة الجلسات النشطة
        </a>
      </p>
      <p style="margin:0 0 8px; line-height:1.7; font-size:13px; color:#475569;">
        إذا لم يعمل الزر، انسخ الرابط التالي والصقه في المتصفح:
      </p>
      <p style="word-break:break-all; font-size:12px; color:#334155; background:#f1f5f9; padding:10px; border-radius:8px;">${sessionsLink}</p>
      <p style="margin:18px 0 0; line-height:1.7; font-size:13px; color:#b91c1c;">
        ننصح أيضاً بتغيير كلمة المرور إذا شككت بأي نشاط مريب على حسابك.
      </p>
    </div>
  </body>
</html>`;
  const text = `مرحباً ${safeName}،

تم تسجيل دخول إلى حسابك من جهاز جديد:
- الوقت: ${when}
- عنوان IP: ${ipAddress}
- المتصفح/الجهاز: ${browser}

إذا لم يكن هذا أنت، افتح صفحة الجلسات النشطة وأنهِ الجلسة:
${sessionsLink}

ننصح أيضاً بتغيير كلمة المرور إذا شككت بأي نشاط مريب.`;
  return { html, text };
}

async function trackLoginDevice(
  req: any,
  teacher: typeof teachersTable.$inferSelect,
  log: { error: (obj: any, msg?: string) => void; info: (obj: any, msg?: string) => void; warn: (obj: any, msg?: string) => void },
) {
  try {
    const userAgent = getUserAgent(req);
    const ipAddress = getClientIp(req);
    const fingerprintHash = computeFingerprint(userAgent, ipAddress);
    const now = new Date();

    const [existing] = await db
      .select()
      .from(trustedDevicesTable)
      .where(
        and(
          eq(trustedDevicesTable.teacherId, teacher.id),
          eq(trustedDevicesTable.fingerprintHash, fingerprintHash),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(trustedDevicesTable)
        .set({ lastSeenAt: now, ipAddress })
        .where(eq(trustedDevicesTable.id, existing.id));
      return;
    }

    // Count existing devices to decide whether to notify.
    const allDevices = await db
      .select({ id: trustedDevicesTable.id })
      .from(trustedDevicesTable)
      .where(eq(trustedDevicesTable.teacherId, teacher.id));
    const isFirstDeviceEver = allDevices.length === 0;

    await db.insert(trustedDevicesTable).values({
      teacherId: teacher.id,
      fingerprintHash,
      userAgent,
      ipAddress,
      revokeTokenHash: null,
      revokeTokenExpiresAt: null,
      firstSeenAt: now,
      lastSeenAt: now,
    });

    const sessionsLink = `${getAppBaseUrl()}/teacher/sessions`;

    if (isFirstDeviceEver) {
      log.info({ teacherId: teacher.id }, "First trusted device recorded; no alert sent");
      return;
    }

    if (!teacher.email) {
      log.info({ teacherId: teacher.id }, "New device login but no email on file; alert skipped");
      return;
    }

    const { html, text } = buildNewDeviceLoginEmail(
      teacher.name,
      now,
      ipAddress,
      userAgent,
      sessionsLink,
    );
    const result = await sendEmail({
      to: teacher.email,
      subject: "تنبيه أمني: تسجيل دخول من جهاز جديد - منصة حصاد",
      html,
      text,
    });
    if (!result.delivered) {
      log.warn(
        { teacherId: teacher.id, reason: result.reason },
        "New device login alert not delivered",
      );
    } else {
      log.info({ teacherId: teacher.id }, "New device login alert sent");
    }
  } catch (err) {
    log.error({ err, teacherId: teacher.id }, "Failed to track login device");
  }
}

function buildResetEmail(name: string, link: string) {
  const safeName = name || "أستاذنا الكريم";
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="font-family: -apple-system, Segoe UI, Tahoma, sans-serif; background:#f6f7fb; padding:24px; color:#1f2937;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:16px; padding:28px; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <h1 style="margin:0 0 12px; font-size:20px; color:#0f172a;">استعادة كلمة المرور</h1>
      <p style="margin:0 0 16px; line-height:1.7;">مرحباً ${safeName}،</p>
      <p style="margin:0 0 16px; line-height:1.7;">
        لقد طلبت إعادة تعيين كلمة المرور الخاصة بحسابك في منصة حصاد. اضغط على الزر أدناه لاختيار كلمة مرور جديدة. هذا الرابط صالح لمدة ساعة واحدة فقط ويمكن استخدامه مرة واحدة.
      </p>
      <p style="text-align:center; margin:24px 0;">
        <a href="${link}" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:10px; font-weight:bold;">
          إعادة تعيين كلمة المرور
        </a>
      </p>
      <p style="margin:0 0 8px; line-height:1.7; font-size:13px; color:#475569;">
        إذا لم يعمل الزر، انسخ الرابط التالي والصقه في المتصفح:
      </p>
      <p style="word-break:break-all; font-size:12px; color:#334155; background:#f1f5f9; padding:10px; border-radius:8px;">${link}</p>
      <p style="margin:18px 0 0; line-height:1.7; font-size:13px; color:#64748b;">
        إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة وستبقى كلمة مرورك كما هي.
      </p>
    </div>
  </body>
</html>`;
  const text = `مرحباً ${safeName}،\n\nطلبت إعادة تعيين كلمة المرور لحسابك في منصة حصاد.\nاستخدم الرابط التالي خلال ساعة واحدة لاختيار كلمة مرور جديدة:\n\n${link}\n\nإذا لم تطلب ذلك، تجاهل هذه الرسالة.`;
  return { html, text };
}

function buildResetSms(link: string) {
  return `رمز استعادة كلمة المرور لمنصة حصاد:\n${link}\nالرابط صالح لمدة ساعة واحدة.`;
}

declare module "express-session" {
  interface SessionData {
    teacherId: number;
    studentAccountId: number;
    userAgent?: string;
    ip?: string;
    createdAt?: string;
    lastSeenAt?: string;
  }
}

function stampTeacherSession(req: any) {
  const ua = req.headers["user-agent"];
  const now = new Date().toISOString();
  if (typeof ua === "string" && ua.length > 0) {
    req.session.userAgent = ua.slice(0, 500);
  }
  req.session.ip = req.ip ?? null;
  req.session.createdAt = now;
  req.session.lastSeenAt = now;
}

const router: IRouter = Router();

router.post("/auth/register", registerLimiter, async (req, res) => {
  try {
    const body = RegisterTeacherBody.parse(req.body);

    if (!body.email && !body.phone) {
      res.status(400).json({ message: "يجب إدخال البريد الإلكتروني أو رقم الهاتف" });
      return;
    }

    // Validate international format: + followed by 7-15 digits total (E.164-like)
    if (body.phone && !/^\+\d{7,15}$/.test(body.phone)) {
      res.status(400).json({ message: "رقم الهاتف غير صحيح" });
      return;
    }

    const conditions = [];
    if (body.email) conditions.push(eq(teachersTable.email, body.email));
    if (body.phone) {
      conditions.push(eq(teachersTable.phone, body.phone));
      // Also check legacy 8-digit Kuwait format to prevent duplicate identities
      if (body.phone.startsWith("+965")) {
        const legacyPhone = body.phone.slice(4);
        if (/^\d{8}$/.test(legacyPhone)) {
          conditions.push(eq(teachersTable.phone, legacyPhone));
        }
      }
    }

    const existing = await db
      .select()
      .from(teachersTable)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ message: "البريد الإلكتروني أو رقم الهاتف مسجل مسبقاً" });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    // Public registration only allows teacher|organizer roles. Admin must be granted internally.
    const requestedRole =
      body.role === "organizer" ? "organizer" : "teacher";
    const [teacher] = await db
      .insert(teachersTable)
      .values({
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        passwordHash,
        role: requestedRole,
      })
      .returning();

    delete req.session.studentAccountId;
    req.session.teacherId = teacher.id;
    stampTeacherSession(req);

    void logIslamicEvent({
      userId: teacher.id,
      eventType: "login",
      metadata: { method: "register" },
    });

    res.status(201).json({
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone,
        role: teacher.role,
      },
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Registration error");
    res.status(400).json({ message: error.message || "خطأ في التسجيل" });
  }
});

router.post("/auth/login", authLimiter, async (req, res) => {
  try {
    const body = LoginTeacherBody.parse(req.body);

    if (!body.email && !body.phone) {
      res.status(400).json({ message: "يجب إدخال البريد الإلكتروني أو رقم الهاتف" });
      return;
    }

    const identifier = body.email || body.phone!;

    let teacher: typeof teachersTable.$inferSelect | undefined;

    if (body.email) {
      const rows = await db
        .select()
        .from(teachersTable)
        .where(eq(teachersTable.email, identifier))
        .limit(1);
      teacher = rows[0];
    } else {
      // Primary lookup: exact match on full phone (handles new users with country code)
      const rows = await db
        .select()
        .from(teachersTable)
        .where(eq(teachersTable.phone, identifier))
        .limit(1);
      teacher = rows[0];

      // Legacy fallback: original platform was Kuwait-only with 8-digit plain numbers.
      // If the user sends "+965XXXXXXXX" and there's no exact match, try "XXXXXXXX".
      if (!teacher && identifier.startsWith("+965")) {
        const legacyPhone = identifier.slice(4); // "+96599123456" → "99123456"
        if (/^\d{8}$/.test(legacyPhone)) {
          const legacyRows = await db
            .select()
            .from(teachersTable)
            .where(eq(teachersTable.phone, legacyPhone))
            .limit(1);
          teacher = legacyRows[0];
        }
      }
    }

    if (!teacher) {
      res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
      return;
    }

    const valid = await bcrypt.compare(body.password, teacher.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
      return;
    }

    if (teacher.isBlocked) {
      res.status(403).json({ message: "تم حظر حسابك. تواصل مع المسؤول" });
      return;
    }

    delete req.session.studentAccountId;
    req.session.teacherId = teacher.id;
    stampTeacherSession(req);

    void logIslamicEvent({
      userId: teacher.id,
      eventType: "login",
      metadata: { method: "password" },
    });

    logActivity({
      req,
      userId: teacher.id,
      userName: teacher.name,
      userRole: teacher.isAdmin ? "admin" : (teacher.role === "organizer" ? "organizer" : "teacher"),
      action: "login",
      details: { method: "password" },
    });

    if (body.rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    }

    await db.update(teachersTable).set({ lastLoginAt: new Date() }).where(eq(teachersTable.id, teacher.id));

    void trackLoginDevice(req, teacher, req.log);

    res.json({
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone,
        isAdmin: teacher.isAdmin,
        role: teacher.role,
      },
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Login error");
    res.status(400).json({ message: error.message || "خطأ في تسجيل الدخول" });
  }
});

router.get("/auth/me", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return;
  }

  const [teacher] = await db
    .select()
    .from(teachersTable)
    .where(eq(teachersTable.id, req.session.teacherId))
    .limit(1);

  if (!teacher) {
    res.status(401).json({ message: "المستخدم غير موجود" });
    return;
  }

  res.json({
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    isAdmin: teacher.isAdmin,
    role: teacher.role,
    aiTier: teacher.aiTier,
    hasProDesign: teacher.hasProDesign,
  });
});

// Allow the current user to switch their role between teacher and organizer.
// Admin role is reserved and cannot be self-assigned, and admins themselves
// cannot demote/switch their admin role from this endpoint either.
router.patch("/auth/role", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return;
  }
  const { role } = req.body ?? {};
  if (role !== "teacher" && role !== "organizer") {
    res.status(400).json({ message: "دور غير صالح" });
    return;
  }
  // Look up the current user first so admins are protected from self-demotion.
  const [current] = await db
    .select()
    .from(teachersTable)
    .where(eq(teachersTable.id, req.session.teacherId))
    .limit(1);
  if (!current) {
    res.status(401).json({ message: "المستخدم غير موجود" });
    return;
  }
  if (current.isAdmin || current.role === "admin") {
    res.status(403).json({
      message: "لا يمكن تغيير نوع حساب المسؤول",
    });
    return;
  }
  const [updated] = await db
    .update(teachersTable)
    .set({ role })
    .where(eq(teachersTable.id, req.session.teacherId))
    .returning();
  if (!updated) {
    res.status(401).json({ message: "المستخدم غير موجود" });
    return;
  }
  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    isAdmin: updated.isAdmin,
    role: updated.role,
  });
});

router.patch("/auth/profile", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return;
  }

  try {
    const parsed = UpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صحيحة" });
      return;
    }
    const { name, email, phone } = parsed.data;

    if (email) {
      const [existing] = await db
        .select()
        .from(teachersTable)
        .where(eq(teachersTable.email, email))
        .limit(1);
      if (existing && existing.id !== req.session.teacherId) {
        res.status(409).json({ message: "البريد الإلكتروني مستخدم بالفعل" });
        return;
      }
    }

    if (phone) {
      const [existing] = await db
        .select()
        .from(teachersTable)
        .where(eq(teachersTable.phone, phone))
        .limit(1);
      if (existing && existing.id !== req.session.teacherId) {
        res.status(409).json({ message: "رقم الهاتف مستخدم بالفعل" });
        return;
      }
    }

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email || null;
    if (phone !== undefined) updateData.phone = phone || null;

    const [updated] = await db
      .update(teachersTable)
      .set(updateData)
      .where(eq(teachersTable.id, req.session.teacherId))
      .returning();

    res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Profile update error");
    res.status(400).json({ message: error.message || "خطأ في تحديث الملف الشخصي" });
  }
});

router.patch("/auth/change-password", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return;
  }
  try {
    const parsed = ChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "كلمة السر الجديدة يجب أن تكون 6 أحرف على الأقل" });
      return;
    }
    const { currentPassword, newPassword } = parsed.data;
    const [teacher] = await db
      .select()
      .from(teachersTable)
      .where(eq(teachersTable.id, req.session.teacherId))
      .limit(1);
    if (!teacher) {
      res.status(404).json({ message: "المستخدم غير موجود" });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, teacher.passwordHash);
    if (!valid) {
      res.status(403).json({ message: "كلمة السر الحالية غير صحيحة" });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    const teacherId = req.session.teacherId;
    await db
      .update(teachersTable)
      .set({ passwordHash: newHash })
      .where(eq(teachersTable.id, teacherId));
    await revokeTeacherSessions(teacherId, req.sessionID ?? null, req.log);
    await sendPasswordChangedNotification(teacherId, "change", req.log);
    res.json({ message: "تم تغيير كلمة السر بنجاح" });
  } catch (error: any) {
    req.log.error({ err: error }, "Password change error");
    res.status(500).json({ message: "خطأ في تغيير كلمة السر" });
  }
});

function buildResetUrl(req: any, token: string): string {
  const configured = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return `${configured}/reset-password?token=${token}`;
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "";
  return `${proto}://${host}/reset-password?token=${token}`;
}

const GENERIC_RESET_RESPONSE = {
  message: "إذا كان الحساب موجوداً، فسيتم إرسال تعليمات الاستعادة قريباً",
};

router.post("/auth/forgot-password", authLimiter, async (req, res) => {
  // Always return a generic success message to avoid account enumeration,
  // regardless of whether the identifier matches an account or delivery succeeds.
  try {
    const parsed = ForgotPasswordSchema.safeParse({
      identifier: typeof req.body?.identifier === "string" ? req.body.identifier.trim() : "",
    });
    if (!parsed.success) {
      res.status(400).json({ message: "يجب إدخال البريد الإلكتروني أو رقم الهاتف" });
      return;
    }
    const identifier = parsed.data.identifier;
    const isEmail = identifier.includes("@");

    let teacher: typeof teachersTable.$inferSelect | undefined;
    if (isEmail) {
      const rows = await db
        .select()
        .from(teachersTable)
        .where(eq(teachersTable.email, identifier.toLowerCase()))
        .limit(1);
      teacher = rows[0];
    } else {
      const rows = await db
        .select()
        .from(teachersTable)
        .where(eq(teachersTable.phone, identifier))
        .limit(1);
      teacher = rows[0];
      if (!teacher && identifier.startsWith("+965")) {
        const legacyPhone = identifier.slice(4);
        if (/^\d{8}$/.test(legacyPhone)) {
          const legacyRows = await db
            .select()
            .from(teachersTable)
            .where(eq(teachersTable.phone, legacyPhone))
            .limit(1);
          teacher = legacyRows[0];
        }
      }
    }

    if (!teacher) {
      req.log.info(
        { kind: isEmail ? "email" : "phone" },
        "Password reset requested for unknown identifier",
      );
      res.json(RESET_GENERIC_RESPONSE);
      return;
    }

    // Pick the delivery channel:
    // - If the requester used an email identifier (and the teacher has email), email it.
    // - Otherwise, if the teacher has a phone, send via SMS so phone-only accounts can recover.
    // - If neither is possible, fall through with a generic response.
    const canEmail = !!teacher.email;
    const canSms = !!teacher.phone;
    const channel: "email" | "sms" | null = isEmail
      ? canEmail
        ? "email"
        : canSms
          ? "sms"
          : null
      : canSms
        ? "sms"
        : canEmail
          ? "email"
          : null;

    if (!channel) {
      req.log.info(
        { teacherId: teacher.id },
        "Password reset skipped: teacher has no email or phone on file",
      );
      res.json(RESET_GENERIC_RESPONSE);
      return;
    }

    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await db.insert(passwordResetTokensTable).values({
      teacherId: teacher.id,
      tokenHash,
      expiresAt,
    });

    const link = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;

    let delivered = false;
    let deliveryReason: string | undefined;

    if (channel === "email") {
      const { html, text } = buildResetEmail(teacher.name, link);
      const result = await sendEmail({
        to: teacher.email!,
        subject: "استعادة كلمة المرور - منصة حصاد",
        html,
        text,
      });
      delivered = result.delivered;
      deliveryReason = result.reason;
    } else {
      // SMS branch — phone-only teachers (Task #176)
      if (!isSmsConfigured()) {
        delivered = false;
        deliveryReason = "sms_not_configured";
      } else {
        try {
          const targetPhone = teacher.phone!.startsWith("+")
            ? teacher.phone!
            : `+965${teacher.phone!}`;
          await sendSms(targetPhone, buildResetSms(link));
          delivered = true;
        } catch (smsErr: any) {
          delivered = false;
          deliveryReason = smsErr?.message || "sms_send_failed";
          req.log.error(
            { err: smsErr, teacherId: teacher.id },
            "Failed to send password reset SMS",
          );
        }
      }
    }

    if (!delivered) {
      // Invalidate the token immediately to limit exposure if delivery failed.
      await db
        .update(passwordResetTokensTable)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokensTable.tokenHash, tokenHash));
      req.log.warn(
        { reason: deliveryReason, channel, teacherId: teacher.id },
        "Password reset not delivered; token invalidated",
      );
    } else {
      req.log.info({ channel, teacherId: teacher.id }, "Password reset link sent");
    }

    res.json(RESET_GENERIC_RESPONSE);
  } catch (error: any) {
    req.log.error({ err: error }, "Forgot-password error");
    res.json(RESET_GENERIC_RESPONSE);
  }
});

router.post("/auth/reset-password", authLimiter, async (req, res) => {
  try {
    const parsed = ResetPasswordSchema.safeParse({
      token: typeof req.body?.token === "string" ? req.body.token.trim() : "",
      newPassword: typeof req.body?.newPassword === "string" ? req.body.newPassword : "",
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.path[0];
      const message =
        issue === "newPassword"
          ? "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"
          : "رمز الاستعادة مفقود";
      res.status(400).json({ message });
      return;
    }
    const { token, newPassword } = parsed.data;

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const newHash = await bcrypt.hash(newPassword, 10);

    // Atomically claim the token: only one concurrent request can succeed.
    const claimed = await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokensTable.tokenHash, tokenHash),
          isNull(passwordResetTokensTable.usedAt),
          gt(passwordResetTokensTable.expiresAt, new Date()),
        ),
      )
      .returning({ teacherId: passwordResetTokensTable.teacherId });

    if (claimed.length === 0) {
      res.status(400).json({ message: "رابط الاستعادة غير صالح أو منتهي الصلاحية" });
      return;
    }

    const teacherId = claimed[0].teacherId;
    await db
      .update(teachersTable)
      .set({ passwordHash: newHash })
      .where(eq(teachersTable.id, teacherId));

    await revokeTeacherSessions(teacherId, null, req.log);
    await sendPasswordChangedNotification(teacherId, "reset", req.log);

    res.json({ message: "تم تحديث كلمة المرور بنجاح" });
  } catch (error: any) {
    req.log.error({ err: error }, "Reset-password error");
    res.status(500).json({ message: "خطأ في إعادة تعيين كلمة المرور" });
  }
});

router.get("/auth/reset-password/verify", async (req, res) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (!token) {
      res.json({ valid: false });
      return;
    }
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [record] = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.tokenHash, tokenHash),
          isNull(passwordResetTokensTable.usedAt),
          gt(passwordResetTokensTable.expiresAt, new Date()),
        ),
      )
      .limit(1);
    res.json({ valid: !!record });
  } catch (error: any) {
    req.log.error({ err: error }, "Reset-password verify error");
    res.json({ valid: false });
  }
});

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function renderRevokePage(
  res: any,
  status: number,
  opts: {
    title: string;
    message: string;
    form?: { actionUrl: string; token: string };
    link?: { href: string; label: string };
  },
) {
  const formHtml = opts.form
    ? `<form method="POST" action="${escapeHtml(opts.form.actionUrl)}" style="text-align:center; margin:24px 0;">
        <input type="hidden" name="token" value="${escapeHtml(opts.form.token)}" />
        <button type="submit" style="display:inline-block; background:#dc2626; color:#ffffff; border:none; cursor:pointer; padding:12px 24px; border-radius:10px; font-weight:bold; font-size:16px;">
          نعم، قم بتأمين حسابي الآن
        </button>
      </form>`
    : "";
  const linkHtml = opts.link
    ? `<p style="text-align:center; margin:24px 0;"><a href="${escapeHtml(opts.link.href)}" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:10px; font-weight:bold;">${escapeHtml(opts.link.label)}</a></p>`
    : "";
  res
    .status(status)
    .set("Cache-Control", "no-store")
    .set("X-Robots-Tag", "noindex, nofollow")
    .type("html")
    .send(`<!doctype html>
<html lang="ar" dir="rtl">
  <head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(opts.title)}</title></head>
  <body style="font-family: -apple-system, Segoe UI, Tahoma, sans-serif; background:#f6f7fb; padding:40px; color:#1f2937;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:28px; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <h1 style="margin:0 0 12px; font-size:20px; color:#0f172a;">${escapeHtml(opts.title)}</h1>
      <p style="margin:0 0 16px; line-height:1.7;">${opts.message}</p>
      ${formHtml}
      ${linkHtml}
    </div>
  </body>
</html>`);
}

// Safe GET: only displays a confirmation page. No state changes occur here,
// so email link prefetchers / scanners cannot trigger account lockout.
router.get("/auth/devices/revoke", async (req, res) => {
  const baseUrl = getAppBaseUrl();
  try {
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (!token) {
      renderRevokePage(res, 400, { title: "رابط غير صالح", message: "الرابط مفقود أو غير صالح." });
      return;
    }
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [device] = await db
      .select()
      .from(trustedDevicesTable)
      .where(
        and(
          eq(trustedDevicesTable.revokeTokenHash, tokenHash),
          gt(trustedDevicesTable.revokeTokenExpiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!device) {
      renderRevokePage(res, 400, {
        title: "الرابط منتهي أو مستخدم",
        message:
          "الرابط غير صالح أو تم استخدامه مسبقاً. إذا كنت قلقاً على حسابك يرجى تسجيل الدخول وتغيير كلمة المرور فوراً.",
        link: { href: `${baseUrl}/forgot-password`, label: "إعادة تعيين كلمة المرور" },
      });
      return;
    }
    renderRevokePage(res, 200, {
      title: "تأكيد تأمين الحساب",
      message:
        "اضغط الزر أدناه لتأكيد أن تسجيل الدخول لم يكن منك. سيتم تسجيل الخروج من جميع الجلسات النشطة، وإرسال رابط جديد لإعادة تعيين كلمة المرور إلى بريدك.",
      form: { actionUrl: `${baseUrl}/api/auth/devices/revoke`, token },
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Device revoke confirmation render error");
    renderRevokePage(res, 500, {
      title: "حدث خطأ",
      message: "تعذر عرض الصفحة. يرجى محاولة تسجيل الدخول وتغيير كلمة المرور يدوياً.",
      link: { href: `${baseUrl}/forgot-password`, label: "إعادة تعيين كلمة المرور" },
    });
  }
});

// Destructive action gated behind explicit POST. Token is consumed atomically.
router.post("/auth/devices/revoke", authLimiter, async (req, res) => {
  const baseUrl = getAppBaseUrl();
  try {
    const rawToken =
      typeof req.body?.token === "string"
        ? req.body.token.trim()
        : typeof req.query.token === "string"
        ? req.query.token.trim()
        : "";
    const parsed = RevokeDeviceSchema.safeParse({ token: rawToken || undefined });
    const token = parsed.success ? parsed.data.token ?? "" : "";
    if (!token) {
      renderRevokePage(res, 400, { title: "رابط غير صالح", message: "الرابط مفقود أو غير صالح." });
      return;
    }
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Atomically claim and invalidate the token by deleting the device row only
    // when the token still matches and hasn't expired. Concurrent requests will
    // see no rows on the second attempt.
    const claimed = await db
      .delete(trustedDevicesTable)
      .where(
        and(
          eq(trustedDevicesTable.revokeTokenHash, tokenHash),
          gt(trustedDevicesTable.revokeTokenExpiresAt, new Date()),
        ),
      )
      .returning({ id: trustedDevicesTable.id, teacherId: trustedDevicesTable.teacherId });

    if (claimed.length === 0) {
      renderRevokePage(res, 400, {
        title: "الرابط منتهي أو مستخدم",
        message:
          "الرابط غير صالح أو تم استخدامه مسبقاً. إذا كنت قلقاً على حسابك يرجى تسجيل الدخول وتغيير كلمة المرور فوراً.",
        link: { href: `${baseUrl}/forgot-password`, label: "إعادة تعيين كلمة المرور" },
      });
      return;
    }

    const teacherId = claimed[0].teacherId;

    // Revoke ALL active sessions for this teacher.
    await revokeTeacherSessions(teacherId, null, req.log);

    // Auto-issue a password reset token and email it so the teacher can lock down quickly.
    const [teacher] = await db
      .select()
      .from(teachersTable)
      .where(eq(teachersTable.id, teacherId))
      .limit(1);

    let resetEmailSent = false;
    if (teacher?.email) {
      const rawToken = crypto.randomBytes(32).toString("base64url");
      const resetTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await db.insert(passwordResetTokensTable).values({
        teacherId: teacher.id,
        tokenHash: resetTokenHash,
        expiresAt,
      });
      const link = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
      const { html, text } = buildResetEmail(teacher.name, link);
      const result = await sendEmail({
        to: teacher.email,
        subject: "تأمين الحساب: إعادة تعيين كلمة المرور - منصة حصاد",
        html,
        text,
      });
      if (!result.delivered) {
        await db
          .update(passwordResetTokensTable)
          .set({ usedAt: new Date() })
          .where(eq(passwordResetTokensTable.tokenHash, resetTokenHash));
        req.log.warn({ teacherId, reason: result.reason }, "Security reset email not delivered");
      } else {
        resetEmailSent = true;
      }
    }

    req.log.info({ teacherId, deviceId: claimed[0].id, resetEmailSent }, "Suspicious device revoked by user");

    const successMessage = resetEmailSent
      ? "تم تسجيل الخروج من جميع الجلسات، وأرسلنا لك رابطاً جديداً لإعادة تعيين كلمة المرور إلى بريدك. أو اضغط الزر التالي للذهاب لصفحة استعادة كلمة المرور."
      : "تم تسجيل الخروج من جميع الجلسات. بما أنه لا يوجد بريد إلكتروني مسجل أو تعذر إرسال البريد، يرجى الذهاب لصفحة استعادة كلمة المرور لإعادة التعيين يدوياً.";

    renderRevokePage(res, 200, {
      title: "تم تأمين حسابك",
      message: successMessage,
      link: { href: `${baseUrl}/forgot-password`, label: "صفحة استعادة كلمة المرور" },
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Device revoke action error");
    renderRevokePage(res, 500, {
      title: "حدث خطأ",
      message: "تعذر إتمام العملية. يرجى محاولة تسجيل الدخول وتغيير كلمة المرور يدوياً.",
      link: { href: `${baseUrl}/forgot-password`, label: "إعادة تعيين كلمة المرور" },
    });
  }
});

router.get("/auth/sessions", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return;
  }
  try {
    const teacherId = req.session.teacherId;
    const currentSid = req.sessionID;
    const { rows } = await pool.query(
      `SELECT sid, sess, expire FROM "session"
         WHERE (sess->>'teacherId')::int = $1
           AND expire > NOW()
         ORDER BY COALESCE(sess->>'lastSeenAt', sess->>'createdAt', '') DESC`,
      [teacherId],
    );
    const ips = rows.map((row: any) => (row.sess && row.sess.ip) || null);
    const locations = await lookupIpLocations(ips);
    const sessions = rows.map((row: any) => {
      const sess = row.sess || {};
      const parsed = parseUserAgent(sess.userAgent);
      const ip: string | null = sess.ip ?? null;
      const normalizedIp = ip ? ip.replace(/%.*$/, "").replace(/^::ffff:/i, "").trim() : null;
      const location = normalizedIp ? locations.get(normalizedIp) ?? null : null;
      return {
        sid: row.sid,
        userAgent: sess.userAgent ?? null,
        ip,
        createdAt: sess.createdAt ?? null,
        lastSeenAt: sess.lastSeenAt ?? null,
        expiresAt: row.expire instanceof Date ? row.expire.toISOString() : row.expire ?? null,
        isCurrent: row.sid === currentSid,
        browser: parsed.browser,
        os: parsed.os,
        deviceType: parsed.deviceType,
        deviceModel: parsed.deviceModel,
        location,
      };
    });
    res.json(sessions);
  } catch (error: any) {
    req.log.error({ err: error }, "List sessions error");
    res.status(500).json({ message: "خطأ في تحميل الجلسات" });
  }
});

router.delete("/auth/sessions", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return;
  }
  try {
    const teacherId = req.session.teacherId;
    const currentSid = req.sessionID;
    const result = await pool.query(
      `DELETE FROM "session" WHERE (sess->>'teacherId')::int = $1 AND sid <> $2`,
      [teacherId, currentSid],
    );
    res.json({
      message: "تم تسجيل الخروج من الأجهزة الأخرى",
      revoked: result.rowCount ?? 0,
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Revoke other sessions error");
    res.status(500).json({ message: "خطأ في إنهاء الجلسات" });
  }
});

router.delete("/auth/sessions/:sid", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return;
  }
  const targetSid = req.params.sid;
  if (!targetSid) {
    res.status(400).json({ message: "معرف الجلسة مفقود" });
    return;
  }
  try {
    const teacherId = req.session.teacherId;
    const currentSid = req.sessionID;
    const wasCurrent = targetSid === currentSid;
    const result = await pool.query(
      `DELETE FROM "session" WHERE sid = $1 AND (sess->>'teacherId')::int = $2`,
      [targetSid, teacherId],
    );
    if ((result.rowCount ?? 0) === 0) {
      res.status(404).json({ message: "الجلسة غير موجودة" });
      return;
    }
    if (wasCurrent) {
      // Avoid resaving the destroyed session.
      req.session.destroy(() => {
        res.json({ message: "تم تسجيل الخروج من هذا الجهاز", wasCurrent: true });
      });
      return;
    }
    res.json({ message: "تم إنهاء الجلسة", wasCurrent: false });
  } catch (error: any) {
    req.log.error({ err: error }, "Revoke session error");
    res.status(500).json({ message: "خطأ في إنهاء الجلسة" });
  }
});

const BriefPreferencesSchema = z
  .object({
    language: z.enum(["ar", "en"]).optional(),
    presentationKind: z.enum(["explain", "review", "interactive", "quick", "contest"]).optional(),
    slideCount: z.number().int().min(5).max(30).optional(),
    durationMinutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]).optional(),
    languageLevel: z.enum(["simple", "medium", "advanced"]).optional(),
    density: z.enum(["minimal", "balanced", "detailed"]).optional(),
    activities: z.boolean().optional(),
    questions: z.boolean().optional(),
    poll: z.boolean().optional(),
    quiz: z.boolean().optional(),
    notes: z.string().max(200).optional(),
  })
  .strict();

router.get("/auth/preferences", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return;
  }
  try {
    const [teacher] = await db
      .select({ preferences: teachersTable.preferences })
      .from(teachersTable)
      .where(eq(teachersTable.id, req.session.teacherId))
      .limit(1);
    res.json(teacher?.preferences ?? {});
  } catch (error: any) {
    req.log.error({ err: error }, "Get brief preferences error");
    res.status(500).json({ message: "خطأ في تحميل الإعدادات" });
  }
});

router.put("/auth/preferences", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return;
  }
  const parsed = BriefPreferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة", errors: parsed.error.issues });
    return;
  }
  try {
    await db
      .update(teachersTable)
      .set({ preferences: parsed.data as Record<string, unknown> })
      .where(eq(teachersTable.id, req.session.teacherId));
    res.json(parsed.data);
  } catch (error: any) {
    req.log.error({ err: error }, "Update brief preferences error");
    res.status(500).json({ message: "خطأ في حفظ الإعدادات" });
  }
});

router.post("/auth/logout", (req, res) => {
  const sess: any = req.session;
  const teacherId = sess?.teacherId ?? null;
  if (teacherId) {
    logActivity({ req, userId: teacherId, userRole: "teacher", action: "logout" });
  }
  req.session.destroy(() => {
    res.json({ message: "تم تسجيل الخروج بنجاح" });
  });
});

router.post("/auth/google", authLimiter, async (req, res) => {
  try {
    const { credential } = req.body ?? {};
    if (!credential || typeof credential !== "string") {
      res.status(400).json({ message: "بيانات Google ناقصة" });
      return;
    }

    const { verifyGoogleIdToken } = await import("../lib/google-verify");
    let profile;
    try {
      profile = await verifyGoogleIdToken(credential);
    } catch (err) {
      req.log.warn({ err }, "Google ID token verification failed (teacher)");
      res.status(401).json({ message: "تعذّر التحقق من حساب Google" });
      return;
    }

    if (!profile.email || !profile.emailVerified) {
      res.status(400).json({ message: "بريد Google غير مُفعَّل" });
      return;
    }

    const email = profile.email.toLowerCase();
    const displayName = profile.name?.trim() || email.split("@")[0];

    let teacher: typeof teachersTable.$inferSelect | undefined;

    const byGoogle = await db
      .select()
      .from(teachersTable)
      .where(eq(teachersTable.googleId, profile.sub))
      .limit(1);
    teacher = byGoogle[0];

    if (!teacher) {
      const byEmail = await db
        .select()
        .from(teachersTable)
        .where(eq(teachersTable.email, email))
        .limit(1);
      const existingByEmail = byEmail[0];

      if (existingByEmail) {
        const [linked] = await db
          .update(teachersTable)
          .set({ googleId: profile.sub })
          .where(eq(teachersTable.id, existingByEmail.id))
          .returning();
        teacher = linked;
      } else {
        const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
        const [created] = await db
          .insert(teachersTable)
          .values({
            name: displayName,
            email,
            phone: null,
            passwordHash: randomHash,
            googleId: profile.sub,
          })
          .returning();
        teacher = created;
      }
    }

    if (!teacher) {
      res.status(500).json({ message: "تعذّر إنشاء الحساب" });
      return;
    }

    if (teacher.isBlocked) {
      res.status(403).json({ message: "تم حظر حسابك. تواصل مع المسؤول" });
      return;
    }

    delete req.session.studentAccountId;
    req.session.teacherId = teacher.id;
    stampTeacherSession(req);

    await db
      .update(teachersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(teachersTable.id, teacher.id));

    void logIslamicEvent({
      userId: teacher.id,
      eventType: "login",
      metadata: { method: "google" },
    });

    void trackLoginDevice(req, teacher, req.log);

    res.json({
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone,
        isAdmin: teacher.isAdmin,
        role: teacher.role,
      },
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Google login error (teacher)");
    res.status(500).json({ message: "خطأ في تسجيل الدخول عبر Google" });
  }
});

export default router;
