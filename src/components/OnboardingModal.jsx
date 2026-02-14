import { useState } from 'react'
import { platformFetch } from '../services/platformApi'

const ROLE_OPTIONS = [
  { label: 'Teacher', value: 'Teacher' },
  { label: 'Maintenance', value: 'Maintenance' },
  { label: 'IT Support', value: 'IT Support' },
  { label: 'Administrator', value: 'Administrator' },
]

export default function OnboardingModal({ user, onComplete }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: user?.name || '',
    role: '',
  })

  const handleComplete = async (role) => {
    setLoading(true)
    setError('')
    try {
      const res = await platformFetch('/api/user/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: formData.name.trim() || undefined,
          role: role || formData.role,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Update failed')
      }
      const data = await res.json()
      onComplete?.(data?.user)
    } catch (err) {
      setError(err?.message || 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full p-8 space-y-6 border border-zinc-200 dark:border-zinc-800">
        {step === 1 && (
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Welcome to Lionheart!
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              Let&apos;s confirm how your name appears for staff.
            </p>
            <input
              className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none placeholder-zinc-400"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Full Name"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={() => setStep(2)}
              disabled={!formData.name.trim()}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              What&apos;s your primary role?
            </h2>
            <div className="grid gap-3">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => handleComplete(r.value)}
                  disabled={loading}
                  className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-left font-medium transition-all text-zinc-900 dark:text-zinc-100"
                >
                  {r.label}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
