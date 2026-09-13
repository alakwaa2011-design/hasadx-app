---
name: Web Push delivery and sound
description: Durable rules for reliable multi-device delivery and avoiding duplicate notification sounds.
---

Web Push delivery state must be tracked independently for every subscribed device. A success on one device must never mark a transient failure on another device as complete. Foreground handling must deduplicate by notification ID because ambiguous provider responses can cause safe at-least-once retries.

**Why:** Notification-scoped delivery loses alerts when one of several devices fails. Retrying after an ambiguous response can also replay a custom foreground sound.

**How to apply:** Always show the system notification so a visible public/student page cannot discard it. When any client is visible, make that system notification silent and notify the page so an authenticated teacher listener can play the selected Hasaad sound once. When no client is visible, let the browser/OS control notification sound and Focus behavior. Never depend on custom Web Push sounds.