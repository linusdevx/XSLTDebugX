// Constrained pane resizing. Pane order remains Input → Transform → Output.

let paneResizeState = null;

function paneLayoutModeKey() {
  return modeManager.isXpath ? 'xpath' : 'xslt';
}

function panePairFor(splitter) {
  if (splitter.id === 'paneSplitterPrimary') {
    return modeManager.isXpath
      ? [document.getElementById('colLeft'), document.getElementById('colRight')]
      : [document.getElementById('colLeft'), document.getElementById('colCenter')];
  }
  return [document.getElementById('colCenter'), document.getElementById('colRight')];
}

function updatePaneSplitters() {
  const primary = document.getElementById('paneSplitterPrimary');
  const secondary = document.getElementById('paneSplitterSecondary');
  if (!primary || !secondary) return;
  primary.hidden = window.innerWidth < 900;
  secondary.hidden = window.innerWidth < 900 || modeManager.isXpath || document.getElementById('colRight')?.classList.contains('collapsed');
  primary.setAttribute('aria-label', modeManager.isXpath ? 'Resize XPath input and results panes' : 'Resize input and XSLT panes');
}

function applyPaneLayout(layout) {
  const workspace = document.querySelector('.workspace');
  if (!workspace || !layout || window.innerWidth < 900) return;
  const mode = paneLayoutModeKey();
  const visibleIds = mode === 'xpath'
    ? ['colLeft', 'colRight']
    : document.getElementById('colRight')?.classList.contains('collapsed')
      ? ['colLeft', 'colCenter']
      : ['colLeft', 'colCenter', 'colRight'];
  const ratios = visibleIds.map(id => Number(layout[id]) || 0);
  const total = ratios.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return;
  resetPaneLayoutStyles();
  const available = visibleIds.reduce((sum, id) => sum + document.getElementById(id).getBoundingClientRect().width, 0);
  workspace.classList.add('custom-pane-layout');
  visibleIds.forEach((id, index) => workspace.style.setProperty(`--${id}-basis`, `${(ratios[index] / total) * available}px`));
}

async function restorePaneLayout() {
  updatePaneSplitters();
  const layout = await workspaceStore.getSetting(`paneLayout:${paneLayoutModeKey()}`, null).catch(() => null);
  if (layout) applyPaneLayout(layout);
  else resetPaneLayoutStyles();
  setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 50);
}

function resetPaneLayoutStyles() {
  const workspace = document.querySelector('.workspace');
  if (!workspace) return;
  workspace.classList.remove('custom-pane-layout');
  for (const id of ['colLeft', 'colCenter', 'colRight']) workspace.style.removeProperty(`--${id}-basis`);
}

async function resetPaneLayout() {
  resetPaneLayoutStyles();
  await workspaceStore.setSetting(`paneLayout:${paneLayoutModeKey()}`, null).catch(() => {});
  setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 50);
}

async function resetAllPaneLayouts() {
  resetPaneLayoutStyles();
  try {
    await Promise.all([
      workspaceStore.setSetting('paneLayout:xslt', null),
      workspaceStore.setSetting('paneLayout:xpath', null),
    ]);
    setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 50);
    clog('Pane layout reset to defaults ✓', 'success');
  } catch (error) {
    clog(`Could not reset pane layout: ${error.message}`, 'error');
  }
}

function startPaneResize(event) {
  if (window.innerWidth < 900 || event.button !== 0) return;
  const splitter = event.currentTarget;
  const [before, after] = panePairFor(splitter);
  if (!before || !after || before.classList.contains('collapsed') || after.classList.contains('collapsed')) return;
  event.preventDefault();
  paneResizeState = {
    splitter, before, after,
    startX: event.clientX,
    beforeWidth: before.getBoundingClientRect().width,
    afterWidth: after.getBoundingClientRect().width,
  };
  splitter.setPointerCapture?.(event.pointerId);
  document.body.classList.add('resizing-panes');
}

function movePaneResize(event) {
  if (!paneResizeState) return;
  const minimum = 220;
  const total = paneResizeState.beforeWidth + paneResizeState.afterWidth;
  const delta = event.clientX - paneResizeState.startX;
  const beforeWidth = Math.max(minimum, Math.min(total - minimum, paneResizeState.beforeWidth + delta));
  const afterWidth = total - beforeWidth;
  const workspace = document.querySelector('.workspace');
  workspace.classList.add('custom-pane-layout');
  workspace.style.setProperty(`--${paneResizeState.before.id}-basis`, `${beforeWidth}px`);
  workspace.style.setProperty(`--${paneResizeState.after.id}-basis`, `${afterWidth}px`);
  eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout();
}

async function endPaneResize() {
  if (!paneResizeState) return;
  const workspace = document.querySelector('.workspace');
  const visible = paneLayoutModeKey() === 'xpath'
    ? ['colLeft', 'colRight']
    : ['colLeft', 'colCenter', 'colRight'].filter(id => !document.getElementById(id).classList.contains('collapsed'));
  const widths = Object.fromEntries(visible.map(id => [id, document.getElementById(id).getBoundingClientRect().width]));
  const total = Object.values(widths).reduce((sum, value) => sum + value, 0);
  const ratios = Object.fromEntries(Object.entries(widths).map(([id, width]) => [id, width / total]));
  paneResizeState = null;
  document.body.classList.remove('resizing-panes');
  await workspaceStore.setSetting(`paneLayout:${paneLayoutModeKey()}`, ratios).catch(() => {});
  applyPaneLayout(ratios);
}

function keyboardPaneResize(event) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const [before, after] = panePairFor(event.currentTarget);
  if (!before || !after || before.classList.contains('collapsed') || after.classList.contains('collapsed')) return;
  event.preventDefault();
  const step = event.shiftKey ? 40 : 16;
  paneResizeState = {
    splitter: event.currentTarget, before, after, startX: 0,
    beforeWidth: before.getBoundingClientRect().width,
    afterWidth: after.getBoundingClientRect().width,
  };
  movePaneResize({ clientX: event.key === 'ArrowLeft' ? -step : step });
  void endPaneResize();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.pane-splitter').forEach(splitter => {
    splitter.addEventListener('pointerdown', startPaneResize);
    splitter.addEventListener('pointermove', movePaneResize);
    splitter.addEventListener('pointerup', () => void endPaneResize());
    splitter.addEventListener('pointercancel', () => void endPaneResize());
    splitter.addEventListener('dblclick', () => void resetPaneLayout());
    splitter.addEventListener('keydown', keyboardPaneResize);
  });
  void restorePaneLayout();
  window.addEventListener('resize', updatePaneSplitters);
});
