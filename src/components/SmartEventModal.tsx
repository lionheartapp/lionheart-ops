'use client'

import { useState, FormEvent } from 'react'
import { fetchApi } from '@/lib/api-client'
import { logger } from '@/lib/logger'

type SmartEventModalProps = {
  onClose: () => void
}

export default function SmartEventModal({ onClose }: SmartEventModalProps) {
  const [input, setInput] = useState('')
  const [stage, setStage] = useState<'input' | 'processing' | 'done'>('input')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStage('processing')

    try {
      await fetchApi<{ id: string }>('/api/draft-events', {
        method: 'POST',
        body: JSON.stringify({ title: input }),
      })
      setStage('done')
      setTimeout(() => onClose(), 1500)
    } catch (err) {
      logger.error({ error: String(err) }, 'Smart event creation failed')
      setStage('input')
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer" onClick={onClose} role="presentation">
      <div className="w-full max-w-lg rounded-lg bg-slate-900 p-6 shadow-heavy cursor-auto" role="dialog" aria-modal="true" aria-labelledby="smart-event-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="smart-event-title" className="text-xl font-bold text-white">Smart Event Assistant</h2>
        <p className="mt-2 text-sm text-slate-400">Describe your event in plain text or voice</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Schedule gym Friday 3pm for basketball practice"
            aria-label="Describe your event"
            className="h-32 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            disabled={stage !== 'input'}
          />

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
              disabled={stage === 'processing'}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              disabled={stage !== 'input' || !input.trim()}
            >
              {stage === 'input' && 'Create Draft'}
              {stage === 'processing' && 'Processing...'}
              {stage === 'done' && 'Done ✓'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
