# XSLTDebugX Development Guide

Quick-start guide for local development, debugging, and testing XSLTDebugX.

## Table of Contents

- [Local Setup](#local-setup)
- [Running the App Locally](#running-the-app-locally)
- [Debugging in Browser](#debugging-in-browser)
- [Making Changes](#making-changes)
- [Testing Checklist](#testing-checklist)
- [Troubleshooting](#troubleshooting)
- [Performance Tips](#performance-tips)

---

## Local Setup

### Prerequisites

- **Git** — for cloning the repo
- **A static HTTP server** — see [Running the App Locally](#running-the-app-locally)
- **A modern browser** — Chrome, Firefox, Safari, or Edge
- **Node.js** — required if you want to run tests or build for production; optional for local dev

### Clone the Repository

```bash
git clone https://github.com/linusdevx/XSLTDebugX.git
cd XSLTDebugX
```

No build step needed for local dev (use `npm run serve` from `package.json`); `npm install` required if you want to run tests or build for production.

---

## Running the App Locally

Choose any of these static HTTP server options:

### Option 1: npm run serve (recommended)

After running `npm install` once, use the script defined in `package.json`:

```bash
npm run serve
# Runs `http-server -p 8000 -c-1`
# Accepting connections at http://localhost:8000
```

### Option 2: Node.js + serve (global)

```bash
npm install -g serve  # One-time setup
serve .
# Output: Accepting connections at http://localhost:3000
```

### Option 3: Python 3

```bash
python -m http.server 8000
# Serving HTTP on 0.0.0.0 port 8000 (http://localhost:8000/)
```

### Option 4: Python 2 (legacy)

```bash
python -m SimpleHTTPServer 8000
# Serving HTTP on 0.0.0.0 port 8000 (http://localhost:8000/)
```

### Option 5: PHP

```bash
php -S localhost:8000
# Development Server started at http://localhost:8000
```

### Option 6: VS Code Live Server Extension

1. Install extension: `ritwickdey.LiveServer`
2. Right-click `index.html` → **Open with Live Server**
3. Browser opens automatically at `http://127.0.0.1:5500`

### Verify It Works

1. Open the served URL in your browser (e.g., `http://localhost:8000`)
2. Press `F12` to open DevTools → **Console** tab
3. You should see no red errors, and the app should be fully interactive
4. Click **Examples** → select a transform example → press **Ctrl+Enter**
5. Verify output appears and no console errors appear

---

## Debugging in Browser

### Opening DevTools

| OS | Shortcut |
|---|---|
| Windows/Linux | `F12` or `Ctrl+Shift+I` |
| macOS | `Cmd+Option+I` |

### Console Logging

XSLTDebugX logs via the `clog()` function:

```javascript
clog('My message', 'info');      // Blue info
clog('Success!', 'success');     // Green success
clog('Warning', 'warn');         // Amber warning
clog('Error occurred', 'error'); // Red error
```

All messages appear in the app's **Console** panel (bottom of the app) and in DevTools Console.

### Console Panel in XSLTDebugX

The built-in console shows:
- Transform status, errors, messages
- `xsl:message` output from stylesheets
- `clog()` entries from JavaScript
- Interactive filters (Info, Success, Warn, Error)
- Search box to filter messages
- Minimize/maximize button

### Breakpoints & Stepping

Set breakpoints in DevTools **Debugger** tab:

```javascript
// In js/transform.js
function runTransform() {
  if (!saxonReady) { ... }
  // Click the line number gutter to set a breakpoint
  const btn = document.getElementById('runBtn');
  // ... step through with F10
}
```

### Inspecting State

In the DevTools Console, access global variables directly:

```javascript
// Check editor state
> eds
{ xml: Editor, xslt: Editor, out: Editor }

// Check current XML content
> eds.xml.getValue()
"<?xml version="1.0"?>..."

// Check if Saxon is ready
> saxonReady
true

// Check stored headers/properties
> kvData
{ headers: [{id: 1, name: 'X-Custom', value: 'test'}, ...], properties: [...] }

// Check persisted session
> JSON.parse(localStorage.getItem('xdebugx-session-v1'))
{ xmlXslt: "<?xml...?>", xmlXpath: "<?xml...?>", xslt: "...", headers: [...], properties: [...], ... }

// Check XPath history
> _xpathHistory
["//element", "//element[@attr]", ...]
```

### Network Tab

Check that vendor libraries load correctly:

| Resource | Expected Source | Cache |
|---|---|---|
| `lib/SaxonJS2.js` | Local file | No cache |
| `index.html` | Local file | No cache |
| `css/style.css` | Local file | No cache |
| `js/*.js` | Local files | No cache |
| `pako.min.js` | `cdnjs.cloudflare.com` (gzip for share-URL payloads) | CDN cache |
| Monaco loader (`vs/loader.js`) + worker chunks | `cdn.jsdelivr.net/npm/monaco-editor@…` | CDN cache |
| Lucide icons | `cdn.jsdelivr.net/npm/lucide@…` | CDN cache |

**Under Cloudflare Pages** (production deployment):
- App code (`/js/*`, `/css/*`) — `Cache-Control: no-store`
- Vendor (`/lib/*`) — `Cache-Control: public, max-age=604800` (7 days)

### Storage Tab (localStorage)

View persisted session data:

1. DevTools → **Application** tab
2. Left sidebar → **Storage** → **localStorage**
3. Look for key: `xdebugx-session-v1`
4. Click to view the JSON object

Session contents (keys saved by `saveState()` in `js/state.js`):
```json
{
  "xmlXslt": "<?xml version='1.0'?>...",        // XML in XSLT mode
  "xmlXpath": "<?xml version='1.0'?>...",       // XML in XPath mode
  "xslt": "<?xml version='1.0'?>...",           // XSLT stylesheet
  "headers": [{"name": "X-Auth", "value": "token"}],
  "properties": [],
  "leftCollapsed": false,
  "rightCollapsed": true,
  "centerCollapsed": false,
  "xpathExpr": "",
  "xpathEnabled": false,
  "lastExampleKey": null,
  "savedAt": 1717200000000
}
```

Note: the last transform output is **not** stored — it's recomputed on demand.

Clear session for a fresh start:

```javascript
// In DevTools Console
localStorage.removeItem('xdebugx-session-v1');
location.reload();
```

---

## Making Changes

### Typical Workflow

1. **Start local server** (see [Running the App Locally](#running-the-app-locally))
2. **Open app in browser**
3. **Open DevTools** (F12)
4. **Edit a JavaScript file** in your editor (e.g., `js/transform.js`)
5. **Refresh browser** (`Ctrl+R`)
6. **See your changes immediately** (no build step!)
7. **Check DevTools Console** for any errors

### Example: Adding a New Helper Function

```javascript
// js/transform.js

// ════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════

// Format a value for CPI parameter (copied from similar code)
function _cpiStrVal(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(_cpiStrVal).join('');
  if (v instanceof Node) return v.textContent ?? '';
  return String(v);
}

// Use it in runTransform()
if (hasCPI) {
  window.cpiSetHeader = (_exchange, name, value) => {
    const nameStr = _cpiStrVal(name);
    const valueStr = _cpiStrVal(value);
    cpiCaptured.headers[nameStr] = valueStr;
    return '';
  };
}
```

### Example: Adding a New UI Button

```html
<!-- index.html -->
<button id="myNewBtn" class="btn btn-primary" title="My New Feature">
  ⭐ New Feature
</button>
```

```javascript
// js/ui.js (or a new module)

// Initialize the button handler
document.getElementById('myNewBtn')?.addEventListener('click', () => {
  clog('My new feature was clicked!', 'success');
  // Do something useful here
});
```

---

## Testing Checklist

Before committing or submitting a PR, verify:

### ✅ Functional Tests

- [ ] **XSLT Mode** — Load an example, run it, output appears without errors
- [ ] **XPath Mode** — Toggle to XPath, enter expression, nodes highlight in XML
- [ ] **Keyboard Shortcuts** — Ctrl+Enter runs, Ctrl+B toggles mode, Ctrl+T toggles theme
- [ ] **Theme Toggle** — Switch dark/light, colors update correctly in all panes
- [ ] **localStorage Persistence** — Refresh browser, state is restored
- [ ] **Headers/Properties** — Add rows, run transform, values inject as `xsl:param`
- [ ] **CPI Simulation** — Test `cpi:setHeader`, `cpi:getHeader`, `cpi:setProperty`, `cpi:getProperty`
- [ ] **File Operations** — Upload files, download output, drag-and-drop works
- [ ] **Examples** — Load examples from all 6 categories, no errors
- [ ] **Console** — Search, type filters, minimize, auto-expand on error all work

### ✅ Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile (iPhone Safari, Android Chrome)

### ✅ Performance

- [ ] Small XML/XSLT transforms — complete in <500ms
- [ ] Medium inputs (~100KB each) — complete in <2s, no UI freeze
- [ ] Large inputs (>1MB) — no hang, spinner visible, responsive to scroll
- [ ] XPath evaluation on large documents — UI stays responsive

### ✅ Code Quality

- [ ] No console errors or warnings (except expected warnings from user input)
- [ ] No broken links in documentation
- [ ] Comments explain complex logic
- [ ] Variable names are clear and follow conventions (camelCase, `_privatePrefix`)
- [ ] No hardcoded values — use constants defined at module top

### ✅ Examples Library

- [ ] All ~60+ examples load without errors (current count is in `js/examples-data.js`)
- [ ] Example icons, labels, descriptions are correct
- [ ] Categories filter correctly in modal
- [ ] XPath hints display when loading XPath examples

---

## Troubleshooting

### Issue: "Saxon-JS not ready yet"

**Cause**: Saxon-JS library failed to load from CDN.

**Solution**:
1. Check DevTools **Network** tab — does `lib/SaxonJS2.js` have a 200 status?
2. Check that you're accessing via HTTP (not `file://`)
3. Try a different server option (see [Running the App Locally](#running-the-app-locally))
4. Clear browser cache: DevTools → **Storage** → **Clear All**

### Issue: Cannot read property 'getValue' of null

**Cause**: Monaco editors haven't initialized yet.

**Solution**:
1. In DevTools Console, check: `> eds.xml`
2. Should show an Editor object, not null
3. If null, wait a few seconds for editors to initialize
4. Check for JavaScript errors in the Console

### Issue: localStorage data is not persisting

**Cause**: localStorage disabled in browser or private browsing mode.

**Solution**:
1. Check: Settings → Privacy → disable "Always use private browsing"
2. Or: Allow the site to store data → Settings → **Cookies and other site data**
3. Check DevTools **Application** → **Storage** → localStorage is available

### Issue: Transform runs but output is empty

**Cause**: XSLT produced no output, or output was serialized strangely.

**Solution**:
1. Check DevTools Console for `xsl:message` output or warnings
2. Verify XSLT has an `<xsl:output>` method declaration:
   ```xml
   <xsl:output method="xml" indent="yes"/>
   ```
3. Add `<xsl:message>` to debug:
   ```xml
   <xsl:message>DEBUG: value = <xsl:value-of select="$myVar"/></xsl:message>
   ```
4. Check that XSLT is not in a format-only mode (no output pane would be generated)

### Issue: XPath expression highlights don't appear

**Cause**: Expression has no matches, or XML is invalid.

**Solution**:
1. Check the results panel — does it say "No matches found"?
2. Verify XML is valid (DevTools Console shows no red XML errors)
3. Try simpler expression: `//*` should match all elements
4. Check XPath syntax: `/Orders/Order[@id='123']/Amount` (predicates need quotes)

### Issue: Console messages are not appearing

**Cause**: Console filter is hiding them, or filter is set to wrong type.

**Solution**:
1. Check **Console** panel → look for filter buttons (Info, Warn, Error, Success)
2. Make sure the filter type is not hidden
3. Check the search box — clear any active search
4. Try `clog('test', 'info')` in DevTools Console to verify clog works

### Issue: Large files cause the app to freeze

**Cause**: No debouncing on validation, or slow regex in syntax highlighting.

**Solution**:
1. Check that debounce timers are set (`xsltDebounce`, `xmlDebounce` = 800ms)
2. Minimize input size if possible (use representative samples, not full production data)
3. Use Firefox (often faster with large DOM trees than Chrome)
4. Open DevTools **Performance** tab, record, and look for bottlenecks

---

## Performance Tips

### Validation Debounce

Validation is debounced to 800ms to avoid freezing on rapid keystrokes. The value is the literal `800` in `editor.js` (and matched by `xsltDebounce` / `xmlDebounce` / the save debounce in `state.js`) — there is no named constant. Adjust the literal directly if you want faster or slower feedback (faster is rarely worth it).

### Large Transform Optimization

For transforms >500ms:

1. **Use `xsl:message` to trace execution**:
   ```xml
   <xsl:message>Processing <xsl:value-of select="count(//Record)"/> records...</xsl:message>
   ```

2. **Enable "Show Spinner"** — Already enabled, min 300ms visible feedback

3. **Profile Saxon execution** — Use `performance.now()` in console:
   ```javascript
   const t0 = performance.now();
   // ... trigger transform
   const t1 = performance.now();
   console.log(`Transform took ${(t1 - t0).toFixed(1)}ms`);
   ```

### XPath Performance

XPath evaluation is generally fast, but large document selection can slow:

1. **Use indexed predicates**: `//Record[1]` is faster than `//Record[@id='x']`
2. **Avoid recursive descent**: `//*` is slower than `/Root/Record`
3. **Test with representative data**, not full production datasets

---

## Browser Debugging Reference

### Useful DevTools Console Commands

```javascript
// Inspect live state
window.eds              // { xml, xslt, out } Monaco instances
window.kvData           // { headers: [...], properties: [...] }
window.saxonReady       // true if Saxon-JS loaded
window.modeManager      // { isXpath, setMode(), ... }

eds.xml.getValue()      // Current XML content
eds.xslt.getValue()     // Current XSLT content
modeManager.isXpath     // true = XPath mode, false = XSLT mode

// localStorage
localStorage.getItem('xdebugx-session-v1')   // Session state
localStorage.getItem('xdebugx-xpath-history') // Last 20 XPath expressions
localStorage.clear()                           // Wipe and start fresh
```

### Common Debugging Tasks

**"Transform won't run"**
```javascript
console.log(saxonReady);              // Must be true
console.log(eds.xslt.getValue());    // Empty?
console.log(modeManager.isXpath);   // Must be false for XSLT
```

**"Mode switch breaks things"**
```javascript
console.log(eds.xml.getModel());    // Check active model
// Mode switch takes ~1.5s — code running too soon?
await new Promise(r => setTimeout(r, 2000));
```

**"CPI headers not captured"**
```javascript
console.log(window.kvData);         // Headers populated?
console.log(modeManager.isXpath);  // Must be false — CPI is XSLT-only
```

**"Storage won't restore"**
```javascript
const stored = localStorage.getItem('xdebugx-session-v1');
try { JSON.parse(stored); } catch(e) { console.error('Corrupt:', e); }
localStorage.clear(); location.reload();  // Fresh start
```

**"XPath won't evaluate"**
```javascript
console.log(modeManager.isXpath);  // Must be true
document.getElementById('xpathInput').value;  // Expression set?
// Try simple expression first: //Item
```

### Quick State Dump (for bug reports)

```javascript
console.log(JSON.stringify({
  xml: eds.xml.getValue(),
  xslt: eds.xslt.getValue(),
  mode: modeManager.isXpath ? 'XPATH' : 'XSLT',
  kvData: window.kvData,
  saxonReady: window.saxonReady
}, null, 2));
```

### Chrome DevTools Tips

- **Pause on exception:** Console → ⚙️ → "Pause on exceptions"
- **Local Overrides:** Sources → Overrides — edit files without reloading
- **Useful breakpoints:** `runTransform()` in `transform.js`, `rewriteCPICalls()` in `transform.js`, `setMode()` in `mode-manager.js`

---

## Next Steps

- Read [../../CONTRIBUTING.md](../../CONTRIBUTING.md) for code style and PR process
- Read [ARCHITECTURE.md](ARCHITECTURE.md) for module structure, data flow, and critical constraints
- Check [reference/features.md](reference/features.md) for the feature catalog and [TRANSFORM.md](TRANSFORM.md) for CPI patterns
