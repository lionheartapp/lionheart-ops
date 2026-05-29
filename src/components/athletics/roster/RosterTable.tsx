'use client'

import { Edit2, Trash2, ExternalLink } from 'lucide-react'
import RowActionMenu from '@/components/RowActionMenu'
import type { Athlete } from './roster-types'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

interface RosterTableProps {
  players: Athlete[]
  selectedTeamId?: string
  onEdit: (player: Athlete) => void
  onDelete: (player: Athlete) => void
}

export default function RosterTable({ players, selectedTeamId, onEdit, onDelete }: RosterTableProps) {
  return (
    <div className="overflow-x-auto hidden sm:block">
      <table className="min-w-full divide-y divide-stone-100">
        <thead>
          <tr className="bg-stone-50/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider w-12">#</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Position</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Grade</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden md:table-cell">Teams</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden lg:table-cell">Ht/Wt</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider w-12" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {players.map((athlete) => {
            const rosterEntry = selectedTeamId
              ? athlete.rosters?.find((r) => r.athleticTeamId === selectedTeamId)
              : athlete.rosters?.[0]
            return (
              <tr key={athlete.id} className="hover:bg-stone-50/50 transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                  {rosterEntry?.jerseyNumber || '\u2014'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {athlete.photoUrl && (
                      <OptimizedImage src={athlete.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {athlete.firstName} {athlete.lastName}
                      </div>
                      {!athlete.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-stone-600">{rosterEntry?.position || '\u2014'}</td>
                <td className="px-4 py-3 text-sm text-stone-600">{athlete.grade || '\u2014'}</td>
                <td className="px-4 py-3 text-sm text-stone-600 hidden md:table-cell">
                  {athlete.rosters?.map((r) => r.athleticTeam?.name).join(', ') || '\u2014'}
                </td>
                <td className="px-4 py-3 text-sm text-stone-600 hidden lg:table-cell">
                  {athlete.height || athlete.weight
                    ? `${athlete.height || '\u2014'} / ${athlete.weight || '\u2014'}`
                    : '\u2014'}
                </td>
                <td className="px-4 py-3 text-right">
                  <RowActionMenu
                    items={[
                      { label: 'View Profile', icon: <ExternalLink className="w-4 h-4" />, onClick: () => window.open(`/athletics/public/player/${athlete.id}`, '_blank') },
                      { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => onEdit(athlete) },
                      {
                        label: 'Delete',
                        icon: <Trash2 className="w-4 h-4" />,
                        onClick: () => onDelete(athlete),
                        variant: 'danger',
                      },
                    ]}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
