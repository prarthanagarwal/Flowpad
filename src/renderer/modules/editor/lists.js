// ===== LIST MANAGEMENT =====
// Handles bullet lists, numbered lists, and checklists

import { 
    isDashListMode, 
    isNumberedListMode, 
    isCircularChecklistMode, 
    currentListNumber,
    setIsDashListMode,
    setIsNumberedListMode,
    setIsCircularChecklistMode,
    setCurrentListNumber
} from '../../state.js';
import { getCurrentLineText, replaceCurrentLineStart } from '../../utils/dom.js';

// Check for list activation when space is typed
export function checkForListActivation() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const lineText = getCurrentLineText();

    // Check for dash list activation (-, *, or > followed by space)
    const normalizedDashLine = lineText.replace(/\u00A0/g, ' ');
    if (normalizedDashLine === '- ' || normalizedDashLine === '* ' || normalizedDashLine === '• ' || normalizedDashLine === '> ') {
        setIsDashListMode(true);
        setIsNumberedListMode(false);
        setIsCircularChecklistMode(false);

        // Replace * or > with bullet point for consistency
        if (normalizedDashLine === '* ') {
            replaceCurrentLineStart('* ', '•\u00A0');
        } else if (normalizedDashLine === '> ') {
            replaceCurrentLineStart('> ', '•\u00A0');
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
    }

    // Check for circular checklist activation (◯/⬤ followed by space)
    const normalizedLine = lineText.replace(/\u00A0/g, ' ');
    if (normalizedLine === '◯ ' || normalizedLine === '⬤ ') {
        setIsCircularChecklistMode(true);
        setIsDashListMode(false);
        setIsNumberedListMode(false);
    }
}

// Insert bullet list
export function insertBulletList() {
    document.execCommand('insertText', false, '•\u00A0');
    setIsDashListMode(true);
    document.getElementById('editor').focus();
}

// Insert numbered list
export function insertNumberedList() {
    setCurrentListNumber(1);
    document.execCommand('insertText', false, '1.\u00A0');
    setIsNumberedListMode(true);
    document.getElementById('editor').focus();
}

// Insert circular checklist
export function insertCircularChecklist() {
    document.execCommand('insertText', false, '◯\u00A0');
    setIsCircularChecklistMode(true);
    document.getElementById('editor').focus();
}

// Toggle circular checkbox using DOM manipulation
export function toggleCircularCheckbox(element) {
    const line = element.closest('div') || element.parentNode;
    if (!line || line.nodeType !== Node.ELEMENT_NODE) return;
    
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT, null, false);
    let textNode;
    let isChecked = false;
    
    while ((textNode = walker.nextNode())) {
        if (textNode.textContent.includes('⬤')) {
            isChecked = true;
            break;
        }
        if (textNode.textContent.includes('◯')) {
            isChecked = false;
            break;
        }
    }
    
    if (!textNode) return;
    
    if (isChecked) {
        textNode.textContent = textNode.textContent.replace('⬤', '◯');
        
        const strikeTags = line.querySelectorAll('s');
        strikeTags.forEach(s => {
            const textContent = s.textContent;
            s.replaceWith(document.createTextNode(textContent));
        });
    } else {
        const text = textNode.textContent;
        const circleIndex = text.indexOf('◯');
        if (circleIndex === -1) return;
        
        const beforeCircle = text.substring(0, circleIndex);
        const afterCircle = text.substring(circleIndex + 2);
        
        textNode.textContent = beforeCircle + '⬤\u00A0';
        
        if (afterCircle) {
            const strikeElem = document.createElement('s');
            strikeElem.style.color = '#666';
            strikeElem.textContent = afterCircle;
            
            if (textNode.nextSibling) {
                line.insertBefore(strikeElem, textNode.nextSibling);
            } else {
                line.appendChild(strikeElem);
            }
        }
    }
}

// Toggle circular checkbox at cursor position
export function toggleCircularCheckboxAtCursor() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let node = range.startContainer;
    const editor = document.getElementById('editor');

    let lineElement = node;
    while (lineElement && lineElement !== editor) {
        if (lineElement.nodeType === Node.ELEMENT_NODE &&
            (lineElement.tagName === 'DIV' || lineElement.tagName === 'P')) {
            break;
        }
        lineElement = lineElement.parentNode;
    }

    if (!lineElement || lineElement === editor) {
        lineElement = null;
    }

    let targetTextNode = null;
    let isChecked = false;
    
    if (lineElement) {
        const walker = document.createTreeWalker(lineElement, NodeFilter.SHOW_TEXT, null, false);
        let textNode;
        while ((textNode = walker.nextNode())) {
            if (textNode.textContent.includes('⬤')) {
                targetTextNode = textNode;
                isChecked = true;
                break;
            }
            if (textNode.textContent.includes('◯')) {
                targetTextNode = textNode;
                isChecked = false;
                break;
            }
        }
    } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text.includes('⬤')) {
            targetTextNode = node;
            isChecked = true;
        } else if (text.includes('◯')) {
            targetTextNode = node;
            isChecked = false;
        }
    }

    if (!targetTextNode) return;

    if (isChecked) {
        targetTextNode.textContent = targetTextNode.textContent.replace('⬤', '◯');
        
        if (lineElement) {
            const strikeTags = lineElement.querySelectorAll('s');
            strikeTags.forEach(s => {
                const textContent = s.textContent;
                s.replaceWith(document.createTextNode(textContent));
            });
            lineElement.normalize();
        }
    } else {
        const text = targetTextNode.textContent;
        const circleIndex = text.indexOf('◯');
        if (circleIndex === -1) return;
        
        const beforeCircle = text.substring(0, circleIndex);
        const afterCircle = text.substring(circleIndex + 2);
        
        targetTextNode.textContent = beforeCircle + '⬤\u00A0';
        
        if (afterCircle) {
            const strikeElem = document.createElement('s');
            strikeElem.style.color = '#666';
            strikeElem.textContent = afterCircle;
            
            const parent = targetTextNode.parentNode;
            if (targetTextNode.nextSibling) {
                parent.insertBefore(strikeElem, targetTextNode.nextSibling);
            } else {
                parent.appendChild(strikeElem);
            }
        }
    }

    const cursorTarget = lineElement || targetTextNode.parentNode;
    if (cursorTarget) {
        const newRange = document.createRange();
        newRange.selectNodeContents(cursorTarget);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
}

// Handle Enter key for list continuation
export function handleListEnter(e) {
    const lineText = getCurrentLineText();

    // Reactivate checklist mode if on a checklist line
    if (!isCircularChecklistMode && (lineText.includes('◯') || lineText.includes('⬤'))) {
        setIsCircularChecklistMode(true);
    }

    // Reactivate bullet mode if on a bullet line
    if (!isDashListMode && (lineText.startsWith('•') || lineText.startsWith('-'))) {
        setIsDashListMode(true);
    }

    // Reactivate numbered mode if on a numbered line
    if (!isNumberedListMode) {
        const numMatch = lineText.match(/^(\d+)\./);
        if (numMatch) {
            setCurrentListNumber(parseInt(numMatch[1]));
            setIsNumberedListMode(true);
        }
    }

    // Handle circular checklist mode
    if (isCircularChecklistMode) {
        e.preventDefault();

        const cleanLineText = lineText.replace(/\u00A0/g, ' ').trim();
        if (cleanLineText === '◯' || cleanLineText === '⬤' || cleanLineText === '') {
            setIsCircularChecklistMode(false);
            document.execCommand('insertText', false, '\n');
        } else {
            document.execCommand('insertText', false, '\n◯\u00A0');
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
            document.execCommand('insertText', false, '\n');
        } else {
            setCurrentListNumber(currentListNumber + 1);
            document.execCommand('insertText', false, `\n${currentListNumber}.\u00A0`);
        }
        return true;
    }

    // Handle dash/bullet list mode
    if (isDashListMode) {
        e.preventDefault();

        const normalizedDashLine = lineText.replace(/\u00A0/g, ' ').trim();
        if (normalizedDashLine === '-' || normalizedDashLine === '•' || normalizedDashLine === '') {
            setIsDashListMode(false);
            document.execCommand('insertText', false, '\n');
        } else {
            const marker = lineText.startsWith('•') ? '•\u00A0' : '-\u00A0';
            document.execCommand('insertText', false, '\n' + marker);
        }
        return true;
    }

    return false;
}
