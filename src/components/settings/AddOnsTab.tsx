'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useModules } from '@/lib/hooks/useModuleEnabled'
import { useToast } from '@/components/Toast'
import { Trophy, Wrench, Monitor, Building2, X, Check, Plus, Settings2, Loader2, Info, Users, Shield, MessageSquare } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ModuleDefinition {
  id: string
  name: string
  description: string
  icon: LucideIcon
  color: string
  gradient: string
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
    gradient: 'from-amber-400 to-orange-500',
    scope: 'campus',
  },
  {
    id: 'maintenance',
    name: 'Facilities Management',
    description: 'Maintenance request system with ticket tracking, technician assignments, and preventive maintenance scheduling.',
    icon: Wrench,
    color: '#059669',
    gradient: 'from-emerald-500 to-teal-600',
    scope: 'campus',
  },
  {
    id: 'it-helpdesk',
    name: 'IT Help Desk',
    description: 'IT support ticketing with Kanban board, technician assignment, magic links for substitute teachers, and activity tracking.',
    icon: Monitor,
    color: '#3B82F6',
    gradient: 'from-blue-500 to-indigo-600',
    scope: 'org',
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

function CampusConfigModal({
  mod,
  campuses,
  enabledCampusIds,
  togglingKey,
  onToggle,
  onClose,
}: {
  mod: ModuleDefinition
  campuses: Campus[]
  enabledCampusIds: string[]
  togglingKey: string | null
  onToggle: (moduleId: string, currentlyEnabled: boolean, campusId: string) => void
  onClose: () => void
}) {
  const Icon = mod.icon
  const activeCampuses = campuses.filter((c) => c.isActive)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ui-glass-overlay rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header with gradient */}
        <div className={`bg-gradient-to-br ${mod.gradient} px-6 py-5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{mod.name}</h3>
                <p className="text-sm text-white/80">Configure per campus</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Campus list */}
        <div className="px-6 py-4">
          {activeCampuses.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              No campuses configured. Add campuses in Campus settings first.
            </p>
          ) : (
            <div className="space-y-1.5">
              {activeCampuses.map((campus) => {
                const campusEnabled = enabledCampusIds.includes(campus.id)
                const toggleKey = `${mod.id}:${campus.id}`
                const isToggling = togglingKey === toggleKey

                return (
                  <button
                    key={campus.id}
                    onClick={() => onToggle(mod.id, campusEnabled, campus.id)}
                    disabled={isToggling}
                    className={`w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-200 disabled:opacity-60 ${
                      campusEnabled
                        ? 'bg-amber-50 border border-amber-200 hover:bg-amber-100/80'
                        : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        campusEnabled ? 'bg-amber-100' : 'bg-gray-200/70'
                      }`}>
                        <Building2 className={`w-4 h-4 ${campusEnabled ? 'text-amber-600' : 'text-gray-400'}`} />
                      </div>
                      <span className={`text-sm font-medium ${campusEnabled ? 'text-gray-900' : 'text-gray-600'}`}>
                        {campus.name}
                      </span>
                    </div>
                    <div className="flex-shrink-0">
                      {isToggling ? (
                        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                      ) : campusEnabled ? (
                        <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-gray-400 text-center">
            {enabledCampusIds.length} of {activeCampuses.length} campus{activeCampuses.length !== 1 ? 'es' : ''} enabled
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AddOnsTab() {
  const { data: modules = [], isLoading: modulesLoading } = useModules()
  const { data: campuses = [], isLoading: campusesLoading } = useQuery({
    queryKey: ['campuses'],
    queryFn: fetchCampuses,
    staleTime: 5 * 60 * 1000,
  })
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [configModuleId, setConfigModuleId] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: ({ moduleId, enabled, campusId }: { moduleId: string; enabled: boolean; campusId?: string }) =>
      toggleModule(moduleId, enabled, campusId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-modules'] })
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      if (variables.enabled) {
        const mod = MODULE_REGISTRY.find((m) => m.id === variables.moduleId)
        toast(`${mod?.name ?? 'Module'} enabled! Roles have been updated with new permissions.`, 'success')
      }
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

  const isLoading = modulesLoading || campusesLoading
  const configMod = MODULE_REGISTRY.find((m) => m.id === configModuleId)

  return (
    <div>
      <div className="ui-glass p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Add-ons</h3>
            <p className="text-xs text-gray-500">Enable optional modules to extend your workspace</p>
          </div>
        </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-gray-200 p-5">
              <div className="w-12 h-12 rounded-xl bg-gray-200 mb-4" />
              <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-full bg-gray-100 rounded mb-1" />
              <div className="h-3 w-2/3 bg-gray-100 rounded mb-6" />
              <div className="h-9 w-full bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULE_REGISTRY.map((mod) => {
            const Icon = mod.icon
            const enabledCampusIds = modules
              .filter((m) => m.moduleId === mod.id && m.campusId)
              .map((m) => m.campusId as string)
            const isOrgEnabled = modules.some((m) => m.moduleId === mod.id && !m.campusId)
            const hasAnyCampusEnabled = enabledCampusIds.length > 0
            const isAdded = mod.scope === 'campus' ? hasAnyCampusEnabled : isOrgEnabled

            return (
              <div
                key={mod.id}
                className={`group rounded-2xl border transition-all duration-200 ${
                  isAdded
                    ? 'border-gray-200 bg-white shadow-sm hover:shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="p-5">
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center mb-4 shadow-sm`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Name + badge */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-sm font-semibold text-gray-900">{mod.name}</h3>
                    {isAdded && (
                      <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                        Added
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-5">
                    {mod.description}
                  </p>

                  {/* Action button */}
                  {mod.scope === 'campus' ? (
                    isAdded ? (
                      <button
                        onClick={() => setConfigModuleId(mod.id)}
                        className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                      >
                        <Settings2 className="w-4 h-4" />
                        Configuration
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfigModuleId(mod.id)}
                        className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add to workspace
                      </button>
                    )
                  ) : (
                    /* Org-scoped: simple toggle button */
                    isOrgEnabled ? (
                      <a
                        href="/settings?tab=members"
                        className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
                      >
                        <Users className="w-4 h-4" />
                        Configure Roles
                      </a>
                    ) : (
                      <button
                        onClick={() => handleToggle(mod.id, false)}
                        disabled={togglingKey === mod.id}
                        className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        Add to workspace
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      </div>

      {mutation.isError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {mutation.error instanceof Error ? mutation.error.message : 'Failed to update module'}
        </div>
      )}

      {/* IT Help Desk guidance callout */}
      {modules.some((m) => m.moduleId === 'it-helpdesk' && !m.campusId) && (
        <div className="mt-6 rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 backdrop-blur-sm p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Info className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">IT Help Desk — Next Steps</h4>
              <p className="text-xs text-gray-500 mt-0.5">Roles have been automatically updated with IT permissions.</p>
            </div>
          </div>
          <div className="space-y-2 ml-11">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-700">Assign the IT Coordinator role</span> to your IT staff via Settings &gt; Members
              </p>
            </div>
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-700">Members and teachers</span> can already submit IT tickets
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-700">Secretary / Front Office role</span> can submit tickets and generate magic links for substitutes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Campus config modal */}
      {configMod && (
        <CampusConfigModal
          mod={configMod}
          campuses={campuses}
          enabledCampusIds={
            modules
              .filter((m) => m.moduleId === configMod.id && m.campusId)
              .map((m) => m.campusId as string)
          }
          togglingKey={togglingKey}
          onToggle={handleToggle}
          onClose={() => setConfigModuleId(null)}
        />
      )}
    </div>
  )
}
