---
name: Hasaad Guide human handoff
description: Product and safety rules for transferring an AI guide conversation to Hasaad support.
---

When a teacher requests human support, continue inside the original Hasaad Guide conversation and preserve its history. Pause AI replies while the support state is requested or human; teacher messages go directly to support until an administrator closes the handoff.

**Why:** Splitting the discussion into a separate inbox loses context and confuses the teacher, while allowing both AI and an administrator to answer creates contradictory replies and can charge credits for a message intended for support.

**How to apply:** Keep ownership checks server-side, make transfer idempotent, notify administrators with a deep link, identify administrator messages distinctly, and exclude support-system and administrator roles from later AI model history after the conversation returns to the guide.