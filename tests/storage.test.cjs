const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeNoteHtml, convertHtmlToMarkdown, convertMarkdownToHtml, createFrontmatter, parseFrontmatter, generateNoteFilename } = require('../src/shared/utils');
const sample = { id: 'abc-123', title: 'A "quote"\\path\nnext', createdAt: '2026-10-27T10:00:00.123Z', updatedAt: '2026-10-27T10:01:00.456Z', isPinned: true, tags: ['with, comma', 'quote"'], fontSize: 18, fontFamily: 'Patrick Hand', folder: 'folder-1', folderName: 'Work "A"\nB', contentFormat: 'html' };
test('frontmatter round-trips quotes, newlines, comma tags and UTC milliseconds', () => {
  const parsed = parseFrontmatter(createFrontmatter(sample) + '<div>Body</div>');
  assert.deepEqual(parsed.metadata, sample);
  assert.equal(parsed.content, '<div>Body</div>');
});
test('frontmatter handles legacy unquoted ids, empty tags and CRLF', () => {
  const parsed = parseFrontmatter('---\r\nid: 1234\r\ntitle: "Old"\r\ntags: []\r\nisPinned: false\r\n---\r\n\r\nBody');
  assert.equal(parsed.metadata.id, '1234');
  assert.deepEqual(parsed.metadata.tags, []);
  assert.equal(parsed.content, 'Body');
});
test('blank lines, leading/trailing whitespace and literal Markdown remain exact', () => {
  const html = '<div>**literal** &amp; &lt;text&gt;</div><div><br></div><div><br></div><div>  spaces   </div><div><br></div>';
  assert.equal(sanitizeNoteHtml(html), html);
});
test('sanitization is idempotent and removes executable markup', () => {
  const html = '<div onclick="alert(1)"><b>safe</b><img src="x" onerror="bad()"><script>bad()</script><iframe src="https://bad.test"></iframe><a href="javascript:bad()">words</a></div>';
  const safe = sanitizeNoteHtml(html);
  assert.equal(safe, '<div><b>safe</b><a>words</a></div>');
  assert.equal(sanitizeNoteHtml(safe), safe);
});
test('legacy interactive task HTML keeps task words without active controls', () => {
  const html = '<div class="checklist-line"><span class="checklist-item" data-checked="true"><span class="checkbox-circle checked"></span><s>Completed</s></span></div>';
  assert.equal(sanitizeNoteHtml(html), '<div><span><s>Completed</s></span></div>');
});
test('legacy Markdown tasks become normal lists without losing words', async () => {
  const html = await convertMarkdownToHtml('- [ ] Pending\n- [x] Done');
  assert.match(html, /<li>Pending<\/li>/);
  assert.match(html, /<li>Done<\/li>/);
  assert.doesNotMatch(html, /checkbox|checklist|input/);
});
test('Markdown headings, nested lists and entities import safely', async () => {
  const html = await convertMarkdownToHtml('# Heading\n\n- First\n  - Nested\n\n<script>bad()</script>\n\nA & B');
  assert.match(html, /<h1>Heading<\/h1>/);
  assert.match(html, /<ul[^>]*>[\s\S]*<ul[^>]*>/);
  assert.match(html, /A &amp; B/);
  assert.doesNotMatch(html, /script|bad\(\)/);
});
test('Markdown export supports headings, underline, strike and lists', async () => {
  const markdown = await convertHtmlToMarkdown('<h1>Title</h1><div><u>Under</u> <s>Gone</s></div><ol><li>One</li><li>Two</li></ol>');
  assert.match(markdown, /# Title/);
  assert.match(markdown, /<u>Under<\/u>/);
  assert.match(markdown, /~~Gone~~/);
  assert.match(markdown, /1\.\s+One/);
  assert.match(markdown, /2\.\s+Two/);
});
test('file names remove forbidden title characters and bound length', () => {
  const filename = generateNoteFilename({ id: 'id-1', title: 'a/b:c*?<>|"\\' + 'long'.repeat(30) });
  assert.match(filename, /^note_id-1_/);
  assert.doesNotMatch(filename, /[/:*?<>|"\\]/);
  assert.ok(filename.length < 50);
});
test('legacy Flowpad underline markers keep their formatting', async () => {
  assert.match(await convertMarkdownToHtml('__underlined__ and **bold**', true), /<u>underlined<\/u> and <strong>bold<\/strong>/);
});
test('plain text export removes formatting and keeps line separation', () => {
  const { convertHtmlToText } = require('../src/shared/utils');
  assert.equal(convertHtmlToText('<h1>Title</h1><div><b>Body</b></div>'), 'Title\nBody');
});
test('dash and bullet marker attributes survive sanitization while other values are removed', () => {
  const html = '<ul data-marker="dash"><li>Dash</li></ul><ul data-marker="bullet"><li>Dot</li></ul>';
  assert.equal(sanitizeNoteHtml(html), html);
  assert.equal(sanitizeNoteHtml('<ul data-marker="unsafe"><li>A</li></ul>'), '<ul><li>A</li></ul>');
});
test('dash and bullet lists keep distinct markers through Markdown export and import', async () => {
  const html = '<ul data-marker="dash"><li>Dash<ul><li>Nested dash</li></ul></li></ul><ul data-marker="bullet"><li>Dot</li></ul>';
  const markdown = await convertHtmlToMarkdown(html);
  assert.match(markdown, /^- +Dash/m);
  assert.match(markdown, /^ {4}- +Nested dash/m);
  assert.match(markdown, /^\* +Dot/m);
  const restored = await convertMarkdownToHtml(markdown);
  assert.match(restored, /<ul data-marker="dash">/);
  assert.match(restored, /<ul data-marker="bullet">/);
});
