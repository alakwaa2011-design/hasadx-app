---
name: Feedback messaging identity
description: Security and delivery invariants when turning public feedback into teacher-platform conversations.
---

Public feedback must be linked to a teacher conversation only from an authenticated teacher session. A typed email address is not proof of account ownership; anonymous and legacy-unlinked feedback remains email-only.

**Why:** Matching public form input to an account by email lets anyone impersonate that teacher and inject messages into their private platform conversation.

**How to apply:** Any public-to-private messaging bridge must derive ownership from verified session identity, never free-text contact fields.

Retryable feedback email status must be updated only by the outbox delivery reference for the currently displayed response. Use bounded terminal status values, keep retries idempotent for identical content, and create a distinct delivery when response content changes.

**Why:** Older outbox jobs can finish after newer replies and overwrite their status; reused keys can also silently drop edited replies.

**How to apply:** Fence terminal status updates with the current response reference, and derive a stable idempotency key from the feedback plus response content or an explicit client request key.