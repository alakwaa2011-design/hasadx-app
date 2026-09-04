---
name: Lemon Squeezy checkout layout limits
description: Official customization boundary for keeping subscription overlays compact without unsupported iframe changes.
---

For Hasaad subscription checkouts, use only Lemon Squeezy’s documented checkout options: product media, store logo, and description may be hidden while discount codes and the recurring subscription preview remain visible.

**Why:** Lemon Squeezy does not document a compact layout, summary/sidebar visibility control, Tax ID visibility control, or custom overlay dimensions. The summary column is part of its hosted checkout design and must not be altered through iframe CSS or JavaScript.

**How to apply:** Keep these compact options scoped to subscription checkout creation so credit-package checkout behavior remains unchanged. Preserve the selected variant, price, discount field, and required billing/tax fields.