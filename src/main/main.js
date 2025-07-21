// ===== MAIN PROCESS - APP LIFECYCLE & WINDOW MANAGEMENT =====
// Handles Electron app lifecycle, window creation, and menu setup

const { app, BrowserWindow, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const storage = require('./storage');
const { initializeIpcHandlers } = require('./ipc-handlers');

// ===== GLOBAL VARIABLES =====
let mainWindow;

// ===== AUTO-UPDATER CONFIGURATION =====
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

// ===== SINGLE INSTANCE LOCK =====
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

// ===== WINDOW CREATION =====
function createWindow() {
  // Get saved window bounds or use defaults
  const windowBounds = storage.getWindowBounds();
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    x: windowBounds.x,
    y: windowBounds.y,
    minWidth: 600,  // Set minimum window size
    minHeight: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../../preload.js')
    },
    frame: false,
    transparent: true,
    titleBarStyle: 'customButtonsOnHover',
    show: false,
    backgroundColor: 'rgba(0,0,0,0)'
  });

  // Restore maximized state if it was maximized when closed
  if (windowBounds.isMaximized) {
    mainWindow.maximize();
  }

  // Load the app
  mainWindow.loadFile(path.join(__dirname, '../../index.html'));

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

  // Save window bounds when they change
  let saveWindowStateTimeout;
  const saveWindowState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    // Clear existing timeout to debounce rapid changes
    if (saveWindowStateTimeout) {
      clearTimeout(saveWindowStateTimeout);
    }
    
    // Debounce window state saving to avoid excessive writes
    saveWindowStateTimeout = setTimeout(() => {
      const bounds = mainWindow.getBounds();
      const isMaximized = mainWindow.isMaximized();
      
      storage.saveWindowBounds({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized: isMaximized
      });
    }, 500); // Wait 500ms after the last change
  };

  // Listen for window events to save state
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', saveWindowState);

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Save window state immediately before closing (no debounce)
  mainWindow.on('close', (event) => {
    if (saveWindowStateTimeout) {
      clearTimeout(saveWindowStateTimeout);
    }
    
    // Save immediately on close
    if (!mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      const isMaximized = mainWindow.isMaximized();
      
      storage.saveWindowBounds({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized: isMaximized
      });
    }
    
    mainWindow = null;
  });
}

// ===== MENU CREATION =====
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
          await storage.ensureNotesDirectory();
          shell.openPath(storage.getNotesDirectory());
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

// ===== APP LIFECYCLE =====
app.whenReady().then(async () => {
  // Set Application User Model ID for Windows taskbar grouping and identification
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.notesapp.app');
  }
  
  // Migrate existing notes to file-based storage
  await storage.migrateNotesToFiles();
  
  // Create window
  createWindow();
  
  // Initialize IPC handlers
  initializeIpcHandlers(mainWindow);
  
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