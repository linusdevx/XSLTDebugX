import { test, expect } from '@playwright/test';
import { EditorPage } from '../../utils/test-helpers.js';

test('Standard XSLT hides CPI panels, runs, and restores from the draft', async ({ page }) => {
  test.setTimeout(90000);
  const editor = new EditorPage(page);
  await editor.navigate();
  await page.evaluate(async () => { await workspaceStore.deleteDatabase(); await workspaceStore.init(); });

  await page.evaluate(() => openWorkspaceSettings());
  await page.selectOption('#settingsRuntimeProfile', 'standard');
  await page.evaluate(() => closeWorkspaceSettings());
  await expect(page.locator('#hdrPanel')).toBeHidden();
  await expect(page.locator('#propPanel')).toBeHidden();
  await editor.clickRun();
  expect((await editor.getOutput()).length).toBeGreaterThan(0);
  await page.waitForTimeout(1100);
  expect(await page.evaluate(async () => (await workspaceStore.getDraft('draft-xslt')).source.runtimeProfile)).toBe('standard');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.monaco-editor');
  await page.evaluate(() => openWorkspaceSettings());
  await expect(page.locator('#settingsRuntimeProfile')).toHaveValue('standard', { timeout: 15000 });
  await page.evaluate(() => closeWorkspaceSettings());
  await expect(page.locator('#hdrPanel')).toBeHidden();
});

test('changing runtime in XPath mode persists only the XSLT context', async ({ page }) => {
  test.setTimeout(90000);
  const editor = new EditorPage(page);
  await editor.navigate();
  const ids = await page.evaluate(async () => {
    await workspaceStore.deleteDatabase();
    await workspaceStore.init();
    const xslt = await workspaceStore.createSession({
      type: 'xslt', workspaceId: 'workspace-default', title: 'Profile Mapping',
      source: { xml: '<x/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [], runtimeProfile: 'cpi' },
    });
    const xpath = await workspaceStore.createSession({
      type: 'xpath', workspaceId: 'workspace-default', title: 'Profile Query',
      source: { xml: '<x/>', expression: '/x' },
    });
    await sessionController.restoreSession(xslt);
    await sessionController.restoreSession(xpath);
    return { xslt: xslt.id, xpath: xpath.id, xpathRevision: xpath.revision };
  });
  expect(await editor.getMode()).toBe('XPATH');
  await page.evaluate(() => openWorkspaceSettings());
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await page.selectOption('#settingsRuntimeProfile', 'standard');
  await page.evaluate(() => sessionController.saveChain);
  const stored = await page.evaluate(async value => ({
    xslt: await workspaceStore.getSession(value.xslt),
    xpath: await workspaceStore.getSession(value.xpath),
  }), ids);
  expect(stored.xslt.source.runtimeProfile).toBe('standard');
  expect(stored.xpath.revision).toBe(ids.xpathRevision);

  await page.evaluate(() => closeWorkspaceSettings());
  await editor.switchToXslt();
  await page.evaluate(() => openWorkspaceSettings());
  await expect(page.locator('#settingsRuntimeProfile')).toHaveValue('standard');
  await page.evaluate(() => closeWorkspaceSettings());
  await expect(page.locator('#hdrPanel')).toBeHidden();
});
