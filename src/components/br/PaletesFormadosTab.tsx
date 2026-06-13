"use client"

import QRCode from "qrcode";
import React, { useState, useMemo } from "react"
import {
  CheckCircle2,
  Box,
  Fan,
  Clock,
  AlertCircle,
  Search,
  Filter,
  ChevronDown,
  Check,
  RefreshCw,
  Pencil,
  Printer,
  X,
  Trash2
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"

// Helpers
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ")
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

interface PosAvaria {
  id: number
  posicao: string
  codigo: string
  descricao: string
  estoque: number
  quantidade: number
}

interface PaletesFormadosTabProps {
  user: any
  controleRaw: any[]
  loadingControle: boolean
  fetchControleAvarias: () => Promise<void>
  setShowLoginModal: (show: boolean) => void
  handleDeleteControle: (id: number) => Promise<void>
  handlePrintControle: (row: any) => void
  setControleRaw: React.Dispatch<React.SetStateAction<any[]>>
  
  // Need posicoesRaw to calculate "Pendentes para Formar"
  posicoesRaw: PosAvaria[]
}

export default function PaletesFormadosTab({
  user,
  controleRaw,
  loadingControle,
  fetchControleAvarias,
  setShowLoginModal,
  handleDeleteControle,
  handlePrintControle,
  setControleRaw,
  posicoesRaw
}: PaletesFormadosTabProps) {
  // Local Filter & Status States
  const [searchControle, setSearchControle]   = useState("")
  const [filterPeriod, setFilterPeriod]       = useState<"todos" | "hoje" | "semanal" | "mensal">("todos")
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)
  const [activeStatusDropdownId, setActiveStatusDropdownId] = useState<number | null>(null)
  const [expandedControleId, setExpandedControleId] = useState<number | null>(null)

  // Edit states
  const [editingControle, setEditingControle] = useState<any>(null)
  const [editReserva, setEditReserva]         = useState("")
  const [editRemessa, setEditRemessa]         = useState("")
  const [editDocumento, setEditDocumento]     = useState("")
  const [editCodigos, setEditCodigos]         = useState("")
  const [editStatus, setEditStatus]           = useState("Pendente")
  const [isSavingEdit, setIsSavingEdit]       = useState(false)

  // Calculate positions pending to form
  const posicoesAgrupadas = useMemo(() => {
    const groups: Record<string, { posicao: string; uniqueSkus: number }> = {}
    posicoesRaw.forEach(item => {
      const pos = (item.posicao || "SEM POSIÇÃO").trim().toUpperCase()
      if (!groups[pos]) {
        groups[pos] = { posicao: pos, uniqueSkus: 0 }
      }
    })
    return Object.values(groups)
  }, [posicoesRaw])

  // Date filter
  const dateFilteredControle = useMemo(() => {
    if (filterPeriod === "todos") return controleRaw
    
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    
    if (filterPeriod === "hoje") {
      return controleRaw.filter(c => c.criacao === today)
    }
    
    if (filterPeriod === "semanal") {
      const msInDay = 24 * 60 * 60 * 1000
      return controleRaw.filter(c => {
        if (!c.criacao) return false
        const [y, m, d] = c.criacao.split('-').map(Number)
        const criacaoDate = new Date(y, m - 1, d)
        const diff = (now.getTime() - criacaoDate.getTime()) / msInDay
        return diff >= 0 && diff <= 7
      })
    }
    
    if (filterPeriod === "mensal") {
      return controleRaw.filter(c => {
        if (!c.criacao) return false
        const [y, m] = c.criacao.split('-').map(Number)
        return y === now.getFullYear() && m === (now.getMonth() + 1)
      })
    }
    
    return controleRaw
  }, [controleRaw, filterPeriod])

  // Search filter
  const filteredControle = useMemo(() => {
    let result = dateFilteredControle

    if (searchControle) {
      const term = searchControle.toLowerCase()
      result = result.filter(c => 
        (c.posicao || "").toLowerCase().includes(term) ||
        (c.codigos || "").toLowerCase().includes(term) ||
        String(c.reserva || "").includes(term) ||
        String(c.remessa || "").includes(term) ||
        (c.documento || "").toLowerCase().includes(term) ||
        (c.status || "").toLowerCase().includes(term)
      )
    }

    return result
  }, [dateFilteredControle, searchControle])

  // Edit Handlers
  const handleOpenEditControle = (row: any) => {
    setEditingControle(row)
    setEditReserva(row.reserva ? String(row.reserva) : "")
    setEditRemessa(row.remessa ? String(row.remessa) : "")
    setEditDocumento(row.documento || "")
    setEditCodigos(row.codigos || "")
    setEditStatus(row.status === "Formado" ? "Pendente" : (row.status || "Pendente"))
  }

  const handleSaveEditControle = async () => {
    if (!editRemessa.trim()) { alert("Remessa é obrigatória."); return }
    if (!editDocumento.trim()) { alert("Documento é obrigatório."); return }
    setIsSavingEdit(true)
    try {
      const updates: any = {
        reserva: editReserva.trim() ? parseInt(editReserva.replace(/[^\d]/g, ''), 10) : null,
        remessa: parseInt(editRemessa.replace(/[^\d]/g, ''), 10),
        documento: editDocumento.trim(),
        codigos: editCodigos.trim() || editingControle.codigos,
        status: editStatus,
      }
      const { error } = await supabase
        .from('controle_avarias')
        .update(updates)
        .eq('id', editingControle.id)
      if (error) throw error
      setControleRaw(prev => prev.map(c => c.id === editingControle.id ? { ...c, ...updates } : c))
      setEditingControle(null)
    } catch (err: any) {
      console.error("Erro ao salvar edição:", err)
      alert("Erro ao salvar: " + err.message)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handlePrintWithQRCode = async (row: any) => {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(String(row.documento || row.id), {
        margin: 1,
        width: 100
      });

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(`
        <html>
          <head>
            <title>Palete - ${row.posicao}</title>
            <style>
              body { font-family: sans-serif; margin: 40px; color: #1e293b; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
              .posicao { font-size: 48px; font-weight: 900; color: #10b981; }
              .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
              .info-item { border: 1px solid #e2e8f0; padding: 15px; border-radius: 10px; }
              .label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
              .value { font-size: 18px; font-weight: 700; }
              .qr-code { width: 120px; height: 120px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="label">Posição</div>
                <div class="posicao">${row.posicao}</div>
              </div>
              <img src="${qrCodeDataUrl}" class="qr-code" />
            </div>
            <div class="info-grid">
              <div class="info-item"><div class="label">Documento SAP</div><div class="value">${row.documento || '—'}</div></div>
              <div class="info-item"><div class="label">Remessa</div><div class="value">${row.remessa || '—'}</div></div>
              <div class="info-item"><div class="label">Quantidade</div><div class="value">${row.quantidade || 0}</div></div>
              <div class="info-item"><div class="label">SKUs</div><div class="value" style="font-size:12px">${row.codigos || '—'}</div></div>
            </div>
            <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error("Erro QR Code:", err);
      handlePrintControle(row);
    }
  };

  return (
    <>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-500/30">
            <CheckCircle2 size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Paletes Formados
            </h1>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Histórico de Controle de Avarias · Portal BR
            </p>
          </div>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Paletes Formados", value: dateFilteredControle.length, icon: Box,          color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800" },
          { label: "Peças Processadas", value: dateFilteredControle.reduce((acc, c) => acc + (c.quantidade || 0), 0), icon: Fan,          color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
          { label: "Pendentes para Entrega", value: dateFilteredControle.filter(c => c.status !== 'Entregue').length, icon: Clock,        color: "text-amber-500 dark:text-amber-400",   bg: "bg-amber-500/10" },
          { label: "Entregues ao Conserto", value: dateFilteredControle.filter(c => c.status === 'Entregue').length, icon: CheckCircle2,   color: "text-blue-500 dark:text-blue-400",     bg: "bg-blue-500/10" },
          { label: "Pendentes para Formar", value: posicoesAgrupadas.length, icon: AlertCircle, color: "text-rose-500 dark:text-rose-400", bg: "bg-rose-500/10", tooltipData: posicoesAgrupadas }
        ].map((m: any, i) => (
          <div
            key={m.label}
            className="group relative rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex items-center gap-3"
          >
            <div className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", m.bg)}>
              <m.icon size={18} className={m.color} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{(loadingControle) ? "..." : m.value.toLocaleString("pt-BR")}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{m.label}</p>
            </div>

            {m.tooltipData && m.tooltipData.length > 0 && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-2xl rounded-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 max-h-64 overflow-y-auto">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1 border-b border-slate-800 pb-2">AVAs Pendentes para Formar</div>
                <div className="flex flex-col gap-1.5">
                  {m.tooltipData.map((ava: any) => (
                    <div key={ava.posicao} className="flex items-center justify-between bg-slate-800/50 dark:bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2 hover:bg-slate-800 transition-colors cursor-default">
                      <span className="text-xs font-bold text-slate-300">{ava.posicao}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Controls Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-6 py-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por Posição, SKUs, Reserva ou Documento..."
              value={searchControle}
              onChange={e => setSearchControle(e.target.value)}
              className="w-full pl-9 pr-4 py-2 h-10 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition"
            />
          </div>

          {/* Period Filter Dropdown */}
          <div className="relative flex items-center shrink-0">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className={cn(
                "flex items-center justify-between h-10 pl-4 pr-3 w-[130px] rounded-xl text-xs font-bold border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer",
                filterPeriod !== 'todos'
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300"
              )}
            >
              <div className="flex items-center gap-2">
                <Filter size={14} className={filterPeriod !== 'todos' ? "text-emerald-500" : "text-slate-400"} />
                <span className="capitalize">{filterPeriod}</span>
              </div>
              <ChevronDown size={14} className={cn("text-slate-400 transition-transform duration-200", isFilterDropdownOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isFilterDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsFilterDropdownOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 mt-2 w-36 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-40 p-1.5"
                  >
                    {[
                      { value: "todos", label: "Todos" },
                      { value: "hoje", label: "Hoje" },
                      { value: "semanal", label: "Semanal" },
                      { value: "mensal", label: "Mensal" }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setFilterPeriod(opt.value as any)
                          setIsFilterDropdownOpen(false)
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-between cursor-pointer",
                          filterPeriod === opt.value
                            ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        )}
                      >
                        {opt.label}
                        {filterPeriod === opt.value && <Check size={14} />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2">
          {filteredControle.length} {filteredControle.length === 1 ? "palete formado" : "paletes formados"}
        </span>
      </div>

      {/* Table */}
      {loadingControle ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="animate-spin text-emerald-500" size={32} />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Carregando Histórico...</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="min-h-[280px]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  {["Data", "Posição", "Qtd Total", "Reserva", "Remessa", "Documento", "Status", "Ações"].map(col => (
                    <th 
                      key={col} 
                      className={cn(
                        "px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap",
                        col === "Posição" && "pl-8",
                        col === "Qtd Total" && "text-right",
                        col === "Ações" && "text-center pl-8"
                      )}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {filteredControle.map((c) => {
                  const isExpanded = expandedControleId === c.id
                  let itens: any[] | null = null
                  try { if (c.itens_json) itens = JSON.parse(c.itens_json) } catch (_) {}
                  const hasDetail = itens && itens.length > 0

                  return (
                    <React.Fragment key={c.id}>
                      <tr
                        onClick={() => setExpandedControleId(isExpanded ? null : c.id)}
                        className={cn(
                          "transition-colors cursor-pointer select-none",
                          isExpanded
                            ? "bg-slate-50 dark:bg-slate-800/60"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {c.criacao ? c.criacao.split('-').reverse().join('/') : "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap pl-8 relative">
                          <ChevronDown
                            size={13}
                            className={cn(
                              "absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 shrink-0 transition-transform duration-200",
                              isExpanded && "rotate-180"
                            )}
                          />
                          {renderPosicaoHighlight(c.posicao)}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{c.quantidade}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {c.reserva ? (
                            <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                              {c.reserva}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 font-bold">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {c.remessa ? (
                            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                              {c.remessa}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 font-bold">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {c.documento ? (
                            <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                              {c.documento}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 font-bold">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap pl-4" onClick={e => e.stopPropagation()}>
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              disabled={!user}
                              onClick={() => setActiveStatusDropdownId(activeStatusDropdownId === c.id ? null : c.id)}
                              className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer transition-all",
                                (c.status === 'Entregue')
                                  ? "text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 hover:border-emerald-300 dark:hover:border-emerald-400"
                                  : "text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 hover:border-amber-300 dark:hover:border-amber-400",
                                !user && "opacity-60 cursor-not-allowed"
                              )}
                              title={user ? "Alterar Status" : "Necessário Login para alterar"}
                            >
                              {c.status === 'Entregue' ? (
                                <>
                                  <CheckCircle2 size={12} className="shrink-0" />
                                  Entregue
                                </>
                              ) : (
                                <>
                                  <Clock size={12} className="shrink-0" />
                                  Pendente
                                </>
                              )}
                              <ChevronDown size={10} className={cn("ml-0.5 opacity-60 transition-transform duration-200", activeStatusDropdownId === c.id && "rotate-180")} />
                            </button>

                            <AnimatePresence>
                              {activeStatusDropdownId === c.id && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-30" 
                                    onClick={() => setActiveStatusDropdownId(null)} 
                                  />
                                  <motion.div
                                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute left-0 mt-2 w-[130px] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-1.5"
                                  >
                                    {[
                                      { value: "Pendente", label: "Pendente", color: "text-amber-500", bg: "hover:bg-amber-50 dark:hover:bg-amber-500/10", icon: Clock },
                                      { value: "Entregue", label: "Entregue", color: "text-emerald-500", bg: "hover:bg-emerald-50 dark:hover:bg-emerald-500/10", icon: CheckCircle2 }
                                    ].map(opt => (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={async () => {
                                          setActiveStatusDropdownId(null)
                                          try {
                                            const { error } = await supabase
                                              .from('controle_avarias')
                                              .update({ status: opt.value })
                                              .eq('id', c.id)
                                            if (error) throw error
                                            setControleRaw(prev => prev.map(item => item.id === c.id ? { ...item, status: opt.value } : item))
                                          } catch (err: any) {
                                            console.error("Erro ao alterar status:", err.message)
                                            alert("Erro ao alterar status: " + err.message)
                                          }
                                        }}
                                        className={cn(
                                          "w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-between cursor-pointer",
                                          opt.bg,
                                          (c.status === 'Entregue' ? 'Entregue' : (c.status || 'Pendente')) === opt.value
                                            ? "bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                                            : "text-slate-600 dark:text-slate-300"
                                        )}
                                      >
                                        <div className="flex items-center gap-2">
                                          <opt.icon size={14} className={opt.color} />
                                          {opt.label}
                                        </div>
                                        {(c.status === 'Entregue' ? 'Entregue' : (c.status || 'Pendente')) === opt.value && <Check size={14} className="text-slate-400" />}
                                      </button>
                                    ))}
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => user && handleOpenEditControle(c)}
                              className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center transition-colors border",
                                user
                                  ? "bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-500/20 text-slate-400 hover:text-blue-500 border-transparent cursor-pointer"
                                  : "bg-slate-50 dark:bg-slate-800 text-slate-300 border-transparent cursor-not-allowed"
                              )}
                              title={user ? "Alterar Registro" : "Necessário Login"}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handlePrintControle(c)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-500 border-transparent border transition-colors cursor-pointer"
                              title="Imprimir Palete"
                            >
                              <Printer size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${c.id}-detail`} className="bg-slate-50/80 dark:bg-slate-800/30">
                          <td colSpan={8} className="px-6 pb-4 pt-0">
                            {hasDetail ? (
                              <div className="rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 mt-1">
                                <table className="w-full text-left">
                                  <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-800/60">
                                      <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Código SKU</th>
                                      <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                                      <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Qtd Orig.</th>
                                      <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Qtd Final</th>
                                      <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                                    {itens!.map((item: any, idx: number) => (
                                      <tr key={idx} className={cn(
                                        "transition-colors",
                                        !item.incluido && "opacity-50"
                                      )}>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                          <span className={cn(
                                            "text-xs font-mono font-bold",
                                            item.incluido ? "text-slate-600 dark:text-slate-400" : "text-slate-400 line-through"
                                          )}>{item.codigo}</span>
                                        </td>
                                        <td className="px-4 py-2">
                                          <span className={cn(
                                            "text-xs font-semibold leading-tight block max-w-xs truncate",
                                            item.incluido ? "text-slate-700 dark:text-slate-300" : "text-slate-400 line-through"
                                          )} title={item.descricao}>{item.descricao}</span>
                                        </td>
                                        <td className="px-4 py-2 text-center whitespace-nowrap">
                                          <span className="text-xs font-semibold text-slate-500">{item.qtdOriginal}</span>
                                        </td>
                                        <td className="px-4 py-2 text-center whitespace-nowrap">
                                          <span className={cn(
                                            "text-xs font-bold",
                                            !item.incluido ? "text-slate-400" :
                                            item.qtdFinal < item.qtdOriginal ? "text-amber-600 dark:text-amber-400" :
                                            "text-slate-900 dark:text-white"
                                          )}>{item.qtdFinal}</span>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                          {!item.incluido ? (
                                            <span className="text-[9px] font-black text-rose-600 bg-rose-100 dark:bg-rose-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider">Retirar</span>
                                          ) : item.qtdFinal < item.qtdOriginal ? (
                                            <span className="text-[9px] font-black text-amber-600 bg-amber-100 dark:bg-amber-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider">Qtd Alt.</span>
                                          ) : (
                                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider">OK</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="mt-2 px-2 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/40 text-xs font-semibold text-slate-500">
                                <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider mr-2">SKUs:</span>
                                {c.codigos || '—'}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}

                {filteredControle.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                          <Box size={22} />
                        </div>
                        <p className="text-sm font-bold text-slate-400">Nenhum palete formado encontrado</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Edit Controle Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {editingControle && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingControle(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              className="relative w-full max-w-lg rounded-[32px] bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="flex justify-between items-start mb-6 pb-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xl font-bold mb-1">
                    {renderPosicaoHighlight(editingControle.posicao)}
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alterar Registro de Palete</p>
                </div>
                <button
                  onClick={() => setEditingControle(null)}
                  className="h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                    Reserva SAP
                    <span className="text-[9px] font-normal text-slate-300 dark:text-slate-600 normal-case tracking-normal">(opcional — somente MB21)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 100028945"
                    value={editReserva}
                    onChange={(e) => setEditReserva(e.target.value)}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                      Remessa MIGO <span className="text-[9px] font-bold text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 80004523"
                      value={editRemessa}
                      onChange={(e) => setEditRemessa(e.target.value)}
                      className={cn(
                        "w-full h-11 bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500",
                        editRemessa.trim() ? "border-slate-200 dark:border-slate-800" : "border-amber-300 dark:border-amber-600/40"
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                      Documento SAP <span className="text-[9px] font-bold text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 5000948301"
                      value={editDocumento}
                      onChange={(e) => setEditDocumento(e.target.value)}
                      className={cn(
                        "w-full h-11 bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500",
                        editDocumento.trim() ? "border-slate-200 dark:border-slate-800" : "border-amber-300 dark:border-amber-600/40"
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Códigos SKUs</label>
                  <textarea
                    rows={2}
                    placeholder="Códigos separados por vírgula..."
                    value={editCodigos}
                    onChange={(e) => setEditCodigos(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Status do Palete</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 border-slate-800 rounded-xl px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Entregue">Entregue</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={!user}
                  onClick={async () => {
                    if (confirm("Deseja realmente excluir este registro?")) {
                      await handleDeleteControle(editingControle.id)
                      setEditingControle(null)
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-450 text-xs font-bold transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 size={13} />
                  Excluir
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingControle(null)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditControle}
                    disabled={isSavingEdit}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      isSavingEdit
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-wait"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    )}
                  >
                    {isSavingEdit ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                    Salvar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
