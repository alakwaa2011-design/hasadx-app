---
name: Hasad unified color tokens
description: Platform-wide green unification — emerald/teal/green Tailwind scales are overridden in index.css; don't reintroduce bright greens or per-file hexes.
---

The platform's green system is unified from the root: a `@theme` block in `artifacts/homework-app/src/index.css` overrides the full `--color-emerald-*`, `--color-teal-*`, and `--color-green-*` scales with shades derived from Hasad dark green `#225739` (700 = brand; 500 = `#468064`, 600 = `#2f684d`).

**Why:** The user asked for one calm dark-green identity across all tools (reference: the «توليد الأسئلة» button / `bg-primary`), removing bright emerald/turquoise variants. Overriding the Tailwind v4 scales unified hundreds of files without touching designs.

**How to apply:** In new UI, just use `emerald-*` classes (or `bg-primary`) — they already resolve to brand shades. Never hardcode bright green/teal hexes (`#10b981`, `#059669`, `#34d399`, `#14b8a6`…); if a hex is unavoidable use the derived scale in that @theme block. Gold `#D9A521`/amber stays the accent; cream/white backgrounds unchanged. In-game visuals (confetti palettes, whiteboard drawing colors) were deliberately left untouched.
