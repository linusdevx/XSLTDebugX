---
description: Complete feature inventory and API reference for XSLTDebugX. Use when implementing new features, understanding existing functionality, debugging feature interactions, checking if functionality already exists, planning architecture changes, or verifying feature coverage.
applyTo:
  - "**/*.js"
  - "**/*.md"
---

# XSLTDebugX Feature Inventory & API Reference

> Complete catalog of all 200+ features across the codebase

## Quick Feature Lookup

**Before implementing new functionality, check if it already exists below.**

---

## 1. Editor Functions (Monaco-based)

### Core Monaco Integration
- **Three editor instances**: `eds.xml`, `eds.xslt`, `eds.out` (`state.js`)
- **Two XML models**: `xmlModelXslt`, `xmlModelXpath` for mode isolation (`state.js`)
- **Active model routing**: Use `xpathEnabled ? xmlModelXpath : xmlModelXslt`
- **Themes**: `xdebugx` (dark) and `xdebugx-light` defined in `themes.js` (`MONACO_THEME_DARK`, `MONACO_THEME_LIGHT`) and registered by `editor.js`
- **Theme toggle**: `toggleTheme()` in `ui.js`

### Live Validation (800ms debounced)
- **validateXML(src)** → `{ ok, line, col, message }` (`validate.js`)
- **markErrorLine(editor, lineNumber, message, oldDecor)** → red squiggle + glyph (`validate.js`)
- **clearAllMarkers()** → clears both XML models (`validate.js`)
- **preflight(xmlSrc, xsltSrc)** → pre-transform validation (`validate.js`)
- **Debounce timers**: `xsltDebounce`, `xmlDebounce` (global)

### Format / Minify
- **prettyXML(xml)** → formatted XML string (`panes.js`)
- **fmtEditor(which)** → format button handler (`panes.js`)
- **Context menu actions**: Format, Minify, Comment/Uncomment (`editor.js`)

### File Operations
- **triggerUpload(pane)** → triggers hidden file input (`files.js`)
- **handleUpload(event, pane)** → routes to active model based on `xpathEnabled` (`files.js`)
- **downloadPane(pane, defaultName)** → downloads editor content as file (`files.js`)
- **setupDragDrop(editorWrapId, pane)** → drag-and-drop handler (`files.js`)

### Word Wrap & Pane Actions
- **toggleWordWrap(which)** → per-editor state in `_wrapState` (`panes.js`)
- **copyPane(which)** → copies editor content to clipboard (`panes.js`)
- **clearPane(which)** → clears editor, both XML models for 'xml' (`panes.js`)

### Context Menu (Right-Click)
- **Copy XPath — Exact**: Indexed XPath like `/Orders/Order[2]/Amount` (`editor.js`)
- **Copy XPath — General**: Pattern XPath like `/Orders/Order/Amount` (`editor.js`)
- **Format XML/XSLT**, **Minify XML/XSLT**, **Comment/Uncomment Lines**
- **XSLT Snippets**: Common patterns (for-each, choose-when, template, etc.) (`editor.js`)

### Auto-Close & Utilities
- **setupAutoClose(editor)** → manual XML tag auto-close (`editor.js`)
- **_updateCursorStat(ed, label)** → updates status bar with line/col/char count (`editor.js`)
- **_getXmlLabel()** → dynamic label: "XML Input" (XSLT mode) vs "XML Source" (XPath mode) (`editor.js`)

---

## 2. XPath Evaluator

### Core XPath Functions
- **runXPath()** → main entry point (`xpath.js`)
- **Saxon-JS evaluation**: `SaxonJS.XPath.evaluate(expr, xmlDoc, options)`
- **Namespace bindings**: `xs`, `fn`, `math`, `map`, `array` auto-provided
- **_xpathNormalise(result)** → flattens XDM sequence to JS array (`xpath.js`)

### Expression Syntax Colorization (Live)
- **_highlightXPath(expr)** → tokenizes and colors expression (`xpath.js`)
- **Overlay div**: `#xpathOverlay` positioned absolutely over textarea
- **Token colors**: Functions (amber), attributes (lavender), strings (green), numbers (orange), operators (pink), variables (lavender), predicates (blue)

### Expression History (localStorage)
- **_xpathHistory[]** → last 20 expressions (`xpath.js`)
- **_xpathHistoryKey**: `'xdebugx-xpath-history'`
- **_xpathHistoryPush(expr)** → adds to history, dedupes, persists (`xpath.js`)
- **_xpathHistoryNavigate(direction, input)** → up/down navigation (`xpath.js`)
- **_xpathHistoryCursor** → current position in history (-1 = not browsing)

### Editor Highlighting (Matched Nodes)
- **_highlightMatchedNodes(items, xmlSrc)** → amber line backgrounds (`xpath.js`)
- **xpathDecorations** → global decoration collection
- **clearXPathHighlights()** → clears decorations (`xpath.js`)
- **_makeLineDecoration(line, hoverMsg)** → creates glyph + hover (`xpath.js`)

### Copy XPath Feature
- **getXPathAtCursor(editor)** → returns `{ indexed, general }` (`xpath.js`)
- **_buildXPathFromNode(el, indexed)** → generates XPath (`xpath.js`)
- **_getXPathDomNodeAtOffset(xmlSrc, offset)** → finds element at cursor (`xpath.js`)
- **_findNodeRange(xmlSrc, el, occurrenceIndex)** → finds start/end offsets (`xpath.js`)
- **_nthTagOpen(src, tag, n)** → finds nth occurrence of tag (`xpath.js`)
- **_offsetToLineCol(src, offset)** → converts offset to line/col (`xpath.js`)

### XPath Hints Strip
- **renderXPathHints(hints)** → displays clickable chips (`xpath.js`)
- **Chip rendering**: Syntax-highlighted expressions
- **Click handler**: Populates input and auto-runs expression

### Results Display
- **_showXPathResults(items, errorMsg, isError)** → async with Monaco colorization (`xpath.js`)
- **_xpathSerializeItem(item)** → converts XDM item to display string (`xpath.js`)
- **Match count** → displayed in header panel
- **Type labels**: Node, Attribute, Text, Value
- **clearXPathResults()** → hides panel, clears decorations (`xpath.js`)
- **restoreOutputSection()** → re-expands output section (`xpath.js`)

### Mode Toggle (XSLT ↔ XPath)
- **toggleXPath()** → trigger mode switch to XPath; calls `modeManager.setMode('XPATH')` internally (`xpath.js`)
- **ModeManager class** → Centralized mode switching, all UI sync happens inside `modeManager.setMode()` (`mode-manager.js`)
- **modeManager.isXpath** → getter property (use instead of checking `xpathEnabled` directly)
- **modeManager.setMode()** → primary API for mode changes; updates models, UI, column states automatically
- ⚠️ **DEPRECATED**: `xpathEnabled` is ONLY a JSON key in saved-state — there is no live global. Read the mode via `modeManager.isXpath`; never swap XML models manually — call `modeManager.setMode()`.

### XPath Mode UI Elements
- **copyXPathInput()** → copies expression to clipboard (`xpath.js`)
- **clearXPathInput()** → clears expression, clears hints (`xpath.js`)
- **copyXPathResults()** → copies all results as plain text (`xpath.js`)
- **_syncXPathInput(value)** → syncs textarea value and overlay/height (`xpath.js`)

---

## 3. Transform Engine

### XSLT 3.0 Execution
- **runTransform()** → main entry point (`transform.js`)
- **Saxon-JS 2.x**: Bundled in `lib/SaxonJS2.js`
- **saxonReady** → global flag, must be true before transforms
- **SaxonJS.transform()** → called with `stylesheetText` + `sourceText`
- **Performance timing** → logs execution duration

### Pre-Flight Validation
- **preflight(xmlSrc, xsltSrc)** → validates both before Saxon runs (`validate.js`)
- **Blocks on errors** → returns false if validation fails
- **Marker placement** → highlights errors in editors with red squiggles

### Output Language Detection
- **XML detection**: Starts with `<` → calls `prettyXML()`
- **JSON detection**: Starts with `{` or `[` → validates with `JSON.parse()`, pretty-prints
- **Plain text fallback**: CSV, fixed-length, EDI, etc. → shown as-is
- **Monaco language mode**: `setModelLanguage(eds.out.getModel(), lang)`
- **Output badge**: Updated to "XML", "JSON", or "TEXT"
- **Download filename**: `output.xml`, `output.json`, or `output.txt`

### Run Button Feedback
- **Spinner**: Shown for minimum 300ms
- **Status updates**: "Validating…", "Running…", "Ready", "Transform failed"
- **Error state**: Red pill in status bar
- **Success log**: Shows execution time in ms

---

## 4. SAP CPI Simulation

### Headers & Properties (Key-Value Panels)
- **kvData** → global store: `{ headers: [], properties: [] }` (`state.js`)
- **toggleKVPanel(panelId)** → expand/collapse accordion (`transform.js`)
- **addKVRow(type)** → adds new header/property row (`transform.js`)
- **deleteKVRow(type, id)** → removes row (`transform.js`)
- **updateKV(type, id, field, val)** → edits name or value (`transform.js`)
- **renderKV(type)** → renders table with delete buttons (`transform.js`)
- **renderOutputKV(headers, properties)** → renders captured values (`transform.js`)
- **Count badges** → show number of entries in accordion headers

### cpi:setHeader / cpi:setProperty
- **rewriteCPICalls(xslt)** → rewrites `cpi:` namespace to `js:` (`transform.js`)
- **ensureJsExcluded(xslt)** → adds `exclude-result-prefixes="js"` (`transform.js`)
- **JavaScript interceptors**: `window.cpiSetHeader`, `window.cpiSetProperty`
- **cpiCaptured** → local object during transform: `{ headers: {}, properties: {} }`
- **Full XPath evaluation**: Supports `concat()`, `if-then-else`, `//element/path`, variables
- **Output panels** → captured values shown in Output Headers/Properties
- **Reads:** declare `<xsl:param name="X"/>` — values come from Headers/Properties panels via `buildParamsXPath()` (mirrors CPI runtime; no `cpi:get*` exists).

### $exchange Parameter
- **buildParamsXPath()** → injects $exchange + headers/properties (`transform.js`)
- **Always injected** → even if no headers/properties defined
- **Dummy value** → string `'exchange'` (not a real object)
- **Usage constraint** → only works as 1st argument to cpi:* functions

### xsl:message Support
- **console.log intercept** → captures Saxon's stdout during transform
- **_xslMessages[]** → temporary array local to `runTransform()`, flushed before completion log (`transform.js`)
- **Console display** → logged as amber 'warn' type messages
- **Execution order** → fired in natural XSLT execution order

### terminate="yes" Handling
- **Error detection** → regex: `/^Terminated with (.+)$/i`
- **Warning log** → not treated as error (intentional halt)
- **User-friendly** → distinguishes from actual bugs

### Error Line Mapping
- **parseSaxonErrorLine(msg)** → extracts line from error message (`validate.js`)
- **findXPathExpressionLine(saxonMsg, originalXslt, saxonReportedLine, cpiLineOffset)** → maps to original XSLT (`validate.js`)
- **Expression search** → finds `{...}` in error message
- **Multiple occurrence handling** → uses closest match to Saxon line
- **Limitation** → ±5 line accuracy due to CPI rewriting

### CPI Detection
- **hasCPI flag** → detects `xmlns:cpi` in XSLT source
- **Console logging** → "CPI simulation enabled" message
- **Captured count** → logs "X headers captured · Y properties captured"
- **Passthrough** → input headers/properties merge to output if not overwritten

### Parameter Injection
- **isValidNCName(name)** → validates param names (`transform.js`)
- **NCName compliance** → skips invalid names with console warning
- **Map building** → `{ exchange: 'exchange', HeaderName: 'value', ... }`
- **stylesheetParams** → passed to `SaxonJS.transform()`

---

## 5. Examples Library

### Category System
- **CATEGORIES object** → 6 categories with labels + accent colors (`examples-data.js`)
- **renderExSidebar()** → auto-generates category buttons with counts (`modal.js`)
- **setExCat(cat)** → filters grid by category (`modal.js`)
- **'all' category** → shows all 61 examples

**Categories:**
- `transform` — Data Transformation (8 examples)
- `aggregation` — Aggregation & Splitting (4 examples)
- `format` — Format Conversion (6 examples)
- `advanced` — XSLT 3.0 Advanced (6 examples)
- `cpi` — SAP CPI Patterns (18 examples)
- `xpath` — XPath Explorer (19 examples)

### Example Structure
- **EXAMPLES object** → 61 examples keyed by ID (`examples-data.js`)
- **Required fields**: `label`, `icon` (Lucide icon name, kebab-case string), `desc`, `cat`, `xml`, `xslt`
- **Optional fields**: `headers`, `properties`, `xpathExpr`, `xpathHints`
- **XPath examples** → have `xpathExpr` instead of `xslt`
- **CPI examples** → include `headers: [['name', 'value'], ...]` arrays

### Example Loading
- **loadExample(key)** → loads by key from EXAMPLES object (`modal.js`)
- **Mode detection** → switches XSLT↔XPath based on presence of `xpathExpr`
- **Model swap** → routes XML to `xmlModelXslt` or `xmlModelXpath`
- **Content loading** → populates XML, XSLT, KV panels
- **Output clear** → clears previous transform output
- **XPath sync** → loads expression + displays hints strip
- **Modal auto-close** → closes after successful load
- **_lastExampleKey** → global variable tracking current example

### Example Grid
- **renderExGrid()** → builds card grid dynamically (`modal.js`)
- **filterExamples()** → search filter on label/desc/category (`modal.js`)
- **Search input** → `#exModalSearch` with `oninput="filterExamples()"`
- **Card layout** → Icon, label, description, category tag
- **Click handler** → `onclick="loadExample('exampleKey')"`

### Example Modal
- **openExModal()** → shows examples library (`modal.js`)
- **closeExModal()** → hides modal (`modal.js`)
- **handleModalBackdropClick(e)** → click-to-close on backdrop (`modal.js`)
- **Escape key** → closes modal (global handler)

---

## 6. Share Function

### URL Encoding
- **buildSharePayload()** → creates payload object (`share.js`)
- **Payload fields**: `xml` (from xmlModelXslt), `xslt`, `headers`, `properties`
- **encodeShareData(data)** → JSON → base64 → pako compress → base64 (`share.js`)
- **generateShareUrl()** → builds `#share/ENCODED_DATA` URL (`share.js`)

### URL Decoding
- **loadFromShareHash()** → parses URL hash on page load (`share.js`)
- **Hash detection** → looks for `#share/...`
- **_pendingShareData** → deferred application after Monaco loads
- **applyShareData(data)** → populates editors + KV panels (`share.js`)
- **Decompression** → base64 decode → pako inflate → JSON parse
- **Mode switch** → always switches to XSLT mode
- **KV restoration** → rebuilds headers/properties from arrays
- **Error handling** → try/catch with console warning

### Share Modal
- **openShareModal()** → generates URL and shows modal (`share.js`)
- **closeShareModal()** → hides modal (`share.js`)
- **handleShareBackdropClick(e)** → click-to-close (`share.js`)
- **Share URL input** → read-only, click-to-select
- **_copyShareUrl(url, silent)** → copies to clipboard with toast (`share.js`)

### Limitations
- **XSLT mode only** → XPath expressions not included in share payload
- **URL length limit** → ~2000 chars browser limit, no warning shown
- **Client-side only** → never hits server, pure URL hash
- **Recipients** → always land in XSLT mode regardless of original mode

---

## 7. Session Persistence

### Auto-Save (localStorage)
- **scheduleSave()** → debounced 800ms (`state.js`)
- **saveState()** → writes to localStorage (`state.js`)
- **_saveTimer** → debounce timer handle (`state.js`)
- **_suppressNextSave** → guards programmatic changes (`state.js`)
- **Storage key**: `'xdebugx-session-v1'`

### Saved Data Fields
- **xmlXslt** → XSLT mode XML model content
- **xmlXpath** → XPath mode XML model content
- **xslt** → XSLT editor content
- **headers** → KV headers array
- **properties** → KV properties array
- **xpathExpr** → XPath expression
- **xpathEnabled** → mode flag (boolean)
- **leftCollapsed** → left column state (boolean)
- **rightCollapsed** → right column state (boolean)

### Load Saved State
- **loadSavedState()** → reads from localStorage (`state.js`)
- **Backward compatibility** → migrates old `'xml'` key to `'xmlXslt'`
- **Session restoration** → `editor.js` restores full state
- **Model restoration** → creates both XML models with saved content
- **Mode restoration** → swaps to correct XML model based on `xpathEnabled`
- **KV restoration** → rebuilds headers/properties panels
- **Column state** → restores collapsed states
- **XPath state** → restores expression + hints

### Clear Session (Mode-Aware)
- **clearSavedState()** → mode-aware reset (`state.js`)
- **XSLT mode reset** → identity transform + sample XML
- **XPath mode reset** → XPath navigation example
- **localStorage clear** → removes `'xdebugx-session-v1'` key
- **History clear** → wipes `_xpathHistory`
- **KV clear** → empties headers/properties
- **Output clear** → resets output editor language to XML
- **Markers clear** → removes validation errors
- **Console preserved** → logs "Session cleared" action
- **Mode preserved** → stays in current mode (XSLT or XPath)

### Auto-Save Indicator
- **showSavedIndicator()** → flashes "Saved" pill (`state.js`)
- **_savedFadeTimer** → 2-second fade timer (`state.js`)
- **Opacity animation** → CSS transition

---

## 8. UI / UX Functions

### Console
- **clog(msg, type)** → main logging function (`state.js`)
- **Types**: `'info'`, `'warn'`, `'error'`, `'success'`
- **Icons per type**: ℹ️, ⚠️, ❌, ✅
- **escHtml(s)** → XSS protection for log messages (`state.js`)
- **Timestamp** → HH:MM:SS format
- **clearConsole()** → clears all log lines (`state.js`)
- **copyConsole()** → copies all messages to clipboard (`ui.js`)
- **consoleErrCount** → global error counter
- **updateConsoleErrBadge()** → updates error count badge (`ui.js`)
- **handleConsoleBarClick(e)** → toggles panel expand/collapse (`ui.js`)
- **setConsoleState(state)** → 'expanded' | 'collapsed' | 'minimized' (`ui.js`)

### Console Filtering
- **setConsoleFilter(filter)** → filters by 'all', 'info', 'warn', 'error' (`ui.js`)
- **Active button highlight** → `.active` class toggle
- **CSS filtering** → shows/hides by `.console-${type}` class
- **Filter buttons** → color-coded circle dots

### Console Search
- **applyConsoleSearch(query)** → keyword filter (`ui.js`)
- **Case-insensitive** → uses `toLowerCase()`
- **Highlights matches** → text contains search query
- **Combined filtering** → works with type filter

### Theme Toggle
- **toggleTheme()** → switches light↔dark (`ui.js`)
- **localStorage persistence** → `'xdebugx-theme'` key
- **Body class** → `'light'` or none (dark default)
- **Monaco theme** → `'xdebugx-light'` or `'xdebugx'`
- **Button emoji** → ☀️ sun (light mode) / 🌙 moon (dark mode)
- **Smooth transition** → CSS transitions on theme switch

### Help Modal
- **openHelpModal()** → shows help modal (`ui.js`)
- **closeHelpModal()** → hides modal (`ui.js`)
- **handleHelpBackdropClick(e)** → click-to-close on backdrop (`ui.js`)
- **switchHelpTab(tab)** → switches between 'features' and 'shortcuts' tabs (`ui.js`)
- **Tab content** → features list, keyboard shortcuts table

### Column Collapse
- **toggleSideCol(side)** → toggles 'left' or 'right' column (`ui.js`)
- **Collapse buttons** → arrow icons in pane bars
- **Tab handles** → clickable when collapsed (`.col-tab`)
- **Editor layout** → calls `eds.xml.layout()` after expand/collapse
- **Mode-aware** → XPath mode can hide center (XSLT) column

### Status Bar
- **setStatus(txt, state)** → updates status pill (`state.js`)
- **States**: `'ok'`, `'err'`, `'busy'`
- **Color coding** → green, red, blue
- **Icon per state** → ✓, ✗, spinner
- **Cursor stats** → line, column, character count
- **Dynamic label** → "XML Input" vs "XML Source" based on mode

### Modals (General)
- **Backdrop click-to-close** → all modals support this
- **Escape key** → closes any open modal (global listener)
- **Centered layout** → CSS Flexbox centering
- **Close button** → ✕ icon in top-right
- **Z-index stacking** → proper layering with `.ex-modal-backdrop`

### Panels & Accordions
- **KV panels** → Headers, Properties, Output Headers, Output Properties
- **Chevron icon** → rotates on expand/collapse (CSS transform)
- **Badge counts** → shows number of entries in accordion header
- **Add buttons** → `+` icon, uses `event.stopPropagation()`
- **Delete buttons** → per-row `×` icon with hover highlight

---

## 9. Key Workflows

### XSLT Transform Workflow
1. User loads XML + XSLT (manual entry, file upload, or example)
2. Press **Run XSLT** button or `Ctrl+Enter`
3. `preflight()` validates XML and XSLT well-formedness
4. If CPI namespace detected (`xmlns:cpi`), `rewriteCPICalls()` rewrites to `js:`
5. `ensureJsExcluded()` adds `exclude-result-prefixes="js"`
6. `buildParamsXPath()` injects `$exchange` + headers/properties as params
7. Saxon-JS runs `SaxonJS.transform()`
8. Output language detected (XML/JSON/plain text)
9. Output pretty-printed if XML or JSON
10. CPI-captured values shown in Output Headers/Properties panels
11. `xsl:message` lines logged to console as warnings
12. Success/error status displayed in status bar

### XPath Evaluation Workflow
1. User clicks **ƒx XPath** mode button or switches via example
2. XML editor swaps to `xmlModelXpath` model
3. UI updates (hides XSLT column, shows XQuery bar, moves console)
4. User types XPath expression (live syntax coloring applied)
5. Press **Run XPath** button or `Enter` key
6. XML validated for well-formedness
7. Saxon-JS evaluates `SaxonJS.XPath.evaluate()`
8. Results normalized to flat array
9. Items serialized and syntax-colored via Monaco
10. XPath Results panel shown with match count
11. Matched nodes highlighted in amber in XML editor
12. Output section minimized automatically
13. Expression added to history (max 20)

### Example Loading Workflow
1. User clicks **Examples** button in header
2. Modal opens with category sidebar + grid layout
3. User selects category or uses search filter
4. User clicks example card
5. `loadExample()` detects mode (XSLT vs XPath based on `xpathExpr`)
6. If mode switch needed, `modeManager.setMode('XPATH')` is called (or via `toggleXPath()` thin wrapper)
7. XML editor model swapped to match new mode
8. Content loaded to editors (XML, XSLT or XPath expression)
9. Headers/Properties populated (if XSLT example)
10. XPath expression + hints loaded (if XPath example)
11. Modal closes automatically
12. User can immediately run transform/evaluation

### Share Workflow
1. User clicks **Share** button in header
2. `buildSharePayload()` collects current state
3. Data compressed (pako) and base64-encoded
4. URL generated with `#share/ENCODED_DATA` hash
5. Modal shows URL in read-only input field
6. User clicks **Copy URL** button
7. URL copied to clipboard
8. Success toast notification shown
9. Recipient opens URL in browser
10. `loadFromShareHash()` parses hash on page load
11. State restored after Monaco loads (via `_pendingShareData`)
12. Always lands in XSLT mode regardless of original mode

### Session Restoration Workflow
1. Page loads, Monaco loader script runs
2. `loadSavedState()` reads from localStorage
3. Both XML models created with saved content (xmlXslt, xmlXpath)
4. Editors initialized with saved XSLT content
5. `xpathEnabled` flag restored from saved session
6. XML editor model swapped to match restored mode
7. KV panels populated with saved headers/properties
8. Column collapse states applied
9. XPath expression restored to input
10. If share hash present in URL, overrides saved state

---

## 10. Module Dependencies

### Load Order (Critical — Defined in index.html)
```
state.js → mode-manager.js → validate.js → panes.js → transform.js →
examples-data.js → modal.js → files.js → ui.js → share.js → xpath.js → editor.js
```

### Global Variables (Always Available)
- **eds** → `{ xml, xslt, out }` Monaco editor instances
- **xmlModelXslt** → XML model for XSLT mode
- **xmlModelXpath** → XML model for XPath mode
- **saxonReady** → boolean flag for Saxon-JS readiness
- **modeManager** → `ModeManager` instance; mode is read via `modeManager.isXpath` (the `xpathEnabled` flag is a JSON-key only, not a live global)
- **kvData** → `{ headers: [], properties: [] }`
- **kvIdSeq** → auto-increment ID for KV rows
- **EXAMPLES** → object with 61 examples
- **CATEGORIES** → object with 6 category definitions
- **consoleErrCount** → global error counter

### Suppression Flags (Prevent Synthetic Events)
- **_suppressNextSave** → skip next scheduleSave() call
- **_suppressNextXmlChange** → skip next XML content-change handler
- **_suppressNextValidation** → skip next validation debounce

### Cross-Module Function Dependencies
- **clog()** → called from all modules
- **scheduleSave()** → called on editor changes, file operations
- **validateXML()** → called from validate, transform, xpath
- **preflight()** → called before transform
- **clearAllMarkers()** → called from state, modal, validate
- **prettyXML()** → called from panes, transform, xpath, editor
- **toggleXPath()** → thin wrapper; calls `modeManager.setMode('XPATH')` from modal (example loading), editor (keyboard)
- **modeManager.setMode()** → centralized mode switching; called from modal, editor, share, xpath
- **_syncXPathInput()** → called from state, modal, editor
- **_updateCursorStat()** → called from modal, editor, xpath
- **renderXPathHints()** → called from state, modal, xpath
- **clearXPathHighlights()** → called from editor, xpath
- **clearXPathResults()** → called from state, xpath, modal
- **restoreOutputSection()** → called from transform

---

## 11. Implementation Patterns

### Adding New Editor Features
1. Check if Monaco API supports it natively
2. Add global state variable if needed (prefix with `_` if private)
3. Implement in appropriate module (editor.js for Monaco, panes.js for actions)
4. Call `scheduleSave()` if state should persist
5. Update `saveState()` / `loadSavedState()` if new persistent field

### Adding New CPI Functions
1. Add to `rewriteCPICalls()` regex patterns
2. Create JavaScript interceptor function
3. Intercept in transform before Saxon runs
4. Return value to XSLT via Saxon's `js:` extension
5. Test with CPI simulation example
6. Document in help modal if user-facing

### Adding New Examples
1. Add entry to `EXAMPLES` object in `examples-data.js`
2. Use existing category or add to `CATEGORIES` if new
3. Follow example structure: `{ label, icon, desc, cat, xml, xslt }`
4. For XPath examples: include `xpathExpr` field
5. For CPI examples: include `headers` and `properties` arrays
6. Test via Examples modal

### Adding New Validation Rules
1. Add to `preflight()` in `validate.js` for blocking errors
2. Add to debounced validation for live feedback
3. Use `markErrorLine()` for visual markers
4. Use `clog()` for console messages
5. Return `false` from `preflight()` to block transform

---

## 12. Known Constraints & Limitations

### Architecture Constraints
- **Global namespace** → no module system, all functions are global
- **Load order matters** → modules depend on previous modules being loaded
- **Model swap events** → synthetic content-change events require suppression flags
- **Saxon async readiness** → must check `saxonReady` before XSLT/XPath operations

### CPI Simulation Constraints
- **$exchange not a real object** → dummy string, only works as 1st arg to cpi:*
- **Error line mapping** → ±5 line accuracy due to XSLT rewriting
- **No dynamic namespace registration** → CPI namespace must be declared in XSLT

### Share Function Constraints
- **XSLT mode only** → XPath expressions and mode not shared
- **URL length limit** → ~2000 chars browser limit, no user warning
- **Client-side only** → never hits server, pure URL hash

### Browser Constraints
- **localStorage limit** → ~5-10MB per domain
- **Clipboard API** → falls back to `execCommand` for file:// protocol
- **Monaco CDN** → requires internet connection (no offline mode)

---

## 13. Testing Checklist

### Before Releasing New Features
- [ ] Test in both XSLT and XPath modes
- [ ] Verify session persistence (save → reload → verify state)
- [ ] Test with CPI examples (headers/properties simulation)
- [ ] Verify validation works (XML + XSLT errors marked)
- [ ] Test example loading (mode switching)
- [ ] Test share URL (encode → decode → verify state)
- [ ] Test in light and dark themes
- [ ] Test file upload/download
- [ ] Test drag-and-drop
- [ ] Test context menu actions
- [ ] Verify console logging (info/warn/error/success)
- [ ] Test column collapse/expand
- [ ] Test keyboard shortcuts (Ctrl+Enter)
- [ ] Test with large files (performance)
- [ ] Test error scenarios (invalid XML, XSLT errors)

---

## Quick Reference: Function Locations

| Function | File | Purpose |
|----------|------|---------|
| `runTransform()` | transform.js | Main XSLT transform entry |
| `runXPath()` | xpath.js | Main XPath eval entry |
| `toggleXPath()` | xpath.js | Mode switch XSLT↔XPath |
| `loadExample(key)` | modal.js | Load example by key |
| `validateXML(src)` | validate.js | XML validation |
| `preflight(xml, xslt)` | validate.js | Pre-transform check |
| `prettyXML(xml)` | panes.js | XML formatter |
| `clog(msg, type)` | state.js | Console logger |
| `saveState()` | state.js | Save to localStorage |
| `loadSavedState()` | state.js | Load from localStorage |
| `clearSavedState()` | state.js | Clear localStorage |
| `buildSharePayload()` | share.js | Build share data |
| `applyShareData(data)` | share.js | Apply share data |

---

**For detailed implementation examples, see individual module files.**
**For CPI simulation details, see `.github/docs/TRANSFORM.md`.**
**For example structure, see `.github/docs/reference/examples-data.md`.**
