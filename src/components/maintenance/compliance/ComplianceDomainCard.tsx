'use client'

import { motion } from 'framer-motion'
import {
  Shield,
  Flame,
  Trees,
  Droplets,
  Thermometer,
  ArrowUpFromLine,
  UtensilsCrossed,
  Accessibility,
  Wind,
  Bug,
  ChevronRight,
} from 'lucide-react'
import { cardEntrance } from '@/lib/animations'
import type { ComplianceDomain, ComplianceStatus } from '@prisma/client'
import type { ComplianceDomainMeta } from '@/lib/types/compliance'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComplianceDomainCardRecord {
  id: string
  dueDate: Date | string
  status: ComplianceStatus
  title: string
}

export interface ComplianceDomainCardData {
  id: string | null
  domain: ComplianceDomain
  isEnabled: boolean
  meta: ComplianceDomainMeta
  nextRecord: ComplianceDomainCardRecord | null
  status: ComplianceStatus
  schoolId?: string | null
  notes?: string | null
}

interface ComplianceDomainCardProps {
  data: ComplianceDomainCardData
  onToggle: (domain: ComplianceDomain, isEnabled: boolean) => Promise<void>
  onClick: (data: ComplianceDomainCardData) => void
  isUpdating?: boolean
}

// ─── Domain Icons ─────────────────────────────────────────────────────────────

const DOMAIN_ICONS: Record<ComplianceDomain, typeof Shield> = {
  AHERA: Shield,
  FIRE_SAFETY: Flame,
  PLAYGROUND: Trees,
  LEAD_WATER: Droplets,
  BOILER: Thermometer,
  ELEVATOR: ArrowUpFromLine,
  KITCHEN: UtensilsCrossed,
  ADA: Accessibility,
  RADON: Wind,
  IPM: Bug,
}

const DOMAIN_ICON_COLORS: Record<ComplianceDomain, string> = {
  AHERA: 'text-slate-600',
  FIRE_SAFETY: 'text-red-600',
  PLAYGROUND: 'text-green-600',
  LEAD_WATER: 'text-blue-600',
  BOILER: 'text-orange-600',
  ELEVATOR: 'text-indigo-600',
  KITCHEN: 'text-yellow-600',
  ADA: 'text-purple-600',
  RADON: 'text-teal-600',
  IPM: 'text-primary-600',
}

const DOMAIN_BG_COLORS: Record<ComplianceDomain, string> = {
  AHERA: 'bg-slate-50',
  FIRE_SAFETY: 'bg-red-50',
  PLAYGROUND: 'bg-green-50',
  LEAD_WATER: 'bg-blue-50',
  BOILER: 'bg-orange-50',
  ELEVATOR: 'bg-indigo-50',
  KITCHEN: 'bg-yellow-50',
  ADA: 'bg-purple-50',
  RADON: 'bg-teal-50',
  IPM: 'bg-primary-50',
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const config: Record<ComplianceStatus, { label: string; className: string }> = {
    CURRENT: { label: 'Current', className: 'bg-green-100 text-green-700' },
    DUE_SOON: { label: 'Due Soon', className: 'bg-amber-100 text-amber-700' },
    OVERDUE: { label: 'Overdue', className: 'bg-red-100 text-red-700' },
    NOT_APPLICABLE: { label: 'Not Applicable', className: 'bg-gray-100 text-gray-500' },
    PENDING: { label: 'Pending', className: 'bg-blue-100 text-blue-700' },
  }
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({
  enabled,
  onToggle,
  disabled,
}: {
  enabled: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) onToggle()
      }}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
        enabled ? 'bg-primary-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      aria-checked={enabled}
      role="switch"
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
          enabled ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function ComplianceDomainCard({
  data,
  onToggle,
  onClick,
  isUpdating = false,
}: ComplianceDomainCardProps) {
  const { domain, isEnabled, meta, nextRecord, status } = data
  const Icon = DOMAIN_ICONS[domain]
  const iconColor = DOMAIN_ICON_COLORS[domain]
  const iconBg = DOMAIN_BG_COLORS[domain]

  const dueDateStr = nextRecord
    ? new Date(nextRecord.dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  const daysUntilDue = nextRecord
    ? Math.floor((new Date(nextRecord.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const isOverdue = daysUntilDue !== null && daysUntilDue < 0

  return (
    <motion.div
      variants={cardEntrance}
      onClick={() => onClick(data)}
      className={`ui-glass-hover p-4 cursor-pointer group ${!isEnabled ? 'opacity-60' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <ToggleSwitch
            enabled={isEnabled}
            onToggle={() => onToggle(domain, !isEnabled)}
            disabled={isUpdating}
          />
        </div>
      </div>

      {/* Domain name */}
      <h3 className="text-sm font-semibold text-gray-900 mb-0.5 leading-tight pr-2">
        {meta.label}
      </h3>
      <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">
        {meta.description}
      </p>

      {/* Status + due date */}
      <div className="flex items-center justify-between">
        <StatusBadge status={status} />
        {isEnabled && dueDateStr && (
          <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
            {isOverdue
              ? `${Math.abs(daysUntilDue!)}d overdue`
              : `Due ${dueDateStr}`}
          </span>
        )}
      </div>

      {/* Frequency hint */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {meta.frequencyYears === 1 ? 'Annual' : `Every ${meta.frequencyYears} years`}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400 transition-colors" />
      </div>
    </motion.div>
  )
}
