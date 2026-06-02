# Contributing to XSLTDebugX

Welcome! XSLTDebugX is an open-source browser-based XSLT 3.0 IDE maintained by the community. This guide covers code style, commit format, PR workflow, and bug reporting.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Before You Start](#before-you-start)
- [Development Setup](#development-setup)
- [PR Checklist](#pr-checklist)
- [Code Style](#code-style)
- [Commit Format](#commit-format)
- [PR Process](#pr-process)
- [Issue Reporting](#issue-reporting)
- [Maintenance](#maintenance-for-maintainers)
- [License](#license)

---

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful in all interactions and follow the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2_1/code_of_conduct/).

---

## Before You Start

1. Search [Issues](https://github.com/linusdevx/XSLTDebugX/issues) — avoid duplicate work.
2. Check [.github/docs/reference/features.md](.github/docs/reference/features.md) — the feature may already exist.
3. Open an issue for significant features or breaking changes; bug fixes and small docs improvements can go straight to a PR.

---

## Development Setup

See [.github/docs/DEVELOPMENT.md](.github/docs/DEVELOPMENT.md) for full setup, local serving options, and DevTools debugging. See [.github/docs/TESTING.md](.github/docs/TESTING.md) for the Playwright E2E guide.

Key commands:

```bash
npm install              # Setup (once)
npm run serve            # Local dev server on port 8000 (no build needed)
npm run test:e2e         # Run all tests
npm run test:e2e:ui      # Interactive UI mode
npm run test:e2e:debug   # Debugger mode
```

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

For examples authoring, see [.github/docs/reference/examples-data.md](.github/docs/reference/examples-data.md).

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
- After merge to `main`, Cloudflare Pages auto-deploys to `xsltdebugx.pages.dev`

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

## Issue Reporting

Found a bug? Help us fix it.

### Bug Report Template

```markdown
## Description
What did you try to do? What happened instead?

## Steps to Reproduce
1. Open XSLTDebugX
2. Load the "Data Transformation" example
3. Click "Run XSLT"
4. Expected: Output appears in 100ms
5. Actual: Console shows "Saxon error: undefined variable..."

## Environment
- **Browser**: Chrome 120 (Windows 10)
- **OS**: Windows 10
- **Version**: As of 2026-03-27

## Affected Code
If you know which file/function, mention it:
- File: `js/xpath.js`
- Function: `_highlightXPath()`

## Additional Context
Attach screenshots, XSLT snippets, or XML samples if relevant.
```

---

## Maintenance (for Maintainers)

**Before releasing:**
1. Bump version in README.md
2. Update CHANGELOG.md
3. Run `example-validator` skill to ensure all 61 examples pass
4. Test all examples in browser (click through each category)
5. Create GitHub release with version tag
6. Verify Cloudflare Pages deployment

**Updating dependencies:**
- **Saxon-JS**: Test all XPath and XSLT examples after updating
- **Monaco Editor**: Check release notes for breaking changes
- **Cloudflare Workers**: Update `wrangler.jsonc` and test deployment

---

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub PR Docs](https://docs.github.com/en/pull-requests)
- [.github/docs/ARCHITECTURE.md](.github/docs/ARCHITECTURE.md) — constraints and patterns
- [.github/docs/TESTING.md](.github/docs/TESTING.md) — test patterns
- [.github/docs/TRANSFORM.md](.github/docs/TRANSFORM.md) — CPI simulation deep dive

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (AGPL-3.0-or-later). See [LICENSE](LICENSE) for details.

---

## Questions?

- **User features**: See [README.md](README.md)
- **Developer docs**: See [.github/docs/DEVELOPMENT.md](.github/docs/DEVELOPMENT.md)
- **API reference**: See [.github/docs/reference/](.github/docs/reference/)
- **Discussions**: Open a GitHub Discussion
- **Bug reports / Feature requests**: Use GitHub Issues

Thank you for contributing to XSLTDebugX! 🙏
