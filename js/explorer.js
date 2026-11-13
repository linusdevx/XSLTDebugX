// Local workspace Explorer for named XSLT mappings and XPath queries.

let explorerView = 'all';
let explorerResizeTimer = null;
let explorerOutputWasCollapsed = null;
let explorerRemoteRefreshTimer = null;
let collapsedExplorerFolders = null;
let explorerRefreshToken = 0;
let explorerActionResolve = null;
let explorerActionReturnFocus = null;

function requestExplorerAction({ title, message = '', label = 'Name', value = '', options = null, optionValue = '', includeInput = false, confirmLabel = 'Save', danger = false }) {
  closeExplorerActionDialog();
  explorerActionReturnFocus = document.activeElement;
  document.getElementById('explorerActionTitle').textContent = title;
  const messageElement = document.getElementById('explorerActionMessage');
  messageElement.textContent = message;
  messageElement.hidden = !message;
  const input = document.getElementById('explorerActionInput');
  const inputLabel = document.getElementById('explorerActionInputLabel');
  const select = document.getElementById('explorerActionSelect');
  const selectLabel = document.getElementById('explorerActionSelectLabel');
  const usesSelect = Array.isArray(options);
  input.hidden = (usesSelect && !includeInput) || label === null;
  inputLabel.hidden = input.hidden;
  inputLabel.textContent = label || '';
  input.value = value;
  select.hidden = !usesSelect;
  selectLabel.hidden = !usesSelect;
  select.replaceChildren(...(options || []).map(option => new Option(option.label, option.value)));
  if (usesSelect) select.value = optionValue;
  const error = document.getElementById('explorerActionError');
  error.textContent = '';
  error.hidden = true;
  const confirm = document.getElementById('explorerActionConfirm');
  confirm.textContent = confirmLabel;
  confirm.classList.toggle('danger', danger);
  document.getElementById('explorerActionBackdrop').classList.add('open');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => (input.hidden ? usesSelect ? select : confirm : input).focus());
  return new Promise(resolve => { explorerActionResolve = resolve; });
}

function submitExplorerActionDialog(event) {
  event?.preventDefault();
  const input = document.getElementById('explorerActionInput');
  const select = document.getElementById('explorerActionSelect');
  const inputValue = input.value.trim();
  let value = input.hidden
    ? (select.hidden ? true : select.value)
    : select.hidden ? inputValue : { value: inputValue, option: select.value };
  if (!input.hidden && !inputValue) {
    const error = document.getElementById('explorerActionError');
    error.textContent = 'Enter a name to continue.';
    error.hidden = false;
    input.focus();
    return;
  }
  closeExplorerActionDialog(value);
}

function closeExplorerActionDialog(value = null) {
  const backdrop = document.getElementById('explorerActionBackdrop');
  if (!backdrop?.classList.contains('open') && !explorerActionResolve) return;
  backdrop?.classList.remove('open');
  document.body.classList.remove('modal-open');
  const resolve = explorerActionResolve;
  explorerActionResolve = null;
  resolve?.(value);
  const returnFocus = explorerActionReturnFocus;
  explorerActionReturnFocus = null;
  requestAnimationFrame(() => returnFocus?.isConnected && returnFocus.focus());
}

var handleExplorerActionBackdropClick = _makeBackdropClose('explorerActionBackdrop', closeExplorerActionDialog);

window.addEventListener('workspace-store-change', event => {
  sessionController?.handleRemoteTrash?.(event.detail);
  clearTimeout(explorerRemoteRefreshTimer);
  explorerRemoteRefreshTimer = setTimeout(() => {
    void refreshExplorer();
  }, 80);
});
window.addEventListener('workspace-storage-blocked', () => {
  showToast('Storage upgrade blocked — close other XSLTDebugX tabs, then reload', { tone: 'error', duration: 0 });
  const element = document.getElementById('settingsStorageStatus');
  if (element) {
    element.textContent = 'Storage upgrade blocked · close other XSLTDebugX tabs, then reload';
    element.classList.add('error');
  }
});

function syncExplorerPaneLayout(open) {
  if (window.innerWidth < 900) return;
  if (!modeManager?.isXslt) {
    if (!open) explorerOutputWasCollapsed = null;
    return;
  }
  const output = document.getElementById('colRight');
  if (!output) return;
  if (open) {
    if (explorerOutputWasCollapsed == null) explorerOutputWasCollapsed = output.classList.contains('collapsed');
    output.classList.add('collapsed');
  } else if (explorerOutputWasCollapsed != null) {
    output.classList.toggle('collapsed', explorerOutputWasCollapsed);
    explorerOutputWasCollapsed = null;
  }
}

function toggleExplorer(force) {
  const explorer = document.getElementById('workspaceExplorer');
  if (!explorer) return;
  const open = typeof force === 'boolean' ? force : !explorer.classList.contains('open');
  explorer.classList.toggle('open', open);
  document.getElementById('explorerBackdrop')?.classList.toggle('open', open);
  document.getElementById('explorerToggle')?.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('explorer-open', open);
  syncExplorerPaneLayout(open);
  if (typeof updatePaneSplitters === 'function') updatePaneSplitters();
  void workspaceStore.setSetting('explorerOpen', open).catch(() => {});
  if (open) {
    void refreshExplorer();
    if (window.innerWidth < 900) requestAnimationFrame(() => document.getElementById('explorerSearch')?.focus());
  } else if (window.innerWidth < 900) {
    document.getElementById('explorerToggle')?.focus();
  }
  setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 250);
}

function setExplorerView(view) {
  explorerView = view;
  document.querySelectorAll('.explorer-filter').forEach(button => {
    button.classList.toggle('active', button.dataset.view === view);
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  });
  void refreshExplorer();
}

let _conflictReturnFocus = null;

function openSessionConflictDialog() {
  _conflictReturnFocus = document.activeElement;
  const type = modeManager.isXpath ? 'xpath' : 'xslt';
  const conflict = sessionController.pendingConflicts[type];
  if (!conflict) return;
  const input = document.getElementById('sessionConflictCopyTitle');
  if (input) input.value = `${conflict.record.title} Conflict Copy`;
  setSessionConflictError('');
  document.getElementById('sessionConflictBackdrop')?.classList.add('open');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => input?.focus());
}

function closeSessionConflictDialog() {
  document.getElementById('sessionConflictBackdrop')?.classList.remove('open');
  document.body.classList.remove('modal-open');
  const returnFocus = _conflictReturnFocus;
  _conflictReturnFocus = null;
  requestAnimationFrame(() => returnFocus?.isConnected && returnFocus.focus());
}

function setSessionConflictError(message) {
  const element = document.getElementById('sessionConflictError');
  if (!element) return;
  element.textContent = message;
  element.hidden = !message;
}

async function reloadSessionConflict() {
  try {
    await sessionController.resolveConflictReload();
    closeSessionConflictDialog();
  } catch (error) {
    setSessionConflictError(error.message);
  }
}

async function saveSessionConflictCopy() {
  const input = document.getElementById('sessionConflictCopyTitle');
  const title = input?.value.trim() || '';
  if (!title) { setSessionConflictError('Enter a name for the copy.'); input?.focus(); return; }
  try {
    await sessionController.resolveConflictCopy(title);
    closeSessionConflictDialog();
    await refreshExplorer();
  } catch (error) {
    setSessionConflictError(error.message);
  }
}

var handleSessionConflictBackdropClick = _makeBackdropClose('sessionConflictBackdrop', closeSessionConflictDialog);

let workspaceSettingsReturnFocus = null;

async function openWorkspaceSettings() {
  workspaceSettingsReturnFocus = document.activeElement;
  document.getElementById('settingsTheme').value = document.body.classList.contains('light') ? 'light' : 'dark';
  document.getElementById('settingsRuntimeProfile').value = runtimeProfile;
  document.getElementById('settingsExplorerOpen').checked = await workspaceStore.getSetting('explorerOpen', true);
  await refreshWorkspaceSettingsStatus();
  document.getElementById('workspaceSettingsBackdrop')?.classList.add('open');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => document.getElementById('settingsTheme')?.focus());
}

function closeWorkspaceSettings() {
  document.getElementById('workspaceSettingsBackdrop')?.classList.remove('open');
  document.body.classList.remove('modal-open');
  workspaceSettingsReturnFocus?.focus?.();
}

var handleWorkspaceSettingsBackdropClick = _makeBackdropClose('workspaceSettingsBackdrop', closeWorkspaceSettings);

async function refreshWorkspaceSettingsStatus() {
  const storage = document.getElementById('settingsStorageStatus');
  const trash = document.getElementById('settingsTrashStatus');
  try {
    const status = await workspaceStore.getStorageStatus();
    const format = bytes => bytes == null ? 'unknown usage' : formatFileSize(bytes);
    storage.textContent = status.blocked
      ? 'Upgrade blocked by another tab · close it, then reload'
      : `${format(status.usage)} · clearing browser site data removes this workspace`;
    const items = await workspaceStore.listTrash();
    trash.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
  } catch (error) {
    storage.textContent = 'Storage status unavailable';
    trash.textContent = 'Trash unavailable';
  }
}

function setWorkspaceTheme(theme) {
  const wantsLight = theme === 'light';
  if (document.body.classList.contains('light') !== wantsLight) toggleTheme();
}

async function setExplorerStartupPreference(open) {
  await workspaceStore.setSetting('explorerOpen', Boolean(open));
  toggleExplorer(Boolean(open));
}

async function emptyWorkspaceTrash() {
  if (!await requestExplorerAction({ title: 'Empty Trash?', message: 'Permanently delete every item in Trash? This cannot be undone.', label: null, confirmLabel: 'Empty Trash', danger: true })) return;
  await workspaceStore.emptyTrash();
  await refreshExplorer();
  await refreshWorkspaceSettingsStatus();
}

async function deleteAllWorkspaceData() {
  if (!await requestExplorerAction({ title: 'Delete local workspace data?', message: 'Sessions, folders, drafts, Trash, and settings will be permanently deleted from this browser.', label: null, confirmLabel: 'Continue', danger: true })) return;
  if (!await requestExplorerAction({ title: 'Final confirmation', message: 'This cannot be undone. Delete all local XSLTDebugX workspace data?', label: null, confirmLabel: 'Delete data', danger: true })) return;
  await workspaceStore.deleteDatabase();
  location.reload();
}

let _aboutReturnFocus = null;

function openAboutDialog() {
  _aboutReturnFocus = document.activeElement;
  const build = document.getElementById('buildInfo')?.textContent?.trim() || 'Unknown build';
  document.getElementById('aboutBuildInfo').textContent = `Build ${build}`;
  document.getElementById('aboutBackdrop')?.classList.add('open');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => document.querySelector('#aboutBackdrop .ex-modal-close')?.focus());
}

function closeAboutDialog() {
  document.getElementById('aboutBackdrop')?.classList.remove('open');
  document.body.classList.remove('modal-open');
  const returnFocus = _aboutReturnFocus;
  _aboutReturnFocus = null;
  requestAnimationFrame(() => returnFocus?.isConnected && returnFocus.focus());
}

var handleAboutBackdropClick = _makeBackdropClose('aboutBackdrop', closeAboutDialog);

async function refreshExplorer() {
  const list = document.getElementById('explorerList');
  if (!list) return;
  const refreshToken = ++explorerRefreshToken;
  const renderTarget = document.createDocumentFragment();
  try {
    await workspaceStore.init();
    if (collapsedExplorerFolders == null) {
      const saved = await workspaceStore.getSetting('explorerCollapsedFolders', []);
      collapsedExplorerFolders = new Set(Array.isArray(saved) ? saved : []);
    }
    const search = (document.getElementById('explorerSearch')?.value || '').trim().toLocaleLowerCase();
    if (explorerView === 'trash') {
      const trash = (await workspaceStore.listTrash()).filter(item =>
        item.snapshot?.title?.toLocaleLowerCase().includes(search)
        || item.snapshot?.folder?.name?.toLocaleLowerCase().includes(search)
        || item.snapshot?.workspace?.name?.toLocaleLowerCase().includes(search)
        || item.snapshot?.sessions?.some(session => session.title.toLocaleLowerCase().includes(search)),
      );
      if (refreshToken !== explorerRefreshToken) return;
      renderExplorerTrash(renderTarget, trash, search);
      list.replaceChildren(renderTarget);
      return;
    }
    const workspaces = await workspaceStore.listWorkspaces();
    const workspaceNames = new Map(workspaces.map(workspace => [workspace.id, workspace.name]));
    const folders = (await Promise.all(workspaces.map(workspace => workspaceStore.listFolders(workspace.id)))).flat();
    const folderNames = new Map(folders.map(folder => [folder.id, folder.name]));
    let sessions = await workspaceStore.listSessions();
    if (explorerView === 'recent') sessions = sessions
      .sort((a, b) => (b.lastOpenedAt || b.updatedAt).localeCompare(a.lastOpenedAt || a.updatedAt))
      .slice(0, 12);
    if (explorerView === 'favorites') sessions = sessions.filter(session => session.favorite);
    if (search) sessions = sessions.filter(session =>
      session.title.toLocaleLowerCase().includes(search)
      || (workspaceNames.get(session.workspaceId) || '').toLocaleLowerCase().includes(search)
      || (folderNames.get(session.folderId) || '').toLocaleLowerCase().includes(search)
    );
    const visibleFolderIds = new Set();
    if (explorerView === 'all' && !search) folders.forEach(folder => visibleFolderIds.add(folder.id));
    sessions.forEach(session => { if (session.folderId) visibleFolderIds.add(session.folderId); });
    if (search) folders.filter(folder => folder.name.toLocaleLowerCase().includes(search))
      .forEach(folder => visibleFolderIds.add(folder.id));
    for (const folder of folders) {
      let parentId = visibleFolderIds.has(folder.id) ? folder.parentFolderId : null;
      while (parentId) {
        visibleFolderIds.add(parentId);
        parentId = folders.find(item => item.id === parentId)?.parentFolderId || null;
      }
    }
    if (refreshToken !== explorerRefreshToken) return;
    renderExplorerSessions(renderTarget, sessions, search, workspaces, folders.filter(folder => visibleFolderIds.has(folder.id)), folders);
    list.replaceChildren(renderTarget);
  } catch (error) {
    if (refreshToken !== explorerRefreshToken) return;
    const state = document.createElement('div');
    state.className = 'explorer-empty error';
    state.textContent = `Workspace unavailable: ${error.message}`;
    list.replaceChildren(state);
  }
}

function renderExplorerSessions(list, sessions, search, workspaces = [], folders = [], allFolders = folders) {
  const appendEmptyState = () => {
    if (search) {
      const empty = document.createElement('div');
      empty.className = 'explorer-empty';
      empty.textContent = `No saved items match “${search}”.`;
      list.appendChild(empty);
      return;
    }
    if (explorerView === 'favorites') {
      const empty = document.createElement('div');
      empty.className = 'explorer-empty';
      empty.textContent = 'No favorites yet.';
      list.appendChild(empty);
      return;
    }
    // Simple empty state pointing to the + New button
    const wrap = document.createElement('div');
    wrap.className = 'explorer-empty-actions';
    const hint = document.createElement('p');
    hint.className = 'explorer-empty-hint';
    hint.textContent = 'No saved items yet — use + XSLT or + XPath above.';
    wrap.append(hint);
    list.appendChild(wrap);
  };
  for (const workspace of workspaces) {
    const workspaceSessions = sessions.filter(session => session.workspaceId === workspace.id);
    const workspaceFolders = folders.filter(folder => folder.workspaceId === workspace.id);
    const workspaceMoveFolders = allFolders.filter(folder => folder.workspaceId === workspace.id);
    const showEmptyWorkspace = explorerView === 'all' && (!search || workspace.name.toLocaleLowerCase().includes(search));
    if (!workspaceSessions.length && !workspaceFolders.length && !showEmptyWorkspace) continue;
    const heading = document.createElement('div');
    heading.className = 'explorer-workspace-heading';
    heading.textContent = workspace.name;
    list.appendChild(heading);
    workspaceSessions.filter(session => !session.folderId).forEach(session => renderExplorerSessionRow(list, session, workspaceMoveFolders, 0));
    const renderFolder = (folder, depth, parent = list) => {
      const folderRow = document.createElement('div');
      folderRow.className = 'explorer-folder-row';
      folderRow.style.paddingLeft = `${7 + depth * 12}px`;
      folderRow.tabIndex = 0;
      folderRow.setAttribute('role', 'button');
      folderRow.setAttribute('aria-label', `Folder ${folder.name}`);
      folderRow.dataset.folderId = folder.id;
      const collapsed = !search && collapsedExplorerFolders.has(folder.id);
      folderRow.setAttribute('aria-expanded', String(!collapsed));
      const name = document.createElement('span');
      name.textContent = `${collapsed ? '▸' : '▾'} ${folder.name}`;
      const rename = explorerAction('✎', `Rename folder ${folder.name}`, () => renameExplorerFolder(folder));
      const remove = explorerAction('×', `Move folder ${folder.name} to Trash`, () => trashExplorerFolder(folder));
      const actions = document.createElement('span');
      actions.className = 'explorer-folder-actions';
      actions.appendChild(_explorerRowMenu([
        { label: 'Rename', handler: () => renameExplorerFolder(folder) },
        { label: 'Move to Trash', handler: () => trashExplorerFolder(folder), danger: true },
      ]));
      folderRow.append(name, actions);
      parent.appendChild(folderRow);
      const children = document.createElement('div');
      children.className = 'explorer-folder-children';
      children.hidden = collapsed;
      parent.appendChild(children);
      const setExpanded = expanded => {
        folderRow.setAttribute('aria-expanded', String(expanded));
        name.textContent = `${expanded ? '▾' : '▸'} ${folder.name}`;
        children.hidden = !expanded;
        collapsedExplorerFolders[expanded ? 'delete' : 'add'](folder.id);
        void workspaceStore.setSetting('explorerCollapsedFolders', [...collapsedExplorerFolders]).catch(() => {});
      };
      folderRow.addEventListener('click', () => setExpanded(folderRow.getAttribute('aria-expanded') !== 'true'));
      folderRow.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setExpanded(folderRow.getAttribute('aria-expanded') !== 'true'); }
        if (event.key === 'ArrowRight') { event.preventDefault(); setExpanded(true); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); setExpanded(false); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); moveExplorerTreeFocus(folderRow, event.key === 'ArrowDown' ? 1 : -1); }
        if (event.key === 'F2') { event.preventDefault(); void renameExplorerFolder(folder).catch(reportExplorerActionError); }
      });
      workspaceSessions.filter(session => session.folderId === folder.id)
        .forEach(session => renderExplorerSessionRow(children, session, workspaceMoveFolders, depth + 1));
      workspaceFolders.filter(child => child.parentFolderId === folder.id)
        .forEach(child => renderFolder(child, depth + 1, children));
    };
    workspaceFolders.filter(folder => !folder.parentFolderId).forEach(folder => renderFolder(folder, 0));
  }
  if (!sessions.length && !folders.length) appendEmptyState();
}

function renderExplorerSessionRow(list, session, workspaceFolders = [], depth = 0) {
    const row = document.createElement('div');
    row.className = 'explorer-row';
    row.dataset.sessionId = session.id;
    row.style.paddingLeft = `${7 + depth * 12}px`;
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `Open ${session.type === 'xpath' ? 'XPath query' : 'XSLT mapping'} ${session.title}`);
    const main = document.createElement('div');
    main.className = 'explorer-row-main';
    const type = document.createElement('span');
    type.className = `explorer-type ${session.type}`;
    type.textContent = session.type === 'xpath' ? 'XPath' : 'XSLT';
    const title = document.createElement('span');
    title.className = 'explorer-row-title';
    title.textContent = session.title;
    const text = document.createElement('span');
    text.className = 'explorer-row-text';
    text.appendChild(title);
    main.append(type, text);
    const actions = document.createElement('div');
    actions.className = 'explorer-row-actions';
    const favBtn = explorerAction(session.favorite ? '★' : '☆', session.favorite ? 'Remove favorite' : 'Add favorite', () => toggleSessionFavorite(session));
    favBtn.className += ' explorer-row-fav';
    actions.append(
      favBtn,
      _explorerRowMenu([
        { label: 'Rename', handler: () => renameExplorerSession(session) },
        { label: 'Duplicate', handler: () => duplicateExplorerSession(session) },
        { label: 'Move to folder', handler: () => moveExplorerSession(session, workspaceFolders) },
        { label: 'Move to Trash', handler: () => trashExplorerSession(session), danger: true },
      ]),
    );
    row.append(main, actions);
    row.addEventListener('click', () => { void openExplorerSession(session.id).catch(reportExplorerActionError); });
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openExplorerSession(session.id).catch(reportExplorerActionError); }
      if (event.key === 'F2') { event.preventDefault(); void renameExplorerSession(session).catch(reportExplorerActionError); }
      if (event.key === 'Delete') { event.preventDefault(); void trashExplorerSession(session).catch(reportExplorerActionError); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveExplorerTreeFocus(row, event.key === 'ArrowDown' ? 1 : -1);
      }
    });
    list.appendChild(row);
}

function moveExplorerTreeFocus(current, direction) {
  const root = document.getElementById('explorerList');
  const rows = [...root.querySelectorAll('.explorer-row[tabindex="0"], .explorer-folder-row[tabindex="0"]')]
    .filter(element => element.getClientRects().length > 0);
  const index = rows.indexOf(current);
  rows[Math.max(0, Math.min(rows.length - 1, index + direction))]?.focus();
}

function explorerAction(text, label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'explorer-row-action';
  button.textContent = text;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', event => {
    event.stopPropagation();
    try { void Promise.resolve(handler()).catch(reportExplorerActionError); }
    catch (error) { reportExplorerActionError(error); }
  });
  return button;
}

// items: [{ label, handler, danger? }]
function _explorerRowMenu(items) {
  const wrap = document.createElement('div');
  wrap.className = 'explorer-row-menu-wrap';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'explorer-row-action explorer-row-menu-trigger';
  trigger.textContent = '···';
  trigger.setAttribute('aria-label', 'More actions');
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');

  const menu = document.createElement('div');
  menu.className = 'explorer-row-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  items.forEach(({ label, handler, danger }) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.role = 'menuitem';
    item.className = 'explorer-row-menu-item' + (danger ? ' danger' : '');
    item.textContent = label;
    item.addEventListener('click', event => {
      event.stopPropagation();
      _closeExplorerMenus();
      try { void Promise.resolve(handler()).catch(reportExplorerActionError); }
      catch (error) { reportExplorerActionError(error); }
    });
    menu.appendChild(item);
  });

  const close = () => { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
  trigger.addEventListener('click', event => {
    event.stopPropagation();
    const wasOpen = !menu.hidden;
    _closeExplorerMenus();
    if (!wasOpen) {
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      // Position fixed to escape overflow:hidden on the Explorer panel
      const rect = trigger.getBoundingClientRect();
      const menuHeight = items.length * 30 + 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < menuHeight + 8;
      menu.style.position = 'fixed';
      menu.style.minWidth = '150px';
      menu.style.right = (window.innerWidth - rect.right) + 'px';
      if (flipUp) {
        menu.style.bottom = (window.innerHeight - rect.top) + 'px';
        menu.style.top = 'auto';
      } else {
        menu.style.top = (rect.bottom + 2) + 'px';
        menu.style.bottom = 'auto';
      }
      requestAnimationFrame(() => menu.querySelector('.explorer-row-menu-item')?.focus());
    }
  });
  menu.addEventListener('keydown', event => {
    const items = [...menu.querySelectorAll('.explorer-row-menu-item')];
    const idx = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
    if (event.key === 'ArrowUp')   { event.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
    if (event.key === 'Escape')    { event.preventDefault(); close(); trigger.focus(); }
  });

  wrap.append(trigger, menu);
  return wrap;
}

function _closeExplorerMenus() {
  document.querySelectorAll('.explorer-row-menu').forEach(m => {
    m.hidden = true;
    m.closest('.explorer-row-menu-wrap')?.querySelector('.explorer-row-menu-trigger')?.setAttribute('aria-expanded', 'false');
  });
}

function reportExplorerActionError(error) {
  const message = error?.message || 'Unknown error';
  clog(`Explorer action could not be completed: ${message}`, 'error');
  if (typeof showCopyToast === 'function') showCopyToast(`Action failed: ${message}`, 3500, 'error');
}

async function flushActiveExplorerSession(session) {
  if (sessionController.getCurrentSession()?.id === session?.id) await flushPendingSave();
}

function renderExplorerTrash(list, items, search) {
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'explorer-empty';
    empty.textContent = search ? `No Trash items match “${search}”.` : 'Trash is empty.';
    list.appendChild(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'explorer-row trash';
    const title = document.createElement('span');
    title.className = 'explorer-row-title';
    const itemTitle = item.recordType === 'folder-tree'
      ? `${item.snapshot.folder.name} (${item.snapshot.sessions.length} saved item${item.snapshot.sessions.length === 1 ? '' : 's'})`
      : item.recordType === 'workspace-tree'
        ? `${item.snapshot.workspace.name} (${item.snapshot.sessions.length} saved item${item.snapshot.sessions.length === 1 ? '' : 's'})`
      : item.snapshot.title;
    title.textContent = itemTitle;
    const restore = explorerAction('↶', `Restore ${itemTitle}`, async () => {
      await workspaceStore.restoreTrashItem(item.id);
      await refreshExplorer();
    });
    const remove = explorerAction('×', `Delete permanently ${itemTitle}`, async () => {
      if (!await requestExplorerAction({ title: 'Delete permanently?', message: `Permanently delete “${itemTitle}”? This cannot be undone.`, label: null, confirmLabel: 'Delete', danger: true })) return;
      await workspaceStore.permanentlyDeleteTrashItem(item.id);
      await refreshExplorer();
    });
    const actions = document.createElement('span');
    actions.className = 'explorer-folder-actions';
    actions.append(restore, remove);
    row.append(title, actions);
    list.appendChild(row);
  }
}

async function openExplorerSession(id) {
  const session = await workspaceStore.getSession(id);
  if (!session) { await refreshExplorer(); return; }
  await sessionController.restoreSession(session);
  if (window.innerWidth < 900) toggleExplorer(false);
}

async function createExplorerSession(type) {
  const suggested = type === 'xpath' ? 'Untitled XPath Query' : 'Untitled XSLT Mapping';
  const workspaceId = sessionController.getCurrentSession()?.workspaceId || 'workspace-default';
  const folders = await workspaceStore.listFolders(workspaceId);
  const result = await requestExplorerAction({
    title: `New ${type === 'xpath' ? 'XPath query' : 'XSLT mapping'}`,
    label: 'Name',
    value: suggested,
    options: folders.length ? [
      { value: '', label: 'Workspace root' },
      ...folders.map(folder => ({ value: folder.id, label: explorerFolderPath(folder, folders) })),
    ] : null,
    includeInput: folders.length > 0,
    confirmLabel: 'Create',
  });
  if (result == null) return;
  const title = typeof result === 'object' ? result.value : result;
  const folderId = typeof result === 'object' ? result.option || null : null;
  await flushPendingSave();
  const source = type === 'xpath'
    ? { xml: EXAMPLES.xpathNavigation.xml, expression: EXAMPLES.xpathNavigation.xpathExpr, namespaces: {}, evaluatorOptions: {} }
    : { xml: EXAMPLES.identityTransform.xml, xslt: EXAMPLES.identityTransform.xslt, headers: [], properties: [], runtimeProfile, runOptions: {} };
  const record = await workspaceStore.createSession({
    type, workspaceId, folderId, title, source,
  });
  await sessionController.restoreSession(record);
  await refreshExplorer();
}

async function createExplorerFolder() {
  const name = await requestExplorerAction({ title: 'New folder', label: 'Folder name', value: 'New Folder', confirmLabel: 'Create' });
  if (name == null) return;
  const active = sessionController.getCurrentSession();
  await workspaceStore.createFolder({
    workspaceId: active?.workspaceId || 'workspace-default',
    parentFolderId: null,
    name,
  });
  await refreshExplorer();
}

async function renameExplorerFolder(folder) {
  const name = await requestExplorerAction({ title: 'Rename folder', label: 'Folder name', value: folder.name, confirmLabel: 'Rename' });
  if (name == null || name === folder.name) return;
  const current = (await workspaceStore.listFolders(folder.workspaceId)).find(item => item.id === folder.id);
  if (!current) return refreshExplorer();
  await workspaceStore.updateFolder(current.id, current.revision, { name });
  await refreshExplorer();
}

async function trashExplorerFolder(folder) {
  if (!await requestExplorerAction({ title: 'Move folder to Trash?', message: `Move “${folder.name}” and all saved items inside it to Trash?`, label: null, confirmLabel: 'Move to Trash', danger: true })) return;
  await flushPendingSave();
  const current = (await workspaceStore.listFolders(folder.workspaceId)).find(item => item.id === folder.id);
  if (!current) return refreshExplorer();
  const trashed = await workspaceStore.moveFolderToTrash(current.id, current.revision);
  const removedIds = new Set(trashed.snapshot.sessions.map(session => session.id));
  for (const type of ['xslt', 'xpath']) {
    if (removedIds.has(sessionController.activeSessions[type]?.id)) await sessionController.restoreModeDraft(type);
  }
  trashed.snapshot.folders.forEach(item => collapsedExplorerFolders?.delete(item.id));
  void workspaceStore.setSetting('explorerCollapsedFolders', [...(collapsedExplorerFolders || [])]).catch(() => {});
  await refreshExplorer();
}

async function moveExplorerSession(session, folders = []) {
  const folderId = await requestExplorerAction({
    title: `Move “${session.title}”`,
    label: 'Location',
    options: [
      { value: '', label: 'Workspace root' },
      ...folders.map(folder => ({ value: folder.id, label: explorerFolderPath(folder, folders) })),
    ],
    confirmLabel: 'Move',
  });
  if (folderId == null) return;
  await flushActiveExplorerSession(session);
  const current = await workspaceStore.getSession(session.id);
  if (!current) return refreshExplorer();
  const updated = await workspaceStore.updateSession(current.id, current.revision, {
    folderId: folderId || null,
  });
  if (sessionController.activeSessions[session.type]?.id === session.id) sessionController.activeSessions[session.type] = updated;
  await refreshExplorer();
}

function explorerFolderPath(folder, folders) {
  const byId = new Map(folders.map(item => [item.id, item]));
  const parts = [folder.name];
  const seen = new Set([folder.id]);
  let parentId = folder.parentFolderId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    parentId = parent.parentFolderId;
  }
  return parts.join(' / ');
}

async function saveCurrentAsCopy() {
  const type = modeManager.isXpath ? 'xpath' : 'xslt';
  const active = sessionController.activeSessions[type];
  const temporaryTitle = sessionController.getTemporaryTitle(type);
  const suggested = active ? `${active.title} Copy` : temporaryTitle || (type === 'xpath' ? 'Untitled XPath Query' : 'Untitled XSLT Mapping');
  const workspaceId = active?.workspaceId || 'workspace-default';
  const folders = await workspaceStore.listFolders(workspaceId);
  const result = await requestExplorerAction({
    title: 'Save current work',
    label: 'Name',
    value: suggested,
    options: folders.length ? [
      { value: '', label: 'Workspace root' },
      ...folders.map(folder => ({ value: folder.id, label: explorerFolderPath(folder, folders) })),
    ] : null,
    optionValue: active?.folderId || '',
    includeInput: folders.length > 0,
    confirmLabel: 'Save',
  });
  if (result == null) return null;
  const title = typeof result === 'object' ? result.value : result;
  const folderId = typeof result === 'object' ? result.option || null : active?.folderId || null;
  await flushPendingSave();
  const source = sessionController.serializeDrafts()[type].source;
  const record = await workspaceStore.createSession({
    type,
    workspaceId,
    folderId,
    title,
    source,
  });
  sessionController.activateNamedSession(record);
  await refreshExplorer();
  clog(`Saved current work as “${record.title}” ✓`, 'success');
  return record;
}

async function renameExplorerSession(session) {
  const title = await requestExplorerAction({ title: 'Rename saved item', label: 'Name', value: session.title, confirmLabel: 'Rename' });
  if (title == null || title === session.title) return;
  await flushActiveExplorerSession(session);
  const current = await workspaceStore.getSession(session.id);
  if (!current) { await refreshExplorer(); return; }
  const updated = await workspaceStore.updateSession(current.id, current.revision, { title });
  if (sessionController.activeSessions[session.type]?.id === session.id) sessionController.activateNamedSession(updated);
  await refreshExplorer();
}

async function duplicateExplorerSession(session) {
  await flushActiveExplorerSession(session);
  const copy = await workspaceStore.duplicateSession(session.id, `${session.title} Copy`);
  await sessionController.restoreSession(copy);
  await refreshExplorer();
}

async function duplicateCurrentSession() {
  const current = sessionController.getCurrentSession();
  if (current) await duplicateExplorerSession(current);
}

function syncSessionMenuState() {
  const duplicate = document.getElementById('sessionMenuDuplicate');
  if (duplicate) duplicate.disabled = !sessionController?.getCurrentSession();
}

function toggleSessionMenu(force) {
  const menu = document.getElementById('sessionMenu');
  const trigger = document.getElementById('sessionMenuTrigger');
  if (!menu || !trigger) return;
  const open = typeof force === 'boolean' ? force : menu.hidden;
  menu.hidden = !open;
  trigger.setAttribute('aria-expanded', String(open));
  if (open) {
    syncSessionMenuState();
    requestAnimationFrame(() => menu.querySelector('button:not(:disabled)')?.focus());
  }
}


async function toggleSessionFavorite(session) {
  await flushActiveExplorerSession(session);
  const current = await workspaceStore.getSession(session.id);
  if (!current) { await refreshExplorer(); return; }
  const updated = await workspaceStore.updateSession(current.id, current.revision, { favorite: !current.favorite });
  if (sessionController.activeSessions[session.type]?.id === session.id) sessionController.activeSessions[session.type] = updated;
  await refreshExplorer();
}

async function trashExplorerSession(session) {
  if (!await requestExplorerAction({ title: 'Move saved item to Trash?', message: `Move “${session.title}” to Trash?`, label: null, confirmLabel: 'Move to Trash', danger: true })) return;
  await flushActiveExplorerSession(session);
  const current = await workspaceStore.getSession(session.id);
  if (!current) { await refreshExplorer(); return; }
  const wasActive = sessionController.activeSessions[session.type]?.id === session.id;
  await workspaceStore.moveSessionToTrash(current.id, current.revision);
  if (wasActive) await sessionController.restoreModeDraft(session.type);
  await refreshExplorer();
}

document.addEventListener('DOMContentLoaded', async () => {
  const [open, savedWidth] = await Promise.all([
    workspaceStore.getSetting('explorerOpen', true).catch(() => true),
    workspaceStore.getSetting('explorerWidth', 260).catch(() => 260),
  ]);
  const explorer = document.getElementById('workspaceExplorer');
  if (explorer) explorer.style.width = `${Math.max(220, Math.min(360, Number(savedWidth) || 260))}px`;
  toggleExplorer(open);
  document.getElementById('explorerSearch')?.addEventListener('input', () => void refreshExplorer());
  if (explorer && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(entries => {
      if (window.innerWidth < 900 || !explorer.classList.contains('open')) return;
      const width = Math.round(entries[0].target.getBoundingClientRect().width);
      if (width < 220 || width > 360) return;
      clearTimeout(explorerResizeTimer);
      explorerResizeTimer = setTimeout(() => {
        void workspaceStore.setSetting('explorerWidth', width).catch(() => {});
      }, 250);
    }).observe(explorer);
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.getElementById('sessionMenu')?.hidden) {
    toggleSessionMenu(false);
    document.getElementById('sessionMenuTrigger')?.focus();
    return;
  }
  const explorer = document.getElementById('workspaceExplorer');
  const overlayOpen = window.innerWidth < 900 && explorer?.classList.contains('open');
  if (overlayOpen && event.key === 'Escape') {
    event.preventDefault();
    toggleExplorer(false);
    return;
  }
  if (overlayOpen && event.key === 'Tab') {
    const focusable = [...explorer.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0);
    if (focusable.length) {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLocaleLowerCase() === 'b') {
    if (!document.activeElement?.closest('.monaco-editor')) { event.preventDefault(); toggleExplorer(); }
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLocaleLowerCase() === 'e') {
    event.preventDefault();
    toggleExplorer();
  }
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === ',') {
    event.preventDefault();
    openWorkspaceSettings();
  }
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === '/') {
    const inEditor = document.activeElement?.closest('.monaco-editor');
    if (!inEditor) { event.preventDefault(); openHelpModal(); }
  }
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLocaleLowerCase() === 's') {
    event.preventDefault();
    const active = sessionController.getCurrentSession();
    if (active) void flushPendingSave().catch(() => {});
    else void saveCurrentAsCopy();
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLocaleLowerCase() === 's') {
    event.preventDefault();
    void saveCurrentAsCopy();
  }
});

document.addEventListener('click', event => {
  if (!event.target.closest('.current-item')) toggleSessionMenu(false);
  if (!event.target.closest('.explorer-row-menu-wrap')) _closeExplorerMenus();
});
