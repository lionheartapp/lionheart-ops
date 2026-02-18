import { memo } from 'react'

/**
 * Top bar for FormBuilder: Back and Save actions when not embedded.
 */
function FormBuilderToolbar({ onBack, onSave, embedded }) {
  if (embedded) return null
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        Back
      </button>
      <button
        type="button"
        onClick={onSave}
        className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
      >
        Save form
      </button>
    </div>
  )
}

export default memo(FormBuilderToolbar)
