// vite.config.js
import { defineConfig } from 'vite';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { buildSync } from 'esbuild';

// Last-modified date for SEO (JSON-LD dateModified, sitemap <lastmod>).
// Prefer the last git commit date so rebuilds from older commits don't lie;
// fall back to wall-clock today when git is unavailable (e.g. tarball builds).
function resolveLastModified() {
  try {
    return execSync('git log -1 --format=%cs', { encoding: 'utf8' }).trim(); // %cs = YYYY-MM-DD
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Build-info chip shown in the bottom status bar: "YYYY-MM-DD (shortSHA)".
// Same git-or-fallback pattern as resolveLastModified — keeps source-tarball
// builds and detached-HEAD CI runs working. Two separate git calls because
// passing a multi-token --format string through execSync treats whitespace as
// argv separation on some shells.
function resolveBuildInfo() {
  try {
    const date = execSync('git log -1 --format=%cs', { encoding: 'utf8' }).trim();
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    return `${date} (${sha})`;
  } catch {
    return `${new Date().toISOString().slice(0, 10)} (unknown)`;
  }
}

// Exact load order from index.html — critical for global namespace correctness
const JS_MODULES = [
  'js/state.js',
  'js/mode-manager.js',
  'js/validate.js',
  'js/panes.js',
  'js/transform.js',
  'js/examples-data.js',
  'js/modal.js',
  'js/files.js',
  'js/ui.js',
  'js/share.js',
  'js/xpath.js',
  'js/themes.js',
  'js/editor.js',
];

export default defineConfig({
  plugins: [
    // Provide a virtual CSS-only entry so Vite processes and hashes style.css
    {
      name: 'css-entry',
      resolveId(id) {
        if (id === 'virtual:css-only') return '\0virtual:css-only';
      },
      load(id) {
        if (id === '\0virtual:css-only') return "import '/css/style.css';";
      },
    },

    // After Vite finishes (closeBundle = after writeBundle), build JS with esbuild,
    // copy vendor files, and emit dist/index.html — all in one pass so the hashed
    // JS filename is available when the HTML is written.
    {
      name: 'post-build',
      closeBundle() {
        // ── JS: concatenate + minify via esbuild (no module wrapper) ─────
        // esbuild minifies each file individually then we concatenate in order.
        // No IIFE wrapping = function declarations stay on window, so
        // onclick="runTransform()" HTML event handlers keep working.
        const TMP = '.esbuild-tmp';
        // Pre-clean: a previous run that errored mid-build can leave stale .js
        // files here; a removed/renamed module would then concatenate dead code.
        rmSync(TMP, { recursive: true, force: true });
        buildSync({
          entryPoints: JS_MODULES,
          bundle: false,
          minify: true,
          // keepNames intentionally OFF. esbuild's keepNames helper injects
          //   var p = Object.defineProperty;
          //   var l = (e,t) => p(e,"name",{value:t,configurable:true});
          // into every minified module. Because we concatenate at top level
          // (no IIFE wrapper — function decls must stay on window for inline
          // onclick=), every module's `var p` and `var l` collide globally.
          // esbuild picks letter assignments per-build; one unlucky pick makes
          // a later module's `var l = Object.defineProperty` overwrite an
          // earlier module's wrapper, and every subsequent l(...) call hits
          // defineProperty with one argument and throws "Property description
          // must be an object: undefined". We don't need keepNames anyway —
          // every name referenced from inline onclick="..." is a top-level
          // function declaration, which esbuild minify never renames.
          outdir: TMP,
        });

        const combined = JS_MODULES
          .map(m => readFileSync(`${TMP}/${m.replace('js/', '')}`, 'utf8'))
          .join('\n');

        rmSync(TMP, { recursive: true, force: true });

        const hash = createHash('sha256').update(combined).digest('hex').slice(0, 8);
        const jsFilename = `app.${hash}.js`;
        // Discover current-build CSS now so we can exclude it from the purge.
        const currentCssFile = readdirSync('dist').find(f => f.endsWith('.css'));

        // Purge prior hashed bundles so Cloudflare's immutable cache headers
        // don't ride orphans forever. emptyOutDir already cleared dist/ before
        // Vite ran, but Vite's CSS pass writes app.*.css before this plugin
        // fires, and any prior closeBundle output also accumulates across
        // partial-failure runs. Anchored regex prevents matching unrelated files.
        readdirSync('dist')
          .filter(f => /^app\.[a-f0-9]{8}\.(js|css)$/.test(f))
          .filter(f => f !== jsFilename && f !== currentCssFile) // keep current build's bundle
          .forEach(f => rmSync(`dist/${f}`, { force: true }));

        writeFileSync(`dist/${jsFilename}`, combined);

        // ── Vendor + config files ─────────────────────────────────────────
        mkdirSync('dist/lib', { recursive: true });
        copyFileSync('lib/SaxonJS2.js', 'dist/lib/SaxonJS2.js');
        copyFileSync('_headers', 'dist/_headers');
        if (existsSync('_redirects')) copyFileSync('_redirects', 'dist/_redirects');
        if (existsSync('favicon.svg')) copyFileSync('favicon.svg', 'dist/favicon.svg');
        if (existsSync('favicon-48.png')) copyFileSync('favicon-48.png', 'dist/favicon-48.png');
        if (existsSync('favicon-192.png')) copyFileSync('favicon-192.png', 'dist/favicon-192.png');
        if (existsSync('site.webmanifest')) copyFileSync('site.webmanifest', 'dist/site.webmanifest');
        if (existsSync('robots.txt')) copyFileSync('robots.txt', 'dist/robots.txt');
        if (existsSync('llms.txt')) copyFileSync('llms.txt', 'dist/llms.txt');
        if (existsSync('humans.txt')) copyFileSync('humans.txt', 'dist/humans.txt');
        // RFC 9116 security.txt — must be served from /.well-known/
        if (existsSync('.well-known/security.txt')) {
          mkdirSync('dist/.well-known', { recursive: true });
          copyFileSync('.well-known/security.txt', 'dist/.well-known/security.txt');
        }
        if (existsSync('og-image.png')) copyFileSync('og-image.png', 'dist/og-image.png');
        if (existsSync('screenshot.png')) copyFileSync('screenshot.png', 'dist/screenshot.png');

        // ── Resolve a single SEO date for this build, then inject it everywhere ──
        const lastModified = resolveLastModified();

        // sitemap.xml — replace <lastmod>…</lastmod> in-flight (read source, write dist)
        if (existsSync('sitemap.xml')) {
          const sitemap = readFileSync('sitemap.xml', 'utf8')
            .replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${lastModified}</lastmod>`);
          writeFileSync('dist/sitemap.xml', sitemap);
        }

        // ── Remove the empty JS stub Vite emits for the CSS-only entry ────
        rmSync('dist/assets', { recursive: true, force: true });

        // ── HTML: strip 12 <script src="js/..."> tags, inject bundle ─────
        const cssFile = currentCssFile;

        let html = readFileSync('index.html', 'utf8');
        html = html.replace(/<script src="js\/[^"]+"><\/script>\n?/g, '');
        html = html.replace('src="./lib/SaxonJS2.js"', 'src="lib/SaxonJS2.js"');
        if (cssFile) html = html.replace('href="css/style.css"', `href="${cssFile}"`);
        html = html.replace('</body>', `  <script src="${jsFilename}"></script>\n</body>`);
        // Refresh JSON-LD dateModified — keeps SEO signals current without manual edits
        html = html.replace(/"dateModified":\s*"[^"]*"/, `"dateModified": "${lastModified}"`);
        // Inject build-info chip ("YYYY-MM-DD (shortSHA)") replacing the __BUILD_INFO__
        // placeholder. Also flip data-placeholder="true" to "false" so the runtime
        // local-dev fallback (in the inline DOMContentLoaded script) leaves it alone.
        const buildInfo = resolveBuildInfo();
        html = html.replace('__BUILD_INFO__', buildInfo);
        html = html.replace('data-placeholder="true"', 'data-placeholder="false"');

        writeFileSync('dist/index.html', html);
      },
    },
  ],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'virtual:css-only',
      output: {
        assetFileNames: 'app.[hash][extname]',
      },
      onwarn(warning, warn) {
        if (['MISSING_GLOBAL_NAME', 'THIS_IS_UNDEFINED', 'EMPTY_BUNDLE'].includes(warning.code)) return;
        warn(warning);
      },
    },
    cssCodeSplit: false,
    cssMinify: true,
    minify: false, // JS minification handled by esbuild in post-build plugin
  },
});
