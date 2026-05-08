'use client'

/**
 * RichTextEditor — Tiptap-based rich text editor for messaging.
 *
 * Features: bold, italic, underline, strikethrough, links, ordered/unordered
 * lists, blockquotes, code, code blocks. Used by Composer and inline edit.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import { createMentionSuggestion } from './MentionSuggestion'
import { splitListItem } from '@tiptap/pm/schema-list'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Code,
  Code2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RichTextEditorProps {
  /** Initial HTML content */
  content?: string
  /** Placeholder text */
  placeholder?: string
  /** Called on every content change with HTML string */
  onChange?: (html: string) => void
  /** Called when user presses Enter (without Shift) */
  onSubmit?: () => void
  /** Called on any keypress — for typing indicators */
  onTyping?: () => void
  /** Whether the editor should autofocus on mount */
  autoFocus?: boolean
  /** Disable editing */
  disabled?: boolean
  /** Compact mode — less padding, no min height */
  compact?: boolean
  /** Called with the editor instance so the parent can insert content */
  onEditorReady?: (editor: { insertContent: (text: string) => void }) => void
  /** Channel ID — enables @mentions scoped to channel members */
  channelId?: string
  /** Current user ID — excluded from @mention suggestions */
  currentUserId?: string
}

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void
  isActive?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
        isActive
          ? 'bg-slate-200 text-slate-800'
          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
      }`}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  )
}

function ToolbarSep() {
  return <div className="w-px h-4 bg-slate-200 mx-0.5" />
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RichTextEditor({
  content = '',
  placeholder = 'Type a message...',
  onChange,
  onSubmit,
  onTyping,
  autoFocus = true,
  disabled = false,
  compact = false,
  onEditorReady,
  channelId,
  currentUserId,
}: RichTextEditorProps) {
  const mentionOpenRef = useRef(false)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary-600 underline cursor-pointer' },
      }),
      ...(channelId ? [Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: createMentionSuggestion(channelId, currentUserId, mentionOpenRef),
      })] : []),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable: !disabled,
    immediatelyRender: false,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none ${compact ? 'min-h-[36px]' : 'min-h-[44px] max-h-[200px]'} overflow-y-auto px-3 py-2`,
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter') {
          // If the mention popup is open, let it handle Enter (select suggestion)
          if (mentionOpenRef.current) return false
          if (!event.shiftKey) {
            // Enter — send message
            if (onSubmit) {
              event.preventDefault()
              onSubmit()
              return true
            }
          } else {
            // Shift+Enter — check if inside a list, split the list item
            const { state } = view
            const { $from } = state.selection
            for (let depth = $from.depth; depth > 0; depth--) {
              const nodeName = $from.node(depth).type.name
              if (['bulletList', 'orderedList', 'listItem'].includes(nodeName)) {
                const listItemType = state.schema.nodes.listItem
                if (listItemType) {
                  event.preventDefault()
                  splitListItem(listItemType)(state, view.dispatch)
                  return true
                }
              }
            }
            // Not in a list — default Shift+Enter (new line)
            return false
          }
        }
        return false
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getHTML())
      onTyping?.()
    },
  })

  // Expose insertContent to parent
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady({ insertContent: (text: string) => editor.chain().focus().insertContent(text).run() })
    }
  }, [editor, onEditorReady])

  // Sync content from outside (e.g. clearing after send)
  useEffect(() => {
    if (editor && content === '' && editor.getHTML() !== '<p></p>') {
      editor.commands.clearContent()
    }
  }, [content, editor])

  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const linkInputRef = useRef<HTMLInputElement>(null)

  const openLinkInput = useCallback(() => {
    if (!editor) return
    // Pre-fill if there's an existing link
    const existing = editor.getAttributes('link').href
    setLinkUrl(existing || '')
    setShowLinkInput(true)
    setTimeout(() => linkInputRef.current?.focus(), 50)
  }, [editor])

  const applyLink = useCallback(() => {
    if (!editor) return
    if (linkUrl.trim()) {
      const url = linkUrl.trim().startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }, [editor, linkUrl])

  if (!editor) return null

  return (
    <div className="border border-slate-200 rounded-xl bg-white focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (Cmd+B)"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (Cmd+I)"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline (Cmd+U)"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarSep />

        <ToolbarButton
          onClick={openLinkInput}
          isActive={editor.isActive('link') || showLinkInput}
          title="Add link"
        >
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarSep />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarSep />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="Inline code"
        >
          <Code className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          title="Code block"
        >
          <Code2 className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Inline link input */}
      {showLinkInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/50">
          <LinkIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {/* eslint-disable-next-line no-restricted-syntax -- Inline link input with custom keyboard handling */}
          <input
            ref={linkInputRef}
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink() }
              if (e.key === 'Escape') { setShowLinkInput(false); setLinkUrl(''); editor?.chain().focus().run() }
            }}
            placeholder="Paste or type a URL..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); applyLink() }}
            className="px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 cursor-pointer transition-colors"
          >
            Apply
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setShowLinkInput(false); setLinkUrl(''); editor?.chain().focus().run() }}
            className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  )
}

/**
 * Extract plain text from Tiptap HTML for preview/notification purposes.
 */
export function htmlToPlainText(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '')
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}
