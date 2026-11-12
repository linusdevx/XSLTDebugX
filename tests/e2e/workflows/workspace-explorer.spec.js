import { test, expect } from '@playwright/test';
import { EditorPage } from '../../utils/test-helpers.js';

// Helper: open the ··· menu on the row containing rowText and click a menuitem by label.
async function explorerRowAction(page, rowText, actionLabel) {
  const row = page.locator('.explorer-row, .explorer-folder-row').filter({ hasText: rowText }).first();
  await row.locator('button[aria-label="More actions"]').click();
  // Click the menuitem inside the open (not hidden) menu
  await page.locator('.explorer-row-menu:not([hidden]) [role="menuitem"]', { hasText: actionLabel }).click();
}

test.describe('local workspace Explorer', () => {
  let editor;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.navigate();
    await page.evaluate(async () => {
      await workspaceStore.deleteDatabase();
      await workspaceStore.init();
      await refreshExplorer();
    });
    await expect(page.locator('#workspaceExplorer')).toHaveClass(/open/);
  });

  test('creates, edits, and reopens a named XSLT mapping', async ({ page }) => {
    await page.locator('#explorerNewXslt').click();
    await page.locator('#explorerActionInput').fill('Order Mapping');
    await page.locator('#explorerActionConfirm').click();

    await expect(page.locator('#currentItemTitle')).toHaveText('Order Mapping');
    await expect(page.locator('.explorer-row-title')).toHaveText('Order Mapping');
    await expect(page.locator('.explorer-row[data-session-id]')).toHaveCount(1);
    await editor.fillXml('<orders><order id="1"/></orders>');
    await page.waitForTimeout(1300);

    const stored = await page.evaluate(() => workspaceStore.listSessions({ type: 'xslt' }));
    expect(stored).toHaveLength(1);
    expect(stored[0].source.xml).toContain('<orders>');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor');
    await expect(page.locator('#currentItemTitle')).toHaveText('Order Mapping', { timeout: 15000 });
    await expect.poll(() => editor.getXmlContent()).toContain('<orders>');
  });

  test('opens XSLT and XPath records with their correct isolated models', async ({ page }) => {
    await page.evaluate(async () => {
      await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'Mapping A',
        source: { xml: '<mapping-a/>', xslt: '<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"/>', headers: [], properties: [] },
      });
      await workspaceStore.createSession({
        type: 'xpath', workspaceId: 'workspace-default', title: 'Query B',
        source: { xml: '<query-b><item/></query-b>', expression: '//item' },
      });
      await refreshExplorer();
    });

    await page.getByText('Query B', { exact: true }).click();
    await expect.poll(() => editor.getMode()).toBe('XPATH');
    expect(await editor.getXmlContent()).toContain('<query-b>');
    await expect(page.locator('#xpathInput')).toHaveValue('//item');
    await expect(page.locator('#savedIndicatorText')).toHaveText('Saved locally');

    await page.getByText('Mapping A', { exact: true }).click();
    await expect.poll(() => editor.getMode()).toBe('XSLT');
    expect(await editor.getXmlContent()).toBe('<mapping-a/>');
  });

  test('favorites, renames, trashes, and restores a saved item', async ({ page }) => {
    await page.evaluate(async () => {
      await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'Lifecycle Mapping',
        source: { xml: '<life/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] },
      });
      await refreshExplorer();
    });

    await page.getByRole('button', { name: 'Add favorite' }).click();
    await page.getByRole('button', { name: 'Favorites' }).click();
    await expect(page.getByText('Lifecycle Mapping', { exact: true })).toBeVisible();

    await explorerRowAction(page, 'Lifecycle Mapping', 'Rename');
    await page.locator('#explorerActionInput').fill('Renamed Mapping');
    await page.locator('#explorerActionConfirm').click();
    await expect(page.getByText('Renamed Mapping', { exact: true })).toBeVisible();

    await explorerRowAction(page, 'Renamed Mapping', 'Move to Trash');
    await page.locator('#explorerActionConfirm').click();
    await expect(page.getByText('Renamed Mapping', { exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'Trash' }).click();
    await expect(page.getByText('Renamed Mapping', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Restore Renamed Mapping' }).click();
    await expect(page.getByText('Renamed Mapping', { exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.getByText('Renamed Mapping', { exact: true })).toBeVisible();
  });

  test('Explorer actions re-read revisions changed by autosave', async ({ page }) => {
    await page.evaluate(async () => {
      const record = await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'Revision Safe',
        source: { xml: '<v1/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] },
      });
      await refreshExplorer();
      await workspaceStore.updateSession(record.id, record.revision, {
        source: { ...record.source, xml: '<v2/>' },
      });
    });

    await page.getByRole('button', { name: 'Add favorite' }).click();
    await expect.poll(async () => {
      const records = await page.evaluate(() => workspaceStore.listSessions({ type: 'xslt' }));
      return records[0]?.favorite;
    }).toBe(true);
    const stored = await page.evaluate(() => workspaceStore.listSessions({ type: 'xslt' }));
    expect(stored[0].favorite).toBe(true);
    expect(stored[0].source.xml).toBe('<v2/>');
  });

  test('Clear resets a named item without deleting it', async ({ page }) => {
    await page.evaluate(async () => {
      const record = await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'Keep My Record',
        source: { xml: '<must-not-return/>', xslt: '<xsl:stylesheet/>', headers: [{ name: 'a', value: 'b' }], properties: [] },
      });
      await sessionController.restoreSession(record);
      clearSavedState();
    });
    await expect(page.locator('#savedIndicatorText')).toHaveText('Saved locally');

    const stored = await page.evaluate(() => workspaceStore.listSessions({ type: 'xslt' }));
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('Keep My Record');
    expect(stored[0].source.xml).not.toContain('must-not-return');
    expect(stored[0].source.headers).toHaveLength(0);
  });

  test('Ctrl+S saves the current playground content', async ({ page }) => {
    await editor.fillXml('<live-playground/>');
    await page.keyboard.press('Control+s');
    await page.locator('#explorerActionInput').fill('Live Save');
    await page.locator('#explorerActionConfirm').click();
    await expect(page.locator('#currentItemTitle')).toHaveText('Live Save');
    const records = await page.evaluate(() => workspaceStore.listSessions({ type: 'xslt' }));
    expect(records).toHaveLength(1);
    expect(records[0].source.xml).toBe('<live-playground/>');
  });

  test('switching sessions flushes the outgoing debounced edit', async ({ page }) => {
    const ids = await page.evaluate(async () => {
      const first = await workspaceStore.createSession({ type: 'xslt', workspaceId: 'workspace-default', title: 'First', source: { xml: '<first/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      const second = await workspaceStore.createSession({ type: 'xslt', workspaceId: 'workspace-default', title: 'Second', source: { xml: '<second/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      await sessionController.restoreSession(first);
      return { first: first.id, second: second.id };
    });
    await editor.fillXml('<first-edited/>');
    await page.evaluate(id => openExplorerSession(id), ids.second);
    await expect.poll(() => editor.getXmlContent()).toBe('<second/>');
    expect((await page.evaluate(id => workspaceStore.getSession(id), ids.first)).source.xml).toBe('<first-edited/>');
  });

  test('trashing one mode restores only that mode draft', async ({ page }) => {
    const ids = await page.evaluate(async () => {
      await workspaceStore.putDraft({ id: 'draft-xslt', type: 'xslt', source: { xml: '<quick-xslt/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      await workspaceStore.putDraft({ id: 'draft-xpath', type: 'xpath', source: { xml: '<quick-xpath/>', expression: '//quick' } });
      const xslt = await workspaceStore.createSession({ type: 'xslt', workspaceId: 'workspace-default', title: 'Trash XSLT', source: { xml: '<named-xslt/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      const xpath = await workspaceStore.createSession({ type: 'xpath', workspaceId: 'workspace-default', title: 'Keep XPath', source: { xml: '<named-xpath/>', expression: '//named' } });
      await sessionController.restoreSession(xslt);
      await sessionController.restoreSession(xpath);
      return { xslt: xslt.id, xpath: xpath.id };
    });
    await page.evaluate(async id => { void trashExplorerSession(await workspaceStore.getSession(id)); }, ids.xslt);
    await page.locator('#explorerActionConfirm').click();
    await expect.poll(() => page.evaluate(() => ({
      xslt: sessionController.activeSessions.xslt?.id || null,
      xpath: sessionController.activeSessions.xpath?.id || null,
    }))).toEqual({ xslt: null, xpath: ids.xpath });
    await editor.switchToXslt();
    await expect(page.locator('#currentItemTitle')).toHaveText('Quick Playground');
    expect(await editor.getXmlContent()).toBe('<quick-xslt/>');
  });

  test('opening another saved item clears stale derived output', async ({ page }) => {
    const ids = await page.evaluate(async () => {
      const first = await workspaceStore.createSession({ type: 'xslt', workspaceId: 'workspace-default', title: 'Output First', source: { xml: '<first/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      const second = await workspaceStore.createSession({ type: 'xslt', workspaceId: 'workspace-default', title: 'Output Second', source: { xml: '<second/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      await sessionController.restoreSession(first);
      eds.out.setValue('<stale-output/>');
      document.getElementById('outEdWrap')?.classList.add('has-content');
      await sessionController.restoreSession(second);
      return { first: first.id, second: second.id };
    });
    expect(await editor.getOutput()).toBe('');
    await expect(page.locator('#outEdWrap')).not.toHaveClass(/has-content/);
    await expect(page.locator('#currentItemTitle')).toHaveText('Output Second');
  });

  test('creates and renames a folder, then moves a session into it', async ({ page }) => {
    await page.evaluate(async () => {
      await workspaceStore.createSession({ type: 'xslt', workspaceId: 'workspace-default', title: 'Folder Item', favorite: true, source: { xml: '<item/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      await refreshExplorer();
    });
    await page.locator('#explorerNewFolder').click();
    await page.locator('#explorerActionInput').fill('Mappings');
    await page.locator('#explorerActionConfirm').click();
    await page.getByRole('button', { name: 'Favorites', exact: true }).click();
    await explorerRowAction(page, 'Folder Item', 'Move to folder');
    await page.locator('#explorerActionSelect').selectOption({ label: 'Mappings' });
    await page.locator('#explorerActionConfirm').click();
    await explorerRowAction(page, 'Mappings', 'Rename');
    await page.locator('#explorerActionInput').fill('CPI Mappings');
    await page.locator('#explorerActionConfirm').click();
    await expect(page.getByText('▾ CPI Mappings')).toBeVisible();
    const result = await page.evaluate(async () => ({
      session: (await workspaceStore.listSessions())[0],
      folder: (await workspaceStore.listFolders('workspace-default'))[0],
    }));
    expect(result.session.folderId).toBe(result.folder.id);
    expect(result.folder.name).toBe('CPI Mappings');
    const folderRow = page.locator('.explorer-folder-row').filter({ hasText: 'CPI Mappings' });
    await folderRow.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(folderRow).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Folder Item', { exact: true })).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Folder Item', { exact: true })).toBeVisible();
  });

  test('Settings controls local preferences and Trash, and About explains privacy', async ({ page }) => {
    await page.evaluate(async () => {
      const record = await workspaceStore.createSession({ type: 'xslt', workspaceId: 'workspace-default', title: 'Disposable', source: { xml: '<x/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      await workspaceStore.moveSessionToTrash(record.id, record.revision);
    });
    await page.getByRole('button', { name: 'About XSLTDebugX' }).click();
    await expect(page.getByRole('dialog', { name: 'About XSLTDebugX' })).toContainText('source content is not attached');
    await page.getByRole('button', { name: 'Close About' }).click();

    await page.locator('#settingsBtn').click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await page.locator('#settingsTheme').selectOption('light');
    await expect(page.locator('body')).toHaveClass(/light/);
    await expect(page.locator('#settingsTrashStatus')).toHaveText('1 item');
    await page.getByRole('button', { name: 'Empty Trash' }).click();
    await page.locator('#explorerActionConfirm').click();
    await expect(page.locator('#settingsTrashStatus')).toHaveText('0 items');
    expect(await page.evaluate(() => workspaceStore.listTrash())).toHaveLength(0);
  });

  test('moves a nested folder tree to Trash and restores it atomically', async ({ page }) => {
    await page.evaluate(async () => {
      const parent = await workspaceStore.createFolder({ workspaceId: 'workspace-default', name: 'Parent' });
      const child = await workspaceStore.createFolder({ workspaceId: 'workspace-default', parentFolderId: parent.id, name: 'Child' });
      await workspaceStore.createSession({ type: 'xslt', workspaceId: 'workspace-default', folderId: child.id, title: 'Nested Mapping', source: { xml: '<nested/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      await refreshExplorer();
    });
    await explorerRowAction(page, 'Parent', 'Move to Trash');
    await page.locator('#explorerActionConfirm').click();
    await expect.poll(() => page.evaluate(async () => (await workspaceStore.listFolders('workspace-default')).length)).toBe(0);
    await expect.poll(() => page.evaluate(async () => (await workspaceStore.listSessions()).length)).toBe(0);
    await page.getByRole('button', { name: 'Trash' }).click();
    await expect(page.getByText('Parent (1 saved item)', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Restore Parent (1 saved item)' }).click();
    await expect.poll(() => page.evaluate(async () => (await workspaceStore.listFolders('workspace-default')).length)).toBe(2);
    const restored = await page.evaluate(async () => ({ folders: await workspaceStore.listFolders('workspace-default'), sessions: await workspaceStore.listSessions(), trash: await workspaceStore.listTrash() }));
    expect(restored.folders).toHaveLength(2);
    expect(restored.sessions[0].source.xml).toBe('<nested/>');
    expect(restored.trash).toHaveLength(0);
  });

});
