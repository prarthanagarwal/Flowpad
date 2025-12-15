// ===== CONTEXT MENU MANAGEMENT =====
// Handles all context menus: editor, note, and folder

import { applyTextStyle } from '../editor/formatting.js';
import * as state from '../../state.js';
import { moveNoteToFolder, renameFolder, deleteFolder, renderFolderTabs } from '../folders/index.js';

// ===== UTILITY: Position menu within screen bounds =====
function positionMenuWithinBounds(menu, x, y) {
    // Show menu first to get dimensions
    menu.style.display = 'block';
    menu.style.visibility = 'hidden';
    
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let left = x;
    let top = y;
    
    // Adjust if menu would go off right edge
    if (left + menuWidth > windowWidth - 10) {
        left = windowWidth - menuWidth - 10;
    }
    
    // Adjust if menu would go off bottom edge
    if (top + menuHeight > windowHeight - 10) {
        top = windowHeight - menuHeight - 10;
    }
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.visibility = 'visible';
}

// ===== EDITOR CONTEXT MENU =====

// Show editor context menu
export function showEditorContextMenu(e) {
    e.preventDefault();

    const contextMenu = document.getElementById('editorContextMenu');
    const selection = window.getSelection();

    // Position the menu at cursor
    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.style.display = 'block';

    // Check if there's a selection to determine which menu items to show
    const hasSelection = selection.rangeCount > 0 && !selection.isCollapsed;

    // Update menu items based on selection state
    const copyItem = contextMenu.querySelector('[data-action="copy"]');
    const cutItem = contextMenu.querySelector('[data-action="cut"]');
    const googleSearchItem = contextMenu.querySelector('[data-action="google-search"]');

    if (hasSelection) {
        if (copyItem) {
            copyItem.style.opacity = '1';
            copyItem.style.pointerEvents = 'auto';
        }
        if (cutItem) {
            cutItem.style.opacity = '1';
            cutItem.style.pointerEvents = 'auto';
        }
        if (googleSearchItem) {
            googleSearchItem.style.opacity = '1';
            googleSearchItem.style.pointerEvents = 'auto';
        }
    } else {
        if (copyItem) {
            copyItem.style.opacity = '0.5';
            copyItem.style.pointerEvents = 'none';
        }
        if (cutItem) {
            cutItem.style.opacity = '0.5';
            cutItem.style.pointerEvents = 'none';
        }
        if (googleSearchItem) {
            googleSearchItem.style.opacity = '0.5';
            googleSearchItem.style.pointerEvents = 'none';
        }
    }

    // Close menu when clicking elsewhere
    const closeMenu = (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
            document.removeEventListener('click', closeMenu);
        }
    };

    // Add event listener after a small delay to prevent immediate closing
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 10);
}

// Hide context menu
export function hideContextMenu() {
    const contextMenu = document.getElementById('editorContextMenu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

// Clipboard operations
export async function handleCopy(editor) {
    try {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const selectedText = selection.toString();
            if (selectedText) {
                await navigator.clipboard.writeText(selectedText);
                console.log('Text copied successfully');
            }
        }
    } catch (err) {
        console.error('Copy failed:', err);
        try {
            document.execCommand('copy');
        } catch (execErr) {
            console.error('ExecCommand copy also failed:', execErr);
            alert('Copy functionality is not available. Please use Ctrl+C instead.');
        }
    }
}

export async function handleCut(editor) {
    try {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const selectedText = selection.toString();
            if (selectedText) {
                await navigator.clipboard.writeText(selectedText);
                selection.deleteFromDocument();
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('Text cut successfully');
            }
        }
    } catch (err) {
        console.error('Cut failed:', err);
        try {
            document.execCommand('cut');
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (execErr) {
            console.error('ExecCommand cut also failed:', execErr);
            alert('Cut functionality is not available. Please use Ctrl+X instead.');
        }
    }
}

export async function handleContextMenuPaste(editor) {
    try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText) {
            const selection = window.getSelection();

            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(clipboardText));
                selection.collapseToEnd();
            } else {
                editor.innerHTML += clipboardText.replace(/\n/g, '<br>');
            }

            editor.dispatchEvent(new Event('input', { bubbles: true }));
            editor.focus();
            console.log('Text pasted successfully');
        }
    } catch (err) {
        console.error('Modern paste failed, trying fallback:', err);
        try {
            document.execCommand('paste');
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            editor.focus();
        } catch (execErr) {
            console.error('ExecCommand paste also failed:', execErr);
            alert('Paste functionality is not available. Please use Ctrl+V instead.');
        }
    }
}

export function handleSelectAll(editor) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    editor.focus();
}

// ===== NOTE CONTEXT MENU =====
let contextMenuNote = null;
let noteDeleteCallback = null;
let noteListRenderCallback = null;

export function setNoteContextCallbacks(deleteCallback, renderCallback) {
    noteDeleteCallback = deleteCallback;
    noteListRenderCallback = renderCallback;
}

export function showNoteContextMenu(event, note) {
    event.preventDefault();
    contextMenuNote = note;
    
    const contextMenu = document.getElementById('noteContextMenu');
    const folderSubmenu = document.getElementById('folderSubmenu');
    
    // Position menu within screen bounds
    positionMenuWithinBounds(contextMenu, event.clientX, event.clientY);
    
    // Populate folder submenu - only show existing folders
    folderSubmenu.innerHTML = '';
    
    if (state.allFolders.length > 0) {
        state.allFolders.forEach(folder => {
            const folderItem = document.createElement('div');
            folderItem.className = 'context-menu-item';
            folderItem.dataset.folderId = folder.id;
            folderItem.innerHTML = `<i class="ph ph-folder-simple" style="font-size: 12px;"></i> ${folder.name}`;
            folderItem.addEventListener('click', () => handleMoveNote(note, folder.id));
            folderSubmenu.appendChild(folderItem);
        });
    } else {
        // Show "No folders" message if no folders exist
        const noFoldersItem = document.createElement('div');
        noFoldersItem.className = 'context-menu-item disabled';
        noFoldersItem.innerHTML = '<i class="ph ph-folder-simple" style="font-size: 12px;"></i> No folders';
        noFoldersItem.style.opacity = '0.5';
        noFoldersItem.style.pointerEvents = 'none';
        folderSubmenu.appendChild(noFoldersItem);
    }
    
    // Close menu when clicking elsewhere
    const closeMenu = (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
            contextMenuNote = null;
            document.removeEventListener('click', closeMenu);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 10);
}

async function handleMoveNote(note, folderId) {
    await moveNoteToFolder(note, folderId);
    
    if (noteListRenderCallback) {
        noteListRenderCallback();
    }
    
    // Hide context menu
    document.getElementById('noteContextMenu').style.display = 'none';
    contextMenuNote = null;
}

export function hideNoteContextMenu() {
    const contextMenu = document.getElementById('noteContextMenu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
    contextMenuNote = null;
}

// ===== FOLDER CONTEXT MENU =====
let contextMenuFolder = null;

export function showFolderContextMenu(event, folderId) {
    event.preventDefault();
    
    // Don't show context menu for "All" tab
    if (folderId === 'all') return;
    
    contextMenuFolder = state.allFolders.find(f => f.id === folderId);
    if (!contextMenuFolder) return;
    
    const contextMenu = document.getElementById('folderContextMenu');
    
    // Position menu within screen bounds
    positionMenuWithinBounds(contextMenu, event.clientX, event.clientY);
    
    // Close menu when clicking elsewhere
    const closeMenu = (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
            contextMenuFolder = null;
            document.removeEventListener('click', closeMenu);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 10);
}

// Start inline rename for a folder tab
export function startFolderRename(folderId, isNewFolder = false) {
    const folder = state.allFolders.find(f => f.id === folderId);
    if (!folder) return;
    
    const folderTab = document.querySelector(`.folder-tab[data-folder="${folderId}"]`);
    if (!folderTab) return;
    
    const originalName = folder.name;
    
    // Create clean inline input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalName;
    input.className = 'folder-rename-input';
    input.style.cssText = `
        background: transparent;
        border: none;
        color: inherit;
        font-size: inherit;
        font-family: inherit;
        padding: 0;
        margin: 0;
        width: ${Math.max(50, originalName.length * 7 + 10)}px;
        outline: none;
        text-align: center;
    `;
    
    // Replace tab content with input
    folderTab.textContent = '';
    folderTab.appendChild(input);
    input.focus();
    input.select();
    
    let saved = false;
    
    // Handle save
    const saveRename = async () => {
        if (saved) return;
        saved = true;
        
        const newName = input.value.trim();
        
        if (newName && newName !== originalName) {
            try {
                await renameFolder(folderId, newName);
                renderFolderTabs();
                if (noteListRenderCallback) {
                    noteListRenderCallback();
                }
            } catch (error) {
                console.error('Failed to rename folder:', error);
                folderTab.textContent = originalName;
            }
        } else if (isNewFolder && !newName) {
            // If new folder with empty name, delete it
            try {
                await deleteFolder(folderId);
                renderFolderTabs();
            } catch (error) {
                console.error('Failed to delete empty folder:', error);
            }
        } else {
            folderTab.textContent = originalName;
        }
    };
    
    // Handle cancel
    const cancelRename = async () => {
        if (saved) return;
        saved = true;
        
        if (isNewFolder) {
            // Cancel on new folder = delete it
            try {
                await deleteFolder(folderId);
                renderFolderTabs();
            } catch (error) {
                console.error('Failed to delete cancelled folder:', error);
            }
        } else {
            folderTab.textContent = originalName;
        }
    };
    
    // Adjust input width as user types
    input.addEventListener('input', () => {
        input.style.width = `${Math.max(50, input.value.length * 7 + 10)}px`;
    });
    
    input.addEventListener('blur', saveRename);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            input.removeEventListener('blur', saveRename);
            cancelRename();
        }
    });
}

async function handleRenameFolder() {
    if (!contextMenuFolder) return;
    
    const folderId = contextMenuFolder.id;
    document.getElementById('folderContextMenu').style.display = 'none';
    contextMenuFolder = null;
    
    startFolderRename(folderId, false);
}

async function handleDeleteFolder() {
    if (!contextMenuFolder) return;
    
    const folderToDelete = contextMenuFolder;
    document.getElementById('folderContextMenu').style.display = 'none';
    
    // Show confirmation modal
    showDeleteConfirmation(
        `Delete "${folderToDelete.name}"?`,
        'Notes in this folder will be moved to All.',
        async () => {
            try {
                await deleteFolder(folderToDelete.id);
                renderFolderTabs();
                if (noteListRenderCallback) {
                    noteListRenderCallback();
                }
            } catch (error) {
                console.error('Failed to delete folder:', error);
            }
        }
    );
    
    contextMenuFolder = null;
}

// Simple confirmation modal
function showDeleteConfirmation(title, message, onConfirm) {
    const isLightMode = document.body.classList.contains('light-mode');
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'delete-confirm-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, ${isLightMode ? '0.3' : '0.5'});
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20000;
    `;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'delete-confirm-modal';
    modal.style.cssText = `
        background: ${isLightMode ? '#fefae0' : '#1a1a1a'};
        border: 1px solid ${isLightMode ? '#d0d0d0' : '#333'};
        border-radius: 12px;
        padding: 20px;
        max-width: 280px;
        text-align: center;
        box-shadow: 0 8px 32px rgba(0, 0, 0, ${isLightMode ? '0.15' : '0.4'});
    `;
    
    modal.innerHTML = `
        <div style="font-size: 14px; font-weight: 500; color: ${isLightMode ? '#2d2d2d' : '#fff'}; margin-bottom: 8px;">${title}</div>
        <div style="font-size: 12px; color: ${isLightMode ? '#666' : '#888'}; margin-bottom: 20px;">${message}</div>
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button class="confirm-cancel-btn" style="
                padding: 8px 16px;
                border-radius: 8px;
                border: 1px solid ${isLightMode ? '#ccc' : '#444'};
                background: transparent;
                color: ${isLightMode ? '#666' : '#ccc'};
                cursor: pointer;
                font-size: 12px;
            ">Cancel</button>
            <button class="confirm-delete-btn" style="
                padding: 8px 16px;
                border-radius: 8px;
                border: none;
                background: #e53935;
                color: #fff;
                cursor: pointer;
                font-size: 12px;
            ">Delete</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Focus delete button
    modal.querySelector('.confirm-delete-btn').focus();
    
    // Handle cancel
    const closeModal = () => {
        overlay.remove();
    };
    
    modal.querySelector('.confirm-cancel-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    
    // Handle confirm
    modal.querySelector('.confirm-delete-btn').addEventListener('click', () => {
        closeModal();
        onConfirm();
    });
    
    // Handle keyboard
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'Enter') {
            closeModal();
            onConfirm();
        }
    });
}

// ===== INITIALIZATION =====
export function initContextMenu(executeCommand) {
    const editor = document.getElementById('editor');
    
    // Add editor context menu event listener
    if (editor) {
        editor.addEventListener('contextmenu', showEditorContextMenu);
    }
    
    // Handle all context menu actions via event delegation
    document.addEventListener('click', async (e) => {
        const menuItem = e.target.closest('.context-menu-item');
        if (!menuItem) return;
        
        const action = menuItem.dataset.action;
        const editor = document.getElementById('editor');

        switch (action) {
            // Editor context menu actions
            case 'copy':
                await handleCopy(editor);
                hideContextMenu();
                break;
            case 'cut':
                await handleCut(editor);
                hideContextMenu();
                break;
            case 'paste':
                await handleContextMenuPaste(editor);
                hideContextMenu();
                break;
            case 'select-all':
                handleSelectAll(editor);
                hideContextMenu();
                break;
            case 'bold':
                executeCommand('bold');
                hideContextMenu();
                break;
            case 'italic':
                executeCommand('italic');
                hideContextMenu();
                break;
            case 'underline':
                executeCommand('underline');
                hideContextMenu();
                break;
            case 'strikethrough':
                executeCommand('strikethrough');
                hideContextMenu();
                break;
            case 'title':
                applyTextStyle('title');
                hideContextMenu();
                break;
            case 'heading':
                applyTextStyle('heading');
                hideContextMenu();
                break;
            case 'body':
                applyTextStyle('body');
                hideContextMenu();
                break;
            case 'google-search':
                const selectedText = window.getSelection().toString().trim();
                if (selectedText) {
                    window.electronAPI.openExternalLink(
                        `https://www.google.com/search?q=${encodeURIComponent(selectedText)}`
                    );
                }
                hideContextMenu();
                break;
            
            // Note context menu actions
            case 'delete-note':
                if (contextMenuNote && noteDeleteCallback) {
                    await noteDeleteCallback(contextMenuNote);
                    hideNoteContextMenu();
                }
                break;
            
            // Folder context menu actions
            case 'rename-folder':
                await handleRenameFolder();
                break;
            case 'delete-folder':
                await handleDeleteFolder();
                break;
        }
    });
}

// Export for use in sidebar (right-click on notes)
export { showNoteContextMenu as showMoveNoteMenu };
