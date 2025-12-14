// ===== FILE-BASED STORAGE MODULE =====
// Handles all note file operations, migration, and directory management

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const Store = require('electron-store');
const { 
  generateNoteFilename,
  createFrontmatter,
  parseFrontmatter,
  convertHtmlToMarkdown,
  convertMarkdownToHtml
} = require('../shared/utils');

// ===== CONFIGURATION =====
// Use Application Support directory to avoid Documents permission issues
const NOTES_DIR = path.join(os.homedir(), 'Documents', 'Flowpad');

// Initialize electron-store for settings (we still use this for app preferences)
const store = new Store({
  name: 'flowpad-data',
  cwd: process.platform === 'darwin' 
    ? path.join(os.homedir(), 'Library', 'Application Support', 'Flowpad')
    : undefined // Use default for Windows/Linux
});

// ===== DIRECTORY MANAGEMENT =====
async function ensureNotesDirectory() {
  try {
    await fs.access(NOTES_DIR);
  } catch (error) {
    await fs.mkdir(NOTES_DIR, { recursive: true });
  }
}

// ===== NOTE FILE OPERATIONS =====
async function saveNote(noteData) {
  try {
    await ensureNotesDirectory();
    
    const noteId = noteData.id || Date.now().toString();
    const timestamp = new Date().toISOString();
    
    const note = {
      id: noteId,
      title: noteData.title || 'New Note',
      content: noteData.content,
      createdAt: noteData.createdAt || timestamp,
      updatedAt: noteData.updatedAt || timestamp, // Preserve provided timestamp if given
      tags: noteData.tags || [],
      fontSize: noteData.fontSize || 16,
      fontFamily: noteData.fontFamily || 'Aeonik',
      folder: noteData.folder || null,
      folderName: noteData.folderName || null
    };
    
    // Convert HTML content to Markdown for storage
    const markdownContent = await convertHtmlToMarkdown(note.content);
    
    // Create file content with frontmatter
    const fileContent = createFrontmatter(note) + markdownContent;
    
    // Generate filename
    const filename = generateNoteFilename(note);
    const filepath = path.join(NOTES_DIR, filename);
    
    // Check if this is an update to existing note (async version)
    const files = await fs.readdir(NOTES_DIR);
    let existingFile = null;
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          const content = await fs.readFile(path.join(NOTES_DIR, file), 'utf8');
          const { metadata } = parseFrontmatter(content);
          if (metadata.id === noteId) {
            existingFile = file;
            break;
          }
        } catch (error) {
          // Continue to next file
        }
      }
    }
    
    // If updating existing note, remove old file
    if (existingFile) {
      const oldFilePath = path.join(NOTES_DIR, existingFile);
      await fs.unlink(oldFilePath);
    }
    
    // Write the new/updated note
    await fs.writeFile(filepath, fileContent, 'utf8');
    
    return { success: true, note };
  } catch (error) {
    console.error('Storage: Error saving note:', error);
    return { success: false, error: error.message };
  }
}

async function loadNotes() {
  try {
    await ensureNotesDirectory();
    
    const files = await fs.readdir(NOTES_DIR);
    const notes = [];
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          const filepath = path.join(NOTES_DIR, file);
          const content = await fs.readFile(filepath, 'utf8');
          const { metadata, content: markdownContent } = parseFrontmatter(content);
          
          // Convert Markdown back to HTML for the editor
          const htmlContent = await convertMarkdownToHtml(markdownContent);
          
          const note = {
            id: metadata.id || Date.now().toString(),
            title: metadata.title || 'New Note',
            content: htmlContent,
            createdAt: metadata.createdAt || new Date().toISOString(),
            updatedAt: metadata.updatedAt || new Date().toISOString(),
            tags: metadata.tags || [],
            fontSize: metadata.fontSize || 16,
            fontFamily: metadata.fontFamily || 'Aeonik',
            folder: metadata.folder || null,
            folderName: metadata.folderName || null
          };
          
          // Debug logging removed for performance - uncomment if needed:
          // if (process.env.DEBUG_FONTS) {
          //   console.log(`Storage: Loading note - fontSize: ${metadata.fontSize}, fontFamily: "${metadata.fontFamily}" for note: "${note.title}"`);
          // }
          
          notes.push(note);
        } catch (fileError) {
          console.error(`Storage: Error reading note file ${file}:`, fileError);
        }
      }
    }
    
    // Sort notes by updatedAt (newest first)
    notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    return { success: true, notes };
  } catch (error) {
    console.error('Storage: Error loading notes:', error);
    return { success: false, error: error.message };
  }
}

async function deleteNote(noteId) {
  try {
    await ensureNotesDirectory();
    
    const files = await fs.readdir(NOTES_DIR);
    let targetFile = null;
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          const content = await fs.readFile(path.join(NOTES_DIR, file), 'utf8');
          const { metadata } = parseFrontmatter(content);
          if (metadata.id === noteId) {
            targetFile = file;
            break;
          }
        } catch (error) {
          // Continue to next file
        }
      }
    }
    
    if (targetFile) {
      const filepath = path.join(NOTES_DIR, targetFile);
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
      if (existingNotes.length > 0) {
        store.set('notes', []);
      }
      
      // Try to clear legacy notes if they exist
      if (legacyNotes.length > 0) {
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
  
  // Convert HTML content to Markdown
  const markdownContent = await convertHtmlToMarkdown(noteWithFonts.content);
  
  // Create file content with frontmatter
  const fileContent = createFrontmatter(noteWithFonts) + markdownContent;
  
  // Generate filename
  const filename = generateNoteFilename(noteWithFonts);
  const filepath = path.join(NOTES_DIR, filename);
  
  // Write the note file
  await fs.writeFile(filepath, fileContent, 'utf8');
  console.log(`Migrated note: ${filename}`);
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

async function saveFolder(folderData) {
  try {
    const folders = store.get('folders', []);
    const folderId = folderData.id || Date.now().toString();
    
    const folder = {
      id: folderId,
      name: folderData.name,
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
    return { success: true, folder };
  } catch (error) {
    console.error('Error saving folder:', error);
    return { success: false, error: error.message };
  }
}

async function deleteFolder(folderId) {
  try {
    const folders = store.get('folders', []);
    const updatedFolders = folders.filter(f => f.id !== folderId);
    store.set('folders', updatedFolders);
    
    // Also update any notes that were in this folder to have no folder
    const result = await loadNotes();
    if (result.success) {
      const notesToUpdate = result.notes.filter(note => note.folder === folderId);
      for (const note of notesToUpdate) {
        await saveNote({ ...note, folder: null });
      }
    }
    
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
  getNotesDirectory
}; 