"use client"

import React, { useState } from "react"
import {
  X,
  Printer,
  Layers,
  AlertCircle,
  Edit2,
  Settings,
  Lock,
  Save,
  Check,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MapeamentoConfig,
  MapeamentoItem,
  MapeamentoPosicao,
  COLOR_THEMES,
} from "@/lib/mapeamentosStorage"
import { cn } from "@/lib/utils"
import { MapeamentoDriveInGrid } from "./MapeamentoDriveInGrid"

export interface PosDetail {
  posicao: string
  posObj?: MapeamentoPosicao
  tipo?: "chao" | "drive_in"
  setor?: string
  capacidade: number
  nivel_count: number
  prof_count: number
  is_blocked: boolean
  status?: string
  observacao: string
  items: MapeamentoItem[]
  occupied: number
  isOverflow: boolean
}

interface MapeamentoPositionPanelProps {
  posDetail: PosDetail | null
  config: MapeamentoConfig
  onClose: () => void
  onAddItem: (
    nivel: number,
    profundidade: number,
    batchCoords?: { lvl: number; prof: number }[]
  ) => void
  onEditItem: (item: MapeamentoItem) => void
  onDeleteItem: (itemId: string) => void
  onSavePosicao?: (pos: MapeamentoPosicao) => Promise<void>
  onSwapItems?: (
    posicao: string,
    source: { lvl: number; d: number },
    target: { lvl: number; d: number }
  ) => Promise<void>
  isLoggedIn?: boolean
}

/**
 * Overlay de posição Drive-In idêntico ao G300 Avarias:
 * backdrop com blur + panel grande centralizado + DriveInGrid embutido
 * + Botão Editar Posição com ativação de modo de mapeamento e modal de configuração
 */
export function MapeamentoPositionPanel({
  posDetail,
  config,
  onClose,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onSavePosicao,
  onSwapItems,
  isLoggedIn = false,
}: MapeamentoPositionPanelProps) {
  const [isEditModeActive, setIsEditModeActive] = useState(false)
  const [isConfigPosModalOpen, setIsConfigPosModalOpen] = useState(false)

  // Estados para edição estrutural da posição
  const [formNivelCount, setFormNivelCount] = useState<number>(posDetail?.nivel_count || 3)
  const [formProfCount, setFormProfCount] = useState<number>(posDetail?.prof_count || 4)
  const [formCapacidade, setFormCapacidade] = useState<number>(posDetail?.capacidade || 16)
  const [formStatus, setFormStatus] = useState<"Aberto" | "Bloqueado">(
    posDetail?.is_blocked ? "Bloqueado" : "Aberto"
  )
  const [formObservacao, setFormObservacao] = useState<string>(posDetail?.observacao || "")
  const [isSavingPos, setIsSavingPos] = useState(false)

  if (!posDetail) return null

  const theme = COLOR_THEMES[config.cor] || COLOR_THEMES.blue
  const {
    posicao,
    capacidade,
    nivel_count,
    is_blocked,
    observacao,
    items,
    occupied,
    isOverflow,
  } = posDetail

  const handleOpenConfigModal = () => {
    setFormNivelCount(nivel_count)
    setFormProfCount(posDetail.prof_count || Math.ceil(capacidade / (nivel_count || 1)))
    setFormCapacidade(capacidade)
    setFormStatus(is_blocked ? "Bloqueado" : "Aberto")
    setFormObservacao(observacao)
    setIsConfigPosModalOpen(true)
  }

  const handleSaveConfigPosicao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onSavePosicao) return

    setIsSavingPos(true)
    try {
      const existing = posDetail.posObj
      const id = existing?.id || `pos_${posicao.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
      const newPos: MapeamentoPosicao = {
        id,
        mapeamentoId: config.id,
        codigo: posicao,
        tipo: posDetail.tipo || (posicao.startsWith("CHAO") ? "chao" : "drive_in"),
        setor: posDetail.setor || (posDetail.tipo === "chao" ? "Área de Chão" : "Rua"),
        capacidade: formCapacidade,
        nivelCount: formNivelCount,
        profundidadeCount: formProfCount,
        status: formStatus,
        observacao: formObservacao,
        criadoEm: existing?.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      }

      await onSavePosicao(newPos)
      setIsConfigPosModalOpen(false)
    } catch (err: any) {
      console.error("Erro ao salvar configuração da posição:", err)
      alert(`Erro ao salvar: ${err?.message || "Erro desconhecido"}`)
    } finally {
      setIsSavingPos(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6">
      {/* Backdrop com blur — idêntico ao G300 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
      />

      {/* Panel principal — idêntico ao G300 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="relative w-full max-w-7xl max-h-[96vh] md:max-h-[92vh] rounded-[3rem] bg-white dark:bg-slate-900 p-6 md:p-10 shadow-2xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col overflow-hidden"
      >
        {/* ── HEADER ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4 md:mb-6 shrink-0">
          <div className="flex items-center gap-4">
            {/* Ícone colorido com tema do mapeamento */}
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center border shrink-0"
              style={{ background: theme.bgSoft, borderColor: theme.border, color: theme.primary }}
            >
              <Layers size={24} />
            </div>

            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-xl md:text-3xl font-light text-slate-900 dark:text-white leading-tight font-mono">
                  {posicao}
                </h3>
                <span className={cn("text-[10px] font-semibold px-2.5 py-0.5 rounded-full border", theme.badge)}>
                  {config.nome}
                </span>
                {is_blocked && (
                  <span className="flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-900/40 px-2.5 py-0.5 text-[9px] font-bold uppercase text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                    <Lock size={10} /> Posição Bloqueada
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
                  {occupied} / {capacidade} Paletes&nbsp;•&nbsp;{nivel_count} Níveis
                </span>
                {isOverflow && (
                  <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[8px] font-semibold uppercase text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                    <AlertCircle size={8} /> Excesso
                  </span>
                )}
                {observacao && (
                  <span className="text-[10px] text-slate-400 italic truncate max-w-xs">
                    Obs: {observacao}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ações do header — IDÊNTICO AO G300 */}
          <div className="flex items-center gap-2">
            {/* Botão 1: Imprimir Mapa */}
            <button
              onClick={() => window.print()}
              title="Imprimir Mapa da Posição"
              className="h-8 w-8 md:h-12 md:px-5 md:w-auto rounded-lg md:rounded-2xl flex items-center justify-center gap-2 transition-all border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Printer size={14} className="md:w-4 md:h-4" />
              <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest hidden md:inline">
                Imprimir Mapa
              </span>
            </button>

            {/* Botões de Edição — Apenas quando Logado */}
            {isLoggedIn && (
              <>
                {/* Botão 2: EDITAR POSIÇÃO — Sistema e Estilo 100% IDÊNTICO AO G300 */}
                <button
                  onClick={() => setIsEditModeActive(prev => !prev)}
                  title="Editar Posição"
                  className={cn(
                    "h-8 px-2.5 md:h-12 md:px-5 rounded-lg md:rounded-2xl flex items-center justify-center gap-2 transition-all border cursor-pointer font-semibold",
                    isEditModeActive
                      ? "bg-blue-600 dark:bg-blue-600 text-white border-blue-600 dark:border-blue-500 shadow-md shadow-blue-500/25 hover:bg-blue-700"
                      : "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800"
                  )}
                >
                  <Edit2 size={13} className="md:w-3.5 md:h-3.5" />
                  <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest">
                    {isEditModeActive ? "Concluir" : "Editar"}
                  </span>
                </button>

                {/* Botão 3: Configurar Estrutura da Posição (Níveis, Profundidade, Bloqueio, Observação) */}
                <button
                  onClick={handleOpenConfigModal}
                  title="Editar Estrutura da Posição (Níveis, Profundidade, Bloqueio)"
                  className="h-8 w-8 md:h-12 md:px-4 md:w-auto rounded-lg md:rounded-2xl flex items-center justify-center gap-2 transition-all border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <Settings size={14} className="md:w-4 md:h-4 text-slate-500" />
                  <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest hidden md:inline">
                    Estrutura
                  </span>
                </button>
              </>
            )}

            {/* Botão 4: Fechar Modal */}
            <button
              onClick={onClose}
              className="h-8 w-8 md:h-12 md:w-12 rounded-lg md:rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-all border border-slate-100 dark:border-slate-800 cursor-pointer"
            >
              <X size={16} className="md:w-6 md:h-6" />
            </button>
          </div>
        </div>

        {/* Banner Informativo quando o Modo Edição está ativo */}
        {isLoggedIn && isEditModeActive && (
          <div className="mb-4 px-4 py-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between text-xs text-blue-600 dark:text-blue-300 shrink-0 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span>
                <strong>Modo de Edição Ativo (G300):</strong> Clique no botão <strong className="text-blue-600 dark:text-blue-200 font-bold px-1 py-0.5 rounded bg-blue-500/20">+</strong> das células vazias para mapear, arraste paletes para trocar de slot, ou selecione células vazias para ações em lote.
              </span>
            </div>
            <button
              onClick={() => setIsEditModeActive(false)}
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors cursor-pointer shrink-0 ml-2"
            >
              Concluir Edição
            </button>
          </div>
        )}

        {/* ── BODY: DriveInGrid embutido (idêntico ao G300) ──────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <MapeamentoDriveInGrid
            positionId={posicao}
            items={items}
            capacity={capacidade}
            levelCount={nivel_count}
            isBlocked={is_blocked}
            observation={observacao}
            config={config}
            isEditModeActive={isLoggedIn && isEditModeActive}
            setIsEditModeActive={setIsEditModeActive}
            onAddItem={onAddItem}
            onEditItem={onEditItem}
            onDeleteItem={onDeleteItem}
            onSwapItems={onSwapItems ? (src, tgt) => onSwapItems(posicao, src, tgt) : undefined}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </motion.div>

      {/* ── MODAL DE CONFIGURAÇÃO ESTRUTURAL DA POSIÇÃO ─────────────────────── */}
      <AnimatePresence>
        {isConfigPosModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                    <Settings size={18} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                      Editar Estrutura: {posicao}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Ajuste a capacidade física, níveis e bloqueio
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsConfigPosModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveConfigPosicao} className="space-y-4">
                {/* Status: Aberto vs Bloqueado */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Status da Posição
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormStatus("Aberto")}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer",
                        formStatus === "Aberto"
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm"
                          : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <Check size={14} /> Aberto (Ativa)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormStatus("Bloqueado")}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer",
                        formStatus === "Bloqueado"
                          ? "bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 shadow-sm"
                          : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <Lock size={14} /> Bloqueado
                    </button>
                  </div>
                </div>

                {/* Níveis e Profundidade */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Níveis (Altura)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={formNivelCount}
                      onChange={e => {
                        const n = Math.max(1, Number(e.target.value))
                        setFormNivelCount(n)
                        setFormCapacidade(n * formProfCount)
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Profundidade
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={formProfCount}
                      onChange={e => {
                        const p = Math.max(1, Number(e.target.value))
                        setFormProfCount(p)
                        setFormCapacidade(formNivelCount * p)
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Capacidade Total */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Capacidade Total (Paletes)
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Calculado: {formNivelCount} × {formProfCount} = {formNivelCount * formProfCount}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={formCapacidade}
                    onChange={e => setFormCapacidade(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    required
                  />
                </div>

                {/* Observação / Motivo */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Observação da Posição
                  </label>
                  <textarea
                    rows={2}
                    value={formObservacao}
                    onChange={e => setFormObservacao(e.target.value)}
                    placeholder="Ex: Posição reservada para avarias, manutenção na longarina..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsConfigPosModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPos}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save size={14} />
                    {isSavingPos ? "Salvando..." : "Salvar Posição"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
