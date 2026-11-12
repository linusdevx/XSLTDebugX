import { test, expect } from '@playwright/test';
import { EditorPage } from '../../utils/test-helpers.js';

test.describe('Workspace storage foundation', () => {
  test.beforeEach(async ({ page }) => {
    const editor = new EditorPage(page);
    await editor.navigate();
    await page.evaluate(async () => {
      await window.workspaceStore.deleteDatabase();
      await window.workspaceStore.init();
    });
  });

  test('creates the versioned schema and an empty default workspace', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const workspaces = await workspaceStore.listWorkspaces();
      const sessions = await workspaceStore.listSessions();
      return {
        metadata: window.XSLTDebugXWorkspace,
        workspaces,
        sessions,
      };
    });

    expect(result.metadata.databaseName).toBe('xsltdebugx-workspace');
    expect(result.metadata.databaseVersion).toBe(1);
    expect(result.metadata.storeNames).toEqual([
      'workspaces',
      'folders',
      'sessions',
      'drafts',
      'trash',
      'settings',
    ]);
    expect(result.workspaces).toHaveLength(1);
    expect(result.workspaces[0].name).toBe('My Workspace');
    expect(result.sessions).toEqual([]);
  });

  test('starts fresh without importing or deleting legacy localStorage', async ({ page }) => {
    const legacy = JSON.stringify({
      xmlXslt: '<legacy/>',
      xslt: '<xsl:stylesheet version="3.0"/>',
      xpathExpr: '//legacy',
    });

    const result = await page.evaluate(async value => {
      localStorage.setItem('xdebugx-session-v1', value);
      await workspaceStore.deleteDatabase();
      await workspaceStore.init();
      return {
        legacy: localStorage.getItem('xdebugx-session-v1'),
        sessions: await workspaceStore.listSessions(),
      };
    }, legacy);

    expect(result.legacy).toBe(legacy);
    expect(result.sessions).toEqual([]);
  });

  test('stores a complete XSLT session and preserves ordered CPI inputs', async ({ page }) => {
    const session = await page.evaluate(async () => workspaceStore.createSession({
      type: 'xslt',
      workspaceId: XSLTDebugXWorkspace.defaultWorkspaceId,
      title: 'Sales Order Mapping',
      source: {
        xml: '<Order/>',
        xslt: '<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"/>',
        headers: [
          { name: 'source', value: 'WEBSHOP' },
          { name: '', value: '' },
        ],
        properties: [
          { name: 'environment', value: 'PROD' },
          { name: 'environment', value: 'OVERRIDE' },
        ],
        runOptions: {},
        output: '<must-not-persist/>',
      },
      favorite: false,
    }));

    expect(session.type).toBe('xslt');
    expect(session.revision).toBe(1);
    expect(session.source.headers.map(row => [row.name, row.value])).toEqual([
      ['source', 'WEBSHOP'],
      ['', ''],
    ]);
    expect(session.source.properties.map(row => [row.name, row.value])).toEqual([
      ['environment', 'PROD'],
      ['environment', 'OVERRIDE'],
    ]);
    expect(session.source.output).toBeUndefined();
  });

  test('stores XPath independently from XSLT sessions', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const xslt = await workspaceStore.createSession({
        type: 'xslt',
        workspaceId: XSLTDebugXWorkspace.defaultWorkspaceId,
        title: 'Mapping',
        source: { xml: '<xslt/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] },
      });
      const xpath = await workspaceStore.createSession({
        type: 'xpath',
        workspaceId: XSLTDebugXWorkspace.defaultWorkspaceId,
        title: 'Query',
        source: { xml: '<xpath/>', expression: '//xpath' },
      });
      return {
        xslt,
        xpath,
        xpathOnly: await workspaceStore.listSessions({ type: 'xpath' }),
      };
    });

    expect(result.xpath.id).not.toBe(result.xslt.id);
    expect(result.xpath.source.xml).toBe('<xpath/>');
    expect(result.xpath.source.expression).toBe('//xpath');
    expect(result.xpath.source.xslt).toBeUndefined();
    expect(result.xpathOnly.map(item => item.id)).toEqual([result.xpath.id]);
  });

  test('supports folders, duplication, favorites, and revision checks', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const folder = await workspaceStore.createFolder({
        workspaceId: XSLTDebugXWorkspace.defaultWorkspaceId,
        name: 'Integrations',
      });
      const original = await workspaceStore.createSession({
        type: 'xpath',
        workspaceId: XSLTDebugXWorkspace.defaultWorkspaceId,
        folderId: folder.id,
        title: 'Active Items',
        source: { xml: '<Items/>', expression: '//Item[@active="true"]' },
      });
      const favorite = await workspaceStore.updateSession(original.id, original.revision, {
        favorite: true,
      });
      const duplicate = await workspaceStore.duplicateSession(original.id, 'Active Items Copy');
      let conflictCode = null;
      try {
        await workspaceStore.updateSession(original.id, original.revision, { title: 'Stale edit' });
      } catch (error) {
        conflictCode = error.code;
      }
      return {
        folder,
        folders: await workspaceStore.listFolders(XSLTDebugXWorkspace.defaultWorkspaceId),
        favorite,
        duplicate,
        favorites: await workspaceStore.listSessions({ favorite: true }),
        conflictCode,
      };
    });

    expect(result.folders.map(folder => folder.id)).toContain(result.folder.id);
    expect(result.favorite.favorite).toBe(true);
    expect(result.favorite.revision).toBe(2);
    expect(result.duplicate.id).not.toBe(result.favorite.id);
    expect(result.duplicate.source).toEqual(result.favorite.source);
    expect(result.favorites.map(item => item.id)).toEqual([result.favorite.id]);
    expect(result.conflictCode).toBe('CONFLICT');
  });

  test('moves sessions to trash and restores them atomically', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const session = await workspaceStore.createSession({
        type: 'xslt',
        workspaceId: XSLTDebugXWorkspace.defaultWorkspaceId,
        title: 'Recover Me',
        source: { xml: '<a/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] },
      });
      const trashItem = await workspaceStore.moveSessionToTrash(session.id, session.revision);
      const afterDelete = await workspaceStore.getSession(session.id);
      const restored = await workspaceStore.restoreTrashItem(trashItem.id);
      return {
        session,
        trashItem,
        afterDelete,
        restored,
        trash: await workspaceStore.listTrash(),
      };
    });

    expect(result.afterDelete).toBeNull();
    expect(result.trashItem.snapshot.id).toBe(result.session.id);
    expect(result.restored.id).toBe(result.session.id);
    expect(result.restored.revision).toBe(2);
    expect(result.trash).toEqual([]);
  });

  test('rejects invalid types and cross-workspace folder references', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const other = await workspaceStore.createWorkspace('Other');
      const folder = await workspaceStore.createFolder({
        workspaceId: other.id,
        name: 'Other Folder',
      });
      const errors = [];
      try {
        await workspaceStore.createSession({
          type: 'invalid',
          workspaceId: XSLTDebugXWorkspace.defaultWorkspaceId,
          title: 'Bad type',
          source: {},
        });
      } catch (error) {
        errors.push(error.code);
      }
      try {
        await workspaceStore.createSession({
          type: 'xpath',
          workspaceId: XSLTDebugXWorkspace.defaultWorkspaceId,
          folderId: folder.id,
          title: 'Wrong folder',
          source: { xml: '', expression: '' },
        });
      } catch (error) {
        errors.push(error.code);
      }
      return errors;
    });

    expect(result).toEqual(['VALIDATION', 'VALIDATION']);
  });

  test('aborted autosave keeps the prior draft and reports failure until retry', async ({ page }) => {
    await page.evaluate(async () => {
      await workspaceStore.putDraft({ id: 'draft-xslt', type: 'xslt', source: { xml: '<before/>', xslt: '<xsl:stylesheet/>', headers: [], properties: [] } });
      workspaceStore.setFailureInjector(point => {
        if (point === 'putDraft:beforeCommit') throw new Error('Simulated quota failure');
      });
      xmlModelXslt.setValue('<failed-write/>');
    });
    await expect(page.locator('#savedIndicatorText')).toHaveText('Save failed', { timeout: 5000 });
    expect((await page.evaluate(() => workspaceStore.getDraft('draft-xslt'))).source.xml).toBe('<before/>');

    await page.evaluate(() => workspaceStore.setFailureInjector(null));
    await page.evaluate(() => xmlModelXslt.setValue('<retry-succeeds/>'));
    await expect(page.locator('#savedIndicatorText')).toHaveText('Saved locally', { timeout: 5000 });
    expect((await page.evaluate(() => workspaceStore.getDraft('draft-xslt'))).source.xml).toBe('<retry-succeeds/>');
  });

  test('caps folder nesting at twenty levels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      let parentFolderId = null;
      for (let depth = 1; depth <= 20; depth++) {
        const folder = await workspaceStore.createFolder({ workspaceId: 'workspace-default', parentFolderId, name: `Level ${depth}` });
        parentFolderId = folder.id;
      }
      try {
        await workspaceStore.createFolder({ workspaceId: 'workspace-default', parentFolderId, name: 'Too Deep' });
        return { code: null, count: (await workspaceStore.listFolders('workspace-default')).length };
      } catch (error) {
        return { code: error.code, count: (await workspaceStore.listFolders('workspace-default')).length };
      }
    });
    expect(result).toEqual({ code: 'VALIDATION', count: 20 });
  });
});
