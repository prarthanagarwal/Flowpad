const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Note operations
  saveNote: (noteData) => ipcRenderer.invoke('save-note', noteData),
  loadNotes: () => ipcRenderer.invoke('load-notes'),
  deleteNote: (noteId) => ipcRenderer.invoke('delete-note', noteId),
  exportNote: (note) => ipcRenderer.invoke('export-note', note),
  
  // Folder operations
  getFolders: () => ipcRenderer.invoke('get-folders'),
  saveFolder: (folderData) => ipcRenderer.invoke('save-folder', folderData),
  deleteFolder: (folderId) => ipcRenderer.invoke('delete-folder', folderId),
  
  // Migration
  triggerMigration: () => ipcRenderer.invoke('trigger-migration'),
  
  // Settings
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
  updateTitleBarTheme: (theme) => ipcRenderer.invoke('update-title-bar-theme', theme),

  // AI Settings
  getAiSettings: () => ipcRenderer.invoke('get-ai-settings'),
  saveAiSettings: (aiSettings) => ipcRenderer.invoke('save-ai-settings', aiSettings),
  initializeAiService: (apiKey) => ipcRenderer.invoke('initialize-ai-service', apiKey),
  getAiStatus: () => ipcRenderer.invoke('get-ai-status'),
  generateAiResponse: (data) => ipcRenderer.invoke('generate-ai-response', data),
  suggestContent: (data) => ipcRenderer.invoke('suggest-content', data),
  
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
  
  // File operations
  openNotesFolder: () => ipcRenderer.invoke('open-notes-folder'),
  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
}); 