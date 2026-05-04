"use client"

import React, { useState, useEffect, useMemo } from "react"
import { 
  Search, 
  ChevronDown,
  Package,
  CheckCircle2,
  AlertCircle,
  Layers,
  Hash,
  Box,
  TrendingUp,
  Clock,
  ChevronRight,
  Sparkles,
  PauseCircle,
  PlayCircle,
  ListTodo,
  Hourglass,
  Plus,
  RefreshCw,
  ArrowRight,
  ListMusic
} from "lucide-react"

const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    .no-spinner::-webkit-inner-spin-button,
    .no-spinner::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .no-spinner {
      -moz-appearance: textfield;
    }
  `}} />
)
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"

interface RetrabalhoRecord {
  id: number
  lote: any
  quantidade_enviada: number
  data_inicio: string
  data_fim: string
  quantidade_retornada: number
  reserva_a501: string
  reserva_g501: string
  estorno_a501: string
  estorno_g501: string
  quantidade_rejeitada: number
  status: string
  embalagens_avariadas: number
  codigo?: string
  desc_produto?: string
  cliente?: string
  unidade?: string
}

interface LoteConfig {
  lote: any
  codigo: string
  status?: string
  Status?: string 
  embalagens?: number
}

interface BaseCodigo {
  "Código": string
  "Descrição": string
  "Grade"?: string | number
}

interface GroupedLote {
  lote: number
  displayId?: string
  codigo: string
  descricao: string
  grade: number
  totalEmbalagens: number
  totalEnviado: number
  totalRetornado: number
  totalRejeitado: number
  totalAvarias: number
  items: RetrabalhoRecord[]
  status: string
  progresso: number
}

const STATUS_OPTIONS = [
  { id: 'all', label: 'Todos', icon: Layers, color: 'text-slate-400' },
  { id: 'Aguardando', label: 'Aguardando', icon: Hourglass, color: 'text-amber-400' },
  { id: 'EM ANDAMENTO', label: 'Em andamento', icon: PlayCircle, color: 'text-blue-400' },
  { id: 'PAUSADO', label: 'Pausado', icon: PauseCircle, color: 'text-rose-400' },
  { id: 'FINALIZADO', label: 'Finalizado', icon: CheckCircle2, color: 'text-emerald-400' },
  { id: 'EM FILA', label: 'Em Fila', icon: ListMusic, color: 'text-purple-400' },
]

export default function RetrabalhosTab({ refreshTrigger }: { refreshTrigger?: boolean } = {}) {
  const [records, setRecords] = useState<RetrabalhoRecord[]>([])
  const [lotesConfig, setLotesConfig] = useState<LoteConfig[]>([])
  const [baseCodigos, setBaseCodigos] = useState<BaseCodigo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeStatus, setActiveStatus] = useState("all")
  const [expandedLotes, setExpandedLotes] = useState<Set<number>>(new Set())
  const [user, setUser] = useState<any>(null)
  const [isNewLoteModalOpen, setIsNewLoteModalOpen] = useState(false)
  const [isNewReservaModalOpen, setIsNewReservaModalOpen] = useState(false)
  const [selectedLoteForReserva, setSelectedLoteForReserva] = useState<number | null>(null)
  const [editingReserva, setEditingReserva] = useState<RetrabalhoRecord | null>(null)
  const [editingLote, setEditingLote] = useState<GroupedLote | null>(null)
  const [tempStatus, setTempStatus] = useState<string>("")

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)

      const [retrabalhosRes, lotesRes, baseRes] = await Promise.all([
        supabase.from('retrabalhos').select('*'),
        supabase.from('lotes_config').select('*'),
        supabase.from('base_codigos').select('*')
      ])
      setRecords(retrabalhosRes.data || [])
      setLotesConfig(lotesRes.data || [])
      setBaseCodigos(baseRes.data || [])
    } catch (err) {
      console.error("Erro na busca:", err)
    } finally {
      setTimeout(() => setLoading(false), 400)
    }
  }

  useEffect(() => {
    fetchData()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (refreshTrigger) {
      fetchData()
    }
  }, [refreshTrigger])

  const groupedData = useMemo(() => {
    // Se o status for "Em Fila", mostramos reservas individuais
    if (activeStatus?.toUpperCase() === 'EM FILA') {
      return records.filter(item => {
        const itemStatus = (item.status || "Aguardando").trim().toUpperCase()
        const matchesSearch = item.codigo?.toLowerCase().includes(search.toLowerCase()) ||
                             item.desc_produto?.toLowerCase().includes(search.toLowerCase()) ||
                             item.lote?.toString().includes(search)
        
        return (itemStatus === 'EM FILA' || itemStatus === 'FILA') && matchesSearch
      }).map(item => {
        const config = lotesConfig.find(c => String(c.lote).trim() === String(item.lote).trim())
        const cleanCodigo = (item.codigo || config?.codigo || '---').trim();
        const base = baseCodigos.find(b => String(b["Código"]).trim() === cleanCodigo);
        
        return {
          lote: item.lote,
          displayId: `FILA-${item.id}`,
          status: item.status || 'EM FILA',
          codigo: cleanCodigo,
          descricao: item.desc_produto || base?.["Descrição"] || (config ? `Produto ${cleanCodigo}` : "Produto não identificado"),
          grade: base?.["Grade"] ? Number(base["Grade"]) : 0,
          totalEmbalagens: item.quantidade_enviada || 0,
          totalEnviado: item.quantidade_enviada || 0,
          totalRetornado: item.quantidade_retornada || 0,
          totalRejeitado: item.quantidade_rejeitada || 0,
          totalAvarias: item.embalagens_avariadas || 0,
          progresso: item.quantidade_enviada > 0 ? (item.quantidade_retornada / item.quantidade_enviada) * 100 : 0,
          items: [item]
        }
      }).sort((a, b) => b.lote - a.lote)
    }

    // Lógica original de agrupamento para os outros status
    const groups: { [key: number]: GroupedLote } = {}
    records.forEach(item => {
      const loteIdRaw = String(item.lote).trim()
      const loteId = Number(loteIdRaw)
      if (isNaN(loteId)) return

      if (!groups[loteId]) {
        const config = lotesConfig.find(c => String(c.lote).trim() === loteIdRaw)
        const codigo = config?.codigo || "---"
        const masterStatus = (config?.status || config?.Status || item.status || "Aguardando").toUpperCase()
        const base = baseCodigos.find(b => String(b["Código"]).trim() === String(codigo).trim())
        const descricao = base?.["Descrição"] || (config ? `Produto ${codigo}` : "Lote não configurado")
        const embalagensMaster = config?.embalagens || 0
        const gradeValue = base?.["Grade"] ? Number(base["Grade"]) : 0

        groups[loteId] = {
          lote: loteId,
          codigo: codigo,
          descricao: descricao,
          grade: gradeValue,
          totalEmbalagens: embalagensMaster,
          totalEnviado: 0,
          totalRetornado: 0,
          totalRejeitado: 0,
          totalAvarias: 0,
          items: [],
          status: masterStatus,
          progresso: 0
        }
      }
      
      groups[loteId].totalEnviado += item.quantidade_enviada || 0
      groups[loteId].totalRetornado += item.quantidade_retornada || 0
      groups[loteId].totalRejeitado += item.quantidade_rejeitada || 0
      groups[loteId].totalAvarias += item.embalagens_avariadas || 0
      groups[loteId].items.push(item)
    })

    return Object.values(groups).map(lote => ({
      ...lote,
      progresso: Math.min(100, (lote.totalRetornado / (lote.totalEnviado || 1)) * 100)
    })).filter(lote => {
      const matchesSearch = lote.codigo?.toLowerCase().includes(search.toLowerCase()) ||
                           lote.descricao?.toLowerCase().includes(search.toLowerCase()) ||
                           lote.lote.toString().includes(search)
      const matchesStatus = activeStatus === 'all' || lote.status === activeStatus.toUpperCase()
      return matchesSearch && matchesStatus
    }).sort((a, b) => b.lote - a.lote)
  }, [records, lotesConfig, baseCodigos, search, activeStatus])

  const toggleLote = (loteNum: number) => {
    const newSet = new Set(expandedLotes)
    if (newSet.has(loteNum)) newSet.delete(loteNum)
    else newSet.add(loteNum)
    setExpandedLotes(newSet)
  }

  const formatPallets = (total: number, grade: number, abbreviated = false) => {
    if (!grade || grade <= 0) return null
    const pallets = Math.floor(total / grade)
    const pieces = total % grade

    const palLabel = abbreviated ? 'pal' : (pallets === 1 ? 'palete' : 'paletes')
    const pçLabel = abbreviated ? 'pç' : (pieces === 1 ? 'peça' : 'peças')

    if (pallets > 0 && pieces > 0) return `${pallets} ${palLabel} + ${pieces} ${pçLabel}`
    if (pallets > 0) return `${pallets} ${palLabel}`
    return `${pieces} ${pçLabel}`
  }

  const getStatusConfig = (status: string) => {
    const s = status?.toUpperCase() || 'AGUARDANDO'
    switch (s) {
      case 'FINALIZADO': return { style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' }
      case 'EM ANDAMENTO': return { style: 'bg-blue-500/10 text-blue-400 border-blue-500/20', dot: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse' }
      case 'PAUSADO': return { style: 'bg-rose-500/10 text-rose-400 border-rose-500/20', dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' }
      case 'AGUARDANDO': return { style: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' }
      case 'EM FILA': return { style: 'bg-violet-500/15 text-violet-400 border-violet-500/30', dot: 'bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.6)]' }
      default: return { style: 'bg-slate-500/10 text-slate-400 border-slate-500/20', dot: 'bg-slate-500' }
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit', 
      minute: '2-digit' 
    }).format(date).replace(',', '')
  }

  return (
    <div className="space-y-4 pb-12">
      <GlobalStyles />
      {/* Row 1: Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Qtd Retrabalhada", value: records.reduce((s, i) => s + (i.quantidade_retornada || 0), 0), icon: TrendingUp, color: "text-emerald-400" },
          { label: "% Retrabalhado", value: `${Math.round((records.reduce((s, i) => s + (i.quantidade_retornada || 0), 0) / (records.reduce((s, i) => s + (i.quantidade_enviada || 0), 0) || 1)) * 100)}%`, icon: Sparkles, color: "text-blue-400" },
          { label: "Embalagens Avariadas", value: records.reduce((s, i) => s + (i.embalagens_avariadas || 0), 0), icon: AlertCircle, color: "text-rose-400" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="group relative p-4 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-xl">
            <div className="relative z-10 flex items-center gap-4">
              <div className={cn("p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10", stat.color)}><stat.icon size={16} /></div>
              <div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">{stat.label}</span>
                <span className="text-xl font-black text-slate-900 dark:text-white font-mono">{stat.value}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Row 2: Filtros + Pesquisa (Mesma Linha) */}
      <div className="flex flex-col lg:flex-row items-center gap-3">
        <div className="flex-1 flex flex-wrap items-center gap-2 bg-slate-50/50 dark:bg-[#0F172A]/50 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 backdrop-blur-sm">
          {STATUS_OPTIONS.map((status) => (
            <button key={status.id} onClick={() => setActiveStatus(status.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200", activeStatus === status.id ? "bg-blue-600 text-white shadow-md scale-105" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5")}>
              <status.icon size={12} className={cn(activeStatus === status.id ? "text-white" : status.color)} />
              {status.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input type="text" placeholder="Filtrar por lote ou SKU..." className="w-full bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 pl-9 pr-3 text-[11px] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-400 shadow-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          
          {user && (
            <button 
              onClick={() => setIsNewLoteModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-600/20 transition-all font-black text-[10px] uppercase shrink-0"
            >
              <Plus size={14} />
              Novo Lote
            </button>
          )}
        </div>
      </div>

      {/* Cards de Lote Slim */}
      <div className="space-y-3 pt-2">
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-white/5 animate-pulse" />)
          ) : groupedData.length > 0 ? (
            <>
              {/* Cabeçalho Informativo quando há dados */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                className="flex items-center justify-between px-6 py-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl mb-4 backdrop-blur-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2">
                    {groupedData.slice(0, 3).map((lote, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-[#0B0F1A] bg-white dark:bg-[#0F172A] flex items-center justify-center overflow-hidden">
                        <img 
                          src={`https://bvgwlkdqmkuuhqiwzfti.supabase.co/storage/v1/object/public/Store/Codigos%20icon/${lote.codigo?.trim() || '---'}.png`}
                          className="w-full h-full object-cover opacity-80"
                          onError={(e) => (e.target as any).style.display = 'none'}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                      {groupedData.length} {groupedData.length === 1 ? 'Lote Encontrado' : 'Lotes Encontrados'}
                      <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                    </span>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                      {activeStatus === 'Aguardando' 
                        ? "Lotes preparados e separados. Aguardando início do retrabalho pela equipe." 
                        : activeStatus === 'Em andamento'
                        ? "Produção em ritmo acelerado. Acompanhe o progresso em tempo real."
                        : activeStatus?.toUpperCase() === 'EM FILA'
                        ? "Reservas individuais aguardando liberação para o próximo lote."
                        : "Listagem atualizada conforme seus filtros de busca."}
                    </p>
                  </div>
                </div>
                
                {activeStatus === 'Aguardando' && (
                  <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-amber-600/10 border border-amber-600/20 rounded-xl">
                    <Clock size={12} className="text-amber-400 animate-pulse" />
                    <span className="text-[8px] font-black text-amber-400 uppercase tracking-[0.2em]">Aguardando Início</span>
                  </div>
                )}
              </motion.div>

              {groupedData.map((lote) => (
            <motion.div layout initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} key={lote.displayId || lote.lote} className={cn("group relative bg-white dark:bg-[#0F172A] border rounded-[1.8rem] transition-all duration-300 overflow-hidden shadow-xl", expandedLotes.has(lote.lote) ? "border-blue-500/30" : "border-slate-200 dark:border-white/5 hover:border-slate-200 dark:border-white/10")}>
              <div className="absolute top-0 left-0 w-1 h-full transition-colors bg-blue-600/20 group-hover:bg-blue-600/40" />
              
              <div className="p-7 cursor-pointer select-none" onClick={() => toggleLote(lote.lote)}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-5 flex-1 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-black/40 border border-slate-100 dark:border-white/5 flex items-center justify-center overflow-hidden relative group/img transition-all">
                        {/* Box symbol behind the image */}
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50">
                          <Package size={24} className="text-slate-200 dark:text-slate-700/50" />
                        </div>

                        {lote.codigo && lote.codigo !== "---" ? (
                          <img 
                            src={`https://bvgwlkdqmkuuhqiwzfti.supabase.co/storage/v1/object/public/Store/Codigos%20icon/${lote.codigo?.trim() || '---'}.png`}
                            alt={lote.codigo}
                            className="w-full h-full object-contain relative z-20 transition-all duration-500 group-hover/img:scale-110 group-hover/img:opacity-40"
                            onLoad={(e) => {
                              const target = e.target as HTMLImageElement;
                              const parent = target.parentElement;
                              if (parent) {
                                const fallback = parent.querySelector('.fallback-placeholder') as HTMLElement;
                                if (fallback) fallback.style.opacity = '0';
                              }
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                const fallback = parent.querySelector('.fallback-placeholder') as HTMLElement;
                                if (fallback) {
                                  fallback.style.opacity = '1';
                                  fallback.style.display = 'flex';
                                }
                              }
                            }}
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider", getStatusConfig(lote.status).style)}>
                            <div className={cn("w-1 h-1 rounded-full", getStatusConfig(lote.status).dot)} />
                            {lote.status}
                          </div>
                          {user && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLote(lote);
                              }}
                              className="p-1 rounded bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-colors border border-slate-200 dark:border-white/5"
                            >
                              <RefreshCw size={8} />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                          <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Lote</span>
                          <span className="text-[10px] font-black text-slate-900 dark:text-white font-mono leading-none">{lote.lote}</span>
                        </div>
                        <span className="text-[10px] font-black text-blue-400 font-mono tracking-widest bg-blue-500/5 px-2 rounded border border-blue-500/10">
                          {lote.codigo}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-lg">{lote.descricao}</h3>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-slate-500"><Clock size={10} className="text-slate-600" /><span className="text-[8px] font-bold uppercase tracking-widest">{formatDate(lote.items[0]?.data_inicio)}</span></div>
                        <div className="flex items-center gap-1.5 text-slate-500"><Hash size={10} className="text-slate-600" /><span className="text-[8px] font-bold uppercase tracking-widest">{lote.items.length} Reservas</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 lg:gap-8 flex-1 justify-between min-w-0">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="relative w-14 h-14 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90">
                           <circle cx="28" cy="28" r="22" className="stroke-slate-200 dark:stroke-white/5 fill-none" strokeWidth="4" />
                           <motion.circle cx="28" cy="28" r="22" className={cn("fill-none transition-all duration-500", lote.progresso === 100 ? "stroke-emerald-500" : "stroke-blue-500")} strokeWidth="4" strokeDasharray={138} initial={{ strokeDashoffset: 138 }} animate={{ strokeDashoffset: 138 - (138 * lote.progresso) / 100 }} strokeLinecap="round" />
                        </svg>
                        <span className="absolute text-[10px] font-black text-slate-900 dark:text-white font-mono tracking-tighter">{Math.floor(lote.progresso)}%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-1 lg:gap-4 py-3 px-3 lg:px-6 bg-slate-50 dark:bg-black/40 rounded-2xl border border-slate-200 dark:border-white/5 flex-1 min-w-[280px]">
                       <div className="flex flex-col min-w-0 justify-between">
                          <span className="text-[7px] md:text-[8px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-wider mb-1 truncate">Embalag.</span>
                          <span className="text-sm md:text-base font-black text-blue-400 font-mono leading-none truncate">{lote.totalEmbalagens}</span>
                       </div>
                       <div className="flex flex-col min-w-0 justify-between">
                          <span className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase tracking-wider mb-1 truncate">Enviado</span>
                          <span className="text-sm md:text-base font-black text-slate-900 dark:text-white font-mono leading-none truncate">{lote.totalEnviado}</span>
                          <span className="text-[6px] md:text-[7px] font-medium text-slate-500/60 mt-1 truncate">{formatPallets(lote.totalEnviado, lote.grade, true)}</span>
                       </div>
                       <div className="flex flex-col min-w-0 justify-between">
                          <span className="text-[7px] md:text-[8px] font-black text-emerald-500 uppercase tracking-wider mb-1 truncate">Retrab.</span>
                          <span className="text-sm md:text-base font-black text-emerald-400 font-mono leading-none truncate">{lote.totalRetornado}</span>
                          <span className="text-[6px] md:text-[7px] font-medium text-emerald-500/60 mt-1 truncate">{formatPallets(lote.totalRetornado, lote.grade, true)}</span>
                       </div>
                       <div className="flex flex-col min-w-0 justify-between">
                          <span className="text-[7px] md:text-[8px] font-black text-rose-500 uppercase tracking-wider mb-1 truncate">Rejeit.</span>
                          <span className="text-sm md:text-base font-black text-rose-400 font-mono leading-none truncate">{lote.totalRejeitado || 0}</span>
                       </div>
                       <div className="flex flex-col min-w-0 justify-between">
                          <span className="text-[7px] md:text-[8px] font-black text-amber-500 uppercase tracking-wider mb-1 truncate">Avarias</span>
                          <span className="text-sm md:text-base font-black text-amber-400 font-mono leading-none truncate">{lote.totalAvarias || 0}</span>
                       </div>
                    </div>

                    {user && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLoteForReserva(lote.lote);
                          setIsNewReservaModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-wider transition-all shrink-0 group/add"
                      >
                        <Plus size={12} className="text-blue-600 dark:text-blue-500 group-hover/add:scale-125 transition-transform" />
                        Add Reserva
                      </button>
                    )}

                    <motion.div animate={{ rotate: expandedLotes.has(lote.lote) ? 180 : 0 }} className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shrink-0 shadow-sm"><ChevronDown size={16} /></motion.div>
                  </div>
                </div>
              </div>

              <div className="h-0.5 w-full bg-slate-50 dark:bg-white/5">
                <motion.div initial={{ width: 0 }} animate={{ width: `${lote.progresso}%` }} className={cn("h-full", lote.progresso === 100 ? "bg-emerald-500" : "bg-blue-600")} />
              </div>

              <AnimatePresence>
                {expandedLotes.has(lote.lote) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-slate-50 dark:bg-black/40">
                    <div className="p-8 space-y-4">
                      <div className="flex items-center gap-4 mb-2">
                           <div className="h-px flex-1 bg-slate-50 dark:bg-white/5" /><span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Detalhamento de Reservas</span><div className="h-px flex-1 bg-slate-50 dark:bg-white/5" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {lote.items.map((item, idx) => (
                          <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: idx * 0.05 }} key={item.id} className="group/item relative p-6 bg-white/[0.03] rounded-[2rem] border border-slate-200 dark:border-white/5 hover:border-blue-500/20 transition-all shadow-inner">
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-[11px] font-black text-blue-600 dark:text-blue-500">{idx + 1}</div>
                                <div className="flex flex-col gap-1 items-start min-w-0">
                                  <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">Reserva Individual</span>
                                  <div className="flex items-center gap-2 text-slate-500">
                                    <Clock size={10} className="text-slate-600" />
                                    <span className="text-[8px] font-bold uppercase tracking-widest">
                                      {formatDate(item.data_inicio)} {item.data_fim ? `- ${formatDate(item.data_fim)}` : ''}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            
                            <div className="flex-1" />

                            <div className="flex items-center gap-3">
                              {item.status?.toUpperCase() === 'FINALIZADO' && (!item.estorno_a501 && !item.estorno_g501) && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                  <AlertCircle size={10} className="animate-pulse" />
                                  <span className="text-[8px] font-black uppercase tracking-widest">Aguardando Estorno de Saldo</span>
                                </motion.div>
                              )}

                              <div className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-wider transition-all duration-300",
                                getStatusConfig(item.status).style
                              )}>
                                <div className={cn("w-1 h-1 rounded-full", getStatusConfig(item.status).dot)} />
                                {item.status}
                              </div>
                            </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-3">
                                  <div className="flex items-center gap-2 mb-1 px-1"><Hash size={10} className="text-blue-600 dark:text-blue-500" /><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">SISTEMA</span></div>
                                  <div className="p-3 bg-slate-50 dark:bg-black/40 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col gap-2">
                                     <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-blue-500 uppercase">A501</span><span className="text-xs font-mono font-black text-slate-900 dark:text-blue-100">{item.reserva_a501 || "---"}</span></div>
                                     <div className="h-px bg-slate-200 dark:bg-white/5" />
                                     <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-emerald-500 uppercase">G501</span><span className="text-xs font-mono font-black text-slate-900 dark:text-emerald-100">{item.reserva_g501 || "---"}</span></div>
                                  </div>
                               </div>
                               <div className="space-y-3">
                                  <div className="flex items-center gap-2 mb-1 px-1"><RefreshCw size={10} className="text-amber-500" /><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">ESTORNOS</span></div>
                                  <div className="p-3 bg-slate-50 dark:bg-black/40 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col gap-2">
                                     <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-amber-500 uppercase">A501</span><span className="text-xs font-mono font-black text-slate-900 dark:text-amber-100">{item.estorno_a501 || "---"}</span></div>
                                     <div className="h-px bg-slate-200 dark:bg-white/5" />
                                     <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-amber-500 uppercase">G501</span><span className="text-xs font-mono font-black text-slate-900 dark:text-amber-100">{item.estorno_g501 || "---"}</span></div>
                                  </div>
                               </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between p-5 bg-slate-100/50 dark:bg-black/60 rounded-[1.5rem] border border-slate-200 dark:border-white/5 relative overflow-hidden">
                               <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-emerald-500/5 opacity-50" />
                               
                               <div className="flex flex-col items-center relative z-10">
                                 <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Enviado</span>
                                 <span className="text-lg font-black text-slate-900 dark:text-white font-mono">{item.quantidade_enviada}</span>
                                 <span className="text-[7px] font-bold text-slate-500 mt-1">{formatPallets(item.quantidade_enviada, lote.grade, true)}</span>
                               </div>

                               <div className="flex items-center px-4 relative z-10">
                                 <div className="w-12 h-[1px] bg-slate-100 dark:bg-white/10 relative">
                                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                                   <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rounded-full border border-blue-500/30 flex items-center justify-center bg-white dark:bg-[#0F172A]">
                                     <ArrowRight size={8} className="text-blue-400" />
                                   </div>
                                 </div>
                               </div>

                               <div className="flex flex-col items-center relative z-10">
                                 <span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest mb-1">Retrabalhado</span>
                                 <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{item.quantidade_retornada}</span>
                                 <span className="text-[7px] font-bold text-emerald-500/50 mt-1">{formatPallets(item.quantidade_retornada, lote.grade, true)}</span>
                               </div>

                               <div className="flex items-center px-4 relative z-10">
                                 <div className="w-12 h-[1px] bg-slate-100 dark:bg-white/10 relative">
                                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
                                   <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rounded-full border border-emerald-500/30 flex items-center justify-center bg-white dark:bg-[#0F172A]">
                                     <ArrowRight size={8} className="text-emerald-400" />
                                   </div>
                                 </div>
                               </div>

                               <div className="flex flex-col items-end relative z-10 gap-2">
                                 <div className="flex items-center gap-4">
                                   <div className="flex flex-col items-end">
                                     <span className="text-[7px] font-black text-amber-500 uppercase tracking-widest mb-1">Emb. Avariada</span>
                                     <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono leading-none">{item.embalagens_avariadas || 0}</span>
                                   </div>
                                   <div className="flex flex-col items-end">
                                     <span className="text-[7px] font-black text-rose-500 uppercase tracking-widest mb-1">Rejeitado</span>
                                     <span className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono leading-none">{item.quantidade_rejeitada || 0}</span>
                                   </div>
                                 </div>
                                 {user && (
                                   <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setEditingReserva(item);
                                       setTempStatus(item.status);
                                     }}
                                     className="p-1.5 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-all border border-slate-200 dark:border-white/5"
                                   >
                                     <RefreshCw size={10} />
                                   </button>
                                 )}
                               </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </motion.div>
            ))}
            </>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="flex flex-col items-center justify-center py-24 bg-white dark:bg-[#0F172A]/30 border border-dashed border-slate-200 dark:border-white/10 rounded-[3rem] shadow-2xl backdrop-blur-sm"
            >
              <div className="w-24 h-24 rounded-full bg-blue-500/5 border border-blue-500/10 flex items-center justify-center mb-8 relative">
                <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping opacity-20" />
                <Package size={40} className="text-blue-600 dark:text-blue-500/30" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest mb-3">
                Nenhum lote aqui
              </h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] text-center max-w-sm px-10 leading-relaxed">
                {activeStatus === 'Aguardando' 
                  ? "Não há lotes separados no momento. Aguardando a preparação dos itens para o retrabalho." 
                  : "Não encontramos registros para este filtro ou pesquisa."}
              </p>
              {(search || activeStatus !== 'all') && (
                <button 
                  onClick={() => { setSearch(""); setActiveStatus("all"); }}
                  className="mt-8 px-8 py-3 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] transition-all flex items-center gap-3"
                >
                  <RefreshCw size={12} />
                  Limpar Filtros
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Modal Novo Lote */}
      <AnimatePresence>
        {isNewLoteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsNewLoteModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <Plus className="text-blue-600 dark:text-blue-500" /> Novo Lote de Retrabalho
              </h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  lote: Number(formData.get('lote')),
                  codigo: String(formData.get('codigo')),
                  status: String(formData.get('status')),
                  embalagens: Number(formData.get('embalagens')),
                };
                
                const { error } = await supabase.from('lotes_config').insert([data]);
                if (!error) {
                  setIsNewLoteModalOpen(false);
                  fetchData();
                } else {
                  alert("Erro ao criar lote: " + error.message);
                }
              }} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Número do Lote</label>
                  <input 
                    name="lote" 
                    required 
                    type="number" 
                    defaultValue={Math.max(...lotesConfig.map(l => Number(l.lote) || 0), 0) + 1}
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500/50 transition-all" 
                    placeholder="Ex: 4" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Código do Produto (SKU)</label>
                  <input name="codigo" required type="text" className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500/50 transition-all" placeholder="Ex: 0685-04" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Embalagens</label>
                    <input name="embalagens" required type="number" className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500/50 transition-all" placeholder="Qtd" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Status Inicial</label>
                    <select name="status" className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500/50 transition-all appearance-none">
                      <option value="Em fila">Em fila</option>
                      <option value="Aguardando">Aguardando</option>
                      <option value="Em andamento">Em andamento</option>
                    </select>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsNewLoteModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white text-[11px] font-black uppercase transition-all">Cancelar</button>
                  <button type="submit" className="flex-2 px-8 py-3 rounded-xl bg-blue-600 text-white text-[11px] font-black uppercase shadow-lg shadow-blue-500/20 transition-all">Criar Lote</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Nova Reserva */}
      <AnimatePresence>
        {isNewReservaModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsNewReservaModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-teal-600" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                <Plus className="text-emerald-500" /> Nova Reserva
              </h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-6">Lote: {selectedLoteForReserva}</p>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  lote: selectedLoteForReserva,
                  quantidade_enviada: Number(formData.get('quantidade_enviada')),
                  reserva_a501: String(formData.get('reserva_a501')),
                  reserva_g501: String(formData.get('reserva_g501')),
                  data_inicio: new Date().toISOString(),
                  status: 'EM ANDAMENTO'
                };
                
                const { error } = await supabase.from('retrabalhos').insert([data]);
                if (!error) {
                  setIsNewReservaModalOpen(false);
                  fetchData();
                } else {
                  alert("Erro ao adicionar reserva: " + error.message);
                }
              }} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Quantidade Enviada</label>
                  <input name="quantidade_enviada" required type="number" className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500/50 transition-all" placeholder="Ex: 500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Reserva A501</label>
                    <input name="reserva_a501" className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500/50 transition-all" placeholder="OP" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Reserva G501</label>
                    <input name="reserva_g501" className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500/50 transition-all" placeholder="OP" />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsNewReservaModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white text-[11px] font-black uppercase transition-all">Cancelar</button>
                  <button type="submit" className="flex-2 px-8 py-3 rounded-xl bg-emerald-600 text-white text-[11px] font-black uppercase shadow-lg shadow-emerald-500/20 transition-all">Adicionar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modal Editar Reserva */}
      <AnimatePresence>
        {editingReserva && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingReserva(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600 to-orange-600" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                <RefreshCw className="text-amber-500" /> Atualizar Produção
              </h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-6">Reserva: {editingReserva.reserva_a501 || editingReserva.reserva_g501}</p>
              
              <form id="edit-reserva-form" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  quantidade_retornada: Number(formData.get('quantidade_retornada')),
                  quantidade_rejeitada: Number(formData.get('quantidade_rejeitada')),
                  embalagens_avariadas: Number(formData.get('embalagens_avariadas')),
                  estorno_a501: String(formData.get('estorno_a501')),
                  estorno_g501: String(formData.get('estorno_g501')),
                  status: String(formData.get('status'))
                };
                
                const { error } = await supabase.from('retrabalhos').update(data).eq('id', editingReserva.id);
                if (!error) {
                  setEditingReserva(null);
                  fetchData();
                } else {
                  alert("Erro ao atualizar: " + error.message);
                }
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 block text-center">Retrabalhado</label>
                    <input name="quantidade_retornada" defaultValue={editingReserva.quantidade_retornada} required type="number" className="no-spinner w-full bg-slate-50 dark:bg-black/40 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 font-mono text-center text-lg focus:outline-none focus:border-emerald-500/50 transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 block text-center">Rejeitado</label>
                    <input name="quantidade_rejeitada" defaultValue={editingReserva.quantidade_rejeitada} required type="number" className="no-spinner w-full bg-slate-50 dark:bg-black/40 border border-rose-500/20 rounded-xl px-4 py-3 text-rose-400 font-mono text-center text-lg focus:outline-none focus:border-rose-500/50 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1.5 block text-center">Embalagens Avariadas</label>
                  <input name="embalagens_avariadas" defaultValue={editingReserva.embalagens_avariadas} required type="number" className="no-spinner w-full bg-slate-50 dark:bg-black/40 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 font-mono text-center text-lg focus:outline-none focus:border-amber-500/50 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Estorno A501</label>
                    <input name="estorno_a501" defaultValue={editingReserva.estorno_a501} className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500/50 transition-all" placeholder="OP Estorno" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Estorno G501</label>
                    <input name="estorno_g501" defaultValue={editingReserva.estorno_g501} className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500/50 transition-all" placeholder="OP Estorno" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Status da Produção</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'EM ANDAMENTO', label: 'Em Andamento', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', active: 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20', icon: PlayCircle },
                      { id: 'PAUSADO', label: 'Pausado', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', active: 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-500/20', icon: PauseCircle },
                      { id: 'FINALIZADO', label: 'Finalizado', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', active: 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/20', icon: CheckCircle2 },
                    ].map((status) => (
                      <button
                        key={status.id}
                        type="button"
                        onClick={() => setTempStatus(status.id)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all duration-300",
                          tempStatus === status.id ? status.active : cn(status.bg, status.border, status.color, "hover:bg-slate-50 dark:hover:bg-white/5")
                        )}
                      >
                        <status.icon size={14} />
                        {status.label}
                      </button>
                    ))}
                    <input type="hidden" name="status" value={tempStatus} />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setEditingReserva(null)} className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white text-[11px] font-black uppercase transition-all">Cancelar</button>
                  <button type="submit" className="flex-2 px-8 py-3 rounded-xl bg-amber-600 text-white text-[11px] font-black uppercase shadow-lg shadow-amber-500/20 transition-all">Salvar Alterações</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modal Editar Lote */}
      <AnimatePresence>
        {editingLote && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingLote(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                <RefreshCw className="text-blue-600 dark:text-blue-500" /> Editar Status do Lote
              </h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-6">Lote: {editingLote.lote} - {editingLote.codigo}</p>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const statusValue = String(formData.get('status'));
                
                // Tentamos atualizar usando 'Status' (maiúsculo) que é o padrão da tabela lotes_config
                const { error } = await supabase.from('lotes_config').update({ Status: statusValue }).eq('lote', editingLote.lote);
                
                if (!error) {
                  setEditingLote(null);
                  fetchData();
                } else {
                  // Se falhar, tentamos 'status' (minúsculo) como fallback ou exibimos o erro real
                  const { error: error2 } = await supabase.from('lotes_config').update({ status: statusValue }).eq('lote', editingLote.lote);
                  if (!error2) {
                    setEditingLote(null);
                    fetchData();
                  } else {
                    alert("Erro ao atualizar lote: " + error.message);
                  }
                }
              }} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Novo Status do Lote</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Aguardando', label: 'Aguardando', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', active: 'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-500/20', icon: Hourglass },
                      { id: 'Em andamento', label: 'Em andamento', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', active: 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20', icon: PlayCircle },
                      { id: 'Pausado', label: 'Pausado', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', active: 'bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-500/20', icon: PauseCircle },
                    ].map((status) => (
                      <button
                        key={status.id}
                        type="button"
                        onClick={() => setTempStatus(status.id)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                          tempStatus === status.id ? status.active : cn(status.bg, status.border, status.color, "hover:bg-slate-50 dark:hover:bg-white/5")
                        )}
                      >
                        <status.icon size={12} />
                        {status.label}
                      </button>
                    ))}
                    <input type="hidden" name="status" value={tempStatus} />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setEditingLote(null)} className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white text-[11px] font-black uppercase transition-all">Cancelar</button>
                  <button type="submit" className="flex-2 px-8 py-3 rounded-xl bg-blue-600 text-white text-[11px] font-black uppercase shadow-lg shadow-blue-500/20 transition-all">Salvar Status</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
