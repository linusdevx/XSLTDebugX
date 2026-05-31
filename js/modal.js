// ════════════════════════════════════════════
//  EXAMPLES LIBRARY MODAL
// ════════════════════════════════════════════

let exActiveCat = 'all';
let exAutoRunChecked = false;  // Auto-run toggle state

// ── Render sidebar category buttons from CATEGORIES object ───────────────────
function renderExSidebar() {
  const sidebar = document.getElementById('exSidebar');
  if (!sidebar) return;

  const allExamples = Object.values(EXAMPLES);
  const total = allExamples.length;

  let html = '<div class="ex-sidebar-label">Categories</div>';

  // "All" button
  html += `<button class="ex-cat-btn${exActiveCat === 'all' ? ' active' : ''}" data-cat="all" onclick="setExCat('all')"><i data-lucide="layout-grid" width="14" height="14"></i> All <span class="ex-cat-count">${total}</span></button>`;

  // One button per category — order follows CATEGORIES definition
  Object.entries(CATEGORIES).forEach(([cat, { label, icon }]) => {
    const count = allExamples.filter(ex => ex.cat === cat).length;
    if (count === 0) return; // skip empty categories
    const isActive = exActiveCat === cat;
    html += `<button class="ex-cat-btn${isActive ? ' active' : ''}" data-cat="${cat}" onclick="setExCat('${cat}')"><i data-lucide="${icon}" width="14" height="14"></i> ${label} <span class="ex-cat-count">${count}</span></button>`;
  });

  sidebar.innerHTML = html;
  reinitIcons(sidebar);
}

function openExModal() {
  document.getElementById('exModalBackdrop').classList.add('open');
  document.getElementById('exModalSearch').value = '';
  // Restore auto-run preference from localStorage
  const savedAutoRun = localStorage.getItem('xdebugx-auto-run-examples') === 'true';
  exAutoRunChecked = savedAutoRun;
  const checkbox = document.getElementById('exAutoRunCheckbox');
  if (checkbox) checkbox.checked = savedAutoRun;
  // Pre-select category based on current mode
  exActiveCat = modeManager.isXpath ? 'xpath' : 'all';
  // I-6: force a fresh render — examples list / icons may have changed since last open
  _exRendered = false;
  renderExSidebar();
  renderExGrid();
  requestAnimationFrame(() => document.getElementById('exModalSearch').focus());
}

function closeExModal() {
  document.getElementById('exModalBackdrop').classList.remove('open');
}

function handleModalBackdropClick(e) {
  if (e.target === document.getElementById('exModalBackdrop')) closeExModal();
}

// Close modal on Escape; run transform on Ctrl/Cmd+Enter from anywhere
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeExModal();
    if (typeof closeShareModal === 'function') closeShareModal();
    if (typeof closeHelpModal  === 'function') closeHelpModal();
    return;
  }
  // Ctrl+Enter / Cmd+Enter → mode-aware run (works even when KV inputs have focus)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (modeManager.isXpath) runXPath();
    else runTransform();
  }
});

function setExCat(cat) {
  exActiveCat = cat;
  renderExSidebar();
  // Category change rebuilds the grid (cheap, one click). The expensive path is
  // search keystrokes — those go through filterExamples and just toggle visibility.
  _exRendered = false;
  renderExGrid();
}

// I-6: filterExamples runs on every search keystroke. Previously it called
// renderExGrid which rebuilt the entire HTML and re-ran lucide.createIcons over
// ~60 SVGs — visibly stuttery. Now it only flips display:none on the cards
// already in the DOM, keeping the icon layer untouched.
function filterExamples() {
  if (!_exRendered) { renderExGrid(); return; }
  const wrap  = document.getElementById('exGridWrap');
  if (!wrap) return;
  const query = (document.getElementById('exModalSearch').value || '').toLowerCase().trim();
  let visibleCount = 0;

  wrap.querySelectorAll('.ex-grid').forEach(grid => {
    let sectionVisible = 0;
    grid.querySelectorAll('.ex-card').forEach(card => {
      const key = card.dataset.exKey;
      const ex  = EXAMPLES[key];
      if (!ex) return;
      const matchesCat  = exActiveCat === 'all' || ex.cat === exActiveCat;
      const matchesText = !query
        || ex.label.toLowerCase().includes(query)
        || ex.desc.toLowerCase().includes(query);
      const show = matchesCat && matchesText;
      card.style.display = show ? '' : 'none';
      if (show) sectionVisible++;
    });
    visibleCount += sectionVisible;
    // Hide the section's label too — it's the immediately-preceding sibling
    const labelEl = grid.previousElementSibling;
    if (labelEl?.classList.contains('ex-grid-section-label')) {
      labelEl.style.display = sectionVisible ? '' : 'none';
    }
    grid.style.display = sectionVisible ? '' : 'none';
  });

  document.getElementById('exModalCount').textContent =
    visibleCount + ' example' + (visibleCount !== 1 ? 's' : '');

  // No-results fallback — show/hide a single placeholder we keep around
  let empty = wrap.querySelector('.ex-no-results');
  if (visibleCount === 0) {
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'ex-no-results';
      empty.textContent = 'No examples match your search.';
      wrap.appendChild(empty);
    }
    empty.style.display = '';
  } else if (empty) {
    empty.style.display = 'none';
  }
}

// I-6: track whether the grid DOM has been built so filterExamples can decide
// between rebuild (first call after open / category change) and toggle.
let _exRendered = false;

function renderExGrid() {
  const query  = (document.getElementById('exModalSearch').value || '').toLowerCase().trim();
  const wrap   = document.getElementById('exGridWrap');

  // Single-pass: filter and group examples simultaneously
  const groups = {};
  const keys = [];
  Object.keys(EXAMPLES).forEach(k => {
    const ex = EXAMPLES[k];
    if (exActiveCat !== 'all' && ex.cat !== exActiveCat) return;
    if (query && !ex.label.toLowerCase().includes(query) && !ex.desc.toLowerCase().includes(query)) return;
    keys.push(k);
    (groups[ex.cat] = groups[ex.cat] || []).push(k);
  });

  document.getElementById('exModalCount').textContent = keys.length + ' example' + (keys.length !== 1 ? 's' : '');

  if (!keys.length) {
    wrap.innerHTML = '<div class="ex-no-results">No examples match your search.</div>';
    _exRendered = false;
    return;
  }

  let html = '';
  // Preserve CATEGORIES order for section grouping
  const orderedCats = [...Object.keys(CATEGORIES), ...Object.keys(groups).filter(c => !CATEGORIES[c])];
  orderedCats.filter(cat => groups[cat]).forEach(cat => {
    const catDef = CATEGORIES[cat] || { label: cat, accent: 'var(--sap-blue)' };
    if (exActiveCat === 'all') {
      html += `<div class="ex-grid-section-label">${escHtml(catDef.label)}</div>`;
    }
    html += '<div class="ex-grid">';
    groups[cat].forEach(k => {
      const ex = EXAMPLES[k];
      const accent = catDef.accent;
      // ex.icon is a Lucide icon name (matches [a-z-]+) and k is the bundled
      // example key (matches [a-zA-Z0-9]+). Both are bundled-internal — do NOT
      // start interpolating external sources here without adding escapes.
      // I-6: data-ex-key lets filterExamples look up EXAMPLES[key] cheaply
      // without re-reading anything else off the card.
      html += `
        <div class="ex-card" data-ex-key="${k}" style="--card-accent:${accent}" onclick="loadExample('${k}')">
          <div class="ex-card-top">
            <span class="ex-card-icon"><i data-lucide="${ex.icon}" width="16" height="16"></i></span>
            <span class="ex-card-name">${escHtml(ex.label)}</span>
          </div>
          <div class="ex-card-desc">${escHtml(ex.desc)}</div>
          <div class="ex-card-footer">
            <span class="ex-card-tag">${escHtml(catDef.label)}</span>
            <span class="ex-card-load">Load →</span>
          </div>
        </div>`;
    });
    html += '</div>';
  });

  wrap.innerHTML = html;
  reinitIcons(wrap);
  _exRendered = true;
}

// ── Load an example ──
function loadExample(key) {
  const ex = EXAMPLES[key];
  if (!ex) return;

  // ── Step 1: Switch mode based on example type BEFORE loading content ──
  try {
    if (ex.xpathExpr && !modeManager.isXpath) {
      modeManager.setMode('XPATH');
      clog('Switched to XPath mode', 'info');
    } else if (!ex.xpathExpr && modeManager.isXpath) {
      modeManager.setMode('XSLT');
      if (typeof clearXPathResults === 'function') clearXPathResults();
      clog('Switched to XSLT mode', 'info');
    }
  } catch (e) {
    logError('loadExample mode switch', e);
  }

  // ── Step 2: Load content ──
  clearTimeout(xsltDebounce);
  clearTimeout(xmlDebounce);
  clearAllMarkers();

  try {
    // Route XML content to the correct model based on current mode
    const targetXmlModel = modeManager.isXpath ? xmlModelXpath : xmlModelXslt;
    if (targetXmlModel) {
      targetXmlModel.setValue(ex.xml);
    }

    // Only set XSLT if in XSLT mode (and example has XSLT content)
    if (!modeManager.isXpath && ex.xslt && eds.xslt) {
      _suppressNextValidation = true;
      eds.xslt.setValue(ex.xslt);
    }
  } finally {
    _suppressNextValidation = false;
  }
  eds.out?.updateOptions({ readOnly: false });
  eds.out?.setValue('');
  eds.out?.updateOptions({ readOnly: true });
  renderOutputKV({}, {});

  // Only set KV panels in XSLT mode — they're hidden in XPath mode
  if (!modeManager.isXpath) {
    kvData = { headers: [], properties: [] };
    kvIdSeq = 0;
    if (ex.headers) {
      ex.headers.forEach(([n,v]) => { kvIdSeq++; kvData.headers.push({ id: kvIdSeq, name: n, value: v }); });
    }
    if (ex.properties) {
      ex.properties.forEach(([n,v]) => { kvIdSeq++; kvData.properties.push({ id: kvIdSeq, name: n, value: v }); });
    }
    renderKV('headers');
    renderKV('properties');
  }

  closeExModal();
  window.goatcounter?.count({ path: `example-${key}`, title: `Example: ${ex.label}` });
  window._lastExampleKey = key;

  // ── Step 3: Post-load layout and actions ──
  if (ex.xpathExpr) {
    const colRight = document.getElementById('colRight');
    if (colRight.classList.contains('collapsed')) colRight.classList.remove('collapsed');
    setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 250);
    const xpathInput = document.getElementById('xpathInput');
    if (xpathInput) {
      if (typeof _syncXPathInput === 'function') _syncXPathInput(ex.xpathExpr);
      else xpathInput.value = ex.xpathExpr;
      // Only auto-run if checkbox is checked
      if (exAutoRunChecked) {
        clog(`Example loaded: "${ex.label}" — XPath pre-filled, running…`, 'success');
        setTimeout(() => { if (typeof runXPath === 'function') runXPath(); }, 350);
      } else {
        clog(`Example loaded: "${ex.label}" — XPath pre-filled, ready to run`, 'success');
      }
    }
    // Render hints strip if example has hints
    if (typeof renderXPathHints === 'function') renderXPathHints(ex.xpathHints ?? null);
  } else {
    const colRight = document.getElementById('colRight');
    if (!colRight.classList.contains('collapsed')) {
      colRight.classList.add('collapsed');
      setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 250);
    }
    // Hide hints strip for XSLT examples
    if (typeof renderXPathHints === 'function') renderXPathHints(null);
    // Only auto-run if checkbox is checked
    if (exAutoRunChecked) {
      clog(`Example loaded: "${ex.label}" ✓ Running…`, 'success');
      setTimeout(() => { if (typeof runTransform === 'function') runTransform(); }, 350);
    } else {
      clog(`Example loaded: "${ex.label}" ✓ Ready to run`, 'success');
    }
  }

  // Update XML validation badge after loading example
  if (typeof updateXMLValidationBadge === 'function') updateXMLValidationBadge();
  scheduleSave();
}