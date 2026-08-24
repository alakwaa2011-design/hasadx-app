---
name: AI content language precedence
description: Rules for choosing and preserving the language of newly generated AI content.
---

New AI-generated content follows this priority: an explicit request for Arabic or English wins; otherwise clearly English teacher input (at least four Latin characters and no Arabic characters) selects English; otherwise the interface language is the fallback.

**Why:** A teacher can work in an Arabic interface while preparing English material, and the generated artifact must keep that language through later saves, edits, builds, and additions.

**How to apply:** Use the shared resolver for content-creating endpoints. Return the resolved language when a client must save an artifact after generation. For existing artifacts, preserve their stored language for subsequent additions unless the new request explicitly asks for another language. Cache keys for language-sensitive replies must include the resolved language.