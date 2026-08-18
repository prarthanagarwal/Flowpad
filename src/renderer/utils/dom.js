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

// Get the direct block element child of #editor containing current selection
export function getCurrentBlock() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const editor = document.getElementById('editor');
    if (!editor) return null;

    let node = selection.getRangeAt(0).startContainer;
    while (node && node !== editor) {
        if (node.parentNode === editor) {
            return node;
        }
        node = node.parentNode;
    }
    return null;
}

// Get the current line text from cursor position
export function getCurrentLineText() {
    const block = getCurrentBlock();
    if (block) {
        return block.textContent.replace(/\u00A0/g, ' ');
    }
    return '';
}

// Replace text at the start of current line
export function replaceCurrentLineStart(oldStart, newStart) {
    const block = getCurrentBlock();
    if (!block) return;

    const text = block.textContent.replace(/\u00A0/g, ' ');
    if (text.startsWith(oldStart)) {
        block.textContent = newStart + text.substring(oldStart.length);
        const range = document.createRange();
        range.selectNodeContents(block);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

