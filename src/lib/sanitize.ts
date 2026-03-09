/**
 * Input sanitization utilities for XSS prevention.
 *
 * Lightweight server-side sanitizer — no heavy DOM/DOMPurify dependency.
 * Used in Zod schemas to strip dangerous HTML before data reaches the database.
 */

import { z } from 'zod'

// Tags that are allowed to remain in rich-text fields
const SAFE_TAGS = new Set([
  'p', 'br', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li',
  'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
])

// Attributes allowed on safe tags (others are stripped)
const SAFE_ATTRS = new Set(['href', 'title'])

/**
 * Strip all HTML tags from a string — for plain-text fields.
 */
export function stripAllHtml(input: string): string {
  if (typeof input !== 'string') return input
  // Remove all tags
  return input.replace(/<[^>]*>/g, '').trim()
}

/**
 * Sanitize HTML for rich-text fields:
 * - Removes dangerous elements: script, style, iframe, embed, object, form, input
 * - Removes event handler attributes (onclick, onerror, onload, etc.)
 * - Removes javascript: protocol from href/src
 * - Preserves safe structural/formatting tags
 *
 * Note: This is a regex-based sanitizer suitable for server-side defense-in-depth.
 * For user-facing rich text rendering, also apply client-side sanitization.
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return input

  let result = input

  // Remove script tags and their content (case-insensitive, greedy across newlines)
  result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

  // Remove style tags and their content
  result = result.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')

  // Remove dangerous block elements entirely (with content)
  result = result.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
  result = result.replace(/<embed\b[^>]*>[\s\S]*?<\/embed>/gi, '')
  result = result.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
  result = result.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, '')

  // Remove self-closing / void dangerous tags
  result = result.replace(/<(iframe|embed|object|input|form|link|meta|base)\b[^>]*\/?>/gi, '')

  // Remove event handler attributes: on* = "..." or on* = '...'
  result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')

  // Remove javascript: protocol in href and src attributes
  result = result.replace(/(href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]*)/gi, '')

  // Remove data: URIs in href/src (can carry scripts)
  result = result.replace(/(href|src)\s*=\s*(?:"data:[^"]*"|'data:[^']*'|data:[^\s>]*)/gi, '')

  // Remove remaining tags that are NOT in the safe set
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag: string) => {
    const tagLower = tag.toLowerCase()
    if (!SAFE_TAGS.has(tagLower)) {
      return '' // strip the tag entirely
    }
    // For safe tags, strip disallowed attributes
    return match.replace(/\s+([a-zA-Z\-:]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/g, (attrMatch, attrName: string) => {
      return SAFE_ATTRS.has(attrName.toLowerCase()) ? attrMatch : ''
    })
  })

  return result.trim()
}

/**
 * Zod transform helper for plain-text fields.
 * Strips all HTML tags — use for titles, names, short text inputs.
 *
 * Usage: z.string().min(1).max(200).transform(stripAllHtml)
 */
export function zodSanitizedString() {
  return z.string().transform(stripAllHtml)
}

/**
 * Zod transform helper for rich-text fields.
 * Removes dangerous HTML while preserving safe formatting tags.
 *
 * Usage: z.string().transform(sanitizeHtml).optional().nullable()
 */
export function zodRichText() {
  return z.string().transform(sanitizeHtml)
}
