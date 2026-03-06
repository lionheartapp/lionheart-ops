'use client'

import { useRef, useEffect, useCallback } from 'react'
import { Search, X } from 'lucide-react'

interface KnowledgeBaseSearchBarProps {
  value: string
  onSearch: (q: string) => void
  placeholder?: string
}

export default function KnowledgeBaseSearchBar({
  value,
  onSearch,
  placeholder = 'Search articles by title, content, or tag...',
}: KnowledgeBaseSearchBarProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearch(q)
      }, 300)
    },
    [onSearch]
  )

  const handleClear = useCallback(() => {
    onSearch('')
  }, [onSearch])

  // Clear on Escape
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleClear()
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <Search className="w-4 h-4 text-gray-400" aria-hidden="true" />
      </div>
      <input
        type="search"
        defaultValue={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="ui-glass w-full pl-9 pr-9 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 transition-shadow"
        aria-label="Search knowledge base"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
