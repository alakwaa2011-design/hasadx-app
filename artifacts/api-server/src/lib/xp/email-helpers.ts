/**
 * Pure HTML builders for XP-event notification emails.
 * Isolated here so they can be unit-tested without touching the DB layer.
 */

import { emailHighlight, renderHasaadEmail } from "../email-design";
import { esc } from "../html-escape";

function renderRewardEmail(
  teacherName: string,
  title: string,
  bodyHtml: string,
): string {
  return renderHasaadEmail({
    title,
    tone: "reward",
    recipientName: teacherName,
    bodyHtml: emailHighlight(bodyHtml, "reward"),
    footer: "هذه رسالة خدمية مرتبطة بتقدمك ومكافآتك.",
  });
}

/** Returns the htmlBody for a badge-awarded email. */
export function buildBadgeEmailHtml(teacherName: string, badgeName: string): string {
  return renderRewardEmail(
    teacherName,
    "شارة جديدة",
    `<p style="margin:0">حصلت على شارة <strong>${esc(badgeName)}</strong>.</p>`,
  );
}

/** Returns the htmlBody for a threshold-reward email. */
export function buildThresholdEmailHtml(teacherName: string, label: string): string {
  return renderRewardEmail(
    teacherName,
    "جائزة جديدة",
    `<p style="margin:0">فُتحت لك جائزة <strong>${esc(label)}</strong>.</p>`,
  );
}

/** Returns the htmlBody for a level-up email. */
export function buildLevelUpEmailHtml(
  teacherName: string,
  newLevel: number,
  levelNameAr: string,
): string {
  return renderRewardEmail(
    teacherName,
    "مستوى جديد",
    `<p style="margin:0">ترقّيت إلى المستوى <strong>${newLevel} — ${esc(levelNameAr)}</strong>.</p>`,
  );
}

/** Returns the htmlBody for a quest-complete email. */
export function buildQuestCompleteEmailHtml(
  teacherName: string,
  questNameAr: string,
  rewardXp: number,
): string {
  return renderRewardEmail(
    teacherName,
    "اكتملت المهمة",
    `<p style="margin:0">أكملت <strong>${esc(questNameAr)}</strong> وأُضيفت <strong>${rewardXp} نقطة</strong> إلى تقدمك.</p>`,
  );
}
