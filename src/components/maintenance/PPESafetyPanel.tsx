'use client'

import {
  ShieldAlert,
  Check,
  Phone,
} from 'lucide-react'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PPESafetyPanelProps {
  category?: string
}

// ─── PPE Checklist Items ──────────────────────────────────────────────────────

const PPE_ITEMS = [
  'Nitrile gloves (minimum)',
  'Safety goggles / face shield',
  'N95 respirator mask',
  'Protective coveralls or apron',
  'Closed-toe non-slip footwear',
  'Biohazard waste bags',
]

const SAFETY_STEPS = [
  'Ventilate the area before starting',
  'Follow bloodborne pathogen protocol',
  'Double-bag all contaminated materials',
  'Wash hands thoroughly after removing PPE',
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function PPESafetyPanel({ category: _category }: PPESafetyPanelProps) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-amber-900">PPE & Safety Requirements</h3>
          <p className="text-xs text-amber-700 mt-0.5">Required safety equipment for this task</p>
        </div>
      </div>

      {/* PPE Checklist */}
      <div>
        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Required Equipment</p>
        <ul className="space-y-1.5">
          {PPE_ITEMS.map((item) => (
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
          {SAFETY_STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0 text-amber-700 text-xs font-bold mt-0.5">
                {i + 1}
              </span>
              <span className="text-xs text-amber-800">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Emergency Contact */}
      <div className="flex items-start gap-2 pt-1 border-t border-amber-200">
        <Phone className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <span className="font-semibold">If exposure occurs</span>, contact your supervisor immediately and follow your facility&apos;s emergency response plan.
        </p>
      </div>
    </div>
  )
}
