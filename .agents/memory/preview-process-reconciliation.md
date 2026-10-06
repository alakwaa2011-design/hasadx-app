---
name: Preview process reconciliation
description: Managed workflow state can diverge from surviving server processes after reconciliation.
---
After workflow reconciliation, a workflow can report failed with “port already in use” while its older server still answers HTTP. A separate backend rebuild can temporarily return 502 on login.

**Why:** This environment exhibited surviving old frontend/backend processes alongside newly reconciled workflows; local HTTP success alone did not establish managed workflow health.

**How to apply:** Check managed workflow state, listening ports and process ancestry together. Resolve only the confirmed duplicate service processes, preserve unrelated artifacts, and verify both proxied API responses and managed readiness before declaring recovery. A 502 does not imply bad credentials.
