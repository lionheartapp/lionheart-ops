'use client'

import { Component, type ReactNode, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { MotionConfig } from 'framer-motion'
import { useITPermissions } from '@/lib/hooks/useITPermissions'
import { ShieldAlert, RefreshCw } from 'lucide-react'

// ─── Error Boundary ──────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode
  resetKey: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ITErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto mt-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-4">
            An unexpected error occurred. Try again or navigate to a different page.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

function ErrorBoundaryWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const resetKey = `${pathname}?${searchParams?.toString() ?? ''}`
  return <ITErrorBoundary resetKey={resetKey}>{children}</ITErrorBoundary>
}

function ITPageShellInner({ children }: { children: ReactNode }) {
  const { loaded, canManage, canSubmit } = useITPermissions()

  // The parent (app)/layout.tsx already provides DashboardLayout with the
  // sidebar, auth gate, and org context. ITPageShell only adds IT-specific
  // permission gating, error boundary, and MotionConfig.

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    )
  }

  if (!canManage && !canSubmit) {
    return (
      <div className="max-w-md mx-auto mt-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Access Required</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          You don&apos;t have permission to access the IT Help Desk. Ask your administrator to
          update your role in <span className="font-medium text-slate-700">Settings &gt; Members</span>.
        </p>
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundaryWrapper>{children}</ErrorBoundaryWrapper>
    </MotionConfig>
  )
}

export default function ITPageShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    }>
      <ITPageShellInner>{children}</ITPageShellInner>
    </Suspense>
  )
}
