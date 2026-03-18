'use client'

import { useState, useCallback } from 'react'
import { CheckCircle2, ClipboardList, Loader2 } from 'lucide-react'
import { getAuthHeaders } from '@/lib/api-client'

interface PmChecklistSectionProps {
  ticketId: string
  checklistItems: string[]
  checklistDone: boolean[]
  canEdit: boolean
  onUpdate?: (updatedDone: boolean[]) => void
}

export default function PmChecklistSection({
  ticketId,
  checklistItems,
  checklistDone,
  canEdit,
  onUpdate,
}: PmChecklistSectionProps) {
  // Normalize done array to match items length
  const normalizeArray = (items: string[], done: boolean[]) => {
    const arr = [...done]
    while (arr.length < items.length) arr.push(false)
    return arr.slice(0, items.length)
  }

  const [localDone, setLocalDone] = useState<boolean[]>(() =>
    normalizeArray(checklistItems, checklistDone)
  )
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const completedCount = localDone.filter(Boolean).length
  const totalCount = checklistItems.length
  const allDone = totalCount > 0 && completedCount === totalCount
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleToggle = useCallback(
    async (index: number) => {
      if (!canEdit || loadingIndex !== null) return

      const newValue = !localDone[index]

      // Optimistic update
      const prevDone = [...localDone]
      const updatedDone = [...localDone]
      updatedDone[index] = newValue
      setLocalDone(updatedDone)
      setLoadingIndex(index)
      setError(null)

      try {
        const res = await fetch(`/api/maintenance/tickets/${ticketId}/checklist`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ index, done: newValue }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error?.message ?? 'Failed to update checklist')
        }

        const data = await res.json()
        if (data?.data?.pmChecklistDone) {
          const serverDone = normalizeArray(checklistItems, data.data.pmChecklistDone as boolean[])
          setLocalDone(serverDone)
          onUpdate?.(serverDone)
        } else {
          onUpdate?.(updatedDone)
        }
      } catch (err) {
        // Rollback optimistic update
        setLocalDone(prevDone)
        setError(err instanceof Error ? err.message : 'Failed to update item')
      } finally {
        setLoadingIndex(null)
      }
    },
    [canEdit, loadingIndex, localDone, ticketId, checklistItems, onUpdate]
  )

  if (checklistItems.length === 0) return null

  return (
    <div
      className={`ui-glass p-5 rounded-2xl space-y-4 ${
        !allDone && completedCount > 0 ? 'border border-primary-200' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary-600" />
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">PM Checklist</h3>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            allDone
              ? 'bg-primary-100 text-primary-700'
              : completedCount > 0
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {completedCount}/{totalCount} complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full bg-primary-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {checklistItems.map((item, index) => {
          const isChecked = localDone[index] ?? false
          const isLoading = loadingIndex === index

          return (
            <label
              key={index}
              className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer select-none transition-colors duration-150 ${
                canEdit ? 'hover:bg-primary-50/50' : 'cursor-default'
              } ${isChecked ? 'bg-primary-50/40' : ''}`}
            >
              {/* Checkbox */}
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(index)}
                  disabled={!canEdit || loadingIndex !== null}
                  className="sr-only"
                />
                <div
                  className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded flex items-center justify-center border-2 transition-all duration-150 active:scale-95 ${
                    isChecked
                      ? 'bg-primary-500 border-primary-500'
                      : 'bg-white border-slate-300 hover:border-primary-400'
                  } ${!canEdit ? 'opacity-60' : ''}`}
                  onClick={canEdit ? () => handleToggle(index) : undefined}
                >
                  {isLoading ? (
                    <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
                  ) : isChecked ? (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  ) : null}
                </div>
              </div>

              {/* Label */}
              <span
                className={`text-sm leading-snug transition-all duration-150 ${
                  isChecked
                    ? 'line-through text-slate-400'
                    : 'text-slate-700'
                }`}
              >
                {item}
              </span>
            </label>
          )
        })}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500 px-1">{error}</p>
      )}

      {/* All complete banner */}
      {allDone && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-primary-50 border border-primary-200 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-primary-600 flex-shrink-0" />
          <p className="text-sm font-medium text-primary-800">All items complete — ready for QA</p>
        </div>
      )}
    </div>
  )
}
