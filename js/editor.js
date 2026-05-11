// ════════════════════════════════════════════
//  MONACO INIT
// ════════════════════════════════════════════
require.config({
  paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }
});

document.getElementById('loadTxt').textContent = 'Loading Monaco Editor…';

// Parse share hash immediately — before editors exist — so _pendingShareData is
// set before editors initialize below.
loadFromShareHash();

require(['vs/editor/editor.main'], () => {
  document.getElementById('loadTxt').textContent = 'Defining theme…';

  const _darkThemeDef = {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // XML structure
      { token: 'delimiter.xml',         foreground: '4a6080' },           // < > / =  — muted steel
      { token: 'metatag.xml',           foreground: 'f472b6' },           // <?xml ?>  — pink

      // Tags & attribute names — base colors (inline decorations override these per-element)
      { token: 'tag',                   foreground: '56b6c2', fontStyle: 'bold' },
      { token: 'tag.id.pug',            foreground: '56b6c2' },
      { token: 'attribute.name',        foreground: 'c084fc' },  // lavender — matches xml-attr-name
      { token: 'attribute.name.html',   foreground: 'c084fc' },

      // Attribute values / strings — soft lime green
      { token: 'attribute.value',       foreground: 'a8e06a' },
      { token: 'attribute.value.html',  foreground: 'a8e06a' },
      { token: 'string',                foreground: 'a8e06a' },
      { token: 'string.xml',            foreground: 'a8e06a' },

      // XSL-specific: namespace prefixes in attribute values
      { token: 'attribute.value.xpath', foreground: 'fbbf24' },           // XPath expressions — amber

      // Comments — dim and italic
      { token: 'comment',               foreground: '3d5470', fontStyle: 'italic' },
      { token: 'comment.xml',           foreground: '3d5470', fontStyle: 'italic' },

      // Numbers
      { token: 'number',                foreground: 'e8c56d' },

      // CDATA / entities
      { token: 'entity.xml',            foreground: 'c084fc' },           // purple
    ],
    colors: {
      'editor.background':                  '#070c14',
      'editor.foreground':                  '#c8d8e8',
      'editorLineNumber.foreground':        '#1e3050',
      'editorLineNumber.activeForeground':  '#4a70a8',
      'editor.lineHighlightBackground':     '#0c1826',
      'editor.lineHighlightBorderColor':    '#182030',
      'editorCursor.foreground':            '#0070f2',
      'editor.selectionBackground':         '#183060',
      'editor.inactiveSelectionBackground': '#10203a',
      'editorIndentGuide.background1':      '#182030',
      'editorIndentGuide.background2':      '#182030',
      'editorIndentGuide.background3':      '#182030',
      'editorIndentGuide.background4':      '#182030',
      'editorIndentGuide.background5':      '#182030',
      'editorIndentGuide.background6':      '#182030',
      'editorIndentGuide.activeBackground1':'#1e3050',
      'editorIndentGuide.activeBackground2':'#1e3050',
      'editorIndentGuide.activeBackground3':'#1e3050',
      'editorIndentGuide.activeBackground4':'#1e3050',
      'editorIndentGuide.activeBackground5':'#1e3050',
      'editorIndentGuide.activeBackground6':'#1e3050',
      'editorBracketHighlight.foreground1': '#2e6db4',
      'editorBracketHighlight.foreground2': '#2e8b4a',
      'editorBracketHighlight.foreground3': '#b47a2e',
      'editorBracketHighlight.foreground4': '#7a2eb4',
      'editorBracketHighlight.foreground5': '#2eb4b4',
      'editorBracketHighlight.foreground6': '#b42e5a',
      'scrollbarSlider.background':         '#182030aa',
      'scrollbarSlider.hoverBackground':    '#1e3050aa',
      'editorWidget.background':            '#0d1420',
      'input.background':                   '#0a1020',
      'dropdown.background':                '#0d1420',
    }
  };

  const _lightThemeDef = {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'tag',                   foreground: '0550ae', fontStyle: 'bold' },
      { token: 'tag.id.pug',            foreground: '0550ae' },
      { token: 'attribute.name',        foreground: '116329' },
      { token: 'attribute.name.html',   foreground: '116329' },
      { token: 'attribute.value',       foreground: '0a3069' },
      { token: 'attribute.value.html',  foreground: '0a3069' },
      { token: 'attribute.value.xpath', foreground: 'b45309' },  // XPath expressions — amber (dark)
      { token: 'string',                foreground: '0a3069' },
      { token: 'string.xml',            foreground: '0a3069' },
      { token: 'delimiter.xml',         foreground: '8090a0' },
      { token: 'metatag.xml',           foreground: 'a626a4' },
      { token: 'comment',               foreground: '6a737d', fontStyle: 'italic' },
      { token: 'comment.xml',           foreground: '6a737d', fontStyle: 'italic' },
      { token: 'number',                foreground: 'b5521a' },
      { token: 'entity.xml',            foreground: '6f42c1' },  // purple
    ],
    colors: {
      'editor.background':                  '#ffffff',
      'editor.foreground':                  '#1a2535',
      'editorLineNumber.foreground':        '#c0cfe0',
      'editorLineNumber.activeForeground':  '#6080a0',
      'editor.lineHighlightBackground':     '#f0f6ff',
      'editor.lineHighlightBorderColor':    '#d8e8f8',
      'editorCursor.foreground':            '#0070f2',
      'editor.selectionBackground':         '#b8d4f8',
      'editor.inactiveSelectionBackground': '#d8e8f8',
      'editorIndentGuide.background1':      '#e0e8f0',
      'editorIndentGuide.background2':      '#e0e8f0',
      'editorIndentGuide.background3':      '#e0e8f0',
      'editorIndentGuide.background4':      '#e0e8f0',
      'editorIndentGuide.background5':      '#e0e8f0',
      'editorIndentGuide.background6':      '#e0e8f0',
      'editorIndentGuide.activeBackground1':'#b0c4d8',
      'editorIndentGuide.activeBackground2':'#b0c4d8',
      'editorIndentGuide.activeBackground3':'#b0c4d8',
      'editorIndentGuide.activeBackground4':'#b0c4d8',
      'editorIndentGuide.activeBackground5':'#b0c4d8',
      'editorIndentGuide.activeBackground6':'#b0c4d8',
      'editorBracketHighlight.foreground1': '#2e6db4',
      'editorBracketHighlight.foreground2': '#1a7f37',
      'editorBracketHighlight.foreground3': '#c87800',
      'editorBracketHighlight.foreground4': '#6f42c1',
      'editorBracketHighlight.foreground5': '#0969a0',
      'editorBracketHighlight.foreground6': '#cf222e',
      'scrollbarSlider.background':         '#c0cfe0aa',
      'scrollbarSlider.hoverBackground':    '#a8bcd4aa',
      'editorWidget.background':            '#f0f4f8',
      'input.background':                   '#ffffff',
      'dropdown.background':                '#f0f4f8',
    }
  };

  monaco.editor.defineTheme('xdebugx',       _darkThemeDef);
  monaco.editor.defineTheme('xdebugx-light', _lightThemeDef);

  // Apply saved theme to Monaco if light was restored from localStorage
  if (document.body.classList.contains('light')) {
    monaco.editor.setTheme('xdebugx-light');
  }

  // Override XML language to remove <> auto-close (our custom handler does tags)
  monaco.languages.setLanguageConfiguration('xml', {
    autoClosingPairs: [],
    surroundingPairs: [],
  });

  const shared = {
    theme: document.body.classList.contains('light') ? 'xdebugx-light' : 'xdebugx',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: 13,
    lineHeight: 22,
    minimap: { enabled: false },
    glyphMargin: true,
    lineNumbersMinChars: 2,
    lineDecorationsWidth: 6,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    folding: true,
    renderLineHighlight: 'all',
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true },
    guides: { bracketPairs: 'active', indentation: true, highlightActiveIndentation: true },
    padding: { top: 10, bottom: 10 },
    wordWrap: 'off',
    suggest: { showWords: false },
    'semanticHighlighting.enabled': true,
  };

  // ── Restore saved session (if any) ──
  // Skip session restore when a share link is pending — applyShareData handles init.
  const _savedSession = window._pendingShareData ? null : loadSavedState();

  // ── Create two XML models for mode isolation ──
  // XSLT mode model — defaults to identity transform or saved xmlXslt
  // Backwards compatibility: if only old 'xml' key exists, use it for XSLT model
  xmlModelXslt = monaco.editor.createModel(
    _savedSession?.xmlXslt ?? _savedSession?.xml ?? EXAMPLES.identityTransform.xml,
    'xml'
  );

  // XPath mode model — defaults to xpath navigation example or saved xmlXpath
  xmlModelXpath = monaco.editor.createModel(
    _savedSession?.xmlXpath ?? EXAMPLES.xpathNavigation.xml,
    'xml'
  );

  // ── Create XML editor with XSLT model initially active ──
  eds.xml = monaco.editor.create(
    document.getElementById('xmlEd'),
    { ...shared, language: 'xml', model: xmlModelXslt }
  );

  eds.xslt = monaco.editor.create(
    document.getElementById('xsltEd'),
    { ...shared, language: 'xml', value: _savedSession?.xslt ?? EXAMPLES.identityTransform.xslt }
  );

  eds.out = monaco.editor.create(
    document.getElementById('outEd'),
    { ...shared, language: 'xml', value: '', readOnly: true, renderValidationDecorations: 'off' }
  );

  // ── Initialize Mode Manager with model references ──
  modeManager.initializeModels(xmlModelXslt, xmlModelXpath);

  // Ctrl/Cmd+Enter → run XPath in XPath mode, run transform in XSLT mode
  [eds.xml, eds.xslt].forEach(ed => {
    ed.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {  if (modeManager.isXpath) runXPath(); else runTransform(); }
    );
  });

  // Set up drag & drop for XML and XSLT panes
  setupDragDrop('xmlEdWrap', 'xml');
  setupDragDrop('xsltEdWrap', 'xslt');

  // ── Auto-close XML tags for xml language mode ──
  // Combined auto-close handler: XML tags + bracket/quote pairs
  // Implemented manually because Monaco's built-in only works for 'html' mode.
  function setupAutoClose(editor) {
    let _inserting = false;

    const PAIRS = { '(': ')', '[': ']', '"': '"' };

    // Single onKeyDown handles: < intercept, bracket/quote pairs, skip-over
    editor.onKeyDown(e => {
      if (_inserting) return;
      const ch = e.browserEvent.key;

      // ── Block Monaco's built-in <> auto-pair ──
      if (ch === '<') {
        e.preventDefault();
        const pos = editor.getPosition();
        _inserting = true;
        editor.executeEdits('insert-lt', [{
          range: {
            startLineNumber: pos.lineNumber, startColumn: pos.column,
            endLineNumber:   pos.lineNumber, endColumn:   pos.column,
          },
          text: '<',
        }]);
        editor.setPosition({ lineNumber: pos.lineNumber, column: pos.column + 1 });
        _inserting = false;
        return;
      }

      // ── Bracket / quote pairs ──
      if (PAIRS[ch]) {
        const model = editor.getModel();
        const sel   = editor.getSelection();
        const pos   = editor.getPosition();

        // Wrap selected text
        const selectedText = sel && !sel.isEmpty() ? model.getValueInRange(sel) : null;
        if (selectedText !== null) {
          e.preventDefault();
          _inserting = true;
          editor.executeEdits('auto-pair', [{ range: sel, text: ch + selectedText + PAIRS[ch] }]);
          editor.setPosition({ lineNumber: sel.endLineNumber, column: sel.endColumn + 1 });
          _inserting = false;
          return;
        }

        // Skip over existing closing char
        const lineText = model.getLineContent(pos.lineNumber);
        const nextChar = lineText[pos.column - 1];
        if (nextChar === PAIRS[ch]) {
          e.preventDefault();
          editor.setPosition({ lineNumber: pos.lineNumber, column: pos.column + 1 });
          return;
        }

        // Insert pair
        e.preventDefault();
        _inserting = true;
        editor.executeEdits('auto-pair', [{
          range: {
            startLineNumber: pos.lineNumber, startColumn: pos.column,
            endLineNumber:   pos.lineNumber, endColumn:   pos.column,
          },
          text: ch + PAIRS[ch],
        }]);
        editor.setPosition({ lineNumber: pos.lineNumber, column: pos.column + 1 });
        _inserting = false;
        return;
      }

      // ── Skip-over ) and ] ──
      if (ch === ')' || ch === ']') {
        const pos      = editor.getPosition();
        const lineText = editor.getModel().getLineContent(pos.lineNumber);
        if (lineText[pos.column - 1] === ch) {
          e.preventDefault();
          editor.setPosition({ lineNumber: pos.lineNumber, column: pos.column + 1 });
        }
      }

      // ── Attribute = → ="" with cursor between quotes ──
      // Only fires when '=' is typed right after a word character (attribute name)
      if (ch === '=') {
        const pos      = editor.getPosition();
        const model    = editor.getModel();
        const lineText = model.getLineContent(pos.lineNumber);
        const charBefore = lineText[pos.column - 2]; // char just before cursor
        const charAfter  = lineText[pos.column - 1]; // char just after cursor

        // Only trigger inside a tag opener: prev char is word char, next is not already "
        // and there must be an unclosed '<' before the cursor on this line
        const lineUpToCursor = lineText.substring(0, pos.column - 1);
        const inTag = (lineUpToCursor.lastIndexOf('<') > lineUpToCursor.lastIndexOf('>'));
        if (/\w/.test(charBefore) && charAfter !== '"' && inTag) {
          e.preventDefault();
          _inserting = true;
          editor.executeEdits('attr-equals', [{
            range: {
              startLineNumber: pos.lineNumber, startColumn: pos.column,
              endLineNumber:   pos.lineNumber, endColumn:   pos.column,
            },
            text: '=""',
          }]);
          // Place cursor between the quotes
          editor.setPosition({ lineNumber: pos.lineNumber, column: pos.column + 2 });
          _inserting = false;
        }
      }
    });

    // ── XML auto-close tags ──
    editor.onDidChangeModelContent(ev => {
      if (_inserting) return;
      for (const change of ev.changes) {
        if (change.text !== '>') continue;
        const model    = editor.getModel();
        const pos      = editor.getPosition();
        const before   = model.getLineContent(pos.lineNumber).substring(0, pos.column - 1);
        if (!before.endsWith('>') || before.endsWith('/>')) continue;
        if (/<\/[^>]+>$/.test(before)) continue;
        // Skip if inside a comment or CDATA section
        const fullBefore = model.getValueInRange({
          startLineNumber: 1, startColumn: 1,
          endLineNumber: pos.lineNumber, endColumn: pos.column
        });
        const lastComment = fullBefore.lastIndexOf('<!--');
        const lastCommentEnd = fullBefore.lastIndexOf('-->');
        if (lastComment > lastCommentEnd) continue;
        const lastCdata = fullBefore.lastIndexOf('<![CDATA[');
        const lastCdataEnd = fullBefore.lastIndexOf(']]>');
        if (lastCdata > lastCdataEnd) continue;
        const m = before.match(/<([a-zA-Z_][a-zA-Z0-9_:.-]*)(?:\s[^>]*)?>$/);
        if (!m) continue;
        _inserting = true;
        editor.executeEdits('auto-close-tag', [{
          range: {
            startLineNumber: pos.lineNumber, startColumn: pos.column,
            endLineNumber:   pos.lineNumber, endColumn:   pos.column,
          },
          text: '</' + m[1] + '>',
          forceMoveMarkers: false,
        }]);
        editor.setPosition(pos);
        _inserting = false;
      }
    });
  }

  setupAutoClose(eds.xml);
  setupAutoClose(eds.xslt);

  // ── Custom context menu actions ───────────────────────────────────────────

  // Helper: toggle XML comment on selected lines
  function _toggleXmlComment(editor) {
    const model = editor.getModel();
    const sel   = editor.getSelection();
    const startLine = sel.startLineNumber;
    const endLine   = sel.endLineNumber;

    // Collect lines in selection
    const lines = [];
    for (let i = startLine; i <= endLine; i++) lines.push(model.getLineContent(i));

    // Detect if ALL non-empty lines are already commented
    const nonEmpty   = lines.filter(l => l.trim());
    const allCommented = nonEmpty.length > 0 &&
      nonEmpty.every(l => l.trim().startsWith('<!--') && l.trim().endsWith('-->'));

    const edits = [];
    if (allCommented) {
      // Uncomment: strip <!-- and -->
      for (let i = startLine; i <= endLine; i++) {
        const line = model.getLineContent(i);
        const stripped = line.replace(/^(\s*)<!--\s?/, '$1').replace(/\s?-->(\s*)$/, '$1');
        edits.push({ range: new monaco.Range(i, 1, i, line.length + 1), text: stripped });
      }
    } else {
      // Comment: wrap each non-empty line
      for (let i = startLine; i <= endLine; i++) {
        const line = model.getLineContent(i);
        if (!line.trim()) continue;
        edits.push({ range: new monaco.Range(i, 1, i, line.length + 1), text: `<!-- ${line} -->` });
      }
    }
    if (edits.length) editor.executeEdits('toggle-comment', edits);
  }

  // ── Minify helper: collapses whitespace outside quoted attributes ──
  function _minifyXml(src) {
    let result = src.replace(/>\s+</g, '><');
    const parts = [];
    let inDouble = false, inSingle = false;
    for (let i = 0; i < result.length; i++) {
      const ch = result[i];
      if (!inDouble && !inSingle) {
        if (ch === '"') { inDouble = true; parts.push(ch); }
        else if (ch === "'") { inSingle = true; parts.push(ch); }
        else if (/\s/.test(ch)) {
          while (i + 1 < result.length && /\s/.test(result[i + 1])) i++;
          parts.push(' ');
        } else { parts.push(ch); }
      } else {
        if (inDouble && ch === '"') inDouble = false;
        else if (inSingle && ch === "'") inSingle = false;
        parts.push(ch);
      }
    }
    return parts.join('');
  }

  // ── XML editor actions ──
  eds.xml.addAction({
    id:    'xd-format-xml',
    label: 'Format XML',
    contextMenuGroupId: '1_modification',
    contextMenuOrder: 10,
    run(ed) {
      const src = ed.getValue();
      if (!src.trim()) { clog('XML pane is empty — nothing to format', 'warn'); return; }
      const fmt = prettyXML(src);
      ed.executeEdits('format-xml', [{
        range: ed.getModel().getFullModelRange(), text: fmt
      }]);
      clog('XML formatted ✓', 'success');
    }
  });

  eds.xml.addAction({
    id:    'xd-minify-xml',
    label: 'Minify XML',
    contextMenuGroupId: '1_modification',
    contextMenuOrder: 11,
    run(ed) {
      const src = ed.getValue().trim();
      if (!src) return;
      const minified = _minifyXml(src);
      ed.executeEdits('minify-xml', [{
        range: ed.getModel().getFullModelRange(), text: minified
      }]);
      clog('XML minified ✓', 'success');
    }
  });

  eds.xml.addAction({
    id:    'xd-comment-xml',
    label: 'Comment / Uncomment Lines',
    contextMenuGroupId: '1_modification',
    contextMenuOrder: 12,
    run(ed) { _toggleXmlComment(ed); }
  });

  // ── Shared clipboard helper for XPath copy actions ──
  function _copyXPathToClipboard(xpath, label) {
    const onSuccess = () => {
      clog(`ƒx  ${label}: ${xpath}`, 'success');
      showCopyToast(`✓ ${label}`);
    };
    const onFail = () => {
      const ta = document.createElement('textarea');
      ta.value = xpath; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      const ok = (() => { try { return document.execCommand('copy'); } catch(_) { return false; } })();
      document.body.removeChild(ta);
      ok ? onSuccess() : clog('Clipboard access denied', 'error');
    };
    if (window.navigator?.clipboard?.writeText) navigator.clipboard.writeText(xpath).then(onSuccess, onFail);
    else onFail();
  }

  // ── Mode-aware handler: XSLT mode → log + copy only; XPath mode → set bar + run ──
  function _handleCopyXPath(xpath, label) {
    if (!modeManager.isXpath) {
      // XSLT mode — just log and copy, don't switch mode or run
      clog(`ƒx  ${label}: ${xpath}`, 'info');
      _copyXPathToClipboard(xpath, label);
    } else {
      // XPath mode — populate bar, run, and copy
      const input = document.getElementById('xpathInput');
      if (input) { input.value = xpath; scheduleSave(); }
      if (typeof runXPath === 'function') runXPath();
      _copyXPathToClipboard(xpath, label);
    }
  }

  eds.xml.addAction({
    id:    'xd-copy-xpath-indexed',
    label: 'Copy XPath — Exact  (e.g. /Orders/Order[2]/Amount)',
    contextMenuGroupId: '1_modification',
    contextMenuOrder: 21,
    run(ed) {
      const result = typeof getXPathAtCursor === 'function' ? getXPathAtCursor(ed) : null;
      if (!result) { clog('Could not determine XPath — place cursor inside an element', 'warn'); return; }
      _handleCopyXPath(result.indexed, 'Exact XPath copied');
    }
  });

  eds.xml.addAction({
    id:    'xd-copy-xpath-general',
    label: 'Copy XPath — General  (e.g. /Orders/Order/Amount)',
    contextMenuGroupId: '1_modification',
    contextMenuOrder: 22,
    run(ed) {
      const result = typeof getXPathAtCursor === 'function' ? getXPathAtCursor(ed) : null;
      if (!result) { clog('Could not determine XPath — place cursor inside an element', 'warn'); return; }
      _handleCopyXPath(result.general, 'General XPath copied');
    }
  });

  // ── XSLT editor actions ──
  eds.xslt.addAction({
    id:    'xd-format-xslt',
    label: 'Format XSLT',
    contextMenuGroupId: '1_modification',
    contextMenuOrder: 10,
    run(ed) {
      const src = ed.getValue();
      if (!src.trim()) { clog('XSLT pane is empty — nothing to format', 'warn'); return; }
      const fmt = prettyXML(src);
      ed.executeEdits('format-xml', [{
        range: ed.getModel().getFullModelRange(), text: fmt
      }]);
      clog('XSLT formatted ✓', 'success');
    }
  });

  eds.xslt.addAction({
    id:    'xd-minify-xslt',
    label: 'Minify XSLT',
    contextMenuGroupId: '1_modification',
    contextMenuOrder: 11,
    run(ed) {
      const src = ed.getValue().trim();
      if (!src) return;
      const minified = _minifyXml(src);
      ed.executeEdits('minify-xslt', [{
        range: ed.getModel().getFullModelRange(), text: minified
      }]);
      clog('XSLT minified ✓', 'success');
    }
  });

  eds.xslt.addAction({
    id:    'xd-comment-xslt',
    label: 'Comment / Uncomment Lines',
    contextMenuGroupId: '1_modification',
    contextMenuOrder: 12,
    run(ed) { _toggleXmlComment(ed); }
  });

  // ── CPI namespace auto-injector ──────────────────────────────────────────────
  // Called before inserting any cpi: snippet — ensures xmlns:cpi is declared
  // on the xsl:stylesheet element and removes it from exclude-result-prefixes.
  function _ensureCpiNamespace(ed) {
    const src = ed.getValue();
    if (src.includes('xmlns:cpi=')) return; // already declared

    // Inject xmlns:cpi onto xsl:stylesheet or xsl:transform opening tag
    const CPI_NS = ' xmlns:cpi="http://sap.com/it/"';
    let updated = src.replace(
      /(<xsl:(?:stylesheet|transform)\b)/,
      `$1${CPI_NS}`
    );

    // Remove 'cpi' from exclude-result-prefixes if present (it's needed now)
    // Also ensure it's NOT in exclude-result-prefixes
    updated = updated.replace(
      /(exclude-result-prefixes\s*=\s*)(["'])([^"']*)\2/g,
      (_, attr, q, val) => {
        const parts = val.split(/\s+/).filter(p => p !== 'cpi' && p !== '');
        return attr + q + parts.join(' ') + q;
      }
    );

    if (updated === src) {
      // No xsl:stylesheet found — warn but still insert snippet
      clog('⚠ Could not auto-add xmlns:cpi — add it manually to xsl:stylesheet', 'warn');
      return;
    }

    _suppressNextValidation = true;
    ed.pushUndoStop();
    ed.executeEdits('inject-cpi-ns', [{
      range: ed.getModel().getFullModelRange(),
      text: updated
    }]);
    ed.pushUndoStop();
    clog('xmlns:cpi="http://sap.com/it/" added to xsl:stylesheet ✓', 'success');
  }


  // Inserts snippet at cursor position using executeEdits so it's undoable.
  function _insertSnippet(ed, snippet) {
    const pos  = ed.getPosition();
    const line = ed.getModel().getLineContent(pos.lineNumber);
    // Detect indentation of current line and apply to snippet
    const indent = line.match(/^(\s*)/)[1];
    const indented = snippet
      .split('\n')
      .map((l, i) => i === 0 ? l : indent + l)
      .join('\n');
    ed.executeEdits('snippet', [{
      range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
      text: indented
    }]);
    ed.focus();
    clog(`Snippet inserted ✓`, 'info');
  }

  const _xsltSnippets = [
    {
      id: 'snip-for-each', order: 1,
      label: 'Snippet → xsl:for-each',
      snippet:
`<xsl:for-each select="(: sequence to iterate e.g. //Item :)">
  <xsl:value-of select="(: child element e.g. Name :)"/>
</xsl:for-each>`
    },
    {
      id: 'snip-choose', order: 2,
      label: 'Snippet → xsl:choose / when / otherwise',
      snippet:
`<xsl:choose>
  <xsl:when test="(: condition e.g. Status = 'OPEN' :)">
    <!-- logic for first condition -->
  </xsl:when>
  <xsl:when test="(: condition e.g. Status = 'CLOSED' :)">
    <!-- logic for second condition -->
  </xsl:when>
  <xsl:otherwise>
    <!-- default logic -->
  </xsl:otherwise>
</xsl:choose>`
    },
    {
      id: 'snip-if', order: 3,
      label: 'Snippet → xsl:if',
      snippet:
`<xsl:if test="(: condition e.g. Status = 'OPEN' or count(//Item) gt 0 :)">
  <!-- content -->
</xsl:if>`
    },
    {
      id: 'snip-variable', order: 4,
      label: 'Snippet → xsl:variable',
      snippet: `<xsl:variable name="(: variable name e.g. orderCount :)" select="(: XPath expression or element path :)"/>`
    },
    {
      id: 'snip-value-of', order: 5,
      label: 'Snippet → xsl:value-of',
      snippet: `<xsl:value-of select="(: XPath expression or element path :)"/>`
    },
    {
      id: 'snip-copy-of', order: 6,
      label: 'Snippet → xsl:copy-of',
      snippet: `<xsl:copy-of select="(: node or tree to copy e.g. //Order :)"/>`
    },
    {
      id: 'snip-template-named', order: 7,
      label: 'Snippet → xsl:template (named)',
      snippet:
`<xsl:template name="(: template name e.g. formatDate :)">
  <xsl:param name="(: param name e.g. inputDate :)"/>
  <!-- template content -->
</xsl:template>`
    },
    {
      id: 'snip-call-template', order: 8,
      label: 'Snippet → xsl:call-template',
      snippet:
`<xsl:call-template name="(: template name to call :)">
  <xsl:with-param name="(: param name :)" select="(: XPath expression or value :)"/>
</xsl:call-template>`
    },
    {
      id: 'snip-for-each-group', order: 9,
      label: 'Snippet → xsl:for-each-group (group-by)',
      snippet:
`<xsl:for-each-group select="(: sequence e.g. //Item :)" group-by="(: grouping key e.g. Category :)">
  <Group key="{current-grouping-key()}">
    <xsl:for-each select="current-group()">  
      <xsl:copy-of select="."/>
    </xsl:for-each>
  </Group>
</xsl:for-each-group>`
    },
    {
      id: 'snip-try-catch', order: 10,
      label: 'Snippet → xsl:try / catch',
      snippet:
`<xsl:try>
  <xsl:value-of select="(: expression that might fail e.g. xs:decimal(Amount) :)"/>
  <xsl:catch errors="(: * for all errors or specific error code e.g. err:FORG0001 :)">
    <xsl:message>Error: <xsl:value-of select="$err:description"/></xsl:message>
  </xsl:catch>
</xsl:try>`
    },
    {
      id: 'snip-cpi-set-header', order: 11,
      label: 'Snippet → cpi:setHeader',
      snippet: `<xsl:value-of select="cpi:setHeader($exchange, '(: header name e.g. ContentType :)', '(: header value or XPath :)')"/>`
    },
    {
      id: 'snip-cpi-get-header', order: 12,
      label: 'Snippet → cpi:getHeader',
      snippet: `<xsl:variable name="(: variable name :)" select="cpi:getHeader($exchange, '(: header name to read :)')"/>`
    },
    {
      id: 'snip-cpi-set-property', order: 13,
      label: 'Snippet → cpi:setProperty',
      snippet: `<xsl:value-of select="cpi:setProperty($exchange, '(: property name e.g. OrderStatus :)', '(: property value or XPath :)')"/>`
    },
    {
      id: 'snip-cpi-get-property', order: 14,
      label: 'Snippet → cpi:getProperty',
      snippet: `<xsl:variable name="(: variable name :)" select="cpi:getProperty($exchange, '(: property name to read :)')"/>`
    },
    {
      id: 'snip-param', order: 15,
      label: 'Snippet → xsl:param',
      snippet: `<xsl:param name="(: param name e.g. SAPClient :)"/>`
    },
    {
      id: 'snip-message', order: 16,
      label: 'Snippet → xsl:message (debug)',
      snippet: `<xsl:message select="(: concat('DEBUG label=', //Element) :)"/>`
    },
    {
      id: 'snip-string-join', order: 17,
      label: 'Snippet → string-join()',
      snippet: `<xsl:value-of select="string-join((: sequence e.g. //Order/Id :), ', ')"/>`
    },
    {
      id: 'snip-stylesheet', order: 18,
      label: 'Snippet → xsl:stylesheet (CPI skeleton)',
      snippet:
`<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cpi="http://sap.com/it/"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="cpi xs">
  <xsl:output method="xml" indent="yes"/>

  <xsl:param name="exchange"/>

  <xsl:template match="/">
    <!-- mapping logic here -->
  </xsl:template>

</xsl:stylesheet>`
    },
    {
      id: 'snip-sort', order: 19,
      label: 'Snippet → xsl:sort',
      snippet:
`<xsl:sort select="(: sort key e.g. Price :)" order="(: ascending or descending :)" data-type="(: text or number :)"/>`
    },
    {
      id: 'snip-function', order: 20,
      label: 'Snippet → xsl:function',
      snippet:
`<xsl:function name="(: prefix:functionName e.g. fn:formatAmount :)" as="(: return type e.g. xs:string :)">
  <xsl:param name="(: param name e.g. amount :)" as="(: type e.g. xs:decimal :)"/>
  <xsl:sequence select="(: return expression :)"/>
</xsl:function>`
    },
    {
      id: 'snip-key', order: 21,
      label: 'Snippet → xsl:key + key() lookup',
      snippet:
`<!-- Declare at top level of stylesheet -->
<xsl:key name="(: key name e.g. orderById :)" match="(: element e.g. Order :)" use="(: key field e.g. @id :)"/>
<!-- Use key() to look up nodes -->
<xsl:copy-of select="key('(: key name :)', (: lookup value e.g. ./OrderRef :))"/>`
    },
    {
      id: 'snip-element-attribute', order: 22,
      label: 'Snippet → xsl:element + xsl:attribute',
      snippet:
`<xsl:element name="{(: dynamic name e.g. concat('Item_', position()) :)}">
  <xsl:attribute name="(: attribute name e.g. id :)" select="(: XPath e.g. @id :)"/>
  <xsl:value-of select="(: content :)"/>
</xsl:element>`
    },
    {
      id: 'snip-result-document', order: 23,
      label: 'Snippet → xsl:result-document',
      snippet:
`<xsl:result-document href="(: output URI e.g. 'output.xml' :)" method="xml" indent="yes">
  <!-- content for secondary output document -->
</xsl:result-document>`
    },
  ];

  _xsltSnippets.forEach(({ id, label, order, snippet }) => {
    eds.xslt.addAction({
      id,
      label,
      contextMenuGroupId: '9_snippets',
      contextMenuOrder: order,
      run(ed) {
        // CPI snippets need xmlns:cpi — auto-inject if missing
        if (id.startsWith('snip-cpi-')) _ensureCpiNamespace(ed);
        _insertSnippet(ed, snippet);
      }
    });
  });



  function runXsltValidation() {
    const src = eds.xslt.getValue().trim();
    if (!src) { clearAllMarkers(); return; }
    // Only validate the XSLT itself for well-formedness here
    const result = validateXML(src);
    if (!result.ok) {
      xsltDecorations = markErrorLine(eds.xslt, result.line, result.message, xsltDecorations);
      setStatus(`XSLT error at line ${result.line}`, 'err');
    } else {
      // Only reset status if we're not mid-transform
      const current = document.getElementById('statTxt').textContent;
      if (current.startsWith('XSLT error')) setStatus('Ready', 'ok');
    }
  }

  function runXmlValidation() {
    const src = eds.xml.getValue().trim();
    if (!src) {
      monaco.editor.setModelMarkers(eds.xml.getModel(), 'xsltdebugx', []);
      if (xmlDecorations) { xmlDecorations.clear(); xmlDecorations = null; }
      const current = document.getElementById('statTxt').textContent;
      if (current.startsWith('XML error')) setStatus('Ready', 'ok');
      return;
    }
    const result = validateXML(src);
    if (!result.ok) {
      xmlDecorations = markErrorLine(eds.xml, result.line, result.message, xmlDecorations);
      setStatus(`XML error at line ${result.line}`, 'err');
    } else {
      const current = document.getElementById('statTxt').textContent;
      if (current.startsWith('XML error')) setStatus('Ready', 'ok');
    }
  }

  eds.xslt.onDidChangeModelContent(() => {
    scheduleSave();
    if (_suppressNextValidation) { _suppressNextValidation = false; return; }
    // Clear immediately so stale markers don't linger while user types
    monaco.editor.setModelMarkers(eds.xslt.getModel(), 'xsltdebugx', []);
    if (xsltDecorations) { xsltDecorations.clear(); xsltDecorations = null; }
    clearTimeout(xsltDebounce);
    xsltDebounce = setTimeout(runXsltValidation, 800);
  });

  eds.xml.onDidChangeModelContent(() => {
    // Guard against synthetic content-change event during model swap in toggleXPath
    if (_suppressNextXmlChange) { _suppressNextXmlChange = false; return; }
    scheduleSave();
    if (_suppressNextValidation) { _suppressNextValidation = false; return; }
    monaco.editor.setModelMarkers(eds.xml.getModel(), 'xsltdebugx', []);
    if (xmlDecorations) { xmlDecorations.clear(); xmlDecorations = null; }
    // Clear stale XPath highlights and hide results panel whenever source XML is edited
    if (typeof clearXPathHighlights === 'function') clearXPathHighlights();
    document.getElementById('xpathResultsPanel')?.classList.remove('visible');
    // Update XML validation badge in real-time
    if (typeof updateXMLValidationBadge === 'function') updateXMLValidationBadge();
    clearTimeout(xmlDebounce);
    xmlDebounce = setTimeout(runXmlValidation, 800);
  });

  // ── Cursor position + character count in status bar ──────────────────────────
  // XML label changes dynamically based on mode: 'XML Input' (XSLT) vs 'XML Source' (XPath)
  function _getXmlLabel() {
    return modeManager.isXpath ? 'XML Source' : 'XML Input';
  }

  function _updateCursorStat(ed, label) {
    const pos      = ed.getPosition();
    const model    = ed.getModel();
    if (!pos || !model) return;
    const chars    = model.getValueLength();
    const lines    = model.getLineCount();
    const statEl   = document.getElementById('statCursor');
    if (statEl) statEl.textContent =
      `${label}  Ln ${pos.lineNumber}/${lines} · Col ${pos.column} · ${chars.toLocaleString()} chars`;
  }

  // Expose _updateCursorStat globally so toggleXPath can update cursor stat after mode switch
  window._updateCursorStat = _updateCursorStat;

  [
    { ed: eds.xml,  getLabel: _getXmlLabel },  // Dynamic label based on mode
    { ed: eds.xslt, getLabel: () => 'XSLT' },
    { ed: eds.out,  getLabel: () => 'Output' },
  ].forEach(({ ed, getLabel }) => {
    ed.onDidChangeCursorPosition(() => _updateCursorStat(ed, getLabel()));
    ed.onDidFocusEditorText(()      => _updateCursorStat(ed, getLabel()));
    ed.onDidChangeModelContent(()   => _updateCursorStat(ed, getLabel()));
  });
  // Initialise with XML pane on load
  _updateCursorStat(eds.xml, _getXmlLabel());

  document.getElementById('loadTxt').textContent = 'Loading Saxon-JS…';

  // Wait for Saxon-JS
  const checkSaxon = setInterval(() => {
    if (typeof SaxonJS !== 'undefined') {
      clearInterval(checkSaxon);
      clearTimeout(saxonTimeout); // cancel failure path — prevents double hideLoader() if Saxon
                                  // loads in the same event-loop turn as the 12s timeout fires
      saxonReady = true;
      hideLoader();
      clog('Saxon-JS 2.x loaded · XSLT 3.0 engine ready ✓', 'success');
      clog('Ctrl+Enter runs XSLT transform in XSLT mode · runs XPath in XPath mode', 'info');

      // ── Share link takes priority over saved session ──
      if (window._pendingShareData) {
        applyShareData(window._pendingShareData);
      } else if (_savedSession) {
        // Restore KV rows
        if (Array.isArray(_savedSession.headers)) {
          _savedSession.headers.forEach(r => {
            kvIdSeq++;
            kvData.headers.push({ id: kvIdSeq, name: r.name, value: r.value });
          });
        }
        if (Array.isArray(_savedSession.properties)) {
          _savedSession.properties.forEach(r => {
            kvIdSeq++;
            kvData.properties.push({ id: kvIdSeq, name: r.name, value: r.value });
          });
        }
        // Restore column collapse states
        if (_savedSession.leftCollapsed)  document.getElementById('colLeft')?.classList.add('collapsed');
        if (!_savedSession.rightCollapsed) document.getElementById('colRight')?.classList.remove('collapsed');

        // Restore XPath expression
        {
          const _expr = _savedSession.xpathExpr || (EXAMPLES.xpathNavigation?.xpathExpr ?? '');
          if (typeof _syncXPathInput === 'function') _syncXPathInput(_expr);
          else { const xi = document.getElementById('xpathInput'); if (xi) xi.value = _expr; }
        }

        // Restore mode using ModeManager
        modeManager.restoreFromSession(_savedSession);

        // Update cursor stat label to match restored mode
        if (eds.xml && typeof _updateCursorStat === 'function') {
          _updateCursorStat(eds.xml, modeManager.isXpath ? 'XML Source' : 'XML Input');
        }

        // Recalculate textarea height for XPath bar
        if (modeManager.isXpath) {
          const _ta = document.getElementById('xpathInput');
          if (_ta) { _ta.style.height = 'auto'; _ta.style.height = _ta.scrollHeight + 'px'; }
        }

        // Relay Monaco after potential column changes
        setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 260);

        const ago = _savedSession.savedAt
          ? (() => {
              const diff = Math.round((Date.now() - _savedSession.savedAt) / 1000);
              if (diff < 60)   return `${diff}s ago`;
              if (diff < 3600) return `${Math.round(diff/60)}m ago`;
              return `${Math.round(diff/3600)}h ago`;
            })()
          : '';
        clog(`Session restored${ago ? ' · saved ' + ago : ''} · ${modeManager.isXpath ? 'XPath' : 'XSLT'} mode ✓`, 'success');

        // Restore hints strip if session was on an XPath example
        if (modeManager.isXpath && _savedSession.lastExampleKey) {
          window._lastExampleKey = _savedSession.lastExampleKey;
          const _ex = EXAMPLES[_savedSession.lastExampleKey];
          if (_ex?.xpathHints && typeof renderXPathHints === 'function') {
            renderXPathHints(_ex.xpathHints);
          }
        }
        // Auto-run XPath on restore — expression already in bar, lightweight to re-evaluate
        if (modeManager.isXpath) {
          setTimeout(() => { if (typeof runXPath === 'function') runXPath(); }, 400);
        }
      } else {
        clog('Identity Transform loaded. Use Examples menu to load CPI scenarios.', 'info');
        // Apply default XPath state (off) on fresh load
        if (typeof _applyXPathToggleState === 'function') _applyXPathToggleState();
        // Pre-load default XPath expression so bar is ready when user switches to XPath mode
        const _defaultExpr = EXAMPLES.xpathNavigation?.xpathExpr ?? '';
        if (typeof _syncXPathInput === 'function') _syncXPathInput(_defaultExpr);
        else { const xi = document.getElementById('xpathInput'); if (xi) xi.value = _defaultExpr; }
      }

      renderKV('headers');
      renderKV('properties');
      renderOutputKV({}, {});
      // Initialize XML validation badge on load
      if (typeof updateXMLValidationBadge === 'function') updateXMLValidationBadge();
      setStatus('Ready', 'ok');
    }
  }, 200);

  // Timeout fallback — ID stored so the success path can cancel it
  const saxonTimeout = setTimeout(() => {
    if (!saxonReady) {
      clearInterval(checkSaxon);
      hideLoader();
      clog('⚠ Saxon-JS failed to load. Check your internet connection.', 'error');
      setStatus('Saxon-JS unavailable', 'err');
    }
  }, 12000);
});

function hideLoader() {
  const el = document.getElementById('loadingOverlay');
  el.classList.add('hidden');
  setTimeout(() => el.remove(), 600);
}