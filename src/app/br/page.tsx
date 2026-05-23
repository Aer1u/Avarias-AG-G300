"use client"

import React, { useState, useEffect } from "react"
import {
  Fan,
  Moon,
  Sun,
  User,
  Package,
  Repeat2,
  X,
  ChevronRight,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  Box,
  Truck,
  BarChart3,
  TrendingUp,
  PlusSquare,
  AlertTriangle,
  Lock,
  Settings,
  Droplet,
  Tag,
  ChevronLeft,
  Trash2,
  Grid,
  List,
  AtSign,
  LogIn,
  RefreshCw,
  FileSpreadsheet,
  Check,
  Pencil,
  Printer,
  ChevronDown,
  Calendar
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"

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
    // Show brief toast-like feedback via title
    const prev = document.title
    document.title = `✓ ${label} copiado!`
    setTimeout(() => { document.title = prev }, 1500)
  }).catch(() => {
    // Fallback for older browsers
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

// ─── Types ───────────────────────────────────────────────────────────────────
type TabId = "formacao_paletes" | "paletes_formados"

interface PosAvaria {
  id: number
  posicao: string
  codigo: string
  descricao: string
  estoque: number
  quantidade: number
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BRModulePage() {
  const [theme, setTheme]               = useState<"dark" | "light">("dark")
  const [activeTab, setActiveTab]       = useState<TabId>("formacao_paletes")
  const [showModuleModal, setShowModuleModal] = useState(false)
  
  // Data State (Active Avarias)
  const [posicoesRaw, setPosicoesRaw]   = useState<PosAvaria[]>([])
  const [loading, setLoading]           = useState(true)
  const [viewMode, setViewMode]         = useState<"grid" | "table">("grid")
  const [search, setSearch]             = useState("")
  const [skuFilter, setSkuFilter]       = useState<"all" | "1" | "multi" | "3plus">("all")
  const [showSkuFilterMenu, setShowSkuFilterMenu] = useState(false)
  const [sortBy, setSortBy]             = useState<"posicao" | "skus_asc" | "skus_desc" | "pecas_asc" | "pecas_desc">("posicao")
  const [showSortMenu, setShowSortMenu] = useState(false)

  // Controle Avarias State (Formed Pallets)
  const [controleRaw, setControleRaw]   = useState<any[]>([])
  const [loadingControle, setLoadingControle] = useState(false)
  const [searchControle, setSearchControle]   = useState("")
  
  // Modals state
  const [showImportModal, setShowImportModal]   = useState(false)
  const [importText, setImportText]             = useState("")
  const [isImporting, setIsImporting]           = useState(false)
  const [selectedPosGroup, setSelectedPosGroup] = useState<any>(null)

  // Formar Palete State
  const [modalPhase, setModalPhase]     = useState<"view" | "form_palete">("view")
  const [editableItems, setEditableItems] = useState<EditableItem[]>([])
  const [reservaNum, setReservaNum]     = useState("")
  const [remessaNum, setRemessaNum]     = useState("")
  const [documentoSM, setDocumentoSM]   = useState("")
  const [isSavingPalete, setIsSavingPalete] = useState(false)

  // Edit / Print controle state
  const [editingControle, setEditingControle] = useState<any>(null)
  const [editReserva, setEditReserva]         = useState("")
  const [editRemessa, setEditRemessa]         = useState("")
  const [editDocumento, setEditDocumento]     = useState("")
  const [editCodigos, setEditCodigos]         = useState("")
  const [editStatus, setEditStatus]           = useState("Pendente")
  const [isSavingEdit, setIsSavingEdit]       = useState(false)
  const [expandedControleId, setExpandedControleId] = useState<number | null>(null)
  const [filterPeriod, setFilterPeriod] = useState<"todos" | "hoje" | "semanal" | "mensal">("todos")
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)
  const [activeStatusDropdownId, setActiveStatusDropdownId] = useState<number | null>(null)

  // Auth state
  const [session, setSession]           = useState<any>(null)
  const [user, setUser]                 = useState<any>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginEmail, setLoginEmail]     = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [isLoggingIn, setIsLoggingIn]   = useState(false)
  const [rememberMe, setRememberMe]     = useState(true)
  const [authLoading, setAuthLoading]   = useState(true)

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [theme])

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark")

  // Load Auth Session
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail")
    if (savedEmail) setLoginEmail(savedEmail)

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Erro na sessão:", error.message)
        if (error.message.includes("Refresh Token")) {
          supabase.auth.signOut()
        }
      }
      setSession(session)
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event as string) === 'TOKEN_REFRESH_FAILED') {
        supabase.auth.signOut()
      }
      setSession(session)
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load pos_avarias Data
  const fetchPosAvarias = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('pos_avarias')
        .select('*')
      if (error) throw error
      setPosicoesRaw(data || [])
    } catch (err: any) {
      console.error("Erro ao buscar posições de avarias:", err.message)
    } finally {
      setLoading(false)
    }
  }

  // Load controle_avarias (Formed Pallets)
  const fetchControleAvarias = async () => {
    setLoadingControle(true)
    try {
      const { data, error } = await supabase
        .from('controle_avarias')
        .select('*')
        .order('criacao', { ascending: false })
      if (error) throw error
      setControleRaw(data || [])
    } catch (err: any) {
      console.error("Erro ao buscar controle de avarias:", err.message)
    } finally {
      setLoadingControle(false)
    }
  }

  useEffect(() => {
    fetchPosAvarias()
    fetchControleAvarias()
  }, [])

  // Reset form phase when position changes
  useEffect(() => {
    if (selectedPosGroup) {
      setEditableItems(
        selectedPosGroup.items.map((item: PosAvaria) => ({
          id: item.id,
          codigo: item.codigo,
          descricao: item.descricao,
          estoque: item.estoque,
          quantidade: item.quantidade,
          qtdOriginal: item.quantidade,
          incluido: true
        }))
      )
      setModalPhase("view")
      setReservaNum("")
      setRemessaNum("")
      setDocumentoSM("")
    }
  }, [selectedPosGroup])

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })
      if (error) throw error

      if (rememberMe) {
        localStorage.setItem("rememberedEmail", loginEmail)
      } else {
        localStorage.removeItem("rememberedEmail")
      }

      setShowLoginModal(false)
      setLoginPassword("")
    } catch (err: any) {
      alert("Erro ao fazer login: " + err.message)
    } finally {
      setIsLoggingIn(false)
    }
  }

  // Logout handler
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // Group positions dynamically
  const posicoesAgrupadas = React.useMemo(() => {
    const groups: Record<string, { posicao: string; items: PosAvaria[]; totalQtd: number; uniqueSkus: number }> = {}
    
    posicoesRaw.forEach(item => {
      const pos = (item.posicao || "SEM POSIÇÃO").trim().toUpperCase()
      if (!groups[pos]) {
        groups[pos] = { posicao: pos, items: [], totalQtd: 0, uniqueSkus: 0 }
      }
      groups[pos].items.push(item)
      groups[pos].totalQtd += item.quantidade || 0
    })

    Object.keys(groups).forEach(pos => {
      const uniqueSkusSet = new Set(groups[pos].items.map(i => i.codigo))
      groups[pos].uniqueSkus = uniqueSkusSet.size
    })

    return Object.values(groups)
  }, [posicoesRaw])

  // Filtered group data for grid search & SKU filter & Sorting
  const filteredGroups = React.useMemo(() => {
    let result = posicoesAgrupadas

    // Apply SKU Count filter
    if (skuFilter !== "all") {
      result = result.filter(g => {
        if (skuFilter === "1") return g.uniqueSkus === 1
        if (skuFilter === "multi") return g.uniqueSkus > 1
        if (skuFilter === "3plus") return g.uniqueSkus >= 3
        return true
      })
    }

    // Apply search filter
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

    // Apply sorting
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

  // Filtered raw data for table search & SKU filter
  const filteredRaw = React.useMemo(() => {
    let result = posicoesRaw

    // Apply SKU filter by filtering the rows whose position matches the SKU filter criteria
    if (skuFilter !== "all") {
      const matchingPositions = new Set(
        posicoesAgrupadas
          .filter(g => {
            if (skuFilter === "1") return g.uniqueSkus === 1
            if (skuFilter === "multi") return g.uniqueSkus > 1
            if (skuFilter === "3plus") return g.uniqueSkus >= 3
            return true
          })
          .map(g => g.posicao)
      )
      result = result.filter(item => matchingPositions.has(item.posicao.trim().toUpperCase()))
    }

    if (search) {
      const term = search.toLowerCase()
      result = result.filter(item => 
        item.posicao.toLowerCase().includes(term) ||
        item.codigo.toLowerCase().includes(term) ||
        item.descricao.toLowerCase().includes(term)
      )
    }

    return result
  }, [posicoesRaw, posicoesAgrupadas, search, skuFilter])

  // Date filtered pallets history
  const dateFilteredControle = React.useMemo(() => {
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

  // Filter formed pallets history
  const filteredControle = React.useMemo(() => {
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

  // Stats (Active)
  const totalPaletesCount = posicoesAgrupadas.length
  const totalPecasCount   = posicoesRaw.reduce((acc, c) => acc + (c.quantidade || 0), 0)
  const uniqueSkusCount   = new Set(posicoesRaw.map(r => r.codigo)).size
  const totalItensCount   = posicoesRaw.length

  // Import handler
  const handleImportRelacao = async () => {
    let lines = importText.trim().split('\n').filter(l => l.trim())
    if (lines.length === 0) return

    const firstLineLower = lines[0].toLowerCase()
    if (
      firstLineLower.includes("posição") || 
      firstLineLower.includes("posicao") || 
      firstLineLower.includes("código") || 
      firstLineLower.includes("codigo") ||
      firstLineLower.includes("descrição") ||
      firstLineLower.includes("descricao")
    ) {
      lines = lines.slice(1)
    }

    if (lines.length === 0) {
      alert("Nenhum dado válido encontrado.")
      return
    }

    if (!confirm(`Confirmar importação de ${lines.length} itens? Isso substituirá todos os dados de avarias atuais.`)) return

    setIsImporting(true)
    try {
      const dataToInsert = lines.map(line => {
        const cols = line.split('\t')
        const posicao = String(cols[0] || '').trim().toUpperCase()
        const codigo = String(cols[1] || '').trim().toUpperCase()
        const descricao = String(cols[2] || '-').trim()
        
        // Safe numeric parse for Z2 values or invalid inputs
        const rawEstoque = String(cols[3] || '0').trim()
        const cleanEstoque = parseInt(rawEstoque.replace(/[^\d-]/g, ''), 10) || 0
        
        const rawQty = String(cols[4] || '0').trim()
        const cleanQty = parseInt(rawQty.replace(/[^\d-]/g, ''), 10) || 0

        return {
          posicao,
          codigo,
          descricao,
          estoque: cleanEstoque,
          quantidade: cleanQty
        }
      }).filter(item => item.posicao !== "")

      if (dataToInsert.length === 0) {
        alert("Nenhum registro com posição preenchida encontrado.")
        return
      }

      // Delete current data
      const { error: delErr } = await supabase
        .from('pos_avarias')
        .delete()
        .neq('id', 0)
      if (delErr) throw delErr

      // Chunk insertion
      const chunkSize = 200
      for (let i = 0; i < dataToInsert.length; i += chunkSize) {
        const chunk = dataToInsert.slice(i, i + chunkSize)
        const { error: insErr } = await supabase
          .from('pos_avarias')
          .insert(chunk)
        if (insErr) throw insErr
      }

      alert("Importação concluída com sucesso!")
      setImportText("")
      setShowImportModal(false)
      fetchPosAvarias()
    } catch (err: any) {
      console.error("Erro na importação:", err)
      alert("Falha ao importar: " + err.message)
    } finally {
      setIsImporting(false)
    }
  }

  // Delete a single item row from detailed position view
  const handleDeleteRow = async (id: number) => {
    if (!user) {
      setShowLoginModal(true)
      return
    }
    if (!confirm("Deseja realmente remover este item da posição?")) return

    try {
      const { error } = await supabase
        .from('pos_avarias')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      // Update local state
      setPosicoesRaw(prev => prev.filter(item => item.id !== id))
      
      // Update selected position details group modal state
      if (selectedPosGroup) {
        setSelectedPosGroup((prev: any) => {
          const updatedItems = prev.items.filter((item: any) => item.id !== id)
          if (updatedItems.length === 0) {
            return null // close modal if position becomes empty
          }
          const uniqueSkusSet = new Set(updatedItems.map((i: any) => i.codigo))
          return {
            ...prev,
            items: updatedItems,
            totalQtd: updatedItems.reduce((acc: number, c: any) => acc + (c.quantidade || 0), 0),
            uniqueSkus: uniqueSkusSet.size
          }
        })
      }
    } catch (err: any) {
      console.error("Erro ao deletar linha:", err.message)
      alert("Erro ao deletar: " + err.message)
    }
  }

  // Formar Palete submission
  const handleConfirmarFormarPalete = async () => {
    if (!user) {
      setShowLoginModal(true)
      return
    }

    const activeItems = editableItems.filter(item => item.incluido)
    if (activeItems.length === 0) {
      alert("Selecione pelo menos um item para incluir no palete.")
      return
    }

    // Remessa e Documento são sempre obrigatórios
    if (!remessaNum.trim()) {
      alert("Por favor, preencha o número da Remessa (gerada pelo MIGO).")
      return
    }
    if (!documentoSM.trim()) {
      alert("Por favor, preencha o Documento SAP (gerado após o SM).")
      return
    }

    setIsSavingPalete(true)
    try {
      const codigosStr = activeItems.map(item => item.codigo).join(", ")
      const totalQtd = activeItems.reduce((acc, item) => acc + (item.quantidade || 0), 0)

      const _now = new Date()
      const localDate = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`

      const itensJson = JSON.stringify(editableItems.map(item => ({
        codigo: item.codigo,
        descricao: item.descricao,
        qtdOriginal: item.qtdOriginal,
        qtdFinal: item.quantidade,
        incluido: item.incluido
      })))

      const payload = {
        posicao: selectedPosGroup.posicao,
        codigos: codigosStr,
        quantidade: totalQtd,
        reserva: reservaNum.trim() ? parseInt(reservaNum.replace(/[^\d]/g, ''), 10) : null,
        remessa: parseInt(remessaNum.replace(/[^\d]/g, ''), 10),
        documento: documentoSM.trim(),
        itens_json: itensJson,
        criacao: localDate,
        status: 'Pendente'
      }

      // 1. Insert into history
      const { error: insErr } = await supabase
        .from('controle_avarias')
        .insert([payload])
      if (insErr) throw insErr

      // 2. Delete included items from active avarias
      const activeIds = activeItems.map(item => item.id)
      const { error: delErr } = await supabase
        .from('pos_avarias')
        .delete()
        .in('id', activeIds)
      if (delErr) throw delErr

      alert("Palete formado e registrado com sucesso!")
      setSelectedPosGroup(null)
      fetchPosAvarias()
      fetchControleAvarias()
    } catch (err: any) {
      console.error("Erro ao formar palete:", err)
      alert("Erro ao formar palete: " + err.message)
    } finally {
      setIsSavingPalete(false)
    }
  }

  // Open edit modal for a controle_avarias row
  const handleOpenEditControle = (row: any) => {
    setEditingControle(row)
    setEditReserva(row.reserva ? String(row.reserva) : "")
    setEditRemessa(row.remessa ? String(row.remessa) : "")
    setEditDocumento(row.documento || "")
    setEditCodigos(row.codigos || "")
    setEditStatus(row.status === "Formado" ? "Pendente" : (row.status || "Pendente"))
  }

  // Save edits to a controle_avarias row
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

  // Print a controle_avarias pallet record
  const handlePrintControle = (row: any) => {
    const now = new Date()
    const printDate = row.criacao
      ? row.criacao.split('-').reverse().join('/')
      : `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`
    const today = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`

    let itens: any[] | null = null
    try { if (row.itens_json) itens = JSON.parse(row.itens_json) } catch (_) {}

    const rowStyle = (item: any) => item.incluido ? '' : 'opacity:0.5'
    const txtStyle = (item: any) => item.incluido ? '' : 'text-decoration:line-through'
    const badge = (item: any) => {
      if (!item.incluido) return '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:800;white-space:nowrap">RETIRAR</span>'
      if (item.qtdFinal < item.qtdOriginal) return '<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:800;white-space:nowrap">QTD ALTERADA</span>'
      return '<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:800;white-space:nowrap">OK</span>'
    }

    const itensHtml = itens
      ? `<table><thead><tr><th style="white-space:nowrap">Código</th><th>Descrição</th><th style="white-space:nowrap;text-align:center">Qtd Orig.</th><th style="white-space:nowrap;text-align:center">Qtd Final</th><th style="white-space:nowrap">Status</th></tr></thead><tbody>${
          itens.map(item => `<tr style="${rowStyle(item)}"><td style="${txtStyle(item)};white-space:nowrap;font-weight:700">${item.codigo}</td><td style="${txtStyle(item)};word-break:break-word">${item.descricao}</td><td style="text-align:center">${item.qtdOriginal}</td><td style="text-align:center">${item.qtdFinal}</td><td style="white-space:nowrap">${badge(item)}</td></tr>`).join('')
        }</tbody></table>`
      : `<p style="margin-top:12px"><strong>SKUs:</strong> ${row.codigos || '-'}</p>`

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Palete ${row.posicao}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}
.hdr{border-bottom:3px solid #10b981;padding-bottom:16px;margin-bottom:24px}
.pos{font-size:32px;font-weight:900;letter-spacing:-1px}.pos-pre{color:#94a3b8;font-size:20px}.pos-suf{color:#10b981}
.sub{font-size:10px;text-transform:uppercase;letter-spacing:3px;color:#94a3b8;margin-top:6px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px}
.lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;margin-bottom:4px}
.val{font-size:18px;font-weight:900;color:#1e293b}.val.sm{font-size:14px;color:#475569}
.sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin-bottom:8px}
table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;border-bottom:2px solid #e2e8f0;white-space:nowrap}
td{padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #f1f5f9;vertical-align:middle}
th:first-child,td:first-child{width:80px}th:nth-child(2),td:nth-child(2){width:auto}th:nth-child(3),td:nth-child(3){width:70px;text-align:center}th:nth-child(4),td:nth-child(4){width:70px;text-align:center}th:nth-child(5),td:nth-child(5){width:100px}
.ftr{margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}</style>
</head><body>
<div class="hdr"><div class="pos"><span class="pos-pre">${row.posicao.slice(0,-2)}</span><span class="pos-suf">${row.posicao.slice(-2)}</span></div><div class="sub">Portal BR · G300 · Formação de Paletes</div></div>
<div class="grid">
  <div class="card"><div class="lbl">Data</div><div class="val sm">${printDate}</div></div>
  <div class="card"><div class="lbl">Remessa MIGO</div><div class="val">${row.remessa || '-'}</div></div>
  <div class="card"><div class="lbl">Documento SAP</div><div class="val">${row.documento || '-'}</div></div>
  ${row.reserva ? `<div class="card"><div class="lbl">Reserva MB21</div><div class="val sm">${row.reserva}</div></div>` : ''}
</div>
<div class="sec">Itens do Palete</div>
${itensHtml}
<div class="ftr"><span>Portal BR · MKBR e G300 · Gestão de Avarias</span><span>Impresso em: ${today}</span></div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`

    const w = window.open('', '_blank', 'width=950,height=750')
    if (w) { w.document.write(html); w.document.close() }
  }

  // Clear entire position
  const handleClearPosition = async (posName: string) => {
    if (!user) {
      setShowLoginModal(true)
      return
    }
    if (!confirm(`Deseja realmente descarregar/limpar todos os itens da posição ${posName}?`)) return

    try {
      const { error } = await supabase
        .from('pos_avarias')
        .delete()
        .eq('posicao', posName)
      
      if (error) throw error

      setPosicoesRaw(prev => prev.filter(item => item.posicao !== posName))
      setSelectedPosGroup(null)
    } catch (err: any) {
      console.error("Erro ao descarregar posição:", err.message)
      alert("Erro ao descarregar: " + err.message)
    }
  }

  // Clear historical pallet row
  const handleDeleteControle = async (id: number) => {
    if (!user) {
      setShowLoginModal(true)
      return
    }
    if (!confirm("Deseja realmente remover este registro de palete do histórico?")) return

    try {
      const { error } = await supabase
        .from('controle_avarias')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setControleRaw(prev => prev.filter(item => item.id !== id))
    } catch (err: any) {
      console.error("Erro ao deletar registro de controle:", err.message)
      alert("Erro ao deletar: " + err.message)
    }
  }

  // Clear all data from pos_avarias table
  const handleClearAllData = async () => {
    if (!user) {
      setShowLoginModal(true)
      return
    }
    if (!confirm("⚠️ ATENÇÃO: Deseja realmente excluir TODOS os dados de posições de avarias do banco de dados? Esta ação é irreversível.")) return

    try {
      const { error } = await supabase
        .from('pos_avarias')
        .delete()
        .neq('id', 0)
      if (error) throw error

      setPosicoesRaw([])
      alert("Todos os dados foram excluídos com sucesso.")
    } catch (err: any) {
      console.error("Erro ao limpar dados:", err.message)
      alert("Erro ao limpar dados: " + err.message)
    }
  }

  const TABS = [
    { id: "formacao_paletes" as TabId, label: "Formação de Paletes", icon: Fan },
    { id: "paletes_formados" as TabId, label: "Paletes Formados", icon: CheckCircle2 },
  ]

  return (
    <div className={cn("flex min-h-screen transition-colors duration-500", theme === "dark" ? "bg-[#020617]" : "bg-[#f8fafc]")}>

      {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="group/sidebar fixed left-0 top-0 z-50 flex h-full w-24 flex-col items-center border-none bg-white/80 py-8 backdrop-blur-xl dark:bg-slate-900/80 transition-all duration-300 hover:w-64 overflow-hidden">

        {/* Branding */}
        <div className="mb-12 flex flex-col items-center gap-4 px-4 w-full text-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-emerald-600 shadow-xl shadow-emerald-500/30">
            <Fan className="text-white animate-[spin_10s_linear_infinite]" size={32} />
          </div>
          <div className="flex flex-col items-center opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden w-full space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              Portal <span className="text-emerald-500">BR</span>
            </h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">MKBR E G300</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-2 w-full px-3">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "group relative flex h-12 w-full items-center rounded-xl transition-all duration-300",
                activeTab === tab.id
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 shadow-sm"
                  : "text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
              )}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeBRTabIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-md bg-emerald-500"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <div className="flex h-12 w-[48px] shrink-0 items-center justify-center">
                <tab.icon size={20} className={cn("transition-all duration-300", activeTab === tab.id ? "text-emerald-500" : "")} />
              </div>
              <span className={cn(
                "text-[11px] font-bold uppercase tracking-wider opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap text-left",
                activeTab === tab.id ? "text-emerald-500" : ""
              )}>
                {tab.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="mt-auto flex flex-col gap-4 w-full px-4 pb-8 items-center">

          {/* Module switcher */}
          <button
            onClick={() => setShowModuleModal(true)}
            className="flex h-12 w-full items-center rounded-2xl text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors overflow-hidden group/btn border border-blue-200/60 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5"
            title="Trocar Módulo"
          >
            <div className="flex min-w-[48px] h-12 items-center justify-center">
              <Repeat2 size={18} className="text-blue-500" />
            </div>
            <span className="ml-1 text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap text-blue-600 dark:text-blue-400">
              Trocar Módulo
            </span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-12 w-full items-center rounded-2xl text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800 transition-colors overflow-hidden group/btn"
          >
            <div className="flex min-w-[48px] h-12 items-center justify-center">
              {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
            </div>
            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap">
              {theme === "light" ? "Escuro" : "Claro"}
            </span>
          </button>

          {/* User login / logout button */}
          <button
            onClick={user ? handleLogout : () => setShowLoginModal(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-all active:scale-95"
            title={user ? `Sair (${user.email})` : "Fazer Login"}
          >
            {user ? (
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{user.email?.substring(0, 2).toUpperCase()}</span>
            ) : (
              <User size={20} />
            )}
          </button>
        </div>
      </aside>

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      <main className="ml-24 flex-1 p-4 md:p-8 lg:p-12">
        <div className="mx-auto max-w-7xl space-y-8">

          {activeTab === "formacao_paletes" ? (
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
                  <button
                    onClick={() => {
                      if (!user) {
                        setShowLoginModal(true)
                      } else {
                        setShowImportModal(true)
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
                  >
                    <PlusSquare size={16} />
                    Importar Relação
                  </button>
                  
                  {user && posicoesRaw.length > 0 && (
                    <button
                      onClick={handleClearAllData}
                      className="flex items-center justify-center h-10 w-10 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors border border-rose-100 dark:border-rose-500/10 active:scale-95"
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
                        "flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-bold border transition-all whitespace-nowrap",
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
                          {/* Invisible backdrop to close on outside click */}
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
                                  "w-full text-left px-4 py-2.5 text-xs font-bold transition-colors",
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
                        "flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-bold border transition-all whitespace-nowrap",
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
                          {/* Invisible backdrop to close on outside click */}
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
                                  "w-full text-left px-4 py-2.5 text-xs font-bold transition-colors",
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

                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        viewMode === "grid"
                          ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      )}
                    >
                      <Grid size={14} />
                      Grade
                    </button>
                    <button
                      onClick={() => setViewMode("table")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        viewMode === "table"
                          ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      )}
                    >
                      <List size={14} />
                      Tabela
                    </button>
                  </div>

                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2">
                    {viewMode === "grid" ? filteredGroups.length : filteredRaw.length} {viewMode === "grid" ? (filteredGroups.length === 1 ? "palete" : "paletes") : (filteredRaw.length === 1 ? "registro" : "registros")}
                  </span>
                </div>
              </div>

              {/* Loading Indicator */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <RefreshCw className="animate-spin text-emerald-500" size={32} />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Carregando Informações...</p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {/* ─── Grid View ─── */}
                  {viewMode === "grid" && (
                    <motion.div
                      key="grid"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                    >
                      {filteredGroups.map((g, idx) => (
                        <motion.div
                          key={g.posicao}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          onClick={() => setSelectedPosGroup(g)}
                          className="group cursor-pointer relative overflow-hidden rounded-[24px] border border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/80 p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.01]"
                        >
                          {/* Top info */}
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold tracking-tight transition-colors">
                              {renderPosicaoHighlight(g.posicao)}
                            </h3>
                            <span className="inline-flex bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider">
                              {g.uniqueSkus} {g.uniqueSkus === 1 ? "SKU" : "SKUs"}
                            </span>
                          </div>

                          {/* Total peças metric */}
                          <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{g.totalQtd}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Peças Totais</p>
                          </div>
                        </motion.div>
                      ))}

                      {filteredGroups.length === 0 && (
                        <div className="col-span-full border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                              <Box size={22} />
                            </div>
                            <p className="text-sm font-bold text-slate-400">Nenhum palete/posição cadastrada</p>
                            <p className="text-xs text-slate-300 dark:text-slate-600">Ajuste a busca ou clique em 'Importar Relação'</p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ─── Table View ─── */}
                  {viewMode === "table" && (
                    <motion.div
                      key="table"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                              {["Posição", "SKU Código", "Descrição", "Depósito/Estoque", "Quantidade", "Ações"].map(col => (
                                <th 
                                  key={col} 
                                  className={cn(
                                    "px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap", 
                                    col === "Quantidade" && "text-right",
                                    col === "Ações" && "text-center pl-8"
                                  )}
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                            {filteredRaw.map((p) => (
                              <tr
                                key={p.id}
                                className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                              >
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {renderPosicaoHighlight(p.posicao)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">{p.codigo}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-tight block max-w-md truncate" title={p.descricao}>{p.descricao}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-xs font-semibold text-slate-500">{formatDeposito(p.estoque)}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">{p.quantidade}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center pl-8">
                                  <div className="inline-flex justify-center">
                                    <button
                                      disabled={!user}
                                      onClick={() => handleDeleteRow(p.id)}
                                      className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center transition-colors border",
                                        user
                                          ? "bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 border-transparent"
                                          : "bg-slate-50 dark:bg-slate-800 text-slate-300 border-transparent cursor-not-allowed"
                                      )}
                                      title={user ? "Remover Registro" : "Necessário Login"}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}

                            {filteredRaw.length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-6 py-16 text-center">
                                  <div className="flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                      <Box size={22} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-400">Nenhum registro encontrado</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </>
          ) : (
            <>
              {/* ─── Paletes Formados historical view ─── */}
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

              {/* Metric Cards for historical view */}
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
                      <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{(loadingControle || loading) ? "..." : m.value.toLocaleString("pt-BR")}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{m.label}</p>
                    </div>

                    {m.tooltipData && m.tooltipData.length > 0 && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-2xl rounded-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 max-h-64 overflow-y-auto">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1 border-b border-slate-800 pb-2">AVAs Pendentes para Formar</div>
                        <div className="flex flex-col gap-1.5">
                          {m.tooltipData.map((ava: any) => (
                            <div key={ava.posicao} className="flex items-center justify-between bg-slate-800/50 dark:bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2 hover:bg-slate-800 transition-colors cursor-default">
                              <span className="text-xs font-bold text-slate-300">{ava.posicao}</span>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md">
                                {ava.uniqueSkus} {ava.uniqueSkus === 1 ? 'SKU' : 'SKUs'}
                              </span>
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

                  {/* Period Filter Custom Dropdown */}
                  <div className="relative flex items-center shrink-0">
                    <button
                      onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                      className={cn(
                        "flex items-center justify-between h-10 pl-4 pr-3 w-[130px] rounded-xl text-xs font-bold border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30",
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
                                  "w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-between",
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

              {/* Table of formed pallets */}
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
                            <>
                              <tr
                                key={c.id}
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
                                          {/* Invisible click-away backdrop */}
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
                                                  "w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-between",
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

                              {/* ── Expandable sub-row with items ── */}
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
                            </>
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
            </>
          )}

        </div>
      </main>

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
              className="relative w-full max-w-3xl rounded-[32px] bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-slate-800/80 pb-5">
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
                    <h3 className="text-2xl font-bold tracking-tight flex items-center gap-3">
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
                  {/* Phase 1: View Pallet Items */}
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
                                      ? "bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 border-transparent"
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

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-5 mt-auto">
                    <button
                      type="button"
                      onClick={() => setModalPhase("form_palete")}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all bg-emerald-600 hover:bg-emerald-500 text-white border-transparent active:scale-[0.98] shadow-lg shadow-emerald-500/20 cursor-pointer"
                    >
                      <Plus size={15} />
                      Formar Palete
                    </button>
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
                  {/* Phase 2: Formar Palete Table and SAP forms */}
                  <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                    
                    {/* SAP Copy Pills */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cópias para SAP MB21</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Clique para copiar as colunas e colar no SAP.</span>
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
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Itens no Palete</h4>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">SKU Código</th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Retirada</th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right pr-6">Qtd</th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Incluso</th>
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
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={cn("text-xs font-mono font-bold", item.incluido ? "text-slate-600 dark:text-slate-400" : "text-slate-400 line-through")}>
                                  {item.codigo}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className={cn("text-xs font-semibold leading-tight max-w-[240px] truncate", item.incluido ? "text-slate-700 dark:text-slate-300" : "text-slate-400 line-through")} title={item.descricao}>
                                  {item.descricao}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span className={cn("text-xs font-black", item.incluido ? "text-slate-500" : "text-slate-400 line-through")}>L100</span>
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap pr-4">
                                <div className="inline-flex items-center rounded-xl bg-slate-50 dark:bg-slate-950 p-0.5 border border-slate-200 dark:border-slate-800">
                                  <button
                                    type="button"
                                    disabled={!item.incluido || item.quantidade <= 1}
                                    onClick={() => {
                                      setEditableItems(prev => prev.map(it => it.id === item.id ? { ...it, quantidade: Math.max(1, it.quantidade - 1) } : it))
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition active:scale-90 cursor-pointer"
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
                                    className="w-12 h-8 text-center bg-transparent border-0 font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={!item.incluido}
                                    onClick={() => {
                                      setEditableItems(prev => prev.map(it => it.id === item.id ? { ...it, quantidade: it.quantidade + 1 } : it))
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition active:scale-90 cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
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
                                      "w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all duration-200",
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

                    {/* SAP Fields — Reserva (optional) + Remessa + Documento (always required) */}
                    <div className="p-5 bg-slate-50 dark:bg-slate-900/60 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                      <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">Documentação SAP</h4>
                        <p className="text-[10px] text-slate-400 mt-1">Remessa e Documento são sempre obrigatórios. Reserva somente se gerada via MB21.</p>
                      </div>

                      {/* Row 1: Reserva (optional) + Remessa (required) */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                            Reserva SAP
                            <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 normal-case tracking-normal">(opcional — somente MB21)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: 100028945"
                            value={reservaNum}
                            onChange={(e) => setReservaNum(e.target.value)}
                            className="w-full h-11 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-300 dark:placeholder:text-slate-700"
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
                              "w-full h-11 bg-white dark:bg-slate-950 border rounded-xl px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-300 dark:placeholder:text-slate-700",
                              remessaNum.trim() ? "border-slate-200 dark:border-slate-800" : "border-amber-300 dark:border-amber-600/40"
                            )}
                          />
                        </div>
                      </div>

                      {/* Row 2: Documento SAP (required) */}
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
                            "w-full h-11 bg-white dark:bg-slate-950 border rounded-xl px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-300 dark:placeholder:text-slate-700",
                            documentoSM.trim() ? "border-slate-200 dark:border-slate-800" : "border-amber-300 dark:border-amber-600/40"
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Buttons for form_palete */}
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-5 mt-auto">
                    <button
                      type="button"
                      onClick={() => setModalPhase("view")}
                      className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Voltar
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmarFormarPalete}
                      disabled={isSavingPalete}
                      className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider border shadow-sm transition-all shadow-emerald-500/20 cursor-pointer",
                        isSavingPalete
                          ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-wait border-transparent animate-pulse"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white border-transparent active:scale-[0.98]"
                      )}
                    >
                      {isSavingPalete ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Gravando no SAP...
                        </>
                      ) : (
                        <>
                          <Check size={14} />
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
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                  <PlusSquare className="text-emerald-500 animate-[pulse_2s_infinite]" size={20} />
                  Importar Relação de Avarias
                </h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"
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

                <div className="p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/20 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed font-semibold">
                    <span className="font-bold uppercase text-amber-900 dark:text-amber-300">Atenção:</span> Esta operação irá <span className="underline italic">SOBRESCREVER E LIMPAR</span> toda a tabela de posições de avarias atual no Supabase com o novo conteúdo colado acima.
                  </p>
                </div>

                <button
                  disabled={isImporting || !importText.trim()}
                  onClick={handleImportRelacao}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3",
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
              {/* Header */}
              <div className="flex justify-between items-start mb-6 pb-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xl font-bold mb-1">
                    {renderPosicaoHighlight(editingControle.posicao)}
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alterar Registro de Palete</p>
                </div>
                <button
                  onClick={() => setEditingControle(null)}
                  className="h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Reserva (optional) */}
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

                {/* Remessa + Documento */}
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

                {/* Códigos SKUs */}
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

                {/* Status do Palete */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Status do Palete</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Entregue">Entregue</option>
                  </select>
                </div>
              </div>

              {/* Footer */}
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
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors disabled:opacity-40"
                >
                  <Trash2 size={13} />
                  Excluir
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingControle(null)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditControle}
                    disabled={isSavingEdit}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
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

      {/* ─── Login Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <div className="h-12 w-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-600 mb-4">
                      <Lock size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Área Restrita</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Identifique-se para alterar o portal.</p>
                  </div>
                  <button
                    onClick={() => setShowLoginModal(false)}
                    className="h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">E-mail Corporativo</label>
                    <div className="relative">
                      <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="usuario@empresa.com"
                        className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Senha de Acesso</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-2 py-1">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="rememberMe" className="text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none">
                      Lembrar meu e-mail
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
                  >
                    {isLoggingIn ? (
                      <RefreshCw size={20} className="animate-spin" />
                    ) : (
                      <>
                        <span>Acessar Dashboard</span>
                        <LogIn size={20} />
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-[10px] text-slate-400 mt-8 uppercase tracking-[0.2em] font-medium">
                  Segurança G300 &copy; 2026
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Module Switcher Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {showModuleModal && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backdropFilter: "blur(16px)", background: "rgba(2,6,23,0.75)" }}
            onClick={() => setShowModuleModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
              style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", border: "1px solid rgba(255,255,255,0.08)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-8 pt-8 pb-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mb-4">
                  <Repeat2 size={22} className="text-white/70" />
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">Selecionar Módulo</h2>
                <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-widest">Avarias — Escolha o portal</p>
              </div>

              {/* Cards */}
              <div className="px-6 pb-8 grid grid-cols-2 gap-4">
                {/* AG Card */}
                <button
                  onClick={() => { setShowModuleModal(false); window.location.href = "/"; }}
                  className="relative rounded-2xl p-5 flex flex-col items-center gap-3 border-2 border-transparent hover:border-blue-500/60 bg-white/5 hover:bg-blue-500/10 transition-all duration-200 group cursor-pointer"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-blue-600 group-hover:bg-blue-500 shadow-xl shadow-blue-500/30 transition-colors">
                    <Package size={28} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white leading-tight">Portal <span className="text-blue-400">AG</span></p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em] mt-0.5">G300 PAINEL<br />OPERACIONAL</p>
                  </div>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">Acessar →</span>
                </button>

                {/* BR Card — active */}
                <div className="relative rounded-2xl p-5 cursor-default flex flex-col items-center gap-3 border-2 border-emerald-500/60 bg-emerald-500/10">
                  <div className="absolute top-3 right-3">
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Ativo</span>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-emerald-600 shadow-xl shadow-emerald-500/40">
                    <Fan size={28} className="text-white animate-[spin_6s_linear_infinite]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white leading-tight">Portal <span className="text-emerald-400">BR</span></p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em] mt-0.5">MKBR E G300</p>
                  </div>
                </div>
              </div>

              {/* Close */}
              <button
                onClick={() => setShowModuleModal(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
