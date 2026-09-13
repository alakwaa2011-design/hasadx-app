---
name: Web Push delivery and sound
description: Durable rules for reliable multi-device delivery and avoiding duplicate notification sounds.
---

Web Push delivery state must be tracked independently for every subscribed device. A success on one device must never mark a transient failure on another device as complete. Foreground handling must deduplicate by notification ID because ambiguous provider responses can cause safe at-least-once retries.

**Why:** Notification-scoped delivery loses alerts when one of several devices fails. Retrying after an ambiguous response can also replay a custom foreground sound.

**How to apply:** When the app has a visible client, suppress the system notification and let the page play the selected Hasaad sound only if the user's sound setting is enabled. When no client is visible, show a normal Web Push notification and let the browser/OS control its sound, silent mode, and Focus behavior. Never depend on custom Web Push sounds.