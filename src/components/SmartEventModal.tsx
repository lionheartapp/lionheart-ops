'use client'

import { useState, FormEvent } from 'react'

type SmartEventModalProps = {
  onClose: () => void
}

export default function SmartEventModal({ onClose }: SmartEventModalProps) {
  const [input, setInput] = useState('')
  const [stage, setStage] = useState<'input' | 'processing' | 'done'>('input')
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStage('processing')

    try {
      const res = await fetch('/api/draft-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-org-id': orgId || '',
        },
        body: JSON.stringify({ title: input }),
      })

      const json = await res.json()
      if (json.ok) {
        setStage('done')
        setTimeout(() => onClose(), 1500)
      }
    } catch (err) {
      console.error(err)
      setStage('input')
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white">Smart Event Assistant</h2>
        <p className="mt-2 text-sm text-zinc-400">Describe your event in plain text or voice</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Schedule gym Friday 3pm for basketball practice"
            className="h-32 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            disabled={stage !== 'input'}
          />

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
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
