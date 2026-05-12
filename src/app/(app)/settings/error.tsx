'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { logger } from '@/lib/logger'

/**
 * F-029: settings error boundary.
 *
 * The previous version showed a generic "Something went wrong" message that
 * gave the user no actionable signal. This version:
 *   - reads the active tab from the URL so the message names the broken tab
 *   - offers TWO recovery paths: retry the same tab, or jump back to Profile
 *     (Profile has the smallest blast radius if a downstream tab is at fault)
 *   - surfaces the digest hash that Sentry/observability tooling captures so
 *     a support-bound user can quote it
 */
export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [tab, setTab] = useState<string | null>(null)

  useEffect(() => {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), digest: error.digest },
      'Settings error'
    )
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      setTab(sp.get('tab'))
    }
  }, [error])

  const tabLabels: Record<string, string> = {
    profile: 'My Profile',
    'school-info': 'School Information',
    roles: 'Roles',
    teams: 'Teams',
    users: 'Members',
    members: 'Members',
    campus: 'Facilities',
    facilities: 'Facilities',
    'academic-calendar': 'Academic Calendar',
    'add-ons': 'Add-ons',
    integrations: 'Integrations',
    'activity-log': 'Activity Log',
    billing: 'Billing',
  }
  const tabName = tab && tabLabels[tab.toLowerCase()] ? tabLabels[tab.toLowerCase()] : null

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-red-600" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 mb-2">
        {tabName ? `Couldn't load ${tabName}` : 'Settings failed to load'}
      </h2>
      <p className="text-sm text-slate-500 mb-1 max-w-md">
        Something went wrong on this tab.
        {tabName ? ' You can retry, or jump back to your profile while we fix it.' : ' Please try again.'}
      </p>
      {error.digest && (
        <p className="text-[11px] font-mono text-slate-400 mb-6">Reference: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button onClick={reset} className="ui-btn-md ui-btn-primary">
          Try again
        </button>
        {tabName && tabName !== tabLabels.profile && (
          <a href="/settings" className="ui-btn-md ui-btn-secondary">
            Go to My Profile
          </a>
        )}
      </div>
    </div>
  )
}
