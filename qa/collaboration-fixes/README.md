# Collaboration fixes — focused browser QA

## Result

All requested focused journeys passed in the isolated QA database using a targeted Playwright run at a time and the existing API build. No application source was edited and no broad suite was run. Findings below describe the tested preview/build, not production certification.

## Observed matrix

| Journey | Widths / setup | Observed result |
|---|---|---|
| Occupied-column transfer/save | 1440, 390, 320 px | In all three layouts, saving the settings moved occupied-column posts to the selected non-first destination and removed the source column. Image/comment/reaction content and hidden/approved and pending states remained. Empty-column deletion worked; saving without a required mapping returned 409; a concurrent post/race was not lost. |
| Projection header and controls | 1440, 390, 320 px; running, paused, no-timer states | Header, PIN, timer and exit controls stayed within their viewports; document/header/display widths had no horizontal overflow. Exit returned to the board. Paused-state rendering used authenticated API setup; see verification limits. |
| Real Print/PDF | Browser print flow; 1440, 390, 320 px print-layout checks | Clicked Print/PDF and inspected an actual two-page A4 PDF (594.96 × 841.92 pt, 70,241 bytes) with two embedded images. Extracted text included the Arabic long-post start/end, tags, and reference URL; teacher/action controls were absent. Rasterized pages were reviewed, responsive print layouts were checked, and the screen stayed unchanged. |
| Loading and recovery | Desktop, 1440 × 900 | A delayed GET showed four skeletons without a premature empty/error state; resolving it loaded the expected board. Aborting the GET showed a clear load error and retry. Explicit retry loaded the correct board and cleared the overlay. |
| Owned empty states | 1440, 390, 320 px | Verified fresh-board CTA and empty participants, empty review queue, empty column alongside an occupied column, no-results search, and an empty library filter distinct from a full-library empty state. No horizontal overflow was observed. |
| Teacher library / anonymous join eligibility | 1440, 390, 320 px | A persisted draft appeared under “مسودات”; open, closed, and archived fixtures were excluded. Before changing any status, anonymous contexts saw the refusal message with no name or Join controls for each ineligible status. All nine POST attempts returned 409 and member counts stayed unchanged. After explicitly opening the draft, anonymous join succeeded to that board at each width. |
| Offline composer and uncertain receipt | 390, 320 px draft; 1440 px receipt retry | The offline draft persisted across close/reopen and resize. Offline showed the cached board and disabled submission; no create request was sent. Reconnection did not auto-send. Explicit send created exactly one post. For a separate create, `route.fetch()` let the server commit once while the response was dropped; the explicit retry reused the same client ID and left exactly one post. |

## Evidence

- `occupied-column-result.json` and `screenshots/transfer-{confirmation,saved}-*.png`
- `projection-header-metrics.json` and `screenshots/projection-header-*.png`
- `print-pdf-verification.json`, `print-responsive-metrics.json`, `screenshots/classroom-board-a4-page-*.png`, and `screenshots/print-*.png`
- `recovery-matrix.json` and `screenshots/recovery-*.png`
- `library-join-status-matrix.json` and `screenshots/library-drafts-*.png`, `screenshots/anonymous-*.png`
- `offline-receipt-matrix.json` and `screenshots/offline-*.png`
- `fixture-cleanup.json` records cleanup counts and confirmation.

Fixture JSON retains only non-authenticating historical IDs/statuses where useful; expired board join PINs, the fake teacher email, session cookie, and media object paths were removed from the QA artifacts.

## Cleanup

The isolated teacher and all owned collaboration boards were removed after the final journey. The teacher deletion cascaded 11 owned boards; both referenced collaboration media objects were deleted successfully. A post-cleanup database check found zero remaining boards for the owner and zero teachers with this QA run's test-email prefix. `/tmp/collab-projection-fixtures.json`, which held the session cookie with mode 0600, was removed. QA JSON was checked for session-cookie/auth-token fields.

## Verification limits

- Browser coverage was the local Chromium/Playwright preview with an isolated database; this is not certification of a production deployment or other browsers.
- Offline behavior was simulated by switching the browser context offline/online. It verifies the application’s offline guard and no-auto-send behavior under that simulation, not every real network failure mode.
- The paused projection layout was verified from an authenticated API-set paused timer state. An earlier interactive pause attempt did not confirm persisted pause state (the board still showed an active timer); that UI transition remains unconfirmed and was not classified as a product bug.
- The PDF was produced and inspected in this browser environment; platform-specific print dialogs and other browser PDF renderers were not tested.
