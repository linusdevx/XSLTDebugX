# Security Policy

## Supported versions

Only the latest revision on `main`, as deployed to **[xsltdebugx.pages.dev](https://xsltdebugx.pages.dev)**, is supported. Older commits are not patched.

## Reporting a vulnerability

Please use **[GitHub Security Advisories](https://github.com/linusdevx/XSLTDebugX/security/advisories/new)** for any sensitive report. Do **not** open a public issue for security problems.

- **Acknowledgement target:** within 7 days of report.
- **Fix target:** depends on severity — critical issues are prioritised over feature work.
- Public disclosure is coordinated with the reporter after a fix is released.

For non-sensitive bugs (broken UI, wrong output, etc.), use the regular [issue tracker](https://github.com/linusdevx/XSLTDebugX/issues).

## Security posture

XSLTDebugX is a **purely client-side** application. Knowing how it's built is the simplest way to evaluate whether it's safe for your environment.

### No backend, no telemetry

- There is **no server-side component**. The app is static HTML + JS served from Cloudflare Pages.
- The app does not send your XML, XSLT, headers, properties, or XPath expressions anywhere. Everything stays in your browser tab.
- The only data leaving your browser is what *you* trigger: clicking **Share** encodes the current state into a URL fragment (`#...`) that you copy and send yourself; URL fragments are never sent to the server.
- The deployed site uses **[GoatCounter](https://www.goatcounter.com/)** for anonymous, aggregate pageview counts. It does not set cookies, does not fingerprint visitors, and does not see editor content. Self-hosters can remove the GoatCounter `<script>` tag from `index.html` to disable it entirely.

### Zero runtime npm dependencies

The app ships with **no npm packages** at runtime. The full list of runtime code:

| Component | Source | License |
|---|---|---|
| Saxon-JS 2.x (XSLT/XPath engine) | Bundled locally in `lib/SaxonJS2.js` at a pinned version | MPL-2.0 |
| Monaco Editor | CDN (`cdn.jsdelivr.net`) at a pinned version | MIT |
| Lucide Icons | CDN (`cdn.jsdelivr.net`) at a pinned version | ISC |
| pako (share-URL compression) | CDN (`cdnjs.cloudflare.com`) at a pinned version | MIT |
| JetBrains Mono | Google Fonts | OFL-1.1 |

`npm install` only pulls **devDependencies** (Playwright, Vite, http-server, esbuild). None of them are part of the deployed bundle.

### Auditing the source

The full source is AGPL-3.0-or-later. The deployed bundle (`dist/app.{hash}.js`) is produced by `npm run build` from this repo — there is no minified-only artifact you cannot rebuild. The build pipeline is documented in [`.github/docs/ARCHITECTURE.md`](.github/docs/ARCHITECTURE.md).

### Transport security

- The deployed site is served over HTTPS only.
- HTTP response headers (CSP, X-Content-Type-Options, Referrer-Policy, etc.) are set via the Cloudflare Pages `_headers` file in the repo root.

## Automated scanning

The repository is continuously scanned by GitHub-native tooling. Results are public; click the badges in the README to view live reports.

| Tool | What it checks | Schedule |
|---|---|---|
| **CodeQL** | Static analysis of our JavaScript (XSS sinks, prototype pollution, unsafe `eval`, suspicious network calls, etc.) using the `security-and-quality` query suite. | Every push, every PR, weekly cron |
| **OpenSSF Scorecard** | Repository security practices: branch protection, signed releases, dangerous workflow patterns, SAST presence, dependency pinning. | Weekly cron + push to `main` |
| **Dependabot** | Version updates for devDependencies and GitHub Actions. | Weekly |

Configuration lives in [`.github/workflows/codeql.yml`](.github/workflows/codeql.yml), [`.github/workflows/scorecard.yml`](.github/workflows/scorecard.yml), and [`.github/dependabot.yml`](.github/dependabot.yml).

## What this project does *not* claim

- **Not a certified product.** No SOC2 / ISO27001 / FedRAMP audit has been performed.
- **Not affiliated with SAP SE.** "SAP", "SAP Cloud Integration", and "CPI" are trademarks of SAP SE; this is an independent open-source tool.
- **Your XSLT is still your responsibility.** XSLTDebugX simulates the CPI runtime — it does not validate that the resulting iFlow is correct for your business case.
