// ===== MAIN PROCESS - APP LIFECYCLE & WINDOW MANAGEMENT =====
// Handles Electron app lifecycle, window creation, and menu setup

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const storage = require('./storage');
const { initializeIpcHandlers } = require('./ipc-handlers');

// ===== SQUIRREL WINDOWS STARTUP HANDLING =====
// Handle Squirrel events for Windows installation
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Handle Squirrel events manually for better control
const handleSquirrelEvent = () => {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require('child_process');
  const fs = require('fs');
  const os = require('os');
  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function(command, args) {
    let spawnedProcess;
    try {
      spawnedProcess = ChildProcess.spawn(command, args, { detached: true });
    } catch (error) {
      console.log('Error spawning process:', error);
    }
    return spawnedProcess;
  };

  const spawnUpdate = function(args) {
    return spawn(updateDotExe, args);
  };

  // Create custom shortcuts without subfolder
  const createCustomShortcuts = () => {
    try {
      // shell is already imported at the top of the file
      
      // Create desktop shortcut
      const desktopPath = path.join(os.homedir(), 'Desktop');
      const startMenuPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
      
      // Use Windows scripting to create shortcuts without company folder
      const createShortcut = (targetPath, shortcutName) => {
        const vbsScript = `
Set WshShell = CreateObject("WScript.Shell")
Set Shortcut = WshShell.CreateShortcut("${path.join(targetPath, shortcutName + '.lnk')}")
Shortcut.TargetPath = "${process.execPath}"
Shortcut.WorkingDirectory = "${appFolder}"
Shortcut.IconLocation = "${process.execPath},0"
Shortcut.Description = "a minimal notepad for your thoughts to flow"
Shortcut.Save
`;
        
        const vbsFile = path.join(os.tmpdir(), 'create_shortcut.vbs');
        fs.writeFileSync(vbsFile, vbsScript);
        
        spawn('cscript', ['/nologo', vbsFile]);
        
        // Clean up VBS file after a delay
        setTimeout(() => {
          try {
            fs.unlinkSync(vbsFile);
          } catch (e) {
            // Ignore cleanup errors
          }
        }, 2000);
      };

      // Create desktop shortcut
      createShortcut(desktopPath, 'Flowpad');
      
      // Create Start Menu shortcut directly in Programs folder
      createShortcut(startMenuPath, 'Flowpad');
      
    } catch (error) {
      console.log('Error creating custom shortcuts:', error);
      // Fallback to default Squirrel behavior
      spawnUpdate(['--createShortcut', exeName]);
    }
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Create custom shortcuts without company subfolder
      createCustomShortcuts();
      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      // Remove shortcuts
      try {
        const desktopShortcut = path.join(os.homedir(), 'Desktop', 'Flowpad.lnk');
        const startMenuShortcut = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Flowpad.lnk');
        
        if (fs.existsSync(desktopShortcut)) {
          fs.unlinkSync(desktopShortcut);
        }
        if (fs.existsSync(startMenuShortcut)) {
          fs.unlinkSync(startMenuShortcut);
        }
      } catch (error) {
        console.log('Error removing shortcuts:', error);
      }
      
      // Also remove default Squirrel shortcuts
      spawnUpdate(['--removeShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before we update to the new version
      app.quit();
      return true;
  }

  return false;
};

// Handle Squirrel events on Windows
if (process.platform === 'win32' && handleSquirrelEvent()) {
  // Squirrel event handled, exit early
  return;
}

// ===== GLOBAL VARIABLES =====
let mainWindow;

// ===== AUTO-UPDATER CONFIGURATION =====
// Using update-electron-app for simple, automatic updates
if (app.isPackaged) {
  const { updateElectronApp } = require('update-electron-app');
  updateElectronApp({
    repo: 'PrarthanAgarwal/Flowpad',
    updateInterval: '1 hour',
    logger: console
  });
}

// ===== MULTIPLE INSTANCE SUPPORT =====
// Removed single instance lock to allow multiple windows for snap layouts
// Each instance will share the same storage but operate independently

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
    app.setAppUserModelId('com.flowpad.app');
  }
  
  // Migrate existing notes to file-based storage
  await storage.migrateNotesToFiles();
  
  // Create window
  createWindow();
  
  // Initialize IPC handlers
  initializeIpcHandlers(mainWindow);
  
  // Create application menu
  createMenu();
  


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Each instance is independent - quit when its window closes
  app.quit();
});

app.on('before-quit', () => {
  // Clean up any remaining processes
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
  }
}); 