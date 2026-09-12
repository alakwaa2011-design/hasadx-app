---
name: AI video character normalization
description: Why generated storyboard character collections need a narrow normalization boundary before strict validation.
---

Generated AI-video storyboards may return the two required characters as an object keyed by `teacher` and `student`, even when instructed to return an array. Treat this as an equivalent structural representation and normalize it before applying the strict storyboard schema.

**Why:** Repeated valid storyboard attempts failed before video generation because the model returned a keyed character object while the schema accepted only an array.

**How to apply:** Normalize only the character collection shape and infer missing role/id from recognized teacher/student keys. Keep all substantive character, dialogue, timing, and rendering checks strict; do not invent missing appearance, voice, or scene content.