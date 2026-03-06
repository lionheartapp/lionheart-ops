'use client'

import { useState } from 'react'
import { FlaskConical, AlertTriangle } from 'lucide-react'

/**
 * Pond Care Dosage Calculator
 *
 * Computes the amount of product needed to treat a pond to a target dose.
 * Formula:
 *   dose_mL = (targetPpm * volumeGallons * 3.785) / (concentration / 100 * 1000000)
 *
 * All computation is client-side — no network calls.
 */

function computeDose(
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

export default function PondCareDosageCalculator() {
  const [volume, setVolume] = useState('')
  const [concentration, setConcentration] = useState('')
  const [targetPpm, setTargetPpm] = useState('')

  const vol = parseFloat(volume)
  const conc = parseFloat(concentration)
  const ppm = parseFloat(targetPpm)

  const result = computeDose(ppm, vol, conc)
  const isOverdose = result !== null && result.mL > 500

  return (
    <div className="ui-glass p-6 rounded-2xl bg-amber-50/50 border border-amber-100/50 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <FlaskConical className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Pond Care Dosage Calculator</h3>
          <p className="text-xs text-gray-500">Calculate product dose for your pond volume</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Pond Volume (gallons)
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            placeholder="e.g. 10000"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Product Concentration (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="any"
            value={concentration}
            onChange={(e) => setConcentration(e.target.value)}
            placeholder="e.g. 47.5"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Target Dose (ppm)
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={targetPpm}
            onChange={(e) => setTargetPpm(e.target.value)}
            placeholder="e.g. 1.0"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
          />
        </div>
      </div>

      {/* Results */}
      {result !== null && (
        <div className="bg-white/70 rounded-xl border border-amber-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
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
        </div>
      )}

      {/* Empty / prompt state */}
      {result === null && (volume || concentration || targetPpm) && (
        <p className="text-xs text-gray-400 italic">
          Enter all three values to see the computed dose.
        </p>
      )}
    </div>
  )
}
