// ════════════════════════════════════════════
//  CPI HEADER / PROPERTY SIMULATION
// ════════════════════════════════════════════

// Shared spinner HTML for the Run button running state
const _RUN_BTN_SPINNER = `<svg class="spinner" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="8" cy="8" r="6" stroke-opacity="0.3"/><path d="M8 2a6 6 0 0 1 6 6" stroke-linecap="round"/></svg>`;

// Rewrite cpi:setHeader / cpi:setProperty calls to use the js: namespace
// (http://saxonica.com/ns/globalJS) which Saxon-JS maps to window.xxx().
// This means Saxon evaluates ALL arguments — including dynamic ones like
// concat('REF-', Id) or $someParam — and calls our JS interceptor with
// the real computed values. No more regex extraction, no more — none —.
//
// Rewrites performed:
//   xmlns:cpi="..."  →  xmlns:js="http://saxonica.com/ns/globalJS"
//                        (only if js: not already declared)
//   cpi:setHeader(   →  js:cpiSetHeader(
//   cpi:setProperty( →  js:cpiSetProperty(
//   'cpi' removed from exclude-result-prefixes
//   'js'  added  to  exclude-result-prefixes (avoids leaking to output)

function rewriteCPICalls(xslt) {
  const JS_NS = 'http://saxonica.com/ns/globalJS';

  // 1. Replace xmlns:cpi="..." with xmlns:js="..." (if js not already present)
  const hasJsNs = /xmlns:js\s*=/.test(xslt);
  xslt = xslt.replace(/\s*xmlns:cpi\s*=\s*(?:"[^"]*"|'[^']*')/g,
    hasJsNs ? '' : ` xmlns:js="${JS_NS}"`);

  // 2. Remove 'cpi' from exclude-result-prefixes (js exclusion handled by ensureJsExcluded)
  xslt = xslt.replace(/(exclude-result-prefixes\s*=\s*)(["'])([^"']*)\2/g, (_, attr, q, val) => {
    const parts = val.split(/\s+/).filter(p => p !== 'cpi' && p !== '');
    if (parts.length === 0) return ''; // remove empty attribute entirely
    return attr + q + parts.join(' ') + q;
  });

  // 3. Rewrite all cpi: function calls → js: equivalents
  xslt = xslt.replace(/cpi:setHeader\s*\(/g,    'js:cpiSetHeader(');
  xslt = xslt.replace(/cpi:setProperty\s*\(/g,  'js:cpiSetProperty(');
  xslt = xslt.replace(/cpi:getHeader\s*\(/g,    'js:cpiGetHeader(');
  xslt = xslt.replace(/cpi:getProperty\s*\(/g,  'js:cpiGetProperty(');

  return { rewritten: xslt };
}

// Ensure the js: namespace is always in exclude-result-prefixes so it never
// leaks into output — mirrors CPI runtime behaviour where extension namespaces
// are never serialized regardless of what the developer declared.
function ensureJsExcluded(xslt) {
  if (!/xmlns:js\s*=/.test(xslt)) return xslt; // no js: namespace — nothing to do

  if (/(exclude-result-prefixes\s*=)/.test(xslt)) {
    // Already has the attribute — make sure 'js' is in it
    return xslt.replace(/(exclude-result-prefixes\s*=\s*)(["'])([^"']*)\2/g, (_, attr, q, val) => {
      const parts = val.split(/\s+/).filter(p => p !== 'js');
      parts.push('js');
      return attr + q + parts.filter(Boolean).join(' ') + q;
    });
  } else {
    // No attribute at all — inject it on the stylesheet element (handles both xsl:stylesheet and xsl:transform)
    return xslt.replace(/(<xsl:(?:stylesheet|transform)\b[^>]*?)(\s*>)/, '$1 exclude-result-prefixes="js"$2');
  }
}

// Valid XML NCName: must start with letter or underscore, then letters/digits/.-_
function isValidNCName(name) {
  return /^[A-Za-z_][\w.\-]*$/.test(name);
}

// ── XML Validation Badge ──
function updateXMLValidationBadge() {
  const badge = document.getElementById('xmlValidationBadge');
  if (!badge) return;

  const xmlSrc = eds.xml?.getValue?.()?.trim();
  if (!xmlSrc) {
    // Empty XML — hide badge
    badge.style.display = 'none';
    return;
  }

  // Try to parse XML
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlSrc, 'text/xml');
    const hasError = doc.getElementsByTagName('parsererror').length > 0;

    if (hasError) {
      // Parse error — show red badge
      const errorEl = doc.getElementsByTagName('parsererror')[0];
      const errorMsg = errorEl?.textContent || 'XML parse error';
      badge.className = 'xml-validation-badge error';
      badge.innerHTML = '<span class="badge-icon">✗</span><span class="badge-text">Error</span>';
      badge.title = errorMsg;
      badge.style.display = 'inline-flex';
    } else {
      // Valid XML — show green badge
      badge.className = 'xml-validation-badge valid';
      badge.innerHTML = '<span class="badge-icon">✓</span><span class="badge-text">Valid</span>';
      badge.title = 'XML is valid';
      badge.style.display = 'inline-flex';
    }
  } catch (e) {
    // Catch any parsing exceptions
    badge.className = 'xml-validation-badge error';
    badge.innerHTML = '<span class="badge-icon">✗</span><span class="badge-text">Error</span>';
    badge.title = e.message || 'XML parse error';
    badge.style.display = 'inline-flex';
  }
}

function buildParamsXPath() {
  const entries = [];
  const skipped = [];
  const dupes   = [];
  // Inject a dummy $exchange so stylesheets that declare it don't get an error
  entries.push(`QName('','exchange'): 'exchange'`);
  // Merge headers then properties; properties win on name collision (last-write-wins).
  // Saxon map literals require unique keys — duplicates cause a runtime error.
  const seen = new Map(); // name → index in entries[]
  [...kvData.headers, ...kvData.properties].forEach(row => {
    const k = row.name.trim();
    const v = row.value.trim().replace(/'/g, "''");
    if (!k) return;
    if (!isValidNCName(k)) {
      skipped.push(k);
      return; // skip invalid names silently here, warn after
    }
    const entry = `QName('','${k}'): '${v}'`;
    if (seen.has(k)) {
      dupes.push(k);
      entries[seen.get(k)] = entry; // overwrite previous entry
    } else {
      seen.set(k, entries.length);
      entries.push(entry);
    }
  });
  if (skipped.length) {
    skipped.forEach(n =>
      clog(`Warning: header/property "${n}" skipped — not a valid xsl:param name (must start with a letter or underscore)`, 'warn')
    );
  }
  if (dupes.length) {
    dupes.forEach(n =>
      clog(`Warning: "${n}" exists in both Headers and Properties — property value used for $${n} param (cpi:getHeader/getProperty still work independently)`, 'warn')
    );
  }
  return `, 'stylesheet-params': map { ${entries.join(', ')} }`;
}

// 4. Render the read-only output panels
function renderOutputKV(headers, properties) {
  const render = (rowsId, countId, data) => {
    const keys = Object.keys(data);
    document.getElementById(countId).textContent = keys.length;
    document.getElementById(rowsId).innerHTML = keys.length
      ? keys.map(k =>
          `<div class="kv-row-out">
            <span class="kv-k">${escHtml(k)}</span>
            <span class="kv-v">${escHtml(data[k])}</span>
          </div>`).join('')
      : '<div class="kv-empty">— none —</div>';
  };
  render('outHdrRows',  'outHdrCount',  headers);
  render('outPropRows', 'outPropCount', properties);
}

// ════════════════════════════════════════════
//  KV PANEL MANAGEMENT
// ════════════════════════════════════════════
function toggleKVPanel(panelId) {
  document.getElementById(panelId).classList.toggle('collapsed');
}

function addKVRow(type) {
  const id = ++kvIdSeq;
  kvData[type].push({ id, name: '', value: '' });
  renderKV(type);
  scheduleSave();
}

function deleteKVRow(type, id) {
  kvData[type] = kvData[type].filter(r => r.id !== id);
  renderKV(type);
  scheduleSave();
}

function updateKV(type, id, field, val) {
  const row = kvData[type].find(r => r.id === id);
  if (row) row[field] = val;
  const countId = type === 'headers' ? 'hdrCount' : 'propCount';
  document.getElementById(countId).textContent =
    kvData[type].filter(r => r.name.trim()).length;
  // Validate the name field if it was changed
  if (field === 'name') {
    _validateKVField(type, id);
  }
  scheduleSave();
}

// Validate and style a KV field (add/remove red highlight + error message for invalid NCName)
function _validateKVField(type, id) {
  const isHdr = type === 'headers';
  const rowsEl = document.getElementById(isHdr ? 'hdrRows' : 'propRows');
  const wrappers = rowsEl?.querySelectorAll('.kv-row-wrapper') || [];
  let wrapperIndex = 0;
  let found = false;

  kvData[type].forEach((row, idx) => {
    if (row.id === id) {
      found = true;
      wrapperIndex = idx;
    }
  });

  if (!found || wrapperIndex >= wrappers.length) return;

  const wrapperEl = wrappers[wrapperIndex];
  const rowEl = wrapperEl?.querySelector('.kv-row');
  const nameInput = rowEl?.querySelector('input:first-of-type');
  const errorEl = wrapperEl?.querySelector('.kv-error-msg');

  if (!nameInput) return;

  const name = nameInput.value.trim();
  const isValid = !name || isValidNCName(name);  // Empty is OK (not yet filled)

  if (isValid) {
    rowEl.classList.remove('kv-invalid');
    nameInput.title = '';  // Remove tooltip
    if (errorEl) errorEl.style.display = 'none';
  } else {
    rowEl.classList.add('kv-invalid');
    nameInput.title = 'Must start with letter or underscore, then use letters, digits, hyphen, dot, or underscore';
    if (errorEl) {
      errorEl.style.display = '';  // Show error message
      errorEl.innerHTML = '⚠️ Invalid NCName — must start with letter or underscore';
    }
  }
}

function renderKV(type) {
  const isHdr   = type === 'headers';
  const rowsEl  = document.getElementById(isHdr ? 'hdrRows'  : 'propRows');
  const countEl = document.getElementById(isHdr ? 'hdrCount' : 'propCount');
  const rows    = kvData[type];
  countEl.textContent = rows.filter(r => r.name.trim()).length;
  rowsEl.innerHTML = rows.length === 0
    ? '<div class="kv-empty">Click + to add</div>'
    : rows.map(r => `
        <div class="kv-row-wrapper">
          <div class="kv-row">
            <input value="${escHtml(r.name)}" placeholder="name"
              oninput="updateKV('${type}',${r.id},'name',this.value)"/>
            <input value="${escHtml(r.value)}" placeholder="value"
              oninput="updateKV('${type}',${r.id},'value',this.value)"/>
            <button class="kv-del-btn" onclick="deleteKVRow('${type}',${r.id})">×</button>
          </div>
          <div class="kv-error-msg" style="display: none;"></div>
        </div>`).join('');

  // Validate all fields after rendering
  rows.forEach(row => {
    _validateKVField(type, row.id);
  });
}

// ════════════════════════════════════════════
//  TRANSFORM
// ════════════════════════════════════════════
function runTransform() {
  if (!saxonReady) { clog('Saxon-JS not ready yet', 'error'); return; }

  // Reset error badge for fresh run
  consoleErrCount = 0;
  updateConsoleErrBadge();

  const btn = document.getElementById('runBtn');
  const _runStart = performance.now();
  const _MIN_SPINNER_MS = 300;
  let _transformStarted = false; // only apply minimum delay if Saxon was actually invoked

  function resetBtn() {
    const elapsed = performance.now() - _runStart;
    const restore = () => {
      btn.disabled = false;
      if (modeManager.isXpath) {
        btn.onclick = runXPath;
        btn.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M3 1.5l11 6.5-11 6.5V1.5z"/></svg> Run XPath <span class="kbd">⌘↵</span>`;
      } else {
        btn.onclick = runTransform;
        btn.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M3 1.5l11 6.5-11 6.5V1.5z"/></svg> Run XSLT <span class="kbd">⌘↵</span>`;
      }
    };
    const remaining = _transformStarted ? _MIN_SPINNER_MS - elapsed : 0;
    if (remaining > 0) setTimeout(restore, remaining);
    else restore();
  }

  btn.disabled = true;
  btn.innerHTML = `${_RUN_BTN_SPINNER} Running… <span class="kbd">⌘↵</span>`;
  setStatus('Transforming…', 'busy');

  try {
    const xmlSrc = eds.xml?.getValue()?.trim();
    let xsltSrc  = eds.xslt?.getValue()?.trim();

    if (!xmlSrc)  { clog('XML Source is empty',      'error'); setStatus('Ready', 'ok'); return; }
    if (!xsltSrc) { clog('XSLT Stylesheet is empty', 'error'); setStatus('Ready', 'ok'); return; }

    // ── Pre-flight validation ──
    setStatus('Validating…', 'busy');
    if (!preflight(xmlSrc, xsltSrc)) return;

    const t0 = performance.now();
    _transformStarted = true;
    clog(`Starting XSLT transform — XML ${xmlSrc.length} chars · XSLT ${xsltSrc.length} chars`, 'info');
  window.goatcounter?.count({ path: 'run-xslt', title: 'Run XSLT' });

    // ── CPI extension call handling ───────────────────────────────────────────
    // Rewrite cpi:setHeader/setProperty → js:cpiSetHeader/cpiSetProperty so
    // Saxon evaluates all arguments (including dynamic ones) and calls our
    // JS interceptor functions on window. Results collected into cpiCaptured.
    const hasCPI = /cpi:(?:set|get)(?:Header|Property)/.test(xsltSrc);
    const cpiCaptured = { headers: {}, properties: {} };
    let _prevCpiSetHeader, _prevCpiSetProperty, _prevCpiGetHeader, _prevCpiGetProperty;

    if (hasCPI) {
      _prevCpiSetHeader   = window.cpiSetHeader;
      _prevCpiSetProperty = window.cpiSetProperty;
      _prevCpiGetHeader   = window.cpiGetHeader;
      _prevCpiGetProperty = window.cpiGetProperty;

      const _cpiStrVal = v => {
        if (v == null) return '';
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
        if (Array.isArray(v)) return v.map(_cpiStrVal).join('');
        if (v instanceof Node) return v.textContent ?? '';
        if (typeof v === 'object' && 'textContent' in v) return v.textContent ?? '';
        return String(v);
      };

      // setHeader / setProperty — capture computed values into cpiCaptured
      window.cpiSetHeader   = (_exchange, name, value) => { cpiCaptured.headers[_cpiStrVal(name)]    = _cpiStrVal(value); return ''; };
      window.cpiSetProperty = (_exchange, name, value) => { cpiCaptured.properties[_cpiStrVal(name)] = _cpiStrVal(value); return ''; };

      // getHeader / getProperty — read from the input Headers/Properties panels (kvData)
      window.cpiGetHeader   = (_exchange, name) => {
        const key = _cpiStrVal(name).trim();
        const row = kvData.headers.find(r => r.name === key);
        const val = row?.value ?? '';
        if (!row) clog(`cpi:getHeader — '${key}' not found in Headers panel, returning empty string`, 'warn');
        return val;
      };
      window.cpiGetProperty = (_exchange, name) => {
        const key = _cpiStrVal(name).trim();
        const row = kvData.properties.find(r => r.name === key);
        const val = row?.value ?? '';
        if (!row) clog(`cpi:getProperty — '${key}' not found in Properties panel, returning empty string`, 'warn');
        return val;
      };

      const { rewritten } = rewriteCPICalls(xsltSrc);
      xsltSrc = rewritten;
      clog('CPI extension calls detected — rewriting to js: namespace for full dynamic evaluation', 'info');
    }

    // Always ensure js: namespace is excluded from output — mirrors CPI runtime behaviour
    xsltSrc = ensureJsExcluded(xsltSrc);

    // Log which params are being passed
    const namedParams = [...kvData.headers, ...kvData.properties].filter(r => r.name.trim());
    if (namedParams.length) {
      clog(`Passing xsl:params: ${namedParams.map(r => r.name).join(', ')}`, 'info');
    }

    const paramsXPath = buildParamsXPath();

    // ── Intercept xsl:message output ──────────────────────────────────────────
    // Saxon-JS routes xsl:message to console.log("xsl:message: <text>").
    // Temporarily patch console.log to capture those and route them to clog.
    const _xslMessages    = [];
    const _origConsoleLog = console.log;
    console.log = function(...args) {
      const first = args[0];
      if (typeof first === 'string' && first.startsWith('xsl:message: ')) {
        _xslMessages.push(first.slice(13));
      } else {
        _origConsoleLog.apply(console, args);
      }
    };

    try {
      const output = SaxonJS.XPath.evaluate(
        `transform(map {
          'stylesheet-text' : $xslt,
          'source-node'     : parse-xml($xml),
          'delivery-format' : 'serialized'
          ${paramsXPath}
        })?output`,
        [],
        { params: { xslt: xsltSrc, xml: xmlSrc } }
      );

      const elapsed = (performance.now() - t0).toFixed(1);

      // Restore output section if it was minimised by XPath panel
      if (typeof restoreOutputSection === 'function') restoreOutputSection();

      // Flush xsl:message lines before completion log — fires in natural execution order
      _xslMessages.forEach(m => clog(`xsl:message → ${m}`, 'warn'));

      // Detect output language from actual content (CPI-relevant: XML, JSON, plain text/CSV/fixed)
      const _trimmed = output.trimStart();
      let _outLang = 'plaintext';
      let _outValue = output;
      if (_trimmed.startsWith('<')) {
        _outLang  = 'xml';
        _outValue = prettyXML(output);
      } else if (_trimmed.startsWith('{') || _trimmed.startsWith('[')) {
        try { _outValue = JSON.stringify(JSON.parse(_trimmed), null, 2); _outLang = 'json'; } catch (_) { /* not valid JSON, treat as plaintext */ }
      }
      // everything else (CSV, fixed-length, EDI, etc.) stays as plaintext
      monaco.editor.setModelLanguage(eds.out.getModel(), _outLang);

      // Update lang badge + download filename to match actual output type
      const _extMap = { xml: 'xml', json: 'json', plaintext: 'txt' };
      const _labelMap = { xml: 'XML', json: 'JSON', plaintext: 'TEXT' };
      const _ext = _extMap[_outLang] ?? 'txt';
      const _badge = document.getElementById('outLangBadge');
      const _dlBtn = document.getElementById('outDownloadBtn');
      if (_badge) _badge.textContent = _labelMap[_outLang] ?? 'TEXT';
      if (_dlBtn) {
        _dlBtn.title = `Download output as ${_ext.toUpperCase()}`;
        _dlBtn.onclick = () => downloadPane('out', `output.${_ext}`);
      }

      eds.out.updateOptions({ readOnly: false });
      eds.out.setValue(_outValue);
      eds.out.updateOptions({ readOnly: true });

      // Show output panels: CPI-captured values (dynamic + static) take priority,
      // then pass-through input headers + properties
      const outHdrs  = { ...cpiCaptured.headers };
      const outProps = { ...cpiCaptured.properties };
      kvData.headers.filter(r => r.name.trim() && !(r.name in outHdrs))
                    .forEach(r => { outHdrs[r.name] = r.value; });
      kvData.properties.filter(r => r.name.trim() && !(r.name in outProps))
                       .forEach(r => { outProps[r.name] = r.value; });

      // Log captured CPI values
      if (hasCPI) {
        const _hc = Object.keys(cpiCaptured.headers).length;
        const _pc = Object.keys(cpiCaptured.properties).length;
        const _parts = [];
        if (_hc) _parts.push(`${_hc} header${_hc > 1 ? 's' : ''} captured`);
        if (_pc) _parts.push(`${_pc} propert${_pc > 1 ? 'ies' : 'y'} captured`);
        if (_parts.length) clog(`CPI — ${_parts.join(' · ')} ✓`, 'success');
      }

      renderOutputKV(outHdrs, outProps);

      clog(`Transform complete in ${elapsed} ms · output: ${_outLang.toUpperCase()} ✓`, 'success');
      setStatus(`Done · ${elapsed} ms`, 'ok');

      // Auto-expand output pane on first successful run
      const colRight = document.getElementById('colRight');
      if (colRight.classList.contains('collapsed')) {
        colRight.classList.remove('collapsed');
        scheduleSave();
        setTimeout(() => {
          eds.xml?.layout();
          eds.xslt?.layout();
          eds.out?.layout();
        }, 250);
      }

    } catch (err) {
      // Flush xsl:message lines before error — trace should precede the failure it caused
      _xslMessages.forEach(m => clog(`xsl:message → ${m}`, 'warn'));

      const fullMsg = err.message || String(err);
      const msg = fullMsg.split('\n')[0];

      // Detect terminate="yes" — Saxon throws "Terminated with <message text>"
      // Log it as a warn (not error) since it's an intentional halt, not a bug.
      const terminateMatch = msg.match(/^Terminated with (.+)$/i);
      if (terminateMatch) {
        clog(`xsl:message terminate="yes" — ${terminateMatch[1]}`, 'warn');
      } else {
        clog(`Error: ${msg}`, 'error');
        const originalXslt = eds.xslt?.getValue() ?? '';
        const saxonLine    = parseSaxonErrorLine(fullMsg);
        const errLine =
          findXPathExpressionLine(fullMsg, originalXslt, saxonLine, 0) ||
          (saxonLine !== null ? saxonLine : null);
        if (errLine) {
          xsltDecorations = markErrorLine(eds.xslt, errLine, msg, xsltDecorations);
          clog(`↳ Error at line ${errLine} (highlighted in XSLT editor)`, 'error');
        }
      }

      setStatus('Transform failed', 'err');
    } finally {
      // Always restore console.log — even if Saxon throws
      console.log = _origConsoleLog;
      // Restore window CPI interceptors to their previous state
      if (hasCPI) {
        _prevCpiSetHeader   !== undefined ? (window.cpiSetHeader   = _prevCpiSetHeader)   : delete window.cpiSetHeader;
        _prevCpiSetProperty !== undefined ? (window.cpiSetProperty = _prevCpiSetProperty) : delete window.cpiSetProperty;
        _prevCpiGetHeader   !== undefined ? (window.cpiGetHeader   = _prevCpiGetHeader)   : delete window.cpiGetHeader;
        _prevCpiGetProperty !== undefined ? (window.cpiGetProperty = _prevCpiGetProperty) : delete window.cpiGetProperty;
      }
    }

  } finally {
    // Always re-enable the Run button — even if preflight, param building, or anything else throws
    resetBtn();
  }
}