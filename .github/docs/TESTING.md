# E2E Testing Guide for XSLTDebugX

## Overview

XSLTDebugX uses **Playwright** for end-to-end (E2E) testing. Tests verify the complete user workflows without mocking any backend systems.

**Status**: ✅ 75 tests passing (7 test suites + smoke tests)

---

## Test Structure

```
tests/
├── e2e/
│   ├── smoke.spec.js                    # Quick smoke tests (UI elements, basic transforms)
│   ├── utils/
│   │   └── test-helpers.js              # EditorPage class - all test utilities
│   ├── fixtures/
│   │   └── sample-data.js               # Test data (XML, XSLT, XPath examples)
│   └── workflows/
│       ├── mode-switching.spec.js       # 13 tests: XSLT ↔ XPath mode switching
│       ├── session-management.spec.js   # 8 tests: localStorage persistence
│       ├── xpath-evaluation.spec.js     # 7 tests: XPath expression evaluation
│       ├── xslt-transform.spec.js       # 8 tests: XSLT transformations
│       ├── cpi-simulation.spec.js       # 12 tests: CPI headers/properties, interceptors
│       ├── examples-library.spec.js     # 14 tests: Examples modal, search, categories
│       └── share-url.spec.js            # 9 tests: URL encoding, session sharing
├── playwright.config.js                 # Playwright configuration
└── package.json                         # Test dependencies
```

---

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run specific test file
```bash
npm run test:e2e -- tests/e2e/workflows/mode-switching.spec.js
```

### Run single test
```bash
npm run test:e2e -- tests/e2e/workflows/mode-switching.spec.js -g "should switch from XSLT"
```

### Run with UI (watch mode)
```bash
npm run test:e2e -- --ui
```

### Run with headed browser (see browser actions)
```bash
npm run test:e2e -- --headed
```

### Run specific browser
```bash
npm run test:e2e -- --project=chrome
```

---

## Test Suites

### 1. Smoke Tests (`smoke.spec.js`)
Quick sanity checks - 4 tests:
- ✅ App loads with all UI elements
- ✅ Basic XSLT transform works
- ✅ Mode switching (XSLT ↔ XPath)
- ✅ Saxon-JS engine ready

**Run**: `npm run test:e2e -- tests/e2e/smoke.spec.js`

### 2. Mode Switching (`workflows/mode-switching.spec.js`)
Tests switching between XSLT and XPath modes - 13 tests:
- ✅ Switch from XSLT → XPath
- ✅ Switch from XPath → XSLT
- ✅ Preserve content when switching
- ✅ Mode indicator badge
- ✅ Rapid mode switches
- ✅ Persist mode preference across reload

**Run**: `npm run test:e2e -- tests/e2e/workflows/mode-switching.spec.js`

### 3. Session Management (`workflows/session-management.spec.js`)
Tests localStorage persistence - 8 tests:
- ✅ Auto-save session to localStorage
- ✅ Persist session after page reload
- ✅ Store transform output
- ✅ Maintain mode in session
- ✅ Restore mode after reload
- ✅ Preserve session across mode switches
- ✅ Handle empty session gracefully

**Run**: `npm run test:e2e -- tests/e2e/workflows/session-management.spec.js`

### 4. XPath Evaluation (`workflows/xpath-evaluation.spec.js`)
Tests XPath expressions - 7 tests:
- ✅ Evaluate count expressions
- ✅ Select text nodes
- ✅ Handle predicates
- ✅ Select attributes
- ✅ Handle empty results
- ✅ Work with namespaces

**Run**: `npm run test:e2e -- tests/e2e/workflows/xpath-evaluation.spec.js`

### 5. XSLT Transform (`workflows/xslt-transform.spec.js`)
Tests XSLT transformations - 8 tests:
- ✅ Basic XML → XSLT → output
- ✅ Detect malformed XML
- ✅ Ctrl+Enter keyboard shortcut
- ✅ Handle empty XML
- ✅ Preserve XSLT across mode switch
- ✅ Store session after transform
- ✅ Show mode indicator

**Run**: `npm run test:e2e -- tests/e2e/workflows/xslt-transform.spec.js`

### 6. CPI Simulation (`workflows/cpi-simulation.spec.js`)
Tests SAP CPI (Cloud Integration) simulation features - 12 tests:
- ✅ Add single header and display count
- ✅ Add multiple headers
- ✅ Add property and display count
- ✅ Add both headers and properties together
- ✅ Update existing header
- ✅ Delete header
- ✅ Execute XSLT with headers and verify in output
- ✅ Execute XSLT with multiple headers and properties
- ✅ Persist headers/properties across page reload
- ✅ Clear headers/properties when clearing session
- ✅ Don't include headers/properties in XPath mode

**Run**: `npm run test:e2e -- tests/e2e/workflows/cpi-simulation.spec.js`

### 7. Examples Library (`workflows/examples-library.spec.js`)
Tests example modal, search, filtering, and loading - 14 tests:
- ✅ Open examples modal and render sidebar categories
- ✅ Close modal on backdrop click
- ✅ Load transform example and populate XML/XSLT
- ✅ Load XPath example and switch to XPath mode
- ✅ Load CPI example with auto-populated headers
- ✅ Search examples by keyword
- ✅ Return to full list when clearing search
- ✅ Toggle auto-run checkbox and persist preference
- ✅ Auto-run example when preference is enabled
- ✅ Clear validation errors when loading example
- ✅ Display correct mode indicator in modal
- ✅ Isolate examples by category
- ✅ Not populate headers in XPath examples

**Run**: `npm run test:e2e -- tests/e2e/workflows/examples-library.spec.js`

### 8. Share URL (`workflows/share-url.spec.js`)
Tests session sharing via encoded URLs - 9 tests:
- ✅ Generate share URL from current editor state
- ✅ Include headers in share URL and decode correctly
- ✅ Include properties in share URL and decode correctly
- ✅ Generate consistent share URL for same content
- ✅ Handle corrupted share URL gracefully
- ✅ Perform round-trip: generate → load → generate with same result
- ✅ Clean up hash from URL after loading share data
- ✅ Close share modal when clicking outside

**Run**: `npm run test:e2e -- tests/e2e/workflows/share-url.spec.js`

---

## Test Utilities (`test-helpers.js`)

The `EditorPage` class provides all utilities needed for testing:

```javascript
const page = new EditorPage(testPage);

// Navigation
await page.navigate();                    // Go to http://localhost:8000

// Editor content
await page.fillXml(xmlString);
await page.fillXslt(xsltString);
const xml = await page.getXmlContent();
const xslt = await page.getXsltContent();
const output = await page.getOutput();

// Mode switching
await page.switchToXslt();
await page.switchToXpath();
const mode = await page.getMode();        // Returns 'XSLT' or 'XPATH'

// Running transforms
await page.clickRun();                    // Click run button
await page.runViaKeyboard();              // Ctrl+Enter

// Session/Storage
await page.getStoredSession();            // Get localStorage session
const session = localStorage.getItem('xdebugx-session-v1');

// Console
const errors = await page.getConsoleErrors();
const messages = await page.getConsoleMessages();

// Helpers
await page.hasErrors();                   // Check for error badge
const mode = await page.getModeIndicator();
```

---

## Key Test Patterns

### 1. Setup & Cleanup
```javascript
test.beforeEach(async ({ page: testPage }) => {
  page = new EditorPage(testPage);
  // Navigate first (localStorage requires DOM)
  await page.navigate();
  // THEN clear storage
  await testPage.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});
```

### 2. Waiting for Auto-Save
```javascript
// Session auto-saves after ~800ms debounce
await page.fillXml(xml);
await testPage.waitForTimeout(1500);  // Wait for save
const session = await page.getStoredSession();
```

### 3. Mode Switching
```javascript
await page.switchToXpath();
await testPage.waitForTimeout(1000);  // Wait for animations
const mode = await page.getMode();
expect(mode).toBe('XPATH');
```

### 4. Assertions
```javascript
// Content
expect(output).toBeTruthy();
expect(output).toContain('<tag>');
expect(xmlContent.length).toBeGreaterThan(0);

// Mode
expect(mode).toBe('XSLT');

// Storage
expect(session).not.toBeNull();
expect(session.xmlXslt).toBeTruthy();
```

---

## Troubleshooting

### Test times out
- Increase `waitForTimeout` values (browser animations, editor loading)
- Check that app is running on `http://localhost:8000`
- Use `--headed` flag to see what browser is doing

### localStorage errors
- Always navigate BEFORE trying to access localStorage
- Don't clear localStorage before navigating

### Mode switching not working
- `isXpath` and `isXslt` are getters (properties), not methods
- Don't call them like functions: `isXpath()` ❌, use `isXpath` ✅

### Editor content not updating
- Wait a bit after `fillXml()`: `await testPage.waitForTimeout(500)`
- Monaco editor events need time to trigger

---

## Best Practices

1. **Keep tests focused** - One workflow per test
2. **Use helper methods** - EditorPage abstracts DOM details
3. **Wait for async operations** - Editor saves, animations, loads
4. **Clean state** - Clear localStorage before each test
5. **Readable assertions** - Use `.toBeTruthy()` instead of checking length > 0
6. **Test order doesn't matter** - Each test should be independent

---

## CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
name: E2E Tests
on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Test Data

Sample data is in `fixtures/sample-data.js`:
- `simpleXml` - Basic user list XML
- `simpleXslt` - Basic transform stylesheet
- `namespacedXml` - XML with namespaces
- `xmlForXpath` - XML optimized for XPath testing
- `xpathExpressions` - Common XPath examples

---

## Debugging

### Enable Playwright Inspector
```bash
npx playwright test --debug
```

### View test trace
```bash
npx playwright show-trace test-results/trace.zip
```

### Print to console
```javascript
console.log('Debug message');  // Shows in test output
```

### Take screenshot
```javascript
await testPage.screenshot({ path: 'debug.png' });
```

---

## Maintenance

### Adding a new test
1. Create test in appropriate `.spec.js` file
2. Use existing `EditorPage` methods
3. Run test locally: `npm run test:e2e -- -g "test name"`
4. Ensure it passes consistently (no flakiness)
5. Add to this guide if it's a new pattern

### Updating test helpers
Edit `tests/utils/test-helpers.js` to add new utilities or fix existing ones.

### Updating test data
Edit `tests/fixtures/sample-data.js` to add new examples.

---

## Current Status

✅ **75 tests passing**
- Smoke tests: 4/4
- Mode switching: 13/13
- Session management: 8/8
- XPath evaluation: 7/7
- XSLT transforms: 8/8
- CPI simulation: 12/12
- Examples library: 14/14
- Share URL: 9/9

Last updated: May 3, 2026
