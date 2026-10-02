---
name: Production replica statistics
description: Avoid mistaking zero monitoring counters on the production read surface for absent application data.
---

Do not infer that production tables are empty, or that the managed query surface points at the wrong database, from zero `pg_stat_user_tables` counters alone.

**Why:** The production read-only query surface returned zero `n_live_tup`, `seq_scan`, and `idx_scan` values even though an explicit `SELECT COUNT(*)` confirmed populated application tables. Those statistics are not an authoritative record count on that surface.

**How to apply:** For performance diagnosis, use actual bounded aggregate queries to verify data volume. Treat catalog index definitions separately from monitoring counters, and distinguish code-based bottleneck hypotheses from measured live request latency.