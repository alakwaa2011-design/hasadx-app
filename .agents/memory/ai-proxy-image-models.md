---
name: AI-integrations image models
description: Which image models the Replit AI-integrations OpenAI proxy supports
---
The AI-integrations OpenAI proxy rejects `dall-e-3` with UNSUPPORTED_MODEL. Use `gpt-image-1`, which returns `b64_json` (no `url` and no `response_format` param) — decode base64 and upload to object storage.
**Why:** app-side image generation silently produced null images when using dall-e-3; errors were swallowed.
**How to apply:** any server route calling `openai.images.generate` via `AI_INTEGRATIONS_OPENAI_BASE_URL` must use gpt-image-1 + b64_json, and log/handle failures instead of returning null silently.

Also: object-storage paths returned by the API (`/objects/...`) are NOT loadable directly from the browser — the frontend must rewrite them to `${API_BASE}/api/objects/...` (see AudioPlayer's resolveUrl). Storing/returning raw `/objects/` paths to the UI renders broken images silently.
