// Application state
let currentNote = null;
let allNotes = [];
let settings = {
    fontSize: 16,
    fontFamily: 'Aeonik',
    theme: 'dark',
    autoSave: true,
    wordWrap: true
};

// Friendly placeholder texts
const placeholderTexts = [
    "Start writing your note...",
    "Let your thoughts flow here...",
    "Capture your ideas...",
    "Write freely, edit later...",
    "Begin your journey here...",
    "What's on your mind today?",
    "Create something wonderful..."
];

// DOM elements
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const notesList = document.getElementById('notesList');
const editor = document.getElementById('editor');
const editorPlaceholder = document.getElementById('editorPlaceholder');
const currentNoteTitle = document.getElementById('currentNoteTitle');
const wordCount = document.getElementById('wordCount');
const currentTime = document.getElementById('currentTime');
const searchNotes = document.getElementById('searchNotes');

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // Set random placeholder text on startup
    const randomIndex = Math.floor(Math.random() * placeholderTexts.length);
    editorPlaceholder.textContent = placeholderTexts[randomIndex];
    
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
    
    // Font size dropdown
    document.getElementById('fontsizeBtn').addEventListener('click', toggleFontSizeDropdown);
    
    // Formatting dropdown
    document.getElementById('formatBtn').addEventListener('click', toggleFormattingDropdown);
    
    // Theme toggle
    document.getElementById('themeBtn').addEventListener('click', toggleTheme);
    
    // Fullscreen toggle
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    
    // Surprise button
    document.getElementById('surpriseBtn').addEventListener('click', surpriseFont);
    
    // Editor events
    editor.addEventListener('input', handleEditorInput);
    editor.addEventListener('keydown', handleKeyDown);
    editor.addEventListener('paste', handlePaste);
    
    // Reset formatting on Enter key
    editor.addEventListener('keydown', handleFormattingReset);
    
    // Search functionality
    searchNotes.addEventListener('input', handleSearch);
    
    // Formatting toolbar
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
                const command = btn.dataset.command;
                if (command) {
                    executeCommand(command);
                    updateFormatButtonStates();
            }
        });
    });
    
    // Update format button states on selection change
    document.addEventListener('selectionchange', updateFormatButtonStates);
    editor.addEventListener('keyup', updateFormatButtonStates);
    editor.addEventListener('mouseup', updateFormatButtonStates);
    
    // Font family controls
    document.querySelectorAll('.font-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const font = e.target.dataset.font;
            updateFontFamily(font);
            closeFontDropdown();
        });
    });
    
    // Font size controls
    document.querySelectorAll('.size-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const size = e.target.dataset.size;
            updateFontSize(size);
            closeFontSizeDropdown();
        });
    });
    
    // Menu event listeners
    window.electronAPI.onNewNote(() => createNewNote());
    window.electronAPI.onSaveNote(() => saveCurrentNote());
    window.electronAPI.onToggleHistory(() => toggleSidebar());
    window.electronAPI.onToggleFullscreen(() => toggleFullscreen());
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.font-family-dropdown')) {
            closeFontDropdown();
        }
        if (!e.target.closest('.font-size-dropdown')) {
            closeFontSizeDropdown();
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
    
    // Apply font to placeholder as well
    document.getElementById('editorPlaceholder').style.fontFamily = settings.fontFamily;
    
    // Update font controls
    document.getElementById('fontsizeDisplay').textContent = `${settings.fontSize}px`;
    
    // Update active font family button
    document.querySelectorAll('.font-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.font === settings.fontFamily) {
            option.classList.add('active');
        }
    });
    
    // Update active font size button
    document.querySelectorAll('.size-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.size == settings.fontSize) {
            option.classList.add('active');
        }
    });
    
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
        notesList.innerHTML = '<div class="no-notes-message">No notes found</div>';
        return;
    }
    
    // Categorize notes by time periods
    const categories = categorizeNotesByTime(notesToRender);
    
    // Render each category
    Object.entries(categories).forEach(([categoryName, notes]) => {
        if (notes.length > 0) {
            const categorySection = createCategorySection(categoryName, notes);
            notesList.appendChild(categorySection);
        }
    });
}

// Categorize notes by time periods
function categorizeNotesByTime(notes) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const categories = {
        'Today': [],
        'Yesterday': [],
        'Last 7 days': [],
        'Last 30 days': [],
        'Older': []
    };
    
    notes.forEach(note => {
        const noteDate = new Date(note.updatedAt);
        const noteDateOnly = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());
        
        if (noteDateOnly.getTime() === today.getTime()) {
            categories['Today'].push(note);
        } else if (noteDateOnly.getTime() === yesterday.getTime()) {
            categories['Yesterday'].push(note);
        } else if (noteDate >= sevenDaysAgo) {
            categories['Last 7 days'].push(note);
        } else if (noteDate >= thirtyDaysAgo) {
            categories['Last 30 days'].push(note);
        } else {
            categories['Older'].push(note);
        }
    });
    
    // Sort notes within each category by update time (newest first)
    Object.keys(categories).forEach(key => {
        categories[key].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    });
    
    return categories;
}

// Create category section
function createCategorySection(categoryName, notes) {
    const section = document.createElement('div');
    section.className = 'category-section';
    
    // Create category header
    const header = document.createElement('div');
    header.className = 'category-header';
    header.textContent = categoryName;
    section.appendChild(header);
    
    // Create notes container
    const notesContainer = document.createElement('div');
    notesContainer.className = 'category-notes';
    
    notes.forEach(note => {
        const noteElement = createNoteListItem(note);
        notesContainer.appendChild(noteElement);
    });
    
    section.appendChild(notesContainer);
    return section;
}

// Get appropriate display text for note (time for recent, date for older)
function getDisplayTextForNote(note) {
    const noteDate = new Date(note.updatedAt);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const noteDateOnly = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());
    
    // Show time for today and yesterday
    if (noteDateOnly.getTime() === today.getTime() || noteDateOnly.getTime() === yesterday.getTime()) {
        return noteDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Show date for older entries
    const currentYear = now.getFullYear();
    const noteYear = noteDate.getFullYear();
    
    // If it's the same year, show month and day
    if (noteYear === currentYear) {
        return noteDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    // If it's a different year, show month, day, and year
    return noteDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// Create note list item
function createNoteListItem(note) {
    const div = document.createElement('div');
    div.className = 'note-item';
    div.dataset.noteId = note.id;
    
    if (currentNote && currentNote.id === note.id) {
        div.classList.add('active');
    }
    
    const date = new Date(note.updatedAt);
    const displayText = getDisplayTextForNote(note);
    
    // Extract title from first line of content for consistency
    let title = note.title || 'Untitled Note';
    if (note.content) {
        const contentText = new DOMParser().parseFromString(note.content, 'text/html').body.textContent;
        const firstLine = contentText.split('\n')[0].trim();
        if (firstLine) {
            title = firstLine.length > 25 ? firstLine.substring(0, 22) + '...' : firstLine;
        }
    }
    
    div.innerHTML = `
        <div class="note-item-content">
            <div class="note-item-title">${title}</div>
            <div class="note-item-time">${displayText}</div>
        </div>
        <div class="note-item-actions">
            <button class="note-action-btn delete-note" data-note-id="${note.id}" title="Delete">
                <i class="ph ph-trash" style="font-size: 12px;"></i>
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
    editor.innerHTML = note.content;
    
    // Store original content for change detection
    currentNote.originalContent = note.content;
    
    // Update title from content
    updateTitleFromContent();
    
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
        title: 'Untitled Note',
        content: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: []
    };
    
    editor.innerHTML = '';
    
    // Apply title character limit for display
    let displayTitle = 'Untitled Note';
    if (displayTitle.length > 15) {
        displayTitle = displayTitle.substring(0, 12) + '...';
    }
    currentNoteTitle.textContent = displayTitle;
    
    // Set random placeholder text
    const randomIndex = Math.floor(Math.random() * placeholderTexts.length);
    editorPlaceholder.textContent = placeholderTexts[randomIndex];
    
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
        // Check if content has actually changed before updating timestamp
        const contentChanged = currentNote.originalContent !== editor.innerHTML;
        
        const noteData = {
            ...currentNote,
            content: editor.innerHTML,
            // Only update timestamp if content changed
            updatedAt: contentChanged ? new Date().toISOString() : currentNote.updatedAt
        };
        
        const result = await window.electronAPI.saveNote(noteData);
        if (result.success) {
            currentNote = result.note;
            // Store original content for future comparison
            currentNote.originalContent = currentNote.content;
            
            // Apply title character limit for display
            let displayTitle = currentNote.title;
            if (displayTitle.length > 15) {
                displayTitle = displayTitle.substring(0, 12) + '...';
            }
            currentNoteTitle.textContent = displayTitle;
            
            // Only refresh list if content changed (which may affect title)
            if (contentChanged) {
                await loadNotes();
            }
        }
    } catch (error) {
        console.error('Error saving note:', error);
    }
}

// Auto-save functionality
async function autoSave() {
    if (currentNote && editor.innerHTML.trim()) {
        await saveCurrentNote();
    }
}

// Export current note
async function exportCurrentNote() {
    if (!currentNote) return;
    
    try {
        const noteToExport = {
            title: currentNote.title || 'Untitled Note',
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
    
    const filteredNotes = allNotes.filter(note => {
        // Convert HTML content to plain text for searching
        const contentText = new DOMParser().parseFromString(note.content, 'text/html').body.textContent.toLowerCase();
        return contentText.includes(query);
    });
    
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
function handleEditorInput(e) {
    updatePlaceholder();
    updateWordCount();
    
    // Check for dash list auto-activation when space is typed
    if (e && e.inputType === 'insertText' && e.data === ' ') {
        checkForDashListActivation();
    }
    
    if (currentNote) {
        currentNote.content = editor.innerHTML;
        
        // Update title based on first line of content
        updateTitleFromContent();
    }
}

function checkForDashListActivation() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const currentLineText = getCurrentLineText();
    
    // Check if the current line is exactly "- " (dash followed by space)
    if (currentLineText === '- ') {
        isDashListMode = true;
    }
}

function getTextBeforeCursor(range) {
    const textNode = range.startContainer;
    if (textNode.nodeType === Node.TEXT_NODE) {
        return textNode.textContent.substring(0, range.startOffset);
    }
    return '';
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

// Title functions removed as we no longer have a separate title input

// Extract title from first line of content
function updateTitleFromContent() {
    if (!currentNote || !editor.textContent) return;
    
    // Get the first line of text
    let firstLine = editor.textContent.split('\n')[0].trim();
    
    // Use the first line as title, or 'Untitled Note' if empty
    const newTitle = firstLine || 'Untitled Note';
    
    // Update note's full title
    if (currentNote.title !== newTitle) {
        currentNote.title = newTitle;
        
        // Limit title bar display to 15 characters max
        let displayTitle = newTitle;
        if (displayTitle.length > 15) {
            displayTitle = displayTitle.substring(0, 12) + '...';
        }
        
        // Update the title bar with shortened title
        currentNoteTitle.textContent = displayTitle;
    }
}

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    currentTime.textContent = timeString;
}

// Keyboard shortcuts
function handleKeyDown(e) {
    // Handle Enter key for dash list continuation
    if (e.key === 'Enter') {
        if (isDashListMode) {
            e.preventDefault();
            
            // Get current line content
        const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            
            // Check if current line has content after the dash
            const currentLineText = getCurrentLineText();
            
            if (currentLineText.trim() === '-' || currentLineText.trim() === '') {
                // Empty line or just dash - exit dash list mode with double enter
                isDashListMode = false;
                document.execCommand('insertHTML', false, '<br>');
            } else {
                // Continue dash list
                document.execCommand('insertHTML', false, '<br>- ');
            }
                
                return;
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

// Dash list functionality
let isDashListMode = false;

function insertDashList() {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    
    // Insert dash and space
    document.execCommand('insertText', false, '- ');
    isDashListMode = true;
    
    editor.focus();
}

function getCurrentLineText() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return '';
    
    const range = selection.getRangeAt(0);
    let currentNode = range.startContainer;
    
    // If we're in a text node, get its content up to the cursor
    if (currentNode.nodeType === Node.TEXT_NODE) {
        const textContent = currentNode.textContent;
        const cursorPosition = range.startOffset;
        
        // Find the last newline before cursor, or start of text
        const lastNewline = textContent.lastIndexOf('\n', cursorPosition - 1);
        const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
        
        return textContent.substring(lineStart, cursorPosition);
    }
    
    // For element nodes, try to get text content
    return currentNode.textContent ? currentNode.textContent.trim() : '';
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
    // Close other dropdowns if open
    closeFontSizeDropdown();
    closeFormattingDropdown();
}

function closeFontDropdown() {
    const dropdown = document.getElementById('fontDropdownContent');
    dropdown.classList.remove('show');
}

function toggleFontSizeDropdown() {
    const dropdown = document.getElementById('fontsizeDropdownContent');
    dropdown.classList.toggle('show');
    // Close other dropdowns if open
    closeFontDropdown();
    closeFormattingDropdown();
}

function closeFontSizeDropdown() {
    const dropdown = document.getElementById('fontsizeDropdownContent');
    dropdown.classList.remove('show');
}

// Formatting dropdown management
function toggleFormattingDropdown() {
    const dropdown = document.getElementById('formattingDropdownContent');
    dropdown.classList.toggle('show');
    // Close other dropdowns if open
    closeFontDropdown();
    closeFontSizeDropdown();
}

function closeFormattingDropdown() {
    const dropdown = document.getElementById('formattingDropdownContent');
    dropdown.classList.remove('show');
}

function updateFontSize(size) {
    settings.fontSize = parseInt(size);
    editor.style.fontSize = `${size}px`;
    document.getElementById('fontsizeDisplay').textContent = `${size}px`;
    
    // Update active button
    document.querySelectorAll('.size-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.size == size) {
            option.classList.add('active');
        }
    });
    
    saveSettings();
}

function updateFontFamily(family) {
    settings.fontFamily = family;
    editor.style.fontFamily = family;
    
    // Apply font to placeholder as well
    document.getElementById('editorPlaceholder').style.fontFamily = family;
    
    // Update active button
    document.querySelectorAll('.font-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.font === family) {
            option.classList.add('active');
        }
    });
    
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
    const icon = themeBtn.querySelector('i');
    if (settings.theme === 'light') {
        span.textContent = 'Dark Mode';
        themeBtn.setAttribute('title', 'Switch to Dark Mode');
        icon.className = 'ph ph-moon';
    } else {
        span.textContent = 'Light Mode';
        themeBtn.setAttribute('title', 'Switch to Light Mode');
        icon.className = 'ph ph-sun';
    }
}

// Surprise font functionality
function surpriseFont() {
    const availableFonts = ['Aeonik', 'Baskervville', 'Instrument Serif', 'Neue Regrade', 'Patrick Hand', 'Courier New'];
    
    // Get current font to avoid selecting the same one
    const currentFont = settings.fontFamily;
    
    // Filter out current font to ensure we get a different one
    const otherFonts = availableFonts.filter(font => font !== currentFont);
    
    // Select random font from remaining options
    const randomIndex = Math.floor(Math.random() * otherFonts.length);
    const randomFont = otherFonts[randomIndex];
    
    // Update to the new random font
    updateFontFamily(randomFont);
    
    // Add a brief visual feedback effect
    const surpriseBtn = document.getElementById('surpriseBtn');
    surpriseBtn.style.transform = 'scale(0.95)';
    surpriseBtn.style.transition = 'transform 0.1s ease';
    
    setTimeout(() => {
        surpriseBtn.style.transform = 'scale(1)';
        surpriseBtn.style.transition = 'transform 0.2s ease';
    }, 100);
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

// Fullscreen functionality
function toggleFullscreen() {
    const appContainer = document.querySelector('.app-container');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    appContainer.classList.toggle('fullscreen-mode');
    
    if (appContainer.classList.contains('fullscreen-mode')) {
        // Don't add active class styling
        fullscreenBtn.querySelector('span').textContent = 'Exit Fullscreen';
        
        // Request fullscreen API if available
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        }
    } else {
        fullscreenBtn.querySelector('span').textContent = 'Fullscreen';
        
        // Exit fullscreen API if available
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
    
    // Adjust editor focus
    setTimeout(() => {
        editor.focus();
    }, 100);
}

// Listen for ESC key to exit fullscreen
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.querySelector('.app-container').classList.contains('fullscreen-mode')) {
        toggleFullscreen();
    }
}); 