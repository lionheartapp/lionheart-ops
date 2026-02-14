import { useState, useEffect } from 'react'
import { Droplets, AlertTriangle, Calculator, Plus } from 'lucide-react'
import DrawerModal from './DrawerModal'
import PondDosageCalculator from './PondDosageCalculator'

const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL?.trim() || 'http://localhost:3001'

const SAFE = { pHMin: 6.5, pHMax: 8.5, turbidityWarn: 25, doMin: 5.0, alkalinityMin: 50 }

function isOutOfRange(reading) {
  if (!reading) return { pH: false, turbidity: false, do: false, alkalinity: false }
  return {
    pH: reading.pH < SAFE.pHMin || reading.pH > SAFE.pHMax,
    turbidity: reading.turbidity > SAFE.turbidityWarn,
    do: reading.dissolvedOxygen != null && reading.dissolvedOxygen < SAFE.doMin,
    alkalinity: reading.alkalinity != null && reading.alkalinity < SAFE.alkalinityMin,
  }
}

export default function PondHealthWidget({
  onAddToTicket,
  setSupportRequests,
  currentUser,
}) {
  const [latest, setLatest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logFormOpen, setLogFormOpen] = useState(false)
  const [dosageOpen, setDosageOpen] = useState(false)
  const [logSubmitting, setLogSubmitting] = useState(false)

  const fetchLatest = () => {
    fetch(`${PLATFORM_URL}/api/pond-sensor`)
      .then((r) => r.json())
      .then(setLatest)
      .catch(() => setLatest(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchLatest()
    const t = setInterval(fetchLatest, 60000)
    return () => clearInterval(t)
  }, [])

  const handleLogSubmit = async (data) => {
    setLogSubmitting(true)
    try {
      const payload = {
        pH: parseFloat(data.pH),
        turbidity: parseFloat(data.turbidity),
        temperature: parseFloat(data.temperature),
        source: 'manual',
        notes: data.notes,
      }
      if (data.dissolvedOxygen) payload.dissolvedOxygen = parseFloat(data.dissolvedOxygen)
      if (data.alkalinity) payload.alkalinity = parseFloat(data.alkalinity)
      await fetch(`${PLATFORM_URL}/api/pond-sensor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setLogFormOpen(false)
      fetchLatest()
    } finally {
      setLogSubmitting(false)
    }
  }

  const alerts = latest ? isOutOfRange(latest) : {}
  const needsAction = alerts.pH || alerts.turbidity || alerts.do || alerts.alkalinity

  return (
    <>
      <section className="glass-card overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Droplets className="w-5 h-5 text-cyan-500" />
            Pond Health
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLogFormOpen(true)}
              className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Log
            </button>
            <button
              type="button"
              onClick={() => setDosageOpen(true)}
              className="text-sm text-amber-500 hover:text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1"
            >
              <Calculator className="w-4 h-4" />
              Dosage
            </button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
          ) : !latest?.pH && latest?.pH !== 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No readings yet. Log manual readings or connect an IoT probe.
            </p>
          ) : (
            <>
            <div className="grid grid-cols-3 gap-4">
              <div className={`rounded-lg p-3 border ${alerts.pH ? 'border-red-500 bg-red-500/10 dark:bg-red-500/20' : 'border-zinc-200 dark:border-zinc-700'}`}>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">pH</p>
                <p className={`text-xl font-semibold ${alerts.pH ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                  {latest.pH?.toFixed(1) ?? '—'}
                </p>
                <p className="text-[10px] text-zinc-500">Safe: {SAFE.pHMin}–{SAFE.pHMax}</p>
              </div>
              <div className={`rounded-lg p-3 border ${alerts.turbidity ? 'border-red-500 bg-red-500/10 dark:bg-red-500/20' : 'border-zinc-200 dark:border-zinc-700'}`}>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Turbidity (NTU)</p>
                <p className={`text-xl font-semibold ${alerts.turbidity ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                  {latest.turbidity?.toFixed(1) ?? '—'}
                </p>
                <p className="text-[10px] text-zinc-500">Warn: &gt;{SAFE.turbidityWarn} NTU</p>
              </div>
              <div className="rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Temp (°C)</p>
                <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {latest.temperature?.toFixed(1) ?? '—'}
                </p>
              </div>
            </div>
            {(latest.dissolvedOxygen != null || latest.alkalinity != null) && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                {latest.dissolvedOxygen != null && (
                  <div className={`rounded-lg p-3 border ${alerts.do ? 'border-red-500 bg-red-500/10 dark:bg-red-500/20' : 'border-zinc-200 dark:border-zinc-700'}`}>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">DO (ppm)</p>
                    <p className={`text-lg font-semibold ${alerts.do ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                      {latest.dissolvedOxygen?.toFixed(1) ?? '—'}
                    </p>
                    <p className="text-[10px] text-zinc-500">Min: {SAFE.doMin} ppm</p>
                  </div>
                )}
                {latest.alkalinity != null && (
                  <div className={`rounded-lg p-3 border ${alerts.alkalinity ? 'border-red-500 bg-red-500/10 dark:bg-red-500/20' : 'border-zinc-200 dark:border-zinc-700'}`}>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Alkalinity (ppm)</p>
                    <p className={`text-lg font-semibold ${alerts.alkalinity ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>{latest.alkalinity ?? '—'}</p>
                    <p className="text-[10px] text-zinc-500">Min 50 for Copper</p>
                  </div>
                )}
              </div>
            )}

            {alerts.do && (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 dark:bg-red-500/20 border border-red-500/30">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                <div>
                  <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                    Oxygen levels low (Current: {latest.dissolvedOxygen?.toFixed(1)} ppm). Aerator engaged.
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
                    Check for algae die-off or high water temps.
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    (Smart Plug API: will auto-turn on aerator when connected. Push notification to maintenance: high priority.)
                  </p>
                </div>
              </div>
            )}
            {alerts.alkalinity && (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 dark:bg-red-500/20 border border-red-500/30">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Alkalinity too low</strong> ({latest.alkalinity} ppm &lt; 50). Do not apply Copper Sulfate. Use aquatic dye or aeration instead.
                </p>
              </div>
            )}
            {needsAction && !alerts.do && (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Reading outside SafeZone. Use the <strong>Dosage Calculator</strong> for treatment amounts safe for animals.
                </p>
                <button
                  type="button"
                  onClick={() => setDosageOpen(true)}
                  className="ml-auto text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
                >
                  Calculate →
                </button>
              </div>
            )}
            </>
          )}
        </div>
      </section>

      <DrawerModal
        isOpen={logFormOpen}
        onClose={() => setLogFormOpen(false)}
        title="Log Pond Reading"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const f = e.target
            handleLogSubmit({
              pH: f.pH?.value,
              turbidity: f.turbidity?.value,
              temperature: f.temperature?.value,
              dissolvedOxygen: f.dissolvedOxygen?.value,
              alkalinity: f.alkalinity?.value,
              notes: f.notes?.value,
            })
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">pH</label>
            <input name="pH" type="number" step="0.1" min="0" max="14" required placeholder="7.0" className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Turbidity (NTU)</label>
            <input name="turbidity" type="number" step="0.1" min="0" required placeholder="5" className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Temperature (°C)</label>
            <input name="temperature" type="number" step="0.1" required placeholder="20" className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Dissolved Oxygen (ppm) — optional</label>
            <input name="dissolvedOxygen" type="number" step="0.1" min="0" placeholder="7.0" className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm" />
            <p className="text-[10px] text-zinc-500 mt-0.5">Below 5 ppm triggers aerator alert</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Alkalinity (ppm) — for Copper dosing</label>
            <input name="alkalinity" type="number" min="0" placeholder="80" className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm" />
            <p className="text-[10px] text-zinc-500 mt-0.5">Min 50 for Copper Sulfate</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Notes (optional)</label>
            <textarea name="notes" rows={2} className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm resize-none" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={logSubmitting} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-60">
              Save
            </button>
            <button type="button" onClick={() => setLogFormOpen(false)} className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium">
              Cancel
            </button>
          </div>
        </form>
      </DrawerModal>

      <PondDosageCalculator
        isOpen={dosageOpen}
        onClose={() => setDosageOpen(false)}
        onAddToTicket={(payload) => {
          setSupportRequests?.((prev) => [
            ...(prev || []),
            {
              id: Date.now(),
              type: 'Facilities',
              title: payload.title,
              priority: 'normal',
              time: 'Just now',
              submittedBy: currentUser?.name ?? 'Unknown',
              status: 'new',
              createdAt: new Date().toISOString(),
              order: 9999,
            },
          ])
          setDosageOpen(false)
        }}
      />
    </>
  )
}
