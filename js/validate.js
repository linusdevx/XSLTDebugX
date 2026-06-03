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

  // Clean up the message — strip leading <?xml...?> declaration if present
  const message = text.replace(/<\?xml[^?]*\?>\s*/i, '').trim().split('\n')[0].trim();
  return { ok: false, line, col, message };
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


// Pre-flight: validate XML source and XSLT structure before running Saxon
// Returns true if OK to proceed, false if a blocking error was found
function preflight(xmlSrc, xsltSrc) {
  clearAllMarkers();
  let ok = true;

  // 1. Validate XML source
  const xmlResult = validateXML(xmlSrc);
  if (!xmlResult.ok) {
    clog(`XML parse error at line ${xmlResult.line}: ${xmlResult.message}`, 'error');
    xmlDecorations = markErrorLine(eds.xml, xmlResult.line, xmlResult.message, xmlDecorations);
    ok = false;
  }

  // 2. Validate XSLT — must be well-formed XML first
  const xsltResult = validateXML(xsltSrc);
  if (!xsltResult.ok) {
    clog(`XSLT parse error at line ${xsltResult.line}: ${xsltResult.message}`, 'error');
    xsltDecorations = markErrorLine(eds.xslt, xsltResult.line, xsltResult.message, xsltDecorations);
    ok = false;
  }

  if (!ok) {
    setStatus('Validation failed — fix errors before running', 'err');
  }
  return ok;
}

