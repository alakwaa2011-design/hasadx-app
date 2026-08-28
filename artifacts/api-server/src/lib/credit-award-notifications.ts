import { db, notificationsTable, teachersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { sendEmail, getAppBaseUrl } from "./email";
import { esc, safeUrl } from "./html-escape";
import { logger } from "./logger";

export type CreditAward =
  | {
      kind: "credits";
      amount: number;
      newBalance: number;
      reason: string;
    }
  | {
      kind: "plan";
      planNameAr: string;
      credits: number;
      expiresAt?: Date;
    }
  | {
      kind: "unlimited";
      reason: string;
    };

interface AwardMessage {
  type: "credit_award" | "plan_award" | "unlimited_award";
  title: string;
  body: string;
  subject: string;
}

function formatNumber(value: number): string {
  return value.toLocaleString("ar-KW");
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("ar-KW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function buildCreditAwardMessage(award: CreditAward): AwardMessage {
  if (award.kind === "credits") {
    const amount = formatNumber(award.amount);
    const balance = formatNumber(award.newBalance);
    return {
      type: "credit_award",
      title: "🎁 هدية جديدة في حسابك",
      body: `تهانينا! أُضيفت لك ${amount} نقطة حصاد. رصيدك الآن ${balance} نقطة. السبب: ${award.reason}`,
      subject: `🎁 أضفنا لك ${amount} نقطة حصاد`,
    };
  }

  if (award.kind === "plan") {
    const creditsText =
      award.credits > 0
        ? ` ومعها ${formatNumber(award.credits)} نقطة حصاد`
        : "";
    const expiryText = award.expiresAt
      ? ` الباقة متاحة حتى ${formatDate(award.expiresAt)}.`
      : "";
    return {
      type: "plan_award",
      title: `🎉 حصلت على باقة ${award.planNameAr}`,
      body: `خبر جميل! مُنح حسابك باقة ${award.planNameAr}${creditsText}.${expiryText}`,
      subject: `🎉 باقة ${award.planNameAr} هدية لك من حصاد`,
    };
  }

  return {
    type: "unlimited_award",
    title: "🌟 حسابك أصبح غير محدود",
    body: `خبر رائع! تم تفعيل الاستخدام غير المحدود لحسابك في منصة حصاد. السبب: ${award.reason}`,
    subject: "🌟 تم تفعيل الاستخدام غير المحدود لحسابك",
  };
}

function buildAwardEmail(
  teacherName: string,
  message: AwardMessage,
): { html: string; text: string } {
  const platformUrl = getAppBaseUrl();
  const safePlatformUrl = safeUrl(platformUrl);
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f5f3ef;font-family:Tahoma,Arial,sans-serif;color:#193326">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f3ef;padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e5dfd4;box-shadow:0 8px 28px rgba(34,87,57,.1)">
          <tr><td style="background:#225739;padding:24px 30px;text-align:center;border-bottom:4px solid #c9a050">
            <div style="font-size:28px;margin-bottom:5px">🎉 ✨ 🎁</div>
            <div style="color:#fff;font-size:21px;font-weight:800">منصة حصاد التعليمية</div>
          </td></tr>
          <tr><td style="padding:34px 30px;text-align:right">
            <p style="margin:0 0 8px;color:#647066;font-size:14px">مرحبًا ${esc(teacherName)}،</p>
            <h1 style="margin:0 0 18px;color:#225739;font-size:24px;line-height:1.5">${esc(message.title)}</h1>
            <div style="background:#f4f8f5;border:1px solid #d8e5dc;border-right:5px solid #c9a050;border-radius:14px;padding:18px 20px;font-size:16px;line-height:1.9">
              ${esc(message.body)}
            </div>
            <p style="margin:26px 0 0;text-align:center">
              <a href="${safePlatformUrl}" style="display:inline-block;background:#225739;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700">افتح منصة حصاد</a>
            </p>
          </td></tr>
          <tr><td style="padding:18px 24px;background:#f5f3ef;text-align:center;color:#7b827d;font-size:12px">
            هذه رسالة تلقائية لإبلاغك بهدية أو ميزة أضيفت إلى حسابك.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = `مرحبًا ${teacherName}،

${message.title}

${message.body}

افتح منصة حصاد: ${platformUrl}`;
  return { html, text };
}

async function deliverAwardEmail(
  teacher: { id: number; name: string; email: string | null },
  message: AwardMessage,
): Promise<boolean> {
  if (!teacher.email) return false;

  try {
    const content = buildAwardEmail(teacher.name, message);
    const result = await sendEmail({
      to: teacher.email,
      subject: message.subject,
      html: content.html,
      text: content.text,
    });
    if (!result.delivered) {
      logger.warn(
        { teacherId: teacher.id, awardType: message.type, reason: result.reason },
        "credit award email was not delivered",
      );
    }
    return result.delivered;
  } catch (err) {
    logger.warn(
      { err, teacherId: teacher.id, awardType: message.type },
      "credit award email failed",
    );
    return false;
  }
}

export async function notifyTeacherOfAward(
  teacherId: number,
  award: CreditAward,
): Promise<{ inApp: boolean; email: boolean }> {
  const [teacher] = await db
    .select({
      id: teachersTable.id,
      name: teachersTable.name,
      email: teachersTable.email,
    })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);

  if (!teacher) {
    logger.warn({ teacherId, awardType: award.kind }, "credit award recipient not found");
    return { inApp: false, email: false };
  }

  const message = buildCreditAwardMessage(award);
  let inApp = false;
  try {
    await db.insert(notificationsTable).values({
      teacherId,
      type: message.type,
      title: message.title,
      body: message.body,
    });
    inApp = true;
  } catch (err) {
    logger.warn(
      { err, teacherId, awardType: message.type },
      "credit award in-app notification failed",
    );
  }

  const email = await deliverAwardEmail(teacher, message);
  return { inApp, email };
}

export async function notifyTeachersOfCreditAward(
  grants: Array<{ teacherId: number; amount: number; newBalance: number }>,
  reason: string,
): Promise<void> {
  const positive = grants.filter((grant) => grant.amount > 0);
  if (positive.length === 0) return;

  const teachers = await db
    .select({
      id: teachersTable.id,
      name: teachersTable.name,
      email: teachersTable.email,
    })
    .from(teachersTable)
    .where(inArray(teachersTable.id, positive.map((grant) => grant.teacherId)));
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));

  const entries = positive.flatMap((grant) => {
    const teacher = teacherById.get(grant.teacherId);
    if (!teacher) return [];
    const message = buildCreditAwardMessage({
      kind: "credits",
      amount: grant.amount,
      newBalance: grant.newBalance,
      reason,
    });
    return [{ teacher, message }];
  });

  if (entries.length > 0) {
    try {
      await db.insert(notificationsTable).values(
        entries.map(({ teacher, message }) => ({
          teacherId: teacher.id,
          type: message.type,
          title: message.title,
          body: message.body,
        })),
      );
    } catch (err) {
      logger.warn({ err, recipients: entries.length }, "bulk credit award notifications failed");
    }
  }

  const concurrency = 5;
  for (let index = 0; index < entries.length; index += concurrency) {
    await Promise.all(
      entries
        .slice(index, index + concurrency)
        .map(({ teacher, message }) => deliverAwardEmail(teacher, message)),
    );
  }
}