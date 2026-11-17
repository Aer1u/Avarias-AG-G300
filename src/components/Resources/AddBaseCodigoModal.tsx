// ============================================================
// NEXUS ERP — Resources / AddBaseCodigoModal.tsx
// Modal oficial para Cadastrar Produto na tabela base_codigos
// Reproduz fielmente a interface canônica do sistema
// ============================================================

"use client"

import React, { useState } from "react"
import { insertBaseCodigo, type BaseCodigoItem } from "./baseCodigosService"

interface AddBaseCodigoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (createdItem: BaseCodigoItem) => void
}

export default function AddBaseCodigoModal({
  isOpen,
  onClose,
  onSuccess,
}: AddBaseCodigoModalProps) {
  const [codigo, setCodigo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [grade, setGrade] = useState("")
  const [tipo, setTipo] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codigo.trim() || !descricao.trim()) {
      setErrorMessage("Código (SKU) e Descrição são obrigatórios.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    const res = await insertBaseCodigo({
      codigo,
      descricao,
      grade: grade.trim() || undefined,
      tipo: tipo.trim() || undefined,
    })

    setIsSubmitting(false)

    if (!res.success) {
      setErrorMessage(res.error || "Erro ao cadastrar produto na tabela base_codigos.")
      return
    }

    if (onSuccess && res.data) {
      onSuccess(res.data)
    }

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b101b] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="p-5 flex items-start justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-700/50 flex items-center justify-center text-purple-400 text-xl font-bold">
              +
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Cadastrar Produto</h2>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">
                Adicionar SKU à tabela base_codigos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-2.5 bg-red-950/70 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <span>⛔</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Código (SKU) */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Código (SKU) *
            </label>
            <input
              type="text"
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ex: 0190-01"
              className="w-full bg-[#131b2e] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono font-bold placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Descrição *
            </label>
            <input
              type="text"
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value.toUpperCase())}
              placeholder="Ex: ESPREMEDOR E-01 127V/60HZ TURBO"
              className="w-full bg-[#131b2e] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
            />
          </div>

          {/* Grade e Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Grade (Opcional)
              </label>
              <input
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="Ex: 36"
                className="w-full bg-[#131b2e] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Tipo (Opcional)
              </label>
              <input
                type="text"
                value={tipo}
                onChange={(e) => setTipo(e.target.value.toUpperCase())}
                placeholder="Ex: ELETRO"
                className="w-full bg-[#131b2e] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-[#131b2e] hover:bg-slate-800 text-slate-300 font-bold uppercase tracking-wider text-[11px] transition-colors border border-slate-800"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-bold uppercase tracking-wider text-[11px] shadow-lg shadow-purple-900/30 transition-all flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Cadastrando...</span>
                </>
              ) : (
                <span>Cadastrar Produto</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
