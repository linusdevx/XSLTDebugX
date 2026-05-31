// ════════════════════════════════════════════
//  XPATH EVALUATOR  +  XML EDITOR HIGHLIGHTING
// ════════════════════════════════════════════
//  Evaluates XPath 3.0 expressions against the XML input pane using Saxon-JS.
//  Matched nodes are highlighted in the XML editor with amber decorations.
//  Results are shown in the XPath Results panel (right column).
// ════════════════════════════════════════════

// Decoration collection for XPath highlights in the XML editor
let xpathDecorations = null;

// ── XPath syntax highlight overlay ───────────────────────────────────────────
// Tokenizes the expression and injects colored <span>s into the overlay div.
// Token order matters — strings first to prevent keywords inside them matching.
// M-9: sticky-anchored regexes (y flag) match only at lastIndex, so we don't
// allocate a fresh substring (src.slice(i)) per character. The y flag has been
// stable in all browsers since 2019 and the codebase already uses ES2020+
// features (optional chaining), so no compat regression.
const _XPT_RE_STR  = /'[^']*'|"[^"]*"/y;
const _XPT_RE_FN   = /[a-zA-Z_][\w-]*(?::[a-zA-Z_][\w-]*)?\s*(?=\()/y;
const _XPT_RE_ATTR = /@[\w:.-]+/y;
const _XPT_RE_NUM  = /\d+(\.\d+)?/y;
const _XPT_RE_KW   = /(and|or|not|eq|ne|lt|le|gt|ge|div|mod|idiv|return|for|in|if|then|else|every|some|satisfies|instance|of|treat|as|cast|castable|union|intersect|except)\b/y;
const _XPT_RE_SEP  = /\/\/|\//y;
const _XPT_RE_PRED = /[\[\]]/y;
const _XPT_RE_VAR  = /\$[a-zA-Z_][\w.-]*(?::[a-zA-Z_][\w.-]*)?/y;
const _XPT_RE_NODE = /[a-zA-Z_*][\w:.-]*(?:::[a-zA-Z_*][\w:.-]*)?/y;

function _highlightXPath(expr) {
  const overlay = document.getElementById('xpathOverlay');
  if (!overlay) return;
  if (!expr) { overlay.innerHTML = ''; return; }

  const out = [];
  const src = expr;
  const len = src.length;
  let i = 0;

  // Try a sticky regex at the current index; on match, push a coloured span and advance.
  const tryMatch = (re, cls) => {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m || m.index !== i) return false;
    out.push(`<span class="${cls}">${escHtml(m[0])}</span>`);
    i += m[0].length;
    return true;
  };

  while (i < len) {
    if (tryMatch(_XPT_RE_STR,  'xpt-str'))  continue;
    if (tryMatch(_XPT_RE_FN,   'xpt-fn'))   continue;
    if (tryMatch(_XPT_RE_ATTR, 'xpt-attr')) continue;
    if (tryMatch(_XPT_RE_NUM,  'xpt-num'))  continue;
    if (tryMatch(_XPT_RE_KW,   'xpt-op'))   continue;
    if (tryMatch(_XPT_RE_SEP,  'xpt-sep'))  continue;
    if (tryMatch(_XPT_RE_PRED, 'xpt-pred')) continue;
    if (tryMatch(_XPT_RE_VAR,  'xpt-attr')) continue;
    if (tryMatch(_XPT_RE_NODE, 'xpt-node')) continue;
    // Everything else — punctuation, operators, whitespace
    out.push(escHtml(src[i]));
    i++;
  }

  overlay.innerHTML = out.join('');
}

// ── Programmatic value setter — updates value, overlay, and auto-grow height ──
function _syncXPathInput(value) {
  const input = document.getElementById('xpathInput');
  if (!input) return;
  input.value = value;
  const bar = document.getElementById('xpathBar');
  const barHidden = !bar || bar.style.display === 'none';
  if (barHidden) {
    // Bar not visible — reset height so it recalculates correctly when shown
    input.style.height = '';
  } else {
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  }
  _highlightXPath(value);
}


const _xpathHistory = [];        // most-recent-first
const _xpathHistoryMax = 20;
const _xpathHistoryKey = 'xdebugx-xpath-history';
let   _xpathHistoryCursor = -1;  // -1 = not browsing history
let   _xpathDraftExpr     = '';  // saves current typed text while browsing

// Load persisted history on startup
(function() {
  try {
    const saved = JSON.parse(localStorage.getItem(_xpathHistoryKey) || '[]');
    if (Array.isArray(saved)) _xpathHistory.push(...saved.slice(0, _xpathHistoryMax));
  } catch(_) {}
})();

function _xpathHistoryPush(expr) {
  if (!expr) return;
  // Remove duplicate if already present, then prepend
  const idx = _xpathHistory.indexOf(expr);
  if (idx !== -1) _xpathHistory.splice(idx, 1);
  _xpathHistory.unshift(expr);
  if (_xpathHistory.length > _xpathHistoryMax) _xpathHistory.length = _xpathHistoryMax;
  _xpathHistoryCursor = -1;
  // Persist to localStorage
  try { localStorage.setItem(_xpathHistoryKey, JSON.stringify(_xpathHistory)); } catch(_) {}
}

function _xpathHistoryNavigate(direction, input) {
  if (_xpathHistory.length === 0) {
    clog('ƒx  No expression history yet — run an expression first', 'info');
    return;
  }
  if (_xpathHistoryCursor === -1) {
    // Save whatever user was typing before browsing
    _xpathDraftExpr = input.value;
  }
  const prevCursor = _xpathHistoryCursor;
  if (direction === 'up') {
    _xpathHistoryCursor = Math.min(_xpathHistoryCursor + 1, _xpathHistory.length - 1);
  } else {
    _xpathHistoryCursor = Math.max(_xpathHistoryCursor - 1, -1);
  }
  input.value = _xpathHistoryCursor === -1 ? _xpathDraftExpr : _xpathHistory[_xpathHistoryCursor];
  // Auto-grow + highlight
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
  _highlightXPath(input.value);
  // Move cursor to end
  const len = input.value.length;
  input.setSelectionRange(len, len);
  if (_xpathHistoryCursor !== prevCursor) {
    if (_xpathHistoryCursor === -1) {
      clog(`ƒx  History: back to current draft`, 'info');
    } else {
      clog(`ƒx  History ${_xpathHistoryCursor + 1}/${_xpathHistory.length}: ${_xpathHistory[_xpathHistoryCursor]}`, 'info');
    }
  }
  scheduleSave();
}

// ── Toggle XPath evaluator on/off ─────────────────────────────────────────────
function toggleXPath() {
  const nextMode = modeManager.isXpath ? 'XSLT' : 'XPATH';
  modeManager.setMode(nextMode);
}

// ── Clear all XPath highlights from the XML editor ───────────────────────────
function clearXPathHighlights() {
  if (xpathDecorations) {
    try { xpathDecorations.clear(); } catch(e) {}
    xpathDecorations = null;
  }
}

// ── Convert a character offset in a string to { line, col } (1-based) ────────
// I-5: when called many times against the same `src` (e.g. one highlight pass
// over N matches), pass `newlineIdx` from _buildNewlineIndex(src) so each
// translation is O(log N) binary-search instead of O(M) substring + split.
function _offsetToLineCol(src, offset, newlineIdx) {
  if (!newlineIdx) {
    // Fallback for ad-hoc callers — same behaviour as before the binary-search variant
    const before = src.substring(0, offset);
    const lines  = before.split('\n');
    return { line: lines.length, col: lines[lines.length - 1].length + 1 };
  }
  // Binary search for the count of newlines strictly before `offset`.
  let lo = 0, hi = newlineIdx.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (newlineIdx[mid] < offset) lo = mid + 1; else hi = mid;
  }
  const line      = lo + 1;
  const lineStart = lo === 0 ? 0 : newlineIdx[lo - 1] + 1;
  return { line, col: offset - lineStart + 1 };
}

// ── Find the character offset of the Nth occurrence of a tag open/close ──────
// Requires the character immediately after the tag name to be whitespace, >, or /
// so that <Item does not match <ItemDetail.
function _nthTagOpen(src, tag, n) {
  // Matches <tag> <tag/> <tag attr=...>
  const re = new RegExp(`<${_escRe(tag)}(?=[\\s>/])`, 'g');
  let count = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    count++;
    if (count === n) return m.index;
  }
  return -1;
}

// ── Find the source range {startOffset, endOffset} for a matched element ──────
function _findNodeRange(xmlSrc, el, occurrenceIndex) {
  return _findNodeRangeForTag(xmlSrc, el.nodeName, occurrenceIndex);
}

// Tag-keyed range finder — single implementation shared by _findNodeRange (which
// passes el.nodeName) and direct callers like _getXPathDomNodeAtOffset that already
// have a tag string. Walks the Nth open tag, skips attribute quotes, then tracks
// nest depth via two regexes to find the matching close tag.
function _findNodeRangeForTag(xmlSrc, tag, occurrenceIndex) {
  const openOffset = _nthTagOpen(xmlSrc, tag, occurrenceIndex);
  if (openOffset === -1) return null;

  // Walk to end of opening tag, respecting attribute quotes
  let i = openOffset + tag.length + 1; // skip past <tagName
  let inDouble = false, inSingle = false;
  while (i < xmlSrc.length) {
    const ch = xmlSrc[i];
    if (!inDouble && !inSingle) {
      if (ch === '"')  { inDouble = true; i++; continue; }
      if (ch === "'")  { inSingle = true; i++; continue; }
      if (ch === '>')  { i++; break; }
    } else if (inDouble && ch === '"') { inDouble = false; }
      else if (inSingle && ch === "'") { inSingle = false; }
    i++;
  }
  const openTagEnd = i;

  // Self-closing?
  if (xmlSrc[i - 2] === '/') {
    return { startOffset: openOffset, endOffset: openTagEnd };
  }

  // Find matching </tag> using precise regex, tracking nesting depth
  let depth = 1, j = openTagEnd;
  const escTag  = _escRe(tag);
  const openRe  = new RegExp(`<${escTag}(?=[\\s>/])`, 'g');
  const closeRe = new RegExp(`<\\/${escTag}(?=[\\s>])`, 'g');

  while (depth > 0) {
    openRe.lastIndex  = j;
    closeRe.lastIndex = j;
    const nextOpen  = openRe.exec(xmlSrc);
    const nextClose = closeRe.exec(xmlSrc);

    if (!nextClose) break;

    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      j = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      if (depth === 0) {
        const closeEnd = xmlSrc.indexOf('>', nextClose.index);
        return {
          startOffset: openOffset,
          endOffset:   closeEnd === -1 ? nextClose.index + nextClose[0].length : closeEnd + 1,
        };
      }
      j = nextClose.index + nextClose[0].length;
    }
  }

  // Fallback: just the opening tag
  return { startOffset: openOffset, endOffset: openTagEnd };
}

// Build a sorted array of newline character offsets for `src`. Used with
// _offsetToLineCol's binary-search path so multiple offset→{line,col}
// translations within a single highlight pass don't each do an O(N) substring.
function _buildNewlineIndex(src) {
  const idx = [];
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10) idx.push(i);
  }
  return idx;
}

// ── Apply Monaco highlight decorations for all matched nodes ──────────────────
function _highlightMatchedNodes(items, xmlSrc) {
  clearXPathHighlights();
  if (!eds.xml || !items.length) return;

  const decorations = [];
  // I-5: precompute newline offsets once per call so _offsetToLineCol can binary-search.
  const newlineIdx = _buildNewlineIndex(xmlSrc);

  // C-3: occurrence index is resolved per DOM node identity, not via a shared
  // tagCounts dict. The previous implementation used one counter for elements,
  // text-node parents, and attribute owners — when a result set contained both
  // an element and its text/attr children, the same owner element got counted
  // multiple times across branches and _findNodeRange received an index past
  // what the source actually contains, producing silent mis-highlights or
  // dropped highlights.
  //
  // Memoize the same-tag sibling array per (doc, tag) so getElementsByTagName
  // isn't called once per item. Cache is local to this call.
  const sameTagCache = new Map();
  const _sameTagSiblings = owner => {
    const tag = owner.nodeName;
    const doc = owner.ownerDocument;
    const key = doc ? `${tag}\0doc` : tag;
    let arr = sameTagCache.get(key);
    if (!arr) {
      arr = doc ? [...doc.getElementsByTagName(tag)] : [owner];
      sameTagCache.set(key, arr);
    }
    return arr;
  };

  items.forEach(item => {
    if (!item || typeof item !== 'object') return; // skip atomics

    // Resolve the owner element + any text/attr-specific hover prefix.
    // Owner determines the source-order occurrence used for highlighting.
    let owner = null, hoverPrefix = null, isAttr = false, isText = false;
    if (item.nodeType === 1)      { owner = item; }
    else if (item.nodeType === 3) { owner = item.parentNode?.nodeType === 1 ? item.parentNode : null; isText = true; }
    else if (item.nodeType === 2) { owner = item.ownerElement; hoverPrefix = `attr \`${item.name}\``; isAttr = true; }
    if (!owner) return;

    // 1-based source-order occurrence among same-tag elements in the SAME
    // document Saxon parsed (parse-xml($xml) in runXPath). Document order is
    // authoritative — independent of how often this owner appears in `items`.
    const occ = _sameTagSiblings(owner).indexOf(owner) + 1;
    if (occ < 1) return;

    const range = _findNodeRange(xmlSrc, owner, occ);
    if (!range) return;

    if (isText || isAttr) {
      // Text / attr → highlight owner's opening line
      const { line } = _offsetToLineCol(xmlSrc, range.startOffset, newlineIdx);
      decorations.push(_makeLineDecoration(
        line,
        hoverPrefix ? `**XPath match** ${hoverPrefix}` : null
      ));
      return;
    }

    // Element node → full range highlight
    const tag   = owner.nodeName;
    const start = _offsetToLineCol(xmlSrc, range.startOffset, newlineIdx);
    const end   = _offsetToLineCol(xmlSrc, range.endOffset - 1, newlineIdx);
    if (start.line === end.line) {
      // Single-line: inline highlight
      decorations.push({
        range: new monaco.Range(start.line, start.col, start.line, end.col + 1),
        options: {
          className: 'xf-xpath-match-inline',
          glyphMarginClassName: 'xf-xpath-match-glyph',
          glyphMarginHoverMessage: { value: `**XPath match** \`<${tag}>\`` },
        }
      });
    } else {
      // Multi-line: whole-line background on each line
      for (let ln = start.line; ln <= end.line; ln++) {
        decorations.push(_makeLineDecoration(
          ln,
          ln === start.line ? `**XPath match** \`<${tag}>\`` : null
        ));
      }
    }
  });

  if (!decorations.length) return;
  xpathDecorations = eds.xml.createDecorationsCollection(decorations);
  // Scroll XML editor to first match
  eds.xml.revealLineInCenter(decorations[0].range.startLineNumber);
}

function _makeLineDecoration(line, hoverMsg) {
  return {
    range: new monaco.Range(line, 1, line, 1),
    options: {
      isWholeLine: true,
      className:            'xf-xpath-match-bg',
      glyphMarginClassName: 'xf-xpath-match-glyph',
      ...(hoverMsg ? { glyphMarginHoverMessage: { value: hoverMsg } } : {}),
    }
  };
}

// ── Serialize a single XDM item to a display string ──────────────────────────
function _xpathSerializeItem(item) {
  if (item === null || item === undefined) return { text: '(empty)', type: 'atomic' };
  if (typeof item === 'object' && item.nodeType) {
    try {
      // Document node (nodeType 9) — unwrap to its document element
      const target = item.nodeType === 9 ? item.documentElement : item;

      const raw   = new XMLSerializer().serializeToString(target);
      // Strip only namespace declarations injected by XMLSerializer
      // (xmlns="..." or xmlns:prefix="...") — use word boundary so we
      // don't accidentally clip attribute values that contain "xmlns"
      const clean = raw.replace(/\s+xmlns(?::\w+)?="[^"]*"/g, '');
      const text  = clean.trim().startsWith('<') ? prettyXML(clean) : clean;
      return { text, type: item.nodeType === 3 ? 'text' : 'node' };
    } catch(e) {
      return { text: String(item), type: 'node' };
    }
  }
  return { text: String(item), type: 'atomic' };
}

// ── Normalise Saxon-JS result to a flat JS array ─────────────────────────────
function _xpathNormalise(result) {
  if (result === null || result === undefined) return [];
  if (Array.isArray(result)) return result;
  return [result];
}

// ── Main entry point ──────────────────────────────────────────────────────────
function runXPath() {
  if (!guardReady()) return;
  if (!modeManager.isXpath) return;

  // Reset error badge for fresh run
  consoleErrCount = 0;
  updateConsoleErrBadge();

  const input = document.getElementById('xpathInput');
  const expr  = input?.value?.trim();
  if (!expr) {
    clog('ƒx  Expression is empty — type an XPath expression and press Run', 'warn');
    return;
  }

  const xmlSrc = eds.xml?.getValue()?.trim();

  // Ensure right column is open
  const colRight = document.getElementById('colRight');
  if (colRight.classList.contains('collapsed')) {
    colRight.classList.remove('collapsed');
    setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 250);
  }

  // Clear previous highlights immediately
  clearXPathHighlights();

  if (!xmlSrc) {
    clog('ƒx  XML Source is empty — add XML input first', 'warn');
    _showXPathResults([], 'XML Source is empty — add XML input first', true);
    return;
  }

  const xmlCheck = validateXML(xmlSrc);
  if (!xmlCheck.ok) {
    const xmlErr = `XML error at line ${xmlCheck.line}: ${xmlCheck.message}`;
    clog(`ƒx  ${xmlErr}`, 'error');
    _showXPathResults([], xmlErr, true);
    return;
  }

  clog(`ƒx  ${expr}`, 'info');
  window.goatcounter?.count({ path: 'run-xpath', title: 'Run XPath' });
  _xpathHistoryPush(expr);
  _xpathHistoryCursor = -1;

  // Show running state on Run button — Option A:
  // show spinner immediately, keep for minimum 300ms
  const _btn = document.getElementById('runBtn');
  const _xpathRunStart = performance.now();
  const _MIN_SPINNER_MS = 300;
  if (_btn) {
    _btn.disabled = true;
    _btn.innerHTML = `${typeof _RUN_BTN_SPINNER !== 'undefined' ? _RUN_BTN_SPINNER : ''} Running… <span class="kbd">⌘↵</span>`;
  }

  const _resetXPathBtn = () => {
    if (!_btn) return;
    const elapsed = performance.now() - _xpathRunStart;
    const restore = () => {
      _btn.disabled = false;
      // Delegate to mode manager — user may have flipped to XSLT during the spinner window.
      // Hardcoding _btn.onclick = runXPath here would silently break Run after the flip.
      modeManager.updateRunButton();
      reinitIcons(_btn);
    };
    const remaining = _MIN_SPINNER_MS - elapsed;
    if (remaining > 0) setTimeout(restore, remaining);
    else restore();
  };

  try {
    const t0      = performance.now();
    const NS = {
      xs:   'http://www.w3.org/2001/XMLSchema',
      fn:   'http://www.w3.org/2005/xpath-functions',
      math: 'http://www.w3.org/2005/xpath-functions/math',
      map:  'http://www.w3.org/2005/xpath-functions/map',
      array:'http://www.w3.org/2005/xpath-functions/array',
    };
    const docNode = SaxonJS.XPath.evaluate('parse-xml($xml)', [], { params: { xml: xmlSrc } });
    const raw     = SaxonJS.XPath.evaluate(expr, docNode, { namespaceContext: NS });
    const elapsed = (performance.now() - t0).toFixed(1);
    const items   = _xpathNormalise(raw);

    // Summarise result types for the console
    if (items.length === 0) {
      clog(`ƒx  No matches  ·  ${elapsed}ms`, 'warn');
    } else {
      const nodeCount   = items.filter(x => x && typeof x === 'object' && x.nodeType === 1).length;
      const textCount   = items.filter(x => x && typeof x === 'object' && x.nodeType === 3).length;
      const attrCount   = items.filter(x => x && typeof x === 'object' && x.nodeType === 2).length;
      const atomicCount = items.length - nodeCount - textCount - attrCount;
      const parts = [];
      if (nodeCount)   parts.push(`${nodeCount} element${nodeCount  !== 1 ? 's' : ''}`);
      if (textCount)   parts.push(`${textCount} text${textCount     !== 1 ? 's' : ''}`);
      if (attrCount)   parts.push(`${attrCount} attr${attrCount     !== 1 ? 's' : ''}`);
      if (atomicCount) parts.push(`${atomicCount} value${atomicCount !== 1 ? 's' : ''}`);
      clog(`ƒx  ${items.length} match${items.length !== 1 ? 'es' : ''}  ·  ${parts.join(', ')}  ·  ${elapsed}ms`, 'success');
    }

    // Highlight matched nodes in the XML editor
    _highlightMatchedNodes(items, xmlSrc);

    _showXPathResults(items, null, false);

  } catch(e) {
    const msg = (e.message || String(e)).split('\n')[0];
    clog(`ƒx  ${msg}`, 'error');
    _showXPathResults([], msg, true);
  } finally {
    _resetXPathBtn();
  }
}

// ── Build an absolute XPath for a DOM element node ───────────────────────────
// indexed=true  → /Orders/Order[2]/Amount  (positional, exact)
// indexed=false → /Orders/Order/Amount     (general, pattern)
function _buildXPathFromNode(el, indexed = true) {
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1) {
    const tag      = node.nodeName;
    const siblings = node.parentNode
      ? [...node.parentNode.children].filter(c => c.nodeName === tag)
      : [node];
    const idx = siblings.indexOf(node) + 1;
    parts.unshift(
      indexed && siblings.length > 1 ? `${tag}[${idx}]` : tag
    );
    node = node.parentNode;
  }
  return '/' + parts.join('/');
}

// ── Public: get XPath at current cursor position in the XML editor ────────────
// Returns { indexed, general } — both absolute XPath strings, or null.
function getXPathAtCursor(editor) {
  const model  = editor.getModel();
  const pos    = editor.getPosition();
  const offset = model.getOffsetAt(pos);
  const src    = model.getValue();
  const domNode = _getXPathDomNodeAtOffset(src, offset);
  if (!domNode) return null;
  return {
    indexed: _buildXPathFromNode(domNode, true),
    general: _buildXPathFromNode(domNode, false),
  };
}

// ── Find the element at a character offset in raw XML source ─────────────────
function _getXPathDomNodeAtOffset(xmlSrc, offset) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xmlSrc, 'application/xml');
  if (doc.querySelector('parsererror')) return null;

  // I-3: blank out comments and CDATA so tag-shaped strings inside them don't
  // bump the regex occurrence counter past the DOM's actual count. Replacing
  // each region with spaces of identical length preserves character positions,
  // so the offset and the ranges from _findNodeRangeForTag (computed on the
  // real source) still align. If `offset` itself falls inside a stripped
  // region the tag regex won't match it and we return null — same as the
  // existing behaviour for "click outside any element".
  const scanSrc = xmlSrc.replace(
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g,
    m => ' '.repeat(m.length)
  );

  const tagRe = /<([\w:.-]+)(?=[\s>/])/g;
  let m;
  const tagOccurrences = {};
  let bestTag = null, bestOcc = 0, bestStart = -1;

  while ((m = tagRe.exec(scanSrc)) !== null) {
    const tag = m[1];
    if (tag.startsWith('/') || tag.startsWith('?') || tag.startsWith('!')) continue;
    tagOccurrences[tag] = (tagOccurrences[tag] || 0) + 1;
    const occ   = tagOccurrences[tag];
    const range = _findNodeRangeForTag(xmlSrc, tag, occ);
    if (!range) continue;
    if (offset >= range.startOffset && offset <= range.endOffset) {
      if (range.startOffset >= bestStart) {
        bestTag = tag; bestOcc = occ; bestStart = range.startOffset;
      }
    }
  }

  if (!bestTag) return null;
  const allNodes = [...doc.getElementsByTagName('*')].filter(el => el.nodeName === bestTag);
  return allNodes[bestOcc - 1] ?? null;
}

// ── Render results panel ───────────────────────────────────────────────────────
// Async because monaco.editor.colorize() returns a Promise.
// Generation counter prevents a slow first run overwriting a faster second run.
let _showXPathGen = 0;
let _lastXPathRenderArgs = null; // saved for re-colorize on theme switch
async function _showXPathResults(items, errorMsg, isError) {
  const gen = ++_showXPathGen; // capture generation for this call
  // I-11: pin the XML model that was active when this run started. eds.xml
  // points at whichever model the user is currently viewing — if they switch
  // mode while we await monaco.editor.colorize() (potentially hundreds of ms),
  // eds.xml will swap to the other XML model and any decoration application
  // would attach XPath highlights to the wrong document.
  const xmlModelAtStart = eds.xml?.getModel?.() ?? null;
  _lastXPathRenderArgs = { items, errorMsg, isError }; // save for refreshXPathColors()
  const panel   = document.getElementById('xpathResultsPanel');
  const body    = document.getElementById('xpathResultsBody');
  const countEl = document.getElementById('xpathMatchCount');

  panel.classList.add('visible');
  // Only minimise output section if it's actually visible (not hidden in XPath mode)
  const outSec = document.getElementById('outputSection');
  if (outSec && outSec.style.display !== 'none') {
    outSec.classList.add('xpath-minimized');
    setTimeout(() => { eds.out?.layout(); }, 250);
  }

  // Helper: update the XQuery pane-bar count badge
  const headerCount = document.getElementById('xpathHeaderCount');
  const _setHeaderCount = (text, cls) => {
    if (!headerCount) return;
    headerCount.textContent = text;
    headerCount.className = 'xpath-header-count' + (cls ? ' ' + cls : '');
    headerCount.style.display = text ? '' : 'none';
  };

  if (isError) {
    countEl.textContent = 'Error';
    countEl.className   = 'xpath-match-count has-error';
    body.innerHTML      = `<div class="xpath-error">${escHtml(errorMsg)}</div>`;
    _setHeaderCount('Error', 'has-error');
    return;
  }

  const n = items.length;
  countEl.textContent = `${n} match${n !== 1 ? 'es' : ''}`;
  countEl.className   = n > 0 ? 'xpath-match-count has-results' : 'xpath-match-count';
  _setHeaderCount(`${n} match${n !== 1 ? 'es' : ''}`, n > 0 ? 'has-results' : '');

  if (n === 0) {
    body.innerHTML = '<div class="xpath-no-results">No matches found for this expression.</div>';
    return;
  }

  // Serialize all items first
  const serialized = items.map(item => _xpathSerializeItem(item));

  // Colorize node/text items using Monaco's own XML tokenizer — same colours as the editors
  const colorized = await Promise.all(serialized.map(async ({ text, type }) => {
    if ((type === 'node' || type === 'text') && typeof monaco !== 'undefined') {
      try {
        return await monaco.editor.colorize(text, 'xml', { tabSize: 2 })
          .then(html => html.replace(/<br\s*\/?>\s*$/, ''));
      } catch(e) {
        console.warn('[colorize]', e);
        return escHtml(text);
      }
    }
    return escHtml(text);
  }));

  // Bail if a newer run has started while we were awaiting colorize
  if (gen !== _showXPathGen) return;
  // I-11: also bail if the user switched modes mid-await — the highlights and
  // results panel belong to the previous mode's XML model.
  if (eds.xml?.getModel?.() !== xmlModelAtStart) {
    clearXPathHighlights();
    return;
  }

  body.innerHTML = serialized.map(({ type }, i) => {
    const typeLabel = type === 'node' ? 'Node' : type === 'text' ? 'Text' : 'Value';
    return `<div class="xpath-result-item">
      <span class="xpath-result-num">${i + 1}</span>
      <pre class="xpath-result-content">${colorized[i]}</pre>
      <span class="xpath-result-type ${type}">${typeLabel}</span>
    </div>`;
  }).join('');
}

// ── Clear results, highlights, and restore output section ─────────────────────
function clearXPathResults() {
  clearXPathHighlights();
  _lastXPathRenderArgs = null;
  document.getElementById('xpathResultsPanel')?.classList.remove('visible');
  document.getElementById('outputSection')?.classList.remove('xpath-minimized');
  const headerCount = document.getElementById('xpathHeaderCount');
  if (headerCount) { headerCount.style.display = 'none'; headerCount.textContent = ''; }
  setTimeout(() => { eds.out?.layout(); }, 250);
}

// ── Re-colorize visible results after a theme switch ─────────────────────────
// monaco.editor.colorize() bakes theme-specific mtk* palette indices into HTML.
// When the theme changes those palette entries remap, so stale HTML shows wrong
// colours. Calling this re-runs _showXPathResults with the last known args.
function refreshXPathColors() {
  const panel = document.getElementById('xpathResultsPanel');
  if (!panel?.classList.contains('visible') || !_lastXPathRenderArgs) return;
  const { items, errorMsg, isError } = _lastXPathRenderArgs;
  _showXPathResults(items, errorMsg, isError);
}

// ── Restore output section when a transform runs ──────────────────────────────
function restoreOutputSection() {
  document.getElementById('outputSection')?.classList.remove('xpath-minimized');
  // Collapse XPath results panel and clear editor highlights — mirror of output being minimized during XPath run
  document.getElementById('xpathResultsPanel')?.classList.remove('visible');
  clearXPathHighlights();
}

// ── Clear XPath expression input ──────────────────────────────────────────────
function clearXPathInput() {
  const input = document.getElementById('xpathInput');
  if (input) { input.value = ''; input.style.height = 'auto'; _highlightXPath(''); input.focus(); scheduleSave(); }
  clearXPathResults();
  renderXPathHints(null);
}

// ── XPath Hints Strip ──────────────────────────────────────────────────────────
function renderXPathHints(hints) {
  const strip = document.getElementById('xpathHintsStrip');
  if (!strip) return;

  if (!hints || hints.length === 0) {
    strip.style.display = 'none';
    strip.classList.remove('expanded');
    strip.innerHTML = '';
    return;
  }

  strip.innerHTML = '';
  strip.classList.remove('expanded');

  const label = document.createElement('span');
  label.className = 'xpath-hint-label';
  label.textContent = 'Try:';
  strip.appendChild(label);

  hints.forEach(hint => {
    // Each hint is "expression — description", split on em dash
    const dashIdx = hint.indexOf('—');
    const expr = dashIdx >= 0 ? hint.slice(0, dashIdx).trim() : hint.trim();
    const desc = dashIdx >= 0 ? hint.slice(dashIdx + 1).trim() : '';

    const chip = document.createElement('button');
    chip.className = 'xpath-hint-chip';
    chip.textContent = expr;
    chip.title = desc ? `${expr}\n\n${desc}` : expr;
    chip.addEventListener('click', () => {
      if (typeof _syncXPathInput === 'function') _syncXPathInput(expr);
      else {
        const input = document.getElementById('xpathInput');
        if (input) { input.value = expr; _highlightXPath(expr); }
      }
      if (typeof runXPath === 'function') runXPath();
    });
    strip.appendChild(chip);
  });

  // Chevron toggle button — only shown when chips wrap beyond one row
  const toggle = document.createElement('button');
  toggle.className = 'xpath-hints-toggle';
  toggle.title = 'Show more hints';
  toggle.innerHTML = '<i data-lucide="chevron-down" width="12" height="12"></i>';
  toggle.addEventListener('click', () => {
    const isExpanded = strip.classList.toggle('expanded');
    toggle.classList.toggle('expanded', isExpanded);
    toggle.title = isExpanded ? 'Show less' : 'Show more hints';
  });
  strip.appendChild(toggle);
  reinitIcons(toggle);

  strip.style.display = 'flex';
}

// ── Copy XPath expression to clipboard ────────────────────────────────────────
function copyXPathInput() {
  const expr = document.getElementById('xpathInput')?.value?.trim();
  if (!expr) return clog('XPath bar is empty — nothing to copy', 'warn');
  _clipboardWrite(expr, () => {
    clog(`ƒx  Expression copied to clipboard ✓`, 'success');
    showCopyToast('✓ Copied XPath expression');
  });
}

// ── Copy results to clipboard ──────────────────────────────────────────────────
function copyXPathResults() {
  const body = document.getElementById('xpathResultsBody');
  if (!body) return;
  // M-8: compute count from the array we already built rather than re-querying
  const items = [...body.querySelectorAll('.xpath-result-content')];
  const text  = items.map((el, i) => `[${i + 1}] ${el.textContent}`)
                     .join('\n' + '─'.repeat(40) + '\n');
  if (!text.trim()) return clog('XPath results are empty — nothing to copy', 'warn');

  const count = items.length;
  _clipboardWrite(text, () => {
    clog('XPath results copied to clipboard ✓', 'success');
    showCopyToast(`✓ Copied ${count} result${count !== 1 ? 's' : ''}`);
  });
}