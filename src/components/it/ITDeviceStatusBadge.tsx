'use client'

const DEVICE_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
  REPAIR: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'In Repair' },
  LOANER: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Loaner' },
  RETIRED: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Retired' },
  LOST: { bg: 'bg-red-100', text: 'text-red-700', label: 'Lost' },
  DECOMMISSIONED: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Decommissioned' },
}

const DEVICE_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  CHROMEBOOK: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Chromebook' },
  LAPTOP: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Laptop' },
  TABLET: { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Tablet' },
  DESKTOP: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Desktop' },
  MONITOR: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Monitor' },
  PRINTER: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Printer' },
  OTHER: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Other' },
}

const STUDENT_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
  INACTIVE: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Inactive' },
  TRANSFERRED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Transferred' },
  GRADUATED: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Graduated' },
}

export function DeviceStatusBadge({ status }: { status: string }) {
  const c = DEVICE_STATUS_COLORS[status] ?? DEVICE_STATUS_COLORS.ACTIVE
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

export function DeviceTypeBadge({ type }: { type: string }) {
  const c = DEVICE_TYPE_COLORS[type] ?? DEVICE_TYPE_COLORS.OTHER
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

export function StudentStatusBadge({ status }: { status: string }) {
  const c = STUDENT_STATUS_COLORS[status] ?? STUDENT_STATUS_COLORS.ACTIVE
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

export { DEVICE_STATUS_COLORS, DEVICE_TYPE_COLORS, STUDENT_STATUS_COLORS }
