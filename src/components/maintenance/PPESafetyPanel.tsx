'use client'

import {
  ShieldAlert,
  Check,
  Phone,
  OctagonAlert,
} from 'lucide-react'
import { getMaintenanceSafetyGuidance } from '@/lib/maintenance-safety'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PPESafetyPanelProps {
  category?: string
}

// ─── PPE Checklist Items ──────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

export default function PPESafetyPanel({ category }: PPESafetyPanelProps) {
  const guidance = getMaintenanceSafetyGuidance(category)

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-amber-900">{guidance.label}</h3>
          <p className="text-xs text-amber-700 mt-0.5">Review before starting work</p>
        </div>
      </div>

      {/* PPE Checklist */}
      <div>
        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Required Equipment</p>
        <ul className="space-y-1.5">
          {guidance.ppe.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
                <Check className="w-2.5 h-2.5 text-amber-700" />
              </div>
              <span className="text-xs text-amber-800">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Safety Steps */}
      <div>
        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Safety Protocol</p>
        <ol className="space-y-1.5">
          {guidance.steps.map((step, i) => (
            <li key={step} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0 text-amber-700 text-xs font-bold mt-0.5">
                {i + 1}
              </span>
              <span className="text-xs text-amber-800">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <OctagonAlert className="w-3.5 h-3.5 text-red-500" />
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Stop and escalate if</p>
        </div>
        <ul className="space-y-1.5">
          {guidance.stopConditions.map((condition) => (
            <li key={condition} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600 text-xs font-bold mt-0.5">
                !
              </span>
              <span className="text-xs text-red-800">{condition}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Emergency Contact */}
      <div className="flex items-start gap-2 pt-1 border-t border-amber-200">
        <Phone className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          {guidance.note}
        </p>
      </div>
    </div>
  )
}
