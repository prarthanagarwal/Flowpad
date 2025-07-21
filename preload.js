const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Note operations
  saveNote: (noteData) => ipcRenderer.invoke('save-note', noteData),
  loadNotes: () => ipcRenderer.invoke('load-notes'),
  deleteNote: (noteId) => ipcRenderer.invoke('delete-note', noteId),
  exportNote: (note) => ipcRenderer.invoke('export-note', note),
  
  // Settings
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
  updateTitleBarTheme: (theme) => ipcRenderer.invoke('update-title-bar-theme', theme),
  
  // Window bounds
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  saveWindowBounds: (bounds) => ipcRenderer.invoke('save-window-bounds', bounds),
  
  // App control
  closeApp: () => ipcRenderer.invoke('close-app'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  
  // Menu event listeners
  onNewNote: (callback) => ipcRenderer.on('new-note', callback),
  onSaveNote: (callback) => ipcRenderer.on('save-note', callback),
  onToggleHistory: (callback) => ipcRenderer.on('toggle-history', callback),
  onToggleFullscreen: (callback) => ipcRenderer.on('toggle-fullscreen', callback),
  
  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', callback),
  onCheckForUpdates: (callback) => ipcRenderer.on('check-for-updates', callback),
  
  // File operations
  openNotesFolder: () => ipcRenderer.invoke('open-notes-folder'),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
}); 