import { test, expect } from '@playwright/test';
import { EditorPage } from '../../utils/test-helpers.js';

test.describe('IndexedDB Quick Playground drafts', () => {
  let editor;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.navigate();
    await page.evaluate(async () => {
      await workspaceStore.deleteDatabase();
      await workspaceStore.init();
      localStorage.removeItem('xdebugx-session-v1');
    });
  });

  test('autosaves independent XSLT and XPath drafts', async ({ page }) => {
    await editor.switchToXslt();
    await editor.fillXml('<xslt-draft/>');
    await editor.fillXslt('<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"/>');
    await editor.switchToXpath();
    await editor.fillXml('<xpath-draft><Item/></xpath-draft>');
    await page.locator('#xpathInput').fill('//Item');
    await page.waitForTimeout(1300);

    const drafts = await page.evaluate(async () => ({
      xslt: await workspaceStore.getDraft('draft-xslt'),
      xpath: await workspaceStore.getDraft('draft-xpath'),
      activeMode: await workspaceStore.getSetting('activeMode'),
      legacy: localStorage.getItem('xdebugx-session-v1'),
    }));

    expect(drafts.xslt.source.xml).toBe('<xslt-draft/>');
    expect(drafts.xpath.source.xml).toContain('<xpath-draft>');
    expect(drafts.xpath.source.expression).toBe('//Item');
    expect(drafts.activeMode).toBe('XPATH');
    expect(drafts.legacy).toBeNull();
  });

  test('restores both drafts and the active mode after reload', async ({ page }) => {
    await page.evaluate(async () => {
      await workspaceStore.putDraft({
        id: 'draft-xslt',
        type: 'xslt',
        source: {
          xml: '<saved-xslt/>',
          xslt: '<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"/>',
          headers: [{ name: 'source', value: 'TEST' }],
          properties: [{ name: 'environment', value: 'DEV' }],
        },
      });
      await workspaceStore.putDraft({
        id: 'draft-xpath',
        type: 'xpath',
        source: { xml: '<saved-xpath><Item/></saved-xpath>', expression: '//Item' },
      });
      await workspaceStore.setSetting('activeMode', 'XPATH');
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor');
    await page.waitForTimeout(2500);

    expect(await editor.getMode()).toBe('XPATH');
    expect(await editor.getXmlContent()).toContain('<saved-xpath>');
    expect(await page.locator('#xpathInput').inputValue()).toBe('//Item');

    await editor.switchToXslt();
    expect(await editor.getXmlContent()).toBe('<saved-xslt/>');
    expect(await editor.getXsltContent()).toContain('xsl:stylesheet');
    expect(await editor.getHeaderCount()).toBe(1);
    expect(await editor.getPropertyCount()).toBe(1);
  });

  test('restores the last named item for both modes after reload', async ({ page }) => {
    const ids = await page.evaluate(async () => {
      const xslt = await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'Reloaded Mapping',
        source: { xml: '<named-xslt/>', xslt: '<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"/>', headers: [{ name: 'mode', value: 'xslt' }], properties: [] },
      });
      const xpath = await workspaceStore.createSession({
        type: 'xpath', workspaceId: 'workspace-default', title: 'Reloaded Query',
        source: { xml: '<named-xpath><Item/></named-xpath>', expression: '//Item' },
      });
      await workspaceStore.setSetting('activeSession:xslt', xslt.id);
      await workspaceStore.setSetting('activeSession:xpath', xpath.id);
      await workspaceStore.setSetting('activeMode', 'XPATH');
      return { xslt: xslt.id, xpath: xpath.id, xsltRevision: xslt.revision, xpathRevision: xpath.revision };
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor');
    await expect(page.locator('#currentItemTitle')).toHaveText('Reloaded Query', { timeout: 5000 });
    expect(await editor.getMode()).toBe('XPATH');
    expect(await editor.getXmlContent()).toContain('<named-xpath>');
    expect(await page.locator('#xpathInput').inputValue()).toBe('//Item');
    const startupRecords = await page.evaluate(async value => ({
      xslt: await workspaceStore.getSession(value.xslt),
      xpath: await workspaceStore.getSession(value.xpath),
    }), ids);
    expect(startupRecords.xslt.revision).toBe(ids.xsltRevision);
    expect(startupRecords.xpath.revision).toBe(ids.xpathRevision);

    await editor.switchToXslt();
    await expect(page.locator('#currentItemTitle')).toHaveText('Reloaded Mapping');
    expect(await editor.getXmlContent()).toBe('<named-xslt/>');
    expect(await editor.getHeaderCount()).toBe(1);
    await page.evaluate(() => sessionController.saveChain);
    const switchedRecords = await page.evaluate(async value => ({
      xslt: await workspaceStore.getSession(value.xslt),
      xpath: await workspaceStore.getSession(value.xpath),
      activeMode: await workspaceStore.getSetting('activeMode'),
    }), ids);
    expect(switchedRecords.xslt.revision).toBe(ids.xsltRevision);
    expect(switchedRecords.xpath.revision).toBe(ids.xpathRevision);
    expect(switchedRecords.activeMode).toBe('XSLT');
  });

  test('ignores legacy content and leaves it untouched', async ({ page }) => {
    const legacy = JSON.stringify({
      xmlXslt: '<legacy-xml/>',
      xslt: '<legacy-xslt/>',
      xmlXpath: '<legacy-xpath/>',
      xpathExpr: '//legacy',
      xpathEnabled: true,
    });
    await page.evaluate(value => localStorage.setItem('xdebugx-session-v1', value), legacy);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor');
    await page.waitForTimeout(2200);

    expect(await editor.getMode()).toBe('XSLT');
    expect(await editor.getXmlContent()).not.toContain('legacy-xml');
    expect(await page.evaluate(() => localStorage.getItem('xdebugx-session-v1'))).toBe(legacy);
  });

  test('reports saving and committed local state truthfully', async ({ page }) => {
    await editor.fillXml('<saving-state/>');
    await expect(page.locator('#savedIndicatorText')).toHaveText('Saving…');
    await expect(page.locator('#savedIndicatorText')).toHaveText('Saved locally', { timeout: 4000 });
    const draft = await page.evaluate(() => workspaceStore.getDraft('draft-xslt'));
    expect(draft.source.xml).toBe('<saving-state/>');
  });

  test('clears only the active mode draft', async ({ page }) => {
    await page.evaluate(async () => {
      await workspaceStore.putDraft({
        id: 'draft-xslt', type: 'xslt',
        source: { xml: '<x/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] },
      });
      await workspaceStore.putDraft({
        id: 'draft-xpath', type: 'xpath',
        source: { xml: '<y/>', expression: '//y' },
      });
    });
    await editor.switchToXslt();
    await page.evaluate(() => clearSavedState());
    await page.waitForTimeout(500);

    const drafts = await page.evaluate(async () => ({
      xslt: await workspaceStore.getDraft('draft-xslt'),
      xpath: await workspaceStore.getDraft('draft-xpath'),
    }));
    expect(drafts.xslt).toBeNull();
    expect(drafts.xpath).not.toBeNull();
  });

  test('does not rewrite the inactive named session during autosave', async ({ page }) => {
    const ids = await page.evaluate(async () => {
      const xslt = await workspaceStore.createSession({ type: 'xslt', workspaceId: 'workspace-default', title: 'Active XSLT', source: { xml: '<x/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      const xpath = await workspaceStore.createSession({ type: 'xpath', workspaceId: 'workspace-default', title: 'Inactive XPath', source: { xml: '<y/>', expression: '//y' } });
      await sessionController.restoreSession(xpath);
      await sessionController.restoreSession(xslt);
      await flushPendingSave();
      return { xslt: xslt.id, xpath: xpath.id, xpathRevision: (await workspaceStore.getSession(xpath.id)).revision };
    });
    await editor.fillXml('<x-edited/>');
    await expect(page.locator('#savedIndicatorText')).toHaveText('Saved locally', { timeout: 4000 });
    const records = await page.evaluate(async ids => ({ xslt: await workspaceStore.getSession(ids.xslt), xpath: await workspaceStore.getSession(ids.xpath) }), ids);
    expect(records.xslt.revision).toBeGreaterThan(1);
    expect(records.xpath.revision).toBe(ids.xpathRevision);
  });

  test('autosave preserves non-editor source metadata', async ({ page }) => {
    const ids = await page.evaluate(async () => {
      const xslt = await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'Options Mapping',
        source: { xml: '<x/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [], runOptions: { indent: false, custom: 'keep' } },
      });
      const xpath = await workspaceStore.createSession({
        type: 'xpath', workspaceId: 'workspace-default', title: 'Namespace Query',
        source: { xml: '<n:x xmlns:n="urn:test"/>', expression: '/n:x', namespaces: { n: 'urn:test' }, evaluatorOptions: { strict: true } },
      });
      await sessionController.restoreSession(xslt);
      return { xslt: xslt.id, xpath: xpath.id };
    });
    await editor.fillXml('<x changed="yes"/>');
    await expect(page.locator('#savedIndicatorText')).toHaveText('Saved locally', { timeout: 4000 });
    await page.evaluate(async id => sessionController.restoreSession(await workspaceStore.getSession(id)), ids.xpath);
    await page.locator('#xpathInput').fill('/n:x/@id');
    await page.locator('#xpathInput').dispatchEvent('input');
    await expect(page.locator('#savedIndicatorText')).toHaveText('Saved locally', { timeout: 4000 });

    const records = await page.evaluate(async value => ({
      xslt: await workspaceStore.getSession(value.xslt),
      xpath: await workspaceStore.getSession(value.xpath),
    }), ids);
    expect(records.xslt.source.runOptions).toEqual({ indent: false, custom: 'keep' });
    expect(records.xpath.source.namespaces).toEqual({ n: 'urn:test' });
    expect(records.xpath.source.evaluatorOptions).toEqual({ strict: true });
  });

  test('blocks a session switch after failed persistence and allows retry', async ({ page }) => {
    const ids = await page.evaluate(async () => {
      const first = await workspaceStore.createSession({ type: 'xslt', workspaceId: 'workspace-default', title: 'Unsaved First', source: { xml: '<first/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      const second = await workspaceStore.createSession({ type: 'xslt', workspaceId: 'workspace-default', title: 'Second', source: { xml: '<second/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      await sessionController.restoreSession(first);
      workspaceStore.setFailureInjector(point => { if (point === 'updateSession:beforeCommit') throw new Error('Simulated full storage'); });
      return { first: first.id, second: second.id };
    });
    await editor.fillXml('<must-stay-visible/>');
    await expect(page.locator('#savedIndicatorText')).toHaveText('Save failed', { timeout: 5000 });
    const blocked = await page.evaluate(async id => {
      try { await openExplorerSession(id); return false; } catch (_) { return true; }
    }, ids.second);
    expect(blocked).toBe(true);
    expect(await editor.getXmlContent()).toBe('<must-stay-visible/>');
    await expect(page.locator('#currentItemTitle')).toHaveText('Unsaved First');

    await page.evaluate(() => workspaceStore.setFailureInjector(null));
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('#savedIndicatorText')).toHaveText('Saved locally', { timeout: 4000 });
    await page.evaluate(id => openExplorerSession(id), ids.second);
    await expect.poll(() => editor.getXmlContent()).toBe('<second/>');
  });

  test('blocks a mode switch when a named item cannot be saved', async ({ page }) => {
    await page.evaluate(async () => {
      const record = await workspaceStore.createSession({ type: 'xslt', workspaceId: 'workspace-default', title: 'Mode Guard', source: { xml: '<before/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      await sessionController.restoreSession(record);
      workspaceStore.setFailureInjector(point => { if (point === 'updateSession:beforeCommit') throw new Error('Simulated full storage'); });
    });
    await editor.fillXml('<must-save-first/>');
    await page.locator('#modeBtnXpath').click();
    await expect.poll(() => editor.getMode()).toBe('XSLT');
    await expect(page.locator('#savedIndicatorText')).toHaveText('Save failed');

    await page.evaluate(() => workspaceStore.setFailureInjector(null));
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('#savedIndicatorText')).toHaveText('Saved locally', { timeout: 4000 });
    await page.locator('#modeBtnXpath').click();
    await expect.poll(() => editor.getMode()).toBe('XPATH');
    const stored = await page.evaluate(async () => (await workspaceStore.listSessions({ type: 'xslt' }))[0]);
    expect(stored.source.xml).toBe('<must-save-first/>');
  });

  test('save indicator follows each mode temporary state', async ({ page }) => {
    await page.evaluate(async () => {
      await workspaceStore.putDraft({ id: 'draft-xpath', type: 'xpath', source: { xml: '<saved-query/>', expression: '//saved-query' } });
      sessionController.beginTemporary('xslt', 'Temporary Mapping');
    });
    await expect(page.locator('#savedIndicatorText')).toHaveText('Temporary · not saved');
    await page.locator('#modeBtnXpath').click();
    await expect.poll(() => editor.getMode()).toBe('XPATH');
    await expect(page.locator('#savedIndicatorText')).toHaveText('Saved locally');
    await page.locator('#modeBtnXslt').click();
    await expect.poll(() => editor.getMode()).toBe('XSLT');
    await expect(page.locator('#savedIndicatorText')).toHaveText('Temporary · not saved');
  });

  test('preserves an open item removed by another tab as temporary work', async ({ page }) => {
    const id = await page.evaluate(async () => {
      const record = await workspaceStore.createSession({ type: 'xslt', workspaceId: 'workspace-default', title: 'Remote Item', source: { xml: '<preserve/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      await sessionController.restoreSession(record);
      window.dispatchEvent(new CustomEvent('workspace-store-change', { detail: { kind: 'session-trashed', id: record.id } }));
      return record.id;
    });
    await expect(page.locator('#currentItemTitle')).toHaveText('Remote Item (Recovered)');
    await expect(page.locator('#savedIndicatorText')).toHaveText('Temporary · not saved');
    expect(await editor.getXmlContent()).toBe('<preserve/>');
    expect(await page.evaluate(() => sessionController.getCurrentSession())).toBeNull();
  });
});
