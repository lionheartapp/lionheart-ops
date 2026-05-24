'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { SearchInput } from '@/components/ui/SearchInput'

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
  const [localValue, setLocalValue] = useState(value)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value
      setLocalValue(q)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearch(q)
      }, 300)
    },
    [onSearch]
  )

  const handleClear = useCallback(() => {
    setLocalValue('')
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
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <SearchInput
      value={localValue}
      onChange={handleChange}
      onClear={handleClear}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className="max-w-[768px] h-[60px] rounded-full px-5 text-base focus-within:border-transparent focus-within:ring-2 focus-within:ring-blue-400/40 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
      aria-label="Search knowledge base"
    />
  )
}
