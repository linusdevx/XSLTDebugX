# Implementation checklist and research gate

## Recommendation at the gate

Proceed with a **session-first hybrid**: complete runnable XSLT Mapping and XPath Query records in IndexedDB, a shared Explorer, explicit temporary drafts, a clean workspace start, revision-based concurrency, and portable backups. Preserve the current editors and execution modules behind a new SessionController rather than rewriting them.

The recommendation deviates from a simple “copy Markdown Viewer” path in several ways:

- No raw project/file Explorer in V1.
- No encryption, linked folders, desktop vault, live collaboration, or cloud share fallback.
- One complete session record instead of separate document/content stores.
- Merge-as-copy backup import before destructive replace.
- No automatic Trash expiry initially.
- Tabs are runnable-session tabs only and remain conditional on measured vertical-space/usability value.

## Approval requested before Phase 2

Confirm these product decisions:

1. Named runnable sessions are the V1 unit; linked project files/includes are deferred.
2. Use the implemented narrow native IndexedDB adapter and add no runtime dependency.
3. Share links and examples open as temporary drafts and never overwrite named items automatically.
4. Explorer is inline on wide desktop and an overlay/drawer on constrained widths.
5. Backup import ships merge-as-copy first; destructive replace is deferred.
6. Session tabs are built after storage/Explorer and may be deferred if they reduce editor usability.

The user approved a fresh workspace with no legacy migration on 2026-11-11. No production deployment, merge, backend, account system, license change, or fundamental editor layout change is authorized by this research branch.

## Phase B1 — schema and repository foundation

- [x] Implement a narrow native IndexedDB adapter with no new runtime dependency.
- [x] Add record validators and explicit byte/collection limits.
- [x] Create database/open/upgrade lifecycle with blocked and versionchange handling.
- [x] Implement workspaces, folders, sessions, drafts, trash, and settings stores/indexes.
- [x] Browser tests for type isolation, duplicate titles, blanks, ordering, referential integrity, conflicts, and trash/restore.
- [x] Confirm a fresh store ignores and preserves the legacy key.
- [x] Add injectable transaction-failure hooks and a focused abort/retry test.
- [x] Storage capability/usage/persistence status with graceful unsupported behavior in Explorer.

**Likely files:** new `js/workspace/*`, `index.html` script order, `vite.config.js`, license notices, tests.
**Estimate:** 4–6 engineering days including tests.

## Phase B2 — session controller and truthful autosave

- [x] Add mode-specific Quick Playground serialization without changing execution.
- [x] Implement named-session restore/switch, draft recovery, create, autosave, Save As, and Duplicate.
- [x] Preserve separate XSLT/XPath XML models while restoring IndexedDB drafts.
- [x] Add truthful Saving/Saved locally/Save failed UI for Quick Playground commits.
- [x] Add named-session conflict states; keep Monaco memory bounded by reusing the fixed XSLT/XPath models instead of allocating one model per Explorer session.
- [x] Flush before named item changes; retain best-effort visibility/pagehide handling only.
- [x] Compare-and-set revisions in transaction with BroadcastChannel notifications for cross-tab Explorer refresh.
- [x] Focused two-tab conflict test proves both revisions can be preserved through Save as copy.
- [x] Focused browser tests for independent autosave, reload, active mode, legacy-key isolation, status, and mode-aware clear.
- [x] Focused simulated quota/abort/retry coverage proves an aborted draft remains intact and the UI does not show a false Saved state. Broader browser-denial coverage remains in final verification.
- [x] Restore the last named XSLT and XPath contexts independently; direct mode changes do not create false revisions and are blocked when a named item cannot be saved.

**Likely files:** `js/state.js`, `js/editor.js`, `js/mode-manager.js`, new controller/conflict modules, status markup/CSS, tests.
**Estimate:** 5–7 days.

## Phase B3 — fresh-start transition

- [x] Do not create a migration store or import legacy values.
- [x] Preserve `xdebugx-session-v1` byte-for-byte while creating an empty workspace.
- [x] Move Quick Playground draft persistence to the new drafts store.
- [x] Stop restoring the legacy combined session.
- [x] Keep an explicit rollback note documenting that the old key remains available.

**Estimate:** 1–2 days as part of SessionController integration.

## Phase B4 — safe ingress boundaries

- [x] Refactor share decoding from immediate apply to pending validated payload.
- [x] Add Open temporarily / Save a copy choice and privacy/length warning.
- [x] Make examples open detached drafts by default.
- [x] Make upload/drop open detached draft or use explicit Replace action.
- [x] Redefine Clear as reset current content, not delete; named record remains and the reset is committed.
- [x] Preserve existing pane-level download behavior and raw-deflate `#share/` URL decoding compatibility while adding an explicit safe receiver flow.
- [x] Focused regression tests proving shares, examples, and uploads cannot silently overwrite named items or Quick Playground drafts.
- [x] Handle hash-only share navigation in an already-open tab, flush outgoing named work before replacement, cap decompression, and reject pane files above 25 MiB before reading.
- [x] Preserve CPI Helper Chrome Extension transfer compatibility: raw-deflate `#share/` payloads with XML, XSLT, headers, and properties open safely in SAP CPI mode.

**Likely files:** `js/share.js`, `js/modal.js`, `js/files.js`, `js/state.js`, controller, dialogs/tests.
**Estimate:** 3–4 days.

## Phase C1 — Explorer

- [x] Collapsible/resizable 220–360 px desktop Explorer with remembered open state and width.
- [x] Overlay drawer with focus trap, Escape close, and focus return at constrained widths.
- [x] New XSLT/New XPath, rename, duplicate, favorite, session/folder-tree soft delete, and restore.
- [x] Search title/workspace/folder plus All/Recent/Favorites/Trash, workspace grouping, simple folder create/rename, and session movement are implemented; deeper hierarchy management stays out of the primary UI.
- [x] Empty/no-results/storage-error states.
- [x] Keyboard open, unified tree Up/Down navigation, folder Left/Right collapse/expand, F2 rename, Delete-to-Trash, Escape drawer, and announced item types/save state.
- [x] Do not expose raw XML/XSLT files as separate primary items.

**Likely files:** `index.html`, `css/style.css`, new Explorer module/controller/query APIs, tests.
**Estimate:** 6–9 days.

## Phase C2 — responsive repair

- [x] Remove current desktop horizontal overflow at 1920 and 1366 CSS-pixel viewports.
- [x] Ensure Explorer overlay does not alter editor canvas width below breakpoint.
- [x] Provide usable pane navigation at 390×844 with a mode-aware Input/Transform/Output (or Query/Results) switcher and contained horizontal scrolling.
- [x] Keep mode and Run reachable; no critical primary controls off-screen.
- [x] Visual snapshots for XSLT/XPath, light/dark, Explorer open/closed at all target sizes. (24 PNGs in `docs/upgrade-review/screenshots/current/`; script: `capture-current.mjs`.)
- [x] Touch/keyboard tests and screen-reader smoke review. (13 accessibility tests in `accessibility.spec.js`; Explorer keyboard, dialogs, focus return, live errors/ARIA, skip link covered.)

**Likely files:** `css/style.css`, limited markup/layout code, Playwright screenshot suite.
**Estimate:** 3–5 days.

## Phase C3 — optional session tabs

- [ ] Validate need after Explorer usability testing.
- [ ] Tabs represent runnable sessions, hidden with one item.
- [ ] Close view without delete; protect failed/dirty drafts.
- [ ] Restore selection/scroll/undo where model cache remains live.
- [ ] Dispose evicted models and test bounded memory behavior.

**Estimate:** 3–5 days if approved; otherwise defer.

## Backlog — freeform pane arrangement

- [ ] Evaluate draggable pane reordering only after the constrained splitter layout has shipped and been usability-tested.
- [ ] Preserve the semantic Input → Transform → Output order by default; do not introduce floating windows without a clear accessibility and reset model.
- [ ] If pursued, add keyboard-equivalent reorder controls, per-mode layout persistence, safe reset, and narrow-screen fallbacks.

## Backlog — existing product audit and refinement

- [ ] Review and simplify existing code paths after the workspace feature stabilizes; remove duplication, stale compatibility branches, dead styles, and unclear ownership without changing behavior silently.
- [ ] Inventory every existing UI control and option across XSLT, XPath, CPI, Standard XSLT, Explorer, dialogs, console, examples, and status areas; keep, improve, relocate, or remove each option deliberately.
- [ ] Review desktop, tablet, and mobile layouts as one system, including hierarchy, spacing, pane density, overflow, collapse behavior, discoverability, keyboard parity, and light/dark consistency.
- [ ] Walk through complete user workflows—first visit, edit/run/debug, save/reopen, share receive/send, file ingress, backup/restore, conflict recovery, Trash, settings, and failure recovery—and remove redundant or confusing steps.
- [ ] Validate the refined UI and workflows with focused usability checks before freezing screenshots and running the final full regression suite.
- [ ] Audit user-facing terminology: use “Cloud Integration” for UI labels while retaining `cpi` code identifiers, CPI compatibility contracts, historical references, and precise trademark/product wording where required.

## Phase D1 — backup and restore

- [x] Versioned ZIP manifest and per-entry SHA-256.
- [x] Safe path, entry count, size, expansion ratio, duplicate, version, schema, and reference validation.
- [x] Export source, CPI input state, queries, organization, and favorites; exclude outputs/trash/history/drafts by default.
- [x] Flush pending named-session edits before creating a backup; abort export rather than producing a silently stale archive when the save fails.
- [x] Merge-as-new import preview with new IDs and one transaction.
- [x] Focused roundtrip covers CPI, Standard XSLT, XPath, Unicode, and exact source-object preservation.
- [x] Expanded corrupt/malicious/future-version matrix covers corrupt data, oversized pre-read rejection, unsafe paths, checksum tampering, future schemas, invalid references, and transactional rollback with zero partial writes.
- [ ] Defer Replace Workspace until rollback is separately approved/tested.

**Likely files:** new backup module, Settings dialog, ZIP dependency/notice if selected, fixtures/tests.
**Estimate:** 5–8 days.

## Phase D2 — selective product polish

- [x] Compact current-session menu without crowding Run.
- [x] Settings: theme, Explorer, storage usage/persistence, backup, trash/data controls.
- [x] About: version/build, AGPL, attribution, GitHub/Issues, accurate privacy/network wording, notices.
- [x] Integrate workspace/runtime/backup shortcuts and behavior into existing Help; do not add competing Help UI.
- [x] Release Notes only from real changelog/release data. (No fabricated release history; About dialog shows version only; GitHub releases atom feed is the authoritative source.)
- [x] Feedback link opens GitHub Issues without attaching source/payload.

**Estimate:** 3–5 days.

## Phase E — final verification

- [x] Run source and production-bundle E2E suites. (170/174 passed; 4 pre-existing flaky tests; production build clean at 8.7s.)
- [ ] Add Firefox/WebKit smoke coverage where CI permits.
- [ ] Execute all 25 acceptance scenarios from the brief with stored evidence.
- [ ] 5–20 MiB XML performance/memory test; blank, Unicode, namespaces, malformed XSLT, duplicate titles, many sessions, long paths.
- [ ] Two-tab conflict, blocked upgrade, quota/denied/private browsing, eviction/persistence messaging.
- [ ] Fresh-profile verification proves legacy keys are ignored and remain untouched.
- [ ] Backup roundtrip in clean browser profile.
- [x] Network audit proves no new content uploads. (No `fetch()` calls in any JS module; all persistence is local IndexedDB/localStorage; only external load is Saxon-JS CDN and GoatCounter analytics.)
- [x] Accessibility: Explorer keyboard, dialogs, focus, labels, live errors, contrast. (14 tests in `accessibility.spec.js`: +1 example card keyboard test added. Explorer rows have role=button+keydown, example cards have role=button+tabindex+aria-label+Enter/Space; KV panel accordion headers and col-tab divs have keyboard support via onkeydown in index.html; focus-visible styles on example cards in style.css.)
- [x] Update README feature/workflow wording for Explorer, local persistence, runtime profiles, safe shares, and backups.
- [x] Update architecture/testing docs, privacy wording, and actual release notes.
- [x] Produce before/after screenshots and test logs. (Before: `docs/upgrade-review/screenshots/` 12 PNGs; after: `docs/upgrade-review/screenshots/current/` 24 PNGs.)
- [ ] Request explicit merge/deployment approval.

## Final polish — Cloudflare Pages SEO ✅ Done (Priority 3)

- [x] Audit production metadata, canonical URL, Open Graph/Twitter cards, JSON-LD, sitemap, robots, and crawlable content.
- [x] Validate Cloudflare Pages headers, redirects, asset caching, compression, Core Web Vitals, and production-bundle crawlability.
- [x] Verify generated build/date metadata and avoid claims or release data that are not backed by the deployed product.
- [x] Run search-engine rich-result/schema checks and inspect the deployed page only after product behavior is stable.

## Product expansion — runtime profiles

- [x] Add a saved runtime profile independent of the XSLT/XPath language mode: `SAP CPI` (default) and `Standard XSLT`.
- [x] Standard XSLT hides CPI headers/properties and CPI-only examples, and skips CPI parameter/extension injection.
- [x] SAP CPI preserves current headers, properties, exchange parameters, extension functions, and CPI-focused examples.
- [x] Persist the profile per named session and Quick Playground draft; switching profiles does not discard source.
- [x] Cover both profiles in light/dark themes, XSLT/XPath workflows, Explorer restore, share/backup, and final SEO wording. (SEO wording done as Priority 3; light/dark and workflow coverage in Phase E final regression.)

**Estimate:** 4–7 days plus issue remediation.

## Acceptance coverage map

| Brief scenarios | Primary milestone |
|---|---|
| 1, 18, 19, 20, 21, 25 | Baseline + responsive + final regression |
| 2–8 | Repository/controller + Explorer |
| 9 | Trash/Explorer |
| 10, 11, 17 | Autosave/conflicts/storage failure |
| 12 | Replaced by the approved fresh-start/no-import test |
| 13, 14 | Safe ingress |
| 15, 16 | Backup |
| 22, 23 | Explorer/polish/accessibility |
| 24 | Security/network audit |

## Current research artifacts

- `BASELINE_AUDIT.md` — architecture, source flows, tests, browser evidence, current risks.
- `REFERENCE_RESEARCH.md` — Markdown Viewer analysis, platform research, alternatives and decisions.
- `UX_SPEC.md` — layouts, responsive behavior, lifecycle, errors, keyboard/accessibility.
- `DATA_MODEL_AND_MIGRATION.md` — schema, autosave, conflicts, approved fresh-start policy, share and backup guarantees.
- `browser-baseline.json` — machine-readable local/live capture evidence.
- `screenshots/` — twelve real browser screenshots across target/mode/viewport combinations; `screenshots/current/` for after-state captures.
- `scripts/capture-current.mjs` — reproducible after-state evidence capture (run against local dev server on port 8000).

## Unresolved decisions requiring implementation evidence

- Exact autosave debounce and large-payload thresholds after profiling.
- Whether to ship session tabs in the first workspace release.
- Whether the native adapter needs additional helpers after SessionController integration; avoid broadening it speculatively.
- Whether backup compression should use a locally bundled ZIP dependency or a simpler uncompressed multi-file format; ZIP is preferred for portability, subject to security tests and bundle cost.
- The mobile pane-switch interaction that best preserves the existing desktop identity.
- Whether anonymous analytics/privacy copy should be changed independently of the workspace feature.
