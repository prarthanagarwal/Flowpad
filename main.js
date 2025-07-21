const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const Store = require('electron-store');

// Initialize persistent storage with platform-specific configuration
const store = new Store({
  name: 'flowpad-data',
  cwd: process.platform === 'darwin' 
    ? path.join(require('os').homedir(), 'Library', 'Application Support', 'Flowpad')
    : undefined // Use default for Windows/Linux
});

let mainWindow;

// File-based storage configuration
const NOTES_DIR = path.join(os.homedir(), 'Documents', 'Flowpad');

// Utility functions for file-based storage
async function ensureNotesDirectory() {
  try {
    await fs.access(NOTES_DIR);
  } catch (error) {
    await fs.mkdir(NOTES_DIR, { recursive: true });
  }
}

function sanitizeFilename(title) {
  // Remove illegal filename characters and limit length
  return title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove illegal chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .substring(0, 20) // Limit to 20 characters max
    || 'Untitled Note';
}

function generateNoteFilename(note) {
  const createdDate = new Date(note.createdAt);
  const datePrefix = createdDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Simple numeric time format: HHMMSS
  const hours = createdDate.getHours().toString().padStart(2, '0');
  const minutes = createdDate.getMinutes().toString().padStart(2, '0');
  const seconds = createdDate.getSeconds().toString().padStart(2, '0');
  const timePrefix = `${hours}${minutes}${seconds}`;
  
  const sanitizedTitle = sanitizeFilename(note.title);
  return `${datePrefix}_${timePrefix}_${sanitizedTitle}.md`;
}

function createFrontmatter(note) {
  // Use the sanitized title in frontmatter, not the full title
  const sanitizedTitle = sanitizeFilename(note.title);
  
  // Format timestamps as readable date and time
  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = date.toTimeString().split(' ')[0]; // HH:MM:SS
    return `${dateStr} ${timeStr}`;
  };
  
  return `---
id: ${note.id}
title: "${sanitizedTitle.replace(/"/g, '\\"')}"
createdAt: ${formatDateTime(note.createdAt)}
updatedAt: ${formatDateTime(note.updatedAt)}
tags: [${note.tags.map(tag => `"${tag}"`).join(', ')}]
---

`;
}

function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return {
      metadata: {},
      content: content
    };
  }
  
  const frontmatterLines = match[1].split('\n');
  const metadata = {};
  
  frontmatterLines.forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > -1) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Parse different value types
      if (key === 'tags') {
        value = value.replace(/^\[|\]$/g, '').split(',').map(tag => tag.trim().replace(/^"|"$/g, ''));
      } else if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\"/g, '"');
      }
      
      metadata[key] = value;
    }
  });
  
  return {
    metadata,
    content: match[2]
  };
}

async function convertHtmlToMarkdown(htmlContent) {
  // Simple HTML to Markdown conversion
  return htmlContent
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<b>(.*?)<\/b>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<i>(.*?)<\/i>/g, '*$1*')
    .replace(/<u>(.*?)<\/u>/g, '__$1__')
    .replace(/<s>(.*?)<\/s>/g, '~~$1~~')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<div>/g, '\n')
    .replace(/<\/div>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

async function convertMarkdownToHtml(markdownContent) {
  // Simple Markdown to HTML conversion for display
  return markdownContent
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<u>$1</u>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// Configure auto-updater
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'PrarthanAgarwal',
  repo: 'Flowpad'
});

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { type: 'checking' });
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { 
      type: 'available', 
      version: info.version,
      releaseDate: info.releaseDate,
      downloadSize: info.files?.[0]?.size || 0
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { type: 'not-available' });
  }
});

autoUpdater.on('error', (err) => {
  console.error('Auto-updater error:', err);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { 
      type: 'error', 
      message: err.message 
    });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log('Download progress:', progressObj.percent);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { 
      type: 'download-progress', 
      percent: progressObj.percent,
      bytesPerSecond: progressObj.bytesPerSecond,
      total: progressObj.total,
      transferred: progressObj.transferred
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { 
      type: 'downloaded', 
      version: info.version 
    });
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: false,
    transparent: true,
    titleBarStyle: 'customButtonsOnHover',
    show: false,
    backgroundColor: 'rgba(0,0,0,0)'
  });

  // Load the app
  mainWindow.loadFile('index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Fallback: Show window after a timeout if ready-to-show doesn't fire
  const showTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('Fallback: Showing window after timeout');
      mainWindow.show();
      mainWindow.focus();
    }
  }, 3000); // 3 second fallback

  // Clear timeout if window shows normally
  mainWindow.once('show', () => {
    clearTimeout(showTimeout);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Ensure app quits when window is closed on Windows/Linux
  mainWindow.on('close', (event) => {
    // Allow normal close behavior
    mainWindow = null;
  });
}

// App event listeners
// Migration function to convert JSON notes to markdown files
async function migrateNotesToFiles() {
  try {
    const existingNotes = store.get('notes', []);
    
    if (existingNotes.length > 0) {
      console.log(`Migrating ${existingNotes.length} notes to file-based storage...`);
      await ensureNotesDirectory();
      
      for (const note of existingNotes) {
        try {
          // Convert HTML content to Markdown
          const markdownContent = await convertHtmlToMarkdown(note.content);
          
          // Create file content with frontmatter
          const fileContent = createFrontmatter(note) + markdownContent;
          
          // Generate filename
          const filename = generateNoteFilename(note);
          const filepath = path.join(NOTES_DIR, filename);
          
          // Write the note file
          await fs.writeFile(filepath, fileContent, 'utf8');
          console.log(`Migrated note: ${filename}`);
        } catch (noteError) {
          console.error(`Error migrating note ${note.id}:`, noteError);
        }
      }
      
      // Clear the old notes from electron-store after successful migration
      store.set('notes', []);
      console.log('Migration completed successfully!');
    }
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

app.whenReady().then(async () => {
  // Set Application User Model ID for Windows taskbar grouping and identification
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.notesapp.app');
  }
  
  // Migrate existing notes to file-based storage
  await migrateNotesToFiles();
  
  createWindow();
  
  // Create application menu
  createMenu();
  
  // Check for updates after a delay to ensure app is fully loaded
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 30000); // Check after 30 seconds

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Always quit when all windows are closed (including macOS)
  app.quit();
});

app.on('before-quit', () => {
  // Clean up any remaining processes
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
  }
});

// IPC Handlers
ipcMain.handle('save-note', async (event, noteData) => {
  try {
    await ensureNotesDirectory();
    
    const noteId = noteData.id || Date.now().toString();
    const timestamp = new Date().toISOString();
    
    const note = {
      id: noteId,
      title: noteData.title || 'Untitled Note',
      content: noteData.content,
      createdAt: noteData.createdAt || timestamp,
      updatedAt: timestamp,
      tags: noteData.tags || []
    };
    
    // Convert HTML content to Markdown for storage
    const markdownContent = await convertHtmlToMarkdown(note.content);
    
    // Create file content with frontmatter
    const fileContent = createFrontmatter(note) + markdownContent;
    
    // Generate filename
    const filename = generateNoteFilename(note);
    const filepath = path.join(NOTES_DIR, filename);
    
    // Check if this is an update to existing note
    const files = await fs.readdir(NOTES_DIR);
    const existingFile = files.find(file => {
      if (file.endsWith('.md')) {
        try {
          const content = fsSync.readFileSync(path.join(NOTES_DIR, file), 'utf8');
          const { metadata } = parseFrontmatter(content);
          return metadata.id === noteId;
        } catch (error) {
          return false;
        }
      }
      return false;
    });
    
    // If updating existing note, remove old file
    if (existingFile) {
      const oldFilePath = path.join(NOTES_DIR, existingFile);
      await fs.unlink(oldFilePath);
    }
    
    // Write the new/updated note
    await fs.writeFile(filepath, fileContent, 'utf8');
    
    return { success: true, note };
  } catch (error) {
    console.error('Error saving note:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-notes', async () => {
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
            title: metadata.title || 'Untitled Note',
            content: htmlContent,
            createdAt: metadata.createdAt || new Date().toISOString(),
            updatedAt: metadata.updatedAt || new Date().toISOString(),
            tags: metadata.tags || []
          };
          
          notes.push(note);
        } catch (fileError) {
          console.error(`Error reading note file ${file}:`, fileError);
        }
      }
    }
    
    // Sort notes by updatedAt (newest first)
    notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    return { success: true, notes };
  } catch (error) {
    console.error('Error loading notes:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-note', async (event, noteId) => {
  try {
    await ensureNotesDirectory();
    
    const files = await fs.readdir(NOTES_DIR);
    const targetFile = files.find(file => {
      if (file.endsWith('.md')) {
        try {
          const content = fsSync.readFileSync(path.join(NOTES_DIR, file), 'utf8');
          const { metadata } = parseFrontmatter(content);
          return metadata.id === noteId;
        } catch (error) {
          return false;
        }
      }
      return false;
    });
    
    if (targetFile) {
      const filepath = path.join(NOTES_DIR, targetFile);
      await fs.unlink(filepath);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting note:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-note', async (event, note) => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
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

ipcMain.handle('get-app-settings', async () => {
  return store.get('settings', {
    fontSize: 16,
    fontFamily: 'Inter',
    theme: 'dark',
    autoSave: true,
    wordWrap: true
  });
});

ipcMain.handle('save-app-settings', async (event, settings) => {
  try {
    store.set('settings', settings);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-title-bar-theme', async (event, theme) => {
  try {
    if (mainWindow) {
      const titleBarColors = theme === 'light' 
        ? { color: '#fefae0', symbolColor: '#2d2d2d' }
        : { color: '#1a1a1a', symbolColor: '#ffffff' };
      
      mainWindow.setTitleBarOverlay(titleBarColors);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('close-app', async () => {
  try {
    app.quit();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

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

// Auto-updater IPC handlers
ipcMain.handle('check-for-updates', async () => {
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('quit-and-install', async () => {
  try {
    autoUpdater.quitAndInstall(true, true);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-notes-folder', async () => {
  try {
    await ensureNotesDirectory();
    const { shell } = require('electron');
    await shell.openPath(NOTES_DIR);
    return { success: true };
  } catch (error) {
    console.error('Error opening notes folder:', error);
    return { success: false, error: error.message };
  }
});

function createMenu() {
  const template = [];
  
  // macOS app menu
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => {
            mainWindow.webContents.send('check-for-updates');
          }
        },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }
  
  template.push({
    label: 'File',
    submenu: [
      {
        label: 'New Note',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          mainWindow.webContents.send('new-note');
        }
      },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: () => {
          mainWindow.webContents.send('save-note');
        }
      },
      { type: 'separator' },
      {
        label: 'Open Notes Folder',
        click: async () => {
          const { shell } = require('electron');
          await ensureNotesDirectory();
          shell.openPath(NOTES_DIR);
        }
      },
      { type: 'separator' },
      ...(process.platform !== 'darwin' ? [{
        label: 'Exit',
        accelerator: 'Ctrl+Q',
        click: () => {
          app.quit();
        }
      }] : [])
    ]
  });
  
  template.push({
    label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
  });
  
  template.push({
    label: 'View',
      submenu: [
        {
          label: 'Toggle History',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            mainWindow.webContents.send('toggle-history');
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            mainWindow.webContents.send('toggle-fullscreen');
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
  });

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
} 