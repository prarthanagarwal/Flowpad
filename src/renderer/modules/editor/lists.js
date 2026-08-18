// ===== LIST MANAGEMENT =====
// Handles bullet lists, numbered lists, and checklists

import { 
    isDashListMode, 
    isNumberedListMode, 
    isCircularChecklistMode, 
    isQuoteListMode,
    currentListNumber,
    setIsDashListMode,
    setIsNumberedListMode,
    setIsCircularChecklistMode,
    setIsQuoteListMode,
    setCurrentListNumber
} from '../../state.js';
import { getCurrentLineText, replaceCurrentLineStart } from '../../utils/dom.js';

// Check for list activation when space is typed
export function checkForListActivation() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const lineText = getCurrentLineText();

    // Check for quote list activation (> followed by space) - keep as >
    const normalizedLine = lineText.replace(/\u00A0/g, ' ');
    if (normalizedLine === '> ') {
        setIsQuoteListMode(true);
        setIsDashListMode(false);
        setIsNumberedListMode(false);
        setIsCircularChecklistMode(false);
        return;
    }

    // Check for dash list activation (-, * followed by space)
    const normalizedDashLine = lineText.replace(/\u00A0/g, ' ');
    if (normalizedDashLine === '- ' || normalizedDashLine === '* ' || normalizedDashLine === '• ') {
        setIsDashListMode(true);
        setIsNumberedListMode(false);
        setIsCircularChecklistMode(false);
        setIsQuoteListMode(false);

        // Replace * with bullet point for consistency
        if (normalizedDashLine === '* ') {
            replaceCurrentLineStart('* ', '•\u00A0');
        }
    }

    // Check for numbered list activation (1. followed by space)
    const normalizedNumberedLine = lineText.replace(/\u00A0/g, ' ');
    const numberedMatch = normalizedNumberedLine.match(/^(\d+)\.\s$/);
    if (numberedMatch) {
        setCurrentListNumber(parseInt(numberedMatch[1]));
        setIsNumberedListMode(true);
        setIsDashListMode(false);
        setIsCircularChecklistMode(false);
        setIsQuoteListMode(false);
    }

    // Check for circular checklist activation (◯/⬤ followed by space)
    const normalizedCheckLine = lineText.replace(/\u00A0/g, ' ');
    if (normalizedCheckLine === '◯ ' || normalizedCheckLine === '⬤ ') {
        setIsCircularChecklistMode(true);
        setIsDashListMode(false);
        setIsNumberedListMode(false);
        setIsQuoteListMode(false);
    }
}

// Convert selected lines to list format
function convertSelectionToList(prefix) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return false;
    
    const selectedText = selection.toString();
    if (!selectedText) return false;
    
    // Check if selection spans multiple lines
    const lines = selectedText.split('\n');
    if (lines.length <= 1) return false;
    
    // Convert each line to list item
    const convertedLines = lines.reduce((acc, line) => {
        const trimmedLine = line.trim();
        if (trimmedLine) {
            const cleanLine = trimmedLine.replace(/^[-•*>\d+.◯⬤]\s*/, '').trim();
            if (cleanLine) {
                acc.push(`${prefix}${cleanLine}`);
            }
        }
        return acc;
    }, []);
    
    // Replace selection with converted text
    const range = selection.getRangeAt(0);
    range.deleteContents();
    
    // Insert as HTML with proper line breaks
    const fragment = document.createDocumentFragment();
    convertedLines.forEach((line, index) => {
        if (index > 0) {
            fragment.appendChild(document.createElement('br'));
        }
        fragment.appendChild(document.createTextNode(line));
    });
    
    range.insertNode(fragment);
    
    // Move cursor to end
    selection.collapseToEnd();
    
    return true;
}

// Insert bullet list (supports multi-line selection)
export function insertBulletList() {
    // Try to convert selection first
    if (convertSelectionToList('• ')) {
        setIsDashListMode(true);
        return;
    }
    
    // Single line/cursor - just insert bullet
    document.execCommand('insertText', false, '•\u00A0');
    setIsDashListMode(true);
    document.getElementById('editor').focus();
}

// Insert numbered list (supports multi-line selection)
export function insertNumberedList() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const selectedText = selection.toString();
        const lines = selectedText.split('\n');
        
        if (lines.length > 1) {
            // Multi-line selection - number each line
            let lineNumber = 1;
            const convertedLines = lines.reduce((acc, line) => {
                const trimmedLine = line.trim();
                if (trimmedLine) {
                    const cleanLine = trimmedLine.replace(/^[-•*>\d+.◯⬤]\s*/, '').trim();
                    if (cleanLine) {
                        acc.push(`${lineNumber++}. ${cleanLine}`);
                    }
                }
                return acc;
            }, []);
            
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            const fragment = document.createDocumentFragment();
            convertedLines.forEach((line, index) => {
                if (index > 0) {
                    fragment.appendChild(document.createElement('br'));
                }
                fragment.appendChild(document.createTextNode(line));
            });
            
            range.insertNode(fragment);
            selection.collapseToEnd();
            
            setCurrentListNumber(lineNumber);
            setIsNumberedListMode(true);
            return;
        }
    }
    
    // Single line/cursor
    setCurrentListNumber(1);
    document.execCommand('insertText', false, '1.\u00A0');
    setIsNumberedListMode(true);
    document.getElementById('editor').focus();
}

// Insert circular/interactive checklist (supports multi-line selection)
export function insertCircularChecklist() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        if (convertSelectionToList('- [ ] ')) {
            setIsCircularChecklistMode(true);
            return;
        }
    }
    
    // Single line/cursor - insert interactive checklist element
    const html = `<div class="checklist-line"><span class="checklist-item" data-checked="false"><span class="checkbox-circle"></span><span>&nbsp;</span></span></div>`;
    document.execCommand('insertHTML', false, html);
    setIsCircularChecklistMode(true);
    document.getElementById('editor').focus();
}

// Toggle interactive checkbox on click
export function toggleCircularCheckboxAtCursor(clickedTarget = null) {
    const selection = window.getSelection();
    let targetElement = clickedTarget;

    if (!targetElement && selection.rangeCount > 0) {
        const node = selection.getRangeAt(0).startContainer;
        targetElement = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    }

    if (!targetElement) return;

    const item = targetElement.closest('.checklist-item');
    if (!item) return;

    const isChecked = item.getAttribute('data-checked') === 'true';
    const circle = item.querySelector('.checkbox-circle');

    if (isChecked) {
        item.setAttribute('data-checked', 'false');
        if (circle) circle.classList.remove('checked');

        const strike = item.querySelector('s');
        if (strike) {
            const span = document.createElement('span');
            span.innerHTML = strike.innerHTML;
            strike.replaceWith(span);
        }
    } else {
        item.setAttribute('data-checked', 'true');
        if (circle) circle.classList.add('checked');

        // Find text content after circle and wrap in strikethrough
        const textSpan = item.querySelector('span:not(.checkbox-circle)');
        if (textSpan) {
            const s = document.createElement('s');
            s.className = 'completed';
            s.innerHTML = textSpan.innerHTML;
            textSpan.replaceWith(s);
        }
    }

    // Move cursor to end of item
    const range = document.createRange();
    range.selectNodeContents(item);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}

// Handle Enter key for list continuation
export function handleListEnter(e) {
    const lineText = getCurrentLineText();
    const selection = window.getSelection();

    // Check if inside interactive checklist
    let inChecklist = false;
    if (selection.rangeCount > 0) {
        const anchor = selection.anchorNode;
        const elem = anchor ? (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement) : null;
        if (elem && elem.closest('.checklist-item')) {
            inChecklist = true;
        }
    }

    if (inChecklist || isCircularChecklistMode || lineText.includes('◯') || lineText.includes('⬤') || lineText.includes('[ ]') || lineText.includes('[x]')) {
        e.preventDefault();

        const cleanText = lineText.replace(/[◯⬤[\]\sxX]/g, '').trim();

        // Empty checklist item -> exit checklist mode
        if (!cleanText || cleanText === '') {
            setIsCircularChecklistMode(false);
            const html = `<div><br></div>`;
            document.execCommand('insertHTML', false, html);
        } else {
            // New UNCHECKED checklist item
            setIsCircularChecklistMode(true);
            const html = `<div class="checklist-line"><span class="checklist-item" data-checked="false"><span class="checkbox-circle"></span><span>&nbsp;</span></span></div>`;
            document.execCommand('insertHTML', false, html);
        }
        return true;
    }

    // Reactivate bullet mode if on a bullet line
    if (!isDashListMode && (lineText.startsWith('•') || lineText.startsWith('-'))) {
        setIsDashListMode(true);
    }

    // Reactivate quote mode if on a quote line
    if (!isQuoteListMode && lineText.startsWith('>')) {
        setIsQuoteListMode(true);
    }

    // Reactivate numbered mode if on a numbered line
    if (!isNumberedListMode) {
        const numMatch = lineText.match(/^(\d+)\./);
        if (numMatch) {
            setCurrentListNumber(parseInt(numMatch[1]));
            setIsNumberedListMode(true);
        }
    }

    // Handle quote list mode (>)
    if (isQuoteListMode) {
        e.preventDefault();

        const normalizedQuoteLine = lineText.replace(/\u00A0/g, ' ').trim();
        if (normalizedQuoteLine === '>' || normalizedQuoteLine === '') {
            setIsQuoteListMode(false);
            document.execCommand('insertHTML', false, '<div><br></div>');
        } else {
            document.execCommand('insertHTML', false, '<div>&gt;&nbsp;</div>');
        }
        return true;
    }

    // Handle numbered list mode
    if (isNumberedListMode) {
        e.preventDefault();

        const normalizedNumberedLine = lineText.replace(/\u00A0/g, ' ');
        const numberMatch = normalizedNumberedLine.match(/^\d+\.\s*/);
        if (numberMatch && normalizedNumberedLine.trim() === numberMatch[0].trim()) {
            setIsNumberedListMode(false);
            setCurrentListNumber(1);
            document.execCommand('insertHTML', false, '<div><br></div>');
        } else {
            setCurrentListNumber(currentListNumber + 1);
            document.execCommand('insertHTML', false, `<div>${currentListNumber}.&nbsp;</div>`);
        }
        return true;
    }

    // Handle dash/bullet list mode
    if (isDashListMode) {
        e.preventDefault();

        const normalizedDashLine = lineText.replace(/\u00A0/g, ' ').trim();
        if (normalizedDashLine === '-' || normalizedDashLine === '•' || normalizedDashLine === '') {
            setIsDashListMode(false);
            document.execCommand('insertHTML', false, '<div><br></div>');
        } else {
            const marker = lineText.startsWith('•') ? '•&nbsp;' : '-&nbsp;';
            document.execCommand('insertHTML', false, `<div>${marker}</div>`);
        }
        return true;
    }

    return false;
}
