'use client'

/**
 * GifPicker — search and browse GIFs via server-side GIPHY proxy.
 *
 * Shows trending GIFs by default, with a search bar at the top.
 * Clicking a GIF calls onSelect with the GIF URL.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'

interface GifPickerProps {
  onSelect: (gifUrl: string, width: number, height: number) => void
  onClose: () => void
}

interface GifItem {
  id: string
  title: string
  preview: string
  original: string
  width: number
  height: number
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [search, setSearch] = useState('')
  const [gifs, setGifs] = useState<GifItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Focus search on mount
  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [])

  // Fetch GIFs from our server proxy
  const fetchGifs = useCallback(async (query: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '24' })
      if (query) params.set('q', query)

      const res = await fetch(`/api/messaging/gifs?${params}`, { credentials: 'include' })
      const json = await res.json()

      if (json.ok) {
        setGifs(json.data ?? [])
      } else {
        setError(json.error?.message ?? 'Failed to load GIFs')
        setGifs([])
      }
    } catch {
      setError('Failed to load GIFs')
      setGifs([])
    }
    setLoading(false)
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchGifs(search), search ? 400 : 0)
    return () => clearTimeout(timer)
  }, [search, fetchGifs])

  // Initial trending load
  useEffect(() => { fetchGifs('') }, [fetchGifs])

  return (
    <div
      ref={containerRef}
      className="bg-white border border-slate-200 rounded-xl shadow-lg w-[340px] overflow-hidden"
    >
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <Input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search GIFs..."
          size="sm"
          className="h-auto min-h-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none outline-none placeholder:text-slate-400 focus:ring-0"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* GIF grid */}
      <div className="h-[300px] overflow-y-auto p-2">
        {error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-400 text-center px-4">{error}</p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-400">
              {search ? 'No GIFs found' : 'No trending GIFs'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onSelect(gif.original, gif.width, gif.height)}
                className="relative rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary-400 transition-all group"
              >
                <img
                  src={gif.preview}
                  alt={gif.title}
                  loading="lazy"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* GIPHY attribution */}
      <div className="px-3 py-1.5 border-t border-slate-100 flex items-center justify-end">
        <span className="text-[10px] text-slate-300">Powered by GIPHY</span>
      </div>
    </div>
  )
}
