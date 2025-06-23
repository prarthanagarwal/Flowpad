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
  
  // App control
  closeApp: () => ipcRenderer.invoke('close-app'),
  
  // Menu event listeners
  onNewNote: (callback) => ipcRenderer.on('new-note', callback),
  onSaveNote: (callback) => ipcRenderer.on('save-note', callback),
  onToggleHistory: (callback) => ipcRenderer.on('toggle-history', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
}); 