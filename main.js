const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Initialize persistent storage
const store = new Store();

let mainWindow;

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
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a1a',
      symbolColor: '#ffffff'
    },
    show: false,
    backgroundColor: '#1a1a1a'
  });

  // Load the app
  mainWindow.loadFile('index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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
app.whenReady().then(() => {
  // Set Application User Model ID for Windows taskbar grouping and identification
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.notesapp.app');
  }
  
  createWindow();
  
  // Create application menu
  createMenu();

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
    const notes = store.get('notes', []);
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
    
    const existingIndex = notes.findIndex(n => n.id === noteId);
    if (existingIndex >= 0) {
      notes[existingIndex] = note;
    } else {
      notes.unshift(note);
    }
    
    store.set('notes', notes);
    return { success: true, note };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-notes', async () => {
  try {
    const notes = store.get('notes', []);
    return { success: true, notes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-note', async (event, noteId) => {
  try {
    const notes = store.get('notes', []);
    const filteredNotes = notes.filter(n => n.id !== noteId);
    store.set('notes', filteredNotes);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-note', async (event, note) => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Note',
      defaultPath: `${note.title}.txt`,
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'Markdown Files', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (filePath) {
      const fs = require('fs');
      fs.writeFileSync(filePath, note.content);
      return { success: true, filePath };
    }
    return { success: false, error: 'Export cancelled' };
  } catch (error) {
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

function createMenu() {
  const template = [
    {
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
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
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
    },
    {
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
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
} 