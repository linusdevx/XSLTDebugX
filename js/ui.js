// ════════════════════════════════════════════
//  ICONS (Lucide)
// ════════════════════════════════════════════
function reinitIcons(container) {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons(container ? { root: container } : undefined);
  }
}

// ════════════════════════════════════════════
//  RIPPLE EFFECT
// ════════════════════════════════════════════
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

// ════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ════════════════════════════════════════════
function showCopyToast(message, duration = 1500) {
  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('visible'), 10);

  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);  // Wait for fade-out
  }, duration);
}

// ════════════════════════════════════════════
//  SIDE COLUMN COLLAPSE
// ════════════════════════════════════════════
function toggleSideCol(side) {
  const col = document.getElementById(side === 'left' ? 'colLeft' : 'colRight');
  col.classList.toggle('collapsed');
  scheduleSave();

  // Relayout all Monaco editors after spring transition (0.35s)
  setTimeout(() => {
    eds.xml?.layout();
    eds.xslt?.layout();
    eds.out?.layout();
  }, 400);
}

// ════════════════════════════════════════════
//  CONSOLE STATE (minimize / maximize)
// ════════════════════════════════════════════
let consoleState = 'normal';  // 'normal' | 'minimized'
let consoleErrCount = 0;

function setConsoleState(state) {
  const panel = document.getElementById('consolePanel');
  panel.classList.toggle('minimized', state === 'minimized');
  consoleState = state;

  // Relay Monaco continuously during the CSS transition (350ms spring) to prevent blank editor
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

// Clicking the bar toggles minimize
function handleConsoleBarClick(e) {
  setConsoleState(consoleState === 'minimized' ? 'normal' : 'minimized');
}

function updateConsoleErrBadge() {
  const badge = document.getElementById('consoleErrBadge');
  if (!badge) return;
  if (consoleErrCount > 0 && consoleState === 'minimized') {
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

  // Update active button state
  document.querySelectorAll('.console-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  // Delegate all filtering (type + text) to applyConsoleSearch
  const searchVal = document.getElementById('consoleSearch')?.value ?? '';
  applyConsoleSearch(searchVal);
}

function applyConsoleSearch(query) {
  const term = query.trim().toLowerCase();
  const typeFilter = consoleFilter || 'all';
  document.querySelectorAll('#consoleBody .log-line').forEach(line => {
    const t = line.dataset.type;
    // INFO filter shows both info and success (success is a positive outcome, not a separate category)
    const matchesType = typeFilter === 'all'
      || t === typeFilter
      || (typeFilter === 'info' && t === 'success');
    const matchesText = !term || line.textContent.toLowerCase().includes(term);
    line.style.display = matchesType && matchesText ? '' : 'none';
  });
}

// ════════════════════════════════════════════
//  THEME TOGGLE
// ════════════════════════════════════════════
function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('xdebugx-theme', isLight ? 'light' : 'dark');
  clog(`Theme: ${isLight ? 'light' : 'dark'} mode`, 'info');

  const monacoTheme = isLight ? 'xdebugx-light' : 'xdebugx';
  if (typeof monaco !== 'undefined') {
    monaco.editor.setTheme(monacoTheme);
    setTimeout(() => { if (typeof refreshXPathColors === 'function') refreshXPathColors(); }, 50);
  }
}

// M-7: symmetric theme restore — handle both 'light' and 'dark'. Surviving a
// future flip of the default theme in index.html requires touching the class
// in both directions, not just removing 'light' on saved=='dark'.
(function() {
  const saved = localStorage.getItem('xdebugx-theme');
  if (saved === 'light')      document.body.classList.add('light');
  else if (saved === 'dark')  document.body.classList.remove('light');
  // saved === null (first visit) → leave whatever index.html shipped
})();
// ════════════════════════════════════════════
//  HELP MODAL
// ════════════════════════════════════════════
function openHelpModal() {
  document.getElementById('helpModalBackdrop').classList.add('open');
}

function closeHelpModal() {
  document.getElementById('helpModalBackdrop').classList.remove('open');
}

// M-6: factory in state.js. `var` keeps it on window for inline onclick=.
var handleHelpBackdropClick = _makeBackdropClose('helpModalBackdrop', closeHelpModal);

function switchHelpTab(tab) {
  document.querySelectorAll('.help-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('helpTabFeatures').classList.toggle('active', tab === 'features');
  document.getElementById('helpTabShortcuts').classList.toggle('active', tab === 'shortcuts');
}