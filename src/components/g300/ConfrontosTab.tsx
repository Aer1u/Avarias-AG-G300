// =============================================================================
// SYSTEM: MÓDULO G300 (ESTOQUE, AVARIAS & DRIVE-IN)
// OWNER:  Workspace Admin G300 (Nível 3)
// SCOPE:  Aba de Confrontos (Físico x A501, A501 x G501)
// PURPOSE: Conciliação analítica entre saldo físico do armazém, sistema A501,
//          estoque BA e vistoria G501. Inclui modais de ajuste e importação.
// =============================================================================

"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  GitCompare,
  RefreshCw,
  Tag,
  AlertCircle,
  BarChart3,
  Layers,
  Search,
  ArrowDownAZ,
  Settings,
  X,
  PlusSquare,
  AlertTriangle,
  Lock,
  Package,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"

export interface AjusteManal {
  id?: number
  produto: string
  quantidade: number
  motivo: string
  usuario?: string
  timestamp?: Date | string
}

interface ConfrontosTabProps {
  loadingConfrontos: boolean
  confrontosData: any
  errorConfrontos: string | null
  fetchConfrontos: () => Promise<void>
  confrontoType: "fisico_x_a501" | "a501_x_g501"
  setConfrontoType: (t: "fisico_x_a501" | "a501_x_g501") => void
  confrontoFilter: "all" | "divergent" | "match" | "excess" | "missing" | "adjusted"
  setConfrontoFilter: (f: any) => void
  confrontoSearch: string
  setConfrontoSearch: (s: string) => void
  confrontoCurrentPage: number
  setConfrontoCurrentPage: React.Dispatch<React.SetStateAction<number>>
  confrontoItemsPerPage: number
  ajustesConfronto: any[]
  setAjustesConfronto: React.Dispatch<React.SetStateAction<any[]>>
  baRawList: any[]
  retrabalhoConfrontoData: { mapeamentoMap: Map<string, number>; reservasMap: Map<string, number> }
  effectiveData: any[]
  fmtNum: (n: number) => string
  user: any
  setShowLoginModal: (open: boolean) => void
  modalAjusteOpen: boolean
  setModalAjusteOpen: (open: boolean) => void
  modalImportA501Open: boolean
  setModalImportA501Open: (open: boolean) => void
  importTextA501: string
  setImportTextA501: (t: string) => void
  isImportingA501: boolean
  setIsImportingA501: (i: boolean) => void
  modalImportG501Open: boolean
  setModalImportG501Open: (open: boolean) => void
  importTextG501: string
  setImportTextG501: (t: string) => void
  isImportingG501: boolean
  setIsImportingG501: (i: boolean) => void
  selectedConfrontoItem: any
  setSelectedConfrontoItem: (item: any) => void
}

export function ConfrontosTab({
  loadingConfrontos,
  confrontosData,
  errorConfrontos,
  fetchConfrontos,
  confrontoType,
  setConfrontoType,
  confrontoFilter,
  setConfrontoFilter,
  confrontoSearch,
  setConfrontoSearch,
  confrontoCurrentPage,
  setConfrontoCurrentPage,
  confrontoItemsPerPage,
  ajustesConfronto,
  setAjustesConfronto,
  baRawList,
  retrabalhoConfrontoData,
  effectiveData,
  fmtNum,
  user,
  setShowLoginModal,
  modalAjusteOpen,
  setModalAjusteOpen,
  modalImportA501Open,
  setModalImportA501Open,
  importTextA501,
  setImportTextA501,
  isImportingA501,
  setIsImportingA501,
  modalImportG501Open,
  setModalImportG501Open,
  importTextG501,
  setImportTextG501,
  isImportingG501,
  setIsImportingG501,
  selectedConfrontoItem,
  setSelectedConfrontoItem
}: ConfrontosTabProps) {
  const [confrontoSortDir, setConfrontoSortDir] = useState<"asc" | "desc">("asc")

  const normalizeSku = (s: string) =>
    String(s || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  // Cálculo unificado do confronto
  const getConfrontoCalc = (c: any) => {
    const sku = normalizeSku(c.produto)
    const isFis = confrontoType === "fisico_x_a501"
    const ajusteSoma = isFis
      ? ajustesConfronto.filter((a) => normalizeSku(a.produto) === sku).reduce((s, a) => s + a.quantidade, 0)
      : 0
    const mapRetrab = isFis ? (retrabalhoConfrontoData.mapeamentoMap.get(sku) || 0) : 0
    const resAberta = isFis ? (retrabalhoConfrontoData.reservasMap.get(sku) || 0) : 0
    const qtdFisica = isFis ? Math.max(0, c.qtd_fisica - mapRetrab) + ajusteSoma : c.qtd_fisica
    const qtdSistema = isFis ? Math.max(0, c.qtd_sistema - resAberta) : c.qtd_sistema
    return { ajusteSoma, mapRetrab, resAberta, qtdFisica, qtdSistema, diferenca: qtdFisica - qtdSistema }
  }

  return (
    <>
      <motion.div
        key="confrontos-content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="space-y-6"
      >
        {loadingConfrontos && !confrontosData ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-6">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="h-16 w-16 rounded-full border-2 border-blue-500/20 border-t-blue-500"
              />
              <motion.div
                initial={{ opacity: 0.5, scale: 0.8 }}
                animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <GitCompare size={24} className="text-blue-500" />
              </motion.div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-[0.3em] animate-pulse">Sincronizando Confrontos</p>
              <p className="text-[10px] text-slate-500 mt-2 font-medium">Isso pode levar alguns segundos dependendo da base...</p>
            </div>
          </div>
        ) : errorConfrontos ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
            <div className="h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500">
              <RefreshCw size={28} />
            </div>
            <div className="text-center">
              <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-tight">{errorConfrontos}</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-[280px]">Verifique sua conexão com o servidor ou tente novamente em alguns instantes.</p>
            </div>
            <button
              onClick={() => fetchConfrontos()}
              className="group flex items-center gap-3 px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-semibold text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200 dark:shadow-none"
            >
              <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
              Tentar Novamente
            </button>
          </div>
        ) : confrontosData ? (
          <div className={cn("transition-opacity duration-300 relative", loadingConfrontos && "opacity-50 pointer-events-none")}>
            <AnimatePresence mode="wait">
              <motion.div
                key={confrontoType}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Painel Premium Minimalista */}
                {(() => {
                  const divergenciasAjustadas = confrontosData.dados.filter(
                    (c: any) => Math.abs(getConfrontoCalc(c).diferenca) > 0.001
                  ).length
                  const total = confrontosData.total_produtos
                  const acuracidade = Math.round(((total - divergenciasAjustadas) / Math.max(1, total)) * 100)

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="border border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Tag className="text-slate-500" size={14} />
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">PRODUTOS ANALISADOS</p>
                        </div>
                        <p className="text-3xl font-light text-slate-900 dark:text-slate-100">{total}</p>
                      </div>
                      <div className="border border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="text-slate-500" size={14} />
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">DIVERGÊNCIAS ENCONTRADAS</p>
                        </div>
                        <p className="text-3xl font-light text-slate-900 dark:text-slate-100">{divergenciasAjustadas}</p>
                      </div>
                      <div className="border border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="text-slate-500" size={14} />
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">ÍNDICE DE ACURACIDADE</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <p className="text-3xl font-light text-slate-900 dark:text-slate-100">{acuracidade}%</p>
                          <div className="w-full bg-slate-200/80 dark:bg-slate-800/80 rounded-full h-1 mt-1 overflow-hidden flex">
                            <div className="bg-emerald-500 h-1 rounded-full transition-all duration-1000" style={{ width: `${acuracidade}%` }}></div>
                          </div>
                        </div>
                      </div>
                      <div className="border border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Layers className="text-slate-500" size={14} />
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">SALDO LÍQUIDO DE PEÇAS</p>
                        </div>
                        <div className="flex items-baseline gap-2">
                          {(() => {
                            const fisico = confrontosData.dados.reduce((acc: number, item: any) => acc + getConfrontoCalc(item).qtdFisica, 0)
                            const sistema = confrontosData.dados.reduce((acc: number, item: any) => acc + getConfrontoCalc(item).qtdSistema, 0)
                            const net = fisico - sistema
                            return (
                              <>
                                <p className={cn("text-3xl font-light", net > 0 ? "text-emerald-600 dark:text-emerald-400" : net < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100")}>
                                  {net > 0 ? "+" : ""}{fmtNum(net)}
                                </p>
                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                                  ({confrontoType === "fisico_x_a501" ? "FÍS." : "A501"} {fmtNum(fisico)} / {confrontoType === "fisico_x_a501" ? "SIST." : "G501"} {fmtNum(sistema)})
                                </p>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Filtros e Busca */}
                {(() => {
                  const baMap = new Map<string, number>()
                  ;(baRawList || []).forEach((item: any) => {
                    const rawSku = String(item.Produto || item.Código || item.Codigo || '').trim().toUpperCase()
                    const sku = normalizeSku(rawSku)
                    if (sku) {
                      baMap.set(sku, (baMap.get(sku) || 0) + Number(item.Quantidade || item.quantidade || 0))
                    }
                  })

                  const counts = confrontosData.dados.reduce((acc: any, c: any) => {
                    const k = getConfrontoCalc(c)
                    const baQty = confrontoType === "fisico_x_a501" ? (baMap.get(normalizeSku(c.produto)) || 0) : 0
                    const teveAjuste = (k.ajusteSoma !== 0) || (baQty > 0) || (k.mapRetrab > 0) || (k.resAberta > 0)
                    const diferenca = k.diferenca

                    acc.all++
                    if (teveAjuste) acc.adjusted++
                    if (diferenca === 0) {
                      acc.match++
                    } else {
                      acc.divergent++
                      if (diferenca > 0) acc.excess++
                      else acc.missing++
                    }
                    return acc
                  }, { all: 0, divergent: 0, excess: 0, missing: 0, match: 0, adjusted: 0 })

                  return (
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                      <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-[1.25rem] shadow-inner backdrop-blur-sm">
                        <button
                          onClick={() => setConfrontoFilter("all")}
                          className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "all" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                        >
                          Tudo <span className="opacity-70 text-[10px] font-semibold bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.all}</span>
                        </button>
                        <button
                          onClick={() => setConfrontoFilter("divergent")}
                          className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "divergent" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                        >
                          Divergentes <span className="opacity-70 text-[10px] font-semibold bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.divergent}</span>
                        </button>
                        <button
                          onClick={() => setConfrontoFilter("excess")}
                          className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "excess" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                        >
                          Sobras <span className="opacity-70 text-[10px] font-semibold bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.excess}</span>
                        </button>
                        <button
                          onClick={() => setConfrontoFilter("missing")}
                          className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "missing" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                        >
                          Faltas <span className="opacity-70 text-[10px] font-semibold bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.missing}</span>
                        </button>
                        <button
                          onClick={() => setConfrontoFilter("match")}
                          className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "match" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                        >
                          Batendo <span className="opacity-70 text-[10px] font-semibold bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.match}</span>
                        </button>
                        {confrontoType === "fisico_x_a501" && (
                          <button
                            onClick={() => setConfrontoFilter("adjusted")}
                            className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "adjusted" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30 font-semibold")}
                          >
                            Ajustados <span className="opacity-70 text-[10px] font-semibold bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md">{counts.adjusted}</span>
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                          <input
                            type="text"
                            placeholder="Buscar produto ou desc..."
                            value={confrontoSearch}
                            onChange={(e) => setConfrontoSearch(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors"
                          />
                        </div>
                        <button
                          onClick={() => setConfrontoSortDir(d => d === "asc" ? "desc" : "asc")}
                          className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Ordenar por Diferença"
                        >
                          <ArrowDownAZ size={14} className={cn("transition-transform duration-300", confrontoSortDir === "desc" && "rotate-180")} />
                          <span className="hidden sm:inline">Ordenar</span>
                        </button>
                        <button
                          onClick={() => setModalAjusteOpen(true)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm bg-blue-600/10 border border-blue-500/30 text-blue-400 hover:bg-blue-600/20 hover:border-blue-500/50"
                          )}
                          title="Ajuste Manual de Divergências"
                        >
                          <Settings size={14} className={ajustesConfronto.length > 0 ? "animate-spin-slow" : ""} />
                          <span className="hidden sm:inline">
                            Ajustes {ajustesConfronto.length > 0 ? `(${ajustesConfronto.length})` : ''}
                          </span>
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {/* Tabela de Confrontos */}
                <div className="border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm rounded-2xl overflow-hidden shadow-xl">
                  <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-slate-100/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest transition-colors">Código</th>
                        <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest transition-colors">Descrição</th>
                        <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest text-right transition-colors">{confrontoType === "fisico_x_a501" ? "Física" : "Sist. A501"}</th>
                        <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest text-right transition-colors">{confrontoType === "fisico_x_a501" ? "Sistema" : "Sist. G501"}</th>
                        <th className="px-5 py-4 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest text-right transition-colors">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
                      {(() => {
                        const baMapLocal = new Map<string, number>()
                        ;(baRawList || []).forEach((item: any) => {
                          const rawSku = String(item.Produto || item.Código || item.Codigo || '').trim().toUpperCase()
                          const sku = normalizeSku(rawSku)
                          if (sku) baMapLocal.set(sku, (baMapLocal.get(sku) || 0) + Number(item.Quantidade || item.quantidade || 0))
                        })
                        const dadosAjustados = confrontosData.dados.map((c: any) => {
                          const skuNormal = normalizeSku(c.produto)
                          const itemAdjustments = confrontoType === "fisico_x_a501" ? ajustesConfronto.filter((a: any) => normalizeSku(a.produto) === skuNormal) : []
                          const kc = getConfrontoCalc(c)
                          const ajusteSoma = kc.ajusteSoma
                          const diferencaAjustada = kc.diferenca
                          const baQty = confrontoType === "fisico_x_a501" ? (baMapLocal.get(skuNormal) || 0) : 0
                          const teveAjusteManual = ajusteSoma !== 0
                          const teveAjusteBA = baQty > 0
                          const teveAjuste = teveAjusteManual || teveAjusteBA
                          let motivo = itemAdjustments.map((a: any) => a.motivo).join('; ')
                          if (teveAjusteBA) motivo = motivo ? `${motivo}; BA: ${baQty} un.` : `Estoque BA: ${baQty} un.`
                          return {
                            ...c,
                            qtd_fisica_original: c.qtd_fisica,
                            qtd_fisica: kc.qtdFisica,
                            qtd_sistema_original: c.qtd_sistema,
                            qtd_sistema: kc.qtdSistema,
                            qtd_retrabalho: kc.mapRetrab,
                            reserva_aberta: kc.resAberta,
                            diferenca: diferencaAjustada,
                            teve_ajuste: teveAjuste,
                            filtro_ajustado: teveAjuste || kc.mapRetrab > 0 || kc.resAberta > 0,
                            teve_ajuste_ba: teveAjusteBA,
                            teve_ajuste_manual: teveAjusteManual,
                            ajuste_quantidade: ajusteSoma,
                            motivo_ajuste: motivo
                          }
                        })

                        const filtered = dadosAjustados.filter((c: any) => {
                          if (confrontoFilter === "divergent" && c.diferenca === 0) return false
                          if (confrontoFilter === "match" && c.diferenca !== 0) return false
                          if (confrontoFilter === "excess" && c.diferenca <= 0) return false
                          if (confrontoFilter === "missing" && c.diferenca >= 0) return false
                          if (confrontoFilter === "adjusted" && !c.filtro_ajustado) return false

                          if (confrontoSearch) {
                            const term = confrontoSearch.toLowerCase()
                            const p = String(c.produto || "").toLowerCase()
                            const d = String(c.descricao || "").toLowerCase()
                            if (!p.includes(term) && !d.includes(term)) return false
                          }
                          return true
                        })

                        filtered.sort((a: any, b: any) => {
                          if (confrontoSortDir === "asc") return a.diferenca - b.diferenca
                          return b.diferenca - a.diferenca
                        })

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={5} className="px-5 py-16 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Nenhum registro encontrado.
                              </td>
                            </tr>
                          )
                        }

                        const startIndex = (confrontoCurrentPage - 1) * confrontoItemsPerPage
                        const endIndex = startIndex + confrontoItemsPerPage
                        const paginatedFiltered = filtered.slice(startIndex, endIndex)

                        return paginatedFiltered.map((c: any, i: number) => (
                          <tr key={i} onClick={() => setSelectedConfrontoItem(c)} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all hover:scale-[1.01] hover:shadow-lg group cursor-pointer relative z-0 hover:z-10">
                            <td className="px-5 py-3.5">
                              <span className="text-sm font-normal text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{c.produto}</span>
                              {c.teve_ajuste_manual && (
                                <span className="ml-2 inline-flex border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[8px] font-bold px-1.5 py-0.5 rounded-md align-middle shadow-sm" title={c.motivo_ajuste}>
                                  AJUSTADO
                                </span>
                              )}
                              {c.qtd_retrabalho > 0 && <span className="ml-1 inline-flex align-middle text-[8px] bg-sky-500/10 text-sky-500 border border-sky-500/30 px-1 py-0.5 rounded">-{c.qtd_retrabalho} RET</span>}
                              {c.reserva_aberta > 0 && <span className="ml-1 inline-flex align-middle text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/30 px-1 py-0.5 rounded">-{c.reserva_aberta} RES</span>}
                              {c.teve_ajuste_ba && (
                                <span className="ml-1 inline-flex border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[8px] font-bold px-1.5 py-0.5 rounded-md align-middle shadow-sm" title={c.motivo_ajuste}>
                                  BA
                                </span>
                              )}
                              {(() => {
                                const skuNorm = normalizeSku(c.produto)
                                const resAberta = retrabalhoConfrontoData.reservasMap.get(skuNorm) || 0
                                const mapRetrab = retrabalhoConfrontoData.mapeamentoMap.get(skuNorm) || 0
                                const temRetrab = resAberta > 0 || mapRetrab > 0
                                if (!temRetrab) return null
                                const bateu = resAberta === mapRetrab
                                return bateu ? (
                                  <span className="ml-1 inline-flex border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold px-1.5 py-0.5 rounded-md align-middle shadow-sm" title={`Reservas Abertas (${resAberta}) = Retrabalho Mapeamento (${mapRetrab})`}>
                                    RETRABALHO OK
                                  </span>
                                ) : (
                                  <span className="ml-1 inline-flex border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[8px] font-bold px-1.5 py-0.5 rounded-md align-middle shadow-sm" title={`Divergência: Reservas Abertas: ${resAberta} un. | Mapeamento Retrabalho: ${mapRetrab} un.`}>
                                    ⚠️ RETRABALHO ({resAberta} vs {mapRetrab})
                                  </span>
                                )
                              })()}
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="text-xs font-normal text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors truncate max-w-[250px]">{c.descricao}</p>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex flex-col items-end">
                                <span className={cn("text-sm font-normal", (c.teve_ajuste || c.qtd_retrabalho > 0) ? "text-blue-600 dark:text-blue-300 font-bold" : "text-slate-600 dark:text-slate-300")}>{fmtNum(c.qtd_fisica)}</span>
                                {(c.teve_ajuste || c.qtd_retrabalho > 0) && (
                                  <span className="text-[9px] text-slate-400 dark:text-slate-500 line-through">
                                    Orig: {fmtNum(c.qtd_fisica_original)}
                                    {c.qtd_retrabalho > 0 && ` (-${fmtNum(c.qtd_retrabalho)} ret)`}
                                    {c.teve_ajuste_manual && ` (${c.ajuste_quantidade > 0 ? "+" : ""}${fmtNum(c.ajuste_quantidade)} aj)`}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex flex-col items-end">
                                <span className={cn("text-sm font-normal", c.reserva_aberta > 0 ? "text-amber-500 dark:text-amber-400 font-bold" : "text-slate-600 dark:text-slate-300")}>{fmtNum(c.qtd_sistema)}</span>
                                {c.reserva_aberta > 0 && <span className="text-[9px] text-amber-500">Orig: {fmtNum(c.qtd_sistema_original)} (-{fmtNum(c.reserva_aberta)})</span>}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              {c.diferenca === 0 ? (
                                <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">Bateu</span>
                              ) : (
                                <span className={cn("text-xs font-bold", c.diferenca > 0 ? "text-amber-500 dark:text-amber-400" : "text-rose-600 dark:text-rose-400")}>
                                  {c.diferenca > 0 ? "+" : ""}{c.diferenca} {c.diferenca > 0 ? "(Positivado)" : "(Negativo)"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Paginação de Confrontos */}
                {(() => {
                  const baMapLocal2 = new Map<string, number>()
                  ;(baRawList || []).forEach((item: any) => {
                    const rawSku = String(item.Produto || item.Código || item.Codigo || '').trim().toUpperCase()
                    const sku = normalizeSku(rawSku)
                    if (sku) baMapLocal2.set(sku, (baMapLocal2.get(sku) || 0) + Number(item.Quantidade || item.quantidade || 0))
                  })
                  const dadosAjustados = confrontosData.dados.map((c: any) => {
                    const skuNormal = normalizeSku(c.produto)
                    const kc = getConfrontoCalc(c)
                    const ajusteSoma = kc.ajusteSoma
                    const baQty = confrontoType === "fisico_x_a501" ? (baMapLocal2.get(skuNormal) || 0) : 0
                    const teveAjuste = ajusteSoma !== 0 || baQty > 0
                    return {
                      ...c,
                      teve_ajuste: teveAjuste,
                      filtro_ajustado: teveAjuste || kc.mapRetrab > 0 || kc.resAberta > 0,
                      teve_ajuste_ba: baQty > 0,
                      diferenca: kc.diferenca
                    }
                  })

                  const filtered = dadosAjustados.filter((c: any) => {
                    if (confrontoFilter === "divergent" && c.diferenca === 0) return false
                    if (confrontoFilter === "match" && c.diferenca !== 0) return false
                    if (confrontoFilter === "excess" && c.diferenca <= 0) return false
                    if (confrontoFilter === "missing" && c.diferenca >= 0) return false
                    if (confrontoFilter === "adjusted" && !c.filtro_ajustado) return false
                    if (confrontoSearch) {
                      const term = confrontoSearch.toLowerCase()
                      if (!c.produto.toLowerCase().includes(term) && !c.descricao.toLowerCase().includes(term)) return false
                    }
                    return true
                  })

                  const confTotalPages = Math.ceil(filtered.length / confrontoItemsPerPage)
                  if (confTotalPages <= 1) return null

                  const startIndex = (confrontoCurrentPage - 1) * confrontoItemsPerPage
                  const endIndex = Math.min(startIndex + confrontoItemsPerPage, filtered.length)

                  return (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2 px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 rounded-b-[2.5rem]">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Mostrando {startIndex + 1}-{endIndex} de {filtered.length} resultados
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setConfrontoCurrentPage(p => Math.max(1, p - 1))}
                          disabled={confrontoCurrentPage === 1}
                          className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        {[...Array(confTotalPages)].map((_, idx) => {
                          const page = idx + 1
                          if (
                            page === 1 ||
                            page === confTotalPages ||
                            (page >= confrontoCurrentPage - 1 && page <= confrontoCurrentPage + 1)
                          ) {
                            return (
                              <button
                                key={page}
                                onClick={() => setConfrontoCurrentPage(page)}
                                className={cn(
                                  "h-8 w-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                                  confrontoCurrentPage === page
                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                )}
                              >
                                {page}
                              </button>
                            )
                          }
                          if (page === confrontoCurrentPage - 2 || page === confrontoCurrentPage + 2) {
                            return <span key={page} className="px-1 text-slate-400">...</span>
                          }
                          return null
                        })}
                        <button
                          onClick={() => setConfrontoCurrentPage(p => Math.min(confTotalPages, p + 1))}
                          disabled={confrontoCurrentPage === confTotalPages}
                          className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })()}

              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 space-y-6">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="h-16 w-16 rounded-full border-2 border-blue-500/20 border-t-blue-500"
              />
              <motion.div
                initial={{ opacity: 0.5, scale: 0.8 }}
                animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <GitCompare size={24} className="text-blue-500" />
              </motion.div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-[0.3em] animate-pulse">Aguardando Dados...</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Modal de Lançamento de Ajustes de Saldo */}
      <AnimatePresence>
        {modalAjusteOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalAjusteOpen(false)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors">
                  <Settings size={20} className="text-blue-600 dark:text-blue-500" />
                  Lançar Ajuste Manual
                </h3>
                <button onClick={() => setModalAjusteOpen(false)} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              {user ? (
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  const prod = (formData.get('produto') as string).trim().toUpperCase()
                  const qtd = Math.floor(Number(formData.get('quantidade')))
                  const motivo = (formData.get('motivo') as string).trim()

                  if (!prod || isNaN(qtd) || !motivo) return

                  try {
                    const { data, error } = await supabase
                      .from('Ajuste')
                      .insert({
                        'Código': prod,
                        'Quantidade': qtd,
                        'Motivo': motivo,
                        'Data': new Date().toISOString().split('T')[0]
                      })
                      .select()

                    if (error) throw error

                    if (data?.[0]) {
                      const novoAjuste: AjusteManal = {
                        id: data[0].id,
                        produto: prod,
                        quantidade: qtd,
                        motivo,
                        usuario: user.email || "Usuário",
                        timestamp: new Date()
                      }
                      setAjustesConfronto(prev => [novoAjuste, ...prev])
                      ;(e.target as HTMLFormElement).reset()
                    }
                  } catch (err: any) {
                    console.error("Erro ao salvar ajuste:", err)
                    alert("Erro ao salvar no banco de dados: " + err.message)
                  }
                }} className="space-y-4 mb-8">
                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Código do Produto (SKU)</label>
                    <input required name="produto" type="text" className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" placeholder="Ex: 1024-00" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">QTD de Ajuste (+ ou -)</label>
                    <input
                      required
                      name="quantidade"
                      type="number"
                      step="1"
                      onInput={(e) => {
                        const val = (e.target as HTMLInputElement).value
                        if (val.includes('.') || val.includes(',')) {
                          ;(e.target as HTMLInputElement).value = val.split(/[.,]/)[0]
                        }
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                      placeholder="Ex: -5 ou 10"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Motivo do Ajuste</label>
                    <textarea required name="motivo" rows={2} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 resize-none" placeholder="Ex: Contagem dupla na Doca 3..." />
                  </div>
                  <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/20">
                    Aplicar Ajuste Permanente
                  </button>
                </form>
              ) : (
                <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center border border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-600 dark:text-slate-300">Faça <span className="text-blue-600 dark:text-blue-400 font-bold cursor-pointer" onClick={() => { setModalAjusteOpen(false); setShowLoginModal(true); }}>login</span> para lançar novos ajustes. Visitantes podem apenas visualizar o histórico abaixo.</p>
                </div>
              )}

              <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Histórico de Ajustes ({ajustesConfronto.length})</h4>
                  {ajustesConfronto.length > 0 && (
                    <button onClick={async () => {
                      if (!user) {
                        setShowLoginModal(true)
                        return
                      }
                      if (confirm("Deseja realmente remover TODOS os ajustes permanentes do banco de dados?")) {
                        const { error } = await supabase.from('Ajuste').delete().neq('id', 0)
                        if (error) {
                          alert("Erro ao limpar banco: " + error.message)
                        } else {
                          setAjustesConfronto([])
                        }
                      }
                    }} className={cn("text-[10px] font-medium uppercase tracking-widest transition-colors", user ? "text-rose-500 hover:text-rose-400" : "text-slate-400")}>
                      {user ? "Remover Todos" : "Login para Limpar"}
                    </button>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                  {ajustesConfronto.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-600 text-center py-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">Nenhum ajuste ativo.</p>
                  ) : (
                    ajustesConfronto.map((aj, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 p-3 rounded-xl gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{aj.produto}</span>
                            <span className={cn("text-xs font-semibold", aj.quantidade > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{aj.quantidade > 0 ? "+" : ""}{aj.quantidade}</span>
                            {aj.timestamp && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium ml-auto">
                                {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(aj.timestamp))}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 truncate" title={aj.motivo}>{aj.motivo}</p>
                        </div>
                        <button onClick={async () => {
                          if (!user) {
                            setShowLoginModal(true)
                            return
                          }
                          if (!confirm(`Deseja remover o ajuste de ${aj.quantidade > 0 ? "+" : ""}${aj.quantidade} do SKU ${aj.produto}?`)) {
                            return
                          }
                          setAjustesConfronto(prev => prev.filter(p => p.id !== aj.id))
                          if (aj.id) {
                            const { error } = await supabase.from('Ajuste').delete().eq('id', aj.id)
                            if (error) console.error("Erro ao deletar no Supabase:", error)
                          }
                        }} className={cn("flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors border", user ? "bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 border-transparent hover:border-rose-200 dark:hover:border-rose-500/30" : "bg-slate-100 dark:bg-slate-900 text-slate-300 border-slate-200 dark:border-slate-800 cursor-not-allowed")}>
                          {user ? <X size={14} /> : <Lock size={12} />}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Importação em Massa A501 */}
      <AnimatePresence>
        {modalImportA501Open && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalImportA501Open(false)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <PlusSquare size={20} className="text-blue-600" />
                  Importar Dados A501 (Sistema)
                </h3>
                <button onClick={() => setModalImportA501Open(false)} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              {!user ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Você precisa estar logado para atualizar a base de dados do sistema.</p>
                  <button onClick={() => { setModalImportA501Open(false); setShowLoginModal(true); }} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium uppercase tracking-wider">Fazer Login</button>
                </div>
              ) : (
                <div className="flex flex-col flex-1 min-h-0 gap-6">
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Cole os dados do Excel/Sheets abaixo. Ordem esperada: <span className="font-bold text-slate-700 dark:text-slate-200">Código | Descrição | Quantidade</span> (separadas por TAB).</p>
                    <div className="relative flex-1 min-h-[300px]">
                      <textarea
                        value={importTextA501}
                        onChange={(e) => setImportTextA501(e.target.value)}
                        className="w-full h-full min-h-[300px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4 text-xs font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-blue-500 resize-none overflow-y-auto custom-scrollbar"
                        placeholder="Ex:&#10;1024-00	CABO USB TIPO C	150&#10;2050-X	CARREGADOR TURBO	42"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="text-amber-600 flex-shrink-0" size={18} />
                    <p className="text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed font-medium">
                      <span className="font-semibold uppercase">Atenção:</span> Esta operação irá <span className="font-semibold underline italic">APAGAR TODOS</span> os registros atuais da tabela A501 no Supabase e substituí-los pelo conteúdo acima.
                    </p>
                  </div>

                  <button
                    disabled={isImportingA501 || !importTextA501.trim()}
                    onClick={async () => {
                      let lines = importTextA501.trim().split('\n').filter(l => l.trim())
                      if (lines.length === 0) return

                      const firstLineLower = lines[0].toLowerCase()
                      if (firstLineLower.includes("código") || firstLineLower.includes("codigo") || firstLineLower.includes("descrição") || firstLineLower.includes("descricao")) {
                        lines = lines.slice(1)
                      }
                      if (lines.length === 0) {
                        alert("Nenhum dado válido encontrado.")
                        return
                      }

                      if (!confirm(`Confirmar importação de ${lines.length} itens? Isso substituirá a base A501 atual.`)) return

                      setIsImportingA501(true)
                      try {
                        const dataToInsert = lines.map(line => {
                          const cols = line.split('\t')
                          let rawQty = String(cols[2] || '0').trim()
                          const cleanQty = rawQty.split('.').join('').replace(',', '.')
                          return {
                            'Produto': String(cols[0] || '').trim().toUpperCase(),
                            'Descrição': String(cols[1] || '-').trim(),
                            'Quantidade': Number(cleanQty) || 0
                          }
                        })

                        const { error: delErr } = await supabase.from('A501').delete().neq('Produto', 'xyz_placeholder')
                        if (delErr) throw delErr

                        const chunkSize = 200
                        for (let i = 0; i < dataToInsert.length; i += chunkSize) {
                          const chunk = dataToInsert.slice(i, i + chunkSize)
                          const { error: insErr } = await supabase.from('A501').insert(chunk)
                          if (insErr) throw insErr
                        }

                        alert("Importação concluída com sucesso!")
                        setImportTextA501("")
                        setModalImportA501Open(false)
                        fetchConfrontos()
                      } catch (err: any) {
                        console.error("Erro na importação:", err)
                        alert("Falha ao importar: " + err.message)
                      } finally {
                        setIsImportingA501(false)
                      }
                    }}
                    className={cn(
                      "w-full py-4 rounded-2xl font-semibold text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3",
                      isImportingA501
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-wait"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/20 active:scale-[0.98]"
                    )}
                  >
                    {isImportingA501 ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="h-4 w-4 border-2 border-slate-400 border-t-white rounded-full" />
                        Processando...
                      </>
                    ) : "Confirmar e Sobrescrever Base A501"}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Importação em Massa G501 */}
      <AnimatePresence>
        {modalImportG501Open && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalImportG501Open(false)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <PlusSquare size={20} className="text-blue-600" />
                  Importar Dados G501 (Vistoria)
                </h3>
                <button onClick={() => setModalImportG501Open(false)} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              {!user ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Você precisa estar logado para atualizar a base de dados G501.</p>
                  <button onClick={() => { setModalImportG501Open(false); setShowLoginModal(true); }} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium uppercase tracking-wider">Fazer Login</button>
                </div>
              ) : (
                <div className="flex flex-col flex-1 min-h-0 gap-6">
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Cole os dados do Excel/Sheets abaixo. Ordem esperada: <span className="font-bold text-slate-700 dark:text-slate-200">Código | Descrição | Quantidade</span> (separadas por TAB).</p>
                    <div className="relative flex-1 min-h-[300px]">
                      <textarea
                        value={importTextG501}
                        onChange={(e) => setImportTextG501(e.target.value)}
                        className="w-full h-full min-h-[300px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4 text-xs font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-blue-500 resize-none overflow-y-auto custom-scrollbar"
                        placeholder="Ex:&#10;1024-00	CABO USB TIPO C	150&#10;2050-X	CARREGADOR TURBO	42"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="text-amber-600 flex-shrink-0" size={18} />
                    <p className="text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed font-medium">
                      <span className="font-semibold uppercase">Atenção:</span> Esta operação irá <span className="font-semibold underline italic">APAGAR TODOS</span> os registros atuais da tabela G501 no Supabase e substituí-los pelo conteúdo acima.
                    </p>
                  </div>

                  <button
                    disabled={isImportingG501 || !importTextG501.trim()}
                    onClick={async () => {
                      let lines = importTextG501.trim().split('\n').filter(l => l.trim())
                      if (lines.length === 0) return

                      const firstLineLower = lines[0].toLowerCase()
                      if (firstLineLower.includes("código") || firstLineLower.includes("codigo") || firstLineLower.includes("descrição") || firstLineLower.includes("descricao")) {
                        lines = lines.slice(1)
                      }
                      if (lines.length === 0) {
                        alert("Nenhum dado válido encontrado.")
                        return
                      }

                      if (!confirm(`Confirmar importação de ${lines.length} itens? Isso substituirá a base G501 atual.`)) return

                      setIsImportingG501(true)
                      try {
                        const dataToInsert = lines.map(line => {
                          const cols = line.split('\t')
                          let rawQty = String(cols[2] || '0').trim()
                          const cleanQty = rawQty.split('.').join('').replace(',', '.')
                          return {
                            'Produto': String(cols[0] || '').trim().toUpperCase(),
                            'Descrição': String(cols[1] || '-').trim(),
                            'Quantidade': Number(cleanQty) || 0
                          }
                        })

                        const { error: delErr } = await supabase.from('G501').delete().neq('Produto', 'xyz_placeholder')
                        if (delErr) throw delErr

                        const chunkSize = 200
                        for (let i = 0; i < dataToInsert.length; i += chunkSize) {
                          const chunk = dataToInsert.slice(i, i + chunkSize)
                          const { error: insErr } = await supabase.from('G501').insert(chunk)
                          if (insErr) throw insErr
                        }

                        alert("Importação de G501 concluída com sucesso!")
                        setImportTextG501("")
                        setModalImportG501Open(false)
                        fetchConfrontos()
                      } catch (err: any) {
                        console.error("Erro na importação G501:", err)
                        alert("Falha ao importar: " + err.message)
                      } finally {
                        setIsImportingG501(false)
                      }
                    }}
                    className={cn(
                      "w-full py-4 rounded-2xl font-semibold text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3",
                      isImportingG501
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-wait"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/20 active:scale-[0.98]"
                    )}
                  >
                    {isImportingG501 ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="h-4 w-4 border-2 border-slate-400 border-t-white rounded-full" />
                        Processando...
                      </>
                    ) : "Confirmar e Sobrescrever Base G501"}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Detalhes do Confronto (SKU Selecionado) */}
      <AnimatePresence>
        {selectedConfrontoItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-colors">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedConfrontoItem(null)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-xl max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 flex items-center justify-center text-slate-600 dark:text-slate-400">
                    <Package size={18} />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">{selectedConfrontoItem.produto}</h3>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 max-w-[250px] sm:max-w-sm line-clamp-1">{selectedConfrontoItem.descricao}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedConfrontoItem(null)} className="h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 flex items-center justify-center hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900/50 transition-colors"><X size={16} /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-3.5 transition-colors shadow-sm text-center">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Qtd Física</span>
                      {selectedConfrontoItem.teve_ajuste && <span className="text-[8px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1 py-0.5 rounded font-bold leading-none">+Ajuste</span>}
                    </div>
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{fmtNum(selectedConfrontoItem.qtd_fisica)}</span>
                    {selectedConfrontoItem.teve_ajuste && (
                      <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">Orig: {fmtNum(selectedConfrontoItem.qtd_fisica_original)}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-3.5 transition-colors shadow-sm text-center">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Qtd Sistema</span>
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{fmtNum(selectedConfrontoItem.qtd_sistema)}</span>
                  </div>
                </div>

                <div className={cn("border rounded-xl p-5 flex flex-col items-center justify-center text-center transition-colors shadow-sm mt-3",
                  selectedConfrontoItem.diferenca > 0 ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20" :
                    selectedConfrontoItem.diferenca < 0 ? "border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20" :
                      "border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30"
                )}>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Situação Atual</span>
                  <span className={cn("text-4xl font-bold tracking-tight",
                    selectedConfrontoItem.diferenca > 0 ? "text-emerald-600 dark:text-emerald-400" :
                      selectedConfrontoItem.diferenca < 0 ? "text-rose-600 dark:text-rose-400" :
                        "text-slate-800 dark:text-slate-200"
                  )}>
                    {selectedConfrontoItem.diferenca === 0 ? "Bateu" : (
                      `${selectedConfrontoItem.diferenca > 0 ? "+" : ""}${selectedConfrontoItem.diferenca}`
                    )}
                  </span>
                  {selectedConfrontoItem.diferenca !== 0 ? (
                    <p className="text-[11px] font-medium mt-2 text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
                      {selectedConfrontoItem.diferenca > 0 ? (
                        <>Há <span className="font-bold text-emerald-600 dark:text-emerald-400">{Math.abs(selectedConfrontoItem.diferenca)} peças</span> a mais no {confrontoType === 'fisico_x_a501' ? 'físico' : 'A501'}.</>
                      ) : (
                        <>Faltam <span className="font-bold text-rose-600 dark:text-rose-400">{Math.abs(selectedConfrontoItem.diferenca)} peças</span> no {confrontoType === 'fisico_x_a501' ? 'físico' : 'A501'}.</>
                      )}
                    </p>
                  ) : (
                    <p className="text-[11px] font-medium mt-2 text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
                      Os volumes {confrontoType === 'fisico_x_a501' ? 'físico e do sistema' : 'A501 e G501'} estão alinhados.
                    </p>
                  )}

                  {selectedConfrontoItem.teve_ajuste && (
                    <div className="mt-4 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-left w-full">
                      <h4 className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-blue-600 dark:text-blue-400 mb-1.5">
                        <Settings size={12} />
                        Ajuste de {selectedConfrontoItem.ajuste_quantidade > 0 ? "+" : ""}{selectedConfrontoItem.ajuste_quantidade} Aplicado
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        {selectedConfrontoItem.motivo_ajuste}
                      </p>
                    </div>
                  )}
                </div>

                {(() => {
                  const productPositions = effectiveData.filter((item: any) => item.produto === selectedConfrontoItem.produto)
                  if (productPositions.length === 0) return null

                  const posicoesAgrupadas = productPositions.reduce((acc: any, current: any) => {
                    const posicao = current.posicao || "S/P"
                    const armazem = current.armazem || current.g3 || "-"
                    const quantidade = current.quantidade_total || 0

                    const existing = acc.find((item: any) => item.posicao === posicao)
                    if (existing) {
                      existing.quantidade_agrupada += quantidade
                    } else {
                      acc.push({ posicao, armazem, quantidade_agrupada: quantidade })
                    }
                    return acc
                  }, [])

                  const posicoesAgrupadasLocal = selectedConfrontoItem.diferenca !== 0
                    ? posicoesAgrupadas.sort((a: any, b: any) => b.quantidade_agrupada - a.quantidade_agrupada)
                    : posicoesAgrupadas

                  return (
                    <div className="border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30">
                        <h4 className="text-[10px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase">Aba de posições ({posicoesAgrupadasLocal.length})</h4>
                      </div>
                      <div className="max-h-40 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50/50 dark:bg-slate-900 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                              <th className="px-4 py-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Posição</th>
                              <th className="px-4 py-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Qtd</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {posicoesAgrupadasLocal.map((p: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors">{p.posicao}</td>
                                <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 text-right transition-colors">{fmtNum(p.quantidade_agrupada)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

export default ConfrontosTab
