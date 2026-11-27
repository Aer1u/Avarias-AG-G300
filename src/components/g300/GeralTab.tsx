// =============================================================================
// SYSTEM: MÓDULO G300 (ESTOQUE, AVARIAS & DRIVE-IN)
// OWNER:  Workspace Admin G300 (Nível 3)
// SCOPE:  Aba Geral (Dashboard Executivo G300)
// PURPOSE: KPIs principais, ocupação física, histórico de paletes, Top 3 SKUs,
//          fluxo de registros e gráfico analítico de origem.
// =============================================================================

"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Package,
  BarChart3,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  History,
  Box,
  MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MetricCard } from "./MetricCard"
import { OriginDonutChart } from "./OriginDonutChart"

export interface GeralTabProps {
  error: string | null
  loading: boolean
  data: any[]
  effectiveData: any[]
  globalStats: any
  stats: any
  palletTrend: number | undefined
  advancedStats: any
  palletHistory: { t14: number; t17: number; t22: number; prevT22: number }
  dailyHistoryRecords: { date: string; value: number }[]
  topSkus: any[]
  topSkusFilter: "geral" | "molhado" | "incidencia"
  setTopSkusFilter: React.Dispatch<React.SetStateAction<"geral" | "molhado" | "incidencia">>
  topSkusSort: "quantidade" | "incidencia"
  movementPeriod: "hoje" | "semana" | "mensal"
  setMovementPeriod: React.Dispatch<React.SetStateAction<"hoje" | "semana" | "mensal">>
  fmtNum: (val: number, locale?: string) => string
}

export function GeralTab({
  error,
  loading,
  data,
  effectiveData,
  globalStats,
  stats,
  palletTrend,
  advancedStats,
  palletHistory,
  dailyHistoryRecords,
  topSkus,
  topSkusFilter,
  setTopSkusFilter,
  topSkusSort,
  movementPeriod,
  setMovementPeriod,
  fmtNum,
}: GeralTabProps) {
  const [palletHistoryFilter, setPalletHistoryFilter] = useState<"hoje" | "dias">("hoje")
  const [showMovementMenu, setShowMovementMenu] = useState(false)
  const [hoveredBarId, setHoveredBarId] = useState<string | null>(null)
  const [originTypeFilter, setOriginTypeFilter] = useState<"entrada" | "saída">("entrada")
  const [originPeriod, setOriginPeriod] = useState<"hoje" | "semana" | "mensal" | "tudo">("tudo")
  const [showOriginPeriodMenu, setShowOriginPeriodMenu] = useState(false)

  return (
    <motion.div
      key="geral-content"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 rounded-2xl border border-red-200 dark:border-red-900/20 bg-red-50 dark:bg-red-900/10 p-5 text-sm font-bold text-red-600 dark:text-red-400 shadow-xl shadow-red-100 dark:shadow-red-900/10 transition-colors"
        >
          <AlertCircle size={20} />
          {error}
        </motion.div>
      )}

      {/* KPIs Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Paletes Totais"
          value={(() => {
            const val = globalStats?.total_pallets ?? stats?.total_pallets ?? 0
            if (val === 0 && loading && data.length === 0) return "---"
            return val.toLocaleString("pt-BR")
          })()}
          icon={Package}
          delay={0.1}
          description={
            palletTrend !== undefined ? (
              <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold uppercase tracking-wider">
                <span
                  className={cn(
                    "flex items-center gap-0.5",
                    palletTrend >= 0
                      ? "text-emerald-500 dark:text-emerald-400"
                      : "text-red-500 dark:text-red-400"
                  )}
                >
                  {palletTrend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {palletTrend >= 0 ? "+" : ""}
                  {palletTrend.toLocaleString("pt-BR")}
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-bold ml-1 tracking-widest leading-none">
                  vs ontem
                </span>
              </div>
            ) : undefined
          }
          hoverContent={
            <div className="flex items-center justify-around gap-10 text-center w-full">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Alocados
                </span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 transition-colors">
                  {fmtNum(advancedStats.alocadosPallets)}
                </span>
              </div>
              <div className="h-6 w-[1px] bg-slate-200 dark:bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Não Alocados
                </span>
                <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 transition-colors">
                  {fmtNum(advancedStats.naoAlocadosPallets)}
                </span>
              </div>
            </div>
          }
        />
        <MetricCard
          title={<div className="flex items-center gap-2">Peças Totais</div>}
          value={(() => {
            const val = globalStats?.absolute_total_quantity ?? stats?.absolute_total_quantity ?? 0
            if (val === 0 && loading && data.length === 0) return "---"
            return val.toLocaleString("pt-BR")
          })()}
          icon={BarChart3}
          delay={0.2}
          description={(() => {
            const todayNet = stats?.today_net ?? 0
            const delta = todayNet

            return (
              <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold uppercase tracking-wider">
                <span
                  className={cn(
                    "flex items-center gap-0.5",
                    delta > 0
                      ? "text-emerald-500 dark:text-emerald-400"
                      : delta < 0
                      ? "text-red-500 dark:text-red-400"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                >
                  {delta > 0 ? <TrendingUp size={10} /> : delta < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                  {delta > 0 ? "+" : ""}
                  {delta.toLocaleString("pt-BR")}
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-bold ml-1 tracking-widest leading-none">
                  vs ontem
                </span>
              </div>
            )
          })()}
          hoverContent={
            <div className="grid grid-cols-2 gap-x-10 gap-y-4 text-center w-full">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Alocadas
                </span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 transition-colors">
                  {fmtNum(
                    effectiveData
                      .filter((i) => {
                        const p = String(i.posicao || "").toUpperCase()
                        return p !== "CHÃO" && p !== "CHAO"
                      })
                      .reduce((s, i) => s + (i.quantidade_total || 0), 0)
                  )}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Não Alocadas
                </span>
                <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 transition-colors">
                  {fmtNum(
                    effectiveData
                      .filter((i) => {
                        const p = String(i.posicao || "").toUpperCase()
                        return p === "CHÃO" || p === "CHAO"
                      })
                      .reduce((s, i) => s + (i.quantidade_total || 0), 0)
                  )}
                </span>
              </div>
              <div className="col-span-2 h-[1px] bg-slate-200 dark:bg-white/10 my-1" />
              <div className="flex flex-col border-r border-slate-200 dark:border-white/10 pr-6">
                <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Molhados
                </span>
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 transition-colors">
                  {fmtNum(stats?.qtd_molhado || 0)}{" "}
                  <span className="text-[10px] text-slate-500 dark:text-slate-500 font-medium">un</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Tombadas
                </span>
                <span className="text-sm font-semibold text-red-600 dark:text-red-400 transition-colors">
                  {fmtNum(stats?.qtd_tombada || 0)}{" "}
                  <span className="text-[10px] text-slate-500 dark:text-slate-500 font-medium">un</span>
                </span>
              </div>
            </div>
          }
        />
        <MetricCard
          title="Drive-in ativos"
          value={advancedStats.totalPositions}
          icon={ShieldCheck}
          delay={0.1}
          hoverContent={
            <div className="flex items-center justify-around gap-8 text-center w-full">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Completos
                </span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 transition-colors">
                  {advancedStats.completoCount}
                </span>
              </div>
              <div className="h-6 w-[1px] bg-slate-200 dark:bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Disponíveis
                </span>
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 transition-colors">
                  {advancedStats.disponivelCount}
                </span>
              </div>
            </div>
          }
        />
        <MetricCard
          title="SKUs Ativos"
          value={(() => {
            const val = globalStats?.absolute_total_skus ?? stats?.absolute_total_skus ?? 0
            if (val === 0 && loading && data.length === 0) return "---"
            return val.toLocaleString("pt-BR")
          })()}
          icon={TrendingUp}
          delay={0.4}
        />
      </div>

      {/* Analytics Section — Locked Height 310px */}
      <div className="grid grid-cols-1 gap-4 md:gap-8 lg:grid-cols-3">
        {/* Capacity Donut */}
        <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-5 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors h-[310px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                CAPACIDADE FÍSICA
              </h3>
              <p className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 tracking-widest mt-1">
                VOL. GEOGRÁFICO G300
              </p>
            </div>
            <History size={18} className="text-slate-400 dark:text-slate-600" />
          </div>
          <div className="flex flex-col items-center justify-center h-full pb-4">
            <div className="group/donut relative h-40 w-40 cursor-help">
              {/* Overlay de Composição no Hover */}
              <div className="opacity-0 group-hover/donut:opacity-100 absolute inset-[-10%] bg-slate-950/98 backdrop-blur-xl rounded-[2.5rem] flex flex-col items-center justify-center transition-all duration-300 z-30 scale-95 group-hover/donut:scale-100 border border-white/20 p-5 shadow-2xl">
                <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-4">
                  COMPOSIÇÃO
                </span>
                <div className="w-full space-y-2">
                  {advancedStats.breakdown.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center border-b border-white/10 pb-1.5 last:border-0"
                    >
                      <span className="text-[9px] font-semibold text-slate-400 uppercase">
                        {item.count} DRIVE-IN DE
                      </span>
                      <span className="text-[10px] font-semibold text-white">{item.capacity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  className="text-slate-50 dark:text-slate-800"
                  strokeWidth="8"
                  stroke="currentColor"
                  strokeLinecap="butt"
                  fill="transparent"
                  r="42"
                  cx="50"
                  cy="50"
                />
                <motion.circle
                  className="text-blue-600 dark:text-blue-500"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeLinecap="butt"
                  initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                  animate={{
                    strokeDashoffset: 2 * Math.PI * 42 * (1 - advancedStats.occupiedPercent / 100),
                  }}
                  stroke="currentColor"
                  fill="transparent"
                  r="42"
                  cx="50"
                  cy="50"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center group-hover/donut:opacity-0 transition-opacity duration-200">
                <div className="flex items-baseline">
                  <span className="text-3xl font-light text-slate-900 dark:text-slate-100 tracking-tighter">
                    {Math.round(advancedStats.occupiedPercent)}
                  </span>
                  <span className="text-base font-semibold text-blue-500 dark:text-blue-400 ml-0.5">%</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                  OCUPAÇÃO
                </span>
              </div>
            </div>

            {/* Métricas Compactas no Rodapé */}
            <div className="mt-auto w-full flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/50">
              <div className="flex flex-col">
                <span className="text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5">
                  TOTAL
                </span>
                <span className="text-[12px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                  {advancedStats.totalCapacity.toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5">
                  USADO
                </span>
                <span className="text-[12px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                  {advancedStats.occupied.toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5">
                  LIVRE
                </span>
                <span className="text-[12px] font-semibold text-emerald-500 dark:text-emerald-400 tracking-tight">
                  {advancedStats.free.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Histórico de Paletes Card */}
        <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-5 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors h-[310px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                HISTÓRICO
              </h3>
              <p className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 tracking-widest mt-1">
                CRESCIMENTO DE PALETES
              </p>
            </div>
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-xl">
              <button
                onClick={() => setPalletHistoryFilter("hoje")}
                className={cn(
                  "px-2 py-1 text-[8px] font-semibold uppercase rounded-lg transition-all",
                  palletHistoryFilter === "hoje"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-400"
                )}
              >
                Hoje
              </button>
              <button
                onClick={() => setPalletHistoryFilter("dias")}
                className={cn(
                  "px-2 py-1 text-[8px] font-semibold uppercase rounded-lg transition-all",
                  palletHistoryFilter === "dias"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-400"
                )}
              >
                Dias
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6 flex-1 justify-center scrollbar-hide py-2">
            {palletHistoryFilter === "hoje" ? (
              <>
                <div className="grid grid-cols-3 items-center">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-semibold text-slate-400/80 uppercase tracking-widest mb-0.5">
                      MANHÃ
                    </span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                      14:20
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    {(() => {
                      const now = new Date()
                      const hour = now.getHours()
                      const min = now.getMinutes()
                      const pastTime = hour > 14 || (hour === 14 && min >= 20)

                      if (palletHistory.t14 === 0) {
                        if (!pastTime) {
                          return (
                            <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                              Aguardando
                            </span>
                          )
                        }
                        return (
                          <span className="text-[9px] font-semibold text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                            Não apurado
                          </span>
                        )
                      }
                      return (
                        <span className="text-xs font-normal text-slate-700 dark:text-slate-300 tracking-tight">
                          {palletHistory.t14.toLocaleString("pt-BR")}
                          <span className="text-[10px] font-medium text-slate-400 ml-1">Paletes</span>
                        </span>
                      )
                    })()}
                  </div>
                  <div className="flex items-center justify-end">
                    {(() => {
                      const diff = palletHistory.t14 - palletHistory.prevT22
                      if (palletHistory.t14 === 0) return <span className="text-[9px] font-medium text-slate-400">-</span>
                      if (palletHistory.prevT22 === 0)
                        return <span className="text-[9px] font-medium text-slate-400">-</span>
                      return (
                        <div
                          className={cn(
                            "flex flex-col items-end gap-0",
                            diff >= 0
                              ? "text-emerald-500 dark:text-emerald-400"
                              : "text-red-500 dark:text-red-400"
                          )}
                        >
                          <div className="flex items-center gap-0.5 text-xs font-semibold">
                            {diff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {diff >= 0 ? "+" : ""}
                            {diff}
                          </div>
                          <span className="text-[7px] font-semibold opacity-60 uppercase">Vs ontem</span>
                        </div>
                      )
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-3 items-center">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-semibold text-slate-400/80 uppercase tracking-widest mb-0.5">
                      TARDE
                    </span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                      17:00
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    {(() => {
                      const now = new Date()
                      const hour = now.getHours()
                      const pastTime = hour >= 17

                      if (palletHistory.t17 === 0) {
                        if (!pastTime) {
                          return (
                            <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                              Aguardando
                            </span>
                          )
                        }
                        return (
                          <span className="text-[9px] font-semibold text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                            Não apurado
                          </span>
                        )
                      }
                      return (
                        <span className="text-xs font-normal text-slate-700 dark:text-slate-300 tracking-tight">
                          {palletHistory.t17.toLocaleString("pt-BR")}
                          <span className="text-[10px] font-medium text-slate-400 ml-1">Paletes</span>
                        </span>
                      )
                    })()}
                  </div>
                  <div className="flex items-center justify-end">
                    {(() => {
                      const diff = palletHistory.t17 - palletHistory.t14
                      if (palletHistory.t17 === 0) return <span className="text-[9px] font-medium text-slate-400">-</span>
                      if (palletHistory.t14 === 0) return <span className="text-[9px] font-medium text-slate-400">-</span>
                      return (
                        <div
                          className={cn(
                            "flex flex-col items-end gap-0",
                            diff >= 0
                              ? "text-emerald-500 dark:text-emerald-400"
                              : "text-red-500 dark:text-red-400"
                          )}
                        >
                          <div className="flex items-center gap-0.5 text-xs font-semibold">
                            {diff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {diff >= 0 ? "+" : ""}
                            {diff}
                          </div>
                          <span className="text-[7px] font-semibold opacity-60 uppercase">Vs 14:20</span>
                        </div>
                      )
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-3 items-center">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-semibold text-slate-400/80 uppercase tracking-widest mb-0.5">
                      FECHAMENTO
                    </span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                      22:20
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    {(() => {
                      const nowHour = new Date().getHours()
                      const nowMin = new Date().getMinutes()
                      const pastClosing = nowHour > 22 || (nowHour === 22 && nowMin >= 20)
                      if (palletHistory.t22 === 0 && !pastClosing) {
                        return (
                          <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                            Aguardando
                          </span>
                        )
                      }
                      if (palletHistory.t22 === 0 && pastClosing) {
                        return (
                          <span className="text-[9px] font-semibold text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                            Não apurado
                          </span>
                        )
                      }
                      return (
                        <span className="text-xs font-normal text-slate-700 dark:text-slate-300 tracking-tight">
                          {palletHistory.t22.toLocaleString("pt-BR")}
                          <span className="text-[10px] font-medium text-slate-400 ml-1">Paletes</span>
                        </span>
                      )
                    })()}
                  </div>
                  <div className="flex items-center justify-end">
                    {(() => {
                      const diff = palletHistory.t22 - palletHistory.t17
                      if (palletHistory.t22 === 0) return <span className="text-[9px] font-medium text-slate-400">-</span>
                      if (palletHistory.t17 === 0) return <span className="text-[9px] font-medium text-slate-400">-</span>
                      return (
                        <div
                          className={cn(
                            "flex flex-col items-end gap-0",
                            diff >= 0
                              ? "text-emerald-500 dark:text-emerald-400"
                              : "text-red-500 dark:text-red-400"
                          )}
                        >
                          <div className="flex items-center gap-0.5 text-xs font-semibold">
                            {diff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {diff >= 0 ? "+" : ""}
                            {diff}
                          </div>
                          <span className="text-[7px] font-semibold opacity-60 uppercase">Vs 17:00</span>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                {dailyHistoryRecords.length > 0 ? (
                  dailyHistoryRecords.slice(0, 15).map((record, index) => {
                    const olderRecord = dailyHistoryRecords[index + 1]
                    const diff = olderRecord ? record.value - olderRecord.value : null
                    const recordDate = new Date(record.date + "T00:00:00")
                    const weekday = recordDate
                      .toLocaleDateString("pt-BR", { weekday: "short" })
                      .toUpperCase()
                      .replace(".", "")

                    return (
                      <div
                        key={record.date}
                        className="grid grid-cols-3 items-center border-b border-slate-100 dark:border-slate-800/30 pb-1 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                            {recordDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </span>
                          <span className="text-[8px] font-semibold text-slate-400 uppercase">{weekday}</span>
                        </div>

                        <div className="flex justify-center">
                          <span className="text-xs font-normal text-slate-700 dark:text-slate-300 tracking-tight">
                            {record.value.toLocaleString("pt-BR")}
                            <span className="text-[8px] font-medium text-slate-400 ml-0.5">Paletes</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-end">
                          {diff !== null ? (
                            <div
                              className={cn(
                                "flex items-center gap-1",
                                diff >= 0
                                  ? "text-emerald-500 dark:text-emerald-400"
                                  : "text-red-500 dark:text-red-400"
                              )}
                            >
                              <span className="text-[9px] font-semibold">
                                {diff >= 0 ? "+" : ""}
                                {diff}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[7px] font-semibold text-slate-300 dark:text-slate-700 uppercase">
                              BASE
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-[180px] text-center">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mb-2">
                      <BarChart3 size={16} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Nenhum registro
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Top 3 SKUs Card */}
        <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-5 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors h-[310px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                TOP 3 SKUS
              </h3>
              <p className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 tracking-widest mt-1">
                {topSkusFilter === "geral"
                  ? "QUANTIDADE GERAL"
                  : topSkusFilter === "molhado"
                  ? "MOLHADOS/TOMBADOS"
                  : "INCIDÊNCIA DE REG"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-xl">
              <button
                onClick={() => setTopSkusFilter("geral")}
                className={cn(
                  "px-2 py-1 text-[8px] font-semibold uppercase rounded-lg transition-all",
                  topSkusFilter === "geral"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-400"
                )}
              >
                Geral
              </button>
              <button
                onClick={() => setTopSkusFilter("molhado")}
                className={cn(
                  "px-2 py-1 text-[8px] font-semibold uppercase rounded-lg transition-all",
                  topSkusFilter === "molhado"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-400"
                )}
              >
                Crit.
              </button>
              <button
                onClick={() => setTopSkusFilter("incidencia")}
                className={cn(
                  "px-2 py-1 text-[8px] font-semibold uppercase rounded-lg transition-all",
                  topSkusFilter === "incidencia"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-400"
                )}
              >
                Reg.
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-start space-y-2 overflow-y-auto custom-scrollbar py-1 pr-1">
            {topSkus.length > 0 ? (
              topSkus.slice(0, 3).map((item: any, index: number) => (
                <div
                  key={item.sku}
                  className="flex items-center justify-between group/sku p-1.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
                >
                  <div className="flex items-center gap-2.5 flex-1">
                    <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-semibold text-xs text-slate-400 group-hover/sku:bg-blue-500 group-hover/sku:text-white transition-colors">
                      {index + 1}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold tracking-tight uppercase truncate text-slate-700 dark:text-slate-200">
                          {item.sku}
                        </span>
                      </div>
                      <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase truncate leading-tight">
                        {item.descricao}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] font-semibold text-blue-500/60 dark:text-blue-400/40 uppercase tracking-widest">
                          {item.posicoesCount} POSIÇÕES
                        </span>
                        <div className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                        <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          {Math.round(item.paletes)} PALETES
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl font-semibold text-[11px] tracking-tight min-w-[70px] text-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {topSkusSort === "incidencia" || topSkusFilter === "incidencia"
                      ? `${item.incidencia} REG`
                      : fmtNum(topSkusFilter === "molhado" ? item.molhados : item.quantidade)}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 flex flex-col items-center justify-center opacity-20 dark:opacity-50">
                <Box size={32} className="mb-2 text-slate-400 dark:text-slate-500" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Aguardando dados...
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* MOVEMENTS & ORIGIN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT: CHART */}
        <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-4 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                  Fluxo de Registros
                </h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 tracking-widest">
                    {`VOLUME TOTAL DO PERÍODO: ${movementPeriod.toUpperCase()}`}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-medium text-slate-400 dark:text-slate-600 uppercase tracking-tighter">
                        Entradas:
                      </span>
                      <span className="text-[9px] font-semibold text-emerald-500 dark:text-emerald-400">
                        {stats?.period_entries?.toLocaleString("pt-BR") || "0"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-medium text-slate-400 dark:text-slate-600 uppercase tracking-tighter">
                        Saídas:
                      </span>
                      <span className="text-[9px] font-semibold text-orange-500 dark:text-orange-400">
                        {stats?.period_exits?.toLocaleString("pt-BR") || "0"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowMovementMenu(!showMovementMenu)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-600"
              >
                <MoreHorizontal size={18} />
              </button>

              <AnimatePresence>
                {showMovementMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMovementMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-[150] p-1.5"
                    >
                      {[
                        { id: "hoje", label: "Hoje" },
                        { id: "semana", label: "Semanal" },
                        { id: "mensal", label: "Mensal" },
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setMovementPeriod(p.id as any)
                            setShowMovementMenu(false)
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-widest transition-colors",
                            movementPeriod === p.id
                              ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                              : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex-1 relative mt-4">
            {/* Y-Axis */}
            <div className="absolute left-8 top-0 bottom-6 w-[1px] bg-slate-100 dark:bg-slate-800/50" />
            {/* X-Axis */}
            <div className="absolute left-8 right-0 bottom-6 h-[1px] bg-slate-100 dark:bg-slate-800/50" />

            {/* Background Grid Lines */}
            <div className="absolute left-8 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none opacity-50">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-full h-[1px] bg-slate-50 dark:bg-slate-800/30 border-t border-dashed border-slate-100/50 dark:border-slate-800/20"
                />
              ))}
            </div>

            <div className="flex items-end justify-center gap-1.5 h-full pl-10 pr-4 pb-6">
              {stats?.period_movements && stats.period_movements.length > 0 ? (
                (() => {
                  const isIndividual = movementPeriod === "hoje"
                  const isWeekly = movementPeriod === "semana"
                  const isMonthly = movementPeriod === "mensal"

                  let chartItems: any[] = []

                  if (isIndividual) {
                    const skuGroups: Record<string, { val: number; molhado: number; m: any }> = {}
                    stats?.period_movements?.forEach((m: any) => {
                      const sku = m.produto
                      if (!skuGroups[sku]) {
                        skuGroups[sku] = { val: 0, molhado: 0, m }
                      }
                      skuGroups[sku].val += m.movimentacao
                      skuGroups[sku].molhado += m.molhado || 0
                    })

                    chartItems = Object.entries(skuGroups)
                      .map(([sku, grpData]) => ({
                        label: sku.split(" ")[0],
                        sublabel: grpData.m.entrada_val > 0 ? "ENTRADAS" : "SAÍDAS",
                        mov: grpData.m.entrada_val > 0 ? "ENT" : "SAÍ",
                        val: grpData.val,
                        molhado: grpData.molhado,
                        isEntrada: grpData.m.entrada_val > 0,
                        details: [{ sku, val: grpData.val, molhado: grpData.molhado }],
                        date: grpData.m.data || "Hoje",
                      }))
                      .sort((a, b) => b.val - a.val)
                      .slice(0, 10)
                  } else if (isWeekly) {
                    const diasSemana = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"]
                    const groups: Record<
                      string,
                      {
                        label: string
                        date: string
                        ent: { val: number; molh: number; items: any[] }
                        sai: { val: number; molh: number; items: any[] }
                      }
                    > = {}

                    const today = new Date()
                    const day = today.getDay()
                    const diffToMonday = today.getDate() - (day === 0 ? 6 : day - 1)
                    const monday = new Date(today.setDate(diffToMonday))

                    for (let i = 0; i < 7; i++) {
                      const d = new Date(monday)
                      d.setDate(monday.getDate() + i)
                      const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(
                        d.getMonth() + 1
                      ).padStart(2, "0")}/${d.getFullYear()}`
                      groups[dateStr] = {
                        label: diasSemana[i],
                        date: dateStr,
                        ent: { val: 0, molh: 0, items: [] },
                        sai: { val: 0, molh: 0, items: [] },
                      }
                    }

                    stats?.period_movements?.forEach((m: any) => {
                      const key = m.data ? m.data.slice(0, 10).split("-").reverse().join("/") : null
                      if (key && groups[key]) {
                        if (m.entrada_val > 0) {
                          groups[key].ent.val += m.entrada_val
                          groups[key].ent.molh += m.molhado || 0
                          groups[key].ent.items.push({
                            sku: m.produto,
                            val: m.entrada_val,
                            molhado: m.molhado || 0,
                          })
                        }
                        if (m.saida_val > 0) {
                          groups[key].sai.val += m.saida_val
                          groups[key].sai.molh += m.molhado || 0
                          groups[key].sai.items.push({
                            sku: m.produto,
                            val: m.saida_val,
                            molhado: m.molhado || 0,
                          })
                        }
                      }
                    })

                    Object.values(groups).forEach((g) => {
                      const dayItems: any[] = []
                      if (g.ent.val > 0)
                        dayItems.push({
                          label: g.label,
                          sublabel: "ENTRADAS",
                          mov: "ENT",
                          val: g.ent.val,
                          molhado: g.ent.molh,
                          isEntrada: true,
                          details: g.ent.items,
                          date: g.date,
                          isLastOfDay: false,
                        })
                      if (g.sai.val > 0)
                        dayItems.push({
                          label: g.label,
                          sublabel: "SAÍDAS",
                          mov: "SAÍ",
                          val: g.sai.val,
                          molhado: g.sai.molh,
                          isEntrada: false,
                          details: g.sai.items,
                          date: g.date,
                          isLastOfDay: false,
                        })
                      if (dayItems.length === 0)
                        dayItems.push({
                          label: g.label,
                          sublabel: "-",
                          mov: "-",
                          val: 0,
                          molhado: 0,
                          isEntrada: true,
                          details: [],
                          date: g.date,
                          isEmpty: true,
                          isLastOfDay: false,
                        })
                      if (dayItems.length > 0) dayItems[dayItems.length - 1].isLastOfDay = true
                      chartItems.push(...dayItems)
                    })
                  } else if (isMonthly) {
                    const monthNames = [
                      "JANEIRO",
                      "FEVEREIRO",
                      "MARÇO",
                      "ABRIL",
                      "MAIO",
                      "JUNHO",
                      "JULHO",
                      "AGOSTO",
                      "SETEMBRO",
                      "OUTUBRO",
                      "NOVEMBRO",
                      "DEZEMBRO",
                    ]
                    const groups: Record<
                      string,
                      {
                        label: string
                        year: number
                        month: number
                        ent: { val: number; items: any[] }
                        sai: { val: number; items: any[] }
                      }
                    > = {}

                    stats.period_movements.forEach((m: any) => {
                      if (!m.data) return
                      const parts = m.data.split("-")
                      if (parts.length < 3) return
                      const [y, mon] = parts.map(Number)
                      const monthIdx = mon - 1
                      const key = `${y}-${String(mon).padStart(2, "0")}`
                      if (!groups[key]) {
                        groups[key] = {
                          label: monthNames[monthIdx],
                          year: y,
                          month: mon,
                          ent: { val: 0, items: [] },
                          sai: { val: 0, items: [] },
                        }
                      }
                      if (m.entrada_val > 0) {
                        groups[key].ent.val += m.entrada_val
                        groups[key].ent.items.push({
                          sku: m.produto,
                          val: m.entrada_val,
                          molhado: m.molhado || 0,
                        })
                      }
                      if (m.saida_val > 0) {
                        groups[key].sai.val += m.saida_val
                        groups[key].sai.items.push({
                          sku: m.produto,
                          val: m.saida_val,
                          molhado: m.molhado || 0,
                        })
                      }
                    })

                    Object.values(groups)
                      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
                      .forEach((g) => {
                        let hasEntries = false
                        if (g.ent.val > 0) {
                          chartItems.push({
                            label: g.label,
                            sublabel: "ENTRADAS",
                            mov: "ENT",
                            val: g.ent.val,
                            molhado: 0,
                            isEntrada: true,
                            details: g.ent.items,
                            date: String(g.year),
                            isLastOfDay: false,
                          })
                          hasEntries = true
                        }
                        if (g.sai.val > 0) {
                          chartItems.push({
                            label: g.label,
                            sublabel: "SAÍDAS",
                            mov: "SAÍ",
                            val: g.sai.val,
                            molhado: 0,
                            isEntrada: false,
                            details: g.sai.items,
                            date: String(g.year),
                            isLastOfDay: true,
                          })
                        } else if (hasEntries) {
                          const last = chartItems[chartItems.length - 1]
                          if (last) last.isLastOfDay = true
                        }
                      })
                  }

                  const maxVal = Math.max(...chartItems.map((i) => i.val), 10)
                  const groupedItems: any[][] = []
                  let currentGroup: any[] = []
                  chartItems.forEach((item, idx) => {
                    if (
                      idx === 0 ||
                      (item.date === chartItems[idx - 1].date && item.label === chartItems[idx - 1].label)
                    ) {
                      currentGroup.push(item)
                    } else {
                      groupedItems.push(currentGroup)
                      currentGroup = [item]
                    }
                  })
                  if (currentGroup.length > 0) groupedItems.push(currentGroup)

                  return groupedItems.map((group, gIdx) => {
                    const firstItem = group[0]
                    const isLastGroup = gIdx === groupedItems.length - 1
                    const showSeparator = firstItem.isLastOfDay && !isLastGroup
                    const shortDate =
                      firstItem.date && firstItem.date.includes("/")
                        ? firstItem.date.split("/").slice(0, 2).join("/")
                        : firstItem.date

                    return (
                      <React.Fragment key={gIdx}>
                        <div
                          className={cn(
                            "flex flex-col flex-1 min-w-0 max-w-[160px] pb-2 relative",
                            showSeparator && "border-r border-slate-100 dark:border-slate-800/40 mr-1"
                          )}
                        >
                          <div className="flex items-end justify-center gap-1 h-24 mb-2">
                            {group.map((item, iIdx) => {
                              const hPct = (item.val / maxVal) * 100
                              return (
                                <div
                                  key={iIdx}
                                  className={cn(
                                    "relative flex flex-col items-center justify-end",
                                    isIndividual ? "w-10" : "flex-1"
                                  )}
                                  style={{ height: "100%" }}
                                >
                                  {item.val > 0 && (
                                    <span
                                      className={cn(
                                        "absolute text-[10px] font-semibold pointer-events-none transition-all drop-shadow-sm z-20",
                                        item.isEntrada ? "text-emerald-500" : "text-orange-500"
                                      )}
                                      style={{ bottom: `calc(${hPct}% + 6px)` }}
                                    >
                                      {item.isEntrada ? `+${item.val}` : item.val}
                                    </span>
                                  )}
                                  <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${hPct}%` }}
                                    className={cn(
                                      "w-full rounded-t-xl rounded-b-md relative",
                                      item.val === 0
                                        ? "h-0.5 bg-slate-100 dark:bg-slate-800"
                                        : item.isEntrada
                                        ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                                        : "bg-gradient-to-t from-orange-600 to-orange-400"
                                    )}
                                    onMouseEnter={() => setHoveredBarId(`bar-${gIdx}-${iIdx}`)}
                                    onMouseLeave={() => setHoveredBarId(null)}
                                  >
                                    {item.val > 0 && (
                                      <div className="absolute inset-x-0 top-0 h-1 bg-white/20 rounded-full mx-1 mt-1 blur-[1px]" />
                                    )}
                                    {item.val > 0 && hoveredBarId === `bar-${gIdx}-${iIdx}` && (
                                      <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-4">
                                        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 p-2.5 rounded-2xl shadow-2xl min-w-[140px]">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-semibold text-white uppercase">
                                              {item.label}
                                            </span>
                                            <span
                                              className={cn(
                                                "text-[9px] font-semibold",
                                                item.isEntrada ? "text-emerald-400" : "text-orange-400"
                                              )}
                                            >
                                              {item.isEntrada ? "ENTRADA" : "SAÍDA"}
                                            </span>
                                          </div>
                                          <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                                            {item.details?.slice(0, 5).map((d: any, di: number) => (
                                              <div
                                                key={di}
                                                className="flex flex-col gap-0.5 border-l-2 border-slate-700 pl-2"
                                              >
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className="text-[9px] font-semibold text-slate-300 truncate">
                                                    {d.sku}
                                                  </span>
                                                  <span className="text-[9px] font-semibold text-white">
                                                    {item.isEntrada ? "+" : "-"}
                                                    {d.val}
                                                  </span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </motion.div>
                                </div>
                              )
                            })}
                          </div>
                          <div className="flex flex-col items-center shrink-0 w-full overflow-hidden">
                            <span className="text-[7.5px] font-semibold text-slate-900 dark:text-slate-100 uppercase truncate text-center w-full">
                              {firstItem.label}
                            </span>
                            <span className="text-[8px] font-semibold text-blue-500 truncate w-full text-center mt-0.5">
                              {shortDate}
                            </span>
                            <div className="flex justify-center gap-2 w-full mt-1">
                              {group.map((it, idx) => (
                                <span
                                  key={idx}
                                  className="text-[6px] font-bold text-slate-400 dark:text-slate-600 uppercase text-center"
                                >
                                  {it.sublabel}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  })
                })()
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-8">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center">
                      <BarChart3 size={22} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center border-2 border-white dark:border-[#0F172A]">
                      <span className="text-[10px]">📭</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      {movementPeriod === "hoje"
                        ? "Sem movimentações hoje"
                        : movementPeriod === "semana"
                        ? "Sem movimentações esta semana"
                        : "Sem movimentações este mês"}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      Nenhum registro de entrada ou saída encontrado
                    </p>
                  </div>
                  {movementPeriod === "hoje" && (
                    <button
                      onClick={() => setMovementPeriod("semana")}
                      className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest hover:text-blue-400 transition-colors border border-blue-500/20 hover:border-blue-400/30 px-3 py-1.5 rounded-xl"
                    >
                      {"Ver semana →"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* RIGHT: LIST */}
        <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-5 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors overflow-hidden flex flex-col h-[310px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-5 bg-emerald-500 rounded-full" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                  Origem
                </h3>
                <p className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 tracking-widest mt-1">
                  DISTRIBUIÇÃO ANALÍTICA
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* SMALL TYPE FILTER */}
              <div className="flex items-center p-1 bg-slate-100/80 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 rounded-xl">
                {[
                  { id: "entrada", label: "Entrada" },
                  { id: "saída", label: "Saída" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setOriginTypeFilter(t.id as any)}
                    className={cn(
                      "px-3 h-6 flex items-center justify-center text-[9px] font-semibold uppercase rounded-lg transition-all",
                      originTypeFilter === t.id
                        ? cn(
                            "bg-white dark:bg-slate-600 shadow-sm",
                            t.id === "entrada"
                              ? "text-emerald-500 dark:text-emerald-400"
                              : "text-red-500 dark:text-red-400"
                          )
                        : "text-slate-400 hover:text-slate-500"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* PERIOD FILTER */}
              <div className="relative">
                <button
                  onClick={() => setShowOriginPeriodMenu(!showOriginPeriodMenu)}
                  className={cn(
                    "p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors",
                    showOriginPeriodMenu ? "text-blue-500" : "text-slate-400"
                  )}
                >
                  <MoreHorizontal size={18} />
                </button>

                <AnimatePresence>
                  {showOriginPeriodMenu && (
                    <>
                      <div className="fixed inset-0 z-[140]" onClick={() => setShowOriginPeriodMenu(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-[150] p-1.5"
                      >
                        {[
                          { id: "hoje", label: "Hoje" },
                          { id: "semana", label: "Semanal" },
                          { id: "mensal", label: "Mensal" },
                          { id: "tudo", label: "Todo o Histórico" },
                        ].map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setOriginPeriod(p.id as any)
                              setShowOriginPeriodMenu(false)
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-widest transition-colors",
                              originPeriod === p.id
                                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                          >
                            {p.label}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            {(() => {
              const today = new Date()
              const todayStr = today.toISOString().split("T")[0]
              const day = today.getDay()
              const diff = (day === 0 ? -6 : 1) - day
              const monday = new Date(today)
              monday.setDate(today.getDate() + diff)
              monday.setHours(0, 0, 0, 0)

              const filteredOriginData = (stats?.latest_movements || []).filter((m: any) => {
                if (originPeriod === "tudo") return true
                if (!m.timestamp) return false

                if (originPeriod === "hoje") {
                  return m.data?.startsWith(todayStr)
                }
                if (originPeriod === "semana") {
                  return m.timestamp >= monday.getTime()
                }
                if (originPeriod === "mensal") {
                  const d = new Date(m.timestamp)
                  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()
                }
                return true
              })

              return <OriginDonutChart data={filteredOriginData} typeFilter={originTypeFilter} />
            })()}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default GeralTab
