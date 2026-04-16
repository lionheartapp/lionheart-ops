'use client'

import React, { useMemo, useState } from 'react'
import { Building2, MapPin, DoorOpen, Edit2, Trash2, Plus, ChevronDown, ChevronRight, Users, School as SchoolIcon } from 'lucide-react'
import RowActionMenu from '@/components/RowActionMenu'
import { IllustrationCampus } from '@/components/illustrations'
import {
  type Building,
  type Area,
  type Room,
  type SchoolInfo,
  BUILDING_TYPE_LABELS,
  OUTDOOR_TYPE_LABELS,
  renderStatusBadge,
  renderSkeleton,
} from './types'

type Props = {
  buildings: Building[]
  outdoorSpaces: Area[]
  rooms: Room[]
  schools: SchoolInfo[]
  loading: boolean
  onAddBuilding: (schoolIds: string[]) => void
  onEditBuilding: (b: Building) => void
  onDeleteBuilding: (id: string, name: string) => void
  onManageRooms: (b: Building) => void
  onAddOutdoor: (schoolIds: string[]) => void
  onEditOutdoor: (a: Area) => void
  onDeleteOutdoor: (id: string, name: string) => void
  /** School CRUD — wired up to SchoolsManagement imperative API */
  onAddSchool: () => void
  onEditSchool: (schoolId: string) => void
  onDeleteSchool: (schoolId: string) => void
}

type GroupKey = 'shared' | string // school id or 'shared'

const SHARED_COLOR = '#6366f1'

export default function SchoolGroupedFacilities({
  buildings,
  outdoorSpaces,
  rooms,
  schools,
  loading,
  onAddBuilding,
  onEditBuilding,
  onDeleteBuilding,
  onManageRooms,
  onAddOutdoor,
  onEditOutdoor,
  onDeleteOutdoor,
  onAddSchool,
  onEditSchool,
  onDeleteSchool,
}: Props) {
  // Collapsed state per group — all expanded by default
  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>({})
  const toggle = (key: GroupKey) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))

  // Buildings + outdoor spaces, grouped
  const sharedBuildings = useMemo(
    () => buildings.filter((b) => (b.schools?.length ?? 0) === 0),
    [buildings]
  )
  const sharedOutdoor = useMemo(
    () => outdoorSpaces.filter((a) => (a.schools?.length ?? 0) === 0),
    [outdoorSpaces]
  )

  const buildingsForSchool = (schoolId: string) =>
    buildings.filter((b) => b.schools?.some((s) => s.id === schoolId))
  const outdoorForSchool = (schoolId: string) =>
    outdoorSpaces.filter((a) => a.schools?.some((s) => s.id === schoolId))

  if (loading) {
    return (
      <div className="space-y-4">
        {renderSkeleton()}
      </div>
    )
  }

  const hasAnything =
    buildings.length > 0 || outdoorSpaces.length > 0 || schools.length > 0

  if (!hasAnything) {
    return (
      <div className="ui-glass-table text-center py-14">
        <IllustrationCampus className="w-48 h-40 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-600 mb-1">No facilities yet</p>
        <p className="text-xs text-slate-400 mb-4">
          Add schools, buildings, and outdoor spaces to organize your campus.
        </p>
        <button
          onClick={() => onAddBuilding([])}
          className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors active:scale-[0.97] cursor-pointer"
        >
          Add First Building
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Section header with Add School */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Schools & Facilities</h3>
          <p className="text-sm text-slate-500 mt-0.5">Buildings and outdoor spaces organized by school</p>
        </div>
        <button
          type="button"
          onClick={onAddSchool}
          className="flex items-center gap-2 px-4 py-2.5 min-h-[36px] text-sm font-semibold bg-white text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add School
        </button>
      </div>

      {/* Shared Facilities (top) */}
      <FacilitiesCard
        groupKey="shared"
        title="Shared Facilities"
        subtitle="Available to all schools"
        color={SHARED_COLOR}
        icon={<Users className="w-4 h-4 text-white" />}
        buildings={sharedBuildings}
        outdoorSpaces={sharedOutdoor}
        rooms={rooms}
        schools={schools}
        collapsed={!!collapsed['shared']}
        onToggle={() => toggle('shared')}
        onAddBuilding={() => onAddBuilding([])}
        onEditBuilding={onEditBuilding}
        onDeleteBuilding={onDeleteBuilding}
        onManageRooms={onManageRooms}
        onAddOutdoor={() => onAddOutdoor([])}
        onEditOutdoor={onEditOutdoor}
        onDeleteOutdoor={onDeleteOutdoor}
      />

      {/* One card per school */}
      {schools.map((school) => {
        const sb = buildingsForSchool(school.id)
        const so = outdoorForSchool(school.id)
        return (
          <FacilitiesCard
            key={school.id}
            groupKey={school.id}
            title={school.name}
            subtitle={`${sb.length} building${sb.length === 1 ? '' : 's'} · ${so.length} outdoor space${so.length === 1 ? '' : 's'}`}
            color={school.color}
            icon={<SchoolIcon className="w-4 h-4 text-white" />}
            buildings={sb}
            outdoorSpaces={so}
            rooms={rooms}
            schools={schools}
            collapsed={!!collapsed[school.id]}
            onToggle={() => toggle(school.id)}
            onAddBuilding={() => onAddBuilding([school.id])}
            onEditBuilding={onEditBuilding}
            onDeleteBuilding={onDeleteBuilding}
            onManageRooms={onManageRooms}
            onAddOutdoor={() => onAddOutdoor([school.id])}
            onEditOutdoor={onEditOutdoor}
            onDeleteOutdoor={onDeleteOutdoor}
            onEditSchool={() => onEditSchool(school.id)}
            onDeleteSchool={() => onDeleteSchool(school.id)}
          />
        )
      })}
    </div>
  )
}

// ─── Inner card ───────────────────────────────────────────────────────────

type FacilitiesCardProps = {
  groupKey: GroupKey
  title: string
  subtitle: string
  color: string
  icon: React.ReactNode
  buildings: Building[]
  outdoorSpaces: Area[]
  rooms: Room[]
  schools: SchoolInfo[]
  collapsed: boolean
  onToggle: () => void
  onAddBuilding: () => void
  onEditBuilding: (b: Building) => void
  onDeleteBuilding: (id: string, name: string) => void
  onManageRooms: (b: Building) => void
  onAddOutdoor: () => void
  onEditOutdoor: (a: Area) => void
  onDeleteOutdoor: (id: string, name: string) => void
  /** Only provided for actual school cards, not the "Shared" card */
  onEditSchool?: () => void
  onDeleteSchool?: () => void
}

function FacilitiesCard({
  title,
  subtitle,
  color,
  icon,
  buildings,
  outdoorSpaces,
  rooms,
  schools,
  collapsed,
  onToggle,
  onAddBuilding,
  onEditBuilding,
  onDeleteBuilding,
  onManageRooms,
  onAddOutdoor,
  onEditOutdoor,
  onDeleteOutdoor,
  onEditSchool,
  onDeleteSchool,
}: FacilitiesCardProps) {
  const isEmpty = buildings.length === 0 && outdoorSpaces.length === 0

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      {/* Card header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer text-left"
      >
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: color }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <span className="text-xs text-slate-400">{subtitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onEditSchool && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEditSchool()
              }}
              aria-label="Edit school"
              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {onDeleteSchool && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDeleteSchool()
              }}
              aria-label="Delete school"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {onEditSchool && <div className="w-px h-5 bg-slate-200 mx-1" />}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddBuilding()
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Building
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddOutdoor()
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Outdoor Space
          </button>
          {collapsed ? (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Card body */}
      {!collapsed && (
        <div className="px-5 pb-5">
          {isEmpty ? (
            <div className="text-center py-8 text-sm text-slate-400">
              No buildings or outdoor spaces yet. Use the buttons above to add one.
            </div>
          ) : (
            <div className="space-y-4">
              {buildings.length > 0 && (
                <BuildingsList
                  buildings={buildings}
                  rooms={rooms}
                  schools={schools}
                  onEditBuilding={onEditBuilding}
                  onDeleteBuilding={onDeleteBuilding}
                  onManageRooms={onManageRooms}
                />
              )}
              {outdoorSpaces.length > 0 && (
                <OutdoorList
                  outdoorSpaces={outdoorSpaces}
                  schools={schools}
                  onEditOutdoor={onEditOutdoor}
                  onDeleteOutdoor={onDeleteOutdoor}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Buildings list ───────────────────────────────────────────────────────

function BuildingsList({
  buildings,
  rooms,
  schools,
  onEditBuilding,
  onDeleteBuilding,
  onManageRooms,
}: {
  buildings: Building[]
  rooms: Room[]
  schools: SchoolInfo[]
  onEditBuilding: (b: Building) => void
  onDeleteBuilding: (id: string, name: string) => void
  onManageRooms: (b: Building) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <Building2 className="w-4 h-4 text-slate-400" />
        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Buildings</h4>
        <span className="text-xs text-slate-400">({buildings.length})</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-slate-500 bg-slate-50 border-b border-slate-100">
              <th className="py-2.5 px-4 text-left font-medium">Building</th>
              <th className="py-2.5 px-4 text-left font-medium">Type</th>
              <th className="py-2.5 px-4 text-left font-medium">Rooms</th>
              <th className="py-2.5 px-4 text-left font-medium">Status</th>
              <th className="py-2.5 pl-4 pr-6 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {buildings.map((b) => {
              const roomCount = rooms.filter((r) => r.buildingId === b.id).length
              const sharedWith = b.schools ?? []
              return (
                <tr key={b.id} className="border-b last:border-b-0 hover:bg-slate-50 transition-colors duration-150">
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-slate-900">{b.name}</div>
                    {b.code && <div className="text-xs text-slate-400 mt-0.5">{b.code}</div>}
                    {sharedWith.length > 1 && (
                      <SharedPill schools={sharedWith} allSchools={schools} />
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500 text-xs">{BUILDING_TYPE_LABELS[b.buildingType] || 'General'}</td>
                  <td className="py-2.5 px-4 text-slate-500">{roomCount}</td>
                  <td className="py-2.5 px-4">{renderStatusBadge(b.isActive)}</td>
                  <td className="py-2.5 pl-4 pr-6">
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
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Outdoor list ─────────────────────────────────────────────────────────

function OutdoorList({
  outdoorSpaces,
  schools,
  onEditOutdoor,
  onDeleteOutdoor,
}: {
  outdoorSpaces: Area[]
  schools: SchoolInfo[]
  onEditOutdoor: (a: Area) => void
  onDeleteOutdoor: (id: string, name: string) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <MapPin className="w-4 h-4 text-slate-400" />
        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Outdoor Spaces</h4>
        <span className="text-xs text-slate-400">({outdoorSpaces.length})</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-slate-500 bg-slate-50 border-b border-slate-100">
              <th className="py-2.5 px-4 text-left font-medium">Space</th>
              <th className="py-2.5 px-4 text-left font-medium">Type</th>
              <th className="py-2.5 px-4 text-left font-medium">Status</th>
              <th className="py-2.5 pl-4 pr-6 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {outdoorSpaces.map((a) => {
              const sharedWith = a.schools ?? []
              return (
                <tr key={a.id} className="border-b last:border-b-0 hover:bg-slate-50 transition-colors duration-150">
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-slate-900">{a.name}</div>
                    {sharedWith.length > 1 && (
                      <SharedPill schools={sharedWith} allSchools={schools} />
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{OUTDOOR_TYPE_LABELS[a.areaType] || a.areaType}</td>
                  <td className="py-2.5 px-4">{renderStatusBadge(a.isActive)}</td>
                  <td className="py-2.5 pl-4 pr-6">
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
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Pill for facilities shared across multiple (but not all) schools ─────

function SharedPill({ schools, allSchools }: { schools: { id: string; name: string }[]; allSchools: SchoolInfo[] }) {
  // If shared with all, no pill needed (caller already filters to >1, not all)
  if (schools.length === allSchools.length) return null
  const names = schools.map((s) => s.name).join(', ')
  return (
    <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
      <Users className="w-3 h-3" />
      <span>Shared with {names}</span>
    </div>
  )
}
