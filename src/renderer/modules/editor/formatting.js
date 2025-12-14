// ===== TEXT FORMATTING =====
// Handles text formatting commands and styles

import { activeTextStyle, setActiveTextStyle } from '../../state.js';

// Text style configurations
const textStyleConfigs = {
    title: { className: 'line-title', label: 'Title', activateBold: false },
    heading: { className: 'line-heading', label: 'Heading', activateBold: false },
    body: { className: 'line-body', label: 'Body', activateBold: false }
};

// Execute formatting command with list marker protection
export function executeCommand(command) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const startNode = range.startContainer;
        
        // Check if selection starts with a list marker
        if (startNode.nodeType === Node.TEXT_NODE) {
            const text = startNode.textContent;
            const startOffset = range.startOffset;
            
            if (startOffset === 0) {
                let markerLength = 0;
                
                if (text.match(/^[•◯⬤\-]\s/)) {
                    markerLength = 2;
                } else {
                    const numMatch = text.match(/^(\d+)\.\s/);
                    if (numMatch) {
                        markerLength = numMatch[0].length;
                    }
                }
                
                if (markerLength > 0 && markerLength < text.length) {
                    range.setStart(startNode, markerLength);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        }
    }
    
    document.execCommand(command, false, null);
    document.getElementById('editor').focus();
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

// Apply text style to current line
export function applyTextStyle(style, size) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const targetStyle = style || 'body';
    const styleConfig = textStyleConfigs[targetStyle] || textStyleConfigs.body;
    const editor = document.getElementById('editor');

    const range = selection.getRangeAt(0);
    let node = range.startContainer;

    while (node && node !== editor) {
        if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'DIV' || node.tagName === 'P')) {
            break;
        }
        node = node.parentNode;
    }

    if (node === editor || !node) {
        document.execCommand('formatBlock', false, 'div');
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
        node.classList.remove('line-title', 'line-heading', 'line-body');
        node.classList.add(styleConfig.className);
        node.style.fontSize = '';
        node.style.fontWeight = '';

        const spans = node.querySelectorAll('span[style*="font-size"]');
        spans.forEach(span => {
            span.style.fontSize = '';
            if (span.getAttribute('style') === '') {
                const parent = span.parentNode;
                while (span.firstChild) parent.insertBefore(span.firstChild, span);
                parent.removeChild(span);
            }
        });
    }

    setActiveTextStyle(targetStyle);
    updateTextStyleUI(targetStyle);

    editor.focus();
}

// Update text style UI
export function updateTextStyleUI(style) {
    let currentStyle = style;

    if (!currentStyle) {
        const selection = window.getSelection();
        const editor = document.getElementById('editor');
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
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let node = range.startContainer;
    const editor = document.getElementById('editor');

    while (node && node !== editor) {
        if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'DIV' || node.tagName === 'P')) {
            node.classList.remove('line-title', 'line-heading');
            node.classList.add('line-body');
            node.style.fontSize = '';
            node.style.fontWeight = '';
            return;
        }
        node = node.parentNode;
    }
}

// Reset text style to body
export function resetTextStyleToBody() {
    setActiveTextStyle('body');
    updateTextStyleUI('body');
}

// Handle formatting reset on Enter
export function handleFormattingReset(e) {
    if (e.key === 'Enter') {
        setTimeout(() => {
            document.execCommand('removeFormat', false, null);

            const commands = ['bold', 'italic', 'underline', 'strikethrough'];
            commands.forEach(command => {
                if (document.queryCommandState(command)) {
                    document.execCommand(command, false, null);
                }
            });

            resetBlockStyleAfterEnter();
            setActiveTextStyle('body');
            updateTextStyleUI('body');
            updateFormatButtonStates();
        }, 10);
    }
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
