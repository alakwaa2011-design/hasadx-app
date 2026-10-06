---
name: AI content language precedence
description: Rules for choosing and preserving the language of newly generated AI content.
---

New AI-generated content follows this priority: an explicit request for Arabic or English wins; otherwise clearly English teacher input (at least four Latin characters and no Arabic characters) selects English; otherwise the interface language is the fallback.

**Why:** A teacher can work in an Arabic interface while preparing English material, and the generated artifact must keep that language through later saves, edits, builds, and additions.

**How to apply:** Use the shared resolver for content-creating endpoints. Return the resolved language when a client must save an artifact after generation. For existing artifacts, preserve their stored language for subsequent additions unless the new request explicitly asks for another language. Cache keys for language-sensitive replies must include the resolved language.

Assistant execution must preserve the content language confirmed during preparation or chosen in its settings. Internal English formatting/game instructions are not teacher input and must never trigger a fresh language inference.

**Why:** The user reported English-only assistant games despite explicitly asking for Arabic; internal English gameplay guidance overrode the already selected Arabic language.

**How to apply:** Resolve from the teacher's own text during preparation, giving explicit new language requests priority over model guesses and prior settings. Pass the confirmed language through generation and saving without re-inferring it from system-authored notes.