"use client"

import React, { useState, useMemo, useEffect } from "react"
import { AvariaTipo, hexToStyle } from "@/hooks/useAvariaTipos"
import {
  Fan,
  Box,
  Tag,
  List,
  Search,
  Filter,
  ArrowUpDown,
  Layers,
  PlusSquare,
  Trash2,
  RefreshCw,
  Plus,
  X,
  ChevronLeft,
  Check,
  AlertTriangle,
  ChevronDown,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// Helpers
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ")
}

function formatDeposito(val: number) {
  if (!val) return "Z2"
  return `Z${val}`
}

function renderPosicaoHighlight(posicao: string) {
  const name = (posicao || "").trim()
  if (name.length > 2) {
    const prefix = name.slice(0, -2)
    const suffix = name.slice(-2)
    return (
      <span className="inline-flex items-center font-bold">
        <span className="text-[10px] text-slate-400/60 dark:text-slate-500/60 font-bold tracking-wider">{prefix}</span>
        <span className="text-emerald-500 dark:text-emerald-400 text-sm font-black ml-0.5">{suffix}</span>
      </span>
    )
  }
  return <span>{posicao}</span>
}

function copyToClipboard(text: string, label: string) {
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    const prev = document.title
    document.title = `✓ ${label} copiado!`
    setTimeout(() => { document.title = prev }, 1500)
  }).catch(() => {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.position = "fixed"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.select()
    document.execCommand("copy")
    document.body.removeChild(ta)
  })
}

// Props types
interface PosAvaria {
  id: number
  posicao: string
  codigo: string
  descricao: string
  estoque: number
  quantidade: number
  palete?: string | null
}

interface EditableItem {
  id: number
  codigo: string
  descricao: string
  estoque: number
  quantidade: number
  qtdOriginal: number
  incluido: boolean
}

interface FormacaoPaletesTabProps {
  user: any
  posicoesRaw: PosAvaria[]
  loading: boolean
  fetchPosAvarias: () => Promise<void>
  setShowLoginModal: (show: boolean) => void
  handleClearAllData: () => Promise<void>
  handleDeleteRow: (id: number) => Promise<void>
  handleClearPosition: (posName: string, paleteId?: string) => Promise<void>
  
  // States passed from parent for modal workflows
  selectedPosGroup: any
  setSelectedPosGroup: (group: any) => void
  modalPhase: "view" | "form_palete"
  setModalPhase: (phase: "view" | "form_palete") => void
  editableItems: EditableItem[]
  setEditableItems: React.Dispatch<React.SetStateAction<EditableItem[]>>
  reservaNum: string
  setReservaNum: (v: string) => void
  remessaNum: string
  setRemessaNum: (v: string) => void
  documentoSM: string
  setDocumentoSM: (v: string) => void
  isSavingPalete: boolean
  handleConfirmarFormarPalete: () => Promise<void>

  // Import states and handler
  showImportModal: boolean
  setShowImportModal: (show: boolean) => void
  importText: string
  setImportText: (text: string) => void
  isImporting: boolean
  replaceExisting: boolean
  setReplaceExisting: (val: boolean) => void
  splitByGrade: boolean
  setSplitByGrade: (val: boolean) => void
  gradeSize: number
  setGradeSize: (val: number) => void
  handleImportRelacao: () => Promise<void>
  avariaType: string
  setAvariaType: (v: string) => void
  avariaTipos: AvariaTipo[]
}

export default function FormacaoPaletesTab({
  user,
  posicoesRaw,
  loading,
  fetchPosAvarias,
  setShowLoginModal,
  handleClearAllData,
  handleDeleteRow,
  handleClearPosition,
  selectedPosGroup,
  setSelectedPosGroup,
  modalPhase,
  setModalPhase,
  editableItems,
  setEditableItems,
  reservaNum,
  setReservaNum,
  remessaNum,
  setRemessaNum,
  documentoSM,
  setDocumentoSM,
  isSavingPalete,
  avariaType,    // <--- Nova
  setAvariaType, // <--- Nova
  avariaTipos,
  handleConfirmarFormarPalete,
  showImportModal,
  setShowImportModal,
  importText,
  setImportText,
  isImporting,
  replaceExisting,
  setReplaceExisting,
  splitByGrade,
  setSplitByGrade,
  gradeSize,
  setGradeSize,
  handleImportRelacao,
}: FormacaoPaletesTabProps) {
  // Local States for Filters & Sorting & Views
  const [groupedView, setGroupedView]   = useState(true)
  const [search, setSearch]             = useState("")
  const [skuFilter, setSkuFilter]       = useState<"all" | "1" | "multi" | "3plus">("all")
  const [showSkuFilterMenu, setShowSkuFilterMenu] = useState(false)
  const [sortBy, setSortBy]             = useState<"posicao" | "skus_asc" | "skus_desc" | "pecas_asc" | "pecas_desc">("posicao")
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [isAvariaTypeOpen, setIsAvariaTypeOpen] = useState(false)

  const [isOutras, setIsOutras] = useState(false)
  const [customTypeName, setCustomTypeName] = useState("")

  useEffect(() => {
    const tipoNomes = avariaTipos.map(t => t.nome)
    if (!avariaType) {
      setIsOutras(false)
      setCustomTypeName("")
    } else if (!tipoNomes.includes(avariaType)) {
      setIsOutras(true)
      setCustomTypeName(avariaType)
    } else {
      setIsOutras(false)
    }
  }, [avariaType, avariaTipos])

  // Filtered ungrouped items
  const filteredItems = useMemo(() => {
    let result = posicoesRaw

    if (search) {
      const term = search.toLowerCase()
      result = result.filter(item => 
        item.posicao.toLowerCase().includes(term) ||
        item.codigo.toLowerCase().includes(term) ||
        item.descricao.toLowerCase().includes(term)
      )
    }

    return [...result].sort((a, b) => {
      if (sortBy === "posicao") {
        const aNum = parseInt(a.posicao.replace(/[^\d]/g, ''), 10)
        const bNum = parseInt(b.posicao.replace(/[^\d]/g, ''), 10)
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum
        }
        return a.posicao.localeCompare(b.posicao)
      }
      if (sortBy === "pecas_asc" || sortBy === "skus_asc") {
        return a.quantidade - b.quantidade || a.posicao.localeCompare(b.posicao)
      }
      if (sortBy === "pecas_desc" || sortBy === "skus_desc") {
        return b.quantidade - a.quantidade || a.posicao.localeCompare(b.posicao)
      }
      return a.posicao.localeCompare(b.posicao)
    })
  }, [posicoesRaw, search, sortBy])

  // Group positions dynamically
  const posicoesAgrupadas = useMemo(() => {
    const groups: Record<string, { palete?: string; posicao: string; items: PosAvaria[]; totalQtd: number; uniqueSkus: number }> = {}
    
    posicoesRaw.forEach(item => {
      const groupKey = item.palete ? item.palete : (item.posicao || "SEM POSIÇÃO").trim().toUpperCase()
      const pos = (item.posicao || "SEM POSIÇÃO").trim().toUpperCase()
      if (!groups[groupKey]) {
        groups[groupKey] = { palete: item.palete || undefined, posicao: pos, items: [], totalQtd: 0, uniqueSkus: 0 }
      }
      groups[groupKey].items.push(item)
      groups[groupKey].totalQtd += item.quantidade || 0
    })

    Object.keys(groups).forEach(key => {
      const uniqueSkusSet = new Set(groups[key].items.map(i => i.codigo))
      groups[key].uniqueSkus = uniqueSkusSet.size
    })

    return Object.values(groups)
  }, [posicoesRaw])

  // Filtered groups
  const filteredGroups = useMemo(() => {
    let result = posicoesAgrupadas

    if (skuFilter !== "all") {
      result = result.filter(g => {
        if (skuFilter === "1") return g.uniqueSkus === 1
        if (skuFilter === "multi") return g.uniqueSkus > 1
        if (skuFilter === "3plus") return g.uniqueSkus >= 3
        return true
      })
    }

    if (search) {
      const term = search.toLowerCase()
      result = result.filter(g => {
        const matchPos = g.posicao.toLowerCase().includes(term)
        const matchItem = g.items.some(item => 
          item.codigo.toLowerCase().includes(term) || 
          item.descricao.toLowerCase().includes(term)
        )
        return matchPos || matchItem
      })
    }

    return [...result].sort((a, b) => {
      if (sortBy === "posicao") {
        const aNum = parseInt(a.posicao.replace(/[^\d]/g, ''), 10)
        const bNum = parseInt(b.posicao.replace(/[^\d]/g, ''), 10)
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum
        }
        return a.posicao.localeCompare(b.posicao)
      }
      if (sortBy === "skus_asc") {
        return a.uniqueSkus - b.uniqueSkus || a.posicao.localeCompare(b.posicao)
      }
      if (sortBy === "skus_desc") {
        return b.uniqueSkus - a.uniqueSkus || a.posicao.localeCompare(b.posicao)
      }
      if (sortBy === "pecas_asc") {
        return a.totalQtd - b.totalQtd || a.posicao.localeCompare(b.posicao)
      }
      if (sortBy === "pecas_desc") {
        return b.totalQtd - a.totalQtd || a.posicao.localeCompare(b.posicao)
      }
      return 0
    })
  }, [posicoesAgrupadas, search, skuFilter, sortBy])

  // Metrics
  const totalPaletesCount = posicoesAgrupadas.length
  const totalPecasCount   = posicoesRaw.reduce((acc, c) => acc + (c.quantidade || 0), 0)
  const uniqueSkusCount   = new Set(posicoesRaw.map(r => r.codigo)).size
  const totalItensCount   = posicoesRaw.length

  return (
    <>
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-500/30">
            <Fan size={22} className="text-white animate-[spin_12s_linear_infinite]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Formação de Paletes
            </h1>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Portal BR · MKBR E G300
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            onClick={fetchPosAvarias}
            disabled={loading}
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors border border-slate-200 dark:border-slate-700 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Atualizar dados"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => {
              if (!user) {
                setShowLoginModal(true)
              } else {
                setShowImportModal(true)
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition-all active:scale-95 cursor-pointer"
          >
            <PlusSquare size={16} />
            Importar Relação
          </button>
          
          {user && posicoesRaw.length > 0 && (
            <button
              onClick={handleClearAllData}
              className="flex items-center justify-center h-10 w-10 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors border border-rose-100 dark:border-rose-500/10 active:scale-95 cursor-pointer"
              title="Excluir Todos os Dados"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Paletes (Posições)", value: totalPaletesCount, icon: Box,          color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800" },
          { label: "Peças em Avaria",    value: totalPecasCount,   icon: Fan,          color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
          { label: "SKUs Únicos",        value: uniqueSkusCount,   icon: Tag,          color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10" },
          { label: "Itens Cadastrados",  value: totalItensCount,   icon: List,         color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-500/10" },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-sm"
          >
            <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl mb-3", m.bg)}>
              <m.icon size={18} className={m.color} />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? "..." : m.value.toLocaleString("pt-BR")}</p>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{m.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Controls Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-6 py-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar Posição, SKU, descrição..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 h-10 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition"
            />
          </div>

          {/* SKU Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSkuFilterMenu(v => !v)}
              className={cn(
                "flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer",
                skuFilter !== "all"
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-emerald-300"
              )}
            >
              <Filter size={14} />
              {skuFilter === "all" ? "Todos os SKUs" :
               skuFilter === "1" ? "1 SKU" :
               skuFilter === "multi" ? "Multi-SKU (>1)" : "3+ SKUs"}
            </button>
            
            <AnimatePresence>
              {showSkuFilterMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSkuFilterMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl z-20 overflow-hidden py-1"
                  >
                    {[
                      { value: "all", label: "Todos os SKUs" },
                      { value: "1", label: "Apenas 1 SKU" },
                      { value: "multi", label: "Multi-SKU (> 1 SKU)" },
                      { value: "3plus", label: "3 ou mais SKUs" }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setSkuFilter(opt.value as any); setShowSkuFilterMenu(false) }}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer",
                          skuFilter === opt.value
                            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Order/Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(v => !v)}
              className={cn(
                "flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer",
                sortBy !== "posicao"
              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
              : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-emerald-300"
              )}
            >
              <ArrowUpDown size={14} />
              {sortBy === "posicao" ? "Ordenar por Posição" :
               sortBy === "skus_asc" ? "Qtd SKUs (Crescente)" :
               sortBy === "skus_desc" ? "Qtd SKUs (Decrescente)" :
               sortBy === "pecas_asc" ? "Total Peças (Crescente)" : "Total Peças (Decrescente)"}
            </button>
            
            <AnimatePresence>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl z-20 overflow-hidden py-1"
                  >
                    {[
                      { value: "posicao", label: "Posição (A-Z)" },
                      { value: "skus_desc", label: "Qtd SKUs (Maior → Menor)" },
                      { value: "skus_asc", label: "Qtd SKUs (Menor → Maior)" },
                      { value: "pecas_desc", label: "Peças Totais (Maior → Menor)" },
                      { value: "pecas_asc", label: "Peças Totais (Menor → Maior)" }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value as any); setShowSortMenu(false) }}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer",
                          sortBy === opt.value
                            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* View switcher: Grouped (Agrupado) vs Individual */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-900/60 p-0.5 border border-slate-200/60 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setGroupedView(true)}
              className={cn(
                "px-3 h-8 flex items-center rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer",
                groupedView
                  ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
              )}
            >
              Agrupado
            </button>
            <button
              type="button"
              onClick={() => setGroupedView(false)}
              className={cn(
                "px-3 h-8 flex items-center rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer",
                !groupedView
                  ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
              )}
            >
              Individual
            </button>
          </div>

          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2 whitespace-nowrap">
            {groupedView 
              ? `${filteredGroups.length} ${filteredGroups.length === 1 ? "palete" : "paletes"}`
              : `${filteredItems.length} ${filteredItems.length === 1 ? "item" : "itens"}`
            }
          </span>
        </div>
      </div>

      {/* Loading / Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="animate-spin text-emerald-500" size={32} />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Carregando Informações...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key="parking"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="select-none"
          >
            {(groupedView ? filteredGroups.length : filteredItems.length) === 0 ? (
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <Layers size={22} />
                  </div>
                  <p className="text-sm font-bold text-slate-400">
                    {groupedView ? "Nenhum palete cadastrado" : "Nenhum item cadastrado"}
                  </p>
                </div>
              </div>
                        ) : groupedView ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-4">
                {filteredGroups.map((g) => (
                  <motion.div
                    key={g.palete || g.posicao}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedPosGroup(g)}
                    className="group cursor-pointer relative aspect-square w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 flex flex-col items-center justify-between transition-all duration-200 hover:scale-[1.04]"
                  >
                    {/* MIX badge if multi-SKU */}
                    {g.uniqueSkus > 1 && (
                      <span className="absolute top-1.5 right-1.5 text-[6px] font-black tracking-wider uppercase bg-amber-400 text-slate-900 px-1 py-0.5 rounded-xs leading-none shadow-xs z-10">
                        MIX
                      </span>
                    )}

                    {/* 3D Box & Pallet Graphic */}
                    <div className="flex-1 flex flex-col items-center justify-center w-full mt-1">
                      <div className="relative group-hover:-translate-y-0.5 transition-transform duration-300 flex flex-col items-center">
                        {/* Box */}
                        <span className="text-[44px] drop-shadow-md inline-block relative z-10 leading-none select-none">📦</span>
                        {/* Subdued Pallet */}
                        <div className="w-14 h-[6px] bg-[#8B5A2B] rounded-sm mx-auto flex justify-around items-end pt-[2px] relative z-0 -mt-[2px] shadow-sm">
                          <div className="w-[6px] h-[4px] bg-[#4A2E12] rounded-t-[1px]"></div>
                          <div className="w-[6px] h-[4px] bg-[#4A2E12] rounded-t-[1px]"></div>
                          <div className="w-[6px] h-[4px] bg-[#4A2E12] rounded-t-[1px]"></div>
                        </div>
                      </div>
                    </div>

                    {/* The Dark Information Pill */}
                    <div className="w-[88%] bg-[#0B1120] rounded-lg py-1.5 flex flex-col items-center justify-center mb-1 border border-white/5 shadow-inner">
                      <span className="text-[11px] leading-tight font-bold text-white tracking-widest">{g.posicao}</span>
                      <span className="text-[9px] leading-tight text-slate-400 font-medium">
                        {g.totalQtd} {g.totalQtd === 1 ? 'peça' : 'peças'}
                      </span>
                    </div>

                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-4">
                {filteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedPosGroup({
                      posicao: item.posicao,
                      items: [item],
                      totalQtd: item.quantidade,
                      uniqueSkus: 1
                    })}
                    className="group cursor-pointer relative aspect-square w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 flex flex-col items-center justify-between transition-all duration-200 hover:scale-[1.04]"
                  >
                    {/* 3D Box & Pallet Graphic */}
                    <div className="flex-1 flex flex-col items-center justify-center w-full mt-1">
                      <div className="relative group-hover:-translate-y-0.5 transition-transform duration-300 flex flex-col items-center">
                        {/* Box */}
                        <span className="text-[44px] drop-shadow-md inline-block relative z-10 leading-none select-none">📦</span>
                        {/* Subdued Pallet */}
                        <div className="w-14 h-[6px] bg-[#8B5A2B] rounded-sm mx-auto flex justify-around items-end pt-[2px] relative z-0 -mt-[2px] shadow-sm">
                          <div className="w-[6px] h-[4px] bg-[#4A2E12] rounded-t-[1px]"></div>
                          <div className="w-[6px] h-[4px] bg-[#4A2E12] rounded-t-[1px]"></div>
                          <div className="w-[6px] h-[4px] bg-[#4A2E12] rounded-t-[1px]"></div>
                        </div>
                      </div>
                    </div>

                    {/* The Dark Information Pill */}
                    <div className="w-[88%] bg-[#0B1120] rounded-lg py-1.5 flex flex-col items-center justify-center mb-1 border border-white/5 shadow-inner">
                      <span className="text-[11px] leading-tight font-bold text-white tracking-widest">{item.posicao}</span>
                      <span className="text-[9px] leading-tight text-slate-400 font-medium">
                        {item.quantidade} {item.quantidade === 1 ? 'peça' : 'peças'}
                      </span>
                    </div>

                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ─── Detailed Position Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {selectedPosGroup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPosGroup(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              className="relative w-full max-w-3xl rounded-[28px] bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                <div className="flex items-center gap-3">
                  {modalPhase === "form_palete" && (
                    <button
                      onClick={() => setModalPhase("view")}
                      className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
                      title="Voltar para detalhes"
                    >
                      <ChevronLeft size={20} />
                    </button>
                  )}
                  <div>
                    <h3 className="text-lg font-bold tracking-tight flex items-center gap-3">
                      {renderPosicaoHighlight(selectedPosGroup.posicao)}
                      <span className={cn(
                        "text-[10px] font-bold px-2.5 py-1 rounded-xl uppercase tracking-wider",
                        modalPhase === "form_palete" 
                          ? "text-emerald-500 bg-emerald-500/10" 
                          : "text-amber-500 bg-amber-500/10"
                      )}>
                        {modalPhase === "form_palete" ? "Formando Palete" : "Palete Ativo"}
                      </span>
                    </h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                      {selectedPosGroup.uniqueSkus} SKUs Únicos · {selectedPosGroup.totalQtd} Peças Totais
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPosGroup(null)}
                  className="h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {modalPhase === "view" ? (
                <>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-6">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">SKU Código</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Depósito</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Qtd</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center pl-8">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                        {selectedPosGroup.items.map((item: PosAvaria) => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">{item.codigo}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-tight max-w-[280px] truncate" title={item.descricao}>{item.descricao}</p>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className="text-xs font-bold text-slate-400">{formatDeposito(item.estoque)}</span>
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">{item.quantidade}</span>
                            </td>
                            <td className="px-4 py-3.5 text-center pl-8">
                              <div className="inline-flex justify-center">
                                <button
                                  disabled={!user}
                                  onClick={() => handleDeleteRow(item.id)}
                                  className={cn(
                                    "h-8 w-8 rounded-lg inline-flex items-center justify-center transition-colors border",
                                    user
                                      ? "bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 border-transparent cursor-pointer"
                                      : "bg-slate-50 dark:bg-slate-800 text-slate-300 border-transparent cursor-not-allowed"
                                  )}
                                  title={user ? "Remover Item" : "Necessário Login"}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-5 mt-auto">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalPhase("form_palete")}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all bg-emerald-600 hover:bg-emerald-500 text-white border-transparent active:scale-[0.98] shadow-lg shadow-emerald-500/20 cursor-pointer"
                      >
                        <Plus size={15} />
                        Formar Palete
                      </button>
                      
                      {user && (
                        <button
                          type="button"
                          onClick={() => handleClearPosition(selectedPosGroup.posicao, selectedPosGroup.palete)}
                          className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-450 hover:bg-rose-100 dark:hover:bg-rose-500/20 cursor-pointer"
                          title="Descarregar Posição / Palete"
                        >
                          <Trash2 size={15} />
                          Descarregar Posição
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedPosGroup(null)}
                      className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Fechar Painel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                    {/* SAP Copy Pills */}
                    <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cópias para SAP MB21</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Clique para copiar e colar no SAP.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const active = editableItems.filter(it => it.incluido)
                            if (active.length === 0) return alert("Nenhum item incluído.")
                            const text = active.map(it => it.codigo).join("\n")
                            copyToClipboard(text, "SKUs")
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-500 text-slate-600 dark:text-slate-300 text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
                        >
                          Copiar SKUs
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const active = editableItems.filter(it => it.incluido)
                            if (active.length === 0) return alert("Nenhum item incluído.")
                            const text = active.map(it => it.quantidade).join("\n")
                            copyToClipboard(text, "Quantidades")
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-500 text-slate-600 dark:text-slate-300 text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
                        >
                          Copiar Qtds
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const active = editableItems.filter(it => it.incluido)
                            if (active.length === 0) return alert("Nenhum item incluído.")
                            const text = active.map(() => "L100").join("\n")
                            copyToClipboard(text, "Depósitos (L100)")
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-500 text-slate-600 dark:text-slate-300 text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
                        >
                          Copiar L100
                        </button>
                      </div>
                    </div>

                    {/* Fully Editable Table */}
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Itens no Palete</h4>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <th className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">SKU</th>
                            <th className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                            <th className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Retirada</th>
                            <th className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right pr-4">Qtd</th>
                            <th className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Incluso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                          {editableItems.map((item) => (
                            <tr 
                              key={item.id} 
                              className={cn(
                                "transition-all", 
                                item.incluido 
                                  ? "hover:bg-slate-50 dark:hover:bg-slate-800/20" 
                                  : "bg-rose-500/[0.03] dark:bg-rose-500/[0.02] opacity-60"
                              )}
                            >
                              <td className="px-3 py-1 whitespace-nowrap">
                                <span className={cn("text-xs font-mono font-bold", item.incluido ? "text-slate-600 dark:text-slate-400" : "text-slate-400 line-through")}>
                                  {item.codigo}
                                </span>
                              </td>
                              <td className="px-3 py-1">
                                <p className={cn("text-xs font-semibold leading-tight max-w-[240px] truncate", item.incluido ? "text-slate-700 dark:text-slate-300" : "text-slate-400 line-through")} title={item.descricao}>
                                  {item.descricao}
                                </p>
                              </td>
                              <td className="px-3 py-1 text-center whitespace-nowrap">
                                <span className={cn("text-xs font-black", item.incluido ? "text-slate-500" : "text-slate-400 line-through")}>L100</span>
                              </td>
                              <td className="px-3 py-1 text-right whitespace-nowrap pr-3">
                                <div className="inline-flex items-center rounded-lg bg-slate-50 dark:bg-slate-950 p-0.5 border border-slate-200 dark:border-slate-800">
                                  <button
                                    type="button"
                                    disabled={!item.incluido || item.quantidade <= 1}
                                    onClick={() => {
                                      setEditableItems(prev => prev.map(it => it.id === item.id ? { ...it, quantidade: Math.max(1, it.quantidade - 1) } : it))
                                    }}
                                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition active:scale-90 cursor-pointer text-xs"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    disabled={!item.incluido}
                                    min="1"
                                    value={item.quantidade}
                                    onChange={(e) => {
                                      const val = Math.max(1, parseInt(e.target.value, 10) || 1)
                                      setEditableItems(prev => prev.map(it => it.id === item.id ? { ...it, quantidade: val } : it))
                                    }}
                                    className="w-10 h-6 text-center bg-transparent border-0 font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={!item.incluido}
                                    onClick={() => {
                                      setEditableItems(prev => prev.map(it => it.id === item.id ? { ...it, quantidade: it.quantidade + 1 } : it))
                                    }}
                                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition active:scale-90 cursor-pointer text-xs"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-1 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-2">
                                  <label className="inline-flex items-center justify-center cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={item.incluido}
                                      onChange={(e) => {
                                        setEditableItems(prev => prev.map(it => it.id === item.id ? { ...it, incluido: e.target.checked } : it))
                                      }}
                                      className="sr-only"
                                    />
                                    <div className={cn(
                                      "w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all duration-200",
                                      item.incluido
                                        ? "bg-emerald-600 border-emerald-600 shadow-md shadow-emerald-500/25 text-white scale-100"
                                        : "bg-transparent border-slate-300 dark:border-slate-850 text-transparent hover:border-emerald-500/50"
                                    )}>
                                      <Check size={14} className="stroke-[3]" />
                                    </div>
                                  </label>
                                  {!item.incluido && (
                                    <span className="text-[8px] font-black text-rose-600 bg-rose-100 dark:bg-rose-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                      TIRAR
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* SAP Fields */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">Documentação SAP</h4>
                        <p className="text-[10px] text-slate-400 mt-1">Remessa e Documento são sempre obrigatórios. Reserva somente se gerada via MB21.</p>
                      </div>

                      {/* COPIE E COLE ESTE BLOCO ABAIXO: */}
<div className="space-y-1.5">
  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
    Tipo de Avaria
    <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">*</span>
  </label>
  <div className="flex flex-wrap gap-2">
    {avariaTipos.map((tipo) => {
      const active = avariaType === tipo.nome
      return (
        <button
          key={tipo.nome}
          type="button"
          onClick={() => {
            setAvariaType(tipo.nome)
          }}
          className={cn(
            "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border",
            active
              ? "text-white shadow-lg"
              : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 border-transparent"
          )}
          style={active ? { backgroundColor: tipo.cor_hex, borderColor: tipo.cor_hex } : {}}
        >
          {tipo.label || tipo.nome}
        </button>
      )
    })}
  </div>
</div>


                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                            Reserva SAP
                            <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 normal-case tracking-normal">(opcional)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: 100028945"
                            value={reservaNum}
                            onChange={(e) => setReservaNum(e.target.value)}
                            className="w-full h-8 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-300 dark:placeholder:text-slate-700"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                            Remessa MIGO
                            <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: 80004523"
                            value={remessaNum}
                            onChange={(e) => setRemessaNum(e.target.value)}
                            className={cn(
                              "w-full h-8 bg-white dark:bg-slate-950 border rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-300 dark:placeholder:text-slate-700",
                              remessaNum.trim() ? "border-slate-200 dark:border-slate-800" : "border-amber-300 dark:border-amber-600/40"
                            )}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                          Documento SAP (pós-SM)
                          <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: 5000948301"
                          value={documentoSM}
                          onChange={(e) => setDocumentoSM(e.target.value)}
                          className={cn(
                            "w-full h-8 bg-white dark:bg-slate-950 border rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-300 dark:placeholder:text-slate-700",
                            documentoSM.trim() ? "border-slate-200 dark:border-slate-800" : "border-amber-300 dark:border-amber-600/40"
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-auto">
                    <button
                      type="button"
                      onClick={() => setModalPhase("view")}
                      className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Voltar
                    </button>

                                    <button
                      type="button"
                      disabled={isSavingPalete || !remessaNum.trim() || !documentoSM.trim() || !avariaType}
                      onClick={handleConfirmarFormarPalete}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg cursor-pointer",
                        isSavingPalete || !remessaNum.trim() || !documentoSM.trim() || !avariaType
                          ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25 active:scale-[0.98]"
                      )}
                    >
                      {isSavingPalete ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Check size={16} className="stroke-[3]" />
                          Confirmar e Finalizar Palete
                        </>
                      )}
                    </button>

                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Import Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              className="relative w-full max-w-2xl rounded-[32px] bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                  <PlusSquare className="text-emerald-500 animate-[pulse_2s_infinite]" size={20} />
                  Importar Relação de Avarias
                </h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col flex-1 min-h-0 gap-6">
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cole os dados da planilha Excel ou Sheets abaixo. Ordem esperada:<br />
                    <span className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest text-[10px]">Posição | Código | Descrição | Depósito | Quantidade</span> (separados por TAB).
                  </p>
                  
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    className="w-full h-64 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-4 text-xs font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-emerald-500 resize-none overflow-y-auto custom-scrollbar"
                    placeholder="Exemplo:&#10;AVA00002	9751-02	VENT 40CM VTX-40P-8P 220V/60Hz PAREDE	Z2	2&#10;AVA00002	2026-02	VENT50CM VTX-50-8P 220V/60Hz SUPER TURBO	Z2	30"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80">
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={replaceExisting}
                          onChange={(e) => setReplaceExisting(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[16px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider group-hover:text-emerald-500 transition-colors">
                        Substituir Dados
                      </span>
                    </label>
                    <p className="text-[9px] font-medium text-slate-400 leading-normal pl-11">
                      {replaceExisting 
                        ? "Limpa todos os dados existentes antes de inserir." 
                        : "Acrescenta os novos dados aos registros atuais."
                      }
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={splitByGrade}
                            onChange={(e) => setSplitByGrade(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[16px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider group-hover:text-emerald-500 transition-colors">
                          Quebrar por Grade
                        </span>
                      </label>
                      
                      {splitByGrade && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Qtd:</span>
                          <input
                            type="number"
                            min={1}
                            value={gradeSize}
                            onChange={(e) => setGradeSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-16 h-7 text-center text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] font-medium text-slate-400 leading-normal pl-11">
                      {splitByGrade 
                        ? `Divide volumes em registros de no máximo ${gradeSize} peças.` 
                        : "Mantém a quantidade inteira em um único registro."
                      }
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/20 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed font-semibold">
                    <span className="font-bold uppercase text-amber-900 dark:text-amber-300">Atenção:</span>{" "}
                    {replaceExisting ? (
                      <>
                        Esta operação irá <span className="underline italic">SOBRESCREVER E LIMPAR</span> toda a tabela de posições de avarias atual no Supabase com o novo conteúdo colado acima.
                      </>
                    ) : (
                      <>
                        Esta operação irá <span className="underline italic">SOMAR E ACRESCENTAR</span> os novos registros colados acima aos dados atuais no Supabase, mantendo o que já existe.
                      </>
                    )}
                  </p>
                </div>

                <button
                  disabled={isImporting || !importText.trim()}
                  onClick={handleImportRelacao}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 cursor-pointer",
                    isImporting
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-wait"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 active:scale-[0.98]"
                  )}
                >
                  {isImporting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Gravando no Banco de Dados...
                    </>
                  ) : "Gravar e Atualizar Portal BR"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
