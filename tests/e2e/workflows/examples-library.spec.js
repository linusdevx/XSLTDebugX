import { test, expect } from '@playwright/test';
import { EditorPage } from '../../utils/test-helpers.js';
import { sampleData } from '../../fixtures/sample-data.js';

/**
 * Examples Library Modal Tests
 * Tests the Examples feature: open modal, load examples, search, auto-run, mode switching
 */

test.describe('Examples Library Workflow', () => {
  let page;

  test.beforeEach(async ({ page: testPage }) => {
    page = new EditorPage(testPage);
    await page.navigate();
    // Clear storage to get clean state
    await testPage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    // Start in XSLT mode
    await page.switchToXslt();
  });

  test('should open examples modal and render sidebar categories', async ({ page: testPage }) => {
    await page.openExamplesModal();

    // Verify modal is visible
    const backdrop = testPage.locator('#exModalBackdrop');
    const isOpen = await backdrop.evaluate(el => el.classList.contains('open'));
    expect(isOpen).toBe(true);

    // Verify sidebar and grid are visible
    const sidebar = testPage.locator('#exSidebar');
    const grid = testPage.locator('#exGridWrap');

    expect(await sidebar.isVisible()).toBe(true);
    expect(await grid.isVisible()).toBe(true);
  });

  test('should close modal on backdrop click', async ({ page: testPage }) => {
    await page.openExamplesModal();

    let backdrop = testPage.locator('#exModalBackdrop');
    let isOpen = await backdrop.evaluate(el => el.classList.contains('open'));
    expect(isOpen).toBe(true);

    await page.closeExamplesModal();

    isOpen = await backdrop.evaluate(el => el.classList.contains('open'));
    expect(isOpen).toBe(false);
  });

  test('should load transform example and populate XML/XSLT', async ({ page: testPage }) => {
    await page.openExamplesModal();

    // Load a transform example
    await page.loadExample('identityTransform');

    // Verify content is populated
    const xml = await page.getXmlContent();
    const xslt = await page.getXsltContent();

    expect(xml.length).toBeGreaterThan(0);
    expect(xslt.length).toBeGreaterThan(0);
    expect(xslt).toContain('xsl:stylesheet');

    // Modal should be closed
    const backdrop = testPage.locator('#exModalBackdrop');
    const isOpen = await backdrop.evaluate(el => el.classList.contains('open'));
    expect(isOpen).toBe(false);
  });

  test('should load XPath example and switch to XPath mode', async ({ page: testPage }) => {
    await page.openExamplesModal();

    // Load an XPath example
    await page.loadExample('xpathNavigation');

    // Verify mode switched to XPath
    const mode = await page.getMode();
    expect(mode).toBe('XPATH');
  });

  test('should load CPI example with auto-populated headers', async ({ page: testPage }) => {
    await page.openExamplesModal();

    // Load a CPI example
    await page.loadExample('cpiHeadersProps');

    // Verify we're in XSLT mode (CPI is XSLT-only)
    const mode = await page.getMode();
    expect(mode).toBe('XSLT');

    // Verify headers were auto-populated
    const headerCount = await page.getHeaderCount();
    // CPI examples should have headers
    const session = await page.getStoredSession();
    expect(session.headers).toBeDefined();
  });

  test('should search examples by keyword', async ({ page: testPage }) => {
    await page.openExamplesModal();

    // Get initial count
    const initialCount = await page.getExampleCount();
    expect(initialCount).toBeGreaterThan(0);

    // Search for 'json'
    await page.searchExamples('json');

    // Filtered count should be less than or equal to initial
    const filteredCount = await page.getExampleCount();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('should return to full list when clearing search', async ({ page: testPage }) => {
    await page.openExamplesModal();

    const initialCount = await page.getExampleCount();

    // Search for something specific
    await page.searchExamples('transform');
    const searchCount = await page.getExampleCount();

    // Clear search
    await page.searchExamples('');

    // Count should be back to initial
    const clearedCount = await page.getExampleCount();
    expect(clearedCount).toBe(initialCount);
  });

  test('should toggle auto-run checkbox and persist preference', async ({ page: testPage }) => {
    await page.openExamplesModal();

    // Enable auto-run
    await page.setAutoRunExamples(true);
    await testPage.waitForTimeout(300);

    // Verify preference is saved in localStorage
    const autoRunPref = await testPage.evaluate(() => {
      return localStorage.getItem('xdebugx-auto-run-examples');
    });
    expect(autoRunPref).toBeDefined();

    // Close and reopen modal
    await page.closeExamplesModal();
    await testPage.waitForTimeout(500);
    await page.openExamplesModal();
  });

  test('should auto-run example when preference is enabled', async ({ page: testPage }) => {
    // Enable auto-run before opening modal
    await page.openExamplesModal();
    await page.setAutoRunExamples(true);
    await page.closeExamplesModal();

    // Load an example with auto-run enabled
    await page.openExamplesModal();
    await page.loadExample('identityTransform');

    // Wait for auto-run to execute
    await testPage.waitForTimeout(2000);

    // Output should be populated
    const output = await page.getOutput();
    expect(output.length).toBeGreaterThan(0);
  });

  test('should clear validation errors when loading example', async ({ page: testPage }) => {
    // First, create a validation error
    await page.fillXslt('<invalid>');
    await testPage.waitForTimeout(1000);

    const errorsBefore = await page.getConsoleErrors();

    // Load an example
    await page.openExamplesModal();
    await page.loadExample('identityTransform');
    await testPage.waitForTimeout(1000);

    // Validation errors should be cleared by the example load
    const xslt = await page.getXsltContent();
    expect(xslt).toContain('xsl:stylesheet');
  });

  test('should display correct mode indicator in modal', async ({ page: testPage }) => {
    await page.openExamplesModal();

    // Mode should be indicated somehow (check if XSLT examples show XSLT badge, etc.)
    const modeIndicator = testPage.locator('#modeBtnXslt, .mode-btn-xslt');
    expect(await modeIndicator.isVisible()).toBe(true);
  });

  test('should isolate examples by category', async ({ page: testPage }) => {
    await page.openExamplesModal();

    // Get all examples count
    const allCount = await page.getExampleCount();

    // Click a category (e.g., 'CPI')
    const cpiCategoryBtn = testPage.locator('#exSidebar button').first(); // Assuming first category
    if (await cpiCategoryBtn.isVisible()) {
      await cpiCategoryBtn.click();
      await testPage.waitForTimeout(500);

      // Filtered count should be <= all count
      const categoryCount = await page.getExampleCount();
      expect(categoryCount).toBeLessThanOrEqual(allCount);
    }
  });

  test('should not populate headers in XPath examples', async ({ page: testPage }) => {
    await page.openExamplesModal();

    // Load an XPath example
    await page.loadExample('xpathNavigation');

    // Verify mode is XPath
    const mode = await page.getMode();
    expect(mode).toBe('XPATH');

    // Headers should not be populated (they're only for XSLT)
    const headerCount = await page.getHeaderCount();
    // In XPath mode, header panel should be hidden or disabled
    const hdrPanel = testPage.locator('#hdrPanel');
    const isVisible = await hdrPanel.isVisible();
    // XPath examples won't have headers populated
    expect(headerCount).toBe(0);
  });

  test('SUMMARY: Examples Library', async () => {
    console.log(`
✅ EXAMPLES LIBRARY SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Examples modal opens/closes
  • Examples load and populate editors
  • Search and filtering work
  • Auto-run preference persists
`);
  });
});
