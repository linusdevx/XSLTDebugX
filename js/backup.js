// Versioned ZIP backup/export with fail-closed validation and atomic merge-as-copy import.

const BACKUP_FORMAT = 'xsltdebugx-workspace-backup';
const BACKUP_VERSION = 1;
const BACKUP_MAX_ZIP_BYTES = 75 * 1024 * 1024;
const BACKUP_MAX_ENTRY_BYTES = 60 * 1024 * 1024;
const BACKUP_MAX_TOTAL_BYTES = 120 * 1024 * 1024;
const BACKUP_MAX_ENTRIES = 5000;
// Deflate can legitimately compress repetitive XML above 100:1. Absolute entry
// and total-expanded caps remain the primary allocation guard.
const BACKUP_MAX_RATIO = 1200;
const BACKUP_RECORD_SCHEMA_VERSION = 1;
let pendingBackupImport = null;
let _backupImportReturnFocus = null;

function backupJsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n');
}

async function backupSha256(bytes) {
  if (!crypto?.subtle) throw new Error('SHA-256 verification is unavailable in this browser.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function backupSafePath(path) {
  if (typeof path !== 'string' || !path || path.length > 500 || path.includes('\\') || path.startsWith('/') || path.includes('\0')) return false;
  const parts = path.split('/');
  return parts.every(part => part && part !== '.' && part !== '..');
}

function backupParseJson(bytes, path) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (_) { throw new Error(`Backup entry is not valid UTF-8: ${path}`); }
  try { return JSON.parse(text); }
  catch (_) { throw new Error(`Invalid JSON entry: ${path}`); }
}

function readZipDirectory(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > BACKUP_MAX_ZIP_BYTES) throw new Error('Backup ZIP is too large.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= Math.max(0, bytes.byteLength - 65_557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('ZIP end record is missing.');
  const diskNumber = view.getUint16(eocd + 4, true);
  const directoryDisk = view.getUint16(eocd + 6, true);
  const diskCount = view.getUint16(eocd + 8, true);
  const count = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  if (diskNumber !== 0 || directoryDisk !== 0 || diskCount !== count) throw new Error('Multi-disk ZIP backups are not supported.');
  const centralOffset = view.getUint32(eocd + 16, true);
  const eocdCommentLength = view.getUint16(eocd + 20, true);
  if (count === 0xffff || centralOffset === 0xffffffff) throw new Error('ZIP64 backups are not supported.');
  if (!count || count > BACKUP_MAX_ENTRIES) throw new Error('Backup has an invalid number of entries.');
  if (eocd + 22 + eocdCommentLength !== bytes.byteLength || centralOffset + centralSize > eocd) throw new Error('ZIP directory bounds are invalid.');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const entries = [];
  const names = new Set();
  let offset = centralOffset;
  let totalExpanded = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new Error('ZIP directory is corrupt.');
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    if (flags & 0x0001) throw new Error('Encrypted ZIP entries are not supported.');
    if (method !== 0 && method !== 8) throw new Error('ZIP uses an unsupported compression method.');
    const compressedBytes = view.getUint32(offset + 20, true);
    const expandedBytes = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    const entryEnd = nameEnd + extraLength + commentLength;
    if (entryEnd > centralOffset + centralSize || entryEnd > bytes.byteLength) throw new Error('ZIP directory entry is truncated.');
    const path = decoder.decode(bytes.subarray(nameStart, nameEnd));
    if (!backupSafePath(path)) throw new Error(`Unsafe ZIP path: ${path || '(empty)'}`);
    if (names.has(path)) throw new Error(`Duplicate ZIP path: ${path}`);
    if (expandedBytes > BACKUP_MAX_ENTRY_BYTES) throw new Error(`ZIP entry is too large: ${path}`);
    if (compressedBytes === 0 ? expandedBytes > 0 : expandedBytes / compressedBytes > BACKUP_MAX_RATIO) {
      throw new Error(`ZIP entry expansion ratio is unsafe: ${path}`);
    }
    names.add(path);
    totalExpanded += expandedBytes;
    if (totalExpanded > BACKUP_MAX_TOTAL_BYTES) throw new Error('Expanded backup is too large.');
    entries.push({ path, compressedBytes, expandedBytes });
    offset = entryEnd;
  }
  if (offset !== centralOffset + centralSize) throw new Error('ZIP directory size does not match its entries.');
  return entries;
}

async function createWorkspaceBackupBlob() {
  if (!window.fflate?.zipSync) throw new Error('ZIP support failed to load.');
  await flushPendingSave();
  await workspaceStore.init();
  const { workspaces, folders, sessions } = await workspaceStore.getBackupSnapshot();
  const files = {};
  for (const record of workspaces) files[`workspaces/${record.id}.json`] = backupJsonBytes(record);
  for (const record of folders) files[`folders/${record.id}.json`] = backupJsonBytes(record);
  for (const record of sessions) files[`sessions/${record.id}.json`] = backupJsonBytes(record);
  files['README.txt'] = new TextEncoder().encode(
    'XSLTDebugX local workspace backup\n\nImport this ZIP from the XSLTDebugX Explorer. Source, organization, and favorites are included. Drafts, output, console history, and Trash are excluded.\n',
  );
  let expandedBytes = 0;
  for (const [path, content] of Object.entries(files)) {
    if (content.byteLength > BACKUP_MAX_ENTRY_BYTES) throw new Error(`Saved item is too large to back up safely: ${path}`);
    expandedBytes += content.byteLength;
    if (expandedBytes > BACKUP_MAX_TOTAL_BYTES) throw new Error('Workspace is too large to back up in one archive.');
  }
  const entries = [];
  for (const path of Object.keys(files).sort()) {
    entries.push({ path, bytes: files[path].byteLength, sha256: await backupSha256(files[path]) });
  }
  const manifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appBuild: document.getElementById('buildInfo')?.textContent?.trim() || 'unknown',
    counts: { workspaces: workspaces.length, folders: folders.length, sessions: sessions.length },
    entries,
  };
  const manifestBytes = backupJsonBytes(manifest);
  if (manifestBytes.byteLength > BACKUP_MAX_ENTRY_BYTES || expandedBytes + manifestBytes.byteLength > BACKUP_MAX_TOTAL_BYTES) {
    throw new Error('Workspace backup manifest exceeds the safe archive limit.');
  }
  files['xsltdebugx-backup.json'] = manifestBytes;
  const archive = fflate.zipSync(files, { level: 6 });
  if (archive.byteLength > BACKUP_MAX_ZIP_BYTES) throw new Error('Compressed workspace backup exceeds the 75 MiB limit.');
  return new Blob([archive], { type: 'application/zip' });
}

async function downloadWorkspaceBackup() {
  try {
    const blob = await createWorkspaceBackupBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `xsltdebugx-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Safari can cancel a download when its object URL is revoked in the same task.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    clog(`Workspace backup created · ${formatFileSize(blob.size)} ✓`, 'success');
    showCopyToast('✓ Workspace backup downloaded');
  } catch (error) {
    clog(`Backup failed: ${error.message}`, 'error');
    console.warn('[XSLTDebugX] Backup download failed', error);
    showCopyToast(`Backup failed: ${error.message}`, 3500, 'error');
  }
}

function validateBackupModel(model) {
  const { workspaces, folders, sessions } = model;
  const workspaceIds = new Set();
  const folderIds = new Set();
  const folderById = new Map();
  const sessionIds = new Set();
  const validateRecordVersion = (record, label) => {
    if (record.schemaVersion != null && (!Number.isInteger(record.schemaVersion) || record.schemaVersion < 1 || record.schemaVersion > BACKUP_RECORD_SCHEMA_VERSION)) {
      throw new Error(`${label} uses an unsupported schema version.`);
    }
  };
  for (const workspace of workspaces) {
    if (!workspace || typeof workspace.id !== 'string' || !workspace.id || typeof workspace.name !== 'string' || !workspace.name.trim()) throw new Error('Backup contains an invalid workspace.');
    validateRecordVersion(workspace, 'A workspace');
    if (workspaceIds.has(workspace.id)) throw new Error('Backup contains duplicate workspace IDs.');
    workspaceIds.add(workspace.id);
  }
  for (const folder of folders) {
    if (!folder || typeof folder.id !== 'string' || !folder.id || typeof folder.name !== 'string' || !workspaceIds.has(folder.workspaceId)) throw new Error('Backup contains an invalid folder.');
    validateRecordVersion(folder, 'A folder');
    if (folderIds.has(folder.id)) throw new Error('Backup contains duplicate folder IDs.');
    folderIds.add(folder.id);
    folderById.set(folder.id, folder);
  }
  for (const folder of folders) {
    if (folder.parentFolderId != null && !folderIds.has(folder.parentFolderId)) throw new Error('A folder references a missing parent.');
    if (folder.parentFolderId != null && folderById.get(folder.parentFolderId)?.workspaceId !== folder.workspaceId) throw new Error('A folder parent belongs to a different workspace.');
    const seen = new Set([folder.id]);
    let parent = folder.parentFolderId;
    let depth = 1;
    while (parent != null) {
      if (seen.has(parent)) throw new Error('Backup contains a folder cycle.');
      seen.add(parent);
      depth += 1;
      if (depth > 20) throw new Error('Backup folder nesting exceeds 20 levels.');
      parent = folders.find(candidate => candidate.id === parent)?.parentFolderId ?? null;
    }
  }
  for (const session of sessions) {
    if (!session || typeof session.id !== 'string' || !session.id || sessionIds.has(session.id)) throw new Error('Backup contains an invalid or duplicate session ID.');
    validateRecordVersion(session, 'A session');
    if ((session.type !== 'xslt' && session.type !== 'xpath') || typeof session.title !== 'string' || !session.title.trim()) throw new Error('Backup contains an invalid session.');
    if (!workspaceIds.has(session.workspaceId) || (session.folderId != null && !folderIds.has(session.folderId))) throw new Error('A session references a missing location.');
    if (session.folderId != null && folderById.get(session.folderId)?.workspaceId !== session.workspaceId) throw new Error('A session folder belongs to a different workspace.');
    if (!session.source || typeof session.source !== 'object' || typeof session.source.xml !== 'string') throw new Error('A session has invalid source content.');
    if (session.type === 'xslt' && (typeof session.source.xslt !== 'string' || !Array.isArray(session.source.headers) || !Array.isArray(session.source.properties))) throw new Error('An XSLT session has invalid source content.');
    if (session.type === 'xpath' && typeof session.source.expression !== 'string') throw new Error('An XPath session has invalid source content.');
    sessionIds.add(session.id);
  }
}

async function validateWorkspaceBackup(input) {
  if (!window.fflate?.unzipSync) throw new Error('ZIP support failed to load.');
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const directory = readZipDirectory(bytes);
  const files = fflate.unzipSync(bytes);
  const directoryByPath = new Map(directory.map(entry => [entry.path, entry]));
  let actualExpandedBytes = 0;
  for (const [path, content] of Object.entries(files)) {
    const entry = directoryByPath.get(path);
    if (!entry || content.byteLength !== entry.expandedBytes) throw new Error(`ZIP entry size does not match its directory: ${path}`);
    if (content.byteLength > BACKUP_MAX_ENTRY_BYTES) throw new Error(`ZIP entry is too large: ${path}`);
    actualExpandedBytes += content.byteLength;
    if (actualExpandedBytes > BACKUP_MAX_TOTAL_BYTES) throw new Error('Expanded backup is too large.');
  }
  if (files && Object.keys(files).length !== directory.length) throw new Error('ZIP directory entries could not be read exactly.');
  if (!files['xsltdebugx-backup.json']) throw new Error('Backup manifest is missing.');
  const manifest = backupParseJson(files['xsltdebugx-backup.json'], 'xsltdebugx-backup.json');
  if (manifest.format !== BACKUP_FORMAT || manifest.version !== BACKUP_VERSION) throw new Error('Backup format or version is not supported.');
  if (!Array.isArray(manifest.entries)) throw new Error('Backup manifest entries are invalid.');
  const directoryPaths = new Set(directory.map(entry => entry.path).filter(path => path !== 'xsltdebugx-backup.json'));
  const manifestPaths = new Set();
  for (const entry of manifest.entries) {
    if (!entry || !backupSafePath(entry.path) || manifestPaths.has(entry.path)) throw new Error('Backup manifest contains an invalid or duplicate path.');
    if (entry.path !== 'README.txt' && !/^(workspaces|folders|sessions)\/[^/]+\.json$/.test(entry.path)) throw new Error(`Backup contains an unexpected entry: ${entry.path}`);
    const content = files[entry.path];
    if (!content || !directoryPaths.has(entry.path) || content.byteLength !== entry.bytes) throw new Error(`Backup entry size mismatch: ${entry.path}`);
    if (await backupSha256(content) !== entry.sha256) throw new Error(`Backup checksum mismatch: ${entry.path}`);
    manifestPaths.add(entry.path);
  }
  if (manifestPaths.size !== directoryPaths.size || [...directoryPaths].some(path => !manifestPaths.has(path))) throw new Error('ZIP entries do not match the manifest.');
  const parseRecords = prefix => [...manifestPaths]
    .filter(path => path.startsWith(prefix) && path.endsWith('.json'))
    .sort()
    .map(path => backupParseJson(files[path], path));
  const model = {
    workspaces: parseRecords('workspaces/'),
    folders: parseRecords('folders/'),
    sessions: parseRecords('sessions/'),
  };
  validateBackupModel(model);
  const counts = manifest.counts || {};
  if (counts.workspaces !== model.workspaces.length || counts.folders !== model.folders.length || counts.sessions !== model.sessions.length) throw new Error('Backup manifest counts do not match its contents.');
  return { manifest, model, zipBytes: bytes.byteLength };
}

async function prepareWorkspaceBackupImport(file) {
  _backupImportReturnFocus = document.activeElement;
  const input = document.getElementById('backupImportInput');
  if (input) input.value = '';
  if (!file) return;
  const error = document.getElementById('backupImportError');
  if (error) { error.hidden = true; error.textContent = ''; }
  try {
    if (!Number.isFinite(file.size) || file.size > BACKUP_MAX_ZIP_BYTES) throw new Error('Backup ZIP is too large.');
    pendingBackupImport = await validateWorkspaceBackup(await file.arrayBuffer());
    const { counts } = pendingBackupImport.manifest;
    const summary = document.getElementById('backupImportSummary');
    if (summary) summary.textContent = `${counts.workspaces} workspace${counts.workspaces === 1 ? '' : 's'} · ${counts.folders} folder${counts.folders === 1 ? '' : 's'} · ${counts.sessions} saved item${counts.sessions === 1 ? '' : 's'}`;
    document.getElementById('backupImportBackdrop')?.classList.add('open');
    document.body.classList.add('modal-open');
  } catch (validationError) {
    pendingBackupImport = null;
    if (error) { error.hidden = false; error.textContent = validationError.message; }
    const summary = document.getElementById('backupImportSummary');
    if (summary) summary.textContent = 'Backup validation failed — nothing was imported.';
    document.getElementById('backupImportBackdrop')?.classList.add('open');
    document.body.classList.add('modal-open');
    document.getElementById('backupImportConfirmBtn')?.toggleAttribute('disabled', true);
    requestAnimationFrame(() => document.querySelector('#backupImportBackdrop .ex-modal-close')?.focus());
    return;
  }
  if (pendingBackupImport) document.getElementById('backupImportConfirmBtn')?.toggleAttribute('disabled', false);
  requestAnimationFrame(() => document.getElementById('backupImportConfirmBtn')?.focus());
}

function closeBackupImportDialog() {
  pendingBackupImport = null;
  document.getElementById('backupImportBackdrop')?.classList.remove('open');
  document.body.classList.remove('modal-open');
  const returnFocus = _backupImportReturnFocus;
  _backupImportReturnFocus = null;
  requestAnimationFrame(() => returnFocus?.isConnected && returnFocus.focus());
}

async function confirmWorkspaceBackupImport() {
  if (!pendingBackupImport) return;
  const button = document.getElementById('backupImportConfirmBtn');
  button.disabled = true;
  try {
    const result = await workspaceStore.importBackupCopies(pendingBackupImport.model);
    closeBackupImportDialog();
    explorerView = 'all';
    await refreshExplorer();
    clog(`Backup imported as copies · ${result.sessions} saved item${result.sessions === 1 ? '' : 's'} ✓`, 'success');
    showCopyToast(`✓ Imported ${result.sessions} saved item${result.sessions === 1 ? '' : 's'}`);
  } catch (error) {
    const element = document.getElementById('backupImportError');
    element.hidden = false;
    element.textContent = error.message;
    button.disabled = false;
  }
}

var handleBackupImportBackdropClick = _makeBackdropClose('backupImportBackdrop', closeBackupImportDialog);
