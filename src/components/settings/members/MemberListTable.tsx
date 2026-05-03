'use client'

import { Edit2, Trash2, UserMinus, UserCheck, Shield, Download } from 'lucide-react'
import RowActionMenu from '@/components/RowActionMenu'
import { getInitials, getDisplayName, getAvatarColor, formatDate, StatusBadge, type ApiUser } from './types'

interface MemberListTableProps {
  users: ApiUser[]
  loading: boolean
  search: string
  onEditUser: (user: ApiUser) => void
  onManagePermissions: (user: ApiUser) => void
  onToggleStatus: (user: ApiUser) => void
  onRemoveUser: (user: ApiUser) => void
}

export default function MemberListTable({
  users,
  loading,
  search,
  onEditUser,
  onManagePermissions,
  onToggleStatus,
  onRemoveUser,
}: MemberListTableProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-3 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-48 bg-slate-200 rounded" />
            </div>
            <div className="h-5 w-16 bg-slate-200 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm">
        {search ? 'No members match your search.' : 'No members found.'}
      </div>
    )
  }

  const actionItems = (u: ApiUser) => [
    { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => onEditUser(u) },
    { label: 'Manage Permissions', icon: <Shield className="w-4 h-4" />, onClick: () => onManagePermissions(u) },
    {
      label: u.status === 'ACTIVE' ? 'Deactivate' : 'Activate',
      icon: u.status === 'ACTIVE' ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />,
      onClick: () => onToggleStatus(u),
    },
    { label: 'Remove', icon: <Trash2 className="w-4 h-4" />, onClick: () => onRemoveUser(u), variant: 'danger' as const },
  ]

  return (
    <>
      {/* Mobile card list */}
      <div className="sm:hidden divide-y divide-slate-100">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3">
            <span className={`relative inline-flex items-center justify-center h-9 w-9 rounded-full text-white text-xs font-bold flex-shrink-0 ${getAvatarColor(u.id)}`}>
              {getInitials(u.firstName, u.lastName, u.email, u.name)}
              {u.avatar && (
                <img
                  src={u.avatar}
                  alt={getDisplayName(u) ?? u.email}
                  className="absolute inset-0 h-9 w-9 rounded-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 text-sm truncate">
                {getDisplayName(u) || '—'}
              </div>
              <div className="text-xs text-slate-500 truncate">{u.email}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-600 capitalize">{u.userRole?.name ?? '—'}</span>
                <StatusBadge status={u.status} />
              </div>
            </div>
            <RowActionMenu items={actionItems(u)} ariaLabel={`Actions for ${u.name || u.email}`} />
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <table className="min-w-full text-sm hidden sm:table">
        <thead>
          <tr className="text-slate-500 border-b bg-slate-50">
            <th className="py-3 px-4 text-left font-medium">Name</th>
            <th className="py-3 px-4 text-left font-medium">Role</th>
            <th className="py-3 px-4 text-left font-medium">Status</th>
            <th className="py-3 px-4 text-left font-medium hidden md:table-cell">Teams</th>
            <th className="py-3 px-4 text-left font-medium hidden lg:table-cell">Date added</th>
            <th className="py-3 pl-4 pr-10 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b last:border-b-0 hover:bg-slate-50 transition-colors duration-150">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <span className={`relative inline-flex items-center justify-center h-8 w-8 rounded-full text-white text-xs font-bold flex-shrink-0 ${getAvatarColor(u.id)}`}>
                    {getInitials(u.firstName, u.lastName, u.email, u.name)}
                    {u.avatar && (
                      <img
                        src={u.avatar}
                        alt={getDisplayName(u) ?? u.email}
                        className="absolute inset-0 h-8 w-8 rounded-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    )}
                  </span>
                  <div>
                    <div className="font-medium text-slate-900">
                      {getDisplayName(u) || '—'}
                    </div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 text-slate-700 capitalize">
                {u.userRole?.name ?? <span className="text-slate-400">—</span>}
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={u.status} />
              </td>
              <td className="py-3 px-4 text-slate-600 hidden md:table-cell">
                {u.teams.length > 0
                  ? u.teams.map((t) => t.team.name).join(', ')
                  : <span className="text-slate-400">—</span>}
              </td>
              <td className="py-3 px-4 text-slate-600 hidden lg:table-cell">{formatDate(u.createdAt)}</td>
              <td className="py-3 pl-4 pr-10">
                <div className="flex justify-end">
                  <RowActionMenu items={actionItems(u)} ariaLabel={`Actions for ${u.name || u.email}`} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
