"use client"

import React, { useState, useRef, useMemo, useEffect } from "react"
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
import type { DimensionConfig } from "@/components/MapLibrary/dimensionsTypes"
import { generateDimensionItems } from "@/components/MapLibrary/dimensionManager"

interface MapeamentoDriveInGridProps {
  positionId: string
  items: MapeamentoItem[]
  capacity: number
  levelCount: number
  startLevel?: number
  levelsConfig?: DimensionConfig
  depthConfig?: DimensionConfig
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
  onEditSlot?: (items: MapeamentoItem[]) => void
  onDeleteItem: (itemId: string) => void
  onSwapItems?: (
    source: { lvl: number; d: number },
    target: { lvl: number; d: number }
  ) => void
  isLoggedIn?: boolean
  fitToViewport?: boolean
  sidePreview?: React.ReactNode
}

export function MapeamentoDriveInGrid({
  positionId,
  items,
  capacity,
  levelCount,
  startLevel,
  levelsConfig,
  depthConfig,
  isBlocked,
  observation,
  config,
  isEditModeActive: propIsEditModeActive,
  setIsEditModeActive: propSetIsEditModeActive,
  onAddItem,
  onEditItem,
  onEditSlot,
  onDeleteItem,
  onSwapItems,
  isLoggedIn = false,
  fitToViewport = false,
  sidePreview,
}: MapeamentoDriveInGridProps) {
  const effectiveStartLevel = startLevel ?? (levelsConfig ? 1 : 0)
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

  // Medição dinâmica do container central útil (considerando painel lateral direito e cabeçalho)
  const gridViewportRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    if (!fitToViewport) return
    const el = gridViewportRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (rect && rect.width > 0 && rect.height > 0) {
        setViewportSize(prev =>
          prev && Math.abs(prev.w - rect.width) < 2 && Math.abs(prev.h - rect.height) < 2
            ? prev
            : { w: rect.width, h: rect.height }
        )
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitToViewport])

  const totalLevels = Math.max(1, levelCount)
  const maxAllowedLevel = effectiveStartLevel + totalLevels - 1

  // Levels: do topo para a base (ex: 4, 3, 2, 1 quando startLevel=1; ou 3, 2, 1, 0 quando startLevel=0)
  const levels = useMemo(
    () =>
      Array.from({ length: totalLevels }, (_, i) => i + effectiveStartLevel).sort(
        (a, b) => b - a
      ),
    [totalLevels, effectiveStartLevel]
  )

  // Calculate max depth from capacity and levelCount
  const maxDepth = levelCount > 0 ? Math.ceil(capacity / levelCount) : capacity || 4
  const depths = useMemo(
    () => Array.from({ length: Math.max(maxDepth, 1) }, (_, i) => i + 1),
    [maxDepth]
  )

  // Nomenclatura resolvida de níveis e profundidades (fiel ao objeto)
  const resolvedLevelItems = useMemo(() => {
    if (!levelsConfig) return null
    return generateDimensionItems(
      totalLevels,
      levelsConfig.sequenceType,
      levelsConfig.orientation,
      levelsConfig.prefix,
      levelsConfig.suffix,
      levelsConfig.paddingDigits,
      levelsConfig.customValues
    )
  }, [levelsConfig, totalLevels])

  const resolvedDepthItems = useMemo(() => {
    if (!depthConfig) return null
    return generateDimensionItems(
      depths.length,
      depthConfig.sequenceType,
      depthConfig.orientation,
      depthConfig.prefix,
      depthConfig.suffix,
      depthConfig.paddingDigits,
      depthConfig.customValues
    )
  }, [depthConfig, depths.length])

  const getLevelLabel = (lvl: number): string => {
    const idx = lvl - effectiveStartLevel
    if (resolvedLevelItems && resolvedLevelItems[idx]) {
      return resolvedLevelItems[idx].identifier
    }
    if (effectiveStartLevel === 0 && levelCount <= 1) {
      return "CHÃO"
    }
    return String(lvl)
  }

  const getDepthLabel = (d: number): string => {
    const idx = d - 1
    if (resolvedDepthItems && resolvedDepthItems[idx]) {
      return resolvedDepthItems[idx].identifier
    }
    return String(d)
  }

  const formatCoord = (prefix: string, label: string): string => {
    return /^\d+$/.test(label) ? `${prefix}${label}` : label
  }

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
      if (effectiveStartLevel === 0 && levelCount <= 1) {
        lvl = 0
      } else if (lvl < effectiveStartLevel) {
        lvl = effectiveStartLevel
      } else if (lvl > maxAllowedLevel) {
        lvl = maxAllowedLevel
      }
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
  }, [items, levels, depths, levelCount, effectiveStartLevel, maxAllowedLevel])

  const toggleGapSelection = (lvl: number, d: number) => {
    const key = `${lvl}-${d}`
    setSelectedGaps(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Estatísticas agregadas: conta paletes físicos reais ocupados (células distintas preenchidas)
  const { totalPallets, uniqueSkus, totalQty } = useMemo(() => {
    let occupied = 0
    levels.forEach(lvl => {
      depths.forEach(d => {
        if ((grid[lvl]?.[d] || []).length > 0) {
          occupied++
        }
      })
    })
    const uSkus = new Set(items.map(p => p.sku)).size
    const tQty = items.reduce((sum, p) => sum + p.quantidade, 0)
    return { totalPallets: occupied, uniqueSkus: uSkus, totalQty: tQty }
  }, [grid, levels, depths, items])

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

  const isDenseGrid = fitToViewport && (levels.length >= 6 || depths.length >= 7)

  // Dimensionamento dinâmico proporcional das células baseado no espaço útil real do container central
  const gridMetrics = useMemo(() => {
    if (!fitToViewport || !viewportSize) return null
    const cols = Math.max(1, depths.length)
    const rows = Math.max(1, levels.length)
    const LABEL_COL_W = 42
    const FRONT_COL_W = 42
    const VERT_CHROME = 76
    const gap = Math.max(
      6,
      Math.min(12, Math.round(Math.min(viewportSize.w, viewportSize.h) * 0.016))
    )

    const usableW = Math.max(160, viewportSize.w - LABEL_COL_W - FRONT_COL_W - 18)
    const usableH = Math.max(140, viewportSize.h - VERT_CHROME)

    const rawCellW = (usableW - (cols - 1) * gap) / cols
    const rawCellH = (usableH - (rows - 1) * gap) / rows

    const MIN_CELL = 44
    const MAX_CELL_W = 220
    const MAX_CELL_H = 175

    let cellW = Math.min(rawCellW, rawCellH * 1.45, MAX_CELL_W)
    let cellH = Math.min(rawCellH, cellW * 1.25, MAX_CELL_H)
    cellW = Math.max(Math.min(rawCellW, MIN_CELL), Math.floor(cellW))
    cellH = Math.max(Math.min(rawCellH, MIN_CELL), Math.floor(cellH))

    const gridInnerWidth = LABEL_COL_W + cols * cellW + (cols - 1) * gap + FRONT_COL_W + gap
    return {
      labelColW: LABEL_COL_W,
      frontColW: FRONT_COL_W,
      gap,
      cellW,
      cellH,
      gridInnerWidth,
    }
  }, [fitToViewport, viewportSize, depths.length, levels.length])

  const cellMinDim = gridMetrics ? Math.min(gridMetrics.cellW, gridMetrics.cellH) : 84
  const isLargeCell = fitToViewport && cellMinDim >= 98

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

  const renderGridCell = (lvl: number, d: number) => {
    const cellItems = grid[lvl]?.[d] || []
    const isEmpty = cellItems.length === 0
    const isSelected = selectedCoords?.lvl === lvl && selectedCoords?.d === d
    const isGridSelected = selectedGaps.has(`${lvl}-${d}`)
    const firstItem = cellItems[0]
    const isMixed = new Set(cellItems.map(p => p.sku)).size > 1
    const sku = !isEmpty
      ? isMixed
        ? `${new Set(cellItems.map(p => p.sku)).size} SKUs`
        : firstItem.sku
      : ""
    const qty = !isEmpty ? cellItems.reduce((sum, p) => sum + p.quantidade, 0) : 0
    const hasTilted = cellItems.some(p => Number(p.customValues?.qtd_tombada) > 0)
    const hasWet = cellItems.some(p => Number(p.customValues?.qtd_molhado) > 0)

    return (
      <div
        key={`cell-${lvl}-${d}`}
        data-grid-slot="true"
        data-lvl={lvl}
        data-d={d}
        onClick={() => {
          if (justDragged.current) return
          if (isEditModeActive) {
            if (selectedGaps.size > 0 || isEmpty) {
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
          fitToViewport
            ? "w-full h-full min-w-0 min-h-0 rounded-lg md:rounded-xl border relative group flex items-center justify-center p-0.5 sm:p-1 text-center transition-all duration-200 cursor-pointer overflow-hidden"
            : "w-16 h-16 sm:w-28 sm:h-28 md:w-28 md:h-28 rounded-lg md:rounded-xl border relative group flex items-center justify-center p-0.5 sm:p-2 text-center transition-all duration-200 cursor-pointer shrink-0",
          isEmpty
            ? "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700",
          !isEditModeActive && !draggingCoords && (fitToViewport ? "hover:brightness-110" : "hover:scale-[1.04]"),
          isSelected && "border-[3px] border-blue-600 dark:border-blue-500 z-20",
          !fitToViewport && isSelected && "scale-[1.02]",
          isGridSelected &&
            "border-orange-500 ring-2 sm:ring-4 ring-orange-500/10 bg-orange-50/5 dark:bg-orange-950/10 z-20",
          draggingCoords?.lvl === lvl && draggingCoords?.d === d && "z-[60]"
        )}
      >
        {isEditModeActive && (
          <div
            className={cn(
              "absolute z-30 cursor-pointer rounded-lg hover:bg-orange-500/20 transition-colors",
              fitToViewport ? "top-0.5 right-0.5 p-0.5" : "top-1.5 right-1.5 p-1"
            )}
            onClick={e => {
              e.stopPropagation()
              toggleGapSelection(lvl, d)
            }}
            title="Selecionar para ação em lote"
          >
            {isGridSelected ? (
              <div className="bg-orange-500 text-white rounded-md p-0.5 shadow-sm">
                <Check size={fitToViewport ? 10 : 12} strokeWidth={4} />
              </div>
            ) : (
              <div className="bg-white/50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 rounded-md p-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                <Square size={fitToViewport ? 10 : 12} />
              </div>
            )}
          </div>
        )}

        {!isEmpty ? (
          <motion.div
            key={cellItems.map(p => p.id).join("-")}
            drag={isEditModeActive}
            dragMomentum={false}
            dragElastic={0}
            onClick={e => {
              if (justDragged.current) {
                e.stopPropagation()
                return
              }
              if (isEditModeActive && selectedGaps.size > 0) {
                e.stopPropagation()
                toggleGapSelection(lvl, d)
              }
            }}
            onDragStart={() => {
              justDragged.current = false
              document.body.classList.add("grid-is-dragging")
              setDraggingCoords({ lvl, d })
            }}
            onDrag={e => {
              if (!document.body.classList.contains("grid-is-dragging")) return
              const ev = e as unknown as {
                clientX?: number
                clientY?: number
                touches?: Array<{ clientX?: number; clientY?: number }>
                changedTouches?: Array<{ clientX?: number; clientY?: number }>
              }
              const clientX =
                ev.clientX ?? ev.touches?.[0]?.clientX ?? ev.changedTouches?.[0]?.clientX
              const clientY =
                ev.clientY ?? ev.touches?.[0]?.clientY ?? ev.changedTouches?.[0]?.clientY
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
            onDragEnd={e => {
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

              const ev = e as unknown as {
                clientX?: number
                clientY?: number
                touches?: Array<{ clientX?: number; clientY?: number }>
                changedTouches?: Array<{ clientX?: number; clientY?: number }>
              }
              const clientX =
                ev.clientX ?? ev.touches?.[0]?.clientX ?? ev.changedTouches?.[0]?.clientX
              const clientY =
                ev.clientY ?? ev.touches?.[0]?.clientY ?? ev.changedTouches?.[0]?.clientY

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
                    onSwapItems({ lvl, d }, { lvl: targetLvl, d: targetD })
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
              fitToViewport
                ? "w-full h-full min-w-0 min-h-0 rounded-md sm:rounded-lg flex flex-col items-center justify-between overflow-hidden relative shadow-md transition-colors p-0.5"
                : "w-[94%] h-[94%] rounded-xl flex flex-col items-center justify-between overflow-hidden relative shadow-md transition-colors p-0.5",
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
            <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 flex gap-0.5 z-20">
              {hasWet && (
                <div className="h-3 w-3 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                  <Droplet size={7} className="text-white fill-white" />
                </div>
              )}
              {hasTilted && (
                <div className="h-3 w-3 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                  <AlertCircle size={7} className="text-white fill-white" />
                </div>
              )}
              {isMixed && !hasWet && !hasTilted && (
                <div className="px-1 h-3 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
                  <span className="text-[6px] sm:text-[7px] font-bold text-white uppercase">
                    Mix
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col items-center justify-center w-full overflow-hidden">
              <div className="relative group-hover:-translate-y-0.5 transition-transform duration-300 flex flex-col items-center">
                <span
                  className={cn(
                    "drop-shadow-md inline-block relative z-10 leading-none",
                    fitToViewport
                      ? isDenseGrid
                        ? "text-xs sm:text-sm"
                        : isLargeCell
                        ? "text-2xl sm:text-3xl"
                        : "text-lg sm:text-xl"
                      : "text-sm sm:text-2xl md:text-[32px]"
                  )}
                >
                  📦
                </span>
                {(!fitToViewport || !isDenseGrid) && (
                  <div
                    className={cn(
                      "bg-[#8B5A2B] rounded-sm mx-auto flex justify-around items-end pt-[1px] relative z-0 -mt-[1px] shadow-sm",
                      fitToViewport
                        ? isLargeCell
                          ? "w-7 sm:w-9 h-[3px] sm:h-[4px]"
                          : "w-5 sm:w-6 h-[2px] sm:h-[3px]"
                        : "w-5 sm:w-9 h-[3px] sm:h-[4px]"
                    )}
                  >
                    <div className="w-[3px] sm:w-[4px] h-[2px] bg-[#4A2E12] rounded-t-[1px]" />
                    <div className="w-[3px] sm:w-[4px] h-[2px] bg-[#4A2E12] rounded-t-[1px]" />
                    <div className="w-[3px] sm:w-[4px] h-[2px] bg-[#4A2E12] rounded-t-[1px]" />
                  </div>
                )}
              </div>
            </div>

            <div
              className={cn(
                "bg-[#0B1120] rounded sm:rounded-md flex flex-col items-center justify-center border border-white/5 shadow-inner px-1 shrink-0",
                fitToViewport
                  ? isLargeCell
                    ? "w-[92%] py-1 mb-1 sm:rounded-lg"
                    : "w-[96%] py-[2px] mb-0.5"
                  : "w-[96%] sm:w-[88%] py-0.5 sm:py-1.5 mb-0.5 sm:mb-1.5 sm:rounded-lg"
              )}
            >
              <span
                className={cn(
                  "leading-tight font-bold text-white truncate max-w-full font-mono",
                  fitToViewport
                    ? isLargeCell
                      ? "text-[10px] sm:text-xs tracking-wide"
                      : "text-[8px] sm:text-[10px]"
                    : "text-[8px] sm:text-[12px] tracking-tight sm:tracking-widest"
                )}
              >
                {sku}
              </span>
              <span
                className={cn(
                  "leading-tight text-slate-400 font-medium whitespace-nowrap",
                  fitToViewport
                    ? isLargeCell
                      ? "text-[9px] sm:text-[10px]"
                      : "text-[7px] sm:text-[9px]"
                    : "text-[7px] sm:text-[10px]"
                )}
              >
                {qty.toLocaleString("pt-BR")} un
              </span>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full gap-1 transition-opacity">
            {isEditModeActive ? (
              <button
                onClick={e => {
                  e.stopPropagation()
                  onAddItem(lvl, d)
                }}
                title={`Adicionar Palete no Nível ${getLevelLabel(lvl)}, Profundidade ${getDepthLabel(d)}`}
                className={cn(
                  "add-pallete-btn flex items-center justify-center bg-blue-600 hover:bg-blue-500 rounded-full text-white shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer opacity-100 ring-blue-500/20 z-20",
                  fitToViewport
                    ? isLargeCell
                      ? "h-10 w-10 ring-4"
                      : "h-7 w-7 ring-2"
                    : "h-10 w-10 ring-4"
                )}
              >
                <span
                  className={cn(
                    "font-light leading-none",
                    fitToViewport ? (isLargeCell ? "text-2xl mb-0.5" : "text-base") : "text-2xl mb-1"
                  )}
                >
                  +
                </span>
              </button>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center select-none pointer-events-none">
                <span
                  className={cn(
                    "font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center px-0.5",
                    fitToViewport
                      ? isLargeCell
                        ? "text-[9px] sm:text-[10px]"
                        : "text-[7px] sm:text-[8px]"
                      : "text-[8px] sm:text-[9px]"
                  )}
                >
                  VAZIO
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "w-full flex flex-col relative",
        fitToViewport ? "h-full min-h-0 overflow-hidden gap-2" : "gap-4"
      )}
    >
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

      <div
        className={cn(
          "w-full flex relative",
          fitToViewport
            ? "flex-1 min-h-0 flex-col md:flex-row gap-3 md:gap-4 overflow-hidden"
            : "flex-col lg:flex-row gap-2 md:gap-8 pb-1 md:pb-4"
        )}
      >
        {/* ── GRID SECTION ──────────────────────────────────────────────── */}
        {fitToViewport ? (
          <div
            ref={gridViewportRef}
            className="flex-1 min-w-0 min-h-0 flex items-center justify-center overflow-hidden p-1.5"
          >
            <div
              className="flex flex-col overflow-hidden"
              style={
                gridMetrics
                  ? { width: `${gridMetrics.gridInnerWidth}px` }
                  : { width: "100%", height: "100%" }
              }
            >
              {/* Axis Label Header Row */}
              <div
                className="flex items-center mb-1 shrink-0"
                style={{ gap: `${gridMetrics?.gap ?? 8}px` }}
              >
                <div
                  className="shrink-0 pr-1.5 text-right"
                  style={{ width: `${gridMetrics?.labelColW ?? 42}px` }}
                >
                  <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {levelsConfig?.displayName ||
                      (effectiveStartLevel === 0 && levelCount <= 1 ? "SOLO" : "NÍVEL")}
                  </span>
                </div>
              </div>

              {/* Matrix + FRENTE indicator com células dimensionadas dinamicamente */}
              <div
                className="flex-1 min-h-0 flex items-stretch overflow-hidden"
                style={{ gap: `${gridMetrics?.gap ?? 8}px` }}
              >
                <div
                  className="grid items-stretch"
                  style={
                    gridMetrics
                      ? {
                          gap: `${gridMetrics.gap}px`,
                          gridTemplateColumns: `${gridMetrics.labelColW}px repeat(${depths.length}, ${gridMetrics.cellW}px)`,
                          gridTemplateRows: `repeat(${levels.length}, ${gridMetrics.cellH}px)`,
                        }
                      : {
                          flex: 1,
                          gap: "8px",
                          gridTemplateColumns: `2.5rem repeat(${depths.length}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${levels.length}, minmax(0, 1fr))`,
                        }
                  }
                >
                  {levels.map(lvl => (
                    <React.Fragment key={`row-${lvl}`}>
                      <div className="flex items-center justify-end pr-1.5 min-h-0">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-tighter truncate">
                          {getLevelLabel(lvl)}
                        </span>
                      </div>
                      {depths.map(d => renderGridCell(lvl, d))}
                    </React.Fragment>
                  ))}
                </div>

                {/* Front indicator */}
                <div
                  className="shrink-0 flex flex-col items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
                  style={{ width: `${gridMetrics?.frontColW ?? 42}px` }}
                >
                  <ArrowLeft size={15} className="text-slate-900 dark:text-white" />
                  <span className="text-[8px] font-semibold uppercase tracking-[0.22em] text-slate-900 dark:text-white mt-0.5">
                    FRENTE
                  </span>
                </div>
              </div>

              {/* Footer Depth Indicators alinhados 1-para-1 com as colunas da grade */}
              <div
                className="shrink-0 flex items-center mt-1.5"
                style={{ gap: `${gridMetrics?.gap ?? 8}px` }}
              >
                <div
                  className="grid"
                  style={
                    gridMetrics
                      ? {
                          gap: `${gridMetrics.gap}px`,
                          gridTemplateColumns: `${gridMetrics.labelColW}px repeat(${depths.length}, ${gridMetrics.cellW}px)`,
                        }
                      : {
                          flex: 1,
                          gap: "8px",
                          gridTemplateColumns: `2.5rem repeat(${depths.length}, minmax(0, 1fr))`,
                        }
                  }
                >
                  <div />
                  {depths.map(d => (
                    <div key={`head-${d}`} className="text-center min-w-0">
                      <span className="text-[11px] font-semibold text-slate-900 dark:text-white uppercase tracking-tighter truncate block">
                        {getDepthLabel(d)}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  className="shrink-0"
                  style={{ width: `${gridMetrics?.frontColW ?? 42}px` }}
                />
              </div>

              {/* Footer Axis Label */}
              <div className="shrink-0 flex justify-center pt-1.5 mt-1 border-t border-slate-100 dark:border-slate-800/50">
                <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {depthConfig?.displayName ||
                    (effectiveStartLevel === 0 && levelCount <= 1
                      ? "VAGAS / POSIÇÕES NO CHÃO"
                      : "PROFUNDIDADE")}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto custom-scrollbar pt-2">
            <div className="flex flex-col items-center min-w-full p-4">
              <div className="relative inline-block">
                {/* Axis Label Header Row */}
                <div className="flex mb-4">
                  <div className="w-8 md:w-14 shrink-0 pr-1 md:pr-4 text-right">
                    <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {levelsConfig?.displayName || (effectiveStartLevel === 0 && levelCount <= 1 ? "SOLO" : "NÍVEL")}
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
                            {getLevelLabel(lvl)}
                          </span>
                        </div>

                        {/* Cells */}
                        <div className="flex gap-1.5 md:gap-4">
                          {depths.map(d => renderGridCell(lvl, d))}
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
                        {getDepthLabel(d)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Footer Axis Label */}
                <div className="flex ml-8 md:ml-14 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                  <div className="flex-1 flex justify-center">
                    <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {depthConfig?.displayName || (effectiveStartLevel === 0 && levelCount <= 1 ? "VAGAS / POSIÇÕES NO CHÃO" : "PROFUNDIDADE")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SELECTION DETAIL SIDEBAR — IDÊNTICO AO G300 ─────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "shrink-0 transition-all duration-500",
            fitToViewport
              ? "w-full md:w-64 lg:w-[272px] min-h-0 flex flex-col overflow-hidden"
              : "w-full lg:w-72"
          )}
        >
          {selectedCoords && selectedItem ? (
            <div className={cn(fitToViewport ? "space-y-2.5 overflow-hidden" : "space-y-4")}>
              {/* Selected Cell Header */}
              <div
                className={cn(
                  "rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50",
                  fitToViewport ? "p-3" : "p-4"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50",
                    fitToViewport ? "pb-2 mb-2" : "pb-3 mb-3"
                  )}
                >
                  <div>
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block mb-0.5">
                      Célula Selecionada
                    </span>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                      {formatCoord("N", getLevelLabel(selectedCoords.lvl))} · {formatCoord("P", getDepthLabel(selectedCoords.d))}
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
                    <div className={cn("flex flex-col gap-2", fitToViewport ? "mt-2.5" : "mt-4")}>
                      {selectedCellItems.length > 1 && onEditSlot && (
                        <button
                          onClick={() => onEditSlot(selectedCellItems)}
                          className="w-full py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 text-white bg-purple-600 hover:bg-purple-500"
                        >
                          <Edit2 size={13} /> Editar Palete MIX ({selectedCellItems.length} SKUs)
                        </button>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (selectedCellItems.length > 1 && onEditSlot) {
                              onEditSlot(selectedCellItems)
                            } else {
                              handleOpenEditItemModal(selectedItem)
                            }
                          }}
                          className="flex-1 py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 text-white bg-blue-600 hover:bg-blue-500"
                        >
                          <Edit2 size={13} /> {selectedCellItems.length > 1 ? "Editar Palete" : "Editar Item"}
                        </button>
                        <button
                          onClick={() => {
                            onDeleteItem(selectedItem.id)
                            setSelectedCoords(null)
                          }}
                          className="py-1.5 px-3 rounded-xl bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Trash2 size={13} /> Remover
                        </button>
                      </div>
                    </div>

                    {/* Botão de adicionar outro item ao mesmo slot */}
                    <button
                      onClick={() => onAddItem(selectedCoords.lvl, selectedCoords.d)}
                      className="w-full mt-2 py-1.5 px-3 rounded-xl border border-dashed border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus size={14} /> Mapear outro item neste slot
                    </button>
                  </>
                )}
              </div>

              {/* Tabela de múltiplos itens no slot */}
              {selectedCellItems.length > 1 && (
                <div className="space-y-1.5 overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Outros itens neste slot ({selectedCellItems.length})
                  </span>
                  {(fitToViewport ? selectedCellItems.slice(1, 4) : selectedCellItems.slice(1)).map(it => (
                    <div
                      key={it.id}
                      className={cn(
                        "rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between",
                        fitToViewport ? "p-2" : "p-3"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white font-mono truncate">
                          {it.sku}
                        </p>
                        <p className="text-[10px] text-slate-400">{it.quantidade} un</p>
                      </div>
                      {isLoggedIn && (
                        <div className="flex gap-1 shrink-0">
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
                  {fitToViewport && selectedCellItems.length > 4 && (
                    <p className="text-[10px] text-slate-400 text-center">
                      +{selectedCellItems.length - 4} itens adicionais neste palete
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "flex flex-col overflow-hidden",
                fitToViewport ? "flex-1 min-h-0 gap-2" : "h-full gap-4"
              )}
            >
              {/* Position Summary Dashboard */}
              <div
                className={cn(
                  "rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 shrink-0",
                  fitToViewport ? "p-2.5 space-y-2" : "p-5 space-y-4"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "rounded-xl flex items-center justify-center border shrink-0",
                      fitToViewport ? "h-7 w-7" : "h-10 w-10"
                    )}
                    style={{
                      background: theme.bgSoft,
                      borderColor: theme.border,
                      color: theme.primary,
                    }}
                  >
                    <Box size={fitToViewport ? 14 : 18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                      {config.nome}
                    </span>
                    <h4
                      className={cn(
                        "font-bold text-slate-900 dark:text-white font-mono truncate",
                        fitToViewport ? "text-xs" : "text-sm"
                      )}
                    >
                      {positionId}
                    </h4>
                  </div>
                </div>

                <div className={cn("grid grid-cols-2", fitToViewport ? "gap-1.5" : "gap-3")}>
                  <div
                    className={cn(
                      "rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50",
                      fitToViewport ? "px-2.5 py-1.5" : "p-2.5"
                    )}
                  >
                    <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
                      Paletes Ocupados
                    </span>
                    <p
                      className={cn(
                        "font-bold text-slate-900 dark:text-white leading-tight mt-0.5",
                        fitToViewport ? "text-sm" : "text-lg"
                      )}
                    >
                      {totalPallets}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50",
                      fitToViewport ? "px-2.5 py-1.5" : "p-2.5"
                    )}
                  >
                    <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
                      SKUs Únicos
                    </span>
                    <p
                      className={cn(
                        "font-bold text-slate-900 dark:text-white leading-tight mt-0.5",
                        fitToViewport ? "text-sm" : "text-lg"
                      )}
                    >
                      {uniqueSkus}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50",
                      fitToViewport ? "px-2.5 py-1.5" : "col-span-2 p-2.5"
                    )}
                  >
                    <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
                      Total Peças
                    </span>
                    <p
                      className={cn(
                        "font-bold text-slate-900 dark:text-white font-mono leading-tight mt-0.5",
                        fitToViewport ? "text-xs" : "text-sm"
                      )}
                    >
                      {totalQty.toLocaleString("pt-BR")} un
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50",
                      fitToViewport ? "px-2.5 py-1.5" : "col-span-2 p-2.5"
                    )}
                  >
                    <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
                      Ocupação
                    </span>
                    <div className="flex items-center justify-between gap-1.5 mt-0.5">
                      <p
                        className={cn(
                          "font-bold text-slate-900 dark:text-white leading-tight whitespace-nowrap",
                          fitToViewport ? "text-xs" : "text-lg"
                        )}
                      >
                        {totalPallets}/{capacity} PTs
                      </p>
                      <div
                        className={cn(
                          "h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden",
                          fitToViewport ? "w-10" : "h-2 w-20"
                        )}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              capacity > 0 ? (totalPallets / capacity) * 100 : 0
                            )}%`,
                            background: totalPallets > capacity ? "#ef4444" : theme.primary,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Frame 3D do Drive-In em rotação suave abaixo dos indicadores */}
              {sidePreview && (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  {sidePreview}
                </div>
              )}

              <div
                className={cn(
                  "text-center text-slate-400 font-medium shrink-0",
                  fitToViewport ? "py-0.5 text-[10px] leading-tight" : "py-4 text-xs"
                )}
              >
                {isEditModeActive
                  ? "Clique nas células para selecionar/editar."
                  : "Clique em uma célula para inspecionar."}
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
                      {formatCoord("N", getLevelLabel(editingItem.origLvl))} · {formatCoord("P", getDepthLabel(editingItem.origProf))}
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
                      {levelsConfig || effectiveStartLevel > 0 ? (
                        <select
                          value={editingItem.newNivel}
                          onChange={e =>
                            setEditingItem({
                              ...editingItem,
                              newNivel: Number(e.target.value),
                            })
                          }
                          className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-blue-500 p-2 rounded-lg text-slate-900 dark:text-white font-bold outline-none font-mono"
                        >
                          {[...levels].reverse().map(lvl => (
                            <option key={lvl} value={lvl}>
                              {getLevelLabel(lvl)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          min={effectiveStartLevel}
                          max={maxAllowedLevel}
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
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-semibold text-slate-400 uppercase">
                        Nova Profundidade *
                      </label>
                      {depthConfig || effectiveStartLevel > 0 ? (
                        <select
                          value={editingItem.newProf}
                          onChange={e =>
                            setEditingItem({
                              ...editingItem,
                              newProf: Number(e.target.value),
                            })
                          }
                          className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-blue-500 p-2 rounded-lg text-slate-900 dark:text-white font-bold outline-none font-mono"
                        >
                          {depths.map(d => (
                            <option key={d} value={d}>
                              {getDepthLabel(d)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          min={1}
                          max={depths.length}
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
                      )}
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
