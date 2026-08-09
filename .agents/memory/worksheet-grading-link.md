---
name: Worksheet smart paper grading link
description: How worksheets connect to the photo-grading engine via hidden internal assignments
---

Worksheets with smart grading enabled link to a hidden internal assignment (`assignments.source='worksheet'`, `worksheets.linked_assignment_id`).

**Rules that must hold:**
- The internal assignment has `accessCode: NULL`, `accessMode: 'private'`, `isShared: false`. It is gated ONLY by the owner's teacher session (special branch in submit-image). Never expose an access code or route it through the generic `GET /assignments/:id` (that endpoint 404s worksheet-source rows).
- Teacher assignment lists filter `source IS DISTINCT FROM 'worksheet'`.
- Editing a worksheet whose linked assignment already has submissions must VERSION (create a new internal assignment and repoint the link) — never mutate questions under existing results. Toggle-off detaches without deleting.
- Converted questions all carry `correctAnswer: null` so the grading engine always takes its paper/partial-credit vision path; the answer key travels in `aiGradingInstructions`.

**Why:** the submit-image engine picks all-or-nothing MCQ-letter extraction whenever any question has a correctAnswer; mixed worksheet types only grade reliably on the uniform paper path.

**How to apply:** any new feature touching worksheets↔assignments, assignment lists, or submit-image must preserve these invariants. Login deep-links use `/login?returnTo=/...` (validated same-app path in auth page); `/auth` is NOT a registered route.

**Name auto-extraction (worksheet flow only):**
- Student name/class are read by the same grading vision call (extra "الاسم:" line in prompt); manual input is optional and takes precedence. Never block grading on a missing/unclear name — save as-read, offer post-hoc correction (owner-only PATCH on the submission).
- Roster matching must be scoped to the assignment's teacher and normalized for Arabic variants (hamza/alef/ta-marbuta/عبدال). NEVER trust a client-supplied studentId in the worksheet flow — cross-teacher injection risk.
- Extracted class must pass `normalizeExtractedClass` (digit/ordinal normalization, 1-12 only, OCR noise stripped); untrustworthy readings are stored blank, and a matched roster student's class overrides the OCR reading unless the teacher typed one manually.
- Parse AI answer lines into a map keyed by question number (incl. Arabic-Indic digits), never by array position — a dropped/reordered line otherwise shifts all grades.

**QR + multi-page (worksheet flow only):**
- Printed QR carries only the grade-page URL + p/of page numbers — never answers or codes. Page count is a client print-layout fact, so the server never knows it; the grade page learns it from the QR/URL.
- Multi-page = one submission: ordered imagesBase64 (worksheet source only, cap 10 pages, per-page and total base64 size validated server-side; express caps image routes at 25mb) sent as multiple image parts in ONE grading call. The PAPER-ONLY branch is the one worksheets use — there are three near-identical messageContent blocks in submit-image; editing "the last one" hits the MCQ branch by mistake.
- Client reads the QR inside each captured photo (jsQR at full res, then compress for upload); page fallback allocation must happen inside the functional setState (concurrent captures otherwise race for the same missing slot); clamp any QR-supplied page total to ≤10.

## تقرير النتائج وتحليلات التصحيح
- أي إحصاءات/تقارير تُبنى على نتائج التصحيح **يجب** أن تعتمد الدرجة الفعلية: `teacherAdjustedPoints ?? earnedPoints` للورقة، و`teacherPoints != null ? teacherPoints > 0 : isCorrect` للإجابة — تجاهلها يجعل التقرير يكذب بعد مراجعة المعلم اليدوية.
- `GET /api/submissions/:id/details` يعيد `{ submission: {...}, answers: [...] }` (شكل مغلّف) — لا يعيد الحقول مسطّحة.
- دمج محاولات نفس الطالب في التقارير: الهوية = studentId إن وُجد وإلا `normalizeArabicName` من lib/worksheet-grading؛ «غير معروف»/الاسم الفارغ لا يُدمج أبداً (كل ورقة مستقلة).
