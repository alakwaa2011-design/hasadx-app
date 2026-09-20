---
name: Shared upload cleanup scope
description: Safety rule for cleanup jobs operating in an object-storage namespace shared by unrelated application features.
---

An orphan cleanup job must enumerate only the object prefix owned by that subsystem. Do not scan a shared uploads root and infer orphan status solely from the subsystem's database tables.

**Why:** Unrelated application assets can be valid and intentionally absent from those tables. A library cleanup that scanned the common uploads root deleted Quran recitation audio and its timing manifest even though those files were not library objects.

**How to apply:** Give each subsystem a distinct storage prefix, limit listing and deletion to that prefix, and add regression tests proving that neighboring application namespaces are never candidates. Temporary exclusions are only a containment measure until enumeration is scoped correctly.