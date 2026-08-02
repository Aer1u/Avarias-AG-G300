"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { 
  Package, 
  Plus, 
  Search, 
  RefreshCw, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Truck, 
  Inbox,
  X,
  FileText,
  Save,
  Loader2,
  LayoutGrid,
  TrendingDown,
  TrendingUp,
  Layers,
  ShoppingCart
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

interface BaseCodigo {
  "Código": string
  "Descrição": string
  "Grade"?: string | number
}

interface MapeamentoRecord {
  id: number
  "Código": string
  "Quantidade": number
  "Posição": string
}

interface EmbalagemRegistro {
  id?: number
  codigo: string
  quantidade: number | null
  data?: string | null
  chegada?: string | null
  isNew?: boolean
  isDirty?: boolean
}

interface SkuRow {
  codigo: string
  descricao: string
  avarias: number
  estoque: number
  pedidas: number
  chegando: number
  totalCoberto: number
  deficit: number
  saldo: number
  pctCoberto: number
}

// ─── Animated Number ───────────────────────────────────────────────────────────
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const duration = 900
    const step = 16
    const increment = value / (duration / step)
    const timer = setInterval(() => {
      start += increment
      if (start >= value) {
        setDisplay(value)
        clearInterval(timer)
      } else {
        setDisplay(Math.round(start))
      }
    }, step)
    return () => clearInterval(timer)
  }, [value])
  return <span className={className}>{display.toLocaleString("pt-BR")}</span>
}

// ─── Coverage Waterfall Chart ──────────────────────────────────────────────────
function CoverageWaterfall({
  avarias,
  estoque,
  pedidas,
  chegando,
  deficit,
}: {
  avarias: number
  estoque: number
  pedidas: number
  chegando: number
  deficit: number
}) {
  const safe = (v: number) => (isNaN(v) || !isFinite(v) ? 0 : v)
  const total = safe(avarias) || 1
  const pctEstoque = Math.min(100, (safe(estoque) / total) * 100)
  const pctPedidas = Math.min(100 - pctEstoque, (safe(pedidas) / total) * 100)
  const pctChegando = Math.min(100 - pctEstoque - pctPedidas, (safe(chegando) / total) * 100)
  const pctDeficit = Math.max(0, 100 - pctEstoque - pctPedidas - pctChegando)
  const pctTotal = Math.min(100, pctEstoque + pctPedidas + pctChegando)

  return (
    <div className="space-y-3 w-full">
      {/* Main stacked bar */}
      <div className="relative h-10 w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-700/60 shadow-inner">
        {/* Background deficit zone */}
        <div className="absolute inset-0 bg-rose-950/30" />

        {/* Estoque */}
        {pctEstoque > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pctEstoque}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            className="absolute left-0 top-0 h-full bg-emerald-500"
          />
        )}
        {/* Pedidas */}
        {pctPedidas > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pctPedidas}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            style={{ left: `${pctEstoque}%` }}
            className="absolute top-0 h-full bg-blue-600"
          />
        )}
        {/* Chegando */}
        {pctChegando > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pctChegando}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
            style={{ left: `${pctEstoque + pctPedidas}%` }}
            className="absolute top-0 h-full bg-indigo-500"
          />
        )}

        {/* Coverage percentage label inside bar */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold text-white drop-shadow tracking-wider uppercase font-sans">
            {Math.round(pctTotal)}% COBERTO
          </span>
        </div>
      </div>

      {/* Segment labels */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "CD / Conserto", value: estoque, color: "bg-emerald-500", pct: pctEstoque, textColor: "text-emerald-400" },
          { label: "Solicitado", value: pedidas, color: "bg-blue-600", pct: pctPedidas, textColor: "text-blue-400" },
          { label: "Chegando", value: chegando, color: "bg-indigo-500", pct: pctChegando, textColor: "text-indigo-400" },
          { label: "Falta Pedir", value: deficit, color: "bg-rose-500/60", pct: pctDeficit, textColor: "text-rose-400" },
        ].map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className={cn("w-2.5 h-2.5 rounded-sm flex-shrink-0", seg.color)} />
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{seg.label}</p>
              <p className={cn("text-xs font-bold font-mono", seg.textColor)}>
                {seg.value.toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Per-SKU Mini Coverage Bar ─────────────────────────────────────────────────
function SkuCoverageBar({ row }: { row: SkuRow }) {
  const total = row.avarias || 1
  const pctE = Math.min(100, (row.estoque / total) * 100)
  const pctP = Math.min(100 - pctE, (row.pedidas / total) * 100)
  const pctC = Math.min(100 - pctE - pctP, (row.chegando / total) * 100)
  const covered = pctE + pctP + pctC

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-slate-800 relative">
        <div className="absolute inset-0 bg-rose-950/40 rounded-full" />
        {pctE > 0 && (
          <div style={{ width: `${pctE}%` }} className="absolute left-0 top-0 h-full bg-emerald-500 rounded-l-full" />
        )}
        {pctP > 0 && (
          <div style={{ left: `${pctE}%`, width: `${pctP}%` }} className="absolute top-0 h-full bg-blue-600" />
        )}
        {pctC > 0 && (
          <div style={{ left: `${pctE + pctP}%`, width: `${pctC}%` }} className="absolute top-0 h-full bg-indigo-500" />
        )}
      </div>
      <span className={cn(
        "text-[10px] font-bold font-mono w-9 text-right",
        covered >= 100 ? "text-emerald-400" : covered > 0 ? "text-amber-400" : "text-rose-400"
      )}>
        {Math.round(covered)}%
      </span>
    </div>
  )
}

export default function EmbalagensTab({ refreshTrigger }: { refreshTrigger?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [baseCodigos, setBaseCodigos] = useState<BaseCodigo[]>([])
  const [mapeamentoData, setMapeamentoData] = useState<MapeamentoRecord[]>([])
  
  const [pedidas, setPedidas] = useState<EmbalagemRegistro[]>([])
  const [atuais, setAtuais] = useState<EmbalagemRegistro[]>([])
  const [chegando, setChegando] = useState<EmbalagemRegistro[]>([])
  
  const [subTab, setSubTab] = useState<"comparativo" | "pedidas" | "atuais" | "chegando">("comparativo")
  const [search, setSearch] = useState("")
  const [user, setUser] = useState<any>(null)
  const [activeSkuDropdown, setActiveSkuDropdown] = useState<{ type: string, index: number } | null>(null)
  const [skuSearchCell, setSkuSearchCell] = useState("")
  const [sortBy, setSortBy] = useState<"avaria" | "deficit" | "estoque" | "cobertura_asc" | "cobertura_desc" | "az">("avaria")
  const [filterMode, setFilterMode] = useState<"todos" | "com_estoque" | "com_deficit" | "cobertos" | "sem_embalagem">("todos")
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState("")
  const [replaceExistingData, setReplaceExistingData] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setActiveSkuDropdown(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const [historicoData, setHistoricoData] = useState<any[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      let histData: any[] = []
      const histRes1 = await supabase.from("Registros").select("*")
      if (histRes1.data && histRes1.data.length > 0) {
        histData = histRes1.data
      } else {
        const histRes2 = await supabase.from("registros").select("*")
        if (histRes2.data) histData = histRes2.data
      }

      const [baseRes, mapRes, pRes, aRes, cRes] = await Promise.all([
        supabase.from("base_codigos").select("*"),
        supabase.from("mapeamento").select('id, "Código", "Quantidade", "Posição"'),
        supabase.from("embalagens_pedidas").select("*").order("data", { ascending: false }),
        supabase.from("embalagens_atuais").select("*").order("chegada", { ascending: false }),
        supabase.from("embalagens_chegando").select("*").order("data", { ascending: false }),
      ])
      setBaseCodigos(baseRes.data || [])
      setMapeamentoData(mapRes.data || [])
      setHistoricoData(histData)
      setPedidas(pRes.data || [])
      setAtuais(aRes.data || [])
      setChegando(cRes.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [refreshTrigger])

  // ─── Aggregations ──────────────────────────────────────────────────────────
  const avariasPerSku = useMemo(() => {
    const m: Record<string, number> = {}
    const parseBrNum = (val: any): number => {
      if (val === null || val === undefined || val === '') return 0
      if (typeof val === 'number') return val
      const clean = String(val).replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
      const parsed = parseFloat(clean)
      return isNaN(parsed) ? 0 : parsed
    }

    historicoData.forEach(r => {
      const ent = parseBrNum(r['Entrada'] || r['entrada'])
      const sai = parseBrNum(r['Saída'] || r['saida'] || r['Saida'] || r['saída'])
      const skuRaw = String(r['Produto'] || r['produto'] || r['Código'] || r['codigo'] || r['Codigo'] || "").trim().toUpperCase()
      const sku = skuRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      if (sku && sku !== "-" && sku !== "NAN") {
        m[sku] = (m[sku] || 0) + (ent - sai)
      }
    })
    return m
  }, [historicoData])

  const pedidasPerSku = useMemo(() => {
    const m: Record<string, number> = {}
    pedidas.filter(r => !r.isNew).forEach(r => {
      const c = String(r.codigo || "").trim().toUpperCase()
      if (c) m[c] = (m[c] || 0) + (Number(r.quantidade) || 0)
    })
    return m
  }, [pedidas])

  const atuaisPerSku = useMemo(() => {
    const m: Record<string, number> = {}
    atuais.filter(r => !r.isNew).forEach(r => {
      const c = String(r.codigo || "").trim().toUpperCase()
      if (c) m[c] = (m[c] || 0) + (Number(r.quantidade) || 0)
    })
    return m
  }, [atuais])

  const chegandoPerSku = useMemo(() => {
    const m: Record<string, number> = {}
    chegando.filter(r => !r.isNew).forEach(r => {
      const c = String(r.codigo || "").trim().toUpperCase()
      if (c) m[c] = (m[c] || 0) + (Number(r.quantidade) || 0)
    })
    return m
  }, [chegando])

  const allSkuRows = useMemo<SkuRow[]>(() => {
    const skusSet = new Set<string>()
    baseCodigos.forEach(b => { const c = String(b["Código"] || "").trim().toUpperCase(); if (c) skusSet.add(c) })
    ;[avariasPerSku, atuaisPerSku, pedidasPerSku, chegandoPerSku].forEach(m => Object.keys(m).forEach(k => skusSet.add(k)))

    return Array.from(skusSet).map(code => {
      const base = baseCodigos.find(b => String(b["Código"]).trim().toUpperCase() === code)
      const avarias = avariasPerSku[code] || 0
      const estoque = atuaisPerSku[code] || 0
      const p = pedidasPerSku[code] || 0
      const c = chegandoPerSku[code] || 0
      const totalCoberto = estoque + p + c
      const deficit = Math.max(0, avarias - totalCoberto)
      const saldo = totalCoberto - avarias
      const pctCoberto = avarias > 0 ? Math.min(100, Math.round((totalCoberto / avarias) * 100)) : (totalCoberto > 0 ? 100 : 0)
      return { codigo: code, descricao: base?.["Descrição"] || code, avarias, estoque, pedidas: p, chegando: c, totalCoberto, deficit, saldo, pctCoberto }
    })
  }, [baseCodigos, avariasPerSku, atuaisPerSku, pedidasPerSku, chegandoPerSku])

  const filteredSkuRows = useMemo(() => {
    let active = allSkuRows.filter(s => s.codigo in avariasPerSku || s.estoque > 0 || s.pedidas > 0 || s.chegando > 0)
    // text search
    if (search) {
      const t = search.toLowerCase()
      active = active.filter(s => s.codigo.toLowerCase().includes(t) || s.descricao.toLowerCase().includes(t))
    }
    // quick filter
    if (filterMode === "com_estoque") active = active.filter(s => s.estoque > 0)
    else if (filterMode === "com_deficit") active = active.filter(s => s.deficit > 0)
    else if (filterMode === "cobertos") active = active.filter(s => s.deficit === 0 && s.avarias > 0)
    else if (filterMode === "sem_embalagem") active = active.filter(s => s.estoque === 0 && s.pedidas === 0 && s.chegando === 0 && s.avarias > 0)
    // sort
    if (sortBy === "avaria") active = [...active].sort((a, b) => b.avarias - a.avarias)
    else if (sortBy === "deficit") active = [...active].sort((a, b) => b.deficit - a.deficit)
    else if (sortBy === "estoque") active = [...active].sort((a, b) => b.estoque - a.estoque)
    else if (sortBy === "cobertura_desc") active = [...active].sort((a, b) => b.pctCoberto - a.pctCoberto)
    else if (sortBy === "cobertura_asc") active = [...active].sort((a, b) => a.pctCoberto - b.pctCoberto)
    else if (sortBy === "az") active = [...active].sort((a, b) => a.codigo.localeCompare(b.codigo))
    return active
  }, [allSkuRows, search, avariasPerSku, filterMode, sortBy])

  // ─── Global KPIs ──────────────────────────────────────────────────────────
  const totalAvarias = useMemo(() => Object.values(avariasPerSku).reduce((a, c) => a + c, 0), [avariasPerSku])
  const totalEstoque = useMemo(() => Object.values(atuaisPerSku).reduce((a, c) => a + c, 0), [atuaisPerSku])
  const totalPedidas = useMemo(() => Object.values(pedidasPerSku).reduce((a, c) => a + c, 0), [pedidasPerSku])
  const totalChegando = useMemo(() => Object.values(chegandoPerSku).reduce((a, c) => a + c, 0), [chegandoPerSku])
  const totalDeficit = useMemo(() => filteredSkuRows.reduce((a, s) => a + s.deficit, 0), [filteredSkuRows])
  const globalPct = totalAvarias > 0 ? Math.min(100, Math.round(((totalEstoque + totalPedidas + totalChegando) / totalAvarias) * 100)) : 0

  // ─── Spreadsheet helpers ───────────────────────────────────────────────────
  const activeList = useMemo(() => {
    const list = subTab === "pedidas" ? pedidas : subTab === "atuais" ? atuais : chegando
    if (!search) return list
    const t = search.toLowerCase()
    return list.filter(r => r.codigo.toLowerCase().includes(t) || (baseCodigos.find(b => b["Código"].toUpperCase() === r.codigo.toUpperCase())?.["Descrição"] || "").toLowerCase().includes(t))
  }, [subTab, pedidas, atuais, chegando, search, baseCodigos])

  const hasUnsaved = useMemo(() => {
    if (subTab === "pedidas") return pedidas.some(r => r.isDirty)
    if (subTab === "atuais") return atuais.some(r => r.isDirty)
    if (subTab === "chegando") return chegando.some(r => r.isDirty)
    return false
  }, [subTab, pedidas, atuais, chegando])

  const cellSkus = useMemo(() => {
    if (!skuSearchCell) return baseCodigos.slice(0, 8)
    const t = skuSearchCell.toLowerCase()
    return baseCodigos.filter(b => b["Código"].toLowerCase().includes(t) || b["Descrição"].toLowerCase().includes(t)).slice(0, 8)
  }, [baseCodigos, skuSearchCell])

  const addRow = () => {
    if (!user) { alert("Faça login para adicionar lançamentos."); return }
    const today = new Date().toISOString().split("T")[0]
    const row: EmbalagemRegistro = { codigo: "", quantidade: null, isNew: true, isDirty: true }
    if (subTab === "pedidas") { row.data = today; setPedidas([row, ...pedidas]) }
    else if (subTab === "atuais") { row.chegada = today; setAtuais([row, ...atuais]) }
    else if (subTab === "chegando") { row.data = today; setChegando([row, ...chegando]) }
  }

  const updateRow = (idx: number, field: keyof EmbalagemRegistro, value: any) => {
    if (subTab === "pedidas") { const u = [...pedidas]; u[idx] = { ...u[idx], [field]: value, isDirty: true }; setPedidas(u) }
    else if (subTab === "atuais") { const u = [...atuais]; u[idx] = { ...u[idx], [field]: value, isDirty: true }; setAtuais(u) }
    else if (subTab === "chegando") { const u = [...chegando]; u[idx] = { ...u[idx], [field]: value, isDirty: true }; setChegando(u) }
  }

  const removeRow = (idx: number) => {
    if (subTab === "pedidas") setPedidas(pedidas.filter((_, i) => i !== idx))
    else if (subTab === "atuais") setAtuais(atuais.filter((_, i) => i !== idx))
    else if (subTab === "chegando") setChegando(chegando.filter((_, i) => i !== idx))
  }

  const saveRows = async () => {
    const listMap = { pedidas: { list: pedidas, table: "embalagens_pedidas" }, atuais: { list: atuais, table: "embalagens_atuais" }, chegando: { list: chegando, table: "embalagens_chegando" } }
    const { list, table } = listMap[subTab as keyof typeof listMap]
    const dirty = list.filter(r => r.isDirty)
    if (!dirty.length) return
    if (dirty.some(r => !r.codigo || !r.quantidade || Number(r.quantidade) <= 0)) {
      alert("Preencha o SKU e quantidade > 0 em todas as linhas."); return
    }
    setSaving(true)
    try {
      for (const row of dirty) {
        const payload: any = { codigo: row.codigo.trim().toUpperCase(), quantidade: Number(row.quantidade) }
        payload[subTab === "atuais" ? "chegada" : "data"] = subTab === "atuais" ? row.chegada : row.data
        if (row.isNew) { const { error } = await supabase.from(table).insert([payload]); if (error) throw error }
      }
      alert("Lançamentos salvos!")
      fetchData()
    } catch (err: any) {
      alert("Erro: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteRecord = async (table: "embalagens_atuais" | "embalagens_pedidas" | "embalagens_chegando", id: number) => {
    if (!user) { alert("Faça login para excluir."); return }
    if (!confirm("Excluir este lançamento?")) return
    try {
      const { error } = await supabase.from(table).delete().eq("id", id)
      if (error) throw error
      fetchData()
    } catch (err: any) {
      alert("Erro: " + err.message)
    }
  }

  // ─── Donut arc helper ─────────────────────────────────────────────────────
  const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const toRad = (d: number) => (d * Math.PI) / 180
    const x1 = cx + r * Math.cos(toRad(startAngle - 90))
    const y1 = cy + r * Math.sin(toRad(startAngle - 90))
    const x2 = cx + r * Math.cos(toRad(endAngle - 90))
    const y2 = cy + r * Math.sin(toRad(endAngle - 90))
    const large = endAngle - startAngle > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  const totalAvariasDisplay = totalAvarias || 1
  const segments = [
    { label: "CD / Conserto", value: totalEstoque, color: "#10b981", glow: "rgba(16,185,129,0.3)" },
    { label: "Solicitado", value: totalPedidas, color: "#2563eb", glow: "rgba(37,99,235,0.3)" },
    { label: "Chegando", value: totalChegando, color: "#6366f1", glow: "rgba(99,102,241,0.3)" },
    { label: "Falta Pedir", value: totalDeficit, color: "#dc2626", glow: "rgba(220,38,38,0.2)" },
  ]

  // Build pie segments
  let currentAngle = 0
  const arcs = segments.map(seg => {
    const pct = Math.min(1, seg.value / totalAvariasDisplay)
    const angleDeg = pct * 360
    const arc = { ...seg, startAngle: currentAngle, endAngle: currentAngle + angleDeg, pct }
    currentAngle += angleDeg
    return arc
  })

  return (
    <div className="flex flex-col h-full space-y-6 pb-12 text-slate-200 font-sans">

      {/* ─── Header & Sub-tabs ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/10 p-2.5 rounded-xl border border-blue-500/20">
            <Package className="text-blue-400" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-wider leading-tight font-sans">Gestão de Embalagens</h2>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {[
              { id: "comparativo", label: "Painel Comparativo", icon: LayoutGrid, active: "bg-blue-600 border-blue-500" },
              { id: "pedidas", label: "Pedidos", icon: ShoppingCart, active: "bg-blue-600 border-blue-500" },
              { id: "atuais", label: "Estoque CD / Conserto", icon: Package, active: "bg-emerald-600 border-emerald-500" },
              { id: "chegando", label: "A Caminho", icon: Truck, active: "bg-indigo-600 border-indigo-500" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setSubTab(tab.id as any); setSearch(""); setActiveSkuDropdown(null) }}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer",
                  subTab === tab.id ? `${tab.active} text-white shadow-sm` : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                <tab.icon size={11} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder={subTab === "comparativo" ? "Buscar SKU..." : "Pesquisar..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 w-60 transition-all"
          />
        </div>
        <button onClick={fetchData} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer" title="Atualizar">
          <RefreshCw size={16} />
        </button>
        {subTab !== "comparativo" && user && (
          <>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              <Plus size={14} /> Importar Planilha
            </button>
            <button onClick={addRow} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">
              <Plus size={14} /> Nova Linha
            </button>
            <button
              onClick={saveRows}
              disabled={saving || !hasUnsaved}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                hasUnsaved ? "bg-blue-600 hover:bg-blue-500 text-white shadow" : "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
              )}
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              Salvar
            </button>
          </>
        )}
      </div>
    </div>

    <AnimatePresence mode="wait">
      {subTab === "comparativo" ? (
        <motion.div key="comparativo" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">

          {/* ─── MAIN ANALYTICS DASHBOARD ──────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">

            {/* LEFT: Waterfall + KPIs */}
            <div className="space-y-5">

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Avaria Física",
                    value: totalAvarias,
                    icon: AlertTriangle,
                    bg: "bg-[#111827] border-rose-500/30",
                    iconBg: "bg-rose-500/10 text-rose-400",
                    numColor: "text-white",
                    sub: "Total a cobrir",
                  },
                  {
                    label: "Estoque CD / Conserto",
                    value: totalEstoque,
                    icon: Package,
                    bg: "bg-[#111827] border-emerald-500/30",
                    iconBg: "bg-emerald-500/10 text-emerald-400",
                    numColor: "text-white",
                    sub: "Disponível agora",
                  },
                  {
                    label: "Solicitado",
                    value: totalPedidas,
                    icon: ShoppingCart,
                    bg: "bg-[#111827] border-blue-500/30",
                    iconBg: "bg-blue-500/10 text-blue-400",
                    numColor: "text-white",
                    sub: "Pedidos em aberto",
                  },
                  {
                    label: "Chegando",
                    value: totalChegando,
                    icon: Truck,
                    bg: "bg-[#111827] border-indigo-500/30",
                    iconBg: "bg-indigo-500/10 text-indigo-400",
                    numColor: "text-white",
                    sub: "Em trânsito",
                  },
                ].map((kpi) => (
                    <div key={kpi.label} className={cn("p-4 rounded-xl border flex items-start gap-3 shadow-sm", kpi.bg)}>
                      <div className={cn("p-2 rounded-lg flex-shrink-0", kpi.iconBg)}>
                        <kpi.icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{kpi.label}</p>
                        <AnimatedNumber value={kpi.value} className={cn("text-2xl font-bold font-mono block mt-0.5", kpi.numColor)} />
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{kpi.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Global Coverage Bar */}
                <div className="p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-md space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">Cobertura Global de Embalagens</h3>
                      <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">
                        Avarias físicas vs. insumos disponíveis (estoque + pedidos + chegando)
                      </p>
                    </div>
                    <div className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold font-mono",
                      totalDeficit === 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    )}>
                      {totalDeficit === 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {globalPct}% coberto
                    </div>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center h-12">
                      <Loader2 className="animate-spin text-blue-500" size={20} />
                    </div>
                  ) : (
                    <CoverageWaterfall
                      avarias={totalAvarias}
                      estoque={totalEstoque}
                      pedidas={totalPedidas}
                      chegando={totalChegando}
                      deficit={totalDeficit}
                    />
                  )}

                  {/* Deficit alert */}
                  {totalDeficit > 0 && !loading && (
                    <div className="flex items-start gap-3 mt-2 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <AlertTriangle className="text-rose-400 flex-shrink-0 mt-0.5" size={15} />
                      <div>
                        <p className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">
                          Déficit de {totalDeficit.toLocaleString("pt-BR")} embalagens
                        </p>
                        <p className="text-[10px] text-slate-300 mt-0.5 font-medium">
                          São necessários novos pedidos para cobrir a demanda restante de avarias físicas.
                          Verifique os SKUs com status pendente na tabela abaixo.
                        </p>
                      </div>
                    </div>
                  )}
                  {totalDeficit === 0 && !loading && totalAvarias > 0 && (
                    <div className="flex items-center gap-3 mt-2 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="text-emerald-400 flex-shrink-0" size={15} />
                      <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
                        Cobertura total atingida — todas as avarias estão cobertas por insumos.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Donut Chart */}
              <div className="p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-md flex flex-col">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1 font-sans">Distribuição de Cobertura</h3>
                <p className="text-[10px] text-slate-400 font-medium mb-5">Proporção por categoria vs. avarias</p>

                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="animate-spin text-blue-500" size={20} />
                  </div>
                ) : (
                  <>
                    {/* SVG Donut */}
                    <div className="flex justify-center mb-5">
                      <div className="relative">
                        <svg width={180} height={180} viewBox="0 0 200 200">
                          {/* Background ring */}
                          <circle cx={100} cy={100} r={75} fill="none" stroke="#1f293d" strokeWidth={26} />
                          
                          {/* Segments */}
                          {arcs.map((arc, i) => {
                            if (arc.pct <= 0) return null
                            const path = arc.endAngle - arc.startAngle >= 360
                              ? `M 100 25 A 75 75 0 1 1 99.99 25`
                              : describeArc(100, 100, 75, arc.startAngle, Math.min(arc.endAngle, arc.startAngle + 359.9))
                            return (
                              <path
                                key={i}
                                d={path}
                                fill="none"
                                stroke={arc.color}
                                strokeWidth={26}
                                strokeLinecap="butt"
                              />
                            )
                          })}

                          {/* Center text */}
                          <text x={100} y={93} textAnchor="middle" fill="#ffffff" fontSize={26} fontWeight={800} fontFamily="monospace">
                            {globalPct}%
                          </text>
                          <text x={100} y={112} textAnchor="middle" fill="#94a3b8" fontSize={9} fontWeight={700} letterSpacing={1.5} fontFamily="sans-serif">
                            COBERTO
                          </text>
                        </svg>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="space-y-2.5 flex-1">
                      {[
                        { label: "Avaria Física (Total)", value: totalAvarias, color: "bg-slate-600", pct: 100 },
                        { label: "Estoque CD / Conserto", value: totalEstoque, color: "bg-emerald-500", pct: totalAvarias > 0 ? Math.round((totalEstoque / totalAvarias) * 100) : 0 },
                        { label: "Solicitado / Pedido", value: totalPedidas, color: "bg-blue-600", pct: totalAvarias > 0 ? Math.round((totalPedidas / totalAvarias) * 100) : 0 },
                        { label: "A Caminho / Chegando", value: totalChegando, color: "bg-indigo-500", pct: totalAvarias > 0 ? Math.round((totalChegando / totalAvarias) * 100) : 0 },
                        { label: "Falta Solicitar", value: totalDeficit, color: "bg-rose-600", pct: totalAvarias > 0 ? Math.round((totalDeficit / totalAvarias) * 100) : 0 },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={cn("w-2.5 h-2.5 rounded-sm flex-shrink-0", item.color)} />
                            <span className="text-[10px] font-medium text-slate-300 truncate">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-bold font-mono text-white">{item.value.toLocaleString("pt-BR")}</span>
                            <span className="text-[9px] font-medium text-slate-400 w-8 text-right">{item.pct}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ─── SKU TABLE ─────────────────────────────────────────────── */}
            {/* ─── SKU TABLE ─────────────────────────────────────────────── */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              {/* Table header row */}
              <div className="px-6 py-4 border-b border-slate-800 bg-[#161f32] flex flex-wrap gap-4 justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">Painel SKU — Físico × Insumos</h3>
                  <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                    Cobertura individual por produto · Evite pedidos duplicados
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const avariasList = allSkuRows.filter(s => s.avarias > 0)
                      if (!avariasList.length) { alert("Nenhuma avaria física registrada."); return }
                      let csv = "\uFEFFSKU;Descrição;Avaria Física;Estoque Atual;Pedidos Pendentes;A Caminho;Déficit\n"
                      avariasList.forEach(s => {
                        csv += `"${s.codigo}";"${s.descricao.replace(/"/g, '""')}";${s.avarias};${s.estoque};${s.pedidas};${s.chegando};${s.deficit}\n`
                      })
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
                      const link = document.createElement("a")
                      link.href = URL.createObjectURL(blob)
                      link.setAttribute("download", `avarias_fisicas_${new Date().toISOString().split("T")[0]}.csv`)
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    }}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    <FileText size={12} /> Exportar Avarias
                  </button>
                  <button
                    onClick={() => {
                      const deficitList = allSkuRows.filter(s => s.deficit > 0)
                      if (!deficitList.length) { alert("Nenhum déficit de embalagens encontrado!"); return }
                      let csv = "\uFEFFSKU;Descrição;Falta Pedir (Déficit);Avaria Física;Estoque CD;Solicitado;A Caminho\n"
                      deficitList.forEach(s => {
                        csv += `"${s.codigo}";"${s.descricao.replace(/"/g, '""')}";${s.deficit};${s.avarias};${s.estoque};${s.pedidas};${s.chegando}\n`
                      })
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
                      const link = document.createElement("a")
                      link.href = URL.createObjectURL(blob)
                      link.setAttribute("download", `falta_pedir_${new Date().toISOString().split("T")[0]}.csv`)
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    }}
                    className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    <AlertTriangle size={12} /> Exportar Falta Pedir
                  </button>
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-lg font-mono whitespace-nowrap">
                    {filteredSkuRows.length} SKUs
                  </span>
                </div>
              </div>

              {/* ─── Filter + Sort bar ─────────────────────────────────────── */}
              <div className="px-6 py-3 border-b border-slate-800 flex flex-wrap gap-3 items-center justify-between bg-[#111827]">
                {/* Quick filter chips */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filtrar:</span>
                  {([
                    { id: "todos",        label: "Todos",          dot: "bg-slate-400" },
                    { id: "com_deficit",  label: "Com Déficit",    dot: "bg-rose-500" },
                    { id: "sem_embalagem",label: "Sem Embalagem",  dot: "bg-amber-500" },
                    { id: "com_estoque",  label: "Com Estoque",    dot: "bg-emerald-500" },
                    { id: "cobertos",     label: "100% Cobertos",  dot: "bg-blue-500" },
                  ] as { id: typeof filterMode; label: string; dot: string }[]).map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFilterMode(f.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer",
                        filterMode === f.id
                          ? "bg-blue-600 border-blue-500 text-white shadow-sm"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                      )}
                    >
                      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", f.dot)} />
                      {f.label}
                      {f.id !== "todos" && (
                        <span className="text-[9px] opacity-80 font-mono">
                          ({f.id === "com_deficit"
                            ? allSkuRows.filter(s => (s.codigo in avariasPerSku || s.estoque > 0 || s.pedidas > 0 || s.chegando > 0) && s.deficit > 0).length
                            : f.id === "sem_embalagem"
                            ? allSkuRows.filter(s => s.avarias > 0 && s.estoque === 0 && s.pedidas === 0 && s.chegando === 0).length
                            : f.id === "com_estoque"
                            ? allSkuRows.filter(s => (s.codigo in avariasPerSku || s.estoque > 0 || s.pedidas > 0 || s.chegando > 0) && s.estoque > 0).length
                            : allSkuRows.filter(s => (s.codigo in avariasPerSku || s.estoque > 0 || s.pedidas > 0 || s.chegando > 0) && s.deficit === 0 && s.avarias > 0).length
                          })
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Sort select */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ordenar:</span>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none pr-7 relative"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
                  >
                    <option value="avaria">↓ Maior Avaria</option>
                    <option value="deficit">↓ Maior Déficit</option>
                    <option value="estoque">↓ Maior Estoque</option>
                    <option value="cobertura_asc">↑ Menor Cobertura %</option>
                    <option value="cobertura_desc">↓ Maior Cobertura %</option>
                    <option value="az">A → Z (SKU)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#161f32] whitespace-nowrap">
                      <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-36">SKU</th>
                      <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descrição</th>
                      <th className="px-6 py-3.5 text-[10px] font-bold text-rose-400 uppercase tracking-wider text-center w-28">Avaria</th>
                      <th className="px-6 py-3.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider text-center w-28">Estoque</th>
                      <th className="px-6 py-3.5 text-[10px] font-bold text-blue-400 uppercase tracking-wider text-center w-28">Solicitado</th>
                      <th className="px-6 py-3.5 text-[10px] font-bold text-indigo-400 uppercase tracking-wider text-center w-28">Chegando</th>
                      <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-44">Cobertura</th>
                      <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center w-36">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-[#111827]">
                    {loading ? (
                      <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-500" />
                        Carregando dados...
                      </td></tr>
                    ) : filteredSkuRows.length === 0 ? (
                      <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                        <Inbox size={28} className="mx-auto mb-2 text-slate-600" />
                        Nenhum SKU ativo encontrado.
                      </td></tr>
                    ) : filteredSkuRows.map(sku => (
                      <tr key={sku.codigo} className="hover:bg-slate-800/40 transition-colors whitespace-nowrap group">
                        <td className="px-6 py-3.5 text-xs font-bold text-white font-mono whitespace-nowrap tracking-wider">{sku.codigo}</td>
                        <td className="px-6 py-3.5 text-xs font-medium text-slate-300 max-w-[240px] truncate whitespace-nowrap" title={sku.descricao}>{sku.descricao}</td>
                        <td className="px-6 py-3.5 text-xs font-bold text-rose-400 font-mono text-center whitespace-nowrap">{sku.avarias.toLocaleString("pt-BR")}</td>
                        <td className="px-6 py-3.5 text-xs font-bold text-emerald-400 font-mono text-center whitespace-nowrap">{sku.estoque.toLocaleString("pt-BR")}</td>
                        <td className="px-6 py-3.5 text-xs font-bold text-blue-400 font-mono text-center whitespace-nowrap">{sku.pedidas.toLocaleString("pt-BR")}</td>
                        <td className="px-6 py-3.5 text-xs font-bold text-indigo-400 font-mono text-center whitespace-nowrap">{sku.chegando.toLocaleString("pt-BR")}</td>
                        <td className="px-6 py-3.5 w-44">
                          <SkuCoverageBar row={sku} />
                        </td>
                        <td className="px-6 py-3.5 text-center whitespace-nowrap">
                          {sku.deficit === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                              <CheckCircle2 size={10} /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-400 uppercase tracking-wider font-mono">
                              <AlertTriangle size={10} /> {sku.deficit.toLocaleString("pt-BR")} FALTAM
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ─── SPREADSHEET TABS ──────────────────────────────────────────── */
          <motion.div key="spreadsheet" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-md"
          >
            <div className="px-6 py-4 border-b border-slate-800 bg-[#161f32]">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                {subTab === "pedidas" ? "Planilha de Pedidos / Solicitações" : subTab === "atuais" ? "Estoque Atual CD / Conserto" : "Cargas a Caminho"}
              </h3>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                Lançamento direto na planilha · Alterações afetam o painel comparativo em tempo real
              </p>
            </div>

            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#161f32]">
                    <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[160px]">Data</th>
                    <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[220px]">SKU</th>
                    <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descrição</th>
                    <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center w-[140px]">Quantidade</th>
                    <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right w-[80px]">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-[#111827]">
                  {loading ? (
                    <tr><td colSpan={5} className="px-8 py-10 text-center text-slate-500">
                      <Loader2 className="animate-spin text-blue-500 mx-auto mb-2" size={20} />
                      Carregando...
                    </td></tr>
                  ) : activeList.length === 0 ? (
                    <tr><td colSpan={5} className="px-8 py-10 text-center text-slate-600">
                      <Inbox size={22} className="mx-auto mb-2" />
                      Nenhum lançamento. Clique em 'Nova Linha'.
                    </td></tr>
                  ) : activeList.map((item, idx) => {
                    const base = baseCodigos.find(b => String(b["Código"]).trim().toUpperCase() === String(item.codigo).trim().toUpperCase())
                    const dateVal = item.chegada || item.data || ""
                    return (
                      <tr key={item.id || `new-${idx}`} className={cn(
                        "hover:bg-white/[0.015] transition-colors relative",
                        item.isDirty && "bg-blue-500/[0.03]",
                        item.isNew && "bg-emerald-500/[0.03]"
                      )}>
                        {/* Date */}
                        <td className="p-0 border-r border-white/5">
                          {item.isNew ? (
                            <input type="date" value={dateVal}
                              onChange={e => updateRow(idx, subTab === "atuais" ? "chegada" : "data", e.target.value)}
                              className="w-full bg-transparent border-none px-8 py-3.5 text-xs text-slate-300 focus:bg-slate-900 focus:outline-none font-mono [color-scheme:dark]"
                            />
                          ) : (
                            <div className="px-8 py-3.5 text-xs font-mono text-slate-500">
                              {dateVal ? dateVal.split("-").reverse().join("/") : "—"}
                            </div>
                          )}
                        </td>

                        {/* SKU */}
                        <td className="p-0 border-r border-white/5 relative">
                          {item.isNew ? (
                            <div className="relative w-full">
                              <input type="text" value={item.codigo}
                                onChange={e => { updateRow(idx, "codigo", e.target.value); setSkuSearchCell(e.target.value); setActiveSkuDropdown({ type: subTab, index: idx }) }}
                                onClick={() => { setSkuSearchCell(item.codigo); setActiveSkuDropdown({ type: subTab, index: idx }) }}
                                placeholder="Pesquisar SKU..."
                                className="w-full bg-transparent border-none px-8 py-3.5 text-xs text-white font-mono focus:bg-slate-900/60 focus:outline-none whitespace-nowrap"
                              />
                              {activeSkuDropdown?.type === subTab && activeSkuDropdown?.index === idx && cellSkus.length > 0 && (
                                <div ref={dropdownRef} className="absolute z-50 w-[300px] left-8 bottom-full mb-1 bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl p-2 space-y-1 transform -translate-y-[calc(100%+3.5rem)]">
                                  {cellSkus.map(b => (
                                    <button key={b["Código"]} type="button"
                                      onClick={() => { updateRow(idx, "codigo", b["Código"]); setActiveSkuDropdown(null) }}
                                      className="w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold flex justify-between text-slate-400 hover:bg-white/5 hover:text-white transition-all"
                                    >
                                      <span className="font-mono text-blue-400">{b["Código"]}</span>
                                      <span className="opacity-60 max-w-[140px] truncate">{b["Descrição"]}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="px-8 py-3.5 text-xs font-bold text-white font-mono whitespace-nowrap">{item.codigo}</div>
                          )}
                        </td>

                        {/* Desc */}
                        <td className="px-8 py-3.5 text-xs font-semibold text-slate-500 max-w-xs truncate">
                          {base?.["Descrição"] || (item.codigo ? `Produto ${item.codigo}` : "—")}
                        </td>

                        {/* Qty */}
                        <td className="p-0 border-l border-white/5 text-center">
                          {item.isNew ? (
                            <input type="text" value={item.quantidade === null ? "" : item.quantidade}
                              onChange={e => updateRow(idx, "quantidade", e.target.value === "" ? null : Number(e.target.value.replace(/\D/g, "")))}
                              placeholder="0"
                              className="w-full bg-transparent border-none py-3.5 text-center text-xs text-white font-mono focus:bg-slate-900/60 focus:outline-none"
                            />
                          ) : (
                            <div className="py-3.5 text-xs font-bold text-white font-mono text-center">
                              {item.quantidade ? item.quantidade.toLocaleString("pt-BR") : "0"}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-8 py-3 text-right">
                          {item.isNew ? (
                            <button onClick={() => removeRow(idx)} className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all" title="Cancelar">
                              <X size={13} />
                            </button>
                          ) : (
                            user && (
                              <button onClick={() => deleteRecord(subTab === "pedidas" ? "embalagens_pedidas" : subTab === "atuais" ? "embalagens_atuais" : "embalagens_chegando", item.id!)}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all active:scale-95" title="Excluir">
                                <Trash2 size={13} />
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── IMPORT MODAL ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-2xl rounded-[2.5rem] bg-[#090D16] p-8 shadow-2xl border border-white/5 flex flex-col max-h-[90vh] text-slate-200"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight">
                  <Plus className="text-emerald-400" size={20} />
                  Importar {subTab === "pedidas" ? "Pedidos" : subTab === "atuais" ? "Estoque CD / Conserto" : "A Caminho"}
                </h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col flex-1 min-h-0 gap-6">
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    Cole os dados da planilha Excel ou Sheets abaixo. Ordem esperada:<br />
                    <span className="font-bold text-white uppercase tracking-wider">DATA | CÓDIGO | QUANTIDADE</span> (separados por TAB).
                  </p>
                  <div className="relative flex-1 min-h-[220px]">
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      className="w-full h-full min-h-[220px] bg-white/[0.02] border border-white/5 rounded-2xl px-4 py-4 text-xs font-mono text-white placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none overflow-y-auto custom-scrollbar"
                      placeholder={`Exemplo:&#10;2026-05-25	1705-01	150&#10;2026-05-25	2955-01	30`}
                    />
                  </div>
                </div>

                {/* Switch to Replace / Append */}
                <div className="flex items-center justify-between p-4 bg-white/[0.01] border border-white/5 rounded-2xl">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Substituir Dados</span>
                    <span className="text-[10px] text-slate-500">Limpa todos os dados existentes antes de inserir.</span>
                  </div>
                  <button
                    onClick={() => setReplaceExistingData(!replaceExistingData)}
                    className={cn(
                      "w-12 h-6 rounded-full p-1 transition-colors relative duration-200",
                      replaceExistingData ? "bg-emerald-600" : "bg-slate-800"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full bg-white transition-transform duration-200",
                        replaceExistingData ? "translate-x-6" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* Attention message */}
                {replaceExistingData && (
                  <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="text-rose-400 flex-shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      <span className="font-black text-rose-300 uppercase">Atenção:</span> Esta operação irá{" "}
                      <span className="font-bold text-rose-400 underline decoration-wavy">SOBRESCREVER E LIMPAR</span> toda a tabela de{" "}
                      {subTab === "pedidas" ? "embalagens_pedidas" : subTab === "atuais" ? "embalagens_atuais" : "embalagens_chegando"}{" "}
                      no Supabase com o novo conteúdo colado acima.
                    </p>
                  </div>
                )}

                <button
                  disabled={isImporting || !importText.trim()}
                  onClick={async () => {
                    let lines = importText.trim().split("\n").filter((l) => l.trim())
                    if (lines.length === 0) return

                    // Ignorar cabeçalho se colado junto
                    const first = lines[0].toLowerCase()
                    if (first.includes("data") || first.includes("código") || first.includes("codigo") || first.includes("quantidade") || first.includes("qtd")) {
                      lines = lines.slice(1)
                    }

                    if (lines.length === 0) {
                      alert("Nenhum dado válido encontrado.")
                      return
                    }

                    const targetTable = subTab === "pedidas" ? "embalagens_pedidas" : subTab === "atuais" ? "embalagens_atuais" : "embalagens_chegando"
                    if (!confirm(`Confirmar importação de ${lines.length} itens? Isso será gravado no Supabase.`)) return

                    setIsImporting(true)
                    try {
                      const payload = lines.map((line) => {
                        const cols = line.split("\t")
                        const dateCol = String(cols[0] || "").trim()
                        const skuCol = String(cols[1] || "").trim().toUpperCase()
                        const qtyCol = Number(String(cols[2] || "0").replace(/\D/g, ""))

                        const obj: any = {
                          codigo: skuCol,
                          quantidade: qtyCol,
                        }
                        if (subTab === "atuais") {
                          obj.chegada = dateCol || new Date().toISOString().split("T")[0]
                        } else {
                          obj.data = dateCol || new Date().toISOString().split("T")[0]
                        }
                        return obj
                      })

                      // Se o usuário optou por limpar/substituir a tabela
                      if (replaceExistingData) {
                        const { error: delErr } = await supabase.from(targetTable).delete().neq("codigo", "placeholder_xyz")
                        if (delErr) throw delErr
                      }

                      // Gravação em blocos
                      const chunkSize = 150
                      for (let i = 0; i < payload.length; i += chunkSize) {
                        const chunk = payload.slice(i, i + chunkSize)
                        const { error: insErr } = await supabase.from(targetTable).insert(chunk)
                        if (insErr) throw insErr
                      }

                      alert("Importação concluída com sucesso!")
                      setImportText("")
                      setShowImportModal(false)
                      fetchData()
                    } catch (err: any) {
                      alert("Erro ao importar: " + err.message)
                    } finally {
                      setIsImporting(false)
                    }
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {isImporting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  Gravar e Atualizar Portal BR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
