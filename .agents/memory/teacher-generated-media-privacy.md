---
name: Private teacher-generated media
description: Privacy boundary for AI-generated videos and other teacher-owned media outputs
---

AI-generated teacher media must be stored in a private, teacher-owned object prefix. Persist only the normalized private object path; authorize the requesting session against the owner before issuing a short-lived signed download URL.

**Why:** a hard-to-guess public object URL is still public once leaked through logs, browser history, or sharing. Generated lesson media may include private classroom material and must not inherit the public ACL used by shareable presentation assets.

**How to apply:** use public object uploads only for explicitly shareable assets. For teacher projects, include the teacher identity in the object prefix, keep the ACL private, and enforce the same ownership rule at upload validation, server-side rendering, and retrieval.