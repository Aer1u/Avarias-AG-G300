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
  onEditSuccess?: () => void
}

export function DriveInGrid({ products, capacity, levelCount, isBlocked, observation, positionId, onEditSuccess }: DriveInGridProps) {
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
  
  // Edit State
  const [isEditModeActive, setIsEditModeActive] = React.useState(false)
  const [addingCoords, setAddingCoords] = React.useState<{ lvl: number; d: number; sku: string; qty: number; molhado: number; tombado: number } | null>(null)
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null)
  const [isSelectingProductToEdit, setIsSelectingProductToEdit] = React.useState(false)
  const [showPasswordPrompt, setShowPasswordPrompt] = React.useState(false)
  const [passwordInput, setPasswordInput] = React.useState("")
  const [passwordError, setPasswordError] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  
  // Onde o usuário pode mudar a senha:
  // Basta alterar a string abaixo ("menos avarias e mais espaço") para a nova senha desejada.
  const EDIT_PASSWORD = "menos avarias e mais espaço"

  const handleEditClick = (p: Product) => {
    setEditingProduct(p)
    if (isEditModeActive) {
      setShowPasswordPrompt(false)
    } else {
      setShowPasswordPrompt(true)
      setPasswordInput("")
      setPasswordError("")
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordInput === EDIT_PASSWORD) {
      setShowPasswordPrompt(false)
      setIsEditModeActive(true) // Persists Edit Mode
      if (isSelectingProductToEdit && products.length === 1) {
        setEditingProduct(products[0])
        setIsSelectingProductToEdit(false)
      }
    } else {
      setPasswordError("Senha incorreta")
    }
  }

  React.useEffect(() => {
    const handleTriggerEdit = () => {
      setIsEditModeActive(prev => {
        if (prev) {
          // If already active, turn it off
          setEditingProduct(null)
          setAddingCoords(null)
          return false
        }
        // Engage edit mode sequence
        setIsSelectingProductToEdit(false)
        setShowPasswordPrompt(true)
        setPasswordInput("")
        setPasswordError("")
        return false // Wait for successful password login
      })
    }

    window.addEventListener("trigger-drivein-edit", handleTriggerEdit)
    return () => window.removeEventListener("trigger-drivein-edit", handleTriggerEdit)
  }, [])

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return
    
    setIsSubmitting(true)
    try {
      const payload = {
        posicao: positionId,
        produto: editingProduct.sku,
        id_palete: editingProduct.id_palete || "",
        quantidade_total: parseFloat(String(editingProduct.quantidade)),
        nivel: parseFloat(String(editingProduct.nivel)),
        profundidade: editingProduct.profundidade,
        qtd_tombada: parseFloat(String(editingProduct.qtd_tombada)),
        qtd_molhado: parseFloat(String(editingProduct.qtd_molhado)),
        observacao: "" // Pode ser adicionado no form se necessário
      }

      const isLocal = typeof window !== "undefined" && 
        (window.location.hostname === "localhost" || 
         window.location.hostname === "127.0.0.1" || 
         window.location.hostname.startsWith("192.168."));

      const API_BASE = isLocal
        ? `http://${window.location.hostname}:8000`
        : "https://avarias-ag-g300.onrender.com"

      const res = await fetch(`${API_BASE}/api/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        throw new Error("Erro ao salvar")
      }

      setEditingProduct(null)
      if (onEditSuccess) {
        onEditSuccess()
      }
    } catch (err) {
      console.error(err)
      alert("Erro ao salvar alterações no Google Sheets")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addingCoords || !addingCoords.sku || addingCoords.qty <= 0) return
    
    setIsSubmitting(true)
    try {
      const payload = {
        posicao: positionId,
        produto: addingCoords.sku,
        quantidade_total: addingCoords.qty,
        nivel: addingCoords.lvl,
        profundidade: addingCoords.d,
        qtd_tombada: addingCoords.tombado,
        qtd_molhado: addingCoords.molhado
      }

      const isLocal = typeof window !== "undefined" && 
        (window.location.hostname === "localhost" || 
         window.location.hostname === "127.0.0.1" || 
         window.location.hostname.startsWith("192.168."));

      const API_BASE = isLocal
        ? `http://${window.location.hostname}:8000`
        : "https://avarias-ag-g300.onrender.com"

      const res = await fetch(`${API_BASE}/api/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error("Erro ao salvar")

      setAddingCoords(null)
      if (onEditSuccess) onEditSuccess()
    } catch (err) {
      console.error(err)
      alert("Erro ao salvar no Google Sheets")
    } finally {
      setIsSubmitting(false)
    }
  }

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
    <div className="w-full flex flex-col gap-4 relative">
      {isEditModeActive && (
        <div className="w-full bg-red-600/90 text-white rounded-xl p-3 flex justify-between items-center shadow-lg shadow-red-600/20 backdrop-blur-sm z-10 sticky top-0 border border-red-500/50">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span className="text-sm font-black uppercase tracking-widest">Modo de Edição Ativo</span>
          </div>
          <button 
            onClick={() => {
              setIsEditModeActive(false)
              setEditingProduct(null)
              setAddingCoords(null)
            }}
            className="text-[10px] font-black uppercase bg-black/20 hover:bg-black/40 px-3 py-1.5 rounded-lg transition-colors border border-black/10"
          >
            Sair da Edição
          </button>
        </div>
      )}
      <div className="w-full flex flex-col lg:flex-row gap-8 pb-4 relative">
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
                                <div className="flex flex-col items-center justify-center w-full h-full gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                  {isEditModeActive ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAddingCoords({ lvl, d, sku: "", qty: 0, molhado: 0, tombado: 0 })
                                      }}
                                      className="h-10 w-10 flex items-center justify-center bg-blue-600 rounded-full text-white shadow-lg hover:scale-110 hover:bg-blue-500 transition-all cursor-pointer opacity-100 ring-4 ring-blue-500/20"
                                      title="Adicionar Novo Palete Aqui"
                                    >
                                      <span className="text-2xl font-light mb-1">+</span>
                                    </button>
                                  ) : (
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest group-hover:opacity-20 text-center px-1">VAZIO</span>
                                  )}
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {Math.round(p.quantidade).toLocaleString('pt-BR')} <span className="text-[8px] opacity-40">UN</span> • {Number(p.paletes).toFixed(2).replace(/\.?0+$/, '')} <span className="text-[8px] opacity-40">PT</span>
                          </span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEditClick(p); }}
                            className="text-[9px] font-black uppercase bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 px-2 py-1 rounded hover:opacity-80 transition-opacity"
                          >
                            Editar
                          </button>
                        </div>
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

      {/* MODAL DE SENHA E EDIÇÃO/ADIÇÃO */}
      {(showPasswordPrompt || isSelectingProductToEdit || editingProduct || addingCoords) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm rounded-3xl">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700">
            {showPasswordPrompt ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">Acesso Restrito</h3>
                <p className="text-xs text-slate-500">Insira a senha de liberação para editar paletes na grade.</p>
                <input 
                  type="password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder="Senha"
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  autoFocus
                />
                {passwordError && <p className="text-xs text-red-500 font-bold">{passwordError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowPasswordPrompt(false); setEditingProduct(null); setIsSelectingProductToEdit(false); }} className="flex-1 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase hover:bg-slate-200 dark:hover:bg-slate-700">Cancelar</button>
                  <button type="submit" className="flex-1 p-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase hover:bg-blue-700 shadow-lg shadow-blue-500/20">Acessar</button>
                </div>
              </form>
            ) : isSelectingProductToEdit && !editingProduct ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase leading-none">Qual Item Editar?</h3>
                  <button type="button" onClick={() => setIsSelectingProductToEdit(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white font-black text-[10px] uppercase">X Fechar</button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {products.map((p, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => { setEditingProduct(p); setIsSelectingProductToEdit(false); }}
                      className="w-full text-left bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-blue-500 transition-colors"
                    >
                      <p className="text-xs font-black text-slate-900 dark:text-white mb-0.5">{p.sku}</p>
                      <p className="text-[10px] text-slate-500 italic line-clamp-1 mb-1">{p.descricao}</p>
                      <div className="flex justify-between items-center text-[10px] font-black uppercase">
                         <span className="text-slate-400">Nív: {p.nivel} • Prof: {p.profundidade}</span>
                         <span className="text-blue-600">{Math.round(p.quantidade)} UN</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : editingProduct ? (
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase leading-none">Editar Vínculo</h3>
                  <button type="button" onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white font-black text-[10px] uppercase">X Fechar</button>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mb-4">
                  <p className="text-xs font-black text-slate-900 dark:text-white uppercase mb-1">{editingProduct.sku}</p>
                  <p className="text-[10px] text-slate-500 italic line-clamp-1">{editingProduct.descricao}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Qtd Fís. Total</label>
                    <input type="number" step="0.01" value={editingProduct.quantidade} onChange={e => setEditingProduct({...editingProduct, quantidade: Number(e.target.value)})} className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Qtd Tombada</label>
                    <input type="number" step="0.01" value={editingProduct.qtd_tombada} onChange={e => setEditingProduct({...editingProduct, qtd_tombada: Number(e.target.value)})} className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Qtd Molhado</label>
                    <input type="number" step="0.01" value={editingProduct.qtd_molhado} onChange={e => setEditingProduct({...editingProduct, qtd_molhado: Number(e.target.value)})} className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Profundidade</label>
                    <input type="text" value={editingProduct.profundidade} onChange={e => setEditingProduct({...editingProduct, profundidade: e.target.value})} className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Nível (Andar)</label>
                    <input type="number" value={editingProduct.nivel} onChange={e => setEditingProduct({...editingProduct, nivel: Number(e.target.value)})} className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white" />
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full mt-4 p-3 rounded-xl bg-orange-600 text-white font-black text-xs uppercase hover:bg-orange-700 shadow-lg shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center">
                  {isSubmitting ? "Salvando..." : "Salvar na Planilha Online"}
                </button>
              </form>
            ) : addingCoords ? (
              <form onSubmit={handleAddSave} className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase leading-none">Adicionar Palete</h3>
                  <button type="button" onClick={() => setAddingCoords(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white font-black text-[10px] uppercase">X Fechar</button>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50 mb-4 flex justify-between items-center text-blue-800 dark:text-blue-300">
                  <span className="text-xs font-black uppercase">Nível: {addingCoords.lvl}</span>
                  <span className="text-xs font-black uppercase">Profundidade: {addingCoords.d}</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Código/SKU do Produto *</label>
                    <input type="text" value={addingCoords.sku} onChange={e => setAddingCoords({...addingCoords, sku: e.target.value.toUpperCase()})} className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white" placeholder="Ex: G12345" required autoFocus />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Qtd Fís. Total *</label>
                    <input type="number" step="0.01" value={addingCoords.qty || ""} onChange={e => setAddingCoords({...addingCoords, qty: Number(e.target.value)})} className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Qtd Tombada</label>
                      <input type="number" step="0.01" value={addingCoords.tombado || ""} onChange={e => setAddingCoords({...addingCoords, tombado: Number(e.target.value)})} className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Qtd Molhado</label>
                      <input type="number" step="0.01" value={addingCoords.molhado || ""} onChange={e => setAddingCoords({...addingCoords, molhado: Number(e.target.value)})} className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-900 dark:text-white" />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting || addingCoords.qty <= 0 || !addingCoords.sku} className="w-full mt-4 p-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center">
                  {isSubmitting ? "Adicionando..." : "Salvar na Planilha Online"}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
