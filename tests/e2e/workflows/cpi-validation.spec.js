import { test, expect } from '@playwright/test';
import { EditorPage } from '../../utils/test-helpers.js';
import { cpiBadSamples } from '../../fixtures/cpi-bad-samples.js';

/**
 * CPI pre-flight validation: catches unknown cpi: functions, wrong arity,
 * missing xmlns:cpi, missing <xsl:param name="exchange"/>, and reports
 * accurate line numbers even for whitespace-rich expressions.
 */

// Read messages directly from the console DOM. The page-object's
// getConsoleMessages relies on a clog.getMessages() API that does not exist;
// the real source of truth is the #consoleBody DOM tree.
async function readConsoleDom(testPage) {
  return await testPage.evaluate(() => {
    const lines = document.querySelectorAll('#consoleBody .log-line');
    return Array.from(lines).map(el => ({
      type: el.dataset.type || 'info',
      text: el.querySelector('.msg')?.textContent || '',
    }));
  });
}

function extractReportedLine(messages) {
  for (const m of messages) {
    const match = (m.text || '').match(/(?:line|at line)\s+(\d+)/i);
    if (match) return parseInt(match[1]);
  }
  return null;
}

test.describe('CPI pre-flight validation', () => {
  let page;
  let testPage;

  test.beforeEach(async ({ page: pwPage }) => {
    testPage = pwPage;
    page = new EditorPage(pwPage);
    try {
      await page.navigate();
    } catch {
      test.skip();
      return;
    }
    await pwPage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.switchToXslt();
    await page.clearConsole();
  });

  async function loadAndRun(fixture) {
    await page.fillXml(fixture.xml);
    await page.fillXslt(fixture.xslt);
    await page.clickRun();
    return await readConsoleDom(testPage);
  }

  test('unknown cpi function (cpi:setHeaders typo) is rejected with clear message', async () => {
    const f = cpiBadSamples.unknownCpiFunction;
    const messages = await loadAndRun(f);
    const errors = messages.filter(m => m.type === 'error');
    expect(errors.some(m => m.text.includes(f.expectedFragment))).toBe(true);
    expect(extractReportedLine(errors)).toBe(f.expectedLine);
  });

  test('cpi:getHeader is rejected (does not exist in real CPI)', async () => {
    const f = cpiBadSamples.cpiGetter;
    const messages = await loadAndRun(f);
    const errors = messages.filter(m => m.type === 'error');
    expect(errors.some(m => m.text.includes(f.expectedFragment))).toBe(true);
  });

  test('cpi:setHeader with 2 args is rejected with arity message', async () => {
    const f = cpiBadSamples.wrongArityTwo;
    const messages = await loadAndRun(f);
    const errors = messages.filter(m => m.type === 'error');
    expect(errors.some(m => m.text.includes(f.expectedFragment))).toBe(true);
  });

  test('missing xmlns:cpi is detected', async () => {
    const f = cpiBadSamples.missingNamespace;
    const messages = await loadAndRun(f);
    const errors = messages.filter(m => m.type === 'error');
    expect(errors.some(m => m.text.includes(f.expectedFragment))).toBe(true);
  });

  test('missing <xsl:param name="exchange"/> is detected', async () => {
    const f = cpiBadSamples.missingExchangeParam;
    const messages = await loadAndRun(f);
    const errors = messages.filter(m => m.type === 'error');
    expect(errors.some(m => m.text.includes(f.expectedFragment))).toBe(true);
  });

  test('first arg not $exchange is detected', async () => {
    const f = cpiBadSamples.wrongFirstArg;
    const messages = await loadAndRun(f);
    const errors = messages.filter(m => m.type === 'error');
    expect(errors.some(m => m.text.includes(f.expectedFragment))).toBe(true);
  });

  test('valid minimal CPI XSLT passes pre-flight and produces output', async () => {
    const f = cpiBadSamples.validMinimalCpi;
    await page.fillXml(f.xml);
    await page.fillXslt(f.xslt);
    await page.clickRun();
    const messages = await readConsoleDom(testPage);
    const cpiErrors = messages.filter(m =>
      m.type === 'error' && /CPI error/.test(m.text)
    );
    expect(cpiErrors).toHaveLength(0);
    const out = await page.getOutput();
    expect(out).toContain('<out');
  });

  test('whitespace-rich XPath expression resolves to correct source line (Task 1)', async () => {
    const f = cpiBadSamples.whitespaceLineSpacing;
    const messages = await loadAndRun(f);
    // This case is a Saxon static error (bogus-fn unknown), NOT a CPI
    // pre-flight error — so we look for the "↳ Error at line N" message.
    const arrowLine = messages
      .map(m => m.text)
      .map(t => t.match(/at line\s+(\d+)/i))
      .filter(Boolean)
      .map(m => parseInt(m[1]));
    expect(arrowLine).toContain(f.expectedLine);
  });

  test('bundled "CPI Headers & Properties" example still runs end-to-end', async () => {
    await testPage.click('button#exBtn');
    await testPage.waitForSelector('#exModalBackdrop.open', { timeout: 5000 });
    await testPage.click('text=CPI Headers & Properties (Complete)');
    await testPage.waitForTimeout(1000);
    await page.clickRun();
    const messages = await readConsoleDom(testPage);
    const cpiErrors = messages.filter(m =>
      m.type === 'error' && /CPI error/.test(m.text)
    );
    expect(cpiErrors).toHaveLength(0);
  });
});
