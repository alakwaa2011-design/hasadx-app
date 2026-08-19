---
name: Wameeth gift rounds
description: Distinguishes individual live games from actual one-player Wameeth sessions when enabling gift rounds.
---

`gameMode: "solo"` means students compete individually in a live Wameeth game; it is not a reliable signal that a session has only one player. Gift rounds must remain available in this mode just as they are for team games.

**Why:** The same game mode is used by self challenges and independent direct links, which do need uninterrupted single-player flow. Treating every `solo` game as a self challenge silently disabled gifts for the normal individual live-game option.

**How to apply:** Gate gift rounds with the session's gifts-enabled setting. At creation, explicitly disable gifts only for one-player self challenges and independent direct links; leave individual and team live games enabled.