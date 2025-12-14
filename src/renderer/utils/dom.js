// ===== DOM UTILITIES =====
// Common DOM manipulation functions

// Escape HTML for safe display
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Normalize HTML for comparison (handles browser rendering differences)
export function normalizeHtmlForComparison(html) {
    if (!html) return '';
    return html
        .replace(/\s+/g, ' ')           // Normalize whitespace
        .replace(/>\s+</g, '><')        // Remove whitespace between tags
        .replace(/\s*\/>/g, '/>')       // Normalize self-closing tags
        .replace(/&nbsp;/g, '\u00A0')   // Normalize non-breaking spaces
        .trim();
}

// Focus editor and optionally position cursor at end
export function focusEditor(editor, positionAtEnd = true) {
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

// Get the current line text from cursor position
export function getCurrentLineText() {
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

// Replace text at the start of current line
export function replaceCurrentLineStart(oldStart, newStart) {
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
