---
name: Worksheet immediate-save state
description: Prevents the last worksheet formatting action from being lost when Save is clicked immediately.
---

Worksheet layout saving must read question text and style changes from synchronously updated sources, not only from the latest rendered React state.

**Why:** A teacher can change a formatting option and click Save before React commits the queued state update. The worksheet then appears correct until reload, when the final action has reverted.

**How to apply:** Any new worksheet text or formatting control must update its synchronous snapshot and rendered state together. Verify by making it the final action, saving immediately, and checking it after a full reload.