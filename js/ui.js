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
  _layoutAfterTransition(col, 400);
}

// ════════════════════════════════════════════
//  CONSOLE STATE (minimize / maximize / resize)
// ════════════════════════════════════════════
let consoleState = 'normal';  // 'normal' | 'minimized'
let consoleErrCount = 0;
let consoleHeight = 160;       // current height in px (matches CSS default)
const CONSOLE_MIN_H = 80;
const CONSOLE_MAX_VH = 0.7;    // 70% of viewport height

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
      // Capture the bottom line and whether the user was at the document bottom
      // BEFORE layout shrinks the editor.
      const ranges = ed.getVisibleRanges?.();
      let oldBottomLine = null;
      let wasAtDocBottom = false;
      if (ranges && ranges.length) {
        oldBottomLine = ranges[ranges.length - 1].endLineNumber;
        const lineCount = ed.getModel?.()?.getLineCount?.() ?? 0;
        wasAtDocBottom = oldBottomLine >= lineCount - 1;  // within 1 line of the end
      }
      ed.layout();
      // Pin the previously-bottom line to the new bottom so shrinking the editor
      // doesn't push the user's last-visible line out of view.
      if (oldBottomLine != null && typeof monaco !== 'undefined') {
        const targetLine = wasAtDocBottom ? ed.getModel().getLineCount() : oldBottomLine;
        const range = new monaco.Range(targetLine, 1, targetLine, 1);
        ed.revealRange(range, 1 /* Immediate */, 4 /* BottomOfScrollableViewport */);
      }
    });
  }

  function onMove(ev) {
    // Drag UP grows the console — invert the delta
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

// Clicking the bar toggles minimize
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

// ════════════════════════════════════════════
//  HELP MODAL
// ════════════════════════════════════════════
function openHelpModal() {
  document.getElementById('helpModalBackdrop').classList.add('open');
}

function closeHelpModal() {
  document.getElementById('helpModalBackdrop').classList.remove('open');
}

// Factory in state.js. `var` keeps it on window for inline onclick=.
var handleHelpBackdropClick = _makeBackdropClose('helpModalBackdrop', closeHelpModal);

function switchHelpTab(tab) {
  document.querySelectorAll('.help-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('helpTabFeatures').classList.toggle('active', tab === 'features');
  document.getElementById('helpTabShortcuts').classList.toggle('active', tab === 'shortcuts');
}