// ════════════════════════════════════════════════════════════════════════════
//  MODE MANAGER - Centralized XSLT/XPath mode handling
// ════════════════════════════════════════════════════════════════════════════

class ModeManager {
  constructor() {
    this.mode = 'XSLT';  // 'XSLT' | 'XPATH'
    this.models = {
      xslt: null,
      xpath: null
    };

    this.columnStates = {
      xslt: { centerCollapsed: false },
      xpath: { centerCollapsed: true }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIMARY API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Switch to a different mode.
   * @param {string} newMode - 'XSLT' or 'XPATH'
   * @returns {boolean} - true if successful, false if invalid
   */
  setMode(newMode) {
    if (!this.isValidMode(newMode)) {
      console.error(`Invalid mode: ${newMode}. Must be 'XSLT' or 'XPATH'`);
      return false;
    }

    if (this.mode === newMode) return true;

    const previousMode = this.mode;
    try {
      this.cleanup();
      this.saveColumnState();
      this.mode = newMode;
      this.setup();
      this.updateUI();
      this.layout();
      this.trackModeChange(previousMode, newMode);
      scheduleSave();
      return true;
    } catch (error) {
      console.error('❌ Error switching mode:', error);
      this.mode = previousMode;
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUERY METHODS
  // ─────────────────────────────────────────────────────────────────────────

  isMode(mode) {
    return this.mode === mode;
  }

  get isXslt() {
    return this.mode === 'XSLT';
  }

  get isXpath() {
    return this.mode === 'XPATH';
  }

  get currentModel() {
    return this.models[this.mode.toLowerCase()];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  isValidMode(mode) {
    return ['XSLT', 'XPATH'].includes(mode);
  }

  cleanup() {
    if (this.isXpath) {
      if (typeof clearXPathHighlights === 'function') {
        clearXPathHighlights();
      }
      if (typeof clearXPathResults === 'function') {
        clearXPathResults();
      }
    }
  }

  setup() {
    if (eds.xml && this.models.xslt && this.models.xpath) {
      const targetModel = this.isXpath
        ? this.models.xpath
        : this.models.xslt;

      // Arm the synthetic-change guard BEFORE setModel — Monaco fires
      // onDidChangeModelContent synchronously, and the listener in editor.js
      // consumes this flag. Without it every mode switch fires a spurious
      // scheduleSave + marker clear + xpath-highlight clear + 800ms re-validate.
      if (eds.xml.getModel() !== targetModel) {
        _suppressNextXmlChange = true;
        eds.xml.setModel(targetModel);
        eds.xml.layout();
      }
    }

    this.restoreColumnState();

    if (this.isXpath) {
      const xpathInput = document.getElementById('xpathInput');
      if (xpathInput && typeof _savedSession !== 'undefined' && _savedSession?.xpathExpr) {
        if (typeof _syncXPathInput === 'function') {
          _syncXPathInput(_savedSession.xpathExpr);
        } else {
          xpathInput.value = _savedSession.xpathExpr;
        }
      }
    }
  }

  saveColumnState() {
    const colCenter = document.getElementById('colCenter');
    if (colCenter) {
      this.columnStates[this.mode.toLowerCase()].centerCollapsed =
        colCenter.classList.contains('collapsed');
    }
  }

  restoreColumnState() {
    const colCenter = document.getElementById('colCenter');
    if (!colCenter) return;

    const state = this.columnStates[this.mode.toLowerCase()];
    if (state.centerCollapsed) colCenter.classList.add('collapsed');
    else colCenter.classList.remove('collapsed');

    const colRight = document.getElementById('colRight');
    if (colRight && this.isXpath && colRight.classList.contains('collapsed')) {
      colRight.classList.remove('collapsed');
    }
  }

  updateUI() {
    this.updateButtonStates();
    this.updatePanelVisibility();
    this.updateLabels();
    this.updateRunButton();
    this.updateStatusBar();
    this.updateConsolePosition();
  }

  updateButtonStates() {
    const btnXslt = document.getElementById('modeBtnXslt');
    const btnXpath = document.getElementById('modeBtnXpath');
    const switcher = document.getElementById('modeSwitcher');

    if (btnXslt) btnXslt.classList.toggle('active', this.isXslt);
    if (btnXpath) btnXpath.classList.toggle('active', this.isXpath);
    if (switcher) switcher.classList.toggle('xpath-mode', this.isXpath);
  }

  updatePanelVisibility() {
    const visibility = this.isXslt ? '' : 'none';

    const hdrPanel = document.getElementById('hdrPanel');
    const propPanel = document.getElementById('propPanel');
    const outSection = document.getElementById('outputSection');
    const shareBtn = document.getElementById('shareBtn');

    if (hdrPanel) hdrPanel.style.display = visibility;
    if (propPanel) propPanel.style.display = visibility;
    if (outSection) outSection.style.display = visibility;
    if (shareBtn) {
      shareBtn.disabled = this.isXpath;
      shareBtn.title = this.isXpath ? 'Sharing is only available in XSLT mode' : '';
    }

    const bar = document.getElementById('xpathBar');
    if (bar) bar.style.display = this.isXpath ? '' : 'none';
  }

  updateLabels() {
    const xmlPaneTitle = document.getElementById('xmlPaneTitle');
    const xmlColTabLabel = document.getElementById('xmlColTabLabel');
    const newTitle = this.isXpath ? 'XML Source' : 'Input';

    if (xmlPaneTitle) xmlPaneTitle.textContent = newTitle;
    if (xmlColTabLabel) xmlColTabLabel.textContent = newTitle;

    const consoleTitle = document.querySelector('.console-title');
    if (consoleTitle) {
      consoleTitle.textContent = this.isXpath
        ? 'Console · XPath'
        : 'Console · XSLT';
    }
  }

  updateRunButton() {
    const runBtn = document.getElementById('runBtn');
    if (!runBtn) return;

    if (this.isXpath) {
      runBtn.onclick = () => {
        if (typeof runXPath === 'function') runXPath();
      };
      runBtn.innerHTML = _runBtnHtml('XPATH');
    } else {
      runBtn.onclick = () => {
        if (typeof runTransform === 'function') runTransform();
      };
      runBtn.innerHTML = _runBtnHtml('XSLT');
    }
    reinitIcons(runBtn);
  }

  updateStatusBar() {
    const modePill = document.getElementById('modePill');
    if (modePill) {
      modePill.textContent = this.isXpath ? 'XPath' : 'XSLT';
      modePill.className = this.isXpath
        ? 'mode-pill mode-xpath'
        : 'mode-pill mode-xslt';
    }
  }

  // XPATH: console below workspace; XSLT: console inside colCenter
  updateConsolePosition() {
    const console_ = document.getElementById('consolePanel');
    const colCenter = document.getElementById('colCenter');
    const workspace = document.querySelector('.workspace');

    if (!console_ || !colCenter || !workspace) return;

    if (this.isXpath) {
      workspace.insertAdjacentElement('afterend', console_);
    } else {
      colCenter.appendChild(console_);
    }
  }

  layout() {
    requestAnimationFrame(() => {
      [eds.xml, eds.xslt, eds.out].forEach(ed => {
        if (ed && typeof ed.layout === 'function') {
          ed.layout();
        }
      });
    });
  }

  trackModeChange(fromMode, toMode) {
    if (typeof window.goatcounter !== 'undefined') {
      window.goatcounter.count({
        path: `mode-${toMode.toLowerCase()}`,
        title: `Switch to ${toMode} mode`
      });
    }
  }

  initializeModels(xsltModel, xpathModel) {
    this.models.xslt = xsltModel;
    this.models.xpath = xpathModel;
  }

  restoreFromSession(savedSession) {
    if (savedSession && savedSession.xpathEnabled === true) {
      this.setMode('XPATH');
    } else {
      this.setMode('XSLT');
    }
    // setMode is a no-op if already in the target mode, but panel visibility
    // must still be applied on initial load.
    this.updatePanelVisibility();
  }

  toJSON() {
    return {
      mode: this.mode,
      columnStates: this.columnStates
    };
  }
}

const modeManager = new ModeManager();
window.modeManager = modeManager;

