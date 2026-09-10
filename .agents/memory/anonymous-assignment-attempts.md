---
name: Anonymous assignment attempts
description: Attempt and deadline rules while assignments do not have verified student identities.
---

Without verified student accounts, an assignment may grant at most one extra attempt globally, but eligibility is enforced per device fingerprint rather than by student name. The UI must state that shared devices share the attempt pool and changing devices cannot be treated as verified identity.

**Why:** Names and client-supplied student IDs are forgeable. Device fingerprints are only a temporary abuse-control boundary, not proof of a person.

**How to apply:** Serialize attempt checks by assignment and device inside the final write transaction, recheck lifecycle and deadline under the same lock, and never use names to grant individual exceptions. Preserve adaptive assignments that explicitly allow retries.