"use client"

import React from "react"
import { X, Printer, Layers, AlertCircle, Plus } from "lucide-react"
import { motion } from "framer-motion"
import { MapeamentoConfig, MapeamentoItem, COLOR_THEMES } from "@/lib/mapeamentosStorage"
import { cn } from "@/lib/utils"
import { MapeamentoDriveInGrid } from "./MapeamentoDriveInGrid"

interface PosDetail {
  posicao: string
  capacidade: number
  nivel_count: number
  prof_count: number
  is_blocked: boolean
  observacao: string
  items: MapeamentoItem[]
  occupied: number
  isOverflow: boolean
}

interface MapeamentoPositionPanelProps {
  posDetail: PosDetail | null
  config: MapeamentoConfig
  onClose: () => void
  onAddItem: (nivel: number, profundidade: number) => void
  onEditItem: (item: MapeamentoItem) => void
  onDeleteItem: (itemId: string) => void
}

/**
 * Overlay de posição Drive-In idêntico ao G300 Avarias:
 * backdrop com blur + panel grande centralizado + DriveInGrid embutido
 */
export function MapeamentoPositionPanel({
  posDetail,
  config,
  onClose,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: MapeamentoPositionPanelProps) {
  if (!posDetail) return null

  const theme = COLOR_THEMES[config.cor] || COLOR_THEMES.blue
  const { posicao, capacidade, nivel_count, is_blocked, observacao, items, occupied, isOverflow } = posDetail

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
        <div className="flex items-center justify-between mb-6 md:mb-8 shrink-0">
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
              </div>
            </div>
          </div>

          {/* Ações do header */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              title="Imprimir Mapa da Posição"
              className="h-9 md:h-12 px-3 md:px-5 rounded-lg md:rounded-2xl flex items-center justify-center gap-2 transition-all border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Printer size={15} />
              <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest hidden md:inline">
                Imprimir Mapa
              </span>
            </button>

            <button
              onClick={() => onAddItem(1, 1)}
              className="h-9 px-3 md:h-12 md:px-5 rounded-lg md:rounded-2xl flex items-center justify-center gap-2 transition-all font-semibold text-white shadow-md active:scale-95 cursor-pointer text-xs uppercase tracking-widest"
              style={{ background: theme.primary }}
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Mapear</span>
            </button>

            <button
              onClick={onClose}
              className="h-9 w-9 md:h-12 md:w-12 rounded-lg md:rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-all border border-slate-100 dark:border-slate-800 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

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
            onAddItem={onAddItem}
            onEditItem={onEditItem}
            onDeleteItem={onDeleteItem}
          />
        </div>
      </motion.div>
    </div>
  )
}
