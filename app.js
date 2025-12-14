// Application state
let currentNote = null;
let allNotes = [];
let allFolders = [];
let currentFolder = 'all'; // 'all' means show all notes, otherwise folder ID
let isNoteDirty = false; // Explicit dirty flag for change tracking
let settings = {
    fontSize: 18,
    fontFamily: 'Aeonik',
    theme: 'dark',
    autoSave: true,
    wordWrap: true
};

// Normalize HTML for comparison (handles browser rendering differences)
function normalizeHtmlForComparison(html) {
    if (!html) return '';
    return html
        .replace(/\s+/g, ' ')           // Normalize whitespace
        .replace(/>\s+</g, '><')        // Remove whitespace between tags
        .replace(/\s*\/>/g, '/>')       // Normalize self-closing tags
        .replace(/&nbsp;/g, '\u00A0')   // Normalize non-breaking spaces
        .trim();
}

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

    // Checklist button (now in toolbar)
    document.getElementById('checklistBtn')?.addEventListener('click', insertCircularChecklist);

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
    editor.addEventListener('mouseup', () => {
        updateFormatButtonStates();
        // Prevent cursor in list marker space after mouse interaction
        setTimeout(() => {
            preventCursorInListSpace();
        }, 0);
    });
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
    document.addEventListener('selectionchange', () => {
        updateFormatButtonStates();
        updateTextStyleUI(); // Also update text style UI (Title/Heading/Body)

        // Prevent cursor in list marker space on any selection change
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && selection.isCollapsed) {
            setTimeout(() => {
                preventCursorInListSpace();
            }, 0);
        }
    });

    // Font family controls
    document.querySelectorAll('.font-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const font = e.target.dataset.font;
            updateFontFamily(font);
            closeFontDropdown();
        });
    });

    // Font size/style controls (now inside formatting dropdown)
    document.querySelectorAll('.size-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const target = e.target.closest('.size-option');
            const size = target.dataset.size;
            const style = target.dataset.style;
            applyTextStyle(style, size);
            closeFormattingDropdown();
        });
    });

    // Bullet list button
    document.getElementById('bulletListBtn')?.addEventListener('click', () => {
        insertBulletList();
        closeFormattingDropdown();
    });

    // Numbered list button
    document.getElementById('numberedListBtn')?.addEventListener('click', () => {
        insertNumberedList();
        closeFormattingDropdown();
    });

    // Handle click on circular checkboxes in the editor
    editor.addEventListener('click', (e) => {
        const text = e.target.textContent || '';
        // Check if clicked on a circular checkbox character (◯ = unchecked, ⬤ = checked)
        if (text.includes('◯') || text.includes('⬤')) {
            const clickedChar = getClickedCharacter(e);
            if (clickedChar === '◯' || clickedChar === '⬤') {
                toggleCircularCheckboxAtCursor();
            }
        }

        // Prevent cursor in the space after list markers
        preventCursorInListSpace();
    });

    // Prevent cursor placement in space after list markers (checklist, bullet, dash, numbered)
    function preventCursorInListSpace() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (!range.collapsed) return; // Only handle collapsed selections (cursor)

        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) return;

        const text = node.textContent;
        const offset = range.startOffset;

        // Strict check: Only apply if the text node actually starts with a list marker
        // This fixes the issue where dashes in the middle of sentences were affecting cursor
        let markerLength = 0;

        // Check for Bullet/Dash
        if (text.match(/^[-•]\s/)) {
            markerLength = 2; // "- " or "• "
        }
        // Check for Checklist
        else if (text.match(/^[◯⬤]\s/)) {
            markerLength = 2; // "◯ "
        }
        // Check for Numbered List
        else {
            const numMatch = text.match(/^(\d+)\.\s/);
            if (numMatch) {
                markerLength = numMatch[0].length;
            }
        }

        // If not a list marker at start, return immediately
        if (markerLength === 0) return;

        // If cursor is inside the marker area (including the space)
        if (offset < markerLength) {
            // Move cursor to after the marker
            const newRange = document.createRange();
            newRange.setStart(node, markerLength);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    }

    // Handle hover over circular checkboxes - change cursor to pointer
    editor.addEventListener('mousemove', (e) => {
        let range;

        // Try to get range from point (modern browsers)
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(e.clientX, e.clientY);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
            if (pos) {
                range = document.createRange();
                range.setStart(pos.offsetNode, pos.offset);
                range.collapse(true);
            }
        }

        if (!range) {
            editor.classList.remove('hovering-checkbox');
            return;
        }

        const node = range.startContainer;
        let text = '';
        let offset = 0;

        if (node.nodeType === Node.TEXT_NODE) {
            text = node.textContent;
            offset = range.startOffset;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Get text from element
            text = node.textContent || '';
            offset = 0;
        }

        // Check if we're on or near a circle character (within 2 characters for precision)
        const nearbyText = text.substring(Math.max(0, offset - 2), Math.min(text.length, offset + 2));

        // Check if cursor is directly on the circle or the space right after it
        const isOnCircle = offset > 0 && (text[offset - 1] === '◯' || text[offset - 1] === '⬤');
        const isAfterCircle = offset > 1 && (text[offset - 2] === '◯' || text[offset - 2] === '⬤') &&
            (text[offset - 1] === ' ' || text[offset - 1] === '\u00A0');

        if (isOnCircle || isAfterCircle || nearbyText.includes('◯') || nearbyText.includes('⬤')) {
            editor.classList.add('hovering-checkbox');
        } else {
            editor.classList.remove('hovering-checkbox');
        }
    });

    // Remove pointer cursor when mouse leaves editor
    editor.addEventListener('mouseleave', () => {
        editor.classList.remove('hovering-checkbox');
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
    // Always use 18px as base editor font size (matches Body)
    editor.style.fontSize = '18px';
    editor.style.fontFamily = settings.fontFamily;

    // Apply font to placeholder as well
    document.getElementById('editorPlaceholder').style.fontFamily = settings.fontFamily;
    document.getElementById('editorPlaceholder').style.fontSize = '18px';


    // Update active font family button
    document.querySelectorAll('.font-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.font === settings.fontFamily) {
            option.classList.add('active');
        }
    });

    // Update active font size button to Body
    document.querySelectorAll('.size-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.style === 'body') {
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

    // Always use 18px as the base editor font size (matches Body)
    // The per-note fontSize is only used for font family now
    editor.style.fontSize = '18px';
    editor.style.fontFamily = currentNote.fontFamily;

    // Apply font to placeholder as well
    document.getElementById('editorPlaceholder').style.fontFamily = currentNote.fontFamily;
    document.getElementById('editorPlaceholder').style.fontSize = '18px';

    // Reset to Body style
    activeTextStyle = 'body';

    // Update active font family button
    document.querySelectorAll('.font-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.font === currentNote.fontFamily) {
            option.classList.add('active');
        }
    });

    // Update active font size button to Body
    document.querySelectorAll('.size-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.style === 'body') {
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

    // Extract title and body using centralized logic
    const { title, bodyPreview } = extractTitleAndBodyFromContent(note.content);

    // Apply character limit for sidebar title display
    let displayTitle = title;
    if (displayTitle.length > 25) {
        displayTitle = displayTitle.substring(0, 22) + '...';
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

    // Build body preview if available
    let bodyPreviewHtml = '';
    if (bodyPreview) {
        bodyPreviewHtml = `<span class="note-item-preview">${escapeHtml(bodyPreview)}</span>`;
    }

    div.innerHTML = `
        <div class="note-item-content">
            <div class="note-item-title">${escapeHtml(displayTitle)}</div>
            <div class="note-item-meta">
                <span class="note-item-time">
                    <span class="time-text">${timeDisplay}</span>${folderInfo}
                </span>
                ${bodyPreviewHtml}
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
        const hasUnsavedChanges = isNoteDirty || 
            normalizeHtmlForComparison(currentNote.originalContent) !== normalizeHtmlForComparison(editor.innerHTML);
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

    // Reset dirty flag for new note
    isNoteDirty = false;

    // Reset list mode flags when switching notes
    isDashListMode = false;
    isNumberedListMode = false;
    isCircularChecklistMode = false;
    currentListNumber = 1;

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

    // Store original content AFTER DOM has settled (microtask)
    // This ensures browser normalization is captured
    queueMicrotask(() => {
        if (currentNote) {
            currentNote.originalContent = editor.innerHTML;
            console.log(`Original content set after DOM settle for: "${currentNote.title}"`);
        }
    });

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
    // Close sidebar when creating a new note
    closeSidebar();

    // CRITICAL: Save current note before creating new one if content has changed
    if (currentNote && editor.innerHTML.trim()) {
        const hasUnsavedChanges = isNoteDirty || 
            normalizeHtmlForComparison(currentNote.originalContent) !== normalizeHtmlForComparison(editor.innerHTML);
        if (hasUnsavedChanges) {
            console.log(`Auto-saving current note before creating new note: "${currentNote.title}"`);
            await saveCurrentNote();
        }
    }

    // Reset dirty flag for new note
    isNoteDirty = false;

    // Reset list mode flags when creating new note
    isDashListMode = false;
    isNumberedListMode = false;
    isCircularChecklistMode = false;
    currentListNumber = 1;

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
        const contentChanged = isNoteDirty || 
            normalizeHtmlForComparison(currentNote.originalContent) !== normalizeHtmlForComparison(editor.innerHTML);

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

            // Set original content to current editor content (post-save baseline)
            updatedNote.originalContent = editor.innerHTML;

            // Update current note reference
            currentNote = updatedNote;

            // Reset dirty flag after successful save
            isNoteDirty = false;

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
        // Only save if content has actually changed (use dirty flag or normalized comparison)
        const hasContentChanged = isNoteDirty || 
            normalizeHtmlForComparison(currentNote.originalContent) !== normalizeHtmlForComparison(editor.innerHTML);

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
            // More robust content comparison using dirty flag and normalization
            const hasContentChanged = isNoteDirty || 
                normalizeHtmlForComparison(currentNote.originalContent) !== normalizeHtmlForComparison(editor.innerHTML);

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

    // Check for list auto-activation when space is typed
    if (e && e.inputType === 'insertText' && e.data === ' ') {
        checkForListActivation();
    }


    if (currentNote) {
        // Always update the current note content
        currentNote.content = editor.innerHTML;

        // Update title based on first line of content (includes sidebar update)
        updateTitleFromContent();

        // Mark as dirty and trigger debounced auto-save if content actually changed
        const hasChanged = normalizeHtmlForComparison(currentNote.originalContent) !== 
                          normalizeHtmlForComparison(editor.innerHTML);
        if (hasChanged) {
            isNoteDirty = true;
            debouncedAutoSave();
        }
    }
}



function checkForListActivation() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const currentLineText = getCurrentLineText();

    // Check for dash list activation (-, *, or > followed by space or non-breaking space)
    const normalizedDashLine = currentLineText.replace(/\u00A0/g, ' ');
    if (normalizedDashLine === '- ' || normalizedDashLine === '* ' || normalizedDashLine === '• ' || normalizedDashLine === '> ') {
        isDashListMode = true;
        isNumberedListMode = false;
        isCircularChecklistMode = false;

        // Replace * or > with bullet point for consistency
        if (normalizedDashLine === '* ') {
            replaceCurrentLineStart('* ', '•\u00A0');
        } else if (normalizedDashLine === '> ') {
            replaceCurrentLineStart('> ', '•\u00A0');
        }
    }

    // Check for numbered list activation (1. followed by space or non-breaking space)
    const normalizedNumberedLine = currentLineText.replace(/\u00A0/g, ' ');
    const numberedMatch = normalizedNumberedLine.match(/^(\d+)\.\s$/);
    if (numberedMatch) {
        currentListNumber = parseInt(numberedMatch[1]);
        isNumberedListMode = true;
        isDashListMode = false;
        isCircularChecklistMode = false;
    }

    // Check for circular checklist activation (◯/⬤ followed by space or non-breaking space)
    const normalizedLine = currentLineText.replace(/\u00A0/g, ' ');
    if (normalizedLine === '◯ ' || normalizedLine === '⬤ ') {
        isCircularChecklistMode = true;
        isDashListMode = false;
        isNumberedListMode = false;
    }
}

function replaceCurrentLineStart(oldStart, newStart) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;

    if (textNode.nodeType === Node.TEXT_NODE) {
        const content = textNode.textContent;
        if (content.startsWith(oldStart)) {
            textNode.textContent = newStart + content.substring(oldStart.length);

            // Restore cursor position
            const newRange = document.createRange();
            newRange.setStart(textNode, newStart.length);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    }
}

// Legacy function name for compatibility
function checkForDashListActivation() {
    checkForListActivation();
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
    let text = editor.textContent || editor.innerText;
    
    // Remove list markers before counting words
    // Remove bullet markers: •, -, ◯, ⬤
    text = text.replace(/[•◯⬤]/g, '');
    // Remove numbered list markers at start of lines (e.g., "1. ", "12. ")
    text = text.replace(/^\d+\.\s*/gm, '');
    // Remove standalone dashes that are list markers (at start of line)
    text = text.replace(/^-\s+/gm, '');
    
    const words = text.trim() ? text.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
    wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
}

// ===== CENTRALIZED TITLE MANAGEMENT =====

// Escape HTML for safe display
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Extract title from content using consistent logic
function extractTitleFromContent(content) {
    if (!content) return 'New Note';

    // Handle both HTML content and plain text
    let textContent;
    if (typeof content === 'string' && content.includes('<')) {
        // Replace common line break elements with newlines before parsing
        let processedContent = content
            .replace(/<div>/gi, '\n')
            .replace(/<\/div>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p>/gi, '\n')
            .replace(/<\/p>/gi, '');

        // Parse HTML content to get plain text
        textContent = new DOMParser().parseFromString(processedContent, 'text/html').body.textContent || '';
    } else {
        textContent = content;
    }

    const trimmedContent = textContent.trim();

    // If content is completely empty, use 'New Note'
    if (!trimmedContent) {
        return 'New Note';
    }

    // Get the first line of text (split by newlines)
    const lines = trimmedContent.split('\n').filter(line => line.trim());
    let firstLine = lines.length > 0 ? lines[0].trim() : 'New Note';

    // Use the first line as title, or 'New Note' if first line is empty
    return firstLine || 'New Note';
}

// Extract both title and body preview from content
function extractTitleAndBodyFromContent(content) {
    if (!content) {
        return { title: 'New Note', bodyPreview: '' };
    }

    // Handle both HTML content and plain text
    let textContent;
    if (typeof content === 'string' && content.includes('<')) {
        // Replace common line break elements with newlines before parsing
        let processedContent = content
            .replace(/<div>/gi, '\n')
            .replace(/<\/div>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p>/gi, '\n')
            .replace(/<\/p>/gi, '');

        // Parse HTML content to get plain text
        textContent = new DOMParser().parseFromString(processedContent, 'text/html').body.textContent || '';
    } else {
        textContent = content;
    }

    const trimmedContent = textContent.trim();

    // If content is completely empty
    if (!trimmedContent) {
        return { title: 'New Note', bodyPreview: '' };
    }

    // Split into lines and filter out empty lines
    const allLines = trimmedContent.split('\n');
    const nonEmptyLines = allLines.filter(line => line.trim());

    // First non-empty line is always the title
    const title = nonEmptyLines.length > 0 ? nonEmptyLines[0].trim() : 'New Note';

    // Get body preview from remaining non-empty lines
    let bodyPreview = '';
    if (nonEmptyLines.length > 1) {
        bodyPreview = nonEmptyLines[1].trim();
        // Truncate if too long
        if (bodyPreview.length > 50) {
            bodyPreview = bodyPreview.substring(0, 47) + '...';
        }
    }

    return { title, bodyPreview };
}

// Debounced sidebar update to avoid excessive DOM manipulation
let sidebarUpdateTimeout;
function debouncedSidebarUpdate() {
    clearTimeout(sidebarUpdateTimeout);
    sidebarUpdateTimeout = setTimeout(() => {
        updateSidebarNoteTitle(currentNote);
    }, 100); // Update sidebar 100ms after last change
}

// Update a specific note's title and body preview in the sidebar
function updateSidebarNoteTitle(note) {
    if (!note) return;

    const noteElement = document.querySelector(`[data-note-id="${note.id}"]`);
    if (noteElement) {
        const titleElement = noteElement.querySelector('.note-item-title');
        const metaElement = noteElement.querySelector('.note-item-meta');

        // Extract title and body using the new function
        const { title, bodyPreview } = extractTitleAndBodyFromContent(note.content);

        if (titleElement) {
            // Apply character limit for sidebar title display
            let displayTitle = title;
            if (displayTitle.length > 25) {
                displayTitle = displayTitle.substring(0, 22) + '...';
            }
            titleElement.textContent = displayTitle;
        }

        // Update body preview if meta element exists
        if (metaElement) {
            let previewElement = metaElement.querySelector('.note-item-preview');

            if (bodyPreview) {
                if (!previewElement) {
                    // Create preview element if it doesn't exist
                    previewElement = document.createElement('span');
                    previewElement.className = 'note-item-preview';
                    metaElement.appendChild(previewElement);
                }
                previewElement.textContent = bodyPreview;
            } else if (previewElement) {
                // Remove preview element if no body preview
                previewElement.remove();
            }
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
    // Handle arrow keys and other navigation - prevent cursor in list marker space
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home') {
        // Use setTimeout to check after the key has moved the cursor
        setTimeout(() => {
            preventCursorInListSpace();
        }, 0);
    }

    // Prevent typing in the space after list markers
    // Check for regular typing keys (not special keys)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== 'Enter' && e.key !== 'Backspace') {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (range.collapsed) {
                const node = range.startContainer;
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent;
                    const offset = range.startOffset;

                    // Check if we're about to type in the forbidden space
                    const charAtCursor = offset < text.length ? text[offset] : null;
                    const charBefore = offset > 0 ? text[offset - 1] : null;
                    const charBeforeBefore = offset > 1 ? text[offset - 2] : null;
                    let isInForbiddenSpace = false;

                    // Case 1: Cursor is ON the space character
                    if (charAtCursor === ' ' || charAtCursor === '\u00A0') {
                        if (charBefore === '◯' || charBefore === '⬤' ||
                            charBefore === '•' || charBefore === '-') {
                            isInForbiddenSpace = true;
                        } else if (charBefore === '.') {
                            // Check for numbered list
                            const beforePeriod = text.substring(Math.max(0, offset - 4), offset - 1);
                            if (beforePeriod.match(/\d+$/)) {
                                isInForbiddenSpace = true;
                            }
                        }
                    }
                    // Case 2: Cursor is right after the space
                    // Logic removed to allow typing immediately after the list marker space

                    if (isInForbiddenSpace) {
                        // Prevent the default typing
                        e.preventDefault();

                        // Move cursor past the space
                        const newRange = document.createRange();
                        let targetOffset = offset;
                        if (charAtCursor === ' ' || charAtCursor === '\u00A0') {
                            targetOffset = offset + 1; // Move past the space we're on
                        } else {
                            targetOffset = offset + 1; // Move past the space we're after
                        }
                        const safeOffset = Math.min(targetOffset, text.length);
                        newRange.setStart(node, safeOffset);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);

                        // Insert the character at the new position
                        document.execCommand('insertText', false, e.key);
                    }
                }
            }
        }
    }

    // Handle Backspace key for list item removal (checklist, bullets, numbered)
    if (e.key === 'Backspace') {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (range.collapsed && range.startOffset > 0) {
            const node = range.startContainer;
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                const offset = range.startOffset;

                // Check if we're right after a list marker (followed by non-breaking space or regular space)
                if (offset > 0 && (text[offset - 1] === '\u00A0' || text[offset - 1] === ' ')) {
                    // Check for checkbox (◯ or ⬤)
                    if (offset > 1 && (text[offset - 2] === '◯' || text[offset - 2] === '⬤')) {
                        e.preventDefault();
                        const newText = text.substring(0, offset - 2) + text.substring(offset);
                        node.textContent = newText;
                        const newRange = document.createRange();
                        newRange.setStart(node, offset - 2);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);

                        // Immediately check the line we moved to and reactivate if needed
                        const lineText = getCurrentLineText();
                        if (lineText.includes('◯') || lineText.includes('⬤')) {
                            isCircularChecklistMode = true;
                        } else {
                            isCircularChecklistMode = false;
                        }
                        return;
                    }
                    // Check for bullet (•)
                    else if (offset > 1 && text[offset - 2] === '•') {
                        e.preventDefault();
                        const newText = text.substring(0, offset - 2) + text.substring(offset);
                        node.textContent = newText;
                        const newRange = document.createRange();
                        newRange.setStart(node, offset - 2);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);

                        // Immediately check the line we moved to and reactivate if needed
                        const lineText = getCurrentLineText();
                        if (lineText.startsWith('•') || lineText.startsWith('-')) {
                            isDashListMode = true;
                        } else {
                            isDashListMode = false;
                        }
                        return;
                    }
                    // Check for dash (-)
                    else if (offset > 1 && text[offset - 2] === '-') {
                        e.preventDefault();
                        const newText = text.substring(0, offset - 2) + text.substring(offset);
                        node.textContent = newText;
                        const newRange = document.createRange();
                        newRange.setStart(node, offset - 2);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);

                        // Immediately check the line we moved to and reactivate if needed
                        const lineText = getCurrentLineText();
                        if (lineText.startsWith('•') || lineText.startsWith('-')) {
                            isDashListMode = true;
                        } else {
                            isDashListMode = false;
                        }
                        return;
                    }
                    // Check for numbered list (1., 2., etc.)
                    else if (offset > 2) {
                        // Check if there's a number followed by period before the space
                        const beforeSpace = text.substring(Math.max(0, offset - 5), offset - 1);
                        const numberMatch = beforeSpace.match(/(\d+)\.$/);
                        if (numberMatch) {
                            e.preventDefault();
                            const numberLength = numberMatch[1].length;
                            const removeLength = numberLength + 2; // number + period + space
                            const newText = text.substring(0, offset - removeLength) + text.substring(offset);
                            node.textContent = newText;
                            const newRange = document.createRange();
                            newRange.setStart(node, offset - removeLength);
                            newRange.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(newRange);

                            // Immediately check the line we moved to and reactivate if needed
                            const lineText = getCurrentLineText();
                            const numMatch = lineText.match(/^(\d+)\./);
                            if (numMatch) {
                                currentListNumber = parseInt(numMatch[1]);
                                isNumberedListMode = true;
                            } else {
                                isNumberedListMode = false;
                            }
                            return;
                        }
                    }
                }
            }
        }
    }

    // Handle Enter key for list continuation
    if (e.key === 'Enter') {
        const currentLineText = getCurrentLineText();

        // Check if we're on a line with a checkbox - reactivate checklist mode if needed
        if (!isCircularChecklistMode && (currentLineText.includes('◯') || currentLineText.includes('⬤'))) {
            isCircularChecklistMode = true;
        }

        // Check if we're on a line with a bullet/dash - reactivate list mode if needed
        if (!isDashListMode && (currentLineText.startsWith('•') || currentLineText.startsWith('-'))) {
            isDashListMode = true;
        }

        // Check if we're on a line with a number - reactivate numbered list mode if needed
        if (!isNumberedListMode) {
            const numMatch = currentLineText.match(/^(\d+)\./);
            if (numMatch) {
                currentListNumber = parseInt(numMatch[1]);
                isNumberedListMode = true;
            }
        }

        // Handle circular checklist mode
        if (isCircularChecklistMode) {
            e.preventDefault();

            // Check if current line is just the checkbox (empty item)
            // Remove non-breaking space for comparison
            const cleanLineText = currentLineText.replace(/\u00A0/g, ' ').trim();
            if (cleanLineText === '◯' || cleanLineText === '⬤' || cleanLineText === '') {
                isCircularChecklistMode = false;
                document.execCommand('insertText', false, '\n');
            } else {
                // Continue checklist with unchecked circle and non-breaking space
                document.execCommand('insertText', false, '\n◯\u00A0');
            }
            return;
        }

        // Handle numbered list mode
        if (isNumberedListMode) {
            e.preventDefault();

            // Check if current line has content after the number (handle non-breaking space)
            const normalizedNumberedLine = currentLineText.replace(/\u00A0/g, ' ');
            const numberMatch = normalizedNumberedLine.match(/^\d+\.\s*/);
            if (numberMatch && normalizedNumberedLine.trim() === numberMatch[0].trim()) {
                // Empty numbered item - exit numbered list mode
                isNumberedListMode = false;
                currentListNumber = 1;
                document.execCommand('insertText', false, '\n');
            } else {
                // Continue numbered list with non-breaking space
                currentListNumber++;
                document.execCommand('insertText', false, `\n${currentListNumber}.\u00A0`);
            }
            return;
        }

        // Handle dash/bullet list mode
        if (isDashListMode) {
            e.preventDefault();

            // Check if current line has content after the dash/bullet (handle non-breaking space)
            const normalizedDashLine = currentLineText.replace(/\u00A0/g, ' ').trim();
            if (normalizedDashLine === '-' || normalizedDashLine === '•' || normalizedDashLine === '') {
                // Empty line or just dash - exit dash list mode
                isDashListMode = false;
                document.execCommand('insertText', false, '\n');
            } else {
                // Continue list with same marker and non-breaking space
                const marker = currentLineText.startsWith('•') ? '•\u00A0' : '-\u00A0';
                document.execCommand('insertText', false, '\n' + marker);
            }
            // Reset text style to body on Enter
            resetTextStyleToBody();
            return;
        }

        // Reset text style to body on Enter (for non-list contexts)
        if (activeTextStyle !== 'body') {
            resetTextStyleToBody();
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

    // Close app with ESC key
    if (e.key === 'Escape') {
        e.preventDefault();
        window.electronAPI.closeApp();
        return;
    }

    // Handle ArrowLeft at start of list item to jump to previous line
    if (e.key === 'ArrowLeft') {
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const node = range.startContainer;

            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                const offset = range.startOffset;

                // Identify marker at start of node
                let markerLength = 0;
                if (text.match(/^[-•]\s/)) markerLength = 2;
                else if (text.match(/^[◯⬤]\s/)) markerLength = 2;
                else {
                    const numMatch = text.match(/^(\d+)\.\s/);
                    if (numMatch) markerLength = numMatch[0].length;
                }

                // If we are exactly at the start of the text (after marker)
                if (markerLength > 0 && offset === markerLength) {
                    e.preventDefault();
                    // Move back until we leave this "forbidden" start area
                    // We want to end up at the end of the previous line

                    // Try moving back character by character
                    for (let i = 0; i < markerLength + 2; i++) {
                        selection.modify('move', 'backward', 'character');

                        const newRange = selection.getRangeAt(0);
                        const newNode = newRange.startContainer;

                        // If we changed nodes, we are likely in previous line. Good.
                        if (newNode !== node) break;

                        // If we are at offset 0, one more move should take us out
                        if (newRange.startOffset === 0) continue;
                    }
                    return;
                }
            }
        }
    }
}

// Formatting commands
function executeCommand(command) {
    // Preserve list markers by adjusting selection if needed
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const startNode = range.startContainer;
        
        // Check if selection starts with a list marker
        if (startNode.nodeType === Node.TEXT_NODE) {
            const text = startNode.textContent;
            const startOffset = range.startOffset;
            
            // Check if we're selecting from the start of a list marker
            if (startOffset === 0) {
                let markerLength = 0;
                
                // Check for bullet/dash markers
                if (text.match(/^[•◯⬤\-]\s/)) {
                    markerLength = 2; // marker + space
                }
                // Check for numbered list markers
                else {
                    const numMatch = text.match(/^(\d+)\.\s/);
                    if (numMatch) {
                        markerLength = numMatch[0].length;
                    }
                }
                
                // Adjust selection to exclude marker
                if (markerLength > 0 && markerLength < text.length) {
                    range.setStart(startNode, markerLength);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        }
    }
    
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

// List functionality
let isDashListMode = false;
let isNumberedListMode = false;
let currentListNumber = 1;
let isCircularChecklistMode = false;

function insertDashList() {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    // Insert dash with non-breaking space
    document.execCommand('insertText', false, '-\u00A0');
    isDashListMode = true;

    editor.focus();
}

function insertBulletList() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    // Insert bullet with non-breaking space
    document.execCommand('insertText', false, '•\u00A0');
    isDashListMode = true;

    editor.focus();
}

function insertNumberedList() {
    currentListNumber = 1;
    // Insert number with non-breaking space after period
    document.execCommand('insertText', false, '1.\u00A0');
    isNumberedListMode = true;

    editor.focus();
}

function insertCircularChecklist() {
    // Insert unchecked circular checkbox with non-breaking space (◯ = hollow/unchecked)
    // Using non-breaking space (U+00A0) so it acts as a single unit
    document.execCommand('insertText', false, '◯\u00A0');
    isCircularChecklistMode = true;

    editor.focus();
}

// Toggle circular checkbox state
// ◯ (U+25EF) = hollow/unchecked, ⬤ (U+2B24) = filled/checked (larger circles)
// Uses DOM manipulation instead of innerHTML to prevent content reset
function toggleCircularCheckbox(element) {
    const line = element.closest('div') || element.parentNode;
    if (!line || line.nodeType !== Node.ELEMENT_NODE) return;
    
    // Find the text node containing the checkbox
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT, null, false);
    let textNode;
    let isChecked = false;
    
    while ((textNode = walker.nextNode())) {
        if (textNode.textContent.includes('⬤')) {
            isChecked = true;
            break;
        }
        if (textNode.textContent.includes('◯')) {
            isChecked = false;
            break;
        }
    }
    
    if (!textNode) return;
    
    if (isChecked) {
        // Unchecking: Replace ⬤ with ◯ and remove strikethrough
        textNode.textContent = textNode.textContent.replace('⬤', '◯');
        
        // Remove any <s> tags by replacing with their text content
        const strikeTags = line.querySelectorAll('s');
        strikeTags.forEach(s => {
            const textContent = s.textContent;
            s.replaceWith(document.createTextNode(textContent));
        });
    } else {
        // Checking: Replace ◯ with ⬤ and add strikethrough to text after
        const text = textNode.textContent;
        const circleIndex = text.indexOf('◯');
        if (circleIndex === -1) return;
        
        // Split the text node: before circle, circle+space, after circle
        const beforeCircle = text.substring(0, circleIndex);
        const afterCircle = text.substring(circleIndex + 2); // Skip ◯ and space
        
        // Update text node to just before + checked circle + space
        textNode.textContent = beforeCircle + '⬤\u00A0';
        
        // Create strikethrough element for text after
        if (afterCircle) {
            const strikeElem = document.createElement('s');
            strikeElem.style.color = '#666';
            strikeElem.textContent = afterCircle;
            
            // Insert after the text node
            if (textNode.nextSibling) {
                line.insertBefore(strikeElem, textNode.nextSibling);
            } else {
                line.appendChild(strikeElem);
            }
        }
    }
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

// Font size dropdown removed - sizes now in formatting dropdown
function toggleFontSizeDropdown() { }
function closeFontSizeDropdown() { }

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
    // This function is kept for compatibility but font size is now fixed at 18px
    // Font sizes are applied to selected text via applyTextStyle instead
}

// Current active text style mode (title, heading, body)
let activeTextStyle = 'body';

// Style configurations - just sizes, bold is activated separately
// Style configurations - using block classes
const textStyleConfigs = {
    title: { className: 'line-title', label: 'Title', activateBold: false },
    heading: { className: 'line-heading', label: 'Heading', activateBold: false },
    body: { className: 'line-body', label: 'Body', activateBold: false }
};

// Apply text style - applies block class to the current line
function applyTextStyle(style, size) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const targetStyle = style || 'body';
    const styleConfig = textStyleConfigs[targetStyle] || textStyleConfigs.body;

    const range = selection.getRangeAt(0);
    let node = range.startContainer;

    // Find the parent block element (div or p)
    // If we are in the editor root, we might need to wrap the text in a div first
    while (node && node !== editor) {
        if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'DIV' || node.tagName === 'P')) {
            break;
        }
        node = node.parentNode;
    }

    // If we couldn't find a block element (e.g. text directly in editor), wrap it
    if (node === editor || !node) {
        document.execCommand('formatBlock', false, 'div');
        // Re-get the selection and node after formatting
        const newSelection = window.getSelection();
        if (newSelection.rangeCount > 0) {
            const newRange = newSelection.getRangeAt(0);
            node = newRange.startContainer;
            while (node && node !== editor) {
                if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'DIV' || node.tagName === 'P')) {
                    break;
                }
                node = node.parentNode;
            }
        }
    }

    if (node && node !== editor && node.nodeType === Node.ELEMENT_NODE) {
        // Remove all style classes
        node.classList.remove('line-title', 'line-heading', 'line-body');

        // Add the new style class
        node.classList.add(styleConfig.className);

        // Remove any inline font-size styles that might conflict
        node.style.fontSize = '';
        node.style.fontWeight = '';

        // Also clean up any span wrappers inside that might have old styling
        const spans = node.querySelectorAll('span[style*="font-size"]');
        spans.forEach(span => {
            span.style.fontSize = '';
            if (span.getAttribute('style') === '') {
                // Unwrap if style is empty
                const parent = span.parentNode;
                while (span.firstChild) parent.insertBefore(span.firstChild, span);
                parent.removeChild(span);
            }
        });
    }

    // Set the active style mode
    activeTextStyle = targetStyle;

    // Update UI
    updateTextStyleUI(targetStyle);

    editor.focus();
}

// Check if we're on the first line and should override title styling
function checkFirstLineOverride() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    // Check if cursor is on the first line
    const range = selection.getRangeAt(0);
    const editorContent = editor.innerHTML;

    // If editor is empty or cursor is at very beginning, apply override
    if (!editorContent || editorContent === '<br>' || editorContent === '') {
        editor.classList.add('title-override');
        return;
    }

    // Check if we're in the first block/line
    let node = range.startContainer;
    while (node && node !== editor) {
        if (node.previousSibling && node.parentNode === editor) {
            // Not on first line
            return;
        }
        node = node.parentNode;
    }

    // We're on first line, add override
    editor.classList.add('title-override');
}

// Update the text style UI (display and active button)
function updateTextStyleUI(style) {
    // If style is not provided, try to detect it from cursor position
    let currentStyle = style;

    if (!currentStyle) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            let node = selection.getRangeAt(0).startContainer;
            while (node && node !== editor) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList.contains('line-title')) currentStyle = 'title';
                    else if (node.classList.contains('line-heading')) currentStyle = 'heading';
                    else if (node.classList.contains('line-body')) currentStyle = 'body';

                    if (currentStyle) break;
                }
                node = node.parentNode;
            }
        }
    }

    // Default to body if still unknown
    if (!currentStyle) currentStyle = 'body';

    // Update active button in the formatting dropdown
    document.querySelectorAll('.size-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.style === currentStyle) {
            option.classList.add('active');
        }
    });

    activeTextStyle = currentStyle;
}

// Reset text style to body (called on Enter key)
function resetBlockStyleAfterEnter() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let node = range.startContainer;

    // Find the current block element
    while (node && node !== editor) {
        if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'DIV' || node.tagName === 'P')) {
            // We found the block element for the new line
            // Remove title/heading classes and add body class
            node.classList.remove('line-title', 'line-heading');
            node.classList.add('line-body');

            // Remove any inline styles
            node.style.fontSize = '';
            node.style.fontWeight = '';

            return;
        }
        node = node.parentNode;
    }
}

// Get the character at the click position
function getClickedCharacter(e) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;

    if (node.nodeType === Node.TEXT_NODE) {
        const offset = range.startOffset;
        const char = node.textContent.charAt(offset) || node.textContent.charAt(offset - 1);
        return char;
    }
    return null;
}

// Toggle circular checkbox at cursor position
// Uses DOM manipulation instead of innerHTML to prevent content reset
function toggleCircularCheckboxAtCursor() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let node = range.startContainer;

    // Find the parent element that contains this line
    let lineElement = node;
    while (lineElement && lineElement !== editor) {
        if (lineElement.nodeType === Node.ELEMENT_NODE &&
            (lineElement.tagName === 'DIV' || lineElement.tagName === 'P')) {
            break;
        }
        lineElement = lineElement.parentNode;
    }

    // If we couldn't find a line element, use the editor itself for direct text
    if (!lineElement || lineElement === editor) {
        lineElement = null;
    }

    // Find the text node containing the checkbox character
    let targetTextNode = null;
    let isChecked = false;
    
    if (lineElement) {
        // Search within the line element
        const walker = document.createTreeWalker(lineElement, NodeFilter.SHOW_TEXT, null, false);
        let textNode;
        while ((textNode = walker.nextNode())) {
            if (textNode.textContent.includes('⬤')) {
                targetTextNode = textNode;
                isChecked = true;
                break;
            }
            if (textNode.textContent.includes('◯')) {
                targetTextNode = textNode;
                isChecked = false;
                break;
            }
        }
    } else if (node.nodeType === Node.TEXT_NODE) {
        // Direct text node case
        const text = node.textContent;
        if (text.includes('⬤')) {
            targetTextNode = node;
            isChecked = true;
        } else if (text.includes('◯')) {
            targetTextNode = node;
            isChecked = false;
        }
    }

    if (!targetTextNode) return;

    // Perform the toggle using DOM manipulation
    if (isChecked) {
        // Unchecking: Replace ⬤ with ◯ and remove strikethrough
        targetTextNode.textContent = targetTextNode.textContent.replace('⬤', '◯');
        
        // Remove any <s> tags in the line by replacing with their text content
        if (lineElement) {
            const strikeTags = lineElement.querySelectorAll('s');
            strikeTags.forEach(s => {
                const textContent = s.textContent;
                s.replaceWith(document.createTextNode(textContent));
            });
            // Normalize to merge adjacent text nodes
            lineElement.normalize();
        }
    } else {
        // Checking: Replace ◯ with ⬤ and add strikethrough to text after
        const text = targetTextNode.textContent;
        const circleIndex = text.indexOf('◯');
        if (circleIndex === -1) return;
        
        // Determine the space character used (regular or non-breaking)
        const spaceChar = (circleIndex + 1 < text.length && text[circleIndex + 1] === '\u00A0') ? '\u00A0' : ' ';
        
        // Split: text before circle, and text after circle+space
        const beforeCircle = text.substring(0, circleIndex);
        const afterCircle = text.substring(circleIndex + 2); // Skip ◯ and space
        
        // Update text node to just before + checked circle + space
        targetTextNode.textContent = beforeCircle + '⬤\u00A0';
        
        // Create strikethrough element for text after
        if (afterCircle) {
            const strikeElem = document.createElement('s');
            strikeElem.style.color = '#666';
            strikeElem.textContent = afterCircle;
            
            // Insert after the text node
            const parent = targetTextNode.parentNode;
            if (targetTextNode.nextSibling) {
                parent.insertBefore(strikeElem, targetTextNode.nextSibling);
            } else {
                parent.appendChild(strikeElem);
            }
        }
    }

    // Restore cursor to end of line content
    const cursorTarget = lineElement || targetTextNode.parentNode;
    if (cursorTarget) {
        const newRange = document.createRange();
        newRange.selectNodeContents(cursorTarget);
        newRange.collapse(false); // Collapse to end
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
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

            // Reset font size by breaking out of styled spans
            resetFontSizeAfterEnter();

            // Reset to body style
            activeTextStyle = 'body';
            updateTextStyleUI('body');

            // Update button states
            updateFormatButtonStates();
        }, 10);
    }
}

// Reset font size after Enter to ensure new line is body text
function resetFontSizeAfterEnter() {
    // This function is replaced by resetBlockStyleAfterEnter
    resetBlockStyleAfterEnter();
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
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.querySelector('.app-container').classList.contains('fullscreen-mode')) {
        toggleFullscreen();
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

async function handleContextMenuPaste(editor) {
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
            editor.dispatchEvent(new Event('input', { bubbles: true }));
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
                editor.dispatchEvent(new Event('input', { bubbles: true }));
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

