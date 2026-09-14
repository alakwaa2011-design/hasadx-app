---
name: Socket terminal recovery UI
description: Terminal game screens must keep their reconnect affordance during browser offline and Socket.IO recovery.
---

Terminal result views are part of the live game shell, not a separate disconnected page: preserve the finished phase on transport loss and keep the reconnect banner mounted there.

**Why:** Browser offline can happen before Socket.IO emits its disconnect event, and replacing a finished solo result with the lobby loses the player's result during recovery.

**How to apply:** When adding or changing terminal game branches, test browser offline/online after completion and assert both result persistence and absence of lobby/join UI.