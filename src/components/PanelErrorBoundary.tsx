'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface PanelErrorBoundaryProps {
  children: ReactNode
  /** Label shown in the fallback UI (e.g., "Activity Feed", "AI Diagnostics") */
  label?: string
}

interface PanelErrorBoundaryState {
  hasError: boolean
}

/**
 * Catches render errors in a panel without crashing the entire page.
 * Shows a compact fallback with retry button.
 */
export default class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): PanelErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[PanelErrorBoundary${this.props.label ? ` – ${this.props.label}` : ''}]`, error, errorInfo?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-6 h-6 text-slate-400 mb-2" />
          <p className="text-sm font-medium text-slate-600 mb-1">
            {this.props.label ? `${this.props.label} failed to load` : 'Something went wrong'}
          </p>
          <p className="text-xs text-slate-400 mb-3">This section encountered an error.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
