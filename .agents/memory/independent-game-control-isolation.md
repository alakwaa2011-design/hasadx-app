---
name: Independent game control isolation
description: Prevent touch input on Wameeth independent-game controls from leaking into answer interactions.
---

Independent-game controls must execute at pointer-down (while preserving keyboard activation) rather than waiting for the trailing click. Opening an exit confirmation must immediately fence answer submission and incoming next-question/finished updates until the user cancels or navigation completes.

**Why:** Mobile touch input can leave a trailing click in the answer area. During answer auto-advance, that can mix an exit attempt with a new answer and leave the game visually inconsistent.

**How to apply:** Keep control and dialog layers above question content, stop their pointer propagation, and use a synchronous ref—not only React state—to guard competing socket/UI events during the exit flow.