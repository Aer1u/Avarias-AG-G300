"use client"

import React from "react"
import { AlertTriangle } from "lucide-react"

export default function DashboardTab() {
  return (
    <div className="space-y-8 relative overflow-hidden">
      {/* Dev Alert Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-amber-500/5 p-8 backdrop-blur-sm">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <AlertTriangle size={160} className="text-amber-500" />
        </div>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider">Módulo em Desenvolvimento</h4>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-400 leading-relaxed max-w-2xl">
              Esta aba do dashboard está sendo implementada para consolidação de indicadores analíticos em tempo real das avarias e processos de paletização da área BR.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
