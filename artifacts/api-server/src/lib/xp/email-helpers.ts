/**
 * Pure HTML-fragment builders for XP-event notification emails.
 * Isolated here so they can be unit-tested without touching the DB layer.
 */

import { esc } from "../html-escape";

/** Returns the htmlBody fragment for a badge-awarded email. */
export function buildBadgeEmailHtml(teacherName: string, badgeName: string): string {
  return `<div dir="rtl"><p>مرحباً ${esc(teacherName)}،</p><p>تهانينا! حصلت على شارة <strong>${esc(badgeName)}</strong> على منصة حصاد.</p></div>`;
}

/** Returns the htmlBody fragment for a threshold-reward email. */
export function buildThresholdEmailHtml(teacherName: string, label: string): string {
  return `<div dir="rtl"><p>مرحباً ${esc(teacherName)}،</p><p>تهانينا! بلغت أحد العتبات في حصاد وفُتحت لك جائزة: <strong>${esc(label)}</strong>.</p></div>`;
}

/** Returns the htmlBody fragment for a level-up email. */
export function buildLevelUpEmailHtml(
  teacherName: string,
  newLevel: number,
  levelNameAr: string,
): string {
  return `<div dir="rtl"><p>مرحباً ${esc(teacherName)}،</p><p>تهانينا! لقد ترقّيت إلى المستوى <strong>${newLevel} — ${esc(levelNameAr)}</strong> في منصة حصاد.</p><p>افتح منصة حصاد لاكتشاف المزايا الجديدة.</p></div>`;
}

/** Returns the htmlBody fragment for a quest-complete email. */
export function buildQuestCompleteEmailHtml(
  teacherName: string,
  questNameAr: string,
  rewardXp: number,
): string {
  return `<div dir="rtl"><p>مرحباً ${esc(teacherName)}،</p><p>أكملت المهمة <strong>${esc(questNameAr)}</strong> وحصلت على <strong>${rewardXp} نقطة</strong> مكافأة.</p></div>`;
}
