---
name: Worksheet immediate-save state
description: Protects live worksheet drafts during immediate saves, echoed props, and delayed navigation.
---

Worksheet layout saving must read question text and style changes from synchronously updated sources, not only from the latest rendered React state.

**Why:** A teacher can change a formatting option and click Save before React commits the queued state update. The worksheet then appears correct until reload, when the final action has reverted.

**How to apply:** Any new worksheet text or formatting control must update its synchronous snapshot and rendered state together. Verify by making it the final action, saving immediately, and checking it after a full reload.

When a preview streams its live draft back to its parent, echoed props are not the saved baseline. Every mutation must notify the canonical draft, every saved-page Save action must persist it, and Discard must restore the last successfully saved snapshot.

**Why:** Integrating header settings into live preview changed the meaning of parent data: using that data for Discard became a no-op, while a formerly local Save appeared successful without persisting anything.

**How to apply:** Cover all toolbar actions, including type conversion, style reset, and automatic layout, as the sole final edit. Preserve uncommitted inline text across settings changes and flush it before exports and browser-leave warnings.

Successful asynchronous saving does not authorize navigation if the leave intent was canceled or newer edits exist.

**Why:** A delayed response can otherwise close the editor after the teacher chooses to stay or makes further changes.

**How to apply:** Fence each leave intent and compare the current draft against the submitted snapshot before navigating. Changing the interface language must not refetch over an unsaved worksheet.