---
name: Activity library subject aliases
description: Subject alias matching must avoid reverse substring matches that create false positives between related Arabic subject names.
---

Subject preference matching may use direct substrings and aliases contained in the searched value, but should not treat an alias as matching merely because it contains the other subject name.

**Why:** Arabic names such as «معلوماتية» contain «علوم» as a character sequence even though they represent different subjects; reverse substring matching can incorrectly prioritize unrelated activities.

**How to apply:** When adding or changing subject aliases, test a custom subject against nearby subjects from other alias groups and keep cross-group false positives out of both filters and preference sorting.