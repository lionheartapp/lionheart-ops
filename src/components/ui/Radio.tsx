'use client'

import { createContext, useContext, useId, type ReactNode } from 'react'

// ─── Context ────────────────────────────────────────────────────────────────

interface RadioGroupContextValue {
  name: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null)

// ─── RadioGroup ─────────────────────────────────────────────────────────────

interface RadioGroupProps {
  /** Currently selected value. */
  value: string
  /** Called with the new value when selection changes. */
  onChange: (value: string) => void
  /** Optional name for the underlying `<input>` group. Auto-generated if omitted. */
  name?: string
  /** Disables every Radio inside the group. */
  disabled?: boolean
  children: ReactNode
  className?: string
}

/**
 * Container for a set of `<Radio>` options. Manages selection state and the
 * shared `name` attribute. Use this around two or more Radio components.
 *
 *   <RadioGroup value={priority} onChange={setPriority}>
 *     <Radio value="low" label="Low" />
 *     <Radio value="high" label="High" />
 *   </RadioGroup>
 */
export function RadioGroup({
  value,
  onChange,
  name,
  disabled,
  children,
  className = '',
}: RadioGroupProps) {
  const generatedName = useId()
  return (
    <RadioGroupContext.Provider value={{ name: name ?? generatedName, value, onChange, disabled }}>
      <div role="radiogroup" className={`flex flex-col gap-2 ${className}`.trim()}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

// ─── Radio ──────────────────────────────────────────────────────────────────

interface RadioProps {
  /** The value this radio represents. Must be unique within its RadioGroup. */
  value: string
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  className?: string
}

/**
 * Single radio option. Must be rendered inside a `<RadioGroup>` — uses the
 * group's value/onChange for selection.
 */
export function Radio({ value, label, description, disabled, className = '' }: RadioProps) {
  const ctx = useContext(RadioGroupContext)
  if (!ctx) {
    throw new Error('<Radio> must be rendered inside a <RadioGroup>.')
  }

  const isDisabled = disabled || ctx.disabled
  const checked = ctx.value === value

  const inputClasses = [
    'mt-0.5 h-4 w-4 flex-shrink-0',
    'border border-slate-300',
    'text-indigo-600 accent-indigo-600',
    'focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:ring-offset-0',
    'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
    'transition-colors',
  ].join(' ')

  if (!label && !description) {
    return (
      <input
        type="radio"
        name={ctx.name}
        value={value}
        checked={checked}
        disabled={isDisabled}
        onChange={() => ctx.onChange(value)}
        className={`${inputClasses} ${className}`.trim()}
      />
    )
  }

  return (
    <label
      className={`flex items-start gap-2.5 ${
        isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${className}`.trim()}
    >
      <input
        type="radio"
        name={ctx.name}
        value={value}
        checked={checked}
        disabled={isDisabled}
        onChange={() => ctx.onChange(value)}
        className={inputClasses}
      />
      <div className="min-w-0 flex-1 leading-tight">
        {label && (
          <span className="text-sm text-slate-900 select-none">{label}</span>
        )}
        {description && (
          <p className="text-xs text-slate-500 mt-0.5 select-none">{description}</p>
        )}
      </div>
    </label>
  )
}
