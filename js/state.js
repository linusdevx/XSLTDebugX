// ════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════

// ── Shared Utilities ──
function _escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function formatFileSize(bytes) { return (bytes / 1024).toFixed(1); }
function logError(context, err) {
  const msg = err?.message || String(err);
  clog(context + ': ' + msg, 'error');
  console.warn('[XSLTDebugX]', context, err);
}
function guardReady() {
  if (!saxonReady) { clog('Saxon-JS not ready yet', 'error'); return false; }
  return true;
}

// ── Clipboard helper — single source of truth for navigator + execCommand fallback.
// onSuccess: () => void  — called when text is on the clipboard.
// onFail:    () => void  — optional; called when both APIs fail. If omitted, logs a generic
//                          "Clipboard access denied" error. Pass a custom onFail when the
//                          UI needs a different affordance (e.g. share.js selecting the URL).
function _clipboardWrite(text, onSuccess, onFail) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch(_) {}
    document.body.removeChild(ta);
    if (ok) { onSuccess(); return; }
    if (onFail) onFail();
    else clog('Clipboard access denied', 'error');
  };
  if (window.navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess, fallback);
  } else {
    fallback();
  }
}

// ── Reset the output editor pane to empty + given language. Used by both reset functions
// and reusable from transform.js if/when output type changes. Idempotent on null editor.
function _resetOutputPane(lang, defaultName) {
  if (!eds.out) return;
  monaco.editor.setModelLanguage(eds.out.getModel(), lang);
  const badge = document.getElementById('outLangBadge');
  if (badge) badge.textContent = lang.toUpperCase();
  const dl = document.getElementById('outDownloadBtn');
  if (dl) {
    dl.title   = `Download output as ${lang.toUpperCase()}`;
    dl.onclick = () => downloadPane('out', defaultName);
  }
  eds.out.updateOptions({ readOnly: false });
  eds.out.setValue('');
  eds.out.updateOptions({ readOnly: true });
}

// ── Backdrop click-to-close factory. The three modals share an identical
// `e.target.id === backdropId && close()` pattern. Returns a handler suitable
// for the inline onclick="..." attributes in index.html.
function _makeBackdropClose(backdropId, closeFn) {
  return function(e) {
    if (e.target.id === backdropId) closeFn();
  };
}

let eds = { xml: null, xslt: null, out: null };
let saxonReady  = false;

// Two separate XML models for XSLT/XPath mode isolation
let xmlModelXslt  = null;  // XML model for XSLT mode
let xmlModelXpath = null;  // XML model for XPath mode

// KV stores: { id, name, value }
let kvData = { headers: [], properties: [] };
let kvIdSeq = 0;

// Validation debounce timers — declared at top level so loadExample can cancel them
let xsltDebounce = null;
let xmlDebounce  = null;

// ════════════════════════════════════════════
//  CONSOLE
// ════════════════════════════════════════════
// M-1: lazy-cache the console DOM elements. They don't exist when state.js
// loads, but once they appear (loader hides → consoleBody mounts) they live
// for the rest of the session. Falls back gracefully — if a lookup misses we
// just retry next call.
let _consoleBodyEl   = null;
let _consoleSearchEl = null;
function _getConsoleEls() {
  if (!_consoleBodyEl)   _consoleBodyEl   = document.getElementById('consoleBody');
  if (!_consoleSearchEl) _consoleSearchEl = document.getElementById('consoleSearch');
  return { body: _consoleBodyEl, search: _consoleSearchEl };
}

function clog(msg, type = 'info') {
  const { body, search } = _getConsoleEls();
  if (!body) return; // DOM not ready yet — caller's message is dropped, matches old behaviour
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.dataset.type = type;
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  line.innerHTML = `<span class="ts">${ts}</span><span class="msg">${escHtml(msg)}</span>`;
  // Apply current search filter to new line before appending
  const term = search?.value.trim().toLowerCase() ?? '';
  const typeFilter = consoleFilter || 'all';
  const matchesType = typeFilter === 'all' || type === typeFilter || (typeFilter === 'info' && type === 'success');
  const matchesText = !term || msg.toLowerCase().includes(term);
  if (!matchesType || !matchesText) line.style.display = 'none';
  body.appendChild(line);
  // Cap visible console DOM at 500 lines. Decrement consoleErrCount when an
  // evicted line was an error/warn so the badge stays in sync with what the
  // user can actually see and copy.
  // M-2: track count before/after so we only repaint the badge when it changes.
  const errCountBefore = consoleErrCount;
  while (body.childElementCount > 500) {
    const evicted = body.firstElementChild;
    const t = evicted.dataset.type;
    if (t === 'error' || t === 'warn') consoleErrCount = Math.max(0, consoleErrCount - 1);
    body.removeChild(evicted);
  }
  body.scrollTop = body.scrollHeight;
  // Track errors/warnings for the minimised-console badge
  if (type === 'error' || type === 'warn') {
    consoleErrCount++;
    // Auto-restore console if minimised so errors aren't silently hidden
    if (consoleState === 'minimized') setConsoleState('normal');
  }
  if (consoleErrCount !== errCountBefore) updateConsoleErrBadge();
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function clearConsole() {
  const body = document.getElementById('consoleBody');
  body.innerHTML = '';
  consoleErrCount = 0;
  updateConsoleErrBadge();
  // Reset filter buttons to ALL and clear search
  if (typeof setConsoleFilter === 'function') setConsoleFilter('all');
  const search = document.getElementById('consoleSearch');
  if (search) search.value = '';
}

// ════════════════════════════════════════════
//  STATUS
// ════════════════════════════════════════════
function setStatus(txt, state = 'ok') {
  document.getElementById('statTxt').textContent = txt;
  const d = document.getElementById('statDot');
  d.className = 'stat-dot ' + state;
}



// ════════════════════════════════════════════
//  STATE PERSISTENCE  (localStorage)
// ════════════════════════════════════════════
const STORAGE_KEY = 'xdebugx-session-v1';
let _saveTimer = null;

// Debounced save — coalesces rapid keystrokes into one write
// Set _suppressNextSave = true before a programmatic setValue to skip that one save.
let _suppressNextSave = false;

// Guard against synthetic content-change event when swapping models in toggleXPath
let _suppressNextXmlChange = false;

function scheduleSave() {
  if (_suppressNextSave) { _suppressNextSave = false; return; }
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveState, 800);
}

function saveState() {
  try {
    const state = {
      // Save both XML models independently
      xmlXslt:    xmlModelXslt?.getValue()  ?? '',
      xmlXpath:   xmlModelXpath?.getValue() ?? '',
      xslt:       eds.xslt?.getValue() ?? '',
      headers:    kvData.headers.map(r => ({ name: r.name, value: r.value })),
      properties: kvData.properties.map(r => ({ name: r.name, value: r.value })),
      leftCollapsed:  document.getElementById('colLeft')?.classList.contains('collapsed')  ?? false,
      rightCollapsed: document.getElementById('colRight')?.classList.contains('collapsed') ?? true,
      centerCollapsed: !modeManager.isXpath && (document.getElementById('colCenter')?.classList.contains('collapsed') ?? false),
      xpathExpr:    document.getElementById('xpathInput')?.value ?? '',
      xpathEnabled: modeManager.isXpath,
      lastExampleKey: window._lastExampleKey ?? null,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Flash a subtle "saved" indicator
    showSavedIndicator();
  } catch (e) {
    // localStorage full or unavailable — fail silently
  }
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function _resetXPathMode() {
  // Cancel pending validation timers so they don't fire against the freshly-reset content
  clearTimeout(xmlDebounce);  xmlDebounce  = null;
  clearTimeout(xsltDebounce); xsltDebounce = null;

  // C-2: arm _suppressNextSave BEFORE setValue. Monaco fires
  // onDidChangeModelContent synchronously inside setValue, and the editor.js
  // listener calls scheduleSave() — without arming the flag, the reset would
  // queue a save against mid-transition state. try/finally restores the
  // previous flag value rather than blindly clearing one set by an outer caller.
  const _prevSuppress = _suppressNextSave;
  _suppressNextSave = true;
  try {
    if (xmlModelXpath) xmlModelXpath.setValue(EXAMPLES.xpathNavigation.xml);
  } finally {
    _suppressNextSave = _prevSuppress;
  }

  _resetOutputPane('xml', 'output.xml');
  if (eds.xml) clearAllMarkers();
  if (typeof clearXPathResults === 'function') clearXPathResults();
  if (typeof renderXPathHints === 'function') renderXPathHints(null);
  window._lastExampleKey = null;

  const _defaultExpr = EXAMPLES.xpathNavigation.xpathExpr ?? '';
  if (typeof _syncXPathInput === 'function') _syncXPathInput(_defaultExpr);
  else { const xi = document.getElementById('xpathInput'); if (xi) xi.value = _defaultExpr; }

  setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 50);
  setStatus('Ready', 'ok');
  clog('XPath session cleared — XML and expression reset to defaults.', 'info');
}

function _resetXsltMode() {
  // Cancel pending validation timers so they don't fire against the freshly-reset content
  clearTimeout(xmlDebounce);  xmlDebounce  = null;
  clearTimeout(xsltDebounce); xsltDebounce = null;

  // C-2: arm _suppressNextSave BEFORE the FIRST setValue. Previously the XML
  // setValue ran before the flag was set, so its synchronous scheduleSave()
  // queued a save with mid-reset XSLT. try/finally restores the previous flag
  // value rather than blindly clearing one set by an outer caller.
  const _prevSuppress = _suppressNextSave;
  _suppressNextSave = true;
  try {
    if (xmlModelXslt) xmlModelXslt.setValue(EXAMPLES.identityTransform.xml);
    if (eds.xslt)     eds.xslt.setValue(EXAMPLES.identityTransform.xslt);
  } finally {
    _suppressNextSave = _prevSuppress;
  }

  _resetOutputPane('xml', 'output.xml');

  kvData.headers    = [];
  kvData.properties = [];
  kvIdSeq = 0;
  renderKV('headers');
  renderKV('properties');
  renderOutputKV({}, {});

  if (eds.xml && eds.xslt) clearAllMarkers();
  if (typeof clearXPathResults === 'function') clearXPathResults();
  if (typeof renderXPathHints === 'function') renderXPathHints(null);
  window._lastExampleKey = null;

  // M-3: XPath bar is hidden in XSLT mode — only sync if we're actually in XPath
  if (modeManager.isXpath) {
    const _defaultExpr = EXAMPLES.xpathNavigation.xpathExpr ?? '';
    if (typeof _syncXPathInput === 'function') _syncXPathInput(_defaultExpr);
    else { const xi = document.getElementById('xpathInput'); if (xi) xi.value = _defaultExpr; }
  }

  setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 50);
  setStatus('Ready', 'ok');
  clog('XSLT session cleared — editors reset to defaults.', 'info');
}

function clearSavedState() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('xdebugx-xpath-history');
  if (typeof _xpathHistory !== 'undefined') _xpathHistory.length = 0;
  _xpathHistoryCursor = -1;

  if (modeManager.isXpath) {
    _resetXPathMode();
  } else {
    _resetXsltMode();
  }

  const ind = document.getElementById('savedIndicator');
  if (ind) ind.style.opacity = '0';
}

// ── Tiny "● Saved" pill in the status bar ──
let _savedFadeTimer = null;
function showSavedIndicator() {
  const ind = document.getElementById('savedIndicator');
  if (!ind) return;
  ind.style.opacity = '1';
  clearTimeout(_savedFadeTimer);
  _savedFadeTimer = setTimeout(() => { ind.style.opacity = '0'; }, 2000);
}