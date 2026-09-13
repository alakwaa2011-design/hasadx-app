---
name: Slides workspace install
description: Workspace dependency setup needed before validating newly scaffolded Legacy slide artifacts.
---

New Legacy slide artifacts can fail dependency installation before any slide code runs when a package uses `wouter: "catalog:"` but the root `pnpm-workspace.yaml` lacks a matching catalog entry.

**Why:** pnpm resolves catalog references workspace-wide, so the artifact's own package file is not enough to install or run `validate-slides`.

**How to apply:** When a new slide artifact reports `CATALOG_ENTRY_NOT_FOUND`, compare its catalog dependencies with the root catalog and add only the missing version-pinned entry before rerunning the filtered install.