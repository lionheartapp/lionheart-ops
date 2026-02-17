import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { platformFetch, clearAuthToken } from '../services/platformApi'

const ROLE_OPTIONS = [
  { label: 'Administrator', value: 'Administrator' },
  { label: 'Teacher / Staff', value: 'Teacher' },
  { label: 'Maintenance', value: 'Maintenance' },
  { label: 'IT Support', value: 'IT Support' },
  { label: 'Secretary / Office Staff', value: 'Secretary' },
  { label: 'A/V or Media', value: 'AV' },
  { label: 'Athletics / Coach', value: 'Teacher' },
  { label: 'Viewer (read-only)', value: 'Viewer' },
]

export default function OnboardingModal({ user, orgLogoUrl, orgName, onComplete }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState('')
  const [logoError, setLogoError] = useState(false)
  const showLogo = orgLogoUrl && !logoError

  const handleComplete = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await platformFetch('/api/user/me', {
        method: 'PATCH',
        body: JSON.stringify({
          role: role || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) {
          clearAuthToken()
          router.push('/login?error=session_expired')
          return
        }
        throw new Error(data?.error || 'Update failed')
      }
      onComplete?.(data?.user)
    } catch (err) {
      setError(err?.message || 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full p-8 space-y-6 border border-zinc-200 dark:border-zinc-800">
        <div className="space-y-4">
          {showLogo ? (
            <div className="flex flex-col items-center gap-2">
              <img src={orgLogoUrl} alt={orgName || 'School'} className="h-16 w-auto max-w-[220px] object-contain" referrerPolicy="no-referrer" onError={() => setLogoError(true)} />
              {orgName && <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{orgName}</span>}
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Welcome to Lionheart!
              </h2>
            </div>
          ) : (
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Welcome to Lionheart!
            </h2>
          )}
          <p className="text-zinc-500 dark:text-zinc-400">
            What&apos;s your primary role?
          </p>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
          >
              <option value="">Select your role…</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.label} value={r.value}>
                  {r.label}
                </option>
              ))}
          </select>
            <button
              onClick={() => handleComplete()}
              disabled={loading || !role}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Continue
            </button>
            {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  )
}
