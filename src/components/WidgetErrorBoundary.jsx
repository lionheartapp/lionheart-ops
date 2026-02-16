import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Sentry } from '../instrument'

/**
 * Granular error boundary for widgets/sections so a failing component
 * (e.g. Pond Widget) doesn't crash the entire dashboard.
 */
class WidgetErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('WidgetErrorBoundary caught:', error, errorInfo)
    try {
      Sentry?.captureException?.(error, { extra: errorInfo })
    } catch {
      // ignore
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="glass-card p-6 flex flex-col items-center justify-center gap-3 min-h-[120px]"
          role="alert"
        >
          <AlertTriangle className="w-8 h-8 text-amber-500 dark:text-amber-400 shrink-0" />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            This widget encountered an error
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600"
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

export default WidgetErrorBoundary
