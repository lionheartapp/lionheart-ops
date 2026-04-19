'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Route,
  Users,
  Wrench,
  Monitor,
  ChevronDown,
  UserCheck,
  Shield,
  Zap,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { queryKeys, queryOptions } from '@/lib/queries'
import { FIELD_LIBRARY, type FieldDefinition } from '@/lib/services/categoryFieldLibrary'
import type { CategoryFieldType } from '@prisma/client'
import RoutingDashboard from './RoutingDashboard'

// ─── Types ───────────────────────────────────────────────────────────────────

type TicketModule = 'MAINTENANCE' | 'IT'
type RoutingStrategy = 'UNASSIGNED' | 'ROUND_ROBIN' | 'LOAD_BALANCED' | 'MANAGER_TRIAGE'

interface UserSummary {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar?: string | null
}

interface RoutingConfig {
  id: string
  module: TicketModule
  campusId: string | null
  strategy: RoutingStrategy
  managerUserId: string | null
  manager: UserSummary | null
}

interface CategoryConfig {
  id: string
  module: TicketModule
  categoryKey: string
  specialistUserId: string | null
  fallbackUserId: string | null
  specialist: UserSummary | null
  fallback: UserSummary | null
  slaResponseMins: number | null
  slaResolveMins: number | null
}

interface StaffAvailabilityRecord {
  id: string
  userId: string
  module: TicketModule
  status: 'AVAILABLE' | 'OUT_OF_OFFICE'
  outUntil: string | null
  maxActiveTickets: number
  delegateUserId: string | null
  user: UserSummary
  delegate: UserSummary | null
  openTickets: number
}

interface FieldConfig {
  id: string
  module: TicketModule
  categoryKey: string
  fieldType: CategoryFieldType
  required: boolean
  sortOrder: number
}

// ─── Strategy metadata ───────────────────────────────────────────────────────

const STRATEGY_OPTIONS: Array<{
  value: RoutingStrategy
  label: string
  description: string
  icon: typeof Route
}> = [
  {
    value: 'UNASSIGNED',
    label: 'Unassigned Queue',
    description: 'New tickets go to the shared queue. Staff self-assign.',
    icon: Users,
  },
  {
    value: 'ROUND_ROBIN',
    label: 'Round Robin',
    description: 'New tickets are distributed evenly across available staff.',
    icon: Zap,
  },
  {
    value: 'LOAD_BALANCED',
    label: 'Load Balanced',
    description: 'New tickets go to the person with the fewest open tickets.',
    icon: Shield,
  },
  {
    value: 'MANAGER_TRIAGE',
    label: 'Manager Triage',
    description: 'All new tickets go to a designated manager for manual assignment.',
    icon: UserCheck,
  },
]

const CATEGORY_LABELS: Record<string, string> = {
  // Maintenance
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  CUSTODIAL_BIOHAZARD: 'Custodial / Biohazard',
  IT_AV: 'IT & A/V',
  GROUNDS: 'Grounds & Landscaping',
  // IT
  HARDWARE: 'Hardware',
  SOFTWARE: 'Software',
  ACCOUNT_PASSWORD: 'Accounts & Passwords',
  NETWORK: 'Network',
  DISPLAY_AV: 'Displays & A/V',
  OTHER: 'Other',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TicketRoutingTab() {
  const queryClient = useQueryClient()
  const [activeModule, setActiveModule] = useState<TicketModule>('MAINTENANCE')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch routing configs
  const { data: routingConfigs, isLoading: loadingConfigs } = useQuery({
    queryKey: queryKeys.ticketRouting.all,
    queryFn: () => fetchApi<RoutingConfig[]>('/api/settings/ticket-routing'),
  })

  // Fetch category configs
  const { data: categoryConfigs, isLoading: loadingCategories } = useQuery({
    queryKey: queryKeys.routingCategories.byModule(activeModule),
    queryFn: () =>
      fetchApi<CategoryConfig[]>(
        `/api/settings/ticket-routing/categories?module=${activeModule}`
      ),
  })

  // Fetch staff availability
  const { data: staffList, isLoading: loadingStaff } = useQuery({
    queryKey: queryKeys.staffAvailability.byModule(activeModule),
    queryFn: () =>
      fetchApi<StaffAvailabilityRecord[]>(
        `/api/settings/staff-availability?module=${activeModule}`
      ),
  })

  // Fetch field configs for all categories in this module
  const { data: fieldConfigs } = useQuery({
    queryKey: ['category-field-configs', activeModule],
    queryFn: () =>
      fetchApi<FieldConfig[]>(
        `/api/settings/ticket-routing/fields?module=${activeModule}`
      ),
  })

  // Fetch org members for user pickers
  const { data: membersData } = useQuery(queryOptions.members())
  const members = (membersData ?? []) as Array<{
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  }>

  // Get current config for active module (org-wide, campusId = null)
  const currentConfig = (routingConfigs ?? []).find(
    (c: RoutingConfig) => c.module === activeModule && c.campusId === null
  )
  const currentStrategy = currentConfig?.strategy ?? 'UNASSIGNED'
  const currentManagerId = currentConfig?.managerUserId ?? null

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.ticketRouting.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.routingCategories.byModule(activeModule) })
    queryClient.invalidateQueries({ queryKey: queryKeys.staffAvailability.byModule(activeModule) })
  }, [queryClient, activeModule])

  // ─── Seed defaults if no config exists ─────────────────────────────────

  const seedDefaults = async () => {
    setSaving(true)
    setError(null)
    try {
      await fetchApi('/api/settings/ticket-routing/seed', {
        method: 'POST',
      })
      invalidateAll()
      setSuccess('Routing defaults initialized')
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError('Failed to initialize routing defaults')
    } finally {
      setSaving(false)
    }
  }

  // ─── Strategy update ───────────────────────────────────────────────────

  const updateStrategy = async (strategy: RoutingStrategy, managerUserId?: string | null) => {
    setSaving(true)
    setError(null)
    try {
      await fetchApi('/api/settings/ticket-routing', {
        method: 'POST',
        body: JSON.stringify({
          module: activeModule,
          campusId: null,
          strategy,
          managerUserId: managerUserId ?? null,
        }),
      })
      invalidateAll()
      setSuccess('Routing strategy updated')
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError('Failed to update strategy')
    } finally {
      setSaving(false)
    }
  }

  // ─── Category config update ────────────────────────────────────────────

  const updateCategory = async (
    categoryKey: string,
    field: 'specialistUserId' | 'fallbackUserId',
    userId: string | null
  ) => {
    setError(null)
    try {
      await fetchApi('/api/settings/ticket-routing/categories', {
        method: 'PATCH',
        body: JSON.stringify({
          module: activeModule,
          categoryKey,
          [field]: userId,
        }),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.routingCategories.byModule(activeModule) })
    } catch {
      setError('Failed to update category routing')
    }
  }

  // ─── Staff availability update ─────────────────────────────────────────

  const updateStaffAvailability = async (
    userId: string,
    updates: { status?: 'AVAILABLE' | 'OUT_OF_OFFICE'; maxActiveTickets?: number; delegateUserId?: string | null }
  ) => {
    setError(null)
    try {
      await fetchApi('/api/settings/staff-availability', {
        method: 'PATCH',
        body: JSON.stringify({
          userId,
          module: activeModule,
          ...updates,
        }),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.staffAvailability.byModule(activeModule) })
    } catch {
      setError('Failed to update staff availability')
    }
  }

  // ─── Loading state ─────────────────────────────────────────────────────

  const isLoading = loadingConfigs || loadingCategories || loadingStaff

  // ─── No config — show seed prompt ──────────────────────────────────────

  const hasNoConfig = !loadingConfigs && (!routingConfigs || routingConfigs.length === 0)

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
          <Route className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Ticket Routing</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure how tickets are automatically assigned to staff
          </p>
        </div>
      </div>

      {/* Module toggle */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-full w-fit">
        <button
          onClick={() => setActiveModule('MAINTENANCE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
            activeModule === 'MAINTENANCE'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Maintenance
        </button>
        <button
          onClick={() => setActiveModule('IT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
            activeModule === 'IT'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Monitor className="w-4 h-4" />
          IT Help Desk
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Seed prompt */}
      {hasNoConfig && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <Route className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-slate-900 mb-1">
            No routing configuration yet
          </h4>
          <p className="text-sm text-slate-500 mb-4">
            Initialize default routing settings for both Maintenance and IT modules.
          </p>
          <button
            onClick={seedDefaults}
            disabled={saving}
            className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Initializing...' : 'Initialize Routing Defaults'}
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !hasNoConfig && (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="h-5 w-40 bg-slate-200 rounded animate-pulse mb-4" />
              <div className="h-10 w-full bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Dashboard widgets */}
      {!isLoading && !hasNoConfig && <RoutingDashboard module={activeModule} />}

      {/* Main content — only show when config exists */}
      {!isLoading && !hasNoConfig && (
        <>
          {/* Section 1: Default Strategy */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
              Default Assignment Strategy
            </h4>

            <div className="grid gap-3">
              {STRATEGY_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const isActive = currentStrategy === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      if (opt.value === 'MANAGER_TRIAGE' && !currentManagerId) {
                        // Don't auto-select triage without a manager — let them pick first
                        return
                      }
                      updateStrategy(opt.value, opt.value === 'MANAGER_TRIAGE' ? currentManagerId : null)
                    }}
                    disabled={saving}
                    className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      isActive
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isActive ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
                        {isActive && (
                          <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{opt.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Manager picker for triage */}
            {(currentStrategy === 'MANAGER_TRIAGE' || !currentConfig) && (
              <div className="mt-4 pl-13">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Triage Manager
                </label>
                <select
                  value={currentManagerId ?? ''}
                  onChange={(e) => {
                    const managerId = e.target.value || null
                    updateStrategy('MANAGER_TRIAGE', managerId)
                  }}
                  className="w-full max-w-xs px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                >
                  <option value="">Select a manager...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} ({m.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Plain-language preview */}
            {currentConfig && (
              <div className="mt-4 px-4 py-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">How it works: </span>
                  {STRATEGY_OPTIONS.find((s) => s.value === currentStrategy)?.description}
                  {currentStrategy === 'MANAGER_TRIAGE' && currentConfig.manager && (
                    <> All tickets route to{' '}
                      <span className="font-medium">
                        {currentConfig.manager.firstName} {currentConfig.manager.lastName}
                      </span>
                      .
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Category Routing */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">
              Category Routing
            </h4>
            <p className="text-sm text-slate-500 mb-4">
              Override the default strategy for specific categories by assigning a specialist or fallback.
            </p>

            {(!categoryConfigs || categoryConfigs.length === 0) ? (
              <p className="text-sm text-slate-400 italic">
                No category configurations. Initialize routing defaults to get started.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Category
                      </th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Specialist
                      </th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Fallback
                      </th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Response SLA
                      </th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Resolve SLA
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryConfigs.map((cat: CategoryConfig) => (
                      <tr key={cat.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-3 px-3 font-medium text-slate-900">
                          {CATEGORY_LABELS[cat.categoryKey] ?? cat.categoryKey}
                        </td>
                        <td className="py-3 px-3">
                          <UserPicker
                            value={cat.specialistUserId}
                            members={members}
                            onChange={(userId) =>
                              updateCategory(cat.categoryKey, 'specialistUserId', userId)
                            }
                            placeholder="Use default"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <UserPicker
                            value={cat.fallbackUserId}
                            members={members}
                            onChange={(userId) =>
                              updateCategory(cat.categoryKey, 'fallbackUserId', userId)
                            }
                            placeholder="None"
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <SLAInput
                            value={cat.slaResponseMins}
                            onChange={(mins) =>
                              updateCategory(cat.categoryKey, 'slaResponseMins' as 'specialistUserId', mins as unknown as string | null)
                            }
                            onUpdate={(mins) => {
                              fetchApi('/api/settings/ticket-routing/categories', {
                                method: 'PATCH',
                                body: JSON.stringify({ module: activeModule, categoryKey: cat.categoryKey, slaResponseMins: mins }),
                              }).then(() => queryClient.invalidateQueries({ queryKey: queryKeys.routingCategories.byModule(activeModule) }))
                            }}
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <SLAInput
                            value={cat.slaResolveMins}
                            onChange={() => {}}
                            onUpdate={(mins) => {
                              fetchApi('/api/settings/ticket-routing/categories', {
                                method: 'PATCH',
                                body: JSON.stringify({ module: activeModule, categoryKey: cat.categoryKey, slaResolveMins: mins }),
                              }).then(() => queryClient.invalidateQueries({ queryKey: queryKeys.routingCategories.byModule(activeModule) }))
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Category Fields */}
          <CategoryFieldsSection
            module={activeModule}
            categoryConfigs={categoryConfigs ?? []}
            fieldConfigs={fieldConfigs ?? []}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ['category-field-configs', activeModule] })}
          />

          {/* Section 4: Staff Availability */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">
              Staff Availability
            </h4>
            <p className="text-sm text-slate-500 mb-4">
              Manage who is available for ticket assignment and their capacity limits.
            </p>

            {(!staffList || staffList.length === 0) ? (
              <div className="text-center py-6">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 mb-3">
                  No staff availability records yet. Add staff members to enable routing.
                </p>
                <AddStaffButton
                  members={members}
                  existingUserIds={(staffList ?? []).map((s: StaffAvailabilityRecord) => s.userId)}
                  module={activeModule}
                  onAdd={(userId) => updateStaffAvailability(userId, { status: 'AVAILABLE' })}
                />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Staff Member
                        </th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Status
                        </th>
                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Open
                        </th>
                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Capacity
                        </th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Delegate
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffList.map((staff: StaffAvailabilityRecord) => (
                        <tr key={staff.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-xs font-semibold text-blue-700">
                                {(staff.user.firstName?.[0] ?? '')}{(staff.user.lastName?.[0] ?? '')}
                              </div>
                              <div>
                                <div className="font-medium text-slate-900">
                                  {staff.user.firstName} {staff.user.lastName}
                                </div>
                                <div className="text-xs text-slate-400">{staff.user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() =>
                                updateStaffAvailability(staff.userId, {
                                  status: staff.status === 'AVAILABLE' ? 'OUT_OF_OFFICE' : 'AVAILABLE',
                                })
                              }
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                                staff.status === 'AVAILABLE'
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              }`}
                            >
                              {staff.status === 'AVAILABLE' ? (
                                <>
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                  Available
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3" />
                                  Out of Office
                                </>
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`text-sm font-medium ${
                                staff.openTickets >= staff.maxActiveTickets
                                  ? 'text-red-600'
                                  : 'text-slate-700'
                              }`}
                            >
                              {staff.openTickets}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={staff.maxActiveTickets}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10)
                                if (val >= 1 && val <= 100) {
                                  updateStaffAvailability(staff.userId, { maxActiveTickets: val })
                                }
                              }}
                              className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-sm text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            />
                          </td>
                          <td className="py-3 px-3">
                            {staff.status === 'OUT_OF_OFFICE' ? (
                              <UserPicker
                                value={staff.delegateUserId}
                                members={members.filter((m) => m.id !== staff.userId)}
                                onChange={(delegateId) =>
                                  updateStaffAvailability(staff.userId, { delegateUserId: delegateId })
                                }
                                placeholder="None"
                              />
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4">
                  <AddStaffButton
                    members={members}
                    existingUserIds={staffList.map((s: StaffAvailabilityRecord) => s.userId)}
                    module={activeModule}
                    onAdd={(userId) => updateStaffAvailability(userId, { status: 'AVAILABLE' })}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── UserPicker (inline select for specialist/fallback) ──────────────────────

function UserPicker({
  value,
  members,
  onChange,
  placeholder,
}: {
  value: string | null
  members: Array<{ id: string; firstName: string | null; lastName: string | null; email: string }>
  onChange: (userId: string | null) => void
  placeholder: string
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full max-w-[220px] px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
    >
      <option value="">{placeholder}</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.firstName} {m.lastName}
        </option>
      ))}
    </select>
  )
}

// ─── CategoryFieldsSection ───────────────────────────────────────────────────

function CategoryFieldsSection({
  module,
  categoryConfigs,
  fieldConfigs,
  onUpdate,
}: {
  module: TicketModule
  categoryConfigs: CategoryConfig[]
  fieldConfigs: FieldConfig[]
  onUpdate: () => void
}) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Get available field types for this module
  const availableFields = Object.values(FIELD_LIBRARY).filter((f) =>
    f.modules.includes(module)
  )

  const toggleField = async (
    categoryKey: string,
    fieldType: CategoryFieldType,
    enabled: boolean,
    required: boolean = false
  ) => {
    setSaving(true)
    try {
      const currentFields = fieldConfigs
        .filter((f) => f.categoryKey === categoryKey)
        .map((f) => ({ fieldType: f.fieldType, required: f.required, sortOrder: f.sortOrder }))

      const newFields = enabled
        ? [...currentFields, { fieldType, required, sortOrder: currentFields.length }]
        : currentFields.filter((f) => f.fieldType !== fieldType)

      await fetchApi('/api/settings/ticket-routing/fields', {
        method: 'PUT',
        body: JSON.stringify({ module, categoryKey, fields: newFields }),
      })
      onUpdate()
    } catch {
      // silently fail — user can retry
    } finally {
      setSaving(false)
    }
  }

  const toggleRequired = async (categoryKey: string, fieldType: CategoryFieldType, required: boolean) => {
    setSaving(true)
    try {
      const currentFields = fieldConfigs
        .filter((f) => f.categoryKey === categoryKey)
        .map((f) => ({
          fieldType: f.fieldType,
          required: f.fieldType === fieldType ? required : f.required,
          sortOrder: f.sortOrder,
        }))

      await fetchApi('/api/settings/ticket-routing/fields', {
        method: 'PUT',
        body: JSON.stringify({ module, categoryKey, fields: currentFields }),
      })
      onUpdate()
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }

  if (categoryConfigs.length === 0) return null

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">
        Category Fields
      </h4>
      <p className="text-sm text-slate-500 mb-4">
        Toggle additional fields that appear when submitting tickets for each category.
      </p>

      <div className="space-y-1">
        {categoryConfigs.map((cat) => {
          const isExpanded = expandedCategory === cat.categoryKey
          const enabledCount = fieldConfigs.filter((f) => f.categoryKey === cat.categoryKey).length

          return (
            <div key={cat.categoryKey} className="border border-slate-100 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : cat.categoryKey)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-medium text-slate-900">
                    {CATEGORY_LABELS[cat.categoryKey] ?? cat.categoryKey}
                  </span>
                  {enabledCount > 0 && (
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                      {enabledCount} field{enabledCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-2 border-t border-slate-100 pt-3">
                  {availableFields.map((fieldDef) => {
                    const config = fieldConfigs.find(
                      (f) => f.categoryKey === cat.categoryKey && f.fieldType === fieldDef.type
                    )
                    const isEnabled = !!config

                    return (
                      <div
                        key={fieldDef.type}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                          isEnabled ? 'bg-blue-50/50' : 'bg-slate-50/50'
                        }`}
                      >
                        <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => toggleField(cat.categoryKey, fieldDef.type, e.target.checked)}
                            disabled={saving}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900">{fieldDef.label}</div>
                            <div className="text-xs text-slate-500">{fieldDef.description}</div>
                          </div>
                        </label>
                        {isEnabled && (
                          <button
                            onClick={() => toggleRequired(cat.categoryKey, fieldDef.type, !config!.required)}
                            disabled={saving}
                            className={`ml-3 px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer flex-shrink-0 ${
                              config!.required
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {config!.required ? 'Required' : 'Optional'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── AddStaffButton (dropdown to add a new staff member) ─────────────────────

// ─── SLAInput (inline minutes input with display helper) ─────────────────────

function SLAInput({
  value,
  onChange,
  onUpdate,
}: {
  value: number | null
  onChange: (mins: number | null) => void
  onUpdate: (mins: number | null) => void
}) {
  const formatDisplay = (mins: number | null): string => {
    if (!mins) return ''
    if (mins < 60) return `${mins}m`
    if (mins % 60 === 0) return `${mins / 60}h`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={1}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value ? parseInt(e.target.value, 10) : null
          onChange(v)
        }}
        onBlur={(e) => {
          const v = e.target.value ? parseInt(e.target.value, 10) : null
          onUpdate(v)
        }}
        placeholder="—"
        className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-sm text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
      />
      {value && (
        <span className="text-xs text-slate-400">{formatDisplay(value)}</span>
      )}
    </div>
  )
}

// ─── AddStaffButton (dropdown to add a new staff member) ─────────────────────

function AddStaffButton({
  members,
  existingUserIds,
  module,
  onAdd,
}: {
  members: Array<{ id: string; firstName: string | null; lastName: string | null; email: string }>
  existingUserIds: string[]
  module: TicketModule
  onAdd: (userId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const available = members.filter((m) => !existingUserIds.includes(m.id))

  if (available.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition cursor-pointer"
      >
        <Users className="w-3.5 h-3.5" />
        Add Staff Member
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
          {available.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onAdd(m.id)
                setOpen(false)
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors cursor-pointer first:rounded-t-xl last:rounded-b-xl"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-xs font-semibold text-blue-700">
                {(m.firstName?.[0] ?? '')}{(m.lastName?.[0] ?? '')}
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900">
                  {m.firstName} {m.lastName}
                </div>
                <div className="text-xs text-slate-400">{m.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
