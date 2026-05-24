'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Upload, X, FileText } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FileInputProps {
  /** Called with the selected files. Always an array, even when `multiple={false}`. */
  onFiles: (files: File[]) => void
  /** Accepted file types — passed straight to the underlying input's `accept` attr. */
  accept?: string
  /** Optional capture hint for mobile camera/file sources. */
  capture?: boolean | 'user' | 'environment'
  /** Allow selecting more than one file at once. Default false. */
  multiple?: boolean
  /** Per-file size limit in bytes. Files over this trigger an error and are not emitted. */
  maxSize?: number
  /** Disable interaction. */
  disabled?: boolean
  /** Loading state — disables interaction and shows a spinner overlay if you provide one. */
  loading?: boolean
  /** Optional className appended to the dropzone container. */
  className?: string
  /**
   * Custom content rendered inside the zone. If omitted, a default upload
   * prompt with icon + text is shown.
   */
  children?: ReactNode
  /**
   * Optional human-readable hint shown under the default prompt — e.g.
   * "JPEG, PNG up to 5MB". Ignored when `children` is provided.
   */
  hint?: string
  /**
   * Compact mode — smaller icon + text for tight contexts.
   */
  compact?: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Drag-and-drop file picker with click-to-upload fallback.
 *
 * The component handles file SELECTION only — it doesn't upload anything. The
 * parent receives the chosen files via `onFiles` and decides what to do
 * (upload to storage, validate further, preview, etc.).
 *
 * Use this in product code instead of writing `<input type="file" hidden>`
 * plus a custom button. If you need upload progress / preview, compose it
 * around <FileInput>.
 *
 *   <FileInput
 *     accept="image/*"
 *     maxSize={5 * 1024 * 1024}
 *     onFiles={([file]) => uploadFile(file)}
 *     hint="JPEG, PNG, WebP up to 5MB"
 *   />
 */
export function FileInput({
  onFiles,
  accept,
  capture,
  multiple = false,
  maxSize,
  disabled = false,
  loading = false,
  className = '',
  children,
  hint,
  compact = false,
}: FileInputProps) {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isLocked = disabled || loading

  const validate = useCallback((files: File[]): { valid: File[]; error: string | null } => {
    if (files.length === 0) return { valid: [], error: null }

    if (maxSize) {
      const oversize = files.filter((f) => f.size > maxSize)
      if (oversize.length > 0) {
        return {
          valid: [],
          error: oversize.length === 1
            ? `${oversize[0].name} exceeds ${formatBytes(maxSize)} limit`
            : `${oversize.length} files exceed ${formatBytes(maxSize)} limit`,
        }
      }
    }

    return { valid: files, error: null }
  }, [maxSize])

  const handleFiles = useCallback((rawFiles: FileList | null) => {
    if (!rawFiles || rawFiles.length === 0) return
    const arr = multiple ? Array.from(rawFiles) : [rawFiles[0]]
    const { valid, error: err } = validate(arr)
    setError(err)
    if (valid.length > 0) onFiles(valid)
  }, [multiple, validate, onFiles])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (isLocked) return
    handleFiles(e.dataTransfer.files)
  }, [isLocked, handleFiles])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!isLocked) setDragOver(true)
  }, [isLocked])

  const onDragLeave = useCallback(() => setDragOver(false), [])

  const open = useCallback(() => {
    if (!isLocked) inputRef.current?.click()
  }, [isLocked])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    // Reset so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = ''
  }, [handleFiles])

  const stateClasses = (() => {
    if (isLocked) return 'border-slate-200 opacity-60 cursor-not-allowed'
    if (dragOver) return 'border-indigo-400 bg-indigo-50/50 cursor-copy'
    return 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/50 cursor-pointer'
  })()

  return (
    <div>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={open}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isLocked) {
            e.preventDefault()
            open()
          }
        }}
        role={isLocked ? undefined : 'button'}
        tabIndex={isLocked ? -1 : 0}
        aria-disabled={isLocked || undefined}
        className={[
          'rounded-lg border-2 border-dashed bg-white transition-colors',
          'flex flex-col items-center justify-center gap-2 text-center',
          compact ? 'px-4 py-5' : 'px-6 py-8',
          stateClasses,
          'focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400',
          className,
        ].join(' ').trim()}
      >
        {children ?? <DefaultPrompt dragOver={dragOver} hint={hint} compact={compact} />}
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        multiple={multiple}
        disabled={isLocked}
        onChange={onInputChange}
        className="hidden"
      />
    </div>
  )
}

interface DefaultPromptProps {
  dragOver: boolean
  hint?: string
  compact: boolean
}

function DefaultPrompt({ dragOver, hint, compact }: DefaultPromptProps) {
  const Icon = dragOver ? FileText : Upload
  return (
    <>
      <Icon
        className={`${compact ? 'w-5 h-5' : 'w-7 h-7'} text-slate-400`}
      />
      <p className={`${compact ? 'text-xs' : 'text-sm'} text-slate-600`}>
        {dragOver ? 'Drop to upload' : 'Drag & drop or click to upload'}
      </p>
      {hint && !compact && (
        <p className="text-xs text-slate-400">{hint}</p>
      )}
    </>
  )
}

// ─── Companion: SelectedFileChip ────────────────────────────────────────────

interface SelectedFileChipProps {
  file: File | { name: string; size?: number }
  onRemove?: () => void
}

/**
 * Optional chip to display a file the user has selected. Pair with FileInput
 * when you want to show the current selection inline (e.g., uploaded images,
 * pending uploads). Composes naturally — you can render any number in a list.
 */
export function SelectedFileChip({ file, onRemove }: SelectedFileChipProps) {
  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-slate-100 rounded-md border border-slate-200">
      <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
      <span className="text-xs text-slate-700 truncate max-w-[180px]">{file.name}</span>
      {typeof file.size === 'number' && (
        <span className="text-[11px] text-slate-400">{formatBytes(file.size)}</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
