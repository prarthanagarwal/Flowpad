// Application state
let currentNote = null;
let allNotes = [];
let allFolders = [];
let currentFolder = 'all'; // 'all' means show all notes, otherwise folder ID
let settings = {
    fontSize: 16,
    fontFamily: 'Aeonik',
    theme: 'dark',
    autoSave: true,
    wordWrap: true
};

// Platform detection
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

// Update tooltips with platform-specific shortcuts
function updateTooltips() {
    const modKey = isMac ? 'Cmd' : 'Ctrl';
    
    // Format buttons
    const boldBtn = document.getElementById('boldBtn');
    const italicBtn = document.getElementById('italicBtn');
    const underlineBtn = document.getElementById('underlineBtn');
    
    if (boldBtn) boldBtn.title = `Bold (${modKey}+B)`;
    if (italicBtn) italicBtn.title = `Italic (${modKey}+I)`;
    if (underlineBtn) underlineBtn.title = `Underline (${modKey}+U)`;
    
    // Other buttons with shortcuts
    const newNoteBtn = document.getElementById('newNoteBtn');
    const historyBtn = document.getElementById('historyBtn');
    
    if (newNoteBtn) newNoteBtn.title = `New Note (${modKey}+N)`;
    if (historyBtn) historyBtn.title = `Toggle History (${modKey}+H)`;
}

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
const folderTabs = document.getElementById('folderTabs');
const newFolderBtn = document.getElementById('newFolderBtn');

// Update notification elements
const updateNotification = document.getElementById('updateNotification');
const updateText = document.getElementById('updateText');
const updateProgress = document.getElementById('updateProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const downloadBtn = document.getElementById('downloadBtn');
const installBtn = document.getElementById('installBtn');
const dismissBtn = document.getElementById('dismissBtn');

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // Set random placeholder text on startup
    const randomIndex = Math.floor(Math.random() * placeholderTexts.length);
    editorPlaceholder.textContent = placeholderTexts[randomIndex];
    
    await loadSettings();
    await loadFolders();
    await loadNotes();
    setupEventListeners();
    updateTooltips();
    updateTime();
    setInterval(updateTime, 1000);
    
    // Apply initial global settings (before any note is loaded)
    applySettings();
    
    // Create initial note if no notes exist or no current note
    if (allNotes.length === 0 || !currentNote) {
        createNewNote();
    } else if (currentNote) {
        // If we have a current note, apply its font settings
        applyNoteFontSettings();
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
    
    // Custom window controls
    document.getElementById('minimizeBtn').addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
    });
    
    document.getElementById('closeBtn').addEventListener('click', () => {
        window.electronAPI.closeApp();
    });
    
    // Surprise button
    document.getElementById('surpriseBtn').addEventListener('click', surpriseFont);
    
    // Editor events
    editor.addEventListener('input', handleEditorInput);
    editor.addEventListener('keyup', handleEditorInput);
    editor.addEventListener('paste', handlePaste);
    editor.addEventListener('keydown', handleKeyDown);
    editor.addEventListener('keyup', updateFormatButtonStates);
    editor.addEventListener('mouseup', updateFormatButtonStates);
    editor.addEventListener('focus', updateFormatButtonStates);
    editor.addEventListener('click', () => {
        // Ensure editor maintains focus when clicked
        if (!editor.contains(document.activeElement)) {
            focusEditor();
        }
    });
    
    // Reset formatting on Enter key
    editor.addEventListener('keydown', handleFormattingReset);
    
    // Search functionality
    searchNotes.addEventListener('input', handleSearch);
    
    // Folder functionality
    newFolderBtn.addEventListener('click', createNewFolder);
    
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
    
    // Auto-update event listeners
    window.electronAPI.onUpdateStatus((event, status) => {
        handleUpdateStatus(status);
    });
    
    // Handle manual update check from menu
    window.electronAPI.onCheckForUpdates(() => {
        window.electronAPI.checkForUpdates();
    });
    
    // Update notification event listeners
    downloadBtn.addEventListener('click', handleDownloadUpdate);
    installBtn.addEventListener('click', handleInstallUpdate);
    dismissBtn.addEventListener('click', hideUpdateNotification);
    
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

// Apply per-note font settings to the UI
function applyNoteFontSettings() {
    if (!currentNote) return;
    
    // Apply note's font settings to editor
    editor.style.fontSize = `${currentNote.fontSize}px`;
    editor.style.fontFamily = currentNote.fontFamily;
    
    // Apply font to placeholder as well
    document.getElementById('editorPlaceholder').style.fontFamily = currentNote.fontFamily;
    
    // Update font controls to reflect current note's settings
    document.getElementById('fontsizeDisplay').textContent = `${currentNote.fontSize}px`;
    
    // Update active font family button
    document.querySelectorAll('.font-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.font === currentNote.fontFamily) {
            option.classList.add('active');
        }
    });
    
    // Update active font size button
    document.querySelectorAll('.size-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.size == currentNote.fontSize) {
            option.classList.add('active');
        }
    });
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
function renderNotesList(notesToRender = null) {
    // If no specific notes provided, use filtered notes based on current folder
    if (!notesToRender) {
        notesToRender = getFilteredNotes();
    }
    
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
    
    // Create time display with folder info
    let timeDisplay = displayText;
    let folderInfo = '';
    
    if (note.folder && currentFolder === 'all') {
        const folder = allFolders.find(f => f.id === note.folder);
        if (folder) {
            folderInfo = `<span class="folder-separator">·</span><i class="ph ph-folder-simple note-folder-icon"></i><span class="folder-name">${folder.name}</span>`;
        }
    }
    
    div.innerHTML = `
        <div class="note-item-content">
            <div class="note-item-title">${title}</div>
            <div class="note-item-time">
                <span class="time-text">${timeDisplay}</span>${folderInfo}
            </div>
        </div>
        <div class="note-item-actions">
            <button class="note-action-btn move-note" data-note-id="${note.id}" title="Move to Folder">
                <i class="ph ph-folder-simple" style="font-size: 12px;"></i>
            </button>
            <button class="note-action-btn delete-note" data-note-id="${note.id}" title="Delete">
                <i class="ph ph-trash" style="font-size: 12px;"></i>
            </button>
        </div>
    `;
    
    // Make draggable
    div.draggable = true;
    
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
    
    // Add move note event
    div.querySelector('.move-note').addEventListener('click', (e) => {
        e.stopPropagation();
        showMoveNoteMenu(e, note);
    });
    
    // Add drag events
    div.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', note.id);
        div.classList.add('dragging');
    });
    
    div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
    });
    
    // Add right-click context menu
    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMoveNoteMenu(e, note);
    });
    
    return div;
}

// Load a specific note
function loadNote(note) {
    currentNote = note;
    
    // Handle backward compatibility - add font settings if they don't exist
    if (!currentNote.fontSize) {
        currentNote.fontSize = settings.fontSize;
    }
    if (!currentNote.fontFamily) {
        currentNote.fontFamily = settings.fontFamily;
    }
    
    editor.innerHTML = note.content;
    
    // Store original content for change detection
    currentNote.originalContent = note.content;
    
    // Update title from content
    updateTitleFromContent();
    
    // Apply the note's font settings to editor
    applyNoteFontSettings();
    
    updatePlaceholder();
    updateWordCount();
    
    // Update active state in sidebar
    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-note-id="${note.id}"]`)?.classList.add('active');
    
    // Ensure editor has focus and cursor is positioned properly
    setTimeout(() => {
        focusEditor();
    }, 100); // Small delay to ensure DOM updates are complete
}

// Create new note
function createNewNote() {
    // Get folder name if creating in a specific folder
    let folderName = null;
    if (currentFolder !== 'all') {
        const folder = allFolders.find(f => f.id === currentFolder);
        folderName = folder ? folder.name : null;
    }
    
    currentNote = {
        id: Date.now().toString(),
        title: 'Untitled Note',
        content: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        fontSize: settings.fontSize,  // Store current font size with note
        fontFamily: settings.fontFamily,  // Store current font family with note
        folder: currentFolder === 'all' ? null : currentFolder,  // Assign current folder
        folderName: folderName  // Assign current folder name
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
    
    // Apply the note's font settings to editor
    applyNoteFontSettings();
    
    focusEditor(false); // Don't position at end for new note
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
    
    // Start with notes from current folder, then filter by search query
    const folderNotes = getFilteredNotes();
    const filteredNotes = folderNotes.filter(note => {
        // Convert HTML content to plain text for searching
        const contentText = new DOMParser().parseFromString(note.content, 'text/html').body.textContent.toLowerCase();
        return contentText.includes(query);
    });
    
    renderNotesList(filteredNotes);
}

// ===== FOLDER FUNCTIONALITY =====

// Load all folders
async function loadFolders() {
    try {
        const result = await window.electronAPI.getFolders();
        if (result.success) {
            allFolders = result.folders;
            renderFolderTabs();
        }
    } catch (error) {
        console.error('Error loading folders:', error);
    }
}

// Render folder tabs
function renderFolderTabs() {
    folderTabs.innerHTML = '';
    
    // Add "All" tab
    const allTab = document.createElement('button');
    allTab.className = 'folder-tab';
    allTab.dataset.folder = 'all';
    allTab.textContent = 'All';
    if (currentFolder === 'all') {
        allTab.classList.add('active');
    }
    allTab.addEventListener('click', () => switchFolder('all'));
    
    // Add drop events for "All" tab (moves note out of any folder)
    allTab.addEventListener('dragover', (e) => {
        e.preventDefault();
        allTab.classList.add('drag-over');
    });
    
    allTab.addEventListener('dragleave', () => {
        allTab.classList.remove('drag-over');
    });
    
    allTab.addEventListener('drop', async (e) => {
        e.preventDefault();
        allTab.classList.remove('drag-over');
        
        const noteId = e.dataTransfer.getData('text/plain');
        if (noteId) {
            await moveNoteToFolder(noteId, null); // null means no folder
        }
    });
    
    folderTabs.appendChild(allTab);
    
    // Add folder tabs
    allFolders.forEach(folder => {
        const tab = document.createElement('button');
        tab.className = 'folder-tab';
        tab.dataset.folder = folder.id;
        tab.textContent = folder.name;
        if (currentFolder === folder.id) {
            tab.classList.add('active');
        }
        tab.addEventListener('click', () => switchFolder(folder.id));
        
        // Add right-click context menu for folder actions
        tab.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showFolderContextMenu(e, folder);
        });
        
        // Add drop events for drag & drop note moving
        tab.addEventListener('dragover', (e) => {
            e.preventDefault();
            tab.classList.add('drag-over');
        });
        
        tab.addEventListener('dragleave', () => {
            tab.classList.remove('drag-over');
        });
        
        tab.addEventListener('drop', async (e) => {
            e.preventDefault();
            tab.classList.remove('drag-over');
            
            const noteId = e.dataTransfer.getData('text/plain');
            if (noteId) {
                await moveNoteToFolder(noteId, folder.id);
            }
        });
        
        folderTabs.appendChild(tab);
    });
}

// Switch to a specific folder
function switchFolder(folderId) {
    currentFolder = folderId;
    
    // Update active tab
    document.querySelectorAll('.folder-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.folder === folderId) {
            tab.classList.add('active');
        }
    });
    
    // Filter and render notes
    renderNotesList();
}

// Create new folder
async function createNewFolder() {
    const folderId = Date.now().toString();
    let folderName = 'New Folder';
    
    // Find a unique name if "New Folder" already exists
    let counter = 1;
    while (allFolders.find(f => f.name.toLowerCase() === folderName.toLowerCase())) {
        counter++;
        folderName = `New Folder ${counter}`;
    }
    
    try {
        const result = await window.electronAPI.saveFolder({
            id: folderId,
            name: folderName
        });
        
        if (result.success) {
            await loadFolders();
            // Start editing the newly created folder
            setTimeout(() => {
                const newTab = document.querySelector(`[data-folder="${folderId}"]`);
                if (newTab) {
                    startEditingFolder(newTab, result.folder);
                }
            }, 100);
        }
    } catch (error) {
        console.error('Error creating folder:', error);
    }
}

// Start editing folder name
function startEditingFolder(tabElement, folder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = folder.name;
    input.className = 'folder-tab editing';
    input.dataset.folder = folder.id;
    
    // Replace the button with input
    tabElement.parentNode.replaceChild(input, tabElement);
    input.focus();
    input.select();
    
    // Handle save on Enter or blur
    const saveEdit = async () => {
        const newName = input.value.trim();
        if (newName && newName !== folder.name) {
            // Check if folder name already exists
            const existingFolder = allFolders.find(f => f.id !== folder.id && f.name.toLowerCase() === newName.toLowerCase());
            if (existingFolder) {
                alert(`A folder named "${newName}" already exists. Please choose a different name.`);
                input.focus();
                input.select();
                return;
            }
            
            try {
                const result = await window.electronAPI.saveFolder({
                    id: folder.id,
                    name: newName
                });
                if (result.success) {
                    await loadFolders();
                    // Update folderName in all notes that reference this folder
                    await updateNotesWithNewFolderName(folder.id, newName);
                }
            } catch (error) {
                console.error('Error saving folder:', error);
                await loadFolders(); // Revert on error
            }
        } else {
            await loadFolders(); // Revert if no change or empty
        }
    };
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            loadFolders(); // Cancel editing
        }
    });
    
    input.addEventListener('blur', saveEdit);
}

// Show folder context menu
function showFolderContextMenu(event, folder) {
    // Remove any existing context menu
    const existingMenu = document.querySelector('.folder-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'folder-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.zIndex = '10000';
    
    menu.innerHTML = `
        <div class="context-menu-item" data-action="rename">
            <i class="ph ph-pencil-simple" style="font-size: 12px;"></i>
            Rename
        </div>
        <div class="context-menu-item" data-action="delete">
            <i class="ph ph-trash" style="font-size: 12px;"></i>
            Delete
        </div>
    `;
    
    // Add event listeners
    menu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            const action = e.currentTarget.dataset.action;
            
            if (action === 'rename') {
                const tabElement = document.querySelector(`[data-folder="${folder.id}"]`);
                if (tabElement) {
                    startEditingFolder(tabElement, folder);
                }
            } else if (action === 'delete') {
                if (confirm(`Are you sure you want to delete the folder "${folder.name}"? Notes in this folder will be moved to "All".`)) {
                    try {
                        const result = await window.electronAPI.deleteFolder(folder.id);
                        if (result.success) {
                            if (currentFolder === folder.id) {
                                switchFolder('all');
                            }
                            await loadFolders();
                            await loadNotes(); // Refresh notes as some may have moved
                        }
                    } catch (error) {
                        console.error('Error deleting folder:', error);
                    }
                }
            }
            
            menu.remove();
        });
    });
    
    document.body.appendChild(menu);
    
    // Remove menu when clicking elsewhere
    setTimeout(() => {
        document.addEventListener('click', function removeMenu() {
            menu.remove();
            document.removeEventListener('click', removeMenu);
        });
    }, 0);
}

// Get filtered notes based on current folder
function getFilteredNotes() {
    if (currentFolder === 'all') {
        return allNotes;
    }
    return allNotes.filter(note => note.folder === currentFolder);
}

// Move note to a specific folder
async function moveNoteToFolder(noteId, folderId) {
    try {
        const note = allNotes.find(n => n.id === noteId);
        if (!note) return;
        
        // Get folder name if moving to a folder
        let folderName = null;
        if (folderId) {
            const folder = allFolders.find(f => f.id === folderId);
            folderName = folder ? folder.name : null;
        }
        
        // Update note's folder and folderName
        const updatedNote = { ...note, folder: folderId, folderName: folderName };
        const result = await window.electronAPI.saveNote(updatedNote);
        
        if (result.success) {
            // Update local notes array
            const noteIndex = allNotes.findIndex(n => n.id === noteId);
            if (noteIndex > -1) {
                allNotes[noteIndex] = result.note;
            }
            
            // Update current note if it's the one being moved
            if (currentNote && currentNote.id === noteId) {
                currentNote = result.note;
            }
            
            // Refresh the notes list
            renderNotesList();
        }
    } catch (error) {
        console.error('Error moving note to folder:', error);
    }
}

// Show move note context menu
function showMoveNoteMenu(event, note) {
    // Remove any existing context menu
    const existingMenu = document.querySelector('.move-note-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'move-note-menu folder-context-menu';
    menu.style.position = 'fixed';
    menu.style.zIndex = '10000';
    
    let menuItems = '';
    
    // Only show "Remove from folder" if note is currently in a folder
    if (note.folder) {
        const currentFolder = allFolders.find(f => f.id === note.folder);
        const folderName = currentFolder ? currentFolder.name : 'folder';
        menuItems += `
            <div class="context-menu-item" data-folder="null">
                <i class="ph ph-x" style="font-size: 12px;"></i>
                Remove from ${folderName}
            </div>
        `;
        
        // Add separator if there are other folders
        if (allFolders.length > 0) {
            menuItems += '<div class="context-menu-separator"></div>';
        }
    }
    
    allFolders.forEach(folder => {
        const isCurrentFolder = note.folder === folder.id;
        if (!isCurrentFolder) { // Only show folders the note is NOT in
            menuItems += `
                <div class="context-menu-item" data-folder="${folder.id}">
                    <i class="ph ph-folder-simple" style="font-size: 12px;"></i>
                    Move to ${folder.name}
                </div>
            `;
        }
    });
    
    menu.innerHTML = menuItems;
    
    // Position menu and adjust if it would go off-screen
    document.body.appendChild(menu); // Add to DOM first to get dimensions
    
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = event.clientX;
    let top = event.clientY;
    
    // Adjust horizontal position if menu would go off right edge
    if (left + menuRect.width > viewportWidth) {
        left = viewportWidth - menuRect.width - 10;
    }
    
    // Adjust vertical position if menu would go off bottom edge
    if (top + menuRect.height > viewportHeight) {
        top = viewportHeight - menuRect.height - 10;
    }
    
    // Ensure menu doesn't go off left or top edge
    left = Math.max(10, left);
    top = Math.max(10, top);
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    
    // Add event listeners
    menu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            const folderId = e.currentTarget.dataset.folder;
            const targetFolder = folderId === 'null' ? null : folderId;
            
            await moveNoteToFolder(note.id, targetFolder);
            menu.remove();
        });
    });
    
    // Remove menu when clicking elsewhere
    setTimeout(() => {
        document.addEventListener('click', function removeMenu() {
            menu.remove();
            document.removeEventListener('click', removeMenu);
        });
    }, 0);
}

// Update folderName in all notes when a folder is renamed
async function updateNotesWithNewFolderName(folderId, newFolderName) {
    try {
        const notesToUpdate = allNotes.filter(note => note.folder === folderId);
        
        for (const note of notesToUpdate) {
            const updatedNote = { ...note, folderName: newFolderName };
            await window.electronAPI.saveNote(updatedNote);
            
            // Update local notes array
            const noteIndex = allNotes.findIndex(n => n.id === note.id);
            if (noteIndex > -1) {
                allNotes[noteIndex] = updatedNote;
            }
            
            // Update current note if it's one of the updated notes
            if (currentNote && currentNote.id === note.id) {
                currentNote = updatedNote;
            }
        }
        
        // Refresh the notes list to show updated folder names
        renderNotesList();
    } catch (error) {
        console.error('Error updating notes with new folder name:', error);
    }
}

// Helper function for consistent editor focus management
function focusEditor(positionAtEnd = true) {
    editor.focus();
    
    if (positionAtEnd && editor.innerHTML.trim() !== '') {
        // Position cursor at the end of the content
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false); // Collapse to end
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

// Sidebar management
function toggleSidebar() {
    const isOpening = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('show');
    
    // If closing sidebar, restore focus to editor after animation
    if (!isOpening) {
        setTimeout(() => {
            focusEditor();
        }, 350); // Wait for sidebar animation to complete
    }
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('show');
    
    // Restore focus to editor after sidebar closes
    setTimeout(() => {
        focusEditor();
    }, 350); // Wait for sidebar animation to complete
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

// Extract title from first line of content
function updateTitleFromContent() {
    if (!currentNote) return;
    
    // Get the text content and handle empty/whitespace cases properly
    const textContent = editor.textContent || editor.innerText || '';
    const trimmedContent = textContent.trim();
    
    // If content is completely empty, use 'New Note'
    if (!trimmedContent) {
        const newTitle = 'New Note';
        if (currentNote.title !== newTitle) {
            currentNote.title = newTitle;
            currentNoteTitle.textContent = newTitle;
        }
        return;
    }
    
    // Get the first line of text
    let firstLine = trimmedContent.split('\n')[0].trim();
    
    // Use the first line as title, or 'New Note' if first line is empty
    const newTitle = firstLine || 'New Note';
    
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
                document.execCommand('insertText', false, '\n');
            } else {
                // Continue dash list
                document.execCommand('insertText', false, '\n- ');
            }
                
                return;
        }
    }
    
    // Save shortcut
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentNote();
        return;
    }
    
    // New note shortcut
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        createNewNote();
        return;
    }
    
    // Bold shortcut
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        executeCommand('bold');
        return;
    }
    
    // Italic shortcut
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        executeCommand('italic');
        return;
    }
    
    // Underline shortcut
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'u') {
        e.preventDefault();
        executeCommand('underline');
        return;
    }
    
    // Toggle history shortcut
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'h') {
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
    if (!currentNote) return;
    
    // Update current note's font size
    currentNote.fontSize = parseInt(size);
    
    // Apply to editor
    editor.style.fontSize = `${size}px`;
    document.getElementById('fontsizeDisplay').textContent = `${size}px`;
    
    // Update active button
    document.querySelectorAll('.size-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.size == size) {
            option.classList.add('active');
        }
    });
    
    // Auto-save the note with new font settings
    saveCurrentNote();
}

function updateFontFamily(family) {
    if (!currentNote) return;
    
    // Update current note's font family
    currentNote.fontFamily = family;
    
    // Apply to editor
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
    
    // Auto-save the note with new font settings
    saveCurrentNote();
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
    if (!currentNote) return;
    
    const availableFonts = ['Aeonik', 'Baskervville', 'Instrument Serif', 'Neue Regrade', 'Patrick Hand', 'Courier New'];
    
    // Get current font to avoid selecting the same one
    const currentFont = currentNote.fontFamily;
    
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
    focusEditor(false);
});

// Maintain editor focus when window regains focus
window.addEventListener('focus', () => {
    // Small delay to ensure the window is fully focused
    setTimeout(() => {
        if (!sidebar.classList.contains('open')) {
            focusEditor();
        }
    }, 100);
});

// Handle visibility change to maintain focus
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !sidebar.classList.contains('open')) {
        setTimeout(() => {
            focusEditor();
        }, 100);
    }
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
        focusEditor();
    }, 100);
}

// Listen for ESC key to exit fullscreen
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.querySelector('.app-container').classList.contains('fullscreen-mode')) {
        toggleFullscreen();
    }
});

// Auto-update functionality
let updateState = {
    available: false,
    downloading: false,
    downloaded: false,
    error: null,
    version: null
};

function handleUpdateStatus(status) {
    console.log('Update status:', status);
    
    switch (status.type) {
        case 'checking':
            // Optionally show checking status, but keep it minimal
            break;
            
        case 'available':
            updateState.available = true;
            updateState.version = status.version;
            showUpdateNotification(`Update ${status.version} available`, 'available');
            break;
            
        case 'not-available':
            // No update available - don't show notification
            break;
            
        case 'download-progress':
            updateState.downloading = true;
            const percent = Math.round(status.percent);
            showUpdateProgress(percent);
            updateText.textContent = `Downloading ${updateState.version}...`;
            break;
            
        case 'downloaded':
            updateState.downloading = false;
            updateState.downloaded = true;
            showUpdateNotification(`Update ready to install`, 'ready');
            hideUpdateProgress();
            downloadBtn.style.display = 'none';
            installBtn.style.display = 'flex';
            break;
            
        case 'error':
            updateState.error = status.message;
            showUpdateNotification('Update failed', 'error');
            console.error('Update error:', status.message);
            
            // Auto-hide error after 5 seconds
            setTimeout(() => {
                hideUpdateNotification();
            }, 5000);
            break;
    }
}

function showUpdateNotification(message, type = 'available') {
    updateText.textContent = message;
    updateNotification.style.display = 'flex';
    
    // Reset classes
    updateNotification.className = 'update-notification';
    
    // Add appropriate class based on type
    if (type === 'downloading') {
        updateNotification.classList.add('downloading');
    } else if (type === 'ready') {
        updateNotification.classList.add('ready');
    }
    
    // Show/hide appropriate buttons
    if (type === 'available') {
        downloadBtn.style.display = 'flex';
        installBtn.style.display = 'none';
    } else if (type === 'ready') {
        downloadBtn.style.display = 'none';
        installBtn.style.display = 'flex';
    }
}

function showUpdateProgress(percent) {
    updateProgress.style.display = 'flex';
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
    
    updateNotification.className = 'update-notification downloading';
}

function hideUpdateProgress() {
    updateProgress.style.display = 'none';
}

function hideUpdateNotification() {
    updateNotification.style.display = 'none';
    updateState = {
        available: false,
        downloading: false,
        downloaded: false,
        error: null,
        version: null
    };
}

async function handleDownloadUpdate() {
    if (updateState.available && !updateState.downloading) {
        try {
            updateState.downloading = true;
            showUpdateNotification(`Downloading ${updateState.version}...`, 'downloading');
            await window.electronAPI.downloadUpdate();
        } catch (error) {
            console.error('Failed to download update:', error);
            showUpdateNotification('Download failed', 'error');
            updateState.downloading = false;
        }
    }
}

async function handleInstallUpdate() {
    if (updateState.downloaded) {
        try {
            // Save current note before restarting
            if (currentNote && currentNote.content !== editor.innerHTML) {
                await saveCurrentNote();
            }
            
            // Install and restart
            await window.electronAPI.quitAndInstall();
        } catch (error) {
            console.error('Failed to install update:', error);
            showUpdateNotification('Install failed', 'error');
        }
    }
}