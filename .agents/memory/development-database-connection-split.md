---
name: Development database connection split
description: How to verify schema when shell PostgreSQL variables disagree with the managed development database.
---

For development schema verification and migrations, prefer the managed database callbacks over direct `psql` commands that use the shell's `PG*` variables when their results disagree.

**Why:** The shell connection reported a missing column immediately after the running API logged successful migrations, while the managed development database connection confirmed the column existed and validated all dependent queries. The two connection surfaces can point at different databases.

**How to apply:** If schema results conflict, use the managed development database status/query tools as the source of truth for the app's Replit database, and avoid mutating the database reached only through shell variables.