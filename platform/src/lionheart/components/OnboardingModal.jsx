import { useState } from 'react'
import { platformFetch } from '../services/platformApi'

const DIVISION_OPTIONS = [
  { label: 'Elementary School', value: 'elementary-school' },
  { label: 'Middle School', value: 'middle-school' },
  { label: 'High School', value: 'high-school' },
  { label: 'Athletics', value: 'athletics' },
  { label: 'Global / All divisions', value: 'global' },
]

// Order: division-like first (per user request), then roles
const ROLE_OPTIONS = [
  { label: 'Administrator', value: 'Administrator' },
  { label: 'Teacher', value: 'Teacher' },
  { label: 'Maintenance', value: 'Maintenance' },
  { label: 'Security', value: 'Security' },
  { label: 'IT', value: 'IT Support' },
  { label: 'AV', value: 'AV' },
  { label: 'Coach', value: 'Coach' },
  { label: 'Secretary / Office Staff', value: 'Secretary' },
  { label: 'Media', value: 'Media' },
  { label: 'Viewer (read-only)', value: 'Viewer' },
]

export default function OnboardingModal({ user, orgLogoUrl, orgName, onComplete }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [division, setDivision] = useState('')
  const [role, setRole] = useState('')
  const [logoError, setLogoError] = useState(false)
  const showLogo = orgLogoUrl && !logoError

  const handleComplete = async () => {
    setLoading(true)
    setError('')
    try {
      const teamIds = []
      if (division) teamIds.push(division)
      const roleDefaultTeam = { Administrator: 'admin', Teacher: 'teachers', Maintenance: 'facilities', Security: 'security', 'IT Support': 'it', AV: 'av', Coach: 'athletics', Secretary: 'admin', Media: 'av', Viewer: null }
      const roleTeam = roleDefaultTeam[role]
      if (roleTeam && !teamIds.includes(roleTeam)) teamIds.push(roleTeam)
      const res = await platformFetch('/api/user/me', {
        method: 'PATCH',
        body: JSON.stringify({
          role: role || undefined,
          teamIds: teamIds.length ? teamIds : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = data?.error || ''
        if (res.status === 401 || /session invalid|sign in again|user not found/i.test(msg)) {
          const { clearAuthToken } = await import('../services/platformApi')
          clearAuthToken()
          if (typeof window !== 'undefined') {
            setError('Redirecting to sign in…')
            window.location.href = '/login'
          }
          return
        }
        throw new Error(msg || 'Update failed')
      }
      const data = await res.json()
      onComplete?.(data?.user)
    } catch (err) {
      const msg = err?.message || 'Something went wrong'
      if (/user not found|sign in again|session invalid/i.test(msg)) {
        const { clearAuthToken } = await import('../services/platformApi')
        clearAuthToken()
        if (typeof window !== 'undefined') window.location.href = '/login'
        return
      }
      setError(msg)
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
            Division or area
          </p>
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Select division…</option>
            {DIVISION_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
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
