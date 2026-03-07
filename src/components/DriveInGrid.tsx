"use client"

import React from "react"
import { Package, AlertCircle, Droplet, Lock, ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface Product {
  sku: string
  descricao: string
  nivel: string | number
  quantidade: number
  paletes: number
  profundidade: string | number
  qtd_por_palete: number
  qtd_tombada: number
  qtd_molhado: number
  id_palete?: string
}

interface DriveInGridProps {
  products: Product[]
  capacity: number
  levelCount: number
  isBlocked?: boolean
  observation?: string
  positionId?: string
}

export function DriveInGrid({ products, capacity, levelCount, isBlocked, observation, positionId }: DriveInGridProps) {
  // 1. Identify all unique levels
  // 1. Generate range of levels based on total height
  // If levels=4, we want [3, 2, 1, 0]
  const levels = Array.from({ length: levelCount }, (_, i) => i).sort((a, b) => b - a)

  // Calculate max depth
  const dataDepths = Array.from(new Set(products.map(p => {
    const d = parseInt(String(p.profundidade).replace(/\D/g, ""))
    return isNaN(d) ? 0 : d
  }))).filter(d => d > 0)
  
  const calculatedMaxDepth = levelCount > 0 ? Math.ceil(capacity / levelCount) : 0
  const maxDepth = Math.max(calculatedMaxDepth, ...dataDepths, 1)
  const depths = Array.from({ length: maxDepth }, (_, i) => i + 1)

  // 2. Intelligent Distribution Logic
  const grid: Record<number, Record<number, Product[]>> = {}
  levels.forEach(lvl => {
    grid[lvl] = {}
    depths.forEach(d => { grid[lvl][d] = [] })
  })

  // Group products by level
  levels.forEach(lvl => {
    const levelProducts = products.filter(p => p.nivel === lvl)
    
    // First, place products with explicit (and valid) depth
    const remainingProducts: Product[] = []
    levelProducts.forEach(p => {
      const d = parseInt(String(p.profundidade).replace(/\D/g, ""))
      if (!isNaN(d) && d > 0 && d <= maxDepth) {
        grid[lvl][d].push(p)
      } else if (p.sku !== "Posição Vazia") {
        remainingProducts.push(p)
      }
    })

    // Group fractional or shared-id products together before distributing
    const groupedById = new Map<string, Product[]>()
    const fractionals: Product[] = []
    const wholePallets: Product[] = []

    remainingProducts.forEach(p => {
      if (p.id_palete) {
        if (!groupedById.has(p.id_palete)) groupedById.set(p.id_palete, [])
        groupedById.get(p.id_palete)!.push(p)
      } else if (p.paletes > 0 && p.paletes < 0.99) {
        fractionals.push(p)
      } else {
        wholePallets.push(p)
      }
    })

    const finalGroups: Product[][] = Array.from(groupedById.values())
    
    // Group fractionals by summing to ~1
    let currentGroup: Product[] = []
    let currentSum = 0
    fractionals.forEach(p => {
      currentGroup.push(p)
      currentSum += p.paletes
      if (currentSum >= 0.95) {
        finalGroups.push(currentGroup)
        currentGroup = []
        currentSum = 0
      }
    })
    if (currentGroup.length > 0) finalGroups.push(currentGroup)
    wholePallets.forEach(p => finalGroups.push([p]))

    // Distribute grouped products into available slots
    let currentDepth = 1
    finalGroups.forEach(group => {
      const totalPallets = group.reduce((sum, p) => sum + p.paletes, 0)
      let cellsNeeded = Math.max(1, Math.round(totalPallets))
      
      while (cellsNeeded > 0 && currentDepth <= maxDepth) {
        if (grid[lvl][currentDepth].length === 0) {
          grid[lvl][currentDepth].push(...group)
          cellsNeeded--
        }
        currentDepth++
      }
    })
  })

  const [selectedCoords, setSelectedCoords] = React.useState<{ lvl: number; d: number } | null>(null)

  if (isBlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 dark:bg-slate-800/10 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800">
        <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
          <Lock size={32} />
        </div>
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Drive Bloqueado</h3>
        <p className="text-xs font-bold text-slate-400 uppercase mt-2">{observation || "Sem observações"}</p>
      </div>
    )
  }

  const selectedCellProducts = selectedCoords ? grid[selectedCoords.lvl][selectedCoords.d] : []
  const selectedProduct = selectedCellProducts[0] || null

  // Aggregated Position Stats
  const totalQty = products.reduce((sum, p) => sum + p.quantidade, 0)
  const totalPallets = products.reduce((sum, p) => sum + p.paletes, 0)
  const uniqueSkus = new Set(products.map(p => p.sku)).size
  const isMixed = uniqueSkus > 1

  return (
    <div className="w-full flex flex-col lg:flex-row gap-8 pb-4">
      {/* Grid Section */}
      <div className="flex-1 overflow-x-auto custom-scrollbar pt-2">
        <div className="flex flex-col items-center min-w-full p-4">
          <div className="relative inline-block">
            {/* Axis Labels Header Row (Levels Only) */}
            <div className="flex mb-4">
               <div className="w-14 shrink-0 pr-4 text-right">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    NÍVEL
                  </span>
               </div>
            </div>

            {/* Main Grid Area (Levels + Front Indicator) */}
            <div className="flex items-start">
              {/* Grid Rows: Levels */}
              <div className="space-y-4 mb-8 pr-4">
                {levels.map(lvl => {
                  const val = parseFloat(String(lvl))
                  const displayLvl = isNaN(val) ? lvl : Math.floor(val).toString()
                  
                  return (
                    <div key={`row-${lvl}`} className="flex items-center">
                      {/* Level Label (Y-Axis) */}
                      <div className="w-14 shrink-0 pr-4 text-right">
                        <span className="text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                          {displayLvl}
                        </span>
                      </div>

                      {/* Cells */}
                      <div className="flex gap-4">
                        {depths.map(d => {
                          const cellProducts = grid[lvl][d]
                          const isEmpty = cellProducts.length === 0
                          const isSelected = selectedCoords?.lvl === lvl && selectedCoords?.d === d
                          const hasWet = cellProducts.some(p => p.qtd_molhado > 0)
                          const hasTilted = cellProducts.some(p => p.qtd_tombada > 0)
                          const isMixedCell = cellProducts.length > 1
                          const sku = !isEmpty ? (isMixedCell ? `${cellProducts.length} SKUs` : cellProducts[0].sku) : ""
                          const description = !isEmpty ? (isMixedCell ? "Múltiplos produtos neste palete" : cellProducts[0].descricao) : ""
                          const qty = !isEmpty ? Math.round(cellProducts.reduce((sum, p) => sum + p.quantidade, 0)) : 0
                          const formattedLvl = isNaN(val) ? lvl : Math.floor(val).toString()
                          
                          return (
                            <motion.div 
                              key={`cell-${lvl}-${d}`} 
                              whileHover={{ scale: 1.04 }}
                              transition={{ duration: 0.1, ease: "easeOut" }}
                              onClick={() => !isEmpty && setSelectedCoords(isSelected ? null : { lvl, d })}
                              className={cn(
                                "w-28 h-28 rounded-xl border relative group flex items-center justify-center p-2 text-center overflow-hidden cursor-pointer",
                                isEmpty 
                                  ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
                                isSelected && "border-[3px] border-blue-600 dark:border-blue-500 z-20 scale-[1.02]"
                              )}
                            >
                              {!isEmpty ? (
                                <div 
                                  className={cn(
                                    "w-[94%] h-[94%] rounded-lg flex flex-col items-center justify-center p-2 relative transition-all",
                                    hasWet 
                                      ? "bg-blue-600" 
                                      : hasTilted
                                      ? "bg-red-600"
                                      : isMixedCell
                                      ? "bg-amber-600 dark:bg-amber-700"
                                      : "bg-[#7A5134] dark:bg-[#5D3D27]",
                                    "border border-black/10"
                                  )}
                                >
                                  {/* SKU Label - Increased Size */}
                                  <span className="text-[13px] font-medium text-white truncate w-full px-1 tracking-tight z-10 antialiased">
                                    {sku}
                                  </span>
                                  
                                  {/* Quantity Label - Increased Size */}
                                  <span className="text-[11px] font-medium text-white/90 uppercase tracking-tighter z-10">
                                      {qty.toLocaleString('pt-BR')} UN
                                  </span>

                                  {/* Status Icons - High Contrast */}
                                  <div className="absolute bottom-1.5 right-1.5 flex gap-1 z-10">
                                      {hasWet && (
                                          <div className="h-4 w-4 rounded-full bg-blue-800 flex items-center justify-center border border-white/20">
                                              <Droplet size={10} className="text-white fill-white" />
                                          </div>
                                      )}
                                      {hasTilted && (
                                          <div className="h-4 w-4 rounded-full bg-red-800 flex items-center justify-center border border-white/20">
                                              <AlertCircle size={10} className="text-white fill-white" />
                                          </div>
                                      )}
                                      {isMixedCell && !hasWet && !hasTilted && (
                                          <div className="h-4 px-1.5 rounded-full bg-amber-800 flex items-center justify-center border border-white/20">
                                              <span className="text-[8px] font-black text-white uppercase mt-0.5">Mix</span>
                                          </div>
                                      )}
                                  </div>

                                  {/* Structured Tooltip (No moving parts) */}
                                  {!isSelected && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[250] w-64 pointer-events-none">
                                        <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-700 relative text-left font-sans">
                                            <div className="flex justify-between items-start mb-2 pb-2 border-b border-slate-700">
                                                <div>
                                                    <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest mb-0.5">NÍVEL {formattedLvl} • PROF. {d}</p>
                                                    <p className="text-xs font-black text-white uppercase">{sku}</p>
                                                </div>
                                                <div className={cn(
                                                    "px-1.5 py-0.5 rounded text-[7px] font-black uppercase text-white",
                                                    hasWet ? "bg-blue-600" : hasTilted ? "bg-red-600" : isMixedCell ? "bg-amber-600" : "bg-[#7A5134]"
                                                )}>
                                                    {hasWet ? "Molhado" : hasTilted ? "Tombado" : isMixedCell ? "Misto" : "Normal"}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-300 leading-tight mb-3 line-clamp-2 italic">{description}</p>
                                            <div className="flex justify-between items-center text-[11px]">
                                                <div>
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase block">Estoque</span>
                                                    <span className="font-black">{qty.toLocaleString('pt-BR')}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase block">Paletes</span>
                                                    <span className="font-black">{Math.ceil(cellProducts.reduce((sum, p) => sum + p.paletes, 0))} PT</span>
                                                </div>
                                            </div>
                                            {/* Static Arrow - High Contrast Visibility */}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-500" />
                                        </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1 opacity-20">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">VAZIO</span>
                                </div>
                              )}
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Front indicator on the right (Minimalist) */}
              <div className="self-stretch flex flex-col items-center justify-center pl-4 mb-8">
                 <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                    <ArrowLeft size={16} className="text-slate-900 dark:text-white" />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-900 dark:text-white">FRENTE</span>
                 </div>
              </div>
            </div>

            {/* Footer Row: Numeric Indicators (No P) */}
            <div className="flex gap-4 ml-14 mb-4">
              {depths.map(d => (
                <div key={`head-${d}`} className="w-28 shrink-0 text-center">
                  <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                    {d}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer Axis Label Header */}
            <div className="flex ml-14 pt-2 border-t border-slate-100 dark:border-slate-800/50">
               <div className="flex-1 flex justify-center">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    PROFUNDIDADE
                  </span>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selection Detail Sidebar */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full lg:w-72 shrink-0 transition-all duration-500"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-[2rem] p-5 shadow-xl shadow-slate-200/40 dark:shadow-none sticky top-4">
          {selectedProduct ? (
            <div className="space-y-5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-blue-500/80 uppercase tracking-widest mb-0.5 block">
                    Célula
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                    N{selectedCoords ? selectedCoords.lvl : ""} • P{selectedCoords ? selectedCoords.d : ""}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedCoords(null)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group"
                >
                  <Lock size={14} className="text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                </button>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {selectedCellProducts.map((p, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 space-y-3">
                    <div className="space-y-1">
                      <p className="text-[14px] font-black text-slate-900 dark:text-white leading-tight">{p.sku}</p>
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-snug line-clamp-2 italic">
                        {p.descricao}
                      </p>
                    </div>
                    
                    <div className="flex gap-1.5">
                      {p.qtd_molhado > 0 && (
                        <div className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                          <Droplet size={8} className="fill-current" /> Molhado
                        </div>
                      )}
                      {p.qtd_tombada > 0 && (
                        <div className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                          <AlertCircle size={8} className="fill-current" /> Tombado
                        </div>
                      )}
                      {p.qtd_molhado === 0 && p.qtd_tombada === 0 && (
                        <div className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                          Normal
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/50">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Qty / Palletes</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {Math.round(p.quantidade).toLocaleString('pt-BR')} <span className="text-[8px] opacity-40">UN</span> • {Number(p.paletes).toFixed(2).replace(/\.?0+$/, '')} <span className="text-[8px] opacity-40">PT</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
                <button 
                  onClick={() => setSelectedCoords(null)}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 mt-4"
                >
                  Fechar Detalhes
                </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 block">
                  Dashboard de Posição
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                  {positionId || "Drive-In"}
                </h3>
              </div>

              {/* Minimalist Summary Grid */}
              <div className="space-y-5">
                {/* Integrated Occupation */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ocupação</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">
                      {totalPallets} <span className="text-[11px] text-slate-400 font-bold">/ {capacity} PTs</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((totalPallets / capacity) * 100, 100)}%` }}
                      className={cn(
                        "h-full rounded-full transition-colors",
                        (totalPallets / capacity) > 0.9 ? "bg-red-500" : "bg-blue-600"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total SKUs</span>
                      <span className={cn(
                        "text-[8px] font-black px-1.5 py-0.5 rounded uppercase",
                        isMixed ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      )}>
                        {isMixed ? "Misturado" : "Mono"}
                      </span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{uniqueSkus}</p>
                  </div>

                  <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/50">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Unidades Físicas</span>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{totalQty.toLocaleString('pt-BR')}</p>
                  </div>
                </div>

                <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-widest animate-pulse pt-2">
                  Selecione p/ mais detalhes
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
