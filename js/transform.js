// Spinner for the Run button's running state.
const _RUN_BTN_SPINNER = `<svg class="spinner" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="8" cy="8" r="6" stroke-opacity="0.3"/><path d="M8 2a6 6 0 0 1 6 6" stroke-linecap="round"/></svg>`;

// Single source of truth for Run button markup — keeps icon, label, and shortcut in sync.
function _runBtnHtml(mode) {
  const label = mode === 'XPATH' ? 'Run XPath' : 'Run XSLT';
  return `<i data-lucide="play" width="14" height="14"></i> ${label} <span class="kbd">⌘↵</span>`;
}

function _triggerRunParticles() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const btn = document.getElementById('runBtn');
  if (!btn) return;
  const colors = ['#00c8ff', '#6366f1', '#f59e0b', '#10b981', '#ef4444'];
  for (let i = 0; i < 8; i++) {
    const angle = (i * 45) * Math.PI / 180;
    const dist = 20 + Math.random() * 15;
    const p = document.createElement('span');
    p.className = 'run-particle';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--px', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--py', `${Math.sin(angle) * dist}px`);
    btn.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }
}

function _flashPaneResult(success) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const pane = document.getElementById('outEd');
  if (!pane) return;
  const cls = success ? 'pane-success' : 'pane-error';
  pane.classList.add(cls);
  setTimeout(() => pane.classList.remove(cls), success ? 600 : 400);
}

// Rewrite cpi:setHeader / cpi:setProperty to the js: namespace
// (http://saxonica.com/ns/globalJS) which Saxon-JS maps to window.xxx().
// Saxon evaluates ALL arguments (including dynamic ones) and calls our
// JS interceptor with the real computed values.
//
// Rewrites:
//   xmlns:cpi="..."  →  xmlns:js="http://saxonica.com/ns/globalJS"
//   cpi:setHeader(   →  js:cpiSetHeader(
//   cpi:setProperty( →  js:cpiSetProperty(
//   'cpi' removed from exclude-result-prefixes
//   'js'  added  to  exclude-result-prefixes (avoids leaking to output)

// Replace XML comments and CDATA with U+0001-bracketed index tokens so the
// rewrite ignores `cpi:setHeader` etc. inside them. Placeholders preserve
// newline count so Saxon-reported line numbers stay accurate. U+0001 is
// forbidden in well-formed XML 1.0 so the token can't collide.
function _extractInsensitiveRegions(xslt) {
  const regions = [];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g;
  const stripped = xslt.replace(re, (match) => {
    const newlines = (match.match(/\n/g) || []).length;
    const idx = regions.length;
    regions.push(match);
    return '' + idx + '' + '\n'.repeat(newlines);
  });
    const restore = (s) => s.replace(/(\d+)/g, (full, idxStr) => {
    return regions[Number(idxStr)] ?? full;
  });
  return { stripped, restore };
}

function rewriteCPICalls(xslt) {
  const JS_NS = 'http://saxonica.com/ns/globalJS';

  const { stripped, restore } = _extractInsensitiveRegions(xslt);
  const hasCPI = /cpi:set(?:Header|Property)/.test(stripped);
  if (!hasCPI) return { rewritten: xslt, hasCPI: false };
  xslt = stripped;

  const hasJsNs = /xmlns:js\s*=/.test(xslt);
  xslt = xslt.replace(/\s*xmlns:cpi\s*=\s*(?:"[^"]*"|'[^']*')/g,
    hasJsNs ? '' : ` xmlns:js="${JS_NS}"`);

  xslt = xslt.replace(/(exclude-result-prefixes\s*=\s*)(["'])([^"']*)\2/g, (_, attr, q, val) => {
    const parts = val.split(/\s+/).filter(p => p !== 'cpi' && p !== '');
    if (parts.length === 0) return '';
    return attr + q + parts.join(' ') + q;
  });

  xslt = xslt.replace(/cpi:setHeader\s*\(/g,    'js:cpiSetHeader(');
  xslt = xslt.replace(/cpi:setProperty\s*\(/g,  'js:cpiSetProperty(');

  return { rewritten: restore(xslt), hasCPI: true };
}

// Ensure js: namespace is always in exclude-result-prefixes so it never leaks
// into output — mirrors CPI runtime behaviour.
function ensureJsExcluded(xslt) {
  if (!/xmlns:js\s*=/.test(xslt)) return xslt;

  if (/(exclude-result-prefixes\s*=)/.test(xslt)) {
    return xslt.replace(/(exclude-result-prefixes\s*=\s*)(["'])([^"']*)\2/g, (_, attr, q, val) => {
      const parts = val.split(/\s+/).filter(p => p !== 'js');
      parts.push('js');
      return attr + q + parts.filter(Boolean).join(' ') + q;
    });
  } else {
    return xslt.replace(/(<xsl:(?:stylesheet|transform)\b[^>]*?)(\s*>)/, '$1 exclude-result-prefixes="js"$2');
  }
}

// Valid XML NCName: starts with letter or underscore, then letters/digits/.-_
function isValidNCName(name) {
  return /^[A-Za-z_][\w.\-]*$/.test(name);
}

// Cache the last validated XML so we don't re-parse on every keystroke
// (onDidChangeModelContent fires per character; DOMParser is O(N)).
// Mode swaps swap the *model*, not the content, so the cache holds across modes.
let _lastValidatedXmlSrc = null;

function invalidateXmlValidationCache() {
  _lastValidatedXmlSrc = null;
}

function updateXMLValidationBadge() {
  const badge = document.getElementById('xmlValidationBadge');
  if (!badge) return;

  const xmlSrc = eds.xml?.getValue?.()?.trim();
  if (!xmlSrc) {
    badge.style.display = 'none';
    _lastValidatedXmlSrc = '';
    return;
  }

  if (xmlSrc === _lastValidatedXmlSrc) return;
  _lastValidatedXmlSrc = xmlSrc;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlSrc, 'text/xml');
    const hasError = doc.getElementsByTagName('parsererror').length > 0;

    if (hasError) {
      const errorEl = doc.getElementsByTagName('parsererror')[0];
      const errorMsg = errorEl?.textContent || 'XML parse error';
      badge.className = 'xml-validation-badge error';
      badge.innerHTML = '<span class="badge-icon">✗</span><span class="badge-text">Error</span>';
      badge.title = errorMsg;
      badge.style.display = 'inline-flex';
    } else {
      badge.className = 'xml-validation-badge valid';
      badge.innerHTML = '<span class="badge-icon">✓</span><span class="badge-text">Valid</span>';
      badge.title = 'XML is valid';
      badge.style.display = 'inline-flex';
    }
  } catch (e) {
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
  // Inject a dummy $exchange so stylesheets that declare it don't error.
  entries.push(`QName('','exchange'): 'exchange'`);
  // Properties win on name collision (last-write-wins). Saxon map literals
  // require unique keys — duplicates would cause a runtime error.
  const seen = new Map();
  [...kvData.headers, ...kvData.properties].forEach(row => {
    const k = row.name.trim();
    const v = row.value.trim().replace(/'/g, "''");
    if (!k) return;
    if (!isValidNCName(k)) {
      skipped.push(k);
      return;
    }
    const entry = `QName('','${k}'): '${v}'`;
    if (seen.has(k)) {
      dupes.push(k);
      entries[seen.get(k)] = entry;
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
      clog(`Warning: "${n}" exists in both Headers and Properties — property value used for $${n} param`, 'warn')
    );
  }
  return `, 'stylesheet-params': map { ${entries.join(', ')} }`;
}

// Render the read-only output panels
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
      : '<div class="kv-empty">None set by transform</div>';
  };
  render('outHdrRows',  'outHdrCount',  headers);
  render('outPropRows', 'outPropCount', properties);
  // Re-apply any active filter so newly rendered rows respect the query.
  _applyKVFilter('outHdrPanel');
  _applyKVFilter('outPropPanel');
}

function toggleKVPanel(panelId) {
  document.getElementById(panelId).classList.toggle('collapsed');
}

// panelId → { rowsId, childSelector }
const _KV_PANEL_MAP = {
  hdrPanel:     { rowsId: 'hdrRows',     childSelector: '.kv-row-wrapper' },
  propPanel:    { rowsId: 'propRows',    childSelector: '.kv-row-wrapper' },
  outHdrPanel:  { rowsId: 'outHdrRows',  childSelector: '.kv-row-out' },
  outPropPanel: { rowsId: 'outPropRows', childSelector: '.kv-row-out' },
};

function toggleKVSearch(panelId) {
  // Legacy no-op — search is now an always-visible inline input in the panel header.
  // Kept as a stub so any stray callers don't throw; can be removed once nothing references it.
  void panelId;
}

function clearKVSearch(panelId) {
  const input = document.getElementById(panelId + 'Search');
  if (!input) return;
  input.value = '';
  _applyKVFilter(panelId);
  input.focus();
}

// Toggle .kv-hidden on each row child by substring match against name + value.
function _applyKVFilter(panelId) {
  const cfg = _KV_PANEL_MAP[panelId];
  if (!cfg) return;
  const rowsEl = document.getElementById(cfg.rowsId);
  if (!rowsEl) return;
  const input = document.getElementById(panelId + 'Search');
  const q = (input?.value || '').trim().toLowerCase();
  const children = rowsEl.querySelectorAll(cfg.childSelector);

  let visibleCount = 0;
  children.forEach(child => {
    let name = '';
    let value = '';
    if (cfg.childSelector === '.kv-row-wrapper') {
      const inputs = child.querySelectorAll('.kv-row input');
      name  = (inputs[0]?.value || '').toLowerCase();
      value = (inputs[1]?.value || '').toLowerCase();
    } else {
      name  = (child.querySelector('.kv-k')?.textContent || '').toLowerCase();
      value = (child.querySelector('.kv-v')?.textContent || '').toLowerCase();
    }
    const match = !q || name.includes(q) || value.includes(q);
    child.classList.toggle('kv-hidden', !match);
    if (match) visibleCount++;
  });

  // "No matches" line — distinct from .kv-empty's "Click + to add" / "— none —".
  let noMatch = rowsEl.querySelector('.kv-no-matches');
  if (q && children.length > 0 && visibleCount === 0) {
    if (!noMatch) {
      noMatch = document.createElement('div');
      noMatch.className = 'kv-no-matches';
      noMatch.textContent = 'No matches';
      rowsEl.appendChild(noMatch);
    }
  } else if (noMatch) {
    noMatch.remove();
  }

  // Mirror active-filter state on the input itself so a non-empty query is visually distinct.
  if (input) input.classList.toggle('kv-search-active', q.length > 0);
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
  if (field === 'name') {
    const tooLong = val.length > 128;
    if (tooLong && !row?._warnedTooLong) {
      clog('Name too long (max 128 chars)', 'warn');
      if (row) row._warnedTooLong = true;
    } else if (!tooLong && row?._warnedTooLong) {
      row._warnedTooLong = false;
    }
  }
  const countId = type === 'headers' ? 'hdrCount' : 'propCount';
  document.getElementById(countId).textContent =
    kvData[type].filter(r => r.name.trim()).length;
  if (field === 'name') {
    _validateKVField(type, id);
  }
  scheduleSave();
}

// Add/remove red highlight + error message for invalid NCName
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
    nameInput.title = '';
    if (errorEl) errorEl.style.display = 'none';
  } else {
    rowEl.classList.add('kv-invalid');
    nameInput.title = 'Must start with letter or underscore, then use letters, digits, hyphen, dot, or underscore';
    if (errorEl) {
      errorEl.style.display = '';
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
    ? `<div class="kv-empty">No ${type} yet — click + to add one</div>`
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

  rows.forEach(row => {
    _validateKVField(type, row.id);
  });

  // Re-apply any active search filter so newly rendered rows respect the query.
  _applyKVFilter(type === 'headers' ? 'hdrPanel' : 'propPanel');
}

function runTransform() {
  if (!guardReady()) return;

  consoleErrCount = 0;
  updateConsoleErrBadge();

  const btn = document.getElementById('runBtn');
  const _runStart = performance.now();
  const _MIN_SPINNER_MS = 300;
  let _transformStarted = false; // only enforce min spinner if Saxon was actually invoked

  function resetBtn() {
    const elapsed = performance.now() - _runStart;
    const restore = () => {
      btn.disabled = false;
      if (modeManager.isXpath) {
        btn.onclick = runXPath;
        btn.innerHTML = _runBtnHtml('XPATH');
      } else {
        btn.onclick = runTransform;
        btn.innerHTML = _runBtnHtml('XSLT');
      }
      reinitIcons(btn);
    };
    const remaining = _transformStarted ? _MIN_SPINNER_MS - elapsed : 0;
    if (remaining > 0) setTimeout(restore, remaining);
    else restore();
  }

  btn.disabled = true;
  btn.innerHTML = `${_RUN_BTN_SPINNER} Running… <span class="kbd">⌘↵</span>`;
  setStatus('Transforming…', 'busy');
  _triggerRunParticles();
  // Editorial direction B: drives the inter-column data-flow line animation
  // and the logomark arrow pulse. Cleared in the outer finally below.
  document.body.classList.add('running');

  try {
    const xmlSrc = eds.xml?.getValue()?.trim();
    let xsltSrc  = eds.xslt?.getValue()?.trim();

    if (!xmlSrc)  { clog('XML Source is empty',      'error'); setStatus('Ready', 'ok'); return; }
    if (!xsltSrc) { clog('XSLT Stylesheet is empty', 'error'); setStatus('Ready', 'ok'); return; }

    setStatus('Validating…', 'busy');
    if (!preflight(xmlSrc, xsltSrc)) return;

    const t0 = performance.now();
    _transformStarted = true;
    clog(`Starting XSLT transform — XML ${xmlSrc.length} chars · XSLT ${xsltSrc.length} chars`, 'info');
  window.goatcounter?.count({ path: 'run-xslt', title: 'Run XSLT' });

    // Rewrite cpi:setHeader/setProperty → js:cpiSetHeader/cpiSetProperty so
    // Saxon evaluates all arguments (including dynamic ones) and calls our JS interceptors.
    const { rewritten: _xsltRewritten, hasCPI } = rewriteCPICalls(xsltSrc);
    const cpiCaptured = { headers: {}, properties: {} };
    let _prevCpiSetHeader, _prevCpiSetProperty;

    if (hasCPI) {
      _prevCpiSetHeader   = window.cpiSetHeader;
      _prevCpiSetProperty = window.cpiSetProperty;

      const _cpiStrVal = v => {
        if (v == null) return '';
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
        if (Array.isArray(v)) return v.map(_cpiStrVal).join('');
        if (v instanceof Node) return v.textContent ?? '';
        if (typeof v === 'object' && 'textContent' in v) return v.textContent ?? '';
        return String(v);
      };

      // setHeader / setProperty — capture computed values into cpiCaptured.
      window.cpiSetHeader   = (_exchange, name, value) => { cpiCaptured.headers[_cpiStrVal(name)]    = _cpiStrVal(value); return ''; };
      window.cpiSetProperty = (_exchange, name, value) => { cpiCaptured.properties[_cpiStrVal(name)] = _cpiStrVal(value); return ''; };

      xsltSrc = _xsltRewritten;
      clog('CPI extension calls detected — rewriting to js: namespace for full dynamic evaluation', 'info');
    }

    // Always exclude js: from output — mirrors CPI runtime behaviour.
    xsltSrc = ensureJsExcluded(xsltSrc);

    const namedParams = [...kvData.headers, ...kvData.properties].filter(r => r.name.trim());
    if (namedParams.length) {
      clog(`Passing xsl:params: ${namedParams.map(r => r.name).join(', ')}`, 'info');
    }

    const paramsXPath = buildParamsXPath();

    // Saxon-JS routes xsl:message to console.log("xsl:message: <text>").
    // Patch console.log to capture and route to clog.
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

      if (typeof restoreOutputSection === 'function') restoreOutputSection();

      // Flush xsl:message lines before completion log — natural execution order.
      _xslMessages.forEach(m => clog(`xsl:message → ${m}`, 'warn'));

      // Detect output language from content (CPI-relevant: XML, JSON, plain text/CSV/fixed).
      const _trimmed = output.trimStart();
      let _outLang = 'plaintext';
      let _outValue = output;
      if (_trimmed.startsWith('<')) {
        _outLang  = 'xml';
        _outValue = prettyXML(output);
      } else if (_trimmed.startsWith('{') || _trimmed.startsWith('[')) {
        try { _outValue = JSON.stringify(JSON.parse(_trimmed), null, 2); _outLang = 'json'; } catch (_) { /* not valid JSON, treat as plaintext */ }
      }
      monaco.editor.setModelLanguage(eds.out.getModel(), _outLang);

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
      // Editorial direction B: hide the empty-state hint once Output has content.
      document.getElementById('outEdWrap')?.classList.toggle('has-content', !!_outValue);

      // CPI-captured values (dynamic + static) take priority, then pass-through inputs.
      const outHdrs  = { ...cpiCaptured.headers };
      const outProps = { ...cpiCaptured.properties };
      kvData.headers.filter(r => r.name.trim() && !(r.name in outHdrs))
                    .forEach(r => { outHdrs[r.name] = r.value; });
      kvData.properties.filter(r => r.name.trim() && !(r.name in outProps))
                       .forEach(r => { outProps[r.name] = r.value; });

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
      _flashPaneResult(true);
      const colRight = document.getElementById('colRight');
      if (colRight.classList.contains('collapsed')) {
        colRight.classList.remove('collapsed');
        scheduleSave();
        _layoutAfterTransition(colRight, 400);
      }

    } catch (err) {
      // Flush xsl:message before error — trace should precede the failure.
      _xslMessages.forEach(m => clog(`xsl:message → ${m}`, 'warn'));

      const fullMsg = err.message || String(err);
      const msg = fullMsg.split('\n')[0];

      // terminate="yes" — Saxon throws "Terminated with <message text>".
      // Log as warn (intentional halt, not a bug).
      const terminateMatch = msg.match(/^Terminated with (.+)$/i);
      if (terminateMatch) {
        clog(`xsl:message terminate="yes" — ${terminateMatch[1]}`, 'warn');
      } else {
        // Find the user-stylesheet line, in priority order:
        //   1. Structured fields on the error object — covers compile-time
        //      errors (errorObject.value) and runtime errors (xsltLineNr
        //      gated on xsltModule). See extractSaxonErrorLine for details.
        //   2. The {expr} match against original source — handles static
        //      XPath errors where Saxon's xsltModule points to its own
        //      xpath.xsl but the message contains the user's expression.
        //   3. Bare line-number parse from the message string — last resort.
        const originalXslt = eds.xslt?.getValue() ?? '';
        const saxonLine    = parseSaxonErrorLine(fullMsg);
        const _structured  = extractSaxonErrorLine(err);
        let errLine =
          _structured?.line ||
          findXPathExpressionLine(fullMsg, originalXslt, saxonLine, 0) ||
          (saxonLine !== null ? saxonLine : null);

        // Saxon-JS attributes runtime errors to the enclosing template's
        // start line, not the failing instruction. When that's the source of
        // the line number, append a hint so users know to scan downward.
        const isTemplateLevel = _structured?.kind === 'runtime-template';

        // Saxon's runtime line can fall on a multi-line element's continuation
        // (e.g. an xmlns: declaration on its own line). Nudge to the next
        // <xsl:…> element so the marker lands on something instruction-shaped.
        if (isTemplateLevel && errLine) {
          errLine = nudgeToNextXslElement(originalXslt, errLine);
        }

        // Strip Saxon's "on line N in /NoStylesheetBaseURI" location prefix
        // from the displayed message — line is shown separately.
        const cleanMsg = msg
          .replace(/\s*(?:on|at)\s+line\s+\d+\s+in\s+\/NoStylesheetBaseURI\s*/i, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (errLine) {
          clog(`[Saxon] line ${errLine}: ${cleanMsg}`, 'error');
          xsltDecorations = markErrorLine(eds.xslt, errLine, cleanMsg, xsltDecorations);
          const trail = isTemplateLevel
            ? `↳ highlighted in XSLT editor at line ${errLine} (enclosing template — Saxon-JS does not pinpoint runtime-error instructions; scan downward)`
            : `↳ highlighted in XSLT editor at line ${errLine}`;
          clog(trail, 'error');
        } else {
          clog(`[Saxon] ${cleanMsg}`, 'error');
        }
      }

      setStatus('Transform failed', 'err');
      _flashPaneResult(false);
    } finally {
      console.log = _origConsoleLog;
      if (hasCPI) {
        _prevCpiSetHeader   !== undefined ? (window.cpiSetHeader   = _prevCpiSetHeader)   : delete window.cpiSetHeader;
        _prevCpiSetProperty !== undefined ? (window.cpiSetProperty = _prevCpiSetProperty) : delete window.cpiSetProperty;
      }
    }

  } finally {
    // Always re-enable Run button — even if preflight or param building throws.
    resetBtn();
    document.body.classList.remove('running');
  }
}