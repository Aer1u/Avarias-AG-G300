"use client"

import React, { useState, useMemo, useRef } from "react"
import { AvariaTipo, hexToStyle, hexToBarStyle } from "@/hooks/useAvariaTipos"
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
  QrCode,
  X,
  Trash2,
  UploadCloud,
  FileCheck2,
  Download,
  AlertTriangle,
  ChevronUp,
  Paperclip,
  Plus,
  Settings2
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import * as XLSX from "xlsx"

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
  fetchControleAvarias: (period?: "hoje" | "semanal" | "mensal") => Promise<void>
  setShowLoginModal: (show: boolean) => void
  handleDeleteControle: (id: number) => Promise<void>
  handlePrintControle: (row: any, autoPrint?: boolean) => void
  setControleRaw: React.Dispatch<React.SetStateAction<any[]>>
  
  // Need posicoesRaw to calculate "Pendentes para Formar"
  posicoesRaw: PosAvaria[]

  legacyCount: number
  handleMigrateData: () => Promise<void>
  isMigrating: boolean
  baseCodigos: any[]
  avariaTipos: AvariaTipo[]
  onOpenTiposManager: () => void
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
  posicoesRaw,
  legacyCount,
  handleMigrateData,
  isMigrating,
  baseCodigos,
  avariaTipos,
  onOpenTiposManager
}: PaletesFormadosTabProps) {
  // Local Filter & Status States
  const [searchControle, setSearchControle]   = useState("")
  const [filterPeriod, setFilterPeriod]       = useState<"hoje" | "semanal" | "mensal">("hoje")
  const [hoveredType, setHoveredType]         = useState<string | null>(null)
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
  const [editType, setEditType]               = useState("")
  const [editCustomType, setEditCustomType]   = useState("")
  const [isSavingEdit, setIsSavingEdit]       = useState(false)
  const [activeStatusTab, setActiveStatusTab] = useState<"todos" | "Pendente" | "Entregue" | "Estornado">("todos")

  // Manual Pallet States
  const [showAddManualPallet, setShowAddManualPallet] = useState(false)
  const [manualReserva, setManualReserva]             = useState("")
  const [manualRemessa, setManualRemessa]             = useState("")
  const [manualDocumento, setManualDocumento]         = useState("")
  const [manualType, setManualType]                   = useState("")
  const [manualCustomType, setManualCustomType]       = useState("")
  const [manualItems, setManualItems]                 = useState<{ codigo: string; quantidade: number }[]>([{ codigo: "", quantidade: 1 }])
  const [isSavingManual, setIsSavingManual]           = useState(false)

  // ── Status Import Modal ──────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importedFileName, setImportedFileName] = useState<string | null>(null)
  const [showStatusImport, setShowStatusImport]   = useState(false)
  const [importStatusText, setImportStatusText]   = useState("")
  const [importPreview, setImportPreview]         = useState<any[] | null>(null)
  const [isParsingImport, setIsParsingImport]     = useState(false)
  const [isSavingImport, setIsSavingImport]       = useState(false)
  const [importResult, setImportResult]           = useState<{ updated: number; inserted: number; notFound: number; errors: number } | null>(null)

  // Handle file upload (xlsx, xls, csv, txt, tsv)
  const handleFileUpload = (file: File) => {
    setImportedFileName(file.name)
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const tsv = XLSX.utils.sheet_to_csv(firstSheet, { FS: '\t' })
          setImportStatusText(tsv)
        } catch (err: any) {
          alert('Erro ao ler o arquivo Excel: ' + err.message)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (evt) => setImportStatusText(evt.target?.result as string || '')
      reader.readAsText(file, 'UTF-8')
    }
  }

  // Parse SAP date formats: DD/MM/YYYY or DD.MM.YYYY → YYYY-MM-DD
  function parseSapDate(raw: string): string | null {
    if (!raw || !raw.trim()) return null
    const cleaned = raw.trim().replace(/\./g, '/')
    const parts = cleaned.split('/')
    if (parts.length === 3) {
      const [d, m, y] = parts
      if (y.length === 4) return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
    }
    return null
  }

  // Map SAP status to our internal status
  function mapSapStatus(sapStatus: string): string | null {
    const s = (sapStatus || '').trim().toLowerCase()
    if (s.includes('recebido') || s.includes('destino') || s.includes('entregue')) return 'Entregue'
    if (s.includes('trânsito') || s.includes('transito') || s.includes('em transit')) return 'Pendente'
    return null
  }

  // Parse the pasted TSV table and match against controleRaw by Remessa
  const handleParseImport = () => {
    if (!importStatusText.trim()) return
    setIsParsingImport(true)

    try {
      const lines = importStatusText.trim().split('\n').filter(l => l.trim())
      if (lines.length < 2) {
        alert('Cole pelo menos o cabeçalho + 1 linha de dados.')
        setIsParsingImport(false)
        return
      }

      // Detect separator (tab or semicolon)
      const sep = lines[0].includes('\t') ? '\t' : ';'
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
      )

      // Find relevant column indexes
      const idxDocumento = headers.findIndex(h => h === 'documento' || h === 'remessa')
      const idxStatus = headers.findIndex(h => h === 'status' || h === 'situacao')
      const idxDt313  = headers.findIndex(h =>
        h.includes('313') && (h.includes('dt') || h.includes('data'))
      )
      const idxDt315  = headers.findIndex(h =>
        h.includes('315') && (h.includes('dt') || h.includes('data'))
      )
      const idxMigo313 = headers.findIndex(h => h === 'migo 313' || h === 'migo313' || (h.includes('313') && !h.includes('dt') && !h.includes('data')))

      if (idxDocumento === -1) {
        alert('Coluna "Documento" (Remessa) não encontrada. Verifique o cabeçalho da tabela.')
        setIsParsingImport(false)
        return
      }

      const cleanNumStr = (val: any) => {
        if (val === null || val === undefined) return ''
        const s = String(val).trim().split('.')[0]
        return s.replace(/[^\d]/g, '')
      }

      // Build a map of remessa → list of controleRaw records
      const remessaMap = new Map<string, any[]>()
      controleRaw.forEach(c => {
        const cleanRem = cleanNumStr(c.remessa)
        if (cleanRem) {
          if (!remessaMap.has(cleanRem)) {
            remessaMap.set(cleanRem, [])
          }
          remessaMap.get(cleanRem)!.push(c)
        }
      })

      // Group imported lines by cleanRem to get unique remessas from the file
      const uniqueImportedRows = new Map<string, {
        remessaRaw: string,
        sapStatus: string,
        dt313Raw: string,
        dt315Raw: string,
        migo313: string
      }>()

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep)
        const remessaRaw = (cols[idxDocumento] || '').trim()
        const cleanRem = cleanNumStr(remessaRaw)
        if (!cleanRem) continue

        const sapStatus  = idxStatus  >= 0 ? (cols[idxStatus]  || '').trim() : ''
        const dt313Raw   = idxDt313   >= 0 ? (cols[idxDt313]   || '').trim() : ''
        const dt315Raw   = idxDt315   >= 0 ? (cols[idxDt315]   || '').trim() : ''
        const migo313    = idxMigo313 >= 0 ? (cols[idxMigo313] || '').trim() : ''

        if (!uniqueImportedRows.has(cleanRem)) {
          uniqueImportedRows.set(cleanRem, {
            remessaRaw,
            sapStatus,
            dt313Raw,
            dt315Raw,
            migo313
          })
        } else {
          const existing = uniqueImportedRows.get(cleanRem)!
          if (!existing.sapStatus && sapStatus) existing.sapStatus = sapStatus
          if (!existing.dt313Raw && dt313Raw) existing.dt313Raw = dt313Raw
          if (!existing.dt315Raw && dt315Raw) existing.dt315Raw = dt315Raw
          if (!existing.migo313 && migo313) existing.migo313 = migo313
        }
      }

      const preview: any[] = []

      uniqueImportedRows.forEach((impRow, cleanRem) => {
        const { remessaRaw, sapStatus, dt313Raw, dt315Raw, migo313 } = impRow
        
        const newCriacao = parseSapDate(dt313Raw)
        const newDataEntrega = parseSapDate(dt315Raw)
        let newStatus = sapStatus ? mapSapStatus(sapStatus) : null
        if (newDataEntrega) {
          newStatus = 'Entregue'
        }

        const matchedList = remessaMap.get(cleanRem) || []
        
        if (matchedList.length > 0) {
          matchedList.forEach(matched => {
            const willChange = (
              (newStatus && newStatus !== matched.status) ||
              (newCriacao && newCriacao !== matched.criacao) ||
              (newDataEntrega && newDataEntrega !== matched.entrega) ||
              (migo313 && cleanNumStr(migo313) !== cleanNumStr(matched.documento))
            )

            preview.push({
              documento: remessaRaw,
              sapStatus,
              newStatus,
              dt313Raw,
              dt315Raw,
              newCriacao,
              newDataEntrega,
              migo313,
              matched: true,
              willInsert: false,
              willChange,
              paletId: matched.id
            })
          })
        } else {
          const willInsert = (newStatus === 'Entregue' || newStatus === 'Pendente')
          preview.push({
            documento: remessaRaw,
            sapStatus,
            newStatus,
            dt313Raw,
            dt315Raw,
            newCriacao,
            newDataEntrega,
            migo313,
            matched: false,
            willInsert,
            willChange: false,
            paletId: null
          })
        }
      })

      setImportPreview(preview)
    } catch (err: any) {
      alert('Erro ao interpretar a tabela: ' + err.message)
    } finally {
      setIsParsingImport(false)
    }
  }

  // Apply the parsed changes to Supabase
  const handleApplyImport = async () => {
    if (!user) { setShowLoginModal(true); return }
    if (!importPreview) return

    const toUpdate = importPreview.filter(r => r.matched && r.willChange)
    const toInsert = importPreview.filter(r => r.willInsert)
    if (toUpdate.length === 0 && toInsert.length === 0) {
      alert('Nenhum registro com alteração ou inserção detectada.')
      return
    }
    if (!confirm(`Confirmar atualização de ${toUpdate.length} palete(s) e criação de ${toInsert.length} novo(s)?`)) return

    setIsSavingImport(true)
    let updated = 0, inserted = 0, errors = 0

    const idMap = new Map<number, any>()
    controleRaw.forEach(c => { if (c.id) idMap.set(c.id, c) })

    const cleanNumStr = (val: any) => {
      if (val === null || val === undefined) return ''
      const s = String(val).trim().split('.')[0]
      return s.replace(/[^\d]/g, '')
    }

    for (const row of importPreview) {
      if (row.willInsert) {
        const remessaInt = parseInt(cleanNumStr(row.documento), 10)
        const docInt = row.migo313 ? parseInt(cleanNumStr(row.migo313), 10) : 0
        
        const insertPayload = {
          position: null,
          remessa: remessaInt,
          documento: docInt,
          reserva: null,
          type: null,
          // CORREÇÃO AQUI: Mudamos 'data' para 'entrega'
          entrega: row.newDataEntrega || row.newCriacao || new Date().toISOString().split('T')[0],
          criacao: row.newCriacao || new Date().toISOString().split('T')[0],
          status: row.newStatus
        }

        const { error } = await supabase.from('documento_palete').insert([insertPayload])
        if (error) { console.error(error); errors++ } else inserted++
        continue
      }

      if (!row.matched || !row.willChange) continue

      const currentRecord = idMap.get(row.paletId)
      const updates: any = {}
      if (row.newStatus && row.newStatus !== currentRecord?.status) updates.status = row.newStatus
      if (row.newCriacao && row.newCriacao !== currentRecord?.criacao) updates.criacao = row.newCriacao
      
      // CORREÇÃO AQUI: Mudamos 'data' para 'entrega'
      if (row.newDataEntrega && row.newDataEntrega !== currentRecord?.entrega) {
        updates.entrega = row.newDataEntrega
      }
      
      if (row.migo313 && cleanNumStr(row.migo313) !== cleanNumStr(currentRecord?.documento)) {
        updates.documento = parseInt(cleanNumStr(row.migo313), 10)
      }

      const { error } = await supabase.from('documento_palete').update(updates).eq('id', row.paletId)
      if (error) { console.error(error); errors++ } else updated++
    }

    setImportResult({ 
      updated, 
      inserted,
      notFound: importPreview.filter(r => !r.matched && !r.willInsert).length, 
      errors 
    })
    setIsSavingImport(false)
    await fetchControleAvarias(filterPeriod)
  }


  const handleCloseImport = () => {
    setShowStatusImport(false)
    setImportStatusText('')
    setImportPreview(null)
    setImportResult(null)
    setImportedFileName(null)
  }

  // Export current table as CSV
  const handleExportCSV = () => {
    const rows = [['Data','Posição','Qtd','Reserva','Remessa','Documento','Status','Tipo']]
    controleRaw.forEach(c => {
      rows.push([
        c.criacao || '',
        c.posicao || '',
        String(c.quantidade || 0),
        String(c.reserva || ''),
        String(c.remessa || ''),
        String(c.documento || ''),
        c.status || '',
        c.type || ''
      ])
    })
    const csv = rows.map(r => r.map(v => `"${v}"`).join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paletes_formados_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    
    return controleRaw.filter(c => {
      // REGRA: Se o palete está 'Entregue', usamos a data de 'entrega'. 
      // Caso contrário (Pendente/Estornado), usamos a data de 'criacao'.
      const dataParaFiltrar = c.status === 'Entregue' ? (c.entrega || c.criacao) : c.criacao;
      
      if (!dataParaFiltrar) return false

      if (filterPeriod === "hoje") {
        return dataParaFiltrar === today
      }
      
      if (filterPeriod === "semanal") {
        // Segunda a sábado desta semana
        const dayOfWeek = now.getDay()
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        const monday = new Date(now)
        monday.setDate(now.getDate() + diffToMonday)
        
        const saturday = new Date(monday)
        saturday.setDate(monday.getDate() + 5)
        
        const formatDateStr = (d: Date) => {
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        }
        const mondayStr = formatDateStr(monday)
        const saturdayStr = formatDateStr(saturday)
        
        return dataParaFiltrar >= mondayStr && dataParaFiltrar <= saturdayStr
      }
      
      if (filterPeriod === "mensal") {
        const [y, m] = dataParaFiltrar.split('-').map(Number)
        return y === now.getFullYear() && m === (now.getMonth() + 1)
      }

      return true
    })
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

  // Status tab filter
  const statusFilteredControle = useMemo(() => {
    if (activeStatusTab === "todos") return filteredControle
    return filteredControle.filter(c => c.status === activeStatusTab)
  }, [filteredControle, activeStatusTab])

  // Edit Handlers
  const handleOpenEditControle = (row: any) => {
    setEditingControle(row)
    setEditReserva(row.reserva ? String(row.reserva) : "")
    setEditRemessa(row.remessa ? String(row.remessa) : "")
    setEditDocumento(row.documento || "")
    setEditCodigos(row.codigos || "")
    setEditStatus(row.status === "Formado" ? "Pendente" : (row.status || "Pendente"))

    const tipoNomes = avariaTipos.map(t => t.nome)
    if (row.type) {
      const uType = String(row.type).trim().toUpperCase()
      const matched = avariaTipos.find(t => t.nome === uType)
      if (matched) {
        setEditType(matched.nome)
        setEditCustomType("")
      } else {
        setEditType("Outras")
        setEditCustomType(row.type)
      }
    } else {
      setEditType("")
      setEditCustomType("")
    }
  }

   const handleSaveEdit = async () => {
    setIsSavingEdit(true)
    try {
      // Função interna para limpar e validar números
      const cleanNum = (val: any) => {
        if (!val || String(val).trim() === "" || String(val).toLowerCase() === "null") return null;
        const cleaned = String(val).replace(/[^\d]/g, '');
        return cleaned === "" ? null : parseInt(cleaned, 10);
      }

      const remessaVal   = cleanNum(editRemessa);
      const documentoVal = cleanNum(editDocumento) ?? 0; // Se for nulo, vira 0 para evitar erro de not-null
      const reservaVal   = cleanNum(editReserva);

      const updatesDoc: any = {
        status: editStatus,
        type: editType || null,
        remessa: remessaVal,
        documento: documentoVal,
        reserva: reservaVal
      }

      const { error: docErr } = await supabase
        .from('documento_palete')
        .update(updatesDoc)
        .eq('id', editingControle.id)
      
      if (docErr) throw docErr

      // Se o número da remessa mudou, atualiza também a tabela de relação
      if (remessaVal !== null && Number(editingControle.remessa) !== remessaVal) {
        const { error: relErr } = await supabase
          .from('relacao_documento')
          .update({ remessa: remessaVal })
          .eq('remessa', editingControle.remessa)
        if (relErr) throw relErr
      }

      await fetchControleAvarias(filterPeriod)
      setEditingControle(null)
      alert("Alterações salvas com sucesso!")
    } catch (err: any) {
      console.error("Erro ao salvar edição:", err)
      alert("Erro ao salvar: " + err.message)
    } finally {
      setIsSavingEdit(false)
    }
  }

   const handleSaveManualPallet = async () => {
    setIsSavingManual(true)
    try {
      const cleanNumStr = (val: any) => {
        if (val === null || val === undefined) return ''
        const s = String(val).trim().split('.')[0]
        return s.replace(/[^\d]/g, '')
      }

      const remessaClean = cleanNumStr(manualRemessa)
      // GARANTIA: Se não digitar, gera o número aqui e guarda na variável
      const remessaInt = remessaClean ? parseInt(remessaClean, 10) : Math.floor(10000000 + Math.random() * 90000000)
      
      const docClean = cleanNumStr(manualDocumento)
      const docInt = docClean ? parseInt(docClean, 10) : 0 // Evita o erro de null no Documento SAP

      const reservaClean = cleanNumStr(manualReserva)
      const reservaInt = reservaClean ? parseInt(reservaClean, 10) : null

      const typeVal = manualType || null
      const localDate = new Date().toISOString().split('T')[0]

      // 1. Inserir no documento_palete
      const docPayload = {
        position: null,
        remessa: remessaInt, // Usa o número gerado
        documento: docInt,
        reserva: reservaInt,
        type: typeVal,
    entrega: localDate, // Alterado de 'data' para 'entrega'
  criacao: localDate,
  status: 'Pendente'
      }

      const { error: docErr } = await supabase
        .from('documento_palete')
        .insert([docPayload])
      if (docErr) throw docErr

      // 2. Inserir na relacao_documento (Onde estava dando o erro)
      const validItems = manualItems.filter(item => item.codigo.trim() && item.quantidade > 0)
      if (validItems.length > 0) {
        const relPayload = validItems.map(item => ({
          remessa: remessaInt, // GARANTIA: Usa o MESMO número gerado acima
          codigo: item.codigo,
          quantidade: item.quantidade,
          itens_excluido: null
        }))

        const { error: relErr } = await supabase
          .from('relacao_documento')
          .insert(relPayload)
        if (relErr) throw relErr
      }

      alert("Palete manual criado com sucesso!")
      setShowAddManualPallet(false)
      setManualReserva("")
      setManualRemessa("")
      setManualDocumento("")
      setManualType("")
      setManualCustomType("")
      setManualItems([{ codigo: "", quantidade: 1 }])
      
      await fetchControleAvarias(filterPeriod)
    } catch (err: any) {
      console.error("Erro ao criar palete manual:", err)
      alert("Erro ao salvar: " + err.message)
    } finally {
      setIsSavingManual(false)
    }
  }


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

        {/* ── 4 Action Buttons ── */}
        <div className="flex items-center gap-2">
          {/* Gerenciar Tipos de Avaria */}
          <div className="relative group/tip">
            <button
              onClick={onOpenTiposManager}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-all duration-200 cursor-pointer active:scale-95"
              title="Gerenciar Tipos de Avaria"
            >
              <Settings2 size={15} />
            </button>
            <div className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-[10px] font-bold text-slate-300 opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-xl">
              Configurar Tipos
            </div>
          </div>

          {/* Adicionar Palete Manual */}
          <div className="relative group/tip">
            <button
              onClick={() => { if (!user) { setShowLoginModal(true); return } setShowAddManualPallet(true) }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-all duration-200 cursor-pointer active:scale-95"
              title="Criar Palete Manualmente"
            >
              <Plus size={16} />
            </button>
            <div className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-[10px] font-bold text-slate-300 opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-xl">
              Criar Palete Manual
            </div>
          </div>

          {/* Import SAP Status */}
          <div className="relative group/tip">
            <button
              onClick={() => { if (!user) { setShowLoginModal(true); return } setShowStatusImport(true) }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 hover:text-blue-300 transition-all duration-200 cursor-pointer active:scale-95"
              title="Importar Atualização de Status SAP"
            >
              <UploadCloud size={16} />
            </button>
            <div className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-[10px] font-bold text-slate-300 opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-xl">
              Importar Status SAP
            </div>
          </div>

          {/* Refresh */}
          <div className="relative group/tip">
            <button
              onClick={() => fetchControleAvarias(filterPeriod)}
              disabled={loadingControle}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-40"
              title="Atualizar dados"
            >
              <RefreshCw size={15} className={loadingControle ? 'animate-spin' : ''} />
            </button>
            <div className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-[10px] font-bold text-slate-300 opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-xl">
              Atualizar Dados
            </div>
          </div>

          {/* Export CSV */}
          <div className="relative group/tip">
            <button
              onClick={handleExportCSV}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all duration-200 cursor-pointer active:scale-95"
              title="Exportar CSV"
            >
              <Download size={15} />
            </button>
            <div className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-[10px] font-bold text-slate-300 opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-xl">
              Exportar CSV
            </div>
          </div>
        </div>
      </header>

      {/* ── Status Period Header & Toggle Buttons ── */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800/85 p-5 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/80 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] leading-none">Monitoramento</p>
            <h2 className="text-sm font-extrabold text-white mt-1.5">
              {filterPeriod === 'hoje' ? 'Hoje'
              : filterPeriod === 'semanal' ? 'Esta Semana (Seg a Sáb)'
              : 'Este Mês'}
            </h2>
          </div>
        </div>
        
        {/* Toggle Button Group for Main Filter Period */}
        <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800/60 self-start sm:self-auto shrink-0 select-none gap-0.5">
          {[
            { id: 'hoje', label: 'Hoje' },
            { id: 'semanal', label: 'Semanal' },
            { id: 'mensal', label: 'Mensal' }
          ].map(opt => {
            const active = filterPeriod === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => {
                  setFilterPeriod(opt.id as any)
                  fetchControleAvarias(opt.id as any)
                }}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-250 cursor-pointer whitespace-nowrap border text-center",
                  active
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/40"
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Metric Cards - 3 cols normal, 4 cols on "hoje" mode */}
      <div className={cn("grid grid-cols-1 gap-4", filterPeriod === 'hoje' ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
        {(() => {
          // Calculate pieces and pallets breakdown
          const totalPallets = dateFilteredControle.length
          const totalPieces = dateFilteredControle.reduce((acc, c) => acc + (c.quantidade || 0), 0)

          const pendentePallets = dateFilteredControle.filter(c => c.status === 'Pendente').length
          const pendentePieces = dateFilteredControle.filter(c => c.status === 'Pendente').reduce((acc, c) => acc + (c.quantidade || 0), 0)

          const entreguePallets = dateFilteredControle.filter(c => c.status === 'Entregue').length
          const entreguePieces = dateFilteredControle.filter(c => c.status === 'Entregue').reduce((acc, c) => acc + (c.quantidade || 0), 0)

          // "Pendentes para Formar" — positions/SKUs still waiting to be palletized
          const pendentesFormar = posicoesAgrupadas.length
          const pendentesFormarPieces = posicoesRaw.reduce((acc, p) => acc + (p.quantidade || 0), 0)

          return (
            <>
              {/* Card: Total Formados */}
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                    <Box size={18} className="text-slate-500 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Paletes Formados</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                      {loadingControle ? "..." : totalPallets}
                    </p>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 border-t border-slate-200 dark:border-slate-800/80 pt-2 flex justify-between">
                  <span>Total Peças:</span>
                  <span className="font-black text-slate-600 dark:text-slate-300">{totalPieces.toLocaleString('pt-BR')} pcs</span>
                </div>
              </div>

              {/* Card: Pendentes para Entrega */}
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                    <Clock size={18} className="text-amber-500 dark:text-amber-450" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pendentes para Entrega</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                      {loadingControle ? "..." : pendentePallets}
                    </p>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 border-t border-slate-200 dark:border-slate-800/80 pt-2 flex justify-between">
                  <span>Peças Pendentes:</span>
                  <span className="font-black text-amber-500">{pendentePieces.toLocaleString('pt-BR')} pcs</span>
                </div>
              </div>

              {/* Card: Entregues */}
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Entregues ao Conserto</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                      {loadingControle ? "..." : entreguePallets}
                    </p>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 border-t border-slate-200 dark:border-slate-800/80 pt-2 flex justify-between">
                  <span>Peças Entregues:</span>
                  <span className="font-black text-emerald-500 dark:text-emerald-400">{entreguePieces.toLocaleString('pt-BR')} pcs</span>
                </div>
              </div>

              {/* Card: Pendentes para Formar — only visible in "hoje" mode */}
              {filterPeriod === 'hoje' && (
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-violet-500/20 dark:border-violet-500/20 p-4 shadow-sm flex flex-col justify-between space-y-3 relative overflow-hidden">
                  {/* subtle glow accent */}
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none" />
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                      <AlertTriangle size={18} className="text-violet-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pendentes para Formar</p>
                      <p className="text-2xl font-black text-violet-400 leading-tight">
                        {loadingControle ? "..." : pendentesFormar}
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 border-t border-violet-500/15 pt-2 flex justify-between">
                    <span>Peças na Fila:</span>
                    <span className="font-black text-violet-400">{pendentesFormarPieces.toLocaleString('pt-BR')} pcs</span>
                  </div>
                </div>
              )}
            </>
          )
        })()}
      </div>

      {/* ── Mini Dashboard: Meta do Dia + Gráfico de Entregas ── */}
      {(() => {
        const DAILY_GOAL = 30

        // Build type config dynamically from avariaTipos
        const typeKey = (c: any): string => {
          if (!c.type) return '__outro__'
          const upper = String(c.type).trim().toUpperCase()
          const match = avariaTipos.find(t => t.nome === upper || t.nome === String(c.type).trim())
          if (match) return match.nome
          return String(c.type).trim() || '__outro__'
        }

        const getCfg = (t: string) => {
          const tipo = avariaTipos.find(tp => tp.nome === t)
          if (tipo) return { hex: tipo.cor_hex, label: tipo.label || tipo.nome }
          // Fallback for unknown types: generate stable color from string hash
          const palette = ['#a855f7','#ec4899','#6366f1','#f97316','#06b6d4','#84cc16','#f59e0b','#3b82f6']
          let hash = 0
          for (let i = 0; i < t.length; i++) hash = t.charCodeAt(i) + ((hash << 5) - hash)
          return { hex: palette[Math.abs(hash) % palette.length], label: t || 'Outro' }
        }

        // Filter helper to ensure we only count registered types
        const isCadastrado = (c: any) => avariaTipos.some(tp => tp.nome === typeKey(c))

        // Compute Today's Data for Left Panel
        const now = new Date()
        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
        const todayItems = controleRaw.filter(c => c.status === 'Entregue' && (c.entrega || c.criacao) === todayStr && isCadastrado(c))
       
        const todayData = {
          ds: todayStr,
          total: todayItems.length,
          totalPieces: todayItems.reduce((acc, c) => acc + (c.quantidade || 0), 0),
          byType: {} as Record<string, number>
        }
        todayItems.forEach(c => {
          const k = typeKey(c)
          todayData.byType[k] = (todayData.byType[k] || 0) + 1
        })

        const pendingPalletsList = controleRaw.filter(c => c.status === 'Pendente' && isCadastrado(c))
        const pendingByType: Record<string, { count: number; pieces: number }> = {}
        pendingPalletsList.forEach(c => {
          const k = typeKey(c)
          if (!pendingByType[k]) {
            pendingByType[k] = { count: 0, pieces: 0 }
          }
          pendingByType[k].count += 1
          pendingByType[k].pieces += (c.quantidade || 0)
        })

        const todayPct = Math.min((todayData.total / DAILY_GOAL) * 100, 100)
        const todayMet = todayData.total >= DAILY_GOAL
        const todayTypes = Object.entries(todayData.byType).sort(([,a],[,b]) => b - a)

        // Compute period-wide data by type (for when filterPeriod !== 'hoje')
        const periodItems = dateFilteredControle.filter(c => c.status === 'Entregue' && isCadastrado(c))
        const periodTotal = periodItems.length
        const periodTotalPieces = periodItems.reduce((acc, c) => acc + (c.quantidade || 0), 0)
        
        const periodTypesSet = new Set<string>()
        periodItems.forEach(c => periodTypesSet.add(typeKey(c)))
        const periodTypesList = Array.from(periodTypesSet)

        const periodTypeData = periodTypesList.map(t => {
          const cfg = getCfg(t)
          const itemsOfType = periodItems.filter(c => typeKey(c) === t)
          const totalPieces = itemsOfType.reduce((acc, c) => acc + (c.quantidade || 0), 0)
          return {
            type: t,
            label: cfg.label,
            total: itemsOfType.length,
            totalPieces,
            cfg
          }
        }).sort((a, b) => b.total - a.total)
        const maxPeriodTypeVal = Math.max(...periodTypeData.map(d => d.total), 1)

        // Build Chart Items according to top filterPeriod
        const isTodayMode = filterPeriod === 'hoje'
        let chartItems: {
          key: string;
          label: string;
          subLabel?: string;
          total: number;
          totalPieces: number;
          byType: Record<string, number>;
          isToday?: boolean;
          tooltipTitle: string;
        }[] = []

        let chartTitle = 'Entregas por Dia'
        let chartSubtitle = ''

        if (isTodayMode) {
          chartTitle = 'Entregas por Tipo'
          chartSubtitle = 'Hoje'
          
          const todayTypesSet = new Set<string>()
          todayItems.forEach(c => todayTypesSet.add(typeKey(c)))
          const typesList = Array.from(todayTypesSet)

          chartItems = typesList.map(t => {
            const cfg = getCfg(t)
            const itemsOfType = todayItems.filter(c => typeKey(c) === t)
            const totalPieces = itemsOfType.reduce((acc, c) => acc + (c.quantidade || 0), 0)
            return {
              key: t,
              label: cfg.label,
              subLabel: 'HOJE',
              total: itemsOfType.length,
              totalPieces,
              byType: { [t]: itemsOfType.length },
              tooltipTitle: cfg.label ? `AV. ${cfg.label.toUpperCase()}` : 'SEM TIPO',
              isToday: true
            }
          })
        } else {
          let uniqueDates: string[] = []
          if (filterPeriod === 'semanal') {
            chartSubtitle = 'Esta Semana (Seg a Sáb)'
            const dayOfWeek = now.getDay()
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
            uniqueDates = Array.from({ length: 6 }, (_, i) => {
              const d = new Date(now)
              d.setDate(now.getDate() + diffToMonday + i)
              return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
            })
          } else {
            chartSubtitle = 'Este Mês'
            const todayDate = now.getDate()
            uniqueDates = Array.from({ length: todayDate }, (_, i) => {
              const d = new Date(now)
              d.setDate(i + 1)
              return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
            })
          }

          chartItems = uniqueDates.map(ds => {
            const [y, m, dNum] = ds.split('-').map(Number)
            const dateObj = new Date(y, m - 1, dNum)
            const short = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.','').toUpperCase().slice(0,3)
            const num = dateObj.getDate()
const items = controleRaw.filter(c => {
  return c.status === 'Entregue' && (c.entrega || c.criacao) === ds && isCadastrado(c);
});

const byType: Record<string, number> = {}
let totalPieces = 0
items.forEach(c => {
  const k = typeKey(c)
  byType[k] = (byType[k] || 0) + 1
  totalPieces += (c.quantidade || 0)
})
            
            const now = new Date()
            const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

            return {
              key: ds,
              label: short,
              subLabel: String(num),
              total: items.length,
              totalPieces,
              byType,
              isToday: ds === todayStr,
              tooltipTitle: `${num} DE ${dateObj.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}`
            }
          })
        }

        const maxBar = Math.max(...chartItems.map(d => d.total), DAILY_GOAL, 1)

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* LEFT PANEL */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between shadow-lg min-h-[460px]">
              {isTodayMode ? (
                // LEFT: Meta do Dia (Today Mode)
                <div className="flex flex-col justify-between h-full space-y-5">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Meta do Dia</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border",
                      todayMet
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                        : todayPct > 50
                        ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                        : "bg-slate-700/50 text-slate-400 border-slate-600/50"
                    )}>
                      {todayMet ? '✓ Meta Atingida' : `${Math.round(todayPct)}% da Meta`}
                    </div>
                  </div>

                  {/* Big number */}
                  <div>
                    <div className="flex items-end gap-2 mb-3">
                      <span className="text-5xl font-black text-white leading-none">{todayData.total}</span>
                      <div className="pb-1">
                        <span className="text-sm font-bold text-slate-400">/ {DAILY_GOAL}</span>
                        <p className="text-[10px] text-slate-500 font-bold">Paletes Entregues</p>
                      </div>
                      <div className="ml-auto pb-1 text-right">
                        <span className="text-lg font-black text-slate-300">{todayData.totalPieces.toLocaleString('pt-BR')}</span>
                        <p className="text-[10px] text-slate-500 font-bold">Peças Entregues</p>
                      </div>
                    </div>

                    {/* Segmented progress bar by type */}
                    <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700/40">
                      {todayTypes.length === 0 ? (
                        <div className="h-full w-0" />
                      ) : (
                        <div className="flex h-full">
                          {todayTypes.map(([type, cnt], idx) => {
                            const cfg = getCfg(type)
                            const segPct = (cnt / DAILY_GOAL) * 100
                            return (
                              <motion.div
                                key={type}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(segPct, 100)}%` }}
                                transition={{ duration: 0.7, ease: 'easeOut', delay: idx * 0.08 }}
                                className={cn('h-full relative overflow-hidden', idx > 0 && 'border-l border-slate-900/40')}
                                style={{ backgroundColor: cfg.hex }}
                                title={`${cfg.label || 'Sem Tipo'}: ${cnt} paletes`}
                              >
                                <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent" />
                              </motion.div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex justify-between items-center text-[10px]">
                      {!todayMet ? (
                        <span className="text-slate-300 font-bold">
                          Faltam <span className="text-amber-400 font-black">{DAILY_GOAL - todayData.total}</span> paletes para a meta
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-black flex items-center gap-1">✓ Meta atingida hoje!</span>
                      )}
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Meta: {DAILY_GOAL} pal.</span>
                    </div>
                  </div>

                  {/* Type breakdown */}
                  <div className="border-t border-slate-800 pt-4 space-y-2.5">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">Detalhes por Tipo — Hoje</span>
                    </div>

                    {todayTypes.length === 0 ? (
                      <p className="text-xs text-slate-500 italic font-bold">Nenhum palete entregue hoje.</p>
                    ) : (
                      <div className="space-y-2">
                        {todayTypes.map(([type, cnt]) => {
                          const cfg = getCfg(type)
                          const pct = todayData.total > 0 ? (cnt / todayData.total) * 100 : 0
                      const pieces = controleRaw
  .filter(c => (c.entrega || c.criacao) === todayData.ds && c.status === 'Entregue' && typeKey(c) === type)
  .reduce((acc, c) => acc + (c.quantidade || 0), 0)
                          return (
                            <div key={type} className="flex items-center gap-3">
                              <div className='h-2 w-2 rounded-full shrink-0' style={{ backgroundColor: cfg.hex }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                                  <span className="text-slate-300">{cfg.label || 'Sem Tipo'}</span>
                                  <span className="text-slate-400 text-[10px]">
                                    {cnt} pal · <span style={{ color: cfg.hex }}>{pieces.toLocaleString('pt-BR')} pcs</span>
                                  </span>
                                </div>
                                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.6, ease: 'easeOut' }}
                                    className='h-full rounded-full'
                                    style={{ backgroundColor: cfg.hex }}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // LEFT: Relação de Quantidade por Tipo (Period Mode)
                <div className="flex flex-col justify-between h-full space-y-4">
                  {/* Header */}
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Entregas por Tipo</p>
                    <p className="text-sm font-black text-white mt-0.5">
                      {filterPeriod === 'semanal' ? 'Esta Semana (Últimos 7 dias)' : filterPeriod === 'mensal' ? 'Este Mês' : 'Histórico Completo'}
                    </p>
                  </div>

                  {/* Summary metrics for Left Panel */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-800/40 rounded-xl px-3 py-2.5 border border-slate-800/60 shadow-inner flex flex-col justify-between min-h-[64px]">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Líder</p>
                      <p className="text-[13px] font-black text-white truncate mt-1">
                        {(() => {
                          const sorted = [...periodTypeData].sort((a,b) => b.total - a.total)
                          return sorted[0]?.total > 0 ? (sorted[0].label || 'Sem Tipo') : '—'
                        })()}
                      </p>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl px-3 py-2.5 border border-slate-800/60 shadow-inner flex flex-col justify-between min-h-[64px]">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Paletes</p>
                      <p className="text-[14px] font-black text-slate-200 mt-1">{periodTotal}</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl px-3 py-2.5 border border-slate-800/60 shadow-inner flex flex-col justify-between min-h-[64px]">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Peças</p>
                      <p className="text-[14px] font-black text-emerald-400 mt-1">{periodTotalPieces.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>

                  {/* Circular distribution chart */}
                  <div className="flex flex-col sm:flex-row items-center gap-10 py-6 flex-1 justify-center">
                    {/* Donut Chart SVG */}
                    <div className="relative shrink-0 w-48 h-48 flex items-center justify-center bg-slate-950/20 rounded-full p-2 border border-slate-800/40">
                      <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                        {/* Background track */}
                        <circle cx="100" cy="100" r="70" fill="transparent" stroke="#1e293b" strokeWidth="22" />
                        {(() => {
                          const totalPalletsPeriod = periodTotal
                          if (totalPalletsPeriod === 0) return null
                          let accumulatedPercent = 0
                          return periodTypeData.map((d, index) => {
                            if (d.total === 0) return null
                            const percent = (d.total / totalPalletsPeriod) * 100
                            const strokeLength = (percent / 100) * 439.82
                            // In SVG, clockwise stacking uses negative offsets
                            const strokeOffset = -((accumulatedPercent / 100) * 439.82)
                            accumulatedPercent += percent

                            const isHovered = hoveredType === d.type
                            const isAnyHovered = hoveredType !== null

                            return (
                              <motion.circle
                                key={d.type}
                                cx="100"
                                cy="100"
                                r="70"
                                fill="transparent"
                                stroke={d.cfg.hex}
                                strokeWidth={isHovered ? 28 : 22}
                                strokeDasharray={`${strokeLength} 439.82`}
                                strokeDashoffset={strokeOffset}
                                initial={{ strokeDashoffset: 0 }}
                                animate={{ 
                                  strokeDashoffset: strokeOffset,
                                  strokeWidth: isHovered ? 28 : 22
                                }}
                                style={{
                                  opacity: isAnyHovered && !isHovered ? 0.35 : 1,
                                  transition: "stroke-width 0.25s ease, opacity 0.25s ease",
                                  cursor: "pointer"
                                }}
                                onMouseEnter={() => setHoveredType(d.type)}
                                onMouseLeave={() => setHoveredType(null)}
                              />
                            )
                          })
                        })()}
                      </svg>
                      {/* Central label */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-4xl font-black text-white tracking-tight leading-none">
                          {periodTotal}
                        </span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">
                          TOTAL
                        </span>
                      </div>
                    </div>

                    {/* Breakdown List */}
                    <div className="flex-1 w-full space-y-2.5 overflow-x-hidden py-1">
                      {periodTotal === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center">Nenhum palete entregue neste período.</p>
                      ) : (
                        periodTypeData.map((d) => {
                          if (d.total === 0) return null
                          const pct = Math.round((d.total / periodTotal) * 100)
                          const isHovered = hoveredType === d.type

                          return (
                            <div 
                              key={d.type} 
                              className={cn(
                                "flex items-center justify-between py-2 border-b border-slate-800/45 last:border-0 hover:bg-slate-800/40 px-3 rounded-xl transition-all duration-200 cursor-pointer",
                                isHovered ? "bg-slate-800/50 scale-[1.02] border-slate-700/50" : ""
                              )}
                              onMouseEnter={() => setHoveredType(d.type)}
                              onMouseLeave={() => setHoveredType(null)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-6.5 w-6.5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${d.cfg.hex}22` }}>
                                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.cfg.hex }} />
                                </div>
                                <span className="text-xs font-black text-slate-200 uppercase tracking-wider">{d.label || d.type}</span>
                              </div>
                              <div className="flex items-center gap-3 text-right">
                                <span className="text-xs font-black text-white bg-slate-950/80 border border-slate-800/60 px-2.5 py-0.5 rounded-lg">{d.total}</span>
                                <span className="text-xs font-black text-cyan-400 border-l border-slate-800/80 pl-3 min-w-[40px] text-right">{pct}%</span>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Bar Chart / Pendentes por Tipo */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col shadow-lg min-h-[460px]">
              {isTodayMode ? (
                // RIGHT: Pendentes por Tipo (Today Mode)
                <div className="flex flex-col h-full justify-between flex-1 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Pendentes por Tipo</p>
                      <p className="text-sm font-black text-white mt-0.5">Fila de Aguardando Entrega</p>
                    </div>
                    {pendingPalletsList.length > 0 && (
                      <div className="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/25">
                        {pendingPalletsList.length} paletes
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 flex flex-col justify-center">
                    {pendingPalletsList.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center text-center p-8 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-3"
                      >
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle2 className="text-emerald-500" size={20} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-black text-slate-200">Nenhum palete pendente</p>
                          <p className="text-[10px] text-slate-500 font-bold max-w-[240px] mx-auto leading-relaxed">
                            Todos os paletes formados foram entregues. Bom trabalho!
                          </p>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                        {Object.entries(pendingByType)
                          .sort(([, a], [, b]) => b.count - a.count)
                          .map(([type, data]) => {
                            const cfg = getCfg(type)
                            const pct = pendingPalletsList.length > 0 ? (data.count / pendingPalletsList.length) * 100 : 0
                            return (
                              <div 
                                key={type} 
                                className="p-3.5 rounded-xl bg-slate-950/30 border border-slate-800/40 hover:border-slate-700/60 transition-all duration-300 hover:bg-slate-900/30 group/item hover:translate-x-1 flex flex-col gap-2"
                              >
                                <div className="flex items-center justify-between text-xs font-bold">
                                  <div className="flex items-center gap-2.5">
                                    <div 
                                      className="h-2.5 w-2.5 rounded-full animate-pulse" 
                                      style={{ 
                                        backgroundColor: cfg.hex,
                                        boxShadow: `0 0 8px ${cfg.hex}`
                                      }} 
                                    />
                                    <span className="text-slate-100 uppercase tracking-widest text-[11px] font-black">{cfg.label || type}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-200 text-[11px] font-black bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800/80">
                                      {data.count} <span className="text-[8px] text-slate-500 font-bold ml-0.5">PAL</span>
                                    </span>
                                    <span 
                                      className="text-[11px] font-black bg-slate-950/50 px-2 py-0.5 rounded border border-slate-800/40"
                                      style={{ color: cfg.hex }}
                                    >
                                      {data.pieces.toLocaleString('pt-BR')} <span className="text-[8px] opacity-60 font-bold ml-0.5">PCS</span>
                                    </span>
                                  </div>
                                </div>
                                <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-850 shadow-inner">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.65, ease: "easeOut" }}
                                    className="h-full rounded-full relative"
                                    style={{ 
                                      backgroundColor: cfg.hex,
                                      boxShadow: `0 0 10px ${cfg.hex}aa`
                                    }}
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
                                  </motion.div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="pt-3 border-t border-slate-800/50 flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase tracking-wider shrink-0">
                    <span>Aguardando MIGO / SAP</span>
                    <span>Total de peças: {pendingPalletsList.reduce((acc, c) => acc + (c.quantidade || 0), 0).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              ) : (
                // RIGHT: Bar Chart (Weekly/Monthly/History)
                <div className="flex flex-col h-full justify-between flex-1">
                  {/* Chart Header — title left, Média/Dia pill right */}
                  {(() => {
                    const totalP = chartItems.reduce((s, d) => s + d.total, 0)
                    const activeDays = chartItems.filter(d => d.total > 0).length
                    return (
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{chartTitle}</p>
                          <p className="text-sm font-black text-white mt-0.5">{chartSubtitle}</p>
                        </div>

                        <div className="flex flex-col items-end">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Média/Dia</p>
                          <p className="text-lg font-black text-cyan-400">
                            {activeDays > 0 ? Math.round(totalP / activeDays) : 0}
                          </p>
                          <p className="text-[9px] text-slate-600 font-bold">pal/dia ativo</p>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Bar Chart */}
                  <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-stretch gap-1.5 pb-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950/20" style={{ minHeight: 130 }}>
                    {chartItems.map((day, i) => {
                      const pct = day.total > 0 ? (day.total / maxBar) * 100 : 0
                      const typeEntries = Object.entries(day.byType).sort(([,a],[,b]) => b - a)
                      return (
                        <div key={day.key} className={cn("flex-1 flex flex-col items-center group/bar relative", filterPeriod === 'semanal' ? "w-full" : "min-w-[28px] max-w-[42px]")}>

                          {/* Hover Tooltip */}
                          <div className={cn(
                            "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30",
                            "bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2.5 w-max max-w-[160px]",
                            "opacity-0 group-hover/bar:opacity-100 pointer-events-none transition-opacity duration-150"
                          )}>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                              {day.tooltipTitle}{day.isToday && !isTodayMode ? ' · HOJE' : ''}
                            </p>
                            <div className="flex items-center justify-between gap-4 mb-1">
                              <span className="text-[11px] font-black text-white">{day.total} paletes</span>
                              <span className="text-[10px] font-bold text-emerald-400">{day.totalPieces.toLocaleString('pt-BR')} pcs</span>
                            </div>
                            {typeEntries.length > 0 && (
                              <div className="border-t border-slate-700 pt-1.5 space-y-1 mt-1">
                                {typeEntries.map(([type, cnt]) => {
                                  const cfg = getCfg(type)
                                  return (
                                    <div key={type} className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-1.5">
                                        <div className='h-1.5 w-1.5 rounded-full shrink-0' style={{ backgroundColor: cfg.hex }} />
                                        <span className="text-[9px] text-slate-300 font-bold">{cfg.label || 'Sem Tipo'}</span>
                                      </div>
                                      <span className='text-[9px] font-black' style={{ color: cfg.hex }}>{cnt}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            {day.total === 0 && (
                              <p className="text-[9px] text-slate-500 italic">Sem entregas</p>
                            )}
                          </div>

                          {/* Number label — flex child above bar, never overflows card */}
                          <div className="h-6 flex items-center justify-center w-full pointer-events-none shrink-0 mb-1">
                            {day.total > 0 && (
                              <motion.span
                                key={`${day.key}-pal-label`}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, ease: 'easeOut', delay: i * 0.03 + 0.25 }}
                                className="text-[14px] font-black text-emerald-400 leading-none whitespace-nowrap"
                              >
                                +{day.total}
                              </motion.span>
                            )}
                          </div>

                          {/* Bar — overflow-hidden now safe because label is outside */}
                          <div className={cn("flex-1 flex flex-col justify-end rounded-t-full overflow-hidden bg-slate-800/10", filterPeriod === 'semanal' ? "w-12 sm:w-16" : "w-full")}>
                            {typeEntries.length === 0 ? (
                              <div
                                className={cn("rounded-t-full", filterPeriod === 'semanal' ? "w-12 sm:w-16" : "w-full", day.isToday ? 'bg-slate-600/30' : 'bg-slate-850/30')}
                                style={{ height: '2%' }}
                              />
                            ) : (
                              <motion.div
                                initial={{ scaleY: 0 }}
                                animate={{ scaleY: 1 }}
                                transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.03 }}
                                style={{ height: `${Math.max(pct, 3)}%`, transformOrigin: 'bottom' }}
                                className="w-full flex flex-col-reverse rounded-t-full overflow-hidden"
                              >
                                {typeEntries.map(([type, cnt], idx) => {
                                  const cfg = getCfg(type)
                                  const segH = day.total > 0 ? (cnt / day.total) * 100 : 0
                                  return (
                                    <div
                                      key={type}
                                      style={{ height: `${segH}%`, backgroundColor: cfg.hex }}
                                      className={cn(
                                        'w-full',
                                        idx > 0 && 'border-t border-slate-900/30',
                                      )}
                                    />
                                  )
                                })}
                              </motion.div>
                            )}
                          </div>

                          {/* X-axis label */}
                          <div className={cn("text-center leading-tight mt-2 shrink-0 flex flex-col gap-0.5", day.isToday && !isTodayMode ? "text-emerald-400" : "text-slate-400")}>
                            {isTodayMode ? (
                              <>
                                <span className="text-[10px] font-black uppercase tracking-wider text-white">{day.label}</span>
                                <span className="text-[8px] text-slate-500 font-bold">HOJE</span>
                              </>
                            ) : (
                              <>
                                <span className="text-[11px] font-black uppercase text-white tracking-wide">{day.label}</span>
                                <span className="text-[9px] text-cyan-400 font-bold">{day.subLabel}</span>
                                <span className="text-[7px] text-slate-500 font-black uppercase tracking-wider">DIAS</span>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Legend — dynamic from avariaTipos (filtered by active types in chart) */}
                  <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-x-3 gap-y-1.5 items-center">
                    {(() => {
                      const activeTypesInChart = new Set<string>()
                      chartItems.forEach(item => {
                        Object.keys(item.byType).forEach(k => {
                          if (item.byType[k] > 0) activeTypesInChart.add(k)
                        })
                      })
                      const chartActiveTipos = avariaTipos.filter(tipo => activeTypesInChart.has(tipo.nome))
                      return chartActiveTipos.map((tipo) => (
                        <div key={tipo.nome} className="flex items-center gap-1.5">
                          <div className='h-2 w-2 rounded-full' style={{ backgroundColor: tipo.cor_hex }} />
                          <span className="text-[9px] font-bold text-slate-500">{tipo.label || tipo.nome}</span>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}
            </div>

          </div>
        )
      })()}


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
        </div>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2">
          {filteredControle.length} {filteredControle.length === 1 ? "palete filtrado" : "paletes filtrados"}
        </span>
      </div>

      {/* Status tabs */}
      <div className="flex border-b border-slate-100 dark:border-slate-800/80 mb-4 overflow-x-auto shrink-0">
        {[
          { id: "todos", label: "Todos", count: filteredControle.length, icon: Box, color: "text-slate-500 bg-slate-500/10 border-slate-500/20" },
          { id: "Pendente", label: "Pendentes", count: filteredControle.filter(c => c.status === 'Pendente').length, icon: Clock, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
          { id: "Entregue", label: "Entregues", count: filteredControle.filter(c => c.status === 'Entregue').length, icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveStatusTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-all duration-300 relative cursor-pointer whitespace-nowrap",
              activeStatusTab === tab.id
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 font-black"
                : "border-transparent text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
            )}
          >
            <tab.icon size={14} className={cn(activeStatusTab === tab.id ? "text-emerald-500" : "text-slate-400")} />
            <span>{tab.label}</span>
            <span className={cn(
              "ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-black leading-none transition-colors",
              activeStatusTab === tab.id
                ? "bg-emerald-500 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
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
                {statusFilteredControle.map((c) => {
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
                                c.status === 'Entregue'
                                  ? "text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 hover:border-emerald-300 dark:hover:border-emerald-400"
                                  : c.status === 'Estornado'
                                    ? "text-rose-600 bg-rose-55 dark:bg-rose-500/10 dark:text-rose-450 dark:border-rose-500/25 border-rose-100 hover:border-rose-300 dark:hover:border-rose-400"
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
                              ) : c.status === 'Estornado' ? (
                                <>
                                  <AlertCircle size={12} className="shrink-0 text-rose-500" />
                                  Estornado
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
                                    className="absolute left-0 mt-2 w-[130px] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-1.5 space-y-0.5"
                                  >
                                    {[
                                      { value: "Pendente", label: "Pendente", color: "text-amber-550", bg: "hover:bg-amber-50 dark:hover:bg-amber-500/10", icon: Clock },
                                      { value: "Entregue", label: "Entregue", color: "text-emerald-550", bg: "hover:bg-emerald-50 dark:hover:bg-emerald-500/10", icon: CheckCircle2 },
                                      { value: "Estornado", label: "Estornado", color: "text-rose-500", bg: "hover:bg-rose-50 dark:hover:bg-rose-500/10", icon: AlertCircle }
                                    ].map(opt => (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={async () => {
                                          setActiveStatusDropdownId(null)
                                          try {
                                            const { error } = await supabase
                                              .from('documento_palete')
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
                                          (c.status === 'Entregue' ? 'Entregue' : (c.status === 'Estornado' ? 'Estornado' : (c.status || 'Pendente'))) === opt.value
                                            ? "bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                                            : "text-slate-600 dark:text-slate-350"
                                        )}
                                      >
                                        <div className="flex items-center gap-2">
                                          <opt.icon size={14} className={opt.color} />
                                          {opt.label}
                                        </div>
                                        {(c.status === 'Entregue' ? 'Entregue' : (c.status === 'Estornado' ? 'Estornado' : (c.status || 'Pendente'))) === opt.value && <Check size={14} className="text-emerald-500" />}
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
                              onClick={() => handlePrintControle(c, true, false)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-500 border-transparent border transition-colors cursor-pointer"
                              title="Gerar / Visualizar Ficha com QR Code"
                            >
                              <QrCode size={14} />
                            </button>
                            <button
                              onClick={() => handlePrintControle(c, false, true)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-500/20 text-slate-400 hover:text-blue-500 border-transparent border transition-colors cursor-pointer"
                              title="Imprimir Palete (Padrão sem QR Code)"
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

                {statusFilteredControle.length === 0 && (
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
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Tipo de Avaria</label>
                  <div className="flex flex-wrap gap-2">
                    {avariaTipos.map(t => ({ value: t.nome, cor_hex: t.cor_hex })).map((t) => {
                      const active = editType === t.value
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setEditType(t.value)}
                          className={cn(
                            "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                            active
                              ? "text-white shadow-lg"
                              : "bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                          )}
                          style={active ? { backgroundColor: t.cor_hex, borderColor: t.cor_hex } : {}}
                        >
                          {t.value}
                        </button>
                      )
                    })}
                  </div>
                </div>


                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Status do Palete</label>
                  <div className="flex gap-2">
                    {[
                      { value: "Pendente", label: "Pendente", colorClass: "hover:text-amber-500 dark:hover:bg-amber-500/10", activeClass: "bg-amber-500 border-amber-500 text-slate-950 shadow-lg shadow-amber-500/20" },
                      { value: "Entregue", label: "Entregue", colorClass: "hover:text-emerald-500 dark:hover:bg-emerald-500/10", activeClass: "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20" }
                    ].map((statusOpt) => (
                      <button
                        key={statusOpt.value}
                        type="button"
                        onClick={() => setEditStatus(statusOpt.value)}
                        className={cn(
                          "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex-1",
                          editStatus === statusOpt.value
                            ? statusOpt.activeClass
                            : `bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 ${statusOpt.colorClass}`
                        )}
                      >
                        {statusOpt.label}
                      </button>
                    ))}
                  </div>
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
                    onClick={handleSaveEdit}
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

      {/* ─── Status Import Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showStatusImport && (
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseImport}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between p-7 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <UploadCloud size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                      Importar Atualização de Status SAP
                    </h2>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      Confronto automático por Documento · Portal BR
                    </p>
                  </div>
                </div>
                <button onClick={handleCloseImport} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-7 space-y-6">

                {/* Instructions */}
                {!importPreview && (
                  <div className="rounded-2xl bg-blue-500/5 border border-blue-500/15 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileCheck2 size={14} className="text-blue-400 shrink-0" />
                      <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest">Como usar</span>
                    </div>
                    <ol className="space-y-1.5 pl-1">
                      {[
                        'Acesse o Portal SAP e exporte o relatório de remessas/MIGO',
                        'Copie a tabela (Ctrl+A, Ctrl+C) OU carregue o arquivo abaixo',
                        'Colunas utilizadas: Documento, Status, Dt.Migo 313 (criação), Dt.Migo 315 (entrega)',
                        'Revise o preview e confirme a atualização'
                      ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="shrink-0 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/20 text-[9px] font-black text-blue-400">{i+1}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{step}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-slate-400">Status mapeados:</span>{' '}
                      <span className="text-emerald-400 font-bold">Recebido no Destino → Entregue</span>{' · '}
                      <span className="text-amber-400 font-bold">Em Trânsito → Pendente</span>
                    </div>
                  </div>
                )}

                {/* Paste + File Upload Area */}
                {!importPreview && (
                  <div className="space-y-3">

                    {/* File upload zone */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.txt,.tsv"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(file)
                        e.target.value = ''
                      }}
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault()
                        const file = e.dataTransfer.files?.[0]
                        if (file) handleFileUpload(file)
                      }}
                      className="flex items-center justify-center gap-3 h-14 rounded-2xl border-2 border-dashed border-blue-500/25 hover:border-blue-500/50 bg-blue-500/4 hover:bg-blue-500/8 text-blue-400 cursor-pointer transition-all group/drop"
                    >
                      {importedFileName ? (
                        <>
                          <Paperclip size={15} className="shrink-0" />
                          <span className="text-xs font-bold truncate max-w-[280px]">{importedFileName}</span>
                          <span className="text-[10px] text-blue-300/60 font-bold">· clique para trocar</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud size={16} className="shrink-0 group-hover/drop:scale-110 transition-transform" />
                          <span className="text-xs font-bold">Arraste o arquivo ou clique para carregar</span>
                          <span className="text-[10px] text-blue-300/50 font-bold">.xlsx .xls .csv .txt</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-800" />
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">ou cole aqui</span>
                      <div className="flex-1 h-px bg-slate-800" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dados do Portal SAP</label>
                      <textarea
                        rows={7}
                        placeholder={`Material\tDescrição\tQtd\tDocumento\tDt.Migo 313\tMigo 313\tDt.Migo 315\tMigo 315\tStatus\n4916757015\tPROD XYZ\t30\t...`}
                        value={importStatusText}
                        onChange={e => setImportStatusText(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs text-slate-700 dark:text-slate-300 font-mono focus:outline-none focus:border-blue-500/50 resize-none placeholder-slate-300 dark:placeholder-slate-700"
                      />
                      <p className="text-[10px] text-slate-500">
                        {importStatusText.trim() ? `${importStatusText.trim().split('\n').length} linha(s) detectada(s)` : 'Nenhum dado inserido.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Preview */}
                {importPreview && !importResult && (
                  <div className="space-y-4">
                    {/* Summary badges */}
                    <div className="flex flex-wrap gap-2">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-400">
                        <Check size={12} /> {importPreview.filter(r => r.matched && r.willChange).length} para atualizar
                      </span>
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] font-bold text-blue-400">
                        <Plus size={12} /> {importPreview.filter(r => r.willInsert).length} para adicionar
                      </span>
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-500/10 border border-slate-500/20 text-[11px] font-bold text-slate-400">
                        <Check size={12} /> {importPreview.filter(r => r.matched && !r.willChange).length} sem alteração
                      </span>
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] font-bold text-rose-400">
                        <AlertTriangle size={12} /> {importPreview.filter(r => !r.matched && !r.willInsert).length} não mapeados/ignorados
                      </span>
                    </div>
                  </div>
                )}

                {/* Preview */}
                {importPreview && !importResult && (
                  <div className="space-y-4">
                    {/* Preview table */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left">
                          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">
                            <tr className="border-b border-slate-200 dark:border-slate-800">
                              {['Documento','Status SAP','→ Novo Status','Dt. Criação','Dt. Entrega','Situação'].map(col => (
                                <th key={col} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                            {importPreview.map((row, i) => (
                              <tr key={i} className={cn(
                                'transition-colors',
                                !row.matched && !row.willInsert ? 'opacity-40' :
                                row.willInsert ? 'bg-blue-500/5' :
                                row.willChange ? 'bg-emerald-500/3' : ''
                              )}>
                                <td className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 font-mono whitespace-nowrap">{row.documento}</td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{row.sapStatus || '—'}</td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  {row.newStatus ? (
                                    <span className={cn(
                                      'px-2 py-0.5 rounded-lg text-[10px] font-black',
                                      row.newStatus === 'Entregue'  ? 'bg-emerald-500/15 text-emerald-400' :
                                      row.newStatus === 'Estornado' ? 'bg-rose-500/15 text-rose-400' :
                                      'bg-amber-500/15 text-amber-400'
                                    )}>{row.newStatus}</span>
                                  ) : <span className="text-slate-600 text-[10px]">—</span>}
                                </td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-500 font-mono whitespace-nowrap">{row.newCriacao || row.dt313Raw || '—'}</td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-500 font-mono whitespace-nowrap">{row.newDataEntrega || row.dt315Raw || '—'}</td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  {row.willInsert ? (
                                    <span className="text-[10px] font-bold text-blue-400 font-bold">✓ Adicionar</span>
                                  ) : !row.matched ? (
                                    <span className="text-[10px] font-bold text-slate-500">Ignorado</span>
                                  ) : row.willChange ? (
                                    <span className="text-[10px] font-bold text-emerald-400">✓ Atualizar</span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">Sem mudança</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Result screen */}
                {importResult && (
                  <div className="text-center py-8 space-y-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 border border-emerald-500/20 mx-auto">
                      <FileCheck2 size={28} className="text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Importação Concluída!</h3>
                    <div className="flex flex-wrap justify-center gap-4 max-w-md mx-auto pt-2">
                      <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 w-24">
                        <div className="text-2xl font-black text-emerald-400">{importResult.updated}</div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Atualizados</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-blue-500/5 border border-blue-500/10 w-24">
                        <div className="text-2xl font-black text-blue-400">{importResult.inserted || 0}</div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Criados</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-rose-500/5 border border-rose-500/10 w-24">
                        <div className="text-2xl font-black text-rose-400">{importResult.notFound}</div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Ignorados</div>
                      </div>
                      {importResult.errors > 0 && (
                        <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 w-24">
                          <div className="text-2xl font-black text-amber-400">{importResult.errors}</div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Erros</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-6 border-t border-slate-100 dark:border-slate-800 shrink-0">
                {importResult ? (
                  <button
                    onClick={handleCloseImport}
                    className="ml-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                ) : importPreview ? (
                  <>
                    <button
                      onClick={() => setImportPreview(null)}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                    >
                      ← Voltar
                    </button>
                    <button
                      onClick={handleApplyImport}
                      disabled={isSavingImport || (importPreview.filter(r => r.matched && r.willChange).length === 0 && importPreview.filter(r => r.willInsert).length === 0)}
                      className={cn(
                        'flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                        isSavingImport || (importPreview.filter(r => r.matched && r.willChange).length === 0 && importPreview.filter(r => r.willInsert).length === 0)
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                      )}
                    >
                      {isSavingImport ? <RefreshCw size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                      Aplicar Alterações ({importPreview.filter(r => (r.matched && r.willChange) || r.willInsert).length})
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleCloseImport}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleParseImport}
                      disabled={!importStatusText.trim() || isParsingImport}
                      className={cn(
                        'flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                        !importStatusText.trim() || isParsingImport
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                      )}
                    >
                      {isParsingImport ? <RefreshCw size={13} className="animate-spin" /> : <FileCheck2 size={13} />}
                      Analisar Tabela
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Add Manual Pallet Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddManualPallet && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddManualPallet(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              className="relative w-full max-w-lg rounded-[32px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-8 shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="relative mb-8 pb-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-2xl blur-2xl" />
                <div className="relative">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Criar Palete Manual</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Preencha os dados abaixo</p>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Reserva SAP (opcional — somente MB21)</label>
                  <input type="text" value={manualReserva} onChange={(e) => setManualReserva(e.target.value)} className="w-full h-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" placeholder="Ex: 100028945" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Remessa MIGO</label>
                    <input type="text" value={manualRemessa} onChange={(e) => setManualRemessa(e.target.value)} className="w-full h-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" placeholder="Ex: 83384647" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Doc. SAP</label>
                    <input type="text" value={manualDocumento} onChange={(e) => setManualDocumento(e.target.value)} className="w-full h-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" placeholder="Ex: 4916837702" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Tipo de Avaria</label>
                  <div className="flex flex-wrap gap-2">
                    {avariaTipos.map(t => ({ value: t.nome, cor_hex: t.cor_hex })).map((t) => {
                      const active = manualType === t.value
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setManualType(t.value)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border",
                            active
                              ? "text-white shadow-lg"
                              : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 border-transparent"
                          )}
                          style={active ? { backgroundColor: t.cor_hex, borderColor: t.cor_hex } : {}}
                        >
                          {t.value}
                        </button>
                      )
                    })}
                  </div>
                </div>


                {/* Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Itens</label>
                    <button onClick={() => setManualItems([...manualItems, { codigo: "", quantidade: 1 }])} className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><Plus size={12} /> Adicionar</button>
                  </div>
                  <div className="space-y-2">
                    {manualItems.map((item, idx) => (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={idx} className="flex gap-2">
                        <input value={item.codigo} onChange={(e) => { const newI = [...manualItems]; newI[idx].codigo = e.target.value; setManualItems(newI) }} className="flex-1 h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500" placeholder="Código..." />
                        <input type="text" inputMode="numeric" pattern="[0-9]*" value={item.quantidade} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); const newI = [...manualItems]; newI[idx].quantidade = v === '' ? 0 : parseInt(v); setManualItems(newI) }} className="w-20 h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs text-center text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <button onClick={() => setManualItems(manualItems.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-600 px-2"><Trash2 size={16} /></button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-5 mt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddManualPallet(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveManualPallet}
                  disabled={isSavingManual}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    isSavingManual
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  )}
                >
                  {isSavingManual ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                  Confirmar e Criar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
