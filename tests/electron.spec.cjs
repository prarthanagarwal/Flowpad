const { test: base, expect, _electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const test = base.extend({
  running: async ({ playwright: _playwright }, use, testInfo) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'flowpad-e2e-'));
    const app = await _electron.launch({ args: ['.'], env: { ...process.env, FLOWPAD_DATA_DIR: dir } });
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
    await use({ app, page, dir });
    if (testInfo.status !== testInfo.expectedStatus) {
      await page.screenshot({ path: testInfo.outputPath('failure.png') }).catch(() => {});
    }
    await app.close();
    expect(errors).toEqual([]);
    await fs.rm(dir, { recursive: true, force: true });
  }
});
async function save(page) {
  await page.keyboard.press('Meta+s');
  await expect(page.locator('#saveStatus')).toHaveText('Saved');
}
async function persisted(page) {
  return page.evaluate(async () => (await window.electronAPI.loadNotes()).notes);
}
async function newNote(page) {
  const old = await page.evaluate(async () => (await import('./src/renderer/state.js')).currentNote.id);
  await page.locator('#newNoteBtn').click();
  await expect.poll(() => page.evaluate(async () => (await import('./src/renderer/state.js')).currentNote.id)).not.toBe(old);
}
async function history(page) {
  if (!await page.locator('#sidebar').evaluate(node => node.classList.contains('open'))) await page.locator('#historyBtn').click();
  await expect(page.locator('#sidebar')).toHaveClass(/open/);
}
async function selectAll(page) {
  await page.locator('#editor').focus();
  await page.keyboard.press('Meta+a');
}
async function list(page, type) {
  await page.locator('#formatBtn').click();
  await page.locator(type === 'ordered' ? '#numberedListBtn' : '#bulletListBtn').click();
}

test('startup, empty state, clock and checklist removal', async ({ running: { page } }) => {
  await expect(page.locator('#editorPlaceholder')).toBeVisible();
  await expect(page.locator('#wordCount')).toHaveText('0 words');
  await expect(page.locator('#currentTime')).not.toBeEmpty();
  await expect(page.locator('#checklistBtn')).toHaveCount(0);
  expect(await page.evaluate(() => ['require' in window, !!window.electronAPI])).toEqual([false, true]);
});

test('word count separates adjacent blocks and resets for a new note', async ({ running: { page } }) => {
  await page.locator('#editor').fill('First\nSecond\nThird');
  await expect(page.locator('#wordCount')).toHaveText('3 words');
  await newNote(page);
  await expect(page.locator('#wordCount')).toHaveText('0 words');
});

test('auto-save persists without a manual save', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Autosaved');
  await expect.poll(async () => (await persisted(page))[0]?.content).toBe('Autosaved');
});

test('exact lines, blank lines, spaces, Unicode and literal Markdown survive reload', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Title\n\n\n  spaced   text\n**literal** _literal_\nFamily 👩‍👩‍👧‍👦 हिंदी\n');
  const original = await page.locator('#editor').innerHTML();
  await save(page);
  expect((await persisted(page))[0].content).toBe(original);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.ready === 'true');
  await history(page);
  await page.locator('.note-item').first().click();
  await expect(page.locator('#editor')).toHaveJSProperty('innerHTML', original);
});

test('clearing all content is saved when switching notes', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Erase me');
  await save(page);
  await page.locator('#editor').fill('');
  await newNote(page);
  expect((await persisted(page))[0].content.replace(/<[^>]*>/g, '')).toBe('');
});

for (const type of ['bullet', 'ordered']) {
  test(`${type} list converts several selected lines and persists`, async ({ running: { page } }) => {
    await page.locator('#editor').fill('Alpha\nBeta\nGamma');
    await selectAll(page);
    await list(page, type);
    await expect(page.locator('#editor li')).toHaveCount(3);
    const html = await page.locator('#editor').innerHTML();
    await save(page);
    expect((await persisted(page))[0].content).toBe(html);
  });
  test(`${type} list splits at the cursor and exits on an empty item`, async ({ running: { page } }) => {
    await page.locator('#editor').fill('AlphaBeta');
    await list(page, type);
    await page.keyboard.press('End');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await expect(page.locator('#editor li')).toHaveText(['Alpha', 'Beta']);
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('Body');
    await expect(page.locator('#editor li')).toHaveCount(2);
    expect(await page.locator('#editor').innerText()).toContain('Body');
  });
  test(`${type} list preserves inline formatting and supports toggle off`, async ({ running: { page } }) => {
    await page.locator('#editor').fill('Bold words');
    await selectAll(page);
    await page.keyboard.press('Meta+b');
    await list(page, type);
    await expect(page.locator('#editor li b')).toHaveText('Bold words');
    await list(page, type);
    await expect(page.locator('#editor li')).toHaveCount(0);
    await expect(page.locator('#editor b')).toHaveText('Bold words');
  });
}

test('list auto activation, Shift+Enter, nesting, outdent and undo', async ({ running: { page } }) => {
  await page.locator('#editor').focus();
  await page.keyboard.type('- ');
  await page.keyboard.type('Alpha');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Beta');
  await expect(page.locator('#editor li')).toHaveCount(2);
  await page.keyboard.press('Tab');
  await expect(page.locator('#editor ul ul li')).toHaveText('Beta');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#editor ul ul')).toHaveCount(0);
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('continuation');
  await expect(page.locator('#editor li')).toHaveCount(2);
  await page.keyboard.press('Meta+z');
  expect(await page.locator('#editor').innerText()).not.toContain('continuation');
});

test('numbered auto activation preserves a non-one start', async ({ running: { page } }) => {
  await page.locator('#editor').focus();
  await page.keyboard.type('5. Five');
  await expect(page.locator('#editor ol')).toHaveAttribute('start', '5');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Six');
  await expect(page.locator('#editor li')).toHaveText(['Five', 'Six']);
  await save(page);
  expect((await persisted(page))[0].content).toContain('start="5"');
});

test('headings, bold, italic, underline and strike persist', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Heading');
  await selectAll(page);
  await page.locator('#formatBtn').click();
  await page.locator('[data-style="title"]').click();
  await expect(page.locator('#editor h1')).toHaveText('Heading');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Body');
  await expect(page.locator('#editor h1')).toHaveCount(1);
  await selectAll(page);
  for (const shortcut of ['Meta+b', 'Meta+i', 'Meta+u', 'Meta+Shift+x']) await page.keyboard.press(shortcut);
  const html = await page.locator('#editor').innerHTML();
  await save(page);
  expect((await persisted(page))[0].content).toBe(html);
  expect((await persisted(page))[0].title).toBe('Heading');
});

test('plain-text paste inserts at caret, preserves emoji and supports undo', async ({ running: { app, page } }) => {
  await page.locator('#editor').fill('leftright');
  await page.keyboard.press('Home');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await app.evaluate(({ clipboard }) => clipboard.writeText('👩‍👩‍👧‍👦\n\nहिंदी'));
  await page.keyboard.press('Meta+v');
  expect(await page.locator('#editor').innerText()).toContain('left👩‍👩‍👧‍👦');
  expect(await page.locator('#editor').innerText()).toContain('हिंदीright');
  await page.keyboard.press('Meta+z');
  await expect(page.locator('#editor')).toHaveText('leftright');
});

test('active note deletion is not resurrected by switching or autosave', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Delete this');
  await save(page);
  await page.keyboard.type(' unsaved');
  await history(page);
  await page.locator('.delete-note').first().click();
  await page.locator('.confirm-delete-btn').click();
  await expect.poll(async () => (await persisted(page)).length).toBe(0);
  await page.locator('#editor').fill('Replacement');
  await save(page);
  const notes = await persisted(page);
  expect(notes).toHaveLength(1);
  expect(notes[0].title).toBe('Replacement');
});

test('delete cancel with Enter on Cancel retains the note', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Keep me');
  await save(page);
  await history(page);
  await page.locator('.delete-note').click();
  await page.locator('.confirm-cancel-btn').focus();
  await page.keyboard.press('Enter');
  expect(await persisted(page)).toHaveLength(1);
  await expect(page.locator('.delete-confirm-overlay')).toHaveCount(0);
});

test('pinning active note keeps unsaved text and pinned sort survives new saves', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Pinned');
  await save(page);
  await page.keyboard.type(' latest');
  await history(page);
  await page.locator('.pin-note').click();
  await expect.poll(async () => (await persisted(page))[0]?.isPinned).toBe(true);
  expect((await persisted(page))[0].content).toContain('latest');
  await newNote(page);
  await page.locator('#editor').fill('Newer unpinned');
  await save(page);
  await history(page);
  await expect(page.locator('.note-item').first()).toHaveClass(/is-pinned/);
});

test('search remains applied after save and matches content', async ({ running: { page } }) => {
  await page.locator('#editor').fill('First\nneedle');
  await save(page);
  await newNote(page);
  await page.locator('#editor').fill('Second');
  await save(page);
  await history(page);
  await page.locator('#searchNotes').fill('needle');
  await expect(page.locator('.note-item')).toHaveCount(1);
  await page.keyboard.press('Meta+s');
  await expect(page.locator('.note-item')).toHaveCount(1);
  await page.locator('#searchNotes').fill('does not exist');
  await expect(page.locator('.no-notes-message')).toBeVisible();
});

test('folder create, rename, move, filter, delete retains active note membership', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Folder note');
  await save(page);
  await history(page);
  await page.locator('#newFolderBtn').click();
  const input = page.locator('#folderTabs input');
  await input.fill('Work');
  await input.press('Enter');
  await expect(page.locator('.folder-tab', { hasText: 'Work' })).toBeVisible();
  await page.locator('.move-note').click();
  await page.locator('#directFolderList .context-menu-item').filter({ hasText: 'Work' }).click();
  await expect.poll(async () => (await persisted(page))[0]?.folderName).toBe('Work');
  const tab = page.locator('.folder-tab', { hasText: 'Work' });
  await tab.click();
  await page.locator('#searchNotes').fill('Folder note');
  await expect(page.locator('.note-item')).toHaveCount(1);
  await tab.click({ button: 'right' });
  await page.locator('[data-action="rename-folder"]').click();
  await input.fill('Renamed');
  await input.press('Enter');
  await page.locator('.folder-tab', { hasText: 'Renamed' }).click({ button: 'right' });
  await page.locator('[data-action="delete-folder"]').click();
  await page.locator('.confirm-delete-btn').click();
  await expect.poll(async () => (await persisted(page))[0]?.folder).toBe(null);
  await page.keyboard.press('Meta+s');
  await expect.poll(async () => (await persisted(page))[0]?.folderName).toBe(null);
});

test('theme, local font, dropdown Escape and settings persist', async ({ running: { page } }) => {
  await page.locator('#themeBtn').click();
  await expect(page.locator('body')).toHaveClass('light-mode');
  await page.locator('#fontBtn').click();
  await page.locator('[data-font="Patrick Hand"]').click();
  await expect(page.locator('#editor')).toHaveCSS('font-family', '"Patrick Hand"');
  await page.locator('#formatBtn').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#formattingDropdownContent')).not.toHaveClass(/show/);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.ready === 'true');
  await expect(page.locator('body')).toHaveClass('light-mode');
  await history(page);
  await page.locator('.note-item').click();
  await expect(page.locator('#editor')).toHaveCSS('font-family', '"Patrick Hand"');
});

test('rapid note creation and switching have distinct ids and retain contents', async ({ running: { page } }) => {
  for (const text of ['One', 'Two', 'Three']) {
    await page.locator('#editor').fill(text);
    await newNote(page);
  }
  const notes = await persisted(page);
  expect(new Set(notes.map(note => note.id)).size).toBe(3);
  expect(notes.map(note => note.title).sort()).toEqual(['One', 'Three', 'Two']);
});

test('save failure retains edits and blocks navigation until retry succeeds', async ({ running: { page, dir } }) => {
  const notesDir = path.join(dir, 'notes');
  await fs.rename(notesDir, notesDir + '-backup');
  await fs.writeFile(notesDir, 'block writes');
  await page.locator('#editor').fill('Keep after failure');
  await page.locator('#newNoteBtn').click();
  await expect(page.locator('#saveStatus')).toContainText('Save failed');
  await expect(page.locator('#editor')).toHaveText('Keep after failure');
  await fs.unlink(notesDir);
  await fs.rename(notesDir + '-backup', notesDir);
  await save(page);
  expect((await persisted(page))[0].title).toBe('Keep after failure');
});

test('close button flushes the last edit before app exits', async ({ running: { app, page, dir } }) => {
  await page.locator('#editor').fill('Saved on close');
  const closed = app.waitForEvent('close');
  await page.locator('#closeBtn').click();
  await closed;
  const files = await fs.readdir(path.join(dir, 'notes'));
  expect(files.filter(file => file.endsWith('.md'))).toHaveLength(1);
  expect(await fs.readFile(path.join(dir, 'notes', files[0]), 'utf8')).toContain('Saved on close');
});

test('unsafe links and path ids rejected; HTML loaded inert; export Markdown', async ({ running: { app, page, dir } }) => {
  const result = await page.evaluate(async () => {
    const now = new Date().toISOString();
    const bad = await window.electronAPI.saveNote({ id: '../escape', content: 'bad' });
    const link = await window.electronAPI.openExternalLink('javascript:alert(1)');
    const saved = await window.electronAPI.saveNote({ id: 'safe', title: 'Safe', content: '<h1 onclick="alert(1)">Title</h1><script>alert(1)</script><div><u>Under</u></div><ul><li>Item</li></ul>', createdAt: now, updatedAt: now });
    return { bad, link, saved };
  });
  expect(result.bad.success).toBe(false);
  expect(result.link.success).toBe(false);
  expect(result.saved.note.content).not.toMatch(/script|onclick/);
  const output = path.join(dir, 'export.md');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ filePath }); }, output);
  const exported = await page.evaluate(note => window.electronAPI.exportNote(note), result.saved.note);
  expect(exported.success).toBe(true);
  const markdown = await fs.readFile(output, 'utf8');
  expect(markdown).toContain('# Title');
  expect(markdown).toContain('<u>Under</u>');
  expect(markdown).toContain('-   Item');
});

test('concurrent saves, title rename, failed rename and delete ordering are atomic', async ({ running: { page, dir } }) => {
  const result = await page.evaluate(async () => {
    const now = new Date().toISOString();
    const note = { id: 'concurrent', title: 'Original', content: '<div>old</div>', createdAt: now, updatedAt: now };
    return Promise.all(Array.from({ length: 15 }, (_, i) => window.electronAPI.saveNote({ ...note, title: `Title ${i}`, content: `<div>Revision ${i}</div>` })));
  });
  expect(result.every(item => item.success)).toBe(true);
  let files = await fs.readdir(path.join(dir, 'notes'));
  expect(files).toHaveLength(1);
  expect((await persisted(page))[0].content).toBe('<div>Revision 14</div>');
  const collision = path.join(dir, 'notes', 'note_concurrent_Blocked.md');
  await fs.mkdir(collision);
  const failure = await page.evaluate(async () => {
    const [note] = (await window.electronAPI.loadNotes()).notes;
    return window.electronAPI.saveNote({ ...note, title: 'Blocked', content: 'new' });
  });
  expect(failure.success).toBe(false);
  expect((await persisted(page))[0].content).toBe('<div>Revision 14</div>');
  await fs.rmdir(collision);
  await page.evaluate(async () => {
    const [note] = (await window.electronAPI.loadNotes()).notes;
    await Promise.all([window.electronAPI.saveNote({ ...note, content: 'last' }), window.electronAPI.deleteNote(note.id)]);
  });
  expect(await persisted(page)).toEqual([]);
  files = await fs.readdir(path.join(dir, 'notes'));
  expect(files).toEqual([]);
});

test('legacy migration preserves failed source notes and never overwrites newer files', async ({ running: { page, dir } }) => {
  const configPath = path.join(dir, 'flowpad-data.json');
  const now = new Date().toISOString();
  const good = { id: 'migrated', title: 'Legacy', content: '<div>Legacy body</div>', createdAt: now, updatedAt: now };
  const config = JSON.parse(await fs.readFile(configPath, 'utf8').catch(() => '{}'));
  config.notes = [good, { ...good, id: '../invalid' }];
  await fs.writeFile(configPath, JSON.stringify(config));
  await page.evaluate(() => window.electronAPI.triggerMigration());
  const retained = JSON.parse(await fs.readFile(configPath, 'utf8')).notes.length;
  await page.evaluate(note => window.electronAPI.saveNote({ ...note, content: '<div>Newer body</div>' }), good);
  config.notes = [good];
  await fs.writeFile(configPath, JSON.stringify(config));
  await page.evaluate(() => window.electronAPI.triggerMigration());
  const result = { retained, remaining: JSON.parse(await fs.readFile(configPath, 'utf8')).notes.length };
  expect(result).toEqual({ retained: 2, remaining: 0 });
  expect((await persisted(page))[0].content).toBe('<div>Newer body</div>');
});

test('metadata-less Markdown uses a stable id and does not duplicate on save', async ({ running: { page, dir } }) => {
  await fs.writeFile(path.join(dir, 'notes', 'imported.md'), '# Imported\n\n- A\n- B');
  const [first] = await persisted(page);
  const [second] = await persisted(page);
  expect(first.id).toBe(second.id);
  expect(first.content).toContain('<h1>Imported</h1>');
  await page.evaluate(async note => window.electronAPI.saveNote({ ...note, title: 'Changed' }), first);
  expect((await persisted(page))).toHaveLength(1);
  expect((await fs.readdir(path.join(dir, 'notes'))).filter(file => file.endsWith('.md'))).toHaveLength(1);
});

test('drag-to-folder, folder-scoped search, rename metadata and new-note membership', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Outside');
  await save(page);
  await history(page);
  await page.locator('#newFolderBtn').click();
  await page.locator('#folderTabs input').fill('Projects');
  await page.locator('#folderTabs input').press('Enter');
  const tab = page.locator('.folder-tab', { hasText: 'Projects' });
  await expect(tab).toBeVisible();
  await page.locator('.note-item').dragTo(tab);
  await expect.poll(async () => (await persisted(page))[0]?.folderName).toBe('Projects');
  await tab.click();
  await newNote(page);
  await page.locator('#editor').fill('Inside');
  await save(page);
  await history(page);
  await expect(page.locator('.note-item')).toHaveCount(2);
  await tab.click({ button: 'right' });
  await page.locator('[data-action="rename-folder"]').click();
  await page.locator('#folderTabs input').fill('Renamed');
  await page.locator('#folderTabs input').press('Enter');
  await expect.poll(async () => (await persisted(page)).every(note => note.folderName === 'Renamed')).toBe(true);
  await page.locator('.folder-tab', { hasText: 'Renamed' }).click();
  await page.locator('#searchNotes').fill('Missing');
  await expect(page.locator('.note-item')).toHaveCount(0);
});

test('context menu copy, cut, paste, select all and undo preserve the editing selection', async ({ running: { app, page } }) => {
  await page.locator('#editor').fill('Copy this');
  await selectAll(page);
  await page.locator('#editor').click({ button: 'right' });
  await page.locator('#editorContextMenu [data-action="copy"]').click();
  await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe('Copy this');
  await page.locator('#editor').click({ button: 'right' });
  await page.locator('#editorContextMenu [data-action="cut"]').click();
  await expect(page.locator('#editor')).toHaveText('');
  await page.locator('#editor').click({ button: 'right' });
  await page.locator('#editorContextMenu [data-action="paste"]').click();
  await expect(page.locator('#editor')).toHaveText('Copy this');
  await page.keyboard.press('Meta+z');
  await expect(page.locator('#editor')).toHaveText('');
});

test('fullscreen UI follows fullscreenchange and Escape', async ({ running: { app, page } }) => {
  const entered = app.evaluate(({ BrowserWindow }) => new Promise(resolve => BrowserWindow.getAllWindows()[0].once('enter-full-screen', () => resolve(true))));
  await page.locator('#fullscreenBtn').click();
  await entered;
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await expect(page.locator('.app-container')).toHaveClass(/fullscreen-mode/);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await expect(page.locator('.app-container')).not.toHaveClass(/fullscreen-mode/);
});

test('minimize, restore and window bounds persist', async ({ running: { app, page, dir } }) => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(720, 580));
  await page.locator('#minimizeBtn').click();
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized())).toBe(true);
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.restore(); win.focus(); });
  await expect.poll(async () => {
    const config = JSON.parse(await fs.readFile(path.join(dir, 'flowpad-data.json'), 'utf8').catch(() => '{}'));
    return config.windowBounds?.width;
  }).toBe(720);
});

test('surprise font is restored with a stylesheet when reopening a note', async ({ running: { page } }) => {
  // Keep font service responses deterministic; test font selection and persistence separately from the remote CDN.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.locator('#editor').fill('Font note');
  await page.locator('#surpriseBtn').click();
  await expect.poll(async () => { const font = (await persisted(page))[0]?.fontFamily; return !!font && font !== 'Aeonik'; }).toBe(true);
  const [note] = await persisted(page);
  await newNote(page);
  await history(page);
  await page.locator('.note-item').filter({ hasText: 'Font note' }).click();
  expect(await page.locator('#editor').evaluate(element => element.style.fontFamily)).toContain(note.fontFamily);
  expect(await page.locator('link[href*="fonts.googleapis.com"]').count()).toBeGreaterThan(1);
});

test('save responses never acknowledge newer edits made during the write', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Old');
  // Issue the save and edit synchronously so the renderer cannot receive its IPC response first.
  await page.evaluate(async () => {
    const notes = await import('./src/renderer/modules/notes/index.js');
    const editor = document.getElementById('editor');
    const saving = notes.saveCurrentNote(editor, document.getElementById('currentNoteTitle'));
    editor.focus();
    document.execCommand('selectAll');
    document.execCommand('insertText', false, 'Newer');
    await saving;
  });
  await expect(page.locator('#editor')).toHaveText('Newer');
  await expect(page.locator('#saveStatus')).toHaveText('Unsaved changes');
  await save(page);
  expect((await persisted(page))[0].content).toBe('Newer');
});

test('export cancellation and plain text export', async ({ running: { app, page, dir } }) => {
  await page.locator('#editor').fill('A title\nBody');
  await save(page);
  const [note] = await persisted(page);
  await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }); });
  expect((await page.evaluate(note => window.electronAPI.exportNote(note), note)).success).toBe(false);
  const output = path.join(dir, 'note.txt');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ filePath }); }, output);
  expect((await page.evaluate(note => window.electronAPI.exportNote(note), note)).success).toBe(true);
  expect(await fs.readFile(output, 'utf8')).toContain('Body');
});

test('reload flushes edits that are still waiting for autosave', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Before reload');
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.ready === 'true');
  expect((await persisted(page))[0].content).toBe('Before reload');
});

test('load failure is visible and prevents editing until reload succeeds', async ({ running: { page, dir } }) => {
  const notesDir = path.join(dir, 'notes');
  await fs.rename(notesDir, notesDir + '-backup');
  await fs.writeFile(notesDir, 'blocked');
  await page.reload();
  await expect(page.locator('#saveStatus')).toContainText('Could not load notes');
  await expect(page.locator('#editor')).toHaveAttribute('contenteditable', 'false');
  await fs.unlink(notesDir);
  await fs.rename(notesDir + '-backup', notesDir);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.ready === 'true');
  await expect(page.locator('#editor')).toHaveAttribute('contenteditable', 'true');
});

test('failed save blocks close and allows retry without losing the edit', async ({ running: { page, dir } }) => {
  const notesDir = path.join(dir, 'notes');
  await fs.rename(notesDir, notesDir + '-backup');
  await fs.writeFile(notesDir, 'blocked');
  await page.locator('#editor').fill('Keep open');
  await page.locator('#closeBtn').click();
  await expect(page.locator('#saveStatus')).toContainText('Save failed');
  await expect(page.locator('#editor')).toHaveAttribute('contenteditable', 'true');
  await fs.unlink(notesDir);
  await fs.rename(notesDir + '-backup', notesDir);
  await save(page);
  expect((await persisted(page))[0].content).toBe('Keep open');
});

test('full app restart retains content, font, theme and folder metadata', async ({ running: { app, page, dir } }) => {
  await page.locator('#editor').fill('Restarted\n\nBody');
  await page.locator('#themeBtn').click();
  await page.locator('#fontBtn').click();
  await page.locator('[data-font="Baskervville"]').click();
  await save(page);
  await app.close();
  const restarted = await _electron.launch({ args: ['.'], env: { ...process.env, FLOWPAD_DATA_DIR: dir } });
  try {
    const window = await restarted.firstWindow();
    await window.waitForFunction(() => document.body.dataset.ready === 'true');
    await expect(window.locator('body')).toHaveClass('light-mode');
    await history(window);
    await window.locator('.note-item').first().click();
    await expect(window.locator('#editor')).toHaveText('RestartedBody');
    expect((await persisted(window))[0].content).toContain('<div><br></div>');
    await expect(window.locator('#editor')).toHaveCSS('font-family', 'Baskervville');
  } finally { await restarted.close(); }
});

test('plain quote continuation splits at caret and exits on empty quote', async ({ running: { page } }) => {
  await page.locator('#editor').fill('> AlphaBeta');
  await page.keyboard.press('End');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  expect(await page.locator('#editor').innerText()).toContain('> Alpha\n> Beta');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Body');
  expect(await page.locator('#editor').innerText()).toContain('\nBody');
  await save(page);
  expect((await persisted(page))[0].content).toContain('&gt; Beta');
});

test('malformed imported ids are reported without injecting sidebar markup', async ({ running: { page, dir } }) => {
  await fs.writeFile(path.join(dir, 'notes', 'malformed.md'), '---\nid: "bad\\\"id"\ntitle: "Bad"\n---\n\nKeep original');
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.ready === 'true');
  await expect(page.locator('#saveStatus')).toContainText('1 note file');
  expect((await persisted(page)).length).toBe(0);
  expect(await fs.readFile(path.join(dir, 'notes', 'malformed.md'), 'utf8')).toContain('Keep original');
});

test('folder rename can be cancelled and empty new folders are removed', async ({ running: { page } }) => {
  await history(page);
  await page.locator('#newFolderBtn').click();
  const input = page.locator('#folderTabs input');
  await input.press('Escape');
  await expect(page.locator('.folder-tab')).toHaveCount(1);
  await page.locator('#newFolderBtn').click();
  await input.fill('');
  await input.press('Enter');
  await expect(page.locator('.folder-tab')).toHaveCount(1);
  expect(await page.evaluate(async () => (await window.electronAPI.getFolders()).folders)).toEqual([]);
});

test('undo and redo stay within the current note after a switch', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Original note');
  await newNote(page);
  await page.keyboard.insertText('Second note');
  await page.keyboard.press('Meta+z');
  await expect(page.locator('#editor')).toHaveText('');
  await page.keyboard.press('Meta+Shift+z');
  await expect(page.locator('#editor')).toHaveText('Second note');
  await save(page);
  const notes = await persisted(page);
  expect(notes.map(note => note.title).sort()).toEqual(['Original note', 'Second note']);
});

test('Backspace at a list boundary keeps both item texts', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Alpha\nBeta');
  await selectAll(page);
  await list(page, 'bullet');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  const text = await page.locator('#editor').innerText();
  expect(text).toContain('Alpha');
  expect(text).toContain('Beta');
  await save(page);
  expect((await persisted(page))[0].content).toContain('Beta');
});

test('folder mutations and stale note saves cannot overwrite content or restore deleted folders', async ({ running: { page } }) => {
  const result = await page.evaluate(async () => {
    const now = new Date().toISOString();
    const folder = { id: 'race-folder', name: 'Old', createdAt: now };
    await window.electronAPI.saveFolder(folder);
    const note = { id: 'race-note', title: 'Race', content: 'Original', createdAt: now, updatedAt: now, folder: folder.id, folderName: folder.name };
    await window.electronAPI.saveNote(note);
    await Promise.all([
      window.electronAPI.saveFolder({ ...folder, name: 'Renamed' }),
      window.electronAPI.saveNote({ ...note, content: 'Latest after rename' })
    ]);
    const renamed = (await window.electronAPI.loadNotes()).notes[0];
    await Promise.all([
      window.electronAPI.deleteFolder(folder.id),
      window.electronAPI.saveNote({ ...renamed, content: 'Latest after deletion' })
    ]);
    return { renamed, deleted: (await window.electronAPI.loadNotes()).notes[0] };
  });
  expect(result.renamed.content).toBe('Latest after rename');
  expect(result.renamed.folderName).toBe('Renamed');
  expect(result.deleted.content).toBe('Latest after deletion');
  expect(result.deleted.folder).toBe(null);
  expect(result.deleted.folderName).toBe(null);
});

for (const marker of ['-', '*', '•']) {
  test(`list reactivates with ${marker} after exiting an earlier list`, async ({ running: { page } }) => {
    await page.locator('#editor').fill('hello');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('* first');
    await page.keyboard.press('Enter');
    await page.keyboard.type('second');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type(`${marker} `);
    await expect(page.locator('#editor li')).toHaveCount(3);
    await page.keyboard.type('again');
    await page.keyboard.press('Enter');
    await page.keyboard.type('continued');
    await expect(page.locator('#editor li')).toHaveText(['first', 'second', 'again', 'continued']);
    await expect(page.locator('#editor ul').first()).toHaveAttribute('data-marker', 'bullet');
    const style = marker === '-' ? 'dash' : 'bullet';
    await expect(page.locator('#editor li').nth(2)).toHaveAttribute('data-marker', style);
    const markerContent = await page.locator('#editor li').last().evaluate(item => getComputedStyle(item, '::marker').content);
    expect(markerContent).toContain(marker === '-' ? '-' : '•');
  });
}

test('list activation starts at the logical line after Shift+Enter', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Body text');
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('- again');
  await expect(page.locator('#editor ul[data-marker="dash"] li')).toHaveText('again');
  expect(await page.locator('#editor').innerText()).toContain('Body text');
});

test('dash and dot markers stay distinct through nesting, continuation, save and reopening', async ({ running: { page } }) => {
  await page.locator('#editor').focus();
  await page.keyboard.type('- Dash one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Dash two');
  await page.keyboard.press('Tab');
  expect(await page.locator('#editor li').last().evaluate(item => getComputedStyle(item, '::marker').content)).toContain('-');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('* Dot one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Dot two');
  const markers = () => page.locator('#editor li').evaluateAll(items => items.map(item => getComputedStyle(item, '::marker').content));
  expect(await markers()).toEqual(['"-  "', '"-  "', '"•  "', '"•  "']);
  await save(page);
  const html = await page.locator('#editor').innerHTML();
  expect((await persisted(page))[0].content).toBe(html);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.ready === 'true');
  await history(page);
  await page.locator('.note-item').first().click();
  expect(await markers()).toEqual(['"-  "', '"-  "', '"•  "', '"•  "']);
});

test('numbered list reactivates after an earlier bullet list', async ({ running: { page } }) => {
  await page.locator('#editor').fill('Title');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('* First');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('3. Third');
  await expect(page.locator('#editor ol')).toHaveAttribute('start', '3');
  await expect(page.locator('#editor ol li')).toHaveText('Third');
});
