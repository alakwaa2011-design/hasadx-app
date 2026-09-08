# AI video motion provider and pricing

The motion adapter uses fal's documented `fal-ai/veo3.1/fast` text-to-video model. The public model documentation lists:

- 4, 6, or 8 second generations;
- `16:9` and `9:16` aspect ratios;
- 720p, 1080p, and 4K resolution;
- optional generated audio; and
- **$0.10 per generated second without audio at 720p or 1080p** (**$0.15/second with audio**). 4K is listed at $0.30/second without audio or $0.35/second with audio.

This integration requests standard 720p with audio disabled, so one 4/6/8-second provider clip has a documented public price of **$0.40 / $0.60 / $0.80**, respectively, before any Replit billing or connector-specific charges. Prices should be rechecked before paid trials because provider pricing can change. Source: [fal Veo 3.1 Fast model documentation](https://fal.ai/models/fal-ai/veo3.1/fast/llms.txt).

Requested scene durations are rounded up to the next supported duration so the generated clip is not shorter than the scene. Requests over eight seconds are rejected rather than assembled from unrelated generations. Square scenes are generated as `16:9` with a centered-subject safe-area instruction and are intended for a centered `1:1` crop downstream.

fal-hosted generated media URLs are public, provider-hosted, and transient. The adapter downloads the MP4 only from approved HTTPS `fal.media` hosts with redirect, size, timeout, content-type, and payload checks. The downloaded local file is private (`0600`) and is intended to be copied into the application's private object storage by the downstream renderer; the transient public URL must not be persisted as the project output.