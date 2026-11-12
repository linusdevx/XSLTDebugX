# XSLTDebugX improvement backlog

This file is the handoff for future implementation work. The local-first workspace upgrade is complete; its design decisions and detailed acceptance checklist live in [`docs/upgrade-review/IMPLEMENTATION_CHECKLIST.md`](docs/upgrade-review/IMPLEMENTATION_CHECKLIST.md).

## Working rules

- Keep the app simple and browser-local. Do not add accounts, a backend, cloud storage, or automatic legacy migration without explicit approval.
- Preserve the CPI Helper raw-deflate `#share/` contract and the safe recipient flow.
- Keep `cpi` identifiers internally for compatibility. Prefer **Cloud Integration** in new user-facing labels where it remains clear.
- Avoid duplicating controls or introducing floating-window complexity.
- Add focused tests for changed behavior. Run the full E2E suite only at a final integration gate.
- Update this file when an item is completed, deferred, or materially changed.

## Priority 1 — existing product and workflow refinement

- Audit the complete XSLT, XPath, SAP CPI, and Standard XSLT workflows for unclear or redundant steps.
- Simplify the top bar, Help access, pane actions, and footer while keeping primary actions discoverable.
- Review every pane icon and action: copy, clear, upload, import, download, format, and collapse. Standardize labels, ordering, tooltips, and keyboard access.
- Review light and dark themes for contrast, editor chrome, overlays, menus, dialogs, badges, and disabled states.
- Review Explorer, save/reopen, share receive/send, backup/import, conflict recovery, Trash, and failure-state UX.
- Remove dead styles, duplicated paths, and stale compatibility code only when behavior is covered by a focused test.

## Priority 2 — responsive and accessibility completion

- Capture final XSLT/XPath snapshots in light/dark themes with Explorer open/closed at target desktop and phone sizes.
- Complete touch, keyboard, focus-order, screen-reader, and contrast smoke reviews.
- Keep the desktop/laptop recommendation on small touch devices without blocking quick mobile viewing or edits.
- Verify all dialogs trap and return focus, all icon-only buttons have accessible names, and live errors are announced.

## Priority 3 — Cloudflare Pages and SEO

- Audit canonical URL, title/description, Open Graph, Twitter cards, JSON-LD, sitemap, robots, and crawlable page content.
- Verify Cloudflare Pages redirects, headers, compression, caching, and Core Web Vitals.
- Run rich-result/schema validation against the deployed build.
- Keep product, release, build-date, privacy, and telemetry claims backed by the deployed application.

## Deferred ideas — validate before building

- Draggable pane reordering: pursue only if usability feedback shows clear value; retain Input → Transform → Output as the default and provide keyboard/reset behavior.
- Runnable-session tabs: add only if Explorer testing shows repeated switching friction; do not duplicate the Explorer or reduce editor space unnecessarily.
- Replace Workspace import: requires explicit approval, rollback design, and destructive-flow testing. Merge-as-copy remains the safe default.
- Linked project files/includes, encryption, collaboration, and cloud synchronization remain out of scope.

## Final gate for any improvement batch

- Production build succeeds.
- Focused tests for changed behavior pass.
- `git diff --check` is clean.
- Full regression runs once, after implementation is complete.
- No source content is uploaded unexpectedly.
- Deployment or merge happens only after explicit approval.
