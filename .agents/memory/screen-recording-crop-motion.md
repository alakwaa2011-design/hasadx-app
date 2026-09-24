---
name: Screen-recording crop motion
description: Guard against cropping important content out of animated screen recordings.
---

For captured product footage, fit a crop to the **actual moments used**, not to a representative frame elsewhere in the recording. Check the beginning and end of each cropped segment. If a short wide view must remain stable while the source zooms, a still frame from the real recording with motion in the film composition is safer than a wandering crop.

**Why:** An internal camera zoom changed the apparent position and size of the game UI; a crop that looked correct on a wide frame cut off a team and part of the question when applied later in the same recording.

**How to apply:** Sample timestamps on either side of each intended cut, inspect cropped output at full size, and preserve the actual source UI. For a portrait film that must show two wide side-by-side panels, paired crops from the same real frame can keep both panels visible without inventing replacement UI.