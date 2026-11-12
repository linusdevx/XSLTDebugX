// Runtime behavior is independent from the XSLT/XPath language mode.
let runtimeProfile = 'cpi';

function isCpiRuntimeProfile() {
  return runtimeProfile === 'cpi';
}

function setRuntimeProfile(profile, options = {}) {
  const next = profile === 'standard' ? 'standard' : 'cpi';
  runtimeProfile = next;
  document.body.dataset.runtimeProfile = next;
  const settingsSelect = document.getElementById('settingsRuntimeProfile');
  if (settingsSelect && settingsSelect.value !== next) settingsSelect.value = next;
  const status = document.getElementById('runtimeProfileStatus');
  if (status) status.textContent = next === 'cpi' ? 'Cloud Integration' : 'Standard';
  modeManager?.updatePanelVisibility();
  if (typeof renderExSidebar === 'function' && document.getElementById('exModalBackdrop')?.classList.contains('open')) {
    _exRendered = false;
    renderExSidebar();
    renderExGrid();
  }
  if (options.save !== false && window.sessionController) {
    if (modeManager?.isXpath) {
      void sessionController.saveQuickDrafts({ types: ['xslt'] }).catch(() => {});
    } else {
      scheduleSave();
    }
  }
  if (options.log !== false) clog(`${next === 'cpi' ? 'Cloud Integration' : 'Standard XSLT'} runtime profile active`, 'info');
}
