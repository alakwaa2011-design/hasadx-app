---
name: Direct upload finalization
description: Security invariants for signed direct uploads and recipient-authorized attachment access.
---

Direct uploads remain untrusted until a server-verified finalization step. The signed ticket must bind the owner, object path, purpose, exact allowed MIME, maximum actual size, entitlement, and expiry. Store the verified object generation and reject serving if the current generation differs.

**Why:** A signed PUT URL can be reused or paired with client-controlled policy values unless finalization is cryptographically bound to the original reservation. Recipient access based only on a folder or uploader identity can expose unrelated files or make legitimate files inaccessible.

**How to apply:** Every direct-upload client must finalize before persisting a path. Recipient download routes must validate an active access token, require the object to be explicitly referenced by that message or reply, and then recheck ownership, verified metadata, size/type, and generation before signing a download URL.