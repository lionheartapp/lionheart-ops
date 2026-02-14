import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, Check, Clock } from 'lucide-react'

const OSHA_CHECKLIST = [
  { id: 'ppe', label: 'Don appropriate PPE (gloves, gown, face shield as needed)' },
  { id: 'splash', label: 'For toilet/bathroom work: wear face shield or goggles to protect from urine/waste splashing' },
  { id: 'vent', label: 'Ensure area is ventilated' },
  { id: 'spill', label: 'Contain spill / isolate area from others' },
  { id: 'absorb', label: 'Use absorbent material for liquids; place in biohazard bag' },
  { id: 'disinfect', label: 'Apply EPA-registered disinfectant per label instructions' },
  { id: 'contact', label: 'Allow minimum 5 minutes contact time for disinfectant' },
  { id: 'waste', label: 'Dispose of waste in designated biohazard container' },
  { id: 'handwash', label: 'Remove PPE and wash hands thoroughly' },
]

const CONTACT_TIME_SECONDS = 5 * 60 // 5 minutes

export default function SafetyModeOverlay({ onComplete, ticketTitle }) {
  const [checked, setChecked] = useState({})
  const [timerStarted, setTimerStarted] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(CONTACT_TIME_SECONDS)

  const allChecked = OSHA_CHECKLIST.every((item) => checked[item.id])
  const timerComplete = secondsLeft <= 0

  useEffect(() => {
    if (!timerStarted) return
    if (secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [timerStarted, secondsLeft])

  const toggleCheck = (id) => setChecked((c) => ({ ...c, [id]: !c[id] }))

  useEffect(() => {
    if (allChecked && !timerStarted) setTimerStarted(true)
  }, [allChecked, timerStarted])

  const canProceed = allChecked && timerComplete

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-amber-950/95 dark:bg-amber-950/98 p-6 overflow-y-auto"
    >
      <div className="max-w-lg w-full space-y-6">
        <div className="flex items-center gap-3 text-amber-200">
          <ShieldAlert className="w-10 h-10 shrink-0" />
          <div>
            <h1 className="text-xl font-bold">Safety Mode — Biohazard Protocol</h1>
            <p className="text-sm text-amber-300/90 mt-0.5">
              This ticket requires OSHA-compliant procedures before proceeding.
            </p>
            {ticketTitle && (
              <p className="text-xs text-amber-400/80 mt-1 truncate">Ticket: {ticketTitle}</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-amber-600/50 bg-amber-900/30 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-amber-200 uppercase tracking-wider flex items-center gap-2">
            <Check className="w-4 h-4" />
            OSHA-Compliant Checklist
          </h2>
          <p className="text-xs text-amber-300/90">
            Confirm each step before allowing disinfectant contact time to begin.
          </p>
          <ul className="space-y-2">
            {OSHA_CHECKLIST.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleCheck(item.id)}
                  className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    checked[item.id]
                      ? 'bg-amber-500 border-amber-500 text-amber-950'
                      : 'border-amber-500/60 text-transparent hover:border-amber-400'
                  }`}
                  aria-pressed={checked[item.id]}
                >
                  {checked[item.id] && <Check className="w-3 h-3" strokeWidth={3} />}
                </button>
                <span
                  className={`text-sm ${checked[item.id] ? 'text-amber-200 line-through' : 'text-amber-100'}`}
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {allChecked && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-amber-600/50 bg-amber-900/30 p-4"
          >
            <h2 className="text-sm font-semibold text-amber-200 flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4" />
              Disinfectant Contact Time
            </h2>
            <p className="text-xs text-amber-300/90 mb-3">
              Allow 5 minutes for disinfectant to remain wet on surfaces per label instructions.
            </p>
            <div className="flex items-center justify-between gap-4">
              <span className="text-2xl font-mono font-bold text-amber-100 tabular-nums">
                {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}
              </span>
              {!timerComplete ? (
                <span className="text-sm text-amber-300">Keep disinfectant wet…</span>
              ) : (
                <span className="text-sm text-emerald-400 font-medium">Contact time complete</span>
              )}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {canProceed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pt-4"
            >
              <button
                type="button"
                onClick={onComplete}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Check className="w-5 h-5" />
                Proceed to ticket
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>,
    document.body
  )
}
