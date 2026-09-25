---
name: Browser film audio startup
description: Audio startup timing when recording browser-rendered videos with narration.
---

When an animated film must start with narration, wait until its actual audio element has advanced through a silent pre-roll before mounting the scene clock. Keep that same element alive during the film; creating another element or seeking back to zero can reintroduce a noticeable decoder/output startup stall.

**Why:** In headless Chromium, `canplay`, `readyState=4`, and `paused=false` were all true while `currentTime` stayed at its initial value for more than a second. A separate preload element did not eliminate the delay. A silent pre-roll on the same, continuously playing element did.

**How to apply:** For voice-led browser video exports, check that `currentTime` advances at the first visible frame, not just that the media loaded. Align cumulative scene audio offsets to the pre-roll. In headless visual checks, the audio can remain near zero for several seconds even with autoplay allowed; if the loading gate remains visible, click its sound-start button before waiting for the film canvas. Do not mistake that startup stall for a React render failure.