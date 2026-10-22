"use client"

import React from "react"
import { Layers, Plus, ChevronLeft } from "lucide-react"

interface MapeamentoEmptyStateProps {
  onBackToHome: () => void
  onCreateFirst: () => void
}

export function MapeamentoEmptyState({
  onBackToHome,
  onCreateFirst,
}: MapeamentoEmptyStateProps) {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-semibold cursor-pointer"
          >
            <ChevronLeft size={16} /> Voltar ao Início
          </button>
          <h1 className="text-base font-semibold text-slate-900 dark:text-white">
            Plataforma de Mapeamentos
          </h1>
          <div className="w-24" />
        </div>
      </header>

      {/* Empty State Screen */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xl shadow-blue-500/5">
            <Layers size={36} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-light text-slate-900 dark:text-white tracking-tight">
              Nenhum Mapeamento Cadastrado
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Crie um novo mapeamento para começar a registrar elementos físicos no galpão
              (como embalagens, avarias segregadas ou materiais) utilizando o sistema de grade Drive-In.
            </p>
          </div>

          <button
            onClick={onCreateFirst}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
          >
            <Plus size={16} /> Criar Primeiro Mapeamento
          </button>
        </div>
      </div>
    </div>
  )
}
