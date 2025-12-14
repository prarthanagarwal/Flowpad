// ===== SIDEBAR MODULE =====
// Handles sidebar open/close and note list rendering

import { currentNote, allNotes, allFolders, currentFolder, setCurrentFolder } from '../../state.js';
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
export function renderNotesList(notesToRender = null, loadNoteCallback, deleteNoteCallback, showMoveNoteMenuCallback) {
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
            const categorySection = createCategorySection(categoryName, notes, loadNoteCallback, deleteNoteCallback, showMoveNoteMenuCallback);
            notesList.appendChild(categorySection);
        }
    });
}

// Create category section
function createCategorySection(categoryName, notes, loadNoteCallback, deleteNoteCallback, showMoveNoteMenuCallback) {
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
        const noteElement = createNoteListItem(note, loadNoteCallback, deleteNoteCallback, showMoveNoteMenuCallback);
        notesContainer.appendChild(noteElement);
    });

    section.appendChild(notesContainer);
    return section;
}

// Create note list item
function createNoteListItem(note, loadNoteCallback, deleteNoteCallback, showMoveNoteMenuCallback) {
    const div = document.createElement('div');
    div.className = 'note-item';
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
                    <span class="time-text">${displayText}</span>${folderInfo}
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

    // Add click event to load note
    div.addEventListener('click', async (e) => {
        if (!e.target.closest('.note-item-actions')) {
            await loadNoteCallback(note);
            closeSidebar();
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
        showMoveNoteMenuCallback(e, note);
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
        showMoveNoteMenuCallback(e, note);
    });

    return div;
}

// Extract title and body from content
function extractTitleAndBodyFromContent(content) {
    if (!content) {
        return { title: 'New Note', bodyPreview: '' };
    }

    let textContent;
    if (typeof content === 'string' && content.includes('<')) {
        let processedContent = content
            .replace(/<div>/gi, '\n')
            .replace(/<\/div>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p>/gi, '\n')
            .replace(/<\/p>/gi, '');

        textContent = new DOMParser().parseFromString(processedContent, 'text/html').body.textContent || '';
    } else {
        textContent = content;
    }

    const trimmedContent = textContent.trim();

    if (!trimmedContent) {
        return { title: 'New Note', bodyPreview: '' };
    }

    const allLines = trimmedContent.split('\n');
    const nonEmptyLines = allLines.filter(line => line.trim());

    const title = nonEmptyLines.length > 0 ? nonEmptyLines[0].trim() : 'New Note';

    let bodyPreview = '';
    if (nonEmptyLines.length > 1) {
        bodyPreview = nonEmptyLines[1].trim();
        if (bodyPreview.length > 50) {
            bodyPreview = bodyPreview.substring(0, 47) + '...';
        }
    }

    return { title, bodyPreview };
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
            titleElement.textContent = displayTitle;
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
