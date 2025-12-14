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
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) return;

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent;
    const offset = range.startOffset;

    let markerLength = 0;

    if (text.match(/^[-•]\s/)) {
        markerLength = 2;
    } else if (text.match(/^[◯⬤]\s/)) {
        markerLength = 2;
    } else {
        const numMatch = text.match(/^(\d+)\.\s/);
        if (numMatch) {
            markerLength = numMatch[0].length;
        }
    }

    if (markerLength === 0) return;

    if (offset < markerLength) {
        const newRange = document.createRange();
        newRange.setStart(node, markerLength);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
}

// Check if click is directly on a checkbox character (◯ or ⬤)
function isClickOnCheckbox(e) {
    // Get the click position
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
    
    if (!range) return false;
    
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return false;
    
    const text = node.textContent;
    const offset = range.startOffset;
    
    // Check if click is at or near a checkbox character
    // Check the character at offset and one before (in case of nbsp after checkbox)
    const checkboxChars = ['◯', '⬤'];
    
    // Check character at current offset
    if (offset > 0 && checkboxChars.includes(text[offset - 1])) {
        return true;
    }
    // Check character at offset
    if (checkboxChars.includes(text[offset])) {
        return true;
    }
    // Check if we're in the space right after the checkbox
    if (offset > 1 && checkboxChars.includes(text[offset - 2]) && (text[offset - 1] === ' ' || text[offset - 1] === '\u00A0')) {
        return true;
    }
    
    return false;
}

// Handle paste events
export function handlePaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, text);
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
        setTimeout(() => {
            preventCursorInListSpace();
        }, 0);
    });

    editor.addEventListener('focus', updateFormatButtonStates);

    editor.addEventListener('click', (e) => {
        // Only toggle checkbox if clicking directly on the checkbox character
        const clickedOnCheckbox = isClickOnCheckbox(e);
        if (clickedOnCheckbox) {
            toggleCircularCheckboxAtCursor();
        }
        preventCursorInListSpace();
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
