import { test, expect } from '@playwright/test';
import { EditorPage } from '../../utils/test-helpers.js';

test.describe('workspace ZIP backup', () => {
  test.beforeEach(async ({ page }) => {
    await new EditorPage(page).navigate();
    await page.evaluate(async () => {
      await workspaceStore.deleteDatabase();
      await workspaceStore.init();
      await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'Backup Mapping',
        source: { xml: '<backup/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] },
      });
      await refreshExplorer();
    });
  });

  test('exports, previews, and imports as a new copy', async ({ page }) => {
    const bytes = await page.evaluate(async () => [...new Uint8Array(await (await createWorkspaceBackupBlob()).arrayBuffer())]);
    await page.locator('#backupImportInput').setInputFiles({ name: 'workspace.zip', mimeType: 'application/zip', buffer: Buffer.from(bytes) });
    await expect(page.locator('#backupImportSummary')).toContainText('1 saved item');
    await page.getByRole('button', { name: 'Import as copies' }).click();
    await expect.poll(() => page.evaluate(async () => (await workspaceStore.listSessions()).length)).toBe(2);
    await expect(page.locator('.explorer-row-title')).toHaveCount(2);
    const records = await page.evaluate(() => workspaceStore.listSessions());
    expect(new Set(records.map(record => record.id)).size).toBe(2);
    expect(records.every(record => record.source.xml === '<backup/>')).toBe(true);
  });

  test('flushes a pending named-session edit before export', async ({ page }) => {
    const exportedXml = await page.evaluate(async () => {
      const record = (await workspaceStore.listSessions({ type: 'xslt' }))[0];
      await sessionController.restoreSession(record);
      _withSuppress(['save'], () => xmlModelXslt.setValue('<latest-before-backup/>'));
      scheduleSave();
      clearTimeout(_saveTimer);
      _saveTimer = setTimeout(saveState, 60_000);
      const blob = await createWorkspaceBackupBlob();
      const files = fflate.unzipSync(new Uint8Array(await blob.arrayBuffer()));
      const sessionPath = Object.keys(files).find(path => path.startsWith('sessions/'));
      return JSON.parse(new TextDecoder().decode(files[sessionPath])).source.xml;
    });
    expect(exportedXml).toBe('<latest-before-backup/>');
  });

  test('accepts its own highly compressible XML backup', async ({ page }) => {
    const result = await page.evaluate(async () => {
      await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'Repetitive XML',
        source: { xml: `<root>${'x'.repeat(2 * 1024 * 1024)}</root>`, xslt: '<xsl:stylesheet/>', headers: [], properties: [] },
      });
      const blob = await createWorkspaceBackupBlob();
      const validated = await validateWorkspaceBackup(await blob.arrayBuffer());
      return { sessions: validated.model.sessions.length, zipBytes: validated.zipBytes };
    });
    expect(result.sessions).toBe(2);
    expect(result.zipBytes).toBeLessThan(50_000);
  });

  test('rejects corrupt ZIP data without writing', async ({ page }) => {
    await page.locator('#backupImportInput').setInputFiles({
      name: 'corrupt.zip', mimeType: 'application/zip', buffer: Buffer.from('not a zip'),
    });
    await expect(page.locator('#backupImportError')).toBeVisible();
    expect(await page.evaluate(async () => (await workspaceStore.listSessions()).length)).toBe(1);
  });

  test('rejects oversized files before reading them into memory', async ({ page }) => {
    const readAttempted = await page.evaluate(async () => {
      window.__backupReadAttempted = false;
      await prepareWorkspaceBackupImport({
        size: BACKUP_MAX_ZIP_BYTES + 1,
        arrayBuffer() { window.__backupReadAttempted = true; return Promise.resolve(new ArrayBuffer(0)); },
      });
      return window.__backupReadAttempted;
    });
    expect(readAttempted).toBe(false);
    await expect(page.locator('#backupImportError')).toContainText('too large');
    expect(await page.evaluate(async () => (await workspaceStore.listSessions()).length)).toBe(1);
  });

  test('rejects future record schemas without writing', async ({ page }) => {
    const bytes = await page.evaluate(async () => {
      const files = {
        'workspaces/future.json': backupJsonBytes({ id: 'future', name: 'Future', schemaVersion: 2 }),
        'README.txt': new TextEncoder().encode('test'),
      };
      const entries = [];
      for (const path of Object.keys(files).sort()) entries.push({ path, bytes: files[path].byteLength, sha256: await backupSha256(files[path]) });
      files['xsltdebugx-backup.json'] = backupJsonBytes({ format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), counts: { workspaces: 1, folders: 0, sessions: 0 }, entries });
      return [...fflate.zipSync(files)];
    });
    await page.locator('#backupImportInput').setInputFiles({ name: 'future.zip', mimeType: 'application/zip', buffer: Buffer.from(bytes) });
    await expect(page.locator('#backupImportError')).toContainText('unsupported schema version');
    expect(await page.evaluate(async () => (await workspaceStore.listSessions()).length)).toBe(1);
  });

  test('rejects unsafe ZIP paths and checksum tampering without writing', async ({ page }) => {
    const unsafe = await page.evaluate(() => [...fflate.zipSync({ '../escape.json': new TextEncoder().encode('{}') })]);
    await page.locator('#backupImportInput').setInputFiles({ name: 'unsafe.zip', mimeType: 'application/zip', buffer: Buffer.from(unsafe) });
    await expect(page.locator('#backupImportError')).toContainText('Unsafe ZIP path');

    const tampered = await page.evaluate(async () => {
      const files = {
        'workspaces/a.json': backupJsonBytes({ id: 'a', name: 'A', schemaVersion: 1 }),
        'README.txt': new TextEncoder().encode('test'),
      };
      const entries = [];
      for (const path of Object.keys(files).sort()) entries.push({ path, bytes: files[path].byteLength, sha256: await backupSha256(files[path]) });
      entries[0].sha256 = '0'.repeat(64);
      files['xsltdebugx-backup.json'] = backupJsonBytes({ format: BACKUP_FORMAT, version: BACKUP_VERSION, counts: { workspaces: 1, folders: 0, sessions: 0 }, entries });
      return [...fflate.zipSync(files)];
    });
    await page.locator('#backupImportInput').setInputFiles({ name: 'tampered.zip', mimeType: 'application/zip', buffer: Buffer.from(tampered) });
    await expect(page.locator('#backupImportError')).toContainText('checksum mismatch');
    expect(await page.evaluate(async () => (await workspaceStore.listSessions()).length)).toBe(1);
  });

  test('rolls back the complete import transaction on write failure', async ({ page }) => {
    const bytes = await page.evaluate(async () => [...new Uint8Array(await (await createWorkspaceBackupBlob()).arrayBuffer())]);
    await page.locator('#backupImportInput').setInputFiles({ name: 'rollback.zip', mimeType: 'application/zip', buffer: Buffer.from(bytes) });
    await expect(page.locator('#backupImportSummary')).toContainText('1 saved item');
    await page.evaluate(() => workspaceStore.setFailureInjector(point => {
      if (point === 'importBackupCopies:beforeCommit') throw new Error('Simulated storage failure');
    }));
    await page.getByRole('button', { name: 'Import as copies' }).click();
    await expect(page.locator('#backupImportError')).toContainText('rolled back');
    expect(await page.evaluate(async () => (await workspaceStore.listSessions()).length)).toBe(1);
    await page.evaluate(() => workspaceStore.setFailureInjector(null));
  });

  test('roundtrips CPI, Standard XSLT, and XPath sources exactly', async ({ page }) => {
    await page.evaluate(async () => {
      await workspaceStore.createSession({
        type: 'xslt', workspaceId: 'workspace-default', title: 'Standard Unicode',
        source: { xml: '<root>こんにちは 🌍\n</root>', xslt: '<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">\n</xsl:stylesheet>', headers: [], properties: [], runtimeProfile: 'standard', runOptions: { indent: false } },
      });
      await workspaceStore.createSession({
        type: 'xpath', workspaceId: 'workspace-default', title: 'XPath Unicode',
        source: { xml: '<café id="α"/>', expression: 'string(/*/@id)', namespaces: { t: 'urn:test' }, evaluatorOptions: { mode: 'exact' } },
      });
    });
    const before = await page.evaluate(async () => (await workspaceStore.listSessions())
      .map(record => ({ title: record.title, type: record.type, source: record.source }))
      .sort((a, b) => a.title.localeCompare(b.title)));
    const bytes = await page.evaluate(async () => [...new Uint8Array(await (await createWorkspaceBackupBlob()).arrayBuffer())]);
    await page.locator('#backupImportInput').setInputFiles({ name: 'profiles.zip', mimeType: 'application/zip', buffer: Buffer.from(bytes) });
    await expect(page.locator('#backupImportSummary')).toContainText('3 saved items');
    await page.getByRole('button', { name: 'Import as copies' }).click();
    const after = await page.evaluate(async () => (await workspaceStore.listSessions())
      .map(record => ({ title: record.title, type: record.type, source: record.source }))
      .sort((a, b) => a.title.localeCompare(b.title)));
    expect(after).toEqual(before.flatMap(record => [record, record]).sort((a, b) => a.title.localeCompare(b.title)));
  });

  test('rejects cross-workspace folder references with zero writes', async ({ page }) => {
    const bytes = await page.evaluate(async () => {
      const files = {};
      const records = {
        'workspaces/a.json': { id: 'a', name: 'A' },
        'workspaces/b.json': { id: 'b', name: 'B' },
        'folders/f.json': { id: 'f', workspaceId: 'b', parentFolderId: null, name: 'B Folder' },
        'sessions/s.json': { id: 's', type: 'xslt', workspaceId: 'a', folderId: 'f', title: 'Invalid placement', source: { xml: '<x/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } },
      };
      for (const [path, record] of Object.entries(records)) files[path] = backupJsonBytes(record);
      files['README.txt'] = new TextEncoder().encode('test');
      const entries = [];
      for (const path of Object.keys(files).sort()) entries.push({ path, bytes: files[path].byteLength, sha256: await backupSha256(files[path]) });
      files['xsltdebugx-backup.json'] = backupJsonBytes({ format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), counts: { workspaces: 2, folders: 1, sessions: 1 }, entries });
      return [...fflate.zipSync(files)];
    });
    await page.locator('#backupImportInput').setInputFiles({ name: 'cross-workspace.zip', mimeType: 'application/zip', buffer: Buffer.from(bytes) });
    await expect(page.locator('#backupImportError')).toContainText('different workspace');
    expect(await page.evaluate(async () => (await workspaceStore.listSessions()).length)).toBe(1);
  });
});
