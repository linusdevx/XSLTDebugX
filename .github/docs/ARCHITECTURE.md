# XSLTDebugX Architecture

This document describes the structure, data flow, and design patterns of XSLTDebugX.

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Build Pipeline](#build-pipeline)
- [Module Overview](#module-overview)
- [Module Dependency Graph](#module-dependency-graph)
- [Data Flow](#data-flow)
- [Global State Management](#global-state-management)
- [DOM Structure](#dom-structure)
- [Key Design Patterns](#key-design-patterns)
- [Loading Order & Initialization](#loading-order--initialization)
- [Namespace Guidelines](#namespace-guidelines)

---

## High-Level Architecture

XSLTDebugX is a **vanilla JavaScript application** deployed as a static site on Cloudflare Pages. It uses **no framework**. For local development, source files are served directly (no build required). For production, a Vite + esbuild pipeline bundles and minifies into `dist/`.

```
┌──────────────────────────────────────────────────────────────┐
│                        index.html                             │
│  (loads CSS + 12 JS modules + Monaco Editor + Saxon-JS + Lucide Icons)      │
└──────────────────────────────────────────────────────────────┘
                              ↓
              ┌─────────────────────────────────┐
              │   Vanilla ES6+ JavaScript       │
              │   (12 modules)
              └─────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────────┐
        │  Monaco Editor (XML, XSLT, Output panes)   │
        │  Saxon-JS 2.7 (XSLT 3.0 + XPath 3.1)       │
        │  Lucide Icons (SVG icon library)             │
        │  CSS (Light & Dark themes)                  │
        └─────────────────────────────────────────────┘
                              ↓
              ┌──────────────────────────────┐
              │   Browser localStorage       │
              │   (xdebugx-session-v1)       │
              └──────────────────────────────┘
```

---

## Build Pipeline

`npm run build` runs `vite build`, which uses a custom two-plugin pipeline in `vite.config.js`:

```
Source files (js/*.js + css/style.css)
    ↓
esbuild — minifies each JS module individually (no IIFE wrapping)
    ↓
Concatenated in strict load order → content-hashed → dist/app.{hash}.js
    ↓
Vite — processes css/style.css → dist/app.{hash}.css
    ↓
index.html rewritten:
  - 12 <script src="js/..."> tags stripped
  - Single <script src="app.{hash}.js"> injected
  - CSS link replaced with hashed filename
    ↓
dist/lib/SaxonJS2.js, _headers, _redirects, favicon.svg copied as-is
```

**Why no IIFE wrapping?** The source code uses inline HTML event handlers (`onclick="runTransform()"`) that require functions to be on `window`. IIFE-wrapping would make them local-scoped and break all handlers. esbuild's `bundle: false` mode minifies without wrapping.

**Load order** is defined by the `JS_MODULES` array in `vite.config.js` and must stay in sync with the `<script>` tag order in `index.html`. When adding or reordering modules, update both.

**dist/ output:**
```
dist/
├── index.html           # Rewritten HTML
├── app.{hash}.js        # All 12 modules, minified + concatenated
├── app.{hash}.css       # Minified CSS
├── favicon.svg
├── _headers             # Cloudflare cache rules
├── _redirects           # SPA routing fallback
└── lib/
    └── SaxonJS2.js      # Vendor XSLT engine (~2.3 MB)
```

---

## Module Overview

| Module | Responsibility | Key Functions |
|--------|-----------------|----------------|
| **state.js** | Global state, shared utilities, localStorage persistence, console | `clog()`, `scheduleSave()`, `loadSavedState()`, `setStatus()`, `logError()`, `guardReady()` |
| **mode-manager.js** | Centralized mode management (XSLT vs XPath) | `setMode()`, `isXpath`, `isXslt`, `getMode()` |
| **validate.js** | XML/XSLT validation, Monaco error markers, Saxon error parsing | `validateXML()`, `markErrorLine()`, `preflight()`, `parseSaxonErrorLine()` |
| **panes.js** | Word wrap, copy/clear/format, XML tokenizer | `toggleWordWrap()`, `copyPane()`, `fmtEditor()`, `prettyXML()`, `_tokenizeXML()`, `_indentTokens()` |
| **transform.js** | XSLT execution, CPI simulation, output rendering | `runTransform()`, `rewriteCPICalls()`, `buildParamsXPath()`, `renderOutputKV()` |
| **examples-data.js** | 61 built-in XSLT/XPath examples across 6 categories | `CATEGORIES`, `EXAMPLES` (data objects) |
| **modal.js** | Examples library UI, filtering, loading | `openExModal()`, `loadExample()`, `renderExGrid()`, `filterExamples()` |
| **files.js** | File upload/download, drag-and-drop | `triggerUpload()`, `handleUpload()`, `downloadPane()`, `setupDragDrop()` |
| **ui.js** | Console state, theme toggle, help modal, column collapse | `setConsoleState()`, `toggleTheme()`, `applyConsoleSearch()`, `setConsoleFilter()` |
| **share.js** | URL encoding/decoding of session state | `buildSharePayload()`, `generateShareUrl()`, `loadFromShareHash()` |
| **xpath.js** | XPath mode UI, expression evaluation, node highlighting, syntax coloring | `runXPath()`, `toggleXPath()`, `_highlightXPath()`, `_highlightMatchedNodes()` |
| **editor.js** | Monaco initialization, themes, keyboard shortcuts, context menus | `hideLoader()`, `setupAutoClose()`, `toggleTheme()`, `_toggleXmlComment()` |

---

## Module Dependency Graph

```
index.html
    ↓
[Load order matters — executed in sequence]
    ↓
state.js ←─────────────────────────────────────────────────────┐
    ↓ (provides global state, clog, scheduleSave)               │
mode-manager.js (uses state)                                    │
    ↓ (provides setMode, isXpath, isXslt, getMode)             │
validate.js (uses state)                                        │
    ↓ (provides validateXML, markErrorLine, preflight)          │
panes.js (uses state)                                           │
    ↓ (provides toggleWordWrap, copyPane, fmtEditor)            │
transform.js (uses state, validate)                             │
    ↓ (provides runTransform, CPI functions)                    │
examples-data.js                                                │
    ↓ (provides CATEGORIES, EXAMPLES)                           │
modal.js (uses state, examples-data)                            │
    ↓ (provides openExModal, loadExample)                       │
files.js (uses state)                                           │
    ↓ (provides triggerUpload, downloadPane)                    │
ui.js (uses state)                                              │
    ↓ (provides toggleTheme, setConsoleState)                   │
share.js (uses state, transform)                                │
    ↓ (provides generateShareUrl)                               │
xpath.js (uses state, validate, mode-manager)                   │
    ↓ (provides runXPath, toggleXPath, node highlighting)       │
editor.js (uses state, all above) ←────────────────────────────┘
    ↓ (provides eds, Monaco init, keyboard shortcuts)
[All modules must load before first user interaction]
```

**Key Constraint**: Load order is strict. Each module depends on globals defined by earlier modules.

---

## Data Flow

### XSLT Transform Flow

```
User clicks "Run XSLT"
    ↓
runTransform() [transform.js]
    ↓
1. Read XML from eds.xml.getValue()
2. Read XSLT from eds.xslt.getValue()
    ↓
3. preflight(xmlSrc, xsltSrc) [validate.js]
   - validateXML() on both inputs
   - If errors → mark lines, log, return false
    ↓
4. Detect CPI calls (cpi:setHeader, etc.)
   ↓
5. If CPI detected → rewriteCPICalls() [transform.js]
   - Replace xmlns:cpi → xmlns:js (Saxon-JS namespace)
   - Replace cpi:setHeader → js:cpiSetHeader
   - Inject window.cpiSetHeader, cpiSetProperty, etc. interceptors
   - Capture values into cpiCaptured object
    ↓
6. BuildParamsXPath() [transform.js]
   - Build xsl:param map from kvData.headers + kvData.properties
   - Validate NCNames, warn on duplicates/invalid names
    ↓
7. SaxonJS.XPath.evaluate() [transform.js]
   - Execute transform(map { stylesheet-text, source-node, params })
   - Intercept console.log to capture xsl:message output
    ↓
8. Detect output language
   - If starts with '<' → XML (pretty-print)
   - If starts with '{' or '[' → JSON (pretty-print)
   - Else → plaintext (CSV, fixed-length, EDI)
    ↓
9. Render output
   - eds.out.setValue(formattedOutput)
   - renderOutputKV(headers, properties)
   - For CPI: show cpiCaptured values first, then headers/properties
    ↓
Complete
```

### XPath Evaluation Flow

```
User types XPath expression → press Enter or click "Run XPath"
    ↓
runXPath() [xpath.js]
    ↓
1. Read expression from document.getElementById('xpathInput')
2. Read XML from eds.xml.getValue()
    ↓
3. validateXML(xmlSrc) [validate.js]
   - If invalid → show error in results panel, return
    ↓
4. Push expression to history: _xpathHistoryPush(expr)
    ↓
5. SaxonJS.XPath.evaluate(expr, docNode, { namespaceContext: NS })
   - Namespace context includes xs, fn, math, map, array
    ↓
6. _xpathNormalise(result) [xpath.js]
   - Convert result to flat array (handles atomic values, sequences)
    ↓
7. _highlightMatchedNodes(items, xmlSrc) [xpath.js]
   - For each matched element: find source range, calculate line numbers
   - Apply Monaco decorations (amber highlights) on matched lines
   - Scroll XML editor to first match
    ↓
8. _showXPathResults(items, null, false) [xpath.js]
   - Serialize each matched item to string
   - Use monaco.editor.colorize() to syntax-highlight XML nodes
   - Render results panel with type badges (Node, Text, Value)
    ↓
Complete
```

### Theme Toggle Flow

```
User clicks theme toggle button
    ↓
toggleTheme() [ui.js]
    ↓
1. Toggle xthemeMode between 'dark' and 'light'
2. Save to localStorage
    ↓
3. Apply CSS class to <body> for styling
    ↓
4. Update Monaco theme on all 3 editors:
   - eds.xml.updateOptions({ theme: 'xdebugx' or 'xdebugx-light' })
   - eds.xslt.updateOptions({ theme: 'xdebugx' or 'xdebugx-light' })
   - eds.out.updateOptions({ theme: 'xdebugx' or 'xdebugx-light' })
    ↓
5. If XPath results visible → refreshXPathColors() [xpath.js]
   - Re-colorize results using new theme palette
    ↓
Complete
```

### Session Persistence Flow

```
On startup:
    loadSavedState() [state.js] → parse localStorage[xdebugx-session-v1]
    ↓
    Restore to all editors and panels:
    - eds.xml.setValue(saved.xmlXslt)
    - eds.xslt.setValue(saved.xslt)
    - eds.out.setValue(saved.out)
    - kvData.headers = saved.headers
    - kvData.properties = saved.properties
    - xpathEnabled = saved.xpathEnabled
    - Current XPath expression
    - Column collapse states
    ↓
On user edit:
    Any change to XML, XSLT, headers, properties, or mode
    ↓
    scheduleSave() [state.js]
    ↓
    (debounced for 800ms)
    ↓
    persistSession() [state.js] → serialize to localStorage[xdebugx-session-v1]
    ↓
    Complete
```

---

## Global State Management

All mutable state lives in **global variables** (no module system, no class-based state management).

### Editor State (state.js)

```javascript
// Three Monaco editor instances
let eds = { xml: null, xslt: null, out: null };

// Two XML models (for XSLT vs XPath mode isolation)
let xmlModelXslt = null;  // Active in XSLT mode
let xmlModelXpath = null; // Active in XPath mode

// Active mode flag
let xpathEnabled = false; // XSLT mode by default

// CPI simulation data
let kvData = { headers: [], properties: [] };
let kvIdSeq = 0; // For generating unique IDs
```

### UI State (ui.js, xpath.js, panes.js)

```javascript
// Word wrap state per editor
let _wrapState = { xml: false, xslt: false, out: false };

// XPath history and browsing state
let _xpathHistory = [];             // Most-recent-first
let _xpathHistoryCursor = -1;       // -1 = not browsing
let _xpathDraftExpr = '';           // Saves text while browsing history

// Decorations/highlights
let xpathDecorations = null;        // Monaco decoration collection
let xsltDecorations = null;         // Monaco decoration collection
let xmlDecorations = null;          // Monaco decoration collection

// XPath results state
let _showXPathGen = 0;              // Generation counter
let _lastXPathRenderArgs = null;    // For re-colorize on theme switch
```

### Console State (state.js)

```javascript
let clog_msgs = [];  // Array of { type, msg }
let consoleErrCount = 0;
let consoleWarnCount = 0;
// Console filters and search state managed by setConsoleFilter(), applyConsoleSearch()
```

### Debounce Timers (state.js)

```javascript
let xsltDebounce = null;            // Debounce XSLT validation
let xmlDebounce = null;             // Debounce XML validation
let saveDebounce = null;            // Debounce session save

const VALIDATION_DEBOUNCE_MS = 800;
const SAVE_DEBOUNCE_MS = 500;
```

### Saxon-JS Readiness (state.js)

```javascript
let saxonReady = false; // Set to true after window.SaxonJS loads
```

---

## DOM Structure

```html
<body class="light|dark">
  <div class="app-header">
    <!-- Logo, mode toggle (XSLT|XPath), Run button, Examples, etc. -->
  </div>

  <div class="workspace">
    <!-- Three-column layout: colLeft | colCenter | colRight -->

    <div id="colLeft" class="col">
      <!-- XML Input Pane + Toolbar -->
      <div id="xmlWrap" class="editor-wrap">
        <div id="xmlEd" class="monaco-editor"></div>
      </div>
    </div>

    <div id="colCenter" class="col [collapsed]">
      <!-- XSLT Pane + Console -->
      <div id="xsltWrap" class="editor-wrap">
        <div id="xsltEd" class="monaco-editor"></div>
      </div>
      <div id="consolePanel">
        <!-- Console with search, filters, minimize -->
      </div>
    </div>

    <div id="colRight" class="col [collapsed]">
      <!-- Output Pane + Headers + Properties -->
      <div id="outputSection">
        <div id="outWrap" class="editor-wrap">
          <div id="outEd" class="monaco-editor"></div>
        </div>
        <div id="hdrPanel" class="kv-panel"><!-- Headers --></div>
        <div id="propPanel" class="kv-panel"><!-- Properties --></div>
      </div>
      <div id="xpathResultsPanel" class="[visible]">
        <!-- XPath results with syntax highlighting -->
      </div>
    </div>
  </div>

  <div id="xpathBar" class="xpath-bar [hidden]">
    <!-- XPath input, hints, buttons -->
  </div>

  <div id="consolePanel" class="console-panel">
    <!-- Full-width console (in XPath mode) -->
  </div>

  <div id="statusBar">
    <!-- File mode pill, line:col, etc. -->
  </div>
</body>
```

---

## Key Design Patterns

### 1. Debouncing for Performance

**Pattern**: Use debounce timers to avoid excessive revalidation and persistence.

```javascript
// XSLT validation — debounce 800ms
editors.xslt.onDidChangeModelContent(() => {
  clearTimeout(xsltDebounce);
  xsltDebounce = setTimeout(() => {
    const src = eds.xslt.getValue();
    const result = validateXML(src);
    if (!result.ok) markErrorLine(eds.xslt, result.line, result.message);
  }, 800);
});

// Session save — debounce 500ms
function scheduleSave() {
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => {
    persistSession();
  }, 500);
}
```

**Why**: Validation on every keystroke would freeze the editor. Debouncing batches changes and improves responsiveness.

### 2. Model Isolation for Dual Modes

**Pattern**: Two separate Monaco XML models for XSLT vs XPath mode to prevent cross-contamination.

```javascript
// On startup, create both models
xmlModelXslt = monaco.editor.createModel(xmlContent, 'xml');
xmlModelXpath = monaco.editor.createModel(xmlContent, 'xml');

// In toggleXPath(), swap the active model
function toggleXPath() {
  xpathEnabled = !xpathEnabled;
  if (eds.xml && xmlModelXpath && xmlModelXslt) {
    eds.xml.setModel(xpathEnabled ? xmlModelXpath : xmlModelXslt);
  }
  // ... update UI
}
```

**Why**: Prevents validation decorations, highlights, and cursor positions from interfering between modes.

### 3. CPI Rewriting & JavaScript Extension Calls

**Pattern**: Rewrite XSLT namespace declarations and function calls to use Saxon-JS's extension function namespace.

```javascript
// Original XSLT
<xsl:stylesheet xmlns:cpi="http://example.org/cpi">
  <xsl:call-template name="set-header">
    <xsl:with-param name="h1" select="cpi:setHeader('exchange', 'X-Header', concat('prefix-', $id))"/>

// Rewritten XSLT
<xsl:stylesheet xmlns:js="http://saxonica.com/ns/globalJS" exclude-result-prefixes="js">
  <xsl:call-template name="set-header">
    <xsl:with-param name="h1" select="js:cpiSetHeader('exchange', 'X-Header', concat('prefix-', $id))"/>

// JavaScript interceptor
window.cpiSetHeader = (exchange, name, value) => {
  cpiCaptured.headers[name] = value;
  return '';
};
```

**Why**: Allows Saxon to evaluate complex XPath expressions (including `concat()`, variables, functions) before calling the interceptor with computed values. No regex extraction, 100% fidelity.

### 4. Suppression Flags for Synthetic Changes

**Pattern**: Use flags to skip validation after programmatic edits that shouldn't trigger error checking.

```javascript
function toggleXPath() {
  _suppressNextXmlChange = true;  // Set the flag
  eds.xml.setModel(newModel);     // Change model triggers onDidChangeModelContent
  // The event handler checks _suppressNextXmlChange and skips validation
  _suppressNextXmlChange = false; // Clear the flag
}
```

**Why**: Prevents stale error markers after loading examples or switching modes.

### 5. Generation Counters to Handle Async Completion

**Pattern**: Each async operation (XPath evaluation, colorization) increments a generation counter. Results check the counter before rendering.

```javascript
let _showXPathGen = 0;

async function _showXPathResults(items, errorMsg, isError) {
  const gen = ++_showXPathGen;  // Capture this run's generation

  // ... async work (awaiting monaco.editor.colorize())

  if (gen !== _showXPathGen) return; // A faster run has started, bail
  // ... render results
}
```

**Why**: If a user runs a second XPath faster than the first completes, the slow first run won't overwrite the new results.

---

## Loading Order & Initialization

The order in [../../index.html](../../index.html) is **critical**:

```html
<!-- 1. CSS first -->
<link rel="stylesheet" href="css/style.css">

<!-- 2. Vendor libs (Monaco, Saxon-JS) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/..."></script>
<script src="lib/SaxonJS2.js"></script>

<!-- 3. JS modules in dependency order -->
<script src="js/state.js"></script>      <!-- Global state, clog -->
<script src="js/mode-manager.js"></script>  <!-- Mode management (XSLT vs XPath) -->
<script src="js/validate.js"></script>   <!-- Validation, uses state -->
<script src="js/panes.js"></script>      <!-- UI helpers, uses state -->
<script src="js/transform.js"></script>  <!-- Transform logic, uses state, validate -->
<script src="js/examples-data.js"></script>  <!-- Example definitions -->
<script src="js/modal.js"></script>      <!-- Examples modal, uses examples-data -->
<script src="js/files.js"></script>      <!-- File I/O, uses state -->
<script src="js/ui.js"></script>         <!-- UI state, uses state -->
<script src="js/share.js"></script>      <!-- URL sharing, uses state, transform -->
<script src="js/xpath.js"></script>      <!-- XPath mode, uses validate, mode-manager -->
<script src="js/editor.js"></script>     <!-- Monaco setup, uses all above (last) -->
```

**Initialization sequence**:

1. **Browser parses HTML** → loads CSS
2. **Vendor libs load asynchronously** (Monaco, Saxon-JS)
3. **Module scripts execute in order**
4. **state.js** → Initializes global state, sets up saveDebounce
5. **mode-manager.js** → Registers mode switching logic
6. **validate.js** → Provides XML validation functions
7. **transform.js** → Registers transform button handler
8. ... (remaining modules register event handlers, await their dependencies)
9. **editor.js** (last) → Initializes Monaco editors, restores session, connects all handlers
10. **All modules loaded** → `saxonReady` flag triggers when Saxon-JS loaded
11. **On first user interaction** → Transform or XPath can run

### When is the App Ready?

```javascript
// Check these before allowing user actions:
if (!saxonReady) {
  clog('Saxon-JS not ready yet', 'error');
  return;
}
if (!eds.xml || !eds.xslt || !eds.out) {
  clog('Editors not initialized', 'error');
  return;
}
```

---

## Namespace Guidelines

### Global Variable Naming

**Public APIs** (used across modules):
- `eds` — Editor instances
- `xmlModelXslt`, `xmlModelXpath` — Monaco XML models
- `kvData` — Headers/properties data
- `saxophone` — Saxon-JS ready flag
- `clog()` — Console logging function
- Functions run by user: `runTransform()`, `runXPath()`, `toggleXPath()`, etc.

**Private to module** (prefixed with `_`):
- `_wrapState` — word wrap state
- `_xpathHistory` — expression history
- `_highlightXPath()` — internal highlighting
- `_rewriteCPICalls()` — internal CPI rewriting
- `_suppressNextXmlChange` — internal flag

### Why Prefixes?

With no module system, all variables are global. The `_` prefix signals "this is internal; don't call from other modules". Helps prevent namespace collisions and makes intentions clear.

### Avoid These Patterns

```javascript
// ❌ DON'T: Unprefixed global function (collides with DOM API or other libs)
function format(x) { ... }

// ✅ DO: Prefix with module identifier
function _panes_format(x) { ... }
// Or use the convention in panes.js:
function prettyXML(x) { ... } // Public to other modules; no underscore

// ❌ DON'T: Create new global without tracking
let someState = 'foo';

// ✅ DO: Initialize in state.js or the module that owns it
// Add to a clear initialization section with a comment
let _myModuleState = { foo: 'bar' }; // In my-module.js, prefixed
```

---

## Critical Constraints

These patterns prevent the most common bugs. See also `CLAUDE.md` Critical Constraints section.

### 1. Global Namespace

Public API functions: unprefixed (`runTransform()`). Private/internal: `_` prefix (`_rewriteCPICalls()`). Never add an unprefixed function without checking `state.js` for conflicts.

### 2. Editor Model Isolation

Always check `modeManager.isXpath` before reading/writing XML — the two modes use separate models (`xmlModelXslt` / `xmlModelXpath`). Using the wrong model corrupts content and decorations.

```javascript
// ✅ Correct
const model = modeManager.isXpath ? xmlModelXpath : xmlModelXslt;
return model.getValue();
```

### 3. Saxon Readiness

Always guard Saxon calls with `if (!saxonReady)`. Saxon loads async from CDN — buttons render before it's ready.

### 4. CPI Rewriting Fragility

`rewriteCPICalls()` in `transform.js` shifts error line numbers. Don't modify it without running the full CPI test suite (`npx playwright test --grep "CPI"`).

### 5. Validation Debouncing

Validation is debounced at 800ms. When making programmatic editor changes, set `_suppressNextValidation = true` first to avoid spurious error markers.

### 6. Share URL Limit

URLs cap at ~2,000 chars. Large XSLT + XML silently fail to encode. No warning is shown — users discover on load.

### 7. localStorage Versioning

Storage key is `xdebugx-session-v1`. If you change the saved-state schema, bump to `v2` — old sessions are silently ignored, users get a clean state.

### 8. Mode Switch Timing

Mode switches trigger UI animations (~1.5s). XPath-specific DOM elements don't exist in XSLT mode. Wait for `#xpathInput` before interacting:

```javascript
await modeManager.setMode('XPATH');
await page.waitForSelector('#xpathInput'); // in tests
```

### Pre-commit Checklist

- [ ] No new unprefixed globals — check `state.js`
- [ ] Saxon calls guarded with `saxonReady`
- [ ] Programmatic editor changes use `_suppressNextValidation`
- [ ] localStorage schema unchanged, or version bumped
- [ ] `rewriteCPICalls()` untouched, or CPI tests run

---

## Further Reading

- **[../../CONTRIBUTING.md](../../CONTRIBUTING.md)** — Code style, testing, PR process
- **[reference/features.md](reference/features.md)** — Complete 200+ feature catalog and API reference
- **[TRANSFORM.md](TRANSFORM.md)** — CPI simulation deep dive, error mapping
- **[../../README.md](../../README.md)** — User-facing features, getting started, keyboard shortcuts
