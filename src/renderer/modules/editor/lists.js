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

// Get selected lines as array
function getSelectedLines() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;
    
    const selectedText = selection.toString();
    if (!selectedText || !selectedText.includes('\n')) return null;
    
    return selectedText.split('\n').filter(line => line.trim() !== '');
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
    const convertedLines = lines.map(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return '';
        
        // Remove existing list markers if present
        const cleanLine = trimmedLine
            .replace(/^[•\-\*>\d+\.◯⬤]\s*/, '')
            .trim();
        
        return cleanLine ? `${prefix}${cleanLine}` : '';
    }).filter(line => line !== '');
    
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
            const convertedLines = lines.map(line => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return '';
                
                // Remove existing list markers
                const cleanLine = trimmedLine
                    .replace(/^[•\-\*>\d+\.◯⬤]\s*/, '')
                    .trim();
                
                if (cleanLine) {
                    return `${lineNumber++}. ${cleanLine}`;
                }
                return '';
            }).filter(line => line !== '');
            
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

// Insert circular checklist (supports multi-line selection)
export function insertCircularChecklist() {
    // Try to convert selection first
    if (convertSelectionToList('◯ ')) {
        setIsCircularChecklistMode(true);
        return;
    }
    
    // Single line/cursor - just insert checkbox
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

    // We need to find the SPECIFIC checkbox that was clicked
    // First, check if we clicked directly on a text node with a checkbox
    let targetTextNode = null;
    let isChecked = false;
    
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text.includes('⬤')) {
            targetTextNode = node;
            isChecked = true;
        } else if (text.includes('◯')) {
            targetTextNode = node;
            isChecked = false;
        }
    }
    
    // If not found in the clicked node, look in immediate parent only
    if (!targetTextNode && node.nodeType === Node.ELEMENT_NODE) {
        // Only check direct children, not the whole subtree
        for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                if (child.textContent.includes('⬤')) {
                    targetTextNode = child;
                    isChecked = true;
                    break;
                } else if (child.textContent.includes('◯')) {
                    targetTextNode = child;
                    isChecked = false;
                    break;
                }
            }
        }
    }

    if (!targetTextNode) return;

    // Find the line container for this specific checkbox
    // Walk up from the text node to find the nearest div/p, but stop at br boundaries
    let lineContainer = targetTextNode.parentNode;
    while (lineContainer && lineContainer !== editor) {
        if (lineContainer.nodeType === Node.ELEMENT_NODE &&
            (lineContainer.tagName === 'DIV' || lineContainer.tagName === 'P')) {
            break;
        }
        lineContainer = lineContainer.parentNode;
    }
    
    // If no div/p found, we need to work with just the content around this checkbox
    // Find content between previous <br> and next <br>
    const useLineContainer = lineContainer && lineContainer !== editor;

    if (isChecked) {
        // Unchecking: replace filled circle with empty, remove strikethrough
        targetTextNode.textContent = targetTextNode.textContent.replace('⬤', '◯');
        
        if (useLineContainer) {
            // Remove all strikethrough elements in the container
            const strikeTags = lineContainer.querySelectorAll('s');
            strikeTags.forEach(s => {
                const parent = s.parentNode;
                while (s.firstChild) {
                    parent.insertBefore(s.firstChild, s);
                }
                parent.removeChild(s);
            });
            lineContainer.normalize();
        } else {
            // No line container - remove strikethrough siblings only
            let sibling = targetTextNode.nextSibling;
            while (sibling && sibling.nodeName !== 'BR' && sibling.nodeName !== 'DIV') {
                const next = sibling.nextSibling;
                if (sibling.nodeName === 'S') {
                    const parent = sibling.parentNode;
                    while (sibling.firstChild) {
                        parent.insertBefore(sibling.firstChild, sibling);
                    }
                    parent.removeChild(sibling);
                }
                sibling = next;
            }
            targetTextNode.parentNode.normalize();
        }
    } else {
        // Checking: replace empty circle with filled, add strikethrough to rest
        const text = targetTextNode.textContent;
        const circleIndex = text.indexOf('◯');
        if (circleIndex === -1) return;
        
        const beforeCircle = text.substring(0, circleIndex);
        const afterCircle = text.substring(circleIndex + 2);
        
        targetTextNode.textContent = beforeCircle + '⬤\u00A0';
        
        // Wrap remaining text content in strikethrough
        if (afterCircle.trim()) {
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
        
        // Also wrap any existing text sibling content after the checkbox (until BR or DIV)
        let sibling = targetTextNode.nextSibling;
        // Skip the strikethrough we just added
        if (sibling && sibling.nodeName === 'S') {
            sibling = sibling.nextSibling;
        }
        while (sibling && sibling.nodeName !== 'BR' && sibling.nodeName !== 'DIV') {
            const next = sibling.nextSibling;
            if (sibling.nodeType === Node.TEXT_NODE && sibling.textContent.trim()) {
                const strikeElem = document.createElement('s');
                strikeElem.style.color = '#666';
                strikeElem.textContent = sibling.textContent;
                sibling.parentNode.replaceChild(strikeElem, sibling);
            }
            sibling = next;
        }
    }

    // Move cursor after the checkbox
    if (targetTextNode.parentNode) {
        const newRange = document.createRange();
        newRange.setStartAfter(targetTextNode);
        newRange.collapse(true);
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

    // Handle quote list mode (>)
    if (isQuoteListMode) {
        e.preventDefault();

        const normalizedQuoteLine = lineText.replace(/\u00A0/g, ' ').trim();
        if (normalizedQuoteLine === '>' || normalizedQuoteLine === '') {
            setIsQuoteListMode(false);
            document.execCommand('insertText', false, '\n');
        } else {
            document.execCommand('insertText', false, '\n>\u00A0');
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
