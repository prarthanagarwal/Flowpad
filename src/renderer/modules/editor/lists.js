import { getCurrentBlock } from '../../utils/dom.js';

// Let Chromium own list structure, cursor splitting, numbering, and undo history.
function toggleList(command, marker = 'bullet') {
    const editor = document.getElementById('editor');
    editor.focus();
    const selection = window.getSelection();
    if (!selection.rangeCount || !editor.contains(selection.anchorNode)) return;
    document.execCommand(command, false, null);
    if (command === 'insertUnorderedList') {
        const active = selection.anchorNode.nodeType === Node.TEXT_NODE
            ? selection.anchorNode.parentElement : selection.anchorNode;
        const list = active.closest('ul');
        if (list && !list.hasAttribute('data-marker')) list.setAttribute('data-marker', marker);
        const range = selection.getRangeAt(0);
        const items = selection.isCollapsed ? [active.closest('li')].filter(Boolean)
            : [...editor.querySelectorAll('li')].filter(item => range.intersectsNode(item));
        items.forEach(item => item.setAttribute('data-marker', marker));
    }
    editor.dispatchEvent(new Event('input', { bubbles: true }));
}

export function insertBulletList() {
    toggleList('insertUnorderedList');
}

export function insertNumberedList() {
    toggleList('insertOrderedList');
}

export function checkForListActivation() {
    const editor = document.getElementById('editor');
    const selection = window.getSelection();
    if (!selection.isCollapsed || !editor.contains(selection.anchorNode)) return;
    const element = selection.anchorNode.nodeType === Node.TEXT_NODE
        ? selection.anchorNode.parentElement : selection.anchorNode;
    if (element.closest('li,pre,code')) return;
    const block = element.closest('div,p,h1,h2,h3,blockquote') || editor;
    const before = selection.getRangeAt(0).cloneRange();
    before.setStart(block, 0);
    // A paragraph can share a wrapper with an earlier list or contain Shift+Enter breaks.
    for (const boundary of block.querySelectorAll('br,div,p,h1,h2,h3,blockquote,ul,ol')) {
        const offset = Array.prototype.indexOf.call(boundary.parentNode.childNodes, boundary) + 1;
        if (before.comparePoint(boundary.parentNode, offset) === 0) before.setStartAfter(boundary);
    }
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode())) {
        for (const newline of text.data.matchAll(/\n/g)) {
            if (before.comparePoint(text, newline.index + 1) === 0) before.setStart(text, newline.index + 1);
        }
    }
    const prefix = before.toString().replace(/\u00a0/g, ' ');
    const match = prefix.match(/^(?:[-*•] |(\d+)\. )$/);
    if (!match) return;
    selection.removeAllRanges();
    selection.addRange(before);
    document.execCommand('delete');
    // Chromium represents Shift+Enter in pre-wrap text as a literal newline.
    if (before.startContainer.nodeType === Node.TEXT_NODE && before.startOffset > 0 &&
        before.startContainer.data[before.startOffset - 1] === '\n') {
        const separator = before.cloneRange();
        separator.setStart(before.startContainer, before.startOffset - 1);
        separator.setEnd(before.startContainer, before.startOffset);
        selection.removeAllRanges();
        selection.addRange(separator);
        document.execCommand('insertParagraph');
    }
    toggleList(match[1] ? 'insertOrderedList' : 'insertUnorderedList', prefix[0] === '-' ? 'dash' : 'bullet');
    const active = selection.anchorNode.nodeType === Node.TEXT_NODE
        ? selection.anchorNode.parentElement : selection.anchorNode;
    if (match[1] && match[1] !== '1') active.closest('ol')?.setAttribute('start', match[1]);
}

export function handleListEnter(e) {
    if (e.isComposing || (e.key === 'Enter' && e.shiftKey)) return false;
    const selection = window.getSelection();
    const editor = document.getElementById('editor');
    if (!selection.rangeCount || !editor.contains(selection.anchorNode)) return false;
    const element = selection.anchorNode.nodeType === Node.TEXT_NODE
        ? selection.anchorNode.parentElement : selection.anchorNode;
    if (e.key === 'Tab' && element.closest('li')) {
        e.preventDefault();
        document.execCommand(e.shiftKey ? 'outdent' : 'indent');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    }
    // Quotes remain plain text, with native paragraph insertion preserving the tail at the caret.
    if (e.key === 'Enter' && !element.closest('li')) {
        const block = getCurrentBlock();
        if (block && /^>\s/.test(block.textContent)) {
            e.preventDefault();
            if (!block.textContent.slice(1).trim()) {
                const range = document.createRange();
                range.selectNodeContents(block);
                selection.removeAllRanges();
                selection.addRange(range);
                document.execCommand('delete');
            } else {
                document.execCommand('insertParagraph');
                document.execCommand('insertText', false, '> ');
            }
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }
    }
    // Native Enter splits at the caret and exits an empty list item.
    return false;
}
