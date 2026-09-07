---
name: Credit hold idempotency and artifact delivery races
description: Rules for concurrent holds, replay safety, and crash-safe paid artifact completion
---
Idempotent paid work needs one serialized claim boundary: only one duplicate may execute, while every replay follows the stored operation outcome.

**Why:** checking a key and claiming work in separate, uncoordinated steps lets one duplicate refund or reuse another request's hold, causing failed work, double charges, or unbilled execution.

**How to apply:** claim before execution, re-check inside the debit boundary, and test simultaneous duplicates with balance for exactly one operation.

Long paid jobs need a renewable worker lease. Persisting the final result and completing its charge are atomic; recovery claims expired leases only and stays fail-closed until credit reconciliation succeeds.

**Why:** unfenced workers, split completion writes, or early retries can turn one crash into lost work or a double charge.

**How to apply:** fence terminal writes by lease identity and make artifact completion, charge completion, and retry eligibility agree after any interruption.
