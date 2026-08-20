import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Stops one broken part of the page taking the whole page with it.
 *
 * React unmounts the entire tree when a render throws, so without a boundary
 * any single failure produced a blank white document — no header, no nav, no CV
 * check, nothing to read and nothing to click. Two real ways in: an index
 * missing a field it was read for, and the globe's chunk failing to download,
 * which on a phone on bad signal is an ordinary event rather than an exotic one.
 *
 * A class, because this is the one thing hooks cannot do.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; label?: string },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Left in the console on purpose: there is no error reporting service here,
    // and a silent failure is harder to explain than a noisy one.
    console.error(`[${this.props.label ?? 'app'}]`, error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    if (this.props.fallback !== undefined) return this.props.fallback
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm font-semibold text-chalk">Something on this page broke</p>
        <p className="mt-1 text-xs text-mist">
          Reloading usually clears it. Your saved jobs are kept in this browser and are not
          affected.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-ghost mt-4 !text-xs"
        >
          Reload
        </button>
      </div>
    )
  }
}
