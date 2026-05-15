/**
 * Extract plain text from Tiptap HTML for preview/notification purposes.
 * Extracted from RichTextEditor.tsx to avoid pulling in Tiptap when only
 * the text extraction utility is needed.
 */
export function htmlToPlainText(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '')
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}
