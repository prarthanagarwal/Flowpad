// ===== FILE-BASED STORAGE MODULE =====
// Handles all note file operations, migration, and directory management

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');
const Store = require('electron-store');
const {
  generateNoteFilename,
  createFrontmatter,
  parseFrontmatter,
  convertMarkdownToHtml,
  sanitizeNoteHtml
} = require('../shared/utils');

// ===== CONFIGURATION =====
// Keep existing user notes in Documents; tests use an isolated profile.
const NOTES_DIR = process.env.FLOWPAD_DATA_DIR
  ? path.join(process.env.FLOWPAD_DATA_DIR, 'notes')
  : path.join(os.homedir(), 'Documents', 'Flowpad');

// Initialize electron-store for settings (we still use this for app preferences)
const store = new Store({
  name: 'flowpad-data',
  cwd: process.env.FLOWPAD_DATA_DIR || (process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'Flowpad')
    : undefined) // Use default for Windows/Linux
});

// ===== DIRECTORY MANAGEMENT =====
async function ensureNotesDirectory() {
  try {
    await fs.access(NOTES_DIR);
  } catch {
    await fs.mkdir(NOTES_DIR, { recursive: true });
  }
}

// ===== NOTE FILE OPERATIONS =====
async function findFileByNoteId(noteId) {
  const files = await fs.readdir(NOTES_DIR);
  const mdFiles = files.filter(file => file.endsWith('.md'));

  const directMatch = mdFiles.find(file => file.startsWith(`note_${noteId}_`));
  if (directMatch) return directMatch;

  const results = await Promise.all(
    mdFiles.map(async file => {
      try {
        const content = await fs.readFile(path.join(NOTES_DIR, file), 'utf8');
        const { metadata } = parseFrontmatter(content);
        if (metadata.id === noteId || (!metadata.id && require('crypto').createHash('sha256').update(file).digest('hex').slice(0, 32) === noteId)) return file;
      } catch {
        // Skip unreadable files
      }
      return null;
    })
  );

  return results.find(Boolean) || null;
}

// Serialize mutations so an older write cannot finish after a newer save or delete.
let pendingMutation = Promise.resolve();
function enqueueMutation(operation) {
  const result = pendingMutation.then(operation);
  pendingMutation = result.catch(() => {});
  return result;
}
// IPC values are untrusted; representation checks belong at this storage boundary.
/* eslint-disable anti-slop/no-runtime-typeof */
function validateId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(id)) {
    throw new Error('Invalid note or folder ID');
  }
}
function saveNote(noteData) {
  return enqueueMutation(() => writeNote(noteData));
}
async function writeNote(noteData) {
  try {
    await ensureNotesDirectory();

    const noteId = noteData.id || randomUUID();
    validateId(noteId);
    if (noteData.title != null && (typeof noteData.title !== 'string' || noteData.title.length > 10000)) throw new Error('Invalid note title');
    if (noteData.folder != null) validateId(noteData.folder);
    if (typeof noteData.content !== 'string' || noteData.content.length > 10_000_000) {
      throw new Error('Invalid note content');
    }
    const timestamp = new Date().toISOString();
    const folder = store.get('folders', []).find(item => item.id === noteData.folder);

    const note = {
      id: noteId,
      title: noteData.title || 'New Note',
      content: noteData.content || '',
      createdAt: noteData.createdAt || timestamp,
      updatedAt: noteData.updatedAt || timestamp,
      isPinned: noteData.isPinned || false,
      tags: noteData.tags || [],
      fontSize: noteData.fontSize || 18,
      fontFamily: noteData.fontFamily || 'Aeonik',
      folder: folder?.id || null,
      folderName: folder?.name || null
    };

    // Preserve exact editor structure; Markdown export is handled separately.
    note.content = sanitizeNoteHtml(note.content);
    const htmlContent = note.content;
    note.contentFormat = 'html';

    // Create file content with frontmatter
    const fileContent = createFrontmatter(note) + htmlContent;

    // Target filepath
    const newFilename = generateNoteFilename(note);
    const newFilepath = path.join(NOTES_DIR, newFilename);

    // Find existing file for this note
    const existingFile = await findFileByNoteId(noteId);

    // Replace only after the complete new file is on disk; failed renames keep the old note.
    const temporaryPath = `${newFilepath}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporaryPath, fileContent, { encoding: 'utf8', mode: 0o600, flush: true });
      await fs.rename(temporaryPath, newFilepath);
    } finally {
      await fs.unlink(temporaryPath).catch(() => {});
    }
    if (existingFile && existingFile !== newFilename) {
      await fs.unlink(path.join(NOTES_DIR, existingFile));
    }

    return { success: true, note };
  } catch (error) {
    console.error('Storage: Error saving note:', error);
    return { success: false, error: error.message };
  }
}

async function loadNotes() {
  await pendingMutation;
  return readNotes();
}
async function readNotes() {
  try {
    await ensureNotesDirectory();

    const files = await fs.readdir(NOTES_DIR);
    const mdFiles = files.filter(file => file.endsWith('.md'));

    const warnings = [];
    const notesResults = await Promise.all(
      mdFiles.map(async file => {
        try {
          const filepath = path.join(NOTES_DIR, file);
          const content = await fs.readFile(filepath, 'utf8');
          const { metadata, content: markdownContent } = parseFrontmatter(content);

          const id = metadata.id || require('crypto').createHash('sha256').update(file).digest('hex').slice(0, 32);
          validateId(id);
          // Convert Markdown back to HTML for the editor
          const htmlContent = metadata.contentFormat === 'html'
            ? sanitizeNoteHtml(markdownContent)
            : await convertMarkdownToHtml(markdownContent, !!metadata.id && !metadata.contentFormat);

          return {
            id,
            title: typeof metadata.title === 'string' ? metadata.title : 'New Note',
            content: htmlContent,
            createdAt: Number.isFinite(Date.parse(metadata.createdAt)) ? new Date(metadata.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: Number.isFinite(Date.parse(metadata.updatedAt)) ? new Date(metadata.updatedAt).toISOString() : new Date().toISOString(),
            isPinned: metadata.isPinned || false,
            tags: metadata.tags || [],
            fontSize: metadata.fontSize || 18,
            fontFamily: metadata.fontFamily || 'Aeonik',
            folder: metadata.folder || null,
            folderName: metadata.folderName || null
          };
        } catch (fileError) {
          warnings.push(file);
          console.error(`Storage: Error reading note file ${file}:`, fileError);
          return null;
        }
      })
    );

    const notes = notesResults.filter(Boolean);

    // Sort notes: pinned notes first, then by updatedAt (newest first)
    notes.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    return { success: true, notes, warnings };
  } catch (error) {
    console.error('Storage: Error loading notes:', error);
    return { success: false, error: error.message };
  }
}

function deleteNote(noteId) {
  return enqueueMutation(() => removeNote(noteId));
}
async function removeNote(noteId) {
  try {
    await ensureNotesDirectory();
    validateId(noteId);
    const existingFile = await findFileByNoteId(noteId);

    if (existingFile) {
      const filepath = path.join(NOTES_DIR, existingFile);
      await fs.unlink(filepath);
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting note:', error);
    return { success: false, error: error.message };
  }
}

// ===== MIGRATION =====
async function migrateNotesToFiles() {
  try {
    // Get notes from current electron-store
    const existingNotes = store.get('notes', []);
    let migratedCount = 0;
    let totalNotesToMigrate = existingNotes.length;

    // Check for notes in the legacy location (without -data suffix)
    let legacyNotes = [];
    const legacyConfigPath = path.join(os.homedir(), 'AppData', 'Roaming', 'flowpad', 'config.json');

    try {
      if (fsSync.existsSync(legacyConfigPath)) {
        console.log(`Found legacy config file at ${legacyConfigPath}`);
        const legacyConfig = JSON.parse(fsSync.readFileSync(legacyConfigPath, 'utf8'));
        if (legacyConfig.notes && Array.isArray(legacyConfig.notes)) {
          legacyNotes = legacyConfig.notes;
          console.log(`Found ${legacyNotes.length} notes in legacy config`);
          totalNotesToMigrate += legacyNotes.length;
        }
      }
    } catch (legacyError) {
      console.error('Error reading legacy config:', legacyError);
    }

    if (totalNotesToMigrate > 0) {
      console.log(`Migrating ${totalNotesToMigrate} notes to file-based storage...`);
      await ensureNotesDirectory();

      // First migrate notes from current store
      for (const note of existingNotes) {
        try {
          await migrateNote(note);
          migratedCount++;
        } catch (noteError) {
          console.error(`Error migrating note ${note.id}:`, noteError);
        }
      }

      // Then migrate notes from legacy location
      for (const note of legacyNotes) {
        try {
          await migrateNote(note);
          migratedCount++;
        } catch (noteError) {
          console.error(`Error migrating legacy note ${note.id}:`, noteError);
        }
      }

      // Clear the old notes from electron-store after successful migration
      if (existingNotes.length > 0 && migratedCount === totalNotesToMigrate) {
        store.set('notes', []);
      }

      // Try to clear legacy notes if they exist
      if (legacyNotes.length > 0 && migratedCount === totalNotesToMigrate) {
        try {
          if (fsSync.existsSync(legacyConfigPath)) {
            const legacyConfig = JSON.parse(fsSync.readFileSync(legacyConfigPath, 'utf8'));
            legacyConfig.notes = [];
            fsSync.writeFileSync(legacyConfigPath, JSON.stringify(legacyConfig, null, 2), 'utf8');
          }
        } catch (clearError) {
          console.error('Error clearing legacy notes:', clearError);
        }
      }

      console.log(`Migration completed! Migrated ${migratedCount} of ${totalNotesToMigrate} notes.`);
    } else {
      console.log('No notes found to migrate.');
    }
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Helper function to migrate a single note
async function migrateNote(note) {
  // Add default font settings for backward compatibility
  const noteWithFonts = {
    ...note,
    fontSize: note.fontSize || 16,
    fontFamily: note.fontFamily || 'Aeonik'
  };

  const existing = await findFileByNoteId(note.id);
  if (existing) return;
  const result = await saveNote(noteWithFonts);
  if (!result.success) throw new Error(result.error);
}

// ===== SETTINGS MANAGEMENT =====
function getAppSettings() {
  return store.get('settings', {
    fontSize: 16,
    fontFamily: 'Aeonik',
    theme: 'dark',
    autoSave: true,
    wordWrap: true,
    openOnStartup: false
  });
}

function saveAppSettings(settings) {
  try {
    store.set('settings', settings);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}


// ===== WINDOW STATE MANAGEMENT =====
function getWindowBounds() {
  return store.get('windowBounds', {
    width: 900,  // Smaller default size
    height: 700, // Smaller default size
    x: undefined,
    y: undefined,
    isMaximized: false
  });
}

function saveWindowBounds(bounds) {
  try {
    store.set('windowBounds', bounds);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== DIRECTORY ACCESS =====
function getNotesDirectory() {
  return NOTES_DIR;
}

// ===== FOLDER MANAGEMENT =====
async function getFolders() {
  try {
    const folders = store.get('folders', []);
    return { success: true, folders };
  } catch (error) {
    console.error('Error getting folders:', error);
    return { success: false, error: error.message };
  }
}

function saveFolder(folderData) {
  return enqueueMutation(() => writeFolder(folderData));
}
async function writeFolder(folderData) {
  try {
    const folders = store.get('folders', []);
    const folderId = folderData.id || randomUUID();
    validateId(folderId);
    if (typeof folderData.name !== 'string' || !folderData.name.trim() || folderData.name.length > 200) {
      throw new Error('Folder name must contain 1–200 characters');
    }

    const folder = {
      id: folderId,
      name: folderData.name.trim(),
      createdAt: folderData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Check if folder exists
    const existingIndex = folders.findIndex(f => f.id === folderId);
    if (existingIndex > -1) {
      folders[existingIndex] = folder;
    } else {
      folders.push(folder);
    }

    store.set('folders', folders);
    if (existingIndex > -1) {
      const result = await readNotes();
      if (!result.success) throw new Error(result.error);
      for (const note of result.notes.filter(item => item.folder === folderId)) {
        const saved = await writeNote({ ...note, folderName: folder.name });
        if (!saved.success) throw new Error(saved.error);
      }
    }
    store.set('folders', folders);
    return { success: true, folder };
  } catch (error) {
    console.error('Error saving folder:', error);
    return { success: false, error: error.message };
  }
}

function deleteFolder(folderId) {
  return enqueueMutation(() => removeFolder(folderId));
}
async function removeFolder(folderId) {
  try {
    const folders = store.get('folders', []);
    const updatedFolders = folders.filter(f => f.id !== folderId);
    validateId(folderId);

    // Also update any notes that were in this folder to have no folder
    const result = await readNotes();
    if (!result.success) throw new Error(result.error);
    if (result.success) {
      const notesToUpdate = result.notes.filter(note => note.folder === folderId);
      for (const note of notesToUpdate) {
        const saved = await writeNote({ ...note, folder: null, folderName: null });
        if (!saved.success) throw new Error(saved.error);
      }
    }

    store.set('folders', updatedFolders);
    return { success: true };
  } catch (error) {
    console.error('Error deleting folder:', error);
    return { success: false, error: error.message };
  }
}

// ===== EXPORTS =====
module.exports = {
  // Note operations
  saveNote,
  loadNotes,
  deleteNote,

  // Folder operations
  getFolders,
  saveFolder,
  deleteFolder,

  // Migration
  migrateNotesToFiles,

  // Settings
  getAppSettings,
  saveAppSettings,

  // Window state
  getWindowBounds,
  saveWindowBounds,

  // Directory management
  ensureNotesDirectory,
  getNotesDirectory,
  flush: () => pendingMutation
};
