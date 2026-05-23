# Contributing to XSLTDebugX

Welcome! XSLTDebugX is an open-source browser-based XSLT 3.0 IDE maintained by the community. This guide will help you contribute code, documentation, examples, and bug reports.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Before You Start](#before-you-start)
- [Development Setup](#development-setup)
- [Code Style Guide](#code-style-guide)
- [Working with Examples](#working-with-examples)
- [Testing Your Changes](#testing-your-changes)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Issue Reporting](#issue-reporting)
- [License](#license)

---

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful in all interactions and follow the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2_1/code_of_conduct/).

---

## Before You Start

- **Check existing issues** — Search [GitHub Issues](https://github.com/linusdevx/XSLTDebugX/issues) to see if your idea is already being discussed
- **Open an issue first** — For significant features or breaking changes, open an issue to discuss the approach before coding
- **Small fixes** — Bug fixes and documentation improvements can go straight to a PR

---

## Development Setup

See [.github/docs/DEVELOPMENT.md](.github/docs/DEVELOPMENT.md) for full setup instructions, including local serving options (Node.js, Python, PHP, VS Code Live Server), debugging in DevTools, and testing your changes.

---

## Code Style Guide

See [.github/docs/DEVELOPMENT.md](.github/docs/DEVELOPMENT.md) for detailed code style guidelines covering JavaScript (naming, organization, error handling), CSS (naming, themes), and HTML (structure, attributes).

**Key points:** use `const`/`let`, camelCase, prefix internal functions with `_`, emoji section dividers, comment the "why" not the "what".

---

## Working with Examples

See [.github/docs/reference/examples-data.md](.github/docs/reference/examples-data.md) for the complete example library structure, format validation rules, and how to add new examples to `js/examples-data.js`.

---

## Testing Your Changes

See [.github/docs/TESTING.md](.github/docs/TESTING.md) for the complete E2E testing guide with Playwright setup, running tests, writing tests with Page Object Model, and debugging.

Key commands:
```bash
npm install              # Setup (once)
npm run test:e2e         # Run all tests
npm run test:e2e:ui      # Interactive UI mode
npm run test:e2e:debug   # Debugger mode
```

---

## Browser Testing

Before submitting a PR, test manually in browser:
- **Core**: Transform runs, XPath evaluates, themes toggle, no console errors
- **Features**: Headers/Properties inject, CPI simulation works, file upload/download, examples load
- **Storage**: Refresh browser, verify state persists
- **Compatibility**: Test on Chrome, Firefox, Safari, Edge (latest versions)

See [.github/docs/TESTING.md](.github/docs/TESTING.md) for the complete checklist and DevTools debugging guide.

---

## Submitting a Pull Request

1. **Fork and clone** the repository
2. **Create a feature branch**: `git checkout -b feature/my-feature` or `git checkout -b fix/my-fix`
3. **Make your changes** and test thoroughly
4. **Commit with clear messages**: `git commit -m "Fix: description"` or `git commit -m "Feat: description"`
5. **Push to your fork**: `git push origin feature/my-feature`

### PR Description Template

When opening a PR on GitHub, use this template:

```markdown
## Description
Brief summary of the change (1-2 sentences).

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (change that breaks existing functionality)
- [ ] Documentation update

## Related Issues
Closes #123

## Testing
Describe how you tested this change:
- Tested XSLT mode with large transforms
- Verified XPath highlights update on theme switch
- Tested on Chrome and Firefox

## Checklist
- [ ] I have tested the change in a browser
- [ ] I have verified no console errors appear
- [ ] I have updated related documentation
- [ ] I have added a new example (if applicable)
- [ ] My code follows the code style guide
```

### PR Review Process

1. **GitHub Actions** runs basic lint checks (if configured)
2. **Maintainer reviews** code style, logic, and test coverage
3. **Feedback** provided on PR (may require changes)
4. **Approval** and merge to `main` branch
5. **Auto-deployment** to `xsltdebugx.pages.dev` via Cloudflare Pages

---

## Issue Reporting

Found a bug? Help us fix it!

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

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (AGPL-3.0-or-later). See [LICENSE](LICENSE) for details.

---

## Questions?

- **User features**: See [README.md](README.md)
- **Developer docs**: See [.github/docs/DEVELOPMENT.md](.github/docs/DEVELOPMENT.md) (setup, testing, architecture)
- **API reference**: See [.github/docs/reference/](.github/docs/reference/)
- **Discussions**: Open a GitHub Discussion
- **Bug reports / Feature requests**: Use GitHub Issues

Thank you for contributing to XSLTDebugX! 🙏
