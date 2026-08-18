---
name: DM read receipts & image attachments
description: One-way read receipts (admin only) and image attachments in direct messages; stored-XSS hardening on object serving.
---
- Read-receipt privacy is one-way BY DESIGN: admin sees teacher's readAt; teacher must never see if admin read their message. Server enforces it — teacher GET /direct-messages returns readAt only for admin-authored messages (needed for unread count) and null for the teacher's own. Don't "fix" this asymmetry.
- **Why:** explicit product decision — teachers shouldn't pressure/infer admin availability.
- DM images store the internal objectPath ("/objects/<id>") in direct_messages.image_url; frontend renders via `${API_BASE}/api/storage${objectPath}`. Upload reuses /api/storage/uploads/request-image-url presigned PUT.
- Stored-XSS hardening (keep intact): request-image-url only allows raster MIME allowlist (SVG rejected); serveObject sends nosniff + restrictive CSP and forces Content-Disposition: attachment for svg/html/xml types. Removing any of these reopens same-origin script execution from uploaded files.
