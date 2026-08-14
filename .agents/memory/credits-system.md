---
name: Credits system architecture
description: Design decisions and gotchas for the credits/points system added to the platform.
---

## Rule
The credits system is a pure no-op when `creditsEnabled = false` (the default). Zero code paths changed for regular teachers or students until an admin flips the switch.

**Why:** The system was built as silent infrastructure — it must not affect any existing behaviour until deliberately activated.

**How to apply:** `checkCredits(toolKey)` middleware reads settings (cached 30s); calls `next()` immediately when the system is off. Invalidate cache via `invalidateCreditsSettingsCache()` after admin settings change.

## Schema
- 5 new tables: `credit_tool_prices`, `credit_accounts`, `credit_transactions`, `credit_holds`, `credit_packages`
- 3 new columns on `platform_settings`: `credits_enabled`, `welcome_credits`, `admin_credit_test_mode`
- All in `lib/db/src/schema/credit-*.ts`, exported from `lib/db/src/schema/index.ts`
- Runtime CREATE TABLE in `runSchemaMigrations()` in `artifacts/api-server/src/index.ts`

## Critical: rebuild @workspace/db after schema changes
`lib/db` uses a compiled `dist/` output referenced by TypeScript project references. Adding new schema files requires:
```
cd lib/db && npx tsc -p tsconfig.json
```
Without this, the api-server tsc will report "Module '@workspace/db' has no exported member 'creditXxxTable'".

## UI gotchas
- `Button` in `ui-elements.tsx` accepts only `variant` (`default | outline | ghost | destructive`) — no `size` prop. Using `size="sm"` causes TS2322.
- Admin tab key: `"credits"`, icon: `Coins` from lucide-react (must be in the import list in admin.tsx).

## Handler contract (post-hold)
Every response after `checkCredits` must either `captureCredits(req)` (content delivered — including lenient/fallback success paths) or `refundCredits(req, reason)` (400/403/404/5xx early exits), otherwise held credits sit until the 60s auto-refund cron. `checkCredits` honors an `X-Idempotency-Key` UUID header (requestId = `teacherId:toolKey:key`) so browser retries can't double-charge; frontend does not send it yet.

## Test DB gotcha
TEST_DATABASE_URL DB lacks the boot-time `credit_tool_prices` seed (it runs in api-server startup). Integration tests must seed/normalize the tool rows they assert costs for.

## Deliberately free (audited 2026-08-14)
Admin-only image-question extraction; game AI generation (wheel, quick-challenge, arena, million hint — games policy cost 0); guest/public AI routes (no teacher session); TTS (student listening, rate-limited); AI chat (own daily cap).

## Wired tool_keys (checkCredits middleware applied)
- `ai-questions` → POST /api/ai/generate-questions
- `mindmap` → POST /api/ai/generate-mindmap
- `worksheet` → POST /api/worksheets/ai/generate
- `lesson-plan` → POST /api/lesson-plans/ai/generate
- `whiteboard` → POST /api/whiteboard/generate
- `presentation` → POST /api/presentations/ai/outline + /api/presentations/ai/build/:draftId
- `whiteboard` → POST /api/whiteboard/ask (shared key with generate)
- `presentation-slide` (cost 5) → POST /api/presentations/ai/single-slide
- Pro 20% discount is central in `CreditService.hold` (`Math.ceil(cost*0.8)`, plan code `pro`, active)

## @workspace/billing is NOT modified
The credits system is entirely independent of subscriptions/plans in `@workspace/billing`.

## Auto-refund cron
`setInterval` every 60s calls `CreditService.autoRefundStaleHolds()` — uses each hold's snapshot `timeout_seconds` so admin changes don't affect in-flight operations.

## Admin routes
Mounted at `/api/admin/credits/` in `routes/credits-admin.ts`, registered in `routes/index.ts` before the export.
