import { useState, useEffect } from 'react'
import { Calculator, ShoppingCart, ExternalLink, AlertTriangle, ChevronDown } from 'lucide-react'
import DrawerModal from './DrawerModal'
import { platformFetch } from '../services/platformApi'

const POND_THRESHOLDS = {
  pH: { ideal: '7.0–8.0', warn: '<6.5 or >8.5', danger: '<5.5 or >9.5' },
  temp: { ideal: '65–78°F', warn: '<50 or >85°F', danger: '>90°F (Koi stress)' },
  do: { ideal: '6–9 ppm', warn: '<5 ppm', danger: '<3 ppm (fish kill risk)' },
  turbidity: { ideal: '0–10 NTU', warn: '>25 NTU', danger: '>50 NTU' },
  alkalinity: { ideal: '90–120 ppm', warn: '<50 ppm', danger: '<20 ppm (copper toxicity)' },
}

const POOL_THRESHOLDS = {
  pH: { ideal: '7.2–7.8', warn: '<7.0 or >8.0', danger: '<6.8 or >8.5' },
  chlorine: { ideal: '1–3 ppm', warn: '<0.5 or >4 ppm', danger: '<0.2 or >5 ppm' },
  alkalinity: { ideal: '80–120 ppm', warn: '<60 ppm', danger: '<50 ppm' },
}

const DEFAULT_VOLUME = 5000

export default function WaterDosageCalculator({ isOpen, onClose, onAddToTicket, asset }) {
  const assetType = asset?.type || 'POND'
  const isPool = assetType === 'POOL'
  const defaultVolume = asset?.volumeGallons ?? DEFAULT_VOLUME

  const [volume, setVolume] = useState(defaultVolume)
  const [treatment, setTreatment] = useState(isPool ? 'chlorine' : 'copper')
  const [alkalinity, setAlkalinity] = useState('')
  const [hasTurtles, setHasTurtles] = useState(false)
  const [currentChlorine, setCurrentChlorine] = useState('0')
  const [targetChlorine, setTargetChlorine] = useState('2')
  const [currentPH, setCurrentPH] = useState('')
  const [targetPH, setTargetPH] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setVolume(asset?.volumeGallons ?? DEFAULT_VOLUME)
    setTreatment(isPool ? 'chlorine' : 'copper')
    setAlkalinity('')
    setHasTurtles(false)
    setCurrentChlorine('0')
    setTargetChlorine('2')
    setCurrentPH('')
    setTargetPH('')
    setResult(null)
  }, [isOpen, asset, isPool])

  const fetchDosage = () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('mode', isPool ? 'pool' : 'pond')
    params.set('volume', String(volume))
    if (asset?.id) params.set('waterAssetId', asset.id)
    if (isPool) {
      params.set('currentChlorine', currentChlorine)
      params.set('targetChlorine', targetChlorine)
      if (currentPH.trim()) params.set('currentPH', currentPH.trim())
      if (targetPH.trim()) params.set('targetPH', targetPH.trim())
    } else {
      params.set('treatment', treatment)
      params.set('turtles', hasTurtles)
      if (alkalinity.trim()) params.set('alkalinity', alkalinity.trim())
    }
    platformFetch(`/api/aquatics/dosage?${params}`)
      .then((r) => r.json())
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (isOpen && volume > 0) fetchDosage()
  }, [isOpen, volume, treatment, alkalinity, hasTurtles, currentChlorine, targetChlorine, currentPH, targetPH, isPool])

  const handleAddToTicket = () => {
    if (!result) return
    let title
    if (result.mode === 'pool') {
      const chem = result.chlorineOz > 0 ? `${result.chlorineOz} oz Chlorine` : ''
      const acid = result.acidOz > 0 ? `${result.acidOz} oz Muriatic Acid` : ''
      title = `Pool treatment: ${[chem, acid].filter(Boolean).join(', ')} (${volume.toLocaleString()} gal)`
    } else {
      const chemical = treatment === 'dye' ? 'Aquatic Dye' : 'Copper Sulfate'
      const oz = treatment === 'dye' ? result.dyeOz : result.copperSulfateOz
      title = `Pond treatment: Apply ${oz} oz ${chemical} (${volume.toLocaleString()} gal)`
    }
    if (result.error) title = `⚠️ Water: ${result.error}`
    onAddToTicket?.({ title })
    onClose?.()
  }

  const showCopperBlocked = result?.copperBlocked && result?.error
  const thresholds = isPool ? POOL_THRESHOLDS : POND_THRESHOLDS

  return (
    <DrawerModal
      isOpen={isOpen}
      onClose={onClose}
      title={isPool ? 'Pool Dosage Calculator' : 'Pond Dosage Calculator'}
    >
      <div className="space-y-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {isPool
            ? 'Calculate Chlorine and pH-adjustment doses for pools. Target: pH 7.2–7.8, Chlorine 1–3 ppm.'
            : 'Calculate safe treatment amounts for aquatic life. Alkalinity required for Copper Sulfate.'}
        </p>

        <details className="group rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 overflow-hidden">
          <summary className="flex items-center justify-between px-3 py-2 cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <span>Quick reference: Ideal / Warning / Danger</span>
            <ChevronDown className="w-4 h-4 group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-3 pt-0 text-xs">
            <table className="w-full text-zinc-600 dark:text-zinc-400">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-600">
                  <th className="text-left py-1.5">Parameter</th>
                  <th className="text-left py-1.5">Ideal</th>
                  <th className="text-left py-1.5">Warning</th>
                  <th className="text-left py-1.5">Danger</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(thresholds).map(([k, v]) => (
                  <tr key={k} className="border-b border-zinc-100 dark:border-zinc-700/50">
                    <td className="py-1.5 capitalize">{k}</td>
                    <td className="py-1.5 text-green-600 dark:text-green-400">{v.ideal}</td>
                    <td className="py-1.5 text-amber-600 dark:text-amber-400">{v.warn}</td>
                    <td className="py-1.5 text-red-600 dark:text-red-400">{v.danger}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Volume (gallons)
          </label>
          <input
            type="number"
            min="100"
            step="100"
            value={volume}
            onChange={(e) => setVolume(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
          />
        </div>

        {isPool ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Current Chlorine (ppm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={currentChlorine}
                  onChange={(e) => setCurrentChlorine(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Target Chlorine (ppm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={targetChlorine}
                  onChange={(e) => setTargetChlorine(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Current pH (optional)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="14"
                  placeholder="7.6"
                  value={currentPH}
                  onChange={(e) => setCurrentPH(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Target pH (to lower)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="14"
                  placeholder="7.4"
                  value={targetPH}
                  onChange={(e) => setTargetPH(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Treatment
              </label>
              <select
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
              >
                <option value="copper">Copper Sulfate (algae control)</option>
                <option value="dye">Aquatic Dye (weed/light control)</option>
              </select>
            </div>
            {treatment === 'copper' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Alkalinity (ppm) <span className="text-amber-600">*Required</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 80"
                    value={alkalinity}
                    onChange={(e) => setAlkalinity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasTurtles}
                    onChange={(e) => setHasTurtles(e.target.checked)}
                    className="rounded border-zinc-300 dark:border-zinc-600"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    Pond has turtles (limits Copper to 0.2 ppm max)
                  </span>
                </label>
              </>
            )}
          </>
        )}

        {loading && <p className="text-sm text-zinc-500">Calculating…</p>}

        {showCopperBlocked && (
          <div className="rounded-lg p-4 border-2 border-red-500 bg-red-500/10 dark:bg-red-500/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Hazardous Condition</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{result.error}</p>
                <button
                  type="button"
                  onClick={handleAddToTicket}
                  className="mt-3 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                >
                  Add Alert to Maintenance Ticket
                </button>
              </div>
            </div>
          </div>
        )}

        {result && !result.copperBlocked && (result.chlorineOz > 0 || result.copperSulfateOz > 0 || result.dyeOz > 0 || result.acidOz > 0) && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-medium">
              <Calculator className="w-5 h-5" />
              Recommended Dose
            </div>
            {result.mode === 'pool' ? (
              <>
                {result.chlorineOz > 0 && (
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {result.chlorineOz} oz Liquid Chlorine (12.5%)
                  </p>
                )}
                {result.acidOz > 0 && (
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {result.acidOz} oz Muriatic Acid
                  </p>
                )}
              </>
            ) : (
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {treatment === 'dye' ? result.dyeOz : result.copperSulfateOz} oz{' '}
                {treatment === 'dye' ? 'Aquatic Dye' : 'Copper Sulfate'}
              </p>
            )}
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{result.recommendation}</p>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-2">
                School Value Pick (future)
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Compare price-per-pound across sizes. Bulk 40% cheaper per lb → &quot;School Value Pick&quot;.
              </p>
              <a
                href="https://www.google.com/search?q=pool+chlorine+copper+sulfate+pentahydrate"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400"
              >
                <ExternalLink className="w-4 h-4" />
                Search suppliers
              </a>
            </div>

            <button
              type="button"
              onClick={handleAddToTicket}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              Add to Maintenance Ticket
            </button>
          </div>
        )}
      </div>
    </DrawerModal>
  )
}
