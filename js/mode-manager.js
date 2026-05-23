// ════════════════════════════════════════════════════════════════════════════
//  MODE MANAGER - Centralized XSLT/XPath mode handling
// ════════════════════════════════════════════════════════════════════════════

class ModeManager {
  constructor() {
    this.mode = 'XSLT';  // 'XSLT' | 'XPATH'
    this.models = {
      xslt: null,  // Will be set via initializeModels()
      xpath: null
    };

    // Store column collapse state per mode
    this.columnStates = {
      xslt: { centerCollapsed: false },
      xpath: { centerCollapsed: true }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIMARY API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Switch to a different mode
   * @param {string} newMode - 'XSLT' or 'XPATH'
   * @returns {boolean} - true if successful, false if invalid
   */
  setMode(newMode) {
    // Validate input
    if (!this.isValidMode(newMode)) {
      console.error(`Invalid mode: ${newMode}. Must be 'XSLT' or 'XPATH'`);
      return false;
    }

    // No-op if already in this mode
    if (this.mode === newMode) {
      console.info(`Already in ${newMode} mode, skipping switch`);
      return true;
    }

    console.log(`🔄 Switching from ${this.mode} to ${newMode}...`);

    const previousMode = this.mode;
    try {
      // Step 1: Cleanup current mode
      this.cleanup();

      // Step 2: Save column state before leaving mode
      this.saveColumnState();

      // Step 3: Update internal state
      this.mode = newMode;
      console.log(`✓ Mode state updated: ${newMode}`);

      // Step 4: Setup new mode
      this.setup();
      console.log(`✓ Setup complete`);

      // Step 5: Update all UI elements
      this.updateUI();
      console.log(`✓ UI updated`);

      // Step 6: Update editor layouts (batched)
      this.layout();
      console.log(`✓ Layout updated`);

      // Step 7: Track the mode change
      this.trackModeChange(previousMode, newMode);

      // Step 8: Save to localStorage
      scheduleSave();

      console.log(`✅ Mode switch complete: ${previousMode} → ${newMode}`);
      return true;
    } catch (error) {
      console.error('❌ Error switching mode:', error);
      // Revert on error
      this.mode = previousMode;
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUERY METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if currently in a specific mode
   */
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

  /**
   * Cleanup when leaving a mode
   */
  cleanup() {
    if (this.isXpath) {
      // Cleanup XPath mode
      if (typeof clearXPathHighlights === 'function') {
        clearXPathHighlights();
      }
      if (typeof clearXPathResults === 'function') {
        clearXPathResults();
      }
    }

    // Clear any editor decorations
    if (typeof xmlDecorations !== 'undefined' && xmlDecorations) {
      try {
        xmlDecorations.clear();
        xmlDecorations = null;
      } catch (e) {
        console.warn('[modeManager] cleanup:', e);
      }
    }
  }

  /**
   * Setup when entering a mode
   */
  setup() {
    // 1. Swap the XML editor model
    if (eds.xml && this.models.xslt && this.models.xpath) {
      const targetModel = this.isXpath
        ? this.models.xpath
        : this.models.xslt;

      eds.xml.setModel(targetModel);
      eds.xml.layout();
    }

    // 2. Restore column collapse state for this mode
    this.restoreColumnState();

    // 3. Restore text field values if needed
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

  /**
   * Save column collapse state before leaving mode
   */
  saveColumnState() {
    const colCenter = document.getElementById('colCenter');
    if (colCenter) {
      this.columnStates[this.mode.toLowerCase()].centerCollapsed =
        colCenter.classList.contains('collapsed');
    }
  }

  /**
   * Restore column collapse state when entering mode
   */
  restoreColumnState() {
    const colCenter = document.getElementById('colCenter');
    if (!colCenter) return;

    const state = this.columnStates[this.mode.toLowerCase()];
    const shouldBeCollapsed = state.centerCollapsed;

    if (shouldBeCollapsed) {
      colCenter.classList.add('collapsed');
    } else {
      colCenter.classList.remove('collapsed');
    }

    // Ensure right column behavior
    const colRight = document.getElementById('colRight');
    if (colRight) {
      if (this.isXpath && colRight.classList.contains('collapsed')) {
        colRight.classList.remove('collapsed');
      }
    }
  }

  /**
   * Update ALL UI elements for this mode
   */
  updateUI() {
    this.updateButtonStates();
    this.updatePanelVisibility();
    this.updateLabels();
    this.updateRunButton();
    this.updateStatusBar();
    this.updateConsolePosition();
  }

  /**
   * Update XSLT/XPath button active states
   */
  updateButtonStates() {
    const btnXslt = document.getElementById('modeBtnXslt');
    const btnXpath = document.getElementById('modeBtnXpath');
    const switcher = document.getElementById('modeSwitcher');

    if (btnXslt) {
      btnXslt.classList.toggle('active', this.isXslt);
    }
    if (btnXpath) {
      btnXpath.classList.toggle('active', this.isXpath);
    }
    if (switcher) {
      switcher.classList.toggle('xpath-mode', this.isXpath);
    }
  }

  /**
   * Show/hide panels based on mode
   */
  updatePanelVisibility() {
    const visibility = this.isXslt ? '' : 'none';

    const hdrPanel = document.getElementById('hdrPanel');
    const propPanel = document.getElementById('propPanel');
    const outSection = document.getElementById('outputSection');
    const shareBtn = document.getElementById('shareBtn');

    if (hdrPanel) hdrPanel.style.display = visibility;
    if (propPanel) propPanel.style.display = visibility;
    if (outSection) outSection.style.display = visibility;
    if (shareBtn) shareBtn.classList.toggle('hidden', this.isXpath);

    // Show XPath bar only in XPath mode
    const bar = document.getElementById('xpathBar');
    if (bar) {
      bar.style.display = this.isXpath ? '' : 'none';
    }
  }

  /**
   * Update pane titles and labels
   */
  updateLabels() {
    const xmlPaneTitle = document.getElementById('xmlPaneTitle');
    const xmlColTabLabel = document.getElementById('xmlColTabLabel');
    const newTitle = this.isXpath ? 'XML Source' : 'Input';

    if (xmlPaneTitle) xmlPaneTitle.textContent = newTitle;
    if (xmlColTabLabel) xmlColTabLabel.textContent = newTitle;

    // Update console label
    const consoleTitle = document.querySelector('.console-title');
    if (consoleTitle) {
      consoleTitle.textContent = this.isXpath
        ? 'Console · XPath'
        : 'Console · XSLT';
    }
  }

  /**
   * Change Run button: label, onclick, icon
   */
  updateRunButton() {
    const runBtn = document.getElementById('runBtn');
    if (!runBtn) return;

    if (this.isXpath) {
      runBtn.onclick = () => {
        if (typeof runXPath === 'function') runXPath();
      };
      runBtn.innerHTML = `<i data-lucide="play" width="14" height="14"></i> Run XPath <span class="kbd">⌘↵</span>`;
    } else {
      runBtn.onclick = () => {
        if (typeof runTransform === 'function') runTransform();
      };
      runBtn.innerHTML = `<i data-lucide="play" width="14" height="14"></i> Run XSLT <span class="kbd">⌘↵</span>`;
    }
    reinitIcons(runBtn);
  }

  /**
   * Update mode indicator pill in status bar
   */
  updateStatusBar() {
    const modePill = document.getElementById('modePill');
    if (modePill) {
      modePill.textContent = this.isXpath ? 'XPath' : 'XSLT';
      modePill.className = this.isXpath
        ? 'mode-pill mode-xpath'
        : 'mode-pill mode-xslt';
    }
  }

  /**
   * Move console: XPATH below workspace, XSLT inside colCenter
   */
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

  /**
   * Batch layout updates
   */
  layout() {
    requestAnimationFrame(() => {
      [eds.xml, eds.xslt, eds.out].forEach(ed => {
        if (ed && typeof ed.layout === 'function') {
          ed.layout();
        }
      });
    });
  }

  /**
   * Track mode change for analytics
   */
  trackModeChange(fromMode, toMode) {
    if (typeof window.goatcounter !== 'undefined') {
      window.goatcounter.count({
        path: `mode-${toMode.toLowerCase()}`,
        title: `Switch to ${toMode} mode`
      });
    }
  }

  /**
   * Initialize the manager with model references
   */
  initializeModels(xsltModel, xpathModel) {
    this.models.xslt = xsltModel;
    this.models.xpath = xpathModel;
  }

  /**
   * Restore mode from saved session
   */
  restoreFromSession(savedSession) {
    if (savedSession && savedSession.xpathEnabled === true) {
      this.setMode('XPATH');
    } else {
      this.setMode('XSLT');
    }
    // Always sync UI — setMode is a no-op if already in the target mode,
    // but panel visibility must still be applied on initial load
    this.updatePanelVisibility();
  }

  /**
   * Get current state for persistence
   */
  toJSON() {
    return {
      mode: this.mode,
      columnStates: this.columnStates
    };
  }
}

// Create global instance
const modeManager = new ModeManager();
window.modeManager = modeManager;  // Expose to window for testing and external access

