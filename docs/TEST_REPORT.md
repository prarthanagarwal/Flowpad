# Flowpad feature and regression report

Tested on 27 October 2026 on macOS, Apple Silicon, using real Electron 45 windows and isolated temporary profiles. Existing user notes were not used as test fixtures. The tests read the saved files through the real IPC and filesystem implementation.

## Feature inventory

| Feature | Cases exercised | Result |
| --- | --- | --- |
| Startup and empty editor | Placeholder, clock, word count, renderer readiness, isolated profile | Pass |
| Create notes | Button, rapid successive creation, unique IDs, saving the previous note | Pass |
| Open and switch notes | History selection, saving changes before switching, failed-save navigation block | Pass |
| Autosave and manual save | Debounce, Cmd+S, empty content, explicit Saved/Unsaved/Save failed feedback | Pass |
| Save across app lifecycle | Close button, reload before debounce, full process restart, failed close and retry | Pass |
| Lines and text fidelity | Consecutive blank lines, leading/trailing spaces, literal Markdown, Unicode, emoji with ZWJ | Pass |
| Dash lists | `-` + Space, separate dash markers, nesting, continuation, save/reopen, Markdown round-trip | Pass |
| Bulleted lists | Selected lines, typing a marker, continuation, splitting at the caret, empty-item exit, toggle off | Pass |
| Numbered lists | The same editing cases, non-one starting number, persistence | Pass |
| List keyboard behavior | Tab nesting, Shift+Tab outdent, Shift+Enter, Backspace between items, undo | Pass |
| Plain text quotes | Continuation, splitting at the caret, exiting an empty quote, saving | Pass |
| Formatting | Title/body headings, bold, italic, underline, strike, inline formatting within lists | Pass |
| Undo and redo | Text insertion, paste, cut, lists, editing after switching to another note | Pass |
| Clipboard | Plain-text paste at caret, multiline text, emoji, copy/cut/paste context menus | Pass |
| Titles and previews | First-line title, heading title, separate block boundaries, sidebar updates | Pass |
| Word count | Adjacent blocks, list markers, reset on a new note | Pass |
| Search | Body match, no results, keeping the active query after saves, folder filtering | Pass |
| Pin notes | Pin order, pinning with unsaved text, persistence alongside new notes | Pass |
| Delete notes | Active-note deletion, avoiding resurrection, replacement note, cancelling with keyboard | Pass |
| Folders | Create, rename, empty names, cancel, move by menu, drag onto folder, filtering, delete | Pass |
| Folder persistence | Names and membership, concurrent rename/delete and stale note writes, keeping recent content | Pass |
| Theme and fonts | Light/dark persistence, bundled fonts, note-specific fonts, surprise-font selection and stylesheet restoration | Pass |
| Dropdowns and dialogs | Selection retained for formatting, Escape dismissal, Delete/Cancel keyboard behavior | Pass |
| Window controls | Minimize/restore, saved bounds, fullscreen state and Escape after native transition completion | Pass |
| Export service | Markdown formatting, plain text, cancelled export, successful filesystem writes | Pass |
| Legacy notes | Markdown import, old underline syntax, former task text, stable IDs for metadata-less files | Pass |
| Store migration | Successful migration, failed source retention, not overwriting newer existing files | Pass |
| Write integrity | Fifteen concurrent revisions, rename collision, original file retention on failure, save/delete ordering | Pass |
| Load/write errors | Blocked notes directory, retry, malformed imported IDs, visible warnings, keeping original files | Pass |
| Electron boundaries | Renderer without Node, sandbox, trusted IPC sender, blocked unsafe links, inert saved HTML | Pass |
| Checklist removal | No button, state, click handling, auto-activation, or feature CSS; old task text remains readable | Pass |

## What was fixed

- Fixed repeated auto-activation after exiting an earlier list, nested paragraph wrappers, and literal Shift+Enter line breaks. Dash and dot markers now remain distinct, including when Chromium merges adjacent lists.
- Replaced manually constructed list prefixes with Chromium's list editing so Enter splits the selected item at the cursor, numbering and nesting work, and editing participates in undo history.
- Removed checklist creation, interaction, state and styles. Legacy task words remain as ordinary text or list items.
- Separated the internal save format from Markdown export. Ordinary saves no longer trim whitespace, collapse blank lines, reinterpret literal Markdown, or drop heading and inline formatting.
- Serialized note and folder mutations. Save responses acknowledge their own snapshots; they cannot mark a newer edit as saved. Folder names and membership are resolved against the current folder registry.
- Write a complete temporary file, flush it, and rename it before removing an old filename. A failed replacement retains the previous file. Note files are created with owner-only permissions.
- Save empty edits, flush before switching, close and reload, retain dirty content when saving fails, and prevent failed saves from silently navigating away.
- Prevented deleted active notes from being saved again by the new-note flow.
- Fixed word boundaries, heading titles, stale search results, folder rename metadata, absent drag/drop handlers, Unicode paste and clipboard undo.
- Fixed fullscreen synchronization and narrowed clipboard/fullscreen permissions to the trusted app page.
- Added IPC sender and ID validation, HTML sanitization, response-header CSP, external URL restrictions and navigation/window guards.
- Upgraded Electron 36 to 45, Forge 7 to 8 and patched compatible dependencies. Fixed the Vite CommonJS build and missing icon-font references.

## Saving and compatibility

Notes remain in `Documents/Flowpad`. They still use `.md` filenames and readable frontmatter. New saves include `contentFormat: "html"` and preserve sanitized editor HTML in the body; Markdown cannot represent every editor line break, underline and literal formatting marker exactly. Markdown and plain-text export remain separate operations. Older Markdown notes are loaded without an eager rewrite.

Do not downgrade an edited profile to an older Flowpad build: older builds do not understand the new content-format marker. Blank lines already removed by previous releases cannot be reconstructed.

Only one app process may write a profile at a time. Launching the app again focuses its existing window; separate concurrent processes previously risked overwriting each other's notes.

## Verification

- `npm test`: 13 storage/conversion tests and 51 real Electron scenarios.
- `npm run lint`: clean.
- `npm run build:vite`: renderer, main and preload builds succeed.
- Electron skill security scan: passes.
- Unsigned local macOS arm64 Forge package: builds successfully.
- `npm audit --omit=dev`: zero reported production vulnerabilities.
- Full dependency audit: four related development-only findings remain in the DMG maker → appdmg → image-size chain. The installed upstream chain has no compatible fix. It processes the project's own bundled icon during DMG creation; it is not a production dependency.
- Visual inspection at 900×700 and the 600×500 minimum window size: completed.

Run `npm test` to reproduce the suite. Playwright uses the installed Electron executable; no separate Chromium browser download is required. Failure traces and screenshots are written under `test-results/`, and the HTML report under `playwright-report/`.

## Limits

This is a finite regression suite, not a claim to have exhausted every possible interaction. Windows/Linux runtime behavior, Intel macOS, Windows tray and installer shortcuts, signing/notarization, publishing and a real auto-update installation were not exercised on this Mac. Native export dialogs use controlled return values during tests; actual exported files are verified. Remote font responses are controlled in the surprise-font test, so CDN delivery is not certified.

The runtime upgrade requires macOS 13 or later, and the build tools require Node 22.13 or later. Abrupt process termination or power loss before the autosave debounce completes can still lose an unsaved edit; ordinary close and reload explicitly flush it.

## Official guidance consulted

- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security/): process isolation, sender validation and navigation boundaries.
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc): narrow preload functions and avoiding exposed IPC events.
- [Playwright Electron automation](https://playwright.dev/docs/api/class-electron): launching and testing the actual app.
- [MDN execCommand](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand): native undo preservation. This API is deprecated on the open web; this app uses its tested implementation in its bundled Chromium runtime.
- [Electron breaking changes](https://www.electronjs.org/docs/latest/breaking-changes): runtime migration and OS requirements.
