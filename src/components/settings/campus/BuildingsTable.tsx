'use client'

import React, { useMemo } from 'react'
import { DoorOpen, Edit2, Trash2, Plus } from 'lucide-react'
import RowActionMenu from '@/components/RowActionMenu'
import { IllustrationCampus } from '@/components/illustrations'
import {
  type Building,
  type Room,
  type SchoolInfo,
  DIVISION_ORDER,
  DIVISION_LABELS,
  DIVISION_COLORS,
  BUILDING_TYPE_LABELS,
  renderStatusBadge,
  renderSkeleton,
} from './types'

type BuildingsTableProps = {
  buildings: Building[]
  rooms: Room[]
  schools: SchoolInfo[]
  loading: boolean
  onAddBuilding: () => void
  onEditBuilding: (b: Building) => void
  onDeleteBuilding: (id: string, name: string) => void
  onManageRooms: (b: Building) => void
}

export default function BuildingsTable({
  buildings,
  rooms,
  schools,
  loading,
  onAddBuilding,
  onEditBuilding,
  onDeleteBuilding,
  onManageRooms,
}: BuildingsTableProps) {
  const groupedBuildings = useMemo(() => {
    return DIVISION_ORDER
      .map((div) => ({ division: div, buildings: buildings.filter((b) => b.schoolDivision === div) }))
      .filter((g) => g.buildings.length > 0)
  }, [buildings])

  const getGroupColor = (group: { division: string; buildings: Building[] }) =>
    group.buildings.find((b) => b.school?.color)?.school?.color
    || schools.find((s) => s.gradeLevel === group.division)?.color
    || DIVISION_COLORS[group.division]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Buildings</h3>
          <p className="text-sm text-slate-500 mt-0.5">Physical structures on campus</p>
        </div>
        <button
          onClick={onAddBuilding}
          className="flex items-center gap-2 px-4 py-2.5 min-h-[36px] text-sm font-semibold bg-white text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50 transition"
        >
          <Plus className="w-4 h-4" />
          Add Building
        </button>
      </div>

      {loading ? renderSkeleton() : (
        <div className="ui-glass-table overflow-x-auto">
          {buildings.length === 0 ? (
            <div className="text-center py-14">
              <IllustrationCampus className="w-48 h-40 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600 mb-1">No buildings yet</p>
              <p className="text-xs text-slate-400 mb-4">Add your campus buildings to manage rooms and areas.</p>
              <button
                onClick={onAddBuilding}
                className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors active:scale-[0.97] cursor-pointer"
              >
                Add First Building
              </button>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b bg-slate-50">
                  <th className="py-3 px-4 text-left font-medium">Building</th>
                  <th className="py-3 px-4 text-left font-medium">Type</th>
                  <th className="py-3 px-4 text-left font-medium">Rooms</th>
                  <th className="py-3 px-4 text-left font-medium">Status</th>
                  <th className="py-3 pl-4 pr-10 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedBuildings.map((group) => (
                  <React.Fragment key={group.division}>
                    <tr style={{ backgroundColor: getGroupColor(group) + '0a' }}>
                      <td colSpan={5} className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: getGroupColor(group) }}
                          />
                          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            {DIVISION_LABELS[group.division] || group.division}
                          </span>
                          <span className="text-xs text-slate-400">({group.buildings.length})</span>
                        </div>
                      </td>
                    </tr>
                    {group.buildings.map((b) => {
                      const roomCount = rooms.filter((r) => r.buildingId === b.id).length
                      return (
                        <tr key={b.id} className="border-b last:border-b-0 hover:bg-slate-50 transition-colors duration-150">
                          <td className="py-3 pl-9 pr-4">
                            <div className="font-medium text-slate-900">{b.name}</div>
                            {b.code && <div className="text-xs text-slate-400 mt-0.5">{b.code}</div>}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-xs">{BUILDING_TYPE_LABELS[b.buildingType] || 'General'}</td>
                          <td className="py-3 px-4 text-slate-500">{roomCount}</td>
                          <td className="py-3 px-4">{renderStatusBadge(b.isActive)}</td>
                          <td className="py-3 pl-4 pr-10">
                            <div className="flex justify-end">
                              <RowActionMenu
                                items={[
                                  { label: 'Manage Rooms', icon: <DoorOpen className="w-4 h-4" />, onClick: () => onManageRooms(b) },
                                  { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => onEditBuilding(b) },
                                  { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => onDeleteBuilding(b.id, b.name), variant: 'danger' as const },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
