'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useModules } from '@/lib/hooks/useModuleEnabled'
import { Trophy, ChevronDown, ChevronRight, Building2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ModuleDefinition {
  id: string
  name: string
  description: string
  icon: LucideIcon
  color: string
  scope: 'org' | 'campus'
}

interface Campus {
  id: string
  name: string
  isActive: boolean
}

const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    id: 'athletics',
    name: 'Athletics',
    description: 'Manage sports teams, schedules, seasons, and rosters for your athletic programs.',
    icon: Trophy,
    color: '#f59e0b',
    scope: 'campus',
  },
]

async function fetchCampuses(): Promise<Campus[]> {
  const token = localStorage.getItem('auth-token')
  const res = await fetch('/api/settings/campus/campuses', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.ok ? data.data : []
}

async function toggleModule(moduleId: string, enabled: boolean, campusId?: string) {
  const token = localStorage.getItem('auth-token')
  const res = await fetch('/api/modules', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ moduleId, enabled, ...(campusId ? { campusId } : {}) }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error?.message || 'Failed to toggle module')
  }
  return res.json()
}

export default function AddOnsTab() {
  const { data: modules = [], isLoading: modulesLoading } = useModules()
  const { data: campuses = [], isLoading: campusesLoading } = useQuery({
    queryKey: ['campuses'],
    queryFn: fetchCampuses,
    staleTime: 5 * 60 * 1000,
  })
  const queryClient = useQueryClient()
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['athletics']))

  const mutation = useMutation({
    mutationFn: ({ moduleId, enabled, campusId }: { moduleId: string; enabled: boolean; campusId?: string }) =>
      toggleModule(moduleId, enabled, campusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-modules'] })
    },
    onSettled: () => {
      setTogglingKey(null)
    },
  })

  const handleToggle = (moduleId: string, currentlyEnabled: boolean, campusId?: string) => {
    const key = campusId ? `${moduleId}:${campusId}` : moduleId
    setTogglingKey(key)
    mutation.mutate({ moduleId, enabled: !currentlyEnabled, campusId })
  }

  const toggleExpanded = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) {
        next.delete(moduleId)
      } else {
        next.add(moduleId)
      }
      return next
    })
  }

  const isLoading = modulesLoading || campusesLoading

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900">Add-ons</h2>
      <p className="mt-1 text-sm text-gray-500">
        Enable optional modules to extend your workspace.
      </p>
      <div className="h-px bg-gray-200 mt-4 mb-6" />

      {isLoading ? (
        <div className="space-y-4">
          {[1].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                  <div className="h-3 w-64 bg-gray-100 rounded" />
                </div>
                <div className="w-11 h-6 bg-gray-200 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {MODULE_REGISTRY.map((mod) => {
            const Icon = mod.icon
            const enabledCampusIds = modules
              .filter((m) => m.moduleId === mod.id && m.campusId)
              .map((m) => m.campusId as string)
            const isOrgEnabled = modules.some((m) => m.moduleId === mod.id && !m.campusId)
            const hasAnyCampusEnabled = enabledCampusIds.length > 0
            const isExpanded = expandedModules.has(mod.id)
            const activeCampuses = campuses.filter((c) => c.isActive)

            if (mod.scope === 'campus') {
              return (
                <div
                  key={mod.id}
                  className={`rounded-xl border transition-colors ${
                    hasAnyCampusEnabled
                      ? 'border-gray-200 bg-white'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  {/* Module header */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(mod.id)}
                    className="w-full p-5 flex items-center gap-4 text-left"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${mod.color}18` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: mod.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">{mod.name}</h3>
                        {hasAnyCampusEnabled && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {enabledCampusIds.length} campus{enabledCampusIds.length !== 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{mod.description}</p>
                    </div>
                    <div className="flex-shrink-0 text-gray-400">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>
                  </button>

                  {/* Campus sub-toggles */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 pb-4 pt-3">
                      {activeCampuses.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">
                          No campuses configured. Add campuses in Campus settings first.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                            Enable per campus
                          </p>
                          {activeCampuses.map((campus) => {
                            const campusEnabled = enabledCampusIds.includes(campus.id)
                            const toggleKey = `${mod.id}:${campus.id}`
                            const isToggling = togglingKey === toggleKey

                            return (
                              <div
                                key={campus.id}
                                className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                                  campusEnabled ? 'bg-amber-50/50' : 'bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Building2 className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-700">{campus.name}</span>
                                </div>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={campusEnabled}
                                  aria-label={`${campusEnabled ? 'Disable' : 'Enable'} ${mod.name} for ${campus.name}`}
                                  disabled={isToggling}
                                  onClick={() => handleToggle(mod.id, campusEnabled, campus.id)}
                                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    campusEnabled ? 'bg-primary-600' : 'bg-gray-200'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      campusEnabled ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            }

            // Org-scoped module — single toggle (future use)
            const isToggling = togglingKey === mod.id
            return (
              <div
                key={mod.id}
                className={`rounded-xl border p-5 transition-colors ${
                  isOrgEnabled
                    ? 'border-gray-200 bg-white'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${mod.color}18` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: mod.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">{mod.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{mod.description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOrgEnabled}
                    aria-label={`${isOrgEnabled ? 'Disable' : 'Enable'} ${mod.name}`}
                    disabled={isToggling}
                    onClick={() => handleToggle(mod.id, isOrgEnabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isOrgEnabled ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isOrgEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {mutation.isError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {mutation.error instanceof Error ? mutation.error.message : 'Failed to update module'}
        </div>
      )}
    </div>
  )
}
