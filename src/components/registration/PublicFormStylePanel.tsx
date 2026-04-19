'use client'

import { useState } from 'react'
import { Paintbrush, ChevronDown, Eye } from 'lucide-react'
import { readableTextColor } from '@/lib/forms/schemas'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PublicFormStyle = 'MINIMAL' | 'SPLIT' | 'HERO'
export type FormImageSide = 'LEFT' | 'RIGHT'

export interface PublicFormStyleConfig {
  publicStyle: PublicFormStyle
  publicCtaColor: string | null
  publicBgColor: string | null
  publicImageUrl: string | null
  publicImageSide: FormImageSide
}

interface PublicFormStylePanelProps {
  config: PublicFormStyleConfig
  onChange: (patch: Partial<PublicFormStyleConfig>) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND_COLORS = [
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Slate', hex: '#0f172a' },
  { name: 'Sky', hex: '#0284c7' },
]

const BG_PRESETS = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Warm white', hex: '#fdfcfb' },
  { name: 'Warm gray', hex: '#f5f4f0' },
  { name: 'Cool gray', hex: '#f1f5f9' },
  { name: 'Indigo', hex: '#eef2ff' },
  { name: 'Sky', hex: '#f0f9ff' },
  { name: 'Emerald', hex: '#ecfdf5' },
  { name: 'Amber', hex: '#fffbeb' },
  { name: 'Rose', hex: '#fff1f2' },
  { name: 'Dark', hex: '#0f172a' },
]

const LAYOUT_OPTIONS: Array<{
  value: PublicFormStyle
  label: string
  description: string
}> = [
  { value: 'MINIMAL', label: 'Minimal', description: 'Centered card, no image' },
  { value: 'SPLIT', label: 'Split + Image', description: 'Form and image side-by-side' },
  { value: 'HERO', label: 'Hero Banner', description: 'Image banner on top, form below' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function PublicFormStylePanel({ config, onChange }: PublicFormStylePanelProps) {
  const [expanded, setExpanded] = useState(false)

  const ctaColor = config.publicCtaColor || '#4f46e5'
  const bgColor = config.publicBgColor || '#f5f4f0'

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-colors duration-200"
      >
        <Paintbrush className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-semibold text-slate-700 flex-1 text-left">
          Public Form Appearance
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="p-4 space-y-5">
          {/* Layout style */}
          <div>
            <label className="text-xs font-medium text-[#6a6864] mb-2 block">
              Layout Style
            </label>
            <div className="inline-flex rounded-xl border border-[rgba(17,15,10,0.08)] p-0.5 bg-[#fafaf9]">
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ publicStyle: opt.value })}
                  className={`px-3.5 py-2 text-sm rounded-lg cursor-pointer transition-all duration-200 ${
                    config.publicStyle === opt.value
                      ? 'bg-white shadow-sm text-[#1a1915] font-semibold'
                      : 'text-[#6a6864] hover:text-[#1a1915]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#a8a49d] mt-1">
              {LAYOUT_OPTIONS.find((o) => o.value === config.publicStyle)?.description}
            </p>
          </div>

          {/* CTA button color */}
          <div>
            <label className="text-xs font-medium text-[#6a6864] mb-1.5 block">
              CTA Button Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={ctaColor}
                onChange={(e) => onChange({ publicCtaColor: e.target.value })}
                className="h-9 w-10 rounded-lg cursor-pointer border border-[rgba(17,15,10,0.08)]"
              />
              <input
                type="text"
                value={ctaColor}
                onChange={(e) => onChange({ publicCtaColor: e.target.value })}
                className="w-24 rounded-xl border border-[rgba(17,15,10,0.1)] px-2 py-1.5 text-sm font-mono text-[#1a1915]"
              />
              {/* Preview chip */}
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: ctaColor,
                  color: readableTextColor(ctaColor),
                }}
              >
                Register
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {BRAND_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => onChange({ publicCtaColor: c.hex })}
                  title={c.name}
                  className={`h-6 w-6 rounded-full border cursor-pointer transition-all duration-150 ${
                    ctaColor.toLowerCase() === c.hex.toLowerCase()
                      ? 'ring-2 ring-blue-400 ring-offset-1 border-white'
                      : 'border-[rgba(17,15,10,0.1)] hover:ring-1 hover:ring-[rgba(17,15,10,0.2)]'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Background color (Minimal only) */}
          {config.publicStyle === 'MINIMAL' && (
            <div>
              <label className="text-xs font-medium text-[#6a6864] mb-1.5 block">
                Page Background Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => onChange({ publicBgColor: e.target.value })}
                  className="h-9 w-10 rounded-lg cursor-pointer border border-[rgba(17,15,10,0.08)]"
                />
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => onChange({ publicBgColor: e.target.value })}
                  className="w-24 rounded-xl border border-[rgba(17,15,10,0.1)] px-2 py-1.5 text-sm font-mono text-[#1a1915]"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {BG_PRESETS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => onChange({ publicBgColor: c.hex })}
                    title={c.name}
                    className={`h-6 w-6 rounded-full cursor-pointer transition-all duration-150 ${
                      bgColor.toLowerCase() === c.hex.toLowerCase()
                        ? 'ring-2 ring-blue-400 ring-offset-1'
                        : 'ring-1 ring-[rgba(17,15,10,0.1)] hover:ring-[rgba(17,15,10,0.25)]'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
              <p className="text-[11px] text-[#a8a49d] mt-1">
                The color behind the centered form card.
              </p>
            </div>
          )}

          {/* Image controls (Split + Hero) */}
          {config.publicStyle !== 'MINIMAL' && (
            <>
              <div>
                <label className="text-xs font-medium text-[#6a6864] mb-1.5 block">
                  Image URL
                </label>
                <input
                  type="url"
                  value={config.publicImageUrl ?? ''}
                  onChange={(e) =>
                    onChange({ publicImageUrl: e.target.value || null })
                  }
                  placeholder="https://..."
                  className="w-full rounded-xl border border-[rgba(17,15,10,0.1)] px-3 py-2 text-sm font-mono text-[#1a1915] placeholder:text-[#a8a49d]"
                />
              </div>

              {/* Image side toggle (Split only) */}
              {config.publicStyle === 'SPLIT' && (
                <div>
                  <label className="text-xs font-medium text-[#6a6864] mb-1.5 block">
                    Image Side
                  </label>
                  <div className="inline-flex rounded-xl border border-[rgba(17,15,10,0.08)] p-0.5 bg-[#fafaf9]">
                    {(['LEFT', 'RIGHT'] as FormImageSide[]).map((side) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => onChange({ publicImageSide: side })}
                        className={`px-3.5 py-1.5 text-sm rounded-lg cursor-pointer transition-all duration-200 capitalize ${
                          config.publicImageSide === side
                            ? 'bg-white shadow-sm text-[#1a1915] font-semibold'
                            : 'text-[#6a6864] hover:text-[#1a1915]'
                        }`}
                      >
                        {side.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
