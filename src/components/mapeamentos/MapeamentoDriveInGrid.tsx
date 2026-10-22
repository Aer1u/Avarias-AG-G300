"use client"

import React from "react"
import {
  ArrowLeft,
  Lock,
  Edit2,
  Trash2,
  Check,
  Square,
  AlertCircle,
  Droplet,
  RefreshCw,
  Plus,
  Box,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { MapeamentoConfig, MapeamentoItem, COLOR_THEMES } from "@/lib/mapeamentosStorage"

interface MapeamentoDriveInGridProps {
  positionId: string
  items: MapeamentoItem[]
  capacity: number
  levelCount: number
  isBlocked?: boolean
  observation?: string
  config: MapeamentoConfig
  onAddItem: (nivel: number, profundidade: number) => void
  onEditItem: (item: MapeamentoItem) => void
  onDeleteItem: (itemId: string) => void
}

export function MapeamentoDriveInGrid({
  positionId,
  items,
  capacity,
  levelCount,
  isBlocked,
  observation,
  config,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: MapeamentoDriveInGridProps) {
  const [selectedCoords, setSelectedCoords] = React.useState<{ lvl: number; d: number } | null>(null)
  const [isEditModeActive, setIsEditModeActive] = React.useState(false)
  const [selectedGaps, setSelectedGaps] = React.useState<Set<string>>(new Set())
  const theme = COLOR_THEMES[config.cor] || COLOR_THEMES.blue

  // Levels: from top to bottom (e.g. 3, 2, 1, 0), ou [0] para Chão
  const levels = React.useMemo(
    () => Array.from({ length: Math.max(1, levelCount) }, (_, i) => i).sort((a, b) => b - a),
    [levelCount]
  )

  // Calculate max depth from capacity and levelCount
  const maxDepth = levelCount > 0 ? Math.ceil(capacity / levelCount) : capacity || 4
  const depths = Array.from({ length: Math.max(maxDepth, 1) }, (_, i) => i + 1)

  // Index items by slot [nivel]_[profundidade]
  const grid = React.useMemo(() => {
    const g: Record<number, Record<number, MapeamentoItem[]>> = {}
    levels.forEach(lvl => {
      g[lvl] = {}
      depths.forEach(d => { g[lvl][d] = [] })
    })
    items.forEach(item => {
      let lvl = item.nivel
      if (levelCount <= 1) lvl = 0
      const d = item.profundidade
      if (g[lvl] && g[lvl][d] !== undefined) {
        g[lvl][d].push(item)
      } else if (g[lvl]) {
        // Se a profundidade for além do range, aloca no primeiro slot livre ou no final
        const firstFreeD = depths.find(depth => g[lvl][depth].length === 0) || depths[depths.length - 1]
        if (firstFreeD && g[lvl][firstFreeD]) {
          g[lvl][firstFreeD].push(item)
        }
      }
    })
    return g
  }, [items, levels, depths, levelCount])

  const toggleGapSelection = (lvl: number, d: number) => {
    const key = `${lvl}-${d}`
    setSelectedGaps(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Aggregated position stats
  const { totalItems, uniqueSkus } = React.useMemo(() => {
    const tItems = items.length
    const uSkus = new Set(items.map(p => p.sku)).size
    return { totalItems: tItems, uniqueSkus: uSkus }
  }, [items])

  // Selected cell products
  const selectedCellItems = selectedCoords ? grid[selectedCoords.lvl]?.[selectedCoords.d] || [] : []
  const selectedItem = selectedCellItems[0] || null

  if (isBlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 dark:bg-slate-800/10 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-700">
        <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
          <Lock size={32} />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
          Drive Bloqueado
        </h3>
        <p className="text-xs font-normal text-slate-400 uppercase mt-2">
          {observation || "Sem observações"}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col gap-4 relative">
      <style>{`
        .map-drop-target-active {
          transform: scale(1.08) !important;
          border-color: #3b82f6 !important;
          border-width: 3px !important;
          background-color: rgba(59, 130, 246, 0.15) !important;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.3) !important;
          z-index: 40 !important;
        }
      `}</style>

      <div className="w-full flex flex-col lg:flex-row gap-2 md:gap-8 pb-1 md:pb-4 relative">
        {/* Grid Section */}
        <div className="flex-1 overflow-x-auto custom-scrollbar pt-2">
          <div className="flex flex-col items-center min-w-full p-4">
            <div className="relative inline-block">

              {/* Axis Label Header Row */}
              <div className="flex mb-4">
                <div className="w-8 md:w-14 shrink-0 pr-1 md:pr-4 text-right">
                  <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {levelCount <= 1 ? "SOLO" : "NÍVEL"}
                  </span>
                </div>
              </div>

              {/* Main Grid Area */}
              <div className="flex items-start">
                <div className="space-y-1.5 md:space-y-4 mb-4 md:mb-8 pr-2 md:pr-4">
                  {levels.map(lvl => (
                    <div key={`row-${lvl}`} className="flex items-center">
                      {/* Level Label */}
                      <div className="w-8 md:w-14 shrink-0 pr-1 md:pr-4 text-right">
                        <span className="text-[13px] font-semibold text-slate-900 dark:text-white uppercase tracking-tighter">
                          {levelCount <= 1 ? "CHÃO" : lvl}
                        </span>
                      </div>

                      {/* Cells */}
                      <div className="flex gap-1.5 md:gap-4">
                        {depths.map(d => {
                          const cellItems = grid[lvl]?.[d] || []
                          const isEmpty = cellItems.length === 0
                          const isSelected = selectedCoords?.lvl === lvl && selectedCoords?.d === d
                          const isGridSelected = selectedGaps.has(`${lvl}-${d}`)
                          const firstItem = cellItems[0]
                          const sku = !isEmpty ? firstItem.sku : ""
                          const qty = !isEmpty ? cellItems.reduce((sum, p) => sum + p.quantidade, 0) : 0

                          return (
                            <div
                              key={`cell-${lvl}-${d}`}
                              onClick={() => {
                                if (isEditModeActive) {
                                  toggleGapSelection(lvl, d)
                                } else if (!isEmpty) {
                                  setSelectedCoords(isSelected ? null : { lvl, d })
                                }
                              }}
                              className={cn(
                                "w-16 h-16 sm:w-28 sm:h-28 md:w-28 md:h-28 rounded-lg md:rounded-xl border relative group flex items-center justify-center p-0.5 sm:p-2 text-center transition-all duration-200 cursor-pointer shrink-0",
                                isEmpty
                                  ? "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700",
                                !isEditModeActive && "hover:scale-[1.04]",
                                isSelected && "border-[3px] border-blue-600 dark:border-blue-500 z-20 scale-[1.02]",
                                isGridSelected && "border-orange-500 ring-4 ring-orange-500/10 bg-orange-50/5 dark:bg-orange-950/10 z-20"
                              )}
                            >
                              {/* Multi-Selection Indicator */}
                              {isEditModeActive && (
                                <div className="absolute top-2 right-2 z-30">
                                  {isGridSelected ? (
                                    <div className="bg-orange-500 text-white rounded-md p-0.5 shadow-sm">
                                      <Check size={12} strokeWidth={4} />
                                    </div>
                                  ) : (
                                    <div className="bg-white/50 dark:bg-slate-800/50 text-slate-300 rounded-md p-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                      <Square size={12} />
                                    </div>
                                  )}
                                </div>
                              )}

                              {!isEmpty ? (
                                /* 3D Box + Pallet Visual — idêntico ao DriveInGrid do G300 */
                                <div className="w-[94%] h-[94%] rounded-xl flex flex-col items-center justify-between overflow-hidden relative shadow-md bg-[#1e293b] dark:bg-slate-800 border-[1.5px] border-slate-700 hover:brightness-110 transition-colors p-0.5">
                                  {/* The 3D Box & Pallet Graphic */}
                                  <div className="flex-1 flex flex-col items-center justify-center w-full mt-0.5 sm:mt-2">
                                    <div className="relative group-hover:-translate-y-0.5 transition-transform duration-300 flex flex-col items-center">
                                      <span className="text-sm sm:text-2xl md:text-[32px] drop-shadow-md inline-block relative z-10 leading-none">
                                        📦
                                      </span>
                                      <div className="w-6 sm:w-11 h-[3px] sm:h-[5px] bg-[#8B5A2B] rounded-sm mx-auto flex justify-around items-end pt-[1px] sm:pt-[2px] relative z-0 -mt-[1px] sm:-mt-[2px] shadow-sm">
                                        <div className="w-[3px] sm:w-[5px] h-[2px] sm:h-[3px] bg-[#4A2E12] rounded-t-[1px]"></div>
                                        <div className="w-[3px] sm:w-[5px] h-[2px] sm:h-[3px] bg-[#4A2E12] rounded-t-[1px]"></div>
                                        <div className="w-[3px] sm:w-[5px] h-[2px] sm:h-[3px] bg-[#4A2E12] rounded-t-[1px]"></div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Dark Information Pill */}
                                  <div className="w-[96%] sm:w-[88%] bg-[#0B1120] rounded sm:rounded-lg py-0.5 sm:py-1.5 flex flex-col items-center justify-center mb-0.5 sm:mb-1.5 border border-white/5 shadow-inner px-0.5">
                                    <span className="text-[8px] sm:text-[12px] leading-tight font-bold text-white tracking-tight sm:tracking-widest truncate max-w-full font-mono">
                                      {sku}
                                    </span>
                                    <span className="text-[7px] sm:text-[10px] leading-tight text-slate-400 font-medium whitespace-nowrap">
                                      {qty.toLocaleString("pt-BR")} un
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center w-full h-full gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                  {isEditModeActive ? (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation()
                                        onAddItem(lvl, d)
                                      }}
                                      className="add-pallete-btn h-10 w-10 flex items-center justify-center bg-blue-600 rounded-full text-white shadow-lg hover:scale-110 hover:bg-blue-500 transition-all cursor-pointer opacity-100 ring-4 ring-blue-500/20"
                                    >
                                      <span className="text-2xl font-light mb-1">+</span>
                                    </button>
                                  ) : (
                                    <span className="text-[8px] font-medium text-slate-400 uppercase tracking-widest group-hover:opacity-20 text-center px-1">
                                      VAZIO
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Front indicator — idêntico ao DriveInGrid do G300 */}
                <div className="self-stretch flex flex-col items-center justify-center pl-4 mb-8">
                  <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                    <ArrowLeft size={16} className="text-slate-900 dark:text-white" />
                    <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-slate-900 dark:text-white">
                      FRENTE
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Row: Numeric Indicators */}
              <div className="flex gap-1.5 md:gap-4 ml-8 md:ml-14 mb-2 md:mb-4">
                {depths.map(d => (
                  <div key={`head-${d}`} className="w-16 sm:w-28 md:w-28 shrink-0 text-center">
                    <span className="text-[11px] font-semibold text-slate-900 dark:text-white uppercase tracking-tighter">
                      {d}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer Axis Label */}
              <div className="flex ml-8 md:ml-14 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                <div className="flex-1 flex justify-center">
                  <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {levelCount <= 1 ? "VAGAS / POSIÇÕES NO CHÃO" : "PROFUNDIDADE"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selection Detail Sidebar — idêntico ao DriveInGrid do G300 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full lg:w-72 shrink-0 transition-all duration-500"
        >
          {selectedCoords && selectedItem ? (
            <div className="space-y-4">
              {/* Selected Cell Header */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50 pb-3 mb-3">
                  <div>
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block mb-0.5">
                      Slot Selecionado
                    </span>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                      N{selectedCoords.lvl} · P{selectedCoords.d}
                    </h4>
                  </div>
                  {selectedItem.idPalete && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                      {selectedItem.idPalete}
                    </span>
                  )}
                </div>

                {/* SKU & Description */}
                <div className="space-y-1">
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                      Produto / SKU
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white font-mono truncate">
                      {selectedItem.sku}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {selectedItem.descricao || "Sem descrição"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/40">
                    <span className="text-xs text-slate-500">Quantidade</span>
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                      {selectedItem.quantidade} un
                    </span>
                  </div>
                </div>

                {/* Custom Fields */}
                {Object.keys(selectedItem.customValues || {}).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50 space-y-1.5">
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block">
                      Dados Adicionais
                    </span>
                    {Object.entries(selectedItem.customValues).map(([fieldId, val]) => {
                      const fieldDef = config.camposPersonalizados.find(f => f.id === fieldId)
                      return (
                        <div
                          key={fieldId}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/40"
                        >
                          <span className="text-slate-400 text-[10px]">{fieldDef?.nome || fieldId}:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                            {String(val)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => onEditItem(selectedItem)}
                    className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 text-white"
                    style={{ background: theme.primary }}
                  >
                    <Edit2 size={13} /> Editar
                  </button>
                  <button
                    onClick={() => {
                      onDeleteItem(selectedItem.id)
                      setSelectedCoords(null)
                    }}
                    className="py-2 px-3 rounded-xl bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Trash2 size={13} /> Remover
                  </button>
                </div>
              </div>

              {/* All items in cell */}
              {selectedCellItems.length > 1 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Outros itens neste slot ({selectedCellItems.length})
                  </span>
                  {selectedCellItems.slice(1).map(it => (
                    <div
                      key={it.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">{it.sku}</p>
                        <p className="text-[10px] text-slate-400">{it.quantidade} un</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => onEditItem(it)} className="p-1 text-slate-400 hover:text-blue-500 cursor-pointer"><Edit2 size={12} /></button>
                        <button onClick={() => onDeleteItem(it.id)} className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col gap-4">
              {/* Position Stats */}
              <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center border shrink-0"
                    style={{ background: theme.bgSoft, borderColor: theme.border, color: theme.primary }}
                  >
                    <Box size={18} />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      {config.nome}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                      {positionId}
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">
                      Itens Mapeados
                    </span>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{totalItems}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">
                      SKUs Únicos
                    </span>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{uniqueSkus}</p>
                  </div>
                  <div className="col-span-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">
                      Capacidade
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {totalItems} / {capacity}
                      </p>
                      <div className="h-1.5 w-20 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, capacity > 0 ? (totalItems / capacity) * 100 : 0)}%`,
                            background: theme.primary,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center py-4 text-xs text-slate-400 font-medium">
                Clique em qualquer célula da grade para ver detalhes ou mapear novos itens
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
