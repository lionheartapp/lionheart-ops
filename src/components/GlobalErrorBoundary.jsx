import { Component } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { Sentry } from '../instrument'

/**
 * Global error boundary to catch unhandled React errors and show a friendly
 * fallback UI instead of a white screen. Prevents the entire app from crashing
 * when one component fails.
 */
class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('GlobalErrorBoundary caught an error:', error, errorInfo)
    try {
      Sentry?.captureException?.(error, { extra: errorInfo })
    } catch {
      // Ignore if Sentry fails (e.g. not configured)
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const orgName = this.props.orgName || import.meta.env.VITE_ORG_NAME || 'School'
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
          role="alert"
        >
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" aria-hidden />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Something went wrong
              </h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {orgName} Operations encountered an unexpected error. We&apos;ve been notified and are looking into it.
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload the app
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-700">
                  Error details (dev only)
                </summary>
                <pre className="mt-2 p-4 rounded bg-zinc-200 dark:bg-zinc-800 text-xs overflow-auto max-h-40">
                  {this.state.error?.message || String(this.state.error)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default GlobalErrorBoundary
