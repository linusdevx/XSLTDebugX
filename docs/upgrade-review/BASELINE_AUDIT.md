# XSLTDebugX baseline audit

**Audit date:** 2026-11-11
**Branch:** `research/workspace-upgrade-phase1`
**Reviewed commit:** `ba98e9bf1fa10515feb638e405a19886d3c76a69` (`chore(deps-dev): bump source-map-js (#83)`)
**Live build observed:** `2026-11-03 (ba98e9b)`
**App version:** `1.0.0` in `package.json`

## Executive baseline

XSLTDebugX is a static, framework-free browser application. Thirteen ordered global scripts are served directly during development and minified/concatenated by the custom Vite build. Saxon-JS is local; Monaco, pako, Lucide, fonts, GoatCounter, and (on production) Cloudflare Web Analytics are remote. There is no application backend.

The existing editor architecture already has the most important isolation primitive: separate Monaco XML models for XSLT and XPath. The storage architecture does not. It serializes both mode drafts, the one XSLT stylesheet, CPI input rows, layout, and the active mode into one `localStorage` object. It cannot represent more than one named mapping or query.

The existing automated baseline is healthy after installing the repository-pinned Playwright browser:

| Command | Result |
|---|---|
| `npm ci` | Success; 68 packages installed |
| `npm run build` | Success; CSS 57.17 kB / 10.72 kB gzip plus generated JS bundle |
| `npm run test:e2e` | **98 passed** in 5.8 minutes, Chromium |
| `npm audit --omit=optional` | 3 development-tool findings: 1 moderate, 2 high |

The first test attempt was invalid because the Playwright browser executable was absent. It produced 97 launch failures and one non-browser summary test. After `npx playwright install chromium`, the unchanged source passed all 98 tests. This distinction matters: those were environment failures, not pre-existing product failures.

## Runtime and build architecture

- `index.html` owns the DOM, inline event bindings, CDN scripts, and strict script order.
- `vite.config.js:34-49` duplicates that script order in `JS_MODULES`; `vite.config.js:68-171` minifies each source independently, concatenates the results, writes a content-hashed bundle, copies static assets, and rewrites `index.html`.
- `js/state.js` owns shared globals, save/load, console, and status.
- `js/mode-manager.js` owns XSLT/XPath mode switching, panel visibility, model swapping, and mode-specific center-column state.
- `js/editor.js` creates Monaco models/editors, restores state, wires change listeners, and applies pending share data after Saxon-JS becomes ready.
- `js/transform.js` validates and executes XSLT, rewrites supported CPI calls, builds stylesheet parameters from input headers/properties, and renders derived output state.
- `js/xpath.js` evaluates XPath, maintains expression history, renders matches, and decorates matched XML ranges.
- `js/share.js`, `js/files.js`, and `js/modal.js` directly replace current editor state for share URLs, files, and examples.

The application intentionally relies on globals and inline `onclick` handlers. A workspace implementation should therefore be additive and globally exposed at its narrow integration points; a framework rewrite is not justified.

## Exact persistence behavior today

### Keys

Observed and confirmed in source:

| Key | Owner | Contents |
|---|---|---|
| `xdebugx-session-v1` | `js/state.js:159-209` | XSLT XML, XPath XML, XSLT, input headers/properties, column collapse state, console height, XPath expression, active mode, last example key, timestamp |
| `xdebugx-xpath-history` | `js/xpath.js:74-96` | Most-recent-first XPath expressions, maximum 20 |
| `xdebugx-theme` | `js/ui.js:191-196` and startup markup | `light` or `dark` |
| `xdebugx-auto-run-examples` | `js/modal.js` | Boolean preference |
| `xdebugx-mobile-notice-dismissed` | `js/ui.js:228-245` | Mobile banner dismissal |

The browser capture found only the session/history keys created by the exercised workflow. No IndexedDB databases are created by the current app.

### Save semantics

`scheduleSave()` debounces for 800 ms (`js/state.js:171-175`). `saveState()` reads both XML models, the single XSLT editor, CPI input rows, layout, XPath expression, mode, example key, and timestamp (`js/state.js:177-194`). Derived transform output, output headers/properties, console contents, XPath match results, selections, cursor position, and undo stacks are not serialized.

The save indicator appears only after `localStorage.setItem()` returns (`js/state.js:194-195`), which is directionally correct. However, all storage exceptions are silently swallowed (`js/state.js:196-198`), leaving no failed/full/disabled state or recovery path.

### Mode switching and editor models

`js/editor.js:58-66` creates two long-lived XML models. `ModeManager.setup()` swaps the shared XML editor to the target model and suppresses the synthetic change event (`js/mode-manager.js:74-88`). XSLT text and CPI rows are XSLT-only globals; the XPath expression is a DOM field. Switching mode clears XPath results/highlights but preserves both XML models and the XSLT editor. Tests cover rapid switching, model isolation, XSLT preservation, and mode persistence.

The current two-model strategy should be retained. Saved-session support should add a model cache/controller above it, with explicit disposal on tab eviction or session close; it should not create an unbounded Monaco model per Explorer item.

## Input-to-result data flow

### XSLT

1. Monaco changes call `scheduleSave()` and schedule validation (`js/editor.js:721-742`).
2. `runTransform()` reads current XML/XSLT and runs preflight validation.
3. CPI calls are validated and rewritten to Saxon-JS global JavaScript extension calls.
4. `buildParamsXPath()` combines headers then properties. Properties win duplicate names; invalid NCNames are skipped with warnings (`js/transform.js:163-200`).
5. Saxon-JS executes the transform. Captured `cpi:setHeader`/`cpi:setProperty` values are rendered into read-only output panels.
6. Output editor, output headers/properties, console messages, and timing are derived and not canonical saved input.

No other user-editable CPI configuration exists today. `$exchange` is injected as a dummy parameter. The reproducible XSLT source boundary is therefore XML + stylesheet + ordered header/property rows, including blank values and duplicate ordering, plus any future run options if introduced.

### XPath

1. The expression is read from `#xpathInput`; XML comes from the XPath XML Monaco model.
2. XML is parsed with Saxon-JS and XPath is evaluated with a fixed namespace context (`js/xpath.js:452-460`).
3. The expression is pushed to global history and matches are normalized, rendered, and highlighted.

There is no user-editable XPath namespace map today. The initial saved query shape only needs XML and expression. Namespace/evaluator options should be versionable optional fields, not invented UI.

## Destructive and replacement behaviors

| Action | Current behavior | Workspace risk |
|---|---|---|
| Open share URL | Share hash is parsed before restore; saved session restore is skipped; shared XSLT/XML/CPI rows are applied and autosaved (`js/editor.js:55-56,789-793`; `js/share.js:52-94`) | **Silently replaces the XSLT draft and persists it.** Must become temporary preview/import-copy flow. |
| Load example | Switches mode, replaces that mode's XML, XSLT when relevant, clears XSLT CPI rows, then autosaves (`js/modal.js:187-277`) | Would overwrite a named item unless detached to a draft or explicitly confirmed. |
| Upload/drop | Replaces the current mode model/pane and autosaves (`js/files.js:8-30,51-75`) | Would overwrite a named item. Import should default to a temporary draft or explicit replacement. |
| Clear | Removes the combined session and XPath history, then resets only the active mode (`js/state.js:274-290`) | Other in-memory mode can disappear if the page closes before another save. Named-session clear must clear content, never delete the record implicitly. |
| Close tab (future) | Not present | Must not delete a saved item. |

## Browser and responsive audit

Automated real-browser captures exercised the unchanged local and deployed builds in XSLT and XPath modes at three viewport sizes. Evidence is in `browser-baseline.json` and `screenshots/`.

Representative images:

- [Local XSLT, 1920×1080](screenshots/local-xslt-1920x1080.png)
- [Local XPath, 1366×768](screenshots/local-xpath-1366x768.png)
- [Local XSLT, 390×844](screenshots/local-xslt-390x844.png)
- [Live XSLT, 1920×1080](screenshots/live-xslt-1920x1080.png)
- [Live XPath, 390×844](screenshots/live-xpath-390x844.png)

Findings:

- XSLT desktop preserves the strong three-column identity. XPath uses query/XML on the left, results on the right, and console below.
- Both local and live runs completed without page errors or console errors in the capture.
- At 1920 CSS pixels the document measured 2208 pixels wide; at 1366 it measured 1571. At 390 it measured 1155 locally and 1221 live. The narrow screenshot exposes only the right end of the toolbar and blank workspace. Existing responsive behavior is therefore a baseline defect, not something the Explorer may worsen.
- The Explorer must be an overlay/drawer below the desktop breakpoint. It must not add permanent width to this already-overflowing layout.
- Local network origins: localhost, jsDelivr, cdnjs, Google Fonts, and GoatCounter script origin.
- Production additionally contacted `xsltdebugx.goatcounter.com`, `static.cloudflareinsights.com`, and `cloudflareinsights.com`.
- `_headers:1-7` supplies clickjacking, MIME, referrer, permissions and HSTS headers, but CSP is **Report-Only**, not enforced. `script-src` permits inline scripts and `unsafe-eval`, required by the present Monaco/global architecture.

## Test coverage and gaps

The existing suite is broad for current workflows: startup, transformation, malformed input, keyboard execution, CPI rows/functions/validation, examples, KV search, mode switching, legacy session persistence, share roundtrips, XPath matches, and clearing.

Important gaps for the upgrade:

- No accessibility tree/focus-trap assertions.
- No responsive/visual assertions.
- No storage-denied/quota/private-mode cases.
- No migration, retry, or corrupt legacy record cases.
- No multi-tab concurrency/conflict tests.
- No large-payload benchmark or memory/model-disposal test.
- No safe share-preview behavior because current behavior intentionally overwrites.
- No backup validation/roundtrip tests.
- Only Chromium is configured; Firefox and WebKit projects are commented out (`playwright.config.js:46-60`).

## Baseline risks

1. **Silent overwrite:** share, example, upload, and clear are incompatible with named sessions without a controller boundary.
2. **False resilience:** storage errors are swallowed, so users receive no failure/recovery UI.
3. **Single-record ceiling:** one `localStorage` blob has no indexing, transactions, trash, migration journal, or conflict detection.
4. **Responsive overflow:** the current app already exceeds the viewport at all measured sizes; adding a fixed sidebar would compound it.
5. **Remote runtime dependencies:** Monaco/pako/icons/fonts and analytics require network; the README's offline claim is only partial.
6. **Privacy wording:** README says no telemetry while also describing anonymous GoatCounter. Production additionally loads Cloudflare Web Analytics. Product copy should distinguish “no content telemetry” from anonymous page analytics.
7. **Security policy:** CSP is report-only and permits inline/eval. Imported titles and metadata must use `textContent`; workspace code must not broaden CSP further.
8. **Development dependency advisories:** current audit findings are in tooling, not shipped runtime code, but open PR #85 updates Vite/esbuild and may conflict with dependency changes.

## Upstream state

`origin/main` still equals the reviewed commit. Open pull requests observed on 2026-11-11:

- #85 targets `main` and updates npm development dependencies.
- #86 and #87 target `dev` and update GitHub Actions/development dependencies.

Workspace work should avoid unrelated dependency upgrades and rebase before implementation if #85 merges.
