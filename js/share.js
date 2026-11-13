const SHARE_MAX_EXPANDED_BYTES = 60_000_000;

function buildSharePayload() {
  return {
    // Share is XSLT-only — always read from the XSLT model explicitly.
    xml:        xmlModelXslt?.getValue() ?? '',
    xslt:       eds.xslt?.getValue() ?? '',
    headers:    kvData.headers.map(r    => ({ name: r.name, value: r.value })),
    properties: kvData.properties.map(r => ({ name: r.name, value: r.value })),
    runtimeProfile,
  };
}

function encodeShareData(data) {
  const bytes      = new TextEncoder().encode(JSON.stringify(data));
  const compressed = pako.deflateRaw(bytes, { level: 9 });
  // Chunked to avoid O(n²) string concat and call-stack limits on large payloads.
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < compressed.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, compressed.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function generateShareUrl() {
  const url = location.href.split('#')[0] + '#share/' + encodeShareData(validateSharePayload(buildSharePayload()));
  if (url.length > 2000) {
    clog(`Share URL is ${url.length.toLocaleString()} chars — some browsers cap URLs at ~2,000. Recipients may not be able to open it. Try reducing the XML or XSLT size.`, 'warn');
  }
  return url;
}

function inflateShareJson(bytes, maxExpandedBytes = SHARE_MAX_EXPANDED_BYTES) {
  const inflater = new pako.Inflate({ raw: true, chunkSize: 64 * 1024 });
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const parts = [];
  let expandedBytes = 0;
  inflater.onData = chunk => {
    expandedBytes += chunk.byteLength;
    if (expandedBytes > maxExpandedBytes) throw new Error('Expanded share payload is too large.');
    parts.push(decoder.decode(chunk, { stream: true }));
  };
  inflater.push(bytes, true);
  if (inflater.err) throw new Error(inflater.msg || 'Share payload could not be decompressed.');
  parts.push(decoder.decode());
  return parts.join('');
}

function loadFromShareHash() {
  if (!location.hash.startsWith('#share/')) return false;
  try {
    // encodeShareData only emits base64url chars [A-Za-z0-9_-]; none need URL escaping,
    // so decodeURIComponent would be a no-op and would throw on hand-edited '%'.
    const encoded = location.hash.slice(7);
    if (!encoded || encoded.length > 7_000_000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
      throw new Error('Share payload is invalid or too large.');
    }
    const raw    = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const b64    = raw.padEnd(Math.ceil(raw.length / 4) * 4, '=');
    const binary = atob(b64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = inflateShareJson(bytes);
    window._pendingShareData = validateSharePayload(JSON.parse(json));
    history.replaceState(null, '', location.pathname + location.search);
    return true;
  } catch (e) {
    window._pendingShareError = 'The link is corrupted, unsupported, or exceeds the safe size limit.';
    history.replaceState(null, '', location.pathname + location.search);
    clog('Failed to decode share URL — link may be corrupted', 'error');
    return false;
  }
}

async function handleShareHashChange() {
  if (!location.hash.startsWith('#share/')) return;
  window._pendingShareNeedsRestore = false;
  const valid = loadFromShareHash();
  if (!saxonReady) return;
  if (valid && window._pendingShareData) openIncomingShareDialog(window._pendingShareData);
  else if (window._pendingShareError) openInvalidShareDialog(window._pendingShareError);
}

window.addEventListener('hashchange', () => { void handleShareHashChange(); });

function openInvalidShareDialog(message = window._pendingShareError) {
  if (!message) return;
  const element = document.getElementById('invalidShareMessage');
  if (element) element.textContent = message;
  document.getElementById('invalidShareBackdrop')?.classList.add('open');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => document.querySelector('#invalidShareBackdrop .incoming-share-btn')?.focus());
}

function closeInvalidShareDialog() {
  document.getElementById('invalidShareBackdrop')?.classList.remove('open');
  document.body.classList.remove('modal-open');
  window._pendingShareError = null;
  requestAnimationFrame(() => document.getElementById('runBtn')?.focus());
}

var handleInvalidShareBackdropClick = _makeBackdropClose('invalidShareBackdrop', closeInvalidShareDialog);

function validateSharePayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Share payload must be an object.');
  const xml = typeof data.xml === 'string' ? data.xml : '';
  const xslt = typeof data.xslt === 'string' ? data.xslt : '';
  if (xml.length > 25_000_000 || xslt.length > 25_000_000) throw new Error('Shared source is too large.');
  const normalizeRows = (rows, label) => {
    if (rows == null) return [];
    if (!Array.isArray(rows) || rows.length > 10_000) throw new Error(`${label} are invalid.`);
    return rows.map(row => {
      if (!row || typeof row !== 'object' || typeof row.name !== 'string' || typeof row.value !== 'string') {
        throw new Error(`${label} contain an invalid row.`);
      }
      if (row.name.length > 1_000 || row.value.length > 1_000_000) throw new Error(`${label} contain an oversized row.`);
      return { name: row.name, value: row.value };
    });
  };
  return {
    xml,
    xslt,
    headers: normalizeRows(data.headers, 'Headers'),
    properties: normalizeRows(data.properties, 'Properties'),
    runtimeProfile: data.runtimeProfile === 'standard' ? 'standard' : 'cpi',
  };
}

// ── Apply (called from editor.js after Monaco + Saxon are ready) ─────────────

function applyShareData(data) {
  if (!data) return;
  sessionController?.setSourceMetadata('xslt', { runOptions: {} });

  // Share is always XSLT context — switch the receiver if needed.
  if (modeManager.isXpath) {
    modeManager.setMode('XSLT');
    clog('Switched to XSLT mode — share link loaded', 'info');
  }
  setRuntimeProfile(data.runtimeProfile, { save: false, log: false });

  clearTimeout(xsltDebounce);
  clearTimeout(xmlDebounce);
  clearAllMarkers();
  if (typeof invalidateXmlValidationCache === 'function') invalidateXmlValidationCache();

  if (eds.xml && xmlModelXslt) {
    eds.xml.setModel(xmlModelXslt);
  }

  // Suppress listener-driven autosave. The receiver chooses the persistence mode.
  if (data.xml !== undefined) {
    _withSuppress(['save', 'validation'], () => xmlModelXslt?.setValue(data.xml));
  }
  if (data.xslt !== undefined) {
    _withSuppress(['save', 'validation'], () => eds.xslt?.setValue(data.xslt));
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
}

function openIncomingShareDialog(data) {
  const safeData = validateSharePayload(data);
  window._pendingShareData = safeData;
  const summary = document.getElementById('incomingShareSummary');
  if (summary) {
    const namedHeaders = safeData.headers.filter(row => row.name).length;
    const namedProperties = safeData.properties.filter(row => row.name).length;
    summary.textContent = `${safeData.xml.length.toLocaleString()} XML characters · ${safeData.xslt.length.toLocaleString()} XSLT characters · ${namedHeaders} headers · ${namedProperties} properties`;
  }
  const title = document.getElementById('incomingShareTitleInput');
  if (title) title.value = 'Shared XSLT Mapping';
  setIncomingShareError('');
  document.getElementById('incomingShareBackdrop')?.classList.add('open');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => document.getElementById('incomingShareTemporaryBtn')?.focus());
}

function closeIncomingShareDialog() {
  document.getElementById('incomingShareBackdrop')?.classList.remove('open');
  document.body.classList.remove('modal-open');
  // Dialog opens from URL hash on page load — no trigger to return to.
  // Fall back to Run button so focus doesn't drop to body.
  requestAnimationFrame(() => document.getElementById('runBtn')?.focus());
}

function setIncomingShareError(message) {
  const error = document.getElementById('incomingShareError');
  if (!error) return;
  error.textContent = message;
  error.hidden = !message;
}

async function cancelIncomingShare() {
  const needsRestore = Boolean(window._pendingShareNeedsRestore);
  closeIncomingShareDialog();
  window._pendingShareData = null;
  window._pendingShareNeedsRestore = false;
  if (needsRestore) await sessionController.restoreInitialSession();
  clog(`Shared link cancelled — ${needsRestore ? 'local work restored' : 'current work kept'}`, 'info');
}

async function openSharedTemporarily() {
  const data = window._pendingShareData;
  if (!data) return;
  try {
    await flushPendingSave();
  } catch (error) {
    setIncomingShareError(`Current work could not be saved: ${error.message}`);
    return;
  }
  sessionController.beginTemporary('xslt', 'Shared XSLT Mapping');
  applyShareData(data);
  window._pendingShareData = null;
  window._pendingShareNeedsRestore = false;
  closeIncomingShareDialog();
  setSaveIndicator('temporary');
}

async function saveSharedCopy() {
  const data = window._pendingShareData;
  if (!data) return;
  const titleInput = document.getElementById('incomingShareTitleInput');
  const title = titleInput?.value.trim() || '';
  if (!title) {
    setIncomingShareError('Enter a name for the saved copy.');
    titleInput?.focus();
    return;
  }
  const saveButton = document.getElementById('incomingShareSaveBtn');
  if (saveButton) saveButton.disabled = true;
  setIncomingShareError('');
  try {
    await flushPendingSave();
    const record = await workspaceStore.createSession({
      type: 'xslt',
      workspaceId: 'workspace-default',
      folderId: null,
      title,
      source: {
        xml: data.xml,
        xslt: data.xslt,
        headers: data.headers,
        properties: data.properties,
        runtimeProfile: data.runtimeProfile,
        runOptions: {},
      },
    });
    applyShareData(data);
    sessionController.activateNamedSession(record);
    window._pendingShareData = null;
    window._pendingShareNeedsRestore = false;
    closeIncomingShareDialog();
    clog(`Saved shared session as “${record.title}” ✓`, 'success');
  } catch (error) {
    setIncomingShareError(error?.message || 'The shared copy could not be saved.');
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
}

var handleIncomingShareBackdropClick = _makeBackdropClose('incomingShareBackdrop', cancelIncomingShare);

let _shareReturnFocus = null;

function openShareModal() {
  _shareReturnFocus = document.activeElement;
  document.getElementById('shareModalBackdrop').classList.add('open');
  document.body.classList.add('modal-open');
  const input = document.getElementById('shareUrlInput');
  const warning = document.getElementById('shareLengthWarning');
  try {
    const url   = generateShareUrl();
    if (input) input.value = url;
    if (warning) {
      warning.textContent = url.length > 2000
        ? `This link is ${url.length.toLocaleString()} characters. Some browsers and messaging tools may truncate links above roughly 2,000 characters; reduce the input before sharing if possible.`
        : '';
      warning.hidden = url.length <= 2000;
    }
  } catch (e) {
    if (input) input.value = '';
    if (warning) {
      warning.textContent = `Share link could not be created: ${e.message}`;
      warning.hidden = false;
    }
    clog('Failed to generate share URL: ' + e.message, 'error');
  }
  requestAnimationFrame(() => document.getElementById('shareCopyBtn')?.focus());
}

function closeShareModal() {
  document.getElementById('shareModalBackdrop').classList.remove('open');
  document.body.classList.remove('modal-open');
  const returnFocus = _shareReturnFocus;
  _shareReturnFocus = null;
  requestAnimationFrame(() => returnFocus?.isConnected && returnFocus.focus());
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
