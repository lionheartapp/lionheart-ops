'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, ShieldHalf, Trash2, ArrowLeft, ArrowRight } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import SortableList from '@/components/forms/SortableList'
import DragHandle from '@/components/forms/DragHandle'
import { getFieldTypeMeta } from '@/lib/forms/schemas'
import type { FormPageData, FormFieldData } from './FormBuilder'

interface FormStyleProps {
  formName: string
  publicStyle: string
  publicImageUrl: string | null
  publicImageSide: string
  publicCtaColor: string | null
  publicBgColor: string | null
  coverColor: string | null
  logoUrl: string | null
  isSystem?: boolean
}

interface FormCanvasProps {
  pages: FormPageData[]
  activePageId: string | null
  onSelectPage: (pageId: string) => void
  selectedFieldId: string | null
  onSelectField: (fieldId: string | null) => void
  onReorderFields: (pageId: string, fields: FormFieldData[]) => void
  onRemoveField: (fieldId: string) => void
  onRenamePageTitle: (pageId: string, title: string) => void
  previewMode?: boolean
  formStyle?: FormStyleProps
}

function getIcon(iconName: string, className = 'w-4 h-4') {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[iconName]
  return Icon ? <Icon className={className} strokeWidth={1.5} /> : null
}

// ─── Field preview (what the field looks like on the canvas) ─────────────

function FieldPreview({ field }: { field: FormFieldData }) {
  const meta = getFieldTypeMeta(field.type)

  if (field.type === 'HEADER') {
    return (
      <p className="text-base font-semibold text-slate-800">{field.label || 'Section Heading'}</p>
    )
  }
  if (field.type === 'DIVIDER') {
    return <hr className="border-slate-200" />
  }

  // Standard field preview
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-slate-400">{getIcon(meta.icon, 'w-3.5 h-3.5')}</span>
        <span className="text-xs font-medium text-slate-700">{field.label}</span>
        {field.required && <span className="text-[10px] text-red-400 font-medium">*</span>}
      </div>
      {/* Fake input preview */}
      {(field.type === 'TEXT' || field.type === 'EMAIL' || field.type === 'PHONE' || field.type === 'URL' || field.type === 'NUMBER') && (
        <div className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center">
          <span className="text-xs text-slate-300">{field.placeholder || meta.description}</span>
        </div>
      )}
      {(field.type === 'TEXTAREA') && (
        <div className="h-16 rounded-lg border border-slate-200 bg-slate-50 px-3 pt-2">
          <span className="text-xs text-slate-300">{field.placeholder || 'Enter text...'}</span>
        </div>
      )}
      {(field.type === 'DROPDOWN' || field.type === 'RADIO' || field.type === 'MULTI_SELECT') && (
        <div className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center justify-between">
          <span className="text-xs text-slate-300">{field.options[0] || 'Select...'}</span>
          <LucideIcons.ChevronDown className="w-3.5 h-3.5 text-slate-300" />
        </div>
      )}
      {field.type === 'CHECKBOX' && (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border border-slate-300 bg-white" />
          <span className="text-xs text-slate-500">Yes</span>
        </div>
      )}
      {(field.type === 'DATE' || field.type === 'TIME') && (
        <div className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center justify-between">
          <span className="text-xs text-slate-300">{field.type === 'DATE' ? 'Pick a date' : 'Pick a time'}</span>
          {field.type === 'DATE' ? <LucideIcons.Calendar className="w-3.5 h-3.5 text-slate-300" /> : <LucideIcons.Clock className="w-3.5 h-3.5 text-slate-300" />}
        </div>
      )}
      {field.type === 'RATING' && (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <LucideIcons.Star key={i} className="w-5 h-5 text-slate-200" />
          ))}
        </div>
      )}
      {field.type === 'SCALE' && (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="w-6 h-6 rounded-full border border-slate-200 bg-white flex items-center justify-center">
              <span className="text-[9px] text-slate-400">{i}</span>
            </div>
          ))}
        </div>
      )}
      {field.type === 'FILE' && (
        <div className="h-16 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
          <span className="text-xs text-slate-300">Drop files here</span>
        </div>
      )}
      {field.type === 'SIGNATURE' && (
        <div className="h-20 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
          <span className="text-xs text-slate-300">Sign here</span>
        </div>
      )}
      {(field.type === 'USER_PICKER' || field.type === 'LOCATION_PICKER' || field.type === 'ASSET_PICKER' || field.type === 'GRADE_SELECTOR') && (
        <div className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center justify-between">
          <span className="text-xs text-slate-300">{meta.description}</span>
          <LucideIcons.Search className="w-3.5 h-3.5 text-slate-300" />
        </div>
      )}
    </div>
  )
}

// ─── Canvas Component ───────────────────────────────────────────────────

export default function FormCanvas({
  pages,
  activePageId,
  onSelectPage,
  selectedFieldId,
  onSelectField,
  onReorderFields,
  onRemoveField,
  onRenamePageTitle,
  previewMode = false,
  formStyle,
}: FormCanvasProps) {
  const [previewPageIndex, setPreviewPageIndex] = useState(0)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const activePage = previewMode
    ? pages[previewPageIndex] ?? pages[0]
    : pages.find((p) => p.id === activePageId) ?? pages[0]

  // ─── Preview mode: render with the chosen layout ──────────────────────
  if (previewMode && formStyle) {
    const style = formStyle.publicStyle || 'MINIMAL'
    const imageUrl = formStyle.publicImageUrl
    const imageSide = formStyle.publicImageSide || 'RIGHT'
    const bgColor = formStyle.publicBgColor || '#f8fafc'
    const ctaColor = formStyle.publicCtaColor || '#0f172a'
    const isLeft = imageSide === 'LEFT'
    const totalPages = pages.length
    const isLastPage = previewPageIndex === totalPages - 1

    // Detect dark mode from background luminance
    const isDark = (() => {
      const h = bgColor.replace('#', '')
      if (h.length !== 6) return false
      const r = parseInt(h.slice(0, 2), 16) / 255
      const g = parseInt(h.slice(2, 4), 16) / 255
      const b = parseInt(h.slice(4, 6), 16) / 255
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 0.4
    })()

    // Lighten a hex color by blending toward white
    function lightenHex(hex: string, amount: number): string {
      const h = hex.replace('#', '')
      const r = Math.min(255, Math.round(parseInt(h.slice(0, 2), 16) + (255 - parseInt(h.slice(0, 2), 16)) * amount))
      const g = Math.min(255, Math.round(parseInt(h.slice(2, 4), 16) + (255 - parseInt(h.slice(2, 4), 16)) * amount))
      const b = Math.min(255, Math.round(parseInt(h.slice(4, 6), 16) + (255 - parseInt(h.slice(4, 6), 16)) * amount))
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    // Derived colors for dark mode — ensure WCAG AA contrast (4.5:1 for text)
    const cardBgHex = isDark ? lightenHex(bgColor, 0.18) : '#ffffff'
    const cardBorderHex = isDark ? lightenHex(bgColor, 0.30) : '#e2e8f0'
    const formBg = isDark ? lightenHex(bgColor, 0.10) : '#ffffff'
    const inputBgHex = isDark ? lightenHex(bgColor, 0.22) : '#ffffff'
    const inputBorderHex = isDark ? lightenHex(bgColor, 0.35) : '#e2e8f0'

    // Color classes based on mode — white text on dark, high contrast placeholders
    const textPrimary = isDark ? 'text-white' : 'text-slate-900'
    const textSecondary = isDark ? 'text-slate-200' : 'text-slate-700'
    const textMuted = isDark ? 'text-slate-300' : 'text-slate-400'
    const inputText = isDark ? 'text-white placeholder:text-slate-300' : 'text-slate-900 placeholder:text-slate-400'

    const formFields = (
      <div className="space-y-5">
        {/* Progress */}
        {totalPages > 1 && (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Step {previewPageIndex + 1} of {totalPages}</span>
            </div>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? inputBorderHex : '#f1f5f9' }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${((previewPageIndex + 1) / totalPages) * 100}%`, backgroundColor: ctaColor }} />
            </div>
          </div>
        )}
        {totalPages > 1 && activePage && (
          <h2 className={`text-sm font-semibold ${textSecondary}`}>{activePage.title}</h2>
        )}
        {activePage?.fields.filter((f) => f.isIncluded).map((field) => {
          const meta = getFieldTypeMeta(field.type)
          if (field.type === 'HEADER') return <h3 key={field.id} className={`text-base font-semibold ${textPrimary} pt-2`}>{field.label}</h3>
          if (field.type === 'DIVIDER') return <hr key={field.id} className={`${isDark ? 'border-white/10' : 'border-slate-200'} my-1`} />
          const inputStyle = { backgroundColor: inputBgHex, borderColor: inputBorderHex }
          const inputCls = `w-full h-11 px-3.5 text-sm border rounded-lg ${inputText}`
          return (
            <div key={field.id}>
              <label className={`text-sm font-medium ${textSecondary} block mb-1.5`}>
                {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {field.helpText && <p className={`text-xs ${textMuted} mb-1.5`}>{field.helpText}</p>}
              {(field.type === 'TEXT' || field.type === 'EMAIL' || field.type === 'PHONE' || field.type === 'URL' || field.type === 'NUMBER') && (
                // eslint-disable-next-line no-restricted-syntax
                <input type="text" readOnly placeholder={field.placeholder || meta.description} className={inputCls} style={inputStyle} />
              )}
              {field.type === 'TEXTAREA' && (
                // eslint-disable-next-line no-restricted-syntax
                <textarea readOnly rows={3} placeholder={field.placeholder || ''} className={`w-full px-3.5 py-2.5 text-sm border rounded-lg resize-none ${inputText}`} style={inputStyle} />
              )}
              {(field.type === 'DROPDOWN' || field.type === 'RADIO' || field.type === 'MULTI_SELECT') && (
                // eslint-disable-next-line no-restricted-syntax
                <select disabled className={inputCls} style={inputStyle}><option>Select...</option>{field.options.map((o) => <option key={o}>{o}</option>)}</select>
              )}
              {field.type === 'CHECKBOX' && (
                <label className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <input type="checkbox" disabled className="w-4 h-4 rounded" style={{ borderColor: inputBorderHex }} />
                  <span className={`text-sm ${textSecondary}`}>Yes</span>
                </label>
              )}
              {(field.type === 'DATE' || field.type === 'TIME') && (
                // eslint-disable-next-line no-restricted-syntax
                <input type={field.type === 'DATE' ? 'date' : 'time'} readOnly className={inputCls} style={inputStyle} />
              )}
              {field.type === 'RATING' && (
                <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => <div key={n} className="w-10 h-10 rounded-lg border flex items-center justify-center text-lg" style={{ borderColor: inputBorderHex, color: isDark ? '#94a3b8' : '#cbd5e1' }}>★</div>)}</div>
              )}
              {field.type === 'FILE' && (
                <div className="h-20 rounded-lg border-2 border-dashed flex items-center justify-center text-xs" style={{ borderColor: inputBorderHex, backgroundColor: inputBgHex, color: isDark ? '#94a3b8' : '#94a3b8' }}>Drag and drop files here</div>
              )}
              {field.type === 'SIGNATURE' && (
                <div className="h-24 rounded-lg border-2 border-dashed flex items-center justify-center text-xs" style={{ borderColor: inputBorderHex, backgroundColor: inputBgHex, color: isDark ? '#94a3b8' : '#94a3b8' }}>Click to sign</div>
              )}
              {(field.type === 'USER_PICKER' || field.type === 'LOCATION_PICKER' || field.type === 'ASSET_PICKER' || field.type === 'GRADE_SELECTOR' || field.type === 'SCALE') && (
                // eslint-disable-next-line no-restricted-syntax
                <input type="text" readOnly placeholder={meta.description} className={inputCls} style={inputStyle} />
              )}
            </div>
          )
        })}
        {/* Nav buttons */}
        <div className="flex items-center justify-between pt-3">
          {previewPageIndex > 0 ? (
            <button type="button" onClick={() => setPreviewPageIndex((p) => p - 1)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : <div />}
          <button type="button" onClick={() => { if (!isLastPage) setPreviewPageIndex((p) => p + 1) }} className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer" style={{ backgroundColor: ctaColor }}>
            {isLastPage ? 'Submit' : <>Continue <ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        </div>
      </div>
    )

    // System forms — preview as a drawer (internal UI)
    if (formStyle.isSystem) {
      const drawerW = previewDevice === 'mobile' ? '375px' : '480px'
      const drawerH = previewDevice === 'mobile' ? '667px' : 'calc(100vh - 180px)'

      return (
        <div className="h-full flex flex-col items-center justify-start bg-slate-100 p-6 overflow-y-auto">
          <div className="flex items-center gap-1 mb-4 bg-white border border-slate-200 rounded-full p-0.5">
            {(['desktop', 'mobile'] as const).map((device) => (
              <button key={device} type="button" onClick={() => setPreviewDevice(device)} className={`relative px-3 py-1.5 text-[11px] font-medium rounded-full cursor-pointer transition-colors duration-200 ${previewDevice === device ? 'text-white' : 'text-slate-500'}`}>
                {previewDevice === device && (
                  <motion.div layoutId="preview-device-pill" className="absolute inset-0 bg-slate-900 rounded-full" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />
                )}
                <span className="relative z-10">{device === 'desktop' ? 'Desktop' : 'Mobile'}</span>
              </button>
            ))}
          </div>

          {/* Drawer frame */}
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all duration-300"
            style={{ width: drawerW, maxWidth: '100%', height: drawerH }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-sm font-semibold text-slate-900">{formStyle.formName || 'Form'}</h2>
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                <LucideIcons.X className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-5">
                {totalPages > 1 && (
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                      <span>Step {previewPageIndex + 1} of {totalPages}</span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-900 rounded-full transition-all duration-300" style={{ width: `${((previewPageIndex + 1) / totalPages) * 100}%` }} />
                    </div>
                  </div>
                )}
                {totalPages > 1 && activePage && (
                  <h3 className="text-sm font-semibold text-slate-700">{activePage.title}</h3>
                )}
                {activePage?.fields.filter((f) => f.isIncluded).map((field) => {
                  const meta = getFieldTypeMeta(field.type)
                  if (field.type === 'HEADER') return <h3 key={field.id} className="text-base font-semibold text-slate-800 pt-2">{field.label}</h3>
                  if (field.type === 'DIVIDER') return <hr key={field.id} className="border-slate-200 my-1" />
                  const cls = "w-full h-11 px-3.5 text-sm border border-slate-200 rounded-lg bg-white"
                  return (
                    <div key={field.id}>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">{field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}</label>
                      {field.helpText && <p className="text-xs text-slate-400 mb-1.5">{field.helpText}</p>}
                      {/* eslint-disable-next-line no-restricted-syntax */}
                      {(field.type === 'TEXT' || field.type === 'EMAIL' || field.type === 'PHONE' || field.type === 'URL' || field.type === 'NUMBER' || field.type === 'USER_PICKER' || field.type === 'LOCATION_PICKER' || field.type === 'ASSET_PICKER' || field.type === 'GRADE_SELECTOR' || field.type === 'SCALE') && <input type="text" readOnly placeholder={field.placeholder || meta.description} className={cls} />}
                      {field.type === 'TEXTAREA' && <textarea readOnly rows={3} placeholder={field.placeholder || ''} className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white resize-none" />}
                      {(field.type === 'DROPDOWN' || field.type === 'RADIO' || field.type === 'MULTI_SELECT') && <select disabled className={cls}><option>Select...</option>{field.options.map((o) => <option key={o}>{o}</option>)}</select>}
                      {field.type === 'CHECKBOX' && <label className="flex items-center gap-2.5"><input type="checkbox" disabled className="w-4 h-4 rounded border-slate-300" /><span className="text-sm text-slate-600">Yes</span></label>}
                      {(field.type === 'DATE' || field.type === 'TIME') && <input type={field.type === 'DATE' ? 'date' : 'time'} readOnly className={cls} />}
                      {field.type === 'RATING' && <div className="flex gap-1.5">{[1,2,3,4,5].map((n) => <div key={n} className="w-10 h-10 rounded-lg border border-slate-200 text-slate-300 flex items-center justify-center text-lg">★</div>)}</div>}
                      {field.type === 'FILE' && <div className="h-20 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">Drag and drop files here</div>}
                      {field.type === 'SIGNATURE' && <div className="h-24 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">Click to sign</div>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Drawer footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 flex-shrink-0">
              {previewPageIndex > 0 ? (
                <button type="button" onClick={() => setPreviewPageIndex((p) => p - 1)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer">Back</button>
              ) : <div />}
              <button type="button" onClick={() => { if (!isLastPage) setPreviewPageIndex((p) => p + 1) }} className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg cursor-pointer">
                {isLastPage ? 'Submit' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Build the layout content (custom/public forms only)
    let layoutContent: React.ReactNode

    if (style === 'SPLIT' && imageUrl) {
      if (previewDevice === 'mobile') {
        // Mobile: stacked — short hero image on top, form below
        layoutContent = (
          <div className="h-full overflow-y-auto" style={{ backgroundColor: bgColor }}>
            <div className="w-full h-[180px] relative overflow-hidden">
              <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            </div>
            <div className="px-5 py-6">
              {formStyle.logoUrl && <img src={formStyle.logoUrl} alt="" className="h-10 max-w-[160px] object-contain mb-8 mx-auto" />}
              <h1 className={`text-xl font-bold ${textPrimary} mb-5`}>{formStyle.formName || 'Form'}</h1>
              {formFields}
            </div>
          </div>
        )
      } else {
        // Desktop: side by side
        layoutContent = (
          <div className="h-full flex" style={{ backgroundColor: formBg }}>
            {isLeft && (
              <div className="w-1/2 p-5" style={{ backgroundColor: bgColor }}><img src={imageUrl} alt="" className="w-full h-full object-cover rounded-2xl" /></div>
            )}
            <div className="flex-1 flex items-start justify-center py-10 px-8 overflow-y-auto" style={{ backgroundColor: formBg }}>
              <div className="w-full max-w-md">
                {formStyle.logoUrl && <img src={formStyle.logoUrl} alt="" className="h-10 max-w-[160px] object-contain mb-8 mx-auto" />}
                <h1 className={`text-xl font-bold ${textPrimary} mb-6`}>{formStyle.formName || 'Form'}</h1>
                {formFields}
              </div>
            </div>
            {!isLeft && (
              <div className="w-1/2 p-5" style={{ backgroundColor: bgColor }}><img src={imageUrl} alt="" className="w-full h-full object-cover rounded-2xl" /></div>
            )}
          </div>
        )
      }
    } else if (style === 'HERO' && imageUrl) {
      const heroH = previewDevice === 'mobile' ? 'h-[160px]' : 'h-[200px]'
      const heroPx = previewDevice === 'mobile' ? 'px-4 pb-6' : 'px-4 pb-8'
      const heroP = previewDevice === 'mobile' ? 'p-5' : 'p-6'
      layoutContent = (
        <div className="h-full overflow-y-auto" style={{ backgroundColor: bgColor }}>
          <div className={`w-full ${heroH} relative overflow-hidden`}>
            <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
          <div className={`relative -mt-8 z-10 ${heroPx}`}>
            <div className={`max-w-lg mx-auto rounded-2xl border shadow-lg ${heroP}`} style={{ backgroundColor: cardBgHex, borderColor: cardBorderHex }}>
              {formStyle.logoUrl && <img src={formStyle.logoUrl} alt="" className="h-10 max-w-[160px] object-contain mb-8 mx-auto" />}
              <h1 className={`text-xl font-bold ${textPrimary} mb-5`}>{formStyle.formName || 'Form'}</h1>
              {formFields}
            </div>
          </div>
        </div>
      )
    } else {
      layoutContent = (
        <div className="h-full overflow-y-auto py-8 px-4" style={{ backgroundColor: bgColor }}>
          <div className="max-w-lg mx-auto">
            {formStyle.coverColor && <div className="h-2 rounded-t-2xl" style={{ backgroundColor: formStyle.coverColor }} />}
            <div className="rounded-2xl border shadow-sm p-6" style={{ backgroundColor: cardBgHex, borderColor: cardBorderHex }}>
              {formStyle.logoUrl && <img src={formStyle.logoUrl} alt="" className="h-10 max-w-[160px] object-contain mb-8 mx-auto" />}
              <h1 className={`text-xl font-bold ${textPrimary} mb-5`}>{formStyle.formName || 'Form'}</h1>
              {formFields}
            </div>
          </div>
        </div>
      )
    }

    // Wrap in browser chrome frame
    return (
      <div className="h-full flex flex-col items-center justify-start bg-slate-100 p-6 overflow-y-auto">
        {/* Device toggle */}
        <div className="flex items-center gap-1 mb-4 bg-white border border-slate-200 rounded-full p-0.5">
          {(['desktop', 'mobile'] as const).map((device) => (
            <button
              key={device}
              type="button"
              onClick={() => setPreviewDevice(device)}
              className={`relative px-3 py-1.5 text-[11px] font-medium rounded-full cursor-pointer transition-colors duration-200 ${
                previewDevice === device ? 'text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {previewDevice === device && (
                <motion.div layoutId="preview-device-pill-2" className="absolute inset-0 bg-slate-900 rounded-full" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />
              )}
              <span className="relative z-10">{device === 'desktop' ? 'Desktop' : 'Mobile'}</span>
            </button>
          ))}
        </div>

        {/* Browser frame */}
        <div
          className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all duration-300"
          style={{
            width: previewDevice === 'mobile' ? '375px' : '100%',
            maxWidth: previewDevice === 'mobile' ? '375px' : '1200px',
            height: previewDevice === 'mobile' ? '667px' : 'calc(100vh - 180px)',
          }}
        >
          {/* Browser top bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 flex-shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <div className="flex-1 bg-white border border-slate-200 rounded-md px-3 py-0.5 text-[10px] text-slate-400 truncate text-center">
              {typeof window !== 'undefined' ? `${window.location.origin}/f/${formStyle.formName?.toLowerCase().replace(/\s+/g, '-') || 'form'}` : 'lionheartapp.com/f/form'}
            </div>
          </div>

          {/* Form content */}
          <div className="flex-1 overflow-hidden">
            {layoutContent}
          </div>
        </div>
      </div>
    )
  }

  // ─── Edit mode ────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Page tabs (edit mode only) */}
      {!previewMode && pages.length > 1 && (
        <div className="flex items-center gap-1 mb-6 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {pages.map((page, i) => (
            <button
              key={page.id}
              type="button"
              onClick={() => onSelectPage(page.id)}
              className={`relative px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-colors duration-200 ${
                page.id === activePageId
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {page.id === activePageId && (
                <motion.div
                  layoutId="form-page-tab-pill"
                  className="absolute inset-0 bg-slate-900 rounded-full"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10">{page.title || `Page ${i + 1}`}</span>
            </button>
          ))}
        </div>
      )}

      {/* Progress bar (preview mode) */}
      {previewMode && pages.length > 1 && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Step {previewPageIndex + 1} of {pages.length}</span>
          </div>
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-900 rounded-full transition-all duration-300"
              style={{ width: `${((previewPageIndex + 1) / pages.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Page heading */}
      {activePage && (
        <div className="mb-6">
          {previewMode ? (
            <h2 className="text-lg font-bold text-slate-900">{activePage.title}</h2>
          ) : (
            /* eslint-disable-next-line no-restricted-syntax -- inline editable page title */
            <input
              type="text"
              value={activePage.title}
              onChange={(e) => onRenamePageTitle(activePage.id, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="text-lg font-bold text-slate-900 bg-transparent border-none outline-none ring-0 px-0 py-0.5 w-full"
              style={{ borderRadius: 0, boxShadow: 'none' }}
              placeholder="Page title"
            />
          )}
          {activePage.description && (
            <p className="text-sm text-slate-500 mt-1">{activePage.description}</p>
          )}
        </div>
      )}

      {/* Fields — Preview mode: render like the public form */}
      {previewMode && activePage && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          {activePage.fields
            .filter((f) => f.isIncluded)
            .map((field) => {
              const meta = getFieldTypeMeta(field.type)
              if (field.type === 'HEADER') return <h3 key={field.id} className="text-base font-semibold text-slate-800 pt-2">{field.label}</h3>
              if (field.type === 'DIVIDER') return <hr key={field.id} className="border-slate-200 my-1" />

              const inputCls = "w-full h-11 px-3.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"

              return (
                <div key={field.id}>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  {field.helpText && <p className="text-xs text-slate-400 mb-1.5">{field.helpText}</p>}

                  {(field.type === 'TEXT' || field.type === 'EMAIL' || field.type === 'PHONE' || field.type === 'URL' || field.type === 'NUMBER') && (
                    // eslint-disable-next-line no-restricted-syntax -- preview render
                    <input type="text" readOnly placeholder={field.placeholder || meta.description} className={inputCls} />
                  )}
                  {field.type === 'TEXTAREA' && (
                    // eslint-disable-next-line no-restricted-syntax -- preview render
                    <textarea readOnly rows={3} placeholder={field.placeholder || 'Enter text...'} className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white resize-none" />
                  )}
                  {(field.type === 'DROPDOWN' || field.type === 'RADIO' || field.type === 'MULTI_SELECT') && (
                    // eslint-disable-next-line no-restricted-syntax -- preview render
                    <select disabled className={inputCls}>
                      <option>Select...</option>
                      {field.options.map((opt) => <option key={opt}>{opt}</option>)}
                    </select>
                  )}
                  {field.type === 'CHECKBOX' && (
                    <label className="flex items-center gap-2.5">
                      {/* eslint-disable-next-line no-restricted-syntax -- preview */}
                      <input type="checkbox" disabled className="w-4 h-4 rounded border-slate-300" />
                      <span className="text-sm text-slate-600">Yes</span>
                    </label>
                  )}
                  {(field.type === 'DATE' || field.type === 'TIME') && (
                    // eslint-disable-next-line no-restricted-syntax -- preview
                    <input type={field.type === 'DATE' ? 'date' : 'time'} readOnly className={inputCls} />
                  )}
                  {field.type === 'RATING' && (
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className="w-10 h-10 rounded-lg border border-slate-200 text-slate-300 flex items-center justify-center text-lg">★</div>
                      ))}
                    </div>
                  )}
                  {field.type === 'SCALE' && (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <div key={n} className="w-8 h-8 rounded-full border border-slate-200 text-xs font-medium text-slate-500 flex items-center justify-center">{n}</div>
                      ))}
                    </div>
                  )}
                  {field.type === 'FILE' && (
                    <div className="h-20 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
                      Drag and drop files here, or click to browse
                    </div>
                  )}
                  {field.type === 'SIGNATURE' && (
                    <div className="h-24 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
                      Click to sign
                    </div>
                  )}
                  {(field.type === 'USER_PICKER' || field.type === 'LOCATION_PICKER' || field.type === 'ASSET_PICKER' || field.type === 'GRADE_SELECTOR') && (
                    // eslint-disable-next-line no-restricted-syntax -- preview
                    <input type="text" readOnly placeholder={meta.description} className={inputCls} />
                  )}
                </div>
              )
            })}
        </div>
      )}

      {/* Fields — Edit mode: sortable builder cards */}
      {!previewMode && activePage && (
        <SortableList
          items={activePage.fields}
          keyFn={(f) => f.id}
          onReorder={(reordered) => onReorderFields(activePage.id, reordered)}
          className="space-y-3"
          renderItem={(field, _index, { listeners, attributes }) => {
            const isSelected = field.id === selectedFieldId
            const isToggledOff = !field.isIncluded

            return (
              previewMode ? (
                // Preview mode — clean, no editing UI, skip toggled-off fields
                !isToggledOff ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <FieldPreview field={field} />
                  </div>
                ) : null
              ) : (
                // Edit mode — full editing UI
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectField(field.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onSelectField(field.id) }}
                  className={`relative bg-white rounded-xl border p-4 transition-all duration-150 cursor-pointer group ${
                    isSelected
                      ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  } ${isToggledOff ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {/* Drag handle */}
                    <div className="pt-0.5">
                      <DragHandle listeners={listeners} attributes={attributes} />
                    </div>

                    {/* Field content */}
                    <div className="flex-1 min-w-0">
                      <FieldPreview field={field} />
                    </div>

                    {/* Protection badges + actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {field.protection === 'LOCKED' && (
                        <span title="Required by the system" className="text-slate-400">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {field.protection === 'DEFAULT' && (
                        <span title="System default — can be toggled off" className="text-slate-400">
                          <ShieldHalf className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {field.protection === 'CUSTOM' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveField(field.id)
                          }}
                          className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Delete field"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Toggled-off indicator */}
                  {isToggledOff && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                      <LucideIcons.AlertTriangle className="w-3 h-3" />
                      Not shown to users
                    </div>
                  )}
                </div>
              )
            )
          }}
        />
      )}

      {/* Empty state (edit mode only) */}
      {!previewMode && activePage && activePage.fields.length === 0 && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-10 text-center mt-4">
          <LucideIcons.LayoutList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">No fields yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Click a field type in the left panel to add it.
          </p>
        </div>
      )}

      {/* Continue/Back buttons (preview mode) */}
      {previewMode && pages.length > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
          {previewPageIndex > 0 ? (
            <button
              type="button"
              onClick={() => setPreviewPageIndex((p) => p - 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={() => {
              if (previewPageIndex < pages.length - 1) {
                setPreviewPageIndex((p) => p + 1)
              }
            }}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {previewPageIndex === pages.length - 1 ? 'Submit' : (
              <>Continue <ArrowRight className="w-3.5 h-3.5" /></>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
