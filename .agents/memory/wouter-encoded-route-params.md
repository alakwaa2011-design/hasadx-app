---
name: Wouter encoded route params
description: Why reserved characters in teacher-defined names need careful URL decoding
---

Wouter normalizes browser paths with `decodeURI`, which leaves encoded reserved characters such as `%2F` inside route parameters. Passing such a parameter to `encodeURIComponent` again double-encodes it and can make existing records look missing. Do not simply apply `decodeURIComponent` to the Wouter parameter: an actual name containing the literal text `%2F` would then become a slash. Read the raw encoded URL segment and decode it exactly once when the exact user-defined name matters.

**Why:** A rewards-board request for a class with `/` returned 404 with `%252F` in its URL, even though the class and its students existed. Stale-query invalidation alone could not fix this.

**How to apply:** For any path parameter that can contain reserved URL characters, check whether Wouter already decoded part of it. Test both an actual slash and a literal percent escape in the underlying name before routing the result into API queries.