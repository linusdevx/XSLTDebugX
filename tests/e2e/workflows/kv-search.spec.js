import { test, expect } from '@playwright/test';
import { EditorPage } from '../../utils/test-helpers.js';

/**
 * KV Panel Search: filter rows in Headers / Properties / output Headers / output Properties
 * by substring match against name + value. View-only — does not mutate kvData or persistence.
 *
 * Search is an always-visible inline input in each panel header (mirrors the console search).
 */

test.describe('KV Panel Search', () => {
  let page;

  test.beforeEach(async ({ page: testPage }) => {
    page = new EditorPage(testPage);
    try {
      await page.navigate();
    } catch (err) {
      test.skip();
      return;
    }
    await testPage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.switchToXslt();
  });

  test('search input is always visible in the header bar', async ({ page: testPage }) => {
    await expect(testPage.locator('#hdrPanelSearch')).toBeVisible();
    await expect(testPage.locator('#propPanelSearch')).toBeVisible();
  });

  test('filters rows by substring match against the name column', async ({ page: testPage }) => {
    await page.addHeader('Authorization', 'Bearer token');
    await page.addHeader('X-Source-System', 'SAP');
    await page.addHeader('X-Environment', 'prod');

    await testPage.fill('#hdrPanelSearch', 'auth');

    const wrappers = testPage.locator('#hdrRows .kv-row-wrapper');
    await expect(wrappers).toHaveCount(3);
    // Only the Authorization row should remain visible
    await expect(wrappers.nth(0)).not.toHaveClass(/kv-hidden/);
    await expect(wrappers.nth(1)).toHaveClass(/kv-hidden/);
    await expect(wrappers.nth(2)).toHaveClass(/kv-hidden/);
  });

  test('filters rows by substring match against the value column', async ({ page: testPage }) => {
    await page.addHeader('Authorization', 'Bearer token');
    await page.addHeader('X-Source-System', 'SAP');
    await page.addHeader('X-Environment', 'prod');

    await testPage.fill('#hdrPanelSearch', 'sap');

    const wrappers = testPage.locator('#hdrRows .kv-row-wrapper');
    await expect(wrappers.nth(0)).toHaveClass(/kv-hidden/);          // Authorization
    await expect(wrappers.nth(1)).not.toHaveClass(/kv-hidden/);      // X-Source-System=SAP
    await expect(wrappers.nth(2)).toHaveClass(/kv-hidden/);          // X-Environment=prod
  });

  test('clearing the input restores all rows', async ({ page: testPage }) => {
    await page.addHeader('Authorization', 'Bearer token');
    await page.addHeader('X-Source-System', 'SAP');

    await testPage.fill('#hdrPanelSearch', 'nope');

    const wrappers = testPage.locator('#hdrRows .kv-row-wrapper');
    await expect(wrappers.nth(0)).toHaveClass(/kv-hidden/);
    await expect(wrappers.nth(1)).toHaveClass(/kv-hidden/);
    await expect(testPage.locator('#hdrRows .kv-no-matches')).toBeVisible();

    await testPage.fill('#hdrPanelSearch', '');

    await expect(wrappers.nth(0)).not.toHaveClass(/kv-hidden/);
    await expect(wrappers.nth(1)).not.toHaveClass(/kv-hidden/);
    await expect(testPage.locator('#hdrRows .kv-no-matches')).toHaveCount(0);
  });

  test('shows a "No matches" line when query matches nothing', async ({ page: testPage }) => {
    await page.addHeader('Authorization', 'Bearer token');

    await testPage.fill('#hdrPanelSearch', 'xxxxx');

    await expect(testPage.locator('#hdrRows .kv-no-matches')).toHaveText('No matches');
  });

  test('keeps filter active across adding a new row', async ({ page: testPage }) => {
    await page.addHeader('Authorization', 'Bearer token');

    await testPage.fill('#hdrPanelSearch', 'auth');

    // Add a brand-new empty row — re-render should preserve filter
    await testPage.click('#hdrPanel button.kv-add-btn');

    const wrappers = testPage.locator('#hdrRows .kv-row-wrapper');
    await expect(wrappers).toHaveCount(2);
    await expect(wrappers.nth(0)).not.toHaveClass(/kv-hidden/);   // Authorization still visible
    await expect(wrappers.nth(1)).toHaveClass(/kv-hidden/);       // empty row hidden by 'auth' query
  });

  test('keeps filter active across deleting a matching row', async ({ page: testPage }) => {
    await page.addHeader('Authorization', 'Bearer token');
    await page.addHeader('X-Source-System', 'SAP');

    await testPage.fill('#hdrPanelSearch', 'auth');

    // Delete the visible (matching) Authorization row at index 0.
    // The non-matching row at index 1 has display:none and cannot be clicked —
    // that is correct UX: hidden rows are not interactable.
    await testPage.locator('#hdrRows .kv-row-wrapper').nth(0).locator('button.kv-del-btn').click();

    const wrappers = testPage.locator('#hdrRows .kv-row-wrapper');
    await expect(wrappers).toHaveCount(1);
    // The remaining row (X-Source-System) doesn't match 'auth' — filter must still be applied
    await expect(wrappers.nth(0)).toHaveClass(/kv-hidden/);
    // No-matches indicator should appear since every remaining row is filtered out
    await expect(testPage.locator('#hdrRows .kv-no-matches')).toBeVisible();
  });

  test('clicking the search input does not collapse the panel', async ({ page: testPage }) => {
    await page.addHeader('Authorization', 'Bearer token');
    const panel = testPage.locator('#hdrPanel');

    await expect(panel).not.toHaveClass(/collapsed/);
    await testPage.click('#hdrPanelSearch');
    await expect(panel).not.toHaveClass(/collapsed/);

    await testPage.fill('#hdrPanelSearch', 'auth');
    await expect(panel).not.toHaveClass(/collapsed/);
  });

  test('does not mutate kvData (persistence unchanged)', async ({ page: testPage }) => {
    await page.addHeader('Authorization', 'Bearer token');
    await page.addHeader('X-Source-System', 'SAP');

    await testPage.fill('#hdrPanelSearch', 'auth');

    const session = await page.getStoredSession();
    expect(session.headers.length).toBe(2);
    expect(session.headers[0].name).toBe('Authorization');
    expect(session.headers[1].name).toBe('X-Source-System');
  });

  test('search input shows active state when query is non-empty', async ({ page: testPage }) => {
    await page.addHeader('Authorization', 'Bearer token');

    const input = testPage.locator('#hdrPanelSearch');
    await expect(input).not.toHaveClass(/kv-search-active/);

    await testPage.fill('#hdrPanelSearch', 'auth');
    await expect(input).toHaveClass(/kv-search-active/);

    await testPage.fill('#hdrPanelSearch', '');
    await expect(input).not.toHaveClass(/kv-search-active/);
  });

  test('Properties panel filter works the same way', async ({ page: testPage }) => {
    await page.addProperty('ProcessingMode', 'ASYNC');
    await page.addProperty('Region', 'EU');

    await testPage.fill('#propPanelSearch', 'async');

    const wrappers = testPage.locator('#propRows .kv-row-wrapper');
    await expect(wrappers.nth(0)).not.toHaveClass(/kv-hidden/);
    await expect(wrappers.nth(1)).toHaveClass(/kv-hidden/);
  });

  test('filters output Headers panel after a transform sets multiple headers', async ({ page: testPage }) => {
    // Minimal transform that sets three output headers via cpi:setHeader.
    // CPI's runtime convention is cpi:setHeader($exchange, name, value) — the first
    // arg is the Camel exchange context. The local handler in transform.js mirrors
    // that signature, so we follow it here (matches js/examples-data.js usage).
    const xml = '<r/>';
    const xslt = `<?xml version="1.0"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cpi="http://sap.com/it/">
  <xsl:param name="exchange"/>
  <xsl:template match="/">
    <xsl:value-of select="cpi:setHeader($exchange, 'X-Auth',   'token-123')"/>
    <xsl:value-of select="cpi:setHeader($exchange, 'X-Source', 'SAP')"/>
    <xsl:value-of select="cpi:setHeader($exchange, 'X-Env',    'prod')"/>
    <out/>
  </xsl:template>
</xsl:stylesheet>`;

    await page.fillXml(xml);
    await page.fillXslt(xslt);
    await page.clickRun();

    // Wait for output panel to populate
    await expect(testPage.locator('#outHdrRows .kv-row-out')).toHaveCount(3);

    await testPage.fill('#outHdrPanelSearch', 'auth');

    const rows = testPage.locator('#outHdrRows .kv-row-out');
    await expect(rows.nth(0)).not.toHaveClass(/kv-hidden/);   // X-Auth
    await expect(rows.nth(1)).toHaveClass(/kv-hidden/);       // X-Source
    await expect(rows.nth(2)).toHaveClass(/kv-hidden/);       // X-Env

    // Filter by value column
    await testPage.fill('#outHdrPanelSearch', 'sap');
    await expect(rows.nth(0)).toHaveClass(/kv-hidden/);       // X-Auth=token-123
    await expect(rows.nth(1)).not.toHaveClass(/kv-hidden/);   // X-Source=SAP
    await expect(rows.nth(2)).toHaveClass(/kv-hidden/);       // X-Env=prod
  });
});
