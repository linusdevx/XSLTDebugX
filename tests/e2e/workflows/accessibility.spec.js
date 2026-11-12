import { test, expect } from '@playwright/test';
import { EditorPage } from '../../utils/test-helpers.js';

test.describe('accessibility improvements', () => {
  test.describe.configure({ timeout: 60000 });
  let editor;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.navigate();
  });

  // ── Skip link ──────────────────────────────────────────────────────────────

  test('skip link is hidden until focused and jumps to Run button', async ({ page }) => {
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeAttached();

    // Before focus: off-screen
    await expect(skipLink).not.toBeInViewport();

    // Tab into it
    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();

    // After focus: visible in viewport
    await expect(skipLink).toBeInViewport();

    // Activating it focuses #runBtn
    await page.keyboard.press('Enter');
    await expect(page.locator('#runBtn')).toBeFocused();
  });

  // ── Console bar keyboard toggle ────────────────────────────────────────────

  test('console bar toggles with Enter and Space keys', async ({ page }) => {
    const consoleBar = page.locator('.console-bar');
    const consolePanel = page.locator('#consolePanel');

    await expect(consolePanel).not.toHaveClass(/minimized/);

    // Focus the bar and press Enter
    await consoleBar.focus();
    await page.keyboard.press('Enter');
    await expect(consolePanel).toHaveClass(/minimized/);

    // Space restores it
    await page.keyboard.press('Space');
    await expect(consolePanel).not.toHaveClass(/minimized/);
  });

  test('console bar has role=button and aria-label', async ({ page }) => {
    const consoleBar = page.locator('.console-bar');
    await expect(consoleBar).toHaveAttribute('role', 'button');
    await expect(consoleBar).toHaveAttribute('aria-label', 'Toggle console');
    await expect(consoleBar).toHaveAttribute('tabindex', '0');
  });

  // ── Focus return from dialogs ──────────────────────────────────────────────

  test('Help modal returns focus to opener', async ({ page }) => {
    const helpBtn = page.locator('#helpBtn');
    await helpBtn.click();
    await expect(page.locator('#helpModalBackdrop')).toHaveClass(/open/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#helpModalBackdrop')).not.toHaveClass(/open/);
    await expect(helpBtn).toBeFocused();
  });

  test('Share modal returns focus to opener', async ({ page }) => {
    const shareBtn = page.locator('#shareBtn');
    await shareBtn.click();
    await expect(page.locator('#shareModalBackdrop')).toHaveClass(/open/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#shareModalBackdrop')).not.toHaveClass(/open/);
    await expect(shareBtn).toBeFocused();
  });

  test('Examples modal returns focus to opener', async ({ page }) => {
    const exBtn = page.locator('#exBtn');
    await exBtn.click();
    await expect(page.locator('#exModalBackdrop')).toHaveClass(/open/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#exModalBackdrop')).not.toHaveClass(/open/);
    await expect(exBtn).toBeFocused();
  });

  test('About dialog returns focus to opener', async ({ page }) => {
    // Open About via the bottom About button (always visible, not a menu item)
    const aboutBtn = page.locator('button[aria-label="About XSLTDebugX"]');
    await aboutBtn.click();
    await expect(page.locator('#aboutBackdrop')).toHaveClass(/open/);

    // Close via close button
    await page.locator('#aboutBackdrop .ex-modal-close').click();
    await expect(page.locator('#aboutBackdrop')).not.toHaveClass(/open/);
    // Focus returns to the button that opened the dialog
    await expect(aboutBtn).toBeFocused();
  });

  // ── Save indicator tooltip uses session name ───────────────────────────────

  test('save indicator tooltip says "Quick Playground saved locally" in playground', async ({ page }) => {
    // Type something to trigger a save
    await page.evaluate(() => { if (typeof setRuntimeProfile === 'function') setRuntimeProfile('standard', { log: false }); });
    await page.waitForTimeout(1200);

    const ind = page.locator('#savedIndicator');
    await expect(ind).toHaveAttribute('title', /Quick Playground/);
  });

  test('save indicator tooltip uses session name for named sessions', async ({ page }) => {
    await page.evaluate(async () => {
      await workspaceStore.deleteDatabase();
      await workspaceStore.init();
      const record = await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'My Invoice Map',
        source: { xml: '<x/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] },
      });
      await sessionController.restoreSession(record);
    });

    // Trigger a save cycle
    await page.evaluate(() => { if (typeof scheduleSave === 'function') scheduleSave(); });
    await page.waitForTimeout(1200);

    const ind = page.locator('#savedIndicator');
    await expect(ind).toHaveAttribute('title', /My Invoice Map/);
  });

  // ── Copy toast screen-reader role ─────────────────────────────────────────

  test('copy toast has role=status for screen reader announcement', async ({ page }) => {
    // Trigger a copy action that shows a toast
    await page.locator('button[aria-label="Copy XSLT"]').click();

    const toast = page.locator('.toast').first();
    await expect(toast).toBeAttached({ timeout: 5000 });
    await expect(toast).toHaveAttribute('role', 'status');
    // aria-live is on the #toastRegion container, not individual toasts
    const region = page.locator('#toastRegion');
    await expect(region).toHaveAttribute('aria-live', 'polite');
  });

  // ── Explorer create buttons accessible names ───────────────────────────────

  test('Explorer create buttons have accessible names', async ({ page }) => {
    // Three direct buttons in the Explorer header — no dropdown needed
    await expect(page.locator('#explorerNewXslt')).toBeAttached();
    await expect(page.locator('#explorerNewXslt')).toHaveAttribute('aria-label', 'New XSLT mapping');
    await expect(page.locator('#explorerNewXpath')).toHaveAttribute('aria-label', 'New XPath query');
    await expect(page.locator('#explorerNewFolder')).toHaveAttribute('aria-label', 'New folder');
  });

  // ── Run button accessible name excludes kbd shortcut ──────────────────────

  test('Run button has aria-label that excludes keyboard hint', async ({ page }) => {
    await expect(page.locator('#runBtn')).toHaveAttribute('aria-label', 'Run XSLT transform');
  });

  // ── Example cards keyboard navigation ────────────────────────────────────

  test('example cards are keyboard accessible', async ({ page }) => {
    // Open the examples modal
    await page.locator('#exBtn').click();
    await expect(page.locator('#exModalBackdrop')).toHaveClass(/open/);

    // Tab into the first visible card and verify it has role=button
    const firstCard = page.locator('.ex-card').first();
    await expect(firstCard).toHaveAttribute('role', 'button');
    await expect(firstCard).toHaveAttribute('tabindex', '0');
    await expect(firstCard).toHaveAttribute('aria-label');

    // Focus the first card and press Enter to load it
    await firstCard.focus();
    await expect(firstCard).toBeFocused();
    await page.keyboard.press('Enter');

    // Modal should close after loading
    await expect(page.locator('#exModalBackdrop')).not.toHaveClass(/open/, { timeout: 5000 });
  });

  // ── Ctrl+B toggles Explorer ───────────────────────────────────────────────

  test('Ctrl+B toggles the Explorer sidebar', async ({ page }) => {
    const explorer = page.locator('#workspaceExplorer');

    // Ensure Explorer is open first (may vary by viewport/session setting)
    await page.evaluate(() => toggleExplorer(true));
    await expect(explorer).toHaveClass(/open/);

    // Move focus away from Monaco by clicking a non-editor element
    await page.locator('#runBtn').focus();
    await page.keyboard.press('Control+b');
    await expect(explorer).not.toHaveClass(/open/);

    // Ctrl+B reopens it
    await page.keyboard.press('Control+b');
    await expect(explorer).toHaveClass(/open/);
  });
});
