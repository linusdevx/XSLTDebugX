# XSLTDebugX improvement backlog

This file is the handoff for future implementation work. The local-first workspace upgrade is complete; its design decisions and detailed acceptance checklist live in [`docs/upgrade-review/IMPLEMENTATION_CHECKLIST.md`](docs/upgrade-review/IMPLEMENTATION_CHECKLIST.md).

## Working rules

- Keep the app simple and browser-local. Do not add accounts, a backend, cloud storage, or automatic legacy migration without explicit approval.
- Preserve the CPI Helper raw-deflate `#share/` contract and the safe recipient flow.
- Keep `cpi` identifiers internally for compatibility. Prefer **Cloud Integration** in new user-facing labels where it remains clear.
- Avoid duplicating controls or introducing floating-window complexity.
- Add focused tests for changed behavior. Run the full E2E suite only at a final integration gate.
- Update this file when an item is completed, deferred, or materially changed.

## Priority 1 — existing product and workflow refinement ✅ Done

- ✅ Audit the complete XSLT, XPath, SAP CPI, and Standard XSLT workflows for unclear or redundant steps.
- ✅ Simplify the top bar, Help access, pane actions, and footer while keeping primary actions discoverable.
- ✅ Review every pane icon and action: copy, clear, upload, import, download, format, and collapse. Standardize labels, ordering, tooltips, and keyboard access.
- ✅ Review light and dark themes for contrast, editor chrome, overlays, menus, dialogs, badges, and disabled states.
- ✅ Review Explorer, save/reopen, share receive/send, backup/import, conflict recovery, Trash, and failure-state UX. Dynamic save indicator tooltip uses session name; retry routing fixed.
- ✅ Remove dead styles, duplicated paths, and stale compatibility code only when behavior is covered by a focused test. 57 lines of dead CSS removed.

## Priority 2 — responsive and accessibility completion ✅ Done

- ✅ Capture final XSLT/XPath snapshots in light/dark themes with Explorer open/closed at target desktop and phone sizes.
- ✅ Complete touch, keyboard, focus-order, screen-reader, and contrast smoke reviews. Skip link, console bar keyboard/ARIA, WCAG AA contrast fix (`--text-dim`).
- ✅ Keep the desktop/laptop recommendation on small touch devices without blocking quick mobile viewing or edits.
- ✅ Verify all dialogs trap and return focus, all icon-only buttons have accessible names, and live errors are announced. 9 dialogs return focus; 12 accessibility tests added.

## Priority 3 — Cloudflare Pages and SEO ✅ Done

- ✅ Audit canonical URL, title/description, Open Graph, Twitter cards, JSON-LD, sitemap, robots, and crawlable page content. "Cloud Integration" labels updated.
- ✅ Verify Cloudflare Pages redirects, headers, compression, caching, and Core Web Vitals. Cache headers added for sitemap.xml and robots.txt.
- ✅ Run rich-result/schema validation against the deployed build.
- ✅ Keep product, release, build-date, privacy, and telemetry claims backed by the deployed application. sitemap.xml, humans.txt, llms.txt all updated to 2026-11-12.

## Priority 4 — UI/UX polish: header, footer, Explorer sidebar ✅ Done

- ✅ Consolidated scattered controls: Clear moved to Session menu, Settings/About promoted to header icon buttons with tooltip shortcuts.
- ✅ Footer keeps LinkedIn personal branding, GitHub, version/About, and the "Not affiliated with SAP SE" trademark notice.
- ✅ About dialog enriched with version, build info, and LinkedIn attribution link.
- ✅ Explorer "+ New" dropdown replaced with 3 direct inline buttons: `+ XSLT` (blue), `+ XPath` (gold), folder icon — no menu-within-sidebar.
- ✅ Explorer row actions consolidated into a `···` overflow menu (position:fixed, flip-up when near bottom, arrow-key navigation).
- ✅ Explorer empty state replaced with a simple hint pointing to the create buttons.
- ✅ New mapping/query and Save as copy dialogs offer an optional folder location when folders exist.
- ✅ New XSLT mappings start with a compact runnable payload and XSLT 3 identity stylesheet instead of the large SalesOrder sample.
- ✅ Runtime profile selector, storage status, and Backup/Import moved from Explorer sidebar into Settings modal — Explorer now shows only the file list.
- ✅ Dead `refreshExplorerStorageStatus` function removed; `refreshWorkspaceSettingsStatus` in Settings covers it.
- ✅ `workspace-storage-blocked` now shows a persistent error toast so users see it whether or not Settings is open.
- ✅ Header dividers added between icon groups for visual clarity.
- ✅ View switcher active state uses semi-transparent fill; toolbar dividers use color-mix() for theme-adaptive opacity.
- ✅ Dead CSS removed: `.explorer-create-row`, `.explorer-save-as`, `.explorer-workspace-label`, `.explorer-runtime-profile`, `.explorer-storage-status`, `.explorer-backup-actions` (80+ lines total).
- ✅ Ctrl+B shortcut added to toggle Explorer (VS Code convention), with Monaco focus guard; `Ctrl+Shift+E` kept as alias.
- ✅ Ctrl+, shortcut wired to open Settings; documented in Help modal Shortcuts tab.
- ✅ Help modal "Clear content" entry updated to say it's in the Session menu.
- ✅ Session menu kept focused on New, Save/Duplicate, and Clear; Backup/Import remain in Settings.
- ✅ Help modal Explorer and Runtime rows updated to match new 3-button layout and Settings location.
- ✅ `aria-keyshortcuts` attributes added to Explorer toggle, Settings, and Help header buttons.
- ✅ Ctrl+/ shortcut added to open Help modal (guarded against Monaco editor focus).
- ✅ Toast notification upgraded to multi-tone `showToast()` with Lucide icons, deduplication, and stacking limit; `showCopyToast()` is a compatibility wrapper.

## Priority 5 — Test coverage ✅ Done

- ✅ 13 accessibility tests added (skip link, console bar keyboard/ARIA, 4 dialog focus return tests, 2 save indicator tooltip tests, toast role, Explorer create buttons, Run button label, Ctrl+B Explorer toggle).
- ✅ All workspace-explorer tests updated for new direct-button create flow.
- ✅ `clearSession()` POM helper fixed — now uses Session menu (`#sessionMenuTrigger` + "Clear current content") instead of stale `#clearSessionBtn`.
- ✅ `runtime-profile.spec.js` and `safe-ingress.spec.js` updated to interact with `#settingsRuntimeProfile` via Settings modal instead of removed `#runtimeProfileSelect` sidebar element.
- ✅ 14th accessibility test added: example card keyboard navigation (role=button, tabindex=0, aria-label, Enter key activates and closes modal).
- ✅ Examples now run immediately when selected; the redundant Auto-run preference and its stale helper/test coverage were removed.
- ✅ Editor `Copy XPath — Exact/General` actions are copy-only in both modes and no longer replace or execute the active XPath query.
- ✅ Global dialogs now layer above the narrow-screen Explorer drawer; About, Help, Settings, Share, and Examples remain usable while Explorer is open.
- ✅ About feedback now links directly to GitHub's new-issue form.
- ✅ Settings explains that workspace data is saved automatically on-device; the confusing persistent-storage request and browser-management jargon were removed.

## Priority 7 — Accessibility pass: keyboard on interactive divs ✅ Done

- ✅ KV panel accordion headers (`hdrPanel`, `propPanel`, `outHdrPanel`, `outPropPanel`) in `index.html`: added `role="button"`, `tabindex="0"`, `aria-controls`, `onkeydown` Enter/Space handler.
- ✅ Collapsed column tabs (`col-tab` left and right) in `index.html`: added `role="button"`, `tabindex="0"`, `aria-label="Expand input/output panel"`, `onkeydown` handler.
- ✅ Example cards in examples modal (`modal.js`): added `role="button"`, `tabindex="0"`, `aria-label` (name + description), `onkeydown` Enter/Space handler — previously click-only.
- ✅ Example card focus styles added to `css/style.css`: `:focus-visible` rule with outline, border, and `::before` accent reveal to match hover state.
- ✅ `pane-bar-clickable` divs audited — already contain explicit `<button class="collapse-btn">` children with keyboard access; div-level onclick is secondary convenience target, no augmentation needed.

## Priority 6 — Architecture and developer docs ✅ Done

- ✅ `ARCHITECTURE.md`: updated high-level diagram (19 JS modules + IndexedDB tier), Module Overview table (all 19 modules), Module Dependency Graph (19-module chain), Session Persistence Flow (IndexedDB model), Global State section (added `sessionController`, `workspaceStore`, `runtimeProfile`), Loading Order section (all 19 scripts), Storage Versioning constraint.
- ✅ `TESTING.md`: added 4 new spec file entries (workspace-explorer, runtime-profile, safe-ingress, accessibility), updated `clearSession()` POM note, updated `getStoredSession()` note, updated Current Status section to 14 spec files.
- ✅ `DEVELOPMENT.md`: replaced localStorage-only storage description with IndexedDB + localStorage dual model, updated Inspecting State console commands (added `workspaceStore`, `sessionController`, `runtimeProfile`), updated Storage Tab section to show IndexedDB + localStorage, updated Useful DevTools Console Commands, updated "Storage won't restore" troubleshooting, updated localStorage issue section to describe IndexedDB-based persistence.

## Priority 8 — Code quality and UX fixes (survey 2026-11-13)

### Bugs

- ✅ **`runTransform` resets `btn.onclick` to itself after every run** — fixed; delegates to `modeManager.updateRunButton()`.
- ✅ **`Ctrl+S` on named sessions calls `saveQuickDrafts()` instead of `flushPendingSave()`** — fixed.

### UX improvements

- ✅ **Download filenames ignore session title** — `_sessionDownloadName()` helper derives slug from session title.
- ✅ **`downloadPane` logs hardcoded name, not actual filename** — logs resolved filename.
- ✅ **`formatFileSize` always shows KB** — now returns "N B / N KB / N MB" with unit.
- ✅ **`downloadWorkspaceBackup` log uses hardcoded `/ 1024` KB** (`js/backup.js`) — fixed to use `formatFileSize()`.
- ✅ **Dead `_quickTitle()` call in `_sessionDownloadName`** (`js/files.js`) — removed non-existent method reference.

### Consistency

- ✅ **XPath history still in localStorage** — moved to `workspaceStore` (IndexedDB); clears with workspace reset.
- ✅ **KV delete buttons have no `aria-label` or `title`** — added to generated markup in `renderKV`.
- ✅ **`sessionMenuTrigger` has no `aria-label`** (`index.html`) — added `aria-label="Current session actions"`.

## Priority 9 — Code quality and UX fixes (survey 2026-11-13 batch 2)

### Bugs

- ✅ **`openShareModal` missing `modal-open` on `<body>`** (`js/share.js`) — added; background scroll now locked while share dialog is open.
- ✅ **`openHelpModal` missing `modal-open` on `<body>`** (`js/ui.js`) — added; matches every other modal.
- ✅ **`clearXPathInput` doesn't reset `_xpathHistoryCursor`** (`js/xpath.js`) — cursor reset to -1 at the top of the function.

### Consistency

- ✅ **`refreshWorkspaceSettingsStatus` uses inline `/ 1024 / 1024`** (`js/explorer.js:219`) — replaced with `formatFileSize`.
- ✅ **`_xpathHistoryNavigate` calls `scheduleSave()`** (`js/xpath.js:122`) — removed; browsing history is read-only and must not trigger a save cycle.

## Priority 10 — Code quality fixes (survey 2026-11-13 batch 3)

### Bugs / Consistency

- ✅ **`copyPane` shows size as `"2.5KB"` (no space, char count not byte count)** (`js/panes.js:71`) — replaced with `formatFileSize(new Blob([v]).size)` for correct bytes + unit.
- ✅ **`fmtEditor` sets `_suppress.validation = true` directly** (`js/panes.js:194`) — replaced with `_withSuppress(['validation'], ...)` so exceptions can't leave suppress stuck at `true`.
- ✅ **`_ensureCpiNamespace` sets `_suppress.validation = true` directly** (`js/editor.js:456`) — same fix as fmtEditor.

## Priority 11 — Code quality fixes (survey 2026-11-13 batch 4)

### Bugs / Consistency

- ✅ **`navigator.platform` deprecated in `ui.js:245`** — replaced with `navigator.userAgent.includes('Mac')` (same check already used in `transform.js:3`).
- ✅ **`startConsoleResize` `onUp` calls `scheduleSave()` spuriously** (`js/ui.js:173`) — console height is persisted directly to IndexedDB on the line above; the `scheduleSave()` triggered a full session save unnecessarily.

## Priority 12 — Code quality fixes (survey 2026-11-13 batch 5)

### Consistency

- ✅ **`closeWorkspaceSettings` returns focus synchronously without `requestAnimationFrame` or `isConnected` guard** (`js/explorer.js:206`) — all 9 other modals use `requestAnimationFrame(() => returnFocus?.isConnected && returnFocus.focus())`; Settings was the only outlier and could call `.focus()` on a detached element.

## Priority 13 — Code quality fixes (survey 2026-11-13 batch 6)

### Bugs / Consistency

- ✅ **`_resetXsltMode` suppresses only `save`, not `validation`** (`js/state.js:264`) — after `setValue` for XML and XSLT models, the `onDidChangeModelContent` handler fires and schedules an 800 ms validation debounce on the just-reset default content. Added `'validation'` to the `_withSuppress` flags so the debounce is suppressed.
- ✅ **`_resetXPathMode` suppresses only `save`, not `validation`** (`js/state.js:238`) — same issue; `xmlModelXpath.setValue` triggers the XML validation debounce. Fixed to suppress `'validation'` as well.
- ✅ **`clearXPathInput` calls `scheduleSave()` spuriously** (`js/xpath.js:687`) — XPath input is a plain textarea, not persisted independently; only the last *run* expression is saved. Clearing the input box doesn't change any session data, so `scheduleSave()` is a no-op save cycle. Removed.

## Priority 14 — Code quality fixes (survey 2026-11-13 batch 7)

### Dead code / Consistency

- ✅ **`showSavedIndicator()` is dead code** (`js/state.js`) — defined as a one-liner wrapper around `setSaveIndicator('saved')` but never called anywhere in the codebase. Removed.
- ✅ **`reinitIcons(_btn)` is redundant in `_resetXPathBtn`** (`js/xpath.js:452`) — `modeManager.updateRunButton()` already calls `reinitIcons(runBtn)` at the end; the extra call in the XPath run reset was a no-op double init.
- ✅ **`_xpathHistoryCursor = -1` in `clearSavedState` has no guard** (`js/state.js:297`) — `_xpathHistory.length = 0` on the line above is guarded with `typeof !== 'undefined'` (because `_xpathHistory` is declared in `xpath.js` which loads later), but `_xpathHistoryCursor = -1` was unguarded, which would create a stray global if `clearSavedState` were called before `xpath.js` loaded. Added matching guard.
- ✅ **`openHelpModal` does not move focus into the dialog** (`js/ui.js`) — every other modal opens with an explicit `requestAnimationFrame(() => el?.focus())` call; Help was the only one that left focus outside the dialog. Added focus to `.ex-modal-close` on open.

## Deferred ideas — validate before building

- Draggable pane reordering: pursue only if usability feedback shows clear value; retain Input → Transform → Output as the default and provide keyboard/reset behavior.
- Runnable-session tabs: add only if Explorer testing shows repeated switching friction; do not duplicate the Explorer or reduce editor space unnecessarily.
- Replace Workspace import: requires explicit approval, rollback design, and destructive-flow testing. Merge-as-copy remains the safe default.
- Linked project files/includes, encryption, collaboration, and cloud synchronization remain out of scope.
- UI terminology cleanup: keep internal `cpi` compatibility identifiers, but gradually use **Cloud Integration** or **Runtime** in user-facing copy where that is clearer.
- Standard XSLT positioning: validate that the Standard runtime profile, simplified Input → XSLT → Output workflow, examples, and SEO copy are understandable to users outside SAP Cloud Integration before expanding it further.
- Toolbar and pane-action simplification: revisit only after usage feedback; prefer removing duplicate actions over adding more menus or icons.

## Follow-up verification

- [ ] In the deployed build, smoke-test Move to Trash, restore, empty Trash, and permanent delete with disposable sessions.
- [ ] Review the compact footer branding in production at desktop and constrained widths.
- [ ] Recheck the first-visit starter in a fresh browser profile; existing users correctly continue seeing their saved session instead.
- [ ] Recheck Explorer overflow menus, toasts, and folder buttons in both themes after deployment.
- [ ] Smoke-test one XSLT and one XPath example to confirm selection closes the library and executes immediately without an Auto-run setting.
- [ ] In XPath mode, right-click XML and verify both Copy XPath actions only copy the path and do not alter or execute the current query.
- [ ] With Explorer open at constrained width, open About, Help, Settings, Share, and Examples and confirm each dialog is above the drawer and returns focus correctly.
- [ ] Confirm the About feedback link opens the upstream repository's pre-filled new-issue page in a separate tab.
- [ ] Validate the CPI Helper Chrome extension data-transfer/share contract against the deployed build before the final release.
- [ ] Perform a final light/dark theme and responsive-layout visual pass after Cloudflare Pages deploys the release candidate.

## Final gate for any improvement batch — complete

- ✅ Production build succeeds (`npm run build` clean, 8.7s).
- ✅ Focused tests for changed behavior pass (runtime-profile × 2, safe-ingress × 5, accessibility × 14 confirmed passing — 13 original + 1 new example card keyboard test).
- ✅ `git diff --check` is clean (only line-ending warning on humans.txt, not whitespace errors).
- ✅ Latest upstream CI regression: 175/175 passed with 4 workers.
- ✅ No source content is uploaded unexpectedly.
- ✅ Workspace PR #89 merged into `dev`; production deployment / `dev` → `main` remains an explicit release decision.
