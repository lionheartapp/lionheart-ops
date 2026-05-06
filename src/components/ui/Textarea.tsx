'use client'

import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { TEXTAREA_CLASSES, FIELD_BORDER_ERROR } from './form-tokens'

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  hasError?: boolean
  className?: string
}

/**
 * Standard multi-line textarea. Same border, radius, focus state as the rest
 * of the form primitives — only the height differs (it grows with `rows`).
 *
 * Use this in product code instead of raw `<textarea>`.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { hasError, className = '', rows = 3, ...rest },
  ref,
) {
  const errorClass = hasError ? `${FIELD_BORDER_ERROR}` : ''
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={`${TEXTAREA_CLASSES} ${errorClass} ${className}`.trim()}
      {...rest}
    />
  )
})
