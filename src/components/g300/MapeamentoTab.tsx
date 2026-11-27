// =============================================================================
// SYSTEM: MÓDULO G300 (ESTOQUE, AVARIAS & DRIVE-IN)
// OWNER:  Workspace Admin G300 (Nível 3)
// SCOPE:  Aba Mapeamento (Mapa Drive-In, Paletes Mistos, Chão, Quarentena, Retrabalho e Classificações)
// PURPOSE: Visualização completa das posições físicas do armazém, gestão de paletes
//          agrupados/livres com drag-and-drop e consulta de classificações.
// =============================================================================

"use client"

import React, { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Package,
  Tag,
  Layers,
  Box,
  AlertTriangle,
  MapPin,
  Info,
  X,
  AlertCircle,
  RefreshCw,
  TrendingDown,
  ArrowDownAZ,
  Search,
  MoreHorizontal,
  Printer,
  CheckSquare,
  FileText,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Warehouse,
  Lock,
  Scissors,
  GitMerge,
  Trash2,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { syncManager, ConnectionStatus } from "@/lib/syncManager"
import {
  ClassificacaoPalete,
  CLASSIFICACAO_OPTIONS,
  SQL_CLASSIFICACAO_MIGRATION,
  extractRowClassificacao,
  isDevolucao,
} from "@/lib/mapeamentoUtils"
import { MetricCard } from "./MetricCard"
import { WarehouseTable } from "./WarehouseTable"
import { ClassificacoesTab, DevolucaoPrintPayload } from "./ClassificacoesTab"

export type MapeamentoViewType =
  | "geral"
  | "posicoes"
  | "nao_alocados"
  | "produtos"
  | "molhados"
  | "quarentena"
  | "retrabalho"

export type MapeamentoDisplayMode =
  | "mapa"
  | "tabela"
  | "misto"
  | "nao_alocados"
  | "quarentena"
  | "retrabalho"
  | "devolucoes"

export type MapeamentoSortType = "none" | "qty_desc" | "qty_asc" | "alpha_asc"

interface MapeamentoTabProps {
  data: any[]
  setData: React.Dispatch<React.SetStateAction<any[]>>
  effectiveData: any[]
  pendingChanges: any[]
  setPendingChanges: React.Dispatch<React.SetStateAction<any[]>>
  globalStats: any
  advancedStats: any
  streetData: Record<string, Record<string, any[]>>
  displayMode: MapeamentoDisplayMode
  setDisplayMode: React.Dispatch<React.SetStateAction<MapeamentoDisplayMode>>
  activeView: MapeamentoViewType
  setActiveView: React.Dispatch<React.SetStateAction<MapeamentoViewType>>
  sortMode: MapeamentoSortType
  setSortMode: React.Dispatch<React.SetStateAction<MapeamentoSortType>>
  tableSort: { key: string; direction: "asc" | "desc" }
  setTableSort: React.Dispatch<React.SetStateAction<{ key: string; direction: "asc" | "desc" }>>
  handleSort: (key: string) => void
  search: string
  setSearch: React.Dispatch<React.SetStateAction<string>>
  syncStatus: ConnectionStatus
  isOffline: boolean
  lastSyncTime: string | null
  pendingCount: number
  fetchData: () => Promise<void>
  user: any
  setShowLoginModal: React.Dispatch<React.SetStateAction<boolean>>
  selectionModeActive: boolean
  setSelectionModeActive: React.Dispatch<React.SetStateAction<boolean>>
  selectedPositions: Set<string>
  setSelectedPositions: React.Dispatch<React.SetStateAction<Set<string>>>
  blinkPosition: string | null
  setSelectedPosition: React.Dispatch<React.SetStateAction<string | null>>
  handleExportMap: (mode: "all" | "filtered") => Promise<void>
  handleExportSelection: () => Promise<void>
  handleVerNoMapa: (posId: string) => void
  setSelectedPalletId: React.Dispatch<React.SetStateAction<string | null>>
  setUngroupTargetData: React.Dispatch<React.SetStateAction<{ id: string; itemIds: any[] } | null>>
  setShowUngroupConfirm: React.Dispatch<React.SetStateAction<boolean>>
  isProcessingGroup: boolean
  setShowGroupModal: React.Dispatch<React.SetStateAction<boolean>>
  handleUngroupSelected: (targetIds?: string[]) => Promise<void>
  selectedNaoAlocados: Set<string>
  setSelectedNaoAlocados: React.Dispatch<React.SetStateAction<Set<string>>>
  paginatedData: any[]
  filteredData: any[]
  currentPage: number
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>
  totalPages: number
  rowsPerPage: number | "ALL"
  setRowsPerPage: React.Dispatch<React.SetStateAction<number | "ALL">>
  getColumns: () => any[]
  setModalFilter: React.Dispatch<React.SetStateAction<boolean>>
  setSelectedProduct: React.Dispatch<React.SetStateAction<string | null>>
  draggedItem: any
  dragOverTarget: string | null
  handleDragStart: (e: React.DragEvent, item: any) => void
  handleDragEnd: (e: React.DragEvent) => void
  handleDragOver: (e: React.DragEvent, targetId: string) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (
    e: React.DragEvent,
    targetType: "mix" | "ungroup" | "new_mix" | "new_standalone_mix",
    targetId: string | null,
    targetBaseItem?: any
  ) => void
  updatingClassificacaoId: string | null
  handleUpdateRowClassificacao: (row: any, nextValue: ClassificacaoPalete) => Promise<void>
  missingClassificacaoColumn: boolean
  setMissingClassificacaoColumn: React.Dispatch<React.SetStateAction<boolean>>
  setSplitTarget: React.Dispatch<React.SetStateAction<any>>
  setSplitQtyPerPallet: React.Dispatch<React.SetStateAction<string>>
  setSplitModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  setMergeTarget: React.Dispatch<React.SetStateAction<{ sku: string; items: any[] } | null>>
  setSelectedMergeIds: React.Dispatch<React.SetStateAction<Set<any>>>
  setMergeModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  setDeleteTarget: React.Dispatch<React.SetStateAction<any>>
  setDeleteQuantity: React.Dispatch<React.SetStateAction<string>>
  setIsAddItemModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  onPrintDevolucoes: (payload: DevolucaoPrintPayload) => void
  fmtNum: (val: number, locale?: string) => string
}

export function MapeamentoTab({
  data,
  setData,
  effectiveData,
  pendingChanges,
  setPendingChanges,
  globalStats,
  advancedStats,
  streetData,
  displayMode,
  setDisplayMode,
  activeView,
  setActiveView,
  sortMode,
  setSortMode,
  tableSort,
  setTableSort,
  handleSort,
  search,
  setSearch,
  syncStatus,
  isOffline,
  lastSyncTime,
  pendingCount,
  fetchData,
  user,
  setShowLoginModal,
  selectionModeActive,
  setSelectionModeActive,
  selectedPositions,
  setSelectedPositions,
  blinkPosition,
  setSelectedPosition,
  handleExportMap,
  handleExportSelection,
  handleVerNoMapa,
  setSelectedPalletId,
  setUngroupTargetData,
  setShowUngroupConfirm,
  isProcessingGroup,
  setShowGroupModal,
  handleUngroupSelected,
  selectedNaoAlocados,
  setSelectedNaoAlocados,
  paginatedData,
  filteredData,
  currentPage,
  setCurrentPage,
  totalPages,
  rowsPerPage,
  setRowsPerPage,
  getColumns,
  setModalFilter,
  setSelectedProduct,
  draggedItem,
  dragOverTarget,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  updatingClassificacaoId,
  handleUpdateRowClassificacao,
  missingClassificacaoColumn,
  setMissingClassificacaoColumn,
  setSplitTarget,
  setSplitQtyPerPallet,
  setSplitModalOpen,
  setMergeTarget,
  setSelectedMergeIds,
  setMergeModalOpen,
  setDeleteTarget,
  setDeleteQuantity,
  setIsAddItemModalOpen,
  onPrintDevolucoes,
  fmtNum,
}: MapeamentoTabProps) {
  const [mapMenuOpen, setMapMenuOpen] = useState(false)
  const [mixedSort, setMixedSort] = useState<"name_asc" | "name_desc" | "sku_asc" | "sku_desc">("name_asc")
  const [copiedMigrationSql, setCopiedMigrationSql] = useState(false)
  const [expandedPallets, setExpandedPallets] = useState<Set<string>>(new Set())

  const togglePallet = (key: string) =>
    setExpandedPallets((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // Mixed Pallets Detection Logic
  const mixedPalletsData = useMemo(() => {
    const palletGroups = new Map<string, any[]>()

    effectiveData.forEach((item) => {
      const id = item.id_palete?.toString()?.trim()
      if (!id || id === "0" || id === "" || id.toLowerCase() === "nan") return

      if (!palletGroups.has(id)) {
        palletGroups.set(id, [])
      }
      palletGroups.get(id)?.push(item)
    })

    const mixed: any[] = []
    for (const [id, items] of palletGroups.entries()) {
      const skus = new Set(items.map((i) => i.produto))
      const positions = new Set(items.map((i) => i.posicao || "S/P"))
      const hasSP = positions.has("S/P")
      const hasAllocated = Array.from(positions).some((p) => p !== "S/P")

      const isMixedSku = skus.size > 1
      const isMixedStatus = hasSP && hasAllocated

      if (isMixedSku || isMixedStatus) {
        mixed.push({
          id,
          totalQty: items.reduce((sum, i) => sum + (i.quantidade_total || 0), 0),
          skuCount: skus.size,
          skus: Array.from(skus),
          isMixedSku,
          isMixedStatus,
          items,
        })
      }
    }

    return mixed.sort((a, b) => {
      switch (mixedSort) {
        case "name_asc":
          return a.id.localeCompare(b.id, undefined, { numeric: true })
        case "name_desc":
          return b.id.localeCompare(a.id, undefined, { numeric: true })
        case "sku_asc":
          return a.skuCount - b.skuCount
        case "sku_desc":
          return b.skuCount - a.skuCount
        default:
          return b.totalQty - a.totalQty
      }
    })
  }, [effectiveData, mixedSort])

  // Summary of Classificações (Regra B - linha a linha)
  const classificacaoResumo = useMemo(() => {
    const resumo = {
      todas: { linhas: 0, pecas: 0 },
      Normal: { linhas: 0, pecas: 0 },
      Devolução: { linhas: 0, pecas: 0 },
      "Não definido": { linhas: 0, pecas: 0 },
    }
    effectiveData.forEach((item) => {
      if (item.is_empty || Number(item.quantidade_total || 0) <= 0) return
      const qty = Number(item.quantidade_total) || 0
      const cls = extractRowClassificacao(item)
      resumo.todas.linhas += 1
      resumo.todas.pecas += qty
      if (cls === "Devolução") {
        resumo.Devolução.linhas += 1
        resumo.Devolução.pecas += qty
      } else if (cls === "Normal") {
        resumo.Normal.linhas += 1
        resumo.Normal.pecas += qty
      } else {
        resumo["Não definido"].linhas += 1
        resumo["Não definido"].pecas += qty
      }
    })
    return resumo
  }, [effectiveData])

  return (
    <motion.div
      key="mapeamento-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
        {/* Global Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            title="Peças Totais"
            value={(globalStats?.absolute_total_quantity || 0).toLocaleString("pt-BR")}
            icon={Package}
          />
          <MetricCard
            title="SKUs Ativos"
            value={(globalStats?.absolute_total_skus || 0).toLocaleString("pt-BR")}
            icon={Tag}
          />
          <MetricCard
            title="Drive-in Ativos"
            value={advancedStats.totalPositions.toLocaleString("pt-BR")}
            icon={Layers}
          />
          <MetricCard
            title="Paletes Mistos"
            value={mixedPalletsData.length.toLocaleString("pt-BR")}
            icon={Box}
          />
          <MetricCard
            title="Pendências"
            value={(globalStats?.pendenciasCount || 0).toLocaleString("pt-BR")}
            icon={AlertTriangle}
          />
          <MetricCard
            title="Classificações"
            value={(classificacaoResumo.Devolução.linhas + classificacaoResumo.Normal.linhas).toLocaleString("pt-BR")}
            description={`Dev: ${classificacaoResumo.Devolução.linhas} • Norm: ${classificacaoResumo.Normal.linhas}`}
            icon={Tag}
            hoverContent={
              <div className="space-y-2 text-xs min-w-[200px]">
                <p className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
                  Resumo por Classificação
                </p>
                <div className="flex justify-between gap-4">
                  <span className="text-amber-500 font-semibold">Devolução</span>
                  <span className="font-bold">
                    {classificacaoResumo.Devolução.linhas} ({fmtNum(classificacaoResumo.Devolução.pecas)} un)
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-emerald-500 font-semibold">Normal</span>
                  <span className="font-bold">
                    {classificacaoResumo.Normal.linhas} ({fmtNum(classificacaoResumo.Normal.pecas)} un)
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Não definido</span>
                  <span className="font-bold">
                    {classificacaoResumo["Não definido"].linhas} ({fmtNum(classificacaoResumo["Não definido"].pecas)} un)
                  </span>
                </div>
              </div>
            }
            className={cn(
              displayMode === "devolucoes"
                ? "border-amber-500 ring-2 ring-amber-500/20"
                : "border-amber-500/30 hover:border-amber-500/70"
            )}
            onClick={() => {
              setDisplayMode("devolucoes")
              setActiveView("geral")
              setTimeout(() => {
                document
                  .getElementById("mapeamento-filter-bar")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }, 60)
            }}
          />
        </div>

        {/* Analytics Grid Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
          {/* NEW Capacity Card (Left) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-[2.5rem] bg-white dark:bg-slate-900/50 p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden relative group transition-colors"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-500">
              <MapPin size={120} className="text-blue-500" />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between gap-8">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    Capacidade de Drives
                    <div className="group/tip relative flex items-center">
                      <Info size={14} className="text-slate-400 dark:text-slate-500 cursor-help" />
                      <div className="absolute left-full ml-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-white/10 dark:border-white/10 z-[100]">
                        Ocupação física total do Armazém
                      </div>
                    </div>
                  </h3>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Ocupação Física
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider">
                    <span className="text-slate-400 dark:text-slate-500">Drives Ocupados</span>
                    <span className="text-slate-900 dark:text-white">
                      {advancedStats.totalPositions - advancedStats.vazioCount} / {advancedStats.totalPositions}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${((advancedStats.totalPositions - advancedStats.vazioCount) / (advancedStats.totalPositions || 1)) * 100}%`,
                      }}
                      className="h-full bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider">
                    <span className="text-slate-400 dark:text-slate-500">Capacidade Total</span>
                    <span className="text-slate-900 dark:text-white">
                      {(advancedStats.occupiedPercent || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${advancedStats.occupiedPercent || 0}%` }}
                      className="h-full bg-slate-400 rounded-full shadow-[0_0_15px_rgba(148,163,184,0.3)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* MODIFIED Mix Card (Right) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-[2.5rem] bg-white dark:bg-slate-900/50 p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden relative group transition-colors"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-500">
              <Layers size={120} className="text-orange-500" />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between gap-8">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    Distribuição de Mix
                    <div className="group/tip relative flex items-center">
                      <Info size={14} className="text-slate-400 dark:text-slate-500 cursor-help" />
                      <div className="absolute left-full ml-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-white/10 dark:border-white/10 z-[100]">
                        Volume de Mono-produto vs Mixed SKUs
                      </div>
                    </div>
                  </h3>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Eficiência de Armazenagem
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 items-end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider">
                      <span className="text-slate-400 dark:text-slate-500">Mono</span>
                      <span className="text-slate-900 dark:text-white">
                        {(100 - (advancedStats.mixPercent || 0)).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-8/12 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${100 - (advancedStats.mixPercent || 0)}%` }}
                        className="h-full bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider">
                      <span className="text-slate-400 dark:text-slate-500">Mix</span>
                      <span className="text-slate-900 dark:text-white">
                        {(advancedStats.mixPercent || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-8/12 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${advancedStats.mixPercent || 0}%` }}
                        className="h-full bg-orange-500 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 border-l border-slate-100 dark:border-white/5 pl-8">
                  <div>
                    <span className="text-3xl font-light text-emerald-500 tracking-tighter leading-none">
                      {advancedStats.totalMono}
                    </span>
                    <p className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-tight mt-1">
                      Organizados
                    </p>
                  </div>
                  <div>
                    <span className="text-3xl font-light text-orange-500 tracking-tighter leading-none">
                      {advancedStats.totalMixed}
                    </span>
                    <p className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-tight mt-1">
                      Críticos
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {missingClassificacaoColumn && (
          <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                  Coluna &quot;classificacao&quot; pendente no banco Supabase
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-200/80 mt-0.5">
                  Para gravar classificações (&quot;Normal&quot; / &quot;Devolução&quot;) por linha no Supabase, execute a migração SQL na tabela mapeamento.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(SQL_CLASSIFICACAO_MIGRATION)
                  setCopiedMigrationSql(true)
                  setTimeout(() => setCopiedMigrationSql(false), 2500)
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-400 transition-colors cursor-pointer"
              >
                {copiedMigrationSql ? "SQL Copiado!" : "Copiar SQL"}
              </button>
              <button
                onClick={() => setMissingClassificacaoColumn(false)}
                className="p-1.5 rounded-lg text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                title="Dispensar aviso"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* REFINED FILTER BAR */}
        <div
          id="mapeamento-filter-bar"
          className="flex flex-col gap-4 py-6 border-y border-slate-100 dark:border-slate-800 transition-colors"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit max-w-full border border-slate-200/50 dark:border-slate-800/50">
              <button
                onClick={() => {
                  setDisplayMode("mapa")
                  setActiveView("geral")
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-[10px] font-semibold transition-all whitespace-nowrap cursor-pointer",
                  displayMode === "mapa"
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <MapPin size={14} /> MAPA
              </button>
              <button
                onClick={() => {
                  setDisplayMode("misto")
                  setActiveView("geral")
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-[10px] font-semibold transition-all whitespace-nowrap cursor-pointer",
                  displayMode === "misto"
                    ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <Layers size={14} /> PALETES MISTOS
              </button>
              <button
                onClick={() => {
                  setDisplayMode("nao_alocados")
                  setActiveView("nao_alocados")
                  setSortMode("none")
                  setTableSort({ key: "produto", direction: "asc" })
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-[10px] uppercase font-semibold transition-all whitespace-nowrap cursor-pointer",
                  displayMode === "nao_alocados"
                    ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <AlertCircle size={14} /> Não alocados
              </button>
              <button
                onClick={() => {
                  setDisplayMode("quarentena")
                  setActiveView("quarentena")
                  setSortMode("none")
                  setTableSort({ key: "produto", direction: "asc" })
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-[10px] uppercase font-semibold transition-all whitespace-nowrap cursor-pointer",
                  displayMode === "quarentena"
                    ? "bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <AlertTriangle size={14} /> Quarentena
              </button>
              <button
                onClick={() => {
                  setDisplayMode("retrabalho")
                  setActiveView("retrabalho")
                  setSortMode("none")
                  setTableSort({ key: "produto", direction: "asc" })
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-[10px] uppercase font-semibold transition-all whitespace-nowrap cursor-pointer",
                  displayMode === "retrabalho"
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <RefreshCw size={14} /> Retrabalho
              </button>
              <button
                onClick={() => {
                  setDisplayMode("devolucoes")
                  setActiveView("geral")
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-[10px] uppercase font-semibold transition-all whitespace-nowrap cursor-pointer border",
                  displayMode === "devolucoes"
                    ? "bg-amber-500 border-amber-500 text-slate-950 shadow-sm"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                )}
              >
                <Tag size={14} /> Classificações
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[9px] font-bold",
                    displayMode === "devolucoes"
                      ? "bg-slate-950/20 text-slate-950"
                      : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                  )}
                >
                  {classificacaoResumo.Devolução.linhas + classificacaoResumo.Normal.linhas}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {displayMode === "mapa" && (
                <div className="hidden lg:flex items-center gap-5 px-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                      VAZIO <span className="ml-1 text-slate-900 dark:text-white">{advancedStats.vazioCount}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#2D5A27] shadow-[0_0_8px_rgba(45,90,39,0.4)]" />
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                      DISPONÍVEL{" "}
                      <span className="ml-1 text-slate-900 dark:text-white">
                        {advancedStats.totalPositions - advancedStats.lotadoCount - advancedStats.vazioCount}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#7F1D1D] shadow-[0_0_8px_rgba(127,29,29,0.4)]" />
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                      LOTADO <span className="ml-1 text-slate-900 dark:text-white">{advancedStats.lotadoCount}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Connection Health Status & Sync Manager Badge (hidden on PC per request) */}
              <div className="shrink-0 hidden items-center gap-2">
                {syncStatus === "syncing" ? (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Sincronizando...</span>
                  </div>
                ) : isOffline || syncStatus === "offline" ? (
                  <div
                    title={
                      lastSyncTime
                        ? `Última sincronização: ${new Date(lastSyncTime).toLocaleTimeString("pt-BR")}`
                        : "Modo Offline"
                    }
                    className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider shadow-sm"
                  >
                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>
                      Offline {pendingCount > 0 ? `(${pendingCount} pendente${pendingCount > 1 ? "s" : ""})` : ""}
                    </span>
                  </div>
                ) : syncStatus === "error" ? (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                    <AlertCircle size={12} />
                    <span>Atenção no Sync ({pendingCount})</span>
                  </div>
                ) : (
                  <div
                    title="Todos os dados sincronizados com o Supabase"
                    className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider shadow-sm"
                  >
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Online</span>
                  </div>
                )}

                {pendingCount > 0 && (
                  <button
                    onClick={async () => {
                      await syncManager.syncPendingQueue()
                      await fetchData()
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <RefreshCw size={12} className={syncStatus === "syncing" ? "animate-spin" : ""} />
                    <span>Enviar ({pendingCount})</span>
                  </button>
                )}
              </div>

              {displayMode === "tabela" && (
                <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                  <button
                    onClick={() => setSortMode("qty_desc")}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-1.5 text-[9px] font-semibold transition-all",
                      sortMode === "qty_desc"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <TrendingDown size={14} /> MAIOR QTD.
                  </button>
                  <button
                    onClick={() => setSortMode("alpha_asc")}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-1.5 text-[9px] font-semibold transition-all",
                      sortMode === "alpha_asc"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <ArrowDownAZ size={14} /> A-Z
                  </button>
                </div>
              )}

              <div className="relative group w-full sm:w-64">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Pesquisar no mapeamento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-11 pl-11 pr-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-xs font-normal text-slate-700 dark:text-slate-200 transition-all shadow-sm"
                />
              </div>

              {/* Map Options Button */}
              {displayMode === "mapa" && (
                <div className="relative">
                  <button
                    onClick={() => setMapMenuOpen((v) => !v)}
                    title="Opções de Exportação"
                    className={cn(
                      "flex items-center justify-center h-11 w-11 rounded-2xl border transition-all active:scale-95",
                      mapMenuOpen
                        ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shadow-sm"
                    )}
                  >
                    <MoreHorizontal size={20} />
                  </button>

                  <AnimatePresence>
                    {mapMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute right-0 top-[120%] z-50 origin-top-right"
                      >
                        <div className="flex flex-col gap-2 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl min-w-[240px]">
                          <button
                            onClick={() => {
                              handleExportMap("all")
                              setMapMenuOpen(false)
                            }}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all group"
                            title="Imprimir mapa completo"
                          >
                            <div className="h-8 w-8 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                              <Printer size={16} />
                            </div>
                            <div className="flex flex-col items-start text-left">
                              <span className="text-[11px] font-semibold uppercase tracking-tight">
                                Imprimir Tudo
                              </span>
                              <span className="text-[9px] font-medium opacity-60">Mapa completo (PDF)</span>
                            </div>
                          </button>

                          {user && (
                            <button
                              onClick={() => {
                                const newMode = !selectionModeActive
                                setSelectionModeActive(newMode)
                                if (!newMode) setSelectedPositions(new Set())
                                setMapMenuOpen(false)
                              }}
                              className={cn(
                                "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group",
                                selectionModeActive
                                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                              )}
                              title={
                                selectionModeActive
                                  ? "Desativar seleção manual"
                                  : "Selecionar posições manualmente"
                              }
                            >
                              <div
                                className={cn(
                                  "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                                  selectionModeActive
                                    ? "bg-blue-600 text-white"
                                    : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white"
                                )}
                              >
                                <CheckSquare size={16} />
                              </div>
                              <div className="flex flex-col items-start text-left">
                                <span className="text-[11px] font-semibold uppercase tracking-tight">
                                  {selectionModeActive ? "Sair da Seleção" : "Escolher Posições"}
                                </span>
                                <span className="text-[9px] font-medium opacity-60">
                                  Escolha manual para impressão
                                </span>
                              </div>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              handleExportMap("filtered")
                              setMapMenuOpen(false)
                            }}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all group"
                            title="Imprimir apenas resultados filtrados"
                          >
                            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 group-hover:bg-slate-600 group-hover:text-white transition-colors">
                              <FileText size={16} />
                            </div>
                            <div className="flex flex-col items-start text-left">
                              <span className="text-[11px] font-semibold uppercase tracking-tight">
                                Imprimir Filtro
                              </span>
                              <span className="text-[9px] font-medium opacity-60">Apenas resultados atuais</span>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

        {displayMode === "misto" && (
          <div className="space-y-4">
            {/* Header with count and sort controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                  <Layers size={16} />
                </div>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {mixedPalletsData.length}
                  <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">
                    {mixedPalletsData.length === 1 ? "palete misto" : "paletes mistos"}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setMixedSort("name_asc")}
                  title="Nome (A → Z)"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all",
                    mixedSort === "name_asc"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                >
                  <ChevronUp size={12} /> Nome
                </button>
                <button
                  onClick={() => setMixedSort("name_desc")}
                  title="Nome (Z → A)"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all",
                    mixedSort === "name_desc"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                >
                  <ChevronDown size={12} /> Nome
                </button>
                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                <button
                  onClick={() => setMixedSort("sku_desc")}
                  title="Mais SKUs primeiro"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all",
                    mixedSort === "sku_desc"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                >
                  <ChevronDown size={12} /> SKUs
                </button>
                <button
                  onClick={() => setMixedSort("sku_asc")}
                  title="Menos SKUs primeiro"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all",
                    mixedSort === "sku_asc"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                >
                  <ChevronUp size={12} /> SKUs
                </button>
              </div>
            </div>

            {/* Pallet cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mixedPalletsData.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors flex flex-col items-center justify-center">
                  <div className="h-20 w-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-800">
                    <Box size={32} className="text-slate-300 dark:text-slate-700" />
                  </div>
                  <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    Ambiente Organizado
                  </h4>
                  <p className="text-xs font-normal text-slate-400 dark:text-slate-600 max-w-[280px] mx-auto">
                    Nenhum palete misto detectado no mapeamento atual. Todo o estoque está segregado por SKU.
                  </p>
                </div>
              ) : (
                mixedPalletsData.map((pallet) => (
                  <motion.div
                    key={pallet.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setSelectedPalletId(pallet.id)}
                    className="group cursor-pointer rounded-[2.5rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm transition-all hover:border-orange-300 dark:hover:border-orange-900/50 hover:shadow-2xl hover:shadow-orange-100/50 dark:hover:shadow-orange-950/20 flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400 border border-orange-100/50 dark:border-orange-900/30 transition-colors">
                          <Layers size={20} />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
                            {pallet.id}
                          </h4>
                          <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 transition-colors">
                            ID PALETE
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-light text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
                          {fmtNum(pallet.totalQty)}
                        </p>
                        <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 transition-colors">
                          Peças
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 py-0.5 transition-colors">
                      {pallet.isMixedSku && (
                        <span className="px-2.5 py-1 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[10px] font-semibold uppercase border border-red-100 dark:border-red-900/40 flex items-center gap-1.5 transition-colors">
                          <AlertCircle size={10} /> {pallet.skuCount} SKUs
                        </span>
                      )}
                      {pallet.isMixedStatus && (
                        <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[10px] font-semibold uppercase border border-blue-100 dark:border-blue-900/40 flex items-center gap-1.5 transition-colors">
                          <MapPin size={10} /> Misto Aloc/SP
                        </span>
                      )}
                    </div>

                    <div className="space-y-4 mt-auto pt-4 border-t border-slate-50 dark:border-slate-800 transition-colors">
                      <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                        <span>Produtos no Palete</span>
                        <div className="flex items-center gap-1 text-orange-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                          <span className="text-[9px]">DETALHES</span>
                          <ChevronRight size={10} />
                        </div>
                      </div>
                      <p className="text-xs font-normal text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed transition-colors">
                        {pallet.skus.join(", ")}
                      </p>

                      {user && (
                        <div className="pt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (user) {
                                setUngroupTargetData({
                                  id: pallet.id,
                                  itemIds: pallet.items.map((item: any) => item.id),
                                })
                                setShowUngroupConfirm(true)
                              } else {
                                setShowLoginModal(true)
                              }
                            }}
                            disabled={isProcessingGroup}
                            className="w-full py-2.5 rounded-xl border border-rose-100 dark:border-rose-900/30 text-[10px] font-semibold uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100"
                          >
                            <X size={12} /> Desagrupar Palete
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {displayMode === "mapa" && (
          <>
            {advancedStats.overflowPositions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 flex flex-col md:flex-row items-center justify-between gap-6 rounded-[2.5rem] bg-gradient-to-br from-red-600 to-rose-700 p-8 text-white shadow-2xl shadow-red-500/30 border border-white/20 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <AlertCircle size={120} />
                </div>

                <div className="flex items-center gap-6 relative z-10">
                  <div className="h-16 w-16 rounded-[1.25rem] bg-white/20 flex items-center justify-center backdrop-blur-xl shrink-0 ring-1 ring-white/30">
                    <AlertCircle size={32} className="text-white animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-2xl font-light uppercase tracking-tight">
                        Erro de Mapeamento Detectado
                      </h2>
                      <div className="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-semibold uppercase tracking-widest border border-white/30">
                        Alerta Crítico
                      </div>
                    </div>
                    <p className="text-xs font-medium uppercase text-red-100/90 tracking-widest leading-relaxed max-w-xl">
                      Identificamos posições com capacidade excedida. Isso pode causar problemas na sincronização:{" "}
                      <span className="text-white underline decoration-white/30 underline-offset-4">
                        {advancedStats.overflowPositions.join(", ")}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleVerNoMapa(advancedStats.overflowPositions[0])}
                  className="px-8 py-4 bg-white text-red-600 hover:bg-red-50 rounded-2xl text-xs font-semibold uppercase tracking-[0.15em] transition-all shadow-xl hover:shadow-2xl active:scale-95 shrink-0 ring-1 ring-black/5"
                >
                  Ver no Mapa
                </button>
              </motion.div>
            )}

            <div id="warehouse-map" className="space-y-6">
              {/* Global Map Summary */}
              {(() => {
                const allStreetPositions = Object.values(streetData).flatMap((sections) =>
                  Object.values(sections).flat()
                )
                const activeStreetPositions = allStreetPositions.filter(
                  (p: any) => !p.is_blocked && p.status !== "Fechado" && p.status !== "Bloqueado"
                )
                const globalCap = Math.round(
                  activeStreetPositions.reduce((acc, p) => acc + (p.capacidade || 0), 0)
                )
                const globalUso = Math.round(
                  activeStreetPositions.reduce((acc, p) => acc + (p.paletes || 0), 0)
                )
                const globalLivre = Math.max(0, globalCap - globalUso)
                const globalOccupancy = globalCap > 0 ? (globalUso / globalCap) * 100 : 0

                return (
                  <div className="p-5 rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-2xl relative overflow-hidden group/global">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

                    <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <Warehouse size={24} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight uppercase">
                            Resumo Geral do Armazém
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.2em]">
                              Monitoramento em Tempo Real
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-8">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
                            Capacidade Total
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-light text-slate-900 dark:text-white tabular-nums tracking-tighter">
                              {fmtNum(globalCap)}
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 uppercase">PTs</span>
                          </div>
                        </div>
                        <div className="h-8 w-px bg-slate-100 dark:bg-slate-800" />
                        <div className="flex flex-col">
                          <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
                            Total em Uso
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-light text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tighter">
                              {fmtNum(globalUso)}
                            </span>
                            <span className="text-[10px] font-medium text-emerald-600/40 dark:text-emerald-900 uppercase">
                              PTs
                            </span>
                          </div>
                        </div>
                        <div className="h-8 w-px bg-slate-100 dark:bg-slate-800" />
                        <div className="flex flex-col">
                          <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
                            Vagas Livres
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-light text-blue-600 dark:text-blue-400 tabular-nums tracking-tighter">
                              {fmtNum(globalLivre)}
                            </span>
                            <span className="text-[10px] font-medium text-blue-600/40 dark:text-blue-900 uppercase">
                              Vagas
                            </span>
                          </div>
                        </div>
                        <div className="h-8 w-px bg-slate-100 dark:bg-slate-800" />
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
                            Ocupação
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-light text-slate-900 dark:text-white tabular-nums tracking-tighter">
                              {Math.round(globalOccupancy)}%
                            </span>
                            <div
                              className={cn(
                                "h-1.5 w-10 rounded-full",
                                globalOccupancy >= 95
                                  ? "bg-red-500"
                                  : globalOccupancy >= 80
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-8">
                {Object.entries(streetData).map(([streetName, sections]) => {
                  const allPositions = Object.values(sections).flat()
                  const activePositionsOnly = allPositions.filter(
                    (p: any) => !p.is_blocked && p.status !== "Fechado" && p.status !== "Bloqueado"
                  )
                  const lotadoPos = activePositionsOnly.filter(
                    (p: any) => Math.round(p.paletes) >= Math.round(p.capacidade) && Math.round(p.capacidade) > 0
                  ).length
                  const disponivelPos = activePositionsOnly.filter(
                    (p: any) => Math.round(p.paletes) > 0 && Math.round(p.paletes) < Math.round(p.capacidade)
                  ).length
                  const vazioPos = activePositionsOnly.filter((p: any) => Math.round(p.paletes) === 0).length

                  const totalUso = Math.round(
                    activePositionsOnly.reduce((acc: number, p: any) => acc + (p.paletes || 0), 0)
                  )
                  const totalCap = Math.round(
                    activePositionsOnly.reduce((acc: number, p: any) => acc + (p.capacidade || 0), 0)
                  )
                  const occupancyPercent = totalCap > 0 ? (totalUso / totalCap) * 100 : 0

                  return (
                    <div
                      key={streetName}
                      className="p-4 md:p-6 rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm relative group/card hover:shadow-xl dark:hover:shadow-slate-950/40 transition-all duration-300"
                    >
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
                        <div className="flex items-center gap-4">
                          <div className="flex overflow-hidden rounded-lg shadow-sm border border-black/5 dark:border-white/5">
                            <div className="bg-slate-200 dark:bg-slate-800 px-3 py-1.5 flex items-center justify-center font-semibold text-slate-700 dark:text-slate-300 text-[13px] tracking-tight border-r border-slate-300 dark:border-slate-700">
                              {streetName}
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-700 px-4 py-1.5 flex items-center justify-center font-semibold text-slate-500 dark:text-slate-400 text-[11px] tracking-widest uppercase">
                              Bloco
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-red-600" /> LOTADOS
                            </span>
                            <p className="text-lg font-semibold text-slate-900 dark:text-white leading-none tracking-tight">
                              {lotadoPos}
                            </p>
                          </div>
                          <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-6">
                            <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> DISPONÍVEIS
                            </span>
                            <p className="text-lg font-semibold text-slate-900 dark:text-white leading-none tracking-tight">
                              {disponivelPos}
                            </p>
                          </div>
                          <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-6">
                            <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-slate-500" /> VAZIOS
                            </span>
                            <p className="text-lg font-semibold text-slate-900 dark:text-white leading-none tracking-tight">
                              {vazioPos}
                            </p>
                          </div>
                          <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-6">
                            <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                              OCUPAÇÍO
                            </span>
                            <p className="text-lg font-semibold text-slate-900 dark:text-white leading-none tracking-tight">
                              {Math.round(occupancyPercent)}%
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mb-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                              CAPACIDADE TOTAL
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-base font-semibold text-slate-900 dark:text-white leading-none tracking-tight">
                                {totalCap}
                              </span>
                              <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase">
                                PTs
                              </span>
                            </div>
                          </div>
                          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700/50" />
                          <div className="flex flex-col">
                            <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                              EM USO
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400 leading-none tracking-tight">
                                {totalUso}
                              </span>
                              <span className="text-[9px] font-medium text-emerald-600/50 dark:text-emerald-400/50 uppercase">
                                PTs
                              </span>
                            </div>
                          </div>
                          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700/50" />
                          <div className="flex flex-col">
                            <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                              ESPAÇO LIVRE
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-base font-semibold text-blue-600 dark:text-blue-400 leading-none tracking-tight">
                                {Math.max(0, totalCap - totalUso)}
                              </span>
                              <span className="text-[9px] font-medium text-blue-600/50 dark:text-blue-400/50 uppercase">
                                Vagas
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="hidden sm:flex flex-col items-end">
                          <span className="text-[7px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-0.5">
                            Status Global
                          </span>
                          <div
                            className={cn(
                              "px-2 py-0.5 rounded-lg text-[8px] font-semibold uppercase tracking-wider border",
                              occupancyPercent >= 95
                                ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30"
                                : occupancyPercent >= 80
                                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30"
                                  : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30"
                            )}
                          >
                            {occupancyPercent >= 95
                              ? "Crítico"
                              : occupancyPercent >= 80
                                ? "Alto volume"
                                : "Operacional"}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 relative">
                        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-100 dark:bg-slate-800/60" />

                        {Object.entries(sections).map(([side, positions]) => {
                          const sideCapacity = positions.reduce(
                            (acc: number, p: any) =>
                              p.is_blocked || p.status === "Fechado" || p.status === "Bloqueado"
                                ? acc
                                : acc + (p.capacidade || 0),
                            0
                          )
                          const sideUsage = positions.reduce(
                            (acc: number, p: any) =>
                              p.is_blocked || p.status === "Fechado" || p.status === "Bloqueado"
                                ? acc
                                : acc + (p.paletes || 0),
                            0
                          )
                          const sideAvailable = Math.max(0, sideCapacity - sideUsage)

                          return (
                            <div key={side} className="space-y-4 relative z-10 py-1">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2 mb-4 gap-2">
                                <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest leading-none">
                                  Lado {side === "even" ? "PAR" : "ÍMPAR"}
                                </p>
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase">
                                    CAP: <span className="text-slate-700 dark:text-slate-300">{Math.round(sideCapacity)}</span>
                                  </span>
                                  <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase">
                                    USO: <span className="text-slate-700 dark:text-slate-300">{Math.round(sideUsage)}</span>
                                  </span>
                                  <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase">
                                    LIVRE:{" "}
                                    <span className="text-slate-700 dark:text-slate-300">{Math.round(sideAvailable)}</span>
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {positions.map((pos: any) => {
                                  const isFull =
                                    pos.capacidade > 0 && Math.round(pos.paletes) >= Math.round(pos.capacidade)
                                  const isOverflow =
                                    pos.capacidade > 0 && Math.round(pos.paletes) > Math.round(pos.capacidade)
                                  const isSelected = selectedPositions.has(pos.id)
                                  const displayNum = pos.id.match(/(\d+)$/)?.[1]?.slice(-3) || pos.id.slice(-3)

                                  return (
                                    <div key={pos.id} className="group relative">
                                      <button
                                        onClick={() => {
                                          if (selectionModeActive) {
                                            const newSelection = new Set(selectedPositions)
                                            if (newSelection.has(pos.id)) newSelection.delete(pos.id)
                                            else newSelection.add(pos.id)
                                            setSelectedPositions(newSelection)
                                          } else {
                                            setSelectedPosition(pos.id)
                                          }
                                        }}
                                        className={cn(
                                          "h-10 w-10 rounded-md border-2 flex items-center justify-center transition-all active:scale-95 relative",
                                          pos.id === blinkPosition &&
                                            "animate-pulse ring-4 ring-red-500 ring-offset-2 dark:ring-offset-slate-900 border-red-600 scale-110 z-20",
                                          pos.status === "Fechado"
                                            ? "bg-slate-100 dark:bg-slate-800/10 border-slate-300 dark:border-slate-700 text-slate-400 grayscale border-dashed"
                                            : pos.unregistered_error
                                              ? "bg-red-900/10 border-red-900 text-red-900 shadow-[0_0_10px_rgba(127,29,29,0.1)]"
                                              : isOverflow
                                                ? "bg-red-900/10 border-red-900 text-red-900 shadow-[0_0_10px_rgba(127,29,29,0.1)]"
                                                : isFull
                                                  ? "bg-transparent border-red-900/70 dark:border-red-900/30 text-red-600 dark:text-red-500"
                                                  : pos.paletes === 0
                                                    ? "bg-slate-50 dark:bg-slate-800/10 border-slate-200 dark:border-slate-800/50 text-slate-400 dark:text-slate-600"
                                                    : "bg-transparent border-emerald-900/70 dark:border-emerald-600/30 text-emerald-800 dark:text-emerald-500",
                                          isSelected &&
                                            !blinkPosition &&
                                            "ring-4 ring-blue-500/30 border-blue-600 z-10 scale-105"
                                        )}
                                      >
                                        {pos.status === "Fechado" ? (
                                          <Lock size={12} className="opacity-50" />
                                        ) : (
                                          <span className="text-[11px] font-mono font-semibold tracking-tighter leading-none">
                                            {displayNum}
                                          </span>
                                        )}
                                      </button>

                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[300] w-60 pointer-events-none">
                                        <div className="bg-slate-950/98 text-white rounded-2xl p-4 shadow-2xl border border-white/10 backdrop-blur-xl relative ring-1 ring-white/5">
                                          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                                            <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-widest">
                                              {pos.id}
                                            </span>
                                            <div
                                              className={cn(
                                                "h-3 w-3 rounded-full ring-2 ring-white/10",
                                                isFull ? "bg-red-500" : "bg-emerald-500"
                                              )}
                                            />
                                          </div>
                                          <div className="space-y-3">
                                            <div className="flex justify-between items-center text-[10px] font-semibold uppercase text-slate-400">
                                              <span>Ocupação</span>
                                              <span className="text-white text-[12px] font-semibold">
                                                {pos.is_blocked
                                                  ? "BLOQUEADO"
                                                  : pos.unregistered_error
                                                    ? "ERRO"
                                                    : `${Math.round(pos.paletes)}/${Math.round(pos.capacidade)} PTs`}
                                              </span>
                                            </div>
                                            {pos.status === "Fechado" && pos.observacao_pos && (
                                              <div className="pt-2 border-t border-white/5">
                                                <p className="text-[9px] font-semibold text-rose-400 uppercase mb-1">
                                                  Observação
                                                </p>
                                                <p className="text-[11px] font-medium text-slate-200 leading-tight italic break-words">
                                                  {pos.observacao_pos}
                                                </p>
                                              </div>
                                            )}
                                            {pos.products.length > 0 && (
                                              <div className="pt-2 border-t border-white/5">
                                                <p className="text-[9px] font-semibold text-slate-500 uppercase mb-1">
                                                  Item no Slot
                                                </p>
                                                <p className="text-[12px] font-semibold text-slate-100 truncate leading-tight tracking-tight">
                                                  {pos.products[0].sku}
                                                </p>
                                                {pos.products.length > 1 && (
                                                  <div className="mt-2 py-1 px-2 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-1.5">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                                                    <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-tight">
                                                      + {pos.products.length - 1} ITENS (SKU MIX)
                                                    </p>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-950/98" />
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {(displayMode === "nao_alocados" || displayMode === "quarentena" || displayMode === "retrabalho") &&
          (() => {
            const INVALID = (v: any) =>
              !v || v === "" || String(v).toUpperCase() === "NAN" || v === "-" || v === "S/ID" || v === "N/A"
            const grouped: { key: string; label: string; isSimple: boolean; items: any[] }[] = []
            const seen = new Map<string, number>()
            let simpleCount = 0
            paginatedData.forEach((item: any) => {
              const rawId = item.id_palete
              if (INVALID(rawId)) {
                const key = `__simple_${simpleCount++}_${item.id}`
                grouped.push({ key, label: "Palete Simples", isSimple: true, items: [item] })
              } else {
                const id = String(rawId).toUpperCase()
                if (seen.has(id)) {
                  grouped[seen.get(id)!].items.push(item)
                } else {
                  seen.set(id, grouped.length)
                  grouped.push({ key: id, label: id, isSimple: false, items: [item] })
                }
              }
            })

            const renderPalletTable = (
              title: string,
              groupData: typeof grouped,
              isEmptyText: string,
              isAgrupados: boolean,
              freePallets?: typeof grouped
            ) => (
              <div
                className={cn(
                  "flex flex-col h-[calc(100vh-320px)] min-h-[500px] rounded-3xl md:rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl dark:shadow-slate-950/50 overflow-hidden transition-colors relative",
                  isAgrupados && dragOverTarget === "LEFT_TABLE_CONTAINER"
                    ? "ring-4 ring-blue-500/50 bg-blue-50/5 dark:bg-blue-900/10"
                    : ""
                )}
                onDragOver={(e) => {
                  if (isAgrupados && draggedItem && !draggedItem.id_palete) {
                    e.preventDefault()
                    if (dragOverTarget !== "LEFT_TABLE_CONTAINER") {
                      handleDragOver(e, "LEFT_TABLE_CONTAINER")
                    }
                  }
                }}
                onDragLeave={(e) => {
                  if (isAgrupados && dragOverTarget === "LEFT_TABLE_CONTAINER") {
                    handleDragLeave(e)
                  }
                }}
                onDrop={(e) => {
                  if (isAgrupados && draggedItem && !draggedItem.id_palete) {
                    e.preventDefault()
                    e.stopPropagation()
                    if (dragOverTarget === "LEFT_TABLE_CONTAINER") {
                      handleDrop(e, "new_standalone_mix", null, null)
                    }
                  }
                }}
              >
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 tracking-tight">
                    {title}
                  </h4>
                  <span className="text-[10px] font-medium text-slate-500 bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded-full">
                    {groupData.length} registros
                  </span>
                </div>
                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative">
                  {groupData.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-400 dark:text-slate-500 italic p-6 text-center">
                      {isEmptyText}
                    </div>
                  ) : (
                    <table className="w-full min-w-[580px] text-left">
                      <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10">
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <th className="px-1 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400 w-5"></th>
                          <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400">
                            ID Palete
                          </th>
                          <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400">
                            Produto
                          </th>
                          <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400">
                            Descrição
                          </th>
                          <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400 text-right">
                            Qtd
                          </th>
                          <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400">
                            Classif.
                          </th>
                          <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400">
                            Obs
                          </th>
                          {user && (
                            <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400 text-center whitespace-nowrap">
                              Ação
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {groupData.map((group) => {
                          const isExpanded = expandedPallets.has(group.key)
                          const totalQty = group.items.reduce(
                            (s: number, i: any) => s + (Number(i.quantidade_total) || 0),
                            0
                          )
                          const isComposite = !group.isSimple
                          const singleItem = group.items[0]
                          const compositeDevCount = isComposite
                            ? group.items.filter((i: any) => isDevolucao(i)).length
                            : 0
                          return (
                            <React.Fragment key={group.key}>
                              <tr
                                onClick={() => isComposite && togglePallet(group.key)}
                                onDragOver={(e) => {
                                  if (
                                    draggedItem &&
                                    draggedItem.id !== singleItem?.id &&
                                    group.label !== draggedItem.id_palete
                                  ) {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleDragOver(e, group.key)
                                  }
                                }}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => {
                                  if (
                                    draggedItem &&
                                    draggedItem.id !== singleItem?.id &&
                                    group.label !== draggedItem.id_palete
                                  ) {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    if (isComposite) {
                                      handleDrop(e, "mix", group.label, group)
                                    } else {
                                      handleDrop(e, "new_mix", null, singleItem)
                                    }
                                  }
                                }}
                                draggable={!isComposite}
                                onDragStart={!isComposite ? (e: any) => handleDragStart(e, singleItem) : undefined}
                                onDragEnd={(e: any) => handleDragEnd(e)}
                                className={cn(
                                  "group transition-all duration-200 relative",
                                  isComposite
                                    ? "border-b-2 border-slate-200 dark:border-slate-700/50 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-500/5"
                                    : "border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
                                  dragOverTarget === group.key
                                    ? "bg-blue-100/50 dark:bg-blue-900/30 ring-2 ring-blue-400 z-10"
                                    : "",
                                  draggedItem?.id === singleItem?.id ? "opacity-50" : ""
                                )}
                              >
                                <td className="px-1 py-1.5 w-5">
                                  {isComposite ? (
                                    <span
                                      className={cn(
                                        "inline-flex items-center justify-center h-4 w-4 rounded-full text-blue-500 bg-blue-50 dark:bg-blue-500/10 transition-transform",
                                        isExpanded && "rotate-90"
                                      )}
                                    >
                                      <ChevronRight size={10} strokeWidth={3} />
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-2 py-1.5">
                                  {group.isSimple ? (
                                    <span className="text-[9px] italic text-slate-400 whitespace-nowrap">
                                      S/ ALOCAÇÃO
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-1 flex-nowrap">
                                      <span className="text-[9px] font-semibold text-blue-500 dark:text-blue-300 tracking-wide whitespace-nowrap">
                                        {group.label}
                                      </span>
                                      {isComposite && (
                                        <span className="text-[8px] font-medium text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1 py-0.5 rounded-full whitespace-nowrap">
                                          {group.items.length} SKUs
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="px-2 py-1.5">
                                  {isComposite ? (
                                    <span className="text-[9px] text-slate-300 dark:text-slate-600 italic">—</span>
                                  ) : (
                                    <span className="text-[10px] font-normal text-slate-700 dark:text-slate-300 tracking-tight">
                                      {singleItem.produto || "—"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 max-w-[120px]">
                                  {isComposite ? (
                                    <span className="text-[8px] text-slate-400 italic">
                                      Misto c/ {group.items.length} itens
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase truncate block max-w-[120px]">
                                      {singleItem.descricao || "—"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                    {fmtNum(totalQty)}
                                  </span>
                                </td>
                                <td
                                  className="px-2 py-1.5"
                                  onClick={(e) => (isComposite ? undefined : e.stopPropagation())}
                                >
                                  {isComposite ? (
                                    compositeDevCount > 0 ? (
                                      <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap">
                                        {compositeDevCount} Dev.
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-slate-400 italic">Por linha</span>
                                    )
                                  ) : (
                                    <select
                                      value={extractRowClassificacao(singleItem)}
                                      disabled={updatingClassificacaoId === String(singleItem.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onChange={(e) =>
                                        handleUpdateRowClassificacao(
                                          singleItem,
                                          e.target.value as ClassificacaoPalete
                                        )
                                      }
                                      className={cn(
                                        "text-[9px] font-semibold rounded-lg px-1.5 py-1 border outline-none cursor-pointer transition-colors",
                                        isDevolucao(singleItem)
                                          ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
                                          : extractRowClassificacao(singleItem) === "Normal"
                                            ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                                            : "bg-transparent border-slate-200 dark:border-slate-700/70 text-slate-400 dark:text-slate-500"
                                      )}
                                    >
                                      {CLASSIFICACAO_OPTIONS.map((opt) => (
                                        <option
                                          key={opt.value || "empty"}
                                          value={opt.value}
                                          className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                                        >
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </td>
                                <td className="px-2 py-1.5">
                                  {!isComposite &&
                                    (() => {
                                      const obs = singleItem.observacao
                                      const strObs = obs && obs !== 0 ? String(obs) : "-"
                                      const isCrit = strObs.endsWith("!")
                                      return (
                                        <span
                                          className={cn(
                                            "text-[9px] italic truncate block max-w-[80px] px-1 py-0.5 rounded w-fit",
                                            isCrit
                                              ? "text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 not-italic"
                                              : "text-slate-400"
                                          )}
                                        >
                                          {strObs}
                                        </span>
                                      )
                                    })()}
                                </td>
                                {user && (
                                  <td className="px-2 py-1.5 text-center whitespace-nowrap">
                                    {!isComposite && (
                                      <div className="flex items-center justify-center gap-0.5">
                                        {Number(singleItem.quantidade_total) > 1 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setSplitTarget(singleItem)
                                              setSplitQtyPerPallet("")
                                              setSplitModalOpen(true)
                                            }}
                                            className="p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded transition-colors"
                                            title="Retirar peças"
                                          >
                                            <Scissors size={11} />
                                          </button>
                                        )}
                                        {(() => {
                                          const sameSku = freePallets
                                            ? freePallets.filter(
                                                (g) => g.items[0]?.produto === singleItem.produto
                                              )
                                            : []
                                          if (sameSku.length > 1) {
                                            return (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  const ids = sameSku.map((g) => g.items[0].id)
                                                  setMergeTarget({
                                                    sku: singleItem.produto,
                                                    items: sameSku.map((g) => g.items[0]),
                                                  })
                                                  setSelectedMergeIds(new Set(ids))
                                                  setMergeModalOpen(true)
                                                }}
                                                className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded transition-colors"
                                                title="Mover peças"
                                              >
                                                <GitMerge size={11} />
                                              </button>
                                            )
                                          }
                                          return null
                                        })()}
                                        {displayMode === "retrabalho" && (
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation()
                                              if (!singleItem?.id) return
                                              if (
                                                !window.confirm(
                                                  `Mover ${singleItem.produto || "item"} (${singleItem.quantidade_total || singleItem.quantidade || 0} un.) do Retrabalho para o Chão?`
                                                )
                                              )
                                                return
                                              try {
                                                const { error } = await supabase
                                                  .from("mapeamento")
                                                  .update({ Posição: "Chão" })
                                                  .eq("id", singleItem.id)
                                                if (error) throw error
                                                await fetchData()
                                              } catch (err: any) {
                                                alert("Erro ao mover para o Chão: " + err.message)
                                              }
                                            }}
                                            className="px-1.5 py-0.5 text-[8px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded transition-colors flex items-center gap-0.5 uppercase whitespace-nowrap"
                                            title="Mover do Retrabalho para o Chão"
                                          >
                                            <RefreshCw size={9} /> p/ Chão
                                          </button>
                                        )}
                                        {displayMode === "nao_alocados" && (
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation()
                                              if (!singleItem?.id) return
                                              if (
                                                !window.confirm(
                                                  `Mover ${singleItem.produto || "item"} (${singleItem.quantidade_total || singleItem.quantidade || 0} un.) do Chão para o Retrabalho?`
                                                )
                                              )
                                                return
                                              try {
                                                const { error } = await supabase
                                                  .from("mapeamento")
                                                  .update({ Posição: "Retrabalho" })
                                                  .eq("id", singleItem.id)
                                                if (error) throw error
                                                await fetchData()
                                              } catch (err: any) {
                                                alert("Erro ao mover para o Retrabalho: " + err.message)
                                              }
                                            }}
                                            className="p-1 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded transition-colors"
                                            title="Mover do Chão para o Retrabalho"
                                          >
                                            <RefreshCw size={11} />
                                          </button>
                                        )}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setDeleteTarget(singleItem)
                                            setDeleteQuantity(String(singleItem.quantidade_total || "0"))
                                          }}
                                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                                          title="Excluir"
                                        >
                                          <Trash2 size={11} />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                )}
                              </tr>
                              {/* Sub-rows */}
                              <AnimatePresence>
                                {isComposite &&
                                  isExpanded &&
                                  group.items.map((sub: any, si: number) => (
                                    <motion.tr
                                      key={sub.id}
                                      initial={{ opacity: 0, y: -4 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                                      transition={{ delay: si * 0.04 }}
                                      draggable
                                      onDragStart={(e: any) => handleDragStart(e, sub)}
                                      onDragEnd={(e: any) => handleDragEnd(e)}
                                      className={cn(
                                        "bg-blue-50/30 dark:bg-blue-500/5 border-b border-blue-100/50 dark:border-blue-500/10 cursor-grab active:cursor-grabbing",
                                        draggedItem?.id === sub.id ? "opacity-50" : ""
                                      )}
                                    >
                                      <td className="px-1 py-1">
                                        <div className="w-px h-full bg-blue-200 dark:bg-blue-700 mx-auto opacity-50"></div>
                                      </td>
                                      <td className="px-2 py-1">
                                        <span className="text-[8px] font-medium text-blue-500 dark:text-blue-400 pl-1.5 border-l-2 border-blue-200">
                                          ╰ sub
                                        </span>
                                      </td>
                                      <td className="px-2 py-1">
                                        <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300">
                                          {sub.produto || "—"}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1 max-w-[120px]">
                                        <span className="text-[8px] text-slate-400 uppercase truncate block max-w-[120px]">
                                          {sub.descricao || "—"}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1 text-right">
                                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
                                          {fmtNum(sub.quantidade_total)}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                                        <select
                                          value={extractRowClassificacao(sub)}
                                          disabled={updatingClassificacaoId === String(sub.id)}
                                          onClick={(e) => e.stopPropagation()}
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onChange={(e) =>
                                            handleUpdateRowClassificacao(
                                              sub,
                                              e.target.value as ClassificacaoPalete
                                            )
                                          }
                                          className={cn(
                                            "text-[8px] font-semibold rounded-md px-1 py-0.5 border outline-none cursor-pointer transition-colors",
                                            isDevolucao(sub)
                                              ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
                                              : extractRowClassificacao(sub) === "Normal"
                                                ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                                                : "bg-transparent border-slate-200 dark:border-slate-700/70 text-slate-400 dark:text-slate-500"
                                          )}
                                        >
                                          {CLASSIFICACAO_OPTIONS.map((opt) => (
                                            <option
                                              key={opt.value || "empty"}
                                              value={opt.value}
                                              className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                                            >
                                              {opt.label}
                                            </option>
                                          ))}
                                        </select>
                                      </td>
                                      <td className="px-2 py-1">
                                        {(() => {
                                          const obs = sub.observacao
                                          const strObs = obs && obs !== 0 ? String(obs) : "-"
                                          return (
                                            <span className="text-[8px] text-slate-400 truncate block max-w-[70px]">
                                              {strObs}
                                            </span>
                                          )
                                        })()}
                                      </td>
                                      {user && (
                                        <td className="px-2 py-1 text-center flex items-center justify-end gap-0.5 whitespace-nowrap">
                                          {displayMode === "retrabalho" && (
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation()
                                                if (!sub?.id) return
                                                if (
                                                  !window.confirm(
                                                    `Mover ${sub.produto || "item"} (${sub.quantidade_total || sub.quantidade || 0} un.) do Retrabalho para o Chão?`
                                                  )
                                                )
                                                  return
                                                try {
                                                  const { error } = await supabase
                                                    .from("mapeamento")
                                                    .update({ Posição: "Chão" })
                                                    .eq("id", sub.id)
                                                  if (error) throw error
                                                  await fetchData()
                                                } catch (err: any) {
                                                  alert("Erro ao mover para o Chão: " + err.message)
                                                }
                                              }}
                                              className="px-1.5 py-0.5 text-[8px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded transition-colors flex items-center gap-0.5 uppercase whitespace-nowrap"
                                              title="Mover do Retrabalho para o Chão"
                                            >
                                              <RefreshCw size={9} /> p/ Chão
                                            </button>
                                          )}
                                          {displayMode === "nao_alocados" && (
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation()
                                                if (!sub?.id) return
                                                if (
                                                  !window.confirm(
                                                    `Mover ${sub.produto || "item"} (${sub.quantidade_total || sub.quantidade || 0} un.) do Chão para o Retrabalho?`
                                                  )
                                                )
                                                  return
                                                try {
                                                  const { error } = await supabase
                                                    .from("mapeamento")
                                                    .update({ Posição: "Retrabalho" })
                                                    .eq("id", sub.id)
                                                  if (error) throw error
                                                  await fetchData()
                                                } catch (err: any) {
                                                  alert("Erro ao mover para o Retrabalho: " + err.message)
                                                }
                                              }}
                                              className="p-1 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded transition-colors"
                                              title="Mover do Chão para o Retrabalho"
                                            >
                                              <RefreshCw size={11} />
                                            </button>
                                          )}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setDeleteTarget(sub)
                                              setDeleteQuantity(String(sub.quantidade_total || "0"))
                                            }}
                                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                                            title="Excluir sub-item"
                                          >
                                            <Trash2 size={10} />
                                          </button>
                                        </td>
                                      )}
                                    </motion.tr>
                                  ))}
                              </AnimatePresence>
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )

            const agrupados = grouped.filter((g) => !g.isSimple)
            const desagrupados = grouped.filter((g) => g.isSimple)

            return (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start w-full">
                {renderPalletTable(
                  "Paletes Agrupados",
                  agrupados,
                  "Nenhum palete agrupado no momento.",
                  true
                )}
                {renderPalletTable(
                  "Livres (Sem Alocação / Sem Agrupamento)",
                  desagrupados,
                  "Nenhum item livre. Todos estão agrupados ou a lista está vazia.",
                  false,
                  desagrupados
                )}
              </div>
            )
          })()}

        {displayMode === "devolucoes" && (
          <ClassificacoesTab
            effectiveData={effectiveData}
            data={data}
            setData={setData}
            search={search}
            pendingChanges={pendingChanges}
            setPendingChanges={setPendingChanges}
            updatingClassificacaoId={updatingClassificacaoId}
            onUpdateRowClassificacao={handleUpdateRowClassificacao}
            onMissingClassificacaoColumn={() => setMissingClassificacaoColumn(true)}
            onVerNoMapa={handleVerNoMapa}
            onPrintDevolucoes={onPrintDevolucoes}
            fmtNum={fmtNum}
          />
        )}

        {displayMode === "tabela" && (
          <div className="rounded-3xl md:rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl dark:shadow-slate-950/50 overflow-x-auto custom-scrollbar transition-colors">
            <div className="min-w-[800px] lg:min-w-full">
              <WarehouseTable
                columns={getColumns()}
                data={paginatedData}
                delay={0.1}
                onRowClick={(row) => {
                  if (activeView === "produtos") {
                    setModalFilter(false)
                    setSelectedProduct(row.produto)
                  }
                  if (activeView === "molhados") {
                    setModalFilter(true)
                    setSelectedProduct(row.produto)
                  }
                }}
                selectable={false}
                selectedIds={selectedNaoAlocados}
                onSelectionChange={setSelectedNaoAlocados}
                idAccessor="id"
                sortConfig={tableSort}
                onSort={handleSort}
              />
            </div>
          </div>
        )}

        {/* Pagination for table within mapeamento */}
        {(displayMode === "tabela" || displayMode === "nao_alocados" || displayMode === "quarentena") &&
          totalPages >= 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 pb-12 transition-colors">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest order-2 sm:order-1">
                {rowsPerPage === "ALL"
                  ? `Exibindo todos os ${filteredData.length} itens`
                  : `Página ${currentPage} de ${totalPages}`}
              </span>
              <div className="flex gap-3 order-1 sm:order-2 items-center">
                {user && (
                  <button
                    onClick={() => setIsAddItemModalOpen(true)}
                    className="px-4 py-2 sm:px-3 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 whitespace-nowrap"
                  >
                    <Plus size={14} />
                    <span>Adicionar Item</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setRowsPerPage((prev) => (prev === "ALL" ? 10 : "ALL"))
                    setCurrentPage(1)
                  }}
                  className="px-4 py-2 sm:px-3 sm:py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-normal text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  {rowsPerPage === "ALL" ? "Voltar ao padrão" : "Ver todos"}
                </button>
                {rowsPerPage !== "ALL" && (
                  <>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="flex-1 sm:flex-none p-4 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm transition-all active:scale-95"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="flex-1 sm:flex-none p-4 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm transition-all active:scale-95"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

        {(globalStats?.pendencias?.length ?? 0) > 0 && (
          <div className="mt-12 mb-8">
            <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-3xl p-6 shadow-sm overflow-hidden relative">
              <div className="absolute -top-10 -right-10 text-amber-500/5 rotate-12 pointer-events-none">
                <Package size={200} />
              </div>

              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-xl">
                    <AlertTriangle className="text-amber-600 dark:text-amber-400" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-300">
                      Janela de Pendências
                    </h3>
                    <p className="text-[10px] uppercase font-bold text-amber-700/60 dark:text-amber-400/60 tracking-wider">
                      Produtos no Registro sem Mapeamento Físico Completo
                    </p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-white/60 dark:bg-slate-900/60 rounded-lg text-xs font-normal text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 backdrop-blur-sm shadow-sm">
                  {globalStats.pendencias.length}{" "}
                  {globalStats.pendencias.length === 1 ? "Código com Pendência" : "Códigos com Pendência"}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 relative z-10">
                {globalStats.pendencias.map((div: any) => (
                  <div
                    key={div.sku}
                    className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 border border-amber-100 dark:border-amber-500/10 flex flex-col gap-3 transition-transform hover:scale-[1.02] shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-amber-300 dark:hover:border-amber-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">
                        {div.sku}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-lg border bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                        {div.diff.toLocaleString("pt-BR")} UN
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <span className="text-[9px] uppercase tracking-wider font-bold mb-1">Mapeado</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {div.mapQty.toLocaleString("pt-BR")}{" "}
                          <span className="text-[10px] font-medium text-slate-400">UN</span>
                        </span>
                      </div>
                      <div className="flex flex-col text-right p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <span className="text-[9px] uppercase tracking-wider font-bold mb-1 text-slate-400">
                          Registrado
                        </span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {div.regQty.toLocaleString("pt-BR")}{" "}
                          <span className="text-[10px] font-medium text-slate-400">UN</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      {typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Floating Action Bar for Selected floor pallets */}
            <AnimatePresence>
              {displayMode === "nao_alocados" && selectedNaoAlocados.size > 0 && (
                <motion.div
                  initial={{ y: 100, x: "-50%", opacity: 0 }}
                  animate={{ y: 0, x: "-50%", opacity: 1 }}
                  exit={{ y: 100, x: "-50%", opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="fixed bottom-10 left-1/2 z-50 flex items-center gap-6 bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-3xl px-10 py-4 ring-1 ring-white/10"
                >
                  <div className="flex flex-col">
                    <span className="text-white text-base font-semibold tracking-tight">
                      {selectedNaoAlocados.size} selecionado{selectedNaoAlocados.size > 1 ? "s" : ""}
                    </span>
                    <span className="text-slate-400 text-[9px] font-semibold uppercase tracking-widest leading-none mt-0.5">
                      Gestão de Chão
                    </span>
                  </div>

                  <div className="h-8 w-px bg-slate-700/50 mx-2"></div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowGroupModal(true)}
                      disabled={isProcessingGroup}
                      className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 group/btn"
                    >
                      <div className="h-6 w-6 rounded-lg bg-white/20 flex items-center justify-center group-hover/btn:rotate-12 transition-transform">
                        <Layers size={14} />
                      </div>
                      <span className="text-sm font-semibold uppercase tracking-[0.1em]">Agrupar Mix</span>
                    </button>

                    <button
                      onClick={async () => {
                        if (!selectedNaoAlocados || selectedNaoAlocados.size === 0) return
                        if (
                          window.confirm(
                            `Mover os ${selectedNaoAlocados.size} itens selecionados do Chão para o Retrabalho?`
                          )
                        ) {
                          try {
                            const idsToMove = Array.from(selectedNaoAlocados)
                            const { error } = await supabase
                              .from("mapeamento")
                              .update({ Posição: "Retrabalho" })
                              .in("id", idsToMove)
                            if (error) throw error
                            setSelectedNaoAlocados(new Set())
                            await fetchData()
                          } catch (err: any) {
                            alert("Erro ao mover para o Retrabalho: " + err.message)
                          }
                        }
                      }}
                      disabled={isProcessingGroup}
                      className="h-12 px-6 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 group/btn cursor-pointer"
                    >
                      <RefreshCw size={18} />
                      <span className="text-sm font-semibold uppercase tracking-[0.1em]">Mover p/ Retrabalho</span>
                    </button>

                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Deseja realmente desagrupar os ${selectedNaoAlocados.size} itens selecionados?`
                          )
                        ) {
                          handleUngroupSelected()
                        }
                      }}
                      disabled={isProcessingGroup}
                      className="h-12 px-6 bg-slate-800 hover:bg-rose-900/40 text-rose-400 border border-slate-700 hover:border-rose-700/50 rounded-2xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 group/btn"
                    >
                      <X size={18} />
                      <span className="text-sm font-semibold uppercase tracking-[0.1em]">Limpar ID</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating Action Bar for Manual Selection on Map */}
            <AnimatePresence>
              {selectionModeActive && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-fit"
                >
                  <div className="bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-2xl px-6 py-4 rounded-[2rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-8 min-w-[320px] md:min-w-[450px]">
                    <div className="flex flex-col text-left">
                      <span className="text-blue-400 text-[10px] font-semibold uppercase tracking-[0.2em]">
                        Seleção Ativa
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-white text-2xl font-light">{selectedPositions.size}</span>
                        <span className="text-slate-400 text-xs font-medium uppercase">
                          {selectedPositions.size === 1 ? "Posição Escolhida" : "Posições Escolhidas"}
                        </span>
                      </div>
                    </div>

                    <div className="h-8 w-px bg-white/10" />

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setSelectionModeActive(false)
                          setSelectedPositions(new Set())
                        }}
                        className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-[11px] font-semibold uppercase tracking-wider transition-all active:scale-95"
                      >
                        Sair
                      </button>
                      <button
                        disabled={selectedPositions.size === 0}
                        onClick={() => handleExportSelection()}
                        className={cn(
                          "px-8 py-3 rounded-2xl text-white text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95",
                          selectedPositions.size > 0
                            ? "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/25 cursor-pointer"
                            : "bg-slate-700 opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Printer size={14} strokeWidth={2.5} />
                        Imprimir Seleção
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>,
          document.body
        )}
    </motion.div>
  )
}
