---
name: Audible Web Audio boundary checks
description: How to measure sound across Quran verse-file transitions without confusing preloads or silent analysers with audible output.
---

When checking gapless verse playback in Chromium, measure RMS from an AnalyserNode connected to the same AudioContext graph as the actual speaker output, with an active downstream connection. Check nonzero PCM immediately on both sides of the boundary in addition to confirming successive files were fetched. An analyser connected only to a MediaStreamAudioSourceNode, but not onward to a pulled destination, can report all zeroes even though the playback graph is producing sound. Media Session titles can also move ahead of the audio if a wall-clock timeout drives the transition.

**Why:** A browser check initially showed fetched verses and advancing labels while no next verse had been scheduled, then later produced false silent-window readings from an unpulled analyser. PCM sampling on the pulled speaker graph revealed the actual edge silence embedded in the MP3s.

**How to apply:** Instrument the sound-producing AudioContext, anchor measurements to its sample-clock boundary, require measurable sound before and after, and test repetition and surah changes separately. Do not treat a successful preload or an advancing title as evidence of continuous sound.