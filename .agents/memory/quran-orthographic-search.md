---
name: Quran orthographic search
description: Preserving ordinary Arabic queries against Uthmani Quran spelling without breaking conventional spellings.
---

Quran verse search needs both forms of a dagger alif: one that omits it and one that writes a normal alif. Split the joined vocative «يا» from a following hamza before normalizing either form.

**Why:** The Uthmani spelling of «يا أهل الكتاب» joins «يا» to «أهل» and writes «الكتاب» with a dagger alif; stripping marks alone yields an unsearchable «يااهل الكتب». Globally expanding every dagger alif would instead lose familiar searches such as «الرحمن», which conventionally omits the extra alif.

**How to apply:** When changing Quran text search, check both plain «يا أهل الكتاب» and «يا آدم», including prefixed «ويا», while retaining ordinary queries like «الرحمن». Preserve the displayed Quran text; only transform searchable forms.