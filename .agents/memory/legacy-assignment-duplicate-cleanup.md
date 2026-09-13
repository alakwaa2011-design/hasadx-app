---
name: Legacy assignment duplicate cleanup
description: Safety rules for finding and archiving assignment copies created before source identity was stored
---

Only present a legacy copy as a cleanup candidate when it matches an active shared source across the question set, relevant assignment settings, and a recognizable title family. Never infer that a teacher's copy is disposable from title similarity alone.

**Why:** Older imported assignments have no provenance marker, while teachers may intentionally reuse or edit the same activity. False positives can hide valuable teaching history even when no rows are deleted.

**How to apply:** Keep any copy with teacher edits or student usage. If multiple untouched copies match, retain the newest and offer only older extras for explicit archival; archival must remain reversible and version-checked.

An intentional-copy confirmation is owner-scoped review metadata, not an archive/share mutation. It should suppress future scans while leaving the assignment content, version, and library permissions unchanged.

**Why:** Teachers may intentionally reuse an activity, and hiding a reviewed false positive must not remove it from their work or alter who can access it.

**How to apply:** Validate the authenticated owner before recording confirmation, filter confirmed copies before duplicate matching, and keep confirmation separate from edit/version conflict state.