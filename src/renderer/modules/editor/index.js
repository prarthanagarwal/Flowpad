export * from './lists.js';
export * from './formatting.js';

import { checkForListActivation, insertBulletList, insertNumberedList } from './lists.js';
import { updateFormatButtonStates, updateTextStyleUI, handleFormattingReset } from './formatting.js';
import { closeFormattingDropdown } from '../ui/dropdowns.js';

export function updatePlaceholder(editor, placeholder) {
    placeholder.classList.toggle('hidden', editor.textContent.trim() !== '');
}

export function updateWordCount(editor, element) {
    const text = editor.innerText.replace(/^[\t ]*(?:[•>-]|\d+\.)\s+/gm, '');
    const count = text.trim() ? text.trim().split(/\s+/).length : 0;
    element.textContent = `${count} word${count === 1 ? '' : 's'}`;
}

export function insertPlainText(text) {
    const editor = document.getElementById('editor');
    editor.focus();
    // Keep ZWJ/ZWNJ: they are meaningful in emoji and many writing systems.
    document.execCommand('insertText', false, text.replace(/\r\n?/g, '\n'));
    editor.dispatchEvent(new Event('input', { bubbles: true }));
}

export function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain');
    if (text) insertPlainText(text);
}

export function initEditor(editor, placeholder, wordCount, onInput) {
    document.execCommand('defaultParagraphSeparator', false, 'div');
    editor.addEventListener('input', e => {
        if (!e.isComposing && e.inputType === 'insertText' && /[ \u00a0]$/.test(e.data || '')) checkForListActivation();
        updatePlaceholder(editor, placeholder);
        updateWordCount(editor, wordCount);
        onInput(e);
    });
    editor.addEventListener('paste', handlePaste);
    editor.addEventListener('keydown', handleFormattingReset);
    document.addEventListener('selectionchange', () => {
        updateFormatButtonStates();
        updateTextStyleUI();
    });
    document.getElementById('bulletListBtn').addEventListener('click', () => {
        insertBulletList();
        closeFormattingDropdown();
    });
    document.getElementById('numberedListBtn').addEventListener('click', () => {
        insertNumberedList();
        closeFormattingDropdown();
    });
    // Toolbar interactions must not move the selection away from the editor.
    document.querySelectorAll('#formattingDropdown button, .editor-context-menu').forEach(element => {
        element.addEventListener('mousedown', e => e.preventDefault());
    });
}
