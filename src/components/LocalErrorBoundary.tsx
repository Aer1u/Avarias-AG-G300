"use client"

import React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

interface LocalErrorBoundaryProps {
  children: React.ReactNode
  fallbackTitle?: string
  fallbackDescription?: string
  compact?: boolean
  onReset?: () => void
}

interface LocalErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

export class LocalErrorBoundary extends React.Component<
  LocalErrorBoundaryProps,
  LocalErrorBoundaryState
> {
  constructor(props: LocalErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, errorMessage: "" }
  }

  static getDerivedStateFromError(error: Error): LocalErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || "Erro inesperado de renderização",
    }
  }

  componentDidCatch(error: Error) {
    console.error("[NEXUS ErrorBoundary]", error)
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: "" })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={`flex flex-col items-center justify-center text-center bg-slate-950/90 border border-rose-800/50 rounded-xl text-slate-200 ${
            this.props.compact ? "p-3 gap-1.5 h-full w-full" : "p-6 gap-3 h-full w-full"
          }`}
        >
          <AlertCircle size={this.props.compact ? 18 : 26} className="text-rose-400 shrink-0" />
          <p className="text-xs font-bold text-rose-300">
            {this.props.fallbackTitle || "Falha temporária de visualização"}
          </p>
          {!this.props.compact && (
            <p className="text-[11px] text-slate-400 max-w-sm">
              {this.props.fallbackDescription || this.state.errorMessage}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5"
          >
            <RefreshCw size={12} />
            <span>Tentar novamente</span>
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
