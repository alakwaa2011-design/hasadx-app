---
name: Browser print-capture lifecycle
description: Keep real export isolation active when verifying a PDF through headless browser capture.
---

Capture automated print PDFs while the application's real print-isolation lifecycle is active. Release a simulated print-completion callback only after the PDF capture finishes.

**Why:** Capturing after simulated print completion releases the export's isolation and can produce misleading output despite a successful A4 preparation check. A nonempty, readable PDF alone does not establish that the intended print layout was captured.

**How to apply:** Trigger the actual export action and capture its isolated DOM with print media. Inspect page count, physical A4 size, header bounds, current content, and absence of editor chrome. Distinguish this PDF evidence from an observed application download: do not claim the native OS “Save as PDF” dialog was automated when only headless capture was performed.