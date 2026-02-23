'use client'

import { useState, useRef } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'

interface SigninModalProps {
  onClose: () => void
}

export default function SigninModal({ onClose }: SigninModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const errorRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!subdomain.trim()) {
        throw new Error('School subdomain is required')
      }

      // First, try to get the organization to verify the subdomain
      const orgResponse = await fetch(
        `/api/organizations/slug-check?slug=${encodeURIComponent(subdomain)}`
      )
      const orgData = await orgResponse.json()

      // Note: slug-check returns valid:false when slug is TAKEN (exists)
      // For signin, we want the slug to exist, so valid:false is actually good!
      if (orgData.data?.valid === true) {
        throw new Error('School subdomain not found')
      }

      // Redirect to the subdomain's login page
      window.location.href = `https://${subdomain}.lionheartapp.com/login`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      errorRef.current?.focus()
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" role="presentation">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full" role="dialog" aria-labelledby="signin-title" aria-modal="true">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 id="signin-title" className="text-lg sm:text-xl font-bold text-gray-900">
            Sign In
          </h2>
          <button
            onClick={onClose}
            className="ui-icon-muted rounded p-1"
            aria-label="Close sign in modal"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                ref={errorRef}
                className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3"
                role="alert"
                aria-live="polite"
                tabIndex={-1}
              >
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="subdomain-signin" className="block text-sm font-medium text-gray-700 mb-2">
                School Subdomain
              </label>
              <div className="relative">
                <input
                  id="subdomain-signin"
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="e.g., mitchell-academy"
                  className="ui-input pr-48"
                  aria-describedby="subdomain-hint"
                  required
                />
                <span className="absolute right-4 top-3 text-gray-500 text-sm pointer-events-none">
                  .lionheartapp.com
                </span>
              </div>
              <p id="subdomain-hint" className="text-xs text-gray-500 mt-1">
                Enter your school's subdomain
              </p>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 text-center bg-blue-50 rounded-lg p-3">
              You'll be redirected to your school's branded login page
            </p>

            <button
              type="submit"
              disabled={loading || !subdomain.trim()}
              className="w-full mt-6 px-4 py-3 min-h-[44px] bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              aria-busy={loading}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Continue to Login
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-3 min-h-[44px] border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
            >
              Cancel
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center">
              Don't have an account yet?
            </p>
            <button
              onClick={() => {
                onClose()
                // Will need to trigger signup modal from parent
              }}
              className="w-full mt-2 px-4 py-3 min-h-[44px] text-blue-600 font-medium hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition"
            >
              Sign Up Here
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
