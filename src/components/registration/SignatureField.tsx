'use client'

/**
 * SignatureField — E-signature component with drawn and typed modes.
 *
 * - Draw mode (default on mobile/touch): Uses react-signature-canvas.
 *   Canvas auto-sizes to container width at 200px height. "Clear" button resets.
 *   On pen-up (onEnd), exports Base64 PNG and calls onChange.
 *
 * - Type mode (default on desktop): Text input + cursive preview.
 *   Calls onChange on every keystroke.
 *
 * Mobile detection uses window.matchMedia('(pointer: coarse)') to default
 * to draw on touch devices.
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Pen, Type, RotateCcw } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SignatureValue {
  type: 'DRAWN' | 'TYPED'
  data: string
}

interface SignatureFieldProps {
  documentLabel: string
  value?: SignatureValue
  onChange: (sig: SignatureValue) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignatureField({
  documentLabel,
  onChange,
}: SignatureFieldProps) {
  const [mode, setMode] = useState<'DRAWN' | 'TYPED'>('TYPED')
  const [typedName, setTypedName] = useState('')
  const [isEmpty, setIsEmpty] = useState(true)
  const canvasRef = useRef<SignatureCanvas>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Detect touch device on mount and default draw mode for mobile
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
      setMode('DRAWN')
    }
  }, [])

  // Handle drawn signature end
  const handleDrawEnd = useCallback(() => {
    if (!canvasRef.current) return
    if (canvasRef.current.isEmpty()) return

    setIsEmpty(false)
    const dataUrl = canvasRef.current.toDataURL('image/png')
    onChange({ type: 'DRAWN', data: dataUrl })
  }, [onChange])

  // Handle clear
  const handleClear = useCallback(() => {
    canvasRef.current?.clear()
    setIsEmpty(true)
    // Notify parent that signature was cleared
    onChange({ type: 'DRAWN', data: '' })
  }, [onChange])

  // Handle typed name change
  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const name = e.target.value
      setTypedName(name)
      onChange({ type: 'TYPED', data: name })
    },
    [onChange],
  )

  // Switch mode
  const switchToDrawn = useCallback(() => {
    setMode('DRAWN')
    setTypedName('')
  }, [])

  const switchToTyped = useCallback(() => {
    setMode('TYPED')
    canvasRef.current?.clear()
    setIsEmpty(true)
  }, [])

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-900">
          Sign: {documentLabel}
        </p>
        <p className="text-xs text-slate-500">
          By signing below, I agree to the terms of this document.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={switchToDrawn}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
            mode === 'DRAWN'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Pen className="w-3 h-3" />
          Draw
        </button>
        <button
          type="button"
          onClick={switchToTyped}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
            mode === 'TYPED'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Type className="w-3 h-3" />
          Type
        </button>
      </div>

      {/* Draw mode */}
      {mode === 'DRAWN' && (
        <div className="space-y-2">
          <div
            ref={containerRef}
            className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white hover:border-slate-400 transition-colors"
          >
            <SignatureCanvas
              ref={canvasRef}
              penColor="#1a1a2e"
              canvasProps={{
                className: 'w-full',
                height: 200,
                style: { display: 'block', cursor: 'crosshair' },
              }}
              onEnd={handleDrawEnd}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {isEmpty ? 'Draw your signature above' : 'Signature captured'}
            </p>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Type mode */}
      {mode === 'TYPED' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Full name
            </label>
            <input
              type="text"
              value={typedName}
              onChange={handleTypeChange}
              placeholder="Type your full name"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all"
            />
          </div>

          {/* Cursive preview */}
          {typedName && (
            <div className="border border-slate-200 rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-400 mb-1">Preview</p>
              <p
                className="text-2xl text-slate-800 select-none"
                style={{ fontFamily: '"Brush Script MT", "Dancing Script", cursive' }}
              >
                {typedName}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
