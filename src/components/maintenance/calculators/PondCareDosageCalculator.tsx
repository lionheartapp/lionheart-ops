'use client'

import { useState } from 'react'
import { FlaskConical, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { FileInput, SelectedFileChip } from '@/components/ui/FileInput'

/**
 * Pond Care Dosage Calculator
 *
 * Computes the amount of product needed to treat a pond to a target dose.
 * Formula:
 *   dose_mL = (targetPpm * volumeGallons * 3.785) / (concentration / 100 * 1000000)
 *
 * All computation is client-side — no network calls.
 */

export function computeDose(
  targetPpm: number,
  volumeGallons: number,
  concentrationPct: number
): { mL: number; oz: number; tbsp: number } | null {
  if (
    targetPpm <= 0 ||
    volumeGallons <= 0 ||
    concentrationPct <= 0 ||
    concentrationPct > 100
  ) {
    return null
  }

  // Convert gallons to liters (1 gal = 3.785 L), then to mL
  const volumeML = volumeGallons * 3785

  // Dose in mL to achieve targetPpm in the volume
  // ppm = mg/L, concentration in % w/v means g/100mL = g/100mL
  // massNeeded_mg = targetPpm * volumeL
  // volumeProduct_mL = massNeeded_mg / (concentration_pct/100 * 1000 mg/mL)
  const volumeLiters = volumeGallons * 3.785
  const massNeededMg = targetPpm * volumeLiters
  const concentrationMgPerML = (concentrationPct / 100) * 1000
  const doseML = massNeededMg / concentrationMgPerML

  return {
    mL: doseML,
    oz: doseML / 29.5735,
    tbsp: doseML / 14.787,
  }
}

export function computeVolumeGallons(params: {
  shape: string
  manualGallons: number
  lengthFt: number
  widthFt: number
  diameterFt: number
  acres: number
  avgDepthFt: number
}): number | null {
  const { shape, manualGallons, lengthFt, widthFt, diameterFt, acres, avgDepthFt } = params

  if (shape === 'MANUAL') {
    return manualGallons > 0 ? manualGallons : null
  }

  if (avgDepthFt <= 0) return null

  if (shape === 'RECTANGLE') {
    if (lengthFt <= 0 || widthFt <= 0) return null
    return lengthFt * widthFt * avgDepthFt * 7.48052
  }

  if (shape === 'CIRCLE') {
    if (diameterFt <= 0) return null
    const radius = diameterFt / 2
    return Math.PI * radius * radius * avgDepthFt * 7.48052
  }

  if (shape === 'ACRE') {
    if (acres <= 0) return null
    return acres * avgDepthFt * 325851
  }

  return null
}

export default function PondCareDosageCalculator() {
  const [shape, setShape] = useState('MANUAL')
  const [manualGallons, setManualGallons] = useState('')
  const [lengthFt, setLengthFt] = useState('')
  const [widthFt, setWidthFt] = useState('')
  const [diameterFt, setDiameterFt] = useState('')
  const [surfaceAcres, setSurfaceAcres] = useState('')
  const [avgDepthFt, setAvgDepthFt] = useState('')
  const [concentration, setConcentration] = useState('')
  const [targetPpm, setTargetPpm] = useState('')
  const [labelVerified, setLabelVerified] = useState(false)
  const [labelFiles, setLabelFiles] = useState<File[]>([])

  const estimatedVolume = computeVolumeGallons({
    shape,
    manualGallons: parseFloat(manualGallons),
    lengthFt: parseFloat(lengthFt),
    widthFt: parseFloat(widthFt),
    diameterFt: parseFloat(diameterFt),
    acres: parseFloat(surfaceAcres),
    avgDepthFt: parseFloat(avgDepthFt),
  })
  const conc = parseFloat(concentration)
  const ppm = parseFloat(targetPpm)

  const result = estimatedVolume ? computeDose(ppm, estimatedVolume, conc) : null
  const isOverdose = result !== null && result.mL > 500

  return (
    <div className="ui-glass p-6 rounded-2xl bg-amber-50/50 border border-amber-100/50 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <FlaskConical className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Pond Care Dosage Calculator</h3>
          <p className="text-xs text-slate-500">Estimate pond volume and product dose</p>
        </div>
      </div>

      {/* Volume estimate */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Pond shape
          </label>
          <Select
            value={shape}
            onChange={setShape}
            size="sm"
            options={[
              { value: 'MANUAL', label: 'I know the gallons' },
              { value: 'RECTANGLE', label: 'Rectangular pond' },
              { value: 'CIRCLE', label: 'Circular pond' },
              { value: 'ACRE', label: 'Surface acres' },
            ]}
          />
        </div>

        {shape === 'MANUAL' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Pond volume (gallons)
            </label>
            <Input
              type="number"
              min="0"
              step="any"
              value={manualGallons}
              onChange={(e) => setManualGallons(e.target.value)}
              placeholder="e.g. 10000"
              size="sm"
              className="w-full text-sm focus-visible:ring-amber-400"
            />
          </div>
        )}

        {shape === 'RECTANGLE' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Length (ft)
              </label>
              <Input type="number" min="0" step="any" value={lengthFt} onChange={(e) => setLengthFt(e.target.value)} size="sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Width (ft)
              </label>
              <Input type="number" min="0" step="any" value={widthFt} onChange={(e) => setWidthFt(e.target.value)} size="sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Average depth (ft)
              </label>
              <Input type="number" min="0" step="any" value={avgDepthFt} onChange={(e) => setAvgDepthFt(e.target.value)} size="sm" />
            </div>
          </div>
        )}

        {shape === 'CIRCLE' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Diameter (ft)
              </label>
              <Input type="number" min="0" step="any" value={diameterFt} onChange={(e) => setDiameterFt(e.target.value)} size="sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Average depth (ft)
              </label>
              <Input type="number" min="0" step="any" value={avgDepthFt} onChange={(e) => setAvgDepthFt(e.target.value)} size="sm" />
            </div>
          </div>
        )}

        {shape === 'ACRE' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Surface area (acres)
              </label>
              <Input type="number" min="0" step="any" value={surfaceAcres} onChange={(e) => setSurfaceAcres(e.target.value)} size="sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Average depth (ft)
              </label>
              <Input type="number" min="0" step="any" value={avgDepthFt} onChange={(e) => setAvgDepthFt(e.target.value)} size="sm" />
            </div>
          </div>
        )}

        {estimatedVolume !== null && (
          <div className="rounded-xl border border-amber-100 bg-white/70 p-3">
            <p className="text-xs text-slate-500">Estimated volume</p>
            <p className="text-lg font-bold text-amber-900">
              {Math.round(estimatedVolume).toLocaleString()} gallons
            </p>
          </div>
        )}
      </div>

      {/* Product inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Product Concentration (%)
          </label>
          <Input
            type="number"
            min="0"
            max="100"
            step="any"
            value={concentration}
            onChange={(e) => setConcentration(e.target.value)}
            placeholder="e.g. 47.5"
            size="sm"
            className="w-full text-sm focus-visible:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Target Dose (ppm)
          </label>
          <Input
            type="number"
            min="0"
            step="any"
            value={targetPpm}
            onChange={(e) => setTargetPpm(e.target.value)}
            placeholder="e.g. 1.0"
            size="sm"
            className="w-full text-sm focus-visible:ring-amber-400"
          />
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-white/70 p-4">
        <Checkbox
          checked={labelVerified}
          onChange={(e) => setLabelVerified(e.target.checked)}
          label="I verified this target dose against the product label"
          description="The label, SDS, and local environmental rules control chemical use. This calculator only does arithmetic."
        />
      </div>

      <div className="rounded-xl border border-amber-200 bg-white/70 p-4 space-y-3">
        <div>
          <p className="text-xs font-medium text-slate-700">Product label or SDS</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Attach the product info used for this calculation.
          </p>
        </div>
        <FileInput
          accept="application/pdf,image/*"
          multiple
          maxSize={10 * 1024 * 1024}
          compact
          hint="PDF or image up to 10MB"
          onFiles={(files) => setLabelFiles((current) => [...current, ...files])}
        />
        {labelFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {labelFiles.map((file, index) => (
              <SelectedFileChip
                key={`${file.name}-${file.size}-${index}`}
                file={file}
                onRemove={() =>
                  setLabelFiles((current) => current.filter((_, i) => i !== index))
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {result !== null && (
        <div className="bg-white/70 rounded-xl border border-amber-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Calculated Dose
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-lg font-bold text-amber-900">{result.mL.toFixed(2)}</p>
              <p className="text-xs text-amber-700">mL</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-lg font-bold text-amber-900">{result.oz.toFixed(3)}</p>
              <p className="text-xs text-amber-700">fl oz</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-lg font-bold text-amber-900">{result.tbsp.toFixed(2)}</p>
              <p className="text-xs text-amber-700">tbsp</p>
            </div>
          </div>

          {isOverdose && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Large dose — verify with product label before applying.
              </p>
            </div>
          )}

          {!labelVerified && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800 font-medium">
                Verify the label before applying. Do not treat if runoff, wildlife, fish, or licensing rules make the application unsafe.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty / prompt state */}
      {result === null && (manualGallons || lengthFt || widthFt || diameterFt || surfaceAcres || avgDepthFt || concentration || targetPpm) && (
        <p className="text-xs text-slate-400 italic">
          Enter pond volume, concentration, and target dose to see the computed amount.
        </p>
      )}
    </div>
  )
}
