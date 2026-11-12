# Workspace UX specification

## Product principles

1. The unnamed Quick Playground remains the first-run experience. Paste, edit, switch modes, and run without a modal, account, workspace decision, or name.
2. A saved item is a complete runnable unit: **XSLT Mapping** or **XPath Query**.
3. Existing XSLT and XPath pane geometry remains recognizable. The Explorer is removable chrome, not a redesign of the editors.
4. “Saved” always means a storage transaction committed. “Saved locally” must never imply cloud sync.
5. Loading a share, file, or example creates a temporary draft unless the user explicitly chooses to replace/save into a named item.

## Information architecture

### Header

Keep the existing logo, Examples, XSLT/XPath toggle, theme, Clear, Help, and Run placement. Add only:

- Explorer toggle before the current session title.
- Current item title: `Quick Playground`, `Untitled XSLT Mapping`, or saved title.
- Compact save state: `Unsaved`, `Saving…`, `Saved locally`, `Save failed`.
- One compact session menu containing New XSLT, New XPath, Save As, Duplicate, Import, Backup, Settings, About.

Share stays visible in XSLT mode until XPath sharing exists; its disabled XPath behavior remains. Run remains the strongest action.

### Explorer

Desktop width: 260 px default, resizable 220–360 px. It sits left of the existing workspace. When collapsed, the original workspace regains all width.

```text
EXPLORER                         +  ⋯
Search saved mappings & queries…
All   Recent   Favorites

WORKSPACES
▾ My Workspace
  ▾ Integrations
    [XSLT] Sales Order Mapping
    [XPath] Active Order Items
  ▸ Experiments

TRASH
```

- XSLT/XPath labels/icons must remain distinguishable without color alone.
- Search initially matches title and folder/workspace names, not source bodies.
- Folders allow nesting but the UI should discourage unnecessary depth.
- Recent/Favorites are views, not duplicate storage locations.
- Context menu/actions: open, rename, duplicate, move, favorite, delete.
- Drag/drop movement is an enhancement; every move must also be possible by keyboard/menu.

### Session tabs

Use runnable-session tabs above the workspace, not tabs inside XML/XSLT/output panes. Hide the tab strip when only one item/draft is open. Each tab displays type icon, title, and local save/error indicator.

- Clicking a tab restores its correct mode and state.
- Closing removes the view/model cache only. It never deletes a saved record.
- A dirty temporary draft prompts Save / Discard / Cancel only when it would otherwise be lost.
- A saved session with a pending failed write remains open and warns before close/navigation.
- Limit live Monaco model caches (proposed: 6 recently used tabs); serialize selection/view state before eviction and dispose unused models.

Tabs are a Phase C feature after core storage. If user testing shows Explorer switching is sufficient, tabs may be deferred without weakening save/reopen.

## XSLT layout

Desktop with Explorer open:

```text
[Header: Explorer | title/save | Examples | XSLT XPath | Share | Run]
[Tabs only when 2+ open]
+----------+----------------+----------------+----------------+
| Explorer | 01 Input XML   | 02 Transform   | 03 Output      |
|          | Monaco         | Monaco         | derived Monaco |
|          +----------------+----------------+----------------+
|          | Input headers/ | Console        | Output headers/|
|          | properties     |                | properties     |
+----------+----------------+----------------+----------------+
```

All existing pane collapse, resize, format, copy, upload/download, wrap, drag/drop, snippets, console, CPI rows, status, and shortcuts remain.

Opening a saved XSLT mapping restores source XML, stylesheet, ordered input header/property rows, and supported run options. Output and output header/property panels begin empty/stale and populate only after a run.

## XPath layout

```text
[Header: Explorer | title/save | Examples | XSLT XPath | Run]
[Tabs only when 2+ open]
+----------+--------------------------------+----------------+
| Explorer | 01 XPath query                 | 03 Results     |
|          +--------------------------------+                |
|          | 02 XML source Monaco           |                |
+----------+--------------------------------+----------------+
|          | Console                                         |
+----------+-------------------------------------------------+
```

Opening a saved XPath query restores its XML and expression, selects XPath mode, and leaves previously open XSLT sessions untouched. History remains a global convenience list, not part of the canonical query.

## Responsive behavior

The measured baseline has horizontal overflow even at desktop widths and is unusable at 390 px. Workspace work must improve rather than preserve that defect.

### ≥ 1280 px

- Explorer is inline when open.
- Existing XSLT columns remain side by side.
- At 1280–1440 px, use the existing collapse controls and allow Explorer collapse; do not reduce editor columns below usable minimums.

### 768–1279 px

- Explorer opens as an overlay drawer with backdrop and focus trap.
- XSLT workspace may horizontally scroll as an explicit editor canvas only if existing column collapse cannot provide a usable view; prefer one primary pane plus pane switch controls.
- XPath query/XML/results preserve clear sequence and avoid clipped header actions.

### < 768 px

- Explorer is an overlay drawer.
- Editors become a pane switcher/stack: Input, Transform, Output for XSLT; Query/XML, Results for XPath; Console is collapsible.
- Run and mode switch stay reachable in a compact sticky header.
- No critical action may exist only off-screen horizontally.
- Existing “best on desktop” guidance may remain, but basic paste/run/save/reopen must be usable.

## Lifecycle flows

### Fresh visitor

1. App opens `Quick Playground` in XSLT mode with existing example defaults.
2. User pastes and runs immediately.
3. Draft autosaves to legacy-compatible draft storage/IndexedDB draft record after the foundation ships.
4. Save opens one naming dialog and defaults to the current mode's type. No workspace dialog unless the user chooses a destination.

### New item

- New XSLT creates a temporary XSLT draft using current default content.
- New XPath creates a temporary XPath draft using current default XML/expression.
- A draft gets a stable temporary ID so refresh recovery is possible without appearing as a named Explorer item.

### Save / Save As / Duplicate

- Save on a draft asks for name and optional location, then creates a record.
- Save on a named item flushes immediately.
- Save As and Duplicate always create a new ID with revision 1; edits cannot mutate the source item.
- Duplicate suffix: `Copy` with collision-safe numbering; user can rename immediately.

### Mode switch

- If the active tab is a saved item, switching the header mode returns to the last active tab/draft of that mode.
- It never converts the current saved record's type.
- If no item exists in the target mode, open/recover that mode's temporary draft.

### Example/file import

- Default: open as temporary draft, labeled `Example: …` or the filename.
- Secondary action: replace current temporary draft.
- Replacing a named session requires an explicit action and confirmation if unsaved changes exist.

### Shared URL

After decoding and validation, show a non-blocking choice before applying to stored work:

- **Open temporarily** (recommended): creates a detached XSLT draft.
- **Save a copy…**: names and imports a new record.
- Cancel: preserves current UI/session.

The dialog warns that URLs can remain in history/logs and may expose payloads. The hash is removed only after payload capture; invalid payloads show an error without changing state.

### Delete and trash

- Delete moves a saved item/folder to Trash and closes affected tabs after successful commit.
- Trash restore preserves content and chooses original location when available; if missing, restore to workspace root.
- Permanent delete and Empty Trash require explicit confirmation.
- V1 has no automatic expiry.

## Empty, error, and conflict states

| State | Required UI |
|---|---|
| Empty Explorer | Explain local saving; New XSLT, New XPath, Import actions |
| No search results | Query text, clear-search action; do not suggest deletion |
| Storage unavailable | Temporary editing/running remains enabled; Save disabled with export-source/backup guidance |
| Quota exceeded | `Save failed — storage full`; retry, backup, storage settings; never show Saved |
| Upgrade blocked | Identify another open XSLTDebugX tab; Retry button |
| Concurrent revision | Keep local edits; Reload newer, Save as copy, or explicit overwrite |
| Corrupt session | Quarantine/diagnostic export; do not crash Explorer |
| Invalid backup | Validation summary; zero writes performed |
| Unsupported future backup | Explain version incompatibility; do not partially import |

## Keyboard and accessibility

- `Ctrl/Cmd+Enter`: unchanged Run behavior.
- `Ctrl/Cmd+Shift+E`: toggle Explorer (avoid the existing documented shortcuts).
- `Ctrl/Cmd+S`: save/flush; on a draft, open Save dialog.
- `Ctrl/Cmd+Shift+S`: Save As.
- `Ctrl/Cmd+P`: quick open/search saved sessions, if added.
- Explorer: Up/Down moves visible row, Left/Right collapses/expands, Enter opens, F2 renames, Delete opens soft-delete confirmation, context-menu key/Shift+F10 opens actions.
- Tree uses appropriate `tree`/`treeitem` semantics or a simpler nested-list pattern with equivalent announced levels/expanded state. Do not use ARIA tree if keyboard behavior is incomplete.
- Dialogs trap focus, support Escape, announce title/description/errors, and return focus to opener.
- Save state uses a live region for failures, not for every successful debounce.
- Type icons include text labels/tooltips; saved/failed indicators are not color-only.
- Touch targets remain at least approximately 40 CSS px on narrow layouts.

## Settings, About, and release notes

Settings V1: theme, Explorer preference, storage usage/persistence status, backup/import, Trash, and delete-local-data controls. Avoid speculative editor preferences.

About reads version/build from generated build metadata, package/license facts, repository/Issues links, developer attribution, local-storage/privacy note, and third-party notices. It must state that editing content stays local while CDN assets and anonymous page analytics make network requests.

Release notes should link to or build from real GitHub releases/CHANGELOG data. Do not invent a version history or show a “What's New” modal until there is a real release entry.
