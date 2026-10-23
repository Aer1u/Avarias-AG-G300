"use client"

import React from "react"
import { Warehouse, Plus, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { MapeamentoConfig, COLOR_THEMES } from "@/lib/mapeamentosStorage"

interface MapeamentoWarehouseMapProps {
  streetData: Record<string, { even: any[]; odd: any[] }>
  areaData?: Record<string, any[]>
  advancedStats: {
    globalCap: number
    globalUso: number
    globalLivre: number
    globalOccupancy: number
  }
  activeConfig: MapeamentoConfig | null
  onOpenDriveIn: (posId: string) => void
  onOpenAddPosicao: () => void
  isLoggedIn?: boolean
}

export function MapeamentoWarehouseMap({
  streetData,
  areaData = {},
  advancedStats,
  activeConfig,
  onOpenDriveIn,
  onOpenAddPosicao,
  isLoggedIn = false,
}: MapeamentoWarehouseMapProps) {
  const theme = activeConfig ? COLOR_THEMES[activeConfig.cor] || COLOR_THEMES.blue : COLOR_THEMES.blue

  const hasStreets = Object.keys(streetData).length > 0
  const hasAreas = Object.keys(areaData).length > 0
  const hasAnyPositions = hasStreets || hasAreas

  // Se não houver posições cadastradas ainda neste mapeamento
  if (!hasAnyPositions) {
    return (
      <div className="p-12 md:p-16 rounded-[2rem] bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-100 dark:border-blue-900/40">
          <Warehouse size={32} />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Nenhuma posição cadastrada neste mapeamento
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Você tem total liberdade para definir quais posições farão parte deste mapeamento:
            crie áreas de <strong className="text-slate-700 dark:text-slate-300">Chão / Blocados</strong>,
            estruturas de <strong className="text-slate-700 dark:text-slate-300">Drive-In / Porta-Paletes</strong> ou importe do galpão.
          </p>
        </div>
        {isLoggedIn && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenAddPosicao}
              className="px-5 py-3 rounded-xl text-xs font-semibold text-white shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
              style={{ background: theme.primary }}
            >
              <Plus size={16} /> Cadastrar Posições / Chão
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Resumo Geral do Armazém (idêntico ao G300) */}
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
                Resumo Geral do Mapeamento
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.2em]">
                  {activeConfig?.nome || "Mapeamento em Andamento"}
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
                  {advancedStats.globalCap.toLocaleString("pt-BR")}
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
                  {advancedStats.globalUso.toLocaleString("pt-BR")}
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
                  {advancedStats.globalLivre.toLocaleString("pt-BR")}
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
                  {Math.round(advancedStats.globalOccupancy)}%
                </span>
                <div
                  className={cn(
                    "h-1.5 w-10 rounded-full",
                    advancedStats.globalOccupancy >= 95
                      ? "bg-red-500"
                      : advancedStats.globalOccupancy >= 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  )}
                />
              </div>
            </div>

            {/* Botão de adicionar posição direto no resumo */}
            {isLoggedIn && (
              <button
                onClick={onOpenAddPosicao}
                className="px-3 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-500 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={14} /> Posição / Chão
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 1: ÁREAS DE CHÃO / BLOCADOS ───────────────────────────── */}
      {hasAreas && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-amber-500" />
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Áreas de Chão / Blocados
            </h4>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-8">
            {Object.entries(areaData).map(([areaName, positions]) => {
              const activePos = positions.filter((p: any) => !p.is_blocked)
              const lotados = activePos.filter((p: any) => p.capacidade > 0 && p.paletes >= p.capacidade).length
              const disponiveis = activePos.filter((p: any) => p.paletes > 0 && p.paletes < p.capacidade).length
              const vazios = activePos.filter((p: any) => p.paletes === 0).length
              const capTotal = activePos.reduce((sum: number, p: any) => sum + (p.capacidade || 0), 0)
              const usoTotal = activePos.reduce((sum: number, p: any) => sum + (p.paletes || 0), 0)

              return (
                <div
                  key={areaName}
                  className="p-4 md:p-6 rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm relative group/card hover:shadow-xl transition-all"
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                    <div className="flex overflow-hidden rounded-lg shadow-sm border border-black/5 dark:border-white/5">
                      <div className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-3 py-1.5 font-bold text-[12px] tracking-tight">
                        {areaName}
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 font-semibold text-slate-500 text-[10px] uppercase">
                        Solo / Chão ({positions.length} pos)
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-[10px] text-slate-400">
                        Cap: <strong className="text-slate-800 dark:text-white">{capTotal}</strong>
                      </span>
                      <span className="text-[10px] text-emerald-600">
                        Uso: <strong>{usoTotal}</strong>
                      </span>
                      <span className="text-[10px] text-blue-600">
                        Livre: <strong>{Math.max(0, capTotal - usoTotal)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Quadrados das Posições de Chão */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {positions.map((pos: any) => {
                      const isFull = pos.capacidade > 0 && pos.paletes >= pos.capacidade
                      const isOverflow = pos.capacidade > 0 && pos.paletes > pos.capacidade

                      return (
                        <div key={pos.id} className="group relative">
                          <button
                            onClick={() => onOpenDriveIn(pos.id)}
                            className={cn(
                              "h-11 px-3 rounded-lg border-2 flex items-center justify-center transition-all active:scale-95 cursor-pointer font-mono font-bold text-[11px]",
                              pos.status === "Fechado"
                                ? "bg-slate-100 dark:bg-slate-800/10 border-slate-300 dark:border-slate-700 text-slate-400"
                                : isOverflow
                                ? "bg-red-900/10 border-red-900 text-red-900"
                                : isFull
                                ? "bg-transparent border-red-900/70 text-red-600 dark:text-red-500"
                                : pos.paletes === 0
                                ? "bg-slate-50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 text-slate-500"
                                : "bg-transparent border-emerald-600 text-emerald-700 dark:text-emerald-400"
                            )}
                          >
                            <span>{pos.id}</span>
                            {pos.paletes > 0 && (
                              <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                {pos.paletes}
                              </span>
                            )}
                          </button>

                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[300] w-56 pointer-events-none">
                            <div className="bg-slate-950/98 text-white rounded-2xl p-3 shadow-2xl border border-white/10 backdrop-blur-xl">
                              <p className="font-mono text-xs font-bold text-amber-400">{pos.id}</p>
                              <p className="text-[10px] text-slate-400 mt-1">
                                Ocupação: {pos.paletes} / {pos.capacidade} PTs
                              </p>
                              {pos.products.length > 0 && (
                                <p className="text-[10px] text-white mt-1 truncate">
                                  {pos.products[0].sku} ({pos.products[0].quantidade} un)
                                </p>
                              )}
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
      )}

      {/* ── SEÇÃO 2: RUAS E DRIVE-IN (idêntico ao G300) ─────────────────── */}
      {hasStreets && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Warehouse size={18} className="text-blue-500" />
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Ruas / Estruturas Drive-In
            </h4>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-8">
            {Object.entries(streetData).map(([streetName, sections]) => {
              const allPositions = [...sections.even, ...sections.odd]
              const activePositionsOnly = allPositions.filter(p => !p.is_blocked)
              const lotadoPos = activePositionsOnly.filter(
                p => p.capacidade > 0 && Math.round(p.paletes) >= Math.round(p.capacidade)
              ).length
              const disponivelPos = activePositionsOnly.filter(
                p => Math.round(p.paletes) > 0 && Math.round(p.paletes) < Math.round(p.capacidade)
              ).length
              const vazioPos = activePositionsOnly.filter(p => Math.round(p.paletes) === 0).length

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
                  {/* Header da Rua */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                    <div className="flex overflow-hidden rounded-lg shadow-sm border border-black/5 dark:border-white/5">
                      <div className="bg-slate-200 dark:bg-slate-800 px-3 py-1.5 flex items-center justify-center font-semibold text-slate-700 dark:text-slate-300 text-[13px] tracking-tight border-r border-slate-300 dark:border-slate-700">
                        Rua {streetName}
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-700 px-4 py-1.5 flex items-center justify-center font-semibold text-slate-500 dark:text-slate-400 text-[11px] tracking-widest uppercase">
                        Bloco
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-600" /> LOTADOS
                        </span>
                        <p className="text-base font-semibold text-slate-900 dark:text-white leading-none tracking-tight">
                          {lotadoPos}
                        </p>
                      </div>
                      <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-4">
                        <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> DISPONÍVEIS
                        </span>
                        <p className="text-base font-semibold text-slate-900 dark:text-white leading-none tracking-tight">
                          {disponivelPos}
                        </p>
                      </div>
                      <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-4">
                        <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-500" /> VAZIOS
                        </span>
                        <p className="text-base font-semibold text-slate-900 dark:text-white leading-none tracking-tight">
                          {vazioPos}
                        </p>
                      </div>
                      <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-4">
                        <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                          OCUPAÇÃO
                        </span>
                        <p className="text-base font-semibold text-slate-900 dark:text-white leading-none tracking-tight">
                          {Math.round(occupancyPercent)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sub-bar da Rua */}
                  <div className="mb-4 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                          CAPACIDADE
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white leading-none">
                            {totalCap}
                          </span>
                          <span className="text-[8px] font-medium text-slate-400 uppercase">PTs</span>
                        </div>
                      </div>
                      <div className="h-6 w-px bg-slate-200 dark:bg-slate-700/50" />
                      <div className="flex flex-col">
                        <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                          EM USO
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 leading-none">
                            {totalUso}
                          </span>
                          <span className="text-[8px] font-medium text-emerald-600/50 uppercase">PTs</span>
                        </div>
                      </div>
                      <div className="h-6 w-px bg-slate-200 dark:bg-slate-700/50" />
                      <div className="flex flex-col">
                        <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                          LIVRE
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 leading-none">
                            {Math.max(0, totalCap - totalUso)}
                          </span>
                          <span className="text-[8px] font-medium text-blue-600/50 uppercase">Vagas</span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-col items-end">
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

                  {/* Lado PAR e Lado ÍMPAR exatamente como no G300 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 relative">
                    <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-100 dark:bg-slate-800/60" />

                    {["odd", "even"].map(sideKey => {
                      const sidePositions = sideKey === "even" ? sections.even : sections.odd
                      const sideLabel = sideKey === "even" ? "Lado PAR" : "Lado ÍMPAR"

                      const sideCapacity = sidePositions.reduce(
                        (acc: number, p: any) => (p.is_blocked ? acc : acc + (p.capacidade || 0)),
                        0
                      )
                      const sideUsage = sidePositions.reduce(
                        (acc: number, p: any) => (p.is_blocked ? acc : acc + (p.paletes || 0)),
                        0
                      )
                      const sideAvailable = Math.max(0, sideCapacity - sideUsage)

                      return (
                        <div key={sideKey} className="space-y-3 relative z-10 py-1">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1.5 mb-3">
                            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest leading-none">
                              {sideLabel}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-medium text-slate-400 uppercase">
                                CAP: <span className="text-slate-700 dark:text-slate-300">{sideCapacity}</span>
                              </span>
                              <span className="text-[9px] font-medium text-slate-400 uppercase">
                                USO: <span className="text-slate-700 dark:text-slate-300">{sideUsage}</span>
                              </span>
                              <span className="text-[9px] font-medium text-slate-400 uppercase">
                                LIVRE: <span className="text-slate-700 dark:text-slate-300">{sideAvailable}</span>
                              </span>
                            </div>
                          </div>

                          {/* Quadrados de Posições (estilo G300) */}
                          <div className="flex flex-wrap gap-2">
                            {sidePositions.map((pos: any) => {
                              const isFull =
                                pos.capacidade > 0 && Math.round(pos.paletes) >= Math.round(pos.capacidade)
                              const isOverflow =
                                pos.capacidade > 0 && Math.round(pos.paletes) > Math.round(pos.capacidade)
                              const displayNum =
                                pos.id.match(/(\d+)$/)?.[1]?.slice(-3) || pos.id.slice(-3)

                              return (
                                <div key={pos.id} className="group relative">
                                  <button
                                    onClick={() => onOpenDriveIn(pos.id)}
                                    className={cn(
                                      "h-10 w-10 rounded-md border-2 flex items-center justify-center transition-all active:scale-95 cursor-pointer relative",
                                      pos.status === "Fechado"
                                        ? "bg-slate-100 dark:bg-slate-800/10 border-slate-300 dark:border-slate-700 text-slate-400 grayscale border-dashed"
                                        : isOverflow
                                        ? "bg-red-900/10 border-red-900 text-red-900 shadow-[0_0_10px_rgba(127,29,29,0.1)]"
                                        : isFull
                                        ? "bg-transparent border-red-900/70 dark:border-red-900/30 text-red-600 dark:text-red-500"
                                        : pos.paletes === 0
                                        ? "bg-slate-50 dark:bg-slate-800/10 border-slate-200 dark:border-slate-800/50 text-slate-400 dark:text-slate-600"
                                        : "bg-transparent border-emerald-900/70 dark:border-emerald-600/30 text-emerald-800 dark:text-emerald-500"
                                    )}
                                  >
                                    <span className="text-[11px] font-mono font-semibold tracking-tighter leading-none">
                                      {displayNum}
                                    </span>
                                  </button>

                                  {/* Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[300] w-60 pointer-events-none">
                                    <div className="bg-slate-950/98 text-white rounded-2xl p-4 shadow-2xl border border-white/10 backdrop-blur-xl relative ring-1 ring-white/5">
                                      <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                                        <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-widest font-mono">
                                          {pos.id}
                                        </span>
                                        <div
                                          className={cn(
                                            "h-3 w-3 rounded-full ring-2 ring-white/10",
                                            isFull ? "bg-red-500" : "bg-emerald-500"
                                          )}
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-semibold uppercase text-slate-400">
                                          <span>Ocupação</span>
                                          <span className="text-white text-[12px] font-semibold">
                                            {pos.paletes} / {pos.capacidade} PTs
                                          </span>
                                        </div>

                                        {pos.products.length > 0 && (
                                          <div className="pt-2 border-t border-white/5 space-y-1">
                                            <p className="text-[9px] font-semibold text-slate-500 uppercase">
                                              Itens Registrados ({pos.products.length})
                                            </p>
                                            <p className="text-[12px] font-semibold text-slate-100 font-mono truncate">
                                              {pos.products[0].sku} ({pos.products[0].quantidade} un)
                                            </p>
                                            {pos.products.length > 1 && (
                                              <div className="py-0.5 px-1.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] font-semibold text-blue-400 uppercase">
                                                + {pos.products.length - 1} outros itens
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
      )}
    </div>
  )
}
