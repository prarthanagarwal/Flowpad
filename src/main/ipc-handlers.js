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

// ===== AUTO-UPDATER HANDLERS =====
function setupUpdaterHandlers() {
  // Check for updates
  ipcMain.handle('check-for-updates', async () => {
    try {
      const { autoUpdater } = require('electron-updater');
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Download update
  ipcMain.handle('download-update', async () => {
    try {
      const { autoUpdater } = require('electron-updater');
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Quit and install
  ipcMain.handle('quit-and-install', async () => {
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.quitAndInstall(true, true);
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
  setupUpdaterHandlers();
  setupFileSystemHandlers();
  
  console.log('IPC handlers initialized');
}

// ===== EXPORTS =====
module.exports = {
  initializeIpcHandlers
}; 