// ===== APPLICATION STATE =====
// Centralized state management for the renderer process

// Current note being edited
export let currentNote = null;

// All notes loaded from storage
export let allNotes = [];

// All folders
export let allFolders = [];

// Current folder filter ('all' means show all notes, otherwise folder ID)
export let currentFolder = 'all';

// Explicit dirty flag for change tracking
export let isNoteDirty = false;

// List mode flags
export let isDashListMode = false;
export let isNumberedListMode = false;
export let isCircularChecklistMode = false;
export let currentListNumber = 1;

// Current active text style mode (title, heading, body)
export let activeTextStyle = 'body';

// Application settings
export let settings = {
    fontSize: 18,
    fontFamily: 'Aeonik',
    theme: 'dark',
    autoSave: true,
    wordWrap: true
};

// ===== STATE SETTERS =====
// Functions to update state (since we can't reassign exported let bindings from outside)

export function setCurrentNote(note) {
    currentNote = note;
}

export function setAllNotes(notes) {
    allNotes = notes;
}

export function setAllFolders(folders) {
    allFolders = folders;
}

export function setCurrentFolder(folder) {
    currentFolder = folder;
}

export function setIsNoteDirty(dirty) {
    isNoteDirty = dirty;
}

export function setIsDashListMode(mode) {
    isDashListMode = mode;
}

export function setIsNumberedListMode(mode) {
    isNumberedListMode = mode;
}

export function setIsCircularChecklistMode(mode) {
    isCircularChecklistMode = mode;
}

export function setCurrentListNumber(num) {
    currentListNumber = num;
}

export function setActiveTextStyle(style) {
    activeTextStyle = style;
}

export function setSettings(newSettings) {
    settings = { ...settings, ...newSettings };
}

// Reset all list modes
export function resetListModes() {
    isDashListMode = false;
    isNumberedListMode = false;
    isCircularChecklistMode = false;
    currentListNumber = 1;
}

// Update a specific note in the allNotes array
export function updateNoteInCache(noteId, updates) {
    const index = allNotes.findIndex(n => n.id === noteId);
    if (index > -1) {
        allNotes[index] = { ...allNotes[index], ...updates };
        return true;
    }
    return false;
}

// Add a note to the beginning of allNotes
export function addNoteToCache(note) {
    allNotes.unshift(note);
}

// Remove a note from allNotes
export function removeNoteFromCache(noteId) {
    const index = allNotes.findIndex(n => n.id === noteId);
    if (index > -1) {
        allNotes.splice(index, 1);
        return true;
    }
    return false;
}
