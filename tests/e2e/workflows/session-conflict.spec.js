import { test, expect } from '@playwright/test';
import { EditorPage } from '../../utils/test-helpers.js';

test('two-tab conflict preserves the second editor as a new copy', async ({ page, context }) => {
  const first = new EditorPage(page);
  await first.navigate();
  await page.evaluate(async () => {
    await workspaceStore.deleteDatabase();
    await workspaceStore.init();
    const record = await workspaceStore.createSession({
      type: 'xslt', workspaceId: 'workspace-default', title: 'Concurrent Mapping',
      source: { xml: '<initial/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] },
    });
    await sessionController.restoreSession(record);
  });

  const secondPage = await context.newPage();
  const second = new EditorPage(secondPage);
  await second.navigate();
  await expect(secondPage.locator('#currentItemTitle')).toHaveText('Concurrent Mapping');

  await first.fillXml('<from-first-tab/>');
  await page.waitForTimeout(1300);
  await second.fillXml('<from-second-tab/>');

  const conflict = secondPage.locator('#sessionConflictBackdrop');
  await expect(conflict).toHaveClass(/open/, { timeout: 5000 });
  await expect(secondPage.locator('#savedIndicatorText')).toHaveText('Save conflict');
  expect(await second.getXmlContent()).toBe('<from-second-tab/>');

  await secondPage.locator('#sessionConflictCopyTitle').fill('Concurrent Mapping — Second Tab');
  await secondPage.getByRole('button', { name: 'Save as copy' }).click();
  await expect(conflict).not.toHaveClass(/open/);
  await expect(secondPage.locator('#currentItemTitle')).toHaveText('Concurrent Mapping — Second Tab');

  const sessions = await secondPage.evaluate(() => workspaceStore.listSessions({ type: 'xslt' }));
  expect(sessions).toHaveLength(2);
  expect(sessions.find(item => item.title === 'Concurrent Mapping').source.xml).toBe('<from-first-tab/>');
  expect(sessions.find(item => item.title === 'Concurrent Mapping — Second Tab').source.xml).toBe('<from-second-tab/>');
  await secondPage.close();
});
