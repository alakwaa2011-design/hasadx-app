---
name: HEIC schedule imports
description: Why iPhone schedule images must be converted in the browser before vision upload.
---

Convert HEIC/HEIF schedule images to JPEG lazily in the browser before sending them through the existing image-upload route.

**Why:** The server's Sharp build recognizes HEIF containers but does not include HEVC decoding. It fails on real iPhone HEIC files even though its format metadata reports HEIF buffer support.

**How to apply:** Keep the HEIC converter dynamically imported so normal page loads and JPG/PNG/WebP imports do not download it. Send the converted file as `image/jpeg` through the standard validated upload path.