---
name: Quran joined-vocative madd
description: Distinguishing the Tajweed rule of joined Uthmani vocatives from upstream word-level tagging.
---

Treat **every vocative «يا» followed by a hamza-initial word** as **مد جائز منفصل حكمًا**, including «يا أيها»، «يا آدم»، and «يا أهل الكتاب», even when the Uthmani script joins «يا» to the next word (or prefixes it with «و»). Correct only the vocative madd span, not other connected-madd spans later within the same joined token. Disclose that the displayed classification is a local correction of sourced data.

**Why:** Quran Foundation's word-level Tajweed markup tags these joined written forms as «مد واجب متصل», which gives readers an incorrect explanation despite using official source data. The user confirmed that the rule applies to «يا» followed by any hamza, not just «أيها/أيتها». The two madd classes use the same display color, so the error is in the rule name and reasoning rather than the color.

**How to apply:** When investigating other suspected Tajweed misclassifications, compare the tagged span with the linguistic word boundary. Keep authentic connected madd unchanged, including other madd spans in the same written word, and make corrections auditable.