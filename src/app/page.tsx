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
  Droplet,
  Table as TableIcon,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Moon,
  Sun,
  FileText,
  CheckSquare,
  Printer,
  MessageSquare,
  TrendingDown,
  Minus,
  GitCompare,
  Settings,
  MoreHorizontal,
  Share2,
  DownloadCloud,
  History
} from "lucide-react"
import { MetricCard } from "@/components/MetricCard"
import { WarehouseTable } from "@/components/WarehouseTable"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

type ViewType = "geral" | "posicoes" | "nao_alocados" | "produtos" | "molhados"
type DisplayMode = "mapa" | "tabela" | "misto" | "nao_alocados"
type SortType = "none" | "qty_desc" | "qty_asc" | "alpha_asc"

// Auto-detect: local dev uses localhost, deployed uses Render backend
const API_BASE = typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://127.0.0.1:8000"
  : "https://avarias-ag-g300.onrender.com"

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
  const [activeView, setActiveView] = useState<ViewType>("geral")
  const [displayMode, setDisplayMode] = useState<DisplayMode>("mapa")
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [selectedPalletId, setSelectedPalletId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [tableSort, setTableSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "posicao", direction: "asc" })
  const [sortMode, setSortMode] = useState<SortType>("none")
  const [modalFilter, setModalFilter] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [scrollRequested, setScrollRequested] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showExportConfigModal, setShowExportConfigModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<"excel" | "pdf">("excel")
  const [exportTab, setExportTab] = useState<"simple" | "advanced">("simple")
  const [exportOptions, setExportOptions] = useState({
    includeWet: true,
    includeTilted: true,
    includeTraditional: true,
    includeAllocated: true,
    includeNotAllocated: true,
    includeNormal: true,
    includeDivergent: true,
    includeRejected: true,
    includeObservations: false
  })
  const [mapMenuOpen, setMapMenuOpen] = useState(false)
  const [selectionModeActive, setSelectionModeActive] = useState(false)
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set())
  const [topTab, setTopTab] = useState<"geral" | "mapeamento" | "produtos" | "confrontos">("geral")
  const [showDivergences, setShowDivergences] = useState(false)
  const [confrontosData, setConfrontosData] = useState<any>(null)
  const [loadingConfrontos, setLoadingConfrontos] = useState(false)
  const [confrontoFilter, setConfrontoFilter] = useState<"all" | "divergent" | "match" | "excess" | "missing">("all")
  const [confrontoSearch, setConfrontoSearch] = useState("")
  const [confrontoSortDir, setConfrontoSortDir] = useState<"asc" | "desc">("asc")
  const [confrontoType, setConfrontoType] = useState<"fisico_x_a501" | "a501_x_g501">("fisico_x_a501")
  const [exportFilter, setExportFilter] = useState<"tudo" | "positivado" | "negativado" | "batendo" | "divergente">("tudo")
  const [selectedConfrontoItem, setSelectedConfrontoItem] = useState<any>(null)
  const [confrontoCurrentPage, setConfrontoCurrentPage] = useState(1)
  const confrontoItemsPerPage = 10
  const [topSkusFilter, setTopSkusFilter] = useState<"geral" | "molhado">("geral")
  const [topSkusSort, setTopSkusSort] = useState<"quantidade" | "incidencia">("quantidade")
  const [showTopSkusMenu, setShowTopSkusMenu] = useState(false)
  const [movementPeriod, setMovementPeriod] = useState<"hoje" | "semana" | "mensal">("hoje")
  const [showMovementMenu, setShowMovementMenu] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // -- AJUSTES DE CONFRONTO --
  type AjusteManal = {
    produto: string
    quantidade: number
    motivo: string
    usuario: string
    timestamp: Date
  }
  const [ajustesConfronto, setAjustesConfronto] = useState<AjusteManal[]>([])
  const [modalAjusteOpen, setModalAjusteOpen] = useState(false)
  const [showAjustesMenu, setShowAjustesMenu] = useState(false)
  const [showImportarAjustesModal, setShowImportarAjustesModal] = useState(false)
  const [importarAjustesText, setImportarAjustesText] = useState("")

  const handleExportAjustes = () => {
    try {
      const jsonStr = JSON.stringify(ajustesConfronto)
      const encoded = btoa(encodeURIComponent(jsonStr))
      navigator.clipboard.writeText(encoded)
      alert("Código de configurações de ajuste copiado para a área de transferência com sucesso!")
      setShowAjustesMenu(false)
    } catch (e) {
      alert("Erro ao exportar configuração.")
    }
  }

  const handleImportAjustes = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (!importarAjustesText.trim()) return;
      const decoded = decodeURIComponent(atob(importarAjustesText.trim()))
      const parsed = JSON.parse(decoded)
      if (Array.isArray(parsed)) {
        // Simple validation
        const valid = parsed.every(p => p.produto && typeof p.quantidade === 'number')
        if (valid) {
          setAjustesConfronto(parsed)
          setShowImportarAjustesModal(false)
          setImportarAjustesText("")
          alert("Configurações importadas com sucesso!")
        } else {
          alert("A configuração colada não é válida.")
        }
      }
    } catch (e) {
      alert("Código inválido ou corrompido.")
    }
  }

  const rowsPerPage = 10 // Posições por página

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" || "light"
    setTheme(savedTheme)
  }, [])

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    localStorage.setItem("theme", theme)
  }, [theme])

  useEffect(() => {
    let attempts = 0;
    let timeoutId: NodeJS.Timeout;

    const tryScroll = () => {
      if (!scrollRequested) return;

      const element = document.getElementById("warehouse-map")
      if (element) {
        // Pequeno delay extra para garantir que o layout estabilizou
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "start" })
          setScrollRequested(false)
        }, 50);
      } else if (attempts < 20) { // Tenta por até 2 segundos
        attempts++;
        timeoutId = setTimeout(tryScroll, 100);
      } else {
        setScrollRequested(false);
      }
    }

    if (scrollRequested) {
      tryScroll()
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [scrollRequested, activeView, displayMode])

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light")
  }

  const fetchData = async () => {
    setLoading(true)
    setIsRefreshing(true)
    setError(null)
    try {
      const [dataRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/data`),
        fetch(`${API_BASE}/api/stats?period=${movementPeriod}`)
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
      setTimeout(() => {
        setLoading(false)
        setIsRefreshing(false)
      }, 500)
    }
  }

  useEffect(() => {
    fetchData()
  }, [movementPeriod])

  useEffect(() => {
    setConfrontoCurrentPage(1);
  }, [confrontoSearch, confrontoFilter, confrontoType, confrontoSortDir]);

  const fetchConfrontos = async () => {
    setLoadingConfrontos(true)
    try {
      const res = await fetch(`${API_BASE}/api/confrontos?type=${confrontoType}`)
      if (!res.ok) throw new Error("Erro ao carregar confrontos")
      const data = await res.json()
      setConfrontosData(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingConfrontos(false)
    }
  }

  useEffect(() => {
    if (topTab === 'confrontos' && !confrontosData) {
      fetchConfrontos()
    }
  }, [topTab, confrontosData])

  useEffect(() => {
    if (confrontosData) {
      fetchConfrontos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confrontoType])

  // street processing logic (Integrated)
  const streetData = useMemo(() => {
    // Dynamic streets object based on prefixes found in data
    const streets: Record<string, { even: any[], odd: any[] }> = {}

    const posMap = new Map()
    data.forEach(item => {
      // Otimização: Se houver busca, ignorar itens que não batem com o SKU ou com a Posição
      const matchesSearch = !search ||
        (item.produto || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.posicao || "").toLowerCase().includes(search.toLowerCase())

      if (!matchesSearch) return

      const posId = item.posicao || "S/P"
      if (!posMap.has(posId)) {
        posMap.set(posId, {
          id: posId,
          paletes: 0,
          capacidade: item.capacidade || 0,
          unregistered_error: item.unregistered_error || false,
          products: []
        })
      }
      const entry = posMap.get(posId)
      entry.paletes += (item.paletes || 0)
      if (item.unregistered_error) entry.unregistered_error = true
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
      // Matches any 2-character street prefix like 1G, 1F, 2G, 3G, 4G...
      const match = id.match(/([0-9][A-Z])(\d+)/i)
      if (match) {
        const prefix = match[1].toUpperCase()
        const fullNumStr = match[2]

        const bayNum = parseInt(fullNumStr.substring(0, 3))
        const isEven = bayNum % 2 === 0
        const side = isEven ? "even" : "odd"

        if (!streets[prefix]) {
          streets[prefix] = { even: [], odd: [] }
        }

        streets[prefix][side].push(p)
      }
    })

    const sortPos = (arr: any[]) => arr.sort((a, b) => {
      const matchA = a.id.match(/([0-9][A-Z])(\d+)/i)
      const matchB = b.id.match(/([0-9][A-Z])(\d+)/i)
      const numA = matchA ? parseInt(matchA[2]) : 0
      const numB = matchB ? parseInt(matchB[2]) : 0
      return numA - numB
    })

    Object.values(streets).forEach(s => {
      if ('even' in s) sortPos(s.even)
      if ('odd' in s) sortPos(s.odd)
    })

    return streets
  }, [data, search])

  // Mixed Pallets Detection Logic
  const mixedPalletsData = useMemo(() => {
    const palletGroups = new Map<string, any[]>()

    data.forEach(item => {
      const id = item.id_palete?.toString()?.trim()
      if (!id || id === "0" || id === "" || id.toLowerCase() === "nan") return

      if (!palletGroups.has(id)) {
        palletGroups.set(id, [])
      }
      palletGroups.get(id)?.push(item)
    })

    const mixed = []
    for (const [id, items] of palletGroups.entries()) {
      const skus = new Set(items.map(i => i.produto))
      const positions = new Set(items.map(i => i.posicao || "S/P"))
      const hasSP = positions.has("S/P")
      const hasAllocated = Array.from(positions).some(p => p !== "S/P")

      const isMixedSku = skus.size > 1
      const isMixedStatus = hasSP && hasAllocated

      if (isMixedSku || isMixedStatus) {
        mixed.push({
          id,
          totalQty: items.reduce((sum, i) => sum + (i.quantidade_total || 0), 0),
          skuCount: skus.size,
          skus: Array.from(skus),
          isMixedSku,
          isMixedStatus,
          items
        })
      }
    }

    return mixed.sort((a, b) => b.totalQty - a.totalQty)
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
        is_complete: item.capacidade > 0 && item.paletes > item.capacidade ? "OVERFLOW" : item.capacidade > 0 && item.paletes >= item.capacidade ? "COMPLETO" : "DISPONÍVEL",
        is_overflow: item.capacidade > 0 && item.paletes > item.capacidade
      }))
    } else if (activeView === "produtos") {
      const productMap = new Map()
      data.forEach(item => {
        if (!item.produto || item.produto.trim() === "") return
        const prod = item.produto
        if (!productMap.has(prod)) {
          productMap.set(prod, {
            produto: prod,
            paletes: 0,
            quantidade_total: 0,
            posicoes: new Set(),
            descricao: item.descricao || "-",
            dmg_molhado: 0,
            dmg_tombada: 0
          })
        }
        const entry = productMap.get(prod)
        entry.paletes += (item.paletes || 0)
        entry.quantidade_total += (item.quantidade_total || 0)
        entry.dmg_molhado += (item.qtd_molhado || 0)
        entry.dmg_tombada += (item.qtd_tombada || 0)
        if (item.posicao) entry.posicoes.add(item.posicao)
      })

      baseData = Array.from(productMap.values()).map(item => ({
        ...item,
        posicao_count: item.posicoes.size,
        quantidade: item.quantidade_total - (item.dmg_molhado || 0)
      }))

      // Calc global prominence (Top 3 by Quantity)
      const sortedByQty = [...baseData].sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0))
      baseData = baseData.map(item => ({
        ...item,
        qtyRank: sortedByQty.findIndex(s => s.produto === item.produto) + 1
      }))
    } else if (activeView === "molhados") {
      const productMap = new Map()
      const skusWithWet = new Set()
      data.forEach(item => {
        if (item.qtd_molhado && item.qtd_molhado > 0 && item.produto && item.produto.trim() !== "") {
          skusWithWet.add(item.produto)
        }
      })

      data.forEach(item => {
        if (!item.produto || item.produto.trim() === "") return
        const prod = item.produto
        if (!skusWithWet.has(prod)) return

        if (!productMap.has(prod)) {
          productMap.set(prod, {
            produto: prod,
            paletes: 0,
            quantidade_total: 0,
            dmg_molhado: 0,
            posicoes_com_molhado: new Set(),
            descricao: item.descricao || "-"
          })
        }
        const entry = productMap.get(prod)
        entry.paletes += (item.paletes || 0)
        entry.quantidade_total += (item.quantidade_total || 0)
        entry.dmg_molhado += (item.qtd_molhado || 0)
        if (item.qtd_molhado && item.qtd_molhado > 0 && item.posicao) {
          entry.posicoes_com_molhado.add(item.posicao)
        }
      })

      baseData = Array.from(productMap.values()).map(item => ({
        ...item,
        posicao_count: item.posicoes_com_molhado.size,
        quantidade: item.dmg_molhado
      }))

      // Calc global prominence (Top 3 by Quantity)
      const sortedByQty = [...baseData].sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0))
      baseData = baseData.map(item => ({
        ...item,
        qtyRank: sortedByQty.findIndex(s => s.produto === item.produto) + 1
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
      baseData.sort((a, b) => (b.quantidade || b.quantidade_total || 0) - (a.quantidade || a.quantidade_total || 0))
    } else if (sortMode === "qty_asc") {
      baseData.sort((a, b) => (a.quantidade || a.quantidade_total || 0) - (b.quantidade || b.quantidade_total || 0))
    } else if (sortMode === "alpha_asc") {
      baseData.sort((a, b) => {
        const key = (activeView === "produtos" || activeView === "molhados") ? "produto" : "posicao"
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

    // FINAL STEP: Assign rank based on final visual order for ALL items
    return baseData.map((item, idx) => ({
      ...item,
      rank: idx + 1
    }))
  }, [data, activeView, sortMode, tableSort])

  const handleSort = (key: string) => {
    setSortMode("none")
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

      const posUpper = (activePos || "").toUpperCase()
      const isRealDrive = posUpper && posUpper !== "S/P" && posUpper !== "N/A" && posUpper !== "NÃO INFORMADO" && posUpper !== "-" && !item.is_unallocated_source

      if (isRealDrive) {
        if (!globalPosMap.has(activePos)) {
          globalPosMap.set(activePos, new Set())
          posOccupancy.set(activePos, 0)
        }
        if (item.produto) globalPosMap.get(activePos).add(item.produto)

        const cap = item.capacidade || 0
        posMap.set(activePos, cap)
        posOccupancy.set(activePos, (posOccupancy.get(activePos) || 0) + (item.paletes || 0))
      }
    })

    let mixedCount = 0
    let monoCount = 0
    let vazioCount = 0
    let lotadoCount = 0
    let totalMixed = 0
    let totalMono = 0
    let alocadosPallets = 0
    let naoAlocadosPallets = 0
    let molhadosPallets = 0
    let tombadosPallets = 0

    const checkStatus = (item: any) => {
      const prod = String(item.produto || "").toLowerCase()
      if (prod.includes("molhado")) molhadosPallets += (item.paletes || 0)
      if (prod.includes("tombado")) tombadosPallets += (item.paletes || 0)
    }

    const overflowPositions: string[] = []
    globalPosMap.forEach((skus, pos) => {
      const cap = posMap.get(pos) || 0
      const occ = posOccupancy.get(pos) || 0

      if (skus.size > 1) totalMixed++
      else if (skus.size === 1) totalMono++

      if (cap > 0 && occ >= cap) {
        lotadoCount++
        if (occ > cap) {
          overflowPositions.push(pos)
        }
      } else if (occ === 0) {
        vazioCount++
      } else {
        if (skus.size > 1) mixedCount++
        else monoCount++
      }
    })

    data.forEach(item => {
      const posUpper = String(item.posicao || "").toUpperCase()
      const isAllocated = posUpper && posUpper !== "S/P" && posUpper !== "N/A" && posUpper !== "NÃO INFORMADO" && posUpper !== "-" && !item.is_unallocated_source

      if (isAllocated) alocadosPallets += (item.paletes || 0)
      else naoAlocadosPallets += (item.paletes || 0)

      checkStatus(item)
    })

    posMap.forEach((cap) => {
      capBreakdown.set(cap, (capBreakdown.get(cap) || 0) + 1)
    })

    const totalCapacity = Array.from(posMap.values()).reduce((sum, cap) => sum + cap, 0)
    const totalPositions = posMap.size

    // FIX: occupied should ONLY count allocated pallets to match backend stats
    const occupied = Math.round(data.filter(i => {
      const p = String(i.posicao || "").toUpperCase();
      return p && p !== "S/P" && p !== "N/A" && p !== "NÃO INFORMADO" && p !== "-" && !i.is_unallocated_source;
    }).reduce((s, i) => s + (i.paletes || 0), 0));

    const free = Math.round(Math.max(0, totalCapacity - occupied))
    const occupiedPercent = totalCapacity > 0 ? (occupied / totalCapacity) * 100 : 0

    const sortedBreakdown = Array.from(capBreakdown.entries())
      .map(([cap, count]) => ({ capacity: cap, count }))
      .sort((a, b) => a.capacity - b.capacity)

    return {
      totalCapacity,
      totalPositions,
      occupied,
      free,
      occupiedPercent: totalCapacity > 0 ? (occupied / totalCapacity) * 100 : 0,
      breakdown: sortedBreakdown,
      mixedCount,
      monoCount,
      vazioCount,
      lotadoCount,
      totalMixed,
      totalMono,
      completoCount: lotadoCount,
      disponivelCount: totalPositions - lotadoCount,
      alocadosPallets,
      naoAlocadosPallets,
      molhadosPallets,
      tombadosPallets,
      mixPercent: (totalMono + totalMixed) > 0 ? (totalMixed / (totalMono + totalMixed) * 100) : 0,
      overflowCount: overflowPositions.length,
      overflowPositions,
      top10Skus: (() => {
        const skuMap = new Map()
        data.forEach(item => {
          const sku = String(item.produto || "").trim()
          if (!sku || sku === "-" || sku === "nan") return

          if (!skuMap.has(sku)) {
            skuMap.set(sku, {
              sku,
              descricao: item.descricao || "-",
              paletes: 0,
              quantidade: 0,
              molhados: 0,
              registrosGeral: 0,
              registrosMolhado: 0,
              posicoes: new Set()
            })
          }
          const entry = skuMap.get(sku)
          entry.paletes += (item.paletes || 0)
          entry.quantidade += (item.quantidade_total || 0)
          const wetQty = (item.qtd_molhado || 0)
          entry.molhados += wetQty

          const p = String(item.posicao || "").toUpperCase()
          if (p && p !== "S/P" && p !== "N/A" && p !== "NÃO INFORMADO" && p !== "-") {
            entry.posicoes.add(p)
          }
        })

        const freqMap = stats?.frequency_by_product || {}
        const molhFreqMap = stats?.molh_frequency_by_product || {}

        return Array.from(skuMap.values())
          .map(item => ({
            ...item,
            posicoesCount: item.posicoes.size,
            incidencia: topSkusFilter === "molhado"
              ? (molhFreqMap[item.sku] || 0)
              : (freqMap[item.sku] || 0)
          }))
          .filter(item => {
            if (topSkusFilter === "geral") return true
            return item.molhados > 0
          })
          .sort((a, b) => {
            if (topSkusSort === "incidencia") {
              return b.incidencia - a.incidencia || b.molhados - a.molhados || b.quantidade - a.quantidade
            }
            // Se o filtro é molhado, o valor principal é o molhado
            const valA = topSkusFilter === "molhado" ? a.molhados : a.quantidade
            const valB = topSkusFilter === "molhado" ? b.molhados : b.quantidade
            return valB - valA || b.quantidade - a.quantidade
          })
          .slice(0, 3)
      })()
    }
  }, [data, stats, topSkusFilter, topSkusSort])

  const getColumns = () => {
    if (activeView === "posicoes") {
      return [
        {
          header: "Posição",
          accessor: "posicao",
          render: (val: string) => (
            <span className="text-slate-500 dark:text-slate-400 tracking-tight transition-colors">
              {val}
            </span>
          )
        },
        { header: "Capacidade", accessor: "capacidade", render: (val: number) => <span className="text-slate-500 dark:text-slate-400 tracking-tight">{fmtNum(val)}</span> },
        { header: "Paletes", accessor: "paletes", render: (val: number) => <span className="text-slate-500 dark:text-slate-400">{fmtNum(val)}</span> },
        {
          header: "Diversidade",
          accessor: "sku_count",
          render: (val: number) => <span className="text-slate-500 dark:text-slate-400">{fmtNum(val)}</span>
        },
        {
          header: "Mix",
          accessor: "drive_status",
          render: (val: string) => (
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-1 text-[10px] uppercase transition-colors shrink-0",
              val === "MISTURADO"
                ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20"
                : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20"
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
              <div className="flex-1 h-1.5 rounded-full bg-slate-50 dark:bg-slate-800 overflow-hidden border border-slate-100/50 dark:border-slate-700/50 transition-colors">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(val, 100)}%` }}
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    val > 100 ? "bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]" : val >= 100 ? "bg-red-500" : val >= 75 ? "bg-orange-500" : "bg-blue-500"
                  )}
                />
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 transition-colors uppercase">{Math.round(val)}%</span>
            </div>
          )
        },
        {
          header: "Lotação",
          accessor: "is_complete",
          render: (val: string) => (
            <span className={cn(
              "inline-flex items-center rounded-full px-3 py-1.5 text-[10px] uppercase shadow-sm transition-all shrink-0",
              val === "OVERFLOW"
                ? "bg-red-600 text-white shadow-lg shadow-red-500/30 animate-pulse"
                : val === "COMPLETO"
                  ? "bg-blue-600 dark:bg-blue-700 text-white shadow-blue-100/50 dark:shadow-blue-900/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/50"
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
          render: (val: string, item: any) => {
            const isTopQty = item.qtyRank <= 3
            const isVisualTop = item.rank <= 3
            const isSortedByQty = sortMode === "qty_desc"
            const showHighlight = isVisualTop && isTopQty && isSortedByQty

            return (
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
                  showHighlight ? (
                    item.rank === 1 ? "bg-orange-500 text-white shadow-lg shadow-orange-100 dark:shadow-orange-900/20" :
                      item.rank === 2 ? "bg-orange-400 text-white shadow-md shadow-orange-50/50 dark:shadow-orange-900/10" :
                        "bg-orange-300 text-white shadow-sm"
                  ) : (
                    "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700 transition-colors"
                  )
                )}>
                  {item.rank}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    {showHighlight && (
                      <Flame size={14} className={cn(
                        "text-orange-500 fill-orange-500",
                        item.qtyRank === 1 && "animate-pulse"
                      )} />
                    )}
                    <span className={cn(
                      showHighlight ? "text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-400"
                    )}>
                      {val}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px] leading-tight">
                      {item.descricao && item.descricao !== "-" ? item.descricao : "Não Identificado"}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase transition-colors">
                      {item.posicao_count} Posições
                    </span>
                  </div>
                </div>
              </div>
            )
          }
        },
        { header: "Paletes", accessor: "paletes", render: (val: number) => <span className="text-slate-500 dark:text-slate-400 transition-colors uppercaseTracking-tight">{fmtNum(val)}</span> },
        {
          header: "Quantidade",
          accessor: "quantidade",
          render: (val: number, item: any) => {
            const isTopQty = item.qtyRank <= 3
            const isVisualTop = item.rank <= 3
            const showHighlight = isVisualTop && isTopQty && sortMode === "qty_desc"

            if (showHighlight) {
              return (
                <span className={cn(
                  "px-3 py-1 rounded-xl transition-all border shrink-0",
                  item.rank === 1 ? "bg-orange-600 dark:bg-orange-700 text-white border-orange-500 dark:border-orange-600 shadow-md shadow-orange-100 dark:shadow-orange-900/20" :
                    item.rank === 2 ? "bg-orange-500 dark:bg-orange-600 text-white border-orange-400 dark:border-orange-500 shadow-sm" :
                      "bg-orange-400 dark:bg-orange-500 text-white border-orange-300 dark:border-orange-400"
                )}>
                  {fmtNum(val)}
                </span>
              )
            }

            return (
              <span className={cn(
                "px-2 transition-all text-slate-500 dark:text-slate-400",
                isTopQty ? "font-medium" : "font-medium"
              )}>
                {fmtNum(val)}
              </span>
            )
          }
        },
        { header: "Nº de Posições", accessor: "posicao_count", render: (val: number) => <span className="text-slate-500 dark:text-slate-400 transition-colors">{fmtNum(val)}</span> },
      ]
    }

    if (activeView === "molhados") {
      return [
        {
          header: "Produto",
          accessor: "produto",
          render: (val: string, item: any) => {
            const isTopQty = item.qtyRank <= 3
            const isVisualTop = item.rank <= 3
            const isSortedByQty = sortMode === "qty_desc"
            const showHighlight = isVisualTop && isTopQty && isSortedByQty

            return (
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
                  showHighlight ? (
                    item.rank === 1 ? "bg-blue-500 text-white shadow-lg shadow-blue-100 dark:shadow-blue-900/20" :
                      item.rank === 2 ? "bg-blue-400 text-white shadow-md shadow-blue-50/50 dark:shadow-blue-900/10" :
                        "bg-blue-300 text-white shadow-sm"
                  ) : (
                    "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700 transition-colors"
                  )
                )}>
                  {item.rank}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    {showHighlight && (
                      <Droplet size={14} className={cn(
                        "text-blue-500 fill-blue-500",
                        item.qtyRank === 1 && "animate-pulse"
                      )} />
                    )}
                    <span className={cn(
                      "text-sm transition-colors uppercase tracking-tight",
                      showHighlight ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
                    )}>
                      {val}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px] leading-tight">
                      {item.descricao && item.descricao !== "-" ? item.descricao : "Não Identificado"}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase transition-colors">
                      {item.posicao_count} Posições com Molhado
                    </span>
                  </div>
                </div>
              </div>
            )
          }
        },
        {
          header: "Qtd. Molhado",
          accessor: "dmg_molhado",
          render: (val: number, item: any) => {
            const isTopQty = item.qtyRank <= 3
            const isVisualTop = item.rank <= 3
            const showHighlight = isVisualTop && isTopQty && sortMode === "qty_desc"

            if (showHighlight) {
              return (
                <span className={cn(
                  "px-3 py-1 rounded-xl transition-all border shrink-0",
                  item.rank === 1 ? "bg-blue-600 dark:bg-blue-700 text-white border-blue-500 dark:border-blue-600 shadow-md shadow-blue-100 dark:shadow-blue-900/20" :
                    item.rank === 2 ? "bg-blue-500 dark:bg-blue-600 text-white border-blue-400 dark:border-blue-500 shadow-sm" :
                      "bg-blue-400 dark:bg-blue-500 text-white border-blue-300 dark:border-blue-400"
                )}>
                  {fmtNum(val)}
                </span>
              )
            }

            return (
              <span className={cn(
                "px-2 transition-all text-slate-500 dark:text-slate-400",
                isTopQty ? "font-medium" : "font-medium"
              )}>
                {fmtNum(val)}
              </span>
            )
          }
        },
        {
          header: "% do Estoque",
          accessor: "dmg_molhado",
          render: (_: any, item: any) => {
            const val = item.dmg_molhado || 0
            const pct = Math.min((val / item.quantidade_total) * 100, 100)
            return (
              <div className="flex items-center gap-2 w-32">
                <div className="h-1.5 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50 transition-colors">
                  <div className="h-full bg-blue-500 dark:bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 transition-colors">{Math.round(pct)}%</span>
              </div>
            )
          }
        },
      ]
    }

    if (activeView === "nao_alocados") {
      return [
        {
          header: "Produto",
          accessor: "produto",
          render: (val: string) => (
            <span className="text-slate-500 dark:text-slate-400 tracking-tight transition-colors">
              {val || "Não Identificado"}
            </span>
          )
        },
        { header: "Quantidade", accessor: "quantidade_total", render: (val: number) => <span className="text-slate-500 dark:text-slate-400">{fmtNum(val)}</span> },
        { header: "Paletes", accessor: "paletes", render: (val: number) => <span className="text-slate-500 dark:text-slate-400">{fmtNum(val)} PTs</span> },
        {
          header: "Observação",
          accessor: "observacao",
          render: (val: any) => {
            const strVal = val && val !== 0 ? String(val) : "-"
            const isCritical = strVal.endsWith("!")
            return (
              <span className={cn(
                "text-[10px] italic max-w-xs truncate block transition-all px-2 py-0.5 rounded-lg w-fit",
                isCritical
                  ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 shadow-sm shadow-red-50/50 not-italic"
                  : "text-slate-500 dark:text-slate-500"
              )}>
                {strVal}
              </span>
            )
          }
        },
        {
          header: "Status",
          accessor: "posicao",
          render: () => (
            <span className="inline-flex items-center rounded-full px-2 py-1 text-[10px] uppercase bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 transition-colors">
              Aguardando Alocação
            </span>
          )
        },
      ]
    }

    return [
      {
        header: "Posição",
        accessor: "posicao",
        render: (val: string) => (
          <span className="text-slate-500 dark:text-slate-400 tracking-tight transition-colors">
            {val}
          </span>
        )
      },
      {
        header: "Principal SKU",
        accessor: "produto",
        render: (val: string) => (
          <span className="text-slate-500 dark:text-slate-400 transition-colors uppercase tracking-tight">
            {val || "Não Identificado"}
          </span>
        )
      },
      { header: "Capacidade", accessor: "capacidade", render: (val: any) => <span className="text-slate-500 dark:text-slate-400">{fmtNum(val)} PTs</span> },
      { header: "Quantidade", accessor: "quantidade_total", render: (val: any) => <span className="text-slate-500 dark:text-slate-400">{fmtNum(val)}</span> },
      { header: "Paletes", accessor: "paletes", render: (val: any) => <span className="text-slate-500 dark:text-slate-400">{fmtNum(val)} PTs</span> },
      {
        header: "Ocupação",
        accessor: "ocupacao",
        render: (val: number) => (
          <div className="flex items-center gap-3 w-32">
            <div className="flex-1 h-1.5 rounded-full bg-slate-50 dark:bg-slate-800 overflow-hidden border border-slate-100 dark:border-slate-700 transition-colors">
              <div className={cn("h-full transition-all duration-1000",
                val >= 100 ? "bg-red-500" :
                  val >= 75 ? "bg-orange-500" :
                    "bg-blue-500"
              )} style={{ width: `${Math.min(val, 100)}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 transition-colors">{Math.round(val)}%</span>
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
      level_count: new Set(matches.map(m => m.nivel)).size,
      occupied: matches.reduce((sum, item) => sum + (item.paletes || 0), 0),
      isOverflow: (matches[0].capacidade || 0) > 0 && matches.reduce((sum, item) => sum + (item.paletes || 0), 0) > (matches[0].capacidade || 0),
      products: matches.map(m => ({
        sku: (m.paletes === 0 || !m.produto) ? "Posição Vazia" : m.produto,
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

    const filteredMatches = modalFilter
      ? matches.filter(m => (m.qtd_molhado || 0) > 0)
      : matches

    return {
      sku: selectedProduct,
      total_paletes: matches.reduce((sum, item) => sum + (item.paletes || 0), 0),
      total_quantidade: matches.reduce((sum, item) => sum + (item.quantidade_total || 0), 0),
      total_registros: filteredMatches.length,
      total_posicoes_unicas: new Set(filteredMatches.map(m => m.posicao)).size,
      positions: filteredMatches.map(m => ({
        posicao: m.posicao || "S/P",
        nivel: m.nivel || "Térreo",
        quantidade: m.quantidade_total || 0,
        paletes: m.paletes || 0,
        profundidade: m.profundidade || "-",
        qtd_tombada: m.qtd_tombada || 0,
        qtd_molhado: m.qtd_molhado || 0
      })).sort((a, b) => a.posicao.localeCompare(b.posicao))
    }
  }, [selectedProduct, data, modalFilter])

  const palletDetail = useMemo(() => {
    if (!selectedPalletId) return null
    const items = data.filter(item => item.id_palete?.toString()?.trim() === selectedPalletId)
    if (items.length === 0) return null

    const locations = Array.from(new Set(items.map(i => i.posicao || "S/P")))

    return {
      id: selectedPalletId,
      total_qty: items.reduce((sum, i) => sum + (i.quantidade_total || 0), 0),
      total_pallets: items.reduce((sum, i) => sum + (i.paletes || 0), 0),
      locations,
      items: items.sort((a, b) => (b.quantidade_total || 0) - (a.quantidade_total || 0))
    }
  }, [selectedPalletId, data])

  const handleExportProducts = () => {
    // Agora o botão apenas abre o modal de configuração
    setShowExportConfigModal(true)
    setShowExportMenu(false)
  }

  const executeProductExport = () => {
    // 1. Determina quais opções usar (Simples = TUDO, Avançado = State)
    const opts = exportTab === "simple"
      ? {
        includeWet: true,
        includeTilted: true,
        includeTraditional: true,
        includeAllocated: true,
        includeNotAllocated: true,
        includeNormal: true,
        includeDivergent: true,
        includeRejected: true,
        includeObservations: false
      }
      : exportOptions as any

    // 2. Filtrar os dados brutos com base nas opções
    let filteredData = data.filter(item => {
      const pos = String(item.posicao || "").toUpperCase()
      const isSP = !pos || pos === "S/P" || pos === "N/A" || pos === "NÃO INFORMADO" || pos === "-"

      const descLine = String(item.produto_descricao || item.descricao || "").toUpperCase()
      const obsLine = String(item.observacao || "").toUpperCase()
      const fullText = `${descLine} ${obsLine}`

      const isRejected = fullText.includes("REJEITADO") || fullText.includes("REJEIÇÃO")
      const isDivergent = fullText.includes("DIVERGENTE") || fullText.includes("DIVERGÊNCIA")
      const isNormal = !isRejected && !isDivergent

      // 1. Filtro de Localização
      if (!opts.includeAllocated && !isSP) return false
      if (!opts.includeNotAllocated && isSP) return false

      // 2. Filtro de Status (Saldo)
      if (!opts.includeNormal && isNormal) return false
      if (!opts.includeDivergent && isDivergent) return false
      if (!opts.includeRejected && isRejected) return false

      // 3. Filtro de Avaria (Importante: Rejeitado NÃO é avaria)
      const hasWetActual = (item.qtd_molhado || 0) > 0 && !isRejected
      const hasTiltedActual = (item.qtd_tombada || 0) > 0 && !isRejected
      const isTraditional = !hasWetActual && !hasTiltedActual && !isRejected

      let matchesDamage = false
      if (opts.includeWet && hasWetActual) matchesDamage = true
      if (opts.includeTilted && hasTiltedActual) matchesDamage = true
      if (opts.includeTraditional && isTraditional) matchesDamage = true

      if (isRejected && opts.includeRejected) matchesDamage = true

      return matchesDamage
    })

    // 3. Agregar por produto
    const productMap = new Map()
    filteredData.forEach(item => {
      // Robustez: aceitarmos múltiplas variações de chaves e tratar espaços
      const rawProd = item.produto || item.SKU || item.sku || item.codigo || item.sku_v || ""
      const prod = String(rawProd).trim()
      if (!prod || prod === "") return

      if (!productMap.has(prod)) {
        productMap.set(prod, {
          produto: prod,
          descricao: item.produto_descricao || item.descricao || "-",
          quantidade_total: 0,
          dmg_molhado: 0,
          dmg_tombada: 0,
          obsCounts: new Map(), // Mapeia obs -> total de itens com essa obs
          total_paletes: 0,
          positions: new Set()
        })
      }
      const entry = productMap.get(prod)
      const qty = Number(item.quantidade_total || 0)

      entry.quantidade_total += qty
      entry.dmg_molhado += Number(item.qtd_molhado || item.dmg_molhado || 0)
      entry.dmg_tombada += Number(item.qtd_tombada || item.dmg_tombada || 0)
      entry.total_paletes += Number(item.paletes || 0)

      // Rastrear posições únicas
      const pos = String(item.posicao || "").trim().toUpperCase()
      if (pos && pos !== "-" && pos !== "N/A") entry.positions.add(pos)

      if (opts.includeObservations) {
        const obs = String(item.observacao || item.Observação || "").trim()
        if (obs && obs !== "-" && obs.toUpperCase() !== "N/A") {
          entry.obsCounts.set(obs, (entry.obsCounts.get(obs) || 0) + qty)
        }
      }
    })

    // 4. Transformar em array, consolidar obs e ORDENAR CRESCENTE pelo SKU
    const productData = Array.from(productMap.values()).map(item => {
      // Formata observações: apenas o texto, sem quantidades prefixadas
      const obsFormatted = Array.from(item.obsCounts.keys())
        .join(", ") || "-"

      // Formata paletes: inteiro se >= 1, 1 casa decimal se < 1 (ex: 0.5)
      const pCount = Number(item.total_paletes || 0)
      const formattedPallets = pCount >= 1
        ? Math.floor(pCount).toString()
        : (pCount === 0 ? "0" : pCount.toFixed(1))

      return {
        ...item,
        observacao: obsFormatted,
        total_paletes: formattedPallets,
        total_posicoes: item.positions.size
      }
    }).sort((a, b) =>
      String(a.produto).localeCompare(String(b.produto), undefined, { numeric: true, sensitivity: 'base' })
    )

    if (productData.length === 0) {
      alert("Nenhum produto encontrado com os filtros selecionados.")
      return
    }

    if (exportFormat === "pdf") {
      setPrintData(productData)
      setIsExportingPDF(true)
      setShowExportConfigModal(false)
      setTimeout(() => {
        window.print()
        setTimeout(() => {
          setIsExportingPDF(false)
          setPrintData([])
        }, 500)
      }, 300)
    } else {
      // CSV/Excel Export Dinâmico
      const headers = ["Produto", "Descrição", "Peças Físicas", "Total Paletes", "Qtd. Posições"]
      if (opts.includeWet) headers.push("Qtd. Molhado")
      if (opts.includeTilted) headers.push("Qtd. Tombado")
      if (opts.includeObservations) headers.push("Observações")

      const csvRows = productData.map(p => {
        const row = [
          p.produto,
          `"${p.descricao.replace(/"/g, '""')}"`,
          p.quantidade_total,
          p.total_paletes,
          p.total_posicoes
        ]
        if (opts.includeWet) row.push(p.dmg_molhado)
        if (opts.includeTilted) row.push(p.dmg_tombada)
        if (opts.includeObservations) row.push(`"${p.observacao.replace(/"/g, '""')}"`)
        return row.join(";")
      })

      const csvContent = "\uFEFF" + headers.join(";") + "\n" + csvRows.join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      const timestamp = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
      link.setAttribute("href", url)
      link.setAttribute("download", `relacao_produtos_${timestamp}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setShowExportConfigModal(false)
    }
  }

  const [printData, setPrintData] = useState<any[]>([])

  const handleExportMap = (mode: "all" | "filtered") => {
    const dataToPrint = mode === "all" ? data : filteredData
    setPrintData(dataToPrint)
    // Small timeout to allow state to settle before printing
    setTimeout(() => {
      window.print()
      setTimeout(() => setPrintData([]), 500)
    }, 100)
  }

  const handleExportSelection = () => {
    if (selectedPositions.size === 0) return
    const dataToPrint = data.filter(item => selectedPositions.has(item.posicao))
    setPrintData(dataToPrint)
    setTimeout(() => {
      window.print()
      setTimeout(() => setPrintData([]), 500)
    }, 100)
  }

  // Group data by position for the report
  const groupedPrintData = useMemo(() => {
    const groups: Record<string, any[]> = {}
    printData.forEach(item => {
      const pos = item.posicao || "S/P"
      if (!groups[pos]) groups[pos] = []
      groups[pos].push(item)
    })

    // Sort positions alpha-numerically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [printData])

  return (
    <div className="relative">
      {/* Printable Report (Hidden normally) */}
      {!isExportingPDF && printData.length > 0 && (
        <div className="hidden print:block print:bg-white print:text-black print:p-2 print:w-full">
          <div className="flex justify-between items-center border-b-[2px] border-black pb-1 mb-4">
            <h1 className="text-[16px] font-black uppercase tracking-tight">Manifesto de Conferência de Drive - G300</h1>
            <p className="text-[8px] font-bold text-slate-500 uppercase">{new Date().toLocaleString('pt-BR')} • {printData.length} Registros</p>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {groupedPrintData.map(([posId, items]) => {
              const totalPosUnits = items.reduce((sum, i) => sum + (i.quantidade_total || i.quantidade || 0), 0);
              const totalPosPallets = items.reduce((sum, i) => sum + (i.paletes || 0), 0);

              // Group by Level
              const levelGroups = new Map<string, any[]>();
              items.forEach(item => {
                const levels = String(item.nivel || "0").split(/[,;]/).map(l => l.trim()).filter(Boolean);
                levels.forEach(lvl => {
                  if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
                  levelGroups.get(lvl)!.push(item);
                });
              });

              const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

              if (sortedLevels.length === 0) return null;

              return (
                <div key={posId} className="avoid-break font-sans">
                  {/* Header */}
                  <div className="bg-[#E5E7EB] px-3 py-1 flex justify-between items-baseline border border-[#D1D5DB]">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] font-black tracking-tight">{posId}</span>
                      <span className="text-[7px] font-bold uppercase opacity-60">Cap. {items[0]?.capacidade || "--"}</span>
                    </div>
                    <span className="text-[10px] font-bold">Qtd. Total: {fmtNum(totalPosUnits)}</span>
                  </div>

                  {/* Levels */}
                  <div className="space-y-1 mt-1">
                    {sortedLevels.map((lvl) => {
                      const levelItems = levelGroups.get(lvl)!;

                      // 1. Flatten items into individual depth entries
                      const depthPallets: { d: number, sku: string, portion: number }[] = [];
                      levelItems.forEach(item => {
                        const depths = String(item.profundidade || "").split(/[,;]/).map(d => parseInt(d.trim().replace(/\D/g, ""))).filter(n => !isNaN(n));
                        const levelsSpanned = String(item.nivel || "0").split(/[,;]/).map(l => l.trim()).filter(Boolean).length || 1;
                        const portion = (item.quantidade_total || item.quantidade || 0) / levelsSpanned;

                        depths.forEach(d => {
                          depthPallets.push({ d, sku: String(item.produto || "VAZIO").trim().toUpperCase(), portion });
                        });
                      });

                      // 2. Group by Depth (The physical pallet)
                      // Map key: Depth number
                      // Map value: Array of {sku, portion} for that depth
                      const palletMap = new Map<number, { sku: string, portion: number }[]>();
                      depthPallets.forEach(p => {
                        if (!palletMap.has(p.d)) palletMap.set(p.d, []);
                        palletMap.get(p.d)!.push({ sku: p.sku, portion: p.portion });
                      });

                      // 3. Group contiguous identical pallets (Depths with same sets of SKU+Portion)
                      const sortedDepths = Array.from(palletMap.keys()).sort((a, b) => a - b);
                      const mergedGroups: { depths: number[], items: { sku: string, portion: number }[] }[] = [];

                      sortedDepths.forEach(d => {
                        const currentItems = palletMap.get(d)!.sort((a, b) => a.sku.localeCompare(b.sku));
                        const key = currentItems.map(i => `${i.sku}_${i.portion}`).join("|");

                        const lastGroup = mergedGroups[mergedGroups.length - 1];
                        const lastItemsSorted = lastGroup ? lastGroup.items.sort((a, b) => a.sku.localeCompare(b.sku)) : [];
                        const lastKey = lastGroup ? lastItemsSorted.map(i => `${i.sku}_${i.portion}`).join("|") : null;

                        if (lastGroup && key === lastKey) {
                          lastGroup.depths.push(d);
                        } else {
                          mergedGroups.push({ depths: [d], items: currentItems });
                        }
                      });

                      return (
                        <div key={lvl} className="flex items-stretch gap-1">
                          {/* Level Indicator (N Label) */}
                          <div className="w-8 border border-black flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-black">N{lvl}</span>
                          </div>

                          {/* Merged Pallet Blocks */}
                          <div className="flex-1 space-y-[-1px]">
                            {mergedGroups.map((group, gIdx) => {
                              const pDepthsString = group.depths.sort((a, b) => a - b).join(", ");

                              return (
                                <div key={gIdx} className="flex border border-black min-h-[1.2rem] items-stretch">
                                  {/* P Column: Spans all SKUs in this pallet block */}
                                  <div className="w-20 border-r border-black px-1.5 flex items-center justify-center shrink-0 bg-white">
                                    <span className="text-[9.5px] font-bold uppercase">P {pDepthsString || "-"}</span>
                                  </div>

                                  {/* Right Side: Stack of SKU rows */}
                                  <div className="flex-1 flex flex-col">
                                    {group.items.map((item, iIdx) => (
                                      <div key={iIdx} className={`flex flex-1 ${iIdx > 0 ? 'border-t border-black' : ''}`}>
                                        {/* SKU Name Column */}
                                        <div className="flex-1 px-2 border-r border-black flex items-center min-w-0">
                                          <span className="text-[9.5px] font-black uppercase truncate">CÓD: {item.sku}</span>
                                        </div>

                                        {/* Individual Quantity Column */}
                                        <div className="w-24 px-2 flex items-center justify-end shrink-0">
                                          <span className="text-[12px] font-black">{fmtNum(item.portion)} UN</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body { background: white !important; padding: 0 !important; margin: 0 !important; font-family: -apple-system, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .avoid-break { page-break-inside: avoid; break-inside: avoid; }
          @page { margin: 0.8cm; size: portrait; }
          * { transition: none !important; color-adjust: exact; }
        }
      ` }} />

      <div className="flex min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-500 no-print">
        {/* Minimalist SideMenu */}
        <aside className="group/sidebar fixed left-0 top-0 z-50 flex h-full w-24 flex-col items-center border-r border-slate-200 bg-white/80 py-8 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 transition-all duration-300 hover:w-64 overflow-hidden">
          {/* Sidebar Branding (Combined) */}
          <div className="mb-12 flex flex-col items-center gap-4 px-4 w-full text-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-blue-600 shadow-xl shadow-blue-500/30">
              <Package className="text-white" size={32} />
            </div>
            <div className="flex flex-col items-center opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden w-full space-y-1">
              <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white leading-tight">Avarias <span className="text-blue-600">AG</span></h2>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">G300 PAINEL OPERACIONAL</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-2 w-full px-3">
            {[
              { id: 'geral', label: 'Dashboard', icon: Layout },
              { id: 'mapeamento', label: 'Mapeamento', icon: MapPin },
              { id: 'produtos', label: 'Produtos', icon: Box },
              { id: 'confrontos', label: 'Confrontos', icon: GitCompare },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setTopTab(tab.id as any);
                  if (tab.id === 'produtos') setActiveView('produtos');
                  if (tab.id === 'geral') setActiveView('geral');
                }}
                className={cn(
                  "group relative flex h-12 w-full items-center rounded-xl transition-all duration-300",
                  topTab === tab.id
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 shadow-sm"
                    : "text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
                )}
              >
                {topTab === tab.id && (
                  <motion.div
                    layoutId="activeSideTabIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-md bg-blue-600 dark:bg-blue-500"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <div className="flex h-12 w-[48px] shrink-0 items-center justify-center">
                  <tab.icon size={20} className={cn(
                    "transition-all duration-300",
                    topTab === tab.id ? "text-blue-600 dark:text-blue-400" : ""
                  )} />
                </div>
                <span className={cn(
                  "text-[11px] font-black uppercase tracking-wider opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap text-left",
                  topTab === tab.id ? "text-blue-600 dark:text-blue-400" : ""
                )}>
                  {tab.label}
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-2 w-full px-4 pb-6">
            <button
              onClick={toggleTheme}
              className="flex h-12 w-full items-center rounded-2xl text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800 transition-colors overflow-hidden"
            >
              <div className="flex min-w-[48px] h-12 items-center justify-center">
                {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
              </div>
              <span className="ml-2 text-[10px] font-black uppercase tracking-wider opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                {theme === "light" ? "Escuro" : "Claro"}
              </span>
            </button>
          </div>
        </aside>

        <main className="ml-24 flex-1 p-4 md:p-8 lg:p-12 overflow-x-hidden">
          <div className="mx-auto max-w-7xl space-y-6 md:space-y-10">

            {/* Header - Simple & Clean */}
            <header className={cn(
              "flex flex-col gap-4 md:flex-row md:items-center mb-8 md:mb-10",
              topTab === 'confrontos' ? "md:justify-between" : "md:justify-end"
            )}>

              {/* LEFT: Confronto title - only when ready */}
              {topTab === 'confrontos' && !loadingConfrontos && (
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-700 dark:bg-blue-600 flex items-center justify-center text-white shadow-md shrink-0">
                    <GitCompare size={18} />
                  </div>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight whitespace-nowrap">Confronto de Saldos</span>
                </div>
              )}

              {/* RIGHT: action buttons */}
              <div className="flex items-center gap-3">
                {/* Divergence Tracking Toggle - Only visible on Dashboard */}
                {topTab === 'mapeamento' && (
                  <button
                    onClick={() => setShowDivergences(!showDivergences)}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-2xl transition-all border shrink-0",
                      showDivergences
                        ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 shadow-inner"
                        : "bg-white dark:bg-slate-800 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 border-slate-200 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-900/50"
                    )}
                    title="Painel de Divergências"
                  >
                    <Search size={18} />
                  </button>
                )}

                {/* Confronto Type Toggle - Only visible on Confrontos tab when NOT loading */}
                {topTab === 'confrontos' && !loadingConfrontos && (
                  <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setConfrontoType("fisico_x_a501")}
                      className={cn(
                        "px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap",
                        confrontoType === "fisico_x_a501"
                          ? "bg-[#1E3A8A] dark:bg-blue-600 text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      )}
                    >
                      Físico vs Sistema
                    </button>
                    <button
                      onClick={() => setConfrontoType("a501_x_g501")}
                      className={cn(
                        "px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap",
                        confrontoType === "a501_x_g501"
                          ? "bg-[#1E3A8A] dark:bg-blue-600 text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      )}
                    >
                      A501 vs G501
                    </button>
                  </div>
                )}

                {/* Sync Button - only visible if NOT loading target tab data */}
                {((topTab === 'confrontos' && !loadingConfrontos) || (topTab !== 'confrontos' && !loading)) && (
                  <button
                    onClick={topTab === 'confrontos' ? () => fetchConfrontos() : () => fetchData()}
                    title="Sincronizar Dados"
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md active:scale-95"
                  >
                    <RefreshCw size={18} className={cn((topTab === 'confrontos' ? loadingConfrontos : loading) && "animate-spin")} />
                  </button>
                )}

                {/* ... menu - hidden when confrontos is loading */}
                {!(topTab === 'confrontos' && loadingConfrontos) && (
                  <div className="relative">
                    <button
                      onClick={() => setShowAjustesMenu(!showAjustesMenu)}
                      className={cn(
                        "group flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 h-[42px] w-[42px] transition-all border shrink-0",
                        showAjustesMenu
                          ? "text-blue-600 border-blue-200 dark:border-blue-900 shadow-lg shadow-blue-50 dark:shadow-blue-900/10"
                          : "text-slate-600 dark:text-slate-300 shadow-sm border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900"
                      )}
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    <AnimatePresence>
                      {showAjustesMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowAjustesMenu(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 15, scale: 0.9, filter: "blur(10px)" }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: 15, scale: 0.9, filter: "blur(10px)" }}
                            className="absolute right-0 mt-3 w-72 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/20 dark:border-slate-800/50 z-50 origin-top-right overflow-hidden p-2"
                          >
                            <div className="px-4 py-3 mb-1">
                              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em]">
                                {topTab === 'confrontos' ? 'Filtro de Exportação' : 'Opções'}
                              </p>
                            </div>

                            {/* Export Filter Selector */}
                            {topTab === 'confrontos' && (
                              <div className="px-2 mb-3 space-y-1">
                                {[
                                  { id: "tudo", label: "Tudo" },
                                  { id: "positivado", label: "Positivado" },
                                  { id: "negativado", label: "Negativado" },
                                  { id: "batendo", label: "Batendo" },
                                  { id: "divergente", label: "Divergentes" }
                                ].map((f) => (
                                  <button
                                    key={f.id}
                                    onClick={() => setExportFilter(f.id as any)}
                                    className={cn(
                                      "w-full text-left px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                                      exportFilter === f.id
                                        ? "bg-blue-600 text-white shadow-sm"
                                        : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    )}
                                  >
                                    {f.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Exportar PDF do confronto atual */}
                            {topTab === 'confrontos' && confrontosData && (
                              <button
                                onClick={() => {
                                  setShowAjustesMenu(false);
                                  // Label for type
                                  const typeLabel = confrontoType === 'fisico_x_a501' ? 'Físico vs Sistema' : 'A501 vs G501';
                                  const filterLabel = exportFilter.charAt(0).toUpperCase() + exportFilter.slice(1);

                                  // Sort data by code ascending
                                  let data = [...confrontosData.dados].sort((a: any, b: any) =>
                                    a.produto.localeCompare(b.produto, undefined, { numeric: true, sensitivity: 'base' })
                                  );

                                  // Apply filters based on balance
                                  data = data.filter((c: any) => {
                                    const ajuste = ajustesConfronto.find((a: any) => a.produto === c.produto);
                                    const qtdFisicaAjustada = c.qtd_fisica + (ajuste ? ajuste.quantidade : 0);
                                    const balance = qtdFisicaAjustada - c.qtd_sistema;

                                    if (exportFilter === "positivado") return balance > 0;
                                    if (exportFilter === "negativado") return balance < 0;
                                    if (exportFilter === "batendo") return balance === 0;
                                    if (exportFilter === "divergente") return balance !== 0;
                                    return true;
                                  });

                                  const rows = data.map((c: any) => {
                                    const ajuste = ajustesConfronto.find((a: any) => a.produto === c.produto);
                                    const qtdFisicaAjustada = c.qtd_fisica + (ajuste ? ajuste.quantidade : 0);
                                    const diferenca = qtdFisicaAjustada - c.qtd_sistema;
                                    const saldo = diferenca === 0 ? 'Bateu' : diferenca > 0 ? `+${diferenca} (Positivo)` : `${diferenca} (Negativo)`;
                                    return `<tr><td>${c.produto}</td><td>${c.descricao}</td><td>${qtdFisicaAjustada}</td><td>${c.qtd_sistema}</td><td>${saldo}</td></tr>`;
                                  }).join('');

                                  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Confronto ${typeLabel} - ${filterLabel}</title><style>body{font-family:sans-serif;font-size:12px;padding:20px}h2{margin-bottom:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#1e3a8a;color:white}tr:nth-child(even){background:#f8fafc}@media print{button{display:none}}</style></head><body><h2>Confronto de Saldos — ${typeLabel} (${filterLabel})</h2><p style="color:#64748b;margin-bottom:12px">Gerado em ${new Date().toLocaleString('pt-BR')}</p><table><thead><tr><th>Código</th><th>Descrição</th><th>Qtd Física</th><th>Qtd Sistema</th><th>Saldo</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
                                  const w = window.open('', '_blank');
                                  if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                                    <FileText size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none mb-1">Exportar PDF</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{confrontoType === 'fisico_x_a501' ? 'Físico vs Sistema' : 'A501 vs G501'}</p>
                                  </div>
                                </div>
                              </button>
                            )}

                            {/* Exportar Excel do confronto atual */}
                            {topTab === 'confrontos' && confrontosData && (
                              <button
                                onClick={() => {
                                  if (!confrontosData?.dados) return;
                                  const typeLabel = confrontoType === 'fisico_x_a501' ? 'Fisico_vs_Sistema' : 'A501_vs_G501';
                                  const filterLabel = exportFilter;

                                  // Sort data by code ascending
                                  let data = [...confrontosData.dados].sort((a: any, b: any) =>
                                    a.produto.localeCompare(b.produto, undefined, { numeric: true, sensitivity: 'base' })
                                  );

                                  // Apply filters based on balance
                                  data = data.filter((c: any) => {
                                    const ajuste = ajustesConfronto.find((a: any) => a.produto === c.produto);
                                    const qtdFisicaAjustada = c.qtd_fisica + (ajuste ? ajuste.quantidade : 0);
                                    const balance = qtdFisicaAjustada - c.qtd_sistema;

                                    if (exportFilter === "positivado") return balance > 0;
                                    if (exportFilter === "negativado") return balance < 0;
                                    if (exportFilter === "batendo") return balance === 0;
                                    if (exportFilter === "divergente") return balance !== 0;
                                    return true;
                                  });

                                  const rows = data.map((c: any) => {
                                    const ajuste = ajustesConfronto.find((a: any) => a.produto === c.produto);
                                    const qtdFisicaAjustada = c.qtd_fisica + (ajuste ? ajuste.quantidade : 0);
                                    const diferenca = qtdFisicaAjustada - c.qtd_sistema;
                                    return `<tr><td>${c.produto}</td><td>${c.descricao}</td><td>${qtdFisicaAjustada}</td><td>${c.qtd_sistema}</td><td>${diferenca}</td></tr>`;
                                  }).join('');

                                  const xls = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Confronto</title><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Confronto</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table><thead><tr><th>Código</th><th>Descrição</th><th>Qtd Física</th><th>Qtd Sistema</th><th>Saldo</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
                                  const blob = new Blob([xls], { type: 'application/vnd.ms-excel;charset=utf-8;' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `confronto_${typeLabel}_${filterLabel}_${new Date().toISOString().slice(0, 10)}.xls`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                  setShowAjustesMenu(false);
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                    <Download size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none mb-1">Exportar Excel</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{confrontoType === 'fisico_x_a501' ? 'Físico vs Sistema' : 'A501 vs G501'}</p>
                                  </div>
                                </div>
                              </button>
                            )}

                            {/* Importar Ajustes */}
                            {topTab === 'confrontos' && (
                              <button
                                onClick={() => {
                                  setShowAjustesMenu(false)
                                  setShowImportarAjustesModal(true)
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                                    <DownloadCloud size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none mb-1">Importar Ajustes</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Colar código compartilhado</p>
                                  </div>
                                </div>
                              </button>
                            )}

                            {/* Relatório Geral - only on other tabs */}
                            {topTab !== 'confrontos' && (
                              <button
                                onClick={() => { handleExportProducts(); setShowAjustesMenu(false); }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                    <Package size={14} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none mb-1">Relatório Geral</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Planilha Consolidada</p>
                                  </div>
                                </div>
                              </button>
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </header >

            {/* GLOBAL LOADING INDICATOR (Phase 7) */}
            <AnimatePresence>
              {(loading || isRefreshing || (topTab === 'confrontos' && loadingConfrontos)) && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                  animate={{ height: "auto", opacity: 1, marginBottom: 24 }}
                  exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-2xl transition-colors shadow-sm">
                    <RefreshCw size={12} className="animate-spin text-blue-600 dark:text-blue-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Atualizando dados...</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Divergence Tracking Panel */}
            <AnimatePresence>
              {
                topTab === 'mapeamento' && showDivergences && stats?.divergences && stats.divergences.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, scale: 0.98 }}
                    animate={{ opacity: 1, height: "auto", scale: 1 }}
                    exit={{ opacity: 0, height: 0, scale: 0.98 }}
                    className="mb-8"
                  >
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-3xl p-6 shadow-sm overflow-hidden relative">
                      {/* Background decoration */}
                      <div className="absolute -top-10 -right-10 text-amber-500/5 rotate-12 pointer-events-none">
                        <AlertCircle size={200} />
                      </div>

                      <div className="flex items-center justify-between mb-6 relative z-10">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-xl">
                            <AlertCircle className="text-amber-600 dark:text-amber-400" size={20} />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-amber-900 dark:text-amber-300">Rastreamento de Divergências</h3>
                            <p className="text-[10px] uppercase font-bold text-amber-700/60 dark:text-amber-400/60 tracking-wider">Mapeamento vs. Quantidade física</p>
                          </div>
                        </div>
                        <div className="px-3 py-1 bg-white/60 dark:bg-slate-900/60 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 backdrop-blur-sm shadow-sm">
                          {stats.divergences.length} {stats.divergences.length === 1 ? 'Produto Divergente' : 'Produtos Divergentes'}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 relative z-10 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {stats.divergences.map((div: any) => (
                          <div key={div.produto} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 border border-amber-100 dark:border-amber-500/10 flex flex-col gap-3 transition-transform hover:scale-[1.02] shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-amber-300 dark:hover:border-amber-500/30">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">{div.produto}</span>
                              <span className={cn(
                                "text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border",
                                div.diff < 0 ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" : "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                              )}>
                                {div.diff < 0 ? `Falta ${Math.abs(div.diff)} no Map.` : `Sobra ${Math.abs(div.diff)} no Map.`}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <div className="flex flex-col p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                <span className="text-[9px] uppercase tracking-wider font-bold mb-1">Mapeamento</span>
                                <span className="text-sm font-black text-slate-700 dark:text-slate-300">{div.db_qty.toLocaleString('pt-BR')} <span className="text-[10px] font-medium text-slate-400">UN</span></span>
                              </div>
                              <div className="flex flex-col text-right p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                <span className="text-[9px] uppercase tracking-wider font-bold mb-1 text-slate-400">Contabilizado</span>
                                <span className="text-sm font-black text-slate-700 dark:text-slate-300">{div.mov_qty.toLocaleString('pt-BR')} <span className="text-[10px] font-medium text-slate-400">UN</span></span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )
              }
            </AnimatePresence >

            <AnimatePresence mode="wait">
              {topTab === "geral" && (
                <motion.div
                  key="geral-content"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >


                  {error && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-2xl border border-red-200 dark:border-red-900/20 bg-red-50 dark:bg-red-900/10 p-5 text-sm font-bold text-red-600 dark:text-red-400 shadow-xl shadow-red-100 dark:shadow-red-900/10 transition-colors">
                      <AlertCircle size={20} />
                      {error}
                    </motion.div>
                  )}

                  {stats?.unregistered_count > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-between gap-4 rounded-3xl bg-amber-600 p-6 text-white shadow-2xl shadow-amber-500/20 border border-amber-500/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                          <AlertCircle size={24} className="text-white animate-pulse" />
                        </div>
                        <div>
                          <h2 className="text-lg font-black uppercase tracking-tight">Divergência de Cadastro Detectada</h2>
                          <p className="text-[10px] font-black uppercase text-amber-100/80 tracking-widest mt-0.5">
                            Posições na Base mas não no Cadastro: {stats.unregistered_positions.join(", ")}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setActiveView("posicoes");
                          setDisplayMode("mapa");
                          setScrollRequested(true);
                        }}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-wider backdrop-blur-sm transition-colors"
                      >
                        Ver no Mapa
                      </button>
                    </motion.div>
                  )}

                  {advancedStats.overflowPositions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-between gap-4 rounded-3xl bg-red-600 p-6 text-white shadow-2xl shadow-red-500/20 border border-red-500/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                          <AlertCircle size={24} className="text-white animate-pulse" />
                        </div>
                        <div>
                          <h2 className="text-lg font-black uppercase tracking-tight">Erro de Mapeamento Detectada</h2>
                          <p className="text-[10px] font-black uppercase text-red-100/80 tracking-widest mt-0.5">
                            Posições com excesso de paletes: {advancedStats.overflowPositions.join(", ")}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setActiveView("posicoes");
                          setDisplayMode("mapa");
                          setScrollRequested(true);
                        }}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-wider backdrop-blur-sm transition-colors"
                      >
                        Ver no Mapa
                      </button>
                    </motion.div>
                  )}

                  {/* KPIs Row */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                      title="Paletes Totais"
                      value={stats?.total_pallets?.toLocaleString('pt-BR') ?? "0"}
                      icon={Package}
                      delay={0.1}
                      hoverContent={
                        <div className="flex items-center justify-around gap-10 text-center w-full">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Alocados</span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 transition-colors">{fmtNum(advancedStats.alocadosPallets)}</span>
                          </div>
                          <div className="h-6 w-[1px] bg-slate-200 dark:bg-white/10" />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Não Alocados</span>
                            <span className="text-sm font-black text-orange-600 dark:text-orange-400 transition-colors">{fmtNum(advancedStats.naoAlocadosPallets)}</span>
                          </div>
                        </div>
                      }
                    />
                    <MetricCard
                      title={
                        <div className="flex items-center gap-2">
                          Peças Totais
                        </div>
                      }
                      value={stats?.movement_pieces?.toLocaleString('pt-BR') ?? stats?.total_quantity?.toLocaleString('pt-BR') ?? "0"}
                      icon={BarChart3}
                      delay={0.2}
                      hoverContent={
                        <div className="grid grid-cols-2 gap-x-10 gap-y-4 text-center w-full">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Alocadas</span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 transition-colors">{fmtNum(data.filter(i => {
                              const p = String(i.posicao || "").toUpperCase();
                              return p && p !== "S/P" && p !== "N/A" && p !== "NÃO INFORMADO" && p !== "-";
                            }).reduce((s, i) => s + (i.quantidade_total || 0), 0))}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Não Alocadas</span>
                            <span className="text-sm font-black text-orange-600 dark:text-orange-400 transition-colors">{fmtNum(data.filter(i => {
                              const p = String(i.posicao || "").toUpperCase();
                              return !p || p === "S/P" || p === "N/A" || p === "NÃO INFORMADO" || p === "-";
                            }).reduce((s, i) => s + (i.quantidade_total || 0), 0))}</span>
                          </div>
                          <div className="col-span-2 h-[1px] bg-slate-200 dark:bg-white/10 my-1" />
                          <div className="flex flex-col border-r border-slate-200 dark:border-white/10 pr-6">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Molhadas</span>
                            <span className="text-sm font-black text-blue-600 dark:text-blue-400 transition-colors">{fmtNum(stats?.qtd_molhado || 0)} <span className="text-[10px] text-slate-500 dark:text-slate-500 font-medium">un</span></span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Tombadas</span>
                            <span className="text-sm font-black text-red-600 dark:text-red-400 transition-colors">{fmtNum(stats?.qtd_tombada || 0)} <span className="text-[10px] text-slate-500 dark:text-slate-500 font-medium">un</span></span>
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
                        <div className="flex items-center justify-around gap-8 text-center w-full">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Completos</span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 transition-colors">{advancedStats.completoCount}</span>
                          </div>
                          <div className="h-6 w-[1px] bg-slate-200 dark:bg-white/10" />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Disponíveis</span>
                            <span className="text-sm font-black text-blue-600 dark:text-blue-400 transition-colors">{advancedStats.disponivelCount}</span>
                          </div>
                        </div>
                      }
                    />
                    <MetricCard
                      title="SKUs Ativos"
                      value={stats?.total_skus?.toLocaleString('pt-BR') ?? "0"}
                      icon={TrendingUp}
                      delay={0.4}
                      hoverContent={
                        <div className="flex flex-col items-center gap-2 w-full">
                          <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Capacidade Total</span>
                          <span className="text-sm font-black text-slate-900 dark:text-slate-100">{stats?.total_capacity?.toLocaleString('pt-BR') ?? "0"} PTs</span>
                        </div>
                      }
                    />
                  </div>

                  {/* Analytics Section */}
                  <div className="grid grid-cols-1 gap-4 md:gap-8 lg:grid-cols-2">
                    {/* Capacity Donut */}
                    <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-8 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors">
                      <div className="flex items-center justify-between mb-10">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">CAPACIDADE FÍSICA</h3>
                          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-widest mt-1">VOLUME GEOGRÁFICO G300</p>
                        </div>
                        <History size={18} className="text-slate-400 dark:text-slate-600" />
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 md:gap-10">
                        <div className="group/donut relative h-44 w-44 cursor-crosshair">
                          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                            <circle className="text-slate-50 dark:text-slate-800" strokeWidth="12" stroke="currentColor" fill="transparent" r="38" cx="50" cy="50" />
                            <motion.circle className="text-blue-600 dark:text-blue-500" strokeWidth="12" strokeDasharray={2 * Math.PI * 38} initial={{ strokeDashoffset: 2 * Math.PI * 38 }} animate={{ strokeDashoffset: (2 * Math.PI * 38) * (1 - advancedStats.occupiedPercent / 100) }} strokeLinecap="round" stroke="currentColor" fill="transparent" r="38" cx="50" cy="50" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{Math.round(advancedStats.occupiedPercent)}%</span>
                            <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">USO</span>
                          </div>

                          {/* Capacity Breakdown Tooltip */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 lg:top-1/2 lg:left-full lg:ml-4 lg:-translate-y-1/2 lg:translate-x-0 hidden group-hover/donut:block z-50 w-64 pointer-events-none">
                            <div className="bg-slate-900/95 backdrop-blur-xl text-white rounded-3xl p-6 shadow-2xl border border-white/10 relative">
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
                              {/* Arrow for mobile (top) and desktop (left) */}
                              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900/95 rotate-45 border-l border-t border-white/10 lg:hidden" />
                              <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-slate-900/95 rotate-45 border-l border-b border-white/10 hidden lg:block" />
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 space-y-3 w-full">
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
                            <div className="flex items-center gap-2.5">
                              <div className="h-2 w-2 rounded-full bg-slate-400" />
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Espaço Total</span>
                            </div>
                            <span className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">{advancedStats.totalCapacity}</span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
                            <div className="flex items-center gap-2.5">
                              <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vagas Ocupadas</span>
                            </div>
                            <span className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">{advancedStats.occupied}</span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
                            <div className="flex items-center gap-2.5">
                              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vagas Livres</span>
                            </div>
                            <span className="text-sm font-black text-emerald-500 tracking-tight">{advancedStats.free}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* TOP 10 SKUS SECTION (Phase 9) */}
                    <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-8 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors overflow-hidden">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                              TOP 3 SKUS
                            </h3>
                          </div>

                          {/* Geral/Molhado Toggle */}
                          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-xl">
                            <button
                              onClick={() => setTopSkusFilter("geral")}
                              className={cn(
                                "px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all",
                                topSkusFilter === "geral"
                                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                              )}
                            >
                              Geral
                            </button>
                            <button
                              onClick={() => setTopSkusFilter("molhado")}
                              className={cn(
                                "px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all",
                                topSkusFilter === "molhado"
                                  ? "bg-blue-600 text-white shadow-sm"
                                  : "text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                              )}
                            >
                              Molhado
                            </button>
                          </div>
                        </div>

                        {/* 3 Potinhos Menu */}
                        <div className="relative">
                          <button
                            onClick={() => setShowTopSkusMenu(!showTopSkusMenu)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                          >
                            <MoreHorizontal size={20} />
                          </button>

                          <AnimatePresence>
                            {showTopSkusMenu && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setShowTopSkusMenu(false)}
                                />
                                <motion.div
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-50 overflow-hidden"
                                >
                                  <div className="px-3 py-2 border-b border-slate-50 dark:border-slate-800/50 mb-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Métrica</span>
                                  </div>
                                  <button
                                    onClick={() => { setTopSkusSort("quantidade"); setShowTopSkusMenu(false); }}
                                    className={cn(
                                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-black uppercase transition-colors",
                                      topSkusSort === "quantidade"
                                        ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600"
                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    )}
                                  >
                                    Quantidade
                                    {topSkusSort === "quantidade" && <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
                                  </button>
                                  <button
                                    onClick={() => { setTopSkusSort("incidencia"); setShowTopSkusMenu(false); }}
                                    className={cn(
                                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-black uppercase transition-colors",
                                      topSkusSort === "incidencia"
                                        ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600"
                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    )}
                                  >
                                    Incidência
                                    {topSkusSort === "incidencia" && <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="w-full space-y-2">
                        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {advancedStats.top10Skus.length > 0 ? (
                            advancedStats.top10Skus.map((item: any, idx: number) => (
                              <div key={item.sku} className="grid grid-cols-[auto_1fr_100px] gap-4 items-center p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group/row">
                                {/* Rank */}
                                <div className="h-10 w-10 flex items-center justify-center rounded-2xl font-black text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all">
                                  {idx + 1}
                                </div>

                                {/* Info */}
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-xs font-black tracking-tight uppercase truncate text-slate-700 dark:text-slate-200 transition-colors">
                                      {item.sku}
                                    </span>
                                  </div>
                                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate leading-tight">
                                    {item.descricao}
                                  </span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[8px] font-black text-blue-500/60 dark:text-blue-400/40 uppercase tracking-widest">
                                      {item.posicoesCount} POSIÇÕES
                                    </span>
                                    <div className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                      {Math.round(item.paletes)} PALETES
                                    </span>
                                  </div>
                                </div>

                                {/* Quantity Pill */}
                                <div className="flex justify-end">
                                  <div className="px-3 py-1.5 rounded-xl font-black text-[11px] tracking-tight min-w-[70px] text-center transition-all bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-transparent">
                                    {topSkusSort === "incidencia"
                                      ? `${item.incidencia} REG`
                                      : fmtNum(topSkusFilter === "molhado" ? item.molhados : item.quantidade)}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-20 flex flex-col items-center justify-center opacity-20">
                              <Box size={40} className="mb-2" />
                              <p className="text-[10px] font-black uppercase tracking-widest">Aguardando dados...</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* MOVEMENTS & CHART SECTION */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT: CHART */}
                    <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-4 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors overflow-hidden flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                              Fluxo de Registros
                            </h3>
                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-widest mt-1">
                              {`VOLUME TOTAL DO PERÍODO: ${movementPeriod.toUpperCase()}`}
                            </p>
                          </div>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setShowMovementMenu(!showMovementMenu)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-600"
                          >
                            <MoreHorizontal size={18} />
                          </button>

                          <AnimatePresence>
                            {showMovementMenu && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowMovementMenu(false)} />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                  className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-20 p-1.5"
                                >
                                  {[
                                    { id: "hoje", label: "Hoje" },
                                    { id: "semana", label: "Semanal" },
                                    { id: "mensal", label: "Mensal" }
                                  ].map((p) => (
                                    <button
                                      key={p.id}
                                      onClick={() => {
                                        setMovementPeriod(p.id as any)
                                        setShowMovementMenu(false)
                                      }}
                                      className={cn(
                                        "w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors",
                                        movementPeriod === p.id
                                          ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                                          : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                                      )}
                                    >
                                      {p.label}
                                    </button>
                                  ))}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="flex-1 relative mt-4">
                        {/* Y-Axis */}
                        <div className="absolute left-8 top-0 bottom-6 w-[1px] bg-slate-100 dark:bg-slate-800" />
                        {/* X-Axis */}
                        <div className="absolute left-8 right-0 bottom-6 h-[1px] bg-slate-100 dark:bg-slate-800" />

                        <div className="flex items-end justify-center gap-4 h-full pl-10 pr-4 pb-6">
                          {stats?.top_moved && stats.top_moved.length > 0 ? (() => {
                            const isIndividual = movementPeriod === "hoje";
                            const isWeekly = movementPeriod === "semana";
                            const isMonthly = movementPeriod === "mensal";

                            let chartItems: any[] = [];

                            if (isIndividual) {
                              chartItems = stats.top_moved.slice(0, 10).map((m: any) => ({
                                label: m.data,
                                sublabel: m.produto.split(' ')[0],
                                mov: m.entrada > 0 ? "ENT" : "SAÍ",
                                val: m.movimentacao,
                                molhado: m.molhado || 0,
                                isEntrada: m.entrada > 0,
                                details: [{ sku: m.produto, val: m.movimentacao, molhado: m.molhado || 0 }]
                              }));
                            } else if (isWeekly) {
                              const groups: Record<string, { ent: { val: number, molh: number, items: any[] }, sai: { val: number, molh: number, items: any[] } }> = {};
                              stats.top_moved.forEach((m: any) => {
                                const d = m.dia_semana || "N/I";
                                if (!groups[d]) groups[d] = { ent: { val: 0, molh: 0, items: [] }, sai: { val: 0, molh: 0, items: [] } };
                                if (m.entrada > 0) {
                                  groups[d].ent.val += m.entrada;
                                  groups[d].ent.molh += (m.molhado || 0);
                                  const existing = groups[d].ent.items.find((i: any) => i.sku === m.produto);
                                  if (existing) {
                                    existing.val += m.entrada;
                                    existing.molhado += (m.molhado || 0);
                                  } else {
                                    groups[d].ent.items.push({ sku: m.produto, val: m.entrada, molhado: m.molhado || 0 });
                                  }
                                }
                                if (m.saida > 0) {
                                  groups[d].sai.val += m.saida;
                                  groups[d].sai.molh += (m.molhado || 0);
                                  const existing = groups[d].sai.items.find((i: any) => i.sku === m.produto);
                                  if (existing) {
                                    existing.val += m.saida;
                                    existing.molhado += (m.molhado || 0);
                                  } else {
                                    groups[d].sai.items.push({ sku: m.produto, val: m.saida, molhado: m.molhado || 0 });
                                  }
                                }
                              });

                              Object.entries(groups).forEach(([dia, vals]) => {
                                if (vals.ent.val > 0) chartItems.push({ label: dia, sublabel: "ENTRADAS", mov: "ENT", val: vals.ent.val, molhado: vals.ent.molh, isEntrada: true, details: vals.ent.items });
                                if (vals.sai.val > 0) chartItems.push({ label: dia, sublabel: "SAÍDAS", mov: "SAÍ", val: vals.sai.val, molhado: vals.sai.molh, isEntrada: false, details: vals.sai.items });
                              });
                            } else if (isMonthly) {
                              const groups: Record<string, { ent: { val: number, molh: number, items: any[] }, sai: { val: number, molh: number, items: any[] } }> = {};
                              stats.top_moved.forEach((m: any) => {
                                const mes = m.mes || "N/I";
                                if (!groups[mes]) groups[mes] = { ent: { val: 0, molh: 0, items: [] }, sai: { val: 0, molh: 0, items: [] } };
                                if (m.entrada > 0) {
                                  groups[mes].ent.val += m.entrada;
                                  groups[mes].ent.molh += (m.molhado || 0);
                                  const existing = groups[mes].ent.items.find((i: any) => i.sku === m.produto);
                                  if (existing) {
                                    existing.val += m.entrada;
                                    existing.molhado += (m.molhado || 0);
                                  } else {
                                    groups[mes].ent.items.push({ sku: m.produto, val: m.entrada, molhado: m.molhado || 0 });
                                  }
                                }
                                if (m.saida > 0) {
                                  groups[mes].sai.val += m.saida;
                                  groups[mes].sai.molh += (m.molhado || 0);
                                  const existing = groups[mes].sai.items.find((i: any) => i.sku === m.produto);
                                  if (existing) {
                                    existing.val += m.saida;
                                    existing.molhado += (m.molhado || 0);
                                  } else {
                                    groups[mes].sai.items.push({ sku: m.produto, val: m.saida, molhado: m.molhado || 0 });
                                  }
                                }
                              });
                              Object.entries(groups).forEach(([mes, vals]) => {
                                if (vals.ent.val > 0) chartItems.push({ label: mes, sublabel: "ENTRADAS", mov: "ENT", val: vals.ent.val, molhado: vals.ent.molh, isEntrada: true, details: vals.ent.items });
                                if (vals.sai.val > 0) chartItems.push({ label: mes, sublabel: "SAÍDAS", mov: "SAÍ", val: vals.sai.val, molhado: vals.sai.molh, isEntrada: false, details: vals.sai.items });
                              });
                            }

                            // Limitar para não quebrar o layout
                            chartItems = chartItems.slice(0, 12);
                            const maxVal = Math.max(...chartItems.map((m: any) => m.val), 1);

                            if (chartItems.length === 0) {
                              return (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <BarChart3 size={18} className="text-slate-400" />
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Sem registros</p>
                                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">Nenhuma movimentação para este período</p>
                                  </div>
                                  <button
                                    onClick={() => setMovementPeriod("semana")}
                                    className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 transition-colors"
                                  >
                                    Ver semana →
                                  </button>
                                </div>
                              );
                            }
                            return chartItems.map((item: any, idx: number) => {
                              const heightPercent = (item.val / maxVal) * 100;
                              return (
                                <div key={idx} className={cn(
                                  "flex flex-col items-center gap-2 group/bar flex-1",
                                  isIndividual ? "max-w-[40px]" : "max-w-[60px]"
                                )}>
                                  <div className="relative w-full flex flex-col items-center justify-end h-24">
                                    <span className={cn(
                                      "absolute text-[9px] font-black pointer-events-none transition-all duration-300",
                                      item.isEntrada ? "text-emerald-500" : "text-orange-500"
                                    )}
                                      style={{
                                        bottom: `calc(${heightPercent}% + 4px)`,
                                      }}
                                    >
                                      {item.isEntrada ? `+${item.val}` : item.val}
                                    </span>

                                    <motion.div
                                      initial={{ height: 0 }}
                                      animate={{ height: `${heightPercent}%` }}
                                      className={cn(
                                        "w-full rounded-t-lg rounded-b-sm transition-all shrink-0 relative",
                                        item.isEntrada
                                          ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                                          : "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.2)]"
                                      )}
                                    >
                                      {/* Tooltip on hover */}
                                      <div className="absolute opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-[100] bottom-full left-1/2 -translate-x-1/2 mb-4">
                                        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 p-2.5 rounded-2xl shadow-2xl min-w-[140px] max-w-[200px]">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-white uppercase tracking-wider">{item.label}</span>
                                            <span className={cn("text-[9px] font-black", item.isEntrada ? "text-emerald-400" : "text-orange-400")}>
                                              {item.isEntrada ? "ENTRADA" : "SAÍDA"}
                                            </span>
                                          </div>
                                          <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                                            {item.details?.slice(0, 5).map((d: any, i: number) => (
                                              <div key={i} className="flex flex-col gap-0.5 border-l-2 border-slate-700 pl-2">
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className="text-[9px] font-black text-slate-300 truncate tracking-tight">{d.sku}</span>
                                                  <span className="text-[9px] font-black text-white shrink-0">
                                                    {item.isEntrada ? "+" : "-"}{d.val}
                                                  </span>
                                                </div>
                                                {d.molhado > 0 && (
                                                  <div className="flex items-center gap-1">
                                                    <Droplet size={8} className="text-blue-400" />
                                                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">
                                                      {d.molhado} MOLHADOS
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                            {item.details?.length > 5 && (
                                              <div className="text-[8px] font-black text-slate-500 text-center py-1 uppercase tracking-widest">
                                                + {item.details.length - 5} OUTROS
                                              </div>
                                            )}
                                          </div>
                                          {item.molhado > 0 && (
                                            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">Total Molhado</span>
                                              <span className="text-[9px] font-black text-blue-400">{item.molhado}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </motion.div>
                                  </div>
                                  <div className="flex flex-col items-center shrink-0 w-full overflow-hidden">
                                    <span className="text-[8px] font-black text-slate-900 dark:text-slate-100 uppercase truncate w-full text-center">
                                      {item.label}
                                    </span>
                                    <span className="text-[6px] font-bold text-slate-400 dark:text-slate-600 uppercase truncate w-full text-center">
                                      {item.sublabel}
                                    </span>
                                  </div>
                                </div>
                              );
                            });
                          })() : (
                            <div className="w-full h-full flex flex-col items-center justify-center opacity-20">
                              <BarChart3 size={32} className="mb-2" />
                              <p className="text-[10px] font-black uppercase tracking-widest">Sem dados para o gráfico</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>

                    {/* RIGHT: LIST */}
                    <motion.div className="group relative rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-4 shadow-xl border border-slate-100 dark:border-slate-800 transition-colors overflow-hidden flex flex-col min-h-[320px]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                              Últimas Movimentações
                            </h3>
                          </div>
                        </div>
                        <Activity size={18} className="text-slate-400 dark:text-slate-600" />
                      </div>

                      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                        {stats?.top_moved && stats.top_moved.length > 0 ? (
                          <div className="flex flex-col">
                            {/* Header Row */}
                            <div className="grid grid-cols-[60px_100px_1fr_60px_80px] gap-4 px-4 py-2 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                              <div>Data</div>
                              <div>Código</div>
                              <div>Descrição</div>
                              <div className="text-right">Qtd</div>
                              <div className="text-right">Origem</div>
                            </div>

                            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                              {stats.top_moved.slice(0, 5).map((mov: any, idx: number) => (
                                <div key={idx} className="grid grid-cols-[60px_100px_1fr_60px_80px] gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors items-center">
                                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                    {mov.data || "-"}
                                  </div>
                                  <div className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate">
                                    {mov.produto}
                                  </div>
                                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                    {mov.descricao !== "-" ? mov.descricao : "Sem Descrição"}
                                  </div>
                                  <div className={cn(
                                    "text-right text-[11px] font-black",
                                    mov.entrada > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"
                                  )}>
                                    {mov.entrada > 0 ? "+" : "-"}{mov.movimentacao}
                                  </div>
                                  <div className="text-right text-[9px] font-black uppercase tracking-tight text-slate-400 dark:text-slate-500">
                                    {mov.origem !== "-" ? mov.origem : "N/I"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
                            <History size={40} className="mb-2" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma movimentação</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>

                </motion.div>
              )}

              {(topTab === "produtos") && (
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
                          "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-black transition-all shrink-0 whitespace-nowrap",
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
                          "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-black transition-all relative group shrink-0 whitespace-nowrap",
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
                        <button onClick={() => { setSortMode("qty_desc"); setTableSort({ key: "none", direction: "asc" }); }} className={cn("px-4 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all", sortMode === "qty_desc" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
                          <ArrowDownWideNarrow size={14} className="inline mr-1" /> Maior Qtd.
                        </button>
                        <button onClick={() => { setSortMode("alpha_asc"); setTableSort({ key: "none", direction: "asc" }); }} className={cn("px-4 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all", sortMode === "alpha_asc" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
                          <ArrowDownAZ size={14} className="inline mr-1" /> A-Z
                        </button>
                      </div>
                      <div className="relative w-full md:w-auto group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 transition-colors group-focus-within:text-blue-500" size={16} />
                        <input type="text" placeholder="Pesquisar detalhes..." className="w-full md:w-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-11 pr-5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-blue-500 dark:focus:border-blue-900 transition-all font-medium shadow-sm transition-colors" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                      <div className="rounded-3xl md:rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl dark:shadow-slate-950/50 overflow-x-auto custom-scrollbar transition-colors">
                        <div className="min-w-[800px] lg:min-w-full">
                          <WarehouseTable
                            columns={getColumns()}
                            data={paginatedData}
                            delay={0.1}
                            onRowClick={(row) => {
                              if (activeView === "produtos") {
                                setModalFilter(false)
                                setSelectedProduct(row.produto)
                              }
                              if (activeView === "molhados") {
                                setModalFilter(true)
                                setSelectedProduct(row.produto)
                              }
                            }}
                            sortConfig={tableSort}
                            onSort={handleSort}
                          />
                        </div>
                      </div>

                      {!loading && totalPages >= 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 pb-12 transition-colors">
                          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest order-2 sm:order-1">Página {currentPage} de {totalPages}</span>
                          <div className="flex gap-3 order-1 sm:order-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="flex-1 sm:flex-none p-4 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm transition-all active:scale-95 transition-colors"><ChevronLeft size={18} /></button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="flex-1 sm:flex-none p-4 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm transition-all active:scale-95 transition-colors"><ChevronRight size={18} /></button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              )}

              {topTab === "mapeamento" && (
                <motion.div
                  key="mapeamento-content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  {/* KPI AREA */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <MetricCard
                      title="PALETES ARMAZENADOS"
                      value={stats?.total_pallets?.toLocaleString('pt-BR') ?? "0"}
                      icon={Package}
                      delay={0.1}
                    />
                    <MetricCard
                      title="PALETES MISTOS"
                      value={advancedStats.mixedCount}
                      icon={Layers}
                      delay={0.2}
                      className={cn(advancedStats.mixedCount > 10 ? "border-orange-200 dark:border-orange-900/50" : "")}
                    />
                    <MetricCard
                      title="TOTAL DE DRIVE-IN"
                      value={fmtNum(advancedStats.totalPositions)}
                      icon={MapPin}
                      delay={0.3}
                    />
                    <MetricCard
                      title="PENDÊNCIAS TOTAIS"
                      value={stats?.divergences?.length ?? 0}
                      icon={AlertCircle}
                      delay={0.4}
                      className={cn((stats?.divergences?.length ?? 0) > 0 ? "border-amber-200 dark:border-amber-900/50" : "")}
                    />
                  </div>

                  {/* Analytics Grid Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                    {/* NEW Capacity Card (Left) */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className="rounded-[2.5rem] bg-slate-900 dark:bg-slate-900/50 p-6 md:p-8 shadow-2xl border border-white/5 overflow-hidden relative group"
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                        <MapPin size={120} className="text-blue-500" />
                      </div>

                      <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                              Capacidade de Drives
                              <div className="group/tip relative flex items-center">
                                <Info size={14} className="text-slate-500 cursor-help" />
                                <div className="absolute left-full ml-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-white/10 z-[100]">
                                  Ocupação física total do armazém
                                </div>
                              </div>
                            </h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ocupação Física</p>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                              <span className="text-slate-400">Drives Ocupados</span>
                              <span className="text-white">{advancedStats.totalPositions - advancedStats.vazioCount} / {advancedStats.totalPositions}</span>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${((advancedStats.totalPositions - advancedStats.vazioCount) / (advancedStats.totalPositions || 1)) * 100}%` }}
                                className="h-full bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                              <span className="text-slate-400">Capacidade Total</span>
                              <span className="text-white">{(advancedStats.occupiedPercent || 0).toFixed(1)}%</span>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${advancedStats.occupiedPercent || 0}%` }}
                                className="h-full bg-slate-400 rounded-full shadow-[0_0_15px_rgba(148,163,184,0.3)]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* MODIFIED Mix Card (Right) */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 }}
                      className="rounded-[2.5rem] bg-slate-900 dark:bg-slate-900/50 p-6 md:p-8 shadow-2xl border border-white/5 overflow-hidden relative group"
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                        <Layers size={120} className="text-orange-500" />
                      </div>

                      <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                              Distribuição de Mix
                              <div className="group/tip relative flex items-center">
                                <Info size={14} className="text-slate-500 cursor-help" />
                                <div className="absolute left-full ml-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-white/10 z-[100]">
                                  Volume de Mono-produto vs Mixed SKUs
                                </div>
                              </div>
                            </h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Eficiência de Armazenagem</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 items-end">
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                                <span className="text-slate-400">Mono</span>
                                <span className="text-white">{(100 - (advancedStats.mixPercent || 0)).toFixed(1)}%</span>
                              </div>
                              <div className="h-2 w-8/12 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${100 - (advancedStats.mixPercent || 0)}%` }}
                                  className="h-full bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                                <span className="text-slate-400">Mix</span>
                                <span className="text-white">{(advancedStats.mixPercent || 0).toFixed(1)}%</span>
                              </div>
                              <div className="h-2 w-8/12 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${advancedStats.mixPercent || 0}%` }}
                                  className="h-full bg-orange-500 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-4 border-l border-white/5 pl-8">
                            <div>
                              <span className="text-3xl font-black text-emerald-500 tracking-tighter leading-none">{advancedStats.totalMono}</span>
                              <p className="text-[8px] font-black text-slate-500 uppercase tracking-tight mt-1">Organizados</p>
                            </div>
                            <div>
                              <span className="text-3xl font-black text-orange-500 tracking-tighter leading-none">{advancedStats.totalMixed}</span>
                              <p className="text-[8px] font-black text-slate-500 uppercase tracking-tight mt-1">Críticos</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* REFINED FILTER BAR */}
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between py-6 border-y border-slate-100 dark:border-slate-800 transition-colors">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit border border-slate-200/50 dark:border-slate-800/50">
                      <button
                        onClick={() => { setDisplayMode("mapa"); setActiveView("geral"); }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black transition-all",
                          displayMode === "mapa" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                      >
                        <MapPin size={14} /> MAPA
                      </button>
                      <button
                        onClick={() => { setDisplayMode("tabela"); setActiveView("posicoes"); setTableSort({ key: "posicao", direction: "asc" }); setSortMode("none"); }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black transition-all",
                          displayMode === "tabela" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                      >
                        <LayoutGrid size={14} /> TABELA
                      </button>
                      <button
                        onClick={() => { setDisplayMode("misto"); setActiveView("geral"); }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black transition-all",
                          displayMode === "misto" ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                      >
                        <Layers size={14} /> PALETES MISTOS
                      </button>
                      <button
                        onClick={() => { setDisplayMode("nao_alocados"); setActiveView("nao_alocados"); setSortMode("none"); setTableSort({ key: "produto", direction: "asc" }); }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] uppercase font-black transition-all",
                          displayMode === "nao_alocados" ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                      >
                        <AlertCircle size={14} /> Não alocados
                      </button>
                    </div>

                    {/* Middle Legend (Map Only with Counts) */}
                    <div className="hidden lg:flex items-center justify-center gap-8 flex-1 px-8">
                      {displayMode === "mapa" && (
                        <>
                          <div className="flex items-center gap-2.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              VAZIO <span className="ml-1 text-slate-900 dark:text-white">{advancedStats.vazioCount}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-[#2D5A27] shadow-[0_0_8px_rgba(45,90,39,0.4)]" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              DISPONÍVEL <span className="ml-1 text-slate-900 dark:text-white">{advancedStats.totalPositions - advancedStats.lotadoCount - advancedStats.vazioCount}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-[#7F1D1D] shadow-[0_0_8px_rgba(127,29,29,0.4)]" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              LOTADO <span className="ml-1 text-slate-900 dark:text-white">{advancedStats.lotadoCount}</span>
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      {displayMode === "tabela" && (
                        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                          <button
                            onClick={() => setSortMode("qty_desc")}
                            className={cn(
                              "flex items-center gap-2 rounded-xl px-3 py-1.5 text-[9px] font-black transition-all",
                              sortMode === "qty_desc" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-600"
                            )}
                          >
                            <TrendingDown size={14} /> MAIOR QTD.
                          </button>
                          <button
                            onClick={() => setSortMode("alpha_asc")}
                            className={cn(
                              "flex items-center gap-2 rounded-xl px-3 py-1.5 text-[9px] font-black transition-all",
                              sortMode === "alpha_asc" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-600"
                            )}
                          >
                            <ArrowDownAZ size={14} /> A-Z
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <div className="relative group w-full sm:w-64">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                          <input
                            type="text"
                            placeholder="Pesquisar no mapeamento..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-11 pl-11 pr-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-xs font-bold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
                          />
                        </div>

                        {/* Map Options Button */}
                        {displayMode === "mapa" && (
                          <div className="relative">
                            <button
                              onClick={() => setMapMenuOpen(v => !v)}
                              title="Opções de Exportação"
                              className={cn(
                                "flex items-center justify-center h-11 w-11 rounded-2xl border transition-all active:scale-95",
                                mapMenuOpen
                                  ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 shadow-sm"
                                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shadow-sm"
                              )}
                            >
                              <MoreHorizontal size={20} />
                            </button>

                            <AnimatePresence>
                              {mapMenuOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                  transition={{ duration: 0.15, ease: "easeOut" }}
                                  className="absolute right-0 top-[120%] z-50 origin-top-right"
                                >
                                  <div className="flex flex-col gap-2 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl min-w-[240px]">
                                    <button
                                      onClick={() => { handleExportMap("all"); setMapMenuOpen(false); }}
                                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all group"
                                      title="Imprimir mapa completo"
                                    >
                                      <div className="h-8 w-8 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                        <Printer size={16} />
                                      </div>
                                      <div className="flex flex-col items-start text-left">
                                        <span className="text-[11px] font-black uppercase tracking-tight">Imprimir Tudo</span>
                                        <span className="text-[9px] font-medium opacity-60">Mapa completo (PDF)</span>
                                      </div>
                                    </button>

                                    <button
                                      onClick={() => {
                                        const newMode = !selectionModeActive;
                                        setSelectionModeActive(newMode);
                                        if (!newMode) setSelectedPositions(new Set());
                                        setMapMenuOpen(false);
                                      }}
                                      className={cn(
                                        "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group",
                                        selectionModeActive ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                                      )}
                                      title={selectionModeActive ? "Desativar seleção manual" : "Selecionar posições manualmente"}
                                    >
                                      <div className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                                        selectionModeActive ? "bg-blue-600 text-white" : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white"
                                      )}>
                                        <CheckSquare size={16} />
                                      </div>
                                      <div className="flex flex-col items-start text-left">
                                        <span className="text-[11px] font-black uppercase tracking-tight">
                                          {selectionModeActive ? "Sair da Seleção" : "Escolher Posições"}
                                        </span>
                                        <span className="text-[9px] font-medium opacity-60">Escolha manual para impressão</span>
                                      </div>
                                    </button>

                                    <button
                                      onClick={() => { handleExportMap("filtered"); setMapMenuOpen(false); }}
                                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all group"
                                      title="Imprimir apenas resultados filtrados"
                                    >
                                      <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 group-hover:bg-slate-600 group-hover:text-white transition-colors">
                                        <FileText size={16} />
                                      </div>
                                      <div className="flex flex-col items-start text-left">
                                        <span className="text-[11px] font-black uppercase tracking-tight">Imprimir Filtro</span>
                                        <span className="text-[9px] font-medium opacity-60">Apenas resultados atuais</span>
                                      </div>
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {displayMode === "misto" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {mixedPalletsData.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
                          <Box size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                          <p className="text-slate-400 dark:text-slate-600 font-bold">Nenhum palete misto detectado no momento.</p>
                        </div>
                      ) : (
                        mixedPalletsData.map((pallet) => (
                          <motion.div
                            key={pallet.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => setSelectedPalletId(pallet.id)}
                            className="group cursor-pointer rounded-[2.5rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm transition-all hover:border-orange-300 dark:hover:border-orange-900/50 hover:shadow-2xl hover:shadow-orange-100/50 dark:hover:shadow-orange-950/20 flex flex-col gap-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-2xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400 border border-orange-100/50 dark:border-orange-900/30 transition-colors">
                                  <Layers size={20} />
                                </div>
                                <div>
                                  <h4 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">{pallet.id}</h4>
                                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 transition-colors">ID PALETE</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">{fmtNum(pallet.totalQty)}</p>
                                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 transition-colors">Peças</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 py-0.5 transition-colors">
                              {pallet.isMixedSku && (
                                <span className="px-2.5 py-1 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[10px] font-black uppercase border border-red-100 dark:border-red-900/40 flex items-center gap-1.5 transition-colors"><AlertCircle size={10} /> {pallet.skuCount} SKUs</span>
                              )}
                              {pallet.isMixedStatus && (
                                <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase border border-blue-100 dark:border-blue-900/40 flex items-center gap-1.5 transition-colors"><MapPin size={10} /> Misto Aloc/SP</span>
                              )}
                            </div>

                            <div className="space-y-2 mt-auto pt-4 border-t border-slate-50 dark:border-slate-800 transition-colors">
                              <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                <span>Produtos no Palete</span>
                                <div className="flex items-center gap-1 text-orange-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                  <span className="text-[9px]">DETALHES</span>
                                  <ChevronRight size={10} />
                                </div>
                              </div>
                              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed transition-colors">
                                {pallet.skus.join(", ")}
                              </p>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  )}
                  {displayMode === "mapa" && (
                    <div id="warehouse-map" className="space-y-6">
                      {/* Map Header (Condensed) */}
                      <div className="relative flex items-center justify-end min-h-[12px]">
                        {/* Legend moved to Filter Bar below KPIs for space efficiency */}
                      </div>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-8">
                        {Object.entries(streetData).map(([streetName, sections]) => {
                          const allPositions = Object.values(sections).flat();
                          const lotadoPos = allPositions.filter((p: any) => p.paletes >= p.capacidade && p.capacidade > 0).length;
                          const disponivelPos = allPositions.filter((p: any) => p.paletes > 0 && p.paletes < p.capacidade).length;
                          const vazioPos = allPositions.filter((p: any) => p.paletes === 0).length;

                          const totalUso = Math.round(allPositions.reduce((acc: number, p: any) => acc + (p.paletes || 0), 0));
                          const totalCap = Math.round(allPositions.reduce((acc: number, p: any) => acc + (p.capacidade || 0), 0));
                          const occupancyPercent = totalCap > 0 ? (totalUso / totalCap) * 100 : 0;

                          return (
                            <div key={streetName} className="p-4 md:p-6 rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors relative group/card hover:shadow-xl dark:hover:shadow-slate-950/40 transition-all duration-300">
                              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
                                <div className="flex items-center gap-4">
                                  {/* Industrial Badge Style - Neutralized */}
                                  <div className="flex overflow-hidden rounded-lg shadow-sm border border-black/5 dark:border-white/5">
                                    <div className="bg-slate-200 dark:bg-slate-800 px-3 py-1.5 flex items-center justify-center font-black text-slate-700 dark:text-slate-300 text-[13px] tracking-tight border-r border-slate-300 dark:border-slate-700">{streetName}</div>
                                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-1.5 flex items-center justify-center font-black text-slate-500 dark:text-slate-400 text-[11px] tracking-widest uppercase">Bloco</div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-6">
                                  <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                      <div className="h-1.5 w-1.5 rounded-full bg-red-600" /> LOTADOS
                                    </span>
                                    <p className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">{lotadoPos}</p>
                                  </div>
                                  <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-6">
                                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> DISPONÍVEIS
                                    </span>
                                    <p className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">{disponivelPos}</p>
                                  </div>
                                  <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-6">
                                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                      <div className="h-1.5 w-1.5 rounded-full bg-slate-500" /> VAZIOS
                                    </span>
                                    <p className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">{vazioPos}</p>
                                  </div>
                                  <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-6">
                                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">OCUPAÇÃO</span>
                                    <p className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">{Math.round(occupancyPercent)}%</p>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 relative">
                                {/* Vertical Divider */}
                                <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-100 dark:bg-slate-800/60" />

                                {Object.entries(sections).map(([side, positions]) => {
                                  const sideCapacity = positions.reduce((acc: number, p: any) => acc + (p.capacidade || 0), 0);
                                  const sideUsage = positions.reduce((acc: number, p: any) => acc + (p.paletes || 0), 0);
                                  const sideAvailable = Math.max(0, sideCapacity - sideUsage);

                                  return (
                                    <div key={side} className="space-y-4 relative z-10 py-1">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2 mb-4 gap-2">
                                        <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest leading-none">Lado {side === "even" ? "PAR" : "ÍMPAR"}</p>
                                        <div className="flex items-center gap-3">
                                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">CAP: <span className="text-slate-700 dark:text-slate-300">{Math.round(sideCapacity)}</span></span>
                                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">USO: <span className="text-slate-700 dark:text-slate-300">{Math.round(sideUsage)}</span></span>
                                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">LIVRE: <span className="text-slate-700 dark:text-slate-300">{Math.round(sideAvailable)}</span></span>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {positions.map((pos: any) => {
                                          const isFull = pos.capacidade > 0 && pos.paletes >= pos.capacidade
                                          const isOverflow = pos.capacidade > 0 && pos.paletes > pos.capacidade
                                          const isSelected = selectedPositions.has(pos.id)

                                          // Back to simple number extraction for the box interior
                                          const displayNum = pos.id.match(/(\d+)$/)?.[1]?.slice(-3) || pos.id.slice(-3);

                                          return (
                                            <div key={pos.id} className="group relative">
                                              <button
                                                onClick={() => {
                                                  if (selectionModeActive) {
                                                    const newSelection = new Set(selectedPositions)
                                                    if (newSelection.has(pos.id)) newSelection.delete(pos.id)
                                                    else newSelection.add(pos.id)
                                                    setSelectedPositions(newSelection)
                                                  } else {
                                                    setSelectedPosition(pos.id)
                                                  }
                                                }}
                                                className={cn(
                                                  "h-10 w-10 rounded-md border-2 flex items-center justify-center transition-all active:scale-95 relative",
                                                  pos.unregistered_error
                                                    ? "bg-red-900/10 border-red-900 text-red-900 shadow-[0_0_10px_rgba(127,29,29,0.1)]"
                                                    : isOverflow
                                                      ? "bg-red-900/10 border-red-900 text-red-900 shadow-[0_0_10px_rgba(127,29,29,0.1)]"
                                                      : isFull
                                                        ? "bg-transparent border-red-900/70 dark:border-red-900/30 text-red-600 dark:text-red-500"
                                                        : pos.paletes === 0
                                                          ? "bg-slate-50 dark:bg-slate-800/10 border-slate-200 dark:border-slate-800/50 text-slate-400 dark:text-slate-600"
                                                          : "bg-transparent border-emerald-900/70 dark:border-emerald-600/30 text-emerald-800 dark:text-emerald-500",
                                                  isSelected && "ring-4 ring-blue-500/30 border-blue-600 z-10 scale-105"
                                                )}
                                              >
                                                <span className="text-[11px] font-mono font-black tracking-tighter leading-none">
                                                  {displayNum}
                                                </span>
                                              </button>

                                              {/* Floating Tooltip - FIXED Position and Smaller Layout to avoid overlapping */}
                                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[300] w-60 pointer-events-none">
                                                <div className="bg-slate-950/98 text-white rounded-2xl p-4 shadow-2xl border border-white/10 backdrop-blur-xl relative ring-1 ring-white/5">
                                                  <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{pos.id}</span>
                                                    <div className={cn("h-3 w-3 rounded-full ring-2 ring-white/10", isFull ? "bg-red-500" : "bg-emerald-500")} />
                                                  </div>
                                                  <div className="space-y-3">
                                                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                                      <span>Ocupação</span>
                                                      <span className="text-white text-[12px] font-black">{pos.unregistered_error ? "ERRO" : `${Math.round(pos.paletes)}/${Math.round(pos.capacidade)} PTs`}</span>
                                                    </div>
                                                    {pos.products.length > 0 && (
                                                      <div className="pt-2 border-t border-white/5">
                                                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Item no Slot</p>
                                                        <p className="text-[12px] font-black text-slate-100 truncate leading-tight tracking-tight">{pos.products[0].sku}</p>
                                                        {pos.products.length > 1 && (
                                                          <div className="mt-2 py-1 px-2 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-1.5">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                                                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-tight">+ {pos.products.length - 1} ITENS (SKU MIX)</p>
                                                          </div>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                  {/* Arrow */}
                                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-950/98" />
                                                </div>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {(displayMode === "tabela" || displayMode === "nao_alocados") && (
                    <div className="rounded-3xl md:rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl dark:shadow-slate-950/50 overflow-x-auto custom-scrollbar transition-colors">
                      <div className="min-w-[800px] lg:min-w-full">
                        <WarehouseTable
                          columns={getColumns()}
                          data={paginatedData}
                          delay={0.1}
                          onRowClick={(row) => {
                            if (activeView === "produtos") {
                              setModalFilter(false)
                              setSelectedProduct(row.produto)
                            }
                            if (activeView === "molhados") {
                              setModalFilter(true)
                              setSelectedProduct(row.produto)
                            }
                          }}
                          sortConfig={tableSort}
                          onSort={handleSort}
                        />
                      </div>
                    </div>
                  )}

                  {/* Pagination for table within mapeamento */}
                  {(displayMode === "tabela" || displayMode === "nao_alocados") && totalPages >= 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 pb-12 transition-colors">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest order-2 sm:order-1">Página {currentPage} de {totalPages}</span>
                      <div className="flex gap-3 order-1 sm:order-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="flex-1 sm:flex-none p-4 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm transition-all active:scale-95 transition-colors"><ChevronLeft size={18} /></button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="flex-1 sm:flex-none p-4 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm transition-all active:scale-95 transition-colors"><ChevronRight size={18} /></button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {topTab === "confrontos" && (
                <motion.div
                  key="confrontos-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {loadingConfrontos && !confrontosData ? (
                    <div className="flex justify-center flex-col items-center py-20">
                      <div className="w-10 h-10 border-2 border-blue-600 dark:border-blue-400 border-t-transparent dark:border-t-transparent rounded-full flex items-center justify-center animate-spin"></div>
                      <p className="mt-4 text-xs font-bold tracking-widest uppercase text-slate-600 dark:text-slate-400 transition-colors">Sincronizando</p>
                    </div>
                  ) : confrontosData ? (
                    <div className={cn("transition-opacity duration-300 relative", loadingConfrontos && "opacity-50 pointer-events-none")}>
                      {loadingConfrontos && (
                        <div className="absolute inset-x-0 top-32 z-50 flex flex-col items-center justify-center">
                          <div className="w-10 h-10 border-4 border-blue-600 dark:border-blue-400 border-t-transparent dark:border-t-transparent rounded-full animate-spin shadow-xl"></div>
                          <p className="mt-2 text-xs font-bold tracking-widest uppercase text-blue-600 dark:text-blue-400 drop-shadow-md">Atualizando</p>
                        </div>
                      )}
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
                            const divergenciasAjustadas = confrontosData.dados.filter((c: any) => {
                              const ajuste = ajustesConfronto.find(a => a.produto === c.produto)
                              const qtdFisicaAjustada = c.qtd_fisica + (ajuste ? ajuste.quantidade : 0)
                              return qtdFisicaAjustada !== c.qtd_sistema
                            }).length;
                            const total = confrontosData.total_produtos;
                            const acuracidade = Math.round(((total - divergenciasAjustadas) / Math.max(1, total)) * 100);

                            return (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="border border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_30px_-10px_rgba(0,0,0,0.5)]">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Tag className="text-slate-500" size={14} />
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">PRODUTOS ANALISADOS</p>
                                  </div>
                                  <p className="text-3xl font-light text-slate-900 dark:text-slate-100">{total}</p>
                                </div>
                                <div className="border border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_30px_-10px_rgba(0,0,0,0.5)]">
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="text-slate-500" size={14} />
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">DIVERGÊNCIAS ENCONTRADAS</p>
                                  </div>
                                  <p className="text-3xl font-light text-slate-900 dark:text-slate-100">{divergenciasAjustadas}</p>
                                </div>
                                <div className="border border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_30px_-10px_rgba(0,0,0,0.5)]">
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
                                <div className="border border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_30px_-10px_rgba(0,0,0,0.5)]">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Layers className="text-slate-500" size={14} />
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">SALDO LÍQUIDO DE PEÇAS</p>
                                  </div>
                                  <div className="flex items-baseline gap-2">
                                    {(() => {
                                      // Aplica ajustes ao Físico Global
                                      const fisico = confrontosData.dados.reduce((acc: number, item: any) => {
                                        const ajuste = ajustesConfronto.find(a => a.produto === item.produto)
                                        return acc + (item.qtd_fisica + (ajuste ? ajuste.quantidade : 0))
                                      }, 0);

                                      const sistema = confrontosData.dados.reduce((acc: number, item: any) => acc + item.qtd_sistema, 0);
                                      const net = fisico - sistema;
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
                            );
                          })()}

                          {/* Filtros e Busca Funcionais Estilo UI Premium */}
                          {(() => {
                            const counts = confrontosData.dados.reduce((acc: any, c: any) => {
                              const ajuste = ajustesConfronto.find(a => a.produto === c.produto)
                              const qtdFisicaAjustada = c.qtd_fisica + (ajuste ? ajuste.quantidade : 0)
                              const diferenca = qtdFisicaAjustada - c.qtd_sistema

                              acc.all++
                              if (diferenca === 0) {
                                acc.match++
                              } else {
                                acc.divergent++
                                if (diferenca > 0) acc.excess++
                                else acc.missing++
                              }
                              return acc
                            }, { all: 0, divergent: 0, excess: 0, missing: 0, match: 0 })

                            return (
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                                <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-[1.25rem] shadow-inner backdrop-blur-sm">
                                  <button
                                    onClick={() => setConfrontoFilter("all")}
                                    className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "all" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                                  >
                                    Tudo <span className="opacity-70 text-[10px] font-black bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.all}</span>
                                  </button>
                                  <button
                                    onClick={() => setConfrontoFilter("divergent")}
                                    className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "divergent" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                                  >
                                    Divergentes <span className="opacity-70 text-[10px] font-black bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.divergent}</span>
                                  </button>
                                  <button
                                    onClick={() => setConfrontoFilter("excess")}
                                    className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "excess" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                                  >
                                    Sobras <span className="opacity-70 text-[10px] font-black bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.excess}</span>
                                  </button>
                                  <button
                                    onClick={() => setConfrontoFilter("missing")}
                                    className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "missing" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                                  >
                                    Faltas <span className="opacity-70 text-[10px] font-black bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.missing}</span>
                                  </button>
                                  <button
                                    onClick={() => setConfrontoFilter("match")}
                                    className={cn("px-5 py-2.5 text-xs font-bold tracking-wide rounded-[1rem] transition-all flex items-center gap-1.5", confrontoFilter === "match" ? "bg-white text-slate-800 shadow-md dark:bg-slate-800/90 dark:text-white" : "bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/30")}
                                  >
                                    Batendo <span className="opacity-70 text-[10px] font-black bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-md">{counts.match}</span>
                                  </button>
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
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600/10 border border-blue-500/30 rounded-xl text-xs font-bold text-blue-400 hover:bg-blue-600/20 hover:border-blue-500/50 transition-colors shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]"
                                    title="Ajuste Manual de Divergências"
                                  >
                                    <Settings size={14} className={ajustesConfronto.length > 0 ? "animate-spin-slow" : ""} />
                                    <span className="hidden sm:inline">
                                      Ajustes {ajustesConfronto.length > 0 && `(${ajustesConfronto.length})`}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            )
                          })()}

                          {/* Tabela Clean, com visual glassmorphism, leveza nas fontes */}
                          <div className="border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm rounded-2xl overflow-x-auto custom-scrollbar shadow-xl">
                            <table className="w-full text-left min-w-[700px]">
                              <thead className="bg-slate-100/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest transition-colors">Código</th>
                                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest transition-colors">Descrição</th>
                                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest text-right transition-colors">{confrontoType === "fisico_x_a501" ? "Física" : "Sist. A501"}</th>
                                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest text-right transition-colors">{confrontoType === "fisico_x_a501" ? "Sistema" : "Sist. G501"}</th>
                                  <th className="px-5 py-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest text-right transition-colors">Saldo</th>
                                </tr>
                              </thead>
                              <AnimatePresence mode="wait">
                                <motion.tbody
                                  key={`${confrontoType}-${confrontoFilter}-${confrontoSearch}-${confrontoSortDir}`}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  transition={{ duration: 0.2 }}
                                  className="divide-y divide-slate-200 dark:divide-slate-800/50"
                                >
                                  {(() => {
                                    const dadosAjustados = confrontosData.dados.map((c: any) => {
                                      const ajuste = ajustesConfronto.find(a => a.produto === c.produto)
                                      const qtdFisicaAjustada = c.qtd_fisica + (ajuste ? ajuste.quantidade : 0)
                                      const diferencaAjustada = qtdFisicaAjustada - c.qtd_sistema
                                      return {
                                        ...c,
                                        qtd_fisica_original: c.qtd_fisica,
                                        qtd_fisica: qtdFisicaAjustada,
                                        diferenca: diferencaAjustada,
                                        teve_ajuste: !!ajuste,
                                        ajuste_quantidade: ajuste?.quantidade || 0,
                                        motivo_ajuste: ajuste?.motivo
                                      }
                                    });

                                    const filtered = dadosAjustados.filter((c: any) => {
                                      // Filtros de Tabs
                                      if (confrontoFilter === "divergent" && c.diferenca === 0) return false;
                                      if (confrontoFilter === "match" && c.diferenca !== 0) return false;
                                      if (confrontoFilter === "excess" && c.diferenca <= 0) return false;
                                      if (confrontoFilter === "missing" && c.diferenca >= 0) return false;

                                      // Filtro da Busca
                                      if (confrontoSearch) {
                                        const term = confrontoSearch.toLowerCase();
                                        if (!c.produto.toLowerCase().includes(term) && !c.descricao.toLowerCase().includes(term)) {
                                          return false;
                                        }
                                      }
                                      return true;
                                    });

                                    // Ordenação
                                    filtered.sort((a: any, b: any) => {
                                      if (confrontoSortDir === "asc") {
                                        return a.diferenca - b.diferenca;
                                      } else {
                                        return b.diferenca - a.diferenca;
                                      }
                                    });

                                    if (filtered.length === 0) {
                                      return (
                                        <tr>
                                          <td colSpan={5} className="px-5 py-16 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            Nenhum registro encontrado.
                                          </td>
                                        </tr>
                                      )
                                    }

                                    const startIndex = (confrontoCurrentPage - 1) * confrontoItemsPerPage;
                                    const endIndex = startIndex + confrontoItemsPerPage;
                                    const paginatedFiltered = filtered.slice(startIndex, endIndex);

                                    return paginatedFiltered.map((c: any, i: number) => (
                                      <tr key={i} onClick={() => setSelectedConfrontoItem(c)} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all hover:scale-[1.01] hover:shadow-lg group cursor-pointer relative z-0 hover:z-10">
                                        <td className="px-5 py-3.5">
                                          <span className="text-sm font-normal text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{c.produto}</span>
                                          {c.teve_ajuste && (
                                            <span className="ml-2 inline-flex border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[8px] font-bold px-1.5 py-0.5 rounded-md align-middle shadow-sm" title={c.motivo_ajuste}>
                                              AJUSTADO
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                          <p className="text-xs font-normal text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors truncate max-w-[250px]">{c.descricao}</p>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                          <div className="flex flex-col items-end">
                                            <span className={cn("text-sm font-normal", c.teve_ajuste ? "text-blue-600 dark:text-blue-300 font-bold" : "text-slate-600 dark:text-slate-300")}>{fmtNum(c.qtd_fisica)}</span>
                                            {c.teve_ajuste && (
                                              <span className="text-[9px] text-slate-400 dark:text-slate-500 line-through">Orig: {fmtNum(c.qtd_fisica_original)}</span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                          <span className="text-sm font-normal text-slate-600 dark:text-slate-300">{fmtNum(c.qtd_sistema)}</span>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                          {c.diferenca === 0 ? (
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Bateu</span>
                                          ) : (
                                            <span className={cn("text-xs font-bold", c.diferenca > 0 ? "text-amber-500 dark:text-amber-400" : "text-rose-600 dark:text-rose-400")}>
                                              {c.diferenca > 0 ? "+" : ""}{c.diferenca} {c.diferenca > 0 ? "(Positivado)" : "(Negativo)"}
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))
                                  })()
                                  }
                                </motion.tbody>
                              </AnimatePresence>
                            </table>
                          </div>

                          {/* Confrontos Pagination */}
                          {(() => {
                            const dadosAjustados = confrontosData.dados.map((c: any) => {
                              const ajuste = ajustesConfronto.find(a => a.produto === c.produto)
                              const qtdFisicaAjustada = c.qtd_fisica + (ajuste ? ajuste.quantidade : 0)
                              return {
                                ...c,
                                diferenca: qtdFisicaAjustada - c.qtd_sistema
                              }
                            });

                            const filtered = dadosAjustados.filter((c: any) => {
                              if (confrontoFilter === "divergent" && c.diferenca === 0) return false;
                              if (confrontoFilter === "match" && c.diferenca !== 0) return false;
                              if (confrontoFilter === "excess" && c.diferenca <= 0) return false;
                              if (confrontoFilter === "missing" && c.diferenca >= 0) return false;
                              if (confrontoSearch) {
                                const term = confrontoSearch.toLowerCase();
                                if (!c.produto.toLowerCase().includes(term) && !c.descricao.toLowerCase().includes(term)) return false;
                              }
                              return true;
                            });

                            const confTotalPages = Math.ceil(filtered.length / confrontoItemsPerPage);
                            if (confTotalPages <= 1) return null;

                            const startIndex = (confrontoCurrentPage - 1) * confrontoItemsPerPage;
                            const endIndex = Math.min(startIndex + confrontoItemsPerPage, filtered.length);

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
                                    const page = idx + 1;
                                    // simple pagination logic to show limited pages
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
                                            "h-8 min-w-[2rem] px-2 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                                            confrontoCurrentPage === page
                                              ? "bg-[#1E3A8A] dark:bg-blue-600 text-white shadow-sm"
                                              : "text-[#1E3A8A] dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800"
                                          )}
                                        >
                                          {page}
                                        </button>
                                      );
                                    }
                                    if (
                                      page === confrontoCurrentPage - 2 ||
                                      page === confrontoCurrentPage + 2
                                    ) {
                                      return <span key={page} className="px-1 text-slate-400">...</span>;
                                    }
                                    return null;
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
                            );
                          })()}

                        </motion.div>
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="border-2 border-slate-300 dark:border-slate-700 bg-transparent p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
                      <p className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Falha na Conexão</p>
                      <button onClick={() => fetchConfrontos()} className="px-6 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold tracking-wider uppercase text-xs hover:bg-slate-700 transition-colors">REPETIR CONFRONT</button>
                    </div>
                  )}

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

                          <form onSubmit={(e) => {
                            e.preventDefault();
                            const data = new FormData(e.currentTarget);
                            const prod = (data.get('produto') as string).trim().toUpperCase();
                            const qtd = Number(data.get('quantidade'));
                            const motivo = (data.get('motivo') as string).trim();

                            if (!prod || isNaN(qtd) || !motivo) return;

                            // Atualizar ou adicionar
                            setAjustesConfronto(prev => {
                              const filt = prev.filter(a => a.produto !== prod);
                              return [...filt, { produto: prod, quantidade: qtd, motivo, usuario: "Atual", timestamp: new Date() }];
                            });

                            (e.currentTarget as HTMLFormElement).reset();
                          }} className="space-y-4 mb-8">

                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Código do Produto (SKU)</label>
                              <input required name="produto" type="text" className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" placeholder="Ex: 1024-00" />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">QTD de Ajuste (+ ou -)</label>
                              <input required name="quantidade" type="number" className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-blue-500" placeholder="Ex: -5 ou 10" />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Motivo do Ajuste</label>
                              <textarea required name="motivo" rows={2} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 resize-none" placeholder="Ex: Contagem dupla na Doca 3..." />
                            </div>

                            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/20">
                              Aplicar Ajuste no Confronto
                            </button>
                          </form>

                          <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Histórico de Ajustes ({ajustesConfronto.length})</h4>
                              {ajustesConfronto.length > 0 && (
                                <button onClick={() => setAjustesConfronto([])} className="text-[10px] font-bold text-rose-500 hover:text-rose-400 uppercase tracking-widest transition-colors">
                                  Remover Todos
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
                                        <span className={cn("text-xs font-black", aj.quantidade > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{aj.quantidade > 0 ? "+" : ""}{aj.quantidade}</span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 truncate" title={aj.motivo}>{aj.motivo}</p>
                                    </div>
                                    <button onClick={() => setAjustesConfronto(prev => prev.filter(p => p.produto !== aj.produto))} className="flex-shrink-0 h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-500/30">
                                      <X size={14} />
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

                </motion.div>
              )}
            </AnimatePresence>
          </div >

          {/* --- DRILL-DOWN MODAL --- */}
          <AnimatePresence>
            {
              selectedProduct && productDetail && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 transition-colors">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedProduct(null)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md" />
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl max-h-[92vh] rounded-3xl md:rounded-[3rem] bg-white dark:bg-slate-900 p-5 md:p-10 shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col overflow-hidden transition-colors">
                    <div className="flex items-center justify-between mb-6 md:mb-8">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={cn(
                          "h-10 w-10 md:h-14 md:w-14 rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-xl transition-all",
                          modalFilter ? "bg-blue-600 shadow-blue-200 dark:shadow-blue-900/20" : "bg-emerald-600 shadow-emerald-200 dark:shadow-emerald-900/20"
                        )}>
                          {modalFilter ? <Droplet size={20} className="md:w-6 md:h-6" /> : <Tag size={20} className="md:w-6 md:h-6" />}
                        </div>
                        <div>
                          <h3 className="text-lg md:text-3xl font-black text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-xs">{selectedProduct}</h3>
                          <p className="text-[8px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 md:mt-1">
                            {Math.round(productDetail.total_paletes)} Paletes • {Math.round(productDetail.total_quantidade).toLocaleString('pt-BR')} Peças
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedProduct(null)} className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"><X size={20} className="md:w-6 md:h-6" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1">
                      <div className="overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 transition-colors">
                        <table className="w-full text-left">
                          <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm">
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Posição</th>
                              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Nível</th>
                              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Prof.</th>
                              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Qtd Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {productDetail.positions.map((p, idx) => (
                              <tr key={`${p.posicao}-${idx}`} className="group hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                <td className="px-6 py-5 text-left">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                        <MapPin size={12} />
                                      </div>
                                      <span className="text-sm font-black text-slate-800 dark:text-slate-100">{p.posicao}</span>
                                    </div>
                                    <div className="flex items-center gap-2 pl-9">
                                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase">{fmtNum(p.paletes)} PTs</span>
                                      {p.qtd_molhado > 0 && <span className="text-[9px] font-black text-blue-500 dark:text-blue-400 uppercase">| {fmtNum(p.qtd_molhado)} M</span>}
                                      {p.qtd_tombada > 0 && <span className="text-[9px] font-black text-red-500 dark:text-red-400 uppercase">| {fmtNum(p.qtd_tombada)} T</span>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-center">
                                  <span className="inline-flex h-7 items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-3 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase">
                                    {p.nivel}
                                  </span>
                                </td>
                                <td className="px-6 py-5 text-center">
                                  <span className="text-xs font-black text-slate-500 dark:text-slate-400 transition-colors">{p.profundidade}</span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <span className="text-sm font-black text-slate-900 dark:text-slate-100 transition-colors">{Math.round(p.quantidade).toLocaleString('pt-BR')}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className={cn(
                      "mt-6 md:mt-10 p-5 md:p-6 rounded-2xl md:rounded-3xl text-white flex flex-col sm:flex-row items-center justify-between gap-4 transition-all shadow-xl",
                      modalFilter ? "bg-blue-600 shadow-blue-100 dark:shadow-blue-900/10" : "bg-emerald-600 shadow-emerald-100 dark:shadow-emerald-900/10"
                    )}>
                      <div className="flex items-center gap-3">
                        {modalFilter ? <Droplet size={18} className="fill-white/20 shrink-0" /> : <Zap size={18} className="fill-white/20 shrink-0" />}
                        <p className="text-[10px] md:text-xs font-bold leading-tight uppercase">
                          {modalFilter ? `Visualização Filtrada: SKU possui ${productDetail.total_registros} registros com molhado em ${productDetail.total_posicoes_unicas} posições` : `Resumo: SKU possui ${productDetail.total_registros} registros distribuídos ao longo de ${productDetail.total_posicoes_unicas} posições`}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setActiveView("posicoes")
                          setDisplayMode("mapa")
                          setSearch(selectedProduct)
                          setSelectedProduct(null)
                        }}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-[9px] md:text-[10px] font-black uppercase hover:bg-white/20 transition-all border border-white/10"
                      >
                        Ver no Mapa <ExternalLink size={12} />
                      </button>
                    </div>
                  </motion.div>
                </div>
              )
            }
          </AnimatePresence >

          <AnimatePresence>
            {selectedPalletId && palletDetail && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 transition-colors">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPalletId(null)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md" />
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl max-h-[92vh] rounded-3xl md:rounded-[3rem] bg-white dark:bg-slate-900 p-5 md:p-10 shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col overflow-hidden transition-colors">
                  <div className="flex items-center justify-between mb-6 md:mb-8">
                    <div className="flex items-center gap-4 md:gap-6">
                      <div className="h-14 w-14 md:h-20 md:w-20 rounded-[2rem] bg-orange-600 flex items-center justify-center text-white shadow-2xl shadow-orange-200 dark:shadow-orange-900/20 transition-all">
                        <Layers size={28} className="md:w-10 md:h-10" />
                      </div>
                      <div>
                        <h3 className="text-2xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter transition-colors">Palete {selectedPalletId}</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                          <div className="flex items-center gap-1.5 transition-colors">
                            <Package size={12} className="text-slate-400 dark:text-slate-500" />
                            <p className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{fmtNum(palletDetail.total_qty)} Peças</p>
                          </div>
                          <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                          <div className="flex items-center gap-1.5 transition-colors">
                            <MapPin size={12} className="text-orange-500" />
                            <p className="text-[10px] md:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest transition-colors">
                              {palletDetail.locations.map((loc, idx) => (
                                <span key={loc} className={cn(loc === "S/P" ? "text-amber-600" : "text-emerald-600 dark:text-emerald-400")}>
                                  {loc}{idx < palletDetail.locations.length - 1 ? " • " : ""}
                                </span>
                              ))}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPalletId(null)} className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-all border border-slate-100 dark:border-slate-800 group"><X size={20} className="md:w-6 md:h-6 group-hover:rotate-90 transition-transform" /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2 text-left">
                    <div className="overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 transition-colors">
                      <table className="w-full">
                        <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm">
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-left">
                            <th className="px-8 py-6 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Conteúdo / SKU</th>
                            <th className="px-8 py-6 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Quantidade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                          {palletDetail.items.map((item: any, idx: number) => (
                            <tr key={`${item.produto}-${idx}`} className="group hover:bg-white dark:hover:bg-slate-800 transition-colors">
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                  <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white dark:group-hover:bg-orange-600 dark:group-hover:text-white transition-colors shadow-sm">
                                    <Package size={18} />
                                  </div>
                                  <span className="text-base font-black text-slate-800 dark:text-slate-200 transition-colors">{item.produto}</span>
                                </div>
                              </td>
                              <td className="px-8 py-6 text-right">
                                <span className="text-lg font-black text-slate-900 dark:text-slate-100 transition-colors">{fmtNum(item.quantidade_total)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-8 md:mt-12 p-6 md:p-8 rounded-[2.5rem] bg-slate-900 dark:bg-slate-700 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                        <Info size={24} className="text-orange-400" />
                      </div>
                      <div>
                        <p className="text-xs md:text-sm font-bold leading-relaxed text-slate-300">
                          Este palete é classificado como <span className="text-orange-400 font-black">MISTO</span> por conter {palletDetail.items.length} registros distintos.
                        </p>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">SISTEMA AG-G300 • AUDITORIA DE PALETES</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* --- CONFRONTO DETAIL MODAL --- */}
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
                      <div className="flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-4 transition-colors shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Qtd Física</span>
                          {selectedConfrontoItem.teve_ajuste && <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-md font-bold leading-none">+ Ajuste</span>}
                        </div>
                        <span className="text-3xl font-semibold text-slate-800 dark:text-slate-100">{fmtNum(selectedConfrontoItem.qtd_fisica)}</span>
                        {selectedConfrontoItem.teve_ajuste && (
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1">Orig: {fmtNum(selectedConfrontoItem.qtd_fisica_original)}</span>
                        )}
                      </div>
                      <div className="flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-4 transition-colors shadow-sm">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Qtd Sistema</span>
                        <span className="text-3xl font-semibold text-slate-800 dark:text-slate-100">{fmtNum(selectedConfrontoItem.qtd_sistema)}</span>
                      </div>
                    </div>

                    <div className={cn("border rounded-xl p-5 flex flex-col items-center justify-center text-center transition-colors shadow-sm mt-3",
                      selectedConfrontoItem.diferenca > 0 ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20" :
                        selectedConfrontoItem.diferenca < 0 ? "border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20" :
                          "border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30"
                    )}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Situação Atual</span>
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
                            <>Há <span className="font-bold text-emerald-600 dark:text-emerald-400">{Math.abs(selectedConfrontoItem.diferenca)} peças</span> a mais no físico.</>
                          ) : (
                            <>Faltam <span className="font-bold text-rose-600 dark:text-rose-400">{Math.abs(selectedConfrontoItem.diferenca)} peças</span> no físico.</>
                          )}
                        </p>
                      ) : (
                        <p className="text-[11px] font-medium mt-2 text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
                          Os volumes físico e do sistema estão alinhados.
                        </p>
                      )}

                      {selectedConfrontoItem.teve_ajuste && (
                        <div className="mt-4 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-left w-full">
                          <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 mb-1.5">
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
                      const productPositions = data.filter((item: any) => item.produto === selectedConfrontoItem.produto);
                      if (productPositions.length === 0) return null;

                      // Agrupando posições
                      const posicoesAgrupadas = productPositions.reduce((acc: any, current: any) => {
                        const posicao = current.posicao || "S/P";
                        // Se armazém não vier na base, deixa um fallback vazio para não bater o undefined.
                        const armazem = current.armazem || current.g3 || "-";
                        const quantidade = current.quantidade_total || 0;

                        const existing = acc.find((item: any) => item.posicao === posicao);
                        if (existing) {
                          existing.quantidade_agrupada += quantidade;
                        } else {
                          acc.push({ posicao, armazem, quantidade_agrupada: quantidade });
                        }
                        return acc;
                      }, []);

                      const posicoesAgrupadasLocal = selectedConfrontoItem.diferenca !== 0
                        ? posicoesAgrupadas.sort((a: any, b: any) => b.quantidade_agrupada - a.quantidade_agrupada)
                        : posicoesAgrupadas;

                      return (
                        <div className="border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30">
                            <h4 className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Aba de posições ({posicoesAgrupadasLocal.length})</h4>
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

          <AnimatePresence>
            {showExportConfigModal && (
              <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-6 transition-colors">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowExportConfigModal(false)} className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xl" />
                <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-lg rounded-[2.5rem] bg-white dark:bg-slate-900 p-6 md:p-8 shadow-[0_40px_100px_rgba(0,0,0,0.4)] border border-white/20 dark:border-slate-800 flex flex-col overflow-hidden transition-colors">

                  {/* Modal Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-2xl shadow-blue-500/30">
                        <TableIcon size={28} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Exportar Relatório</h3>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1">Configuração de Saída {exportFormat === "pdf" ? "PDF" : "EXCEL"}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowExportConfigModal(false)} className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors border border-slate-100 dark:border-slate-800"><X size={24} /></button>
                  </div>

                  <div className="p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex gap-1.5 border border-slate-200 dark:border-slate-800 shadow-inner">
                    <button
                      onClick={() => setExportFormat("excel")}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-2",
                        exportFormat === "excel"
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-105 z-10"
                          : "text-slate-400 dark:text-slate-500 hover:text-slate-600 hover:bg-slate-200/50"
                      )}
                    >
                      <div className={cn("w-1.5 h-1.5 rounded-full", exportFormat === "excel" ? "bg-white animate-pulse" : "bg-emerald-600/30")} />
                      Planilha Excel
                    </button>
                    <button
                      onClick={() => setExportFormat("pdf")}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-2",
                        exportFormat === "pdf"
                          ? "bg-rose-700 text-white shadow-lg shadow-rose-700/20 scale-105 z-10"
                          : "text-slate-400 dark:text-slate-500 hover:text-slate-600 hover:bg-slate-200/50"
                      )}
                    >
                      <div className={cn("w-1.5 h-1.5 rounded-full", exportFormat === "pdf" ? "bg-white animate-pulse" : "bg-rose-700/30")} />
                      Relatório PDF
                    </button>
                  </div>

                  {/* Sub-Tabs: Simple vs Advanced */}
                  <div className="flex border-b border-slate-200 dark:border-slate-800 pb-1">
                    <button
                      onClick={() => setExportTab("simple")}
                      className={cn(
                        "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all relative",
                        exportTab === "simple" ? "text-blue-600" : "text-slate-400 hover:text-slate-500"
                      )}
                    >
                      Seleção Simples
                      {exportTab === "simple" && <motion.div layoutId="exportTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                    </button>
                    <button
                      onClick={() => setExportTab("advanced")}
                      className={cn(
                        "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all relative",
                        exportTab === "advanced" ? "text-blue-600" : "text-slate-400 hover:text-slate-500"
                      )}
                    >
                      Filtros Avançados
                      {exportTab === "advanced" && <motion.div layoutId="exportTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {exportTab === "simple" ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-4 rounded-[2rem] bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50"
                      >
                        <div className="h-20 w-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 mb-2">
                          <Zap size={32} />
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-slate-900 dark:text-white mb-1">Exportação Completa</h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">Resumo rápido de todos os itens filtrados</p>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[240px]">
                          Esta opção gera um relatório com todas as avarias, localizações e status configurados automaticamente.
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="p-4 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 space-y-4"
                      >
                        {/* Grupo 1: Categorias de Carga */}
                        <div className="space-y-3 text-left">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">1. Categorias de Carga</p>
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              { id: "includeWet", label: "Produtos Molhados", icon: Droplet },
                              { id: "includeTilted", label: "Produtos Tombados", icon: Flame },
                              { id: "includeTraditional", label: "Avaria Tradicional / Outras", icon: ShieldCheck }
                            ].map((opt) => (
                              <div
                                key={opt.id}
                                onClick={() => setExportOptions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof typeof prev] }))}
                                className={cn(
                                  "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border",
                                  exportOptions[opt.id as keyof typeof exportOptions]
                                    ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm"
                                    : "bg-transparent border-transparent opacity-40 grayscale"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <opt.icon size={14} className={cn(exportOptions[opt.id as keyof typeof exportOptions] ? "text-blue-600" : "text-slate-400")} />
                                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">{opt.label}</span>
                                </div>
                                <div className={cn("h-5 w-5 rounded border-2 flex items-center justify-center transition-colors", exportOptions[opt.id as keyof typeof exportOptions] ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-slate-600")}>
                                  {exportOptions[opt.id as keyof typeof exportOptions] && <CheckSquare size={12} className="text-white" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="h-px bg-slate-200/50 dark:bg-slate-700/50 mx-1" />

                        {/* Grupo 2: Localização */}
                        <div className="space-y-3 text-left">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">2. Localização</p>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: "includeAllocated", label: "Alocado (G300)" },
                              { id: "includeNotAllocated", label: "Sem End. (S/P)" }
                            ].map((opt) => (
                              <div
                                key={opt.id}
                                onClick={() => setExportOptions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof typeof prev] }))}
                                className={cn(
                                  "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border",
                                  exportOptions[opt.id as keyof typeof exportOptions]
                                    ? "bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-900/50 shadow-sm"
                                    : "bg-transparent border-transparent opacity-40 grayscale"
                                )}
                              >
                                <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">{opt.label}</span>
                                <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center transition-colors shadow-sm", exportOptions[opt.id as keyof typeof exportOptions] ? "bg-emerald-600 border-emerald-600" : "border-slate-300 dark:border-slate-600")}>
                                  {exportOptions[opt.id as keyof typeof exportOptions] && <CheckSquare size={10} className="text-white" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="h-px bg-slate-200/50 dark:bg-slate-700/50 mx-1" />

                        {/* Grupo 3: Status / Saldo */}
                        <div className="space-y-3 text-left">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">3. Status do Saldo</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: "includeNormal", label: "Normal" },
                              { id: "includeDivergent", label: "Divergente" },
                              { id: "includeRejected", label: "Rejeitado" }
                            ].map((opt) => (
                              <div
                                key={opt.id}
                                onClick={() => setExportOptions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof typeof prev] }))}
                                className={cn(
                                  "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border",
                                  exportOptions[opt.id as keyof typeof exportOptions]
                                    ? "bg-white dark:bg-slate-800 border-slate-900 dark:border-slate-100/30 shadow-sm"
                                    : "bg-transparent border-transparent opacity-40 grayscale"
                                )}
                              >
                                <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">{opt.label}</span>
                                <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center transition-colors shadow-sm", exportOptions[opt.id as keyof typeof exportOptions] ? "bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100" : "border-slate-300 dark:border-slate-600")}>
                                  {exportOptions[opt.id as keyof typeof exportOptions] && <CheckSquare size={10} className={cn(opt.id === "includeNormal" ? "text-white" : "text-white dark:text-slate-900")} />}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="h-px bg-slate-200/50 dark:bg-slate-700/50 mx-2" />

                        {/* Grupo 4: Detalhamento */}
                        <div className="space-y-3 text-left">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">4. Detalhamento</p>
                          <div
                            onClick={() => setExportOptions(prev => ({ ...prev, includeObservations: !prev.includeObservations }))}
                            className={cn(
                              "flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all border",
                              exportOptions.includeObservations
                                ? "bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-900/50 shadow-sm"
                                : "bg-transparent border-transparent opacity-40 grayscale"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <MessageSquare size={14} className={cn(exportOptions.includeObservations ? "text-blue-600" : "text-slate-400")} />
                              <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">Incluir Observações</span>
                            </div>
                            <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center transition-colors shadow-sm", exportOptions.includeObservations ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-slate-600")}>
                              {exportOptions.includeObservations && <CheckSquare size={10} className="text-white" />}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Footer Action */}
                  <div className="mt-6 flex gap-4">
                    <button onClick={() => setShowExportConfigModal(false)} className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95">Cancelar</button>
                    <button onClick={executeProductExport} className="flex-[2] py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-500/30 hover:bg-blue-500 transition-all active:scale-95 flex items-center justify-center gap-2">
                      <Download size={16} /> Gerar {exportFormat === "pdf" ? "PDF" : "Planilha"}
                    </button>
                  </div>

                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectionModeActive && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-fit"
              >
                <div className="bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-2xl px-6 py-4 rounded-[2rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-8 min-w-[320px] md:min-w-[450px]">
                  <div className="flex flex-col text-left">
                    <span className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">Seleção Ativa</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-white text-2xl font-black">{selectedPositions.size}</span>
                      <span className="text-slate-400 text-xs font-bold uppercase">{selectedPositions.size === 1 ? "Posição Escolhida" : "Posições Escolhidas"}</span>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-white/10" />

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setSelectionModeActive(false);
                        setSelectedPositions(new Set());
                      }}
                      className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-[11px] font-black uppercase tracking-wider transition-all active:scale-95"
                    >
                      Sair
                    </button>
                    <button
                      disabled={selectedPositions.size === 0}
                      onClick={() => handleExportSelection()}
                      className={cn(
                        "px-8 py-3 rounded-2xl text-white text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95",
                        selectedPositions.size > 0
                          ? "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/25 cursor-pointer"
                          : "bg-slate-700 opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Printer size={14} strokeWidth={2.5} />
                      Imprimir Seleção
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedPosition && positionDetail && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6 transition-colors">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPosition(null)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md" />
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl max-h-[92vh] rounded-3xl md:rounded-[3rem] bg-white dark:bg-slate-900 p-5 md:p-10 shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col overflow-hidden transition-colors">
                  <div className="flex items-center justify-between mb-6 md:mb-8">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="h-10 w-10 md:h-14 md:w-14 rounded-2xl md:rounded-3xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-200 dark:shadow-blue-900/20 transition-all"><MapPin size={20} className="md:w-6 md:h-6" /></div>
                      <div className="text-left">
                        <h3 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white transition-colors">{selectedPosition}</h3>
                        <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                          <p className={cn(
                            "text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-colors",
                            positionDetail.isOverflow ? "text-red-600 dark:text-red-400" : "text-slate-400 dark:text-slate-500"
                          )}>
                            {fmtNum(positionDetail.occupied)} / {positionDetail.capacidade} Paletes • {positionDetail.level_count} Níveis
                          </p>
                          {positionDetail.isOverflow && (
                            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[8px] font-black uppercase text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                              <AlertCircle size={8} /> Excesso
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedPosition(null)}
                        className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-all border border-slate-100 dark:border-slate-800"
                      >
                        <X size={20} className="md:w-6 md:h-6" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1">
                    <div className="overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 transition-colors">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm">
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Produto / SKU</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Nível</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Prof.</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Qtd/PT</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Qtd Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                          {positionDetail.products.map((p, idx) => (
                            <tr key={`${p.sku}-${idx}`} className="group hover:bg-white dark:hover:bg-slate-800 transition-colors">
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 transition-colors">
                                    <Package size={14} />
                                  </div>
                                  <span className="text-sm font-black text-slate-800 dark:text-slate-200 transition-colors">{p.sku}</span>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-center transition-colors">
                                <span className="inline-flex h-7 items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-3 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase transition-colors">
                                  {p.nivel}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-center transition-colors">
                                <span className="text-xs font-black text-slate-500 transition-colors">{p.profundidade}</span>
                              </td>
                              <td className="px-6 py-5 text-center font-black text-emerald-600 dark:text-emerald-400 text-xs transition-colors">
                                {p.qtd_por_palete.toLocaleString('pt-BR')}
                              </td>
                              <td className="px-6 py-5 text-right transition-colors text-right">
                                <div className="flex flex-col">
                                  <span className="text-sm font-black text-slate-900 dark:text-slate-100 transition-colors">{Math.round(p.quantidade).toLocaleString('pt-BR')}</span>
                                  <div className="flex items-center justify-end gap-2 text-right">
                                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase transition-colors">{Math.round(p.paletes)} PTs</span>
                                    {p.qtd_molhado > 0 && <span className="text-[9px] font-black text-blue-500 dark:text-blue-400 uppercase transition-colors">| {fmtNum(p.qtd_molhado)} Molhado</span>}
                                    {p.qtd_tombada > 0 && <span className="text-[9px] font-black text-red-500 dark:text-red-400 uppercase transition-colors">| {fmtNum(p.qtd_tombada)} Tombado</span>}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-6 md:mt-10 p-5 md:p-6 rounded-2xl md:rounded-3xl bg-blue-600 dark:bg-blue-700 text-white flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
                    <div className="flex items-center gap-3"><Zap size={18} className="fill-white/20 shrink-0" /><p className="text-[10px] md:text-xs font-bold leading-tight uppercase">Resumo: {positionDetail.occupied === 0 ? "Drive Vazio - Aguardando Alocação" : `Drive operando com ${positionDetail.products.length > 1 ? "Múltiplos Produtos (Mix)" : "Produto Único"}`}</p></div>
                    <button className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-[9px] md:text-[10px] font-black uppercase hover:bg-white/20 transition-all border border-white/10">Gerar Ticket <ExternalLink size={12} /></button>
                  </div>

                  {positionDetail.isOverflow && (
                    <div className="mt-4 p-5 rounded-[2rem] bg-red-600 text-white flex items-center gap-4 shadow-xl shadow-red-500/20 border border-red-500/50 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <AlertCircle size={24} className="animate-pulse shrink-0" />
                      <div className="text-left">
                        <p className="text-[11px] font-black uppercase tracking-tight">ALERTA DE CAPACIDADE EXCEDIDA</p>
                        <p className="text-[10px] font-bold text-red-100 leading-tight">
                          Esta posição contém {fmtNum(positionDetail.occupied)} paletes, ultrapassando o limite de {positionDetail.capacidade}. Verifique o mapeamento logístico na planilha.
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Modal Importar Configuração de Ajuste */}
          <AnimatePresence>
            {showImportarAjustesModal && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowImportarAjustesModal(false)} className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm" />
                <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">

                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <DownloadCloud size={20} className="text-orange-600 dark:text-orange-500" />
                      Importar Ajustes
                    </h3>
                    <button onClick={() => setShowImportarAjustesModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                    Cole abaixo o código de configuração gerado por outro usuário (através do botão "Compartilhar Ajustes"). Isso irá <strong className="text-slate-800 dark:text-slate-200">substituir</strong> sua configuração atual caso possua alguma ativa.
                  </p>

                  <form onSubmit={handleImportAjustes} className="space-y-4">
                    <div>
                      <textarea
                        required
                        rows={4}
                        value={importarAjustesText}
                        onChange={(e) => setImportarAjustesText(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white font-mono focus:outline-none focus:border-orange-500 resize-none shadow-inner"
                        placeholder="Cole o código aqui..."
                      />
                    </div>

                    <button type="submit" className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 mt-4">
                      <DownloadCloud size={16} /> Importar Agora
                    </button>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Mobile Spacer (replaces non-functional menu) */}

          {/* PDF Print Template (Multi-Page Support) */}
          {
            isExportingPDF && printData.length > 0 && (
              <div className="hidden print:block relative bg-white min-h-screen w-full text-black font-sans leading-tight p-6">

                {/* Header Corporativo Ultra Compacto */}
                <div className="border-b-[1.5px] border-black pb-2 mb-4 flex justify-between items-end">
                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-black/50 mb-0.5">Auditoria Logística G300</p>
                    <h1 className="text-xl font-black uppercase tracking-tight leading-none mb-1">Relação de Produtos e Divergências</h1>
                    <div className="flex gap-3 text-[6px] font-bold uppercase">
                      <span>Avaria: {exportTab === "simple" || (exportOptions.includeWet && exportOptions.includeTilted && exportOptions.includeTraditional) ? 'Todas' : [exportOptions.includeWet && 'Molhados', exportOptions.includeTilted && 'Tombados', exportOptions.includeTraditional && 'Tradicional'].filter(Boolean).join(' + ')}</span>
                      <span className="text-black/20">|</span>
                      <span>Local: {exportTab === "simple" || (exportOptions.includeAllocated && exportOptions.includeNotAllocated) ? 'Todos' : exportOptions.includeAllocated ? 'Alocados' : 'S/P'}</span>
                      <span className="text-black/20">|</span>
                      <span>Status: {exportTab === "simple" || (exportOptions.includeNormal && exportOptions.includeDivergent && exportOptions.includeRejected) ? 'Todos' : [exportOptions.includeNormal && 'Normal', exportOptions.includeDivergent && 'Divergente', exportOptions.includeRejected && 'Rejeitado'].filter(Boolean).join(' + ')}</span>
                      {exportOptions.includeObservations && (
                        <>
                          <span className="text-black/20">|</span>
                          <span>Obs: Sim</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="text-[10px] font-bold">{new Date().toLocaleDateString('pt-BR')} — {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                {/* Resumo Gerencial Ultra Compacto */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="px-3 py-2 border border-black flex items-center justify-between">
                    <span className="text-[7px] font-bold uppercase text-black/60 tracking-wider">SKUs Auditados:</span>
                    <span className="text-sm font-black">{printData.length}</span>
                  </div>
                  <div className="px-3 py-2 border border-black flex items-center justify-between">
                    <span className="text-[7px] font-bold uppercase text-black/60 tracking-wider">Peças Físicas G300:</span>
                    <span className="text-sm font-black">{printData.reduce((acc, curr) => acc + curr.quantidade_total, 0).toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                {/* Tabela de Dados Formal */}
                <table className="w-full text-[9px] border-collapse">
                  <thead className="print:table-header-group">
                    <tr className="border-y-[1.5px] border-black bg-slate-50/50">
                      <th className="px-3 py-2 text-left font-bold uppercase tracking-tight w-[85px]">SKU</th>
                      <th className="px-3 py-2 text-left font-bold uppercase tracking-tight w-[240px]">Descrição</th>
                      <th className="px-3 py-2 text-right font-bold uppercase tracking-tight w-[60px]">PÇS</th>
                      <th className="px-3 py-2 text-right font-bold uppercase tracking-tight w-[45px]">PLTS</th>
                      <th className="px-3 py-2 text-right font-bold uppercase tracking-tight w-[45px]">POS</th>
                      {exportOptions.includeWet && <th className="px-3 py-2 text-right font-bold uppercase tracking-tight w-[55px]">Molhado</th>}
                      {exportOptions.includeTilted && <th className="px-3 py-2 text-right font-bold uppercase tracking-tight w-[55px]">Tombado</th>}
                      {exportOptions.includeObservations && <th className="px-3 py-2 text-left font-bold uppercase tracking-tight">Obs.</th>}
                    </tr>
                  </thead>
                  <tbody className="">
                    {printData.map((item, idx) => (
                      <tr key={idx} className="border-b border-black/10 break-inside-avoid">
                        <td className="px-3 py-1.5 font-bold">{item.produto}</td>
                        <td className="px-3 py-1.5 font-medium">{item.descricao}</td>
                        <td className="px-3 py-1.5 text-right font-black">{item.quantidade_total.toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-1.5 text-right font-bold">{item.total_paletes}</td>
                        <td className="px-3 py-1.5 text-right font-bold">{item.total_posicoes}</td>
                        {exportOptions.includeWet && <td className="px-3 py-1.5 text-right font-bold">{item.dmg_molhado.toLocaleString('pt-BR')}</td>}
                        {exportOptions.includeTilted && <td className="px-3 py-1.5 text-right font-bold">{item.dmg_tombada.toLocaleString('pt-BR')}</td>}
                        {exportOptions.includeObservations && (
                          <td className="px-3 py-1.5 font-normal text-black/70 italic text-[7px] leading-snug">
                            {item.observacao}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </main>
      </div>
    </div>
  )
}
