# Collaboration board — final QA audit

## Verdict: NOT READY

Audit target was the local development build at `http://127.0.0.1:5102` in managed headless Chromium (1440×900 desktop; 390×844 and 320×844 touch/mobile). This is a **dev-build audit, not production deployment validation**. No app source, repo test-suite, workflow, or shared-preview environment changes were made. Playwright harness/config and the QR decoder dependency were confined to `/tmp/collab-final-audit`; only audit evidence was written under this allowed `qa/collaboration-final/` directory. The audit's isolated teacher/boards/media were cleaned; the isolated database query returned no teacher whose email used the audit-only prefix.

Two current-browser findings block a READY recommendation, and multiple requested journeys remain unverified in this final pass.

## Confirmed findings

### F-1 — occupied-column deletion silently changes post grouping (high priority)

**Reproduction:** create a board with columns `أفكار` and `أسئلة`; add a post to `أفكار`; open Settings; delete `أفكار`; save. The SettingsEditor text says the server rejects deletion while a column is used. Instead, save succeeds, the dialog closes, the remaining column is `أسئلة`, the post appears under it, and the owner view reports the post's `columnId` changed from `ideas` to `questions`. No warning/error was displayed. This contradicts the UI promise and silently changes the post's grouping.

Evidence: `occupied-column-finding.json`, `screenshots/occupied-column-before.png`, `screenshots/occupied-column-after.png`.

### F-2 — projection header overflows on narrow viewports when timer is visible (medium/high usability)

With the 4-minute timer visible, the header measures 418 CSS px at both 390 px and 320 px viewport widths. The page itself reports no horizontal document overflow, but the fixed display/header internally overflows. At 390 px the `خروج` control begins around x=-28 and is partly offscreen; at 320 px it begins around x=-98 and is entirely offscreen. The join PIN is also partly clipped at 320 px. This compromises projection controls on small screens.

Evidence: `projection-390-metrics.json`, `projection-320-metrics.json`, `screenshots/projection-390.png`, `screenshots/projection-320.png`.

### Minor PDF presentation issue

The generated one-page A4 PDF contains the board and both Arabic posts, but also prints the `العودة إلى اللوحات` breadcrumb and the floating `مساعد حصاد` widget, with substantial unused page space. See `pdfs/collaboration.pdf`, `exports/pdfinfo.txt`, `exports/pdf-text.txt`, and `screenshots/pdf-page1-preview.png`. This did not prevent generation or text inspection.

## Current-run evidence matrix

| Area | Current result | Evidence / caveat |
|---|---|---|
| Teacher discovery and template creation | Pass | Empty-state CTA; selected `عصف ذهني`, edited Arabic title/prompt, created and opened board. |
| Guest join | Pass | Invalid PIN showed an error; blank guest name kept Join disabled; `ليان` joined, page reload offered the existing session; distinct guest `عمر` joined. |
| Moderated content | Pass, limited | Two realistic Arabic posts from joined guests were pending; teacher opened review and approved them. Posts were seeded through the isolated API fixture, not entered through the student composer. |
| Raster image | Pass, limited | Small generated educational illustration uploaded under the guest token and included with a pending post; review evidence captured. |
| Primary teacher/student views | Pass | Clean first-viewport captures at desktop and mobile. Main teacher grid measured within 390/320 px; student cards measured within those viewports. No join PIN masking was used for these fictional isolated audit boards. |
| Share link and QR | Pass | Copy action produced the expected local join URL. `jsQR` decoded the rendered Chromium QR screenshot; decoded URL exactly matched the clipboard URL. |
| CSV | Pass | Actual browser download saved as `exports/collaboration.csv`; parsed 2 records and Arabic headers with UTF-8 BOM. Formula-leading content was apostrophe-prefixed; quotes/commas remained parseable and newline was flattened to a space. |
| PDF | Pass with minor presentation issue | Clicked app Print/PDF control, then generated the Chromium PDF with `page.pdf`; inspected actual PDF metadata, extracted text, and rendered page preview. It is one A4 page. The breadcrumb and floating assistant widget are included. |
| Occupied-column deletion | **Fail — F-1** | Saved successfully and moved the post to the remaining column without warning, contrary to SettingsEditor guidance. |
| Projection with timer at 390/320 | **Fail — F-2** | Timer is visible but header width is 418 px; exit control is partly or fully beyond the left edge. |

## Prior evidence (not rerun in this final pass)

The prior focused audit recorded: 390/320 teacher/student grid checks; settings sticky-header/actions, cancel leaving values unchanged, save/reload; delete cancel/confirm; pause lost-response followed by same-client-ID retry; pause/extend/resume synchronization; stop-only synchronization to guest/projection. Earlier evidence also covers composer persistence/offline/aborted retry behavior, review rendering/approval/rejection/undo/conflict recovery, media-grant revocation, silent-gallery privacy, projection/lightbox behavior, and timer behavior. These are prior observations, not new claims from the current runs.

## Unverified / incomplete in this final pass

- Comments, reaction/vote budgets, pin/spotlight/hide, sorting/filter/search and student edit/delete paths were not exercised in this final pass.
- Full settings coverage (all six switches, numeric clamps, eight-column cap, reorder/add/remove/blank validation) was not rerun here; rely only on the narrower prior settings evidence above.
- Participant block/unblock, duplicate-board behavior and archive/restore were not completed in this run. One longer harness scenario was stopped at fixture creation because it supplied a deliberately unsafe `javascript:` reference URL; the app correctly rejected that invalid input with HTTP 400, so no later steps from that scenario are counted as tested.
- The final CSV had no comment/reaction values, so those export columns' populated-row contents were not verified.
- This audit did not validate production deployment, real email delivery, multi-device network conditions, or a physical QR scanner. QR payload itself was decoded from the actual rendered QR pixels and matched the copied local URL.

## Screenshots for review

Primary clean captures (the earlier dimmed teacher screenshots were removed):

- `screenshots/teacher-main-desktop-clean.png`
- `screenshots/teacher-main-390-clean.png`
- `screenshots/student-layan-main-desktop-clean.png`
- `screenshots/student-layan-main-390-clean.png`

Additional responsive/problem evidence:

- `screenshots/teacher-main-320-clean.png`, `screenshots/student-layan-320.png`, `screenshots/student-omar-320.png`
- `screenshots/teacher-main-lower-clean.png`
- `screenshots/occupied-column-before.png`, `screenshots/occupied-column-after.png`
- `screenshots/projection-390.png`, `screenshots/projection-320.png`
- `screenshots/share-dialog.png`, `screenshots/pdf-page1-preview.png`

All names/content are fictional Arabic audit data. No real user accounts, cookies, or teacher emails appear in screenshots. The join PIN remains visible intentionally because it belongs to a disposable local fixture, not a real/shared board.

### Follow-up verification requested after visual review

- The copied share URL was opened in a separate guest browser context. It showed the correct board title, accepted the fictional name `ليان`, and entered that board. The QR decoded from that same share screenshot matched the copied URL. See `exports/qr-link-opened.json`.
- A second actual Chromium PDF included the uploaded 280×180 raster and a 900-character Arabic post within the valid limit. `pdfinfo` reports one A4 page; `pdfimages -list` confirms the 280×180 embedded guest image; `pdftotext` includes the beginning and ending of the post, and the rendered page preview shows the image, wrapped text and tags without clipping. See `pdfs/pdf-with-image-long-text.pdf`, `exports/pdf-long-info.txt`, `exports/pdf-long-images.txt`, `exports/pdf-long-text.txt`, `exports/pdf-long-verify.json`, and `screenshots/pdf-long-page-1.png`.
- The print-output UI-chrome issue remains confirmed on both PDFs: the breadcrumb and floating assistant are still present. No fix was attempted.

### Final focused continuation (requested gaps; no broad rerun)

The following focused scratch checks ran after the earlier evidence. Individual passing checks are recorded as observed; expected denials are product-policy behavior, not defects.

| Case | Observation | Result |
|---|---|---|
| Guest comments and deletion permissions | Guest created their own comment; cancel preserved it and confirm deleted it. Teacher deleted a different guest's comment. Guest had no delete control on a peer card. Guest own-post delete cancel preserved the post and confirm removed it; teacher's final-delete flow removed another post. | Verified |
| Reactions and votes | Four like/question on/off toggles returned to zero. Own-card vote controls were disabled. With budget 1, first peer vote disabled the next; the direct API denial returned the expected “استخدمت جميع أصواتك...” message; unvote freed budget and the next peer vote succeeded. | Verified |
| Find/filter/sort | Column, tag and mine filters returned their expected card counts; old/new changed card order; nonexistent search text displayed the empty-results message. | Verified |
| Settings and columns | All six switches persisted to the requested values and guest-visible effects were checked for privacy, moderation, comments, reactions and image denial. Number inputs clamped to 1/10. Blank-column validation and the eight-column cap worked. Occupied columns were moved up and down, saved/reloaded, and post-to-column IDs remained unchanged. | Verified. Silent was saved both on and off; its guest-hide effect was not rechecked in this focused run. |
| Participant access | Blocking a guest produced the access-denied screen on their next GET; unblocking restored their board access. | Verified |
| Closed / open / archived / draft API gates | Closed, archived, and draft guest mutations were denied (HTTP 409); closed board hid the new-post control. Reopening and opening after archive restoration permitted a guest mutation. These denials are expected, not bugs. | Verified |
| Duplicate by teacher UI | Duplicate had a distinct PIN and matching settings/columns, and no posts or members. | Verified |
| Archive, restore and library | Archive state persisted; archived filter showed the original and open filter hid it. Restore returned the original content and mappings; guest mutation was denied while it was draft and allowed after it was opened. | Verified. Draft-library filter remains unverified: the scratch assertion mistakenly checked for the board under “drafts” *after* opening it; no retry was made. |
| Loading/error/empty states | Delayed first GET skeleton, aborted GET followed by manual retry, empty board/participants/review/filter states. | Not run in this continuation. |
| Offline/lost response | Cached offline view/draft with no automatic resend, and one guarded post-create lost response retried with the same client receipt. | Not run in this continuation. |
| Guest join attempts against closed/draft/archived boards | Not run separately; do not infer access behavior from mutation denial. | Unverified |

One intermediate vote-filter assertion initially expected two posts while `column=ideas`, `tag=تشجير`, and `view=mine` were all active; the resulting count of one was consistent with those combined filters. The corrected isolated reaction/filter check passed. In the lifecycle check, the final draft-filter assertion was ordered after reopening the board and therefore used an incorrect expectation; it is a harness gap, not a reported product defect. Per the request, neither scenario was rerun.

The focused lifecycle run stopped at that draft-filter assertion. It had already observed duplicate success, archived-filter behavior, archive restore/content preservation, draft mutation denial, and successful posting after opening. No further browser checks were attempted because the previous notebook was lost and the remaining states were not feasible to recheck without starting a fresh run.

### Cleanup and release recommendation

The run's `afterAll` removed stored-image objects for tracked fixture boards and deleted its uniquely prefixed fixture teacher. A read-only query returned no `e2e-collab-final-*` teacher rows, and the board-to-teacher foreign key is `ON DELETE CASCADE`, so those owned board fixtures are removed as well. No source, test-suite, workflow, shared-preview setting, or application data outside the disposable audit fixtures was changed.

**Recommendation remains NOT READY.** The occupied-column deletion data movement and projection-header overflow are confirmed product defects; the PDF's breadcrumb/assistant chrome is a minor output issue. The explicitly listed loading/empty, offline/draft-resend, guarded lost-response and guest-join lifecycle checks remain unverified. This remains a local development-build audit, not production deployment validation.
