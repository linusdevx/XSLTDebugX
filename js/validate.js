// ════════════════════════════════════════════
//  XSLT VALIDATION & MONACO MARKERS
// ════════════════════════════════════════════

// Track decoration collections per editor
let xsltDecorations = null;
let xmlDecorations  = null;

// Clear all markers and decorations from both editors
function clearAllMarkers() {
  // Clear markers on both XML models — prevents stale markers on inactive model
  if (xmlModelXslt)  monaco.editor.setModelMarkers(xmlModelXslt,  'xsltdebugx', []);
  if (xmlModelXpath) monaco.editor.setModelMarkers(xmlModelXpath, 'xsltdebugx', []);
  if (eds.xslt)      monaco.editor.setModelMarkers(eds.xslt.getModel(), 'xsltdebugx', []);
  if (xsltDecorations) { xsltDecorations.clear(); xsltDecorations = null; }
  if (xmlDecorations)  { xmlDecorations.clear();  xmlDecorations  = null; }
}

// Set a red squiggle + glyph on a specific line in an editor
function markErrorLine(editor, lineNumber, message, oldDecor) {
  // Always clear the previous decoration collection before creating a new one
  if (oldDecor) { try { oldDecor.clear(); } catch(e) {} }
  const model = editor.getModel();
  const lineCount = model.getLineCount();
  const line = Math.min(Math.max(lineNumber, 1), lineCount);
  const lineLen = model.getLineLength(line);

  // Monaco marker (squiggle underline)
  monaco.editor.setModelMarkers(model, 'xsltdebugx', [{
    startLineNumber: line, startColumn: 1,
    endLineNumber:   line, endColumn: lineLen + 1,
    message,
    severity: monaco.MarkerSeverity.Error,
  }]);

  // Glyph + line background decoration
  const dec = editor.createDecorationsCollection([
    {
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: 'xf-error-line-bg',
        glyphMarginClassName: 'xf-error-glyph',
        glyphMarginHoverMessage: { value: '**Error:** ' + message },
      }
    }
  ]);

  // Scroll to the error line
  editor.revealLineInCenter(line);

  return dec;
}

// Try to parse XML using DOMParser; return { ok, line, col, message }
function validateXML(src) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(src, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (!err) return { ok: true };

  // Firefox/Chrome put the error text in the parsererror element
  const text = err.textContent || '';

  // Try to extract line number — format varies by browser
  // Chrome:  "error on line 7 at column 3"
  // Firefox: "XML Parsing Error: ... Line Number 7, Column 3"
  let line = 1, col = 1;
  const lineMatch = text.match(/line[\s:]+([0-9]+)/i) ||
                    text.match(/Line Number\s+([0-9]+)/i);
  const colMatch  = text.match(/column[\s:]+([0-9]+)/i) ||
                    text.match(/Column\s+([0-9]+)/i);
  if (lineMatch) line = parseInt(lineMatch[1]);
  if (colMatch)  col  = parseInt(colMatch[1]);

  // Clean up the message — strip leading <?xml...?> declaration and the
  // "This page contains the following errors:" Chrome wrapper, then take
  // the most informative line. Falls back to the raw first line if our
  // cleaners eat everything (defensive).
  const message = _cleanDomParserMessage(text);
  return { ok: false, line, col, message };
}

// Strip browser noise from a DOMParser parsererror textContent.
// Chrome wraps the real error in:
//   "This page contains the following errors:\nerror on line N at column M: <real>\n..."
// Firefox uses a different shape. Returns the cleanest single-line message we can find.
function _cleanDomParserMessage(text) {
  if (!text) return 'XML parse error';
  // Remove common wrappers
  let cleaned = text
    .replace(/<\?xml[^?]*\?>\s*/i, '')
    .replace(/^This page contains the following errors:\s*/i, '')
    .replace(/Below is a rendering of the page.*$/is, '')
    .trim();
  // Take the most informative line — prefer one starting with "error " or
  // containing ":", else fall back to the first non-empty line.
  const lines = cleaned.split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length) return text.trim() || 'XML parse error';
  const errLine = lines.find(l => /^error\b/i.test(l)) || lines.find(l => l.includes(':')) || lines[0];
  // Strip the redundant "error on line N at column M:" prefix — line/col are
  // shown separately by the caller.
  return errLine.replace(/^error on line \d+ at column \d+:\s*/i, '').trim();
}

// Read the user-stylesheet line number from a Saxon-JS error object.
// Saxon-JS exposes location data in two non-overlapping places depending on
// the error class. The xsltModule field tells us which:
//
//   "normalize.xsl"           → compile-time error.  xsltLineNr points
//                               into Saxon's OWN stylesheet (useless).
//                               The user's line lives on errorObject.value
//                               as " on line N in /NoStylesheetBaseURI".
//                               Returns kind='compile' — line is at or near
//                               the offending element.
//   "NoStylesheetBaseURI"     → runtime error in the user's stylesheet.
//                               xsltLineNr is the line of the enclosing
//                               <xsl:template> — Saxon-JS does not track
//                               per-instruction lines for runtime errors,
//                               so this is the closest anchor available.
//                               Returns kind='runtime-template' so callers
//                               can warn that the marker is template-level.
//   "xpath.xsl" or other      → static XPath error with location embedded
//                               in the message itself (handled by
//                               parseSaxonErrorLine + findXPathExpressionLine).
//
// Returns { line, kind } or null. The callers chain this with the other
// extractors so static-XPath errors still land via the existing path.
function extractSaxonErrorLine(err) {
  const mod = err?.xsltModule;

  if (mod === 'normalize.xsl') {
    const v = err?.errorObject?.value;
    if (typeof v === 'string') {
      const m = v.match(/on line (\d+) in \/NoStylesheetBaseURI/);
      if (m) return { line: parseInt(m[1], 10), kind: 'compile' };
    }
    return null;
  }

  if (mod === 'NoStylesheetBaseURI') {
    // xsltLineNr can arrive as a string ("3") or number (3) depending on the
    // Saxon-JS internal path. Coerce to number, reject non-numeric.
    const n = Number(err?.xsltLineNr);
    if (Number.isFinite(n) && n > 0) return { line: n, kind: 'runtime-template' };
  }

  return null;
}

// Parse Saxon error message to extract line number
// Formats seen:
//   "on line 7 in /NoStylesheetBaseURI"
//   "at line 7"
//   "line 7 column 3"
function parseSaxonErrorLine(msg) {
  const m = msg.match(/(?:on|at)\s+line\s+(\d+)/i) ||
            msg.match(/line\s+(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

// Find the 1-based line number of the first source line containing `needle`
// (whitespace-insensitive). Returns null if not found. Used by the CPI
// pre-flight validator to point users at the offending source line.
function _findLineOf(src, needle) {
  const collapseWS = s => s.replace(/\s+/g, ' ').trim();
  const target = collapseWS(needle);
  if (!target) return null;
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (collapseWS(lines[i]).includes(target)) return i + 1;
  }
  return null;
}

// Saxon-JS reports runtime errors against the enclosing template's start —
// but in stylesheets where <xsl:template> or <xsl:stylesheet> spans several
// lines (namespace declarations on their own lines, multi-line attributes),
// xsltLineNr can land on a non-instruction line like a bare xmlns: declaration.
// Nudge the marker forward to the first line whose first non-whitespace
// content begins with "<xsl:" — typically the template/instruction the user
// expects. Search is forward-only and bounded, falling back to the original
// line if nothing better is found within the window.
function nudgeToNextXslElement(src, startLine) {
  if (!src || !Number.isFinite(startLine) || startLine < 1) return startLine;
  const lines = src.split('\n');
  const max = Math.min(lines.length, startLine - 1 + 50);
  for (let i = startLine - 1; i < max; i++) {
    if (/^\s*<xsl:/.test(lines[i])) return i + 1;
  }
  return startLine;
}

// Saxon error messages include the failing XPath expression in braces:
//   "Static error in XPath on line 4 in /NoStylesheetBaseURI {DOES_NOT_EXIST()}: ..."
// Extract that expression and search for it in the ORIGINAL (unstripped) XSLT source
// to find the true line number — reliable regardless of how many cpi: lines were stripped.
//
// saxonReportedLine (optional): Saxon's own line number against the stripped source.
// When the same expression appears more than once, we pick the occurrence whose line
// number is closest to saxonReportedLine + cpiLineOffset, breaking ties in favour of
// the later line (expressions tend to appear near the end of a template, not the top).
//
// Returns the 1-based line number, or null if not found.
function findXPathExpressionLine(saxonMsg, originalXslt, saxonReportedLine, cpiLineOffset) {
  // Saxon embeds the expression in {…} immediately after the location info.
  // Skip namespace URIs (they look like {http://…}) by requiring the content
  // not to start with "http" or "https".
  const candidates = [];
  const re = /\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(saxonMsg)) !== null) {
    const inner = m[1].trim();
    if (inner && !/^https?:/.test(inner)) {
      candidates.push(inner);
    }
  }
  if (!candidates.length) return null;
  // Prefer the shortest candidate — namespace-qualified names like
  // Q{http://…}fn:name are long; the actual expression snippet is short.
  const expr = candidates.reduce((a, b) => a.length <= b.length ? a : b);
  if (!expr) return null;

  // Saxon collapses runs of whitespace inside XPath expressions when echoing
  // them in error messages (e.g. `'a',   'b'` → `'a', 'b'`). Compare on
  // whitespace-collapsed forms so source indentation/multi-space formatting
  // still matches a single occurrence.
  const collapseWS = s => s.replace(/\s+/g, ' ').trim();
  const exprNorm = collapseWS(expr);
  const lines = originalXslt.split('\n');
  const matches = [];
  for (let i = 0; i < lines.length; i++) {
    if (collapseWS(lines[i]).includes(exprNorm)) matches.push(i + 1); // 1-based
  }
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];

  // Multiple matches — use Saxon's reported line (adjusted by offset) as a hint
  // and return whichever occurrence is closest.
  if (saxonReportedLine != null) {
    const hintLine = saxonReportedLine + (cpiLineOffset || 0);
    return matches.reduce((best, line) =>
      Math.abs(line - hintLine) < Math.abs(best - hintLine) ? line : best
    );
  }
  // No hint — return last occurrence (expressions that error are usually later in the file)
  return matches[matches.length - 1];
}


// ────────────────────────────────────────────────────────────────────────────
// CPI structural validation
// ────────────────────────────────────────────────────────────────────────────
// Catches the common CPI mistakes BEFORE Saxon sees the stylesheet:
//   - typos like cpi:setHeaders / cpi:setProperties / cpi:getHeader
//   - wrong arity on cpi:setHeader / cpi:setProperty (must be exactly 3 args)
//   - missing xmlns:cpi="http://sap.com/it/"
//   - missing <xsl:param name="exchange"/>
//   - first arg of cpi:set* must be $exchange
//
// Reference (SAP CPI docs):
//   - Read  headers/properties: declare <xsl:param name="..."/>; reference as $name
//   - Write headers/properties: cpi:setHeader($exchange,'n','v') / cpi:setProperty(...)
//   - There is NO cpi:getHeader / cpi:getProperty
//
// Returns { errors: [{message, line}], warnings: [{message, line}] }.

const _CPI_VALID_FNS = ['setHeader', 'setProperty'];
const _CPI_NS_URI    = 'http://sap.com/it/';

// Strip XML comments and CDATA so cpi: text inside docs/CDATA isn't flagged.
// Preserves newline count so line numbers in regex matches stay accurate
// against the *stripped* source. We translate back to original line numbers
// using _findLineOf, which searches the original.
function _stripCommentsAndCDATA(src) {
  return src.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, m => {
    const newlines = (m.match(/\n/g) || []).length;
    return ' '.repeat(Math.max(0, m.length - newlines)) + '\n'.repeat(newlines);
  });
}

// Count top-level commas inside an XPath argument list. Skips commas inside
// quoted strings and nested parentheses. `body` is the substring between the
// outer `(` and matching `)`. Returns the comma count (so 3 args → 2 commas).
// Returns null if the parens don't balance (caller treats as parse failure).
function _countTopLevelArgs(body) {
  let depth = 0, commas = 0, q = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) {
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '(') { depth++; continue; }
    if (c === ')') { if (depth === 0) return null; depth--; continue; }
    if (c === ',' && depth === 0) commas++;
  }
  if (depth !== 0 || q) return null;
  return body.trim() === '' ? -1 : commas + 1; // arg count, or -1 for empty list
}

// Find the matching closing `)` for the `(` at index `open` in `src`.
// Returns the index of the `)`, or -1 if unbalanced. Skips quoted content.
function _findMatchingParen(src, open) {
  let depth = 1, q = null;
  for (let i = open + 1; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function validateCPIStructure(xsltSrc) {
  const errors = [];
  const warnings = [];
  const stripped = _stripCommentsAndCDATA(xsltSrc);

  if (!/\bcpi:/.test(stripped)) return { errors, warnings };

  const callRe = /\bcpi:([A-Za-z_][\w.-]*)\s*\(/g;
  let m;
  let firstSetCallLine = null;
  while ((m = callRe.exec(stripped)) !== null) {
    const fnName = m[1];
    const openIdx = m.index + m[0].length - 1;
    const callText = `cpi:${fnName}(`;
    const line = _findLineOf(xsltSrc, callText);

    if (!_CPI_VALID_FNS.includes(fnName)) {
      errors.push({
        line,
        message: `cpi:${fnName} is not a valid CPI function. Valid functions: cpi:setHeader, cpi:setProperty. ` +
                 `To READ a header or property, declare <xsl:param name="${fnName.startsWith('get') ? 'name' : '…'}"/> and reference $name.`
      });
      continue;
    }

    if (firstSetCallLine === null) firstSetCallLine = line;

    const closeIdx = _findMatchingParen(stripped, openIdx);
    if (closeIdx === -1) {
      errors.push({ line, message: `cpi:${fnName}(...) — unbalanced parentheses.` });
      continue;
    }
    const body = stripped.slice(openIdx + 1, closeIdx);
    const argCount = _countTopLevelArgs(body);
    if (argCount === null) {
      errors.push({ line, message: `cpi:${fnName}(...) — could not parse argument list.` });
      continue;
    }
    if (argCount !== 3) {
      const got = argCount === -1 ? 0 : argCount;
      errors.push({
        line,
        message: `cpi:${fnName} requires exactly 3 arguments (got ${got}). ` +
                 `Signature: cpi:${fnName}($exchange, 'name', value)`
      });
      continue;
    }

    let depth = 0, q = null, firstArgEnd = body.length;
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ',' && depth === 0) { firstArgEnd = i; break; }
    }
    const firstArg = body.slice(0, firstArgEnd).trim();
    if (firstArg !== '$exchange') {
      errors.push({
        line,
        message: `cpi:${fnName} — first argument must be $exchange (got "${firstArg}"). ` +
                 `In CPI, $exchange is bound to the message exchange object.`
      });
    }
  }

  if (firstSetCallLine !== null) {
    const nsMatch = stripped.match(/xmlns:cpi\s*=\s*(["'])([^"']*)\1/);
    if (!nsMatch) {
      errors.push({
        line: firstSetCallLine,
        message: `Missing xmlns:cpi declaration. Add xmlns:cpi="${_CPI_NS_URI}" to <xsl:stylesheet>.`
      });
    } else if (nsMatch[2] !== _CPI_NS_URI) {
      errors.push({
        line: _findLineOf(xsltSrc, nsMatch[0]) ?? 1,
        message: `xmlns:cpi is "${nsMatch[2]}" but CPI requires "${_CPI_NS_URI}". This will fail to deploy on CPI.`
      });
    }

    if (!/<xsl:param\s+[^>]*\bname\s*=\s*(["'])exchange\1/.test(stripped)) {
      errors.push({
        line: firstSetCallLine,
        message: `Missing <xsl:param name="exchange"/>. CPI binds the exchange object to this param; without it, $exchange is unbound.`
      });
    }

    const erpMatch = stripped.match(/exclude-result-prefixes\s*=\s*(["'])([^"']*)\1/);
    const erpTokens = erpMatch ? erpMatch[2].split(/\s+/).filter(Boolean) : [];
    // XSLT 3.0 "#all" excludes every declared prefix, so cpi is covered.
    const erpHasCpi = erpTokens.includes('cpi') || erpTokens.includes('#all');
    if (!erpHasCpi) {
      warnings.push({
        line: 1,
        message: `Add 'cpi' to exclude-result-prefixes so the cpi: prefix doesn't leak into output.`
      });
    }
  }

  return { errors, warnings };
}


// Pre-flight: validate XML source and XSLT structure before running Saxon
// Returns true if OK to proceed, false if a blocking error was found
function preflight(xmlSrc, xsltSrc) {
  clearAllMarkers();
  let ok = true;

  // 1. Validate XML source
  const xmlResult = validateXML(xmlSrc);
  if (!xmlResult.ok) {
    clog(`[XML] line ${xmlResult.line}: ${xmlResult.message}`, 'error');
    xmlDecorations = markErrorLine(eds.xml, xmlResult.line, xmlResult.message, xmlDecorations);
    clog(`↳ highlighted in XML editor at line ${xmlResult.line}`, 'error');
    ok = false;
  }

  // 2. Validate XSLT — must be well-formed XML first
  const xsltResult = validateXML(xsltSrc);
  if (!xsltResult.ok) {
    clog(`[XSLT] line ${xsltResult.line}: ${xsltResult.message}`, 'error');
    xsltDecorations = markErrorLine(eds.xslt, xsltResult.line, xsltResult.message, xsltDecorations);
    clog(`↳ highlighted in XSLT editor at line ${xsltResult.line}`, 'error');
    ok = false;
  }

  // 3. CPI structural validation — only if XSLT is well-formed.
  // Catches typos (cpi:setHeaders), unknown functions (cpi:getHeader), wrong
  // arity, missing xmlns:cpi, missing <xsl:param name="exchange"/>, etc.
  if (xsltResult.ok) {
    const cpi = validateCPIStructure(xsltSrc);
    cpi.warnings.forEach(w => {
      const where = w.line ? ` (line ${w.line})` : '';
      clog(`[CPI] warning${where}: ${w.message}`, 'warn');
    });
    if (cpi.errors.length) {
      // Log every error in unified format. Mark the FIRST one with a line —
      // Monaco's marker collection only shows one anchor per file at a time
      // for clarity, but we log all of them so the user sees the full list.
      cpi.errors.forEach(e => {
        if (e.line) clog(`[CPI] line ${e.line}: ${e.message}`, 'error');
        else        clog(`[CPI] ${e.message}`, 'error');
      });
      const firstWithLine = cpi.errors.find(e => e.line);
      if (firstWithLine) {
        xsltDecorations = markErrorLine(eds.xslt, firstWithLine.line, firstWithLine.message, xsltDecorations);
        clog(`↳ highlighted in XSLT editor at line ${firstWithLine.line}`, 'error');
      }
      ok = false;
    }
  }

  if (!ok) {
    setStatus('Validation failed — fix errors before running', 'err');
  }
  return ok;
}

