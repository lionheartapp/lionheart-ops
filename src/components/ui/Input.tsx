'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { inputClasses, FIELD_BORDER_ERROR, type FieldSize } from './form-tokens'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> {
  /** Marks the field as invalid — applies the standard error border. */
  hasError?: boolean
  /** Field size variant. `default` = 52px tall (forms). `sm` = 36px tall (tables, dense UIs). */
  size?: FieldSize
  /** Optional className to APPEND to the canonical styles. Use sparingly. */
  className?: string
}

/**
 * Standard text input. Always renders with the canonical field styling from
 * form-tokens — same height, border, focus state as Select / Textarea /
 * AssigneePicker.
 *
 * Use this in product code instead of raw `<input>`. If you need a special
 * variant (e.g., search box with embedded icon), build a new primitive on top
 * of the same tokens — don't fork the styles inline.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { hasError, size = 'default', className = '', type = 'text', ...rest },
  ref,
) {
  const errorClass = hasError ? `${FIELD_BORDER_ERROR}` : ''
  // For date/time inputs we strip browser-default chrome so the field reads
  // identically to a plain text input.
  const isDateLike = type === 'date' || type === 'time' || type === 'datetime-local'
  const dateClass = isDateLike
    ? 'appearance-none [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:cursor-pointer'
    : ''

  return (
    <input
      ref={ref}
      type={type}
      className={`${inputClasses(size)} ${errorClass} ${dateClass} ${className}`.trim()}
      {...rest}
    />
  )
})
