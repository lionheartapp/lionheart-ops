'use client'

import { Edit2, Trash2, ExternalLink } from 'lucide-react'
import RowActionMenu from '@/components/RowActionMenu'
import type { Athlete } from './roster-types'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

interface RosterCardsProps {
  players: Athlete[]
  selectedTeamId?: string
  onEdit: (player: Athlete) => void
  onDelete: (player: Athlete) => void
}

export default function RosterCards({ players, selectedTeamId, onEdit, onDelete }: RosterCardsProps) {
  return (
    <div className="sm:hidden divide-y divide-stone-100">
      {players.map((athlete) => {
        const rosterEntry = selectedTeamId
          ? athlete.rosters?.find((r) => r.athleticTeamId === selectedTeamId)
          : athlete.rosters?.[0]
        return (
          <div key={athlete.id} className="flex items-center gap-3 px-4 py-3">
            {athlete.photoUrl ? (
              <OptimizedImage src={athlete.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 text-center text-sm font-semibold text-slate-900 flex-shrink-0">
                {rosterEntry?.jerseyNumber || '\u2014'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900">
                {athlete.firstName} {athlete.lastName}
                {!athlete.isActive && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">Inactive</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-500">
                <span>{rosterEntry?.position || '\u2014'}</span>
                {athlete.grade && <><span className="text-stone-300">|</span><span>{athlete.grade}</span></>}
                {(athlete.rosters?.length ?? 0) > 1 && (
                  <><span className="text-stone-300">|</span><span>{athlete.rosters?.length} teams</span></>
                )}
              </div>
            </div>
            <RowActionMenu
              items={[
                { label: 'View Profile', icon: <ExternalLink className="w-4 h-4" />, onClick: () => window.open(`/athletics/public/player/${athlete.id}`, '_blank') },
                { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => onEdit(athlete) },
                { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => onDelete(athlete), variant: 'danger' },
              ]}
            />
          </div>
        )
      })}
    </div>
  )
}
