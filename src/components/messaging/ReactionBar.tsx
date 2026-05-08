'use client'

/**
 * ReactionBar — displays emoji reaction pills below a message.
 *
 * Each pill shows emoji + count. Clicking toggles that reaction.
 * Add-reaction button is in the hover toolbar (MessageBubble), not here.
 */

import type { ReactionGroup } from '@/lib/hooks/useReactions'

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
    </div>
  )
}
