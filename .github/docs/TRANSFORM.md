---
description: "CPI simulation rewriting, Saxon-JS transform execution, namespace handling, param injection, error line mapping. Use when modifying transform.js, debugging CPI simulation, fixing namespace issues, updating interceptors."
applyTo: "js/transform.js"
---

# Transform Module Guidelines

## Purpose

Orchestrates XSLT transformation execution with SAP CPI runtime simulation:
- Rewrites `cpi:` extension calls → `js:` namespace interceptors
- Injects headers/properties as `xsl:param` values
- Captures `cpi:setHeader` / `cpi:setProperty` output
- Intercepts `xsl:message` traces
- Manages Output Headers/Properties panels

## Critical Components

### 1. rewriteCPICalls(xslt)

Rewrites XSLT to use Saxon-JS JavaScript extension functions.

**Input:** Original XSLT with `cpi:` calls
**Output:** `{ rewritten, hasCPI }` — `rewritten` is the (possibly modified) XSLT string; `hasCPI` is a boolean flag callers use to decide whether to install JS interceptors. When no `cpi:*` calls are present, the function returns `{ rewritten: <original xslt>, hasCPI: false }` (early return — no transformation).

**Transformations (only when `hasCPI` is true):**
1. Replace `xmlns:cpi="..."` → `xmlns:js="http://saxonica.com/ns/globalJS"` (or strip `xmlns:cpi` entirely if `xmlns:js` is already declared)
2. Strip `cpi` from `exclude-result-prefixes` (if the resulting list is empty, the entire attribute is removed). NOTE: `js` is **not** added here — that's `ensureJsExcluded`'s job (called separately by `runTransform`).
3. Rewrite function calls: `cpi:setHeader(` → `js:cpiSetHeader(`
4. Same for `setProperty`

**Reads:** `cpi:getHeader` / `cpi:getProperty` are deliberately **not** simulated — CPI does not expose them. Headers/Properties are read by declaring `<xsl:param name="X"/>`, populated by `buildParamsXPath()` from the Headers/Properties panels.

**Comment/CDATA safety:** `_extractInsensitiveRegions()` swaps out `<!-- ... -->` and `<![CDATA[ ... ]]>` regions with placeholders before rewriting, then restores them. Placeholders preserve newline counts so Saxon-reported line numbers stay accurate.

**Why this works:**
- Saxon-JS evaluates ALL function arguments before calling JS interceptors
- Dynamic expressions (`concat()`, XPath paths, variables) are fully computed
- No regex extraction of argument values needed

**Edge case:** If `xmlns:js` already exists in XSLT, don't duplicate it.

### 2. ensureJsExcluded(xslt)

Prevents `js:` namespace from leaking into output. **Status: actively called** by `runTransform()` immediately after `rewriteCPICalls()` (transform.js ~L529, unconditionally — runs even when CPI rewriting did nothing, in case the user authored their own `xmlns:js`). This is the step that actually adds `js` to `exclude-result-prefixes`; `rewriteCPICalls` only strips `cpi`.

**Rule:** `exclude-result-prefixes` must include `js` to mirror CPI runtime

**Scenarios:**
- No `xmlns:js` declared at all → no-op (early return)
- `xmlns:js` declared, no `exclude-result-prefixes` → inject `exclude-result-prefixes="js"` on `<xsl:stylesheet>` / `<xsl:transform>`
- `xmlns:js` declared, has `exclude-result-prefixes` → append `"js"` to value (de-duped)

**Critical:** Without this, output XML gets polluted with `xmlns:js="..."`.

### 3. buildParamsXPath()

Constructs Saxon-JS `stylesheet-params` map from Headers/Properties panels.

**Format:**
```javascript
'stylesheet-params': map { 
  QName('','exchange'): 'exchange',
  QName('','SAPClient'): '100',
  QName('','TargetSystem'): 'ECC'
}
```

**Validation:**
- NCName check: params must start with letter/underscore
- Invalid names skipped with console warning
- Values escaped: single quotes doubled (`'` → `''`)

**Always inject:** a dummy `exchange` stylesheet-param (`QName('','exchange'): 'exchange'`) so stylesheets that declare an `<xsl:param name="exchange"/>` don't error. All other params come solely from `kvData.headers` ++ `kvData.properties` (properties win on name collision; a warning is logged).

**Note:** Do not confuse this `exchange` stylesheet-param with the `_exchange` argument passed to JS interceptors (see "JavaScript Interceptors" below). They are unrelated — `_exchange` is the implicit first argument Saxon-JS passes to every `js:` extension function call site, not a param injected here.

### 4. JavaScript Interceptors

Installed during transform if `cpi:` calls detected. Saxon-JS passes the implicit Saxon "context" object as the first argument (we name it `_exchange` — underscore prefix, **not** `$exchange`; the dollar sign is XPath syntax, not JavaScript). It's accepted but unused by these handlers.

```javascript
window.cpiSetHeader = (_exchange, name, value) => {
  cpiCaptured.headers[_cpiStrVal(name)] = _cpiStrVal(value);
  return '';  // Empty string return mirrors CPI
};
```

**Value coercion:** `_cpiStrVal()` handles Saxon-JS types (nodes, arrays, objects) → strings. **It is defined as a closure inside `runTransform()`**, not a module-level helper — each transform run gets its own copy. If you need the same coercion elsewhere, hoist it deliberately rather than relying on a global.

**Cleanup:** Restore previous `window.cpi*` functions (or `delete` them if previously absent) in the `finally` block after the transform completes.

### 5. xsl:message Interception

Saxon-JS logs messages as `console.log("xsl:message: <text>")`.

**Patch:**
```javascript
const _origConsoleLog = console.log;
console.log = function(...args) {
  const first = args[0];
  if (typeof first === 'string' && first.startsWith('xsl:message: ')) {
    _xslMessages.push(first.slice(13));
  } else {
    _origConsoleLog.apply(console, args);
  }
};
```

The explicit `typeof first === 'string'` guard (rather than `args[0]?.startsWith(...)`) is intentional — Saxon-JS may call `console.log` with non-string first arguments (numbers, objects), and `?.startsWith` would throw `TypeError` on those.

**Post-transform flush order:** Messages are flushed via `clog()` **before the final completion log on success and before the error log on failure** — this preserves natural execution order (trace → outcome) in the console panel. The patched `console.log` is restored in the `finally` block immediately after.

**Special case:** `terminate="yes"` is logged as a warning (`xsl:message terminate="yes" — ...`), not an error.

## Modification Guidelines

### Adding New CPI Functions

Example: Add `cpi:deleteHeader` support

1. **Update rewriteCPICalls:**
   ```javascript
   xslt = xslt.replace(/cpi:deleteHeader\s*\(/g, 'js:cpiDeleteHeader(');
   ```

2. **Add interceptor:**
   ```javascript
   window.cpiDeleteHeader = (_exchange, name) => {
     const key = _cpiStrVal(name);
     delete cpiCaptured.headers[key];
     return '';
   };
   ```

3. **Cleanup:**
   ```javascript
   _prevCpiDeleteHeader = window.cpiDeleteHeader;
   // ... run transform ...
   window.cpiDeleteHeader = _prevCpiDeleteHeader;
   ```

### Debugging Rewriting Issues

**Check console for:**
- `CPI extension calls detected — rewriting to js: namespace`
- `Passing xsl:params: [list]`

**Verify rewritten XSLT:**
```javascript
// Add temporary logging in runTransform():
const { rewritten, hasCPI } = rewriteCPICalls(xsltSrc);
if (hasCPI) {
  console.log('--- REWRITTEN XSLT ---\n', rewritten);  // DEBUG
  xsltSrc = rewritten;
}
```

**Common issues:**
- Regex doesn't match due to whitespace around `(`
- `exclude-result-prefixes` injection fails if `<xsl:stylesheet>` is multiline
- NCName validation rejects valid params with `.` or `-`

### Error Line Mapping Fragility

**Problem:** Saxon error line numbers refer to rewritten XSLT, not original.

**Why it's hard:**
- Rewriting adds/removes lines (`xmlns:js`, stripped `cpi` namespace)
- XPath expressions in predicates can't be reliably line-mapped

**Current mitigation:**
- `findXPathExpressionLine()` searches original XSLT for error text
- Only works for lines with unique text
- Fails if expression appears multiple times

**Don't:**
- Rely on exact line numbers for complex errors
- Add more rewriting steps (increases mapping drift)

**Do:**
- Keep error messages informative with context
- Use `xsl:message` debugging instead of error line hunting

### Performance Considerations

**Spinner minimum duration:**
- Run button shows spinner for minimum 300ms
- Ensures visual feedback even for fast transforms
- Only applied if Saxon was actually invoked (not on pre-flight failures)

**Debouncing:**
- Validation debounced at 800ms (handled by `panes.js`)
- `persistSession()` also debounced at 800ms
- Don't add transform debouncing (user expects immediate execution)

### Memory Management

**Cleanup required:**
- Restore `console.log` after transform
- Restore CPI interceptor functions
- Clear `cpiCaptured` object
- Reset error counters

**Don't leak:**
- Don't keep references to old XSLT strings
- Don't accumulate `_xslMessages` across runs
- Always restore `window.*` functions even on error

## Testing Pattern

**Unit-testable functions:**
- `rewriteCPICalls(xslt)` — pure function, no side effects
- `ensureJsExcluded(xslt)` — pure function
- `isValidNCName(name)` — pure function
- `buildParamsXPath()` — depends on `kvData` global

**Integration testing:**
1. Load example with CPI calls
2. Add headers to input panels
3. Run transform
4. Verify Output Headers captured
5. Check console for expected messages

**Regression tests:**
- Identity transform (no CPI)
- CPI setHeader with static string
- CPI setHeader with `concat()`
- CPI setHeader with XPath expression
- Invalid param names (skip with warning)
- Namespace already declared edge cases

## CPI Simulation in Mode Context

### XPath Mode — CPI Disabled

**Key Fact:** CPI simulation is **only available in XSLT mode**. XPath mode disables CPI functionality.

**Why:**
- XPath mode has no concept of "headers/properties" (XPath is pure expression evaluation)
- The Headers and Properties UI panels are **hidden in XPath mode by `mode-manager.js`** (`updateUI()` toggles `display: none` based on `isXslt`); `kvData` itself is never cleared
- The XPath evaluation path doesn't read `kvData` regardless of UI state — even if the panels were forced visible, edits would not feed into `xpath.js`

**Behavior Summary:**

| Element | XSLT Mode | XPath Mode |
|---------|-----------|------------|
| **Headers Panel** | Visible, editable | Hidden (CSS `display: none`) |
| **Properties Panel** | Visible, editable | Hidden (CSS `display: none`) |
| **CPI Functions** (`cpi:setHeader`, etc.) | Rewritten at runtime | Not applicable; Error if code includes `cpi:*` calls in XPath expression |
| **CPI Rewriting** | Active: XSLT → JS namespace conversion | N/A |
| **localStorage Persistence** | Headers/properties saved in `kvData` | XPath expressions saved in `_xpathHistory` (separate storage) |

**Testing Pattern:**
```javascript
// ✅ CPI works correctly in XSLT mode
await editor.switchToXslt();
await editor.addHeader('X-MyHeader', 'test-value');
await editor.runTransform();  // Headers passed to CPI interceptors

// ❌ CPI is disabled in XPath mode
await editor.switchToXpath();
const headers = await editor.getHeaderCount();
expect(headers).toBe(0);      // Headers panel not visible, kvData not accessible
```

**Error on CPI in XPath:**
If XPath input contains `cpi:` namespace calls:
```xslt
xdebugx:cpi:setHeader('X-MyHeader', 'val')  // ❌ XSLT only
```
Result: Saxon XPath evaluator rejects `cpi:` namespace as undefined. No graceful fallback.

---

## Error Line Mapping Across Modes

### Mapping Stability After Mode Switches

**Question:** Are error line numbers preserved when switching between XSLT and XPath modes?

**Answer: Yes, with caveats.**

**How it works:**
1. XSLT mode: Rewriting (`rewriteCPICalls` + `ensureJsExcluded`) happens **inside `runTransform()` against a local string** (`_xsltRewritten` / `xsltSrc`). The rewritten XSLT is handed to Saxon-JS and discarded; it is **never written back to the editor model** (`eds.xslt` keeps the user's original source verbatim).
2. Saxon error line numbers therefore refer to a transient rewritten buffer that no longer exists once the transform returns. `findXPathExpressionLine()` text-searches the **original** XSLT in the editor for the failing expression and remaps the line for highlighting.
3. Mode switch to XPath / back to XSLT: only the Monaco model swaps (`xmlModelXslt` ↔ `xmlModelXpath`); the XSLT editor content is untouched, so the next run produces the same rewriting and same line mapping.

**Safe Expectation:**
- Error line numbers are consistent **for the same XSLT code within one session**
- If you edit XSLT, rewriting happens again, and line mappings may shift
- Line mapping fragility is unchanged by mode switching

**Risky Case:**
```javascript
await editor.runTransform();   // XSLT errors on line 50 (rewritten XSLT)
await editor.switchToXpath();  // Mode switch
await editor.switchToXslt();   // Back to XSLT
await editor.runTransform();   // Same error? Yes, if XSLT unchanged
```

If XSLT is edited between transforms:
```javascript
await editor.setXslt('/* modified XSLT */');
await editor.runTransform();   // Line numbers may shift!
```

**Testing Pattern:**
```javascript
// ✅ Verify line numbers don't shift on mode switch (XSLT unchanged)
const errors1 = await editor.getErrors();
await editor.switchToXpath();
await editor.switchToXslt();
const errors2 = await editor.getErrors();
expect(errors1).toEqual(errors2);  // Same errors, same line numbers

// ❌ Line numbers may shift if XSLT modified
const errors1 = await editor.getErrors();
await editor.setXslt(newXslt);
const errors2 = await editor.getErrors();
// errors1[0].line !== errors2[0].line  — possible!
```

---

## Console.log Patching & xsl:message in Modes

### How xsl:message Output Appears

**In XSLT Mode:**
```xslt
<xsl:message>Transform started</xsl:message>
```
→ Captured by patched `console.log()` → Appears in **Console Panel** with type `'info'`

**In XPath Mode:**
```xslt
(same <xsl:message>, but XPath evaluator doesn't have <xsl:message>)
```
→ XPath has no `<xsl:message>` element; only expressions
→ Messages from XPath expressions **do not appear** in console
→ Only return value of expression is shown in results

**Key Differences:**

| Feature | XSLT Mode | XPath Mode |
|---------|-----------|------------|
| **`<xsl:message>`** | ✅ Captured to console | N/A (no XSLT template) |
| **`console.log()` patching** | Active (all transform runs) | N/A (no transform runs) |
| **Output Messages** | From XSLT, debugged in console | XPath expression results only |
| **Sidebar Console** | Populated after transform | Empty (message history auto-clears on mode switch) |

**Testing Pattern - XSLT Mode:**
```javascript
await editor.switchToXslt();
await editor.setXslt(`
  <xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/">
      <xsl:message>Debug: Starting transform</xsl:message>
      <root/>
    </xsl:template>
  </xsl:stylesheet>
`);
await editor.runTransform();

const messages = await editor.getConsoleMessages();
expect(messages.some(m => m.msg.includes('Debug: Starting'))).toBe(true);  // ✅
```

**Testing Pattern - XPath Mode:**
```javascript
await editor.switchToXpath();
await editor.setXPathInput('count(//Item)');
const results = await editor.evaluateXPath();

// ✅ Results shown as number, not message
expect(results).toMatch(/^\d+/);  // E.g., "42"

// Note: No console messages appear; XPath is pure computation
```

---

## Common Pitfalls

**Don't:**
- Modify `lib/SaxonJS2.js` (vendor file)
- Add `xmlns:js` manually in XSLT (conflicts with rewriting)
- Assume error line numbers are accurate
- Call CPI interceptors directly from JS (only Saxon should invoke them)
- Mutate `xsltSrc` after passing to Saxon
- Attempt to use CPI functions in XPath mode (namespace error)
- Assume `<xsl:message>` works in XPath mode (it doesn't)

**Do:**
- Always check `saxonReady` before running transform
- Clear error counters at start of each run
- Log CPI detection to console
- Validate NCNames before building params
- Clean up interceptors even on error path
- Verify mode context before testing CPI or `<xsl:message>` features
- Use `modeManager.isXslt` / `modeManager.isXpath` getters to assert current mode in timing-sensitive tests (there is no `getMode()` method on `ModeManager` — the public surface is the `isXslt`/`isXpath` boolean getters and `setMode(mode)` / `isMode(mode)`)

## References

- [Saxon-JS JavaScript extension functions](https://www.saxonica.com/saxon-js/documentation/#!extensibility/js-calls)
- [SAP CPI scripting API](https://help.sap.com/docs/cloud-integration/)
- [XPath 3.1 specification](https://www.w3.org/TR/xpath-31/)
