"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  Plus, Search, X, ChevronDown, ChevronRight,
  Calendar, Package, CheckCircle2, Clock,
  PlayCircle, Upload, Printer, Trash2, RefreshCw,
  AlertTriangle, Save, FileSpreadsheet, Layers,
  BarChart3, ArrowRight, PauseCircle, Hammer
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import * as XLSX from 'xlsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Programacao {
  id: number
  data: string
  descricao: string | null
  created_at: string
}

interface ProgramacaoItem {
  id: number
  programacao_id: number
  produto: string
  embalagens: number
  status: string
  confirmado_em: string | null
  created_at: string
}

interface Reserva {
  id: number
  programacao_item_id: number
  numero_reserva: string
  data_necessidade: string | null
  deposito: string | null
  deposito_receptor: string | null
  qtd_necessaria: number
  quantidade_diferenca: number
  created_at: string
}

interface BaseCodigo {
  "Código": string
  "Descrição": string
  "Grade"?: string | number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcPaletes = (embalagens: number, grade: number) => {
  if (!grade || grade <= 0) return { paletes: 0, sobra: embalagens }
  const paletes = Math.floor(embalagens / grade)
  const sobra = embalagens - paletes * grade
  return { paletes, sobra }
}

const getProgramacaoStatus = (itens: ProgramacaoItem[]) => {
  if (itens.length === 0) return 'Aguardando'
  if (itens.every(i => i.status === 'Concluído')) return 'Concluído'
  if (itens.some(i => i.status === 'Em andamento' || i.status === 'Pausado')) return 'Em andamento'
  return 'Aguardando'
}

const STATUS_STYLE: Record<string, string> = {
  'Concluído':     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'Em andamento':  'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'Pausado':       'text-amber-400 bg-amber-500/10 border-amber-500/20',
  'Aguardando':    'text-slate-400 bg-slate-500/10 border-slate-500/20',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  'Concluído':    <CheckCircle2 size={11} />,
  'Em andamento': <PlayCircle size={11} />,
  'Pausado':      <PauseCircle size={11} />,
  'Aguardando':   <Clock size={11} />,
}

const fmtDate = (d: string | null) => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const fmtNum = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR')

const normCol = (s: string) =>
  s.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°]/g, 'o').replace(/[\s._-]+/g, '')

// ─── Component ────────────────────────────────────────────────────────────────

export default function RetrabalhosTab({ refreshTrigger }: { refreshTrigger?: boolean } = {}) {

  // ── State ──────────────────────────────────────────────────────────────────
  const [programacoes, setProgramacoes] = useState<Programacao[]>([])
  const [itens, setItens] = useState<ProgramacaoItem[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [baseCodigos, setBaseCodigos] = useState<BaseCodigo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [expandedProg, setExpandedProg] = useState<Set<number>>(new Set())
  const [expandedItem, setExpandedItem] = useState<Set<number>>(new Set())

  // Modais
  const [isNewProgOpen, setIsNewProgOpen] = useState(false)
  const [isNewItemOpen, setIsNewItemOpen] = useState(false)
  const [selectedProgForItem, setSelectedProgForItem] = useState<Programacao | null>(null)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importTarget, setImportTarget] = useState<{ item: ProgramacaoItem; prog: Programacao } | null>(null)
  const [isConsolidarOpen, setIsConsolidarOpen] = useState(false)
  const [consolidarTarget, setConsolidarTarget] = useState<ProgramacaoItem | null>(null)

  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [consolidating, setConsolidating] = useState(false)

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4500)
  }

  const importFileRef = useRef<HTMLInputElement>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAllPages = async (table: string, cols = '*') => {
    let all: any[] = [], from = 0
    while (true) {
      const { data, error } = await supabase.from(table).select(cols).range(from, from + 999)
      if (error) { console.error(`[Retrabalho] Erro ${table}:`, error); break }
      if (!data || data.length === 0) break
      all = [...all, ...data]; from += 1000
      if (data.length < 1000) break
    }
    return all
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [progData, itensData, reservasData, baseData] = await Promise.all([
        fetchAllPages('programacoes'),
        fetchAllPages('programacao_itens'),
        fetchAllPages('reservas_programacao'),
        fetchAllPages('base_codigos'),
      ])
      setProgramacoes(progData)
      setItens(itensData)
      setReservas(reservasData)
      setBaseCodigos(baseData)
    } catch (err) {
      console.error("Erro fetchData retrabalho:", err)
    } finally {
      setTimeout(() => setLoading(false), 300)
    }
  }

  useEffect(() => { fetchData() }, [])
  useEffect(() => { if (refreshTrigger) fetchData() }, [refreshTrigger])

  // ── Computed maps ──────────────────────────────────────────────────────────
  const baseMap = useMemo(() => {
    const m = new Map<string, BaseCodigo>()
    baseCodigos.forEach(b => m.set(String(b["Código"]).trim().toUpperCase(), b))
    return m
  }, [baseCodigos])

  const reservasByItem = useMemo(() => {
    const m = new Map<number, Reserva[]>()
    reservas.forEach(r => {
      if (!m.has(r.programacao_item_id)) m.set(r.programacao_item_id, [])
      m.get(r.programacao_item_id)!.push(r)
    })
    return m
  }, [reservas])

  const itensByProg = useMemo(() => {
    const m = new Map<number, ProgramacaoItem[]>()
    itens.forEach(item => {
      if (!m.has(item.programacao_id)) m.set(item.programacao_id, [])
      m.get(item.programacao_id)!.push(item)
    })
    return m
  }, [itens])

  const filteredProgramacoes = useMemo(() => {
    const low = search.toLowerCase()
    return [...programacoes]
      .filter(p => {
        if (!low) return true
        if (fmtDate(p.data).includes(low)) return true
        if ((p.descricao || '').toLowerCase().includes(low)) return true
        const its = itensByProg.get(p.id) || []
        return its.some(i => i.produto.toLowerCase().includes(low))
      })
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [programacoes, itensByProg, search])

  // ── Item stats helpers ─────────────────────────────────────────────────────
  const getItemStats = (item: ProgramacaoItem) => {
    const rs = reservasByItem.get(item.id) || []
    const abertas = rs.filter(r => r.quantidade_diferenca > 0)
    const confirmadas = rs.filter(r => r.quantidade_diferenca === 0)
    const qtdAberta = abertas.reduce((s, r) => s + (r.qtd_necessaria || 0), 0)
    const qtdConfirmada = confirmadas.reduce((s, r) => s + (r.qtd_necessaria || 0), 0)
    const qtdRetrabalhada = rs.reduce((s, r) => s + (r.qtd_necessaria || 0), 0)
    const base = baseMap.get(item.produto.toUpperCase())
    const grade = base?.["Grade"] ? Number(base["Grade"]) : 0
    const { paletes, sobra } = calcPaletes(item.embalagens, grade)
    return { rs, abertas, confirmadas, qtdAberta, qtdConfirmada, qtdRetrabalhada, grade, paletes, sobra, base }
  }

  // ── Create Programação ─────────────────────────────────────────────────────
  const handleCreateProgramacao = async (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const data = fd.get('data') as string
    const descricao = (fd.get('descricao') as string || '').trim() || null
    if (!data) return
    setSaving(true)
    const { data: created, error } = await supabase.from('programacoes').insert([{ data, descricao }]).select().single()
    setSaving(false)
    if (error) { showToast('Erro: ' + error.message, 'error'); return }
    await fetchData()
    setIsNewProgOpen(false)
    // Auto-expand new programação
    if (created) setExpandedProg(prev => new Set([...prev, created.id]))
    showToast('Programação criada!')
  }

  // ── Create Item ────────────────────────────────────────────────────────────
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProgForItem) return
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const produto = (fd.get('produto') as string || '').trim().toUpperCase()
    const embalagens = Number(fd.get('embalagens') || 0)
    if (!produto || embalagens <= 0) { showToast('Produto e Embalagens são obrigatórios', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('programacao_itens').insert([{
      programacao_id: selectedProgForItem.id,
      produto,
      embalagens,
      status: 'Em andamento'
    }])
    setSaving(false)
    if (error) { showToast('Erro: ' + error.message, 'error'); return }
    await fetchData()
    setIsNewItemOpen(false)
    setSelectedProgForItem(null)
    showToast('Item adicionado!')
  }

  // ── Import Planilha ────────────────────────────────────────────────────────
  const handleImportFile = async (file: File) => {
    if (!importTarget) return
    const { item, prog } = importTarget

    // Item already concluded → skip
    if (item.status === 'Concluído') {
      showToast('Este item já está Concluído — importação bloqueada.', 'error')
      return
    }

    setImporting(true)
    try {
      const ab = await file.arrayBuffer()
      const wb = XLSX.read(ab)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<any>(ws, { raw: false, defval: '' })
      if (rows.length === 0) { showToast('Planilha vazia!', 'error'); return }

      const headers = Object.keys(rows[0] || {})
      const findCol = (aliases: string[]) => {
        for (const a of aliases) {
          const m = headers.find(h => normCol(h) === normCol(a)); if (m) return m
        }
        for (const a of aliases) {
          const m = headers.find(h => normCol(h).includes(normCol(a))); if (m) return m
        }
        return null
      }

      const cNrReserva  = findCol(['Nº reserva', 'No reserva', 'numero reserva', 'nreserva'])
      const cDataNec    = findCol(['Data da necessidade', 'Data necessidade', 'datanecessidade'])
      const cDeposito   = findCol(['Depósito', 'Deposito'])
      const cDepRec     = findCol(['Depósito receptor', 'Deposito receptor', 'depositoreceptor'])
      const cMaterial   = findCol(['Material'])
      const cQtdNec     = findCol(['Qtd.necessária', 'Qtd necessaria', 'Quantidade necessaria', 'qtdnecessaria'])
      const cQtdDif     = findCol(['Quantidade diferença', 'Quantidade diferenca', 'qtddiferenca'])

      if (!cNrReserva || !cMaterial) {
        showToast('Colunas obrigatórias não encontradas: "Nº reserva" e "Material"', 'error')
        return
      }

      const progDate = new Date(prog.data + 'T00:00:00')
      const existing = reservasByItem.get(item.id) || []
      const existingMap = new Map(existing.map(r => [r.numero_reserva, r]))

      let inserted = 0, updated = 0, skipped = 0

      for (const row of rows) {
        const material = String(row[cMaterial] || '').trim().toUpperCase()
        if (material !== item.produto.toUpperCase()) { skipped++; continue }

        const dep = cDeposito ? String(row[cDeposito] || '').trim().toUpperCase() : ''
        const depRec = cDepRec ? String(row[cDepRec] || '').trim().toUpperCase() : ''
        if (!['A501', 'G501'].includes(dep)) { skipped++; continue }
        if (!['A560', 'G560'].includes(depRec)) { skipped++; continue }

        // Date filter
        if (cDataNec) {
          const rawDate = String(row[cDataNec] || '').trim()
          if (rawDate) {
            let dateNec: Date
            if (rawDate.includes('/')) {
              const parts = rawDate.split('/')
              // Could be DD/MM/YYYY or MM/DD/YYYY — assume DD/MM/YYYY (Brazilian)
              dateNec = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}T00:00:00`)
            } else {
              dateNec = new Date(rawDate + 'T00:00:00')
            }
            if (!isNaN(dateNec.getTime()) && dateNec < progDate) { skipped++; continue }
          }
        }

        const nrReserva = String(row[cNrReserva] || '').trim()
        if (!nrReserva) { skipped++; continue }

        const qtdNec = cQtdNec ? parseFloat(String(row[cQtdNec] || '0').replace(',', '.')) || 0 : 0
        const qtdDif = cQtdDif ? parseFloat(String(row[cQtdDif] || '0').replace(',', '.')) || 0 : 0

        // Parse data_necessidade
        let dataNecessidade: string | null = null
        if (cDataNec) {
          const rawDate = String(row[cDataNec] || '').trim()
          if (rawDate) {
            if (rawDate.includes('/')) {
              const parts = rawDate.split('/')
              dataNecessidade = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
            } else {
              dataNecessidade = rawDate
            }
          }
        }

        const payload = {
          programacao_item_id: item.id,
          numero_reserva: nrReserva,
          data_necessidade: dataNecessidade,
          deposito: dep,
          deposito_receptor: depRec,
          qtd_necessaria: qtdNec,
          quantidade_diferenca: qtdDif,
        }

        if (existingMap.has(nrReserva)) {
          const ex = existingMap.get(nrReserva)!
          await supabase.from('reservas_programacao')
            .update({ qtd_necessaria: qtdNec, quantidade_diferenca: qtdDif })
            .eq('id', ex.id)
          updated++
        } else {
          const { error } = await supabase.from('reservas_programacao').insert([payload])
          if (!error) inserted++
        }
      }

      await fetchData()
      setIsImportOpen(false)
      setImportTarget(null)
      showToast(`Importação concluída! ${inserted} novas, ${updated} atualizadas, ${skipped} ignoradas.`)
    } catch (err: any) {
      showToast('Erro ao importar: ' + err.message, 'error')
    } finally {
      setImporting(false)
    }
  }

  // ── Toggle Item Status ─────────────────────────────────────────────────────
  const handleToggleItemStatus = async (item: ProgramacaoItem, newStatus: string) => {
    await supabase.from('programacao_itens').update({ status: newStatus }).eq('id', item.id)
    await fetchData()
  }

  // ── Consolidar ─────────────────────────────────────────────────────────────
  const handleConsolidar = async () => {
    const item = consolidarTarget
    if (!item) return
    setConsolidating(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      let remaining = item.embalagens

      // Abate do mapeamento (posição Retrabalho)
      const { data: pallets, error: stockErr } = await supabase
        .from('mapeamento').select('id, Quantidade')
        .eq('Posição', 'Retrabalho').eq('Código', item.produto)
        .order('id', { ascending: true })
      if (stockErr) throw stockErr

      const totalStock = (pallets || []).reduce((s: number, p: any) => s + (p.Quantidade || 0), 0)
      if (totalStock < item.embalagens) {
        showToast(`Estoque insuficiente em Retrabalho: disponível ${totalStock}, necessário ${item.embalagens}`, 'error')
        return
      }

      for (const pallet of (pallets || [])) {
        if (remaining <= 0) break
        const qty = pallet.Quantidade || 0
        if (qty <= remaining) {
          await supabase.from('mapeamento').delete().eq('id', pallet.id)
          remaining -= qty
        } else {
          await supabase.from('mapeamento').update({ Quantidade: qty - remaining }).eq('id', pallet.id)
          remaining = 0
        }
      }

      // Registro em Monitoramento
      await supabase.from('Registros').insert([{
        Data: today,
        Produto: item.produto,
        'Saída': item.embalagens,
        Entrada: null,
        Origem: 'Retrabalho',
        tipo_avaria: 'Sem Avaria',
        turno: 1,
        Observação: `Consolidação de programação de retrabalho`,
      }])

      // Marcar como Concluído
      await supabase.from('programacao_itens').update({
        status: 'Concluído',
        confirmado_em: new Date().toISOString()
      }).eq('id', item.id)

      await fetchData()
      setIsConsolidarOpen(false)
      setConsolidarTarget(null)
      showToast(`${item.produto} consolidado com sucesso!`)
    } catch (err: any) {
      showToast('Erro ao consolidar: ' + err.message, 'error')
    } finally {
      setConsolidating(false)
    }
  }

  // ── Print Reservas ─────────────────────────────────────────────────────────
  const handlePrintReservas = (item: ProgramacaoItem, prog: Programacao) => {
    const rs = reservasByItem.get(item.id) || []
    if (rs.length === 0) { showToast('Sem reservas para imprimir', 'error'); return }

    const printWin = window.open('', '_blank')
    if (!printWin) return

    const qrUrl = (text: string) =>
      `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}`

    const cards = rs.map(r => {
      const confirmada = r.quantidade_diferenca === 0
      return `
        <div style="border:2px solid #000;width:480px;padding:18px;border-radius:10px;background:#fff;margin-bottom:18px;page-break-inside:avoid;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px;">
            <h2 style="margin:0;font-size:18px;font-weight:900;">${r.deposito || '—'} → ${r.deposito_receptor || '—'}</h2>
            <span style="font-size:11px;padding:3px 8px;border-radius:5px;background:${confirmada ? '#dcfce7' : '#fef9c3'};color:${confirmada ? '#166534' : '#854d0e'};font-weight:700;">
              ${confirmada ? '✓ CONFIRMADA' : '⏳ ABERTA'}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:18px;">
            <img src="${qrUrl(r.numero_reserva)}" style="width:140px;height:140px;flex-shrink:0;"/>
            <div style="flex:1;">
              <div style="font-size:26px;font-weight:900;font-family:monospace;margin-bottom:6px;">${r.numero_reserva}</div>
              <div style="font-size:13px;margin-bottom:3px;"><strong>PRODUTO:</strong> ${item.produto}</div>
              <div style="font-size:11px;color:#555;margin-bottom:3px;">${baseMap.get(item.produto.toUpperCase())?.["\u0044escri\u00e7\u00e3o"] || ''}</div>
              <div style="font-size:13px;margin-bottom:3px;"><strong>QTD:</strong> ${fmtNum(r.qtd_necessaria)} un.</div>
              ${r.data_necessidade ? `<div style="font-size:12px;color:#777;"><strong>DATA:</strong> ${fmtDate(r.data_necessidade)}</div>` : ''}
              <div style="font-size:11px;color:#999;margin-top:4px;"><strong>PROG:</strong> ${fmtDate(prog.data)}</div>
            </div>
          </div>
        </div>
      `
    }).join('')

    printWin.document.write(`
      <html><head><title>Reservas ${item.produto} — ${fmtDate(prog.data)}</title>
      <style>
        @page{size:A4;margin:12mm}
        body{margin:0;font-family:-apple-system,sans-serif}
        @media print{.no-print{display:none}}
      </style></head>
      <body onload="setTimeout(()=>{window.print();window.close()},600)">
        <div style="text-align:center;margin-bottom:20px;border-bottom:3px solid #000;padding-bottom:10px;">
          <h1 style="margin:0;font-size:22px;font-weight:900;">PROGRAMAÇÃO ${fmtDate(prog.data)} — ${item.produto}</h1>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">${item.embalagens} embalagens &nbsp;|&nbsp; ${rs.length} reservas &nbsp;|&nbsp; ${rs.filter(r=>r.quantidade_diferenca===0).length} confirmadas</p>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;">${cards}</div>
      </body></html>
    `)
    printWin.document.close()
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteItem = async (id: number) => {
    if (!confirm('Excluir este item e todas as suas reservas?')) return
    await supabase.from('programacao_itens').delete().eq('id', id)
    await fetchData()
    showToast('Item excluído')
  }

  const handleDeleteReserva = async (id: number) => {
    if (!confirm('Excluir esta reserva?')) return
    await supabase.from('reservas_programacao').delete().eq('id', id)
    await fetchData()
  }

  const handleDeleteProg = async (id: number) => {
    if (!confirm('Excluir esta programação e todos os seus itens e reservas?')) return
    await supabase.from('programacoes').delete().eq('id', id)
    await fetchData()
    showToast('Programação excluída')
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 relative">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-4 right-4 z-[9999] px-5 py-3 rounded-2xl text-sm font-semibold shadow-2xl flex items-center gap-2",
              toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar programação, produto..."
              className="pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64"
            />
          </div>
          <button onClick={fetchData} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
        <button
          onClick={() => setIsNewProgOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus size={14} /> Nova Programação
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <RefreshCw size={24} className="animate-spin" />
            <span className="text-xs font-medium">Carregando programações...</span>
          </div>
        </div>
      ) : filteredProgramacoes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <Hammer size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhuma programação encontrada</p>
            <p className="text-xs mt-1">Crie uma nova programação para começar</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pb-8">
          {filteredProgramacoes.map(prog => {
            const progItens = (itensByProg.get(prog.id) || []).sort((a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
            const progStatus = getProgramacaoStatus(progItens)
            const isExpanded = expandedProg.has(prog.id)

            return (
              <div key={prog.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">

                {/* Programação Header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  onClick={() => setExpandedProg(prev => {
                    const s = new Set(prev)
                    s.has(prog.id) ? s.delete(prog.id) : s.add(prog.id)
                    return s
                  })}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider", STATUS_STYLE[progStatus] || STATUS_STYLE['Aguardando'])}>
                      {STATUS_ICON[progStatus]}
                      {progStatus}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar size={13} className="text-slate-400" />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Programação {fmtDate(prog.data)}
                        </span>
                      </div>
                      {prog.descricao && (
                        <p className="text-xs text-slate-400 mt-0.5 ml-5">{prog.descricao}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      {progItens.length} produto{progItens.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setSelectedProgForItem(prog)
                        setIsNewItemOpen(true)
                      }}
                      className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                      title="Adicionar produto"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteProg(prog.id) }}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Excluir programação"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronDown size={16} className={cn("text-slate-400 transition-transform", isExpanded && "rotate-180")} />
                  </div>
                </div>

                {/* Programação Items */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {progItens.length === 0 ? (
                        <div className="px-5 py-8 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
                          Nenhum produto nesta programação.{' '}
                          <button onClick={() => { setSelectedProgForItem(prog); setIsNewItemOpen(true) }} className="text-blue-500 hover:underline">Adicionar</button>
                        </div>
                      ) : (
                        <div className="border-t border-slate-100 dark:border-slate-800">
                          {/* Items Table Header */}
                          <div className="grid grid-cols-[2fr_1fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-2 px-5 py-2 bg-slate-50/80 dark:bg-slate-800/50 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                            <span>Produto</span>
                            <span>Embalagens</span>
                            <span>Paletes Previstos</span>
                            <span>Reservas Abertas</span>
                            <span>Confirmadas</span>
                            <span>Retrabalhado</span>
                            <span>Status</span>
                            <span>Ações</span>
                          </div>

                          {progItens.map(item => {
                            const { rs, qtdAberta, qtdConfirmada, qtdRetrabalhada, grade, paletes, sobra, base, abertas, confirmadas } = getItemStats(item)
                            const isItemExpanded = expandedItem.has(item.id)
                            const isConcluido = item.status === 'Concluído'

                            return (
                              <div key={item.id} className={cn("border-b border-slate-100 dark:border-slate-800 last:border-0", isConcluido && "opacity-70")}>
                                {/* Item Row */}
                                <div
                                  className="grid grid-cols-[2fr_1fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-2 px-5 py-3.5 items-center hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                                  onClick={() => setExpandedItem(prev => {
                                    const s = new Set(prev); s.has(item.id) ? s.delete(item.id) : s.add(item.id); return s
                                  })}
                                >
                                  {/* Produto */}
                                  <div className="flex items-center gap-2">
                                    <ChevronRight size={12} className={cn("text-slate-400 transition-transform flex-shrink-0", isItemExpanded && "rotate-90")} />
                                    <div>
                                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.produto}</p>
                                      {base && <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{base["Descrição"]}</p>}
                                    </div>
                                  </div>

                                  {/* Embalagens */}
                                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                    {fmtNum(item.embalagens)}
                                  </span>

                                  {/* Paletes Previstos */}
                                  <div className="text-xs text-slate-500">
                                    {grade > 0 ? (
                                      <span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{paletes}</span> pal.
                                        {sobra > 0 && <span className="text-slate-400"> + {sobra} un.</span>}
                                        <span className="text-[9px] text-slate-400 ml-1">(grade {grade})</span>
                                      </span>
                                    ) : <span className="text-slate-400">Grade n/a</span>}
                                  </div>

                                  {/* Reservas Abertas */}
                                  <div className="text-xs">
                                    <span className={cn("font-bold", qtdAberta > 0 ? "text-amber-500" : "text-slate-400")}>
                                      {fmtNum(qtdAberta)}
                                    </span>
                                    {abertas.length > 0 && <span className="text-[9px] text-slate-400 ml-1">({abertas.length})</span>}
                                  </div>

                                  {/* Confirmadas */}
                                  <div className="text-xs">
                                    <span className={cn("font-bold", confirmadas.length > 0 ? "text-emerald-500" : "text-slate-400")}>
                                      {fmtNum(qtdConfirmada)}
                                    </span>
                                    {confirmadas.length > 0 && <span className="text-[9px] text-slate-400 ml-1">({confirmadas.length})</span>}
                                  </div>

                                  {/* Retrabalhado */}
                                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    {fmtNum(qtdRetrabalhada)}
                                  </span>

                                  {/* Status */}
                                  <div>
                                    <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider", STATUS_STYLE[item.status] || STATUS_STYLE['Aguardando'])}>
                                      {STATUS_ICON[item.status]}
                                      {item.status}
                                    </span>
                                  </div>

                                  {/* Ações */}
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    {!isConcluido && (
                                      <button
                                        onClick={() => { setImportTarget({ item, prog }); setIsImportOpen(true) }}
                                        className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                                        title="Importar planilha"
                                      >
                                        <Upload size={13} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handlePrintReservas(item, prog)}
                                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                      title="Imprimir reservas"
                                    >
                                      <Printer size={13} />
                                    </button>
                                    {!isConcluido && (
                                      <button
                                        onClick={() => { setConsolidarTarget(item); setIsConsolidarOpen(true) }}
                                        className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                        title="Consolidar (concluir)"
                                      >
                                        <CheckCircle2 size={13} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                                      title="Excluir item"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>

                                {/* Reservas expandidas */}
                                <AnimatePresence>
                                  {isItemExpanded && rs.length > 0 && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.15 }}
                                      className="bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800"
                                    >
                                      <div className="px-8 py-3">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Reservas ({rs.length})</p>
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="text-[9px] text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                                <th className="pb-2 text-left font-semibold">Nº Reserva</th>
                                                <th className="pb-2 text-left font-semibold">Depósito</th>
                                                <th className="pb-2 text-left font-semibold">Recept.</th>
                                                <th className="pb-2 text-right font-semibold">Qtd Nec.</th>
                                                <th className="pb-2 text-right font-semibold">Qtd Dif.</th>
                                                <th className="pb-2 text-left font-semibold">Status</th>
                                                <th className="pb-2 text-left font-semibold">Data Nec.</th>
                                                <th className="pb-2"></th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                              {[...rs].sort((a, b) => (a.numero_reserva > b.numero_reserva ? 1 : -1)).map(r => {
                                                const confirmada = r.quantidade_diferenca === 0
                                                return (
                                                  <tr key={r.id} className="hover:bg-white dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="py-2 font-mono font-bold text-slate-700 dark:text-slate-300">{r.numero_reserva}</td>
                                                    <td className="py-2 text-slate-500">{r.deposito || '—'}</td>
                                                    <td className="py-2 text-slate-500">{r.deposito_receptor || '—'}</td>
                                                    <td className="py-2 text-right text-slate-700 dark:text-slate-300 tabular-nums">{fmtNum(r.qtd_necessaria)}</td>
                                                    <td className="py-2 text-right tabular-nums">
                                                      <span className={r.quantidade_diferenca > 0 ? "text-amber-500 font-semibold" : "text-slate-400"}>
                                                        {fmtNum(r.quantidade_diferenca)}
                                                      </span>
                                                    </td>
                                                    <td className="py-2">
                                                      <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase",
                                                        confirmada ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" : "text-amber-500 bg-amber-500/10 border-amber-500/20"
                                                      )}>
                                                        {confirmada ? <CheckCircle2 size={9} /> : <Clock size={9} />}
                                                        {confirmada ? 'Confirmada' : 'Aberta'}
                                                      </span>
                                                    </td>
                                                    <td className="py-2 text-slate-400 text-[10px]">{fmtDate(r.data_necessidade)}</td>
                                                    <td className="py-2">
                                                      <button onClick={() => handleDeleteReserva(r.id)} className="p-1 text-slate-300 hover:text-rose-500 rounded transition-colors">
                                                        <X size={11} />
                                                      </button>
                                                    </td>
                                                  </tr>
                                                )
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                  {isItemExpanded && rs.length === 0 && (
                                    <motion.div
                                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                      className="px-8 py-4 text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800"
                                    >
                                      Nenhuma reserva importada. Use o botão{' '}
                                      <button
                                        onClick={() => { setImportTarget({ item, prog }); setIsImportOpen(true) }}
                                        className="text-blue-500 hover:underline inline-flex items-center gap-1"
                                      >
                                        <Upload size={10} /> Importar planilha
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Modal: Nova Programação ─── */}
      <AnimatePresence>
        {isNewProgOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsNewProgOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-3xl" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Calendar size={18} className="text-blue-500" /> Nova Programação
              </h2>
              <form onSubmit={handleCreateProgramacao} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Data da Programação *</label>
                  <input name="data" type="date" required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Descrição (opcional)</label>
                  <input name="descricao" type="text" placeholder="Ex: Retrabalho linha 3"
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsNewProgOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white text-xs font-semibold transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-[2] px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50">
                    {saving ? 'Criando...' : 'Criar Programação'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Modal: Novo Item ─── */}
      <AnimatePresence>
        {isNewItemOpen && selectedProgForItem && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setIsNewItemOpen(false); setSelectedProgForItem(null) }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-t-3xl" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <Package size={18} className="text-emerald-500" /> Adicionar Produto
              </h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-6">
                Programação {fmtDate(selectedProgForItem.data)}
              </p>
              <form onSubmit={handleCreateItem} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Código do Produto *</label>
                  <input name="produto" type="text" required placeholder="Ex: 5618-04"
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500/50 uppercase" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Quantidade de Embalagens *</label>
                  <input name="embalagens" type="number" required placeholder="Ex: 800" min={1}
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setIsNewItemOpen(false); setSelectedProgForItem(null) }}
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white text-xs font-semibold transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-[2] px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50">
                    {saving ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Modal: Importar Planilha ─── */}
      <AnimatePresence>
        {isImportOpen && importTarget && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { if (!importing) { setIsImportOpen(false); setImportTarget(null) } }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 to-purple-600 rounded-t-3xl" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-violet-500" /> Importar Planilha de Reservas
              </h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-4">
                {importTarget.item.produto} — Prog. {fmtDate(importTarget.prog.data)}
              </p>

              {/* Rules */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-5 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Filtros aplicados automaticamente:</p>
                <p>• <strong>Material</strong> = {importTarget.item.produto}</p>
                <p>• <strong>Depósito</strong> ∈ A501, G501</p>
                <p>• <strong>Depósito receptor</strong> ∈ A560, G560</p>
                <p>• <strong>Data necessidade</strong> ≥ {fmtDate(importTarget.prog.data)}</p>
              </div>

              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleImportFile(file)
                  e.target.value = ''
                }}
              />
              <button
                onClick={() => importFileRef.current?.click()}
                disabled={importing}
                className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center gap-2 text-slate-500 hover:border-violet-500/50 hover:text-violet-500 hover:bg-violet-500/5 transition-all disabled:opacity-50 cursor-pointer"
              >
                {importing ? (
                  <>
                    <RefreshCw size={24} className="animate-spin text-violet-500" />
                    <span className="text-sm font-semibold">Importando...</span>
                  </>
                ) : (
                  <>
                    <Upload size={24} />
                    <span className="text-sm font-semibold">Clique para selecionar arquivo</span>
                    <span className="text-xs">.xlsx, .xls, .csv</span>
                  </>
                )}
              </button>

              <button
                onClick={() => { setIsImportOpen(false); setImportTarget(null) }}
                disabled={importing}
                className="w-full mt-3 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Modal: Consolidar ─── */}
      <AnimatePresence>
        {isConsolidarOpen && consolidarTarget && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { if (!consolidating) { setIsConsolidarOpen(false); setConsolidarTarget(null) } }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-green-600 rounded-t-3xl" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" /> Consolidar Retrabalho
              </h2>
              <p className="text-xs text-slate-500 mb-5">Esta ação é irreversível. Confirme os dados abaixo:</p>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Produto</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{consolidarTarget.produto}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Quantidade</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{fmtNum(consolidarTarget.embalagens)} un.</span>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2 space-y-1 text-xs text-slate-500">
                  <p>✓ Abater {fmtNum(consolidarTarget.embalagens)} un. da posição <strong>Retrabalho</strong> no Mapeamento</p>
                  <p>✓ Criar registro de saída em <strong>Monitoramento</strong></p>
                  <p>✓ Marcar item como <strong>Concluído</strong></p>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setIsConsolidarOpen(false); setConsolidarTarget(null) }} disabled={consolidating}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white text-xs font-semibold transition-all disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={handleConsolidar} disabled={consolidating}
                  className="flex-[2] px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {consolidating ? <><RefreshCw size={13} className="animate-spin" /> Consolidando...</> : <><CheckCircle2 size={13} /> Confirmar Consolidação</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
