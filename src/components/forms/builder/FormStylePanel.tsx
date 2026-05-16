'use client'

import { useState, useRef } from 'react'
import {
  Image as ImageIcon,
  Upload,
  X,
  Loader2,
  LayoutPanelLeft,
  RectangleHorizontal,
  Square,
  ArrowLeftRight,
  Check,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api-client'

type FormLayout = 'MINIMAL' | 'SPLIT' | 'HERO'
type ImageSide = 'LEFT' | 'RIGHT'

/** Convert hex to HSL components */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const h2 = hex.replace('#', '')
  const r = parseInt(h2.slice(0, 2), 16) / 255
  const g = parseInt(h2.slice(2, 4), 16) / 255
  const b = parseInt(h2.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

/** Convert HSL to hex */
function hslToHex(h: number, s: number, l: number): string {
  const s1 = s / 100, l1 = l / 100
  const a = s1 * Math.min(l1, 1 - l1)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l1 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** Generate accessible light background colors from a button color */
function generateBackgrounds(buttonHex: string): Array<{ value: string; label: string }> {
  const { h, s } = hexToHSL(buttonHex)
  return [
    { value: '#ffffff', label: 'White' },
    { value: hslToHex(h, Math.min(s, 30), 97), label: 'Tint' },
    { value: hslToHex(h, Math.min(s, 25), 95), label: 'Light' },
    { value: hslToHex(h, Math.min(s, 20), 92), label: 'Soft' },
    { value: '#f8fafc', label: 'Gray' },
    { value: '#f1f5f9', label: 'Cool' },
  ]
}

/** Generate dark mode backgrounds */
function generateDarkBackgrounds(buttonHex: string): Array<{ value: string; label: string }> {
  const { h, s } = hexToHSL(buttonHex)
  return [
    { value: '#0f172a', label: 'Slate' },
    { value: '#1e293b', label: 'Dark' },
    { value: hslToHex(h, Math.min(s, 30), 12), label: 'Tint' },
    { value: hslToHex(h, Math.min(s, 25), 15), label: 'Accent' },
    { value: '#18181b', label: 'Zinc' },
    { value: '#171717', label: 'Neutral' },
  ]
}

interface FormStylePanelProps {
  formId: string
  publicStyle: FormLayout
  publicImageUrl: string | null
  publicImageSide: ImageSide
  publicCtaColor: string | null
  publicBgColor: string | null
  coverColor: string | null
  logoUrl: string | null
  requireEmail: boolean
  confirmMessage: string | null
  onUpdate: (patch: Record<string, unknown>) => void
}

const LAYOUT_OPTIONS: Array<{ value: FormLayout; label: string; icon: typeof Square; desc: string }> = [
  { value: 'SPLIT', label: 'Split', icon: LayoutPanelLeft, desc: 'Form + image side by side' },
  { value: 'HERO', label: 'Hero', icon: RectangleHorizontal, desc: 'Image on top, form overlaps' },
  { value: 'MINIMAL', label: 'Minimal', icon: Square, desc: 'Clean card, no image' },
]

export default function FormStylePanel({
  formId,
  publicStyle,
  publicImageUrl,
  publicImageSide,
  publicCtaColor,
  publicBgColor,
  coverColor,
  logoUrl,
  requireEmail,
  confirmMessage,
  onUpdate,
}: FormStylePanelProps) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Detect if current background is dark based on luminance
  const isCurrentlyDark = (() => {
    const bg = publicBgColor || '#f8fafc'
    const { l } = hexToHSL(bg)
    return l < 40
  })()

  // Generate background options based on button color + mode
  const bgOptions = isCurrentlyDark
    ? generateDarkBackgrounds(publicCtaColor || '#0f172a')
    : generateBackgrounds(publicCtaColor || '#0f172a')

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return

    setUploading(true)
    // Resize to max 1200px wide to keep payload under 1MB
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const maxW = 1200
      const scale = img.width > maxW ? maxW / img.width : 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/webp', 0.8)
      URL.revokeObjectURL(url)
      onUpdate({ publicImageUrl: dataUrl })
      setUploading(false)
    }
    img.src = url
    e.target.value = ''
  }

  return (
    <div className="divide-y divide-slate-100">
      {/* Header */}
      <div className="px-4 py-3">
        <span className="text-xs font-semibold text-slate-700">Form Style</span>
        <p className="text-[10px] text-slate-400 mt-0.5">Customize how the public form looks</p>
      </div>

      {/* Layout picker */}
      <div className="px-4 py-3 space-y-2">
        <label className="text-[10px] font-medium text-slate-500 block">Layout</label>
        <div className="grid grid-cols-3 gap-1.5">
          {LAYOUT_OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdate({ publicStyle: opt.value })}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all cursor-pointer ${
                  publicStyle === opt.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-[10px] font-medium">{opt.label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-slate-400">
          {LAYOUT_OPTIONS.find((o) => o.value === publicStyle)?.desc}
        </p>
      </div>

      {/* Logo / Header Image */}
      <div className="px-4 py-3 space-y-2">
        <label className="text-[10px] font-medium text-slate-500 block">Logo / Header Image</label>
        <p className="text-[9px] text-slate-400">Shown at the top of the form above the title</p>
        {logoUrl ? (
          <div className="relative rounded-lg overflow-hidden border border-slate-200">
            <div className="flex items-center justify-center p-4 bg-slate-50">
              <img src={logoUrl} alt="Logo" className="h-10 max-w-[160px] object-contain" />
            </div>
            <button
              type="button"
              onClick={() => onUpdate({ logoUrl: null })}
              className="absolute top-1.5 right-1.5 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'image/jpeg,image/png,image/webp,image/svg+xml'
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (!file || file.size > 5 * 1024 * 1024) return

                // SVG: read directly (small)
                if (file.type === 'image/svg+xml') {
                  const reader = new FileReader()
                  reader.onload = () => onUpdate({ logoUrl: reader.result as string })
                  reader.readAsDataURL(file)
                  return
                }

                // Raster: resize to max 400px wide for small payload
                const img = new Image()
                const url = URL.createObjectURL(file)
                img.onload = () => {
                  const maxW = 400
                  const scale = img.width > maxW ? maxW / img.width : 1
                  const canvas = document.createElement('canvas')
                  canvas.width = Math.round(img.width * scale)
                  canvas.height = Math.round(img.height * scale)
                  const ctx = canvas.getContext('2d')
                  ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
                  const dataUrl = canvas.toDataURL('image/webp', 0.85)
                  URL.revokeObjectURL(url)
                  onUpdate({ logoUrl: dataUrl })
                }
                img.src = url
              }
              input.click()
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 border border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium">Upload logo</span>
          </button>
        )}
      </div>

      {/* Image upload (for Split and Hero) */}
      {publicStyle !== 'MINIMAL' && (
        <div className="px-4 py-3 space-y-2">
          <label className="text-[10px] font-medium text-slate-500 block">Cover Image</label>
          {publicImageUrl ? (
            <div className="relative rounded-lg overflow-hidden border border-slate-200">
              <img
                src={publicImageUrl}
                alt="Cover"
                className="w-full h-28 object-cover"
              />
              <button
                type="button"
                onClick={() => onUpdate({ publicImageUrl: null })}
                className="absolute top-1.5 right-1.5 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full h-24 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors cursor-pointer"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span className="text-[10px] font-medium">Upload image</span>
                </>
              )}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleImageUpload}
          />

          {/* Image side (Split only) */}
          {publicStyle === 'SPLIT' && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-500">Image side</span>
              <div className="flex items-center gap-1">
                {(['LEFT', 'RIGHT'] as ImageSide[]).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => onUpdate({ publicImageSide: side })}
                    className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors cursor-pointer ${
                      publicImageSide === side
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-400 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {side === 'LEFT' ? 'Left' : 'Right'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Button Color — presets + custom picker */}
      <div className="px-4 py-3 space-y-3">
        <label className="text-[10px] font-medium text-slate-500 block">Button Color</label>
        <div className="flex flex-wrap gap-1.5 items-center">
          {[
            { value: '#0f172a', label: 'Dark' },
            { value: '#1e40af', label: 'Blue' },
            { value: '#7c3aed', label: 'Purple' },
            { value: '#059669', label: 'Green' },
            { value: '#dc2626', label: 'Red' },
            { value: '#ea580c', label: 'Orange' },
          ].map((c) => {
            const isSelected = (publicCtaColor || '#0f172a') === c.value
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onUpdate({ publicCtaColor: c.value })}
                className={`w-8 h-8 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center ${
                  isSelected ? 'border-indigo-500 ring-2 ring-indigo-200 scale-110' : 'border-transparent hover:border-slate-300'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </button>
            )
          })}
          {/* Custom color picker */}
          <div className="relative">
            {/* eslint-disable-next-line no-restricted-syntax -- color picker input */}
            <input
              type="color"
              value={publicCtaColor || '#0f172a'}
              onChange={(e) => onUpdate({ publicCtaColor: e.target.value })}
              className="absolute inset-0 w-7 h-7 opacity-0 cursor-pointer"
            />
            <div
              className={`w-7 h-7 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-slate-400 cursor-pointer ${
                ![
                  '#0f172a', '#1e40af', '#7c3aed', '#059669', '#dc2626', '#ea580c'
                ].includes(publicCtaColor || '#0f172a') ? 'border-slate-900 border-solid scale-110' : ''
              }`}
              style={![
                '#0f172a', '#1e40af', '#7c3aed', '#059669', '#dc2626', '#ea580c'
              ].includes(publicCtaColor || '#0f172a') ? { backgroundColor: publicCtaColor || '#0f172a' } : undefined}
            >
              {['#0f172a', '#1e40af', '#7c3aed', '#059669', '#dc2626', '#ea580c'].includes(publicCtaColor || '#0f172a') && (
                <span className="text-[9px]">+</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dark Mode Toggle */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-medium text-slate-500">Dark Mode</span>
            <p className="text-[9px] text-slate-400">Dark background, light text</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const isDark = isCurrentlyDark
              if (isDark) {
                // Switch to light
                onUpdate({ publicBgColor: '#f8fafc' })
              } else {
                // Switch to dark — pick a dark bg matching the button color
                const darks = generateDarkBackgrounds(publicCtaColor || '#0f172a')
                onUpdate({ publicBgColor: darks[0].value })
              }
            }}
            className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer ${
              isCurrentlyDark ? 'bg-indigo-500' : 'bg-slate-200'
            }`}
          >
            <div className={`absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
              isCurrentlyDark ? 'translate-x-[16px]' : 'translate-x-[2px]'
            }`} />
          </button>
        </div>
      </div>

      {/* Background — auto-generated from button color */}
      <div className="px-4 py-3 space-y-2">
        <label className="text-[10px] font-medium text-slate-500 block">
          Background {isCurrentlyDark ? '(Dark)' : '(Light)'}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {bgOptions.map((c) => {
            const isSelected = (publicBgColor || '#f8fafc') === c.value
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onUpdate({ publicBgColor: c.value })}
                className={`w-8 h-8 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-200 scale-110'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              >
                {isSelected && (
                  <Check className={`w-3.5 h-3.5 ${isCurrentlyDark ? 'text-white' : 'text-indigo-600'}`} strokeWidth={3} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Settings */}
      <div className="px-4 py-3 space-y-3">
        <label className="text-[10px] font-medium text-slate-500 block">Settings</label>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Require email</span>
          <button
            type="button"
            onClick={() => onUpdate({ requireEmail: !requireEmail })}
            className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer ${
              requireEmail ? 'bg-indigo-500' : 'bg-slate-200'
            }`}
          >
            <div
              className={`absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                requireEmail ? 'translate-x-[16px]' : 'translate-x-[2px]'
              }`}
            />
          </button>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 block mb-1">Confirmation message</span>
          {/* eslint-disable-next-line no-restricted-syntax -- textarea for confirmation message */}
          <textarea
            value={confirmMessage ?? ''}
            onChange={(e) => onUpdate({ confirmMessage: e.target.value || null })}
            placeholder="Your response has been submitted successfully."
            rows={2}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-none transition-colors"
          />
        </div>
      </div>
    </div>
  )
}
