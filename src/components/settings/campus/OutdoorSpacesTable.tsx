'use client'

import React from 'react'
import { Edit2, Trash2, Plus } from 'lucide-react'
import RowActionMenu from '@/components/RowActionMenu'
import { IllustrationCampus } from '@/components/illustrations'
import { type Area, OUTDOOR_TYPE_LABELS, renderStatusBadge, renderSkeleton } from './types'

type OutdoorSpacesTableProps = {
  outdoorSpaces: Area[]
  loading: boolean
  onAddOutdoor: () => void
  onEditOutdoor: (a: Area) => void
  onDeleteOutdoor: (id: string, name: string) => void
}

export default function OutdoorSpacesTable({
  outdoorSpaces,
  loading,
  onAddOutdoor,
  onEditOutdoor,
  onDeleteOutdoor,
}: OutdoorSpacesTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Outdoor Spaces</h3>
          <p className="text-sm text-slate-500 mt-0.5">Fields, courts, gathering areas, and other outdoor locations</p>
        </div>
        <button
          onClick={onAddOutdoor}
          className="flex items-center gap-2 px-4 py-2.5 min-h-[36px] text-sm font-semibold bg-white text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50 transition"
        >
          <Plus className="w-4 h-4" />
          Add Outdoor Space
        </button>
      </div>

      {loading ? renderSkeleton() : (
        <div className="ui-glass-table overflow-x-auto">
          {outdoorSpaces.length === 0 ? (
            <div className="text-center py-14">
              <IllustrationCampus className="w-48 h-40 mx-auto mb-2" />
              <p className="text-base font-semibold text-slate-700 mb-1">No outdoor spaces yet</p>
              <p className="text-sm text-slate-500 mb-4">Add fields, courts, and other outdoor areas to your campus.</p>
              <button
                onClick={onAddOutdoor}
                className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors active:scale-[0.97] cursor-pointer"
              >
                Add First Outdoor Space
              </button>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b bg-slate-50">
                  <th className="py-3 px-4 text-left font-medium">Space</th>
                  <th className="py-3 px-4 text-left font-medium">Type</th>
                  <th className="py-3 px-4 text-left font-medium">Status</th>
                  <th className="py-3 pl-4 pr-10 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {outdoorSpaces.map((a) => (
                  <tr key={a.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">{a.name}</td>
                    <td className="py-3 px-4 text-slate-600">{OUTDOOR_TYPE_LABELS[a.areaType] || a.areaType}</td>
                    <td className="py-3 px-4">{renderStatusBadge(a.isActive)}</td>
                    <td className="py-3 pl-4 pr-10">
                      <div className="flex justify-end">
                        <RowActionMenu
                          items={[
                            { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => onEditOutdoor(a) },
                            { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => onDeleteOutdoor(a.id, a.name), variant: 'danger' as const },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
