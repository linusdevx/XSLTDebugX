function reinitIcons(container) {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons(container ? { root: container } : undefined);
  }
}

function createRipple(e) {
  const btn = e.currentTarget;
  const circle = document.createElement('span');
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  circle.style.width = circle.style.height = size + 'px';
  circle.style.left = (e.clientX - rect.left - size / 2) + 'px';
  circle.style.top = (e.clientY - rect.top - size / 2) + 'px';
  circle.className = 'ripple-circle';
  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 600);
}

function showCopyToast(message, duration = 1500, type = 'success') {
  showToast(message, { tone: type === 'error' ? 'error' : 'success', duration });
}

const _TOAST_ICONS = {
  success: 'check',
  error:   'circle-alert',
  warning: 'triangle-alert',
  info:    'info',
};
const _TOAST_DURATIONS = { error: 6000, warning: 5000, info: 4000, success: 2500 };

function showToast(message, { tone = 'success', duration, dedupeKey } = {}) {
  let region = document.getElementById('toastRegion');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toastRegion';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'false');
    document.body.appendChild(region);
  }

  const key = dedupeKey || tone + ':' + message;
  const existing = region.querySelector(`[data-dedupe="${CSS.escape(key)}"]`);
  if (existing) existing._dismiss?.();

  while (region.children.length >= 4) region.firstElementChild?._dismiss?.();

  const ms = duration ?? _TOAST_DURATIONS[tone] ?? 2500;
  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  toast.dataset.dedupe = key;

  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', _TOAST_ICONS[tone] ?? 'info');
  icon.setAttribute('width', '14');
  icon.setAttribute('height', '14');
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'toast-message';
  text.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.innerHTML = '<i data-lucide="x" width="12" height="12" aria-hidden="true"></i>';

  toast.append(icon, text, closeBtn);
  region.appendChild(toast);
  reinitIcons(toast);

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }
  toast._dismiss = dismiss;
  closeBtn.addEventListener('click', dismiss);

  setTimeout(() => toast.classList.add('toast-in'), 10);
  const timer = setTimeout(dismiss, ms);
  closeBtn.addEventListener('click', () => clearTimeout(timer));
}

function toggleSideCol(side) {
  const col = document.getElementById(side === 'left' ? 'colLeft' : 'colRight');
  col.classList.toggle('collapsed');
  syncWorkspaceViewButtons();
  if (typeof updatePaneSplitters === 'function') updatePaneSplitters();
  if (typeof restorePaneLayout === 'function') void restorePaneLayout();
  scheduleSave();
  _layoutAfterTransition(col, 400);
}

let consoleState = 'normal';
let consoleErrCount = 0;
let consoleHeight = 160;
const CONSOLE_MIN_H = 80;
const CONSOLE_MAX_VH = 0.7;

function setConsoleState(state) {
  const panel = document.getElementById('consolePanel');
  panel.classList.toggle('minimized', state === 'minimized');
  consoleState = state;

  // Relay Monaco continuously during the CSS transition (350ms spring) to prevent blank editor.
  const start = performance.now();
  const duration = 400;
  function pump(now) {
    eds.xml?.layout();
    eds.xslt?.layout();
    eds.out?.layout();
    if (now - start < duration) requestAnimationFrame(pump);
  }
  requestAnimationFrame(pump);
}

function setConsoleHeight(px) {
  const max = Math.max(CONSOLE_MIN_H, Math.floor(window.innerHeight * CONSOLE_MAX_VH));
  consoleHeight = Math.max(CONSOLE_MIN_H, Math.min(max, px));
  const panel = document.getElementById('consolePanel');
  if (panel) panel.style.height = consoleHeight + 'px';
}

function startConsoleResize(e) {
  e.preventDefault();
  const panel = document.getElementById('consolePanel');
  if (!panel || panel.classList.contains('minimized')) return;

  const startY = e.clientY;
  const startH = panel.getBoundingClientRect().height;
  panel.classList.add('dragging');
  e.target.setPointerCapture?.(e.pointerId);

  function relayoutEditors() {
    [eds.xml, eds.xslt, eds.out].forEach(ed => {
      if (!ed) return;
      // Capture the bottom-visible line and whether the user was at doc bottom
      // BEFORE layout shrinks the editor.
      const ranges = ed.getVisibleRanges?.();
      let oldBottomLine = null;
      let wasAtDocBottom = false;
      if (ranges && ranges.length) {
        oldBottomLine = ranges[ranges.length - 1].endLineNumber;
        const lineCount = ed.getModel?.()?.getLineCount?.() ?? 0;
        wasAtDocBottom = oldBottomLine >= lineCount - 1;
      }
      ed.layout();
      // Pin the previously-bottom line to the new bottom so shrinking doesn't
      // push the user's last-visible line out of view.
      if (oldBottomLine != null && typeof monaco !== 'undefined') {
        const targetLine = wasAtDocBottom ? ed.getModel().getLineCount() : oldBottomLine;
        const range = new monaco.Range(targetLine, 1, targetLine, 1);
        ed.revealRange(range, 1, 4); // Immediate, BottomOfScrollableViewport
      }
    });
  }

  function onMove(ev) {
    // Drag UP grows the console — invert the delta.
    setConsoleHeight(startH - (ev.clientY - startY));
    relayoutEditors();
  }
  function onUp() {
    panel.classList.remove('dragging');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    scheduleSave();
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

// Clicking the bar toggles minimize.
function handleConsoleBarClick(e) {
  setConsoleState(consoleState === 'minimized' ? 'normal' : 'minimized');
}

function updateConsoleErrBadge() {
  const badge = document.getElementById('consoleErrBadge');
  if (!badge) return;
  if (consoleErrCount > 0) {
    badge.textContent = consoleErrCount;
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }
}

function copyConsole() {
  const body = document.getElementById('consoleBody');
  const text = [...body.querySelectorAll('.log-line')]
    .filter(l => l.style.display !== 'none')
    .map(l => {
      const ts  = l.querySelector('.ts')?.textContent  ?? '';
      const msg = l.querySelector('.msg')?.textContent ?? '';
      return `${ts}  ${msg}`;
    }).join('\n');
  if (!text.trim()) return clog('Console is empty — nothing to copy', 'warn');

  _clipboardWrite(text, () => {
    clog('Console copied to clipboard ✓', 'success');
    showCopyToast('✓ Copied console output');
  });
}

// ════════════════════════════════════════════
//  CONSOLE FILTER
// ════════════════════════════════════════════
let consoleFilter = 'all';

function setConsoleFilter(filter) {
  consoleFilter = filter;

  document.querySelectorAll('.console-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  // Delegate all filtering (type + text) to applyConsoleSearch.
  const searchVal = document.getElementById('consoleSearch')?.value ?? '';
  applyConsoleSearch(searchVal);
}

function applyConsoleSearch(query) {
  const term = query.trim().toLowerCase();
  const typeFilter = consoleFilter || 'all';
  document.querySelectorAll('#consoleBody .log-line').forEach(line => {
    const t = line.dataset.type;
    // INFO filter shows both info and success (success is a positive outcome, not a separate category).
    const matchesType = typeFilter === 'all'
      || t === typeFilter
      || (typeFilter === 'info' && t === 'success');
    const matchesText = !term || line.textContent.toLowerCase().includes(term);
    line.style.display = matchesType && matchesText ? '' : 'none';
  });
}

// Patch Run button kbd label for non-Mac platforms — ⌘ is Mac-only.
(function () {
  if (/Mac|iPhone|iPad|iPod/.test(navigator.platform)) return;
  const kbd = document.querySelector('#runBtn .kbd');
  if (kbd) kbd.textContent = 'Ctrl+↵';
})();

function toggleTheme() {
  document.body.classList.add('theme-switching');

  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('xdebugx-theme', isLight ? 'light' : 'dark');
  clog(`Theme: ${isLight ? 'light' : 'dark'} mode`, 'info');

  const monacoTheme = isLight ? 'xdebugx-light' : 'xdebugx';
  if (typeof monaco !== 'undefined') {
    monaco.editor.setTheme(monacoTheme);
    setTimeout(() => { if (typeof refreshXPathColors === 'function') refreshXPathColors(); }, 50);
  }

  requestAnimationFrame(() => {
    document.body.classList.remove('theme-switching');
  });
}

let _helpReturnFocus = null;

function openHelpModal() {
  _helpReturnFocus = document.activeElement;
  document.getElementById('helpModalBackdrop').classList.add('open');
}

function closeHelpModal() {
  document.getElementById('helpModalBackdrop').classList.remove('open');
  const returnFocus = _helpReturnFocus;
  _helpReturnFocus = null;
  requestAnimationFrame(() => returnFocus?.isConnected && returnFocus.focus());
}

// `var` keeps it on window for inline onclick=. Factory in state.js.
var handleHelpBackdropClick = _makeBackdropClose('helpModalBackdrop', closeHelpModal);

function switchHelpTab(tab) {
  document.querySelectorAll('.help-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('helpTabFeatures').classList.toggle('active', tab === 'features');
  document.getElementById('helpTabShortcuts').classList.toggle('active', tab === 'shortcuts');
}

function syncMobilePaneNav() {
  const nav = document.getElementById('mobilePaneNav');
  const workspace = document.querySelector('.workspace');
  if (!nav || !workspace) return;
  const centerButton = nav.querySelector('[data-pane="colCenter"]');
  const labels = modeManager?.isXpath
    ? { colLeft: 'Query + Input', colCenter: 'Transform', colRight: 'Results' }
    : { colLeft: 'Input', colCenter: 'Transform', colRight: 'Output' };
  nav.querySelectorAll('button').forEach(button => { button.textContent = labels[button.dataset.pane]; });
  if (centerButton) centerButton.hidden = Boolean(modeManager?.isXpath);
  const visible = [...nav.querySelectorAll('button:not([hidden])')];
  const workspaceLeft = workspace.getBoundingClientRect().left;
  const active = visible.reduce((closest, button) => {
    const pane = document.getElementById(button.dataset.pane);
    const distance = pane?.classList.contains('collapsed') ? Infinity : Math.abs(pane.getBoundingClientRect().left - workspaceLeft);
    return distance < closest.distance ? { button, distance } : closest;
  }, { button: visible[0], distance: Infinity }).button;
  visible.forEach(button => {
    const selected = button === active;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
}

function focusMobilePane(id) {
  const workspace = document.querySelector('.workspace');
  const pane = document.getElementById(id);
  if (!workspace || !pane || window.innerWidth > 767) return;
  pane.classList.remove('collapsed');
  workspace.scrollTo({ left: pane.offsetLeft, behavior: 'smooth' });
  setTimeout(() => {
    syncMobilePaneNav();
    eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout();
  }, 250);
}

function setWorkspaceView(view) {
  const left = document.getElementById('colLeft');
  const center = document.getElementById('colCenter');
  const right = document.getElementById('colRight');
  if (!left || !center || !right) return;
  if (modeManager.isXpath) {
    left.classList.toggle('collapsed', view === 'output');
    center.classList.add('collapsed');
    right.classList.toggle('collapsed', view === 'edit');
  } else {
    left.classList.toggle('collapsed', view === 'output');
    center.classList.toggle('collapsed', view === 'output');
    right.classList.toggle('collapsed', view === 'edit');
  }
  syncWorkspaceViewButtons();
  if (typeof updatePaneSplitters === 'function') updatePaneSplitters();
  scheduleSave();
  setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 80);
}

function syncWorkspaceViewButtons() {
  const leftCollapsed = document.getElementById('colLeft')?.classList.contains('collapsed');
  const rightCollapsed = document.getElementById('colRight')?.classList.contains('collapsed');
  const view = leftCollapsed ? 'output' : rightCollapsed ? 'edit' : 'all';
  document.querySelectorAll('[data-workspace-view]').forEach(button => {
    const active = button.dataset.workspaceView === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const labels = modeManager?.isXpath
    ? { edit: 'Query and input', all: 'Query and results', output: 'Results' }
    : { edit: 'Input and transform', all: 'All panes', output: 'Output' };
  document.querySelectorAll('[data-workspace-view]').forEach(button => {
    button.title = labels[button.dataset.workspaceView];
    button.setAttribute('aria-label', labels[button.dataset.workspaceView]);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const workspace = document.querySelector('.workspace');
  workspace?.addEventListener('scroll', syncMobilePaneNav, { passive: true });
  window.addEventListener('resize', syncMobilePaneNav);
  syncMobilePaneNav();
  syncWorkspaceViewButtons();
});

(function _initMobileBanner() {
  const DISMISSED_KEY = 'xdebugx-mobile-notice-dismissed';
  // Only show on actual mobile/tablet: small screen AND touch device.
  // Avoids false positives on touch-enabled laptops or narrow browser windows.
  const isSmallScreen = window.matchMedia('(max-width: 900px)').matches;
  const isTouch = navigator.maxTouchPoints > 1;
  if (!(isSmallScreen && isTouch) || localStorage.getItem(DISMISSED_KEY)) return;

  const banner = document.createElement('div');
  banner.className = 'mobile-banner';
  banner.setAttribute('role', 'note');
  banner.setAttribute('aria-label', 'Desktop browser recommended');
  const msg = document.createElement('span');
  msg.textContent = 'Desktop recommended: You can view and make quick edits on mobile, but for reliable XSLT/XPath debugging, use a laptop or desktop browser.';
  const btn = document.createElement('button');
  btn.textContent = 'Continue on mobile';
  btn.addEventListener('click', () => {
    banner.remove();
    localStorage.setItem(DISMISSED_KEY, '1');
  });
  banner.appendChild(msg);
  banner.appendChild(btn);
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('visible'));
}());
