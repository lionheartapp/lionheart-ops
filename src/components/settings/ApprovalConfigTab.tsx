'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'

interface ApprovalConfig {
  id: string
  channelType: string
  mode: string
  assignedTeamId: string | null
  escalationHours: number
  autoApproveIfNoResource: boolean
}

interface Team {
  id: string
  name: string
}

const CHANNELS = [
  { type: 'ADMIN', label: 'Admin', description: 'Administrative approval for all events' },
  { type: 'FACILITIES', label: 'Facilities', description: 'Physical space and setup approval' },
  { type: 'AV_PRODUCTION', label: 'A/V Production', description: 'Audio/visual equipment and setup' },
  { type: 'CUSTODIAL', label: 'Custodial', description: 'Cleaning and setup coordination' },
  { type: 'SECURITY', label: 'Security', description: 'Security presence and parking management' },
  { type: 'ATHLETIC_DIRECTOR', label: 'Athletic Director', description: 'Athletic facility and schedule approval' },
]

const MODES = [
  { value: 'REQUIRED', label: 'Required', color: 'bg-red-100 text-red-700' },
  { value: 'NOTIFICATION', label: 'Notification', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'DISABLED', label: 'Disabled', color: 'bg-gray-100 text-gray-500' },
]

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...options?.headers } })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error?.message || 'Request failed')
  return data.data
}

export default function ApprovalConfigTab() {
  const queryClient = useQueryClient()
  const [localConfigs, setLocalConfigs] = useState<Record<string, { mode: string; assignedTeamId: string | null; escalationHours: number; autoApproveIfNoResource: boolean }>>({})
  const [hasChanges, setHasChanges] = useState(false)

  const { data: configs = [], isLoading } = useQuery<ApprovalConfig[]>({
    queryKey: ['approval-configs'],
    queryFn: () => apiFetch('/api/settings/approval-config'),
  })

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['teams-list'],
    queryFn: () => apiFetch('/api/settings/teams'),
  })

  const saveMutation = useMutation({
    mutationFn: (data: { configs: Array<{ channelType: string; mode: string; assignedTeamId: string | null; escalationHours: number; autoApproveIfNoResource: boolean }> }) =>
      apiFetch('/api/settings/approval-config', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-configs'] })
      setHasChanges(false)
      setLocalConfigs({})
    },
  })

  const getConfig = (channelType: string) => {
    if (localConfigs[channelType]) return localConfigs[channelType]
    const existing = configs.find((c) => c.channelType === channelType)
    return {
      mode: existing?.mode || 'DISABLED',
      assignedTeamId: existing?.assignedTeamId || null,
      escalationHours: existing?.escalationHours || 72,
      autoApproveIfNoResource: existing?.autoApproveIfNoResource ?? true,
    }
  }

  const updateConfig = (channelType: string, field: string, value: unknown) => {
    setLocalConfigs((prev) => ({
      ...prev,
      [channelType]: { ...getConfig(channelType), [field]: value },
    }))
    setHasChanges(true)
  }

  const handleSave = () => {
    const allConfigs = CHANNELS.map((ch) => ({
      channelType: ch.type,
      ...getConfig(ch.type),
    }))
    saveMutation.mutate({ configs: allConfigs })
  }

  return (
    <div className="space-y-6">
      <div className="ui-glass p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Approval Channels</h3>
              <p className="text-xs text-gray-500">Configure how event approvals are routed</p>
            </div>
          </div>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-800 disabled:opacity-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {CHANNELS.map((channel) => {
            const config = getConfig(channel.type)
            const modeInfo = MODES.find((m) => m.value === config.mode) || MODES[2]
            return (
              <div key={channel.type} className="px-4 py-4 bg-white">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{channel.label}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${modeInfo.color}`}>{modeInfo.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{channel.description}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      aria-label="Approval mode"
                      value={config.mode}
                      onChange={(e) => updateConfig(channel.type, 'mode', e.target.value)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:border-gray-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-900/10"
                    >
                      {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>

                    {config.mode !== 'DISABLED' && (
                      <>
                        <select
                          aria-label="Assigned team"
                          value={config.assignedTeamId || ''}
                          onChange={(e) => updateConfig(channel.type, 'assignedTeamId', e.target.value || null)}
                          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:border-gray-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-900/10"
                        >
                          <option value="">No team assigned</option>
                          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>

                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            aria-label="Escalation hours"
                            value={config.escalationHours}
                            onChange={(e) => updateConfig(channel.type, 'escalationHours', parseInt(e.target.value) || 72)}
                            min={1}
                            max={720}
                            className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-900/10"
                          />
                          <span className="text-xs text-gray-500">hrs</span>
                        </div>

                        <label className="flex items-center gap-1.5 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={config.autoApproveIfNoResource}
                            onChange={(e) => updateConfig(channel.type, 'autoApproveIfNoResource', e.target.checked)}
                            className="rounded"
                          />
                          Auto-approve
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}
