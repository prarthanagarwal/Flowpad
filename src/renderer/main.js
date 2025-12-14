// ===== FLOWPAD RENDERER MAIN =====
// Entry point for the renderer process using ES6 modules

// State
import * as state from './state.js';

// Utilities
import { escapeHtml, normalizeHtmlForComparison, focusEditor } from './utils/dom.js';
import { formatTime } from './utils/time.js';

// UI Modules
import { initTheme, applyTheme } from './modules/ui/theme.js';
import { initDropdowns } from './modules/ui/dropdowns.js';
import { initFullscreen, toggleFullscreen } from './modules/ui/fullscreen.js';
import { initContextMenu } from './modules/ui/contextMenu.js';

// Sidebar
import { initSidebar, closeSidebar, toggleSidebar, renderNotesList, updateSidebarNoteTitle } from './modules/sidebar/index.js';

// Notes
import { 
    loadNote, 
    createNewNote, 
    saveCurrentNote, 
    deleteNote as deleteNoteHandler,
    loadNotes,
    extractTitleFromContent,
    updateTitleFromContent
} from './modules/notes/index.js';

// Editor
import { 
    initEditor, 
    handleListEnter, 
    executeCommand,
    updateFormatButtonStates
} from './modules/editor/index.js';

// ===== CONSTANTS =====
const placeholderTexts = [
    "Start writing your note...",
    "Let your thoughts flow here...",
    "Capture your ideas...",
    "Write freely, edit later...",
    "Begin your journey here...",
    "What's on your mind today?",
    "Create something wonderful..."
];

// Platform detection
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

// ===== DOM ELEMENTS =====
let editor;
let editorPlaceholder;
let currentNoteTitle;
let wordCount;
let currentTime;
let searchNotes;
let newNoteBtn;

// ===== INITIALIZATION =====
async function initialize() {
    // Get DOM references
    editor = document.getElementById('editor');
    editorPlaceholder = document.getElementById('editorPlaceholder');
    currentNoteTitle = document.getElementById('currentNoteTitle');
    wordCount = document.getElementById('wordCount');
    currentTime = document.getElementById('currentTime');
    searchNotes = document.getElementById('searchNotes');
    newNoteBtn = document.getElementById('newNoteBtn');

    // Set random placeholder text
    const randomIndex = Math.floor(Math.random() * placeholderTexts.length);
    editorPlaceholder.textContent = placeholderTexts[randomIndex];

    // Load settings
    await loadSettings();

    // Initialize UI modules FIRST (so DOM refs are ready)
    initTheme();
    initDropdowns();
    initFullscreen();
    initSidebar();  
    initContextMenu(executeCommand);
    initEditor(editor, editorPlaceholder, wordCount, handleEditorInput);

    // THEN load data and render
    await loadFolders();
    await loadNotesAndRender();

    // Setup event listeners
    setupEventListeners();

    // Update tooltips
    updateTooltips();

    // Start clock
    updateTime();
    setInterval(updateTime, 1000);

    // Apply settings
    applySettings();

    // Create initial note if needed
    if (state.allNotes.length === 0 || !state.currentNote) {
        await handleCreateNewNote();
    } else if (state.currentNote) {
        applyNoteFontSettings();
    }

    // Auto-save timer (backup - runs every 30s)
    setInterval(() => {
        if (state.currentNote && editor.innerHTML.trim() && state.currentNote.originalContent !== editor.innerHTML) {
            autoSave();
        }
    }, 30000);
}

// ===== SETTINGS =====
async function loadSettings() {
    try {
        const result = await window.electronAPI.getAppSettings();
        if (result) {
            state.setSettings(result);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function applySettings() {
    editor.style.fontSize = '18px';
    editor.style.fontFamily = state.settings.fontFamily;
    editorPlaceholder.style.fontFamily = state.settings.fontFamily;
    editorPlaceholder.style.fontSize = '18px';

    document.querySelectorAll('.font-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.font === state.settings.fontFamily) {
            option.classList.add('active');
        }
    });

    document.querySelectorAll('.size-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.style === 'body') {
            option.classList.add('active');
        }
    });

    applyTheme();

    if (state.settings.wordWrap) {
        editor.style.whiteSpace = 'pre-wrap';
    } else {
        editor.style.whiteSpace = 'pre';
    }
}

function applyNoteFontSettings() {
    if (!state.currentNote) return;

    editor.style.fontSize = '18px';
    editor.style.fontFamily = state.currentNote.fontFamily;
    editorPlaceholder.style.fontFamily = state.currentNote.fontFamily;
    editorPlaceholder.style.fontSize = '18px';
    state.setActiveTextStyle('body');

    document.querySelectorAll('.font-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.font === state.currentNote.fontFamily) {
            option.classList.add('active');
        }
    });

    document.querySelectorAll('.size-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.style === 'body') {
            option.classList.add('active');
        }
    });
}

async function saveSettings() {
    try {
        await window.electronAPI.saveAppSettings(state.settings);
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// ===== FOLDERS =====
async function loadFolders() {
    try {
        const result = await window.electronAPI.getFolders();
        if (result.success) {
            state.setAllFolders(result.folders);
        }
    } catch (error) {
        console.error('Error loading folders:', error);
    }
}

// ===== NOTES =====
async function loadNotesAndRender() {
    await loadNotes();
    doRenderNotesList();
}

function doRenderNotesList() {
    renderNotesList(null, handleLoadNote, handleDeleteNote, showMoveNoteMenu);
}

async function handleLoadNote(note) {
    await loadNote(note, editor, currentNoteTitle, handleSaveCurrentNote, applyNoteFontSettings, editorPlaceholder, wordCount);
}

async function handleCreateNewNote() {
    await createNewNote(editor, currentNoteTitle, handleSaveCurrentNote, applyNoteFontSettings, placeholderTexts, editorPlaceholder);
}

async function handleSaveCurrentNote() {
    // Pass callbacks for sidebar updates - no full reload needed
    await saveCurrentNote(editor, currentNoteTitle, { renderList: doRenderNotesList });
}

async function handleDeleteNote(noteId) {
    await deleteNoteHandler(noteId, handleCreateNewNote, doRenderNotesList);
}

// ===== AUTO-SAVE =====
let autoSaveTimeout;
function debouncedAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        if (state.currentNote && editor.innerHTML.trim()) {
            const hasContentChanged = state.isNoteDirty || 
                normalizeHtmlForComparison(state.currentNote.originalContent) !== normalizeHtmlForComparison(editor.innerHTML);

            if (hasContentChanged) {
                autoSave();
            }
        }
    }, 1500);
}

async function autoSave() {
    if (state.currentNote && editor.innerHTML.trim()) {
        const hasContentChanged = state.isNoteDirty || 
            normalizeHtmlForComparison(state.currentNote.originalContent) !== normalizeHtmlForComparison(editor.innerHTML);

        if (hasContentChanged) {
            await handleSaveCurrentNote();
        }
    }
}

// ===== EDITOR INPUT HANDLER =====
function handleEditorInput(e) {
    if (state.currentNote) {
        state.currentNote.content = editor.innerHTML;
        updateTitleFromContent(editor, currentNoteTitle);

        const hasChanged = normalizeHtmlForComparison(state.currentNote.originalContent) !== 
                          normalizeHtmlForComparison(editor.innerHTML);
        if (hasChanged) {
            state.setIsNoteDirty(true);
            debouncedAutoSave();
        }
    }
}

// ===== KEYBOARD HANDLING =====
function handleKeyDown(e) {
    // Handle Enter for lists
    if (e.key === 'Enter') {
        if (handleListEnter(e)) {
            return;
        }
    }

    // Save shortcut
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveCurrentNote();
        return;
    }

    // New note shortcut
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleCreateNewNote();
        return;
    }

    // Bold
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        executeCommand('bold');
        return;
    }

    // Italic
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        executeCommand('italic');
        return;
    }

    // Underline
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'u') {
        e.preventDefault();
        executeCommand('underline');
        return;
    }

    // Toggle history
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        toggleSidebar();
        return;
    }

    // Close app
    if (e.key === 'Escape') {
        e.preventDefault();
        window.electronAPI.closeApp();
        return;
    }
}

// ===== SEARCH =====
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    if (!query) {
        doRenderNotesList();
        return;
    }

    const filteredNotes = state.allNotes.filter(note => {
        const contentText = new DOMParser().parseFromString(note.content, 'text/html').body.textContent.toLowerCase();
        return contentText.includes(query);
    });

    renderNotesList(filteredNotes, handleLoadNote, handleDeleteNote, showMoveNoteMenu);
}

// ===== MOVE NOTE MENU =====
function showMoveNoteMenu(event, note) {
    // TODO: Implement move note menu
}

// ===== FONT MANAGEMENT =====
function updateFontFamily(family) {
    if (!state.currentNote) return;

    state.currentNote.fontFamily = family;
    editor.style.fontFamily = family;
    editorPlaceholder.style.fontFamily = family;

    document.querySelectorAll('.font-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.font === family) {
            option.classList.add('active');
        }
    });

    handleSaveCurrentNote();
}

function surpriseFont() {
    if (!state.currentNote) return;

    const availableFonts = ['Aeonik', 'Baskervville', 'Instrument Serif', 'Neue Regrade', 'Patrick Hand', 'Courier New'];
    const currentFont = state.currentNote.fontFamily;
    const otherFonts = availableFonts.filter(font => font !== currentFont);
    const randomIndex = Math.floor(Math.random() * otherFonts.length);
    const randomFont = otherFonts[randomIndex];

    updateFontFamily(randomFont);
}

// ===== TIME DISPLAY =====
function updateTime() {
    const now = new Date();
    currentTime.textContent = formatTime(now);
}

// ===== TOOLTIPS =====
function updateTooltips() {
    const modKey = isMac ? 'Cmd' : 'Ctrl';

    const boldBtn = document.getElementById('boldBtn');
    const italicBtn = document.getElementById('italicBtn');
    const underlineBtn = document.getElementById('underlineBtn');
    const historyBtn = document.getElementById('historyBtn');

    if (boldBtn) boldBtn.title = `Bold (${modKey}+B)`;
    if (italicBtn) italicBtn.title = `Italic (${modKey}+I)`;
    if (underlineBtn) underlineBtn.title = `Underline (${modKey}+U)`;
    if (newNoteBtn) newNoteBtn.title = `New Note (${modKey}+N)`;
    if (historyBtn) historyBtn.title = `Toggle History (${modKey}+H)`;
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // New note button
    newNoteBtn?.addEventListener('click', handleCreateNewNote);

    // Surprise font button
    document.getElementById('surpriseBtn')?.addEventListener('click', surpriseFont);

    // Window controls
    document.getElementById('minimizeBtn')?.addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
    });

    document.getElementById('closeBtn')?.addEventListener('click', () => {
        window.electronAPI.closeApp();
    });

    // Keyboard shortcuts
    editor?.addEventListener('keydown', handleKeyDown);

    // Search
    searchNotes?.addEventListener('input', handleSearch);

    // Font options
    document.querySelectorAll('.font-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const font = e.target.dataset.font;
            updateFontFamily(font);
        });
    });

    // Menu event listeners
    window.electronAPI.onNewNote(handleCreateNewNote);
    window.electronAPI.onSaveNote(handleSaveCurrentNote);
    window.electronAPI.onToggleHistory(toggleSidebar);
    window.electronAPI.onToggleFullscreen(toggleFullscreen);
}

// ===== START APPLICATION =====
document.addEventListener('DOMContentLoaded', initialize);

// Focus management
window.addEventListener('load', () => {
    focusEditor(editor, false);
});

window.addEventListener('focus', () => {
    setTimeout(() => {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar.classList.contains('open')) {
            focusEditor(editor);
        }
    }, 100);
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar.classList.contains('open')) {
            setTimeout(() => {
                focusEditor(editor);
            }, 100);
        }
    }
});
