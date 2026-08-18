// ===== SHARED UTILITIES =====
// Common functions used across main and renderer processes

// ===== FILENAME UTILITIES =====
function sanitizeFilename(title) {
  const invalidChars = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);
  const sanitized = Array.from(title || '')
    .filter(char => char.charCodeAt(0) >= 32 && !invalidChars.has(char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 30);
  return sanitized || 'New Note';
}

function generateNoteFilename(note) {
  const sanitizedTitle = sanitizeFilename(note.title);
  const noteId = note.id || Date.now().toString();
  return `note_${noteId}_${sanitizedTitle}.md`;
}

// ===== DATE/TIME UTILITIES =====
function formatDateTime(isoString) {
  const date = new Date(isoString);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0];
  return `${dateStr} ${timeStr}`;
}

// ===== MARKDOWN CONVERSION =====
async function convertHtmlToMarkdown(htmlContent) {
  if (!htmlContent) return '';

  let markdown = htmlContent;

  // Convert interactive checklist items first
  markdown = markdown.replace(/<span class="checklist-item"[^>]*data-checked="true"[^>]*>([\s\S]*?)<\/span>/gi, (_m, content) => {
    const text = content
      .replace(/<span class="checkbox-circle[^"]*"><\/span>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
    return `- [x] ${text}`;
  });
  markdown = markdown.replace(/<span class="checklist-item"[^>]*data-checked="false"[^>]*>([\s\S]*?)<\/span>/gi, (_m, content) => {
    const text = content
      .replace(/<span class="checkbox-circle[^"]*"><\/span>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
    return `- [ ] ${text}`;
  });

  // Convert HTML elements
  markdown = markdown
    .replace(/<div class="checklist-line">(.*?)<\/div>/gi, '$1\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<u>(.*?)<\/u>/gi, '__$1__')
    .replace(/<s>(.*?)<\/s>/gi, '~~$1~~')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<p>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // Clean double blank lines
  return markdown.replace(/\n{3,}/g, '\n\n').trim();
}

async function convertMarkdownToHtml(markdownContent) {
  if (!markdownContent) return '<div><br></div>';

  const lines = markdownContent.split('\n');
  const htmlLines = lines.map(line => {
    let processed = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Checked list item: - [x] text or - [X] text
    if (/^-\s*\[[xX]\]\s*/.test(processed)) {
      const text = processed.replace(/^-\s*\[[xX]\]\s*/, '');
      return `<div class="checklist-line"><span class="checklist-item" data-checked="true"><span class="checkbox-circle checked"></span><s class="completed">${text}</s></span></div>`;
    }

    // Unchecked list item: - [ ] text
    if (/^-\s*\[\s*\]\s*/.test(processed)) {
      const text = processed.replace(/^-\s*\[\s*\]\s*/, '');
      return `<div class="checklist-line"><span class="checklist-item" data-checked="false"><span class="checkbox-circle"></span><span>${text}</span></span></div>`;
    }

    // Inline formatting
    processed = processed
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/~~(.*?)~~/g, '<s>$1</s>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    return processed ? `<div>${processed}</div>` : '<div><br></div>';
  });

  return htmlLines.join('');
}

// ===== FRONTMATTER UTILITIES =====
function createFrontmatter(note) {
  const fullTitle = note.title || 'New Note';
  
  return `---
id: ${note.id}
title: "${fullTitle.replace(/"/g, '\\"')}"
createdAt: ${formatDateTime(note.createdAt)}
updatedAt: ${formatDateTime(note.updatedAt)}
isPinned: ${note.isPinned ? 'true' : 'false'}
tags: [${(note.tags || []).map(tag => `"${tag}"`).join(', ')}]
fontSize: ${note.fontSize || 18}
fontFamily: "${note.fontFamily || 'Aeonik'}"
folder: ${note.folder ? `"${note.folder}"` : 'null'}
folderName: ${note.folderName ? `"${note.folderName.replace(/"/g, '\\"')}"` : 'null'}
---

`;
}

function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return {
      metadata: {},
      content: content
    };
  }
  
  const frontmatterLines = match[1].split('\n');
  const metadata = {};
  
  frontmatterLines.forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > -1) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      if (key === 'tags') {
        value = value.replace(/^\[|\]$/g, '').split(',').map(tag => tag.trim().replace(/^"|"$/g, ''));
      } else if (key === 'fontSize') {
        value = parseInt(value) || 18;
      } else if (key === 'isPinned') {
        value = value === 'true';
      } else if (key === 'fontFamily') {
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1).replace(/\\"/g, '"');
        }
      } else if ((key === 'folder' || key === 'folderName') && value === 'null') {
        value = null;
      } else if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\"/g, '"');
      }
      
      metadata[key] = value;
    }
  });
  
  if (!metadata.fontSize) metadata.fontSize = 18;
  if (!metadata.fontFamily) metadata.fontFamily = 'Aeonik';
  metadata.isPinned = metadata.isPinned === true;
  
  return {
    metadata,
    content: match[2]
  };
}

// ===== PLATFORM DETECTION =====
function getPlatformModKey() {
  if (globalThis.navigator) {
    return globalThis.navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Cmd' : 'Ctrl';
  }
  return process.platform === 'darwin' ? 'Cmd' : 'Ctrl';
}

// ===== EXPORTS =====
const exportsMap = {
  sanitizeFilename,
  generateNoteFilename,
  formatDateTime,
  convertHtmlToMarkdown,
  convertMarkdownToHtml,
  createFrontmatter,
  parseFrontmatter,
  getPlatformModKey
};

try {
  module.exports = exportsMap;
} catch {
  // Ignore in browser environments where module is undeclared
}

try {
  window.FlowpadUtils = exportsMap;
} catch {
  // Ignore in Node environments where window is undeclared
}