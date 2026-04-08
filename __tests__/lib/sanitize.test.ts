import { describe, it, expect } from 'vitest'
import { stripAllHtml, sanitizeHtml, zodSanitizedString, zodRichText } from '@/lib/sanitize'

// ── stripAllHtml ─────────────────────────────────────────────────────────────

describe('stripAllHtml', () => {
  it('strips simple tags', () => {
    expect(stripAllHtml('<p>Hello</p>')).toBe('Hello')
  })

  it('strips nested tags', () => {
    expect(stripAllHtml('<div><p><strong>Bold</strong></p></div>')).toBe('Bold')
  })

  it('strips self-closing tags', () => {
    expect(stripAllHtml('Line 1<br/>Line 2')).toBe('Line 1Line 2')
  })

  it('returns plain text unchanged', () => {
    expect(stripAllHtml('No tags here')).toBe('No tags here')
  })

  it('trims whitespace', () => {
    expect(stripAllHtml('  <b>spaced</b>  ')).toBe('spaced')
  })

  it('handles empty string', () => {
    expect(stripAllHtml('')).toBe('')
  })

  it('strips script tags', () => {
    expect(stripAllHtml('<script>alert("xss")</script>safe')).toBe('alert("xss")safe')
  })

  it('strips tags with attributes', () => {
    expect(stripAllHtml('<a href="http://evil.com">click</a>')).toBe('click')
  })
})

// ── sanitizeHtml ─────────────────────────────────────────────────────────────

describe('sanitizeHtml', () => {
  // Script removal
  it('removes script tags and content', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>safe')).toBe('safe')
  })

  it('removes script tags case-insensitively', () => {
    expect(sanitizeHtml('<SCRIPT>evil</SCRIPT>ok')).toBe('ok')
  })

  it('removes script tags with attributes', () => {
    expect(sanitizeHtml('<script src="evil.js"></script>clean')).toBe('clean')
  })

  // Style removal
  it('removes style tags and content', () => {
    expect(sanitizeHtml('<style>body{display:none}</style>visible')).toBe('visible')
  })

  // Dangerous block elements
  it('removes iframe tags and content', () => {
    expect(sanitizeHtml('<iframe src="evil.com">embed</iframe>safe')).toBe('safe')
  })

  it('removes embed tags', () => {
    expect(sanitizeHtml('<embed src="evil.swf"/>safe')).toBe('safe')
  })

  it('removes object tags and content', () => {
    expect(sanitizeHtml('<object data="evil.swf">obj</object>safe')).toBe('safe')
  })

  it('removes form tags and content', () => {
    expect(sanitizeHtml('<form action="/steal"><input type="text"/></form>safe')).toBe('safe')
  })

  it('removes self-closing input tags', () => {
    expect(sanitizeHtml('text<input type="hidden"/>more')).toBe('textmore')
  })

  it('removes link/meta/base tags', () => {
    expect(sanitizeHtml('<link rel="stylesheet"/><meta charset="utf-8"/><base href="/"/>ok')).toBe('ok')
  })

  // Event handler removal
  it('removes onclick handlers', () => {
    const result = sanitizeHtml('<p onclick="alert(1)">text</p>')
    expect(result).not.toContain('onclick')
    expect(result).toContain('text')
  })

  it('removes onerror handlers', () => {
    const result = sanitizeHtml('<img onerror="alert(1)" src="x"/>')
    expect(result).not.toContain('onerror')
  })

  it('removes onload handlers', () => {
    const result = sanitizeHtml('<body onload="evil()">content</body>')
    expect(result).not.toContain('onload')
  })

  // Protocol removal
  it('removes javascript: protocol in href', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">link</a>')
    expect(result).not.toContain('javascript:')
    expect(result).toContain('link')
  })

  it('removes data: protocol in src', () => {
    const result = sanitizeHtml('<a src="data:text/html,<script>alert(1)</script>">link</a>')
    expect(result).not.toContain('data:')
  })

  // Safe tag preservation
  it('preserves safe formatting tags', () => {
    const input = '<p><strong>Bold</strong> and <em>italic</em></p>'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it('preserves safe structural tags', () => {
    const input = '<ul><li>Item 1</li><li>Item 2</li></ul>'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it('preserves heading tags', () => {
    expect(sanitizeHtml('<h1>Title</h1>')).toBe('<h1>Title</h1>')
  })

  it('preserves anchor tags with href', () => {
    const input = '<a href="https://safe.com">link</a>'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it('preserves br tags', () => {
    expect(sanitizeHtml('<br>')).toBe('<br>')
  })

  // Unsafe tag removal
  it('strips div tags (not in safe list)', () => {
    expect(sanitizeHtml('<div>content</div>')).toBe('content')
  })

  it('strips span tags (not in safe list)', () => {
    expect(sanitizeHtml('<span class="red">text</span>')).toBe('text')
  })

  // Unsafe attribute removal on safe tags
  it('strips class attribute from safe tags', () => {
    const result = sanitizeHtml('<p class="evil">text</p>')
    expect(result).not.toContain('class')
    expect(result).toContain('<p')
    expect(result).toContain('text')
  })

  it('strips style attribute from safe tags', () => {
    const result = sanitizeHtml('<p style="display:none">text</p>')
    expect(result).not.toContain('style')
  })

  it('preserves title attribute on safe tags', () => {
    expect(sanitizeHtml('<a href="/page" title="Go">link</a>')).toContain('title="Go"')
  })

  // Edge cases
  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('trims result', () => {
    expect(sanitizeHtml('  <p>text</p>  ')).toBe('<p>text</p>')
  })

  it('handles multiline script tags', () => {
    const input = '<script>\nalert("xss")\n</script>safe'
    expect(sanitizeHtml(input)).toBe('safe')
  })
})

// ── Zod helpers ──────────────────────────────────────────────────────────────

describe('zodSanitizedString', () => {
  it('returns a Zod schema that strips HTML', () => {
    const schema = zodSanitizedString()
    const result = schema.parse('<b>Hello</b> world')
    expect(result).toBe('Hello world')
  })
})

describe('zodRichText', () => {
  it('returns a Zod schema that sanitizes but preserves safe HTML', () => {
    const schema = zodRichText()
    const result = schema.parse('<p><strong>Bold</strong><script>bad</script></p>')
    expect(result).toBe('<p><strong>Bold</strong></p>')
  })
})
