// Application state
let currentNote = null;
let allNotes = [];
let settings = {
    fontSize: 16,
    fontFamily: 'Inter',
    theme: 'dark',
    autoSave: true,
    wordWrap: true
};

// DOM elements
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const notesList = document.getElementById('notesList');
const editor = document.getElementById('editor');
const editorPlaceholder = document.getElementById('editorPlaceholder');
const noteTitle = document.getElementById('noteTitle');
const currentNoteTitle = document.getElementById('currentNoteTitle');
const wordCount = document.getElementById('wordCount');
const currentTime = document.getElementById('currentTime');
const searchNotes = document.getElementById('searchNotes');

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadNotes();
    setupEventListeners();
    updateTime();
    setInterval(updateTime, 1000);
    
    // Create initial note if no notes exist or no current note
    if (allNotes.length === 0 || !currentNote) {
        createNewNote();
    }
    
    // Auto-save functionality - always enabled
    setInterval(autoSave, 3000); // Auto-save every 3 seconds
});

// Event Listeners Setup
function setupEventListeners() {
    // Sidebar toggle
    document.getElementById('historyBtn').addEventListener('click', toggleSidebar);
    document.getElementById('closeSidebar').addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
    
    // New note
    document.getElementById('newNoteBtn').addEventListener('click', createNewNote);
    
    // Font dropdown
    document.getElementById('fontBtn').addEventListener('click', toggleFontDropdown);
    
    // Formatting dropdown
    document.getElementById('formatBtn').addEventListener('click', toggleFormattingDropdown);
    
    // Theme toggle
    document.getElementById('themeBtn').addEventListener('click', toggleTheme);
    
    // Editor events
    editor.addEventListener('input', handleEditorInput);
    editor.addEventListener('keydown', handleKeyDown);
    editor.addEventListener('paste', handlePaste);
    
    // Reset formatting on Enter key
    editor.addEventListener('keydown', handleFormattingReset);
    
    // Note title events
    noteTitle.addEventListener('input', updateNoteTitle);
    noteTitle.addEventListener('focus', hideTitlePlaceholder);
    noteTitle.addEventListener('blur', showTitlePlaceholder);
    noteTitle.addEventListener('input', () => {
        // Auto-save when title changes
        setTimeout(autoSave, 500);
    });
    
    // Search functionality
    searchNotes.addEventListener('input', handleSearch);
    
    // Formatting toolbar
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (btn.classList.contains('todo-btn')) {
                toggleTodoItem();
            } else {
                const command = btn.dataset.command;
                if (command) {
                    executeCommand(command);
                    updateFormatButtonStates();
                }
            }
        });
    });
    
    // Update format button states on selection change
    document.addEventListener('selectionchange', updateFormatButtonStates);
    editor.addEventListener('keyup', updateFormatButtonStates);
    editor.addEventListener('mouseup', updateFormatButtonStates);
    
    // Font controls
    document.getElementById('fontSize').addEventListener('change', updateFontSize);
    document.getElementById('fontFamily').addEventListener('change', updateFontFamily);
    
    // Menu event listeners
    window.electronAPI.onNewNote(() => createNewNote());
    window.electronAPI.onSaveNote(() => saveCurrentNote());
    window.electronAPI.onToggleHistory(() => toggleSidebar());
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.font-dropdown')) {
            closeFontDropdown();
        }
        if (!e.target.closest('.formatting-dropdown')) {
            closeFormattingDropdown();
        }
    });
}

// Load application settings
async function loadSettings() {
    try {
        const result = await window.electronAPI.getAppSettings();
        if (result) {
            settings = { ...settings, ...result };
            applySettings();
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Apply settings to the UI
function applySettings() {
    editor.style.fontSize = `${settings.fontSize}px`;
    editor.style.fontFamily = settings.fontFamily;
    
    // Update font controls
    document.getElementById('fontSize').value = settings.fontSize;
    document.getElementById('fontFamily').value = settings.fontFamily;
    
    // Apply theme
    document.body.className = settings.theme === 'light' ? 'light-mode' : '';
    updateThemeButton();
    
    // Update title bar theme on startup
    window.electronAPI.updateTitleBarTheme(settings.theme);
    
    if (settings.wordWrap) {
        editor.style.whiteSpace = 'pre-wrap';
    } else {
        editor.style.whiteSpace = 'pre';
    }
}

// Save settings
async function saveSettings() {
    try {
        await window.electronAPI.saveAppSettings(settings);
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// Load all notes
async function loadNotes() {
    try {
        const result = await window.electronAPI.loadNotes();
        if (result.success) {
            allNotes = result.notes;
            renderNotesList();
        }
    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

// Render notes list in sidebar
function renderNotesList(notesToRender = allNotes) {
    notesList.innerHTML = '';
    
    if (notesToRender.length === 0) {
        notesList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No notes found</div>';
        return;
    }
    
    notesToRender.forEach(note => {
        const noteElement = createNoteListItem(note);
        notesList.appendChild(noteElement);
    });
}

// Create note list item
function createNoteListItem(note) {
    const div = document.createElement('div');
    div.className = 'note-item';
    div.dataset.noteId = note.id;
    
    if (currentNote && currentNote.id === note.id) {
        div.classList.add('active');
    }
    
    const date = new Date(note.updatedAt).toLocaleDateString();
    
    div.innerHTML = `
        <div class="note-item-content">
            <div class="note-item-title">${note.title}</div>
            <div class="note-item-date">${date}</div>
        </div>
        <div class="note-item-actions">
            <button class="note-action-btn delete-note" data-note-id="${note.id}" title="Delete">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="M19,6v14a2,2 0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
                </svg>
            </button>
        </div>
    `;
    
    // Add click event to load note
    div.addEventListener('click', (e) => {
        if (!e.target.closest('.note-item-actions')) {
            loadNote(note);
            closeSidebar(); // Auto-close sidebar when note is clicked
        }
    });
    
    // Add delete event
    div.querySelector('.delete-note').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(note.id);
    });
    
    return div;
}

// Load a specific note
function loadNote(note) {
    currentNote = note;
    noteTitle.value = note.title;
    noteTitle.placeholder = note.title ? '' : 'Note title...';
    editor.innerHTML = note.content;
    currentNoteTitle.textContent = note.title || 'Untitled Note';
    updatePlaceholder();
    updateWordCount();
    
    // Update active state in sidebar
    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-note-id="${note.id}"]`)?.classList.add('active');
}

// Create new note
function createNewNote() {
    currentNote = {
        id: Date.now().toString(),
        title: '',
        content: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: []
    };
    
    noteTitle.value = '';
    noteTitle.placeholder = 'Note title...';
    editor.innerHTML = '';
    currentNoteTitle.textContent = 'New Note';
    editor.focus();
    updatePlaceholder();
    updateWordCount();
    
    // Remove active state from sidebar items
    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('active');
    });
}

// Save current note
async function saveCurrentNote() {
    if (!currentNote) return;
    
    try {
        const noteData = {
            ...currentNote,
            title: noteTitle.value || 'Untitled Note',
            content: editor.innerHTML,
            updatedAt: new Date().toISOString()
        };
        
        const result = await window.electronAPI.saveNote(noteData);
        if (result.success) {
            currentNote = result.note;
            currentNoteTitle.textContent = currentNote.title;
            await loadNotes(); // Refresh the list
        }
    } catch (error) {
        console.error('Error saving note:', error);
    }
}

// Auto-save functionality
async function autoSave() {
    if (currentNote && (editor.innerHTML.trim() || noteTitle.value.trim())) {
        await saveCurrentNote();
    }
}

// Export current note
async function exportCurrentNote() {
    if (!currentNote) return;
    
    try {
        const noteToExport = {
            title: noteTitle.value || 'Untitled Note',
            content: editor.textContent || editor.innerText
        };
        
        const result = await window.electronAPI.exportNote(noteToExport);
        if (result.success) {
            console.log('Note exported successfully');
        }
    } catch (error) {
        console.error('Error exporting note:', error);
    }
}

// Delete note
async function deleteNote(noteId) {
    if (confirm('Are you sure you want to delete this note?')) {
        try {
            const result = await window.electronAPI.deleteNote(noteId);
            if (result.success) {
                if (currentNote && currentNote.id === noteId) {
                    createNewNote();
                }
                await loadNotes();
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    }
}

// Search functionality
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    if (!query) {
        renderNotesList();
        return;
    }
    
    const filteredNotes = allNotes.filter(note => 
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
    );
    
    renderNotesList(filteredNotes);
}

// Sidebar management
function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('show');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('show');
}

// Editor functionality
function handleEditorInput() {
    updatePlaceholder();
    updateWordCount();
    maintainTodoEvents();
    
    if (currentNote) {
        currentNote.content = editor.innerHTML;
    }
}

function updatePlaceholder() {
    if (editor.textContent.trim() === '') {
        editorPlaceholder.classList.remove('hidden');
    } else {
        editorPlaceholder.classList.add('hidden');
    }
}

function updateWordCount() {
    const text = editor.textContent || editor.innerText;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
}

function updateNoteTitle() {
    if (currentNote) {
        const newTitle = noteTitle.value.trim() || 'Untitled Note';
        currentNote.title = newTitle;
        currentNoteTitle.textContent = newTitle;
    }
}

// Title placeholder management
function hideTitlePlaceholder() {
    noteTitle.placeholder = '';
}

function showTitlePlaceholder() {
    if (noteTitle.value.trim() === '') {
        noteTitle.placeholder = 'Note title...';
    }
}

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    currentTime.textContent = timeString;
}

// Keyboard shortcuts
function handleKeyDown(e) {
    // Handle Enter key for todo continuation
    if (e.key === 'Enter') {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            let element = range.startContainer;
            
            // If we're in a text node, get the parent
            if (element.nodeType === Node.TEXT_NODE) {
                element = element.parentElement;
            }
            
            // Check if we're inside a todo-text element
            const todoText = element.closest('.todo-text');
            if (todoText) {
                e.preventDefault();
                
                // Create a new todo item
                const newTodoHTML = `<br><span class="todo-item" contenteditable="false"><span class="todo-checkbox"></span><span class="todo-text" contenteditable="true">Todo item</span></span>`;
                
                // Insert the new todo and position cursor
                document.execCommand('insertHTML', false, newTodoHTML);
                
                // Find the newly created todo text and focus it
                setTimeout(() => {
                    const newTodoText = editor.querySelector('.todo-text:last-of-type');
                    if (newTodoText) {
                        newTodoText.focus();
                        // Select all text in the new todo
                        const newRange = document.createRange();
                        newRange.selectNodeContents(newTodoText);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                    attachTodoEvents();
                }, 10);
                
                return;
            }
        }
    }
    
    // Save shortcut
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentNote();
        return;
    }
    
    // New note shortcut
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNewNote();
        return;
    }
    
    // Bold shortcut
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        executeCommand('bold');
        return;
    }
    
    // Italic shortcut
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        executeCommand('italic');
        return;
    }
    
    // Underline shortcut
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        executeCommand('underline');
        return;
    }
    
    // Toggle history shortcut
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        toggleSidebar();
        return;
    }
    
    // Close app with ESC key
    if (e.key === 'Escape') {
        e.preventDefault();
        window.electronAPI.closeApp();
        return;
    }
}

// Formatting commands
function executeCommand(command) {
    document.execCommand(command, false, null);
    editor.focus();
}

// Update format button active states
function updateFormatButtonStates() {
    // Only update if focus is in the main editor, not the title
    if (document.activeElement !== editor) {
        return;
    }
    
    const commands = ['bold', 'italic', 'underline', 'strikethrough'];
    
    commands.forEach(command => {
        const btn = document.querySelector(`[data-command="${command}"]`);
        if (btn) {
            if (document.queryCommandState(command)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

// Todo functionality
function toggleTodoItem() {
    const selection = window.getSelection();
    let currentText = '';
    
    // Get the current line text
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        currentText = range.toString() || getSelectedLineText();
    }
    
    if (!currentText) {
        currentText = 'Todo item';
    }
    
    // Create simple todo HTML structure
    const todoHTML = `<span class="todo-item" contenteditable="false"><span class="todo-checkbox"></span><span class="todo-text" contenteditable="true">${currentText}</span></span>`;
    
    // Insert the todo item
    document.execCommand('insertHTML', false, todoHTML);
    
    // Add click event to the newly created checkbox
    attachTodoEvents();
    
    editor.focus();
}

function getSelectedLineText() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return '';
    
    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    
    // If it's a text node, get its parent
    if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentNode;
    }
    
    // Try to get meaningful text content
    const text = container.textContent || container.innerText || '';
    return text.trim() || '';
}

function attachTodoEvents() {
    // Remove old event listeners and add new ones
    const checkboxes = editor.querySelectorAll('.todo-checkbox');
    checkboxes.forEach(checkbox => {
        // Remove any existing listeners by cloning the element
        const newCheckbox = checkbox.cloneNode(true);
        checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        
        // Add fresh event listener
        newCheckbox.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleTodoCheck(this);
        });
    });
}

function toggleTodoCheck(checkbox) {
    checkbox.classList.toggle('checked');
    const todoText = checkbox.nextElementSibling;
    if (todoText) {
        todoText.classList.toggle('completed');
    }
}

// Call this on editor input to maintain todo functionality
function maintainTodoEvents() {
    attachTodoEvents();
}

// Paste handling
function handlePaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, text);
}

// Font dropdown management
function toggleFontDropdown() {
    const dropdown = document.getElementById('fontDropdownContent');
    dropdown.classList.toggle('show');
    // Close formatting dropdown if open
    closeFormattingDropdown();
}

function closeFontDropdown() {
    const dropdown = document.getElementById('fontDropdownContent');
    dropdown.classList.remove('show');
}

// Formatting dropdown management
function toggleFormattingDropdown() {
    const dropdown = document.getElementById('formattingDropdownContent');
    dropdown.classList.toggle('show');
    // Close font dropdown if open
    closeFontDropdown();
}

function closeFormattingDropdown() {
    const dropdown = document.getElementById('formattingDropdownContent');
    dropdown.classList.remove('show');
}

function updateFontSize() {
    const size = document.getElementById('fontSize').value;
    settings.fontSize = parseInt(size);
    editor.style.fontSize = `${size}px`;
    saveSettings();
}

function updateFontFamily() {
    const family = document.getElementById('fontFamily').value;
    settings.fontFamily = family;
    editor.style.fontFamily = family;
    saveSettings();
}

// Theme management
function toggleTheme() {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    document.body.className = settings.theme === 'light' ? 'light-mode' : '';
    updateThemeButton();
    saveSettings();
    
    // Update title bar colors
    window.electronAPI.updateTitleBarTheme(settings.theme);
}

function updateThemeButton() {
    const themeBtn = document.getElementById('themeBtn');
    const span = themeBtn.querySelector('span');
    if (settings.theme === 'light') {
        span.textContent = 'Dark';
        themeBtn.setAttribute('title', 'Switch to Dark Mode');
    } else {
        span.textContent = 'Light';
        themeBtn.setAttribute('title', 'Switch to Light Mode');
    }
}

// Reset formatting when Enter is pressed
function handleFormattingReset(e) {
    if (e.key === 'Enter') {
        // Small delay to allow the enter to be processed
        setTimeout(() => {
            // Remove any formatting from the current position
            document.execCommand('removeFormat', false, null);
            
            // Also clear any lingering formatting states
            const commands = ['bold', 'italic', 'underline', 'strikethrough'];
            commands.forEach(command => {
                if (document.queryCommandState(command)) {
                    document.execCommand(command, false, null);
                }
            });
            
            // Update button states
            updateFormatButtonStates();
        }, 10);
    }
}

// Focus editor on startup
window.addEventListener('load', () => {
    editor.focus();
}); 