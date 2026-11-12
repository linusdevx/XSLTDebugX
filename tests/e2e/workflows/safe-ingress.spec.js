import { test, expect } from '@playwright/test';
import { EditorPage } from '../../utils/test-helpers.js';

test.describe('examples and files open as temporary work', () => {
  let editor;

  test.use({ timeout: 90000 });

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.navigate();
    await page.evaluate(async () => {
      await workspaceStore.deleteDatabase();
      await workspaceStore.init();
    });
  });

  test('an XSLT example cannot overwrite an open named mapping', async ({ page }) => {
    await page.evaluate(async () => {
      const record = await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'Protected Mapping',
        source: { xml: '<protected/>', xslt: '<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"/>', headers: [], properties: [] },
      });
      await sessionController.restoreSession(record);
      await loadExample('identityTransform');
    });

    await expect(page.locator('#currentItemTitle')).toHaveText('Identity Transform');
    await expect(page.locator('#savedIndicatorText')).toHaveText('Temporary · not saved');
    await editor.fillXml('<example-edit/>');
    await page.waitForTimeout(1300);

    const stored = await page.evaluate(() => workspaceStore.listSessions({ type: 'xslt' }));
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('Protected Mapping');
    expect(stored[0].source.xml).toBe('<protected/>');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor');
    await expect(page.locator('#currentItemTitle')).toHaveText('Quick Playground', { timeout: 15000 });
    expect(await editor.getXmlContent()).not.toBe('<example-edit/>');
  });

  test('an XPath example remains detached from a named query', async ({ page }) => {
    await page.evaluate(async () => {
      const record = await workspaceStore.createSession({
        type: 'xpath', workspaceId: 'workspace-default', title: 'Protected Query',
        source: { xml: '<protected-query/>', expression: '/protected-query' },
      });
      await sessionController.restoreSession(record);
      await loadExample('xpathNavigation');
    });

    expect(await editor.getMode()).toBe('XPATH');
    await expect(page.locator('#currentItemTitle')).toHaveText('Navigation & Predicates');
    await page.locator('#xpathInput').fill('//temporary');
    await page.waitForTimeout(1300);

    const stored = await page.evaluate(() => workspaceStore.listSessions({ type: 'xpath' }));
    expect(stored).toHaveLength(1);
    expect(stored[0].source.expression).toBe('/protected-query');
  });

  test('uploading XML detaches before replacing editor content', async ({ page }) => {
    await page.evaluate(async () => {
      const record = await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'Upload Protected',
        source: { xml: '<original/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] },
      });
      await sessionController.restoreSession(record);
      eds.out.setValue('<old-result/>');
      document.getElementById('outEdWrap')?.classList.add('has-content');
    });

    await page.locator('#uploadXml').setInputFiles({
      name: 'incoming.xml', mimeType: 'application/xml', buffer: Buffer.from('<incoming/>'),
    });
    await expect.poll(() => editor.getXmlContent()).toBe('<incoming/>');
    await expect(page.locator('#currentItemTitle')).toHaveText('incoming');
    expect(await editor.getOutput()).toBe('');
    await expect(page.locator('#outEdWrap')).not.toHaveClass(/has-content/);
    const stored = await page.evaluate(() => workspaceStore.listSessions({ type: 'xslt' }));
    expect(stored[0].source.xml).toBe('<original/>');
  });

  test('rejects oversized pane files before reading them', async ({ page }) => {
    const message = await page.evaluate(() => {
      try { validateUserTextFile({ name: 'huge.xml', size: USER_TEXT_FILE_MAX_BYTES + 1 }); return ''; }
      catch (error) { return error.message; }
    });
    expect(message).toContain('25 MiB');
    expect(await editor.getXmlContent()).not.toBe('');
  });

  test('a CPI example cannot change the saved runtime profile', async ({ page }) => {
    await page.evaluate(async () => {
      const record = await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'Standard Protected',
        source: { xml: '<standard/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [], runtimeProfile: 'standard' },
      });
      await sessionController.restoreSession(record);
      await loadExample('idocToXml');
    });
    const stored = await page.evaluate(async () => (await workspaceStore.listSessions({ type: 'xslt' }))[0]);
    expect(stored.source.runtimeProfile).toBe('standard');
    await page.evaluate(() => openWorkspaceSettings());
    await expect(page.locator('#settingsRuntimeProfile')).toHaveValue('cpi');
    await page.evaluate(() => closeWorkspaceSettings());
    await expect(page.locator('#savedIndicatorText')).toHaveText('Temporary · not saved');
  });
});
