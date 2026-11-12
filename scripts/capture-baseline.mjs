import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('docs/upgrade-review/screenshots');
await mkdir(outputDir, { recursive: true });

const targets = [
  ['local', 'http://localhost:8000/'],
  ['live', 'https://xsltdebugx.pages.dev/'],
];

const viewports = [
  ['1920x1080', { width: 1920, height: 1080 }],
  ['1366x768', { width: 1366, height: 768 }],
  ['390x844', { width: 390, height: 844 }],
];

const browser = await chromium.launch();
const evidence = [];

for (const [targetName, url] of targets) {
  for (const [viewportName, viewport] of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const requests = new Set();
    const pageErrors = [];
    const consoleErrors = [];

    page.on('request', request => requests.add(new URL(request.url()).origin));
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('#loadingOverlay').waitFor({ state: 'hidden', timeout: 30_000 });

    await page.locator('#modeBtnXslt').click();
    await page.locator('#runBtn').click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(outputDir, `${targetName}-xslt-${viewportName}.png`),
      fullPage: false,
    });

    await page.locator('#modeBtnXpath').click();
    await page.locator('#xpathInput').fill('count(//*)');
    await page.locator('#runBtn').click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(outputDir, `${targetName}-xpath-${viewportName}.png`),
      fullPage: false,
    });

    const browserState = await page.evaluate(async () => ({
      localStorage: Object.fromEntries(
        Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]),
      ),
      sessionStorage: Object.fromEntries(
        Object.keys(sessionStorage).sort().map(key => [key, sessionStorage.getItem(key)]),
      ),
      storageEstimate: navigator.storage?.estimate
        ? await navigator.storage.estimate()
        : null,
      storagePersisted: navigator.storage?.persisted
        ? await navigator.storage.persisted()
        : null,
      mode: window.modeManager?.isXpath ? 'xpath' : 'xslt',
      editorModels: window.monaco?.editor?.getModels().map(model => ({
        language: model.getLanguageId(),
        uri: model.uri.toString(),
        length: model.getValueLength(),
      })) ?? [],
      bodyClass: document.body.className,
      overflow: {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        viewportHeight: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
      },
    }));

    evidence.push({
      target: targetName,
      url,
      viewport: viewportName,
      requests: [...requests].sort(),
      pageErrors,
      consoleErrors,
      browserState,
    });
    await context.close();
  }
}

await browser.close();
await writeFile(
  path.resolve('docs/upgrade-review/browser-baseline.json'),
  JSON.stringify(evidence, null, 2),
);
