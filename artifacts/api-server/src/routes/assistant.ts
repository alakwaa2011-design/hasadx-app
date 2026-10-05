import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, assistantOperationsTable as operations, assistantConfigurationTable as configuration, teachersTable, creditHoldsTable } from "@workspace/db";
import { PrepareAssistantWorksheetBody, ConfirmAssistantWorksheetBody, UpdateAssistantAvailabilityBody, worksheetThemeIdSchema } from "@workspace/api-zod";
import { estimateCreditsForToolRequest, holdCreditsForToolRequest, InsufficientCreditsError } from "../lib/check-credits";
import { CreditService } from "../lib/credit-service";
import { canonicalJson, editableStatuses, activeStatuses, missingWorksheetFields, prepareWorksheetRequest, publicAssistantOperation, validateWorksheetRequest } from "../lib/assistant-worksheet";
import { getAssistantExecutionAccess, authorizeAssistantExecution, executionAccessError, recordAssistantEvent, releaseAssistantTrial, getAssistantExecutionMetrics } from "../lib/assistant-execution-access";

const router = Router();
router.use((req, res, next) => {
  if (!req.session?.teacherId) { res.status(401).json({ code: "UNAUTHORIZED" }); return; }
  next();
});
const prepareLimit = rateLimit({ windowMs: 15 * 60_000, limit: 15, standardHeaders: "draft-7", legacyHeaders: false, keyGenerator: req => `teacher:${req.session.teacherId}`, message: { code: "RATE_LIMITED" } });
const mutationLimit = rateLimit({ windowMs: 60_000, limit: 40, standardHeaders: "draft-7", legacyHeaders: false, keyGenerator: req => `teacher:${req.session.teacherId}`, message: { code: "RATE_LIMITED" } });
async function isEnabled(teacherId?: number) {
  const [row] = await db.select().from(configuration).where(eq(configuration.id, 1));
  if (!row?.enabled) return false;
  if (!row.pilotOnly || teacherId === undefined) return true;
  if (row.teacherIds.includes(teacherId)) return true;
  const [teacher] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, teacherId));
  return teacher?.isAdmin ?? false;
}
async function requireAdmin(req: any, res: any, next: any) {
  const [teacher] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, req.session.teacherId));
  if (!teacher?.isAdmin) { res.status(403).json({ code: "FORBIDDEN" }); return; }
  next();
}
function operationId(value: unknown) { return z.string().uuid().parse(value); }
function apiError(res: any, error: any) {
  if (error instanceof InsufficientCreditsError) {
    res.status(402).json({ code: "INSUFFICIENT_CREDITS", required: error.required, balance: error.balance, message: error.message }); return;
  }
  res.status(error.status ?? (error.issues ? 400 : 503)).json({ code: error.code ?? (error.issues ? "INVALID_INPUT" : "UNAVAILABLE") });
}
function failure(code: string, status = 409) { return Object.assign(new Error(code), { code, status }); }
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function ownedOperation(tx: Tx, id: string, teacherId: number) {
  const [row] = await tx.select().from(operations).where(and(eq(operations.id, id), eq(operations.teacherId, teacherId), eq(operations.archived, false))).limit(1).for("update");
  if (!row) throw failure("NOT_FOUND", 404);
  return row;
}

router.get("/operations", async (req, res) => {
  const rows = await db.select().from(operations).where(and(eq(operations.teacherId, req.session.teacherId!), eq(operations.archived, false))).orderBy(desc(operations.updatedAt)).limit(100);
  res.json({ enabled: await isEnabled(req.session.teacherId!), executionAccess: await getAssistantExecutionAccess(req.session.teacherId!), operations: rows.map(row => publicAssistantOperation(row)) });
});
router.get("/admin/execution-metrics", requireAdmin, async (_req, res) => {
  res.json(await getAssistantExecutionMetrics());
});
router.post("/execution-events", mutationLimit, async (req, res) => {
  const parsed = z.object({ event: z.enum(["upgrade_viewed", "upgrade_clicked"]), operationId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ code: "INVALID_INPUT" }); return; }
  const [operation] = await db.select({ id: operations.id }).from(operations).where(and(eq(operations.id, parsed.data.operationId), eq(operations.teacherId, req.session.teacherId!)));
  if (!operation) { res.status(404).json({ code: "NOT_FOUND" }); return; }
  await recordAssistantEvent(req.session.teacherId!, parsed.data.event, operation.id, {}, `${parsed.data.event}:${operation.id}`);
  res.json({ ok: true });
});
router.get("/admin/operations", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(operations).orderBy(desc(operations.updatedAt)).limit(100);
  const [config] = await db.select().from(configuration).where(eq(configuration.id, 1));
  res.json({ enabled: config?.enabled ?? false, pilotOnly: config?.pilotOnly ?? true, teacherIds: config?.teacherIds ?? [], operations: rows.map(row => publicAssistantOperation(row, true)) });
});
router.patch("/admin/settings", requireAdmin, async (req, res) => {
  const body = UpdateAssistantAvailabilityBody.parse(req.body);
  await db.insert(configuration).values({ id: 1, ...body }).onConflictDoUpdate({ target: configuration.id, set: body });
  res.json(body);
});
router.get("/operations/:id", async (req, res) => {
  try {
    const id = operationId(req.params.id);
    const [row] = await db.select().from(operations).where(and(eq(operations.id, id), eq(operations.teacherId, req.session.teacherId!), eq(operations.archived, false))).limit(1);
    if (!row) { res.status(404).json({ code: "NOT_FOUND" }); return; }
    res.json(publicAssistantOperation(row));
  } catch (err) { apiError(res, err); }
});
router.post("/prepare", prepareLimit, async (req, res) => {
  try {
    if (!await isEnabled(req.session.teacherId!)) throw failure("DISABLED");
    const body = PrepareAssistantWorksheetBody.parse({ ...req.body, message: typeof req.body.message === "string" ? req.body.message.trim() : req.body.message });
    const teacherId = req.session.teacherId!;
    if (!body.operationId) await recordAssistantEvent(teacherId, "execution_requested", null, { tool: "worksheet" });
    const access = await getAssistantExecutionAccess(teacherId);
    if (!access.canExecute) {
      await recordAssistantEvent(teacherId, "execution_blocked", null, { reason: access.status });
      throw executionAccessError(access.status);
    }
    const [previous] = body.operationId ? await db.select().from(operations).where(and(eq(operations.id, body.operationId), eq(operations.teacherId, teacherId), eq(operations.archived, false))) : [];
    if (body.operationId && !previous) throw failure("NOT_FOUND", 404);
    if (previous && !editableStatuses.includes(previous.status)) throw failure("LOCKED");
    if (previous && previous.messages.length >= 30) throw failure("RATE_LIMITED", 429);
    const base = previous && body.settings ? { ...previous, parameters: body.settings.parameters as Record<string, unknown>, template: worksheetThemeIdSchema.parse(body.settings.template), title: body.settings.title } : previous;
    const prepared = await prepareWorksheetRequest(req, body.message, body.language, base);
    const fields = {
      title: prepared.title, requestText: body.message, reply: prepared.reply,
      parameters: prepared.parameters as Record<string, unknown>,
      template: base?.template ?? "geometric", status: "draft", quote: null,
      missingFields: missingWorksheetFields(prepared.parameters), errorCode: prepared.supported ? null : "UNSUPPORTED",
      messages: [...previous?.messages ?? [], { role: "user" as const, text: body.message }, { role: "assistant" as const, text: prepared.reply }],
      updatedAt: new Date(),
    };
    const [saved] = previous
      ? await db.update(operations).set(fields).where(and(eq(operations.id, previous.id), eq(operations.updatedAt, previous.updatedAt), inArray(operations.status, editableStatuses))).returning()
      : await db.insert(operations).values({ ...fields, id: randomUUID(), teacherId, creditRequestId: `assistant:${teacherId}:${randomUUID()}` }).returning();
    if (!saved) throw failure("STATE_CHANGED");
    res.json(publicAssistantOperation(saved));
  } catch (err) { req.log?.warn({ errorName: err instanceof Error ? err.name : "unknown" }, "Assistant preparation failed"); apiError(res, err); }
});

router.post("/operations/:id/quote", mutationLimit, async (req, res) => {
  try {
    if (!await isEnabled(req.session.teacherId!)) throw failure("DISABLED");
    const id = operationId(req.params.id);
    const request = validateWorksheetRequest(req.body);
    const row = await db.transaction(async tx => {
      const current = await ownedOperation(tx, id, req.session.teacherId!);
      const saveRetry = current.status === "saving" && !!current.output;
      if (!saveRetry) {
        const access = await getAssistantExecutionAccess(current.teacherId, tx);
        if (!access.canExecute && access.reservedOperationId !== current.id) throw executionAccessError(access.status);
      }
      if (!editableStatuses.includes(current.status) && !saveRetry) throw failure("LOCKED");
      if (current.errorCode === "UNSUPPORTED") throw failure("UNSUPPORTED", 400);
      // Generated output is immutable: a save retry cannot reinterpret existing questions.
      if (saveRetry && (current.title !== request.title || current.template !== request.template || canonicalJson(current.parameters) !== canonicalJson(request.parameters))) throw failure("LOCKED");
      const [hold] = saveRetry && current.held ? await tx.select().from(creditHoldsTable).where(eq(creditHoldsTable.requestId, current.creditRequestId)) : [];
      const credits = saveRetry && (!current.held || hold && ["pending", "completed"].includes(hold.status))
        ? current.credits : await estimateCreditsForToolRequest(req.session.teacherId!, "worksheet");
      const [updated] = await tx.update(operations).set({
        title: request.title, parameters: request.parameters, template: request.template,
        quote: { id: randomUUID(), credits, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() },
        status: saveRetry ? "saving" : "quoted", missingFields: [], updatedAt: new Date(),
      }).where(eq(operations.id, id)).returning();
      return updated;
    });
    res.json(publicAssistantOperation(row));
  } catch (err: any) {
    if (err.code === "EXECUTION_SUBSCRIPTION_REQUIRED") await recordAssistantEvent(req.session.teacherId!, "execution_blocked", String(req.params.id));
    apiError(res, err);
  }
});
router.post("/operations/:id/confirm", mutationLimit, async (req, res) => {
  let newlyHeldRequest: string | null = null;
  try {
    const id = operationId(req.params.id);
    const body = ConfirmAssistantWorksheetBody.parse(req.body);
    const row = await db.transaction(async tx => {
      const current = await ownedOperation(tx, id, req.session.teacherId!);
      if (!current.quote || current.quote.id !== body.quoteId) throw failure("STATE_CHANGED");
      if (["queued", "running", "completed"].includes(current.status)) return current;
      if (current.status !== "quoted" && !(current.status === "saving" && current.output)) throw failure("LOCKED");
      if (!await isEnabled(req.session.teacherId!)) throw failure("DISABLED");
      if (new Date(current.quote.expiresAt).getTime() < Date.now()) throw failure("QUOTE_EXPIRED");
      const [oldHold] = await tx.select().from(creditHoldsTable).where(eq(creditHoldsTable.requestId, current.creditRequestId));
      const acceptedAccounting = !!current.output && (!current.held || oldHold && ["pending", "completed"].includes(oldHold.status));
      const expectedPrice = acceptedAccounting ? current.credits : await estimateCreditsForToolRequest(current.teacherId, "worksheet");
      if (expectedPrice !== current.quote.credits) throw failure("PRICE_CHANGED");
      // Serialize starts for a teacher even across separate operation IDs / server instances.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"assistant:start:" + current.teacherId}))`);
      const executionMode = current.output ? "resume" : await authorizeAssistantExecution(tx, current.teacherId, current.id);
      const active = await tx.select({ id: operations.id }).from(operations).where(and(eq(operations.teacherId, current.teacherId), inArray(operations.status, activeStatuses), sql`${operations.id} <> ${current.id}`));
      if (active.length >= 2) throw failure("CAPACITY");
      let creditRequestId = current.creditRequestId;
      if (oldHold && !["pending", "completed"].includes(oldHold.status)) creditRequestId = `assistant:${current.teacherId}:${randomUUID()}`;
      const hold = acceptedAccounting ? { creditsHeld: current.credits } : await holdCreditsForToolRequest(current.teacherId, "worksheet", creditRequestId);
      if (!acceptedAccounting && hold.creditsHeld > 0 && !("existingStatus" in hold && hold.existingStatus)) newlyHeldRequest = creditRequestId;
      if (hold.creditsHeld !== current.quote.credits) {
        if (hold.creditsHeld > 0) await CreditService.refund(creditRequestId, "Assistant price changed before execution");
        throw failure("PRICE_CHANGED");
      }
      if (hold.creditsHeld > 0) await tx.update(creditHoldsTable).set({ timeoutSeconds: sql`GREATEST(timeout_seconds, EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER + 900)` }).where(eq(creditHoldsTable.requestId, creditRequestId));
      const [updated] = await tx.update(operations).set({
        status: current.output ? "saving" : "queued", leaseUntil: null, errorCode: null,
        creditRequestId, credits: hold.creditsHeld, held: hold.creditsHeld > 0, updatedAt: new Date(),
      }).where(eq(operations.id, id)).returning();
      await recordAssistantEvent(current.teacherId, "execution_started", id, { tool: "worksheet", mode: executionMode, credits: hold.creditsHeld }, `execution_started:${id}`, tx);
      if (executionMode === "trial") await recordAssistantEvent(current.teacherId, "trial_started", id, { credits: hold.creditsHeld }, `trial_started:${id}`, tx);
      return updated;
    });
    newlyHeldRequest = null;
    res.json(publicAssistantOperation(row));
  } catch (err: any) {
    // The existing billing hold uses its own transaction. If our transaction
    // rolls back, fence compensation against a concurrent confirmation/replay.
    if (newlyHeldRequest) {
      const requestId = newlyHeldRequest;
      await db.transaction(async tx => {
        const current = await ownedOperation(tx, operationId(req.params.id), req.session.teacherId!);
        if (current.creditRequestId !== requestId || !["queued", "running", "saving", "completed"].includes(current.status)) {
          await CreditService.refund(requestId, "Assistant confirmation rolled back");
        }
      });
    }
    if (err.code === "EXECUTION_SUBSCRIPTION_REQUIRED") await recordAssistantEvent(req.session.teacherId!, "execution_blocked", String(req.params.id));
    apiError(res, err);
  }
});
router.post("/operations/:id/cancel", mutationLimit, async (req, res) => {
  try {
    const row = await db.transaction(async tx => {
      const current = await ownedOperation(tx, operationId(req.params.id), req.session.teacherId!);
      if (current.status === "cancelled") return current;
      if (!["draft", "quoted", "queued"].includes(current.status)) throw failure("LOCKED");
      if (current.held) await CreditService.refund(current.creditRequestId, "Assistant request cancelled before generation");
      await releaseAssistantTrial(tx, current.teacherId, current.id, "cancelled");
      const [updated] = await tx.update(operations).set({ status: "cancelled", leaseUntil: null, updatedAt: new Date() }).where(eq(operations.id, current.id)).returning();
      return updated;
    });
    res.json(publicAssistantOperation(row));
  } catch (err) { apiError(res, err); }
});
router.delete("/operations/:id", async (req, res) => {
  try {
    await db.transaction(async tx => {
      const current = await ownedOperation(tx, operationId(req.params.id), req.session.teacherId!);
      if (activeStatuses.includes(current.status)) throw failure("LOCKED");
      await tx.update(operations).set({ archived: true, updatedAt: new Date() }).where(eq(operations.id, current.id));
    });
    res.sendStatus(204);
  } catch (err) { apiError(res, err); }
});
export default router;
