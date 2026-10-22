"use client"

import React, { useState } from "react"
import { X, Warehouse, Layers, AlertCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface DriveInPosition {
  id: string
  tipo?: "drive_in" | "chao" | string
  setor?: string
  lado?: string
  paletes: number
  capacidade: number
  is_blocked?: boolean
  status?: string
  observacao?: string
  products?: { sku: string; quantidade: number }[]
}

export interface DriveInStreetData {
  [streetName: string]: {
    even: DriveInPosition[]
    odd: DriveInPosition[]
  }
}

export interface DriveInAreaData {
  [areaName: string]: DriveInPosition[]
}

interface DriveInModalProps {
  isOpen: boolean
  onClose: () => void
  /** Nome exibido no header do modal */
  title?: string
  /** Ruas / Drive-In agrupadas por prefixo (lado par / ímpar) */
  streetData?: DriveInStreetData
  /** Áreas de Chão / Blocados agrupadas por setor */
  areaData?: DriveInAreaData
  /** Callback ao clicar numa posição */
  onSelectPosition?: (posId: string) => void
}

// ── Componente Principal ─────────────────────────────────────────────────────

export function DriveInModal({
  isOpen,
  onClose,
  title = "Mapeamento do Armazém",
  streetData = {},
  areaData = {},
  onSelectPosition,
}: DriveInModalProps) {
  const [selectedPosId, setSelectedPosId] = useState<string | null>(null)

  if (!isOpen) return null

  const hasStreets = Object.keys(streetData).length > 0
  const hasAreas = Object.keys(areaData).length > 0
  const hasAny = hasStreets || hasAreas

  const handlePosClick = (posId: string) => {
    setSelectedPosId(posId)
    onSelectPosition?.(posId)
  }

  // Estatísticas globais
  const allStreetPos = Object.values(streetData).flatMap(s => [...s.even, ...s.odd])
  const allAreaPos = Object.values(areaData).flat()
  const allPos = [...allStreetPos, ...allAreaPos].filter(p => !p.is_blocked)
  const globalCap = allPos.reduce((s, p) => s + (p.capacidade || 0), 0)
  const globalUso = allPos.reduce((s, p) => s + (p.paletes || 0), 0)
  const globalLivre = Math.max(0, globalCap - globalUso)
  const globalOccupancy = globalCap > 0 ? Math.round((globalUso / globalCap) * 100) : 0
  const lotados = allPos.filter(p => p.capacidade > 0 && p.paletes >= p.capacidade).length
  const disponiveis = allPos.filter(p => p.paletes > 0 && p.paletes < p.capacidade).length
  const vazios = allPos.filter(p => p.paletes === 0).length

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
        />

        {/* Modal principal — dark theme igual ao G300 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: "spring", stiffness: 360, damping: 30 }}
          className="relative w-full max-w-7xl max-h-[94vh] rounded-[2.5rem] bg-[#0f172a] border border-slate-700/60 shadow-2xl flex flex-col overflow-hidden"
        >
          {/* ── HEADER ────────────────────────────────────────────────────── */}
          <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Warehouse size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                  {title}
                </h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                  Visualização e Mapeamento de Posições
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* ── BODY ──────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-6 bg-slate-950/50">

            {/* Resumo Global */}
            {hasAny && (
              <div className="p-4 md:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Warehouse size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                      Resumo Geral
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">
                        Atualizado em tempo real
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 text-center">
                  <StatItem label="Capacidade" value={globalCap} unit="PTs" color="text-white" />
                  <div className="h-6 w-px bg-slate-800" />
                  <StatItem label="Em Uso" value={globalUso} unit="PTs" color="text-emerald-400" />
                  <div className="h-6 w-px bg-slate-800" />
                  <StatItem label="Livre" value={globalLivre} unit="Vagas" color="text-blue-400" />
                  <div className="h-6 w-px bg-slate-800" />
                  <StatItem label="Ocupação" value={`${globalOccupancy}%`} color="text-white" />
                  <div className="h-6 w-px bg-slate-800" />
                  <div className="flex items-center gap-4">
                    <LegendDot color="bg-red-600" label="LOTADOS" count={lotados} />
                    <LegendDot color="bg-emerald-500" label="DISPONÍVEIS" count={disponiveis} />
                    <LegendDot color="bg-slate-600" label="VAZIOS" count={vazios} />
                  </div>
                </div>
              </div>
            )}

            {/* Sem posições cadastradas */}
            {!hasAny && (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
                  <Warehouse size={32} />
                </div>
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                  Nenhuma posição cadastrada
                </p>
                <p className="text-xs text-slate-600 text-center max-w-xs">
                  Cadastre posições de Chão, Drive-In ou Porta-Paletes para visualizá-las aqui.
                </p>
              </div>
            )}

            {/* ── SEÇÃO 1: ÁREAS DE CHÃO ──────────────────────────────────── */}
            {hasAreas && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-amber-400" />
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Áreas de Chão / Blocados
                  </h4>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {Object.entries(areaData).map(([areaName, positions]) => {
                    const active = positions.filter(p => !p.is_blocked)
                    const lotadoA = active.filter(p => p.capacidade > 0 && p.paletes >= p.capacidade).length
                    const dispA = active.filter(p => p.paletes > 0 && p.paletes < p.capacidade).length
                    const vazA = active.filter(p => p.paletes === 0).length
                    const capA = active.reduce((s, p) => s + (p.capacidade || 0), 0)
                    const usoA = active.reduce((s, p) => s + (p.paletes || 0), 0)

                    return (
                      <div
                        key={areaName}
                        className="p-4 md:p-6 rounded-[1.5rem] bg-[#0f172a] border border-slate-800 shadow-lg"
                      >
                        {/* Header da Área */}
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
                          <div className="flex overflow-hidden rounded-lg border border-white/5">
                            <div className="bg-amber-950/60 text-amber-300 px-3 py-1.5 font-bold text-[12px] tracking-tight">
                              {areaName}
                            </div>
                            <div className="bg-slate-800 px-3 py-1.5 font-semibold text-slate-400 text-[10px] uppercase border-l border-slate-700">
                              Solo / Chão ({positions.length} pos)
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-[10px]">
                            <span className="text-slate-400">
                              Cap: <strong className="text-white">{capA}</strong>
                            </span>
                            <span className="text-emerald-400">
                              Uso: <strong>{usoA}</strong>
                            </span>
                            <span className="text-blue-400">
                              Livre: <strong>{Math.max(0, capA - usoA)}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Contador de status */}
                        <div className="flex items-center gap-4 mb-3">
                          <LegendDot color="bg-red-600" label="LOTADOS" count={lotadoA} small />
                          <LegendDot color="bg-emerald-500" label="DISPONÍVEIS" count={dispA} small />
                          <LegendDot color="bg-slate-600" label="VAZIOS" count={vazA} small />
                        </div>

                        {/* Botões de posição */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {positions.map((pos) => {
                            const isFull = pos.capacidade > 0 && pos.paletes >= pos.capacidade
                            const isOverflow = pos.capacidade > 0 && pos.paletes > pos.capacidade
                            const isSelected = selectedPosId === pos.id

                            return (
                              <div key={pos.id} className="group relative">
                                <button
                                  onClick={() => handlePosClick(pos.id)}
                                  className={cn(
                                    "h-11 px-3 rounded-lg border-2 flex items-center justify-center transition-all active:scale-95 cursor-pointer font-mono font-bold text-[11px]",
                                    isSelected && "ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-900",
                                    pos.status === "Fechado" || pos.is_blocked
                                      ? "bg-slate-800/30 border-slate-700 text-slate-600 border-dashed"
                                      : isOverflow
                                      ? "bg-red-900/20 border-red-700 text-red-400"
                                      : isFull
                                      ? "bg-transparent border-red-800 text-red-500"
                                      : pos.paletes === 0
                                      ? "bg-slate-800/20 border-slate-700 text-slate-500"
                                      : "bg-transparent border-emerald-700 text-emerald-400"
                                  )}
                                >
                                  <span>{pos.id}</span>
                                  {pos.paletes > 0 && (
                                    <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-emerald-900/60 text-emerald-300">
                                      {pos.paletes}
                                    </span>
                                  )}
                                </button>

                                {/* Tooltip */}
                                <PositionTooltip pos={pos} isFull={isFull} />
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

            {/* ── SEÇÃO 2: RUAS / DRIVE-IN ─────────────────────────────────── */}
            {hasStreets && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Warehouse size={16} className="text-blue-400" />
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Ruas / Estruturas Drive-In
                  </h4>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {Object.entries(streetData).map(([streetName, sections]) => {
                    const allP = [...sections.even, ...sections.odd]
                    const activeP = allP.filter(p => !p.is_blocked)
                    const lotadoS = activeP.filter(p => p.capacidade > 0 && p.paletes >= p.capacidade).length
                    const dispS = activeP.filter(p => p.paletes > 0 && p.paletes < p.capacidade).length
                    const vazS = activeP.filter(p => p.paletes === 0).length
                    const totalCap = activeP.reduce((s, p) => s + (p.capacidade || 0), 0)
                    const totalUso = activeP.reduce((s, p) => s + (p.paletes || 0), 0)
                    const occupancy = totalCap > 0 ? Math.round((totalUso / totalCap) * 100) : 0

                    return (
                      <div
                        key={streetName}
                        className="p-4 md:p-6 rounded-[1.5rem] bg-[#0f172a] border border-slate-800 shadow-lg"
                      >
                        {/* Header da Rua — estilo G300 */}
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5">
                          <div className="flex overflow-hidden rounded-lg border border-white/5">
                            <div className="bg-slate-800 text-slate-300 px-3 py-1.5 font-semibold text-[13px] tracking-tight border-r border-slate-700">
                              {streetName}
                            </div>
                            <div className="bg-slate-700/60 text-slate-400 px-4 py-1.5 font-semibold text-[11px] uppercase tracking-widest">
                              BLOCO
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <StatCell label="LOTADOS" value={lotadoS} dot="bg-red-600" />
                            <StatCell label="DISPONÍVEIS" value={dispS} dot="bg-emerald-500" />
                            <StatCell label="VAZIOS" value={vazS} dot="bg-slate-500" />
                            <StatCell label="OCUPAÇÃO" value={`${occupancy}%`} />
                          </div>
                        </div>

                        {/* Sub-bar */}
                        <div className="mb-4 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-4">
                            <SubBarItem label="CAPACIDADE TOTAL" value={totalCap} unit="PTs" />
                            <div className="h-5 w-px bg-slate-700" />
                            <SubBarItem label="EM USO" value={totalUso} unit="PTs" color="text-emerald-400" />
                            <div className="h-5 w-px bg-slate-700" />
                            <SubBarItem label="ESPAÇO LIVRE" value={Math.max(0, totalCap - totalUso)} unit="Vagas" color="text-blue-400" />
                          </div>
                          <div
                            className={cn(
                              "hidden sm:flex px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider border",
                              occupancy >= 95
                                ? "bg-red-900/30 text-red-400 border-red-800/40"
                                : occupancy >= 80
                                ? "bg-amber-900/30 text-amber-400 border-amber-800/40"
                                : "bg-emerald-900/30 text-emerald-400 border-emerald-800/40"
                            )}
                          >
                            STATUS GLOBAL:{" "}
                            {occupancy >= 95 ? "CRÍTICO" : occupancy >= 80 ? "ALTO VOLUME" : "OPERACIONAL"}
                          </div>
                        </div>

                        {/* LADO PAR e LADO ÍMPAR */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 relative">
                          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-slate-800/60" />

                          {(["odd", "even"] as const).map(sideKey => {
                            const sidePositions = sideKey === "even" ? sections.even : sections.odd
                            const sideLabel = sideKey === "even" ? "LADO PAR" : "LADO ÍMPAR"
                            const sideCap = sidePositions.reduce((s, p) => (!p.is_blocked ? s + (p.capacidade || 0) : s), 0)
                            const sideUso = sidePositions.reduce((s, p) => (!p.is_blocked ? s + (p.paletes || 0) : s), 0)
                            const sideLivre = Math.max(0, sideCap - sideUso)

                            return (
                              <div key={sideKey} className="space-y-2 relative z-10 py-1">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {sideLabel}
                                  </p>
                                  <div className="flex items-center gap-2 text-[9px] font-semibold text-slate-500 uppercase">
                                    <span>CAP:<span className="text-slate-300 ml-1">{sideCap}</span></span>
                                    <span>USO:<span className="text-slate-300 ml-1">{sideUso}</span></span>
                                    <span>LIVRE:<span className="text-slate-300 ml-1">{sideLivre}</span></span>
                                  </div>
                                </div>

                                {/* Quadradinhos de posição — estilo G300 exato */}
                                <div className="flex flex-wrap gap-2">
                                  {sidePositions.map(pos => {
                                    const isFull = pos.capacidade > 0 && Math.round(pos.paletes) >= Math.round(pos.capacidade)
                                    const isOverflow = pos.capacidade > 0 && Math.round(pos.paletes) > Math.round(pos.capacidade)
                                    const displayNum = pos.id.match(/(\d+)$/)?.[1]?.slice(-3) || pos.id.slice(-3)
                                    const isSelected = selectedPosId === pos.id

                                    return (
                                      <div key={pos.id} className="group relative">
                                        <button
                                          onClick={() => handlePosClick(pos.id)}
                                          className={cn(
                                            "h-10 w-10 rounded-md border-2 flex items-center justify-center transition-all active:scale-95 cursor-pointer relative hover:scale-105",
                                            isSelected && "ring-2 ring-blue-400 ring-offset-1 ring-offset-[#0f172a]",
                                            pos.status === "Fechado" || pos.is_blocked
                                              ? "bg-slate-800/10 border-slate-700 text-slate-600 border-dashed grayscale"
                                              : isOverflow
                                              ? "bg-red-900/10 border-red-900 text-red-500 shadow-[0_0_10px_rgba(127,29,29,0.15)]"
                                              : isFull
                                              ? "bg-transparent border-red-900/70 text-red-500"
                                              : pos.paletes === 0
                                              ? "bg-slate-800/10 border-slate-700 text-slate-600"
                                              : "bg-transparent border-emerald-700 text-emerald-400"
                                          )}
                                        >
                                          <span className="text-[11px] font-mono font-bold tracking-tighter leading-none">
                                            {displayNum}
                                          </span>
                                        </button>

                                        {/* Tooltip */}
                                        <PositionTooltip pos={pos} isFull={isFull} />
                                      </div>
                                    )
                                  })}

                                  {sidePositions.length === 0 && (
                                    <p className="text-[10px] text-slate-700 italic">Nenhuma posição neste lado</p>
                                  )}
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
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

// ── Sub-componentes de apoio ─────────────────────────────────────────────────

function StatItem({
  label,
  value,
  unit,
  color = "text-white",
}: {
  label: string
  value: string | number
  unit?: string
  color?: string
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-widest mb-1">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-xl font-light tabular-nums tracking-tighter", color)}>{value}</span>
        {unit && <span className="text-[9px] font-medium text-slate-600 uppercase">{unit}</span>}
      </div>
    </div>
  )
}

function LegendDot({
  color,
  label,
  count,
  small,
}: {
  color: string
  label: string
  count: number
  small?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("rounded-full shrink-0", color, small ? "h-1.5 w-1.5" : "h-2 w-2")} />
      <span className={cn("font-semibold text-slate-500 uppercase tracking-widest", small ? "text-[8px]" : "text-[9px]")}>
        {label} <span className="text-slate-300">{count}</span>
      </span>
    </div>
  )
}

function StatCell({
  label,
  value,
  dot,
}: {
  label: string
  value: string | number
  dot?: string
}) {
  return (
    <div className="flex flex-col border-l border-slate-800 pl-3 first:border-none first:pl-0">
      <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
        {dot && <div className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
        {label}
      </span>
      <p className="text-sm font-semibold text-white leading-none tracking-tight">{value}</p>
    </div>
  )
}

function SubBarItem({
  label,
  value,
  unit,
  color = "text-white",
}: {
  label: string
  value: string | number
  unit?: string
  color?: string
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-widest mb-1">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-sm font-semibold leading-none", color)}>{value}</span>
        {unit && <span className="text-[8px] font-medium text-slate-600 uppercase">{unit}</span>}
      </div>
    </div>
  )
}

function PositionTooltip({ pos, isFull }: { pos: DriveInPosition; isFull: boolean }) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[400] w-56 pointer-events-none">
      <div className="bg-slate-950/98 text-white rounded-2xl p-3 shadow-2xl border border-white/10 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-2">
          <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-widest font-mono">
            {pos.id}
          </span>
          <div
            className={cn(
              "h-2.5 w-2.5 rounded-full ring-2 ring-white/10",
              pos.is_blocked ? "bg-slate-500" : isFull ? "bg-red-500" : pos.paletes === 0 ? "bg-slate-600" : "bg-emerald-500"
            )}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 uppercase">
            <span>Ocupação</span>
            <span className="text-white text-[11px]">
              {pos.paletes} / {pos.capacidade} PTs
            </span>
          </div>
          {pos.is_blocked && (
            <div className="flex items-center gap-1 text-[9px] text-amber-400">
              <AlertCircle size={10} /> Posição Bloqueada
            </div>
          )}
          {pos.products && pos.products.length > 0 && (
            <div className="pt-1.5 border-t border-white/5">
              <p className="text-[9px] font-semibold text-slate-500 uppercase mb-1">
                Itens Registrados ({pos.products.length})
              </p>
              <p className="text-[11px] font-semibold text-slate-100 font-mono truncate">
                {pos.products[0].sku} ({pos.products[0].quantidade} un)
              </p>
            </div>
          )}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-950/98" />
      </div>
    </div>
  )
}
