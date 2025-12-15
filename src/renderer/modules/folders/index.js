// ===== FOLDER MANAGEMENT MODULE =====
// Handles folder CRUD operations and folder tabs

import * as state from '../../state.js';
import { startFolderRename } from '../ui/contextMenu.js';

// ===== FOLDER CRUD =====
export async function createFolder(name) {
    if (!name || !name.trim()) return null;
    
    const folder = {
        id: Date.now().toString(),
        name: name.trim(),
        createdAt: new Date().toISOString()
    };
    
    try {
        await window.electronAPI.saveFolder(folder);
        state.allFolders.push(folder);
        return folder;
    } catch (error) {
        console.error('Error creating folder:', error);
        throw error;
    }
}

export async function renameFolder(folderId, newName) {
    if (!newName || !newName.trim()) return null;
    
    const folder = state.allFolders.find(f => f.id === folderId);
    if (!folder) return null;
    
    folder.name = newName.trim();
    
    try {
        await window.electronAPI.saveFolder(folder);
        return folder;
    } catch (error) {
        console.error('Error renaming folder:', error);
        throw error;
    }
}

export async function deleteFolder(folderId) {
    const folder = state.allFolders.find(f => f.id === folderId);
    if (!folder) return false;
    
    try {
        await window.electronAPI.deleteFolder(folderId);
        
        // Remove from state
        const index = state.allFolders.findIndex(f => f.id === folderId);
        if (index > -1) {
            state.allFolders.splice(index, 1);
        }
        
        // Update notes that were in this folder
        state.allNotes.forEach(note => {
            if (note.folder === folderId) {
                note.folder = null;
                note.folderName = null;
            }
        });
        
        // If we were viewing the deleted folder, switch to All
        if (state.currentFolder === folderId) {
            state.setCurrentFolder('all');
        }
        
        return true;
    } catch (error) {
        console.error('Error deleting folder:', error);
        throw error;
    }
}

export async function moveNoteToFolder(note, folderId) {
    note.folder = folderId;
    
    // Find folder name if moving to a folder
    if (folderId) {
        const folder = state.allFolders.find(f => f.id === folderId);
        note.folderName = folder ? folder.name : null;
    } else {
        note.folderName = null;
    }
    
    // Save the note with new folder
    await window.electronAPI.saveNote(note);
    
    // Update cache - pass note ID and the updates
    state.updateNoteInCache(note.id, { folder: note.folder, folderName: note.folderName });
}

// ===== FOLDER TABS UI =====
let onFolderChange = null;
let onFolderContextMenu = null;

export function setFolderChangeCallback(callback) {
    onFolderChange = callback;
}

export function setFolderContextMenuCallback(callback) {
    onFolderContextMenu = callback;
}

export function renderFolderTabs() {
    const folderTabs = document.getElementById('folderTabs');
    if (!folderTabs) return;
    
    // Clear and rebuild tabs
    folderTabs.innerHTML = '';
    
    // Add "All" tab
    const allTab = document.createElement('button');
    allTab.className = 'folder-tab' + (state.currentFolder === 'all' ? ' active' : '');
    allTab.dataset.folder = 'all';
    allTab.textContent = 'All';
    folderTabs.appendChild(allTab);
    
    // Add folder tabs
    state.allFolders.forEach(folder => {
        const tab = document.createElement('button');
        tab.className = 'folder-tab' + (state.currentFolder === folder.id ? ' active' : '');
        tab.dataset.folder = folder.id;
        tab.textContent = folder.name;
        folderTabs.appendChild(tab);
    });
    
    // Attach event listeners
    setupFolderTabListeners();
}

function setupFolderTabListeners() {
    document.querySelectorAll('.folder-tab').forEach(tab => {
        // Left click to select folder
        tab.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.folder-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Set current folder
            state.setCurrentFolder(tab.dataset.folder);
            
            // Notify callback
            if (onFolderChange) {
                onFolderChange();
            }
        });
        
        // Right click for context menu (except "All" tab)
        tab.addEventListener('contextmenu', (e) => {
            if (onFolderContextMenu) {
                onFolderContextMenu(e, tab.dataset.folder);
            }
        });
    });
}

// Generate a unique folder name
function generateFolderName() {
    const baseName = 'New Folder';
    const existingNames = state.allFolders.map(f => f.name);
    
    if (!existingNames.includes(baseName)) {
        return baseName;
    }
    
    let counter = 1;
    while (existingNames.includes(`${baseName} ${counter}`)) {
        counter++;
    }
    return `${baseName} ${counter}`;
}

// ===== INITIALIZATION =====
export function initFolders(folderChangeCallback, folderContextMenuCallback) {
    setFolderChangeCallback(folderChangeCallback);
    setFolderContextMenuCallback(folderContextMenuCallback);
    
    // New folder button - creates folder and triggers inline rename
    const newFolderBtn = document.getElementById('newFolderBtn');
    
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            try {
                const folderName = generateFolderName();
                const folder = await createFolder(folderName);
                renderFolderTabs();
                
                // Trigger inline rename so user can set the name
                if (folder && folder.id) {
                    setTimeout(() => {
                        startFolderRename(folder.id, true);
                    }, 50);
                }
            } catch (error) {
                console.error('Error creating folder:', error);
            }
        });
    }
    
    // Initial render
    renderFolderTabs();
}
