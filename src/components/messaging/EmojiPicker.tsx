'use client'

import { useEffect, useRef, useState } from 'react'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

interface EmojiData {
  native: string
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [PickerComponent, setPickerComponent] = useState<React.ComponentType<Record<string, unknown>> | null>(null)
  const [emojiData, setEmojiData] = useState<unknown>(null)

  // Dynamic import to reduce bundle size
  useEffect(() => {
    let cancelled = false
    async function loadPicker() {
      const [pickerMod, dataMod] = await Promise.all([
        import('@emoji-mart/react'),
        import('@emoji-mart/data'),
      ])
      if (!cancelled) {
        setPickerComponent(() => pickerMod.default)
        setEmojiData(dataMod.default)
      }
    }
    loadPicker()
    return () => { cancelled = true }
  }, [])

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

  function handleEmojiSelect(emoji: EmojiData) {
    onSelect(emoji.native)
  }

  return (
    <div
      ref={containerRef}
      className="ui-glass-dropdown rounded-xl shadow-lg"
    >
      {PickerComponent && emojiData ? (
        <PickerComponent
          data={emojiData}
          onEmojiSelect={handleEmojiSelect}
          theme="light"
          set="native"
          maxFrequentRows={2}
          previewPosition="none"
          skinTonePosition="none"
        />
      ) : (
        <div className="w-[352px] h-[400px] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
