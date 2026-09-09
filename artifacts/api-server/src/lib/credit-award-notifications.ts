import { db, notificationsTable, teachersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { sendEmail, getAppBaseUrl } from "./email";
import { emailHighlight, renderHasaadEmail } from "./email-design";
import { esc } from "./html-escape";
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
  return value.toLocaleString("ar-KW-u-nu-latn");
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("ar-KW-u-nu-latn", {
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
      title: "هدية نقاط جديدة",
      body: `أُضيفت ${amount} نقطة إلى حسابك، وأصبح رصيدك ${balance} نقطة. السبب: ${award.reason}`,
      subject: "تم تحديث رصيد نقاطك",
    };
  }

  if (award.kind === "plan") {
    const creditsText =
      award.credits > 0
        ? ` ومعها ${formatNumber(award.credits)} نقطة`
        : "";
    const expiryText = award.expiresAt
      ? ` الباقة متاحة حتى ${formatDate(award.expiresAt)}.`
      : "";
    return {
      type: "plan_award",
      title: `باقة ${award.planNameAr} هدية لك`,
      body: `أُضيفت الباقة إلى حسابك${creditsText}.${expiryText}`,
      subject: "تمت إضافة باقة إلى حسابك",
    };
  }

  return {
    type: "unlimited_award",
    title: "حسابك أصبح غير محدود",
    body: `تم تفعيل الاستخدام غير المحدود. السبب: ${award.reason}`,
    subject: "ميزة جديدة في حسابك",
  };
}

function buildAwardEmail(
  teacherName: string,
  message: AwardMessage,
): { html: string; text: string } {
  const platformUrl = getAppBaseUrl();
  const html = renderHasaadEmail({
    title: message.title,
    preheader: message.subject,
    tone: "reward",
    recipientName: teacherName,
    bodyHtml: emailHighlight(esc(message.body), "reward"),
    cta: { label: "عرض حسابي", url: platformUrl },
    footer: "هذه رسالة خدمية لإبلاغك بميزة أضيفت إلى حسابك.",
  });
  const text = `مرحبًا ${teacherName}،

${message.title}

${message.body}

عرض حسابي: ${platformUrl}`;
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