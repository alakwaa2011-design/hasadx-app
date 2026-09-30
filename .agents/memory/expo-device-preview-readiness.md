---
name: Expo device preview readiness
description: How to distinguish an active managed Expo Go session from a stale proxy response.
---

An HTTP 200 from the Expo preview domain alone does not prove the managed mobile workflow is ready for Expo Go. Confirm that the current workflow reaches its Expo Go QR and that the iOS manifest and JavaScript bundle load through the public domain.

**Why:** A previous Metro process can continue serving the proxy while a newer managed workflow waits on a port-conflict prompt, leaving device preview in an ambiguous state.

**How to apply:** When preparing physical-device testing, inspect the managed workflow first; if there is a port collision, identify which processes actually belong to the mobile artifact before stopping stale ones. Restart the managed workflow, then check the iOS manifest, bundle, and required API endpoints before sharing the workflow's own Expo Go URL. Do not construct the link from a generic web preview URL.