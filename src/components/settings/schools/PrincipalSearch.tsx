'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { FloatingInput } from '@/components/ui/FloatingInput'
import { getAuthHeaders as getCookieAuthHeaders } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import type { PrincipalOption, SchoolFormData } from '@/lib/school-utils'
import { OptimizedImage } from '@/components/ui/OptimizedImage'
import {
  normalizeSearchText,
  splitSearchTokens,
  matchesWordPrefixSequence,
} from '@/lib/school-utils'

interface PrincipalSearchProps {
  principalSearch: string
  onPrincipalSearchChange: (value: string) => void
  form: SchoolFormData
  onFormChange: (updater: (prev: SchoolFormData) => SchoolFormData) => void
  onSelectPrincipalId: (id: string | null) => void
  onCreatedInFlow: (created: boolean) => void
}

export default function PrincipalSearch({
  principalSearch,
  onPrincipalSearchChange,
  form,
  onFormChange,
  onSelectPrincipalId,
  onCreatedInFlow,
}: PrincipalSearchProps) {
  const [principalOptions, setPrincipalOptions] = useState<PrincipalOption[]>([])
  const [showPrincipalDropdown, setShowPrincipalDropdown] = useState(false)
  const [searchingPrincipals, setSearchingPrincipals] = useState(false)
  const [creatingPrincipal, setCreatingPrincipal] = useState(false)

  const getAuthHeaders = () => getCookieAuthHeaders()

  // Search for principals by name
  const searchPrincipals = useCallback(async (query: string) => {
    if (!query.trim()) {
      setPrincipalOptions([])
      return
    }

    setSearchingPrincipals(true)
    try {
      const response = await fetch(`/api/settings/principals?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      })
      const data = await response.json()

      if (!response.ok) {
        logger.error({ error: String(data) }, 'Principal search failed')
        setPrincipalOptions([])
      } else {
        setPrincipalOptions(data.data || [])
      }
    } catch (err) {
      logger.error({ error: String(err) }, 'Principal search error')
      setPrincipalOptions([])
    } finally {
      setSearchingPrincipals(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      const normalizedSearch = principalSearch.trim()
      if (normalizedSearch) {
        searchPrincipals(normalizedSearch)
      } else {
        setPrincipalOptions([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [principalSearch, searchPrincipals])

  const rankedPrincipalOptions = useMemo(() => {
    const query = normalizeSearchText(principalSearch)
    if (!query) return principalOptions

    const queryTokens = splitSearchTokens(query)

    const scored = principalOptions
      .map((principal) => {
        const name = normalizeSearchText(principal.name)
        const email = normalizeSearchText(principal.email)

        const exactNamePrefix = name.startsWith(query)
        const phraseInName = name.includes(query)
        const wordPrefixSequence = matchesWordPrefixSequence(principal.name, query)
        const allTokensInName = queryTokens.every((token) => name.includes(token))
        const allTokensInEmail = queryTokens.every((token) => email.includes(token))

        let score = 0
        if (exactNamePrefix) score = 500
        else if (wordPrefixSequence) score = 450
        else if (phraseInName) score = 300
        else if (allTokensInName) score = 200
        else if (allTokensInEmail) score = 100

        return { principal, score }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        // Boost users with "Principal" job title
        const aIsPrincipal = a.principal.jobTitle.toLowerCase().includes('principal') ? 1 : 0
        const bIsPrincipal = b.principal.jobTitle.toLowerCase().includes('principal') ? 1 : 0
        if (bIsPrincipal !== aIsPrincipal) return bIsPrincipal - aIsPrincipal
        return b.score - a.score || a.principal.name.localeCompare(b.principal.name)
      })

    const strictPrefixMatches = scored.filter((entry) => entry.score >= 450)
    if (queryTokens.length >= 2 && strictPrefixMatches.length > 0) {
      return strictPrefixMatches.map((entry) => entry.principal)
    }

    return scored.map((entry) => entry.principal)
  }, [principalOptions, principalSearch])

  // Create a new principal
  const createNewPrincipal = async () => {
    if (!principalSearch.trim()) return

    setCreatingPrincipal(true)
    try {
      const response = await fetch('/api/settings/principals', {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: principalSearch.trim(),
          phone: form.principalPhone || null,
          phoneExt: form.principalPhoneExt || null,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error?.message || 'Failed to create principal')
      }

      // Update form with the newly created principal
      const principal = data.data
      onFormChange((prev) => ({
        ...prev,
        principalName: principal.name,
        principalEmail: principal.email,
        principalPhone: principal.phone || '',
      }))
      onSelectPrincipalId(principal.id)
      onCreatedInFlow(true)
      onPrincipalSearchChange(principal.name)
      setShowPrincipalDropdown(false)
      setPrincipalOptions([])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create principal'
      logger.error({ error: message }, 'Create principal error')
    } finally {
      setCreatingPrincipal(false)
    }
  }

  // Select an existing principal
  const selectPrincipal = (principal: PrincipalOption) => {
    onFormChange((prev) => ({
      ...prev,
      principalName: principal.name,
      principalEmail: principal.email,
      principalPhone: principal.phone || '',
    }))
    onSelectPrincipalId(principal.id)
    onCreatedInFlow(false)
    onPrincipalSearchChange(principal.name)
    setShowPrincipalDropdown(false)
    setPrincipalOptions([])
  }

  return (
    <div className="relative">
      <div className="relative">
        <FloatingInput
          id="sm-principalName"
          label="Name"
          type="text"
          className="pr-10"
          value={principalSearch}
          onChange={(e) => {
            const value = e.target.value
            onPrincipalSearchChange(value)
            onSelectPrincipalId(null)
            onCreatedInFlow(false)
            onFormChange((prev) => ({ ...prev, principalName: value }))
            setShowPrincipalDropdown(true)
          }}
          onFocus={() => setShowPrincipalDropdown(true)}
          disabled={creatingPrincipal}
        />
        {showPrincipalDropdown && (
          <button
            type="button"
            onClick={() => setShowPrincipalDropdown(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {showPrincipalDropdown && (
        <div className="absolute z-dropdown w-full mt-1 ui-glass-dropdown">
          {searchingPrincipals ? (
            <div className="px-4 py-2 text-sm text-slate-500">Searching...</div>
          ) : rankedPrincipalOptions.length > 0 ? (
            <>
              {rankedPrincipalOptions.map((principal) => (
                <button
                  key={principal.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectPrincipal(principal) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 transition text-left"
                >
                  {principal.avatar ? (
                    <OptimizedImage src={principal.avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-slate-100 text-xs font-bold flex items-center justify-center text-slate-600 flex-shrink-0">
                      {principal.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{principal.name}</span>
                      {principal.jobTitle && principal.jobTitle.toLowerCase().includes('principal') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">Principal</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{principal.email}</div>
                  </div>
                </button>
              ))}
              <div className="border-t border-slate-200" />
            </>
          ) : null}

          {principalSearch.trim() && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); createNewPrincipal() }}
              disabled={creatingPrincipal}
              className="w-full text-left px-4 py-2.5 hover:bg-green-50 transition text-green-600 font-medium"
            >
              {creatingPrincipal ? '+ Creating...' : `+ Add new principal: "${principalSearch}"`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
