// ===== CONTEXT MENU MANAGEMENT =====
// Handles the right-click context menu for the editor

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

// Initialize context menu
export function initContextMenu(executeCommand) {
    const editor = document.getElementById('editor');
    
    // Add context menu event listener
    if (editor) {
        editor.addEventListener('contextmenu', showEditorContextMenu);
    }
    
    // Handle context menu actions
    document.addEventListener('click', async (e) => {
        if (e.target.closest('.context-menu-item')) {
            const action = e.target.closest('.context-menu-item').dataset.action;
            const editor = document.getElementById('editor');

            switch (action) {
                case 'copy':
                    await handleCopy(editor);
                    break;
                case 'cut':
                    await handleCut(editor);
                    break;
                case 'paste':
                    await handleContextMenuPaste(editor);
                    break;
                case 'select-all':
                    handleSelectAll(editor);
                    break;
                case 'bold':
                    executeCommand('bold');
                    break;
                case 'italic':
                    executeCommand('italic');
                    break;
                case 'underline':
                    executeCommand('underline');
                    break;
                case 'google-search':
                    const selectedText = window.getSelection().toString().trim();
                    if (selectedText) {
                        window.electronAPI.openExternalLink(
                            `https://www.google.com/search?q=${encodeURIComponent(selectedText)}`
                        );
                    }
                    break;
            }

            hideContextMenu();
        }
    });
}
