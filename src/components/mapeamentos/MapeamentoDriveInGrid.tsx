"use client"

import React, { useState, useRef, useMemo } from "react"
import {
  ArrowLeft,
  Lock,
  Edit2,
  Trash2,
  Check,
  Square,
  PlusSquare,
  AlertCircle,
  Droplet,
  Plus,
  Box,
  X,
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
  isEditModeActive?: boolean
  setIsEditModeActive?: React.Dispatch<React.SetStateAction<boolean>>
  onAddItem: (
    nivel: number,
    profundidade: number,
    batchCoords?: { lvl: number; prof: number }[]
  ) => void
  onEditItem: (item: MapeamentoItem) => void
  onDeleteItem: (itemId: string) => void
  onSwapItems?: (
    source: { lvl: number; d: number },
    target: { lvl: number; d: number }
  ) => void
  isLoggedIn?: boolean
}

export function MapeamentoDriveInGrid({
  positionId,
  items,
  capacity,
  levelCount,
  isBlocked,
  observation,
  config,
  isEditModeActive: propIsEditModeActive,
  setIsEditModeActive: propSetIsEditModeActive,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onSwapItems,
  isLoggedIn = false,
}: MapeamentoDriveInGridProps) {
  const [selectedCoords, setSelectedCoords] = useState<{ lvl: number; d: number } | null>(null)
  const [internalEditMode, setInternalEditMode] = useState(false)
  const isEditModeActive =
    isLoggedIn && (propIsEditModeActive !== undefined ? propIsEditModeActive : internalEditMode)
  const setIsEditModeActive = propSetIsEditModeActive || setInternalEditMode
  const [selectedGaps, setSelectedGaps] = useState<Set<string>>(new Set())
  const theme = COLOR_THEMES[config.cor] || COLOR_THEMES.blue

  // Modal G300 de edição de item de posição
  const [editingItem, setEditingItem] = useState<{
    item: MapeamentoItem
    origLvl: number
    origProf: number
    newQty: number
    newNivel: number
    newProf: number
    qtdTombada: number
    qtdMolhado: number
  } | null>(null)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  // Drag and drop tracking
  const justDragged = useRef(false)
  const [draggingCoords, setDraggingCoords] = useState<{ lvl: number; d: number } | null>(null)

  // Levels: from top to bottom (e.g. 3, 2, 1, 0), ou [0] para Chão
  const levels = useMemo(
    () => Array.from({ length: Math.max(1, levelCount) }, (_, i) => i).sort((a, b) => b - a),
    [levelCount]
  )

  // Calculate max depth from capacity and levelCount
  const maxDepth = levelCount > 0 ? Math.ceil(capacity / levelCount) : capacity || 4
  const depths = useMemo(
    () => Array.from({ length: Math.max(maxDepth, 1) }, (_, i) => i + 1),
    [maxDepth]
  )

  // Index items by slot [nivel]_[profundidade]
  const grid = useMemo(() => {
    const g: Record<number, Record<number, MapeamentoItem[]>> = {}
    levels.forEach(lvl => {
      g[lvl] = {}
      depths.forEach(d => {
        g[lvl][d] = []
      })
    })
    items.forEach(item => {
      let lvl = item.nivel
      if (levelCount <= 1) lvl = 0
      const d = item.profundidade
      if (g[lvl] && g[lvl][d] !== undefined) {
        g[lvl][d].push(item)
      } else if (g[lvl]) {
        // Se a profundidade for além do range, aloca no primeiro slot livre ou no final
        const firstFreeD =
          depths.find(depth => g[lvl][depth].length === 0) || depths[depths.length - 1]
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

  // Estatísticas agregadas
  const { totalItems, uniqueSkus } = useMemo(() => {
    const tItems = items.length
    const uSkus = new Set(items.map(p => p.sku)).size
    return { totalItems: tItems, uniqueSkus: uSkus }
  }, [items])

  // Itens da célula selecionada
  const selectedCellItems = selectedCoords
    ? grid[selectedCoords.lvl]?.[selectedCoords.d] || []
    : []
  const selectedItem = selectedCellItems[0] || null

  const handleOpenEditItemModal = (it: MapeamentoItem) => {
    setEditingItem({
      item: it,
      origLvl: it.nivel,
      origProf: it.profundidade,
      newQty: it.quantidade,
      newNivel: it.nivel,
      newProf: it.profundidade,
      qtdTombada: Number(it.customValues?.qtd_tombada) || 0,
      qtdMolhado: Number(it.customValues?.qtd_molhado) || 0,
    })
  }

  const handleSaveItemEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return

    setIsSubmittingEdit(true)
    try {
      const updated: MapeamentoItem = {
        ...editingItem.item,
        quantidade: Math.max(0, editingItem.newQty),
        nivel: editingItem.newNivel,
        profundidade: editingItem.newProf,
        customValues: {
          ...(editingItem.item.customValues || {}),
          qtd_tombada: editingItem.qtdTombada,
          qtd_molhado: editingItem.qtdMolhado,
        },
      }
      await onEditItem(updated)
      setEditingItem(null)
    } catch (err) {
      console.error("Erro ao salvar item:", err)
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  const handleBatchEmptySelectedGaps = () => {
    if (confirm(`Deseja esvaziar os itens dos ${selectedGaps.size} slots selecionados?`)) {
      selectedGaps.forEach(k => {
        const [lvl, d] = k.split("-").map(Number)
        const cellItems = grid[lvl]?.[d] || []
        cellItems.forEach(it => onDeleteItem(it.id))
      })
      setSelectedGaps(new Set())
    }
  }

  if (isBlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 dark:bg-slate-800/10 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-700">
        <div className="h-16 w-16 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 flex items-center justify-center mb-4">
          <Lock size={32} />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
          Posição Bloqueada
        </h3>
        <p className="text-xs font-normal text-slate-400 uppercase mt-2">
          {observation || "Sem observações registradas"}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col gap-4 relative">
      <style>{`
        .drop-target-active {
          transform: scale(1.06) !important;
          border-color: #3b82f6 !important;
          border-width: 3px !important;
          background-color: rgba(59, 130, 246, 0.15) !important;
          box-shadow: 0 0 25px rgba(59, 130, 246, 0.35) !important;
          z-index: 40 !important;
        }
      `}</style>

      <div className="w-full flex flex-col lg:flex-row gap-2 md:gap-8 pb-1 md:pb-4 relative">
        {/* ── GRID SECTION ──────────────────────────────────────────────── */}
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
                          const isSelected =
                            selectedCoords?.lvl === lvl && selectedCoords?.d === d
                          const isGridSelected = selectedGaps.has(`${lvl}-${d}`)
                          const firstItem = cellItems[0]
                          const sku = !isEmpty ? firstItem.sku : ""
                          const qty = !isEmpty
                            ? cellItems.reduce((sum, p) => sum + p.quantidade, 0)
                            : 0
                          const hasTilted = Number(firstItem?.customValues?.qtd_tombada) > 0
                          const hasWet = Number(firstItem?.customValues?.qtd_molhado) > 0
                          const isMixed = cellItems.length > 1

                          return (
                            <div
                              key={`cell-${lvl}-${d}`}
                              data-grid-slot="true"
                              data-lvl={lvl}
                              data-d={d}
                              onClick={() => {
                                if (justDragged.current) return
                                if (isEditModeActive) {
                                  if (isEmpty) {
                                    toggleGapSelection(lvl, d)
                                  } else {
                                    setSelectedCoords(isSelected ? null : { lvl, d })
                                  }
                                } else if (!isEmpty) {
                                  setSelectedCoords(isSelected ? null : { lvl, d })
                                } else {
                                  setSelectedCoords(null)
                                }
                              }}
                              className={cn(
                                "w-16 h-16 sm:w-28 sm:h-28 md:w-28 md:h-28 rounded-lg md:rounded-xl border relative group flex items-center justify-center p-0.5 sm:p-2 text-center transition-all duration-200 cursor-pointer shrink-0",
                                isEmpty
                                  ? "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700",
                                !isEditModeActive && !draggingCoords && "hover:scale-[1.04]",
                                isSelected &&
                                  "border-[3px] border-blue-600 dark:border-blue-500 z-20 scale-[1.02]",
                                isGridSelected &&
                                  "border-orange-500 ring-4 ring-orange-500/10 bg-orange-50/5 dark:bg-orange-950/10 z-20",
                                draggingCoords?.lvl === lvl &&
                                  draggingCoords?.d === d &&
                                  "z-[60]"
                              )}
                            >
                              {/* Multi-Selection Indicator — idêntico ao G300 */}
                              {isEditModeActive && (
                                <div className="absolute top-2 right-2 z-30">
                                  {isGridSelected ? (
                                    <div className="bg-orange-500 text-white rounded-md p-0.5 shadow-sm">
                                      <Check size={12} strokeWidth={4} />
                                    </div>
                                  ) : (
                                    <div className="bg-white/50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 rounded-md p-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                      <Square size={12} />
                                    </div>
                                  )}
                                </div>
                              )}

                              {!isEmpty ? (
                                /* Palete 3D com Suporte a Drag and Drop no Modo Edição — G300 Style */
                                <motion.div
                                  key={cellItems.map(p => p.id).join("-")}
                                  drag={isEditModeActive}
                                  dragMomentum={false}
                                  dragElastic={0}
                                  onClick={e => {
                                    if (isEditModeActive) e.stopPropagation()
                                  }}
                                  onDragStart={() => {
                                    justDragged.current = false
                                    document.body.classList.add("grid-is-dragging")
                                    setDraggingCoords({ lvl, d })
                                  }}
                                  onDrag={(e, info) => {
                                    if (!document.body.classList.contains("grid-is-dragging")) return
                                    const clientX =
                                      "clientX" in e
                                        ? (e as any).clientX
                                        : (e as any).touches?.[0]?.clientX ||
                                          (e as any).changedTouches?.[0]?.clientX
                                    const clientY =
                                      "clientY" in e
                                        ? (e as any).clientY
                                        : (e as any).touches?.[0]?.clientY ||
                                          (e as any).changedTouches?.[0]?.clientY
                                    if (clientX && clientY) {
                                      const elements = document.elementsFromPoint(clientX, clientY)
                                      const cell = elements.find(
                                        el => el?.getAttribute?.("data-grid-slot") === "true"
                                      )

                                      document
                                        .querySelectorAll(".drop-target-active")
                                        .forEach(node => {
                                          node.classList.remove("drop-target-active")
                                        })

                                      if (cell) {
                                        const targetLvl = Number(cell.getAttribute("data-lvl"))
                                        const targetD = Number(cell.getAttribute("data-d"))
                                        if (targetLvl !== lvl || targetD !== d) {
                                          cell.classList.add("drop-target-active")
                                        }
                                      }
                                    }
                                  }}
                                  onDragEnd={(e, info) => {
                                    justDragged.current = true
                                    setTimeout(() => {
                                      justDragged.current = false
                                    }, 300)

                                    document.body.classList.remove("grid-is-dragging")
                                    setDraggingCoords(null)

                                    document
                                      .querySelectorAll(".drop-target-active")
                                      .forEach(node => {
                                        node.classList.remove("drop-target-active")
                                      })

                                    const clientX =
                                      "clientX" in e
                                        ? (e as any).clientX
                                        : (e as any).touches?.[0]?.clientX ||
                                          (e as any).changedTouches?.[0]?.clientX
                                    const clientY =
                                      "clientY" in e
                                        ? (e as any).clientY
                                        : (e as any).touches?.[0]?.clientY ||
                                          (e as any).changedTouches?.[0]?.clientY

                                    if (clientX && clientY && onSwapItems) {
                                      const elements = document.elementsFromPoint(clientX, clientY)
                                      const cell = elements.find(
                                        el => el?.getAttribute?.("data-grid-slot") === "true"
                                      )
                                      if (cell) {
                                        const targetLvl = Number(cell.getAttribute("data-lvl"))
                                        const targetD = Number(cell.getAttribute("data-d"))
                                        if (
                                          !isNaN(targetLvl) &&
                                          !isNaN(targetD) &&
                                          (targetLvl !== lvl || targetD !== d)
                                        ) {
                                          onSwapItems(
                                            { lvl, d },
                                            { lvl: targetLvl, d: targetD }
                                          )
                                        }
                                      }
                                    }
                                  }}
                                  whileDrag={{
                                    scale: 1.1,
                                    zIndex: 100,
                                    rotate: 2,
                                    boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
                                    opacity: 0.9,
                                  }}
                                  className={cn(
                                    "w-[94%] h-[94%] rounded-xl flex flex-col items-center justify-between overflow-hidden relative shadow-md transition-colors p-0.5",
                                    isEditModeActive
                                      ? "cursor-grab active:cursor-grabbing"
                                      : "cursor-pointer",
                                    "bg-[#1e293b] dark:bg-slate-800",
                                    hasWet
                                      ? "shadow-[inset_0_0_20px_rgba(37,99,235,0.25)] border-[1.5px] border-blue-500/40"
                                      : hasTilted
                                      ? "shadow-[inset_0_0_20px_rgba(220,38,38,0.25)] border-[1.5px] border-red-500/40"
                                      : isMixed
                                      ? "shadow-[inset_0_0_20px_rgba(217,119,6,0.25)] border-[1.5px] border-amber-500/40"
                                      : "shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] border-[1.5px] border-slate-700 hover:brightness-110"
                                  )}
                                >
                                  {/* Absolute Status Badges */}
                                  <div className="absolute top-0.5 right-0.5 sm:top-1.5 sm:right-1.5 flex gap-0.5 sm:gap-1 z-20">
                                    {hasWet && (
                                      <div className="h-3.5 w-3.5 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                                        <Droplet size={8} className="text-white fill-white" />
                                      </div>
                                    )}
                                    {hasTilted && (
                                      <div className="h-3.5 w-3.5 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                                        <AlertCircle size={8} className="text-white fill-white" />
                                      </div>
                                    )}
                                    {isMixed && !hasWet && !hasTilted && (
                                      <div className="px-1 h-3 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
                                        <span className="text-[7px] font-bold text-white uppercase">
                                          Mix
                                        </span>
                                      </div>
                                    )}
                                  </div>

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

                                  {/* The Dark Information Pill */}
                                  <div className="w-[96%] sm:w-[88%] bg-[#0B1120] rounded sm:rounded-lg py-0.5 sm:py-1.5 flex flex-col items-center justify-center mb-0.5 sm:mb-1.5 border border-white/5 shadow-inner px-0.5">
                                    <span className="text-[8px] sm:text-[12px] leading-tight font-bold text-white tracking-tight sm:tracking-widest truncate max-w-full font-mono">
                                      {sku}
                                    </span>
                                    <span className="text-[7px] sm:text-[10px] leading-tight text-slate-400 font-medium whitespace-nowrap">
                                      {qty.toLocaleString("pt-BR")} un
                                    </span>
                                  </div>
                                </motion.div>
                              ) : (
                                /* Célula Vazia: exibe botão + circular azul quando Mapear/Editar está ativo (G300) */
                                <div className="flex flex-col items-center justify-center w-full h-full gap-1 transition-opacity">
                                  {isEditModeActive ? (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation()
                                        onAddItem(lvl, d)
                                      }}
                                      title={`Adicionar Palete no Nível ${lvl}, Profundidade ${d}`}
                                      className="add-pallete-btn h-10 w-10 flex items-center justify-center bg-blue-600 hover:bg-blue-500 rounded-full text-white shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer opacity-100 ring-4 ring-blue-500/20 z-20"
                                    >
                                      <span className="text-2xl font-light mb-1 leading-none">+</span>
                                    </button>
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center select-none pointer-events-none">
                                      <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center px-1">
                                        VAZIO
                                      </span>
                                    </div>
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

        {/* ── SELECTION DETAIL SIDEBAR — IDÊNTICO AO G300 ─────────────────── */}
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
                      Célula Selecionada
                    </span>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                      N{selectedCoords.lvl} · P{selectedCoords.d}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isEditModeActive && (
                      <button
                        onClick={() => {
                          if (confirm("Deseja esvaziar todos os itens deste slot?")) {
                            selectedCellItems.forEach(it => onDeleteItem(it.id))
                            setSelectedCoords(null)
                          }
                        }}
                        className="px-2.5 py-1 bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-[10px] font-semibold rounded-lg border border-rose-200 dark:border-rose-800/50 hover:bg-rose-100 transition-colors uppercase tracking-tight cursor-pointer"
                        title="Esvaziar Slot"
                      >
                        Esvaziar
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedCoords(null)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
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

                {/* Actions no sidebar — Edit e Delete por Item (apenas quando logado) */}
                {isLoggedIn && (
                  <>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleOpenEditItemModal(selectedItem)}
                        className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 text-white bg-blue-600 hover:bg-blue-500"
                      >
                        <Edit2 size={13} /> Editar Item
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

                    {/* Botão de adicionar outro item ao mesmo slot */}
                    <button
                      onClick={() => onAddItem(selectedCoords.lvl, selectedCoords.d)}
                      className="w-full mt-2 py-2 px-3 rounded-xl border border-dashed border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus size={14} /> Mapear outro item neste slot
                    </button>
                  </>
                )}
              </div>

              {/* Tabela de múltiplos itens no slot */}
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
                        <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                          {it.sku}
                        </p>
                        <p className="text-[10px] text-slate-400">{it.quantidade} un</p>
                      </div>
                      {isLoggedIn && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleOpenEditItemModal(it)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => onDeleteItem(it.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col gap-4">
              {/* Position Summary Dashboard */}
              <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center border shrink-0"
                    style={{
                      background: theme.bgSoft,
                      borderColor: theme.border,
                      color: theme.primary,
                    }}
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
                      Paletes Ocupados
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
                      Ocupação
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {totalItems} / {capacity} PTs
                      </p>
                      <div className="h-2 w-24 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              capacity > 0 ? (totalItems / capacity) * 100 : 0
                            )}%`,
                            background: totalItems > capacity ? "#ef4444" : theme.primary,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center py-4 text-xs text-slate-400 font-medium">
                {isEditModeActive
                  ? "Clique no botão + para mapear paletes ou selecione células vazias"
                  : "Clique em qualquer célula para inspecionar, ou ative o botão Editar para modificar"}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── MODAL G300: EDITAR ITEM DE POSIÇÃO ────────────────────────────── */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4"
            >
              <form onSubmit={handleSaveItemEdit} className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <Edit2 size={16} className="text-blue-500" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase leading-none">
                      Editar Item de Posição
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold text-[10px] uppercase cursor-pointer"
                  >
                    ✕ Fechar
                  </button>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Item Atual</p>
                    <p className="font-bold text-slate-900 dark:text-white text-sm font-mono">
                      {editingItem.item.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 block">
                      Posição Original
                    </span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                      N{editingItem.origLvl} · P{editingItem.origProf}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Qtd Total */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-semibold text-slate-400 uppercase">
                      Quantidade Total *
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editingItem.newQty}
                      onChange={e =>
                        setEditingItem({
                          ...editingItem,
                          newQty: Math.max(0, Math.floor(Number(e.target.value))),
                        })
                      }
                      className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl font-bold font-mono outline-none text-slate-900 dark:text-white focus:border-blue-500"
                      required
                    />
                  </div>

                  {/* Tombado / Molhado */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-semibold text-slate-400 uppercase">
                        Qtd Tombada
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editingItem.qtdTombada}
                        onChange={e =>
                          setEditingItem({
                            ...editingItem,
                            qtdTombada: Math.max(0, Math.floor(Number(e.target.value))),
                          })
                        }
                        className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-semibold text-slate-400 uppercase">
                        Qtd Molhado
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editingItem.qtdMolhado}
                        onChange={e =>
                          setEditingItem({
                            ...editingItem,
                            qtdMolhado: Math.max(0, Math.floor(Number(e.target.value))),
                          })
                        }
                        className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>

                  {/* Novo Nível / Nova Profundidade */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-semibold text-slate-400 uppercase">
                        Novo Nível *
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editingItem.newNivel}
                        onChange={e =>
                          setEditingItem({
                            ...editingItem,
                            newNivel: Number(e.target.value),
                          })
                        }
                        className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-blue-500 p-2 rounded-lg text-slate-900 dark:text-white font-bold outline-none font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-semibold text-slate-400 uppercase">
                        Nova Profundidade *
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={editingItem.newProf}
                        onChange={e =>
                          setEditingItem({
                            ...editingItem,
                            newProf: Number(e.target.value),
                          })
                        }
                        className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-blue-500 p-2 rounded-lg text-slate-900 dark:text-white font-bold outline-none font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Modal Action Buttons */}
                  <div className="space-y-2 pt-2">
                    <button
                      type="submit"
                      disabled={isSubmittingEdit}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/20 disabled:opacity-40 transition-all cursor-pointer"
                    >
                      {isSubmittingEdit ? "Salvando..." : "Salvar Alterações"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const targetId = editingItem.item.id
                        setEditingItem(null)
                        onDeleteItem(targetId)
                        setSelectedCoords(null)
                      }}
                      className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 dark:text-rose-400 font-semibold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Trash2 size={13} /> Remover Item Desta Posição
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── FLOATING BATCH ACTION BAR — IDÊNTICO AO G300 ───────────────────── */}
      <AnimatePresence>
        {isEditModeActive && selectedGaps.size > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[140] w-[95vw] sm:w-full max-w-lg px-2 sm:px-4"
          >
            <div className="bg-slate-900/95 dark:bg-slate-950/95 shadow-2xl rounded-2xl p-3 border border-slate-700 flex items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-center gap-3 pl-2 border-r border-slate-700 pr-4">
                <div className="h-9 w-9 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold shadow-lg shadow-orange-500/30 text-sm">
                  {selectedGaps.size}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white tracking-tight leading-none">
                    Grades Selecionadas
                  </h4>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mt-1">
                    Ação em Lote (G300)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const gapsArray = Array.from(selectedGaps).map(k => {
                      const [l, d] = k.split("-").map(Number)
                      return { lvl: l, prof: d }
                    })
                    const first = gapsArray[0]
                    onAddItem(first.lvl, first.prof, gapsArray)
                  }}
                  className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusSquare size={15} /> Adicionar em Lote
                </button>
                <button
                  onClick={handleBatchEmptySelectedGaps}
                  className="h-9 px-3 rounded-xl bg-white/10 hover:bg-rose-600 text-white text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 border border-white/10 cursor-pointer"
                  title="Esvaziar slots selecionados"
                >
                  <Trash2 size={14} /> Esvaziar
                </button>
                <button
                  onClick={() => setSelectedGaps(new Set())}
                  title="Limpar seleção"
                  className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
