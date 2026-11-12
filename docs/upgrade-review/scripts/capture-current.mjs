/**
 * Capture current-state screenshots for C2 visual evidence.
 * Produces 12 PNGs: XSLT/XPath × dark/light × Explorer open/closed × 3 viewports.
 *
 * Usage: node docs/upgrade-review/scripts/capture-current.mjs
 * Requires the dev server to be running on port 8000 (npm run serve).
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'screenshots', 'current');
const BASE = 'http://localhost:8000';

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768',  width: 1366, height: 768  },
  { name: '390x844',   width: 390,  height: 844  },
];

const MODES = ['xslt', 'xpath'];
const THEMES = ['dark', 'light'];

async function capture() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    for (const theme of THEMES) {
      for (const mode of MODES) {
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForSelector('.monaco-editor', { timeout: 15000 });

        // Set theme
        await page.evaluate(t => setWorkspaceTheme(t), theme);
        await page.waitForTimeout(200);

        // Set mode
        if (mode === 'xpath') {
          await page.locator('#modeBtnXpath').click();
          await page.waitForTimeout(300);
        }

        // Explorer OPEN
        await page.evaluate(() => { if (!document.getElementById('workspaceExplorer')?.classList.contains('open')) toggleExplorer(true); });
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(OUT, `${mode}-${theme}-explorer-open-${vp.name}.png`), fullPage: false });

        // Explorer CLOSED
        await page.evaluate(() => { if (document.getElementById('workspaceExplorer')?.classList.contains('open')) toggleExplorer(false); });
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(OUT, `${mode}-${theme}-explorer-closed-${vp.name}.png`), fullPage: false });
      }
    }

    await ctx.close();
  }

  await browser.close();
  console.log(`Captured 24 screenshots to ${OUT}`);
}

capture().catch(err => { console.error(err); process.exit(1); });
