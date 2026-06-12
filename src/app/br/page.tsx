"use client"

import React, { useState, useEffect } from "react"
import {
  Fan,
  Moon,
  Sun,
  User,
  Repeat2,
  X,
  Lock,
  RefreshCw,
  LogIn,
  CheckCircle2,
  BarChart3,
  AtSign,
  Package
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import FormacaoPaletesTab from "@/components/br/FormacaoPaletesTab"
import PaletesFormadosTab from "@/components/br/PaletesFormadosTab"
import DashboardTab from "@/components/br/DashboardTab"

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ")
}

// ─── Types ───────────────────────────────────────────────────────────────────
type TabId = "formacao_paletes" | "paletes_formados" | "dashboard"

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

export default function BRModulePage() {
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [activeTab, setActiveTab] = useState<TabId>("formacao_paletes")
  const [showModuleModal, setShowModuleModal] = useState(false)
  
  // Data State
  const [posicoesRaw, setPosicoesRaw] = useState<PosAvaria[]>([])
  const [loading, setLoading] = useState(true)
  const [controleRaw, setControleRaw] = useState<any[]>([])
  const [loadingControle, setLoadingControle] = useState(false)

  // Modals state
  const [showImportModal, setShowImportModal]   = useState(false)
  const [importText, setImportText]             = useState("")
  const [isImporting, setIsImporting]           = useState(false)
  const [replaceExisting, setReplaceExisting]   = useState(true)
  const [splitByGrade, setSplitByGrade]         = useState(false)
  const [gradeSize, setGradeSize]               = useState<number>(50)
  const [selectedPosGroup, setSelectedPosGroup] = useState<any>(null)

  // Formar Palete State
  const [modalPhase, setModalPhase]     = useState<"view" | "form_palete">("view")
  const [editableItems, setEditableItems] = useState<EditableItem[]>([])
  const [reservaNum, setReservaNum]     = useState("")
  const [remessaNum, setRemessaNum]     = useState("")
  const [documentoSM, setDocumentoSM]   = useState("")
  const [isSavingPalete, setIsSavingPalete] = useState(false)

  // Auth state
  const [session, setSession]           = useState<any>(null)
  const [user, setUser]                 = useState<any>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginEmail, setLoginEmail]     = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [isLoggingIn, setIsLoggingIn]   = useState(false)
  const [rememberMe, setRememberMe]     = useState(true)
  const [authLoading, setAuthLoading]   = useState(true)

  // Avoid hydration mismatch by waiting until client mount
  useEffect(() => {
    setMounted(true)
  }, [])

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
      alert("Nenhum dada válido encontrado.")
      return
    }

    const confirmMessage = replaceExisting
      ? `Confirmar importação de ${lines.length} itens? Isso substituirá todos os dados de avarias atuais.`
      : `Confirmar importação de ${lines.length} itens? Os novos registros serão adicionados aos já existentes.`
    if (!confirm(confirmMessage)) return

    setIsImporting(true)
    try {
      const dataToInsert: any[] = []
      
      for (const line of lines) {
        const cols = line.split('\t')
        const posicao = String(cols[0] || '').trim().toUpperCase()
        if (!posicao) continue

        const codigo = String(cols[1] || '').trim().toUpperCase()
        const descricao = String(cols[2] || '-').trim()
        
        const rawEstoque = String(cols[3] || '0').trim()
        const cleanEstoque = parseInt(rawEstoque.replace(/[^\d-]/g, ''), 10) || 0
        
        const rawQty = String(cols[4] || '0').trim()
        const cleanQty = parseInt(rawQty.replace(/[^\d-]/g, ''), 10) || 0

        if (splitByGrade && gradeSize > 0 && cleanQty > gradeSize) {
          const fullChunks = Math.floor(cleanQty / gradeSize)
          const remainder = cleanQty % gradeSize
          
          for (let k = 0; k < fullChunks; k++) {
            dataToInsert.push({
              posicao,
              codigo,
              descricao,
              estoque: cleanEstoque,
              quantidade: gradeSize
            })
          }
          if (remainder > 0) {
            dataToInsert.push({
              posicao,
              codigo,
              descricao,
              estoque: cleanEstoque,
              quantidade: remainder
            })
          }
        } else {
          dataToInsert.push({
            posicao,
            codigo,
            descricao,
            estoque: cleanEstoque,
            quantidade: cleanQty
          })
        }
      }

      if (dataToInsert.length === 0) {
        alert("Nenhum registro com posição preenchida encontrado.")
        return
      }

      if (replaceExisting) {
        const { error: delErr } = await supabase
          .from('pos_avarias')
          .delete()
          .neq('id', 0)
        if (delErr) throw delErr
      }

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
      
      setPosicoesRaw(prev => prev.filter(item => item.id !== id))
      
      if (selectedPosGroup) {
        setSelectedPosGroup((prev: any) => {
          const updatedItems = prev.items.filter((item: any) => item.id !== id)
          if (updatedItems.length === 0) {
            return null
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

      const { error: insErr } = await supabase
        .from('controle_avarias')
        .insert([payload])
      if (insErr) throw insErr

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

  // Print pallet record
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
<div class="hdr"><div class="pos"><span class="pos-pre">${row.posicao.slice(0,-2)}</span><span class="pos-suf">${row.posicao.slice(-2)}</span></div><div class="sub">Portal BR · G300 · Gestão de Avarias</div></div>
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

  const TABS = [
    { id: "formacao_paletes" as TabId, label: "Formação de Paletes", icon: Fan },
    { id: "paletes_formados" as TabId, label: "Paletes Formados", icon: CheckCircle2 },
    { id: "dashboard" as TabId, label: "Dashboard", icon: BarChart3 }
  ]

  // Render loading state until mounted to prevent hydration errors
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Carregando Portal...</span>
        </div>
      </div>
    )
  }

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
                "group relative flex h-12 w-full items-center rounded-xl transition-all duration-300 cursor-pointer",
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
            className="flex h-12 w-full items-center rounded-2xl text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors overflow-hidden group/btn border border-blue-200/60 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 cursor-pointer"
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
            className="flex h-12 w-full items-center rounded-2xl text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800 transition-colors overflow-hidden group/btn cursor-pointer"
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
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-all active:scale-95 cursor-pointer"
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

          {activeTab === "formacao_paletes" && (
            <FormacaoPaletesTab
              user={user}
              posicoesRaw={posicoesRaw}
              loading={loading}
              fetchPosAvarias={fetchPosAvarias}
              setShowLoginModal={setShowLoginModal}
              handleClearAllData={handleClearAllData}
              handleDeleteRow={handleDeleteRow}
              handleClearPosition={handleClearPosition}
              
              selectedPosGroup={selectedPosGroup}
              setSelectedPosGroup={setSelectedPosGroup}
              modalPhase={modalPhase}
              setModalPhase={setModalPhase}
              editableItems={editableItems}
              setEditableItems={setEditableItems}
              reservaNum={reservaNum}
              setReservaNum={setReservaNum}
              remessaNum={remessaNum}
              setRemessaNum={setRemessaNum}
              documentoSM={documentoSM}
              setDocumentoSM={setDocumentoSM}
              isSavingPalete={isSavingPalete}
              handleConfirmarFormarPalete={handleConfirmarFormarPalete}

              showImportModal={showImportModal}
              setShowImportModal={setShowImportModal}
              importText={importText}
              setImportText={setImportText}
              isImporting={isImporting}
              replaceExisting={replaceExisting}
              setReplaceExisting={setReplaceExisting}
              splitByGrade={splitByGrade}
              setSplitByGrade={setSplitByGrade}
              gradeSize={gradeSize}
              setGradeSize={setGradeSize}
              handleImportRelacao={handleImportRelacao}
            />
          )}

          {activeTab === "paletes_formados" && (
            <PaletesFormadosTab
              user={user}
              controleRaw={controleRaw}
              loadingControle={loadingControle}
              fetchControleAvarias={fetchControleAvarias}
              setShowLoginModal={setShowLoginModal}
              handleDeleteControle={handleDeleteControle}
              handlePrintControle={handlePrintControle}
              setControleRaw={setControleRaw}
              posicoesRaw={posicoesRaw}
            />
          )}

          {activeTab === "dashboard" && (
            <DashboardTab />
          )}

        </div>
      </main>

      {/* ─── Switch Module Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showModuleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            style={{ backdropFilter: 'blur(16px)', background: 'rgba(2,6,23,0.7)' }}
            onClick={() => setShowModuleModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
              style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid rgba(255,255,255,0.08)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-8 pt-8 pb-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mb-4">
                  <Repeat2 size={22} className="text-white/70" />
                </div>
                <h2 className="text-lg font-black text-white tracking-tight">Selecionar Módulo</h2>
                <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-widest">Avarias — Escolha o portal</p>
              </div>

              {/* Cards */}
              <div className="px-6 pb-8 grid grid-cols-2 gap-4">
                {/* AG Card — navigate */}
                <button
                  onClick={() => { setShowModuleModal(false); window.location.href = '/'; }}
                  className="relative rounded-2xl p-5 flex flex-col items-center gap-3 border-2 border-transparent hover:border-blue-500/60 bg-white/5 hover:bg-blue-500/10 transition-all duration-200 group cursor-pointer"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-blue-600 group-hover:bg-blue-500 shadow-xl shadow-blue-500/35 transition-colors">
                    <Package size={28} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-white leading-tight">Portal <span className="text-blue-400">AG</span></p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em] mt-0.5">G300 PAINEL<br/>OPERACIONAL</p>
                  </div>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-black text-blue-450 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">Acessar →</span>
                </button>

                {/* BR Card — active */}
                <div
                  className="relative rounded-2xl p-5 cursor-default flex flex-col items-center gap-3 border-2 border-emerald-500/60 bg-emerald-500/10"
                >
                  <div className="absolute top-3 right-3">
                    <span className="text-[9px] font-black text-emerald-450 bg-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Ativo</span>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-emerald-600 shadow-xl shadow-emerald-500/40">
                    <Fan size={28} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-white leading-tight">Portal <span className="text-emerald-400">BR</span></p>
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
          </motion.div>
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
                    className="h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">E-mail corporativo</label>
                    <div className="relative">
                      <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="email"
                        required
                        placeholder="usuario@dominio.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full h-12 pl-11 pr-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Senha de acesso</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 ml-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-opacity-25"
                      />
                      <span className="text-xs font-semibold text-slate-500">Lembrar meu usuário</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className={cn(
                      "w-full h-12 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer",
                      isLoggingIn
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-wait"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-500/25 active:scale-[0.98]"
                    )}
                  >
                    {isLoggingIn ? (
                      <RefreshCw className="animate-spin" size={14} />
                    ) : (
                      <>
                        <LogIn size={14} />
                        Entrar no Portal
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
