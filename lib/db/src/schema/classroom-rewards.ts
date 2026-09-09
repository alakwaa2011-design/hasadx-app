import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { teachersTable } from "./teachers";
import { studentsTable } from "./students";
import { teacherClassesTable } from "./teacher-classes";

/** A teacher-owned positive behaviour type. This domain is intentionally separate from XP, games, and credits. */
export const classroomRewardTypesTable = pgTable("classroom_reward_types", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("general"),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  defaultAmount: integer("default_amount").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  teacherNameUnique: uniqueIndex("classroom_reward_types_teacher_name_uq").on(t.teacherId, t.name),
  teacherIndex: index("classroom_reward_types_teacher_idx").on(t.teacherId),
}));

/** Per student and per type balance; it is not connected to any existing scoring system. */
export const classroomRewardBalancesTable = pgTable("classroom_reward_balances", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  rewardTypeId: integer("reward_type_id").notNull().references(() => classroomRewardTypesTable.id, { onDelete: "restrict" }),
  balance: integer("balance").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueBalance: uniqueIndex("classroom_reward_balances_owner_student_type_uq").on(t.teacherId, t.studentId, t.rewardTypeId),
  studentIndex: index("classroom_reward_balances_student_idx").on(t.teacherId, t.studentId),
}));

/** Teacher-defined organizational groups inside one rewards class. */
export const classroomRewardGroupsTable = pgTable("classroom_reward_groups", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  teacherClassId: integer("teacher_class_id").notNull().references(() => teacherClassesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull(),
  avatar: text("avatar"),
  score: integer("score").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  classNameUnique: uniqueIndex("classroom_reward_groups_class_name_uq").on(t.teacherId, t.teacherClassId, t.name),
  classIndex: index("classroom_reward_groups_class_idx").on(t.teacherId, t.teacherClassId),
}));

/** Idempotent, immutable receipts for independent group competition scoring. */
export const classroomRewardGroupScoreReceiptsTable = pgTable("classroom_reward_group_score_receipts", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  groupId: integer("group_id").notNull().references(() => classroomRewardGroupsTable.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  operation: text("operation").notNull(),
  points: integer("points").notNull(),
  score: integer("score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ownerRequestUnique: uniqueIndex("classroom_reward_group_score_receipts_owner_request_uq").on(t.teacherId, t.idempotencyKey),
  groupIndex: index("classroom_reward_group_score_receipts_group_idx").on(t.teacherId, t.groupId),
}));

export const classroomRewardGroupMembersTable = pgTable("classroom_reward_group_members", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  groupId: integer("group_id").notNull().references(() => classroomRewardGroupsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  groupStudentUnique: uniqueIndex("classroom_reward_group_members_group_student_uq").on(t.groupId, t.studentId),
  teacherStudentIndex: index("classroom_reward_group_members_teacher_student_idx").on(t.teacherId, t.studentId),
}));

export const classroomRewardBatchesTable = pgTable("classroom_reward_batches", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  classNameSnapshot: text("class_name_snapshot").notNull(),
  teacherClassId: integer("teacher_class_id").references(() => teacherClassesTable.id, { onDelete: "set null" }),
  rewardTypeId: integer("reward_type_id").references(() => classroomRewardTypesTable.id, { onDelete: "restrict" }),
  reasonSnapshot: text("reason_snapshot").notNull(),
  points: integer("points").notNull(),
  targetCount: integer("target_count").notNull(),
  requestFingerprint: text("request_fingerprint").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ ownerRequestUnique: uniqueIndex("classroom_reward_batches_owner_request_uq").on(t.teacherId, t.idempotencyKey), classIndex: index("classroom_reward_batches_class_idx").on(t.teacherId, t.teacherClassId) }));

/** Immutable ledger. Reversals are new opposing entries, never deletes. */
export const classroomRewardTransactionsTable = pgTable("classroom_reward_transactions", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").references(() => studentsTable.id, { onDelete: "set null" }),
  studentNameSnapshot: text("student_name_snapshot").notNull(),
  rewardTypeId: integer("reward_type_id").notNull().references(() => classroomRewardTypesTable.id, { onDelete: "restrict" }),
  amount: integer("amount").notNull(),
  kind: text("kind").notNull().default("grant"),
  idempotencyKey: text("idempotency_key").notNull(),
  batchId: integer("batch_id").references(() => classroomRewardBatchesTable.id, { onDelete: "restrict" }),
  batchKey: text("batch_key"),
  reversalOfId: integer("reversal_of_id").unique().references((): AnyPgColumn => classroomRewardTransactionsTable.id, { onDelete: "restrict" }),
  note: text("note"),
  classNameSnapshot: text("class_name_snapshot"),
  teacherClassId: integer("teacher_class_id").references(() => teacherClassesTable.id, { onDelete: "set null" }),
  rewardTypeNameSnapshot: text("reward_type_name_snapshot").notNull(),
  categorySnapshot: text("category_snapshot").notNull(),
  sourceType: text("source_type"),
  sourceResultId: integer("source_result_id"),
  ruleId: integer("rule_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  requestStudentUnique: uniqueIndex("classroom_reward_transactions_owner_request_student_uq").on(t.teacherId, t.idempotencyKey, t.studentId),
  studentCreatedIndex: index("classroom_reward_transactions_student_created_idx").on(t.teacherId, t.studentId, t.createdAt),
  categoryCreatedIndex: index("classroom_reward_transactions_category_created_idx").on(t.teacherId, t.categorySnapshot, t.createdAt),
  classCreatedIndex: index("classroom_reward_transactions_class_created_idx").on(t.teacherId, t.teacherClassId, t.createdAt),
  reversalRequestUnique: uniqueIndex("classroom_reward_transactions_reversal_request_uq").on(t.teacherId, t.idempotencyKey).where(sql`kind = 'reversal'`),
}));

export const classroomRewardGoalsTable = pgTable("classroom_reward_goals", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  teacherClassId: integer("teacher_class_id").notNull().references(() => teacherClassesTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").references(() => studentsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  targetPoints: integer("target_points").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ownerClassIndex: index("classroom_reward_goals_owner_class_idx").on(t.teacherId, t.teacherClassId),
  ownerStatusIndex: index("classroom_reward_goals_owner_status_idx").on(t.teacherId, t.status),
}));

export const classroomRewardBatchReversalsTable = pgTable("classroom_reward_batch_reversals", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").notNull().references(() => classroomRewardBatchesTable.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ownerKeyUnique: uniqueIndex("classroom_reward_batch_reversals_owner_key_uq").on(t.teacherId, t.idempotencyKey),
  ownerBatchUnique: uniqueIndex("classroom_reward_batch_reversals_owner_batch_uq").on(t.teacherId, t.batchId),
}));

/** Teacher-configured automatic grants. Evidence is evaluated server-side only. */
export const classroomRewardRulesTable = pgTable("classroom_reward_rules", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  condition: text("condition").notNull(),
  threshold: integer("threshold"),
  rewardTypeId: integer("reward_type_id").notNull().references(() => classroomRewardTypesTable.id, { onDelete: "restrict" }),
  amount: integer("amount").notNull(),
  categorySnapshot: text("category_snapshot").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ teacherSourceIndex: index("classroom_reward_rules_teacher_source_idx").on(t.teacherId, t.sourceType) }));

/** Durable processing receipt: one decision for each rule, evidence result, and explicit student. */
export const classroomRewardRuleEvaluationsTable = pgTable("classroom_reward_rule_evaluations", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  ruleId: integer("rule_id").notNull().references(() => classroomRewardRulesTable.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceResultId: integer("source_result_id").notNull(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  outcome: text("outcome").notNull(),
  detail: text("detail"),
  evidenceSummary: jsonb("evidence_summary"),
  ruleNameSnapshot: text("rule_name_snapshot").notNull(),
  transactionId: integer("transaction_id").references(() => classroomRewardTransactionsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ once: uniqueIndex("classroom_reward_rule_evaluations_once_uq").on(t.ruleId, t.sourceType, t.sourceResultId, t.studentId) }));

export const classroomRewardAuditLogsTable = pgTable("classroom_reward_audit_logs", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  idempotencyKey: text("idempotency_key"),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ teacherCreatedIndex: index("classroom_reward_audit_owner_created_idx").on(t.teacherId, t.createdAt) }));
