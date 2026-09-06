---
name: Worksheet pedagogy metadata
description: Why worksheet learning intent is stored with settings and sent to generation as structured fields.
---

Keep worksheet learning objective, cognitive skill, activity duration, differentiation, and assessment mode in the worksheet settings JSON rather than adding dedicated database columns. Send the same values to generation and extraction routes as validated structured fields, never by concatenating them into the topic.

**Why:** These values describe how one worksheet should be taught and assessed, so they must persist with saved worksheets and templates without expanding the database schema. Structured AI inputs preserve validation and prevent a long topic string from truncating or blurring the instructional intent.

**How to apply:** Any worksheet create, edit, duplicate, template-load, generation, or extraction flow must preserve the fields together. Use language-neutral enum values in stored/API data and translate labels only in the interface.