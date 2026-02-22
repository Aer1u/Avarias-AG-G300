"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Package,
  BarChart3,
  ShieldCheck,
  TrendingUp,
  Search,
  RefreshCw,
  Download,
  AlertCircle,
  LayoutGrid,
  MapPin,
  Tag,
  ArrowDownWideNarrow,
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
  Flame,
  PieChart,
  Info,
  Layers,
  Zap,
  Star,
  Activity,
  Box,
  Layout,
  Menu,
  X,
  ExternalLink,
  Table as TableIcon
} from "lucide-react"
import { MetricCard } from "@/components/MetricCard"
import { WarehouseTable } from "@/components/WarehouseTable"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

type ViewType = "geral" | "posicoes" | "nao_alocados" | "produtos"
type DisplayMode = "mapa" | "tabela"
type SortType = "none" | "qty_desc" | "qty_asc" | "alpha_asc"

// Helper: show 1 decimal only if value is < 1 (e.g., shared pallets like 0.5), otherwise integer
const fmtNum = (val: number, locale = 'pt-BR') =>
  val < 1 && val > 0
    ? val.toLocaleString(locale, { maximumFractionDigits: 1 })
    : Math.round(val).toLocaleString(locale)

export default function DashboardPage() {
  const [data, setData] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeView, setActiveView] = useState<ViewType>("posicoes")
  const [displayMode, setDisplayMode] = useState<DisplayMode>("mapa")
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [tableSort, setTableSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "posicao", direction: "asc" })
  const [sortMode, setSortMode] = useState<SortType>("none")
  const [isChartHovered, setIsChartHovered] = useState(false)
  const rowsPerPage = 10

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [dataRes, statsRes] = await Promise.all([
        fetch("https://avarias-ag-g300.onrender.com/api/data"),
        fetch("https://avarias-ag-g300.onrender.com/api/stats")
      ])

      if (!dataRes.ok || !statsRes.ok) throw new Error("Erro ao carregar dados")

      const [dataJson, statsJson] = await Promise.all([
        dataRes.json(),
        statsRes.json()
      ])

      setData(dataJson)
      setStats(statsJson)
    } catch (err) {
      setError("Falha na conexão com o servidor. Verifique se o backend está rodando.")
      console.error(err)
    } finally {
      setTimeout(() => setLoading(false), 800)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // street processing logic (Integrated)
  const streetData = useMemo(() => {
    const streets = {
      "1G": { even: [] as any[], odd: [] as any[] },
      "1F": { even: [] as any[], odd: [] as any[] },
      "2G": { even: [] as any[], odd: [] as any[] },
      "3G": { odd: [] as any[] }
    }

    const posMap = new Map()
    data.forEach(item => {
      const posId = item.posicao || "S/P"
      if (!posMap.has(posId)) {
        posMap.set(posId, {
          id: posId,
          paletes: 0,
          capacidade: item.capacidade || 0,
          products: []
        })
      }
      const entry = posMap.get(posId)
      entry.paletes += (item.paletes || 0)
      if (item.produto) {
        const total = item.quantidade_total || 0
        const damaged = item.qtd_molhado || 0
        entry.products.push({
          sku: item.produto,
          quantidade: total - damaged,
          quantidade_total: total,
          paletes: item.paletes,
          nivel: item.nivel || "N/A",
          profundidade: item.profundidade || item.Profundidade || "-",
          qtd_por_palete: item.qtd_por_palete || item["Quantidade/palete"] || 0,
          qtd_tombada: item.qtd_tombada || 0,
          qtd_molhado: item.qtd_molhado || 0,
          pos_interna: item.posicao_interna || item.posicao?.split('-')?.pop() || "N/A"
        })
      }
    })

    posMap.forEach((p, id) => {
      // Regex adjusted for the format: G30000[STREET][NUMBER]
      // Example: G300001G0071 -> Street: 1G, Number Area: 0071
      const match = id.match(/(1G|1F|2G|3G)(\d+)/i)
      if (match) {
        const prefix = match[1].toUpperCase()
        const fullNumStr = match[2]
        // Often the last digit is a level/sub-pos, let's take the meaningful part for the street number
        // In G300001G0071, 007 might be the bay and 1 the level, or 0071 could be the slot.
        // Based on common warehouse patterns, usually it's [BAY][LEVEL]. 
        // Let's take the first 3 digits as the bay number for parity check.
        const bayNum = parseInt(fullNumStr.substring(0, 3))
        const isEven = bayNum % 2 === 0

        if (prefix === "3G") {
          // Rule for 3G: usually only odd or specific sides, but let's keep it flexible
          if (!isEven) {
            streets["3G"].odd.push(p)
          } else {
            // If 3G has even, we'll need to define where it goes. 
            // The template only had 'odd', but let's allow it to exist or just push to odd if it's the only side
            streets["3G"].odd.push(p)
          }
        } else {
          const s = streets[prefix as "1G" | "1F" | "2G"]
          if (s) {
            const side = isEven ? "even" : "odd"
            s[side].push(p)
          }
        }
      }
    })

    const sortPos = (arr: any[]) => arr.sort((a, b) => {
      // Extract number part for sorting
      const matchA = a.id.match(/(1G|1F|2G|3G)(\d+)/i)
      const matchB = b.id.match(/(1G|1F|2G|3G)(\d+)/i)
      const numA = matchA ? parseInt(matchA[2]) : 0
      const numB = matchB ? parseInt(matchB[2]) : 0
      return numA - numB
    })

    Object.values(streets).forEach(s => {
      if ('even' in s) sortPos(s.even)
      if ('odd' in s) sortPos(s.odd)
    })

    return streets
  }, [data])

  // View Aggregation & Filtering Logic
  const processedData = useMemo(() => {
    let baseData = []

    if (activeView === "posicoes") {
      const posMap = new Map()
      data.forEach(item => {
        const pos = item.posicao || "S/P"
        if (!posMap.has(pos)) {
          posMap.set(pos, {
            posicao: pos,
            paletes: 0,
            quantidade_total: 0,
            skus: new Set(),
            nivel: item.nivel,
            capacidade: item.capacidade || 0
          })
        }
        const entry = posMap.get(pos)
        entry.paletes += (item.paletes || 0)
        entry.quantidade_total += (item.quantidade_total || 0)
        entry.dmg_molhado = (entry.dmg_molhado || 0) + (item.qtd_molhado || 0)
        if (item.produto) entry.skus.add(item.produto)
      })

      baseData = Array.from(posMap.values()).map(item => ({
        ...item,
        sku_count: item.skus.size,
        quantidade: item.quantidade_total - (item.dmg_molhado || 0),
        ocupacao: item.capacidade > 0 ? (item.paletes / item.capacidade * 100) : 0,
        drive_status: item.skus.size > 1 ? "MISTURADO" : "MONO",
        is_complete: item.capacidade > 0 && item.paletes >= item.capacidade ? "COMPLETO" : "DISPONÍVEL"
      }))
    } else if (activeView === "produtos") {
      const productMap = new Map()
      data.forEach(item => {
        const prod = item.produto || "Não Identificado"
        if (!productMap.has(prod)) {
          productMap.set(prod, {
            produto: prod,
            paletes: 0,
            quantidade_total: 0,
            posicoes: new Set()
          })
        }
        const entry = productMap.get(prod)
        entry.paletes += (item.paletes || 0)
        entry.quantidade_total += (item.quantidade_total || 0)
        entry.dmg_molhado = (entry.dmg_molhado || 0) + (item.qtd_molhado || 0)
        if (item.posicao) entry.posicoes.add(item.posicao)
      })

      baseData = Array.from(productMap.values()).map(item => ({
        ...item,
        posicao_count: item.posicoes.size,
        quantidade: item.quantidade_total - (item.dmg_molhado || 0)
      }))

      const sortedForRank = [...baseData].sort((a, b) => (b.quantidade_total || 0) - (a.quantidade_total || 0))
      const top3Names = sortedForRank.slice(0, 3).map(p => p.produto)

      baseData = baseData.map(item => ({
        ...item,
        rank: top3Names.indexOf(item.produto) !== -1 ? top3Names.indexOf(item.produto) + 1 : null
      }))
    } else if (activeView === "nao_alocados") {
      baseData = data.filter(item => {
        const pos = String(item.posicao || "").toUpperCase()
        return !pos || pos === "S/P" || pos === "N/A" || pos === "NÃO INFORMADO" || pos === "-"
      }).map(item => ({
        ...item,
        posicao: item.posicao || "S/P"
      }))
    } else {
      baseData = [...data]
    }

    // Global Sort Mode (The Buttons)
    if (sortMode === "qty_desc") {
      baseData.sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0))
    } else if (sortMode === "alpha_asc") {
      baseData.sort((a, b) => {
        const key = activeView === "produtos" ? "produto" : "posicao"
        return String(a[key]).localeCompare(String(b[key]))
      })
    }

    // Generic sorting for Table (Overrides global sort if header is clicked)
    if (tableSort.key && tableSort.key !== "none") {
      baseData.sort((a, b) => {
        let valA = a[tableSort.key]
        let valB = b[tableSort.key]

        if (valA === undefined || valA === null) valA = ""
        if (valB === undefined || valB === null) valB = ""

        if (typeof valA === "string") valA = valA.toLowerCase()
        if (typeof valB === "string") valB = valB.toLowerCase()

        if (valA < valB) return tableSort.direction === "asc" ? -1 : 1
        if (valA > valB) return tableSort.direction === "asc" ? 1 : -1
        return 0
      })
    }

    // Rank items for Products view after sorting
    if (activeView === "produtos") {
      const sortedByQty = [...baseData].sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0));
      const rankMap = new Map(sortedByQty.map((p, i) => [p.produto, i + 1]));
      baseData = baseData.map(item => ({
        ...item,
        rank: rankMap.get(item.produto)
      }))
    }

    return baseData
  }, [data, activeView, sortMode, tableSort])

  const handleSort = (key: string) => {
    setTableSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }))
  }

  const filteredData = useMemo(() => {
    return processedData.filter(item =>
      Object.values(item).some(val =>
        String(val).toLowerCase().includes(search.toLowerCase())
      )
    )
  }, [processedData, search])

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / rowsPerPage)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filteredData.slice(start, start + rowsPerPage)
  }, [filteredData, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeView, search, sortMode])

  // Advanced Stats Calculation
  const advancedStats = useMemo(() => {
    const posMap = new Map()
    const capBreakdown = new Map()
    const globalPosMap = new Map()
    const posOccupancy = new Map()

    data.forEach(item => {
      let activePos = item.posicao

      // Ultra-robust fallback: if posicao is N/A, check if any key or value looks like G300
      if (!activePos || activePos === 'N/A') {
        const potentialKey = Object.keys(item).find(k => k.startsWith('G300'))
        if (potentialKey) {
          activePos = item[potentialKey]
        } else {
          // Check values
          const potentialVal = Object.values(item).find(v => String(v).startsWith('G300'))
          if (potentialVal) activePos = String(potentialVal)
        }
      }

      if (activePos && activePos !== 'N/A') {
        if (!globalPosMap.has(activePos)) {
          globalPosMap.set(activePos, new Set())
          posOccupancy.set(activePos, 0)
        }
        if (item.produto) globalPosMap.get(activePos).add(item.produto)

        const cap = item.capacidade || 0
        posMap.set(activePos, cap)
        posOccupancy.set(activePos, posOccupancy.get(activePos) + (item.paletes || 0))
      }
    })

    let mixedCount = 0
    let monoCount = 0
    let completoCount = 0
    let disponivelCount = 0
    let alocadosPallets = 0
    let naoAlocadosPallets = 0
    let molhadosPallets = 0
    let tombadosPallets = 0

    const checkStatus = (item: any) => {
      const prod = String(item.produto || "").toLowerCase()
      if (prod.includes("molhado")) molhadosPallets += (item.paletes || 0)
      if (prod.includes("tombado")) tombadosPallets += (item.paletes || 0)
    }

    globalPosMap.forEach((skus, pos) => {
      const posUpper = pos.toUpperCase()
      const isAllocated = pos && posUpper !== "S/P" && posUpper !== "N/A" && posUpper !== "NÃO INFORMADO" && posUpper !== "-"

      if (skus.size > 1) mixedCount++
      else if (skus.size === 1) monoCount++

      const cap = posMap.get(pos) || 0
      const occ = posOccupancy.get(pos) || 0

      if (cap > 0 && occ >= cap) {
        completoCount++
      } else {
        disponivelCount++
      }
    })

    data.forEach(item => {
      const posUpper = String(item.posicao || "").toUpperCase()
      const isAllocated = posUpper && posUpper !== "S/P" && posUpper !== "N/A" && posUpper !== "NÃO INFORMADO" && posUpper !== "-"

      if (isAllocated) alocadosPallets += (item.paletes || 0)
      else naoAlocadosPallets += (item.paletes || 0)

      checkStatus(item)
    })

    posMap.forEach((cap) => {
      capBreakdown.set(cap, (capBreakdown.get(cap) || 0) + 1)
    })

    const totalCapacity = Array.from(posMap.values()).reduce((sum, cap) => sum + cap, 0)
    const totalPositions = posMap.size
    const occupied = stats?.total_pallets || 0
    const free = Math.max(0, totalCapacity - occupied)
    const occupiedPercent = totalCapacity > 0 ? (occupied / totalCapacity) * 100 : 0

    const sortedBreakdown = Array.from(capBreakdown.entries())
      .map(([cap, count]) => ({ capacity: cap, count }))
      .sort((a, b) => a.capacity - b.capacity)

    return {
      totalCapacity, totalPositions, occupied, free, occupiedPercent,
      breakdown: sortedBreakdown,
      mixedCount, monoCount, completoCount, disponivelCount,
      mixPercent: totalPositions > 0 ? (mixedCount / totalPositions) * 100 : 0,
      alocadosPallets, naoAlocadosPallets, molhadosPallets, tombadosPallets
    }
  }, [data, stats])

  const getColumns = () => {
    if (activeView === "posicoes") {
      return [
        {
          header: "Posição",
          accessor: "posicao",
          render: (val: string) => (
            <span className="font-black text-slate-900 tracking-tight">
              {val}
            </span>
          )
        },
        { header: "Capacidade", accessor: "capacidade", render: (val: number) => fmtNum(val) },
        { header: "Paletes", accessor: "paletes", render: (val: number) => fmtNum(val) },
        { header: "Diversidade", accessor: "sku_count" },
        {
          header: "Mix",
          accessor: "drive_status",
          render: (val: string) => (
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase",
              val === "MISTURADO" ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
            )}>
              {val}
            </span>
          )
        },
        {
          header: "Ocupação",
          accessor: "ocupacao",
          render: (val: number) => (
            <div className="flex w-32 items-center gap-2">
              <div className="h-1.5 w-full rounded-full bg-slate-50 overflow-hidden border border-slate-100/50">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(val, 100)}%` }}
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    val >= 100 ? "bg-red-500" : val >= 75 ? "bg-orange-500" : "bg-blue-500"
                  )}
                />
              </div>
              <span className="text-[10px] font-black text-slate-400">{Math.round(val)}%</span>
            </div>
          )
        },
        {
          header: "Lotação",
          accessor: "is_complete",
          render: (val: string) => (
            <span className={cn(
              "inline-flex items-center rounded-full px-3 py-1.5 text-[10px] font-black uppercase shadow-sm transition-all",
              val === "COMPLETO" ? "bg-blue-600 text-white shadow-blue-100/50" : "bg-slate-100 text-slate-400 border border-slate-200"
            )}>
              {val}
            </span>
          )
        },
      ]
    }

    if (activeView === "produtos") {
      return [
        {
          header: "Produto",
          accessor: "produto",
          render: (val: string, item: any) => (
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl font-black transition-all",
                item.rank === 1 ? "bg-orange-600 text-white shadow-lg shadow-orange-200" :
                  item.rank === 2 ? "bg-orange-500 text-white shadow-md shadow-orange-100/50" :
                    item.rank === 3 ? "bg-orange-400/80 text-white shadow-sm" :
                      "bg-slate-50 text-slate-400 border border-slate-100"
              )}>
                {item.rank}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  {item.rank === 1 && <Flame size={14} className="text-orange-500 fill-orange-500 animate-pulse" />}
                  {item.rank === 2 && <Flame size={14} className="text-orange-500 fill-orange-500/50" />}
                  {item.rank === 3 && <Flame size={14} className="text-orange-500/70" />}
                  <span className={cn(
                    "text-sm font-black group-hover:text-blue-600 transition-colors uppercase tracking-tight",
                    item.rank <= 3 ? "text-blue-600" : "text-slate-900"
                  )}>
                    {val}
                  </span>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase">{item.posicao_count} Posições</span>
              </div>
            </div>
          )
        },
        { header: "Paletes", accessor: "paletes", render: (val: number) => fmtNum(val) },
        {
          header: "Quantidade",
          accessor: "quantidade",
          render: (val: number, item: any) => (
            <span className={cn(
              "font-black px-2 py-0.5 rounded-lg transition-all",
              item.rank <= 3 ? "text-blue-600 bg-blue-50/50 font-extrabold" : "text-slate-900"
            )}>
              {fmtNum(val)}
            </span>
          )
        },
        { header: "Nº de Posições", accessor: "posicao_count" },
      ]
    }

    if (activeView === "nao_alocados") {
      return [
        {
          header: "Produto",
          accessor: "produto",
          render: (val: string) => (
            <span className="font-bold text-slate-800">
              {val || "Não Identificado"}
            </span>
          )
        },
        { header: "Quantidade", accessor: "quantidade_total", render: (val: number) => fmtNum(val) },
        { header: "Paletes", accessor: "paletes", render: (val: number) => fmtNum(val) + " PTs" },
        {
          header: "Status",
          accessor: "posicao",
          render: () => (
            <span className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-100">
              Aguardando Alocação
            </span>
          )
        },
      ]
    }

    return [
      { header: "Posição", accessor: "posicao" },
      { header: "Principal SKU", accessor: "produto" },
      { header: "Capacidade", accessor: "capacidade", render: (val: any) => <span className="font-black text-slate-400">{fmtNum(val)} PTs</span> },
      { header: "Quantidade", accessor: "quantidade_total", render: (val: any) => <span className="font-black text-slate-800">{fmtNum(val)}</span> },
      { header: "Paletes", accessor: "paletes", render: (val: any) => <span className="font-black text-slate-900">{fmtNum(val)} PTs</span> },
      {
        header: "Ocupação",
        accessor: "ocupacao",
        render: (val: number) => (
          <div className="flex items-center gap-3 w-32">
            <div className="flex-1 h-1.5 rounded-full bg-slate-50 overflow-hidden border border-slate-100">
              <div className={cn("h-full transition-all duration-1000",
                val >= 100 ? "bg-red-500" :
                  val >= 75 ? "bg-orange-500" :
                    "bg-blue-500"
              )} style={{ width: `${Math.min(val, 100)}%` }} />
            </div>
            <span className="text-[10px] font-black text-slate-400">{Math.round(val)}%</span>
          </div>
        )
      },
    ]
  }

  const positionDetail = useMemo(() => {
    if (!selectedPosition) return null

    const matches = data.filter(item => item.posicao === selectedPosition)
    if (matches.length === 0) return null

    return {
      id: selectedPosition,
      capacidade: matches[0].capacidade || 0,
      occupied: matches.reduce((sum, item) => sum + (item.paletes || 0), 0),
      level_count: new Set(matches.map(m => m.nivel)).size,
      products: matches.map(m => ({
        sku: m.produto || "Não Identificado",
        nivel: m.nivel || "Térreo",
        quantidade: m.quantidade_total || 0,
        paletes: m.paletes || 0,
        profundidade: m.profundidade || m.Profundidade || "-",
        qtd_por_palete: m.qtd_por_palete || m["Quantidade/palete"] || 0,
        qtd_tombada: m.qtd_tombada || 0,
        qtd_molhado: m.qtd_molhado || 0
      }))
    }
  }, [selectedPosition, data])

  const productDetail = useMemo(() => {
    if (!selectedProduct) return null

    const matches = data.filter(item => item.produto === selectedProduct)
    if (matches.length === 0) return null

    return {
      sku: selectedProduct,
      total_paletes: matches.reduce((sum, item) => sum + (item.paletes || 0), 0),
      total_quantidade: matches.reduce((sum, item) => sum + (item.quantidade_total || 0), 0),
      positions: matches.map(m => ({
        posicao: m.posicao || "S/P",
        nivel: m.nivel || "Térreo",
        quantidade: m.quantidade_total || 0,
        paletes: m.paletes || 0,
        profundidade: m.profundidade || "-",
        qtd_tombada: m.qtd_tombada || 0,
        qtd_molhado: m.qtd_molhado || 0
      })).sort((a, b) => a.posicao.localeCompare(b.posicao))
    }
  }, [selectedProduct, data])

  return (
    <div className="min-h-screen bg-[#f8fafc] p-8 md:p-12 lg:p-16">
      <div className="mx-auto max-w-7xl space-y-12">

        {/* Header - Simple & Clean */}
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-xl shadow-blue-100">
              <Package className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Avarias <span className="text-blue-600">AG</span></h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Painel Operacional G300</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={fetchData} disabled={loading} className="group flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-black text-slate-600 shadow-sm border border-slate-100 transition-all hover:border-blue-200">
              <RefreshCw size={16} className={cn(loading ? "animate-spin" : "group-hover:rotate-180")} />
              Sincronizar
            </button>
            <button className="flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black text-white shadow-xl shadow-slate-200 transition-all hover:bg-slate-800">
              <Download size={16} />
              Exportar
            </button>
          </div>
        </header>

        {error && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-600 shadow-xl shadow-red-100">
            <AlertCircle size={20} />
            {error}
          </motion.div>
        )}

        {/* KPIs Row */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Paletes Totais"
            value={stats?.total_pallets?.toLocaleString('pt-BR') ?? "0"}
            icon={Package}
            delay={0.1}
            hoverContent={
              <div className="flex items-center justify-around gap-6 text-center min-w-[200px]">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase text-slate-400">Alocados</span>
                  <span className="text-xs font-black text-emerald-400">{fmtNum(advancedStats.alocadosPallets)}</span>
                </div>
                <div className="h-4 w-[1px] bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase text-slate-400">Não Alocados</span>
                  <span className="text-xs font-black text-orange-400">{fmtNum(advancedStats.naoAlocadosPallets)}</span>
                </div>
              </div>
            }
          />
          <MetricCard
            title="Peças Totais"
            value={stats?.total_quantity?.toLocaleString() ?? "0"}
            icon={BarChart3}
            delay={0.2}
            hoverContent={
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-center min-w-[200px]">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase text-slate-400">Alocadas</span>
                  <span className="text-xs font-black text-emerald-400">{fmtNum(data.filter(i => {
                    const p = String(i.posicao || "").toUpperCase();
                    return p && p !== "S/P" && p !== "N/A" && p !== "NÃO INFORMADO" && p !== "-";
                  }).reduce((s, i) => s + (i.quantidade_total || 0), 0))}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase text-slate-400">Não Alocadas</span>
                  <span className="text-xs font-black text-orange-400">{fmtNum(data.filter(i => {
                    const p = String(i.posicao || "").toUpperCase();
                    return !p || p === "S/P" || p === "N/A" || p === "NÃO INFORMADO" || p === "-";
                  }).reduce((s, i) => s + (i.quantidade_total || 0), 0))}</span>
                </div>
                <div className="col-span-2 h-[1px] bg-white/10 my-1" />
                <div className="flex flex-col border-r border-white/10 pr-6">
                  <span className="text-[8px] font-black uppercase text-slate-400">Molhadas</span>
                  <span className="text-xs font-black text-blue-400">{fmtNum(stats?.qtd_molhado || 0)} <span className="text-[8px] text-slate-500 font-medium">un</span></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase text-slate-400">Tombadas</span>
                  <span className="text-xs font-black text-red-500">{fmtNum(stats?.qtd_tombada || 0)} <span className="text-[8px] text-slate-500 font-medium">un</span></span>
                </div>
              </div>
            }
          />
          <MetricCard
            title="Drives Ativos"
            value={advancedStats.totalPositions}
            icon={ShieldCheck}
            delay={0.1}
            hoverContent={
              <div className="flex items-center justify-around gap-4 text-center">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase text-slate-400">Completos</span>
                  <span className="text-xs font-black text-emerald-400">{advancedStats.completoCount}</span>
                </div>
                <div className="h-4 w-[1px] bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase text-slate-400">Disponíveis</span>
                  <span className="text-xs font-black text-blue-400">{advancedStats.disponivelCount}</span>
                </div>
              </div>
            }
          />
          <MetricCard title="SKUs Ativos" value={stats?.total_skus ?? "0"} icon={TrendingUp} delay={0.4} />
        </div>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Capacity Donut */}
          <motion.div className="group relative rounded-[2.5rem] bg-white p-8 shadow-xl shadow-slate-200/50 border border-slate-50 overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black text-slate-800">Capacidade Física</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Volume Geográfico G300</p>
              </div>
              <PieChart size={20} className="text-blue-600" />
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-10">
              <div className="group/donut relative h-44 w-44 cursor-crosshair">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle className="text-slate-50" strokeWidth="12" stroke="currentColor" fill="transparent" r="38" cx="50" cy="50" />
                  <motion.circle className="text-blue-600" strokeWidth="12" strokeDasharray={2 * Math.PI * 38} initial={{ strokeDashoffset: 2 * Math.PI * 38 }} animate={{ strokeDashoffset: (2 * Math.PI * 38) * (1 - advancedStats.occupiedPercent / 100) }} strokeLinecap="round" stroke="currentColor" fill="transparent" r="38" cx="50" cy="50" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-900">{Math.round(advancedStats.occupiedPercent)}%</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase">USO</span>
                </div>

                {/* Capacity Breakdown Tooltip */}
                <div className="absolute top-1/2 left-full ml-4 -translate-y-1/2 hidden group-hover/donut:block z-50 w-64 pointer-events-none">
                  <div className="bg-slate-900/95 backdrop-blur-xl text-white rounded-3xl p-6 shadow-2xl border border-white/10">
                    <p className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em] mb-4">Composição de Frota</p>
                    <div className="space-y-3">
                      {advancedStats.breakdown.map((item: any) => (
                        <div key={item.capacity} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                            <span className="text-[11px] font-bold text-slate-200">Drive de {item.capacity} PTs</span>
                          </div>
                          <span className="text-sm font-black text-white">{item.count} <span className="text-[9px] text-slate-500 font-black">UNS</span></span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 pt-4 border-t border-white/5">
                      <p className="text-[9px] font-medium text-slate-400 leading-relaxed italic">Base geográfica calculada em tempo real com base na volumetria dos drives cadastrados.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2 w-full">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-slate-400" />
                    <span className="text-[9px] font-black text-slate-400 uppercase">Espaço Total</span>
                  </div>
                  <span className="text-sm font-black text-slate-900">{advancedStats.totalCapacity}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-[9px] font-black text-blue-600 uppercase">Vagas Ocupadas</span>
                  </div>
                  <span className="text-sm font-black text-blue-700">{advancedStats.occupied}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-black text-emerald-600 uppercase">Vagas Livres</span>
                  </div>
                  <span className="text-sm font-black text-emerald-700">{advancedStats.free}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Efficiency Card */}
          <motion.div className="group relative rounded-[2.5rem] bg-white p-8 shadow-xl shadow-slate-200/50 border border-slate-50 overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black text-slate-800">Distribuição de Mix</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Eficiência de Armazenagem</p>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 shadow-sm border border-orange-100">
                <Layers size={20} />
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1 space-y-6 w-full">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-600">
                    <span>Mono-produto</span>
                    <span>{(100 - advancedStats.mixPercent).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${100 - advancedStats.mixPercent}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-600">
                    <span>Misturado</span>
                    <span>{advancedStats.mixPercent.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <div className="h-full bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.3)]" style={{ width: `${advancedStats.mixPercent}%` }} />
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50/50 rounded-[2rem] border border-slate-100 flex flex-col items-center justify-center gap-6 min-w-[200px]">
                <div className="text-center">
                  <span className="text-3xl font-black text-emerald-600 tracking-tight">{advancedStats.monoCount}</span>
                  <div className="h-1 w-8 bg-slate-200 mx-auto my-1 rounded-full opacity-50" />
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Drives Organizados</p>
                </div>
                <div className="text-center">
                  <span className="text-3xl font-black text-red-600 tracking-tight">{advancedStats.mixedCount}</span>
                  <div className="h-1 w-8 bg-slate-200 mx-auto my-1 rounded-full opacity-50" />
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Drives Críticos</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* View Selection & Filters */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between pt-8 border-t border-slate-100">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
            <button
              onClick={() => setActiveView("geral")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-black transition-all",
                activeView === "geral" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <LayoutGrid size={14} /> Geral
            </button>
            <button
              onClick={() => setActiveView("posicoes")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-black transition-all",
                activeView === "posicoes" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <MapPin size={14} /> Posições
            </button>
            <button
              onClick={() => setActiveView("produtos")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-black transition-all",
                activeView === "produtos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Tag size={14} /> Produtos
            </button>
            <button
              onClick={() => setActiveView("nao_alocados")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-black transition-all",
                activeView === "nao_alocados" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <AlertCircle size={14} /> Não alocados
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl">
              <button onClick={() => { setSortMode("qty_desc"); setTableSort({ key: "none", direction: "asc" }); }} className={cn("px-4 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all", sortMode === "qty_desc" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                <ArrowDownWideNarrow size={14} className="inline mr-1" /> Maior Qtd.
              </button>
              <button onClick={() => { setSortMode("alpha_asc"); setTableSort({ key: "none", direction: "asc" }); }} className={cn("px-4 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all", sortMode === "alpha_asc" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                <ArrowDownAZ size={14} className="inline mr-1" /> A-Z
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input type="text" placeholder="Pesquisar detalhes..." className="w-64 rounded-2xl border border-slate-200 bg-white py-2.5 pl-11 pr-5 text-xs outline-none focus:border-slate-900 transition-all font-medium" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {/* --- MAIN DATA VIEW --- */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {activeView === "posicoes" && (
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setDisplayMode("mapa")} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", displayMode === "mapa" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50")}>MAPA</button>
                <button onClick={() => setDisplayMode("tabela")} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", displayMode === "tabela" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50")}>TABELA</button>
              </div>
            )}

            {activeView === "posicoes" && displayMode === "mapa" ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {Object.entries(streetData).map(([streetName, sections]) => (
                  <div key={streetName} className="p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs">{streetName}</div>
                      <h4 className="font-black text-slate-800 uppercase tracking-widest text-sm">Rua {streetName}</h4>
                    </div>
                    <div className="space-y-8">
                      {Object.entries(sections).map(([side, positions]) => (
                        <div key={side}>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Lado {side === "even" ? "PAR" : "ÍMPAR"}</p>
                          <div className="flex flex-wrap gap-2">
                            {positions.map((pos: any) => {
                              const isFull = pos.capacidade > 0 && pos.paletes >= pos.capacidade
                              const isAvailable = pos.paletes < pos.capacidade
                              return (
                                <div key={pos.id} className="group relative">
                                  <button onClick={() => setSelectedPosition(pos.id)} className={cn("h-10 w-10 rounded-lg border-2 flex items-center justify-center transition-all group-hover:scale-110", isFull ? "bg-red-50 border-red-500" : "bg-emerald-50 border-emerald-500")}>
                                    <span className={cn("text-[7px] font-black leading-none text-center px-0.5", isFull ? "text-red-600" : "text-emerald-700")}>
                                      {pos.id.match(/(1G|1F|2G|3G)(\d+)/i)?.[2]?.substring(0, 3) || pos.id.slice(-4)}
                                    </span>
                                  </button>

                                  {/* Floating Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-[100] w-52 pointer-events-none">
                                    <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-white/10 backdrop-blur-md relative">
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{pos.id}</span>
                                        <div className={cn("h-2 w-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)]", isFull ? "bg-red-500" : "bg-emerald-500")} />
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400">
                                          <span>Ocupação</span>
                                          <span className="text-white">{fmtNum(pos.paletes)}/{pos.capacidade || 4} PTs</span>
                                        </div>
                                        {pos.products.some((p: any) => p.qtd_molhado > 0 || p.qtd_tombada > 0) && (
                                          <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                                            {pos.products.map((p: any, idx: number) => (
                                              (p.qtd_molhado > 0 || p.qtd_tombada > 0) && (
                                                <div key={idx} className="flex flex-wrap gap-2 text-[8px] font-black uppercase">
                                                  {p.qtd_molhado > 0 && <span className="text-blue-400">Molhado: {fmtNum(p.qtd_molhado)}</span>}
                                                  {p.qtd_tombada > 0 && <span className="text-red-400">Tombado: {fmtNum(p.qtd_tombada)}</span>}
                                                </div>
                                              )
                                            ))}
                                          </div>
                                        )}
                                        {pos.products.length > 0 && (
                                          <div className="pt-2 border-t border-white/5 space-y-1">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">SKU Principal</p>
                                            <p className="text-[11px] font-black text-slate-100 truncate">{pos.products[0].sku}</p>
                                            {pos.products.length > 1 && (
                                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">+ {pos.products.length - 1} Itens (Mix)</p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900" />
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[2.5rem] bg-white border border-slate-100 shadow-xl overflow-hidden">
                <WarehouseTable
                  columns={getColumns()}
                  data={paginatedData}
                  delay={0.1}
                  onRowClick={(row) => {
                    if (activeView === "posicoes") setSelectedPosition(row.posicao)
                    if (activeView === "produtos") setSelectedProduct(row.produto)
                  }}
                  sortConfig={tableSort}
                  onSort={handleSort}
                />
              </div>
            )}

            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between px-4 pb-8">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-900"><ChevronLeft size={16} /></button>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-900"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* --- DRILL-DOWN MODAL --- */}
      <AnimatePresence>
        {selectedProduct && productDetail && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedProduct(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl max-h-[92vh] rounded-[3rem] bg-white p-8 md:p-10 shadow-2xl border border-white/20 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-3xl bg-emerald-600 flex items-center justify-center text-white shadow-xl shadow-emerald-200"><Tag size={24} /></div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-900">{selectedProduct}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{Math.round(productDetail.total_paletes)} Paletes • {Math.round(productDetail.total_quantidade).toLocaleString('pt-BR')} Peças</p>
                  </div>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1">
                <div className="overflow-hidden rounded-3xl border border-slate-100 bg-slate-50/30">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
                      <tr className="border-b border-slate-100">
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Posição</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Nível</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Prof.</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Qtd Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {productDetail.positions.map((p, idx) => (
                        <tr key={`${p.posicao}-${idx}`} className="group hover:bg-white transition-colors">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <MapPin size={14} />
                              </div>
                              <span className="text-sm font-black text-slate-800">{p.posicao}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className="inline-flex h-7 items-center rounded-lg bg-slate-100 px-3 text-[10px] font-black text-slate-600 uppercase">
                              {p.nivel}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className="text-xs font-black text-slate-500">{p.profundidade}</span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-900">{fmtNum(p.quantidade)}</span>
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase">{fmtNum(p.paletes)} PTs</span>
                                {p.qtd_molhado > 0 && <span className="text-[9px] font-black text-blue-500 uppercase">| {fmtNum(p.qtd_molhado)} M</span>}
                                {p.qtd_tombada > 0 && <span className="text-[9px] font-black text-red-500 uppercase">| {fmtNum(p.qtd_tombada)} T</span>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-10 p-6 rounded-3xl bg-emerald-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3"><Zap size={20} className="fill-white/20" /><p className="text-xs font-bold">Resumo: Produto distribuído em {productDetail.positions.length} posições</p></div>
                <button className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-[10px] font-black uppercase hover:bg-white/20 transition-all border border-white/10">Ver no Mapa <ExternalLink size={12} /></button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPosition && positionDetail && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPosition(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl max-h-[92vh] rounded-[3rem] bg-white p-8 md:p-10 shadow-2xl border border-white/20 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-3xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-200"><MapPin size={24} /></div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-900">{selectedPosition}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{fmtNum(positionDetail.occupied)} / {positionDetail.capacidade} Paletes • {positionDetail.level_count} Níveis</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPosition(null)} className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1">
                <div className="overflow-hidden rounded-3xl border border-slate-100 bg-slate-50/30">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
                      <tr className="border-b border-slate-100">
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Produto / SKU</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Nível</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Prof.</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Qtd/PT</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Qtd Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {positionDetail.products.map((p, idx) => (
                        <tr key={`${p.sku}-${idx}`} className="group hover:bg-white transition-colors">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                <Package size={14} />
                              </div>
                              <span className="text-sm font-black text-slate-800">{p.sku}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className="inline-flex h-7 items-center rounded-lg bg-slate-100 px-3 text-[10px] font-black text-slate-600 uppercase">
                              {p.nivel}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className="text-xs font-black text-slate-500">{p.profundidade}</span>
                          </td>
                          <td className="px-6 py-5 text-center font-black text-emerald-600 text-xs">
                            {p.qtd_por_palete.toLocaleString('pt-BR')}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-900">{Math.round(p.quantidade).toLocaleString('pt-BR')}</span>
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase">{Math.round(p.paletes)} PTs</span>
                                {p.qtd_molhado > 0 && <span className="text-[9px] font-black text-blue-500 uppercase">| {fmtNum(p.qtd_molhado)} Molhado</span>}
                                {p.qtd_tombada > 0 && <span className="text-[9px] font-black text-red-500 uppercase">| {fmtNum(p.qtd_tombada)} Tombado</span>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-10 p-6 rounded-3xl bg-blue-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3"><Zap size={20} className="fill-white/20" /><p className="text-xs font-bold">Resumo: Drive operando com {positionDetail.products.length > 1 ? "Múltiplos Produtos (Mix)" : "Produto Único"}</p></div>
                <button className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-[10px] font-black uppercase hover:bg-white/20 transition-all border border-white/10">Gerar Ticket <ExternalLink size={12} /></button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Menu Mock */}
      <div className="fixed bottom-8 right-8 lg:hidden z-50">
        <button className="h-14 w-14 rounded-2xl bg-slate-900 text-white shadow-2xl flex items-center justify-center"><Menu size={24} /></button>
      </div>

    </div>
  )
}
