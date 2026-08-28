// Word wrap state per editor — off by default.
const _wrapState = { xml: false, xslt: false, out: false };

function _getPaneEd(which) {
  return which === 'xml'  ? eds.xml
       : which === 'xslt' ? eds.xslt
       : eds.out;
}

function toggleWordWrap(which) {
  const ed = _getPaneEd(which);
  if (!ed) return;
  _wrapState[which] = !_wrapState[which];
  ed.updateOptions({ wordWrap: _wrapState[which] ? 'on' : 'off' });
  const btnId = which === 'xml' ? 'wrapToggleXml' : which === 'xslt' ? 'wrapToggleXslt' : 'wrapToggleOut';
  document.getElementById(btnId)?.classList.toggle('active', _wrapState[which]);
  clog(`${which.toUpperCase()} word wrap ${_wrapState[which] ? 'on' : 'off'}`, 'info');
}

function clearPane(which) {
  if (which === 'xml') {
    // Clear both XML models — content otherwise reappears on mode switch.
    if (xmlModelXslt) xmlModelXslt.setValue('');
    if (xmlModelXpath) xmlModelXpath.setValue('');
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
  if (which === 'xslt' && eds.xslt) {
    monaco.editor.setModelMarkers(eds.xslt.getModel(), 'xsltdebugx', []);
    if (xsltDecorations) { xsltDecorations.clear(); xsltDecorations = null; }
    setStatus('Ready', 'ok');
  }
  if (which === 'out') renderOutputKV({}, {});
  scheduleSave();
  clog(`${which.toUpperCase()} cleared`, 'info');
}

function copyPane(which) {
  const ed = _getPaneEd(which);
  const v  = ed?.getValue() ?? '';
  const label = which.toUpperCase();
  if (!v.trim()) return clog(`${label} pane is empty — nothing to copy`, 'warn');

  const sizeKB = (v.length / 1024).toFixed(1);
  _clipboardWrite(v, () => {
    clog(`${label} copied to clipboard ✓`, 'success');
    showCopyToast(`✓ Copied ${label} (${sizeKB}KB)`);
  });
}

// XML token regex — cached at module scope.
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
    // PI, comments, CDATA — all start with '<!' or '<?'
    const isPI        = tok.startsWith('<?') || tok.startsWith('<!--') || tok.startsWith('<!');

    if (isClose) {
      depth = Math.max(0, depth - 1);
      out += INDENT.repeat(depth) + tok + '\n';
    } else if (isSelfClose || isPI) {
      out += INDENT.repeat(depth) + tok + '\n';
    } else if (!tok.startsWith('<')) {
      // Text node not already consumed inline — render at current depth.
      out += INDENT.repeat(depth) + tok.trim() + '\n';
    } else {
      // Open tag — look ahead to decide inline vs block formatting.
      const nextTok  = tokens[i + 1];
      const afterTok = tokens[i + 2];

      if (nextTok && nextTok.startsWith('</')) {
        // <tag></tag> — inline empty element
        out += INDENT.repeat(depth) + tok + nextTok + '\n';
        i += 1;
      } else if (nextTok && !nextTok.startsWith('<') && afterTok && afterTok.startsWith('</')) {
        // <tag>text</tag> — inline single text child
        out += INDENT.repeat(depth) + tok + nextTok.trim() + afterTok + '\n';
        i += 2;
      } else if (nextTok && (nextTok.startsWith('<![CDATA[') || nextTok.startsWith('<!--')) && afterTok && afterTok.startsWith('</')) {
        // <tag><![CDATA[...]]></tag> or <tag><!--...--></tag> — keep inline
        out += INDENT.repeat(depth) + tok + nextTok + afterTok + '\n';
        i += 2;
      } else {
        // Check if this is a mixed-content element (text + child elements at
        // the IMMEDIATE child level only — depth 1 relative to current open tag).
        let scanDepth = 1;
        let j = i + 1;
        let hasText = false;
        let hasChildren = false;
        while (j < tokens.length && scanDepth > 0) {
          const t = tokens[j];
          if (t.startsWith('</')) {
            scanDepth--;
            if (scanDepth === 0) break;
          } else if (t.startsWith('<') && !t.endsWith('/>') && !t.startsWith('<?') && !t.startsWith('<!--') && !t.startsWith('<!')) {
            if (scanDepth === 1) hasChildren = true;
            scanDepth++;
          } else if (!t.startsWith('<') && t.trim() && scanDepth === 1) {
            hasText = true;
          }
          j++;
        }
        const hasMixed = hasText && hasChildren;
        if (hasMixed) {
          // Mixed content — render entire element on one line
          let line = INDENT.repeat(depth) + tok;
          for (let k = i + 1; k <= j; k++) {
            line += tokens[k] ?? '';
          }
          out += line + '\n';
          i = j;
        } else if (nextTok && !nextTok.startsWith('<')) {
          // Open tag followed by text, then more children — render text inline with tag
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
  const ed = _getPaneEd(which);
  if (!ed) return;
  const wasReadOnly = ed.getRawOptions().readOnly;
  if (wasReadOnly) ed.updateOptions({ readOnly: false });
  const formatted = prettyXML(ed.getValue());
  // Formatting doesn't change validity — skip the live-validation debounce.
  _suppress.validation = true;
  // Use executeEdits, not setValue, so Format pushes a single bracketed step
  // onto the undo stack and Ctrl+Z reverts only the format.
  ed.pushUndoStop();
  ed.executeEdits('format', [{ range: ed.getModel().getFullModelRange(), text: formatted }]);
  ed.pushUndoStop();
  if (wasReadOnly) ed.updateOptions({ readOnly: true });
  scheduleSave();
  clog(`${which.toUpperCase()} formatted`, 'info');
}
