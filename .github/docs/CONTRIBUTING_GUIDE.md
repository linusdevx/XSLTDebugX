# Contributing Guide

Code style expectations, commit format, and PR process for XSLTDebugX.

## Table of Contents

- [PR Checklist](#pr-checklist)
- [Code Style](#code-style)
- [Commit Format](#commit-format)
- [PR Process](#pr-process)

---

## PR Checklist

Before submitting:

- [ ] No `var` — use `let`/`const`
- [ ] `_` prefix on private functions
- [ ] Complex logic commented with *why*, not *what*
- [ ] Section dividers: `// ════════ Section Name ════════`
- [ ] HTML IDs camelCase (`xmlEd`, `runBtn`), CSS classes hyphenated (`.pane-bar`)
- [ ] No new unprefixed globals — check `state.js` first
- [ ] `console.log` restored, Monaco models disposed (no memory leaks)
- [ ] Debounce timing unchanged (800ms validation)
- [ ] Manual browser test — no DevTools console errors
- [ ] `npm run test:e2e` passes (Chromium — the only project enabled in `playwright.config.js` / CI)
- [ ] Firefox manual smoke (optional) — Firefox/WebKit projects are commented out
- [ ] localStorage persistence works after refresh

---

## Code Style

### Naming

```javascript
// ✅ Good
const MAX_HISTORY_SIZE = 20;
function runTransform() { ... }          // Public API — no prefix
function _parseErrorLine(err) { ... }    // Private — underscore prefix
async function validateXmlWellFormedness(xml) { ... }

// ❌ Bad
var MAX = 20;
function run() { ... }                   // Not descriptive
function parseErrorLine(err) { ... }     // Looks public but isn't
```

### Comments — Why, Not What

```javascript
// ✅ Good
// Debounce 800ms: large XSLT (>10KB) takes ~6-10ms to parse.
// Validating every keystroke = ~50/sec = CPU spike.
xsltDebounce = setTimeout(() => validateXslt(), 800);

// ❌ Bad
// Set timeout  (states the obvious)
xsltDebounce = setTimeout(() => validateXslt(), 800);
```

### Error Handling — Use `clog()`

```javascript
// ✅ Good
try {
  const result = SaxonJS.transform({
    stylesheetText: xslt,
    sourceText: xml,
    destination: 'serialized',
  }, 'sync');
} catch (err) {
  clog(`Transform failed: ${err.message}`, 'error');
  return null;
}

// ❌ Bad — silent failure or raw console
try { ... } catch (err) { return null; }
console.error('Something went wrong');
```

### Memory — Always Clean Up

```javascript
// ✅ Good — cleanup guaranteed even on error
async function runTransform() {
  const originalLog = console.log;
  try {
    console.log = _captureLog;
    // ...
  } finally {
    console.log = originalLog;
  }
}

// ✅ Dispose Monaco models before reassigning
if (eds.xml) eds.xml.getModel()?.dispose();
eds.xml = monaco.editor.create(...);
```

### Common Review Feedback

**"Function name unclear"** — Be specific: `process(data)` → `validateXsltSyntax(xsltString)`

**"Add a comment explaining rationale"** — The *why* isn't obvious; explain it.

**"Missing cleanup"** — Use `try/finally` so cleanup runs even on error.

**"Add underscore prefix"** — Function is internal but looks public.

**"Breaks module load order"** — A function is referenced before it's defined.

---

## Commit Format

Use **conventional commits**:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** `feat` · `fix` · `docs` · `refactor` · `perf` · `test` · `ci` · `chore`

**Scopes:** `transform` · `xpath` · `editor` · `validate` · `examples` · `ui` · `docs` · `tests`

**Subject rules:** imperative mood (`add` not `added`), no period, ≤50 chars.

**Body:** explain *why*, not what. Wrap at 72 chars.

**Footer:** `Fixes #123` or `Refs #123`.

### Examples

```
feat(transform): Add CPI property simulation

- Rewrite cpi:setProperty calls to js:_cpiSetProperty
- Build property params from Properties panel
- Show output properties after transform

Fixes #89
```

```
fix(xpath): Handle empty nodeset results

Previous code assumed results array always present.
Now checks before rendering hints.

Refs #123
```

**Bad commits:**
```
Updated stuff          # vague, no type
feat: fixed the thing  # wrong mood, vague
Merge branch 'dev'     # meaningless
```

---

## PR Process

### Before Starting

1. Search [Issues](https://github.com/linusdevx/XSLTDebugX/issues) — avoid duplicate work
2. Check [reference/features.md](reference/features.md) — feature may exist
3. Open an issue for significant features; small fixes can skip this

### Branch & Submit

Feature branches are cut from `dev` and PR back into `dev`. The `dev` → `main` PR is opened separately by maintainers when releasing.

```bash
git checkout dev
git pull origin dev
git checkout -b feat/your-feature   # or fix/description — branched from dev
# ... make changes ...
npm run test:e2e                    # must pass
git push origin feat/your-feature
# Open PR with base = dev (NOT main)
```

### PR Description Template

```markdown
## Description
Brief explanation.

## Changes
- Change 1
- Change 2

## Testing
- [ ] Chrome + Firefox
- [ ] E2E tests pass
- [ ] No console errors
- [ ] localStorage persists after refresh

Fixes #123
```

### Review & Merge

- Requires 1 maintainer approval
- All CI checks must pass
- Respond to feedback within a week
- Don't merge your own PRs

### Common CI Failures

```bash
npm run test:e2e -- tests/e2e/workflows/failing.spec.js
# Fix, then:
git commit -m "fix: address review feedback"
git push
```

**Needs docs update?** Update relevant files and note them in the PR description.

**Needs tests?** Add to `tests/e2e/workflows/`, run locally first.

---

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub PR Docs](https://docs.github.com/en/pull-requests)
- [ARCHITECTURE.md](ARCHITECTURE.md) — constraints and patterns
- [TESTING.md](TESTING.md) — test patterns
