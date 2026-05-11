// ════════════════════════════════════════════
//  PANE OPERATIONS
// ════════════════════════════════════════════

// Track word wrap state per editor — off by default
const _wrapState = { xml: false, xslt: false, out: false };

function toggleWordWrap(which) {
  const ed = which === 'xml' ? eds.xml : which === 'xslt' ? eds.xslt : eds.out;
  if (!ed) return;
  _wrapState[which] = !_wrapState[which];
  ed.updateOptions({ wordWrap: _wrapState[which] ? 'on' : 'off' });
  const btnId = which === 'xml' ? 'wrapToggleXml' : which === 'xslt' ? 'wrapToggleXslt' : 'wrapToggleOut';
  document.getElementById(btnId)?.classList.toggle('active', _wrapState[which]);
  clog(`${which.toUpperCase()} word wrap ${_wrapState[which] ? 'on' : 'off'}`, 'info');
}

function clearPane(which) {
  if (which === 'xml') {
    // Clear both XML models to prevent content reappearing on mode switch
    if (xmlModelXslt) xmlModelXslt.setValue('');
    if (xmlModelXpath) xmlModelXpath.setValue('');
    // Clear markers on both models
    if (xmlModelXslt)  monaco.editor.setModelMarkers(xmlModelXslt,  'xsltdebugx', []);
    if (xmlModelXpath) monaco.editor.setModelMarkers(xmlModelXpath, 'xsltdebugx', []);
    if (xmlDecorations)  { xmlDecorations.clear();  xmlDecorations  = null; }
    setStatus('Ready', 'ok');
    scheduleSave();
    clog('XML cleared', 'info');
    return;
  }
  
  const ed = which === 'xslt' ? eds.xslt : eds.out;
  if (!ed) return;
  const wasReadOnly = ed.getRawOptions().readOnly;
  if (wasReadOnly) ed.updateOptions({ readOnly: false });
  ed.setValue('');
  if (wasReadOnly) ed.updateOptions({ readOnly: true });
  // Clear error markers from this pane
  if (which === 'xslt' && eds.xslt) {
    monaco.editor.setModelMarkers(eds.xslt.getModel(), 'xsltdebugx', []);
    if (xsltDecorations) { xsltDecorations.clear(); xsltDecorations = null; }
    setStatus('Ready', 'ok');
  }
  // Clear output KV panels when output is cleared
  if (which === 'out') renderOutputKV({}, {});
  scheduleSave();
  clog(`${which.toUpperCase()} cleared`, 'info');
}

function copyPane(which) {
  const ed = which === 'xml' ? eds.xml : which === 'xslt' ? eds.xslt : eds.out;
  const v  = ed?.getValue() ?? '';
  const label = which.toUpperCase();
  if (!v.trim()) return clog(`${label} pane is empty — nothing to copy`, 'warn');

  const sizeKB = (v.length / 1024).toFixed(1);
  const onSuccess = () => {
    clog(`${label} copied to clipboard ✓`, 'success');
    showCopyToast(`✓ Copied ${label} (${sizeKB}KB)`);
  };
  const onFail    = () => {
    const ta = document.createElement('textarea');
    ta.value = v;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = (() => { try { return document.execCommand('copy'); } catch(_) { return false; } })();
    if (ok) console.info('[clipboard] used execCommand fallback');
    document.body.removeChild(ta);
    ok ? onSuccess() : clog('Clipboard access denied', 'error');
  };

  if (window.navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(v).then(onSuccess, onFail);
  } else {
    onFail();
  }
}

// ── XML Token regex — cached at module scope for performance ──
const _ATTR_VAL   = `"[^"]*"|'[^']*'`;
const _TAG_INNER  = `(?:${_ATTR_VAL}|[^<>])*`;
const _TOKEN_RE   = new RegExp(
  `<\\?[\\s\\S]*?\\?>` +
  `|<!--[\\s\\S]*?-->` +
  `|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>` +
  `|</${_TAG_INNER}>` +
  `|<${_TAG_INNER}>` +
  `|[^<]+`,
  'g'
);

function _tokenizeXML(xml) {
  return (xml.replace(/>\s+</g, '><').trim()).match(_TOKEN_RE) || [];
}

function _indentTokens(tokens) {
  const INDENT = '  ';
  let out = '';
  let depth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok.trim()) continue;

    const isClose     = tok.startsWith('</');
    const isSelfClose = !isClose && tok.endsWith('/>');
    const isPI        = tok.startsWith('<?') || tok.startsWith('<!--') || tok.startsWith('<!');

    if (isClose) {
      depth = Math.max(0, depth - 1);
      out += INDENT.repeat(depth) + tok + '\n';
    } else if (isSelfClose || isPI) {
      out += INDENT.repeat(depth) + tok + '\n';
    } else if (!tok.startsWith('<')) {
      out += INDENT.repeat(depth) + tok.trim() + '\n';
    } else {
      const nextTok  = tokens[i + 1];
      const afterTok = tokens[i + 2];

      if (nextTok && nextTok.startsWith('</')) {
        out += INDENT.repeat(depth) + tok + nextTok + '\n';
        i += 1;
      } else if (nextTok && !nextTok.startsWith('<') && afterTok && afterTok.startsWith('</')) {
        out += INDENT.repeat(depth) + tok + nextTok.trim() + afterTok + '\n';
        i += 2;
      } else if (nextTok && !nextTok.startsWith('<')) {
        const trimmed = nextTok.trim();
        out += INDENT.repeat(depth) + tok + (trimmed ? trimmed + ' ' : '') + '\n';
        depth++;
        i += 1;
      } else {
        out += INDENT.repeat(depth) + tok + '\n';
        depth++;
      }
    }
  }
  return out.trim();
}

function prettyXML(xml) {
  try {
    return _indentTokens(_tokenizeXML(xml));
  } catch(e) {
    return xml;
  }
}

function fmtEditor(which) {
  const ed = which === 'xml'  ? eds.xml
           : which === 'xslt' ? eds.xslt
           : eds.out;
  if (!ed) return;
  const wasReadOnly = ed.getRawOptions().readOnly;
  if (wasReadOnly) ed.updateOptions({ readOnly: false });
  const formatted = prettyXML(ed.getValue());
  // Suppress the live-validation debounce — formatting doesn't change validity
  _suppressNextValidation = true;
  // Use executeEdits instead of setValue so the format is pushed onto Monaco's undo
  // stack as a single bracketed step — Ctrl+Z undoes the format without wiping
  // the edit history that existed before Format was applied.
  ed.pushUndoStop();
  ed.executeEdits('format', [{ range: ed.getModel().getFullModelRange(), text: formatted }]);
  ed.pushUndoStop();
  if (wasReadOnly) ed.updateOptions({ readOnly: true });
  scheduleSave();
  clog(`${which.toUpperCase()} formatted`, 'info');
}

// Flag read by debounce handlers to skip one validation cycle after Format
let _suppressNextValidation = false;