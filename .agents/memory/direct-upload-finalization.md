---
name: Direct upload finalization
description: Security invariants for signed direct uploads and recipient-authorized attachment access.
---

Direct uploads remain untrusted until a server-verified finalization step. The signed ticket must bind the owner, object path, purpose, exact allowed MIME, maximum actual size, entitlement, and expiry. Store the verified object generation and reject serving if the current generation differs. Assign verification metadata with an `ifGenerationMatch` precondition so bytes cannot be replaced between inspection and marking.

Legacy compatibility may authorize only exact references whose write path already proved ownership (such as reserved library uploads or immutable thread attachments). A path copied into mutable presentation, worksheet, question, video, or message content is not ownership evidence. Parent objects require an exact reference in a thread owned by the current teacher; parent portal downloads require the exact active token's thread. A grandfathered public profile image also requires a hardened write path plus authoritative raster MIME; a profile field must never publish arbitrary legacy file types.

**Why:** A signed PUT URL can be reused or paired with client-controlled policy values unless finalization is cryptographically bound to the original reservation. Read-time fallback for modern paths would make finalization optional. Mutable records let a user paste another object's path and manufacture a false ownership reference.

**How to apply:** Every direct-upload client must finalize before persisting a path. Limit legacy fallback to a provable historical path shape and non-forgeable exact DB references, then inspect bytes without mutating metadata. Recipient routes must validate the active token and exact thread reference before signing.