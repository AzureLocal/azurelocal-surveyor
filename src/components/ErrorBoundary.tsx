import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Surveyor] Render error:', error, info.componentStack)
  }

  handleReset = () => {
    // Clear persisted state so the next load starts clean
    try {
      localStorage.removeItem('surveyor-state')
    } catch {
      // ignore
    }
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-8">
          <div className="max-w-md w-full rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              A page failed to render. This is usually caused by saved settings from an older version
              that are no longer compatible. Resetting will restore all defaults.
            </p>
            <pre className="text-xs text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 rounded p-3 overflow-auto mb-4 max-h-32">
              {this.state.error.message}
            </pre>
            <button
              onClick={this.handleReset}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Reset saved settings and reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
