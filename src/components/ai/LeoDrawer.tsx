'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ChatPanel from './ChatPanel'
import type { ImageAttachment } from '@/lib/types/assistant'

interface LeoOpenDetail {
  prompt?: string
  images?: ImageAttachment[]
}

/**
 * Global Leo AI assistant drawer.
 * Listens for `open-leo-drawer` events (fired from sidebar button)
 * and slides in from the right with the ChatPanel in floating mode.
 */
export default function LeoDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null)
  const [initialImages, setInitialImages] = useState<ImageAttachment[] | null>(null)
  const [promptKey, setPromptKey] = useState(0)

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const prompt = (event as CustomEvent<LeoOpenDetail>).detail?.prompt
      const images = (event as CustomEvent<LeoOpenDetail>).detail?.images
      if (prompt) {
        setInitialPrompt(prompt)
        setInitialImages(images ?? null)
        setPromptKey((key) => key + 1)
      } else {
        setInitialPrompt(null)
        setInitialImages(null)
      }
      setIsOpen(true)
    }
    window.addEventListener('open-leo-drawer', handleOpen)
    return () => window.removeEventListener('open-leo-drawer', handleOpen)
  }, [])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:right-4 sm:top-4 sm:bottom-4 sm:max-w-md bg-white shadow-2xl z-50 flex flex-col sm:rounded-2xl overflow-hidden"
          >
            <ChatPanel
              variant="embedded"
              onClose={() => setIsOpen(false)}
              initialPrompt={initialPrompt}
              initialImages={initialImages}
              initialPromptKey={promptKey}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
