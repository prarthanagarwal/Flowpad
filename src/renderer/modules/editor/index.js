// ===== EDITOR MODULE =====
// Main editor module that coordinates all editor functionality

export * from './lists.js';
export * from './formatting.js';

import { 
    checkForListActivation, 
    handleListEnter,
    insertBulletList,
    insertNumberedList,
    insertCircularChecklist,
    toggleCircularCheckboxAtCursor
} from './lists.js';
import { 
    executeCommand, 
    updateFormatButtonStates, 
    handleFormattingReset,
    updateTextStyleUI
} from './formatting.js';
import { isNoteDirty, setIsNoteDirty, currentNote } from '../../state.js';
import { normalizeHtmlForComparison } from '../../utils/dom.js';
import { closeFormattingDropdown } from '../ui/dropdowns.js';

// Update placeholder visibility
export function updatePlaceholder(editor, editorPlaceholder) {
    if (editor.textContent.trim() === '') {
        editorPlaceholder.classList.remove('hidden');
    } else {
        editorPlaceholder.classList.add('hidden');
    }
}

// Update word count
export function updateWordCount(editor, wordCountElement) {
    let text = editor.textContent || editor.innerText;
    
    // Remove list markers before counting (bullets, checkboxes, quotes)
    text = text.replace(/[•◯⬤>]/g, '');
    text = text.replace(/^\d+\.\s*/gm, '');
    text = text.replace(/^-\s+/gm, '');
    
    const words = text.trim() ? text.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
    wordCountElement.textContent = `${words} word${words !== 1 ? 's' : ''}`;
}

// Prevent cursor placement in list marker space
export function preventCursorInListSpace() {
    // Disabled aggressive cursor forcing so Backspace can delete list markers cleanly
    return;
}

// Clean plain-text paste handler using Range & Selection API
export function handlePaste(e) {
    e.preventDefault();
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    let text = clipboardData.getData('text/plain') || '';
    if (!text) return;

    // Normalize newlines and strip unwanted zero-width characters & auto-injected non-breaking spaces
    text = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\u00A0/g, ' ');

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const lines = text.split('\n');
    const fragment = document.createDocumentFragment();

    lines.forEach((line, index) => {
        if (index > 0) {
            fragment.appendChild(document.createElement('br'));
        }
        fragment.appendChild(document.createTextNode(line));
    });

    range.insertNode(fragment);

    // Collapse selection to end of inserted fragment
    selection.collapseToEnd();

    // Trigger single input event for word count & placeholder update
    const editor = document.getElementById('editor');
    if (editor) {
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// Initialize editor module
export function initEditor(editor, editorPlaceholder, wordCountElement, handleInputCallback) {
    // Editor events
    editor.addEventListener('input', (e) => {
        updatePlaceholder(editor, editorPlaceholder);
        updateWordCount(editor, wordCountElement);

        if (e && e.inputType === 'insertText' && e.data === ' ') {
            checkForListActivation();
        }

        if (handleInputCallback) {
            handleInputCallback(e);
        }
    });

    editor.addEventListener('keyup', (e) => {
        updateFormatButtonStates();
    });

    editor.addEventListener('paste', handlePaste);

    editor.addEventListener('mouseup', () => {
        updateFormatButtonStates();
    });

    editor.addEventListener('focus', updateFormatButtonStates);

    editor.addEventListener('click', (e) => {
        // Toggle interactive checkbox if clicking on a checkbox circle or checklist item
        const checkboxCircle = e.target.closest('.checkbox-circle');
        const checklistItem = e.target.closest('.checklist-item');
        if (checkboxCircle || (checklistItem && e.target === checklistItem)) {
            toggleCircularCheckboxAtCursor(e.target);
        }
    });

    // Formatting reset on Enter
    editor.addEventListener('keydown', handleFormattingReset);

    // Selection change
    document.addEventListener('selectionchange', () => {
        updateFormatButtonStates();
        updateTextStyleUI();

        const selection = window.getSelection();
        if (selection.rangeCount > 0 && selection.isCollapsed) {
            setTimeout(() => {
                preventCursorInListSpace();
            }, 0);
        }
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

    // Checklist button
    document.getElementById('checklistBtn')?.addEventListener('click', insertCircularChecklist);

    // Checkbox hover effect
    editor.addEventListener('mousemove', (e) => {
        let range;

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
            text = node.textContent || '';
            offset = 0;
        }

        const nearbyText = text.substring(Math.max(0, offset - 2), Math.min(text.length, offset + 2));
        const isOnCircle = offset > 0 && (text[offset - 1] === '◯' || text[offset - 1] === '⬤');
        const isAfterCircle = offset > 1 && (text[offset - 2] === '◯' || text[offset - 2] === '⬤') &&
            (text[offset - 1] === ' ' || text[offset - 1] === '\u00A0');

        if (isOnCircle || isAfterCircle || nearbyText.includes('◯') || nearbyText.includes('⬤')) {
            editor.classList.add('hovering-checkbox');
        } else {
            editor.classList.remove('hovering-checkbox');
        }
    });

    editor.addEventListener('mouseleave', () => {
        editor.classList.remove('hovering-checkbox');
    });
}

// Export key handler
export { handleListEnter, executeCommand, updateFormatButtonStates };
