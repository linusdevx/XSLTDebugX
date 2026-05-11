// ════════════════════════════════════════════
//  FILE UPLOAD / DOWNLOAD
// ════════════════════════════════════════════

function triggerUpload(pane) {
  const id = pane === 'xml' ? 'uploadXml' : 'uploadXslt';
  document.getElementById(id).value = ''; // reset so same file can be re-uploaded
  document.getElementById(id).click();
}

function handleUpload(event, pane) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    if (pane === 'xml') {
      // Route to the currently active XML model based on mode
      const targetModel = modeManager.currentModel;
      if (targetModel) {
        targetModel.setValue(text);
        scheduleSave();
        clog(`Uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB) → ${pane.toUpperCase()} pane`, 'success');
      } else {
        clog('Editor not ready — cannot upload file', 'error');
      }
    } else if (eds.xslt) {
      eds.xslt.setValue(text);
      scheduleSave();
      clog(`Uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB) → ${pane.toUpperCase()} pane`, 'success');
    } else {
      clog('Editor not ready — cannot upload file', 'error');
    }
  };
  reader.onerror = e => clog(`Failed to read file: ${file.name} (${e.target.error?.name ?? 'unknown error'})`, 'error');
  reader.readAsText(file);
}

function downloadPane(pane, defaultName) {
  const ed = pane === 'xml' ? eds.xml : pane === 'xslt' ? eds.xslt : eds.out;
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
  URL.revokeObjectURL(url);
  clog(`Downloaded: ${defaultName}`, 'success');
}

// ── Drag & Drop onto each editor pane ──
function setupDragDrop(editorWrapId, pane) {
  const el = document.getElementById(editorWrapId);
  if (!el) return;

  el.addEventListener('dragover', e => {
    e.preventDefault();
    el.classList.add('drag-over');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (pane === 'out') { clog('Cannot drop onto Output pane', 'warn'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      if (pane === 'xml') {
        // Route to the currently active XML model based on mode
        const targetModel = modeManager.currentModel;
        if (targetModel) {
          targetModel.setValue(ev.target.result);
          scheduleSave();
          clog(`Dropped: ${file.name} (${(file.size / 1024).toFixed(1)} KB) → ${pane.toUpperCase()} pane`, 'success');
        } else {
          clog('Editor not ready — cannot upload file', 'error');
        }
      } else if (eds.xslt) {
        eds.xslt.setValue(ev.target.result);
        scheduleSave();
        clog(`Dropped: ${file.name} (${(file.size / 1024).toFixed(1)} KB) → ${pane.toUpperCase()} pane`, 'success');
      } else {
        clog('Editor not ready — cannot upload file', 'error');
      }
    };
    reader.onerror = e => clog(`Failed to read dropped file: ${file.name} (${e.target.error?.name ?? 'unknown error'})`, 'error');
    reader.readAsText(file);
  });
}

