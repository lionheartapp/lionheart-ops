'use client'

import type { MapBuilding, OutdoorSpace } from './map-types'
import { DIVISION_COLORS } from './types'

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

export interface MapLegendProps {
  buildings: MapBuilding[]
  outdoorSpaces: OutdoorSpace[]
  schools: { name: string; color: string; gradeLevel?: string }[]
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function MapLegend({ buildings, outdoorSpaces, schools }: MapLegendProps) {
  const hasBuildingsOnMap = buildings.some(b => b.latitude && b.longitude)
  const hasOutdoorsOnMap = outdoorSpaces.some(s => s.lat && s.lng)

  if (!hasBuildingsOnMap && !hasOutdoorsOnMap) return null

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
      <div className="flex items-center gap-3">
        {buildings.some(b => b.latitude && b.longitude && !b.schoolDivision) && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: DIVISION_COLORS.GLOBAL }} />
            <span>Global</span>
          </div>
        )}
        {schools.filter(s => buildings.some(b => b.latitude && b.longitude && b.schoolDivision === s.gradeLevel)).map((s) => (
          <div key={s.name} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span>{s.name}</span>
          </div>
        ))}
        {hasOutdoorsOnMap && (
          <>
            {hasBuildingsOnMap && <span className="text-slate-400">|</span>}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#16a34a' }} />
              <span>Outdoor</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
