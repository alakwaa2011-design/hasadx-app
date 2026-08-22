---
name: Library visibility flags
description: How Wameeth safely handles shared-library list rows when their moderation field is omitted.
---

A client-side source guard that requires `hiddenByAdmin === false` must account for trusted list responses that already filter hidden rows but omit that field from their serialized shape.

**Why:** Treating the omitted field as an ordinary failed visibility check made a visibly published library activity look absent in Wameeth. Conversely, weakening the shared guard globally could expose a future caller that supplies untrusted activity data.

**How to apply:** Normalize the omitted moderation field to `false` only at the client boundary of the server-filtered shared-assignments list. Keep the general Wameeth visibility helper strict for explicit rows and all other callers.