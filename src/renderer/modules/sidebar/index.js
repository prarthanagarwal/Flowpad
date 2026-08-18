// ===== SIDEBAR MODULE =====
// Handles sidebar open/close and note list rendering

import { currentNote, allNotes, allFolders, currentFolder } from '../../state.js';
import { escapeHtml } from '../../utils/dom.js';
import { getDisplayTextForNote, categorizeNotesByTime } from '../../utils/time.js';

// DOM References
let sidebar;
let sidebarOverlay;
let notesList;

// Initialize sidebar references
export function initSidebarElements() {
    sidebar = document.getElementById('sidebar');
    sidebarOverlay = document.getElementById('sidebarOverlay');
    notesList = document.getElementById('notesList');
}

// Toggle sidebar visibility
export function toggleSidebar() {
    const isOpening = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('show');

    // If closing sidebar, restore focus to editor after animation
    if (!isOpening) {
        const editor = document.getElementById('editor');
        setTimeout(() => {
            if (editor) editor.focus();
        }, 350);
    }
}

// Close sidebar
export function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('show');

    // Restore focus to editor after sidebar closes
    const editor = document.getElementById('editor');
    setTimeout(() => {
        if (editor) editor.focus();
    }, 350);
}

// Get filtered notes based on current folder
export function getFilteredNotes() {
    if (currentFolder === 'all') {
        return allNotes;
    }
    return allNotes.filter(note => note.folder === currentFolder);
}

// Render notes list in sidebar
export function renderNotesList(notesToRender = null, loadNoteCallback, deleteNoteCallback, showMoveNoteMenuCallback, togglePinNoteCallback) {
    if (!notesList) return;
    
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
            const categorySection = createCategorySection(categoryName, notes, loadNoteCallback, deleteNoteCallback, showMoveNoteMenuCallback, togglePinNoteCallback);
            notesList.appendChild(categorySection);
        }
    });
}

// Create category section
function createCategorySection(categoryName, notes, loadNoteCallback, deleteNoteCallback, showMoveNoteMenuCallback, togglePinNoteCallback) {
    const section = document.createElement('div');
    section.className = 'category-section';
    if (categoryName === 'Pinned') {
        section.classList.add('pinned-section');
    }

    // Create category header
    const header = document.createElement('div');
    header.className = 'category-header';
    if (categoryName === 'Pinned') {
        header.classList.add('category-header-pinned');
        header.innerHTML = '<i class="ph-fill ph-push-pin" style="font-size: 11px; margin-right: 5px; color: #f59e0b;"></i> Pinned';
    } else {
        header.textContent = categoryName;
    }
    section.appendChild(header);

    // Create notes container
    const notesContainer = document.createElement('div');
    notesContainer.className = 'category-notes';

    notes.forEach(note => {
        const noteElement = createNoteListItem(note, loadNoteCallback, deleteNoteCallback, showMoveNoteMenuCallback, togglePinNoteCallback);
        notesContainer.appendChild(noteElement);
    });

    section.appendChild(notesContainer);
    return section;
}

// Create note list item
function createNoteListItem(note, loadNoteCallback, deleteNoteCallback, showMoveNoteMenuCallback, togglePinNoteCallback) {
    const div = document.createElement('div');
    div.className = 'note-item';
    if (note.isPinned) {
        div.classList.add('is-pinned');
    }
    div.dataset.noteId = note.id;

    if (currentNote && currentNote.id === note.id) {
        div.classList.add('active');
    }

    const displayText = getDisplayTextForNote(note);
    const { title, bodyPreview } = extractTitleAndBodyFromContent(note.content);

    // Apply character limit for sidebar title display
    let displayTitle = title;
    if (displayTitle.length > 25) {
        displayTitle = displayTitle.substring(0, 22) + '...';
    }

    // Create time display with folder info
    let folderInfo = '';
    if (note.folder && currentFolder === 'all') {
        const folder = allFolders.find(f => f.id === note.folder);
        if (folder) {
            folderInfo = `<span class="folder-separator">·</span><i class="ph ph-folder-simple note-folder-icon"></i><span class="folder-name">${escapeHtml(folder.name)}</span>`;
        }
    }

    // Build body preview if available
    let bodyPreviewHtml = '';
    if (bodyPreview) {
        bodyPreviewHtml = `<span class="note-item-preview">${escapeHtml(bodyPreview)}</span>`;
    }

    let pinIconHtml = note.isPinned ? `<i class="ph-fill ph-push-pin note-pin-badge" title="Pinned Note"></i> ` : '';

    div.innerHTML = `
        <div class="note-item-content">
            <div class="note-item-title">${pinIconHtml}${escapeHtml(displayTitle)}</div>
            <div class="note-item-meta">
                <span class="note-item-time">
                    <span class="time-text">${displayText}</span>${folderInfo}
                </span>
                ${bodyPreviewHtml}
            </div>
        </div>
        <div class="note-item-actions">
            <button class="note-action-btn pin-note ${note.isPinned ? 'pinned' : ''}" data-note-id="${note.id}" title="${note.isPinned ? 'Unpin Note' : 'Pin Note'}">
                <i class="ph ${note.isPinned ? 'ph-fill ph-push-pin' : 'ph-push-pin'}" style="font-size: 12px; ${note.isPinned ? 'color: #f59e0b;' : ''}"></i>
            </button>
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
    div.addEventListener('click', async (e) => {
        if (!e.target.closest('.note-item-actions')) {
            await loadNoteCallback(note);
            closeSidebar();
        }
    });

    // Add pin event
    div.querySelector('.pin-note').addEventListener('click', (e) => {
        e.stopPropagation();
        if (togglePinNoteCallback) {
            togglePinNoteCallback(note);
        }
    });

    // Add delete event
    div.querySelector('.delete-note').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNoteCallback(note.id);
    });

    // Add move note event
    div.querySelector('.move-note').addEventListener('click', (e) => {
        e.stopPropagation();
        showMoveNoteMenuCallback(e, note, true);
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
        showMoveNoteMenuCallback(e, note, false);
    });

    return div;
}

// Extract title and body from content using DOM-based parsing
function extractTitleAndBodyFromContent(content) {
    if (!content) {
        return { title: 'New Note', bodyPreview: '' };
    }

    let title = '';
    let bodyPreview = '';
    
    if (String(content) === content && content.includes('<')) {
        // Create a temporary container to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        
        const lines = [];
        
        for (const node of tempDiv.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (text) {
                    lines.push(text);
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName;
                if (tag === 'BR') {
                    lines.push('');
                } else {
                    const text = node.textContent.trim();
                    lines.push(text);
                }
            }
        }
        
        const nonEmptyLines = lines.filter(line => line.trim());
        title = nonEmptyLines.length > 0 ? nonEmptyLines[0].trim() : 'New Note';
        
        if (nonEmptyLines.length > 1) {
            bodyPreview = nonEmptyLines[1].trim();
            if (bodyPreview.length > 50) {
                bodyPreview = bodyPreview.substring(0, 47) + '...';
            }
        }
    } else {
        const lines = content.split('\n');
        const nonEmptyLines = lines.filter(line => line.trim());
        title = nonEmptyLines.length > 0 ? nonEmptyLines[0].trim() : 'New Note';
        
        if (nonEmptyLines.length > 1) {
            bodyPreview = nonEmptyLines[1].trim();
            if (bodyPreview.length > 50) {
                bodyPreview = bodyPreview.substring(0, 47) + '...';
            }
        }
    }

    // Strip HTML markup from extracted title and bodyPreview
    title = title.replace(/<[^>]*>/g, '').trim();
    bodyPreview = bodyPreview.replace(/<[^>]*>/g, '').trim();

    return { title: title || 'New Note', bodyPreview };
}

// Update a specific note's title in the sidebar
export function updateSidebarNoteTitle(note) {
    if (!note) return;

    const noteElement = document.querySelector(`[data-note-id="${note.id}"]`);
    if (noteElement) {
        const titleElement = noteElement.querySelector('.note-item-title');
        const metaElement = noteElement.querySelector('.note-item-meta');

        const { title, bodyPreview } = extractTitleAndBodyFromContent(note.content);

        if (titleElement) {
            let displayTitle = title;
            if (displayTitle.length > 25) {
                displayTitle = displayTitle.substring(0, 22) + '...';
            }
            const pinIconHtml = note.isPinned ? `<i class="ph-fill ph-push-pin note-pin-badge" title="Pinned Note"></i> ` : '';
            titleElement.innerHTML = `${pinIconHtml}${escapeHtml(displayTitle)}`;
        }

        if (metaElement) {
            let previewElement = metaElement.querySelector('.note-item-preview');

            if (bodyPreview) {
                if (!previewElement) {
                    previewElement = document.createElement('span');
                    previewElement.className = 'note-item-preview';
                    metaElement.appendChild(previewElement);
                }
                previewElement.textContent = bodyPreview;
            } else if (previewElement) {
                previewElement.remove();
            }
        }
    }
}

// Initialize sidebar event listeners
export function initSidebar() {
    initSidebarElements();
    
    const historyBtn = document.getElementById('historyBtn');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    
    if (historyBtn) {
        historyBtn.addEventListener('click', toggleSidebar);
    }
    
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }
}

export { extractTitleAndBodyFromContent };
