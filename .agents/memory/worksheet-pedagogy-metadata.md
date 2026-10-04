---
name: Worksheet pedagogy metadata
description: Why worksheet learning intent is stored with settings and sent to generation as structured fields.
---

Keep worksheet learning objective, cognitive skill, activity duration, differentiation, and assessment mode in the worksheet settings JSON rather than adding dedicated database columns. Send the same values to generation and extraction routes as validated structured fields, never by concatenating them into the topic.

**Why:** These values describe how one worksheet should be taught and assessed, so they must persist with saved worksheets and templates without expanding the database schema. Structured AI inputs preserve validation and prevent a long topic string from truncating or blurring the instructional intent.

**How to apply:** Any worksheet create, edit, duplicate, template-load, generation, or extraction flow must preserve the fields together. Use language-neutral enum values in stored/API data and translate labels only in the interface.

Automatic worksheet question selection must supplement, not replace, the teacher's manual choices.

**Why:** The user explicitly requested the default to be automatic, choosing suitable questions from the grade/age and subject/topic, while «تظل الخيارات الأخرى جميعها موجودة».

**How to apply:** Future worksheet simplification must preserve every supported manual question format and count override. Automatic selection should reflect the teaching context, not disguise a fixed distribution as an intelligent choice.

Automatic selection must not sample every supported question type. Respect the teacher's selected page count in the rendered worksheet; use focused types for one page and light variety for two pages. Teachers may optionally constrain the types within automatic mode, while the system chooses a fitting distribution. Tic-Tac-Toe requires an explicit teacher choice and must never become enabled merely through automatic selection.

**Why:** The user reported that automatic generation selected from all types and clarified that page count, restrained variety, optional type constraints, and explicit Tic-Tac-Toe activation are required.

**How to apply:** Treat page count as a real layout constraint, not only a prompt hint. Do not interpret access to all supported formats as an instruction to use them all, and do not let cached choices silently activate a choice board.

The school administration requested adding «ورقة أنشطة المجموعات», which the user compared to Chalkie.

**Why:** The user stated this school requirement directly.

**How to apply:** Keep group-activity worksheets in the educational requirements when discussing worksheet teaching modes; do not treat them merely as another question format.