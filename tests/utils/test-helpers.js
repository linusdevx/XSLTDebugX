import { expect } from '@playwright/test';

/**
 * Page Object Model for XSLTDebugX
 * Provides high-level methods for interacting with the application
 */
export class EditorPage {
  constructor(page) {
    this.page = page;
    // Selectors (from actual index.html)
    this.runButton = 'button#runBtn';
    this.xpathToggle = 'button#modeBtnXpath';
    this.xsltToggle = 'button#modeBtnXslt';
    this.shareButton = 'button#shareBtn';
    this.examplesButton = 'button#exBtn';
    this.clearSessionButton = 'button#clearSessionBtn';
    this.themeToggle = 'button#themeToggle';
  }

  /**
   * Navigate to the application
   * Uses 'domcontentloaded' instead of 'networkidle' for faster startup
   */
  async navigate() {
    await this.page.goto('http://localhost:8000', { waitUntil: 'domcontentloaded', timeout: 45000 });
    // Wait for Monaco Editor to initialize
    await this.page.waitForSelector('.monaco-editor', { timeout: 20000 });
    // Extra wait for JS initialization
    await this.page.waitForTimeout(2000);
  }

  /**
   * Wait for debounced state persistence to complete (800ms + 200ms buffer)
   */
  async waitForDebounce() {
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get XML editor content
   */
  async getXmlContent() {
    return await this.page.evaluate(() => {
      const editors = window.monaco?.editor?.getEditors?.() || [];
      return editors[0]?.getValue?.() || '';
    });
  }

  /**
   * Fill XML content via Monaco API
   */
  async fillXml(content) {
    await this.page.evaluate((xml) => {
      const editors = window.monaco?.editor?.getEditors?.() || [];
      if (editors[0]) {
        editors[0].setValue(xml);
      }
    }, content);
    await this.page.waitForTimeout(300);
  }

  /**
   * Get XSLT editor content
   */
  async getXsltContent() {
    return await this.page.evaluate(() => {
      const editors = window.monaco?.editor?.getEditors?.() || [];
      return editors[1]?.getValue?.() || '';
    });
  }

  /**
   * Fill XSLT content via Monaco API
   */
  async fillXslt(content) {
    await this.page.evaluate((xslt) => {
      const editors = window.monaco?.editor?.getEditors?.() || [];
      if (editors[1]) {
        editors[1].setValue(xslt);
      }
    }, content);
    await this.page.waitForTimeout(300);
  }

  /**
   * Get output editor content
   */
  async getOutput() {
    return await this.page.evaluate(() => {
      const editors = window.monaco?.editor?.getEditors?.() || [];
      return editors[2]?.getValue?.() || '';
    });
  }

  /**
   * Click the Run button
   */
  async clickRun() {
    await this.page.click(this.runButton);
    await this.page.waitForTimeout(2000);
  }

  /**
   * Get current mode (XSLT or XPATH)
   */
  async getMode() {
    return await this.page.evaluate(() => {
      // isXpath is a GETTER property, not a method
      const isXpath = window.modeManager?.isXpath;
      return isXpath ? 'XPATH' : 'XSLT';
    });
  }

  /**
   * Switch to XSLT mode
   */
  async switchToXslt() {
    const mode = await this.getMode();
    if (mode === 'XSLT') return;
    await this.page.click(this.xsltToggle);
    // Wait for mode change animation and DOM updates
    await this.page.waitForTimeout(1500);
  }

  /**
   * Switch to XPath mode
   */
  async switchToXpath() {
    const mode = await this.getMode();
    if (mode === 'XPATH') return;
    await this.page.click(this.xpathToggle);
    // Wait for mode change animation and DOM updates
    await this.page.waitForTimeout(1500);
  }

  /**
   * Get console messages
   */
  async getConsoleMessages() {
    return await this.page.evaluate(() => {
      if (!window.clog?.getMessages) return [];
      try {
        return window.clog.getMessages?.() || [];
      } catch {
        return [];
      }
    });
  }

  /**
   * Clear console
   */
  async clearConsole() {
    return await this.page.evaluate(() => {
      window.clog?.clear?.();
    });
  }

  /**
   * Get all console errors
   */
  async getConsoleErrors() {
    const messages = await this.getConsoleMessages();
    return messages.filter(m => m.type === 'error' || m.type === 'warn');
  }

  /**
   * Clear session — opens Session menu and clicks "Clear current content"
   */
  async clearSession() {
    await this.page.locator('#sessionMenuTrigger').click();
    await this.page.locator('#sessionMenu [role="menuitem"]', { hasText: 'Clear current content' }).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Open share modal
   */
  async openShareModal() {
    await this.page.click(this.shareButton);
    await this.page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  }

  /**
   * Get the share URL from modal
   */
  async getShareUrl() {
    const urlInput = this.page.locator('input[readonly]');
    return await urlInput.inputValue().catch(() => '');
  }

  /**
   * Toggle theme
   */
  async toggleTheme() {
    await this.page.click(this.themeToggle);
    await this.page.waitForTimeout(500);
  }

  /**
   * Get current theme
   */
  async getTheme() {
    return await this.page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') ||
             document.body.getAttribute('class') || 'light';
    });
  }

  /**
   * Clear browser storage
   */
  async clearStorage() {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Return a legacy-shaped view of the current local-first session state.
   * Older workflow specs use these field names; production persistence is IndexedDB.
   */
  async getStoredSession() {
    return await this.page.evaluate(() => {
      if (window.sessionController?.serializeDrafts) {
        const snapshot = window.sessionController.serializeDrafts();
        return {
          xmlXslt: snapshot.xslt.source.xml,
          xmlXpath: snapshot.xpath.source.xml,
          xslt: snapshot.xslt.source.xslt,
          xpathExpr: snapshot.xpath.source.expression,
          xpathEnabled: snapshot.activeMode === 'XPATH',
          headers: snapshot.xslt.source.headers,
          properties: snapshot.xslt.source.properties,
          runtimeProfile: snapshot.xslt.source.runtimeProfile,
        };
      }
      const legacy = localStorage.getItem('xdebugx-session-v1');
      return legacy ? JSON.parse(legacy) : null;
    });
  }

  /**
   * Check if errors are present
   */
  async hasErrors() {
    const errorBadge = this.page.locator('.status-error');
    return await errorBadge.isVisible().catch(() => false);
  }

  /**
   * Get error count
   */
  async getErrorCount() {
    const badge = this.page.locator('.status-error');
    if (!await badge.isVisible().catch(() => false)) return 0;
    const text = await badge.textContent().catch(() => '0');
    return parseInt(text.replace(/\D/g, '')) || 0;
  }

  /**
   * Get mode indicator
   */
  async getModeIndicator() {
    return await this.page.evaluate(() => {
      // isXpath is a GETTER property, not a method
      const mode = window.modeManager?.isXpath ? 'ƒx' : 'XSLT';
      return mode;
    });
  }

  /**
   * Run XSLT via Ctrl+Enter keyboard shortcut
   */
  async runViaKeyboard() {
    await this.page.locator('.monaco-editor').first().click();
    await this.page.keyboard.press('Control+Enter');
    await this.page.waitForTimeout(2000);
  }

  /**
   * Wait for output to be generated
   */
  async waitForOutput() {
    await this.page.waitForTimeout(2000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CPI SIMULATION: Headers & Properties Panel Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Add a header to the Headers panel
   * @param {string} name - Header name
   * @param {string} value - Header value
   */
  async addHeader(name, value) {
    // Click the + button in Headers panel
    await this.page.click('#hdrPanel button.kv-add-btn');
    await this.page.waitForTimeout(300);

    // Get the newly added row wrapper
    const rows = await this.page.locator('#hdrRows .kv-row-wrapper').count();
    const rowIndex = rows - 1; // Last row is the new one

    // Fill name and value inputs in the row
    const nameInput = this.page.locator('#hdrRows .kv-row-wrapper').nth(rowIndex).locator('input').nth(0);
    const valueInput = this.page.locator('#hdrRows .kv-row-wrapper').nth(rowIndex).locator('input').nth(1);

    await nameInput.fill(name);
    await valueInput.fill(value);
    // Wait for debounced save to complete
    await this.waitForDebounce();
  }

  /**
   * Update an existing header by index
   * @param {number} index - Row index (0-based)
   * @param {string} name - New header name
   * @param {string} value - New header value
   */
  async updateHeader(index, name, value) {
    const nameInput = this.page.locator('#hdrRows .kv-row-wrapper').nth(index).locator('input').nth(0);
    const valueInput = this.page.locator('#hdrRows .kv-row-wrapper').nth(index).locator('input').nth(1);

    await nameInput.clear();
    await nameInput.fill(name);
    await valueInput.clear();
    await valueInput.fill(value);
    // Wait for debounced save to complete
    await this.waitForDebounce();
  }

  /**
   * Delete a header by index
   * @param {number} index - Row index (0-based)
   */
  async deleteHeader(index) {
    const deleteBtn = this.page.locator('#hdrRows .kv-row-wrapper').nth(index).locator('button.kv-del-btn');
    await deleteBtn.click();
    // Wait for debounced save to complete
    await this.waitForDebounce();
  }

  /**
   * Add a property to the Properties panel
   * @param {string} name - Property name
   * @param {string} value - Property value
   */
  async addProperty(name, value) {
    // Click the + button in Properties panel
    await this.page.click('#propPanel button.kv-add-btn');
    await this.page.waitForTimeout(300);

    // Get the newly added row wrapper
    const rows = await this.page.locator('#propRows .kv-row-wrapper').count();
    const rowIndex = rows - 1;

    const nameInput = this.page.locator('#propRows .kv-row-wrapper').nth(rowIndex).locator('input').nth(0);
    const valueInput = this.page.locator('#propRows .kv-row-wrapper').nth(rowIndex).locator('input').nth(1);

    await nameInput.fill(name);
    await valueInput.fill(value);
    // Wait for debounced save to complete
    await this.waitForDebounce();
  }

  /**
   * Update an existing property by index
   * @param {number} index - Row index (0-based)
   * @param {string} name - New property name
   * @param {string} value - New property value
   */
  async updateProperty(index, name, value) {
    const nameInput = this.page.locator('#propRows .kv-row-wrapper').nth(index).locator('input').nth(0);
    const valueInput = this.page.locator('#propRows .kv-row-wrapper').nth(index).locator('input').nth(1);

    await nameInput.clear();
    await nameInput.fill(name);
    await valueInput.clear();
    await valueInput.fill(value);
    // Wait for debounced save to complete
    await this.waitForDebounce();
  }

  /**
   * Delete a property by index
   * @param {number} index - Row index (0-based)
   */
  async deleteProperty(index) {
    const deleteBtn = this.page.locator('#propRows .kv-row-wrapper').nth(index).locator('button.kv-del-btn');
    await deleteBtn.click();
    // Wait for debounced save to complete
    await this.waitForDebounce();
  }

  /**
   * Read output headers from the Output Headers panel
   * @returns {Array<{name: string, value: string}>}
   */
  async readOutputHeaders() {
    return await this.page.evaluate(() => {
      const rows = document.querySelectorAll('#outHdrRows .kv-row');
      return Array.from(rows).map(row => ({
        name: row.children[0]?.textContent?.trim() || '',
        value: row.children[1]?.textContent?.trim() || ''
      }));
    });
  }

  /**
   * Read output properties from the Output Properties panel
   * @returns {Array<{name: string, value: string}>}
   */
  async readOutputProperties() {
    return await this.page.evaluate(() => {
      const rows = document.querySelectorAll('#outPropRows .kv-row');
      return Array.from(rows).map(row => ({
        name: row.children[0]?.textContent?.trim() || '',
        value: row.children[1]?.textContent?.trim() || ''
      }));
    });
  }

  /**
   * Get the current header count badge
   */
  async getHeaderCount() {
    const count = await this.page.locator('#hdrCount').textContent();
    return parseInt(count) || 0;
  }

  /**
   * Get the current property count badge
   */
  async getPropertyCount() {
    const count = await this.page.locator('#propCount').textContent();
    return parseInt(count) || 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXAMPLES LIBRARY: Modal & Load Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Open Examples modal (if not already open)
   */
  async openExamplesModal() {
    await this.page.click(this.examplesButton);
    await this.page.waitForSelector('#exModalBackdrop.open', { timeout: 5000 });
    await this.page.waitForTimeout(500);
  }

  /**
   * Close Examples modal
   */
  async closeExamplesModal() {
    const backdrop = this.page.locator('#exModalBackdrop');
    if (await backdrop.evaluate(el => el.classList.contains('open'))) {
      await backdrop.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Search examples by keyword
   * @param {string} query - Search query text
   */
  async searchExamples(query) {
    const searchInput = this.page.locator('#exModalSearch');
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(query);
      await this.page.waitForTimeout(800); // Debounce time for filter
    }
  }

  /**
   * Load an example by key
   * @param {string} exampleKey - Example key from EXAMPLES object
   */
  async loadExample(exampleKey) {
    // Call the loadExample function directly via page.evaluate
    await this.page.evaluate((key) => {
      if (typeof window.loadExample === 'function') {
        window.loadExample(key);
      }
    }, exampleKey);
    // Wait for modal to close and content to load
    await this.page.waitForTimeout(1500);
  }

  /**
   * Set auto-run checkbox for examples
   * @param {boolean} enabled - Whether to enable auto-run
   */
  async setAutoRunExamples(enabled) {
    const checkbox = this.page.locator('#exAutoRunCheckbox');
    const isChecked = await checkbox.isChecked().catch(() => false);

    if (isChecked !== enabled) {
      await checkbox.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Get the currently filtered example count
   */
  async getExampleCount() {
    const text = await this.page.locator('#exModalCount').textContent().catch(() => '0');
    return parseInt(text.replace(/\D/g, '')) || 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHARE URL: Generation & Loading Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a share URL from current editor state
   * @returns {string} The generated share URL
   */
  async generateShareUrl() {
    // Ensure modal is closed first
    await this.closeShareModal();
    await this.page.waitForTimeout(300);

    // Open share modal
    await this.page.click(this.shareButton);
    await this.page.waitForSelector('#shareModalBackdrop.open', { timeout: 5000 });
    await this.page.waitForTimeout(500);

    // Get URL from input field
    const urlInput = this.page.locator('#shareUrlInput');
    const url = await urlInput.inputValue();

    return url;
  }

  /**
   * Check if share URL generation shows a length warning
   * @returns {boolean} True if warning is visible
   */
  async hasShareUrlWarning() {
    // Close and reopen to generate fresh (warnings appear on generation)
    await this.page.waitForTimeout(200);
    const warning = this.page.locator('.share-modal .share-warning, .share-modal-body > .warning');
    return await warning.isVisible().catch(() => false);
  }

  /**
   * Get the generated share URL length
   * @returns {number} URL string length
   */
  async getShareUrlLength() {
    const url = await this.generateShareUrl();
    return url?.length || 0;
  }

  /**
   * Close share modal
   */
  async closeShareModal() {
    const backdrop = this.page.locator('#shareModalBackdrop');
    try {
      const isOpen = await backdrop.evaluate(el => el.classList.contains('open')).catch(() => false);
      if (isOpen) {
        // Use Escape key to close modal (more reliable than clicking backdrop)
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(600);
      }
    } catch (err) {
      // Ignore errors during close attempt
    }
  }

  /**
   * Load application state from a share URL (navigate to it)
   * @param {string} shareUrl - Full share URL with hash
   */
  async loadFromShareUrl(shareUrl) {
    await this.page.goto(shareUrl);
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for Monaco Editor to initialize
    await this.page.waitForSelector('.monaco-editor', { timeout: 15000 });
    const incoming = this.page.locator('#incomingShareBackdrop.open');
    const invalid = this.page.locator('#invalidShareBackdrop.open');
    const outcome = await Promise.race([
      incoming.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'incoming'),
      invalid.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'invalid'),
    ]).catch(() => null);
    if (outcome === 'incoming') {
      await this.page.getByRole('button', { name: 'Open temporarily' }).click();
      await incoming.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }

  /**
   * Check if pending share data is in the app state
   * @returns {boolean} True if share data was detected
   */
  async hasPendingShareData() {
    return await this.page.evaluate(() => {
      return !!window._pendingShareData;
    });
  }
}

/**
 * Utility function to wait for a condition
 */
export async function waitForCondition(fn, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Timeout waiting for condition');
}

/**
 * Generate a share URL with Base64 encoding
 */
export function mockShareUrl(xml, xslt, mode = 'XSLT') {
  const session = {
    xml,
    xslt,
    output: '',
    mode,
    headers: [],
    properties: [],
    xpathEnabled: mode === 'XPATH'
  };
  const encoded = Buffer.from(JSON.stringify(session)).toString('base64');
  return `http://localhost:8000/?s=${encoded}`;
}
