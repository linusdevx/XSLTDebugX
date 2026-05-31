# E2E Testing Guide for XSLTDebugX

## Overview

XSLTDebugX uses **Playwright** for end-to-end (E2E) testing. Tests verify the complete user workflows without mocking any backend systems.

**Status**: ✅ 87 tests passing (smoke + 8 workflow specs)

---

## Test Structure

```
<repo root>/
├── playwright.config.js                 # Playwright configuration (project: chromium)
├── package.json                         # Test scripts and dependencies
└── tests/
    ├── utils/
    │   └── test-helpers.js              # EditorPage class - all test utilities
    ├── fixtures/
    │   └── sample-data.js               # Test data (XML, XSLT, XPath examples)
    └── e2e/
        ├── smoke.spec.js                    # 4 tests: smoke checks (incl. 1 SUMMARY)
        └── workflows/
            ├── mode-switching.spec.js       # 13 tests: XSLT ↔ XPath mode switching
            ├── session-management.spec.js   #  8 tests: localStorage persistence
            ├── xpath-evaluation.spec.js     #  7 tests: XPath expression evaluation
            ├── xslt-transform.spec.js       #  8 tests: XSLT transformations
            ├── cpi-simulation.spec.js       # 12 tests: CPI headers/properties, interceptors
            ├── examples-library.spec.js     # 14 tests: Examples modal, search, categories
            ├── share-url.spec.js            #  9 tests: URL encoding, session sharing
            └── kv-search.spec.js            # 12 tests: KV header/property search filter
```

---

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run specific test file
```bash
npx playwright test tests/e2e/workflows/mode-switching.spec.js
```

### Run single test
```bash
npx playwright test tests/e2e/workflows/mode-switching.spec.js -g "should switch from XSLT"
```

### Run with UI (watch mode)
```bash
npm run test:e2e:ui
```

### Run with headed browser (see browser actions)
```bash
npm run test:e2e:headed
```

### Run in debug mode (Playwright Inspector)
```bash
npm run test:e2e:debug
```

### Filter to the only configured project
```bash
# Only the `chromium` project is enabled in playwright.config.js
npx playwright test --project=chromium
```

### Run against the production build
```bash
npm run build
TEST_SERVER=dist npx playwright test --workers=4
```

---

## Test Suites

### 1. Smoke Tests (`smoke.spec.js`)
Quick sanity checks - 4 tests (3 real + 1 SUMMARY):
- ✅ should load app with all UI elements visible
- ✅ should perform basic XSLT transform
- ✅ should switch between XSLT and XPath modes
- (SUMMARY pseudo-test prints suite summary)

**Run**: `npx playwright test tests/e2e/smoke.spec.js`

### 2. Mode Switching (`workflows/mode-switching.spec.js`)
Tests switching between XSLT and XPath modes - 13 tests (12 real + 1 SUMMARY):
- ✅ should switch from XSLT mode to XPath mode
- ✅ should switch from XPath mode to XSLT mode
- ✅ should preserve XML content when switching modes
- ✅ should preserve XSLT content when switching modes and back
- ✅ should preserve transform output when mode is preserved
- ✅ should show correct mode indicator badge for XSLT
- ✅ should show correct mode indicator badge for XPath
- ✅ should have separate XML state per mode (isolation test)
- ✅ should update mode indicator when button is clicked
- ✅ should clear transform output when switching modes
- ✅ should support rapid mode switching
- ✅ should persist mode preference across page reload

**Run**: `npx playwright test tests/e2e/workflows/mode-switching.spec.js`

### 3. Session Management (`workflows/session-management.spec.js`)
Tests localStorage persistence - 8 tests (7 real + 1 SUMMARY):
- ✅ should auto-save session to localStorage
- ✅ should persist session after page reload
- ✅ should store output when transform runs
- ✅ should maintain session mode (XSLT vs XPath) in localStorage
- ✅ should restore session mode after reload
- ✅ should preserve session across mode switches
- ✅ should load empty editors on fresh start

**Run**: `npx playwright test tests/e2e/workflows/session-management.spec.js`

### 4. XPath Evaluation (`workflows/xpath-evaluation.spec.js`)
Tests XPath expressions - 7 tests (6 real + 1 SUMMARY):
- ✅ should evaluate simple XPath expression (count)
- ✅ should select nodes with XPath
- ✅ should handle XPath with predicates
- ✅ should handle empty result set gracefully
- ✅ should switch mode from XPath to XSLT
- ✅ should preserve XML content in XPath mode

**Run**: `npx playwright test tests/e2e/workflows/xpath-evaluation.spec.js`

### 5. XSLT Transform (`workflows/xslt-transform.spec.js`)
Tests XSLT transformations - 8 tests (7 real + 1 SUMMARY):
- ✅ should perform a basic XSLT transform (XML → XSLT → Output)
- ✅ should detect malformed XML
- ✅ should run XSLT via Ctrl+Enter keyboard shortcut
- ✅ should handle empty XML input
- ✅ should preserve XSLT across mode switch
- ✅ should store session after transform
- ✅ should be in XSLT mode initially

**Run**: `npx playwright test tests/e2e/workflows/xslt-transform.spec.js`

### 6. CPI Simulation (`workflows/cpi-simulation.spec.js`)
Tests SAP CPI (Cloud Integration) simulation features - 12 tests (11 real + 1 SUMMARY):
- ✅ should add a single header and display count
- ✅ should add multiple headers
- ✅ should add a property and display count
- ✅ should add both headers and properties together
- ✅ should update an existing header
- ✅ should delete a header
- ✅ should execute XSLT with headers and verify in output
- ✅ should execute XSLT with multiple headers and properties
- ✅ should persist headers/properties across page reload
- ✅ should clear headers/properties when clearing session
- ✅ should not include headers/properties in XPath mode

**Run**: `npx playwright test tests/e2e/workflows/cpi-simulation.spec.js`

### 7. Examples Library (`workflows/examples-library.spec.js`)
Tests example modal, search, filtering, and loading - 14 tests (13 real + 1 SUMMARY):
- ✅ should open examples modal and render sidebar categories
- ✅ should close modal on backdrop click
- ✅ should load transform example and populate XML/XSLT
- ✅ should load XPath example and switch to XPath mode
- ✅ should load CPI example with auto-populated headers
- ✅ should search examples by keyword
- ✅ should return to full list when clearing search
- ✅ should toggle auto-run checkbox and persist preference
- ✅ should auto-run example when preference is enabled
- ✅ should clear validation errors when loading example
- ✅ should display correct mode indicator in modal
- ✅ should isolate examples by category
- ✅ should not populate headers in XPath examples

**Run**: `npx playwright test tests/e2e/workflows/examples-library.spec.js`

### 8. Share URL (`workflows/share-url.spec.js`)
Tests session sharing via encoded URLs - 9 tests (8 real + 1 SUMMARY):
- ✅ should generate a share URL from current editor state
- ✅ should include headers in share URL and decode correctly
- ✅ should include properties in share URL and decode correctly
- ✅ should generate consistent share URL for same content
- ✅ should handle corrupted share URL gracefully
- ✅ should perform round-trip: generate URL, load, generate again with same result
- ✅ should clean up hash from URL after loading share data, and verify content is decoded
- ✅ should close share modal when clicking outside

**Run**: `npx playwright test tests/e2e/workflows/share-url.spec.js`

### 9. KV Search (`workflows/kv-search.spec.js`)
Tests substring filter on Headers / Properties / output KV panels - 12 tests:
- ✅ toggles the search bar open and closed
- ✅ filters rows by substring match against the name column
- ✅ filters rows by substring match against the value column
- ✅ clear button restores all rows
- ✅ shows a "No matches" line when query matches nothing
- ✅ keeps filter active across adding a new row
- ✅ keeps filter active across deleting a matching row
- ✅ closing the search bar clears the query and restores rows
- ✅ does not mutate kvData (persistence unchanged)
- ✅ search-toggle button shows active state when query is non-empty
- ✅ Properties panel filter works the same way
- ✅ filters output Headers panel after a transform sets multiple headers

**Run**: `npx playwright test tests/e2e/workflows/kv-search.spec.js`

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

The CI workflow already exists at [`.github/workflows/e2e-tests.yml`](../workflows/e2e-tests.yml).

It runs on push and pull request to `dev` and `main`, and:

- Uses **Node.js 24** with `npm ci`
- Runs `npm run build` to produce `dist/`
- Verifies the built bundle (asserts no raw `js/` script tags remain in `dist/index.html`)
- Installs Chromium via `npx playwright install chromium` (+ `install-deps`)
- Runs the suite against the production build with:
  ```bash
  TEST_SERVER=dist npx playwright test --workers=4
  ```
- Uploads the HTML report (`playwright-report/`) and JUnit/JSON results (`test-results/`) as artifacts

To reproduce the CI run locally:

```bash
npm ci
npm run build
TEST_SERVER=dist npx playwright test --workers=4
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

✅ **87 tests passing** (across 9 spec files)
- Smoke tests: 4/4
- Mode switching: 13/13
- Session management: 8/8
- XPath evaluation: 7/7
- XSLT transforms: 8/8
- CPI simulation: 12/12
- Examples library: 14/14
- Share URL: 9/9
- KV search: 12/12

Last updated: June 1, 2026
