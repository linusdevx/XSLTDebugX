# Reference and alternative research

## Scope and independence

Markdown Viewer was inspected as a benchmark at commit `29eb5297a425ec2fae1b0781d2f94e57fcd7aff4` (version `3.10.5`, Apache-2.0). It is much larger than XSLTDebugX and now spans browser, linked-folder, encrypted-workspace, live-share, export, and desktop-packaging concerns. Its implementation is useful evidence, not an architecture to transplant.

Independent platform research used primary documentation for [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [StorageManager](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager), [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel), [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), and the official [`idb` repository](https://github.com/jakearchibald/idb).

## What Markdown Viewer does well

### Storage and recovery

`workspace-storage.js:4-18` uses an explicitly versioned database (`markdownViewerWorkspace`, version 3), a 30-day trash policy, and named legacy keys. Its IndexedDB upgrade creates `documents`, `contents`, `metadata`, `secretRecords`, `trash`, and `journals` stores (`workspace-storage.js:383-425`). It handles blocked upgrades and closes on `versionchange`, both worth adopting.

Strong patterns:

- Separate metadata/content stores avoid eagerly loading every document body.
- Transactions span content and metadata when correctness requires atomicity.
- Storage revisions and writer IDs are used to detect/merge concurrent writes (`workspace-storage.js:220-260`, save paths near 1626-1766).
- Trash records are structurally validated before automatic expiry; malformed/future records are retained.
- Backup parsing rejects unsafe paths, missing hashes, duplicate IDs/paths, count mismatches, invalid JSON, unsupported versions, and missing entries (`script.js:1681-2188`).
- Restore captures rollback data and blocks further edits if both restore and rollback fail.
- Persistent-storage status and usage are visible to users.
- Focus return, busy states, empty states, keyboard navigation, and explicit destructive confirmations are designed rather than incidental.

### Explorer and product language

The live app exposes one Explorer with All/Recent/Favorites, workspaces/folders, search, trash, storage/backup, and clear local-only wording. Closing a view is distinct from deleting a document. The empty state offers useful entry points without forcing workspace creation.

These patterns map well to XSLTDebugX:

- One Explorer shared across XSLT and XPath.
- Type-labelled runnable records rather than three pane-level files.
- Search/Recent/Favorites across both types.
- Trash as recovery, not backup.
- “Saved locally” rather than cloud-sync language.
- Backup/restore validation before any writes.

## What should not be copied

| Markdown Viewer behavior/architecture | Decision | Reason for XSLTDebugX |
|---|---|---|
| Separate metadata and content records | Adapt later if measured | A session has two or three text fields and small CPI arrays. One validated record is simpler and atomically correct. Split only if large-scale profiling justifies it. |
| Desktop vault and linked folders | Reject for V1 | File handles, platform paths, journals, and desktop packaging add scope without improving the core save/reopen job. |
| Secret Workspace encryption | Reject for V1 | Encryption key UX and threat-model claims are substantial. Backups and local privacy warnings are more honest initially. |
| Live Share / temporary cloud KV | Reject | Violates the no-backend/local-first boundary and creates payload-retention/privacy concerns. |
| Markdown editor/preview split, formatting, comments, PDF/image export | Reject | Domain-specific and unrelated to runnable XSLT/XPath sessions. |
| 30-day automatic trash expiry | Adapt cautiously | Recovery is useful; automatic deletion should be deferred until backup/trash behavior is proven. V1 can retain trash until explicit emptying. |
| Large, always-visible toolbar/menu system | Reject | XSLTDebugX must preserve editor space and its prominent mode/run workflow. |
| Replace-only backup restore | Adapt | XSLTDebugX should ship merge-as-copy first. Replace can follow with preview, automatic rollback backup, and explicit confirmation. |
| Complex organization merge logic | Simplify | A revision compare-and-set plus explicit conflict copy is safer and easier to explain than silent field merges for source code. |

No Markdown Viewer source will be copied. If future code reuse is proposed, Apache-2.0 attribution and modified-file notices must be handled explicitly alongside XSLTDebugX's AGPL license.

## Platform/storage findings

### IndexedDB

IndexedDB stores structured objects asynchronously, supports indexes, and commits changes in transactions. It is same-origin and appropriate for multiple sizeable sessions. MDN explicitly warns not to create important transactions during unload; autosave must commit during normal editing, with pagehide/visibility handling only as best effort.

### `idb` wrapper versus raw IndexedDB

The official `idb` project is approximately 1.19 kB Brotli-compressed and turns requests/transactions into promises while preserving IndexedDB semantics. It also exposes blocked, blocking, terminated, upgrade, and `tx.done` hooks.

Initial implementation decision: use a narrowly scoped native adapter and add no runtime dependency. This fits the direct-source/custom-bundle build and keeps the storage surface small. Reconsider `idb` only if transaction lifecycle code expands materially; do not load it from a CDN.

### StorageManager

`navigator.storage.estimate()` can report origin usage/quota; `persisted()` reports current durability; `persist()` requests durable storage. These APIs require a secure context in some browsers. They should be progressive enhancements in Settings, never a startup permission prompt and never a guarantee that browser data cannot be cleared.

### BroadcastChannel and revisions

BroadcastChannel is broadly available and sends same-origin messages across tabs, but communication alone does not prevent lost updates. Every saved session needs an integer `revision` checked in the same readwrite transaction. BroadcastChannel should accelerate UI notification; revision compare-and-set remains the correctness mechanism. When a mismatch occurs, do not silently merge source code—offer reload, overwrite with explicit confirmation, or save conflicting edits as a copy.

### OPFS and File System Access

OPFS is broadly available and optimized for file-like byte access, but it is still origin-private, quota-bound, and deleted with site storage. XSLTDebugX stores structured runnable records, not a large virtual filesystem, so IndexedDB is a better primary store. User-visible File System Access is not uniformly equivalent across browsers and introduces permission/handle lifecycle UX. Defer it to a future linked-project feature.

## Three product/data approaches

Scores: 1 = poor, 3 = adequate, 5 = best. Higher risk/leak scores mean safer/lower risk.

| Criterion | A. Session Explorer | B. Raw project/files | C. Session-first hybrid |
|---|---:|---:|---:|
| Paste/run speed | 5 | 2 | 5 |
| Data safety | 4 | 3 | 5 |
| Migration simplicity | 5 | 2 | 4 |
| Code maintenance | 5 | 2 | 4 |
| Keyboard accessibility | 4 | 3 | 4 |
| Integration risk | 5 | 2 | 4 |
| Bundle impact | 5 | 3 | 4 |
| Browser compatibility | 5 | 2 | 5 |
| No-server cost | 5 | 5 | 5 |
| Future includes/test fixtures | 2 | 5 | 5 |
| Import/export portability | 4 | 5 | 5 |
| Low leakage risk | 5 | 4 | 5 |
| **Total / 60** | **54** | **38** | **55** |

### A. Session Explorer

Each mapping/query is one complete runnable record. This best matches current behavior and is easiest to migrate. Its weakness is future linked dependencies (`xsl:include`, multiple inputs, fixtures), which either get embedded awkwardly or require a schema evolution.

### B. Project/file Explorer

Users manage `.xml`, `.xsl`, and configuration files, then create run configurations that link them. It is powerful but adds naming, file association, broken-link, and dependency concepts before users can save a simple mapping. It conflicts with Quick Playground ergonomics and would encourage a generic IDE.

### C. Session-first hybrid — recommended

V1 stores complete runnable XSLT/XPath sessions exactly like A. The schema gives source payloads a version and reserves optional `resources`/`testCases` references without exposing them. Import/export uses a documented session manifest. Later, a saved XSLT session can opt into embedded or linked dependencies without redefining the primary identity.

This is “hybrid” in evolution, not in V1 UI. Users see named runnable sessions, not raw internal files.

## Recommended design decisions

| Decision | Recommendation |
|---|---|
| Primary unit | Complete runnable `xslt` or `xpath` session |
| Organization | Shared Explorer; workspaces and nested folders; Recent/Favorites are filters |
| Storage | IndexedDB through a narrow native adapter; `localStorage` retained for lightweight theme/layout flags only |
| Autosave | 700–1000 ms debounce, awaited commit, visible Saving/Saved locally/Failed states |
| Concurrency | Transactional revision compare-and-set + BroadcastChannel notification |
| Tabs | Session tabs only, never pane/file tabs; hide strip with one tab; implement after storage/Explorer and validate vertical cost |
| Outputs | Ephemeral; optional cached preview explicitly marked stale, deferred |
| Share | Decode to temporary preview; explicit “Open temporarily” or “Save a copy”; never autosave over a named item |
| Examples/import | Open detached temporary drafts by default; explicit replacement only when chosen |
| Backup | Versioned ZIP with manifest and per-entry hashes; merge-as-new first |
| Trash | Explicit soft delete/restore; no automatic purge in first release |
| OPFS/File System Access | Deferred |
| Framework/state machine | No framework. Small repository/controller modules and explicit state transitions |

## Deliberate V1 cuts

- No encrypted workspace, backend, account, cloud sync, collaboration, analytics changes, or server share storage.
- No linked `xsl:include` project filesystem; schema remains extensible.
- No expected-output fixtures/test-case manager.
- No content search until session-count/performance measurements justify it.
- No automatic trash expiry.
- No Replace Workspace restore until merge import and rollback tests are solid.
- No Safari/Firefox-specific File System Access integration.

These cuts protect the core promise: save, reopen, duplicate, migrate, back up, and recover complete XSLT/XPath run contexts without changing transform semantics.
