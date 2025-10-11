// ===== IPC HANDLERS MODULE =====
// Handles all communication between main and renderer processes

const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const storage = require('./storage');
const { aiService } = require('./ai-service');
const { sanitizeFilename, createFrontmatter } = require('../shared/utils');

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
        defaultPath: `${sanitizeFilename(note.title)}.html`,
        filters: [
          { name: 'HTML Files', extensions: ['html'] },
          { name: 'Markdown Files', extensions: ['md'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (filePath) {
        let exportContent;
        
        if (filePath.endsWith('.md')) {
          // Export as HTML with frontmatter (preserves all formatting)
          exportContent = createFrontmatter(note) + note.content;
        } else if (filePath.endsWith('.html')) {
          // Export as pure HTML
          exportContent = note.content;
        } else {
          // Export as plain text (strip HTML tags)
          exportContent = note.content.replace(/<[^>]*>/g, '');
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

  // Get AI settings
  ipcMain.handle('get-ai-settings', async () => {
    return storage.getAISettings();
  });

  // Save AI settings
  ipcMain.handle('save-ai-settings', async (event, aiSettings) => {
    const result = storage.saveAISettings(aiSettings);

    // Re-initialize AI service if API key changed
    if (result.success && aiSettings.aiApiKey) {
      const initResult = aiService.initialize(aiSettings.aiApiKey);
      if (!initResult.success) {
        console.error('Failed to initialize AI service:', initResult.error);
      }
    }

    return result;
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



// ===== AI HANDLERS =====
function setupAIHandlers() {
  // Generate AI response
  ipcMain.handle('generate-ai-response', async (event, { prompt, context }) => {
    try {
      const result = await aiService.generateResponse(prompt, context);
      return result;
    } catch (error) {
      console.error('Error in AI response generation:', error);
      return { success: false, error: error.message };
    }
  });

  // Generate content suggestions
  ipcMain.handle('suggest-content', async (event, { content, type }) => {
    try {
      const result = await aiService.suggestContent(content, type);
      return result;
    } catch (error) {
      console.error('Error in content suggestion:', error);
      return { success: false, error: error.message };
    }
  });

  // Check AI service status
  ipcMain.handle('get-ai-status', async () => {
    try {
      return {
        success: true,
        status: aiService.getStatus()
      };
    } catch (error) {
      console.error('Error getting AI status:', error);
      return { success: false, error: error.message };
    }
  });

  // Initialize AI service
  ipcMain.handle('initialize-ai-service', async (event, apiKey) => {
    try {
      const result = aiService.initialize(apiKey);
      return result;
    } catch (error) {
      console.error('Error initializing AI service:', error);
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

  // Open external link in system browser
  ipcMain.handle('open-external-link', async (event, url) => {
    try {
      await shell.openExternal(url);
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
  setupAIHandlers();
  setupWindowHandlers(mainWindow);
  setupFileSystemHandlers();

  console.log('IPC handlers initialized');
}

// ===== EXPORTS =====
module.exports = {
  initializeIpcHandlers
}; 