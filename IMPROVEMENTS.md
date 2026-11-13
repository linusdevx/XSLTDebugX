# XSLTDebugX improvement backlog

This file is the handoff for future implementation work. The local-first workspace upgrade is complete; its design decisions and detailed acceptance checklist live in [`docs/upgrade-review/IMPLEMENTATION_CHECKLIST.md`](docs/upgrade-review/IMPLEMENTATION_CHECKLIST.md).

## Working rules

- Keep the app simple and browser-local. Do not add accounts, a backend, cloud storage, or automatic legacy migration without explicit approval.
- Preserve the CPI Helper raw-deflate `#share/` contract and the safe recipient flow.
- Keep `cpi` identifiers internally for compatibility. Prefer **Cloud Integration** in new user-facing labels where it remains clear.
- Avoid duplicating controls or introducing floating-window complexity.
- Add focused tests for changed behavior. Run the full E2E suite only at a final integration gate.
- Update this file when an item is completed, deferred, or materially changed.
- **Do NOT invest further effort in screen-reader / ARIA accessibility work** — this has diminishing returns for this developer tool's audience. Focus on bugs, consistency, and performance.

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

## Priority 15 — Code quality fixes (survey 2026-11-13 batch 8)

### Redundant code

- ✅ **`_xpathHistoryCursor = -1` at `js/xpath.js:432` is redundant** — `_xpathHistoryPush()` already resets the cursor to -1 at line 90; the explicit reset on line 432 immediately after the push call was a no-op. Removed.

## Priority 16 — Accessibility and consistency fixes (survey 2026-11-13 batch 9)

### Bugs / Consistency

- ✅ **`outDownloadBtn` `aria-label` not updated when output language changes** (`js/transform.js`, `js/state.js`) — `title` was updated dynamically after each transform run (to reflect XML/JSON/TEXT), but `aria-label` stayed at the static "Download output as XML" set in `index.html`. Fixed: both `_resetOutputPane` and the post-transform label update now set `aria-label` to match `title`.
- ✅ **`runBtn` `aria-label="Run transform"` never changes with mode** (`js/mode-manager.js`) — `aria-label` takes precedence over button text for the accessible name, so screen readers announced "Run transform" even in XPath mode. `updateRunButton()` now sets `aria-label="Run XPath"` or `aria-label="Run XSLT transform"` on each mode switch.
- ✅ **`applyShareData` suppresses only `save` (not `validation`) for XML setValue** (`js/share.js:152`) — all other programmatic `setValue` calls on XML models use `['save', 'validation']` (in `session-controller.js`, `state.js`, `modal.js`, `files.js`); the share XML load was the only outlier and triggered a spurious 800 ms XML validation debounce immediately after loading foreign content. Fixed to match the pattern.

## Priority 17 — Consistency fixes (survey 2026-11-13 batch 10)

### Consistency

- ✅ **Backup import dialog opens without auto-focusing** (`js/backup.js`) — `prepareWorkspaceBackupImport` opens `backupImportBackdrop` without calling `requestAnimationFrame(...focus())`. On validation success, focus now moves to the Import button; on validation failure, focus moves to the close button. Matches every other dialog in the codebase.

## Priority 18 — Accessibility fixes (survey 2026-11-13 batch 11)

### Bugs / Consistency

- ✅ **KV panel accordion headers missing `aria-expanded`** (`index.html`, `js/transform.js`) — All four KV panel headers (`hdrPanel`, `propPanel`, `outHdrPanel`, `outPropPanel`) had `role="button"` but no `aria-expanded` attribute, so screen readers could not announce the expanded/collapsed state. Added `aria-expanded="true"` to all four headers in HTML (panels start expanded). `toggleKVPanel()` now reads the post-toggle collapsed state and sets `aria-expanded` accordingly on each call.

## Priority 19 — Code quality fixes (survey 2026-11-13 batch 12)

### Bugs / Consistency

- ✅ **`clearPane('xml')` fires two spurious save cycles and two validation debounces** (`js/panes.js:38-39`) — `xmlModelXslt.setValue('')` and `xmlModelXpath.setValue('')` each fire `onDidChangeModelContent` which calls `scheduleSave()` and queues an 800ms validation debounce, before the explicit `scheduleSave()` at the end of the function. Wrapped both in `_withSuppress(['save', 'validation'], ...)` so the single explicit call is the sole save trigger and no-op empty-content validation is suppressed.
- ✅ **`clearPane('xslt')` fires a spurious validation debounce** (`js/panes.js:53`) — `ed.setValue('')` fires `onDidChangeModelContent` → 800ms XSLT validation debounce on empty content. Wrapped in `_withSuppress(['validation'], ...)` to suppress the debounce; the explicit `scheduleSave()` below remains the save trigger.
- ✅ **`clearPane('out')` calls `scheduleSave()` spuriously** (`js/panes.js:66`) — output pane content is never saved to a session (not in `serializeDrafts()`), so clearing it triggered a full session save for nothing. `scheduleSave()` now only fires when `which !== 'out'`.

## Priority 20 — Code quality fixes (survey 2026-11-13 batch 13)

### Cosmetic / Consistency

- ✅ **`const restore` in `_extractInsensitiveRegions` has wrong indentation** (`js/transform.js:63`) — `const restore` was indented 4 spaces (callback level) but is at function-body scope and should be 2 spaces. No behaviour change.

## Priority 21 — Code quality fixes (survey 2026-11-13 batch 14)

### Consistency

- ✅ **`backupImportSummary` set without null guard in success path** (`js/backup.js:261`) — the error path (line 267) uses `const summary = ...; if (summary)` but the success path called `.textContent` directly. Fixed to use the same guarded pattern.
- ✅ **`backupImportConfirmBtn.disabled` unguarded in both paths** (`js/backup.js:271,275`) — `.disabled` was set directly without optional chaining, inconsistent with every other element access in the same function. Fixed to use `?.toggleAttribute('disabled', bool)`.
- ✅ **`mode-manager.js` uses `console.error`/`console.warn` after full app init** (`js/mode-manager.js:19,45,50`) — `setMode()` fires well after `clog` and `logError` are available. Invalid mode error now uses `clog(..., 'error')`, mode persist failure and mode switch error use `logError(context, err)` (which also calls `console.warn` for DevTools). Errors now appear in the in-app console.
- ✅ **`window.goatcounter?.count` in `runTransform` has wrong indentation** (`js/transform.js:427`) — the GoatCounter analytics call was indented 2 spaces (function-body level) but sits inside the `try` block which uses 4-space indentation. No behaviour change.

## Priority 22 — Code quality fixes (survey 2026-11-13 batch 15)

### Consistency

- ✅ **`beginTemporary` silently swallows `setSetting` failure** (`js/session-controller.js:259`) — `setSetting('activeSession:type', null)` used `.catch(() => {})`, so if the IndexedDB write fails the active-session pointer stays stale and the wrong session restores on next page load. Changed to `.catch(error => logError(...))` so the failure appears in the in-app console.
- ✅ **`activateNamedSession` silently swallows `setSetting` failure** (`js/session-controller.js:273`) — same pattern; newly-activated session ID would not persist across reload. Same fix.
- ✅ **`handleRemoteTrash` silently swallows `setSetting` failure** (`js/session-controller.js:362`) — same pattern after a session is trashed in another tab. Same fix.

## Priority 23 — Code quality fixes (survey 2026-11-13 batch 16)

### Consistency

- ✅ **`toggleSideCol` calls `scheduleSave()` spuriously** (`js/ui.js:95`) — column collapsed state is CSS-only and not part of the saved session (not in `serializeDrafts()`). Collapsing the output column triggered a full session save for nothing. Removed the `scheduleSave()` call.

## Priority 24 — Code quality fixes (survey 2026-11-13 batch 17)

### Consistency

- ✅ **`_xpathHistoryPush` silently swallows `setSetting` failure** (`js/xpath.js:91`) — `workspaceStore.setSetting('xpathHistory', ...)` used `.catch(() => {})`, so a failed IndexedDB write silently loses the history entry; on next reload the history will be incomplete. Changed to `.catch(error => logError(...))` to surface the failure in the in-app console.
- ✅ **`setRuntimeProfile` silently swallows `saveQuickDrafts` failure in XPath mode** (`js/runtime-profile.js:24`) — when switching runtime profile while in XPath mode, `saveQuickDrafts` failure was silently swallowed; the profile change would not persist. Changed to `.catch(error => logError(...))`.

## Priority 25 — Code quality fixes (survey 2026-11-13 batch 18)

### Consistency

- ✅ **`openShareModal` does not move focus into the dialog** (`js/share.js`) — every other modal uses `requestAnimationFrame(() => el?.focus())` on open; Share was the only outlier. Added focus to `#shareCopyBtn` (the primary action) on open.
- ✅ **`executeEdits` in XML/XSLT context menu actions has no try/catch** (`js/editor.js:321,337,398,411`) — Format XML, Minify XML, Format XSLT, and Minify XSLT ran `ed.executeEdits(...)` without error handling; a thrown exception would be silently lost. Wrapped each in `try/catch` with `logError(...)`.

## Priority 26 — Critical bug + quality fix (survey 2026-11-13 batch 19)

### Critical bugs

- ✅ **`activateNamedSession` was accidentally merged into `beginTemporary`** (`js/session-controller.js:260-272`) — commit `4d6eeac` introduced this regression: the closing `}` of `beginTemporary` and the opening `activateNamedSession(record)` declaration were deleted, so the entire body of `activateNamedSession` ran as dead code after the `setSetting` fire-and-forget in `beginTemporary`. This caused `activateNamedSession()` to throw `ReferenceError: record is not defined` at line 260. Every path that activates a named session (Save as copy, duplicate, rename, incoming share, conflict copy) was broken. Restored the function boundary.

### Consistency

- ✅ **`Ctrl+S` shortcut silently swallows `flushPendingSave` failure** (`js/explorer.js:896`) — the user explicitly pressed the save shortcut but a flush failure was silently swallowed. Changed to `.catch(error => logError('Could not save (Ctrl+S)', error))` so the failure surfaces in the in-app console.

## Priority 27 — Spurious scheduleSave calls (survey 2026-11-13 batch 20)

### Consistency

- ✅ **`setWorkspaceView` calls `scheduleSave()` spuriously** (`js/ui.js:347`) — workspace view (which columns are collapsed) is CSS-only layout state, not part of `serializeDrafts()`. Toggling between Edit/Output/All views triggered a full session save for nothing. Removed `scheduleSave()` and added `restorePaneLayout()` to reapply saved pane ratios on view change (consistent with `toggleSideCol`).
- ✅ **`runTransform` calls `scheduleSave()` when auto-expanding colRight** (`js/transform.js:558`) — when XSLT output arrives and the output column is collapsed, it auto-expands; the expand triggered a spurious `scheduleSave()`. Column collapsed state is CSS-only; removed.

## Priority 28 — Silent catch and focus-return fixes (survey 2026-11-13 batch 21)

### Consistency

- ✅ **`saveState()` swallows auto-save failure silently** (`js/state.js:208`) — the debounced session save used `.catch(() => {})`, so IndexedDB failures were completely invisible. Changed to `.catch(error => logError('Auto-save failed', error))`.
- ✅ **`handleSaveIndicatorAction` manual retry swallows failure** (`js/state.js:365`) — user explicitly clicked the failed-save indicator to retry; failure was still silent. Changed to `.catch(error => logError('Manual save retry failed', error))`.
- ✅ **`clearSavedState()` swallows XPath history clear failure** (`js/state.js:299`) — `setSetting('xpathHistory', [])` used `.catch(() => {})`; if it failed, history reappeared on reload. Changed to `.catch(error => logError(...))`.
- ✅ **`pagehide`/`visibilitychange` flush swallows failure** (`js/state.js:227,229`) — last-ditch save before tab close was silent. Changed to `console.warn` (can't use `clog` at `pagehide` time as DOM may be gone).
- ✅ **`flushPendingSave` in `setMode()` swallows failure** (`js/mode-manager.js:29`) — mode switch flushed the outgoing mode's draft but a failure was silent; content could be lost. Changed to `.catch(error => logError('Could not flush before mode switch', error))`.
- ✅ **`closeBackupImportDialog()` never restores focus** (`js/backup.js:280`) — opened by file input, closed by user action, but focus dropped to body. Added `_backupImportReturnFocus` captured at open time; `closeBackupImportDialog` now restores it via `requestAnimationFrame` with `isConnected` guard.
- ✅ **`closeIncomingShareDialog()` never restores focus** (`js/share.js:191`) — dialog opens from URL hash on page load (no trigger element). Added `requestAnimationFrame(() => document.getElementById('runBtn')?.focus())` fallback so focus lands on the primary action instead of body.

## Priority 29 — Stale aria-label and silent catch (survey 2026-11-13 batch 22)

### Bugs / Consistency

- ✅ **`runBtn` initial `aria-label="Run transform"` is stale** (`index.html`) — Priority 16 updated `updateRunButton()` to set `aria-label="Run XSLT transform"` (or `"Run XPath"` in XPath mode), but the static HTML still had the old value `"Run transform"`. The initial value is now consistent with what JS sets; no brief incorrect accessible name before Monaco initializes.
- ✅ **Accessibility test expects stale `"Run transform"`** (`tests/e2e/workflows/accessibility.spec.js:161`) — test was written before Priority 16 changed the label to `"Run XSLT transform"`; updated to match the current value.
- ✅ **`clearSavedState` draft-clear catch only sets indicator, not console** (`js/state.js:308`) — if `clearCurrentDraft()` threw, `setSaveIndicator('failed', error)` updated the visual indicator but the error was never logged to the in-app console. Now calls `logError(...)` first so it appears in clog/DevTools, then sets the indicator.

## Priority 30 — Example loading preserves user column layout (2026-11-13)

### UX fix

- ✅ **Loading an XSLT example forces the output column closed, then transform re-opens it** (`js/modal.js:285-289`) — `loadExample()` unconditionally collapsed `colRight` before calling `runTransform()` 350ms later. Since `runTransform` auto-expands `colRight` when output arrives, the user saw a jarring close→open flash on every example load. Removed the forced collapse entirely; if `colRight` is already open the content updates in place, if already closed `runTransform` opens it when output is ready.
- ✅ **Loading an XPath example forces the output column open** (`js/modal.js:273-275`) — `loadExample()` also unconditionally un-collapsed `colRight` before calling `runXPath()` 350ms later. `runXPath` already auto-expands `colRight` at line 406-409 in `xpath.js`, making the force-open redundant. Removed; the layout call that followed it was also removed (it fired before the example content was set).

## Priority 31 — Remaining focus-return gap (2026-11-13)

### Consistency

- ✅ **`closeInvalidShareDialog` does not restore focus** (`js/share.js:95`) — the "corrupt/unsupported share link" dialog opens from a URL hash at page load (no trigger element to return to). Unlike `closeIncomingShareDialog` which was fixed in Priority 28, this sibling dialog had no focus return at all — focus dropped to body on close. Added `requestAnimationFrame(() => document.getElementById('runBtn')?.focus())` matching the incoming-share pattern.

## Priority 32 — Settings dialog robustness (survey 2026-11-13 batch 23)

### Consistency

- ✅ **`openWorkspaceSettings` `getSetting` call is uncaught** (`js/explorer.js:199`) — `workspaceStore.getSetting('explorerOpen', true)` was not given a `.catch()`. If IndexedDB is unavailable, the entire async function throws: the Settings modal never opens and the user sees a generic "Action failed" toast with no useful context. Added `.catch(() => true)` to default to the same value used at DOMContentLoaded, matching the established pattern for UI-preference reads.
- ✅ **`setExplorerStartupPreference` blocks toggle on save failure** (`js/explorer.js:238`) — `toggleExplorer` was called only after `await workspaceStore.setSetting(...)`. If the IndexedDB write fails, the Explorer toggle never fires — the checkbox state changes but the sidebar stays as-is. Reordered to call `toggleExplorer(Boolean(open))` first (always fires), then persist asynchronously with `.catch(error => logError(...))` so a failed save surfaces in the in-app console but does not prevent the UI update.

 pursue only if usability feedback shows clear value; retain Input → Transform → Output as the default and provide keyboard/reset behavior.
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
