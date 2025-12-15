// ===== NOTES MODULE =====
// Handles note CRUD operations and title management

import { 
    currentNote, 
    allNotes, 
    settings, 
    currentFolder,
    allFolders,
    isNoteDirty,
    setCurrentNote, 
    setAllNotes, 
    setIsNoteDirty,
    resetListModes,
    updateNoteInCache,
    addNoteToCache,
    removeNoteFromCache
} from '../../state.js';
import { normalizeHtmlForComparison } from '../../utils/dom.js';
import { closeSidebar, updateSidebarNoteTitle, renderNotesList } from '../sidebar/index.js';
import { updatePlaceholder, updateWordCount } from '../editor/index.js';

// Extract title from content - gets ONLY the first line
export function extractTitleFromContent(content) {
    if (!content) return 'New Note';

    let firstLine = '';
    
    if (typeof content === 'string' && content.includes('<')) {
        // Parse HTML properly using DOM
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const body = doc.body;
        
        // Get first line by examining the structure
        // In contenteditable, structure is either:
        // 1. Text node followed by <div>s for each line
        // 2. All lines in <div>s
        // 3. Lines separated by <br>
        
        const firstChild = body.firstChild;
        
        if (!firstChild) {
            return 'New Note';
        }
        
        // Check if first child is a text node (first line without wrapper)
        if (firstChild.nodeType === Node.TEXT_NODE) {
            firstLine = firstChild.textContent.trim();
        } 
        // If first child is a div, get its text content
        else if (firstChild.nodeType === Node.ELEMENT_NODE) {
            // For div, p, or other block elements - get first one's text
            if (firstChild.tagName === 'DIV' || firstChild.tagName === 'P') {
                firstLine = firstChild.textContent.trim();
            } else {
                // For inline elements or others, get text until first block break
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = content;
                
                // Walk through and get text until first <div>, <p>, or <br>
                let text = '';
                const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
                let node;
                
                while ((node = walker.nextNode())) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const tag = node.tagName;
                        if (tag === 'DIV' || tag === 'P' || tag === 'BR') {
                            break; // Stop at first line break
                        }
                    } else if (node.nodeType === Node.TEXT_NODE) {
                        text += node.textContent;
                    }
                }
                
                firstLine = text.trim();
            }
        }
    } else {
        // Plain text - split by newline
        const lines = content.split('\n');
        firstLine = lines[0]?.trim() || '';
    }

    return firstLine || 'New Note';
}

// Update title from editor content
export function updateTitleFromContent(editor, currentNoteTitle) {
    if (!currentNote) return;

    const editorContent = editor.innerHTML;
    const newTitle = extractTitleFromContent(editorContent);

    if (currentNote.title !== newTitle) {
        const oldTitle = currentNote.title;
        currentNote.title = newTitle;

        // Limit title bar display to 15 characters max
        let displayTitle = newTitle;
        if (displayTitle.length > 15) {
            displayTitle = displayTitle.substring(0, 12) + '...';
        }

        currentNoteTitle.textContent = displayTitle;
        currentNote.content = editorContent;

        // Debounced sidebar update
        debouncedSidebarUpdate(currentNote);
    }
}

// Debounced sidebar update
let sidebarUpdateTimeout;
function debouncedSidebarUpdate(note) {
    clearTimeout(sidebarUpdateTimeout);
    sidebarUpdateTimeout = setTimeout(() => {
        updateSidebarNoteTitle(note);
    }, 100);
}

// Load a specific note
export async function loadNote(note, editor, currentNoteTitle, saveCurrentNoteCallback, applyNoteFontSettingsCallback, editorPlaceholder, wordCountElement) {
    // Save current note before switching if content has changed
    if (currentNote && editor.innerHTML.trim()) {
        const hasUnsavedChanges = isNoteDirty || 
            normalizeHtmlForComparison(currentNote.originalContent) !== normalizeHtmlForComparison(editor.innerHTML);
        if (hasUnsavedChanges) {
            await saveCurrentNoteCallback();
        }
    }

    // Don't reload the same note
    if (currentNote && currentNote.id === note.id) {
        return;
    }

    // Reset dirty flag and list modes
    setIsNoteDirty(false);
    resetListModes();

    // Get fresh version from cache
    const freshNote = allNotes.find(n => n.id === note.id);
    if (freshNote) {
        setCurrentNote({ ...freshNote });
    } else {
        setCurrentNote({ ...note });
    }

    // Handle backward compatibility
    if (!currentNote.fontSize) {
        currentNote.fontSize = settings.fontSize;
    }
    if (!currentNote.fontFamily) {
        currentNote.fontFamily = settings.fontFamily;
    }

    // Set editor content
    const noteContent = currentNote.content || '';
    editor.innerHTML = noteContent;
    currentNote.content = noteContent;

    // Update placeholder visibility and word count
    if (editorPlaceholder) {
        updatePlaceholder(editor, editorPlaceholder);
    }
    if (wordCountElement) {
        updateWordCount(editor, wordCountElement);
    }

    // Update title bar - ALWAYS set it when loading a note
    const noteTitle = extractTitleFromContent(noteContent);
    currentNote.title = noteTitle;
    
    // Limit title bar display to 15 characters max
    let displayTitle = noteTitle;
    if (displayTitle.length > 15) {
        displayTitle = displayTitle.substring(0, 12) + '...';
    }
    currentNoteTitle.textContent = displayTitle;

    // Apply font settings
    if (applyNoteFontSettingsCallback) {
        applyNoteFontSettingsCallback();
    }

    // Update active state in sidebar
    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-note-id="${note.id}"]`)?.classList.add('active');

    // Store original content after DOM settles
    queueMicrotask(() => {
        if (currentNote) {
            currentNote.originalContent = editor.innerHTML;
        }
    });

    // Focus editor
    setTimeout(() => {
        editor.focus();
    }, 100);
}

// Create new note
export async function createNewNote(editor, currentNoteTitle, saveCurrentNoteCallback, applyNoteFontSettingsCallback, placeholderTexts, editorPlaceholder) {
    // Close sidebar when creating a new note
    closeSidebar();

    // Save current note before creating new one
    if (currentNote && editor.innerHTML.trim()) {
        const hasUnsavedChanges = isNoteDirty || 
            normalizeHtmlForComparison(currentNote.originalContent) !== normalizeHtmlForComparison(editor.innerHTML);
        if (hasUnsavedChanges) {
            await saveCurrentNoteCallback();
        }
    }

    // Reset flags
    setIsNoteDirty(false);
    resetListModes();

    // Get folder name if creating in a specific folder
    let folderName = null;
    if (currentFolder !== 'all') {
        const folder = allFolders.find(f => f.id === currentFolder);
        folderName = folder ? folder.name : null;
    }

    setCurrentNote({
        id: Date.now().toString(),
        title: 'New Note',
        content: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily,
        folder: currentFolder === 'all' ? null : currentFolder,
        folderName: folderName,
        originalContent: ''
    });

    editor.innerHTML = '';

    // Update title display
    currentNoteTitle.textContent = 'New Note';

    // Set random placeholder text and make it visible
    if (placeholderTexts && editorPlaceholder) {
        const randomIndex = Math.floor(Math.random() * placeholderTexts.length);
        editorPlaceholder.textContent = placeholderTexts[randomIndex];
        editorPlaceholder.classList.remove('hidden');
    }

    // Apply font settings
    if (applyNoteFontSettingsCallback) {
        applyNoteFontSettingsCallback();
    }

    editor.focus();

    // Remove active state from sidebar items
    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('active');
    });
}

// Save current note - optimized to update cache directly without reloading all notes
export async function saveCurrentNote(editor, currentNoteTitle, sidebarCallbacks) {
    if (!currentNote) return;

    try {
        const contentChanged = isNoteDirty || 
            normalizeHtmlForComparison(currentNote.originalContent) !== normalizeHtmlForComparison(editor.innerHTML);

        const noteData = {
            ...currentNote,
            content: editor.innerHTML,
            updatedAt: contentChanged ? new Date().toISOString() : currentNote.updatedAt
        };

        const result = await window.electronAPI.saveNote(noteData);

        if (result.success) {
            const wasNewNote = !allNotes.find(note => note.id === currentNote.id);

            const updatedNote = result.note;
            updatedNote.originalContent = editor.innerHTML;

            setCurrentNote(updatedNote);
            setIsNoteDirty(false);

            // Update title display
            let displayTitle = currentNote.title;
            if (displayTitle.length > 15) {
                displayTitle = displayTitle.substring(0, 12) + '...';
            }
            currentNoteTitle.textContent = displayTitle;

            // Update cache directly - no full reload from disk needed
            if (wasNewNote) {
                addNoteToCache({ ...currentNote });
                // Re-render sidebar for new notes
                if (sidebarCallbacks && sidebarCallbacks.renderList) {
                    sidebarCallbacks.renderList();
                }
            } else if (contentChanged) {
                // Content changed - update cache, re-sort, and re-render to move note up
                updateNoteInCache(currentNote.id, { ...currentNote }, true);
                if (sidebarCallbacks && sidebarCallbacks.renderList) {
                    sidebarCallbacks.renderList();
                }
            } else {
                // No content change - just update title in place
                updateNoteInCache(currentNote.id, { ...currentNote });
                updateSidebarNoteTitle(currentNote);
            }
        } else {
            console.error('Save failed:', result.error);
        }
    } catch (error) {
        console.error('Error saving note:', error);
    }
}

// Delete note - optimized to update cache directly without reloading all notes
export async function deleteNote(noteId, createNewNoteCallback, renderListCallback) {
    if (confirm('Are you sure you want to delete this note?')) {
        try {
            const result = await window.electronAPI.deleteNote(noteId);
            if (result.success) {
                // Remove from cache directly
                removeNoteFromCache(noteId);
                
                // If we deleted the current note, create a new one
                if (currentNote && currentNote.id === noteId) {
                    await createNewNoteCallback();
                }
                
                // Re-render sidebar with updated cache
                if (renderListCallback) {
                    renderListCallback();
                }
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    }
}

// Load all notes from storage
export async function loadNotes() {
    try {
        const result = await window.electronAPI.loadNotes();

        if (result.success) {
            setAllNotes(result.notes);
            return result.notes;
        } else {
            console.error('Failed to load notes:', result.error);
            return [];
        }
    } catch (error) {
        console.error('Error loading notes:', error);
        return [];
    }
}
