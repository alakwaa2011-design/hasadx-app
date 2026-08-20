---
name: Autosave idempotency
description: Rules for retry-safe persistence of AI-generated teacher content after a timeout or lost response.
---

Each newly generated draft needs one stable client request identifier, retained for retry attempts. The server must enforce ownership-scoped uniqueness for that identifier and return the original row for a duplicate create request.

**Why:** a server can commit a create successfully while its response is lost. Retrying without a durable key silently creates duplicate content and can duplicate side effects such as XP or internal grading records.

**How to apply:** add the identifier to both the create payload and an ownership-scoped unique database index. Keep it stable until the server returns the stored ID, then switch future saves to update. Serialize generation through that first save: never let newer content reuse the same create key while the first response is pending or failed; require its retry to resolve first. Any create-time dependent rows or rewards must be in the same transaction as the winning insert; duplicate requests only read the committed winner.