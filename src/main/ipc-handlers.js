// ===== IPC HANDLERS MODULE =====
// Handles all communication between main and renderer processes

const { ipcMain, dialog, shell } = require('electron');
const fs = require('fs').promises;
const storage = require('./storage');
const { pathToFileURL } = require('url');
const path = require('path');
const appUrl = pathToFileURL(path.join(__dirname, '../../index.html')).href;

function handle(channel, callback) {
  ipcMain.handle(channel, (event, ...args) => {
    if (event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== appUrl) {
      throw new Error('Untrusted IPC sender');
    }
    return callback(event, ...args);
  });
}
const { sanitizeFilename, convertHtmlToMarkdown, convertHtmlToText, createFrontmatter } = require('../shared/utils');

// ===== NOTE OPERATIONS =====
function setupNoteHandlers() {
  // Save note
  handle('save-note', async (event, noteData) => {
    return await storage.saveNote(noteData);
  });

  // Load all notes
  handle('load-notes', async () => {
    return await storage.loadNotes();
  });

  // Delete note
  handle('delete-note', async (event, noteId) => {
    return await storage.deleteNote(noteId);
  });

  // Folder operations
  handle('get-folders', async () => {
    return await storage.getFolders();
  });

  handle('save-folder', async (event, folderData) => {
    return await storage.saveFolder(folderData);
  });

  handle('delete-folder', async (event, folderId) => {
    return await storage.deleteFolder(folderId);
  });

  // Manual migration trigger
  handle('trigger-migration', async () => {
    try {
      await storage.migrateNotesToFiles();
      return { success: true, message: 'Migration completed' };
    } catch (error) {
      console.error('Error during manual migration:', error);
      return { success: false, error: error.message };
    }
  });

  // Export note
  handle('export-note', async (event, note) => {
    try {
      const { filePath } = await dialog.showSaveDialog(null, {
        title: 'Export Note',
        defaultPath: `${sanitizeFilename(note.title)}.md`,
        filters: [
          { name: 'Markdown Files', extensions: ['md'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (filePath) {
        let exportContent;
        
        if (filePath.toLowerCase().endsWith('.md')) {
          // Export as markdown with frontmatter
          const markdownContent = await convertHtmlToMarkdown(note.content);
          exportContent = createFrontmatter({ ...note, contentFormat: 'markdown' }) + markdownContent;
        } else {
          // Export as plain text
          exportContent = convertHtmlToText(note.content);
        }
        
        await fs.writeFile(filePath, exportContent, 'utf8');
        return { success: true, filePath };
      }
      return { success: false, error: 'Export cancelled' };
    } catch (error) {
      console.error('Error exporting note:', error);
      return { success: false, error: error.message };
    }
  });
}

// ===== SETTINGS HANDLERS =====
function setupSettingsHandlers() {
  // Get app settings
  handle('get-app-settings', async () => {
    return storage.getAppSettings();
  });

  // Save app settings
  handle('save-app-settings', async (event, settings) => {
    return storage.saveAppSettings(settings);
  });


  // Get window bounds
  handle('get-window-bounds', async () => {
    return storage.getWindowBounds();
  });

  // Save window bounds
  handle('save-window-bounds', async (event, bounds) => {
    return storage.saveWindowBounds(bounds);
  });

  // Update title bar theme
  handle('update-title-bar-theme', async (_event, _theme) => {
    try {
      // This would be used if we had title bar overlay support
      // For now, just return success
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

// ===== WINDOW CONTROL HANDLERS =====
function setupWindowHandlers(mainWindow) {
  // Close app
  handle('close-app', async () => {
    try {
      const { app } = require('electron');
      app.quit();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Minimize window
  handle('minimize-window', async () => {
    try {
      if (mainWindow) {
        mainWindow.minimize();
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}




// ===== FILE SYSTEM HANDLERS =====
function setupFileSystemHandlers() {
  // Open notes folder
  handle('open-notes-folder', async () => {
    try {
      await storage.ensureNotesDirectory();
      const error = await shell.openPath(storage.getNotesDirectory());
      if (error) throw new Error(error);
      return { success: true };
    } catch (error) {
      console.error('Error opening notes folder:', error);
      return { success: false, error: error.message };
    }
  });

  // Open external link in system browser
  handle('open-external-link', async (event, url) => {
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Unsupported link protocol');
      await shell.openExternal(parsed.href);
      return { success: true };
    } catch (error) {
      console.error('Error opening external link:', error);
      return { success: false, error: error.message };
    }
  });
}

// ===== INITIALIZE ALL HANDLERS =====
function initializeIpcHandlers(mainWindow) {
  setupNoteHandlers();
  setupSettingsHandlers();
  setupWindowHandlers(mainWindow);
  setupFileSystemHandlers();

  console.log('IPC handlers initialized');
}

// ===== EXPORTS =====
module.exports = {
  initializeIpcHandlers
}; 