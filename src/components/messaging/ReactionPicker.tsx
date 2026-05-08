'use client'

/**
 * ReactionPicker — compact grid of common reaction emojis.
 *
 * Shows 16 popular emojis for quick selection. A "more" button opens the
 * full EmojiPicker for access to the complete emoji set.
 */

import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal } from 'lucide-react'
import EmojiPicker from './EmojiPicker'

interface ReactionPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

const COMMON_EMOJIS = [
  '\u{1F44D}', // thumbs up
  '\u{2764}\u{FE0F}', // heart
  '\u{1F602}', // laughing
  '\u{1F525}', // fire
  '\u{1F440}', // eyes
  '\u{1F4AF}', // 100
  '\u{1F389}', // party
  '\u{1F914}', // thinking
  '\u{1F44F}', // clap
  '\u{1F680}', // rocket
  '\u{2705}', // check
  '\u{1F64F}', // folded hands
  '\u{1F60D}', // heart eyes
  '\u{1F62E}', // surprised
  '\u{1F4AA}', // flexed bicep
  '\u{1F64C}', // raised hands
]

export default function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showFullPicker, setShowFullPicker] = useState(false)

  // Click-outside handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (showFullPicker) {
    return (
      <div ref={containerRef}>
        <EmojiPicker onSelect={onSelect} onClose={onClose} />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="bg-white border border-slate-200 rounded-xl shadow-lg p-2 w-[276px]"
    >
      <div className="grid grid-cols-8 gap-1">
        {COMMON_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 cursor-pointer transition-colors duration-200 text-lg"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="border-t border-slate-100 mt-1.5 pt-1.5">
        <button
          type="button"
          onClick={() => setShowFullPicker(true)}
          className="flex items-center gap-1.5 w-full px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700 cursor-pointer transition-colors duration-200"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
          More emojis
        </button>
      </div>
    </div>
  )
}
