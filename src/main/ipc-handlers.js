// ===== IPC HANDLERS MODULE =====
// Handles all communication between main and renderer processes

const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const storage = require('./storage');
const { sanitizeFilename, convertHtmlToMarkdown, createFrontmatter } = require('../shared/utils');

// ===== NOTE OPERATIONS =====
function setupNoteHandlers() {
  // Save note
  ipcMain.handle('save-note', async (event, noteData) => {
    return await storage.saveNote(noteData);
  });

  // Load all notes
  ipcMain.handle('load-notes', async () => {
    return await storage.loadNotes();
  });

  // Delete note
  ipcMain.handle('delete-note', async (event, noteId) => {
    return await storage.deleteNote(noteId);
  });

  // Folder operations
  ipcMain.handle('get-folders', async () => {
    return await storage.getFolders();
  });

  ipcMain.handle('save-folder', async (event, folderData) => {
    return await storage.saveFolder(folderData);
  });

  ipcMain.handle('delete-folder', async (event, folderId) => {
    return await storage.deleteFolder(folderId);
  });

  // Manual migration trigger
  ipcMain.handle('trigger-migration', async () => {
    try {
      await storage.migrateNotesToFiles();
      return { success: true, message: 'Migration completed' };
    } catch (error) {
      console.error('Error during manual migration:', error);
      return { success: false, error: error.message };
    }
  });

  // Export note
  ipcMain.handle('export-note', async (event, note) => {
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
        
        if (filePath.endsWith('.md')) {
          // Export as markdown with frontmatter
          const markdownContent = await convertHtmlToMarkdown(note.content);
          exportContent = createFrontmatter(note) + markdownContent;
        } else {
          // Export as plain text
          exportContent = await convertHtmlToMarkdown(note.content);
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
  ipcMain.handle('get-app-settings', async () => {
    return storage.getAppSettings();
  });

  // Save app settings
  ipcMain.handle('save-app-settings', async (event, settings) => {
    return storage.saveAppSettings(settings);
  });

  // Get window bounds
  ipcMain.handle('get-window-bounds', async () => {
    return storage.getWindowBounds();
  });

  // Save window bounds
  ipcMain.handle('save-window-bounds', async (event, bounds) => {
    return storage.saveWindowBounds(bounds);
  });

  // Update title bar theme
  ipcMain.handle('update-title-bar-theme', async (event, theme) => {
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
  ipcMain.handle('close-app', async () => {
    try {
      const { app } = require('electron');
      app.quit();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Minimize window
  ipcMain.handle('minimize-window', async () => {
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
  ipcMain.handle('open-notes-folder', async () => {
    try {
      await storage.ensureNotesDirectory();
      await shell.openPath(storage.getNotesDirectory());
      return { success: true };
    } catch (error) {
      console.error('Error opening notes folder:', error);
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