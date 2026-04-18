'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'
import { PRESET_TEAM_ROLES } from '@/lib/types/event-project'
import DetailDrawer from '@/components/DetailDrawer'
import type { OrgUser, StagedMember } from './people-types'
import { getUserName, getInitials } from './people-types'
import { RolePicker } from './RolePicker'
import { UserSearchDropdown } from './UserSearchDropdown'

interface AddMembersDrawerProps {
  isOpen: boolean
  onClose: () => void
  existingUserIds: string[]
  eventCustomRoles: string[]
  onSubmit: (staged: StagedMember[]) => void
  isSubmitting: boolean
}

export function AddMembersDrawer({
  isOpen,
  onClose,
  existingUserIds,
  eventCustomRoles,
  onSubmit,
  isSubmitting,
}: AddMembersDrawerProps) {
  const [staged, setStaged] = useState<StagedMember[]>([])
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  // IDs that are already on the team OR staged in this session
  const excludeIds = useMemo(() => {
    const set = new Set(existingUserIds)
    for (const s of staged) set.add(s.user.id)
    return set
  }, [existingUserIds, staged])

  // Collect custom roles from staged members + existing event customs
  const allCustomRoles = useMemo(() => {
    const presetSet = new Set<string>(PRESET_TEAM_ROLES)
    const customs = new Set(eventCustomRoles)
    for (const s of staged) {
      if (s.role && !presetSet.has(s.role)) customs.add(s.role)
    }
    return Array.from(customs).sort()
  }, [eventCustomRoles, staged])

  const handleAddUser = (user: OrgUser) => {
    const newMember: StagedMember = { user, role: '', notes: '' }
    setStaged((prev) => [...prev, newMember])
    setExpandedIdx(staged.length) // expand the newly added one
  }

  const handleRemoveStaged = (idx: number) => {
    setStaged((prev) => prev.filter((_, i) => i !== idx))
    setExpandedIdx(null)
  }

  const handleUpdateStaged = (idx: number, updates: Partial<StagedMember>) => {
    setStaged((prev) => prev.map((s, i) => (i === idx ? { ...s, ...updates } : s)))
  }

  const allHaveRoles = staged.length > 0 && staged.every((s) => s.role.trim().length > 0)

  const handleSubmit = () => {
    if (!allHaveRoles || isSubmitting) return
    onSubmit(staged)
  }

  const handleClose = useCallback(() => {
    setStaged([])
    setExpandedIdx(null)
    onClose()
  }, [onClose])

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Team Members"
      width="lg"
      footer={
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {staged.length === 0
              ? 'Search to add members'
              : `${staged.length} member${staged.length === 1 ? '' : 's'} staged`}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!allHaveRoles || isSubmitting}
              className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting
                ? 'Adding...'
                : `Add ${staged.length || ''} Member${staged.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* User search dropdown */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Search for members to add
          </label>
          <UserSearchDropdown
            excludeIds={excludeIds}
            onSelect={handleAddUser}
          />
        </div>

        {/* Staged members list */}
        {staged.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">
              Members to add ({staged.length})
            </p>
            <AnimatePresence initial={false}>
              {staged.map((s, idx) => (
                <motion.div
                  key={s.user.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  {/* Collapsed row */}
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  >
                    {s.user.avatar ? (
                      <img src={s.user.avatar} alt={getUserName(s.user)} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                        {getInitials(s.user)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{getUserName(s.user)}</p>
                      {s.role ? (
                        <span className="text-xs text-blue-600">{s.role}</span>
                      ) : (
                        <span className="text-xs text-amber-600">Select a role</span>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        expandedIdx === idx ? 'rotate-180' : ''
                      }`}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveStaged(idx) }}
                      className="p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {expandedIdx === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-gray-100 px-3 py-3 space-y-3 bg-slate-50/50"
                      >
                        <RolePicker
                          value={s.role}
                          onChange={(role) => handleUpdateStaged(idx, { role })}
                          eventCustomRoles={allCustomRoles}
                        />
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Notes <span className="text-slate-400 font-normal">(optional)</span>
                          </label>
                          <textarea
                            value={s.notes}
                            onChange={(e) => handleUpdateStaged(idx, { notes: e.target.value })}
                            placeholder="Responsibilities, notes..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all resize-none"
                            maxLength={500}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </DetailDrawer>
  )
}
