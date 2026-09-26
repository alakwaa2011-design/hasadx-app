---
name: Quran joined-vocative madd
description: Distinguishing the Tajweed rule of joined Uthmani vocatives from upstream word-level tagging.
---

Treat «يا أيها» and «يا أيتها» as **مد جائز منفصل حكمًا**: «يا» and «أيها/أيتها» are distinct in meaning even where the Uthmani script joins them. Do not globally relabel the source's connected-madd class; correct only validated forms and disclose that the displayed classification is a local correction of sourced data.

**Why:** Quran Foundation's word-level Tajweed markup tagged the joined written form as «مد واجب متصل», which gave readers an incorrect explanation despite using official source data. The two madd classes use the same display color, so the error is in the rule name and reasoning rather than the color.

**How to apply:** When investigating other suspected Tajweed misclassifications, compare the tagged span with the linguistic word boundary. Keep authentic connected madd unchanged and make any additional exception narrow and auditable.