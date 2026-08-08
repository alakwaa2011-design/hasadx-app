---
name: gpt-5 reasoning tokens eat max_completion_tokens
description: Why gpt-5 calls return empty content (finish_reason "length") and how to configure them
---

The rule: every gpt-5-family chat.completions call MUST set `reasoning_effort` ("minimal" for JSON generation) and a generous `max_completion_tokens` (12k-16k for outline/mindmap-sized outputs; never a few hundred).

**Why:** gpt-5 counts hidden reasoning tokens against `max_completion_tokens`. With a ~4k-token prompt and a 4000 budget, ALL 4000 tokens went to reasoning and the reply content was EMPTY with `finish_reason: "length"` — every retry failed the same way, so requests dragged past the proxy's hard 120s abort (log signature: `request aborted`, `responseTime: 120000`). Default reasoning effort alone also routinely exceeds 120s.

**How to apply:** when adding/auditing AI calls in the api-server, check the model; if it starts with `gpt-5`, add `reasoning_effort: "minimal"` (or "low") and size `max_completion_tokens` to expected output + slack. Diagnose by curling the AI proxy with the real prompt and inspecting `usage.completion_tokens_details.reasoning_tokens` and `finish_reason`.
