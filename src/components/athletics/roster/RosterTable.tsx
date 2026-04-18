'use client'

import { Edit2, Trash2 } from 'lucide-react'
import RowActionMenu from '@/components/RowActionMenu'
import type { RosterPlayer } from './roster-types'

interface RosterTableProps {
  players: RosterPlayer[]
  onEdit: (player: RosterPlayer) => void
  onDelete: (player: RosterPlayer) => void
}

export default function RosterTable({ players, onEdit, onDelete }: RosterTableProps) {
  return (
    <div className="overflow-x-auto hidden sm:block">
      <table className="min-w-full divide-y divide-stone-100">
        <thead>
          <tr className="bg-stone-50/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider w-12">#</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Position</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Grade</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden md:table-cell">Ht/Wt</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden lg:table-cell">Linked User</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider w-12" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {players.map((player) => (
            <tr key={player.id} className="hover:bg-stone-50/50 transition-colors">
              <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                {player.jerseyNumber || '\u2014'}
              </td>
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-slate-900">
                  {player.firstName} {player.lastName}
                </div>
                {!player.isActive && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">
                    Inactive
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-stone-600">{player.position || '\u2014'}</td>
              <td className="px-4 py-3 text-sm text-stone-600">{player.grade || '\u2014'}</td>
              <td className="px-4 py-3 text-sm text-stone-600 hidden md:table-cell">
                {player.height || player.weight
                  ? `${player.height || '\u2014'} / ${player.weight || '\u2014'}`
                  : '\u2014'}
              </td>
              <td className="px-4 py-3 text-sm text-stone-500 hidden lg:table-cell">
                {player.user
                  ? `${player.user.firstName || ''} ${player.user.lastName || ''}`.trim() || player.user.email
                  : '\u2014'}
              </td>
              <td className="px-4 py-3 text-right">
                <RowActionMenu
                  items={[
                    { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => onEdit(player) },
                    {
                      label: 'Delete',
                      icon: <Trash2 className="w-4 h-4" />,
                      onClick: () => onDelete(player),
                      variant: 'danger',
                    },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
