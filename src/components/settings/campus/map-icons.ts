/* ------------------------------------------------------------------ */
/*  Icon/marker creation functions for the campus map                   */
/* ------------------------------------------------------------------ */

import type { MapBuilding, OutdoorSpace } from './map-types'
import { DIVISION_COLORS } from './types'

/* ── Outdoor-specific color mapping ─────────────────────────────────── */

export const OUTDOOR_TYPE_COLORS: Record<string, string> = {
  FIELD: '#16a34a',    // Green
  COURT: '#ea580c',    // Orange
  GYM: '#dc2626',      // Red
  COMMON: '#0891b2',   // Cyan
  PARKING: '#6a6864',  // Gray
  OTHER: '#059669',    // Emerald
}

/* ── Color getters ──────────────────────────────────────────────────── */

export function getBuildingColor(building: MapBuilding, schoolColorByDivision?: Record<string, string>): string {
  return building.school?.color
    || schoolColorByDivision?.[building.schoolDivision || '']
    || DIVISION_COLORS[building.schoolDivision || 'GLOBAL']
    || DIVISION_COLORS.GLOBAL
}

export function getOutdoorColor(space: OutdoorSpace): string {
  return OUTDOOR_TYPE_COLORS[space.areaType] || OUTDOOR_TYPE_COLORS.OTHER
}

/* ── Custom marker icon builders ────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletL = any

/** Circular icon for buildings -- matches school center style but in building color */
export function createBuildingCircleIcon(L: LeafletL, label: string, color = '#2563eb') {
  return L.divIcon({
    className: 'campus-building-marker',
    html: `
      <div style="
        display: flex; align-items: center; justify-content: center;
        transform: translate(-50%, -50%);
      ">
        <div style="
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 50%;
          background: ${color}; border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          flex-shrink: 0;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
            <path d="M9 22V12h6v10"/>
            <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/** Get SVG icon for outdoor spaces based on name and areaType */
export function getOutdoorSvgIcon(name: string, areaType: string): string {
  const nameLower = name.toLowerCase()

  // Check name for keywords first
  if (nameLower.includes('tennis')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M5 19c2-2 4-3 7-3s5 1 7 3"/></svg>'
  }
  if (nameLower.includes('football')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9M5 12h14M8 9h.01M8 15h.01M16 9h.01M16 15h.01"/></svg>'
  }
  if (nameLower.includes('baseball') || nameLower.includes('softball')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M6 12c0 1.5 1 3 2 4M18 12c0 1.5-1 3-2 4M6 12c0-1.5 1-3 2-4M18 12c0-1.5-1-3-2-4"/></svg>'
  }
  if (nameLower.includes('basketball')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>'
  }
  if (nameLower.includes('soccer')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 9v6M15 12h-6M13 10l-2 2M13 14l-2-2"/></svg>'
  }
  if (nameLower.includes('track') || nameLower.includes('running')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><path d="M4 14c1 1 2 1 3 0m-1 2 2-2m3 7s.75-1.5 2-1.5 2 1.5 2 1.5"/></svg>'
  }
  if (nameLower.includes('pool') || nameLower.includes('swim')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10c0 0 1-2 4-2s4 2 4 2M12 10c0 0 1-2 4-2s4 2 4 2M4 14c0 0 1-2 4-2s4 2 4 2M12 14c0 0 1-2 4-2s4 2 4 2"/></svg>'
  }
  if (nameLower.includes('parking')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>'
  }
  if (nameLower.includes('gym') || nameLower.includes('weight')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>'
  }

  // Fallback based on areaType
  switch (areaType) {
    case 'COURT':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="3"/></svg>'
    case 'GYM':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>'
    case 'COMMON':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 1-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
    case 'PARKING':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>'
    case 'FIELD':
    case 'OTHER':
    default:
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c1.1 0 2 .9 2 2 0 2.3 1.5 4.3 3.5 5-2 .7-3.5 2.7-3.5 5 0 1.1-.9 2-2 2s-2-.9-2-2c0-2.3-1.5-4.3-3.5-5 2-.7 3.5-2.7 3.5-5 0-1.1.9-2 2-2z"/></svg>'
  }
}

/** Circular icon for outdoor spaces */
export function createOutdoorIcon(L: LeafletL, name: string, areaType: string, color = '#16a34a') {
  const svgIcon = getOutdoorSvgIcon(name, areaType)

  return L.divIcon({
    className: 'campus-outdoor-marker',
    html: `
      <div style="
        display: flex; align-items: center; justify-content: center;
        transform: translate(-50%, -50%);
      ">
        <div style="
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 50%;
          background: ${color}; border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          flex-shrink: 0;
        ">
          ${svgIcon}
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

export function createOrgIcon(L: LeafletL) {
  return L.divIcon({
    className: 'campus-org-marker',
    html: `
      <div style="
        display: flex; align-items: center; justify-content: center;
        width: 40px; height: 40px; border-radius: 50%;
        background: #dc2626; border: 3px solid white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.35);
        transform: translate(-50%, -50%);
        cursor: grab;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/* ── Polygon label icon ─────────────────────────────────────────────── */

export function createPolygonLabel(L: LeafletL, name: string, color: string) {
  return L.divIcon({
    className: 'campus-polygon-label',
    html: `
      <div style="
        background: ${color}; color: white;
        padding: 2px 8px; border-radius: 4px;
        font-size: 11px; font-weight: 700;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.5);
        transform: translate(-50%, -50%);
        pointer-events: none;
      ">
        ${name}
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}
