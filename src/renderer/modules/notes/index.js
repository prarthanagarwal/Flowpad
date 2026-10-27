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
    updateNoteInCache,
    addNoteToCache,
    removeNoteFromCache
} from '../../state.js';
import { normalizeHtmlForComparison, getPlainText } from '../../utils/dom.js';
import { closeSidebar, updateSidebarNoteTitle } from '../sidebar/index.js';
import { updatePlaceholder, updateWordCount } from '../editor/index.js';
import { showDeleteConfirmation } from '../ui/contextMenu.js';

// Extract title from content - gets ONLY the first line
export function extractTitleFromContent(content) {
    if (!content) return 'New Note';

    return getPlainText(content).split('\n').find(line => line.trim())?.trim() || 'New Note';
}

// Update title from editor content
export function updateTitleFromContent(editor, currentNoteTitle) {
    if (!currentNote) return;

    const editorContent = editor.innerHTML;
    const newTitle = extractTitleFromContent(editorContent);

    if (currentNote.title !== newTitle) {
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
    if (currentNote) {
        const hasUnsavedChanges = isNoteDirty || 
            normalizeHtmlForComparison(currentNote.originalContent) !== normalizeHtmlForComparison(editor.innerHTML);
        if (hasUnsavedChanges) {
            do {
                if (!await saveCurrentNoteCallback()) return false;
            } while (currentNote && currentNote.originalContent !== editor.innerHTML);
        }
    }

    // Don't reload the same note
    if (currentNote && currentNote.id === note.id) {
        return;
    }

    // Reset dirty flag and list modes
    setIsNoteDirty(false);

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
    if (currentNote) {
        const hasUnsavedChanges = isNoteDirty || 
            normalizeHtmlForComparison(currentNote.originalContent) !== normalizeHtmlForComparison(editor.innerHTML);
        if (hasUnsavedChanges) {
            do {
                if (!await saveCurrentNoteCallback()) return false;
            } while (currentNote && currentNote.originalContent !== editor.innerHTML);
        }
    }

    // Reset flags
    setIsNoteDirty(false);

    // Get folder name if creating in a specific folder
    let folderName = null;
    if (currentFolder !== 'all') {
        const folder = allFolders.find(f => f.id === currentFolder);
        folderName = folder ? folder.name : null;
    }

    setCurrentNote({
        id: crypto.randomUUID(),
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
    updateWordCount(editor, document.getElementById('wordCount'));

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
let pendingSave = Promise.resolve();
export function saveCurrentNote(editor, currentNoteTitle, sidebarCallbacks) {
    if (!currentNote) return Promise.resolve(true);
    const snapshot = {
        ...currentNote,
        title: extractTitleFromContent(editor.innerHTML),
        content: editor.innerHTML,
        updatedAt: isNoteDirty || currentNote.originalContent !== editor.innerHTML
            ? new Date().toISOString() : currentNote.updatedAt
    };
    const save = async () => {
        const status = document.getElementById('saveStatus');
        try {
            status.textContent = 'Saving…';
            const result = await window.electronAPI.saveNote(snapshot);
            if (!result.success) throw new Error(result.error);
            const saved = { ...result.note, originalContent: snapshot.content };
            const cached = allNotes.some(note => note.id === saved.id);
            if (cached) updateNoteInCache(saved.id, saved, true);
            else addNoteToCache(saved);
            // A response acknowledges only its snapshot, never edits made while it was in flight.
            if (currentNote?.id === snapshot.id) {
                currentNote.originalContent = snapshot.content;
                setIsNoteDirty(editor.innerHTML !== snapshot.content);
            }
            status.textContent = isNoteDirty ? 'Unsaved changes' : 'Saved';
            sidebarCallbacks?.renderList?.();
            return true;
        } catch (error) {
            setIsNoteDirty(true);
            status.textContent = 'Save failed — retry with ' + (navigator.platform.includes('Mac') ? 'Cmd+S' : 'Ctrl+S');
            console.error('Error saving note:', error);
            return false;
        }
    };
    pendingSave = pendingSave.then(save, save);
    return pendingSave;
}

// Toggle pin state for a note
export async function togglePinNote(note, renderListCallback) {
    if (!note) return;

    try {
        const isPinned = !note.isPinned;
        const source = currentNote?.id === note.id ? currentNote : note;
        const updatedData = { ...source, isPinned };

        // Save to storage
        const result = await window.electronAPI.saveNote(updatedData);
        if (result.success) {
            updateNoteInCache(note.id, { isPinned }, true);

            if (currentNote && currentNote.id === note.id) {
                currentNote.isPinned = isPinned;
            }

            if (renderListCallback) {
                renderListCallback();
            }
        }
    } catch (error) {
        console.error('Error toggling pin note:', error);
    }
}

// Delete note - using custom confirmation modal
export async function deleteNote(noteId, createNewNoteCallback, renderListCallback) {
    const targetNote = allNotes.find(n => n.id === noteId);
    const noteTitle = targetNote ? targetNote.title : 'this note';

    showDeleteConfirmation(
        `Delete "${noteTitle.length > 20 ? noteTitle.substring(0, 18) + '...' : noteTitle}"?`,
        'This action cannot be undone.',
        async () => {
            try {
                await pendingSave;
                const result = await window.electronAPI.deleteNote(noteId);
                if (result.success) {
                    removeNoteFromCache(noteId);
                    
                    if (currentNote && currentNote.id === noteId) {
                        setCurrentNote(null);
                        setIsNoteDirty(false);
                        await createNewNoteCallback();
                    }
                    
                    if (renderListCallback) {
                        renderListCallback();
                    }
                }
            } catch (error) {
                console.error('Error deleting note:', error);
            }
        }
    );
}

// Load all notes from storage
export async function loadNotes() {
    try {
        const result = await window.electronAPI.loadNotes();

        if (result.success) {
            setAllNotes(result.notes);
            if (result.warnings?.length) document.getElementById('saveStatus').textContent = `${result.warnings.length} note file(s) could not be read`;

            return result.notes;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error loading notes:', error);
        throw error;
    }
}
