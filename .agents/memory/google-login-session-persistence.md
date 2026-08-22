---
name: Google login session persistence
description: Prevent Google sign-in from losing its session during an immediate browser navigation.
---

For a Google Identity callback, persist the newly established server-side session before responding, and use the application's in-page role-aware navigation after success rather than a hard document reload.

**Why:** A browser can cancel an in-flight response during an immediate `window.location` navigation. If express-session has not completed its asynchronous store write, the next authenticated request sees no session even though Google token verification and account linking succeeded.

**How to apply:** Any callback-style login flow that ends in an immediate navigation must either await the session store's save operation before returning success, or avoid a full document navigation. Keep the client and server safeguards together.