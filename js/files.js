function triggerUpload(pane) {
  const id = pane === 'xml' ? 'uploadXml' : 'uploadXslt';
  document.getElementById(id).value = ''; // reset so same file can be re-uploaded
  document.getElementById(id).click();
}

const USER_TEXT_FILE_MAX_BYTES = 25 * 1024 * 1024;

function validateUserTextFile(file) {
  if (!file || !Number.isFinite(file.size) || file.size < 0) throw new Error('The selected file is invalid.');
  if (file.size > USER_TEXT_FILE_MAX_BYTES) throw new Error('File exceeds the 25 MiB editor limit.');
}

function reportFileIngressError(file, error) {
  const name = file?.name || 'File';
  clog(`${name} could not be opened: ${error.message}`, 'error');
  if (typeof showCopyToast === 'function') showCopyToast(`${name} could not be opened: ${error.message}`, 3500, 'error');
}

// `verb` lets the caller distinguish "Uploaded" from "Dropped" while keeping routing identical.
async function _applyFileContent(text, file, pane, verb) {
  try { validateUserTextFile(file); }
  catch (error) { reportFileIngressError(file, error); return; }
  if (typeof text !== 'string' || text.includes('\0')) {
    reportFileIngressError(file, new Error('Only text XML/XSLT files are supported.'));
    return;
  }
  const fileSize = formatFileSize(file.size);
  try {
    await flushPendingSave();
  } catch (error) {
    clog(`Could not save the current item before opening ${file.name}: ${error.message}`, 'error');
    return;
  }
  if (pane === 'xslt' && modeManager.isXpath) modeManager.setMode('XSLT');
  sessionController.beginTemporary(
    modeManager.isXpath ? 'xpath' : 'xslt',
    file.name.replace(/\.(xml|xsl|xslt|txt)$/i, '') || file.name,
  );
  if (pane === 'xml') {
    const targetModel = modeManager.currentModel;
    if (!targetModel) { clog('Editor not ready — cannot upload file', 'error'); return; }
    _withSuppress(['save', 'validation'], () => targetModel.setValue(text));
  } else if (eds.xslt) {
    _withSuppress(['save', 'validation'], () => eds.xslt.setValue(text));
  } else {
    clog('Editor not ready — cannot upload file', 'error');
    return;
  }
  setSaveIndicator('temporary');
  clog(`${verb}: ${file.name} (${fileSize}) → ${pane.toUpperCase()} pane`, 'success');
}

function handleUpload(event, pane) {
  const file = event.target.files[0];
  if (!file) return;
  try { validateUserTextFile(file); }
  catch (error) {
    event.target.value = '';
    reportFileIngressError(file, error);
    return;
  }
  const reader = new FileReader();
  reader.onload  = e => { void _applyFileContent(e.target.result, file, pane, 'Uploaded'); };
  reader.onerror = e => clog(`Failed to read file: ${file.name} (${e.target.error?.name ?? 'unknown error'})`, 'error');
  reader.readAsText(file);
}

function _sessionDownloadName(defaultName) {
  const title = window.sessionController?.getCurrentSession()?.title
    || window.sessionController?._quickTitle?.();
  if (!title) return defaultName;
  const ext = defaultName.split('.').pop() || 'xml';
  const slug = title.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug ? `${slug}.${ext}` : defaultName;
}

function downloadPane(pane, defaultName) {
  const ed = _getPaneEd(pane);
  const text = ed?.getValue()?.trim();
  if (!text) { clog(`${pane.toUpperCase()} pane is empty — nothing to download`, 'warn'); return; }
  const filename = _sessionDownloadName(defaultName);
  const ext = filename.split('.').pop() || 'xml';
  const mimeMap = { xml: 'application/xml', xsl: 'application/xml', xslt: 'application/xml', json: 'application/json', txt: 'text/plain' };
  const mime = mimeMap[ext] || 'text/plain';
  const blob = new Blob([text], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  // Defer for Safari: synchronous revocation can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  clog(`Downloaded: ${filename}`, 'success');
}

function setupDragDrop(editorWrapId, pane) {
  const el = document.getElementById(editorWrapId);
  if (!el) return;

  el.addEventListener('dragover', e => {
    e.preventDefault();
    el.classList.add('drag-over');
  });
  // Monaco's wrapper has many nested children; dragleave fires on every internal
  // boundary. Only clear when the pointer actually leaves the wrapper.
  el.addEventListener('dragleave', e => {
    if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over');
  });
  el.addEventListener('dragend', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (pane === 'out') { clog('Cannot drop onto Output pane', 'warn'); return; }
    try { validateUserTextFile(file); }
    catch (error) { reportFileIngressError(file, error); return; }
    const reader = new FileReader();
    reader.onload  = ev => { void _applyFileContent(ev.target.result, file, pane, 'Dropped'); };
    reader.onerror = e  => clog(`Failed to read dropped file: ${file.name} (${e.target.error?.name ?? 'unknown error'})`, 'error');
    reader.readAsText(file);
  });
}

