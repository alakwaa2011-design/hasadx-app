---
name: Worksheet workspace invariants
description: Why worksheet settings, printable renderer lifetimes and export capture need exclusive ownership.
---

Keep worksheet settings under one primary “بيانات الورقة / الترويسة / التصميم” organization, not an additional differently named settings route.

**Why:** The approved editing workflow explicitly rejects a separate “الترويسة والتنسيق” entry that duplicates those same controls.

**How to apply:** Add future header, identity and design settings to that organization. Editing and final preview are modes of the same draft, not alternate settings or save routes.

Worksheet renderers sharing printable IDs and global styles must never overlap, including during closing animations.

**Why:** Retaining an exiting workspace while remounting its live-paper counterpart briefly creates two printable roots. Export lookup and global worksheet styles can then target the wrong renderer even though only one appears visible.

**How to apply:** Treat renderer lifetimes as exclusive when adding transitions or changing workspace ownership. Check the root count during transitions, not only after animations settle.

All worksheet formats must share a synchronous export lock and freeze the live document during asynchronous capture.

**Why:** Separate PDF and Word busy flags allow overlapping operations; mode changes or text/settings edits while fonts or images are loading can alter the document being exported.

**How to apply:** Fence competing exports, navigation, mode changes and live controls until success or failure releases the lock. Verify with delayed export readiness, not only instantly resolved mocks.