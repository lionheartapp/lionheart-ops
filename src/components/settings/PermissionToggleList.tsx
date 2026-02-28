'use client'

import { useMemo } from 'react'
import {
  Ticket,
  Calendar,
  Package,
  Settings,
  Users,
  Shield,
  UserCog,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PermissionItem {
  id: string
  resource: string
  action: string
  scope: string
  description?: string | null
  /** Only used in 'user' mode to show override status */
  status?: 'inherited' | 'granted' | 'revoked' | 'none'
}

interface PermissionGroup {
  resource: string
  label: string
  icon: React.ReactNode
  color: string
  permissions: PermissionItem[]
}

interface PermissionToggleListProps {
  permissions: PermissionItem[]
  selectedIds: string[]
  onToggle: (permissionId: string) => void
  /** 'role' = simple on/off, 'user' = shows override status badges */
  mode: 'role' | 'user'
  loading?: boolean
  disabled?: boolean
}

// ─── Resource Metadata ───────────────────────────────────────────────────────

const RESOURCE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  tickets: {
    label: 'Tickets',
    icon: <Ticket className="w-5 h-5" />,
    color: 'bg-orange-100 text-orange-600',
  },
  events: {
    label: 'Events',
    icon: <Calendar className="w-5 h-5" />,
    color: 'bg-purple-100 text-purple-600',
  },
  inventory: {
    label: 'Inventory',
    icon: <Package className="w-5 h-5" />,
    color: 'bg-emerald-100 text-emerald-600',
  },
  settings: {
    label: 'Settings',
    icon: <Settings className="w-5 h-5" />,
    color: 'bg-gray-100 text-gray-600',
  },
  users: {
    label: 'Users',
    icon: <Users className="w-5 h-5" />,
    color: 'bg-primary-100 text-primary-600',
  },
  roles: {
    label: 'Roles',
    icon: <Shield className="w-5 h-5" />,
    color: 'bg-indigo-100 text-indigo-600',
  },
  teams: {
    label: 'Teams',
    icon: <UserCog className="w-5 h-5" />,
    color: 'bg-teal-100 text-teal-600',
  },
}

const RESOURCE_ORDER = ['tickets', 'events', 'inventory', 'settings', 'users', 'roles', 'teams']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPermissionLabel(perm: PermissionItem): string {
  if (perm.description) return perm.description
  const parts = [perm.resource, perm.action]
  if (perm.scope && perm.scope !== 'global') parts.push(perm.scope)
  return parts.join(':')
}

function getPermissionSubtext(perm: PermissionItem): string {
  const parts = [capitalize(perm.action)]
  if (perm.scope && perm.scope !== 'global') {
    parts.push(capitalize(perm.scope) + ' scope')
  }
  return parts.join(' · ')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function groupPermissions(permissions: PermissionItem[]): PermissionGroup[] {
  const filtered = permissions.filter((p) => p.resource !== '*')
  const byResource = new Map<string, PermissionItem[]>()

  filtered.forEach((perm) => {
    const list = byResource.get(perm.resource) || []
    list.push(perm)
    byResource.set(perm.resource, list)
  })

  const groups: PermissionGroup[] = []

  // Add groups in defined order first
  RESOURCE_ORDER.forEach((resource) => {
    const list = byResource.get(resource)
    if (list && list.length > 0) {
      const meta = RESOURCE_META[resource] || {
        label: capitalize(resource),
        icon: <Settings className="w-5 h-5" />,
        color: 'bg-gray-100 text-gray-600',
      }
      groups.push({
        resource,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        permissions: list.sort((a, b) => {
          const d = a.action.localeCompare(b.action)
          return d !== 0 ? d : a.scope.localeCompare(b.scope)
        }),
      })
      byResource.delete(resource)
    }
  })

  // Add any remaining resources not in the defined order
  for (const [resource, list] of byResource) {
    groups.push({
      resource,
      label: capitalize(resource),
      icon: <Settings className="w-5 h-5" />,
      color: 'bg-gray-100 text-gray-600',
      permissions: list.sort((a, b) => {
        const d = a.action.localeCompare(b.action)
        return d !== 0 ? d : a.scope.localeCompare(b.scope)
      }),
    })
  }

  return groups
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    inherited: { bg: 'bg-primary-50', text: 'text-primary-700', label: 'From Role' },
    granted: { bg: 'bg-green-50', text: 'text-green-700', label: 'Override' },
    revoked: { bg: 'bg-red-50', text: 'text-red-700', label: 'Revoked' },
  }
  const c = config[status]
  if (!c) return null
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '44px',
        minHeight: '44px',
        width: '44px',
        flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        background: 'transparent',
        border: 'none',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          height: '24px',
          width: '44px',
          borderRadius: '9999px',
          backgroundColor: checked ? '#2563eb' : '#d1d5db',
          transition: 'background-color 200ms',
        }}
      >
        <span
          style={{
            pointerEvents: 'none',
            display: 'inline-block',
            height: '20px',
            width: '20px',
            borderRadius: '9999px',
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            transition: 'transform 200ms',
            transform: checked ? 'translateX(22px)' : 'translateX(2px)',
          }}
        />
      </span>
    </button>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="h-5 w-24 bg-gray-200 rounded mb-3" />
          <div className="space-y-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-gray-200 rounded-lg" />
                  <div>
                    <div className="h-4 w-40 bg-gray-200 rounded mb-1" />
                    <div className="h-3 w-24 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="h-6 w-11 bg-gray-200 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PermissionToggleList({
  permissions,
  selectedIds,
  onToggle,
  mode,
  loading = false,
  disabled = false,
}: PermissionToggleListProps) {
  const groups = useMemo(() => groupPermissions(permissions), [permissions])

  if (loading) return <LoadingSkeleton />

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const enabledCount = group.permissions.filter((p) => selectedIds.includes(p.id)).length

        return (
          <div key={group.resource}>
            {/* Group header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${group.color}`}>
                  {group.icon}
                </div>
                <h4 className="text-sm font-semibold text-gray-900">{group.label}</h4>
              </div>
              <span className="text-xs text-gray-500">
                {enabledCount} of {group.permissions.length}
              </span>
            </div>

            {/* Permission items */}
            <div className="space-y-1">
              {group.permissions.map((perm) => {
                const isOn = selectedIds.includes(perm.id)

                return (
                  <div
                    key={perm.id}
                    className={`
                      flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg
                      border transition-colors
                      ${isOn ? 'border-primary-100 bg-primary-50/30' : 'border-gray-100 bg-white'}
                      ${!disabled ? 'hover:bg-gray-50' : ''}
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${group.color}`}>
                        {group.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {getPermissionLabel(perm)}
                          </p>
                          {mode === 'user' && perm.status && perm.status !== 'none' && (
                            <StatusBadge status={perm.status} />
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{getPermissionSubtext(perm)}</p>
                      </div>
                    </div>

                    <Toggle
                      checked={isOn}
                      onChange={() => onToggle(perm.id)}
                      disabled={disabled}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
