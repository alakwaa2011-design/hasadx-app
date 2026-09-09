---
name: Safe required columns on publish
description: How to add a required unique column without making Replit Publish truncate existing production rows.
---

When adding a new required column to a table that already contains production data, give it a database default that can populate every legacy row. If the column is unique, the default must generate a distinct value per row.

**Why:** Replit Publish diffs the final development schema directly against production. A new `NOT NULL` column without a default cannot be applied to existing rows, so validation may classify truncating the populated table as the only executable plan.

**How to apply:** Before publishing, inspect the schema diff. Require no truncation warning and no structural data loss; for unique text identifiers, a generated per-row legacy identifier is safer than a constant default.