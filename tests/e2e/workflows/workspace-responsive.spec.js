import { test, expect } from '@playwright/test';

test.describe('workspace responsive containment', () => {
  test('keeps mode, Run, and Explorer reachable without page overflow on phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:8000', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor');
    await page.waitForTimeout(2200);

    await expect(page.locator('#modeSwitcher')).toBeInViewport();
    await expect(page.locator('#runBtn')).toBeInViewport();
    await expect(page.locator('#mobilePaneNav')).toBeVisible();
    await page.getByRole('button', { name: 'Output', exact: true }).click();
    await expect(page.locator('#mobilePaneNav [data-pane="colRight"]')).toHaveAttribute('aria-current', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    await page.locator('#explorerToggle').click();
    const explorer = page.locator('#workspaceExplorer');
    if (!await explorer.evaluate(element => element.classList.contains('open'))) {
      await page.locator('#explorerToggle').click();
    }
    await expect(explorer).toHaveClass(/open/);
    await page.locator('#explorerSearch').focus();
    await page.keyboard.press('Escape');
    await expect(explorer).not.toHaveClass(/open/);
    await expect(page.locator('#explorerToggle')).toBeFocused();
  });

  test('uses an inline Explorer on wide desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:8000', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor');
    await page.waitForTimeout(2200);
    await page.evaluate(() => toggleExplorer(true));

    const position = await page.locator('#workspaceExplorer').evaluate(element => getComputedStyle(element).position);
    expect(position).toBe('static');
    await expect(page.locator('#runBtn')).toBeInViewport();

    await page.locator('#workspaceExplorer').evaluate(element => { element.style.width = '320px'; });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => workspaceStore.getSetting('explorerWidth'))).toBe(320);
  });

  test('Explorer shifts XSLT work into two panes and minimizes Output', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('http://localhost:8000', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor');
    await page.waitForTimeout(2200);
    await page.evaluate(() => {
      toggleExplorer(false);
      document.getElementById('colRight').classList.remove('collapsed');
      toggleExplorer(true);
    });

    expect(await page.locator('#workspaceExplorer').evaluate(element => getComputedStyle(element).position)).toBe('static');
    await expect(page.locator('#colRight')).toHaveClass(/collapsed/);
    const positions = await page.evaluate(() => {
      const ids = ['workspaceExplorer', 'colLeft', 'colCenter', 'colRight'];
      return ids.map(id => document.getElementById(id).getBoundingClientRect().left);
    });
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    await page.evaluate(() => toggleExplorer(false));
    await expect(page.locator('#colRight')).not.toHaveClass(/collapsed/);
  });

  test('pane gutters resize, persist, and reset the XSLT layout', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('http://localhost:8000', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor');
    await page.waitForTimeout(2200);
    await page.evaluate(() => toggleExplorer(true));

    const before = await page.locator('#colLeft').boundingBox();
    const splitter = await page.locator('#paneSplitterPrimary').boundingBox();
    await page.mouse.move(splitter.x + splitter.width / 2, splitter.y + 100);
    await page.mouse.down();
    await page.mouse.move(splitter.x + splitter.width / 2 + 70, splitter.y + 100, { steps: 5 });
    await page.mouse.up();
    const after = await page.locator('#colLeft').boundingBox();
    expect(after.width).toBeGreaterThan(before.width + 45);
    await expect.poll(() => page.evaluate(() => workspaceStore.getSetting('paneLayout:xslt'))).not.toBeNull();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor');
    await page.waitForTimeout(2200);
    const restored = await page.locator('#colLeft').boundingBox();
    expect(Math.abs(restored.width - after.width)).toBeLessThan(12);

    await page.locator('#paneSplitterPrimary').dblclick();
    await expect.poll(() => page.evaluate(() => workspaceStore.getSetting('paneLayout:xslt'))).toBeNull();
  });
});
