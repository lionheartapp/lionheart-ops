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
    <div className="group relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
        <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" aria-hidden="true" />
      </div>
      <input
        type="search"
        defaultValue={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full h-[60px] pl-13 pr-12 text-base text-gray-800 placeholder:text-gray-400 bg-white border border-gray-200 rounded-full focus:outline-none focus:border-transparent focus:ring-2 focus:ring-blue-400/40 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition-all duration-200"
        aria-label="Search knowledge base"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 flex items-center pr-5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
