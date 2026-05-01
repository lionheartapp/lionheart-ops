'use client'

import { useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Bold, Italic, Link2, Code, Heading2, List, ListOrdered, Eye, EyeOff } from 'lucide-react'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  id?: string
  required?: boolean
}

type FormatAction = 'bold' | 'italic' | 'link' | 'code' | 'heading' | 'ul' | 'ol'

const TOOLBAR_BUTTONS: { action: FormatAction; icon: typeof Bold; label: string }[] = [
  { action: 'bold', icon: Bold, label: 'Bold' },
  { action: 'italic', icon: Italic, label: 'Italic' },
  { action: 'heading', icon: Heading2, label: 'Heading' },
  { action: 'link', icon: Link2, label: 'Link' },
  { action: 'code', icon: Code, label: 'Code' },
  { action: 'ul', icon: List, label: 'Bullet list' },
  { action: 'ol', icon: ListOrdered, label: 'Numbered list' },
]

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write in Markdown...',
  rows = 12,
  id,
  required,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showPreview, setShowPreview] = useState(false)

  const insertFormat = useCallback(
    (action: FormatAction) => {
      const ta = textareaRef.current
      if (!ta) return

      const start = ta.selectionStart
      const end = ta.selectionEnd
      const selected = value.slice(start, end)

      let before = ''
      let after = ''
      let replacement = selected

      switch (action) {
        case 'bold':
          before = '**'
          after = '**'
          if (!selected) replacement = 'bold text'
          break
        case 'italic':
          before = '*'
          after = '*'
          if (!selected) replacement = 'italic text'
          break
        case 'heading':
          before = '## '
          if (!selected) replacement = 'Heading'
          break
        case 'link':
          if (selected) {
            before = '['
            after = '](url)'
          } else {
            replacement = '[link text](url)'
          }
          break
        case 'code':
          if (selected.includes('\n')) {
            before = '```\n'
            after = '\n```'
          } else {
            before = '`'
            after = '`'
            if (!selected) replacement = 'code'
          }
          break
        case 'ul':
          replacement = selected
            ? selected.split('\n').map((line) => `- ${line}`).join('\n')
            : '- Item'
          break
        case 'ol':
          replacement = selected
            ? selected.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n')
            : '1. Item'
          break
      }

      const newValue = value.slice(0, start) + before + replacement + after + value.slice(end)
      onChange(newValue)

      // Restore cursor position after React re-renders
      requestAnimationFrame(() => {
        const cursorPos = start + before.length + replacement.length
        ta.focus()
        ta.setSelectionRange(cursorPos, cursorPos)
      })
    },
    [value, onChange],
  )

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary-300 focus-within:border-primary-400 transition-shadow">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
        {TOOLBAR_BUTTONS.map(({ action, icon: Icon, label }) => (
          <button
            key={action}
            type="button"
            onClick={() => insertFormat(action)}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            title={label}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}

        <div className="h-4 w-px bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            showPreview ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
          }`}
          title={showPreview ? 'Hide preview' : 'Show preview'}
        >
          {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Editor + Preview */}
      <div className={showPreview ? 'grid grid-cols-2 divide-x divide-slate-200' : ''}>
        <textarea
          ref={textareaRef}
          id={id}
          className="w-full px-3 py-2.5 font-mono text-xs leading-relaxed resize-none focus:outline-none bg-white"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
        />

        {showPreview && (
          <div className="px-4 py-3 overflow-y-auto bg-white" style={{ maxHeight: `${rows * 1.625 + 1.25}rem` }}>
            {value ? (
              <div className="prose prose-sm prose-slate max-w-none">
                <ReactMarkdown>{value}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-xs text-slate-300 italic">Preview will appear here...</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
