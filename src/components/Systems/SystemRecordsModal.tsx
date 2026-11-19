// ============================================================
// NEXUS ERP — Systems / SystemRecordsModal.tsx
// Modal de Registro / Monitoramento de Saldos do Sistema
// Estrutura idêntica à aba Monitoramento do Módulo G300
// Apenas "Movimentação Geral" (sem Sync Offline e sem Histórico Drive-In)
// Validação e busca de produtos estrita na base_codigos do Supabase
// ULTRA-OTIMIZADO: React.memo por linha, input SKU isolado sem travamento
// ============================================================

"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import {
  X,
  Plus,
  Save,
  Trash2,
  Search,
  Calendar,
  Filter,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  FileText,
  FilterX,
  RefreshCw,
  Box,
  AlertCircle,
  CheckCircle2,
  Info as InfoIcon,
} from "lucide-react"
import { format, startOfWeek, endOfWeek, addWeeks, parseISO, isValid } from "date-fns"
import * as XLSX from "xlsx"
import { searchBaseCodigos, type BaseCodigoItem } from "../Resources/baseCodigosService"
import { systemDataService } from "./systemDataService"
import type { BusinessSystem, SystemStockRecord } from "./types"
import type { MapObject } from "../MapLibrary/types"
import { cn } from "@/lib/utils"

export interface SystemRecordsModalProps {
  isOpen: boolean
  onClose: () => void
  system: BusinessSystem
  allObjects?: MapObject[]
}

export const ORIGEM_OPTIONS = [
  "Ajuste",
  "Retrabalho",
  "Uso Interno",
  "Armazenamento",
  "Expedição",
  "Recebimento",
  "PPT",
  "Recusa",
]

export const AVARIA_OPTIONS = [
  "Amassado",
  "Molhado",
  "Quebrado",
  "Rasgado",
  "Sem Avaria",
]

interface ImportRecebimentoRow {
  data: string
  codigo: string
  avaria: string
  transportadora: string
  notaFiscal: string
  lacre: string
  placa: string
}

// ── Célula de Autocomplete do Produto com Estado Local Isolado ──
// Garante digitação a 120 FPS sem re-renderizar a tabela inteira
const ProductAutocompleteCell = React.memo(function ProductAutocompleteCell({
  sku,
  description,
  onCommit,
}: {
  sku: string
  description: string
  onCommit: (sku: string, description: string) => void
}) {
  const [val, setVal] = useState(sku)
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState<BaseCodigoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sincroniza se o SKU mudar externamente (ex: importação de planilha)
  useEffect(() => {
    setVal(sku)
  }, [sku])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleChange = (newVal: string) => {
    const upper = newVal.toUpperCase()
    setVal(upper)
    setSelectedIdx(0)

    if (timerRef.current) clearTimeout(timerRef.current)

    const trimmed = upper.trim()
    if (!trimmed) {
      setResults([])
      setIsOpen(false)
      setLoading(false)
      onCommit("", "")
      return
    }

    setLoading(true)
    setIsOpen(true)
    timerRef.current = setTimeout(async () => {
      try {
        const { data } = await searchBaseCodigos(trimmed, 8)
        setResults(data || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 180)
  }

  const handleSelect = (item: BaseCodigoItem) => {
    setVal(item["Código"])
    setIsOpen(false)
    setResults([])
    onCommit(item["Código"], item["Descrição"])
  }

  const handleBlur = async () => {
    const trimmed = val.trim().toUpperCase()
    if (!trimmed) {
      onCommit("", "")
      return
    }
    if (description && sku === trimmed) return

    try {
      const { data } = await searchBaseCodigos(trimmed, 5)
      const exact = (data || []).find((d) => d["Código"].toUpperCase() === trimmed)
      if (exact) {
        onCommit(exact["Código"], exact["Descrição"])
      } else {
        onCommit(trimmed, "")
      }
    } catch {
      onCommit(trimmed, "")
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={val}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (val.trim()) {
            setIsOpen(true)
            handleChange(val)
          }
        }}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (isOpen && results.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setSelectedIdx((p) => Math.min(p + 1, results.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setSelectedIdx((p) => Math.max(p - 1, 0))
            } else if (e.key === "Enter") {
              e.preventDefault()
              if (results[selectedIdx]) {
                handleSelect(results[selectedIdx])
              }
            } else if (e.key === "Escape") {
              setIsOpen(false)
            }
          }
        }}
        placeholder="Buscar SKU..."
        className={cn(
          "w-full bg-slate-900/60 border rounded px-2 py-1 text-xs font-mono uppercase outline-none transition-colors",
          val && !description
            ? "border-amber-500/80 text-amber-300 bg-amber-950/20"
            : description
            ? "border-slate-800 focus:border-blue-500 text-white"
            : "border-slate-800 focus:border-blue-500 text-slate-400"
        )}
      />
      {description && (
        <div className="text-[9px] text-slate-400 truncate max-w-[170px] font-sans mt-0.5">
          {description}
        </div>
      )}
      {val && !description && (
        <div className="text-[9px] text-amber-400/90 truncate max-w-[170px] font-sans mt-0.5">
          Não cadastrado na base_codigos
        </div>
      )}

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-[200] w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden py-1">
          <div className="px-2.5 py-1 bg-slate-950 text-[9px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800 flex items-center justify-between">
            <span>base_codigos ({results.length})</span>
            {loading && <span className="text-blue-400 normal-case font-normal animate-pulse">Buscando...</span>}
          </div>
          <div className="max-h-48 overflow-y-auto">
            {results.length === 0 && !loading ? (
              <div className="py-3 text-center text-[11px] text-slate-500">
                Nenhum produto em base_codigos
              </div>
            ) : (
              results.map((item, idx) => (
                <button
                  key={item["Código"]}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(item)
                  }}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={cn(
                    "w-full px-3 py-2 flex items-center justify-between text-left border-b border-slate-800/60 last:border-0 transition-colors",
                    selectedIdx === idx ? "bg-blue-600/20 text-white" : "hover:bg-slate-800/60 text-slate-300"
                  )}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold font-mono text-white truncate">{item["Código"]}</span>
                    <span className="text-[10px] text-slate-400 truncate">{item["Descrição"]}</span>
                  </div>
                  {item["Grade"] && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono shrink-0 ml-2">
                      {item["Grade"]}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
})

// ── Linha da Tabela Otimizada com React.memo ───────────────────
const RegistroRow = React.memo(function RegistroRow({
  row,
  onUpdateField,
  onCommitProduct,
  onRemove,
  onOpenObs,
}: {
  row: SystemStockRecord
  onUpdateField: (id: string, field: keyof SystemStockRecord, value: any) => void
  onCommitProduct: (id: string, sku: string, description: string) => void
  onRemove: (id: string) => void
  onOpenObs: (id: string, value: string) => void
}) {
  const isReceb = row.origem === "Recebimento"

  return (
    <tr
      className={cn(
        "hover:bg-slate-800/40 transition-colors group relative",
        row.isDirty && "bg-blue-950/20",
        row.isNew && "bg-emerald-950/20"
      )}
    >
      {/* DATA */}
      <td className="px-4 py-2 font-mono text-slate-300 min-w-[125px]">
        <input
          type="date"
          value={row.data || ""}
          onChange={(e) => onUpdateField(row.id, "data", e.target.value)}
          className="w-full bg-transparent border-none text-xs font-mono text-slate-200 outline-none focus:bg-slate-800/80 rounded px-1.5 py-1 [color-scheme:dark]"
        />
      </td>

      {/* PRODUTO (Autocomplete Isolado) */}
      <td className="px-4 py-2 min-w-[180px]">
        <ProductAutocompleteCell
          sku={row.sku}
          description={row.description}
          onCommit={(newSku, newDesc) => onCommitProduct(row.id, newSku, newDesc)}
        />
      </td>

      {/* TIPO AVARIA */}
      <td className="px-2 py-2 min-w-[130px]">
        <select
          value={row.tipo_avaria || "Sem Avaria"}
          onChange={(e) => onUpdateField(row.id, "tipo_avaria", e.target.value)}
          className="w-full bg-slate-900/60 border border-slate-800 focus:border-blue-500 rounded px-2 py-1 text-xs text-slate-300 outline-none"
        >
          {AVARIA_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </td>

      {/* TURNO */}
      <td className="px-4 py-2 min-w-[70px]">
        <input
          type="number"
          value={row.turno ?? ""}
          onChange={(e) =>
            onUpdateField(row.id, "turno", e.target.value ? Number(e.target.value) : null)
          }
          placeholder="---"
          className={cn(
            "w-12 bg-transparent text-center font-bold text-xs outline-none focus:bg-slate-800/80 rounded py-1",
            Number(row.turno) > 0 ? "text-blue-400" : "text-slate-600"
          )}
        />
      </td>

      {/* ENTRADA */}
      <td className="px-4 py-2 min-w-[90px]">
        <input
          type="text"
          value={row.entrada ?? ""}
          onChange={(e) => onUpdateField(row.id, "entrada", e.target.value)}
          placeholder="0"
          className={cn(
            "w-16 bg-transparent text-xs font-bold font-mono tabular-nums outline-none focus:bg-slate-800/80 rounded py-1",
            Number(row.entrada) > 0 ? "text-emerald-400" : "text-slate-600"
          )}
        />
      </td>

      {/* SAÍDA */}
      <td className="px-4 py-2 min-w-[90px]">
        <input
          type="text"
          value={row.saida ?? ""}
          onChange={(e) => onUpdateField(row.id, "saida", e.target.value)}
          placeholder="0"
          className={cn(
            "w-16 bg-transparent text-xs font-bold font-mono tabular-nums outline-none focus:bg-slate-800/80 rounded py-1",
            Number(row.saida) > 0 ? "text-rose-400" : "text-slate-600"
          )}
        />
      </td>

      {/* ORIGEM */}
      <td className="px-2 py-2 min-w-[140px]">
        <select
          value={row.origem || "Recebimento"}
          onChange={(e) => onUpdateField(row.id, "origem", e.target.value)}
          className="w-full bg-slate-900/60 border border-slate-800 focus:border-blue-500 rounded px-2 py-1 text-xs text-slate-300 outline-none"
        >
          {ORIGEM_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </td>

      {/* TRANSP. */}
      <td className="px-4 py-2 min-w-[110px]">
        {isReceb ? (
          <input
            type="text"
            value={row.transportadora || ""}
            onChange={(e) => onUpdateField(row.id, "transportadora", e.target.value.toUpperCase())}
            placeholder="---"
            className="w-full bg-transparent text-xs font-mono uppercase text-slate-300 outline-none focus:bg-slate-800/80 rounded py-1"
          />
        ) : (
          <span className="text-slate-600 font-mono">---</span>
        )}
      </td>

      {/* NF */}
      <td className="px-4 py-2 min-w-[90px]">
        {isReceb ? (
          <input
            type="text"
            value={row.nota_fiscal || ""}
            onChange={(e) => onUpdateField(row.id, "nota_fiscal", e.target.value)}
            placeholder="---"
            className="w-full bg-transparent text-xs font-mono text-slate-300 outline-none focus:bg-slate-800/80 rounded py-1"
          />
        ) : (
          <span className="text-slate-600 font-mono">---</span>
        )}
      </td>

      {/* OBS. */}
      <td className="px-4 py-2 text-center min-w-[60px]">
        <button
          type="button"
          onClick={() => onOpenObs(row.id, row.observacao || "")}
          className={cn(
            "p-1.5 rounded-lg transition-colors inline-flex items-center justify-center",
            row.observacao?.trim()
              ? "text-blue-400 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800/60"
              : "text-slate-600 hover:text-slate-400 hover:bg-slate-800/60"
          )}
          title={row.observacao || "Adicionar observação"}
        >
          <MessageSquare size={14} />
        </button>
      </td>

      {/* AÇÃO: DELETAR */}
      <td className="px-2 py-2 text-center w-10">
        <button
          type="button"
          onClick={() => onRemove(row.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-950/60 hover:text-rose-400 text-slate-600 transition-all"
          title="Remover linha"
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
})

// ── COMPONENTE PRINCIPAL DO MODAL DE REGISTRO ──────────────────
export default function SystemRecordsModal({
  isOpen,
  onClose,
  system,
  allObjects = [],
}: SystemRecordsModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [registros, setRegistros] = useState<SystemStockRecord[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" | "info" }>({
    show: false,
    message: "",
    type: "info",
  })
  const [obsModalTarget, setObsModalTarget] = useState<{ id: string; value: string } | null>(null)

  // Modal de Importação de Recebimentos
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importModalRows, setImportModalRows] = useState<ImportRecebimentoRow[]>(
    Array.from({ length: 15 }, () => ({
      data: "",
      codigo: "",
      avaria: "",
      transportadora: "",
      notaFiscal: "",
      lacre: "",
      placa: "",
    }))
  )

  // Filtros de Data
  const [dateMode, setDateMode] = useState<"week" | "custom" | "all">("week")
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const weekEnd = useMemo(
    () => endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
    [currentWeekStart]
  )
  const [customStartDate, setCustomStartDate] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  )
  const [customEndDate, setCustomEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"))

  // Filtros de Coluna
  const [showColumnFilters, setShowColumnFilters] = useState(false)
  const [colFilters, setColFilters] = useState({
    nota_fiscal: "",
    produto: "",
    origem: "",
    tipo_avaria: "",
    transportadora: "",
  })

  const clearColumnFilters = () => {
    setColFilters({
      nota_fiscal: "",
      produto: "",
      origem: "",
      tipo_avaria: "",
      transportadora: "",
    })
  }

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 4000)
  }, [])

  // ── Carregar Registros ──────────────────────────────────────
  const fetchRegistros = useCallback(() => {
    setLoading(true)
    try {
      const all = systemDataService.getRecordsBySystem(system.id)
      setRegistros(all)
    } catch (e) {
      console.error("Erro ao ler registros do sistema:", e)
      showToast("Erro ao carregar registros do sistema", "error")
    } finally {
      setLoading(false)
    }
  }, [system.id, showToast])

  useEffect(() => {
    if (isOpen) {
      fetchRegistros()
    }
  }, [isOpen, fetchRegistros])

  // ── Adicionar Nova Linha ────────────────────────────────────
  const handleAddRow = useCallback(() => {
    const newRecord: SystemStockRecord = {
      id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      systemId: system.id,
      sku: "",
      description: "",
      quantity: 0,
      data: format(new Date(), "yyyy-MM-dd"),
      entrada: null,
      saida: null,
      tipo_avaria: "Sem Avaria",
      turno: 1,
      origem: "Recebimento",
      transportadora: "",
      nota_fiscal: null,
      placa: "",
      observacao: "",
      positionLabel: system.originStorageLabel || "CHÃO",
      registeredAt: new Date().toISOString(),
      isNew: true,
      isDirty: true,
    }
    setRegistros((prev) => [newRecord, ...prev])
  }, [system.id, system.originStorageLabel])

  const removeRow = useCallback((id: string) => {
    setRegistros((prev) => {
      const target = prev.find((r) => r.id === id)
      if (!target?.isNew) {
        systemDataService.deleteRecord(id)
      }
      return prev.filter((r) => r.id !== id)
    })
    showToast("Registro removido.", "info")
  }, [showToast])

  const updateRowField = useCallback((id: string, field: keyof SystemStockRecord, value: any) => {
    setRegistros((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r

        let finalValue = value

        if (field === "entrada" || field === "saida") {
          if (value === "" || value === null) {
            finalValue = null
          } else {
            const parsed = parseInt(value.toString().replace(/[^0-9]/g, ""), 10)
            finalValue = isNaN(parsed) ? null : parsed
          }
        }

        const nextRow = {
          ...r,
          [field]: finalValue,
          isDirty: true,
        }

        const ent = typeof nextRow.entrada === "number" ? nextRow.entrada : 0
        const sai = typeof nextRow.saida === "number" ? nextRow.saida : 0
        nextRow.quantity = ent > 0 ? ent : sai

        return nextRow
      })
    )
  }, [])

  const commitProduct = useCallback((id: string, sku: string, description: string) => {
    setRegistros((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        return {
          ...r,
          sku,
          description,
          isDirty: true,
        }
      })
    )
  }, [])

  // ── Salvar Linhas Alteradas / Novas ─────────────────────────
  const handleSaveRows = async () => {
    const rowsToSave = registros.filter((r) => r.isDirty)
    if (rowsToSave.length === 0) return

    // Validação estrita: produto DEVE existir em base_codigos (description preenchida)
    const semCodigoValido = rowsToSave.find((r) => !r.sku || !r.description)
    if (semCodigoValido) {
      showToast(
        `Apenas produtos existentes na base_codigos são permitidos! Selecione o produto na lista para "${semCodigoValido.sku || "vazio"}".`,
        "error"
      )
      return
    }

    const semOrigem = rowsToSave.find((r) => !r.origem || r.origem.trim() === "")
    if (semOrigem) {
      showToast(`Origem é obrigatória! (Produto: ${semOrigem.sku})`, "error")
      return
    }

    const semQtd = rowsToSave.find(
      (r) => (Number(r.entrada) || 0) <= 0 && (Number(r.saida) || 0) <= 0
    )
    if (semQtd) {
      showToast(`Preencha o valor de Entrada ou Saída para o produto ${semQtd.sku}.`, "error")
      return
    }

    setSaving(true)
    try {
      const sanitized = rowsToSave.map((r) => ({
        ...r,
        systemId: system.id,
        sku: r.sku.trim().toUpperCase(),
        description: r.description.trim(),
        quantity: (Number(r.entrada) || 0) > 0 ? Number(r.entrada) : (Number(r.saida) || 0),
        data: r.data || format(new Date(), "yyyy-MM-dd"),
        isDirty: false,
        isNew: false,
      }))

      systemDataService.saveRecordsBatch(sanitized)

      setRegistros((prev) =>
        prev.map((r) => {
          const match = sanitized.find((s) => s.id === r.id)
          return match || r
        })
      )

      showToast(`✅ ${rowsToSave.length} registro(s) salvo(s) com sucesso!`, "success")
    } catch (err: any) {
      console.error("Erro ao salvar:", err)
      showToast(`Erro ao salvar registros: ${err.message || "Falha"}`, "error")
    } finally {
      setSaving(false)
    }
  }

  // ── Filtros e Ordenação ─────────────────────────────────────
  const filteredRegistros = useMemo(() => {
    return registros.filter((row) => {
      if (dateMode === "week") {
        if (!row.data) return false
        try {
          const rowDate = parseISO(row.data)
          if (!isValid(rowDate)) return false
          if (rowDate < currentWeekStart || rowDate > weekEnd) return false
        } catch {
          return false
        }
      } else if (dateMode === "custom") {
        if (!row.data) return false
        if (row.data < customStartDate || row.data > customEndDate) return false
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchSku = (row.sku || "").toLowerCase().includes(q)
        const matchDesc = (row.description || "").toLowerCase().includes(q)
        const matchNf = String(row.nota_fiscal || "").toLowerCase().includes(q)
        const matchPlaca = (row.placa || "").toLowerCase().includes(q)
        const matchObs = (row.observacao || "").toLowerCase().includes(q)
        if (!matchSku && !matchDesc && !matchNf && !matchPlaca && !matchObs) return false
      }

      if (colFilters.nota_fiscal && !String(row.nota_fiscal || "").includes(colFilters.nota_fiscal)) {
        return false
      }
      if (colFilters.produto && !(row.sku || "").toUpperCase().includes(colFilters.produto.toUpperCase())) {
        return false
      }
      if (colFilters.origem && row.origem !== colFilters.origem) {
        return false
      }
      if (colFilters.tipo_avaria && row.tipo_avaria !== colFilters.tipo_avaria) {
        return false
      }
      if (
        colFilters.transportadora &&
        !(row.transportadora || "").toUpperCase().includes(colFilters.transportadora.toUpperCase())
      ) {
        return false
      }

      return true
    })
  }, [
    registros,
    dateMode,
    currentWeekStart,
    weekEnd,
    customStartDate,
    customEndDate,
    searchTerm,
    colFilters,
  ])

  // ── Importar Recebimentos ───────────────────────────────────
  const parseBrDateToIso = (s?: string): string => {
    if (!s || !s.trim()) return format(new Date(), "yyyy-MM-dd")
    const str = String(s).trim()
    const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
    if (isoMatch) {
      const yyyy = parseInt(isoMatch[1], 10)
      const mm = parseInt(isoMatch[2], 10)
      const dd = parseInt(isoMatch[3], 10)
      if (yyyy >= 2000 && yyyy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        return `${yyyy}-${mm.toString().padStart(2, "0")}-${dd.toString().padStart(2, "0")}`
      }
    }
    const brMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/)
    if (brMatch) {
      const dd = parseInt(brMatch[1], 10)
      const mm = parseInt(brMatch[2], 10)
      let yyyy = parseInt(brMatch[3], 10)
      if (yyyy < 100) yyyy += 2000
      if (yyyy >= 2000 && yyyy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        return `${yyyy}-${mm.toString().padStart(2, "0")}-${dd.toString().padStart(2, "0")}`
      }
    }
    return format(new Date(), "yyyy-MM-dd")
  }

  const handleProcessImportModal = async () => {
    const validRows = importModalRows.filter(
      (r) => r.codigo.trim() && Number(String(r.avaria).replace(/\D/g, "")) > 0
    )

    if (validRows.length === 0) {
      showToast("Insira pelo menos um produto com quantidade de avaria > 0.", "error")
      return
    }

    const skus = Array.from(new Set(validRows.map((r) => r.codigo.trim().toUpperCase())))
    const descMap = new Map<string, string>()

    for (const sku of skus) {
      const { data } = await searchBaseCodigos(sku, 3)
      const exact = (data || []).find((d) => d["Código"].toUpperCase() === sku)
      if (exact) {
        descMap.set(sku, exact["Descrição"])
      }
    }

    const missing = skus.filter((s) => !descMap.has(s))
    if (missing.length > 0) {
      showToast(
        `Os seguintes SKUs não existem na base_codigos e não puderam ser importados: ${missing.slice(0, 3).join(", ")}...`,
        "error"
      )
      return
    }

    const newRows: SystemStockRecord[] = validRows.map((r, idx) => {
      const parsedAvaria = Math.round(Number(String(r.avaria).replace(/\D/g, "")) || 0)
      const rawNf = r.notaFiscal ? Number(String(r.notaFiscal).replace(/\D/g, "")) : null
      const skuNorm = r.codigo.trim().toUpperCase()

      return {
        id: `imp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        systemId: system.id,
        sku: skuNorm,
        description: descMap.get(skuNorm) || "Produto Validado",
        quantity: parsedAvaria,
        data: parseBrDateToIso(r.data),
        entrada: parsedAvaria > 0 ? parsedAvaria : null,
        saida: null,
        origem: "Recebimento",
        observacao: "Importado via planilha de Recebimentos",
        transportadora: r.transportadora ? String(r.transportadora).trim().toUpperCase() : "",
        nota_fiscal: rawNf && !isNaN(rawNf) ? rawNf : null,
        lacre: r.lacre ? String(r.lacre).trim().toUpperCase() : "",
        placa: r.placa ? String(r.placa).trim().toUpperCase() : "",
        tipo_avaria: "Sem Avaria",
        turno: 1,
        positionLabel: system.originStorageLabel || "CHÃO",
        registeredAt: new Date().toISOString(),
        isNew: true,
        isDirty: true,
      }
    })

    setRegistros((prev) => [...newRows, ...prev])
    setIsImportModalOpen(false)
    setImportModalRows(
      Array.from({ length: 15 }, () => ({
        data: "",
        codigo: "",
        avaria: "",
        transportadora: "",
        notaFiscal: "",
        lacre: "",
        placa: "",
      }))
    )
    showToast(`✅ ${newRows.length} recebimentos importados! Clique em Salvar para gravar.`, "success")
  }

  const handleExcelFileToModal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: "binary" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

        if (!data || data.length < 2) {
          showToast("A planilha parece estar vazia ou sem cabeçalho.", "error")
          return
        }

        const headers = (data[0] || []).map((h: any) =>
          String(h || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
        )

        const findColIdx = (aliases: string[]) =>
          headers.findIndex((h: string) => aliases.some((a) => h.includes(a)))

        const colData = findColIdx(["data", "dia", "date"])
        const colCod = findColIdx(["codigo", "sku", "produto", "material"])
        const colQtd = findColIdx(["avaria", "qtd", "quantidade", "saldo"])
        const colTransp = findColIdx(["transp", "transportadora"])
        const colNf = findColIdx(["nf", "nota", "fiscal"])
        const colLacre = findColIdx(["lacre"])
        const colPlaca = findColIdx(["placa"])

        const parsedRows: ImportRecebimentoRow[] = []
        for (let i = 1; i < data.length; i++) {
          const row = data[i]
          if (!row || row.length === 0) continue

          const codVal = colCod !== -1 ? String(row[colCod] || "").trim() : ""
          if (!codVal) continue

          parsedRows.push({
            data: colData !== -1 ? String(row[colData] || "").trim() : "",
            codigo: codVal.toUpperCase(),
            avaria: colQtd !== -1 ? String(row[colQtd] || "0").trim() : "0",
            transportadora: colTransp !== -1 ? String(row[colTransp] || "").trim().toUpperCase() : "",
            notaFiscal: colNf !== -1 ? String(row[colNf] || "").trim() : "",
            lacre: colLacre !== -1 ? String(row[colLacre] || "").trim().toUpperCase() : "",
            placa: colPlaca !== -1 ? String(row[colPlaca] || "").trim().toUpperCase() : "",
          })
        }

        while (parsedRows.length < 15) {
          parsedRows.push({ data: "", codigo: "", avaria: "", transportadora: "", notaFiscal: "", lacre: "", placa: "" })
        }

        setImportModalRows(parsedRows)
        showToast(`${parsedRows.filter((r) => r.codigo).length} linhas carregadas na tabela.`, "success")
      } catch (err) {
        console.error("Erro ao ler Excel:", err)
        showToast("Erro ao processar planilha do Excel.", "error")
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ""
  }

  if (!isOpen) return null

  const dirtyCount = registros.filter((r) => r.isDirty).length

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#090d16] border border-slate-800 rounded-2xl w-full max-w-[96vw] h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* ── HEADER MODAL ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/80 bg-[#0d131f] shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 shadow-sm"
              style={{ backgroundColor: `${system.color}25`, border: `1px solid ${system.color}60` }}
            >
              {system.icon || "📦"}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  Registros de Saldo — {system.name}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/60 text-blue-300 font-bold">
                  {system.code}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                {registros.length} registros cadastrados · Origem física:{" "}
                <strong className="text-slate-200">{system.originStorageLabel || "CHÃO"}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── ACTION BAR (EXATAMENTE COMO O G300) ── */}
        <div className="p-4 border-b border-slate-800/80 bg-[#0a0f1d] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Aba Única: Movimentação Geral */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 text-xs font-bold shadow-sm">
              <Box size={15} />
              <span>Movimentação Geral</span>
            </div>
          </div>

          {/* Filtros de Data e Busca */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Modo de Data */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDateMode("week")}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-semibold transition-all",
                  dateMode === "week" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                )}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => setDateMode("custom")}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-semibold transition-all",
                  dateMode === "custom" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                )}
              >
                Período
              </button>
              <button
                type="button"
                onClick={() => setDateMode("all")}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-semibold transition-all",
                  dateMode === "all" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                )}
              >
                Tudo
              </button>
            </div>

            {/* Navegador de Semana */}
            {dateMode === "week" && (
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => setCurrentWeekStart((prev) => addWeeks(prev, -1))}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                <div className="px-2.5 flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                  <Calendar size={13} className="text-blue-400" />
                  <span>
                    {format(currentWeekStart, "dd/MM")} — {format(weekEnd, "dd/MM/yyyy")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentWeekStart((prev) => addWeeks(prev, 1))}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}

            {/* Período Customizado */}
            {dateMode === "custom" && (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <Calendar size={13} className="text-blue-400" />
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent text-xs font-mono text-slate-200 outline-none [color-scheme:dark]"
                />
                <span className="text-slate-500 font-bold text-[10px]">até</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent text-xs font-mono text-slate-200 outline-none [color-scheme:dark]"
                />
              </div>
            )}

            {/* Input de Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                type="text"
                placeholder="Buscar por NF, SKU, Placa, Obs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-56 transition-all"
              />
            </div>

            {/* Botão Filtros de Coluna */}
            <button
              type="button"
              onClick={() => setShowColumnFilters(!showColumnFilters)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all relative",
                showColumnFilters || Object.values(colFilters).some(Boolean)
                  ? "bg-blue-600/15 text-blue-400 border-blue-500/40"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              )}
            >
              <Filter size={14} />
              <span>Filtros</span>
              {Object.values(colFilters).some(Boolean) && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              )}
            </button>

            {/* Botão Importar Recebimentos */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <FileText size={15} />
              <span>Importar Recebimentos</span>
            </button>

            {/* Botão + Novo Registro */}
            <button
              onClick={handleAddRow}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Plus size={15} />
              <span>Novo Registro</span>
            </button>

            {/* Botão Salvar */}
            <button
              onClick={handleSaveRows}
              disabled={saving || dirtyCount === 0}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm",
                dirtyCount > 0
                  ? "bg-blue-600 hover:bg-blue-500 text-white animate-pulse"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              )}
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              <span>Salvar {dirtyCount > 0 && `(${dirtyCount})`}</span>
            </button>

            {/* Refresh */}
            <button
              onClick={fetchRegistros}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Recarregar"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* ── BARRA DE FILTROS POR COLUNA ── */}
        {showColumnFilters && (
          <div className="bg-[#0b101c] border-b border-slate-800 p-3 shrink-0 animate-in fade-in duration-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <Filter size={12} className="text-blue-400" /> Filtros Específicos
              </span>
              {Object.values(colFilters).some(Boolean) && (
                <button
                  type="button"
                  onClick={clearColumnFilters}
                  className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300"
                >
                  <FilterX size={12} /> Limpar Filtros
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Nota Fiscal</label>
                <input
                  type="text"
                  placeholder="Ex: 6293..."
                  value={colFilters.nota_fiscal}
                  onChange={(e) => setColFilters((prev) => ({ ...prev, nota_fiscal: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Produto (SKU)</label>
                <input
                  type="text"
                  placeholder="Ex: 5618-03..."
                  value={colFilters.produto}
                  onChange={(e) => setColFilters((prev) => ({ ...prev, produto: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-blue-500 uppercase font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Origem</label>
                <select
                  value={colFilters.origem}
                  onChange={(e) => setColFilters((prev) => ({ ...prev, origem: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-blue-500"
                >
                  <option value="">Todas</option>
                  {ORIGEM_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Tipo Avaria</label>
                <select
                  value={colFilters.tipo_avaria}
                  onChange={(e) => setColFilters((prev) => ({ ...prev, tipo_avaria: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-blue-500"
                >
                  <option value="">Todas</option>
                  {AVARIA_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Transportadora</label>
                <input
                  type="text"
                  placeholder="Ex: JTD..."
                  value={colFilters.transportadora}
                  onChange={(e) => setColFilters((prev) => ({ ...prev, transportadora: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-blue-500 uppercase"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── TABELA DE REGISTROS (10 COLUNAS G300) ── */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-[#070b14]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-[#0d131f] border-b border-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">DATA</th>
                <th className="px-4 py-3">PRODUTO</th>
                <th className="px-4 py-3">TIPO AVARIA</th>
                <th className="px-4 py-3">TURNO</th>
                <th className="px-4 py-3">ENTRADA</th>
                <th className="px-4 py-3">SAÍDA</th>
                <th className="px-4 py-3">ORIGEM</th>
                <th className="px-4 py-3">TRANSP.</th>
                <th className="px-4 py-3">NF</th>
                <th className="px-4 py-3 text-center">OBS.</th>
                <th className="w-10 px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-blue-500" size={32} />
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Carregando registros...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredRegistros.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-20 text-center">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Nenhum registro encontrado
                    </p>
                    <button
                      onClick={handleAddRow}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow"
                    >
                      <Plus size={13} /> Criar Primeiro Registro
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRegistros.map((row) => (
                  <RegistroRow
                    key={row.id}
                    row={row}
                    onUpdateField={updateRowField}
                    onCommitProduct={commitProduct}
                    onRemove={removeRow}
                    onOpenObs={(id, value) => setObsModalTarget({ id, value })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── FOOTER DO MODAL ── */}
        <div className="p-3 border-t border-slate-800/80 bg-[#0d131f] flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span>
              Total exibido: <strong>{filteredRegistros.length}</strong> registro(s)
            </span>
            <span>•</span>
            <span>
              Total peças:{" "}
              <strong className="text-emerald-400">
                {filteredRegistros.reduce((acc, r) => acc + (Number(r.entrada) || 0), 0)} Entradas
              </strong>{" "}
              /{" "}
              <strong className="text-rose-400">
                {filteredRegistros.reduce((acc, r) => acc + (Number(r.saida) || 0), 0)} Saídas
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL: OBSERVAÇÃO DE LINHA ── */}
      {obsModalTarget && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <MessageSquare size={14} className="text-blue-400" />
                Observação do Registro
              </h3>
              <button
                onClick={() => setObsModalTarget(null)}
                className="text-slate-500 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            <textarea
              rows={4}
              value={obsModalTarget.value}
              onChange={(e) => setObsModalTarget({ ...obsModalTarget, value: e.target.value })}
              placeholder="Insira detalhes adicionais sobre esta movimentação..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-blue-500 resize-none"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setObsModalTarget(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  updateRowField(obsModalTarget.id, "observacao", obsModalTarget.value)
                  setObsModalTarget(null)
                }}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow"
              >
                Salvar Observação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: IMPORTAR RECEBIMENTOS (COPIAR E COLAR / EXCEL) ── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-100">
          <div className="bg-[#0B1120] border border-white/10 rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-4 text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight">
                    Importar Recebimentos — {system.name}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Cole colunas do Excel/Sheets (Ctrl+V) ou digite diretamente na tabela abaixo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Controles de Ação */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setImportModalRows((prev) => [
                      ...prev,
                      ...Array.from({ length: 5 }, () => ({
                        data: "",
                        codigo: "",
                        avaria: "",
                        transportadora: "",
                        notaFiscal: "",
                        lacre: "",
                        placa: "",
                      })),
                    ])
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-semibold text-slate-300 transition-colors"
                >
                  <Plus size={13} /> +5 Linhas
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleExcelFileToModal}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-[11px] font-semibold text-blue-400 transition-colors"
                >
                  <FileText size={13} /> Carregar Arquivo Excel
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  setImportModalRows(
                    Array.from({ length: 15 }, () => ({
                      data: "",
                      codigo: "",
                      avaria: "",
                      transportadora: "",
                      notaFiscal: "",
                      lacre: "",
                      placa: "",
                    }))
                  )
                }
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 size={13} /> Limpar Tabela
              </button>
            </div>

            {/* Tabela de Colar */}
            <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#0B1120]">
              <div className="grid grid-cols-[36px_1.1fr_1.3fr_0.9fr_1.2fr_1fr_1fr_1fr] border-b border-white/[0.06] bg-white/[0.02] text-[9.5px] font-semibold text-slate-400 uppercase tracking-widest">
                <div className="px-2 py-2 text-center border-r border-white/[0.06]">#</div>
                <div className="px-3 py-2 border-r border-white/[0.06]">Data</div>
                <div className="px-3 py-2 border-r border-white/[0.06]">Código (SKU) *</div>
                <div className="px-3 py-2 border-r border-white/[0.06] text-center">Qtd Avaria *</div>
                <div className="px-3 py-2 border-r border-white/[0.06]">Transportadora</div>
                <div className="px-3 py-2 border-r border-white/[0.06]">Nº NF</div>
                <div className="px-3 py-2 border-r border-white/[0.06]">Nº Lacre</div>
                <div className="px-3 py-2">Placa</div>
              </div>

              <div className="max-h-[46vh] overflow-y-auto custom-scrollbar divide-y divide-white/[0.03]">
                {importModalRows.map((row, rIdx) => {
                  const handleSmartPaste = (
                    e: React.ClipboardEvent<HTMLInputElement>,
                    startColIdx: number
                  ) => {
                    const text = e.clipboardData.getData("text")
                    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "")
                    const isTSV = lines.some((l) => l.includes("\t"))
                    const isCSV = !isTSV && lines.some((l) => l.includes(";"))
                    const isMultiCol = isTSV || isCSV

                    if (!isMultiCol && lines.length === 1) return

                    e.preventDefault()
                    const sep = isTSV ? "\t" : isCSV ? ";" : "\t"
                    const cols: (keyof ImportRecebimentoRow)[] = [
                      "data",
                      "codigo",
                      "avaria",
                      "transportadora",
                      "notaFiscal",
                      "lacre",
                      "placa",
                    ]

                    const newRows = [...importModalRows]
                    lines.forEach((line, lineOffset) => {
                      const cells = line.split(sep).map((c) => c.trim())
                      const targetRowIdx = rIdx + lineOffset
                      while (newRows.length <= targetRowIdx) {
                        newRows.push({
                          data: "",
                          codigo: "",
                          avaria: "",
                          transportadora: "",
                          notaFiscal: "",
                          lacre: "",
                          placa: "",
                        })
                      }
                      cells.forEach((val, colOffset) => {
                        const targetColIdx = startColIdx + colOffset
                        if (targetColIdx < cols.length) {
                          newRows[targetRowIdx][cols[targetColIdx]] = val
                        }
                      })
                    })
                    setImportModalRows(newRows)
                  }

                  const updateRowFieldImport = (field: keyof ImportRecebimentoRow, val: string) => {
                    const updated = [...importModalRows]
                    updated[rIdx][field] = val
                    setImportModalRows(updated)
                  }

                  return (
                    <div
                      key={rIdx}
                      className="grid grid-cols-[36px_1.1fr_1.3fr_0.9fr_1.2fr_1fr_1fr_1fr] hover:bg-white/[0.015] transition-colors items-center"
                    >
                      <div className="flex items-center justify-center border-r border-white/[0.06] text-[10px] font-mono text-slate-600 py-1.5">
                        {rIdx + 1}
                      </div>
                      <div className="border-r border-white/[0.06]">
                        <input
                          type="text"
                          value={row.data}
                          onChange={(e) => updateRowFieldImport("data", e.target.value)}
                          onPaste={(e) => handleSmartPaste(e, 0)}
                          placeholder="AAAA-MM-DD"
                          className="w-full bg-transparent px-3 py-1.5 text-[11px] font-mono text-slate-200 focus:bg-white/[0.04] focus:outline-none"
                        />
                      </div>
                      <div className="border-r border-white/[0.06]">
                        <input
                          type="text"
                          value={row.codigo}
                          onChange={(e) => updateRowFieldImport("codigo", e.target.value)}
                          onPaste={(e) => handleSmartPaste(e, 1)}
                          placeholder="SKU..."
                          className="w-full bg-transparent px-3 py-1.5 text-[11px] font-mono text-white font-medium focus:bg-white/[0.04] focus:outline-none uppercase"
                        />
                      </div>
                      <div className="border-r border-white/[0.06]">
                        <input
                          type="text"
                          value={row.avaria}
                          onChange={(e) => updateRowFieldImport("avaria", e.target.value)}
                          onPaste={(e) => handleSmartPaste(e, 2)}
                          placeholder="0"
                          className="w-full bg-transparent px-3 py-1.5 text-[11px] font-mono text-center text-emerald-400 focus:bg-white/[0.04] focus:outline-none"
                        />
                      </div>
                      <div className="border-r border-white/[0.06]">
                        <input
                          type="text"
                          value={row.transportadora}
                          onChange={(e) => updateRowFieldImport("transportadora", e.target.value)}
                          onPaste={(e) => handleSmartPaste(e, 3)}
                          placeholder="Transp..."
                          className="w-full bg-transparent px-3 py-1.5 text-[11px] font-mono uppercase text-slate-300 focus:bg-white/[0.04] focus:outline-none"
                        />
                      </div>
                      <div className="border-r border-white/[0.06]">
                        <input
                          type="text"
                          value={row.notaFiscal}
                          onChange={(e) => updateRowFieldImport("notaFiscal", e.target.value)}
                          onPaste={(e) => handleSmartPaste(e, 4)}
                          placeholder="NF..."
                          className="w-full bg-transparent px-3 py-1.5 text-[11px] font-mono text-slate-300 focus:bg-white/[0.04] focus:outline-none"
                        />
                      </div>
                      <div className="border-r border-white/[0.06]">
                        <input
                          type="text"
                          value={row.lacre}
                          onChange={(e) => updateRowFieldImport("lacre", e.target.value)}
                          onPaste={(e) => handleSmartPaste(e, 5)}
                          placeholder="Lacre..."
                          className="w-full bg-transparent px-3 py-1.5 text-[11px] font-mono uppercase text-slate-300 focus:bg-white/[0.04] focus:outline-none"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={row.placa}
                          onChange={(e) => updateRowFieldImport("placa", e.target.value)}
                          onPaste={(e) => handleSmartPaste(e, 6)}
                          placeholder="Placa..."
                          className="w-full bg-transparent px-3 py-1.5 text-[11px] font-mono uppercase text-slate-300 focus:bg-white/[0.04] focus:outline-none"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 font-mono">
                {importModalRows.filter((r) => r.codigo.trim()).length} linhas com SKU
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleProcessImportModal}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                >
                  <Check size={14} /> Processar e Inserir na Tabela
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST FLUTUANTE ── */}
      {toast.show && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-[300] flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-150",
            toast.type === "success"
              ? "bg-emerald-950/80 border-emerald-700/60 text-emerald-300"
              : toast.type === "error"
              ? "bg-rose-950/80 border-rose-700/60 text-rose-300"
              : "bg-blue-950/80 border-blue-700/60 text-blue-300"
          )}
        >
          {toast.type === "success" && <CheckCircle2 size={16} />}
          {toast.type === "error" && <AlertCircle size={16} />}
          {toast.type === "info" && <InfoIcon size={16} />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast((prev) => ({ ...prev, show: false }))}
            className="ml-2 hover:opacity-80"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
