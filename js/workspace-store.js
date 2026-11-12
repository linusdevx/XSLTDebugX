// Local-first workspace persistence. This layer is intentionally independent
// from the legacy playground autosave; fresh workspace installs do not import
// or delete xdebugx-session-v1.

(function () {
  'use strict';

  const DATABASE_NAME = 'xsltdebugx-workspace';
  const DATABASE_VERSION = 1;
  const RECORD_SCHEMA_VERSION = 1;
  const DEFAULT_WORKSPACE_ID = 'workspace-default';
  const MAX_TEXT_BYTES = 25 * 1024 * 1024;
  const MAX_TITLE_LENGTH = 160;
  const MAX_NAME_LENGTH = 120;
  const MAX_FOLDER_DEPTH = 20;

  const STORE_NAMES = Object.freeze([
    'workspaces',
    'folders',
    'sessions',
    'drafts',
    'trash',
    'settings',
  ]);

  class WorkspaceStoreError extends Error {
    constructor(code, message, cause) {
      super(message, cause ? { cause } : undefined);
      this.name = 'WorkspaceStoreError';
      this.code = code;
    }
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
  }

  function transactionToPromise(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    });
  }

  function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function randomId(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function utf8ByteLength(value) {
    return new TextEncoder().encode(value).byteLength;
  }

  function requireObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new WorkspaceStoreError('VALIDATION', `${label} must be an object.`);
    }
    return value;
  }

  function requireString(value, label, options = {}) {
    const { allowEmpty = false, maxLength = null, maxBytes = null } = options;
    if (typeof value !== 'string') {
      throw new WorkspaceStoreError('VALIDATION', `${label} must be a string.`);
    }
    if (!allowEmpty && !value.trim()) {
      throw new WorkspaceStoreError('VALIDATION', `${label} cannot be empty.`);
    }
    if (maxLength != null && [...value].length > maxLength) {
      throw new WorkspaceStoreError('VALIDATION', `${label} is too long.`);
    }
    if (maxBytes != null && utf8ByteLength(value) > maxBytes) {
      throw new WorkspaceStoreError('VALIDATION', `${label} exceeds the ${maxBytes}-byte limit.`);
    }
    if (/\u0000/.test(value)) {
      throw new WorkspaceStoreError('VALIDATION', `${label} contains unsupported control characters.`);
    }
    return value;
  }

  function normalizeName(value, label, maxLength) {
    const name = requireString(value, label, { maxLength }).trim();
    if (/[\u0000-\u001f\u007f]/.test(name)) {
      throw new WorkspaceStoreError('VALIDATION', `${label} contains unsupported control characters.`);
    }
    return name;
  }

  function normalizeRows(value, label) {
    if (!Array.isArray(value)) {
      throw new WorkspaceStoreError('VALIDATION', `${label} must be an array.`);
    }
    if (value.length > 10_000) {
      throw new WorkspaceStoreError('VALIDATION', `${label} contains too many rows.`);
    }
    return value.map((row, index) => {
      requireObject(row, `${label}[${index}]`);
      return {
        id: typeof row.id === 'string' && row.id ? row.id : randomId('row'),
        name: requireString(row.name ?? '', `${label}[${index}].name`, {
          allowEmpty: true,
          maxLength: 128,
        }),
        value: requireString(row.value ?? '', `${label}[${index}].value`, {
          allowEmpty: true,
          maxBytes: MAX_TEXT_BYTES,
        }),
      };
    });
  }

  function normalizeSource(type, value) {
    const source = requireObject(value, 'Session source');
    if (type === 'xslt') {
      return {
        xml: requireString(source.xml ?? '', 'XML source', {
          allowEmpty: true,
          maxBytes: MAX_TEXT_BYTES,
        }),
        xslt: requireString(source.xslt ?? '', 'XSLT source', {
          allowEmpty: true,
          maxBytes: MAX_TEXT_BYTES,
        }),
        headers: normalizeRows(source.headers ?? [], 'Headers'),
        properties: normalizeRows(source.properties ?? [], 'Properties'),
        runtimeProfile: source.runtimeProfile === 'standard' ? 'standard' : 'cpi',
        runOptions: source.runOptions && typeof source.runOptions === 'object'
          ? clone(source.runOptions)
          : {},
      };
    }
    if (type === 'xpath') {
      return {
        xml: requireString(source.xml ?? '', 'XML source', {
          allowEmpty: true,
          maxBytes: MAX_TEXT_BYTES,
        }),
        expression: requireString(source.expression ?? '', 'XPath expression', {
          allowEmpty: true,
          maxBytes: MAX_TEXT_BYTES,
        }),
        namespaces: source.namespaces && typeof source.namespaces === 'object'
          ? clone(source.namespaces)
          : {},
        evaluatorOptions: source.evaluatorOptions && typeof source.evaluatorOptions === 'object'
          ? clone(source.evaluatorOptions)
          : {},
      };
    }
    throw new WorkspaceStoreError('VALIDATION', 'Session type must be xslt or xpath.');
  }

  function normalizeSessionInput(input) {
    requireObject(input, 'Session');
    const type = input.type;
    if (type !== 'xslt' && type !== 'xpath') {
      throw new WorkspaceStoreError('VALIDATION', 'Session type must be xslt or xpath.');
    }
    return {
      type,
      workspaceId: requireString(input.workspaceId, 'Workspace ID'),
      folderId: input.folderId == null ? null : requireString(input.folderId, 'Folder ID'),
      title: normalizeName(input.title, 'Session title', MAX_TITLE_LENGTH),
      source: normalizeSource(type, input.source),
      favorite: Boolean(input.favorite),
    };
  }

  function createSchema(database) {
    if (!database.objectStoreNames.contains('workspaces')) {
      const store = database.createObjectStore('workspaces', { keyPath: 'id' });
      store.createIndex('byUpdatedAt', 'updatedAt');
    }
    if (!database.objectStoreNames.contains('folders')) {
      const store = database.createObjectStore('folders', { keyPath: 'id' });
      store.createIndex('byWorkspace', 'workspaceId');
      store.createIndex('byParent', ['workspaceId', 'parentFolderId']);
    }
    if (!database.objectStoreNames.contains('sessions')) {
      const store = database.createObjectStore('sessions', { keyPath: 'id' });
      store.createIndex('byWorkspace', 'workspaceId');
      store.createIndex('byFolder', ['workspaceId', 'folderId']);
      store.createIndex('byType', 'type');
      store.createIndex('byUpdatedAt', 'updatedAt');
      store.createIndex('byLastOpenedAt', 'lastOpenedAt');
      store.createIndex('byFavorite', 'favorite');
    }
    if (!database.objectStoreNames.contains('drafts')) {
      const store = database.createObjectStore('drafts', { keyPath: 'id' });
      store.createIndex('byType', 'type');
      store.createIndex('byUpdatedAt', 'updatedAt');
    }
    if (!database.objectStoreNames.contains('trash')) {
      const store = database.createObjectStore('trash', { keyPath: 'id' });
      store.createIndex('byDeletedAt', 'deletedAt');
      store.createIndex('byRecordType', 'recordType');
    }
    if (!database.objectStoreNames.contains('settings')) {
      database.createObjectStore('settings', { keyPath: 'key' });
    }
  }

  class WorkspaceStore {
    constructor(options = {}) {
      this.db = null;
      this.openPromise = null;
      this.storageBlocked = false;
      this.failureInjector = options.failureInjector || null;
      this.changeChannel = typeof BroadcastChannel === 'function'
        ? new BroadcastChannel('xsltdebugx-workspace-changes')
        : null;
      if (this.changeChannel) {
        this.changeChannel.onmessage = event => window.dispatchEvent(new CustomEvent('workspace-store-change', {
          detail: event.data,
        }));
      }
    }

    _notify(kind, id = null, details = {}) {
      this.changeChannel?.postMessage({ kind, id, at: Date.now(), ...details });
    }

    setFailureInjector(injector = null) {
      this.failureInjector = typeof injector === 'function' ? injector : null;
    }

    _injectFailure(point, transaction, done) {
      if (!this.failureInjector) return;
      try {
        this.failureInjector(point);
      } catch (cause) {
        try { transaction.abort(); } catch (_) {}
        void done.catch(() => {});
        throw new WorkspaceStoreError('INJECTED_FAILURE', `Injected storage failure at ${point}.`, cause);
      }
    }

    async init() {
      if (this.db) return this;
      if (this.openPromise) return this.openPromise;
      this.openPromise = this._open().finally(() => { this.openPromise = null; });
      return this.openPromise;
    }

    async _open() {
      if (!globalThis.indexedDB) {
        throw new WorkspaceStoreError('UNAVAILABLE', 'IndexedDB is unavailable in this browser.');
      }
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => createSchema(request.result);
      request.onblocked = () => {
        this.storageBlocked = true;
        console.warn('XSLTDebugX workspace database upgrade is blocked by another tab.');
        window.dispatchEvent(new CustomEvent('workspace-storage-blocked'));
      };
      try {
        this.db = await requestToPromise(request);
        this.storageBlocked = false;
      } catch (error) {
        throw new WorkspaceStoreError('OPEN_FAILED', 'Workspace storage could not be opened.', error);
      }
      this.db.onversionchange = () => {
        this.db?.close();
        this.db = null;
      };
      this.db.onclose = () => { this.db = null; };
      await this.ensureDefaultWorkspace();
      return this;
    }

    async _ready() {
      await this.init();
      if (!this.db) throw new WorkspaceStoreError('UNAVAILABLE', 'Workspace storage is unavailable.');
      return this.db;
    }

    async ensureDefaultWorkspace() {
      if (!this.db) return null;
      const transaction = this.db.transaction('workspaces', 'readwrite');
      const done = transactionToPromise(transaction);
      const store = transaction.objectStore('workspaces');
      let workspace = await requestToPromise(store.get(DEFAULT_WORKSPACE_ID));
      if (!workspace) {
        const timestamp = nowIso();
        workspace = {
          id: DEFAULT_WORKSPACE_ID,
          name: 'My Workspace',
          createdAt: timestamp,
          updatedAt: timestamp,
          revision: 1,
          schemaVersion: RECORD_SCHEMA_VERSION,
        };
        store.add(workspace);
      }
      await done;
      return clone(workspace);
    }

    async createWorkspace(name) {
      const db = await this._ready();
      const timestamp = nowIso();
      const record = {
        id: randomId('workspace'),
        name: normalizeName(name, 'Workspace name', MAX_NAME_LENGTH),
        createdAt: timestamp,
        updatedAt: timestamp,
        revision: 1,
        schemaVersion: RECORD_SCHEMA_VERSION,
      };
      const transaction = db.transaction('workspaces', 'readwrite');
      const done = transactionToPromise(transaction);
      transaction.objectStore('workspaces').add(record);
      await done;
      this._notify('workspace-created', record.id);
      return clone(record);
    }

    async updateWorkspace(id, expectedRevision, changes) {
      requireObject(changes, 'Workspace changes');
      const db = await this._ready();
      const transaction = db.transaction('workspaces', 'readwrite');
      const done = transactionToPromise(transaction);
      const store = transaction.objectStore('workspaces');
      const record = await requestToPromise(store.get(requireString(id, 'Workspace ID')));
      if (!record) throw new WorkspaceStoreError('NOT_FOUND', 'Workspace was not found.');
      if (record.revision !== expectedRevision) throw new WorkspaceStoreError('CONFLICT', 'This workspace was changed in another tab.');
      const next = {
        ...record,
        name: changes.name === undefined ? record.name : normalizeName(changes.name, 'Workspace name', MAX_NAME_LENGTH),
        updatedAt: nowIso(),
        revision: record.revision + 1,
      };
      store.put(next);
      await done;
      this._notify('workspace-updated', next.id);
      return clone(next);
    }

    async listWorkspaces() {
      const db = await this._ready();
      const records = await requestToPromise(
        db.transaction('workspaces', 'readonly').objectStore('workspaces').getAll(),
      );
      return records.sort((a, b) => a.name.localeCompare(b.name)).map(clone);
    }

    async createFolder(input) {
      requireObject(input, 'Folder');
      const db = await this._ready();
      const workspaceId = requireString(input.workspaceId, 'Workspace ID');
      const parentFolderId = input.parentFolderId == null
        ? null
        : requireString(input.parentFolderId, 'Parent folder ID');
      const transaction = db.transaction(['workspaces', 'folders'], 'readwrite');
      const done = transactionToPromise(transaction);
      const workspace = await requestToPromise(transaction.objectStore('workspaces').get(workspaceId));
      if (!workspace) {
        throw new WorkspaceStoreError('NOT_FOUND', 'Workspace was not found.');
      }
      if (parentFolderId) {
        const folders = transaction.objectStore('folders');
        const seen = new Set();
        let parent = await requestToPromise(folders.get(parentFolderId));
        if (!parent) throw new WorkspaceStoreError('VALIDATION', 'Parent folder is not in this workspace.');
        let depth = 1;
        while (parent) {
          if (parent.workspaceId !== workspaceId) throw new WorkspaceStoreError('VALIDATION', 'Parent folder is not in this workspace.');
          if (seen.has(parent.id)) throw new WorkspaceStoreError('VALIDATION', 'Existing folder hierarchy contains a cycle.');
          seen.add(parent.id);
          depth += 1;
          if (depth > MAX_FOLDER_DEPTH) throw new WorkspaceStoreError('VALIDATION', `Folders may be nested at most ${MAX_FOLDER_DEPTH} levels.`);
          parent = parent.parentFolderId ? await requestToPromise(folders.get(parent.parentFolderId)) : null;
        }
      }
      const timestamp = nowIso();
      const record = {
        id: randomId('folder'),
        workspaceId,
        parentFolderId,
        name: normalizeName(input.name, 'Folder name', MAX_NAME_LENGTH),
        order: Number.isFinite(input.order) ? Number(input.order) : 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        revision: 1,
        schemaVersion: RECORD_SCHEMA_VERSION,
      };
      transaction.objectStore('folders').add(record);
      await done;
      this._notify('folder-created', record.id);
      return clone(record);
    }

    async listFolders(workspaceId) {
      const db = await this._ready();
      const id = requireString(workspaceId, 'Workspace ID');
      const transaction = db.transaction('folders', 'readonly');
      const records = await requestToPromise(
        transaction.objectStore('folders').index('byWorkspace').getAll(id),
      );
      return records.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map(clone);
    }

    async updateFolder(id, expectedRevision, changes) {
      requireObject(changes, 'Folder changes');
      const db = await this._ready();
      const transaction = db.transaction('folders', 'readwrite');
      const done = transactionToPromise(transaction);
      const store = transaction.objectStore('folders');
      const record = await requestToPromise(store.get(requireString(id, 'Folder ID')));
      if (!record) throw new WorkspaceStoreError('NOT_FOUND', 'Folder was not found.');
      if (record.revision !== expectedRevision) {
        throw new WorkspaceStoreError('CONFLICT', 'This folder was changed in another tab.');
      }
      const parentFolderId = changes.parentFolderId === undefined
        ? record.parentFolderId
        : changes.parentFolderId == null ? null : requireString(changes.parentFolderId, 'Parent folder ID');
      if (parentFolderId === record.id) throw new WorkspaceStoreError('VALIDATION', 'A folder cannot contain itself.');
      if (parentFolderId) {
        let parent = await requestToPromise(store.get(parentFolderId));
        if (!parent || parent.workspaceId !== record.workspaceId) {
          throw new WorkspaceStoreError('VALIDATION', 'Parent folder is not in this workspace.');
        }
        const seen = new Set();
        let depth = 1;
        while (parent) {
          if (parent.id === record.id) throw new WorkspaceStoreError('VALIDATION', 'Folder nesting would create a cycle.');
          if (seen.has(parent.id)) throw new WorkspaceStoreError('VALIDATION', 'Existing folder hierarchy contains a cycle.');
          seen.add(parent.id);
          depth += 1;
          if (depth > MAX_FOLDER_DEPTH) throw new WorkspaceStoreError('VALIDATION', `Folders may be nested at most ${MAX_FOLDER_DEPTH} levels.`);
          parent = parent.parentFolderId ? await requestToPromise(store.get(parent.parentFolderId)) : null;
        }
      }
      const next = {
        ...record,
        name: changes.name === undefined ? record.name : normalizeName(changes.name, 'Folder name', MAX_NAME_LENGTH),
        parentFolderId,
        order: Number.isFinite(changes.order) ? Number(changes.order) : record.order,
        updatedAt: nowIso(),
        revision: record.revision + 1,
      };
      store.put(next);
      await done;
      this._notify('folder-updated', next.id);
      return clone(next);
    }

    async createSession(input) {
      const normalized = normalizeSessionInput(input);
      const db = await this._ready();
      const transaction = db.transaction(['workspaces', 'folders', 'sessions'], 'readwrite');
      const done = transactionToPromise(transaction);
      const workspace = await requestToPromise(
        transaction.objectStore('workspaces').get(normalized.workspaceId),
      );
      if (!workspace) {
        throw new WorkspaceStoreError('NOT_FOUND', 'Workspace was not found.');
      }
      if (normalized.folderId) {
        const folder = await requestToPromise(
          transaction.objectStore('folders').get(normalized.folderId),
        );
        if (!folder || folder.workspaceId !== normalized.workspaceId) {
          throw new WorkspaceStoreError('VALIDATION', 'Folder is not in this workspace.');
        }
      }
      const timestamp = nowIso();
      const record = {
        id: randomId('session'),
        ...normalized,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastOpenedAt: timestamp,
        revision: 1,
        schemaVersion: RECORD_SCHEMA_VERSION,
      };
      transaction.objectStore('sessions').add(record);
      await done;
      this._notify('session-created', record.id);
      return clone(record);
    }

    async getSession(id) {
      const db = await this._ready();
      const record = await requestToPromise(
        db.transaction('sessions', 'readonly').objectStore('sessions').get(requireString(id, 'Session ID')),
      );
      return record ? clone(record) : null;
    }

    async markSessionOpened(id) {
      const db = await this._ready();
      const transaction = db.transaction('sessions', 'readwrite');
      const done = transactionToPromise(transaction);
      const store = transaction.objectStore('sessions');
      const record = await requestToPromise(store.get(requireString(id, 'Session ID')));
      if (!record) { await done; return null; }
      record.lastOpenedAt = nowIso();
      store.put(record);
      await done;
      this._notify('session-opened', record.id);
      return clone(record);
    }

    async listSessions(filters = {}) {
      const db = await this._ready();
      const records = await requestToPromise(
        db.transaction('sessions', 'readonly').objectStore('sessions').getAll(),
      );
      return records
        .filter(record => !filters.workspaceId || record.workspaceId === filters.workspaceId)
        .filter(record => filters.folderId === undefined || record.folderId === filters.folderId)
        .filter(record => !filters.type || record.type === filters.type)
        .filter(record => filters.favorite === undefined || record.favorite === filters.favorite)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(clone);
    }

    async getBackupSnapshot() {
      const db = await this._ready();
      const transaction = db.transaction(['workspaces', 'folders', 'sessions'], 'readonly');
      const done = transactionToPromise(transaction);
      const [workspaces, folders, sessions] = await Promise.all([
        requestToPromise(transaction.objectStore('workspaces').getAll()),
        requestToPromise(transaction.objectStore('folders').getAll()),
        requestToPromise(transaction.objectStore('sessions').getAll()),
      ]);
      await done;
      return clone({ workspaces, folders, sessions });
    }

    async importBackupCopies(backup) {
      requireObject(backup, 'Backup import');
      const sourceWorkspaces = Array.isArray(backup.workspaces) ? backup.workspaces : [];
      const sourceFolders = Array.isArray(backup.folders) ? backup.folders : [];
      const sourceSessions = Array.isArray(backup.sessions) ? backup.sessions : [];
      if (!sourceWorkspaces.length) {
        throw new WorkspaceStoreError('VALIDATION', 'Backup contains no workspace.');
      }

      // Normalize every user-controlled field before opening the write transaction.
      const workspaceIds = new Map();
      const folderIds = new Map();
      const timestamp = nowIso();
      const workspaces = sourceWorkspaces.map(source => {
        requireObject(source, 'Imported workspace');
        const oldId = requireString(source.id, 'Imported workspace ID');
        if (workspaceIds.has(oldId)) throw new WorkspaceStoreError('VALIDATION', 'Backup has duplicate workspace IDs.');
        const id = randomId('workspace');
        workspaceIds.set(oldId, id);
        const importedName = normalizeName(source.name, 'Workspace name', MAX_NAME_LENGTH);
        return {
          id,
          name: `${[...importedName].slice(0, MAX_NAME_LENGTH - 11).join('')} (Imported)`,
          createdAt: timestamp, updatedAt: timestamp, revision: 1, schemaVersion: RECORD_SCHEMA_VERSION,
        };
      });
      for (const source of sourceFolders) {
        requireObject(source, 'Imported folder');
        const oldId = requireString(source.id, 'Imported folder ID');
        if (folderIds.has(oldId)) throw new WorkspaceStoreError('VALIDATION', 'Backup has duplicate folder IDs.');
        folderIds.set(oldId, randomId('folder'));
      }
      const sourceFolderById = new Map(sourceFolders.map(source => [source.id, source]));
      const folders = sourceFolders.map(source => {
        const workspaceId = workspaceIds.get(source.workspaceId);
        if (!workspaceId) throw new WorkspaceStoreError('VALIDATION', 'Imported folder references a missing workspace.');
        const parentFolderId = source.parentFolderId == null ? null : folderIds.get(source.parentFolderId);
        if (source.parentFolderId != null && !parentFolderId) {
          throw new WorkspaceStoreError('VALIDATION', 'Imported folder references a missing parent.');
        }
        if (source.parentFolderId != null) {
          const parent = sourceFolderById.get(source.parentFolderId);
          if (!parent || parent.workspaceId !== source.workspaceId) {
            throw new WorkspaceStoreError('VALIDATION', 'Imported folder parent is in a different workspace.');
          }
        }
        return {
          id: folderIds.get(source.id), workspaceId, parentFolderId,
          name: normalizeName(source.name, 'Folder name', MAX_NAME_LENGTH),
          order: Number.isFinite(source.order) ? Number(source.order) : 0,
          createdAt: timestamp, updatedAt: timestamp, revision: 1, schemaVersion: RECORD_SCHEMA_VERSION,
        };
      });
      for (const source of sourceFolders) {
        const seen = new Set([source.id]);
        let parentId = source.parentFolderId;
        let depth = 1;
        while (parentId != null) {
          if (seen.has(parentId)) throw new WorkspaceStoreError('VALIDATION', 'Imported folders contain a cycle.');
          seen.add(parentId);
          depth += 1;
          if (depth > MAX_FOLDER_DEPTH) throw new WorkspaceStoreError('VALIDATION', `Imported folders exceed ${MAX_FOLDER_DEPTH} nesting levels.`);
          parentId = sourceFolderById.get(parentId)?.parentFolderId ?? null;
        }
      }
      const sessions = sourceSessions.map(source => {
        const normalized = normalizeSessionInput(source);
        const workspaceId = workspaceIds.get(normalized.workspaceId);
        const folderId = normalized.folderId == null ? null : folderIds.get(normalized.folderId);
        if (!workspaceId || (normalized.folderId != null && !folderId)) {
          throw new WorkspaceStoreError('VALIDATION', 'Imported session references a missing location.');
        }
        if (normalized.folderId != null && sourceFolderById.get(normalized.folderId)?.workspaceId !== normalized.workspaceId) {
          throw new WorkspaceStoreError('VALIDATION', 'Imported session folder is in a different workspace.');
        }
        return {
          id: randomId('session'), ...normalized, workspaceId, folderId,
          createdAt: timestamp, updatedAt: timestamp, lastOpenedAt: timestamp,
          revision: 1, schemaVersion: RECORD_SCHEMA_VERSION,
        };
      });

      const db = await this._ready();
      const transaction = db.transaction(['workspaces', 'folders', 'sessions'], 'readwrite');
      const done = transactionToPromise(transaction);
      try {
        const workspaceStore = transaction.objectStore('workspaces');
        const folderStore = transaction.objectStore('folders');
        const sessionStore = transaction.objectStore('sessions');
        for (const record of workspaces) workspaceStore.add(record);
        for (const record of folders) folderStore.add(record);
        for (const record of sessions) sessionStore.add(record);
        this._injectFailure('importBackupCopies:beforeCommit', transaction, done);
        await done;
      } catch (error) {
        try { transaction.abort(); } catch (_) {}
        throw new WorkspaceStoreError('IMPORT_FAILED', 'Backup import was rolled back.', error);
      }
      this._notify('backup-imported');
      return { workspaces: workspaces.length, folders: folders.length, sessions: sessions.length };
    }

    async putDraft(input) {
      requireObject(input, 'Draft');
      const type = input.type;
      if (type !== 'xslt' && type !== 'xpath') {
        throw new WorkspaceStoreError('VALIDATION', 'Draft type must be xslt or xpath.');
      }
      const db = await this._ready();
      const id = input.id || `draft-${type}`;
      const transaction = db.transaction('drafts', 'readwrite');
      const done = transactionToPromise(transaction);
      const store = transaction.objectStore('drafts');
      const existing = await requestToPromise(store.get(id));
      const timestamp = nowIso();
      const record = {
        id,
        type,
        source: normalizeSource(type, input.source),
        origin: typeof input.origin === 'string' && input.origin ? input.origin : 'quick-playground',
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp,
        revision: (existing?.revision || 0) + 1,
        schemaVersion: RECORD_SCHEMA_VERSION,
      };
      store.put(record);
      this._injectFailure('putDraft:beforeCommit', transaction, done);
      await done;
      return clone(record);
    }

    async getDraft(id) {
      const db = await this._ready();
      const record = await requestToPromise(
        db.transaction('drafts', 'readonly').objectStore('drafts').get(requireString(id, 'Draft ID')),
      );
      return record ? clone(record) : null;
    }

    async deleteDraft(id) {
      const db = await this._ready();
      const transaction = db.transaction('drafts', 'readwrite');
      const done = transactionToPromise(transaction);
      transaction.objectStore('drafts').delete(requireString(id, 'Draft ID'));
      await done;
    }

    async setSetting(key, value) {
      const db = await this._ready();
      const transaction = db.transaction('settings', 'readwrite');
      const done = transactionToPromise(transaction);
      transaction.objectStore('settings').put({
        key: requireString(key, 'Setting key'),
        value: clone(value),
        updatedAt: nowIso(),
      });
      await done;
    }

    async getSetting(key, fallback = null) {
      const db = await this._ready();
      const record = await requestToPromise(
        db.transaction('settings', 'readonly').objectStore('settings').get(requireString(key, 'Setting key')),
      );
      return record ? clone(record.value) : fallback;
    }

    async updateSession(id, expectedRevision, changes) {
      requireObject(changes, 'Session changes');
      const db = await this._ready();
      const transaction = db.transaction(['sessions', 'folders'], 'readwrite');
      const done = transactionToPromise(transaction);
      const store = transaction.objectStore('sessions');
      const record = await requestToPromise(store.get(requireString(id, 'Session ID')));
      if (!record) {
        throw new WorkspaceStoreError('NOT_FOUND', 'Session was not found.');
      }
      if (record.revision !== expectedRevision) {
        throw new WorkspaceStoreError('CONFLICT', 'This session was changed in another tab.');
      }
      if (changes.type && changes.type !== record.type) {
        throw new WorkspaceStoreError('VALIDATION', 'A session type cannot be changed.');
      }
      const folderId = changes.folderId === undefined
        ? record.folderId
        : changes.folderId == null
          ? null
          : requireString(changes.folderId, 'Folder ID');
      if (folderId) {
        const folder = await requestToPromise(transaction.objectStore('folders').get(folderId));
        if (!folder || folder.workspaceId !== record.workspaceId) {
          throw new WorkspaceStoreError('VALIDATION', 'Folder is not in this workspace.');
        }
      }
      const next = {
        ...record,
        title: changes.title === undefined
          ? record.title
          : normalizeName(changes.title, 'Session title', MAX_TITLE_LENGTH),
        folderId,
        favorite: changes.favorite === undefined ? record.favorite : Boolean(changes.favorite),
        source: changes.source === undefined
          ? record.source
          : normalizeSource(record.type, changes.source),
        updatedAt: nowIso(),
        revision: record.revision + 1,
      };
      store.put(next);
      this._injectFailure('updateSession:beforeCommit', transaction, done);
      await done;
      this._notify('session-updated', next.id);
      return clone(next);
    }

    async duplicateSession(id, title) {
      const source = await this.getSession(id);
      if (!source) throw new WorkspaceStoreError('NOT_FOUND', 'Session was not found.');
      return this.createSession({
        type: source.type,
        workspaceId: source.workspaceId,
        folderId: source.folderId,
        title: title || `${source.title} Copy`,
        source: source.source,
        favorite: false,
      });
    }

    async moveSessionToTrash(id, expectedRevision) {
      const db = await this._ready();
      const transaction = db.transaction(['sessions', 'trash'], 'readwrite');
      const done = transactionToPromise(transaction);
      const sessions = transaction.objectStore('sessions');
      const session = await requestToPromise(sessions.get(requireString(id, 'Session ID')));
      if (!session) {
        throw new WorkspaceStoreError('NOT_FOUND', 'Session was not found.');
      }
      if (session.revision !== expectedRevision) {
        throw new WorkspaceStoreError('CONFLICT', 'This session was changed in another tab.');
      }
      const record = {
        id: randomId('trash'),
        recordType: 'session',
        deletedAt: nowIso(),
        originalLocation: {
          workspaceId: session.workspaceId,
          folderId: session.folderId,
        },
        snapshot: session,
        schemaVersion: RECORD_SCHEMA_VERSION,
      };
      transaction.objectStore('trash').add(record);
      sessions.delete(session.id);
      await done;
      this._notify('session-trashed', session.id);
      return clone(record);
    }

    async moveFolderToTrash(id, expectedRevision) {
      const db = await this._ready();
      const transaction = db.transaction(['folders', 'sessions', 'trash'], 'readwrite');
      const done = transactionToPromise(transaction);
      const foldersStore = transaction.objectStore('folders');
      const sessionsStore = transaction.objectStore('sessions');
      const folder = await requestToPromise(foldersStore.get(requireString(id, 'Folder ID')));
      if (!folder) throw new WorkspaceStoreError('NOT_FOUND', 'Folder was not found.');
      if (folder.revision !== expectedRevision) {
        throw new WorkspaceStoreError('CONFLICT', 'This folder was changed in another tab.');
      }
      const workspaceFolders = await requestToPromise(foldersStore.index('byWorkspace').getAll(folder.workspaceId));
      const descendantIds = new Set([folder.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const candidate of workspaceFolders) {
          if (!descendantIds.has(candidate.id) && descendantIds.has(candidate.parentFolderId)) {
            descendantIds.add(candidate.id);
            changed = true;
          }
        }
      }
      const folders = workspaceFolders.filter(candidate => descendantIds.has(candidate.id));
      const workspaceSessions = await requestToPromise(sessionsStore.index('byWorkspace').getAll(folder.workspaceId));
      const sessions = workspaceSessions.filter(session => descendantIds.has(session.folderId));
      const record = {
        id: randomId('trash'),
        recordType: 'folder-tree',
        deletedAt: nowIso(),
        originalLocation: { workspaceId: folder.workspaceId, parentFolderId: folder.parentFolderId },
        snapshot: { folder, folders, sessions },
        schemaVersion: RECORD_SCHEMA_VERSION,
      };
      transaction.objectStore('trash').add(record);
      sessions.forEach(session => sessionsStore.delete(session.id));
      folders.forEach(item => foldersStore.delete(item.id));
      await done;
      this._notify('folder-trashed', folder.id, { sessionIds: sessions.map(session => session.id) });
      return clone(record);
    }

    async moveWorkspaceToTrash(id, expectedRevision) {
      const workspaceId = requireString(id, 'Workspace ID');
      if (workspaceId === DEFAULT_WORKSPACE_ID) throw new WorkspaceStoreError('VALIDATION', 'The default workspace cannot be deleted.');
      const db = await this._ready();
      const transaction = db.transaction(['workspaces', 'folders', 'sessions', 'trash'], 'readwrite');
      const done = transactionToPromise(transaction);
      const workspaceStore = transaction.objectStore('workspaces');
      const folderStore = transaction.objectStore('folders');
      const sessionStore = transaction.objectStore('sessions');
      const workspace = await requestToPromise(workspaceStore.get(workspaceId));
      if (!workspace) throw new WorkspaceStoreError('NOT_FOUND', 'Workspace was not found.');
      if (workspace.revision !== expectedRevision) throw new WorkspaceStoreError('CONFLICT', 'This workspace was changed in another tab.');
      const [folders, sessions] = await Promise.all([
        requestToPromise(folderStore.index('byWorkspace').getAll(workspaceId)),
        requestToPromise(sessionStore.index('byWorkspace').getAll(workspaceId)),
      ]);
      const record = {
        id: randomId('trash'), recordType: 'workspace-tree', deletedAt: nowIso(),
        originalLocation: { workspaceId }, snapshot: { workspace, folders, sessions },
        schemaVersion: RECORD_SCHEMA_VERSION,
      };
      transaction.objectStore('trash').add(record);
      sessions.forEach(session => sessionStore.delete(session.id));
      folders.forEach(folder => folderStore.delete(folder.id));
      workspaceStore.delete(workspaceId);
      await done;
      this._notify('workspace-trashed', workspaceId, { sessionIds: sessions.map(session => session.id) });
      return clone(record);
    }

    async listTrash() {
      const db = await this._ready();
      const records = await requestToPromise(
        db.transaction('trash', 'readonly').objectStore('trash').getAll(),
      );
      return records.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)).map(clone);
    }

    async restoreTrashItem(trashId) {
      const db = await this._ready();
      const transaction = db.transaction(['workspaces', 'folders', 'sessions', 'trash'], 'readwrite');
      const done = transactionToPromise(transaction);
      const trashStore = transaction.objectStore('trash');
      const item = await requestToPromise(trashStore.get(requireString(trashId, 'Trash ID')));
      if (!item || !['session', 'folder-tree', 'workspace-tree'].includes(item.recordType)) {
        throw new WorkspaceStoreError('NOT_FOUND', 'Trash item was not found.');
      }
      if (item.recordType === 'workspace-tree') {
        const workspaceStore = transaction.objectStore('workspaces');
        const folderStore = transaction.objectStore('folders');
        const sessionStore = transaction.objectStore('sessions');
        const snapshot = item.snapshot;
        const existingWorkspace = await requestToPromise(workspaceStore.get(snapshot.workspace.id));
        const existingFolderIds = await Promise.all(snapshot.folders.map(folder => requestToPromise(folderStore.get(folder.id))));
        const existingSessionIds = await Promise.all(snapshot.sessions.map(session => requestToPromise(sessionStore.get(session.id))));
        if (existingWorkspace || existingFolderIds.some(Boolean) || existingSessionIds.some(Boolean)) {
          throw new WorkspaceStoreError('CONFLICT', 'One or more restored workspace IDs already exist.');
        }
        const timestamp = nowIso();
        const workspace = { ...snapshot.workspace, updatedAt: timestamp, revision: snapshot.workspace.revision + 1 };
        const folders = snapshot.folders.map(folder => ({ ...folder, updatedAt: timestamp, revision: folder.revision + 1 }));
        const sessions = snapshot.sessions.map(session => ({ ...session, updatedAt: timestamp, revision: session.revision + 1 }));
        workspaceStore.add(workspace);
        folders.forEach(folder => folderStore.add(folder));
        sessions.forEach(session => sessionStore.add(session));
        trashStore.delete(item.id);
        await done;
        this._notify('workspace-restored', workspace.id);
        return clone({ recordType: 'workspace-tree', workspace, folders, sessions });
      }
      if (item.recordType === 'folder-tree') {
        const folderStore = transaction.objectStore('folders');
        const sessionStore = transaction.objectStore('sessions');
        const snapshot = item.snapshot;
        const existingFolderIds = await Promise.all(snapshot.folders.map(folder => requestToPromise(folderStore.get(folder.id))));
        const existingSessionIds = await Promise.all(snapshot.sessions.map(session => requestToPromise(sessionStore.get(session.id))));
        if (existingFolderIds.some(Boolean) || existingSessionIds.some(Boolean)) {
          throw new WorkspaceStoreError('CONFLICT', 'One or more restored IDs already exist.');
        }
        let workspaceId = snapshot.folder.workspaceId;
        const workspace = await requestToPromise(transaction.objectStore('workspaces').get(workspaceId));
        if (!workspace) workspaceId = DEFAULT_WORKSPACE_ID;
        let rootParentId = snapshot.folder.parentFolderId;
        if (rootParentId) {
          const parent = await requestToPromise(folderStore.get(rootParentId));
          if (!parent || parent.workspaceId !== workspaceId) rootParentId = null;
        }
        const timestamp = nowIso();
        const restoredFolders = snapshot.folders.map(folder => ({
          ...folder,
          workspaceId,
          parentFolderId: folder.id === snapshot.folder.id ? rootParentId : folder.parentFolderId,
          updatedAt: timestamp,
          revision: folder.revision + 1,
        }));
        const restoredSessions = snapshot.sessions.map(session => ({
          ...session, workspaceId, updatedAt: timestamp, revision: session.revision + 1,
        }));
        restoredFolders.forEach(folder => folderStore.add(folder));
        restoredSessions.forEach(session => sessionStore.add(session));
        trashStore.delete(item.id);
        await done;
        this._notify('folder-restored', snapshot.folder.id);
        return clone({ recordType: 'folder-tree', folder: restoredFolders.find(folder => folder.id === snapshot.folder.id), folders: restoredFolders, sessions: restoredSessions });
      }
      const existing = await requestToPromise(transaction.objectStore('sessions').get(item.snapshot.id));
      if (existing) {
        throw new WorkspaceStoreError('CONFLICT', 'A session with this ID already exists.');
      }
      const workspace = await requestToPromise(
        transaction.objectStore('workspaces').get(item.snapshot.workspaceId),
      );
      if (!workspace) item.snapshot.workspaceId = DEFAULT_WORKSPACE_ID;
      if (item.snapshot.folderId) {
        const folder = await requestToPromise(
          transaction.objectStore('folders').get(item.snapshot.folderId),
        );
        if (!folder || folder.workspaceId !== item.snapshot.workspaceId) item.snapshot.folderId = null;
      }
      item.snapshot.updatedAt = nowIso();
      item.snapshot.revision += 1;
      transaction.objectStore('sessions').add(item.snapshot);
      trashStore.delete(item.id);
      await done;
      this._notify('session-restored', item.snapshot.id);
      return clone(item.snapshot);
    }

    async permanentlyDeleteTrashItem(trashId) {
      const db = await this._ready();
      const transaction = db.transaction('trash', 'readwrite');
      const done = transactionToPromise(transaction);
      transaction.objectStore('trash').delete(requireString(trashId, 'Trash ID'));
      await done;
      this._notify('trash-item-deleted', trashId);
    }

    async emptyTrash() {
      const db = await this._ready();
      const transaction = db.transaction('trash', 'readwrite');
      const done = transactionToPromise(transaction);
      transaction.objectStore('trash').clear();
      await done;
      this._notify('trash-emptied');
    }

    async getStorageStatus() {
      const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
      const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
      return {
        available: Boolean(globalThis.indexedDB),
        usage: estimate?.usage ?? null,
        quota: estimate?.quota ?? null,
        persisted,
        blocked: this.storageBlocked,
      };
    }

    close() {
      this.db?.close();
      this.db = null;
    }

    async deleteDatabase() {
      this.close();
      const request = indexedDB.deleteDatabase(DATABASE_NAME);
      await requestToPromise(request);
    }
  }

  window.WorkspaceStore = WorkspaceStore;
  window.WorkspaceStoreError = WorkspaceStoreError;
  window.workspaceStore = new WorkspaceStore();
  window.XSLTDebugXWorkspace = Object.freeze({
    databaseName: DATABASE_NAME,
    databaseVersion: DATABASE_VERSION,
    defaultWorkspaceId: DEFAULT_WORKSPACE_ID,
    recordSchemaVersion: RECORD_SCHEMA_VERSION,
    storeNames: STORE_NAMES,
  });
}());
