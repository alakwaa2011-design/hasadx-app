---
name: PostgreSQL prepared statements
description: Why parameterized multi-command SQL fails and how to preserve atomic cleanup.
---

Parameterized PostgreSQL client queries must contain exactly one SQL command. When cleanup requires several dependent deletes or updates, execute each command separately on the same checked-out client inside one explicit transaction.

**Why:** PostgreSQL rejects multiple semicolon-separated commands in a prepared statement with `cannot insert multiple commands into a prepared statement`; database mocks may accept the same string and hide the production failure.

**How to apply:** For server mutations that lock a row and clean related records, keep `BEGIN`, each `DELETE` or `UPDATE`, and `COMMIT` as separate client calls. Cover the path with real PostgreSQL or an end-to-end API test.