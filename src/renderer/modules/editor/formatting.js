// ===== TEXT FORMATTING =====
// Handles text formatting commands and styles

import { setActiveTextStyle } from '../../state.js';

// Text style configurations - using HTML tags for proper undo support
const textStyleConfigs = {
    title: { tag: 'h1', label: 'Title' },
    heading: { tag: 'h2', label: 'Heading' },
    body: { tag: 'div', label: 'Body' }
};

// Execute formatting command with list marker protection
export function executeCommand(command) {
    document.execCommand(command, false, null);
    document.getElementById('editor').focus();
    document.getElementById('editor').dispatchEvent(new Event('input', { bubbles: true }));
}

// Update format button active states
export function updateFormatButtonStates() {
    const editor = document.getElementById('editor');
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

// Apply text style to current line using execCommand for proper undo support
export function applyTextStyle(style) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const targetStyle = style || 'body';
    const styleConfig = textStyleConfigs[targetStyle] || textStyleConfigs.body;
    const editor = document.getElementById('editor');

    // Use execCommand formatBlock - this integrates with browser's undo stack
    document.execCommand('formatBlock', false, styleConfig.tag);

    setActiveTextStyle(targetStyle);
    updateTextStyleUI(targetStyle);

    editor.focus();
    editor.dispatchEvent(new Event('input', { bubbles: true }));
}

// Update text style UI based on current selection
export function updateTextStyleUI(style) {
    let currentStyle = style;

    if (!currentStyle) {
        const selection = window.getSelection();
        const editor = document.getElementById('editor');
        if (selection.rangeCount > 0) {
            let node = selection.getRangeAt(0).startContainer;
            while (node && node !== editor) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const tag = node.tagName;
                    if (tag === 'H1') currentStyle = 'title';
                    else if (tag === 'H2') currentStyle = 'heading';
                    else if (tag === 'DIV' || tag === 'P') currentStyle = 'body';

                    if (currentStyle) break;
                }
                node = node.parentNode;
            }
        }
    }

    if (!currentStyle) currentStyle = 'body';

    document.querySelectorAll('.size-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.style === currentStyle) {
            option.classList.add('active');
        }
    });

    setActiveTextStyle(currentStyle);
}

// Reset to body style after Enter key
export function resetBlockStyleAfterEnter() {
    // Use formatBlock to convert any new line to div (body style)
    // This ensures new lines after h1/h2 become normal body text
    document.execCommand('formatBlock', false, 'div');
}

// Reset text style to body
export function resetTextStyleToBody() {
    setActiveTextStyle('body');
    updateTextStyleUI('body');
}

// Handle formatting reset on Enter
export function handleFormattingReset(e) {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.defaultPrevented) return;
    const selection = window.getSelection();
    const node = selection.anchorNode;
    const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const heading = element?.closest('h1,h2');
    if (!heading) return;
    const tail = selection.getRangeAt(0).cloneRange();
    tail.selectNodeContents(heading);
    tail.setStart(selection.anchorNode, selection.anchorOffset);
    if (tail.toString()) return;
    e.preventDefault();
    document.execCommand('insertParagraph');
    document.execCommand('formatBlock', false, 'div');
    updateTextStyleUI('body');
    document.getElementById('editor').dispatchEvent(new Event('input', { bubbles: true }));
}

// Initialize formatting event listeners
export function initFormatting() {
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

    document.querySelectorAll('.size-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const target = e.target.closest('.size-option');
            const size = target.dataset.size;
            const style = target.dataset.style;
            applyTextStyle(style, size);
        });
    });
}
