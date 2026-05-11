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
function clog(msg, type = 'info') {
  const body = document.getElementById('consoleBody');
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.dataset.type = type;
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  line.innerHTML = `<span class="ts">${ts}</span><span class="msg">${escHtml(msg)}</span>`;
  // Apply current search filter to new line before appending
  const term = document.getElementById('consoleSearch')?.value.trim().toLowerCase() ?? '';
  const typeFilter = consoleFilter || 'all';
  const matchesType = typeFilter === 'all' || type === typeFilter || (typeFilter === 'info' && type === 'success');
  const matchesText = !term || msg.toLowerCase().includes(term);
  if (!matchesType || !matchesText) line.style.display = 'none';
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
  // Track errors/warnings for the minimised-console badge
  if (type === 'error' || type === 'warn') {
    consoleErrCount++;
    updateConsoleErrBadge();
    // Auto-restore console if minimised so errors aren't silently hidden
    if (consoleState === 'minimized') setConsoleState('normal');
  }
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
  if (xmlModelXpath) xmlModelXpath.setValue(EXAMPLES.xpathNavigation.xml);
  if (eds.out) { monaco.editor.setModelLanguage(eds.out.getModel(), 'xml'); const _b=document.getElementById('outLangBadge'); const _d=document.getElementById('outDownloadBtn'); if(_b)_b.textContent='XML'; if(_d){_d.title='Download output as XML';_d.onclick=()=>downloadPane('out','output.xml');} eds.out.updateOptions({ readOnly: false }); eds.out.setValue(''); eds.out.updateOptions({ readOnly: true }); }
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
  if (xmlModelXslt) xmlModelXslt.setValue(EXAMPLES.identityTransform.xml);
  if (eds.xslt) { _suppressNextSave = true; eds.xslt.setValue(EXAMPLES.identityTransform.xslt); }
  _suppressNextSave = false;
  if (eds.out) { monaco.editor.setModelLanguage(eds.out.getModel(), 'xml'); const _b=document.getElementById('outLangBadge'); const _d=document.getElementById('outDownloadBtn'); if(_b)_b.textContent='XML'; if(_d){_d.title='Download output as XML';_d.onclick=()=>downloadPane('out','output.xml');} eds.out.updateOptions({ readOnly: false }); eds.out.setValue(''); eds.out.updateOptions({ readOnly: true }); }
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

  const _defaultExpr = EXAMPLES.xpathNavigation.xpathExpr ?? '';
  if (typeof _syncXPathInput === 'function') _syncXPathInput(_defaultExpr);
  else { const xi = document.getElementById('xpathInput'); if (xi) xi.value = _defaultExpr; }

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