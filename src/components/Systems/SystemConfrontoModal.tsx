// ============================================================
// NEXUS ERP — Systems / SystemConfrontoModal.tsx
// Modal de Confronto Analítico Configurável com Relação em Tabela JSON
// Permite nomear o confronto (ex: "A501", "G501"), importar relação
// e confrontar o saldo físico do sistema em tempo real.
// ============================================================

"use client"

import React, { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  GitCompare,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Trash2,
  Plus,
  Search,
  Filter,
  Download,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RefreshCw,
} from "lucide-react"
import { systemDataService } from "./systemDataService"
import { supabase } from "@/lib/supabase"
import type {
  BusinessSystem,
  SystemConfrontoConfig,
  SystemStockRecord,
  ConfrontoComparisonRow,
  ConfrontoSummary,
} from "./types"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface SystemConfrontoModalProps {
  isOpen: boolean
  onClose: () => void
  system: BusinessSystem
}

type FilterMode = "all" | "divergent" | "match" | "missing" | "excess"

export default function SystemConfrontoModal({
  isOpen,
  onClose,
  system,
}: SystemConfrontoModalProps) {
  const [confrontos, setConfrontos] = useState<SystemConfrontoConfig[]>([])
  const [activeConfrontoId, setActiveConfrontoId] = useState<string | null>(null)

  // Estado do formulário de importação de relação
  const [isImporting, setIsImporting] = useState(false)
  const [confrontoName, setConfrontoName] = useState("A501")
  const [confrontoDescription, setConfrontoDescription] = useState("")
  const [importText, setImportText] = useState("")
  const [importError, setImportError] = useState("")

  // Filtros e busca da tabela de confronto
  const [filterMode, setFilterMode] = useState<FilterMode>("all")
  const [search, setSearch] = useState("")

  const [systemRecords, setSystemRecords] = useState<SystemStockRecord[]>([])

  // Carrega confrontos e registros isolados do sistema
  const load = () => {
    const list = systemDataService.getConfrontosBySystem(system.id)
    setConfrontos(list)
    if (list.length > 0 && (!activeConfrontoId || !list.find((c) => c.id === activeConfrontoId))) {
      setActiveConfrontoId(list[0].id)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    load()

    const fetchSystemRecords = async () => {
      if (UUID_REGEX.test(system.id)) {
        try {
          const { data: dbRows, error } = await supabase
            .from("universal_records")
            .select("*")
            .eq("system_id", system.id)
            .order("created_at", { ascending: false })
            .limit(300)

          if (!error && Array.isArray(dbRows)) {
            const mapped: SystemStockRecord[] = dbRows.map((row: any) => {
              const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {}
              const isEntrada = row.record_type === "entrada"
              const entVal =
                meta.entrada !== undefined
                  ? meta.entrada
                  : isEntrada
                  ? Number(row.quantity)
                  : null
              const saiVal =
                meta.saida !== undefined
                  ? meta.saida
                  : !isEntrada
                  ? Number(row.quantity)
                  : null
              return {
                id: String(row.id),
                systemId: system.id,
                sku: row.resource_id || "",
                description: meta.description || row.resource_id || "",
                quantity: Number(row.quantity) || 0,
                entrada: entVal !== null && entVal !== undefined ? Number(entVal) : null,
                saida: saiVal !== null && saiVal !== undefined ? Number(saiVal) : null,
                registeredAt: row.created_at || new Date().toISOString(),
              }
            })
            setSystemRecords(mapped)
            systemDataService.replaceRecordsForSystem(system.id, mapped)
            return
          }
        } catch {
          // fallback to local cache below
        }
      }
      setSystemRecords(systemDataService.getRecordsBySystem(system.id))
    }

    fetchSystemRecords()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, system.id])

  // Confronto ativo selecionado
  const activeConfronto = useMemo(() => {
    return confrontos.find((c) => c.id === activeConfrontoId) || null
  }, [confrontos, activeConfrontoId])

  // Cálculo da conciliação analítica em tempo real
  const analysis = useMemo(() => {
    if (!activeConfronto) return null
    return systemDataService.calculateComparison(systemRecords, activeConfronto)
  }, [systemRecords, activeConfronto])

  if (!isOpen) return null

  // Processa e salva a relação importada em JSON
  const handleSaveImportedRelation = () => {
    if (!confrontoName.trim()) {
      setImportError("O nome do confronto é obrigatório (ex: A501).")
      return
    }
    if (!importText.trim()) {
      setImportError("Cole o conteúdo da relação a ser confrontada.")
      return
    }

    const parsedItems = systemDataService.parseImportText(importText)
    if (parsedItems.length === 0) {
      setImportError(
        "Nenhum item válido encontrado. Certifique-se de colar as colunas: Código | Descrição | Quantidade"
      )
      return
    }

    const saved = systemDataService.saveConfronto({
      systemId: system.id,
      name: confrontoName.trim().toUpperCase(),
      description: confrontoDescription.trim() || `Relação de confronto ${confrontoName.trim().toUpperCase()}`,
      importedItems: parsedItems,
    })

    setImportText("")
    setConfrontoDescription("")
    setImportError("")
    setIsImporting(false)
    load()
    setActiveConfrontoId(saved.id)
  }

  // Excluir confronto
  const handleDeleteConfronto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm("Deseja excluir esta relação de confronto salva?")) {
      systemDataService.deleteConfronto(id)
      load()
    }
  }

  // Linhas filtradas
  const filteredRows = (analysis?.rows || []).filter((r) => {
    if (filterMode === "divergent" && r.status === "match") return false
    if (filterMode === "match" && r.status !== "match") return false
    if (filterMode === "missing" && r.status !== "missing" && r.status !== "only_confronto") return false
    if (filterMode === "excess" && r.status !== "excess" && r.status !== "only_system") return false

    if (!search.trim()) return true
    const q = search.toLowerCase()
    return r.sku.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
  })

  // Exportar resultado do confronto para CSV
  const handleExportCSV = () => {
    if (!analysis || !activeConfronto) return
    const headers = ["SKU", "Descrição", "Saldo Físico (Sistema)", `Saldo ${activeConfronto.name}`, "Diferença", "Situação"]
    const csvLines = [headers.join(";")]

    analysis.rows.forEach((r) => {
      let sit = "Bate 100%"
      if (r.status === "missing" || r.status === "only_confronto") sit = "Falta no Físico"
      if (r.status === "excess" || r.status === "only_system") sit = "Sobra no Físico"
      csvLines.push(
        [
          `"${r.sku}"`,
          `"${r.description.replace(/"/g, '""')}"`,
          r.systemQty,
          r.confrontoQty,
          r.diff,
          `"${sit}"`,
        ].join(";")
      )
    })

    const blob = new Blob(["\ufeff" + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `confronto_${system.code}_${activeConfronto.name}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-md shrink-0"
              style={{
                backgroundColor: `${system.color}25`,
                border: `1.5px solid ${system.color}80`,
              }}
            >
              {system.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Confronto de Saldo — {system.name}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold border border-slate-700">
                  {system.code}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950/70 text-blue-400 border border-blue-800/40">
                  JSON Estruturado
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Conciliação de saldo físico com relações importadas configuráveis (ex: A501, G501, SAP).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Barra de Seleção de Confronto + Botão Nova Importação */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <GitCompare size={13} className="text-blue-400" />
              <span>Relações Salvas:</span>
            </span>

            {confrontos.length === 0 ? (
              <span className="text-xs text-slate-500 italic">Nenhum confronto salvo ainda</span>
            ) : (
              <div className="flex items-center gap-1.5">
                {confrontos.map((c) => {
                  const isSelected = c.id === activeConfrontoId
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setActiveConfrontoId(c.id)
                        setIsImporting(false)
                      }}
                      className={`group/badge flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30"
                          : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      <span>{c.name}</span>
                      <span className="text-[10px] opacity-75 font-mono">({c.totalItems})</span>
                      <button
                        onClick={(e) => handleDeleteConfronto(c.id, e)}
                        className="opacity-0 group-hover/badge:opacity-100 hover:text-rose-300 transition-opacity ml-1"
                        title="Excluir relação"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsImporting((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow"
            >
              <Plus size={13} />
              <span>Importar Nova Relação</span>
            </button>
            {analysis && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                title="Exportar confronto em arquivo CSV"
              >
                <Download size={13} className="text-emerald-400" />
                <span>Exportar CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal/Gaveta de Importação de Relação (Configurar Nome + Colar Dados) */}
        <AnimatePresence>
          {isImporting && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-4 border-b border-slate-800 bg-slate-950/90 space-y-3 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UploadCloud size={14} />
                  <span>Configurar Relação de Confronto (Armazenada em JSON)</span>
                </span>
                <button
                  onClick={() => setIsImporting(false)}
                  className="text-slate-500 hover:text-slate-300 text-xs"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Nome do Confronto * (ex: A501, G501, SAP-WMS)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: A501"
                    value={confrontoName}
                    onChange={(e) => setConfrontoName(e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Descrição / Observação da Relação
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Relação oficial do A501 exportada em 19/11/2026"
                    value={confrontoDescription}
                    onChange={(e) => setConfrontoDescription(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  Cole os dados do Excel / Google Sheets ou CSV (Código | Descrição | Quantidade) *
                </label>
                <textarea
                  rows={4}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Exemplo colado com TAB:&#10;1024-00	CABO USB TIPO C	150&#10;2050-X	CARREGADOR TURBO	42"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {importError && (
                <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/40 rounded-lg px-3 py-1.5">
                  {importError}
                </p>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-500">
                  {importText.trim() ? `${importText.trim().split("\n").length} linhas detectadas` : "Cole o texto da planilha acima"}
                </span>
                <button
                  type="button"
                  onClick={handleSaveImportedRelation}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <FileSpreadsheet size={13} />
                  <span>Salvar Relação e Confrontar</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resumo do Confronto Ativo */}
        {analysis && activeConfronto && (
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            {/* Taxa de Acuracidade */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                  analysis.summary.accuracyPercentage >= 95
                    ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                    : analysis.summary.accuracyPercentage >= 70
                    ? "bg-amber-950/80 text-amber-400 border border-amber-800/60"
                    : "bg-rose-950/80 text-rose-400 border border-rose-800/60"
                }`}
              >
                {analysis.summary.accuracyPercentage}%
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Acuracidade</span>
                <strong className="text-white text-xs">
                  {analysis.summary.matchCount} / {analysis.summary.totalSkus} SKUs
                </strong>
              </div>
            </div>

            {/* Saldo Físico do Sistema */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Saldo Sistema (Físico)</span>
              <strong className="text-blue-400 font-mono text-sm">
                {analysis.summary.totalSystemQty.toLocaleString("pt-BR")}
              </strong>
            </div>

            {/* Saldo da Relação Importada */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Saldo {activeConfronto.name}</span>
              <strong className="text-amber-400 font-mono text-sm">
                {analysis.summary.totalConfrontoQty.toLocaleString("pt-BR")}
              </strong>
            </div>

            {/* Total Divergente */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Divergências</span>
              <strong
                className={`font-mono text-sm ${
                  analysis.summary.divergenceCount === 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {analysis.summary.divergenceCount} SKU(s)
              </strong>
            </div>

            {/* Diferença Líquida */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Diferença Líquida</span>
              <strong
                className={`font-mono text-sm ${
                  analysis.summary.totalSystemQty - analysis.summary.totalConfrontoQty === 0
                    ? "text-emerald-400"
                    : analysis.summary.totalSystemQty - analysis.summary.totalConfrontoQty > 0
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                {analysis.summary.totalSystemQty - analysis.summary.totalConfrontoQty > 0 ? "+" : ""}
                {(analysis.summary.totalSystemQty - analysis.summary.totalConfrontoQty).toLocaleString("pt-BR")}
              </strong>
            </div>
          </div>
        )}

        {/* Barra de Filtros e Busca */}
        {activeConfronto && (
          <div className="p-3 border-b border-slate-800 bg-slate-950/20 flex flex-wrap items-center justify-between gap-2">
            {/* Abas de Filtro */}
            <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800 gap-0.5 text-xs">
              <button
                onClick={() => setFilterMode("all")}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Todos ({analysis?.rows.length || 0})
              </button>
              <button
                onClick={() => setFilterMode("divergent")}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === "divergent"
                    ? "bg-rose-950/80 text-rose-300 border border-rose-800/40"
                    : "text-slate-400 hover:text-rose-400"
                }`}
              >
                Divergentes ({analysis?.summary.divergenceCount || 0})
              </button>
              <button
                onClick={() => setFilterMode("match")}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === "match"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/40"
                    : "text-slate-400 hover:text-emerald-400"
                }`}
              >
                Bate 100% ({analysis?.summary.matchCount || 0})
              </button>
              <button
                onClick={() => setFilterMode("missing")}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === "missing"
                    ? "bg-rose-950/80 text-rose-300 border border-rose-800/40"
                    : "text-slate-400 hover:text-rose-400"
                }`}
              >
                Faltas
              </button>
              <button
                onClick={() => setFilterMode("excess")}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === "excess"
                    ? "bg-amber-950/80 text-amber-300 border border-amber-800/40"
                    : "text-slate-400 hover:text-amber-400"
                }`}
              >
                Sobras
              </button>
            </div>

            {/* Input Busca */}
            <div className="relative min-w-[220px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar por SKU ou descrição..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Tabela de Conciliação Analítica */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
          {!activeConfronto ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              <GitCompare size={32} className="mx-auto mb-2 text-slate-600" />
              <p className="font-semibold text-slate-300">Nenhum confronto selecionado</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                Clique em &quot;Importar Nova Relação&quot; para configurar seu primeiro confronto (ex: A501) e comparar com o saldo físico.
              </p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" />
              <p>Nenhum item corresponde ao filtro selecionado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 bg-slate-950/40">
                    <th className="py-2.5 px-3">SKU / Código</th>
                    <th className="py-2.5 px-3">Descrição do Produto</th>
                    <th className="py-2.5 px-3 text-right">Saldo Sistema</th>
                    <th className="py-2.5 px-3 text-right">Saldo {activeConfronto.name}</th>
                    <th className="py-2.5 px-3 text-right">Diferença (Δ)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredRows.map((r) => {
                    const isMatch = r.status === "match"
                    const isMissing = r.status === "missing" || r.status === "only_confronto"
                    const isExcess = r.status === "excess" || r.status === "only_system"

                    return (
                      <tr key={r.sku} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-white">{r.sku}</td>
                        <td className="py-2 px-3 text-slate-300 truncate max-w-xs">{r.description}</td>
                        <td className="py-2 px-3 text-right font-mono text-blue-400 font-bold">
                          {r.systemQty.toLocaleString("pt-BR")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-amber-400 font-bold">
                          {r.confrontoQty.toLocaleString("pt-BR")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {isMatch ? (
                            <span className="text-emerald-400">0</span>
                          ) : isMissing ? (
                            <span className="text-rose-400">{r.diff}</span>
                          ) : (
                            <span className="text-amber-400">+{r.diff}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isMatch && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/50 text-emerald-400">
                              <CheckCircle2 size={10} />
                              Bate 100%
                            </span>
                          )}
                          {isMissing && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950/70 border border-rose-800/50 text-rose-400">
                              <TrendingDown size={10} />
                              Falta no Físico
                            </span>
                          )}
                          {isExcess && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/70 border border-amber-800/50 text-amber-400">
                              <TrendingUp size={10} />
                              Sobra no Físico
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>
            {activeConfronto
              ? `Relação: ${activeConfronto.name} · ${filteredRows.length} item(ns) exibido(s)`
              : "Nenhum confronto ativo"}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
