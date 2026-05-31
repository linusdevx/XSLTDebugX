// ════════════════════════════════════════════
//  SHARE
// ════════════════════════════════════════════

// ── Encode ──────────────────────────────────

function buildSharePayload() {
  return {
    // Share is XSLT-only — always read from XSLT model explicitly
    xml:        xmlModelXslt?.getValue() ?? '',
    xslt:       eds.xslt?.getValue() ?? '',
    headers:    kvData.headers.map(r    => ({ name: r.name, value: r.value })),
    properties: kvData.properties.map(r => ({ name: r.name, value: r.value })),
  };
}

function encodeShareData(data) {
  const bytes      = new TextEncoder().encode(JSON.stringify(data));
  const compressed = pako.deflateRaw(bytes, { level: 9 });
  // Chunked to avoid O(n²) string concat and call-stack limits on large payloads
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < compressed.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, compressed.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function generateShareUrl() {
  const url = location.href.split('#')[0] + '#share/' + encodeShareData(buildSharePayload());
  if (url.length > 2000) {
    clog(`Share URL is ${url.length.toLocaleString()} chars — some browsers cap URLs at ~2,000. Recipients may not be able to open it. Try reducing the XML or XSLT size.`, 'warn');
  }
  return url;
}

// ── Decode (called on page load) ─────────────

function loadFromShareHash() {
  if (!location.hash.startsWith('#share/')) return false;
  try {
    // encodeShareData only emits base64url chars [A-Za-z0-9_-]; none need URL escaping,
    // so decodeURIComponent would be a no-op here and would throw on hand-edited '%'.
    const raw    = location.hash.slice(7).replace(/-/g, '+').replace(/_/g, '/');
    const b64    = raw.padEnd(Math.ceil(raw.length / 4) * 4, '=');
    const binary = atob(b64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json   = new TextDecoder().decode(pako.inflateRaw(bytes));
    window._pendingShareData = JSON.parse(json);
    history.replaceState(null, '', location.pathname + location.search);
    return true;
  } catch (e) {
    clog('Failed to decode share URL — link may be corrupted', 'error');
    return false;
  }
}

// ── Apply (called from editor.js after Monaco + Saxon are ready) ─────────────

function applyShareData(data) {
  if (!data) return;

  // Share is always XSLT context — switch the receiver if needed
  if (modeManager.isXpath) {
    modeManager.setMode('XSLT');
    clog('Switched to XSLT mode — share link loaded', 'info');
  }

  clearTimeout(xsltDebounce);
  clearTimeout(xmlDebounce);
  clearAllMarkers();
  if (typeof invalidateXmlValidationCache === 'function') invalidateXmlValidationCache();

  if (eds.xml && xmlModelXslt) {
    eds.xml.setModel(xmlModelXslt);
  }

  // Suppress per-setValue listener-driven scheduleSave; call once at the end.
  if (data.xml  !== undefined) {
    const _prevSS = _suppressNextSave;
    _suppressNextSave = true;
    try {
      xmlModelXslt?.setValue(data.xml);
    } finally {
      _suppressNextSave = _prevSS;
    }
  }
  if (data.xslt !== undefined) {
    const _prevSV = _suppressNextValidation;
    const _prevSS = _suppressNextSave;
    _suppressNextValidation = true;
    _suppressNextSave       = true;
    try {
      eds.xslt?.setValue(data.xslt);
    } finally {
      _suppressNextSave       = _prevSS;
      _suppressNextValidation = _prevSV;
    }
  }

  kvData  = { headers: [], properties: [] };
  kvIdSeq = 0;
  (data.headers    || []).forEach(r => { kvIdSeq++; kvData.headers.push(   { id: kvIdSeq, name: r.name, value: r.value }); });
  (data.properties || []).forEach(r => { kvIdSeq++; kvData.properties.push({ id: kvIdSeq, name: r.name, value: r.value }); });

  const _shdr  = (data.headers    || []).filter(r => r.name).length;
  const _sprop = (data.properties || []).filter(r => r.name).length;
  const _parts = [
    `xml ${(data.xml  || '').length} chars`,
    `xslt ${(data.xslt || '').length} chars`,
  ];
  if (_shdr)  _parts.push(`${_shdr} header${_shdr  > 1 ? 's' : ''}`);
  if (_sprop) _parts.push(`${_sprop} propert${_sprop > 1 ? 'ies' : 'y'}`);
  clog(`Shared session loaded — ${_parts.join(' · ')} ✓`, 'success');

  scheduleSave();
}

// ── Modal ────────────────────────────────────

function openShareModal() {
  document.getElementById('shareModalBackdrop').classList.add('open');
  try {
    const url   = generateShareUrl();
    const input = document.getElementById('shareUrlInput');
    if (input) input.value = url;
    _copyShareUrl(url, true);
  } catch (e) {
    clog('Failed to generate share URL: ' + e.message, 'error');
  }
}

function closeShareModal() {
  document.getElementById('shareModalBackdrop').classList.remove('open');
}

// See modal.js for `var` rationale (kept on window for inline onclick=).
var handleShareBackdropClick = _makeBackdropClose('shareModalBackdrop', closeShareModal);

function _copyShareUrl(url, silent) {
  if (!url) return;

  const onSuccess = () => {
    if (!silent) {
      const btn  = document.getElementById('shareCopyBtn');
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1400);
      showCopyToast('✓ Copied share link');
    }
    clog('Share URL copied to clipboard', 'success');
  };

  // Custom fallback: select the URL input so the user can press Ctrl+C manually.
  const onFail = () => {
    const input = document.getElementById('shareUrlInput');
    if (input) input.select();
    clog('Auto-copy unavailable — URL selected, press Ctrl+C to copy', 'warn');
  };

  _clipboardWrite(url, onSuccess, onFail);
}