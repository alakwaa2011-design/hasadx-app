---
name: Whiteboard boardActions normalization
description: LLM-generated board actions may arrive as wrapped objects without a "type" field; normalize server-side or the presenter silently skips them.
---

The rule: any AI-generated boardActions list must be normalized server-side before reaching the whiteboard presenter — unwrap `{ "showLocation": {...} }` into `{ type: "showLocation", ... }`, filter unknown types, and fall back to a `writeText` of the voiceText if the list ends up empty.

**Why:** GPT models copy the prompt's shorthand notation (`showLocation: { name, ... }`) literally, emitting wrapped objects. Actions without `type` fall through every presenter handler silently → blank board while the voice plays. Prompts should show full literal JSON examples (`{ "type": "...", ... }`), not shorthand.

**How to apply:** when adding new board action types or new AI endpoints that emit board actions, extend the KNOWN_TYPES normalization in the whiteboard ask route and keep prompt examples as complete flat JSON objects with an explicit warning against the wrapped form.
