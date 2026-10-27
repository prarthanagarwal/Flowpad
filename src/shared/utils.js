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

// Keep the editor's HTML as the note body. Markdown export is deliberately separate:
// Markdown cannot represent every blank line, underline, or literal formatting marker.
function sanitizeNoteHtml(html) {
  const { parseHTML } = require('linkedom');
  const { document } = parseHTML('<html><body></body></html>');
  document.body.innerHTML = html || '';
  document.querySelectorAll('script,style,iframe,object,embed,svg,math,form,input,button,link,meta,img').forEach(node => node.remove());
  // Legacy interactive tasks become ordinary text; retain their words and formatting.
  document.querySelectorAll('.checkbox-circle,.circular-checkbox,.todo-checkbox').forEach(node => node.remove());
  const allowed = new Set(['DIV', 'P', 'BR', 'H1', 'H2', 'H3', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'SPAN', 'A']);
  document.body.querySelectorAll('*').forEach(node => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    for (const attribute of Array.from(node.attributes)) {
      if (['UL', 'LI'].includes(node.tagName) && attribute.name === 'data-marker' && ['dash', 'bullet'].includes(attribute.value)) continue;
      if (attribute.name === 'style' && /^(?:(?:font-weight: (?:normal|bold|[1-9]00)|font-style: (?:normal|italic)|text-decoration(?:-line)?: (?:underline|line-through|none))(?:;\s*|$))+$/.test(attribute.value)) continue;
      if (!(node.tagName === 'OL' && attribute.name === 'start' && /^\d+$/.test(attribute.value))) {
        node.removeAttribute(attribute.name);
      }
    }
  });
  return document.body.innerHTML;
}

async function convertHtmlToMarkdown(htmlContent) {
  const TurndownService = require('turndown');
  const service = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
  const listItem = service.options.rules.listItem;
  service.addRule('listMarker', { filter: 'li', replacement(content, node, options) {
    const bulletListMarker = node.closest('[data-marker]')?.getAttribute('data-marker') === 'bullet' ? '*' : '-';
    return listItem.replacement(content, node, { ...options, bulletListMarker });
  } });
  service.addRule('underline', { filter: 'u', replacement: content => `<u>${content}</u>` });
  service.addRule('strike', { filter: ['s', 'strike'], replacement: content => `~~${content}~~` });
  return service.turndown(sanitizeNoteHtml(htmlContent));
}

function convertHtmlToText(htmlContent) {
  const { parseHTML } = require('linkedom');
  const { document } = parseHTML('<html><body></body></html>');
  document.body.innerHTML = sanitizeNoteHtml(htmlContent);
  return document.body.innerText;
}

async function convertMarkdownToHtml(markdownContent, legacyUnderline = false) {
  const { Marked, Renderer } = await import('marked');
  // Retire legacy task syntax without dropping task text.
  const text = (markdownContent || '').replace(/^([ \t]*)- \[[ xX]\] /gm, '$1- ');
  const parser = new Marked({ breaks: true });
  const listRenderer = new Renderer();
  parser.use({ renderer: {
    list(token) {
      listRenderer.parser = this.parser;
      const html = listRenderer.list(token);
      if (token.ordered) return html;
      const marker = /^\s*-/.test(token.raw) ? 'dash' : 'bullet';
      return html.replace('<ul>', `<ul data-marker="${marker}">`);
    }
  } });
  if (legacyUnderline) parser.use({ renderer: {
    strong(token) {
      const tag = token.raw.startsWith('__') ? 'u' : 'strong';
      return `<${tag}>${this.parser.parseInline(token.tokens)}</${tag}>`;
    }
  } });
  return sanitizeNoteHtml(parser.parse(text)) || '<div><br></div>';
}

// JSON scalar values are YAML-compatible and safely preserve quotes and newlines.
function createFrontmatter(note) {
  const metadata = {
    id: note.id,
    title: note.title || 'New Note',
    createdAt: new Date(note.createdAt).toISOString(),
    updatedAt: new Date(note.updatedAt).toISOString(),
    isPinned: !!note.isPinned,
    tags: note.tags || [],
    fontSize: note.fontSize || 18,
    fontFamily: note.fontFamily || 'Aeonik',
    folder: note.folder || null,
    folderName: note.folderName || null,
    contentFormat: note.contentFormat || 'markdown'
  };
  return '---\n' + Object.entries(metadata).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n') + '\n---\n\n';
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n(?:\r?\n)?([\s\S]*)$/);
  if (!match) return { metadata: {}, content };
  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    try { metadata[key] = JSON.parse(value); }
    catch { metadata[key] = value; }
  }
  metadata.id = metadata.id == null ? undefined : String(metadata.id);
  metadata.isPinned = metadata.isPinned === true;
  return { metadata, content: match[2] };
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
  sanitizeNoteHtml,
  sanitizeFilename,
  generateNoteFilename,
  formatDateTime,
  convertHtmlToMarkdown,
  convertHtmlToText,
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