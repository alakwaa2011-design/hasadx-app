---
name: Rebase semantic-merge corruption
description: The task-merge auto-rebase can splice unrelated code blocks together outside conflict markers; don't trust the merged file body.
---
The automated rebase's semantic merge can corrupt files beyond the marked conflict regions — e.g. splicing a Nominatim fetch into an OpenAI call site, or dropping main's changes when a later commit rewrites the same file.

**Why:** Its interstitial merge stitches code by structure, not semantics; a commit that refactors a region can silently clobber main's edits to neighboring lines even when the rebase "completes cleanly".

**How to apply:** After any conflicted rebase, don't just remove markers — grep the final file for signatures of BOTH sides' changes (e.g. main's new params and the task's new imports). If corrupted, rebuild deterministically: `git show <clean-side>:<file>` as a base, then `git apply` the other side's pure diff, and re-verify end to end.
