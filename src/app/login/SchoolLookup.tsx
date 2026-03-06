'use client'

import { useState } from 'react'
import { ArrowRight, Search, AlertCircle } from 'lucide-react'

export default function SchoolLookup() {
  const [slug, setSlug] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = slug.trim().toLowerCase().replace(/\s+/g, '-')
    if (!cleaned) return

    setChecking(true)
    setError('')

    try {
      const res = await fetch(`/api/organizations/slug-check?slug=${encodeURIComponent(cleaned)}`)
      const data = await res.json()

      if (data.ok && data.data.valid === false) {
        // Slug exists (taken = an org exists with this slug) — redirect to it
        window.location.href = `${window.location.protocol}//${cleaned}.${window.location.host.replace(/^[^.]+\./, '')}/login`
      } else {
        setError('No school found with that URL. Check the spelling and try again.')
      }
    } catch {
      // If slug-check fails, try navigating directly
      setError('Could not verify. Check the URL and try again.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setError('') }}
            placeholder="your-school"
            autoFocus
            className="w-full pl-10 pr-4 py-3.5 text-sm bg-zinc-800/80 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/30 transition-colors"
          />
        </div>

        <p className="text-xs text-zinc-500">
          Your school URL looks like{' '}
          <span className="text-zinc-400 font-mono">
            {slug.trim().toLowerCase().replace(/\s+/g, '-') || 'your-school'}.lionheartapp.com
          </span>
        </p>

        {error && (
          <div className="flex items-start gap-2 text-left px-3 py-2.5 bg-red-950/40 border border-red-900/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!slug.trim() || checking}
          className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-white bg-zinc-700 rounded-xl hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {checking ? (
            <>
              <div className="w-4 h-4 border-2 border-zinc-400 border-t-white rounded-full animate-spin" />
              Looking up...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          Don&apos;t know your school URL? Contact your school administrator.
        </p>
      </div>
    </div>
  )
}
