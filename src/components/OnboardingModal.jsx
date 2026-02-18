import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { platformFetch, clearAuthToken, getAuthToken } from '../services/platformApi'

const DIVISION_OPTIONS = [
  { label: 'High School', value: 'High School' },
  { label: 'Middle School', value: 'Middle School' },
  { label: 'Elementary School', value: 'Elementary School' },
  { label: 'Global', value: 'Global' },
  { label: 'Athletics', value: 'Athletics' },
]

const ROLE_OPTIONS = [
  { label: 'Administration', value: 'Administration' },
  { label: 'Teacher', value: 'Teacher' },
  { label: 'Staff', value: 'Staff' },
  { label: 'Maintenance', value: 'Maintenance' },
  { label: 'IT Support', value: 'IT Support' },
  { label: 'Secretary', value: 'Secretary' },
  { label: 'Office Staff', value: 'Office Staff' },
  { label: 'A/V', value: 'A/V' },
  { label: 'Athletics', value: 'Athletics' },
  { label: 'Coach', value: 'Coach' },
  { label: 'Security', value: 'Security' },
  { label: 'Viewer', value: 'Viewer' },
]

export default function OnboardingModal({ user, orgLogoUrl, orgName, onComplete }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [division, setDivision] = useState('')
  const [role, setRole] = useState('')
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [sport, setSport] = useState('')
  const [logoError, setLogoError] = useState(false)
  const showLogo = orgLogoUrl && !logoError

  const showTeacherFields = role === 'Teacher'
  const showCoachField = role === 'Coach'
  const canContinue = division && role && (!showTeacherFields || (grade.trim() && subject.trim())) && (!showCoachField || sport.trim())

  const handleComplete = async () => {
    if (!getAuthToken()) {
      setError('Your session expired. Redirecting to sign in…')
      clearAuthToken()
      setTimeout(() => router.push('/login?error=session_expired'), 800)
      return
    }
    setLoading(true)
    setError('')
    try {
      const payload = {
        division: division || undefined,
        role: role === 'Administration' ? 'Administrator' : role,
        ...(showTeacherFields && { grade: grade.trim() || undefined, subject: subject.trim() || undefined }),
        ...(showCoachField && { sport: sport.trim() || undefined }),
      }
      const res = await platformFetch('/api/user/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) {
          setError('Your session expired. Please sign in again.')
          clearAuthToken()
          setTimeout(() => router.push('/login?error=session_expired'), 1500)
          return
        }
        setError(data?.error || 'Update failed')
        setLoading(false)
        return
      }
      onComplete?.(data?.user)
    } catch (err) {
      setError(err?.message || 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full p-8 space-y-6 border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
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
            Which area do you work in?
          </p>
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Select…</option>
            {DIVISION_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>

          <p className="text-zinc-500 dark:text-zinc-400">
            What&apos;s your primary role?
          </p>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value)
              setGrade('')
              setSubject('')
              setSport('')
            }}
            className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Select your role…</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.label} value={r.value}>{r.label}</option>
            ))}
          </select>

          {showTeacherFields && (
            <>
              <p className="text-zinc-500 dark:text-zinc-400">What grade do you teach?</p>
              <input
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="e.g. 9th, 10th, or 3rd"
                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-zinc-500 dark:text-zinc-400">What subject?</p>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Math, English, Science"
                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </>
          )}

          {showCoachField && (
            <>
              <p className="text-zinc-500 dark:text-zinc-400">What sport do you coach?</p>
              <input
                type="text"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                placeholder="e.g. Football, Basketball, Soccer"
                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </>
          )}

          <button
            onClick={() => handleComplete()}
            disabled={loading || !canContinue}
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
