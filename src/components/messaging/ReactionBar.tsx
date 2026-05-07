'use client'

/**
 * ReactionBar — displays emoji reaction pills below a message.
 *
 * Each pill shows emoji + count. If the current user has reacted, the pill
 * gets a highlighted border. Clicking a pill toggles that reaction.
 * A "+" button at the end opens the ReactionPicker for adding new reactions.
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { ReactionGroup } from '@/lib/hooks/useReactions'
import ReactionPicker from './ReactionPicker'

interface ReactionBarProps {
  reactions: ReactionGroup[]
  messageId: string
  onToggle: (emoji: string) => void
  showAddButton?: boolean
}

export default function ReactionBar({
  reactions,
  messageId,
  onToggle,
  showAddButton = false,
}: ReactionBarProps) {
  const [showPicker, setShowPicker] = useState(false)

  const hasReactions = reactions.length > 0
  if (!hasReactions && !showAddButton) return null

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1 relative">
      {reactions.map((group) => (
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

      {/* Add reaction button */}
      {(showAddButton || hasReactions) && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPicker((prev) => !prev)}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer transition-colors duration-200"
            title="Add reaction"
          >
            <Plus className="w-3 h-3" />
          </button>

          {showPicker && (
            <ReactionPicker
              onSelect={(emoji) => {
                onToggle(emoji)
                setShowPicker(false)
              }}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}
