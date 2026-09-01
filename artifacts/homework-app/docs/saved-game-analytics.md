# Saved-game analytics

The saved-game flow emits three Replit-hosted project analytics events. Events
contain only the stable `game_type` and `location` dimensions; they never
include a game title, question text, saved-game ID, or teacher ID.

| Event name | When it is recorded |
| --- | --- |
| `saved_game_saved` | After the saved-game API confirms a successful save from a game creator |
| `saved_game_replayed` | After a saved-game API request successfully returns a saved activity for replay |
| `saved_game_deleted` | After the saved-game API confirms a successful deletion from My Games |

`game_type` is the canonical game key (for example `arena`, `escape`, `rocket`,
or `tug`). `location` is one of `game_creator` or `saved_games_library`.

## Reading the events after publishing

1. Open **Publishing settings**, enable analytics, and publish or republish
   the app.
2. Open the app's Replit analytics view and filter custom events by one of the
   three event names above.
3. Break down or filter by `game_type` to compare saved-game formats, and by
   `location` to distinguish creator saves from library replays/deletions.

The events start appearing after the publish with analytics enabled. A useful
reuse measure is `saved_game_replayed` compared with `saved_game_saved` for
each `game_type`; deletion volume can be reviewed with
`saved_game_deleted`.