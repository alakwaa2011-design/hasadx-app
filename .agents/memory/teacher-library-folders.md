---
name: Teacher library folders
description: The teacher file library uses hierarchical folders and keeps presentations embedded in the library surface.
---

Folders are represented by a self-referencing parent relationship, while files continue to point to one folder. The library UI treats presentations and teacher-owned interactive videos as internal content views instead of navigating away.

**Why:** Teachers organize resources like a computer file system and need to keep their place while moving between library content types.

**How to apply:** Preserve parent ownership checks, nested breadcrumb navigation, and the embedded presentation/video views when extending the teacher library.