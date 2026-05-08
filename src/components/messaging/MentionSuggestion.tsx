'use client'

/**
 * MentionSuggestion — @mention dropdown for the Tiptap editor.
 *
 * When the user types "@" followed by characters, this fetches matching users
 * from /api/messaging/users and renders a dropdown list. Selecting a user
 * inserts a styled mention node into the editor.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  type MutableRefObject,
} from 'react'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MentionUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
}

// ---------------------------------------------------------------------------
// Suggestion list component (rendered inside the popup)
// ---------------------------------------------------------------------------

interface SuggestionListProps {
  items: MentionUser[]
  command: (item: { id: string; label: string }) => void
}

interface SuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

const SuggestionList = forwardRef<SuggestionListRef, SuggestionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    // Reset selection when items change
    useEffect(() => setSelectedIndex(0), [items])

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index]
        if (!item) return
        const label = [item.firstName, item.lastName].filter(Boolean).join(' ') || item.email
        command({ id: item.id, label })
      },
      [items, command],
    )

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm text-slate-400">
          No users found
        </div>
      )
    }

    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden max-h-[240px] overflow-y-auto">
        {items.map((item, index) => {
          const name = [item.firstName, item.lastName].filter(Boolean).join(' ') || item.email
          const initials = name
            .split(' ')
            .map((p) => p[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase()

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectItem(index)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors ${
                index === selectedIndex ? 'bg-primary-50' : 'hover:bg-slate-50'
              }`}
            >
              <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-slate-200 flex items-center justify-center">
                {item.avatar ? (
                  <img src={item.avatar} alt={name} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <span className="text-[10px] font-medium text-slate-500">{initials}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{name}</p>
                {item.firstName && (
                  <p className="text-xs text-slate-400 truncate">{item.email}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    )
  },
)

SuggestionList.displayName = 'SuggestionList'

// ---------------------------------------------------------------------------
// Suggestion config for Tiptap Mention extension
// ---------------------------------------------------------------------------

export function createMentionSuggestion(
  channelId: string,
  currentUserId?: string,
  mentionOpenRef?: MutableRefObject<boolean>,
): Omit<SuggestionOptions<MentionUser>, 'editor'> {
  return {
  items: async ({ query }) => {
    try {
      // Fetch only members of this channel, then filter by query client-side
      const res = await fetch(`/api/messaging/channels/${channelId}/members`, {
        credentials: 'include',
      })
      if (!res.ok) return []
      const json = await res.json()
      const members: MentionUser[] = (json.data ?? [])
        .filter((m: { userId: string }) => m.userId !== currentUserId)
        .map((m: { userId: string; user: { firstName: string | null; lastName: string | null; email: string; avatar: string | null } }) => ({
        id: m.userId,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
        avatar: m.user.avatar,
      }))
      if (!query) return members.slice(0, 8)
      const q = query.toLowerCase()
      return members
        .filter((m) => {
          const name = [m.firstName, m.lastName].filter(Boolean).join(' ').toLowerCase()
          return name.includes(q) || m.email.toLowerCase().includes(q)
        })
        .slice(0, 8)
    } catch {
      return []
    }
  },

  render: () => {
    let renderer: ReactRenderer<SuggestionListRef> | null = null
    let popup: HTMLDivElement | null = null

    return {
      onStart: (props: SuggestionProps<MentionUser>) => {
        if (mentionOpenRef) mentionOpenRef.current = true
        renderer = new ReactRenderer(SuggestionList, {
          props,
          editor: props.editor,
        })

        popup = document.createElement('div')
        popup.style.position = 'absolute'
        popup.style.zIndex = '50'
        popup.appendChild(renderer.element)
        document.body.appendChild(popup)

        updatePosition(props, popup)
      },

      onUpdate: (props: SuggestionProps<MentionUser>) => {
        renderer?.updateProps(props)
        if (popup) updatePosition(props, popup)
      },

      onKeyDown: (props: { event: KeyboardEvent }) => {
        if (props.event.key === 'Escape') {
          popup?.remove()
          popup = null
          renderer?.destroy()
          renderer = null
          return true
        }
        return renderer?.ref?.onKeyDown(props) ?? false
      },

      onExit: () => {
        if (mentionOpenRef) mentionOpenRef.current = false
        popup?.remove()
        popup = null
        renderer?.destroy()
        renderer = null
      },
    }
  },
  }
}

// Position the popup above the cursor
function updatePosition(props: SuggestionProps<MentionUser>, popup: HTMLDivElement) {
  const { clientRect } = props
  if (!clientRect) return
  const rect = typeof clientRect === 'function' ? clientRect() : clientRect
  if (!rect) return

  popup.style.left = `${rect.left + window.scrollX}px`
  popup.style.top = `${rect.top + window.scrollY - 8}px`
  popup.style.transform = 'translateY(-100%)'
}
