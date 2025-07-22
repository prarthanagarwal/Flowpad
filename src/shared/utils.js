// ===== SHARED UTILITIES =====
// Common functions used across main and renderer processes

// ===== FILENAME UTILITIES =====
function sanitizeFilename(title) {
  // Remove illegal filename characters and limit length
  return title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove illegal chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .substring(0, 20) // Limit to 20 characters max
    || 'Untitled Note';
}

function generateNoteFilename(note) {
  const createdDate = new Date(note.createdAt);
  const datePrefix = createdDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Simple numeric time format: HHMMSS
  const hours = createdDate.getHours().toString().padStart(2, '0');
  const minutes = createdDate.getMinutes().toString().padStart(2, '0');
  const seconds = createdDate.getSeconds().toString().padStart(2, '0');
  const timePrefix = `${hours}${minutes}${seconds}`;
  
  const sanitizedTitle = sanitizeFilename(note.title);
  return `${datePrefix}_${timePrefix}_${sanitizedTitle}.md`;
}

// ===== DATE/TIME UTILITIES =====
function formatDateTime(isoString) {
  const date = new Date(isoString);
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = date.toTimeString().split(' ')[0]; // HH:MM:SS
  return `${dateStr} ${timeStr}`;
}

// ===== MARKDOWN CONVERSION =====
async function convertHtmlToMarkdown(htmlContent) {
  // Simple HTML to Markdown conversion
  return htmlContent
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<b>(.*?)<\/b>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<i>(.*?)<\/i>/g, '*$1*')
    .replace(/<u>(.*?)<\/u>/g, '__$1__')
    .replace(/<s>(.*?)<\/s>/g, '~~$1~~')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<div>/g, '\n')
    .replace(/<\/div>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

async function convertMarkdownToHtml(markdownContent) {
  // Simple Markdown to HTML conversion for display
  return markdownContent
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<u>$1</u>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// ===== FRONTMATTER UTILITIES =====
function createFrontmatter(note) {
  // Use the sanitized title in frontmatter, not the full title
  const sanitizedTitle = sanitizeFilename(note.title);
  
  return `---
id: ${note.id}
title: "${sanitizedTitle.replace(/"/g, '\\"')}"
createdAt: ${formatDateTime(note.createdAt)}
updatedAt: ${formatDateTime(note.updatedAt)}
tags: [${note.tags.map(tag => `"${tag}"`).join(', ')}]
fontSize: ${note.fontSize || 16}
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
      
      // Parse different value types
      if (key === 'tags') {
        value = value.replace(/^\[|\]$/g, '').split(',').map(tag => tag.trim().replace(/^"|"$/g, ''));
      } else if (key === 'fontSize') {
        value = parseInt(value) || 16; // Parse as number with default
      } else if ((key === 'folder' || key === 'folderName') && value === 'null') {
        value = null; // Parse null values for folder and folderName
      } else if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\"/g, '"');
      }
      
      metadata[key] = value;
    }
  });
  
  // Add default values for backward compatibility
  if (!metadata.fontSize) metadata.fontSize = 16;
  if (!metadata.fontFamily) metadata.fontFamily = 'Aeonik';
  
  return {
    metadata,
    content: match[2]
  };
}

// ===== PLATFORM DETECTION =====
function getPlatformModKey() {
  if (typeof navigator !== 'undefined') {
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Cmd' : 'Ctrl';
  }
  return process.platform === 'darwin' ? 'Cmd' : 'Ctrl';
}

// ===== EXPORTS =====
// For Node.js (main process)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sanitizeFilename,
    generateNoteFilename,
    formatDateTime,
    convertHtmlToMarkdown,
    convertMarkdownToHtml,
    createFrontmatter,
    parseFrontmatter,
    getPlatformModKey
  };
}

// For browser (renderer process) - expose to global scope
if (typeof window !== 'undefined') {
  window.FlowpadUtils = {
    sanitizeFilename,
    generateNoteFilename,
    formatDateTime,
    convertHtmlToMarkdown,
    convertMarkdownToHtml,
    createFrontmatter,
    parseFrontmatter,
    getPlatformModKey
  };
} 