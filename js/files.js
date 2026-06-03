function triggerUpload(pane) {
  const id = pane === 'xml' ? 'uploadXml' : 'uploadXslt';
  document.getElementById(id).value = ''; // reset so same file can be re-uploaded
  document.getElementById(id).click();
}

// `verb` lets the caller distinguish "Uploaded" from "Dropped" while keeping routing identical.
function _applyFileContent(text, file, pane, verb) {
  const sizeKB = formatFileSize(file.size);
  if (pane === 'xml') {
    const targetModel = modeManager.currentModel;
    if (!targetModel) { clog('Editor not ready — cannot upload file', 'error'); return; }
    targetModel.setValue(text);
  } else if (eds.xslt) {
    eds.xslt.setValue(text);
  } else {
    clog('Editor not ready — cannot upload file', 'error');
    return;
  }
  scheduleSave();
  clog(`${verb}: ${file.name} (${sizeKB} KB) → ${pane.toUpperCase()} pane`, 'success');
}

function handleUpload(event, pane) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload  = e => _applyFileContent(e.target.result, file, pane, 'Uploaded');
  reader.onerror = e => clog(`Failed to read file: ${file.name} (${e.target.error?.name ?? 'unknown error'})`, 'error');
  reader.readAsText(file);
}

function downloadPane(pane, defaultName) {
  const ed = _getPaneEd(pane);
  const text = ed?.getValue()?.trim();
  if (!text) { clog(`${pane.toUpperCase()} pane is empty — nothing to download`, 'warn'); return; }
  const ext = defaultName.split('.').pop() || 'xml';
  const mimeMap = { xml: 'application/xml', xsl: 'application/xml', xslt: 'application/xml', json: 'application/json', txt: 'text/plain' };
  const mime = mimeMap[ext] || 'text/plain';
  const blob = new Blob([text], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = defaultName;
  a.click();
  // Defer for Safari: synchronous revocation can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  clog(`Downloaded: ${defaultName}`, 'success');
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
  document.addEventListener('dragend', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (pane === 'out') { clog('Cannot drop onto Output pane', 'warn'); return; }
    const reader = new FileReader();
    reader.onload  = ev => _applyFileContent(ev.target.result, file, pane, 'Dropped');
    reader.onerror = e  => clog(`Failed to read dropped file: ${file.name} (${e.target.error?.name ?? 'unknown error'})`, 'error');
    reader.readAsText(file);
  });
}

