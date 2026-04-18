'use client'

import { Edit2, Trash2 } from 'lucide-react'
import RowActionMenu from '@/components/RowActionMenu'
import type { RosterPlayer } from './roster-types'

interface RosterCardsProps {
  players: RosterPlayer[]
  onEdit: (player: RosterPlayer) => void
  onDelete: (player: RosterPlayer) => void
}

export default function RosterCards({ players, onEdit, onDelete }: RosterCardsProps) {
  return (
    <div className="sm:hidden divide-y divide-stone-100">
      {players.map((player) => (
        <div key={player.id} className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 text-center text-sm font-semibold text-slate-900 flex-shrink-0">
            {player.jerseyNumber || '\u2014'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900">
              {player.firstName} {player.lastName}
              {!player.isActive && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">Inactive</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-500">
              <span>{player.position || '\u2014'}</span>
              {player.grade && <><span className="text-stone-300">|</span><span>{player.grade}</span></>}
            </div>
          </div>
          <RowActionMenu
            items={[
              { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => onEdit(player) },
              { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => onDelete(player), variant: 'danger' },
            ]}
          />
        </div>
      ))}
    </div>
  )
}
