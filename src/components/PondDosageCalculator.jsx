import { useState, useEffect } from 'react'
import { Calculator, ShoppingCart, ExternalLink, AlertTriangle, ChevronDown } from 'lucide-react'
import DrawerModal from './DrawerModal'

const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL?.trim() || 'http://localhost:3001'
const DEFAULT_VOLUME = 5000

/** Aquaculture & reptile care threshold quick reference (from pondConstants) */
const THRESHOLDS = {
  pH: { ideal: '7.0–8.0', warn: '<6.5 or >8.5', danger: '<5.5 or >9.5' },
  temp: { ideal: '65–78°F', warn: '<50 or >85°F', danger: '>90°F (Koi stress)' },
  do: { ideal: '6–9 ppm', warn: '<5 ppm', danger: '<3 ppm (fish kill risk)' },
  turbidity: { ideal: '0–10 NTU', warn: '>25 NTU', danger: '>50 NTU' },
  alkalinity: { ideal: '90–120 ppm', warn: '<50 ppm', danger: '<20 ppm (copper toxicity)' },
}

export default function PondDosageCalculator({ isOpen, onClose, onAddToTicket }) {
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const [treatment, setTreatment] = useState('copper')
  const [alkalinity, setAlkalinity] = useState('')
  const [hasTurtles, setHasTurtles] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setVolume(DEFAULT_VOLUME)
    setTreatment('copper')
    setAlkalinity('')
    setHasTurtles(false)
    setResult(null)
  }, [isOpen])

  const fetchDosage = () => {
    setLoading(true)
    const params = new URLSearchParams({ volume, treatment, turtles: hasTurtles })
    if (alkalinity.trim()) params.set('alkalinity', alkalinity.trim())
    fetch(`${PLATFORM_URL}/api/pond/dosage?${params}`)
      .then((r) => r.json())
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (isOpen && volume > 0) fetchDosage()
  }, [isOpen, volume, treatment, alkalinity, hasTurtles])

  const handleAddToTicket = () => {
    if (!result) return
    const chemical = treatment === 'dye' ? 'Aquatic Dye' : 'Copper Sulfate'
    const oz = treatment === 'dye' ? result.dyeOz : result.copperSulfateOz
    let title = `Pond treatment: Apply ${oz} oz ${chemical} (${volume.toLocaleString()} gal)`
    if (result.error) title = `⚠️ POND: ${result.error}`
    onAddToTicket?.({ title })
    onClose?.()
  }

  const showCopperBlocked = result?.copperBlocked && result?.error

  return (
    <DrawerModal isOpen={isOpen} onClose={onClose} title="Pond Dosage Calculator">
      <div className="space-y-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Calculate safe treatment amounts for aquatic life. Alkalinity required for Copper Sulfate (toxic in soft water).
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
                {Object.entries(THRESHOLDS).map(([k, v]) => (
                  <tr key={k} className="border-b border-zinc-100 dark:border-zinc-700/50">
                    <td className="py-1.5 capitalize">{k}</td>
                    <td className="py-1.5 text-green-600 dark:text-green-400">{v.ideal}</td>
                    <td className="py-1.5 text-amber-600 dark:text-amber-400">{v.warn}</td>
                    <td className="py-1.5 text-red-600 dark:text-red-400">{v.danger}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-zinc-500">
              Copper: Alkalinity &lt;50 ppm → do not use. Max safe ppm = Alkalinity ÷ 100. Turtles: max 0.2 ppm.
            </p>
          </div>
        </details>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Pond Volume (gallons)</label>
          <input
            type="number"
            min="100"
            step="100"
            value={volume}
            onChange={(e) => setVolume(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Treatment</label>
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
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Test kit required. Below 50 ppm = do not use Copper. Max safe dose = Alkalinity ÷ 100 (ppm).
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasTurtles}
                onChange={(e) => setHasTurtles(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-600"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                Pond has turtles (limits Copper to 0.2 ppm max for reptiles)
              </span>
            </label>
            {hasTurtles && (
              <div className="rounded-lg p-3 border border-amber-500/50 bg-amber-500/10 dark:bg-amber-500/20">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Turtle double-check: Cross-referenced with reptile sensitivity. Copper capped at 0.2 ppm.
                </p>
              </div>
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
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  Add this alert to the maintenance ticket as a red banner. Use aquatic dye or aeration instead.
                </p>
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

        {result && !result.copperBlocked && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-medium">
              <Calculator className="w-5 h-5" />
              Recommended Dose
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {treatment === 'dye' ? result.dyeOz : result.copperSulfateOz} oz
              {' '}{treatment === 'dye' ? 'Aquatic Dye' : 'Copper Sulfate'}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{result.recommendation}</p>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-2">School Value Pick (future)</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Grainger/Zoro search: compare price-per-pound across 5lb tub vs 50lb bag. If bulk is 40% cheaper per lb, highlight as &quot;School Value Pick&quot; with 6-month savings.
              </p>
              <a
                href="https://www.google.com/search?q=copper+sulfate+pentahydrate+pond"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400"
              >
                <ExternalLink className="w-4 h-4" />
                Search Copper Sulfate Pentahydrate
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
