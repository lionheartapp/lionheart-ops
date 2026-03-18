'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Search, X, ChevronRight, Tag } from 'lucide-react'
import { dropdownVariants } from '@/lib/animations'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetSearchResult {
  id: string
  assetNumber: string
  name: string
  category: string | null
  building: { id: string; name: string } | null
  area: { id: string; name: string } | null
  room: { id: string; roomNumber: string; displayName: string | null } | null
  buildingId: string | null
  areaId: string | null
  roomId: string | null
}

interface StepAssetProps {
  assetId: string | null
  assetLabel: string
  onSelect: (asset: AssetSearchResult) => void
  onClear: () => void
  onSkip: () => void
  // Pre-fill from query params on mount
  initialAssetId?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  CUSTODIAL_BIOHAZARD: 'Custodial / Biohazard',
  IT_AV: 'IT / AV',
  GROUNDS: 'Grounds',
  OTHER: 'Other',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StepAsset({
  assetId,
  assetLabel,
  onSelect,
  onClear,
  onSkip,
  initialAssetId,
}: StepAssetProps) {
  const [query, setQuery] = useState('')
  const [manualNumber, setManualNumber] = useState('')
  const [results, setResults] = useState<AssetSearchResult[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [manualError, setManualError] = useState('')
  const [manualLookupLoading, setManualLookupLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasAutoLoaded = useRef(false)

  const hasSelection = !!assetId

  // Auto-load asset if initialAssetId provided (from "Report Issue" button)
  useEffect(() => {
    if (!initialAssetId || hasAutoLoaded.current) return
    hasAutoLoaded.current = true

    const fetchAsset = async () => {
      try {
        const res = await fetch(`/api/maintenance/assets/${initialAssetId}`, {
          headers: getAuthHeaders(),
        })
        if (!res.ok) return
        const json = await res.json()
        if (json.ok && json.data) {
          onSelect(json.data as AssetSearchResult)
        }
      } catch {
        // Silently fail — user can search manually
      }
    }
    fetchAsset()
  }, [initialAssetId, onSelect])

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setQuery(value)
    setIsDropdownOpen(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/maintenance/assets?search=${encodeURIComponent(value)}&limit=10`, {
          headers: getAuthHeaders(),
        })
        const json = await res.json()
        if (json.ok) {
          setResults(json.data.assets || [])
        }
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300)
  }, [])

  // Manual AST-XXXX lookup
  const handleManualLookup = async () => {
    setManualError('')
    if (!manualNumber.trim()) return

    // Normalize: add AST- prefix if user just typed digits
    const normalized = manualNumber.trim().toUpperCase().startsWith('AST-')
      ? manualNumber.trim().toUpperCase()
      : `AST-${manualNumber.trim()}`

    setManualLookupLoading(true)
    try {
      const res = await fetch(`/api/maintenance/assets?search=${encodeURIComponent(normalized)}&limit=5`, {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (json.ok && json.data?.assets?.length > 0) {
        // Find exact match on assetNumber
        const exact = json.data.assets.find(
          (a: AssetSearchResult) => a.assetNumber === normalized
        )
        if (exact) {
          onSelect(exact)
          setManualNumber('')
        } else {
          setManualError(`Asset ${normalized} not found`)
        }
      } else {
        setManualError(`Asset ${normalized} not found`)
      }
    } catch {
      setManualError('Failed to look up asset')
    } finally {
      setManualLookupLoading(false)
    }
  }

  const handleSelect = (asset: AssetSearchResult) => {
    onSelect(asset)
    setQuery('')
    setResults([])
    setIsDropdownOpen(false)
  }

  const handleClear = () => {
    onClear()
    setQuery('')
    setResults([])
  }

  // Build location label for a result
  function getLocationLabel(asset: AssetSearchResult): string {
    const parts: string[] = []
    if (asset.building?.name) parts.push(asset.building.name)
    if (asset.area?.name) parts.push(asset.area.name)
    if (asset.room?.displayName || asset.room?.roomNumber) {
      parts.push(asset.room.displayName || asset.room.roomNumber)
    }
    return parts.join(' › ')
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Which asset needs attention?</h3>
        <p className="text-sm text-slate-500">Link this ticket to specific equipment (optional)</p>
      </div>

      {hasSelection ? (
        /* Selected asset card */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="ui-glass rounded-xl p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Package className="w-4 h-4 text-primary-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-mono font-semibold text-primary-700 mb-0.5">{assetLabel}</p>
                <p className="text-sm font-medium text-slate-900 truncate">{assetLabel.split(' — ')[1] || assetLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
              title="Clear asset selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      ) : (
        /* Search input */
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setIsDropdownOpen(true)}
              onBlur={() => setTimeout(() => setIsDropdownOpen(false), 150)}
              placeholder="Search by asset name, number, or make..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent transition-shadow"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <AnimatePresence>
            {isDropdownOpen && results.length > 0 && (
              <motion.div
                key="dropdown"
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute z-50 mt-1.5 w-full ui-glass-dropdown max-h-64 overflow-y-auto"
              >
                {results.map((asset) => {
                  const loc = getLocationLabel(asset)
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onMouseDown={() => handleSelect(asset)}
                      className="w-full text-left px-3 py-2.5 hover:bg-primary-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-primary-700">{asset.assetNumber}</span>
                            {asset.category && (
                              <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                                {CATEGORY_LABELS[asset.category] || asset.category}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-slate-900 truncate">{asset.name}</p>
                          {loc && (
                            <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                              <Tag className="w-3 h-3" />
                              {loc}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                      </div>
                    </button>
                  )
                })}
              </motion.div>
            )}

            {isDropdownOpen && query.trim() && results.length === 0 && !isLoading && (
              <motion.div
                key="no-results"
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute z-50 mt-1.5 w-full ui-glass-dropdown py-4 text-center"
              >
                <p className="text-sm text-slate-500">No assets found for &ldquo;{query}&rdquo;</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Manual AST-XXXX entry */}
      {!hasSelection && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-2">Or enter asset number directly:</p>
          <div className="flex gap-2">
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden flex-1">
              <span className="px-2 py-2 text-xs font-mono text-slate-400 bg-slate-50 border-r border-slate-200">AST-</span>
              <input
                type="text"
                value={manualNumber}
                onChange={(e) => {
                  setManualNumber(e.target.value)
                  setManualError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleManualLookup()
                }}
                placeholder="0001"
                className="flex-1 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none font-mono"
              />
            </div>
            <button
              type="button"
              onClick={handleManualLookup}
              disabled={!manualNumber.trim() || manualLookupLoading}
              className="px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              {manualLookupLoading ? '...' : 'Find'}
            </button>
          </div>
          {manualError && (
            <p className="text-xs text-red-600 mt-1.5">{manualError}</p>
          )}
        </div>
      )}

      {/* Skip button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          Skip — this issue is not related to a specific asset
        </button>
      </div>
    </div>
  )
}
