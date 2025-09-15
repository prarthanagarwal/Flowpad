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

    // Initialize AI status
    setTimeout(() => {
        updateAIStatus();
    }, 500);
    
    // Apply initial global settings (before any note is loaded)
    applySettings();
    
    // Create initial note if no notes exist or no current note
    if (allNotes.length === 0 || !currentNote) {
        await createNewNote();
    } else if (currentNote) {
        // If we have a current note, apply its font settings
        applyNoteFontSettings();
    }
    
    // Auto-save functionality - backup timer every 30 seconds
    setInterval(() => {
        if (currentNote && editor.innerHTML.trim() && currentNote.originalContent !== editor.innerHTML) {
            console.log('Backup auto-save triggered');
            autoSave();
        }
    }, 30000);
});

// Event Listeners Setup
function setupEventListeners() {
    // Sidebar toggle
    document.getElementById('historyBtn').addEventListener('click', toggleSidebar);
    document.getElementById('closeSidebar').addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
    
    // New note
    document.getElementById('newNoteBtn').addEventListener('click', async () => {
        await createNewNote();
    });
    
    // Font dropdown
    document.getElementById('fontBtn').addEventListener('click', toggleFontDropdown);
    
    // Font size dropdown
    document.getElementById('fontsizeBtn').addEventListener('click', toggleFontSizeDropdown);
    
    // Formatting dropdown
    document.getElementById('formatBtn').addEventListener('click', toggleFormattingDropdown);
    
    // Theme toggle
    document.getElementById('themeBtn').addEventListener('click', toggleTheme);

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);

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
    editor.addEventListener('paste', async (e) => {
        e.preventDefault();
        await handlePaste(editor);
    });
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

    // Context menu for editor
    editor.addEventListener('contextmenu', showEditorContextMenu);
    
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
    window.electronAPI.onNewNote(async () => await createNewNote());
    window.electronAPI.onSaveNote(async () => await saveCurrentNote());
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

// Apply per-note font settings to the UI
function applyNoteFontSettings() {
    if (!currentNote) return;
    
    // Debug font application for non-default fonts
    if (currentNote.fontSize !== 16 || currentNote.fontFamily !== 'Aeonik') {
        console.log(`Applying font settings - fontSize: ${currentNote.fontSize}px, fontFamily: "${currentNote.fontFamily}" for note: "${currentNote.title}"`);
    }
    
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
    
    if (currentNote.fontSize !== 16 || currentNote.fontFamily !== 'Aeonik') {
        console.log(`Font settings applied successfully to editor`);
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
        } else {
            console.error('Failed to load notes:', result.error);
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
    
    // Extract title using centralized logic for consistency
    let title = extractTitleFromContent(note.content);
    
    // Apply character limit for sidebar display
    if (title.length > 25) {
        title = title.substring(0, 22) + '...';
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
    
    // Add click event to load note (async to handle auto-save)
    div.addEventListener('click', async (e) => {
        if (!e.target.closest('.note-item-actions')) {
            await loadNote(note);
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

// Load a specific note (with auto-save protection)
async function loadNote(note) {
    // CRITICAL: Save current note before switching if content has changed
    if (currentNote && editor.innerHTML.trim()) {
        const hasUnsavedChanges = currentNote.originalContent !== editor.innerHTML;
        if (hasUnsavedChanges) {
            console.log(`Auto-saving current note before switch: "${currentNote.title}"`);
            await saveCurrentNote();
        }
    }
    
    // Don't reload the same note
    if (currentNote && currentNote.id === note.id) {
        console.log(`Note already loaded: "${note.title}"`);
        return;
    }
    
    // CRITICAL FIX: Always get the most up-to-date version from allNotes cache
    const freshNote = allNotes.find(n => n.id === note.id);
    if (freshNote) {
        currentNote = { ...freshNote }; // Use the fresh cached version
        console.log(`Using fresh cached data for note: "${currentNote.title}"`);
    } else {
        currentNote = { ...note }; // Fallback to passed note
        console.log(`Using passed note data (no cache found): "${currentNote.title}"`);
    }
    
    // Handle backward compatibility - add font settings if they don't exist
    if (!currentNote.fontSize) {
        currentNote.fontSize = settings.fontSize;
    }
    if (!currentNote.fontFamily) {
        currentNote.fontFamily = settings.fontFamily;
    }
    
    // Set editor content from the current note's stored content
    const noteContent = currentNote.content || '';
    editor.innerHTML = noteContent;
    
    // Store original content for change detection (must match editor content)
    currentNote.originalContent = noteContent;
    
    // Ensure current content is up to date
    currentNote.content = noteContent;
    
    // Update title from content (this will also update sidebar if needed)
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
    
    console.log(`Loaded note: "${currentNote.title}" (ID: ${currentNote.id}) - Content length: ${noteContent.length}, fontSize: ${currentNote.fontSize}px, fontFamily: "${currentNote.fontFamily}"`);
    
    // Debug: Check what's in the allNotes cache for this note
    const cachedNote = allNotes.find(n => n.id === note.id);
    if (cachedNote) {
        console.log(`Cache comparison - Loaded: fontSize ${currentNote.fontSize}, fontFamily "${currentNote.fontFamily}" | Cached: fontSize ${cachedNote.fontSize}, fontFamily "${cachedNote.fontFamily}"`);
        if (cachedNote.fontSize !== currentNote.fontSize || cachedNote.fontFamily !== currentNote.fontFamily) {
            console.warn(`⚠️ CACHE MISMATCH DETECTED! Using outdated note data.`);
        }
    }
}

// Create new note (with auto-save protection)
async function createNewNote() {
    // CRITICAL: Save current note before creating new one if content has changed
    if (currentNote && editor.innerHTML.trim()) {
        const hasUnsavedChanges = currentNote.originalContent !== editor.innerHTML;
        if (hasUnsavedChanges) {
            console.log(`Auto-saving current note before creating new note: "${currentNote.title}"`);
            await saveCurrentNote();
        }
    }
    
    // Get folder name if creating in a specific folder
    let folderName = null;
    if (currentFolder !== 'all') {
        const folder = allFolders.find(f => f.id === currentFolder);
        folderName = folder ? folder.name : null;
    }
    
    currentNote = {
        id: Date.now().toString(),
        title: 'New Note',
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
    
    // Set initial content reference for change detection
    currentNote.originalContent = '';
    currentNote.content = '';
    
    // Apply title character limit for display
    let displayTitle = 'New Note';
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
            const oldTitle = currentNote.title;
            const wasNewNote = !allNotes.find(note => note.id === currentNote.id);
            
            // Update current note with saved data
            const updatedNote = result.note;
            
            // Preserve editor content reference for consistency
            updatedNote.originalContent = updatedNote.content;
            
            // Update current note reference
            currentNote = updatedNote;
            
            // Apply title character limit for display
            let displayTitle = currentNote.title;
            if (displayTitle.length > 15) {
                displayTitle = displayTitle.substring(0, 12) + '...';
            }
            currentNoteTitle.textContent = displayTitle;
            
            // Update the note in allNotes array for consistency
            const noteIndex = allNotes.findIndex(note => note.id === currentNote.id);
            if (noteIndex > -1) {
                // CRITICAL: Update the cached note with the fresh saved data
                allNotes[noteIndex] = { ...currentNote };
                console.log(`Updated cached note: "${currentNote.title}" with fontSize: ${currentNote.fontSize}, fontFamily: "${currentNote.fontFamily}"`);
            } else if (wasNewNote) {
                allNotes.unshift(currentNote); // Add new note to the beginning
                console.log(`Added new note to cache: "${currentNote.title}"`);
            }
            
            // Check if title changed
            const titleChanged = oldTitle !== currentNote.title;
            
            // Refresh list if it's a new note or title changed significantly
            if (wasNewNote || titleChanged) {
                await loadNotes();
            } else {
                // Update sidebar title without full reload for minor changes
                updateSidebarNoteTitle(currentNote);
            }
            
            console.log(`Note saved successfully: ${currentNote.title}`);
        } else {
            console.error('Save failed:', result.error);
        }
    } catch (error) {
        console.error('Error saving note:', error);
    }
}

// Auto-save functionality
async function autoSave() {
    if (currentNote && editor.innerHTML.trim()) {
        // Only save if content has actually changed
        const currentContent = editor.innerHTML;
        const hasContentChanged = currentNote.originalContent !== currentContent;
        
        if (hasContentChanged) {
            console.log(`Auto-save: Content changed for "${currentNote.title}"`);
            await saveCurrentNote();
        } else {
            console.log(`Auto-save: No changes detected for "${currentNote.title}"`);
        }
    }
}

// Export current note
async function exportCurrentNote() {
    if (!currentNote) return;
    
    try {
        const noteToExport = {
            title: currentNote.title || 'New Note',
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

// Debounced auto-save with improved content detection
let autoSaveTimeout;
function debouncedAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        if (currentNote && editor.innerHTML.trim()) {
            // More robust content comparison
            const currentContent = editor.innerHTML;
            const hasContentChanged = currentNote.originalContent !== currentContent;
            
            if (hasContentChanged) {
                console.log('Auto-save triggered: content changed');
                autoSave();
            }
        }
    }, 1500); // Reduced to 1.5 seconds for better responsiveness
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
        // Always update the current note content
        currentNote.content = editor.innerHTML;
        
        // Update title based on first line of content (includes sidebar update)
        updateTitleFromContent();
        
        // Trigger debounced auto-save only if content actually changed
        if (currentNote.originalContent !== editor.innerHTML) {
            debouncedAutoSave();
        }
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

// ===== CENTRALIZED TITLE MANAGEMENT =====

// Extract title from content using consistent logic
function extractTitleFromContent(content) {
    if (!content) return 'New Note';
    
    // Handle both HTML content and plain text
    let textContent;
    if (typeof content === 'string' && content.includes('<')) {
        // Parse HTML content to get plain text
        textContent = new DOMParser().parseFromString(content, 'text/html').body.textContent || '';
    } else {
        textContent = content;
    }
    
    const trimmedContent = textContent.trim();
    
    // If content is completely empty, use 'New Note'
    if (!trimmedContent) {
        return 'New Note';
    }
    
    // Get the first line of text
    let firstLine = trimmedContent.split('\n')[0].trim();
    
    // Use the first line as title, or 'New Note' if first line is empty
    return firstLine || 'New Note';
}

// Debounced sidebar update to avoid excessive DOM manipulation
let sidebarUpdateTimeout;
function debouncedSidebarUpdate() {
    clearTimeout(sidebarUpdateTimeout);
    sidebarUpdateTimeout = setTimeout(() => {
        updateSidebarNoteTitle(currentNote);
    }, 100); // Update sidebar 100ms after last change
}

// Update a specific note's title in the sidebar
function updateSidebarNoteTitle(note) {
    if (!note) return;
    
    const noteElement = document.querySelector(`[data-note-id="${note.id}"]`);
    if (noteElement) {
        const titleElement = noteElement.querySelector('.note-item-title');
        if (titleElement) {
            // Use the same title extraction logic as createNoteListItem
            let title = extractTitleFromContent(note.content);
            
            // Apply the same character limit as in createNoteListItem
            if (title.length > 25) {
                title = title.substring(0, 22) + '...';
            }
            
            titleElement.textContent = title;
        }
    }
}

// Extract title from first line of content and update UI
function updateTitleFromContent() {
    if (!currentNote) return;
    
    // Get current editor content
    const editorContent = editor.innerHTML;
    const newTitle = extractTitleFromContent(editorContent);
    
    // Update note's full title if it changed
    if (currentNote.title !== newTitle) {
        const oldTitle = currentNote.title;
        currentNote.title = newTitle;
        
        // Limit title bar display to 15 characters max
        let displayTitle = newTitle;
        if (displayTitle.length > 15) {
            displayTitle = displayTitle.substring(0, 12) + '...';
        }
        
        // Update the title bar with shortened title
        currentNoteTitle.textContent = displayTitle;
        
        // Update content for title detection
        currentNote.content = editorContent;
        
        // Update sidebar in real-time with debouncing
        debouncedSidebarUpdate();
        
        console.log(`Title updated: "${oldTitle}" → "${newTitle}"`);
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
        createNewNote(); // Fire and forget - async handled internally
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
    
    // AI prompt bar shortcut (Cmd+K / Ctrl+K)
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const text = selection.toString();
            if (text.trim()) {
                // Use the exact same logic as right-click
                openInlinePrompt(range, text);
            }
        }
        return;
    }

    // AI shortcuts
    // Cmd+Enter / Ctrl+Enter to accept AI changes
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        applyAIChanges();
        return;
    }

    // Shift+Cmd+Enter / Shift+Ctrl+Enter to reject AI changes
    if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        undoAIChanges();
        return;
    }

    // Cmd+Y / Ctrl+Y to keep AI changes
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        applyAIChanges();
        return;
    }

    // Close app with ESC key
    if (e.key === 'Escape') {
        e.preventDefault();
        // Close inline prompt if open, otherwise close app
        const inlinePrompt = document.getElementById('inlinePrompt');
        if (inlinePrompt && inlinePrompt.style.display !== 'none') {
            closeInlinePrompt();
        } else {
            window.electronAPI.closeApp();
        }
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
    
    console.log(`Updating font size from ${currentNote.fontSize}px to ${size}px for note: "${currentNote.title}"`);
    
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
    
    console.log(`Font size updated successfully. Saving note...`);
    // Auto-save the note with new font settings
    saveCurrentNote();
}

function updateFontFamily(family) {
    if (!currentNote) return;
    
    console.log(`Updating font family from "${currentNote.fontFamily}" to "${family}" for note: "${currentNote.title}"`);
    
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
    
    console.log(`Font family updated successfully. Saving note...`);
    // Auto-save the note with new font settings
    saveCurrentNote();
}

// Theme management
function toggleTheme() {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    document.body.className = settings.theme === 'light' ? 'light-mode' : '';
    updateThemeButton();
    saveSettings();
    updateTitleBarTheme(settings.theme);
}

// Helper function to update title bar theme
function updateTitleBarTheme(theme) {
    window.electronAPI.updateTitleBarTheme(theme);
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

// ===== EDITOR CONTEXT MENU =====
function showEditorContextMenu(e) {
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

    if (hasSelection) {
        copyItem.style.opacity = '1';
        copyItem.style.pointerEvents = 'auto';
        cutItem.style.opacity = '1';
        cutItem.style.pointerEvents = 'auto';
    } else {
        copyItem.style.opacity = '0.5';
        copyItem.style.pointerEvents = 'none';
        cutItem.style.opacity = '0.5';
        cutItem.style.pointerEvents = 'none';
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

// Handle context menu actions
document.addEventListener('click', async (e) => {
    if (e.target.closest('.context-menu-item')) {
        const action = e.target.closest('.context-menu-item').dataset.action;
        const editor = document.getElementById('editor');

        switch (action) {
            case 'edit-with-ai':
                handleEditWithAI(editor);
                break;
            case 'copy':
                await handleCopy(editor);
                break;
            case 'cut':
                await handleCut(editor);
                break;
            case 'paste':
                await handlePaste(editor);
                break;
            case 'select-all':
                handleSelectAll(editor);
                break;
        }

        // Hide the context menu
        document.getElementById('editorContextMenu').style.display = 'none';
    }
});

// Robust clipboard functions
async function handleCopy(editor) {
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
        // Fallback for older browsers or restricted environments
        try {
            document.execCommand('copy');
        } catch (execErr) {
            console.error('ExecCommand copy also failed:', execErr);
            alert('Copy functionality is not available. Please use Ctrl+C instead.');
        }
    }
}

async function handleCut(editor) {
    try {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const selectedText = selection.toString();
            if (selectedText) {
                await navigator.clipboard.writeText(selectedText);
                // Remove selected text
                selection.deleteFromDocument();
                // Trigger input event to update word count and save
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('Text cut successfully');
            }
        }
    } catch (err) {
        console.error('Cut failed:', err);
        // Fallback for older browsers or restricted environments
        try {
            document.execCommand('cut');
            // Trigger input event to update word count and save
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (execErr) {
            console.error('ExecCommand cut also failed:', execErr);
            alert('Cut functionality is not available. Please use Ctrl+X instead.');
        }
    }
}

async function handlePaste(editor) {
    try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText) {
            const selection = window.getSelection();

            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(clipboardText));
                // Move cursor to end of pasted text
                selection.collapseToEnd();
            } else {
                // If no selection, append to end
                editor.innerHTML += clipboardText.replace(/\n/g, '<br>');
            }

            // Trigger input event to update word count and save
            const inputEvent = new Event('input', { bubbles: true });
            editor.dispatchEvent(inputEvent);
            // Ensure editor maintains focus
            editor.focus();
            console.log('Text pasted successfully');
        }
    } catch (err) {
        console.error('Modern paste failed, trying fallback:', err);
        // Fallback for older browsers or restricted environments
        try {
            const success = document.execCommand('paste');
            if (success) {
                // Trigger input event to update word count and save
                const inputEvent = new Event('input', { bubbles: true });
                editor.dispatchEvent(inputEvent);
                // Ensure editor maintains focus
                editor.focus();
                console.log('Paste successful via execCommand');
            } else {
                console.log('ExecCommand paste returned false, but this is normal in some contexts');
                // Don't show alert - execCommand often returns false even when it works
            }
        } catch (execErr) {
            console.error('ExecCommand paste also failed:', execErr);
            // Only show alert if both methods completely fail
            alert('Paste functionality is not available. Please use Ctrl+V instead.');
        }
    }
}

function handleSelectAll(editor) {
    const selection = window.getSelection();
    const range = document.createRange();

    // Select all content in the editor
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);

    // Ensure editor maintains focus
    editor.focus();
}

// ===== SETTINGS MODAL =====
async function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const modalBody = document.querySelector('.settings-modal-body');

    // Get AI settings
    const aiSettings = await loadAISettings();

    // Populate settings content
    modalBody.innerHTML = `
        <div class="gemini-settings-container">
            <h2 class="gemini-settings-title">Gemini API Settings</h2>
            <p class="gemini-settings-description">Configure your Gemini API key to enable AI-powered insights. Get your API key from the Google AI Studio.</p>
            
            <div class="gemini-input-container">
                <input type="password" id="aiApiKeyInput" class="gemini-api-input" placeholder="Enter your API key" value="${aiSettings.aiApiKey || ''}">
                <button id="aiToggleVisibility" class="gemini-toggle-visibility" title="Toggle visibility">
                    <i class="ph ph-eye" style="font-size: 16px;"></i>
                </button>
            </div>
            
            <p class="gemini-security-message">Your API key is stored securely in your browser's local storage.</p>
            
            <button id="aiSaveBtn" class="gemini-save-btn">Save API Key</button>
            
            <div class="gemini-help-link">
                <span>Need an API key?</span>
                <a href="#" id="geminiHelpLink">Visit Google AI Studio →</a>
            </div>
        </div>
    `;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open

    // Setup AI settings listeners after modal is shown
    setTimeout(setupAISettingsListeners, 100);
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Settings modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    const settingsModalClose = document.getElementById('settingsModalClose');
    if (settingsModalClose) {
        settingsModalClose.addEventListener('click', closeSettingsModal);
    }

    // Close modal when clicking overlay
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('settings-modal-overlay')) {
                closeSettingsModal();
            }
        });
    }

    // AI settings event listeners
    setupAISettingsListeners();

    // AI prompt bar event listeners
    setupAIPromptBarListeners();
});

// Setup AI settings event listeners
function setupAISettingsListeners() {
    // AI API key input
    const aiApiKeyInput = document.getElementById('aiApiKeyInput');
    const aiSaveBtn = document.getElementById('aiSaveBtn');
    const aiToggleVisibility = document.getElementById('aiToggleVisibility');

    if (aiApiKeyInput) {
        aiApiKeyInput.addEventListener('input', () => {
            // Enable save button when there's input
            if (aiSaveBtn) {
                aiSaveBtn.disabled = !aiApiKeyInput.value.trim();
            }
        });
    }

    if (aiSaveBtn) {
        aiSaveBtn.addEventListener('click', async () => {
            const apiKey = aiApiKeyInput ? aiApiKeyInput.value.trim() : '';
            
            if (!apiKey) {
                alert('Please enter an API key');
                return;
            }

            // Show loading state
            aiSaveBtn.disabled = true;
            aiSaveBtn.textContent = 'Saving...';

            try {
                // Test the API key first
                const testResult = await window.electronAPI.initializeAiService(apiKey);
                
                if (testResult.success) {
                    // Save the settings
                    await saveAISettings({ aiApiKey: apiKey, aiEnabled: true });
                    updateAIStatus();
                    
                    // Show success message
                    aiSaveBtn.textContent = 'Saved!';
                    aiSaveBtn.style.backgroundColor = '#28a745';
                    
                    setTimeout(() => {
                        aiSaveBtn.textContent = 'Save API Key';
                        aiSaveBtn.style.backgroundColor = '';
                        aiSaveBtn.disabled = false;
                    }, 2000);
                } else {
                    throw new Error(testResult.error);
                }
            } catch (error) {
                alert('Failed to save API key: ' + error.message);
                aiSaveBtn.textContent = 'Save API Key';
                aiSaveBtn.disabled = false;
            }
        });
    }

    if (aiToggleVisibility) {
        aiToggleVisibility.addEventListener('click', () => {
            const input = aiApiKeyInput;
            const icon = aiToggleVisibility.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'ph ph-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'ph ph-eye';
            }
        });
    }

    // Gemini help link
    const geminiHelpLink = document.getElementById('geminiHelpLink');
    if (geminiHelpLink) {
        geminiHelpLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openExternalLink('https://aistudio.google.com/app/apikey');
        });
    }
}

// Setup AI prompt bar event listeners
function setupAIPromptBarListeners() {
    // Close prompt bar
    const promptClose = document.getElementById('promptClose');

    if (promptClose) {
        promptClose.addEventListener('click', closeInlinePrompt);
    }

    // Prompt input and submission
    const promptInput = document.getElementById('promptInput');
    const promptSubmit = document.getElementById('promptSubmit');

    if (promptInput) {
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const prompt = promptInput.value.trim();
                if (prompt) {
                    handlePromptSubmit(prompt);
                }
            }
        });
    }

    if (promptSubmit) {
        promptSubmit.addEventListener('click', () => {
            const prompt = promptInput ? promptInput.value.trim() : '';
            if (prompt) {
                handlePromptSubmit(prompt);
            }
        });
    }

}

// Settings functions
function changeTheme(theme) {
    settings.theme = theme;
    document.body.className = theme === 'light' ? 'light-mode' : '';
    updateThemeButton();
    saveSettings();

    // Update theme buttons in modal
    const themeBtns = document.querySelectorAll('.settings-btn');
    themeBtns.forEach(btn => {
        if (btn.textContent.trim() === 'Dark' || btn.textContent.trim() === 'Light') {
            btn.classList.remove('active');
        }
    });

    // Find and activate the correct theme button
    const targetBtn = Array.from(themeBtns).find(btn =>
        btn.textContent.trim() === (theme === 'dark' ? 'Dark' : 'Light')
    );
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    // Update title bar theme
    updateTitleBarTheme(theme);
}

// Removed unused settings dropdown functions that reference non-existent HTML elements

function toggleWordWrap(enabled) {
    settings.wordWrap = enabled;
    if (enabled) {
        editor.style.whiteSpace = 'pre-wrap';
    } else {
        editor.style.whiteSpace = 'pre';
    }
    saveSettings();
}

function toggleAutoSave(enabled) {
    settings.autoSave = enabled;
    saveSettings();
}

// ===== AI FUNCTIONS =====

// Load AI settings
async function loadAISettings() {
    try {
        const result = await window.electronAPI.getAiSettings();
        return result || { aiApiKey: '', aiEnabled: false };
    } catch (error) {
        console.error('Error loading AI settings:', error);
        return { aiApiKey: '', aiEnabled: false };
    }
}

// Save AI settings
async function saveAISettings(aiSettings) {
    try {
        await window.electronAPI.saveAiSettings(aiSettings);
        return { success: true };
    } catch (error) {
        console.error('Error saving AI settings:', error);
        return { success: false, error: error.message };
    }
}

// Test AI connection
async function testAIConnection() {
    const apiKeyInput = document.getElementById('aiApiKeyInput');
    const testBtn = document.getElementById('aiTestBtn');
    const testIcon = testBtn.querySelector('i');

    if (!apiKeyInput || !testBtn) return;

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('Please enter an API key first');
        return;
    }

    // Show loading state
    testBtn.disabled = true;
    testIcon.className = 'ph ph-spinner ph-spin';
    testIcon.style.color = '#007bff';

    try {
        const result = await window.electronAPI.initializeAiService(apiKey);

        if (result.success) {
            testIcon.className = 'ph ph-check-circle';
            testIcon.style.color = '#28a745';
            alert('API key is valid and AI service is ready!');
        } else {
            testIcon.className = 'ph ph-x-circle';
            testIcon.style.color = '#dc3545';
            alert('API key test failed: ' + result.error);
        }
    } catch (error) {
        testIcon.className = 'ph ph-x-circle';
        testIcon.style.color = '#dc3545';
        alert('Connection test failed: ' + error.message);
    } finally {
        testBtn.disabled = false;
        setTimeout(() => {
            testIcon.className = 'ph ph-check';
            testIcon.style.color = '';
        }, 3000);
    }
}

// Update AI status indicator
async function updateAIStatus() {
    const statusElement = document.getElementById('aiStatus');
    const statusText = document.getElementById('aiStatusText');
    const statusIcon = statusElement?.querySelector('i');

    if (!statusElement || !statusText || !statusIcon) return;

    try {
        const result = await window.electronAPI.getAiStatus();

        if (result.success) {
            const status = result.status;
            if (status.configured && status.hasApiKey && status.modelReady) {
                statusText.textContent = 'AI Ready';
                statusIcon.className = 'ph ph-check-circle';
                statusIcon.style.color = '#28a745';
            } else if (status.hasApiKey) {
                statusText.textContent = 'API Key Set';
                statusIcon.className = 'ph ph-circle';
                statusIcon.style.color = '#ffc107';
            } else {
                statusText.textContent = 'AI not configured';
                statusIcon.className = 'ph ph-circle';
                statusIcon.style.color = '#6c757d';
            }
        } else {
            statusText.textContent = 'Error checking AI status';
            statusIcon.className = 'ph ph-x-circle';
            statusIcon.style.color = '#dc3545';
        }
    } catch (error) {
        console.error('Error updating AI status:', error);
        statusText.textContent = 'Error';
        statusIcon.className = 'ph ph-x-circle';
        statusIcon.style.color = '#dc3545';
    }
}

// Open external link in system browser
function openExternalLink(url) {
    try {
        window.electronAPI.openExternalLink(url);
    } catch (error) {
        console.error('Error opening external link:', error);
        // Fallback to window.open if electronAPI is not available
        window.open(url, '_blank');
    }
}

// Handle Edit with AI from context menu
function handleEditWithAI(editor) {
    // Get selected text or all text if nothing is selected
    const selection = window.getSelection();
    let selectedText = '';
    let range = null;
    
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        selectedText = selection.toString();
        range = selection.getRangeAt(0);
    } else {
        selectedText = editor.textContent || editor.innerText;
        range = document.createRange();
        range.selectNodeContents(editor);
    }
    
    if (!selectedText.trim()) {
        alert('Please select some text to edit with AI, or ensure there is content in the editor.');
        return;
    }
    
    // Open inline prompt with the selected text - same as Cmd+K
    openInlinePrompt(range, selectedText);
}

// ===== INLINE AI PROMPT FUNCTIONS =====

// Global variables for tracking state
let currentRange = null;
let currentText = '';
let promptHistory = [];
let lastResponse = '';

// Open inline prompt
function openInlinePrompt(range, text) {
    const inlinePrompt = document.getElementById('inlinePrompt');
    const promptInput = document.getElementById('promptInput');
    const promptHistory = document.getElementById('promptHistory');
    const promptResponse = document.getElementById('promptResponse');

    if (!inlinePrompt || !range) return;

    // Store current state
    currentRange = range;
    currentText = text;

    // Clear any existing markers
    const existingMarkers = editor.querySelectorAll('.ai-text-selected');
    existingMarkers.forEach(m => {
        const parent = m.parentNode;
        while (m.firstChild) {
            parent.insertBefore(m.firstChild, m);
        }
        parent.removeChild(m);
    });

    try {
        // Create a wrapper for the selected text
        const wrapper = document.createElement('span');
        wrapper.className = 'ai-text-selected';
        range.surroundContents(wrapper);

        // Insert the prompt box before the wrapper
        wrapper.parentNode.insertBefore(inlinePrompt, wrapper);

        // Reset prompt state
        promptInput.value = '';
        promptHistory.innerHTML = '';
        promptResponse.style.display = 'none';
        inlinePrompt.style.display = 'flex';

        // Add animation class after display
        setTimeout(() => {
            inlinePrompt.classList.add('show');
            promptInput.focus();
        }, 10);

        // Hide any existing preview
        hideAIPreview();
    } catch (error) {
        console.error('Error opening inline prompt:', error);
        // Fallback: insert at cursor position
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.insertNode(inlinePrompt);
        }
        
        promptInput.value = '';
        promptHistory.innerHTML = '';
        promptResponse.style.display = 'none';
        inlinePrompt.style.display = 'flex';
        setTimeout(() => {
            inlinePrompt.classList.add('show');
            promptInput.focus();
        }, 10);
    }
}


// Close inline prompt
function closeInlinePrompt() {
    const inlinePrompt = document.getElementById('inlinePrompt');
    
    if (!inlinePrompt) return;

    // Remove the wrapper and restore text position
    const wrapper = editor.querySelector('.ai-text-selected');
    if (wrapper) {
        const parent = wrapper.parentNode;
        while (wrapper.firstChild) {
            parent.insertBefore(wrapper.firstChild, wrapper);
        }
        parent.removeChild(wrapper);
    }

    // Hide prompt with animation
    inlinePrompt.classList.remove('show');
    setTimeout(() => {
        inlinePrompt.style.display = 'none';
        // Move prompt back to its original position in the DOM
        document.body.appendChild(inlinePrompt);
        const promptResponse = document.getElementById('promptResponse');
        promptResponse.style.display = 'none';
    }, 200);

    // Clear state
    currentRange = null;
    currentText = '';
    hideAIPreview();
}

// Handle prompt submission
async function handlePromptSubmit(prompt) {
    const promptInput = document.getElementById('promptInput');
    const promptSubmit = document.getElementById('promptSubmit');
    const promptResponse = document.getElementById('promptResponse');
    const submitIcon = promptSubmit.querySelector('i');
    
    if (!prompt.trim() || !currentText) return;

    // Add to history
    addToPromptHistory(prompt);

    try {
        // Show loading state
        promptInput.disabled = true;
        promptSubmit.disabled = true;
        submitIcon.className = 'ph ph-spinner ph-spin';

        const result = await window.electronAPI.generateAiResponse({
            prompt: `${prompt}. Here's the text to modify: "${currentText}"`,
            context: currentText
        });

        if (result.success) {
            lastResponse = result.response;
            showAIPreview(result.response);
            promptResponse.style.display = 'block';
        } else {
            alert('Failed to generate response: ' + result.error);
        }
    } catch (error) {
        alert('Error generating response: ' + error.message);
    } finally {
        // Reset input state
        promptInput.disabled = false;
        promptSubmit.disabled = false;
        submitIcon.className = 'ph ph-paper-plane-tilt';
        promptInput.value = '';
        promptInput.focus();
    }
}

// Add prompt to history
function addToPromptHistory(prompt) {
    const historyContainer = document.getElementById('promptHistory');
    const historyItem = document.createElement('div');
    historyItem.className = 'prompt-history-item';
    historyItem.textContent = prompt;
    historyContainer.appendChild(historyItem);
    promptHistory.push(prompt);
}

// Show AI preview
function showAIPreview(text) {
    const wrapper = editor.querySelector('.ai-text-selected');
    if (!wrapper) return;

    // Create preview element
    const preview = document.createElement('div');
    preview.className = 'ai-preview';
    preview.innerHTML = `
        <div class="ai-preview-content">${text}</div>
        <div class="ai-preview-actions">
            <button class="ai-preview-undo" onclick="undoAIChanges()">
                <span>Undo</span>
                <span class="shortcut">⌘N</span>
            </button>
            <button class="ai-preview-keep" onclick="applyAIChanges()">
                <span>Keep</span>
                <span class="shortcut">⌘Y</span>
            </button>
        </div>
    `;

    // Insert preview after the wrapper
    wrapper.parentNode.insertBefore(preview, wrapper.nextSibling);

    // Scroll preview into view
    preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Hide AI preview
function hideAIPreview() {
    const preview = editor.querySelector('.ai-preview');
    if (preview) {
        preview.remove();
    }
}

// Apply AI changes
function applyAIChanges() {
    if (!currentRange || !lastResponse) return;

    // Replace text with AI response
    const wrapper = editor.querySelector('.ai-text-selected');
    if (wrapper) {
        wrapper.style.marginTop = '0';
        wrapper.textContent = lastResponse;
        wrapper.className = '';
    }

    // Remove preview
    hideAIPreview();

    // Clear selection
    window.getSelection().removeAllRanges();

    // Trigger save
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    // Close prompt
    closeInlinePrompt();
}

// Undo AI changes
function undoAIChanges() {
    if (!currentRange || !currentText) return;

    // Restore original text
    const wrapper = editor.querySelector('.ai-text-selected');
    if (wrapper) {
        wrapper.style.marginTop = '0';
        wrapper.textContent = currentText;
        wrapper.className = '';
    }

    // Remove preview
    hideAIPreview();

    // Clear selection
    window.getSelection().removeAllRanges();

    // Close prompt
    closeInlinePrompt();
}



// Fullscreen functionality
function toggleFullscreen() {
    const appContainer = document.querySelector('.app-container');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = fullscreenBtn.querySelector('i');
    
    appContainer.classList.toggle('fullscreen-mode');
    
    if (appContainer.classList.contains('fullscreen-mode')) {
        // Change icon to exit fullscreen
        fullscreenIcon.className = 'ph ph-arrows-in-simple';
        fullscreenBtn.title = 'Exit Fullscreen';
        
        // Request fullscreen API if available
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        }
    } else {
        // Change icon back to enter fullscreen
        fullscreenIcon.className = 'ph ph-arrows-out-simple';
        fullscreenBtn.title = 'Toggle Fullscreen';
        
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

// Listen for fullscreen change events to sync UI state
document.addEventListener('fullscreenchange', function() {
    const appContainer = document.querySelector('.app-container');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = fullscreenBtn.querySelector('i');
    
    if (document.fullscreenElement) {
        // Entered fullscreen
        appContainer.classList.add('fullscreen-mode');
        fullscreenIcon.className = 'ph ph-arrows-in-simple';
        fullscreenBtn.title = 'Exit Fullscreen';
    } else {
        // Exited fullscreen
        appContainer.classList.remove('fullscreen-mode');
        fullscreenIcon.className = 'ph ph-arrows-out-simple';
        fullscreenBtn.title = 'Toggle Fullscreen';
    }
});

// Also listen for webkit fullscreen events (Safari)
document.addEventListener('webkitfullscreenchange', function() {
    const appContainer = document.querySelector('.app-container');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = fullscreenBtn.querySelector('i');
    
    if (document.webkitFullscreenElement) {
        // Entered fullscreen
        appContainer.classList.add('fullscreen-mode');
        fullscreenIcon.className = 'ph ph-arrows-in-simple';
        fullscreenBtn.title = 'Exit Fullscreen';
    } else {
        // Exited fullscreen
        appContainer.classList.remove('fullscreen-mode');
        fullscreenIcon.className = 'ph ph-arrows-out-simple';
        fullscreenBtn.title = 'Toggle Fullscreen';
    }
});

