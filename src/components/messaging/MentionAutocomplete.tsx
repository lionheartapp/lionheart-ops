'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useFilteredMembers, type OrgMember } from '@/lib/hooks/useOrgMembers'

interface MentionAutocompleteProps {
  query: string
  position: { top: number; left: number }
  onSelect: (user: { id: string; name: string }) => void
  onClose: () => void
}

interface SpecialMention {
  id: string
  name: string
  description: string
}

const SPECIAL_MENTIONS: SpecialMention[] = [
  { id: '__channel', name: '@channel', description: 'Notify everyone in this channel' },
  { id: '__here', name: '@here', description: 'Notify active members' },
  { id: '__team', name: '@team', description: 'Notify the whole team' },
]

function getFullName(member: OrgMember): string {
  return `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || member.email
}

export default function MentionAutocomplete({
  query,
  position,
  onSelect,
  onClose,
}: MentionAutocompleteProps) {
  const members = useFilteredMembers(query)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter special mentions by query
  const filteredSpecials = SPECIAL_MENTIONS.filter((s) => {
    if (!query) return true
    return s.name.toLowerCase().includes(query.toLowerCase())
  })

  // Combine results: specials first, then members
  const allItems = [
    ...filteredSpecials.map((s) => ({ type: 'special' as const, item: s })),
    ...members.map((m) => ({ type: 'member' as const, item: m })),
  ].slice(0, 6)

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleSelect = useCallback(
    (index: number) => {
      const entry = allItems[index]
      if (!entry) return

      if (entry.type === 'special') {
        const special = entry.item as SpecialMention
        onSelect({ id: special.id, name: special.name })
      } else {
        const member = entry.item as OrgMember
        onSelect({ id: member.id, name: getFullName(member) })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allItems, onSelect],
  )

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % allItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + allItems.length) % allItems.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        handleSelect(selectedIndex)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [allItems.length, selectedIndex, handleSelect, onClose])

  if (allItems.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="absolute z-50 ui-glass-dropdown rounded-xl shadow-lg border border-slate-200 py-1 w-64 max-h-[280px] overflow-y-auto"
      style={{ bottom: position.top, left: position.left }}
    >
      {allItems.map((entry, index) => {
        if (entry.type === 'special') {
          const special = entry.item as SpecialMention
          return (
            <button
              key={special.id}
              type="button"
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer ${
                index === selectedIndex ? 'bg-indigo-50' : 'hover:bg-slate-50'
              }`}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(index)
              }}
            >
              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-medium">
                @
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {special.name}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {special.description}
                </div>
              </div>
            </button>
          )
        }

        const member = entry.item as OrgMember
        return (
          <button
            key={member.id}
            type="button"
            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer ${
              index === selectedIndex ? 'bg-indigo-50' : 'hover:bg-slate-50'
            }`}
            onMouseEnter={() => setSelectedIndex(index)}
            onMouseDown={(e) => {
              e.preventDefault()
              handleSelect(index)
            }}
          >
            {member.avatar ? (
              <img
                src={member.avatar}
                alt=""
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-medium">
                {(member.firstName?.[0] ?? member.email[0] ?? '?').toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-900 truncate">
                {getFullName(member)}
              </div>
              <div className="text-xs text-slate-400 truncate">
                {member.email}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
