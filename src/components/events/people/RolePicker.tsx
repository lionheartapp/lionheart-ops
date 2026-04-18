'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { PRESET_TEAM_ROLES } from '@/lib/types/event-project'

interface RolePickerProps {
  value: string
  onChange: (role: string) => void
  eventCustomRoles: string[]
}

export function RolePicker({ value, onChange, eventCustomRoles }: RolePickerProps) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customText, setCustomText] = useState('')
  const allPresets = PRESET_TEAM_ROLES as readonly string[]
  const isPreset = allPresets.includes(value) || eventCustomRoles.includes(value)

  // On mount, if current value is not a preset/event-custom, show custom input
  useEffect(() => {
    if (value && !allPresets.includes(value) && !eventCustomRoles.includes(value)) {
      setShowCustomInput(true)
      setCustomText(value)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCustomConfirm = () => {
    const trimmed = customText.trim()
    if (trimmed) {
      onChange(trimmed)
      setShowCustomInput(false)
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
      <div className="flex flex-wrap gap-2">
        {PRESET_TEAM_ROLES.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => { onChange(preset); setShowCustomInput(false) }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
              !showCustomInput && value === preset
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {preset}
          </button>
        ))}
        {/* Event-specific custom roles as chips */}
        {eventCustomRoles.map((cr) => (
          <button
            key={cr}
            type="button"
            onClick={() => { onChange(cr); setShowCustomInput(false) }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer border border-dashed ${
              !showCustomInput && value === cr
                ? 'bg-blue-600 text-white border-transparent'
                : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'
            }`}
          >
            {cr}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setShowCustomInput(true)
            setCustomText('')
            onChange('')
          }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
            showCustomInput
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          + Custom
        </button>
      </div>
      {showCustomInput && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCustomConfirm() } }}
            placeholder="Enter custom role..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all"
            maxLength={100}
            autoFocus
          />
          <button
            type="button"
            onClick={handleCustomConfirm}
            disabled={!customText.trim()}
            className="px-3 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
