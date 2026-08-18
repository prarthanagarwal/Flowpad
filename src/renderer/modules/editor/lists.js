// ===== LIST MANAGEMENT =====
// Handles bullet lists, numbered lists, and checklists

import { 
    setIsDashListMode, 
    setIsNumberedListMode, 
    setIsCircularChecklistMode, 
    setIsQuoteListMode,
    setCurrentListNumber,
    resetListModes
} from '../../state.js';
import { getCurrentBlock, replaceCurrentLineStart, escapeHtml } from '../../utils/dom.js';

// Check for list activation when space is typed
export function checkForListActivation() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const block = getCurrentBlock();
    if (!block) return;

    // Get text before cursor in current block
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(block);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const textBeforeCaret = preCaretRange.toString().replace(/\u00A0/g, ' ');

    // Check for quote list activation (> followed by space)
    if (textBeforeCaret === '> ') {
        replaceCurrentLineStart('> ', '>\u00A0');
        setIsQuoteListMode(true);
        setIsDashListMode(false);
        setIsNumberedListMode(false);
        setIsCircularChecklistMode(false);
        return;
    }

    // Check for dash/bullet list activation (-, *, • followed by space)
    if (textBeforeCaret === '- ' || textBeforeCaret === '* ' || textBeforeCaret === '• ') {
        replaceCurrentLineStart(textBeforeCaret, '•\u00A0');
        setIsDashListMode(true);
        setIsNumberedListMode(false);
        setIsCircularChecklistMode(false);
        setIsQuoteListMode(false);
        return;
    }

    // Check for numbered list activation (e.g. 1. followed by space)
    const numberedMatch = textBeforeCaret.match(/^(\d+)\.\s$/);
    if (numberedMatch) {
        const num = parseInt(numberedMatch[1], 10);
        replaceCurrentLineStart(numberedMatch[0], `${num}.\u00A0`);
        setCurrentListNumber(num);
        setIsNumberedListMode(true);
        setIsDashListMode(false);
        setIsCircularChecklistMode(false);
        setIsQuoteListMode(false);
        return;
    }

    // Check for circular/interactive checklist activation (◯, ⬤, or - [ ] followed by space)
    if (textBeforeCaret === '◯ ' || textBeforeCaret === '⬤ ' || textBeforeCaret === '- [ ] ') {
        const newBlock = document.createElement('div');
        newBlock.className = 'checklist-line';
        newBlock.innerHTML = '<span class="checklist-item" data-checked="false"><span class="checkbox-circle"></span><span>&nbsp;</span></span>';
        
        if (block.parentNode) {
            block.parentNode.replaceChild(newBlock, block);
        } else {
            document.getElementById('editor')?.appendChild(newBlock);
        }

        const textSpan = newBlock.querySelector('.checklist-item span:not(.checkbox-circle)');
        const newRange = document.createRange();
        if (textSpan) {
            newRange.selectNodeContents(textSpan);
            newRange.collapse(false);
        } else {
            newRange.selectNodeContents(newBlock);
            newRange.collapse(false);
        }
        selection.removeAllRanges();
        selection.addRange(newRange);

        setIsCircularChecklistMode(true);
        setIsDashListMode(false);
        setIsNumberedListMode(false);
        setIsQuoteListMode(false);
        return;
    }
}

// Convert selected lines to list format
function convertSelectionToList(prefix) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    
    const selectedText = selection.toString();
    if (!selectedText) return false;
    
    const lines = selectedText.split('\n');
    if (lines.length <= 1) return false;
    
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
    
    return true;
}

// Insert bullet list (supports multi-line selection)
export function insertBulletList() {
    if (convertSelectionToList('• ')) {
        setIsDashListMode(true);
        return;
    }
    
    const block = getCurrentBlock();
    if (block) {
        const text = block.textContent.replace(/\u00A0/g, ' ').replace(/^[-•*>\d+.◯⬤]\s*/, '');
        block.textContent = '•\u00A0' + text;
        const range = document.createRange();
        range.selectNodeContents(block);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        document.execCommand('insertText', false, '•\u00A0');
    }
    setIsDashListMode(true);
    document.getElementById('editor')?.focus();
}

// Insert numbered list (supports multi-line selection)
export function insertNumberedList() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const selectedText = selection.toString();
        const lines = selectedText.split('\n');
        
        if (lines.length > 1) {
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
    
    const block = getCurrentBlock();
    if (block) {
        const text = block.textContent.replace(/\u00A0/g, ' ').replace(/^[-•*>\d+.◯⬤]\s*/, '');
        block.textContent = '1.\u00A0' + text;
        const range = document.createRange();
        range.selectNodeContents(block);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        document.execCommand('insertText', false, '1.\u00A0');
    }
    setCurrentListNumber(1);
    setIsNumberedListMode(true);
    document.getElementById('editor')?.focus();
}

// Insert circular/interactive checklist (supports multi-line selection)
export function insertCircularChecklist() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        if (convertSelectionToList('- [ ] ')) {
            setIsCircularChecklistMode(true);
            return;
        }
    }
    
    const block = getCurrentBlock();
    let initialText = '';
    if (block) {
        initialText = block.textContent.replace(/\u00A0/g, ' ').trim().replace(/^[-•*>\d+.◯⬤]\s*/, '').trim();
    }
    
    const newBlock = document.createElement('div');
    newBlock.className = 'checklist-line';
    const textHtml = initialText ? escapeHtml(initialText) : '&nbsp;';
    newBlock.innerHTML = `<span class="checklist-item" data-checked="false"><span class="checkbox-circle"></span><span>${textHtml}</span></span>`;
    
    if (block && block.parentNode) {
        block.parentNode.replaceChild(newBlock, block);
    } else {
        document.getElementById('editor')?.appendChild(newBlock);
    }
    
    const textSpan = newBlock.querySelector('.checklist-item span:not(.checkbox-circle)');
    const range = document.createRange();
    if (textSpan) {
        range.selectNodeContents(textSpan);
        range.collapse(false);
    } else {
        range.selectNodeContents(newBlock);
        range.collapse(false);
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    
    setIsCircularChecklistMode(true);
    document.getElementById('editor')?.focus();
}

// Toggle interactive checkbox on click
export function toggleCircularCheckboxAtCursor(clickedTarget = null) {
    const selection = window.getSelection();
    let targetElement = clickedTarget;

    if (!targetElement && selection && selection.rangeCount > 0) {
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
    } else {
        item.setAttribute('data-checked', 'true');
        if (circle) circle.classList.add('checked');
    }

    // Only update range if clicked directly on the circle button
    if (clickedTarget && (clickedTarget.classList.contains('checkbox-circle') || clickedTarget.closest('.checkbox-circle'))) {
        const textContainer = item.querySelector('span:not(.checkbox-circle), s') || item;
        const range = document.createRange();
        range.selectNodeContents(textContainer);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

// Helper to replace an empty list line with a standard body block
function replaceWithEmptyBodyBlock(block) {
    const newBlock = document.createElement('div');
    newBlock.innerHTML = '<br>';
    if (block.parentNode) {
        block.parentNode.replaceChild(newBlock, block);
    } else {
        document.getElementById('editor')?.appendChild(newBlock);
    }

    const range = document.createRange();
    range.setStart(newBlock, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    resetListModes();
}

// Handle Enter key for list continuation
export function handleListEnter(e) {
    const block = getCurrentBlock();
    if (!block) return false;

    const fullText = block.textContent.replace(/\u00A0/g, ' ');

    // 1. CHECKLIST ITEM
    const isChecklist = block.classList.contains('checklist-line') || 
                       !!block.querySelector('.checklist-item') ||
                       /^\s*[◯⬤]/.test(fullText) ||
                       /^\s*-\s*\[[ xX]\]/.test(fullText);

    if (isChecklist) {
        e.preventDefault();

        const textSpan = block.querySelector('.checklist-item span:not(.checkbox-circle), .checklist-item s');
        const itemText = textSpan ? textSpan.textContent.replace(/\u00A0/g, ' ').trim() : fullText.replace(/[◯⬤[\]\sxX]/g, '').trim();

        if (!itemText) {
            // Empty checklist item -> exit checklist mode
            replaceWithEmptyBodyBlock(block);
        } else {
            // Create new unchecked checklist item
            const newBlock = document.createElement('div');
            newBlock.className = 'checklist-line';
            newBlock.innerHTML = '<span class="checklist-item" data-checked="false"><span class="checkbox-circle"></span><span>&nbsp;</span></span>';

            if (block.nextSibling) {
                block.parentNode.insertBefore(newBlock, block.nextSibling);
            } else {
                block.parentNode.appendChild(newBlock);
            }

            const targetSpan = newBlock.querySelector('.checklist-item span:not(.checkbox-circle)');
            const range = document.createRange();
            if (targetSpan) {
                range.selectNodeContents(targetSpan);
                range.collapse(false);
            } else {
                range.selectNodeContents(newBlock);
                range.collapse(false);
            }
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            setIsCircularChecklistMode(true);
        }
        return true;
    }

    // 2. BULLET / DASH LIST ITEM
    const bulletMatch = fullText.match(/^\s*([•*-])(?:\s|$)/);
    if (bulletMatch) {
        e.preventDefault();

        const contentAfterMarker = fullText.substring(bulletMatch[0].length).trim();
        if (!contentAfterMarker) {
            // Empty bullet line -> exit bullet mode
            replaceWithEmptyBodyBlock(block);
        } else {
            const marker = bulletMatch[1] === '-' ? '-\u00A0' : '•\u00A0';
            const newBlock = document.createElement('div');
            newBlock.innerHTML = `${marker}`;

            if (block.nextSibling) {
                block.parentNode.insertBefore(newBlock, block.nextSibling);
            } else {
                block.parentNode.appendChild(newBlock);
            }

            const range = document.createRange();
            range.selectNodeContents(newBlock);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            setIsDashListMode(true);
        }
        return true;
    }

    // 3. NUMBERED LIST ITEM
    const numMatch = fullText.match(/^\s*(\d+)\.(?:\s|$)/);
    if (numMatch) {
        e.preventDefault();

        const currentNum = parseInt(numMatch[1], 10);
        const contentAfterMarker = fullText.substring(numMatch[0].length).trim();

        if (!contentAfterMarker) {
            // Empty numbered list line -> exit numbered list mode
            replaceWithEmptyBodyBlock(block);
        } else {
            const nextNum = currentNum + 1;
            const newBlock = document.createElement('div');
            newBlock.innerHTML = `${nextNum}.\u00A0`;

            if (block.nextSibling) {
                block.parentNode.insertBefore(newBlock, block.nextSibling);
            } else {
                block.parentNode.appendChild(newBlock);
            }

            const range = document.createRange();
            range.selectNodeContents(newBlock);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            setCurrentListNumber(nextNum);
            setIsNumberedListMode(true);
        }
        return true;
    }

    // 4. QUOTE LIST ITEM
    const quoteMatch = fullText.match(/^\s*>(?:\s|$)/);
    if (quoteMatch) {
        e.preventDefault();

        const contentAfterMarker = fullText.substring(quoteMatch[0].length).trim();
        if (!contentAfterMarker) {
            // Empty quote line -> exit quote mode
            replaceWithEmptyBodyBlock(block);
        } else {
            const newBlock = document.createElement('div');
            newBlock.innerHTML = '>\u00A0';

            if (block.nextSibling) {
                block.parentNode.insertBefore(newBlock, block.nextSibling);
            } else {
                block.parentNode.appendChild(newBlock);
            }

            const range = document.createRange();
            range.selectNodeContents(newBlock);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            setIsQuoteListMode(true);
        }
        return true;
    }

    // Not a list item
    resetListModes();
    return false;
}
