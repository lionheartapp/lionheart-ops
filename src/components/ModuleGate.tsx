'use client'

import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled'
import { ReactNode } from 'react'

interface ModuleGateProps {
  moduleId: string
  children: ReactNode
  fallback?: ReactNode
}

function DefaultFallback({ moduleId }: { moduleId: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-1">Module Not Enabled</h3>
      <p className="text-sm text-slate-500 max-w-sm">
        The <span className="font-medium">{moduleId}</span> module is not enabled for your organization.
        Contact your administrator to enable it.
      </p>
    </div>
  )
}

export default function ModuleGate({ moduleId, children, fallback }: ModuleGateProps) {
  const { enabled, loading } = useModuleEnabled(moduleId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!enabled) {
    return <>{fallback ?? <DefaultFallback moduleId={moduleId} />}</>
  }

  return <>{children}</>
}
