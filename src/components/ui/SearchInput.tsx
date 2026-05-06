'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { Search, X } from 'lucide-react'
import {
  FIELD_HEIGHT,
  FIELD_HEIGHT_SM,
  FIELD_RADIUS,
  FIELD_BORDER,
  FIELD_BORDER_HOVER,
  FIELD_BG,
  FIELD_TEXT,
  FIELD_TEXT_SM,
  FIELD_PLACEHOLDER,
  FIELD_FOCUS,
  type FieldSize,
} from './form-tokens'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className' | 'size'> {
  /** Current value — required so we can show/hide the clear button. */
  value: string
  /** Optional handler for the clear (×) button. If omitted, the button is hidden. */
  onClear?: () => void
  /** Field size variant. `default` = 52px (forms). `sm` = 36px (dropdown panels, dense UIs). */
  size?: FieldSize
  className?: string
}

/**
 * Standard search box — same height/border/focus state as Input, with a
 * magnifying glass icon on the left and (optionally) a clear button on the
 * right. Use this in product code instead of an `<input type="text">` plus
 * inline icon.
 *
 * The clear button only renders when `onClear` is provided AND `value` is
 * non-empty, so it stays out of the way for empty/uncontrolled cases.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onClear, placeholder = 'Search…', size = 'default', className = '', ...rest },
  ref,
) {
  const showClear = !!onClear && typeof value === 'string' && value.length > 0
  const isSm = size === 'sm'

  return (
    <div
      className={[
        'relative w-full',
        isSm ? FIELD_HEIGHT_SM : FIELD_HEIGHT,
        FIELD_RADIUS,
        FIELD_BORDER,
        FIELD_BORDER_HOVER,
        FIELD_BG,
        'flex items-center gap-2',
        isSm ? 'px-2' : 'px-3',
        'transition-colors',
        // Focus ring / border are applied via :focus-within so the wrapper
        // mirrors what the input does. Keeps the visual state consistent.
        'focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-100',
        className,
      ].join(' ').trim()}
    >
      <Search className={`${isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-slate-400 flex-shrink-0`} />
      <input
        ref={ref}
        type="text"
        value={value}
        placeholder={placeholder}
        className={`flex-1 min-w-0 bg-transparent outline-none ${isSm ? FIELD_TEXT_SM : FIELD_TEXT} ${FIELD_PLACEHOLDER}`}
        // Override the standalone input focus state — the wrapper handles it.
        // (Avoid double rings.)
        style={{ boxShadow: 'none' }}
        {...rest}
      />
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="flex-shrink-0 p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
})

// Note: FIELD_FOCUS is intentionally unused here because the focus state is
// applied to the wrapper via focus-within (see above). Re-export only kept for
// downstream type-stability if future variants want it.
void FIELD_FOCUS
