---
name: Homework Vitest DOM setup
description: Test-environment constraints for React component tests in the homework web artifact.
---

React component tests in the homework web artifact should explicitly clean up rendered DOM between cases, use native DOM properties rather than jest-dom matchers, and wrap context consumers in their real providers.

**Why:** The current Vitest setup does not automatically clean up between renders or register jest-dom matchers. Quran audio tests also fail before exercising behavior when `QuranAudioPlayer` is rendered outside `QuranAudioHostProvider`.

**How to apply:** In new or repaired component tests, call Testing Library `cleanup()` in `afterEach`, assert through `getAttribute`, `classList`, and native element properties, and include the same required providers used by the application.

Tests of blur-dependent inline saving must focus the element natively, wrapped in `act`, rather than only dispatching a focus event.

**Why:** `fireEvent.focus` does not transfer `document.activeElement` in jsdom. A flush that blurs the active element then misses the editable field, producing a misleading draft-loss failure on mode changes.

**How to apply:** Use `act(() => element.focus())` before entering an uncommitted inline draft when verifying save, preview or export flushing.