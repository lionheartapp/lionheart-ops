'use client'

/**
 * ReactionBar — displays emoji reaction pills below a message.
 *
 * Each pill shows emoji + count. Clicking toggles that reaction.
 * A small "+" button at the end opens the reaction picker inline.
 */

import { useState, useRef } from 'react'
import { SmilePlus } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { ReactionGroup } from '@/lib/hooks/useReactions'

const EmojiPicker = dynamic(() => import('./EmojiPicker'), { ssr: false })

interface ReactionBarProps {
  reactions: ReactionGroup[]
  messageId: string
  onToggle: (emoji: string) => void
}

export default function ReactionBar({
  reactions,
  messageId,
  onToggle,
}: ReactionBarProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [pickerDropDown, setPickerDropDown] = useState(false)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  // Only show reactions that look like actual emoji (not raw IDs)
  const validReactions = reactions.filter((g) => g.emoji.length <= 4)
  if (validReactions.length === 0) return null

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {validReactions.map((group) => (
        <button
          key={`${messageId}-${group.emoji}`}
          type="button"
          onClick={() => onToggle(group.emoji)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer transition-colors duration-200 border ${
            group.reacted
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
          title={`${group.count} ${group.count === 1 ? 'reaction' : 'reactions'}`}
        >
          <span>{group.emoji}</span>
          <span className="font-medium">{group.count}</span>
        </button>
      ))}
      {/* Inline add-reaction button */}
      <div className="relative">
        <button
          ref={addBtnRef}
          type="button"
          onClick={() => {
            if (!showPicker && addBtnRef.current) {
              const rect = addBtnRef.current.getBoundingClientRect()
              setPickerDropDown(rect.top < window.innerHeight * 0.4)
            }
            setShowPicker((prev) => !prev)
          }}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 hover:bg-slate-50 cursor-pointer transition-colors duration-200"
          title="Add reaction"
        >
          <SmilePlus className="w-3.5 h-3.5" />
        </button>
        {showPicker && (
          <div className={`absolute left-0 z-50 ${pickerDropDown ? 'top-full mt-1' : 'bottom-full mb-1'}`}>
            <EmojiPicker
              onSelect={(emoji: string) => {
                onToggle(emoji)
                setShowPicker(false)
              }}
              onClose={() => setShowPicker(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
