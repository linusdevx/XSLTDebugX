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

// Clipboard helper — single source of truth for navigator + execCommand fallback.
// Pass a custom onFail when the UI needs a different affordance (e.g. share.js).
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

// Reset the output editor pane to empty + given language. Idempotent on null editor.
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
  // Editorial direction B: re-show the empty-state hint after a clear.
  document.getElementById('outEdWrap')?.classList.remove('has-content');
}

// Backdrop click-to-close factory shared by three modals.
function _makeBackdropClose(backdropId, closeFn) {
  return function(e) {
    if (e.target.id === backdropId) closeFn();
  };
}

// Keep keyboard focus inside the top-most open dialog. Individual dialogs
// still choose their most useful initial control when opened.
document.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const dialogs = [...document.querySelectorAll('.ex-modal-backdrop.open[role="dialog"]')];
  const dialog = dialogs.at(-1);
  if (!dialog) return;
  const focusable = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.hidden && element.getClientRects().length > 0);
  if (!focusable.length) { event.preventDefault(); return; }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!dialog.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}, true);

function _layoutAfterTransition(el, fallbackMs = 400) {
  const relayout = () => {
    eds.xml?.layout();
    eds.xslt?.layout();
    eds.out?.layout();
  };
  if (!el) { setTimeout(relayout, fallbackMs); return; }
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    relayout();
    el.removeEventListener('transitionend', fire);
  };
  el.addEventListener('transitionend', fire, { once: true });
  setTimeout(fire, fallbackMs);
}

let eds = { xml: null, xslt: null, out: null };
let saxonReady  = false;

// Two separate XML models for XSLT/XPath mode isolation
let xmlModelXslt  = null;
let xmlModelXpath = null;

let kvData = { headers: [], properties: [] };
let kvIdSeq = 0;

// Top-level so loadExample can cancel them.
let xsltDebounce = null;
let xmlDebounce  = null;

// Console DOM elements don't exist when state.js loads — lazy-cache on first use.
let _consoleBodyEl   = null;
let _consoleSearchEl = null;
function _getConsoleEls() {
  if (!_consoleBodyEl)   _consoleBodyEl   = document.getElementById('consoleBody');
  if (!_consoleSearchEl) _consoleSearchEl = document.getElementById('consoleSearch');
  return { body: _consoleBodyEl, search: _consoleSearchEl };
}

function clog(msg, type = 'info') {
  const { body, search } = _getConsoleEls();
  if (!body) return; // DOM not ready — drop message
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.dataset.type = type;
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const _LOG_ICON = { error: 'x-circle', warn: 'alert-triangle', success: 'check-circle', info: 'info' };
  const iconName = _LOG_ICON[type] || 'info';
  line.innerHTML = `<span class="ts">${ts}</span><i data-lucide="${iconName}" width="11" height="11" class="log-type-icon"></i><span class="msg">${escHtml(msg)}</span>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: line });
  const term = search?.value.trim().toLowerCase() ?? '';
  const typeFilter = consoleFilter || 'all';
  const matchesType = typeFilter === 'all' || type === typeFilter || (typeFilter === 'info' && type === 'success');
  const matchesText = !term || msg.toLowerCase().includes(term);
  if (!matchesType || !matchesText) line.style.display = 'none';
  body.appendChild(line);
  // Cap visible console at 200 lines; keep consoleErrCount in sync when an error scrolls off.
  const errCountBefore = consoleErrCount;
  while (body.childElementCount > 200) {
    const evicted = body.firstElementChild;
    const t = evicted.dataset.type;
    if (t === 'error') consoleErrCount = Math.max(0, consoleErrCount - 1);
    body.removeChild(evicted);
  }
  body.scrollTop = body.scrollHeight;
  if (type === 'error') {
    consoleErrCount++;
    // Auto-restore minimised console so errors aren't silently hidden.
    if (consoleState === 'minimized') setConsoleState('normal');
  } else if (type === 'warn') {
    if (consoleState === 'minimized') setConsoleState('normal');
  }
  if (consoleErrCount !== errCountBefore) updateConsoleErrBadge();
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function clearConsole() {
  const body = document.getElementById('consoleBody');
  body.innerHTML = '';
  consoleErrCount = 0;
  updateConsoleErrBadge();
  if (typeof setConsoleFilter === 'function') setConsoleFilter('all');
  const search = document.getElementById('consoleSearch');
  if (search) search.value = '';
}

function setStatus(txt, state = 'ok') {
  document.getElementById('statTxt').textContent = txt;
  const d = document.getElementById('statDot');
  d.className = 'stat-dot ' + state;
}

let _saveTimer = null;

const _suppress = { save: false, validation: false, xmlChange: false };

function _withSuppress(flags, fn) {
  const prev = {};
  for (const k of flags) { prev[k] = _suppress[k]; _suppress[k] = true; }
  try { return fn(); }
  finally { for (const k of flags) _suppress[k] = prev[k]; }
}

function scheduleSave() {
  if (_suppress.save) { _suppress.save = false; return; }
  clearTimeout(_saveTimer);
  setSaveIndicator('saving');
  _saveTimer = setTimeout(saveState, 800);
}

function saveState() {
  if (!window.sessionController) return;
  void sessionController.saveQuickDrafts().catch(() => {});
}

function flushPendingSave() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
    return window.sessionController?.saveQuickDrafts() || Promise.resolve();
  }
  return window.sessionController?.saveChain || Promise.resolve();
}

function cancelPendingSave() {
  if (!_saveTimer) return;
  clearTimeout(_saveTimer);
  _saveTimer = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flushPendingSave().catch(() => {});
});
window.addEventListener('pagehide', () => { void flushPendingSave().catch(() => {}); });

function _resetXPathMode() {
  // Cancel pending validation/save timers so they don't fire against the freshly-reset content.
  clearTimeout(xmlDebounce);  xmlDebounce  = null;
  clearTimeout(xsltDebounce); xsltDebounce = null;
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  if (typeof invalidateXmlValidationCache === 'function') invalidateXmlValidationCache();
  sessionController?.resetSourceMetadata('xpath');

  _withSuppress(['save'], () => {
    if (xmlModelXpath) xmlModelXpath.setValue(EXAMPLES.xpathNavigation.xml);
  });

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
  clearTimeout(xmlDebounce);  xmlDebounce  = null;
  clearTimeout(xsltDebounce); xsltDebounce = null;
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  if (typeof invalidateXmlValidationCache === 'function') invalidateXmlValidationCache();
  sessionController?.resetSourceMetadata('xslt');

  _withSuppress(['save'], () => {
    if (xmlModelXslt) xmlModelXslt.setValue(EXAMPLES.identityTransform.xml);
    if (eds.xslt)     eds.xslt.setValue(EXAMPLES.identityTransform.xslt);
  });

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

  // XPath bar is hidden in XSLT mode — only sync if we're actually in XPath.
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
  localStorage.removeItem('xdebugx-xpath-history');
  if (typeof _xpathHistory !== 'undefined') _xpathHistory.length = 0;
  _xpathHistoryCursor = -1;

  if (typeof setConsoleHeight === 'function') setConsoleHeight(160);

  if (modeManager.isXpath) {
    _resetXPathMode();
  } else {
    _resetXsltMode();
  }
  void sessionController?.clearCurrentDraft().catch(error => setSaveIndicator('failed', error));
}

// Truthful local persistence state in the status bar.
let _savedFadeTimer = null;
function setSaveIndicator(state, error = null) {
  const ind = document.getElementById('savedIndicator');
  if (!ind) return;
  const text = document.getElementById('savedIndicatorText');
  const action = document.getElementById('saveIndicatorAction');
  clearTimeout(_savedFadeTimer);
  ind.classList.remove('saving', 'saved', 'failed', 'temporary', 'conflict');
  if (action) action.hidden = true;
  if (state === 'idle') {
    ind.style.opacity = '0';
    return;
  }
  ind.classList.add(state);
  ind.style.opacity = '1';
  if (text) {
    text.textContent = state === 'conflict'
      ? 'Save conflict'
      : state === 'temporary'
      ? 'Temporary · not saved'
      : state === 'saving'
      ? 'Saving…'
      : state === 'failed'
        ? 'Save failed'
        : 'Saved locally';
  }
  const itemName = sessionController?.getCurrentSession()?.title || 'Quick Playground';
  ind.title = state === 'conflict'
    ? 'This item changed in another tab; choose how to preserve your edits'
    : state === 'temporary'
    ? 'This shared session is open temporarily and will not overwrite your saved work'
    : state === 'failed'
    ? `${itemName} could not be saved locally${error?.message ? ': ' + error.message : ''}`
    : state === 'saving'
      ? `Saving ${itemName} locally`
      : `${itemName} saved locally`;
  if (action) {
    action.hidden = !['failed', 'conflict', 'temporary'].includes(state);
    action.textContent = state === 'conflict' ? 'Resolve' : state === 'temporary' ? 'Save…' : 'Retry';
  }
  if (state === 'saved') {
    _savedFadeTimer = setTimeout(() => { ind.style.opacity = '0'; }, 2000);
  }
}

function handleSaveIndicatorAction(event) {
  event.stopPropagation();
  const indicator = document.getElementById('savedIndicator');
  if (indicator?.classList.contains('conflict')) {
    openSessionConflictDialog();
    return;
  }
  if (indicator?.classList.contains('failed')) {
    void sessionController?.saveQuickDrafts().catch(() => {});
    return;
  }
  if (indicator?.classList.contains('temporary')) {
    void saveCurrentAsCopy().catch(reportExplorerActionError);
  }
}

function showSavedIndicator() {
  setSaveIndicator('saved');
}
