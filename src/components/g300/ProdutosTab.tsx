// =============================================================================
// SYSTEM: MÓDULO G300 (ESTOQUE, AVARIAS & DRIVE-IN)
// OWNER:  Workspace Admin G300 (Nível 3)
// SCOPE:  Aba de Produtos & Molhados
// PURPOSE: Visualização detalhada e filtros analíticos por SKU e produtos molhados.
// =============================================================================

"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Tag, 
  Droplet, 
  ArrowDownWideNarrow, 
  ArrowDownAZ, 
  Search, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react"
import { cn } from "@/lib/utils"
import { WarehouseTable } from "./WarehouseTable"

interface ProdutosTabProps {
  activeView: string
  setActiveView: (view: any) => void
  sortMode: string
  setSortMode: (mode: any) => void
  tableSort: { key: string; direction: "asc" | "desc" }
  setTableSort: (config: { key: string; direction: "asc" | "desc" }) => void
  handleSort: (key: string) => void
  search: string
  setSearch: (search: string) => void
  columns: any[]
  paginatedData: any[]
  filteredData: any[]
  loading: boolean
  currentPage: number
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>
  totalPages: number
  rowsPerPage: number | "ALL"
  setRowsPerPage: React.Dispatch<React.SetStateAction<number | "ALL">>
  onRowClick: (row: any) => void
}

export function ProdutosTab({
  activeView,
  setActiveView,
  sortMode,
  setSortMode,
  tableSort,
  setTableSort,
  handleSort,
  search,
  setSearch,
  columns,
  paginatedData,
  filteredData,
  loading,
  currentPage,
  setCurrentPage,
  totalPages,
  rowsPerPage,
  setRowsPerPage,
  onRowClick
}: ProdutosTabProps) {
  return (
    <motion.div
      key="produtos-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      {/* View Selection & Filters for Products */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between py-2 transition-colors overflow-hidden">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit max-w-full overflow-x-auto hide-scrollbar border border-slate-200/50 dark:border-slate-800/50 transition-colors">
          <button
            onClick={() => { setActiveView("produtos"); setSortMode("none"); }}
            className={cn(
              "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-semibold transition-all shrink-0 whitespace-nowrap",
              activeView === "produtos" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <Tag size={14} /> Produtos
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/20 rounded-2xl w-fit max-w-full transition-colors">
          <button
            onClick={() => { setActiveView("molhados"); setSortMode("none"); }}
            className={cn(
              "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-semibold transition-all relative group shrink-0 whitespace-nowrap",
              activeView === "molhados" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            )}
          >
            <Droplet size={14} className={cn(activeView === "molhados" ? "fill-white/20" : "fill-blue-500/20 animate-pulse")} /> Molhados
            {activeView !== "molhados" && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl transition-colors border border-slate-200/50 dark:border-slate-800/50">
            <button 
              onClick={() => { setSortMode("qty_desc"); setTableSort({ key: "none", direction: "asc" }); }} 
              className={cn("px-4 py-2.5 text-[10px] font-semibold uppercase rounded-xl transition-all", sortMode === "qty_desc" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
            >
              <ArrowDownWideNarrow size={14} className="inline mr-1" /> Maior Qtd.
            </button>
            <button 
              onClick={() => { setSortMode("alpha_asc"); setTableSort({ key: "none", direction: "asc" }); }} 
              className={cn("px-4 py-2.5 text-[10px] font-semibold uppercase rounded-xl transition-all", sortMode === "alpha_asc" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
            >
              <ArrowDownAZ size={14} className="inline mr-1" /> A-Z
            </button>
          </div>
          <div className="relative w-full md:w-auto group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 transition-colors group-focus-within:text-blue-500" size={16} />
            <input 
              type="text" 
              placeholder="Pesquisar detalhes..." 
              className="w-full md:w-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-11 pr-5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-blue-500 dark:focus:border-blue-900 font-medium shadow-sm transition-colors" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
        </div>
      </div>

      {/* --- MAIN DATA VIEW --- */}
      <AnimatePresence>
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-8"
        >
          <div className="rounded-3xl md:rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl dark:shadow-slate-950/50 overflow-x-auto custom-scrollbar transition-colors">
            <div className="min-w-[800px] lg:min-w-full">
              <WarehouseTable
                columns={columns}
                data={paginatedData}
                delay={0.1}
                onRowClick={onRowClick}
                sortConfig={tableSort}
                onSort={handleSort}
              />
            </div>
          </div>

          {!loading && totalPages >= 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 pb-12 transition-colors">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest order-2 sm:order-1">
                {rowsPerPage === 'ALL' ? `Exibindo todos os ${filteredData.length} itens` : `Página ${currentPage} de ${totalPages}`}
              </span>
              <div className="flex gap-3 order-1 sm:order-2 items-center">
                <button 
                  onClick={() => {
                    setRowsPerPage(prev => prev === 'ALL' ? 10 : 'ALL')
                    setCurrentPage(1)
                  }}
                  className="px-4 py-2 sm:px-3 sm:py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-normal text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  {rowsPerPage === 'ALL' ? "Voltar ao padrão" : "Ver todos"}
                </button>
                {rowsPerPage !== 'ALL' && (
                  <>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="flex-1 sm:flex-none p-4 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm transition-all active:scale-95 transition-colors"><ChevronLeft size={18} /></button>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="flex-1 sm:flex-none p-4 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm transition-all active:scale-95 transition-colors"><ChevronRight size={18} /></button>
                  </>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

export default ProdutosTab
