# Data model, fresh-start policy, concurrency, and backup

## Storage choice

Use IndexedDB as the canonical workspace store through the repository's narrow native adapter. Keep light, non-critical preferences such as theme in `localStorage`. Never require a backend.

Proposed database: `xsltdebugx-workspace`, version 1.

## Stores and indexes

```text
workspaces keyPath id
  indexes: byUpdatedAt(updatedAt)

folders keyPath id
  indexes: byWorkspace(workspaceId), byParent([workspaceId,parentFolderId])

sessions keyPath id
  indexes: byWorkspace(workspaceId), byFolder([workspaceId,folderId]),
           byType(type), byUpdatedAt(updatedAt), byLastOpenedAt(lastOpenedAt),
           byFavorite(favorite)

drafts keyPath id
  indexes: byType(type), byUpdatedAt(updatedAt)

trash keyPath id
  indexes: byDeletedAt(deletedAt), byRecordType(recordType)

settings keyPath key

```

Folder and workspace deletion/move operations must span all affected stores in one readwrite transaction. Avoid a separate content store initially: atomic complete-session records are simpler and current payload sizes do not justify lazy body loading.

## Record envelopes

All timestamps are ISO-8601 UTC strings. IDs use `crypto.randomUUID()` with a tested fallback only if required. Records are validated at repository boundaries; UI code never writes raw objects directly.

### Workspace

```json
{
  "id": "uuid",
  "name": "My Workspace",
  "createdAt": "2026-11-11T09:00:00.000Z",
  "updatedAt": "2026-11-11T09:00:00.000Z",
  "revision": 1,
  "schemaVersion": 1
}
```

### Folder

```json
{
  "id": "uuid",
  "workspaceId": "uuid",
  "parentFolderId": null,
  "name": "Integrations",
  "order": 0,
  "createdAt": "...",
  "updatedAt": "...",
  "revision": 1,
  "schemaVersion": 1
}
```

Cycles are forbidden. Repository validation must prove parent belongs to the same workspace and cap nesting/record sizes.

### XSLT session

```json
{
  "id": "uuid",
  "type": "xslt",
  "workspaceId": "uuid",
  "folderId": null,
  "title": "Sales Order Mapping",
  "source": {
    "xml": "<?xml version=\"1.0\"?>...",
    "xslt": "<xsl:stylesheet version=\"3.0\">...</xsl:stylesheet>",
    "headers": [
      { "id": "row-uuid", "name": "source", "value": "WEBSHOP" }
    ],
    "properties": [
      { "id": "row-uuid", "name": "environment", "value": "PROD" }
    ],
    "runOptions": {}
  },
  "favorite": false,
  "createdAt": "...",
  "updatedAt": "...",
  "lastOpenedAt": "...",
  "revision": 1,
  "schemaVersion": 1
}
```

Header/property arrays preserve order, duplicates, blank names/values, and absent versus empty where the current UI distinguishes them. Stable row IDs improve focus/edit updates but do not affect CPI execution. Output text and output headers/properties are not canonical source state.

`runOptions` is an object reserved for validated user-controlled options. It starts empty because the current app has no user-editable output method, clock, or CPI extension configuration beyond headers/properties and the built-in `$exchange` simulation.

### XPath session

```json
{
  "id": "uuid",
  "type": "xpath",
  "workspaceId": "uuid",
  "folderId": null,
  "title": "Active Order Items",
  "source": {
    "xml": "<Orders>...</Orders>",
    "expression": "//Item[@status='active']",
    "namespaces": {},
    "evaluatorOptions": {}
  },
  "favorite": false,
  "createdAt": "...",
  "updatedAt": "...",
  "lastOpenedAt": "...",
  "revision": 1,
  "schemaVersion": 1
}
```

`namespaces` is empty in V1 because the current namespace map is fixed in code. It is present for forward compatibility but no UI or behavior is promised until implemented.

### Draft

Drafts use the same type-specific `source` shape plus `id`, `type`, `updatedAt`, `schemaVersion`, and optional `origin` (`quick-playground`, `example`, `file`, `share`). They do not appear in the saved Explorer. Keep at most one recovered draft per mode plus explicitly open temporary tabs; prune only after a named save is committed and verified.

### Trash

```json
{
  "id": "trash-uuid",
  "recordType": "session",
  "deletedAt": "...",
  "originalLocation": {
    "workspaceId": "uuid",
    "folderId": null
  },
  "snapshot": { "...complete validated session record...": true },
  "schemaVersion": 1
}
```

V1 does not auto-expire trash. Restore and permanent delete are explicit transactions.

## Size and validation limits

Initial defensive limits, to be verified against measured SAP samples:

- Maximum individual text field accepted from UI/import: 25 MiB UTF-8.
- Maximum session record: 60 MiB serialized.
- Maximum backup entries: 10,000.
- Maximum uncompressed backup: 500 MiB; maximum compressed-to-expanded ratio: 100:1.
- Title: 1–160 Unicode code points after trimming; preserve source text exactly.
- Workspace/folder name: 1–120 code points; reject control characters and path separators in exported paths.
- Folder depth: 20.

Do not synchronously stringify or search 20 MiB source fields on every keystroke. Autosave should snapshot editor strings after debounce and perform storage work asynchronously; large-input performance needs explicit measurement.

## Repository API boundary

Proposed modules:

```text
js/workspace/schema.js          validation, defaults, size checks
js/workspace/store.js           open/upgrade/transactions/queries
js/workspace/session-controller.js serialize/restore/switch/autosave
js/workspace/conflicts.js       revision compare-and-set + channel
js/workspace/backup.js          manifest, ZIP validation, import plan
js/workspace/explorer.js        rendering and keyboard behavior
```

Core calls:

- `serializeCurrentMode()` returns a validated mode-specific source snapshot.
- `restoreSession(record)` selects the mode and restores only that type's state.
- `saveSession(id, expectedRevision, snapshot)` atomically compares/increments revision.
- `switchSession(id)` flushes current pending save, then restores target or surfaces failure.
- `openTemporarySource(source, origin)` never writes a named item.
- `openSharePayload(payload)` delegates to temporary/import-copy UI.

## Autosave truth model

State machine:

```text
clean -> dirty -> saving -> clean
                   |        ^
                   v        |
                  failed -- retry

saving + revision mismatch -> conflict
```

- `dirty`: editor state differs from last committed snapshot.
- `saving`: a repository transaction is in progress.
- `clean/Saved locally`: transaction completed and its new revision is installed in memory.
- `failed`: retain dirty state and error; never advance the in-memory committed snapshot.
- `conflict`: retain dirty state; block background overwrite.

Debounce around 800 ms to match current ergonomics. Flush pending changes before switching tabs/modes/items. `visibilitychange` may request a flush if the document becomes hidden, but no unload handler may promise durable IndexedDB writes.

## Multi-tab correctness

1. Every tab gets a random `writerId` and opens `BroadcastChannel('xsltdebugx-workspace-v1')` when supported.
2. A save transaction reads the current session, requires `current.revision === expectedRevision`, writes revision + 1, and commits.
3. After commit, broadcast `{kind:'session-committed', id, revision, writerId}`.
4. Other tabs refresh Explorer metadata. If they have the same clean item open, they may reload after preserving view state. If dirty, they enter conflict.
5. BroadcastChannel absence only reduces immediacy; the next compare-and-set still prevents silent overwrite.

No automatic line/field merge for XML/XSLT/XPath. “Save as conflict copy” is the safe default resolution.

## Fresh-start policy

Per the product decision on 2026-11-11, the new workspace does not import the legacy playground session.

- `xdebugx-session-v1` and `xdebugx-xpath-history` are not read by the workspace repository.
- The first workspace open creates an empty `My Workspace` with no saved sessions.
- Legacy keys are not deleted or rewritten. This keeps rollback/recovery possible without presenting migration UI.
- Existing Quick Playground persistence can remain temporarily during implementation, but once workspace drafts become canonical it must not populate named sessions implicitly.
- A future opt-in “Import previous playground” tool would be a separate user action and is outside V1 scope.

No migration store or journal is created in database version 1.

Rollback note: the legacy `xdebugx-session-v1` value remains untouched byte-for-byte. Rolling back to an older build can therefore read its previous legacy session again; work created only in the new IndexedDB workspace must be exported through Backup before rollback if it needs to be carried back manually.

## Share URL behavior

Current share data is raw-deflate JSON in `#share/`, containing XSLT XML, stylesheet, headers, and properties. Preserve decoding compatibility.

New flow:

1. Capture and validate hash payload with strict maximum compressed/expanded size.
2. Remove hash from address bar after capture to reduce accidental reprocessing.
3. Handle both initial navigation and a hash-only link opened while the app is already running.
4. Flush the outgoing named item before applying the shared mapping; a failed save blocks replacement.
5. Do **not** skip/overwrite the current saved session.
6. Show summary (type, sizes, header/property counts) and privacy warning.
7. Open temporarily or Save a copy with a new ID.

Do not add server fallback. Warn before generating unusually long links and explain that URLs may enter browser history, chat systems, proxy logs, or screenshots.

## Backup format

Proposed ZIP:

```text
xsltdebugx-backup.json
workspaces/<id>.json
folders/<id>.json
sessions/<id>.json
README.txt
```

Manifest:

```json
{
  "format": "xsltdebugx-workspace-backup",
  "version": 1,
  "createdAt": "...",
  "appBuild": "commit-or-version",
  "counts": { "workspaces": 1, "folders": 2, "sessions": 10 },
  "entries": [
    { "path": "sessions/uuid.json", "bytes": 1234, "sha256": "..." }
  ]
}
```

Export user-authored source state, organization, favorites, and appropriate settings. Exclude derived output, console, XPath history, trash, migration journals, analytics identifiers, and transient drafts by default. Optional draft export can be explicit.

Import validation completes fully before a write transaction:

- ZIP path normalization and traversal rejection.
- Entry count, individual size, total expanded size, and expansion-ratio checks.
- Pre-read ZIP size rejection plus post-inflate verification against central-directory sizes.
- Manifest format/version and per-entry SHA-256 checks.
- Strict UTF-8 JSON/schema/type validation and duplicate ID/path detection.
- Referential integrity for workspaces/folders/sessions and folder-cycle checks.
- Unsupported future versions fail closed.

V1 import mode: **merge as copies** with new IDs and a preview summary. Replace Workspace is deferred until automatic pre-restore backup and rollback are independently tested.

## Failure guarantees

- Storage denied/full: temporary edit/run remains available; export individual panes/share remains available; no false Saved status.
- Blocked database upgrade: close stale connection on `versionchange`, show retry guidance for other tabs.
- Corrupt record: quarantine from normal open, keep raw export, do not delete automatically.
- Partial backup validation failure: zero writes.
- Transaction abort: in-memory committed revision remains unchanged.
- Fresh start: legacy keys remain byte-for-byte untouched and produce no workspace records.
