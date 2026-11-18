// =============================================================================
// SYSTEM: MÓDULO G300 (ESTOQUE, AVARIAS & DRIVE-IN)
// OWNER:  Workspace Admin G300 (Nível 3)
// SCOPE:  Aba Estoque BA (BA30001V9601)
// PURPOSE: Visualização, pesquisa e conciliação do saldo de estoque BA.
// =============================================================================

"use client"

import React from "react"
import { motion } from "framer-motion"
import { Search, PlusSquare } from "lucide-react"

interface EstoqueBATabProps {
  baRawList: any[]
  effectiveData: any[]
  baSearch: string
  setBaSearch: (val: string) => void
  fmtNum: (n: number) => string
  user: any
  onOpenImportModal: () => void
}

export function EstoqueBATab({
  baRawList,
  effectiveData,
  baSearch,
  setBaSearch,
  fmtNum,
  user,
  onOpenImportModal
}: EstoqueBATabProps) {
  // Computa a lista filtrada e enriquece com descrição da base_codigos
  const filteredBaList = (baRawList || []).map((item: any) => {
    const codigo = String(item.Produto || item.Código || item.Codigo || '').trim().toUpperCase()
    const normCod = codigo.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const prodInfo = (effectiveData || []).find((p: any) => (p.produto || '').trim().toUpperCase() === normCod)
    const descricao = prodInfo?.descricao || item.Descrição || item.Descricao || '-'
    const quantidade = Number(item.Quantidade || item.quantidade || 0)
    return { id: item.id || codigo, codigo, descricao, quantidade }
  }).filter(i => {
    if (!baSearch.trim()) return true
    const s = baSearch.toLowerCase()
    return i.codigo.toLowerCase().includes(s) || i.descricao.toLowerCase().includes(s)
  })

  const totalBaQty = filteredBaList.reduce((acc, curr) => acc + curr.quantidade, 0)

  return (
    <motion.div
      key="estoque-ba-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 overflow-auto space-y-6"
    >
      {/* Header / KPI Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Estoque BA30001V9601</h2>
            <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 dark:bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-800">
              {filteredBaList.length} SKUs
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Base de estoque BA (somada ao A501 no Confronto com o Físico)
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Total Pieces KPI */}
          <div className="px-4 py-2 bg-purple-50 dark:bg-purple-500/10 rounded-2xl border border-purple-100 dark:border-purple-900/30 flex flex-col">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">Total Peças BA</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">{fmtNum(totalBaQty)} un</span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar por código ou descrição..."
              value={baSearch}
              onChange={(e) => setBaSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 w-48 sm:w-64"
            />
          </div>

          {/* Import Button */}
          {user && (
            <button
              onClick={onOpenImportModal}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-semibold shadow-lg shadow-purple-500/20 transition-all active:scale-95"
            >
              <PlusSquare size={14} />
              <span>Importar BA</span>
            </button>
          )}
        </div>
      </div>

      {/* Table of BA Stock */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                <th className="px-5 py-4">Código (SKU)</th>
                <th className="px-5 py-4">Descrição (Sistema de Produtos)</th>
                <th className="px-5 py-4 text-right">Quantidade BA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {filteredBaList.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-slate-400 italic">
                    Nenhum registro encontrado no Estoque BA30001V9601.
                  </td>
                </tr>
              ) : (
                filteredBaList.map((item: any, idx: number) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-blue-600 dark:text-blue-400 tracking-wide">
                      {item.codigo}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                      {item.descricao}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                      {fmtNum(item.quantidade)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}

export default EstoqueBATab
