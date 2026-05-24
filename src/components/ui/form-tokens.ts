/**
 * Form field design tokens.
 *
 * SINGLE SOURCE OF TRUTH for the visual style of every form field in the app:
 * inputs, textareas, selects, date pickers, assignee pickers, search boxes.
 *
 * The actual NUMBERS (radius, height) live in `tailwind.config.ts` under
 * `theme.extend.borderRadius.field` and `theme.extend.height.field`. Change
 * those once, every primitive in this file updates. Do not hard-code these
 * values in component code.
 *
 * If you find yourself writing raw className strings like `px-3 py-2 border
 * border-slate-200 rounded-lg ...` on a form field, STOP — use the matching
 * primitive in `@/components/ui/` instead (Input, Textarea, Select, etc.).
 * If a new primitive is needed, build it on top of these tokens.
 */

// ─── Atomic tokens (composed by the presets below) ─────────────────────────

/** Default fixed height for single-line fields. Compact = `h-field-sm`. */
export const FIELD_HEIGHT = 'h-field'
export const FIELD_HEIGHT_SM = 'h-field-sm'

/** Inner padding for single-line fields. */
export const FIELD_PADDING_X = 'px-3'
export const FIELD_PADDING_X_SM = 'px-2'

/** Inner padding for textareas (vertical needs explicit value since they grow). */
export const FIELD_PADDING_TEXTAREA = 'px-3 py-2.5'

/** Corner rounding. Driven by tailwind.config.ts → borderRadius.field. */
export const FIELD_RADIUS = 'rounded-field'

/** Resting border color. Matches the global input border treatment. */
export const FIELD_BORDER = 'border border-[rgba(17,15,10,0.12)]'

/** Hover border color. */
export const FIELD_BORDER_HOVER = 'hover:border-[rgba(17,15,10,0.18)]'

/** Error border color. */
export const FIELD_BORDER_ERROR = 'border-red-300'

/** Focus state — applied via a single class string for consistency. */
export const FIELD_FOCUS =
  'focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100'

/** Focus state when the field is open (e.g., custom Select trigger with panel showing). */
export const FIELD_OPEN = 'border-indigo-400 ring-1 ring-indigo-100'

/** Background color. Always white inside the form, even on the cream surface. */
export const FIELD_BG = 'bg-white'

/** Text size + color for value content. */
export const FIELD_TEXT = 'text-sm text-slate-900'
export const FIELD_TEXT_SM = 'text-xs text-slate-900'

/** Placeholder color. */
export const FIELD_PLACEHOLDER = 'placeholder:text-slate-400'

// ─── Composed presets — default size ───────────────────────────────────────

/**
 * Full className string for a standard single-line input. Used by <Input>.
 * Don't use directly — render <Input> instead.
 */
export const INPUT_CLASSES = [
  'w-full',
  FIELD_HEIGHT,
  FIELD_PADDING_X,
  FIELD_TEXT,
  FIELD_PLACEHOLDER,
  FIELD_BG,
  FIELD_BORDER,
  FIELD_BORDER_HOVER,
  FIELD_RADIUS,
  FIELD_FOCUS,
  'transition-colors',
].join(' ')

/**
 * Full className string for a textarea. Same visual language as INPUT_CLASSES
 * but without fixed height (grows by row count) and with vertical padding.
 */
export const TEXTAREA_CLASSES = [
  'w-full',
  FIELD_PADDING_TEXTAREA,
  FIELD_TEXT,
  FIELD_PLACEHOLDER,
  FIELD_BG,
  FIELD_BORDER,
  FIELD_BORDER_HOVER,
  FIELD_RADIUS,
  FIELD_FOCUS,
  'resize-none transition-colors',
].join(' ')

/**
 * Trigger className for custom dropdowns (Select, AssigneePicker). Same look
 * as INPUT_CLASSES but designed to host a flex layout with chevron + content.
 */
export const FIELD_TRIGGER_CLASSES = [
  'w-full',
  FIELD_HEIGHT,
  FIELD_PADDING_X,
  'flex items-center justify-between gap-2',
  FIELD_TEXT,
  FIELD_BG,
  FIELD_BORDER,
  FIELD_BORDER_HOVER,
  FIELD_RADIUS,
  'overflow-hidden text-left transition-colors cursor-pointer',
].join(' ')

// ─── Composed presets — compact (sm) variant ───────────────────────────────

/** Compact input className — for dense/tabular contexts (table cells). */
export const INPUT_CLASSES_SM = [
  'w-full',
  FIELD_HEIGHT_SM,
  FIELD_PADDING_X_SM,
  FIELD_TEXT_SM,
  FIELD_PLACEHOLDER,
  FIELD_BG,
  FIELD_BORDER,
  FIELD_BORDER_HOVER,
  FIELD_RADIUS,
  FIELD_FOCUS,
  'transition-colors',
].join(' ')

/** Compact trigger className — for dense/tabular custom dropdowns. */
export const FIELD_TRIGGER_CLASSES_SM = [
  'w-full',
  FIELD_HEIGHT_SM,
  FIELD_PADDING_X_SM,
  'flex items-center justify-between gap-2',
  FIELD_TEXT_SM,
  FIELD_BG,
  FIELD_BORDER,
  FIELD_BORDER_HOVER,
  FIELD_RADIUS,
  'overflow-hidden text-left transition-colors cursor-pointer',
].join(' ')

/** Disabled-state className — append onto a trigger when disabled. */
export const FIELD_TRIGGER_DISABLED =
  'border-slate-200 text-slate-400 cursor-not-allowed hover:border-slate-200'

/** Dropdown panel that floats below a trigger (Select, AssigneePicker). */
export const PANEL_CLASSES = [
  'absolute z-30 top-full mt-1.5 left-0 right-0',
  'bg-white border border-slate-200 rounded-field-panel shadow-lg overflow-hidden',
].join(' ')

/** Row inside a dropdown panel — selected vs. hover variants. */
export const PANEL_ROW_BASE =
  'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer'

export const PANEL_ROW_SELECTED = 'bg-indigo-50'
export const PANEL_ROW_HOVER = 'hover:bg-slate-50'

// ─── Helpers ────────────────────────────────────────────────────────────────

export type FieldSize = 'default' | 'sm'

/** Resolve the right input className based on size. */
export function inputClasses(size: FieldSize = 'default'): string {
  return size === 'sm' ? INPUT_CLASSES_SM : INPUT_CLASSES
}

/** Resolve the right trigger className based on size. */
export function triggerClasses(size: FieldSize = 'default'): string {
  return size === 'sm' ? FIELD_TRIGGER_CLASSES_SM : FIELD_TRIGGER_CLASSES
}
