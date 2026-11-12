import { test, expect } from '@playwright/test';
import { EditorPage } from '../../utils/test-helpers.js';

const shared = {
  xml: '<shared><item>from-link</item></shared>',
  xslt: '<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:template match="/"><received/></xsl:template></xsl:stylesheet>',
  headers: [{ name: 'sender', value: 'alice' }],
  properties: [{ name: 'environment', value: 'test' }],
};

test.describe('shared-link receiver safety', () => {
  let editor;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.navigate();
    await page.evaluate(async () => {
      await workspaceStore.deleteDatabase();
      await workspaceStore.init();
      await workspaceStore.putDraft({
        id: 'draft-xslt', type: 'xslt',
        source: {
          xml: '<recipient-draft/>',
          xslt: '<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"/>',
          headers: [], properties: [],
        },
      });
    });
  });

  async function openShare(page, payload = shared) {
    const encoded = await page.evaluate(value => encodeShareData(value), payload);
    // A hash-only navigation does not reload the app, so leave the document first
    // to exercise the same startup path as a recipient opening a new link.
    await page.goto('about:blank');
    await page.goto(`http://localhost:8000/#share/${encoded}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor');
    await expect(page.locator('#incomingShareBackdrop')).toHaveClass(/open/, { timeout: 15000 });
  }

  test('previews a link without applying it and removes the payload from the address bar', async ({ page }) => {
    await openShare(page);

    await expect(page.locator('#incomingShareSummary')).toContainText('1 headers');
    await expect(page.locator('#incomingShareSummary')).toContainText('1 properties');
    expect(await editor.getXmlContent()).not.toBe(shared.xml);
    await expect(page).toHaveURL('http://localhost:8000/');
  });

  test('accepts the CPI Helper plugin transfer contract', async ({ page }) => {
    const pluginPayload = {
      xml: '<from-cpi-helper/>',
      xslt: '<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"/>',
      headers: [{ name: 'CamelHttpMethod', value: 'POST' }],
      properties: [{ name: 'SourceSystem', value: 'CPI' }],
    };
    // Mirrors CPI Helper xsltDebugX.js: CompressionStream('deflate-raw'),
    // URL-safe base64 without padding, and no runtimeProfile field.
    const encoded = await page.evaluate(async payload => {
      const stream = new Blob([JSON.stringify(payload)]).stream()
        .pipeThrough(new CompressionStream('deflate-raw'));
      const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
      let binary = '';
      for (let i = 0; i < compressed.length; i += 8192) {
        binary += String.fromCharCode(...compressed.subarray(i, i + 8192));
      }
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }, pluginPayload);

    await page.goto('about:blank');
    await page.goto(`http://localhost:8000/#share/${encoded}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor');
    await expect(page.getByRole('dialog', { name: 'Open shared XSLT?' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Open temporarily' }).click();

    await expect.poll(() => editor.getXmlContent()).toBe(pluginPayload.xml);
    expect(await page.evaluate(() => ({ runtimeProfile, kvData }))).toMatchObject({
      runtimeProfile: 'cpi',
      kvData: {
        headers: [{ name: 'CamelHttpMethod', value: 'POST' }],
        properties: [{ name: 'SourceSystem', value: 'CPI' }],
      },
    });
  });

  test('cancel restores the recipient Quick Playground', async ({ page }) => {
    await openShare(page);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('#incomingShareBackdrop')).not.toHaveClass(/open/);
    await expect.poll(() => editor.getXmlContent()).toBe('<recipient-draft/>');

    const draft = await page.evaluate(() => workspaceStore.getDraft('draft-xslt'));
    expect(draft.source.xml).toBe('<recipient-draft/>');
  });

  test('temporary open never overwrites the recipient draft', async ({ page }) => {
    await openShare(page);
    await page.getByRole('button', { name: 'Open temporarily' }).click();

    expect(await editor.getXmlContent()).toBe(shared.xml);
    await expect(page.locator('#savedIndicatorText')).toHaveText('Temporary · not saved');
    await editor.fillXml('<temporary-edit/>');
    await page.waitForTimeout(1300);

    const result = await page.evaluate(async () => ({
      draft: await workspaceStore.getDraft('draft-xslt'),
      sessions: await workspaceStore.listSessions({ type: 'xslt' }),
    }));
    expect(result.draft.source.xml).toBe('<recipient-draft/>');
    expect(result.sessions).toHaveLength(0);
    await expect(page.locator('#savedIndicatorText')).toHaveText('Temporary · not saved');
  });

  test('receives a share in an already-open tab and flushes the outgoing item', async ({ page }) => {
    const id = await page.evaluate(async () => {
      const record = await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'Outgoing Mapping',
        source: { xml: '<before/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] },
      });
      await sessionController.restoreSession(record);
      return record.id;
    });
    await editor.fillXml('<pending-before-share/>');
    await page.evaluate(() => {
      clearTimeout(_saveTimer);
      _saveTimer = setTimeout(saveState, 60_000);
    });
    await page.evaluate(payload => { location.hash = `share/${encodeShareData(payload)}`; }, shared);
    await expect(page.locator('#incomingShareBackdrop')).toHaveClass(/open/);
    await expect(page).toHaveURL('http://localhost:8000/');
    expect(await editor.getXmlContent()).toBe('<pending-before-share/>');

    await page.getByRole('button', { name: 'Open temporarily' }).click();
    await expect.poll(() => editor.getXmlContent()).toBe(shared.xml);
    const outgoing = await page.evaluate(value => workspaceStore.getSession(value), id);
    expect(outgoing.source.xml).toBe('<pending-before-share/>');
    await expect(page.locator('#savedIndicatorText')).toHaveText('Temporary · not saved');
  });

  test('save a copy creates and continues updating a separate named session', async ({ page }) => {
    await openShare(page);
    await page.locator('#incomingShareTitleInput').fill('Partner Mapping');
    await page.getByRole('button', { name: 'Save a copy' }).click();
    await expect(page.locator('#incomingShareBackdrop')).not.toHaveClass(/open/);
    expect(await editor.getXmlContent()).toBe(shared.xml);

    let sessions = await page.evaluate(() => workspaceStore.listSessions({ type: 'xslt' }));
    expect(sessions).toHaveLength(1);
    expect(sessions[0].title).toBe('Partner Mapping');
    expect(sessions[0].source.xml).toBe(shared.xml);
    expect(sessions[0].source.headers).toMatchObject(shared.headers);

    await editor.fillXml('<saved-copy-edit/>');
    await page.waitForTimeout(1300);
    sessions = await page.evaluate(() => workspaceStore.listSessions({ type: 'xslt' }));
    expect(sessions).toHaveLength(1);
    expect(sessions[0].source.xml).toBe('<saved-copy-edit/>');
    expect(sessions[0].revision).toBeGreaterThan(1);

    const draft = await page.evaluate(() => workspaceStore.getDraft('draft-xslt'));
    expect(draft.source.xml).toBe('<recipient-draft/>');
  });

  test('shows a safe error for a corrupt link without changing the draft', async ({ page }) => {
    await page.goto('about:blank');
    await page.goto('http://localhost:8000/#share/not-valid!', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.monaco-editor');
    await expect(page.getByRole('dialog', { name: 'Shared link could not be opened' })).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL('http://localhost:8000/');
    await expect.poll(() => editor.getXmlContent()).toBe('<recipient-draft/>');
    expect((await page.evaluate(() => workspaceStore.getDraft('draft-xslt'))).source.xml).toBe('<recipient-draft/>');
  });

  test('stops decompression when the expanded payload exceeds its limit', async ({ page }) => {
    const message = await page.evaluate(() => {
      const compressed = pako.deflateRaw(new TextEncoder().encode(JSON.stringify({ xml: 'x'.repeat(2048) })));
      try { inflateShareJson(compressed, 128); return ''; }
      catch (error) { return error.message; }
    });
    expect(message).toContain('too large');
  });
});
