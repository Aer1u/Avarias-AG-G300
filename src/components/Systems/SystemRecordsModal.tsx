// ============================================================
// NEXUS ERP — Systems / SystemRecordsModal.tsx
// Modal de Registro / Monitoramento de Saldos do Sistema
// Estrutura idêntica à aba Monitoramento do Módulo G300
// Apenas "Movimentação Geral" (sem Sync Offline e sem Histórico Drive-In)
// Validação e busca de produtos estrita na base_codigos do Supabase
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
  ChevronDown,
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
import { ptBR } from "date-fns/locale"
import { motion, AnimatePresence } from "framer-motion"
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

// ── Dropdown customizado (estilo G300) ─────────────────────────
const CustomSelect = ({
  value,
  options,
  onChange,
  disabled,
  placeholder = "Selecione...",
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
  disabled: boolean
  placeholder?: string
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full text-left bg-transparent border-none px-4 py-3 text-xs transition-colors focus:outline-none flex items-center justify-between",
          disabled
            ? "cursor-default text-slate-500"
            : "cursor-pointer text-slate-300 hover:text-white focus:bg-slate-800/80 focus:ring-1 focus:ring-blue-500/20"
        )}
      >
        <span className={!value ? "text-slate-500 truncate" : "truncate"}>
          {value || placeholder}
        </span>
        {!disabled && (
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 ml-1.5 flex-shrink-0 transition-transform text-slate-500",
              isOpen && "rotate-180"
            )}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-[120] w-[170px] top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden py-1"
          >
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                className={cn(
                  "w-full text-left px-3.5 py-2 text-xs transition-colors",
                  value === opt
                    ? "text-blue-400 font-semibold bg-blue-950/60"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
                onClick={() => {
                  onChange(opt)
                  setIsOpen(false)
                }}
              >
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Toast local ───────────────────────────────────────────────
interface ToastState {
  show: boolean
  message: string
  type: "success" | "error" | "info"
}

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
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "info" })
  const [obsModalTarget, setObsModalTarget] = useState<{ id: string; value: string } | null>(null)

  // Autocomplete / base_codigos state
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<BaseCodigoItem[]>([])
  const [isSearchingProduct, setIsSearchingProduct] = useState(false)
  const [selectedDropdownIdx, setSelectedDropdownIdx] = useState(0)
  const currentSearchQuery = useRef("")
  const productDropdownRef = useRef<HTMLDivElement>(null)

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

  // Filtros de Data (Semana / Período / Tudo)
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

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 4000)
  }

  // ── Carregar Registros do Sistema ───────────────────────────
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
  }, [system.id])

  useEffect(() => {
    if (isOpen) {
      fetchRegistros()
    }
  }, [isOpen, fetchRegistros])

  // Fecha dropdown de produtos ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setActiveSearchId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // ── Adicionar Nova Linha ────────────────────────────────────
  const handleAddRow = () => {
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
  }

  const removeRow = (id: string) => {
    const target = registros.find((r) => r.id === id)
    if (target?.isNew) {
      setRegistros((prev) => prev.filter((r) => r.id !== id))
    } else {
      systemDataService.deleteRecord(id)
      setRegistros((prev) => prev.filter((r) => r.id !== id))
      showToast("Registro removido.", "info")
    }
  }

  const updateRow = (id: string, field: keyof SystemStockRecord, value: any) => {
    setRegistros((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r

        let finalValue = value

        if (field === "data" && typeof value === "string") {
          const today = new Date()
          const currentYear = today.getFullYear()
          const currentMonth = today.getMonth() + 1

          if (/^\d{1,2}$/.test(value)) {
            finalValue = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${value.padStart(2, "0")}`
          } else if (/^\d{1,2}\/\d{1,2}$/.test(value)) {
            const [d, m] = value.split("/")
            finalValue = `${currentYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
          } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
            const [d, m, y] = value.split("/")
            finalValue = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
          }
        }

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

        // Mantém quantity sincronizado com entrada ou saida
        const ent = typeof nextRow.entrada === "number" ? nextRow.entrada : 0
        const sai = typeof nextRow.saida === "number" ? nextRow.saida : 0
        nextRow.quantity = ent > 0 ? ent : sai

        return nextRow
      })
    )
  }

  // ── Autocomplete base_codigos ao digitar SKU ───────────────
  const handleSkuInputChange = (id: string, query: string) => {
    updateRow(id, "sku", query.toUpperCase())
    setActiveSearchId(id)
    setSelectedDropdownIdx(0)
    currentSearchQuery.current = query

    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearchingProduct(true)
    searchBaseCodigos(query.trim(), 10).then(({ data }) => {
      if (currentSearchQuery.current === query) {
        setSearchResults(data)
        setIsSearchingProduct(false)
      }
    })
  }

  const handleSelectProduct = (id: string, item: BaseCodigoItem) => {
    setRegistros((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        return {
          ...r,
          sku: item["Código"],
          description: item["Descrição"],
          isDirty: true,
        }
      })
    )
    setActiveSearchId(null)
    setSearchResults([])
  }

  // Validação no blur: se digitou um código exato que existe na base_codigos, auto-preenche a descrição
  const handleSkuBlur = async (id: string, skuVal: string) => {
    const trimmed = (skuVal || "").trim().toUpperCase()
    if (!trimmed) return
    const row = registros.find((r) => r.id === id)
    if (row && !row.description) {
      const { data } = await searchBaseCodigos(trimmed, 5)
      const exact = data.find((d) => d["Código"].toUpperCase() === trimmed)
      if (exact) {
        handleSelectProduct(id, exact)
      }
    }
  }

  // ── Salvar Linhas Alteradas / Novas ─────────────────────────
  const handleSaveRows = async () => {
    const rowsToSave = registros.filter((r) => r.isDirty)
    if (rowsToSave.length === 0) return

    // Validação estrita: produto DEVE existir em base_codigos (description preenchida)
    const semCodigoValido = rowsToSave.find((r) => !r.sku || !r.description)
    if (semCodigoValido) {
      showToast(
        `Apenas produtos existentes em base_codigos são permitidos! Selecione o produto na lista para "${semCodigoValido.sku || "vazio"}".`,
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

      // Persiste no serviço local estruturado
      systemDataService.saveRecordsBatch(sanitized)

      // Atualiza estado local
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
      // 1. Filtro por Modo de Data
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

      // 2. Busca Global
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchSku = (row.sku || "").toLowerCase().includes(q)
        const matchDesc = (row.description || "").toLowerCase().includes(q)
        const matchNf = String(row.nota_fiscal || "").toLowerCase().includes(q)
        const matchPlaca = (row.placa || "").toLowerCase().includes(q)
        const matchObs = (row.observacao || "").toLowerCase().includes(q)
        if (!matchSku && !matchDesc && !matchNf && !matchPlaca && !matchObs) return false
      }

      // 3. Filtros por Coluna
      if (
        colFilters.nota_fiscal &&
        !String(row.nota_fiscal || "").includes(colFilters.nota_fiscal)
      ) {
        return false
      }
      if (
        colFilters.produto &&
        !(row.sku || "").toUpperCase().includes(colFilters.produto.toUpperCase())
      ) {
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
        !(row.transportadora || "")
          .toUpperCase()
          .includes(colFilters.transportadora.toUpperCase())
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

  // ── Importar Recebimentos (Processamento) ────────────────────
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

    // Valida cada SKU na base_codigos
    const skus = Array.from(new Set(validRows.map((r) => r.codigo.trim().toUpperCase())))
    const descMap = new Map<string, string>()

    for (const sku of skus) {
      const { data } = await searchBaseCodigos(sku, 3)
      const exact = data.find((d) => d["Código"].toUpperCase() === sku)
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
          {/* Aba Única: Movimentação Geral (Offline e Histórico omitidos) */}
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
        <AnimatePresence>
          {showColumnFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-[#0b101c] border-b border-slate-800 p-3 shrink-0"
            >
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
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
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
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TABELA DE REGISTROS (EXATA AO G300) ── */}
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
                filteredRegistros.map((row) => {
                  const isReceb = row.origem === "Recebimento"
                  const isSearchActive = activeSearchId === row.id

                  return (
                    <tr
                      key={row.id}
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
                          onChange={(e) => updateRow(row.id, "data", e.target.value)}
                          className="w-full bg-transparent border-none text-xs font-mono text-slate-200 outline-none focus:bg-slate-800/80 rounded px-1.5 py-1 [color-scheme:dark]"
                        />
                      </td>

                      {/* PRODUTO (SKU com busca estrita na base_codigos) */}
                      <td className="px-4 py-2 font-mono font-semibold text-white min-w-[170px] relative">
                        <div className="relative">
                          <input
                            type="text"
                            value={row.sku}
                            onChange={(e) => handleSkuInputChange(row.id, e.target.value)}
                            onBlur={() => handleSkuBlur(row.id, row.sku)}
                            placeholder="Buscar SKU..."
                            className={cn(
                              "w-full bg-transparent border rounded px-2 py-1 text-xs font-mono uppercase outline-none transition-colors",
                              row.sku && !row.description
                                ? "border-amber-500/80 text-amber-300 bg-amber-950/20"
                                : row.description
                                ? "border-slate-800 focus:border-blue-500 text-white"
                                : "border-slate-800 focus:border-blue-500 text-slate-400"
                            )}
                          />
                          {row.description && (
                            <div className="text-[9px] text-slate-500 truncate max-w-[160px] font-sans mt-0.5">
                              {row.description}
                            </div>
                          )}

                          {/* Dropdown de base_codigos */}
                          <AnimatePresence>
                            {isSearchActive && row.sku && (
                              <motion.div
                                ref={productDropdownRef}
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.12 }}
                                className="absolute left-0 top-full mt-1 z-[150] w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
                              >
                                <div className="px-2.5 py-1.5 bg-slate-950 text-[9px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800 flex items-center justify-between">
                                  <span>base_codigos ({searchResults.length})</span>
                                  {isSearchingProduct && (
                                    <span className="text-blue-400 normal-case font-normal animate-pulse">
                                      Buscando...
                                    </span>
                                  )}
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  {searchResults.length === 0 && !isSearchingProduct ? (
                                    <div className="py-3 text-center text-[11px] text-slate-500">
                                      Nenhum produto em base_codigos
                                    </div>
                                  ) : (
                                    searchResults.map((item, idx) => (
                                      <button
                                        key={item["Código"]}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handleSelectProduct(row.id, item)}
                                        onMouseEnter={() => setSelectedDropdownIdx(idx)}
                                        className={cn(
                                          "w-full px-3 py-2 flex items-center justify-between text-left border-b border-slate-800 last:border-0 transition-colors",
                                          selectedDropdownIdx === idx ? "bg-blue-500/20" : "hover:bg-slate-800/60"
                                        )}
                                      >
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-xs font-bold font-mono text-white truncate">
                                            {item["Código"]}
                                          </span>
                                          <span className="text-[10px] text-slate-400 truncate">
                                            {item["Descrição"]}
                                          </span>
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
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>

                      {/* TIPO AVARIA */}
                      <td className="p-0 min-w-[130px]">
                        <CustomSelect
                          value={row.tipo_avaria || ""}
                          disabled={false}
                          onChange={(v) => updateRow(row.id, "tipo_avaria", v)}
                          options={AVARIA_OPTIONS}
                          placeholder="Avaria?"
                        />
                      </td>

                      {/* TURNO */}
                      <td className="px-4 py-2 min-w-[70px]">
                        <input
                          type="number"
                          value={row.turno ?? ""}
                          onChange={(e) =>
                            updateRow(row.id, "turno", e.target.value ? Number(e.target.value) : null)
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
                          onChange={(e) => updateRow(row.id, "entrada", e.target.value)}
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
                          onChange={(e) => updateRow(row.id, "saida", e.target.value)}
                          placeholder="0"
                          className={cn(
                            "w-16 bg-transparent text-xs font-bold font-mono tabular-nums outline-none focus:bg-slate-800/80 rounded py-1",
                            Number(row.saida) > 0 ? "text-rose-400" : "text-slate-600"
                          )}
                        />
                      </td>

                      {/* ORIGEM */}
                      <td className="p-0 min-w-[140px]">
                        <CustomSelect
                          value={row.origem || ""}
                          disabled={false}
                          onChange={(v) => updateRow(row.id, "origem", v)}
                          options={ORIGEM_OPTIONS}
                          placeholder="Origem?"
                        />
                      </td>

                      {/* TRANSP. */}
                      <td className="px-4 py-2 min-w-[110px]">
                        {isReceb ? (
                          <input
                            type="text"
                            value={row.transportadora || ""}
                            onChange={(e) => updateRow(row.id, "transportadora", e.target.value.toUpperCase())}
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
                            onChange={(e) => updateRow(row.id, "nota_fiscal", e.target.value)}
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
                          onClick={() => setObsModalTarget({ id: row.id, value: row.observacao || "" })}
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

                      {/* AÇÃO: DELETAR LINHA */}
                      <td className="px-2 py-2 text-center w-10">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-950/60 hover:text-rose-400 text-slate-600 transition-all"
                          title="Remover linha"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })
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
      <AnimatePresence>
        {obsModalTarget && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3 text-slate-100"
            >
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
                    updateRow(obsModalTarget.id, "observacao", obsModalTarget.value)
                    setObsModalTarget(null)
                  }}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow"
                >
                  Salvar Observação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: IMPORTAR RECEBIMENTOS (COPIAR E COLAR / EXCEL) ── */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0B1120] border border-white/10 rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-4 text-slate-200"
            >
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

                    const updateRowField = (field: keyof ImportRecebimentoRow, val: string) => {
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
                            onChange={(e) => updateRowField("data", e.target.value)}
                            onPaste={(e) => handleSmartPaste(e, 0)}
                            placeholder="AAAA-MM-DD"
                            className="w-full bg-transparent px-3 py-1.5 text-[11px] font-mono text-slate-200 focus:bg-white/[0.04] focus:outline-none"
                          />
                        </div>
                        <div className="border-r border-white/[0.06]">
                          <input
                            type="text"
                            value={row.codigo}
                            onChange={(e) => updateRowField("codigo", e.target.value)}
                            onPaste={(e) => handleSmartPaste(e, 1)}
                            placeholder="SKU..."
                            className="w-full bg-transparent px-3 py-1.5 text-[11px] font-mono text-white font-medium focus:bg-white/[0.04] focus:outline-none uppercase"
                          />
                        </div>
                        <div className="border-r border-white/[0.06]">
                          <input
                            type="text"
                            value={row.avaria}
                            onChange={(e) => updateRowField("avaria", e.target.value)}
                            onPaste={(e) => handleSmartPaste(e, 2)}
                            placeholder="0"
                            className="w-full bg-transparent px-3 py-1.5 text-[11px] font-mono text-center text-emerald-400 focus:bg-white/[0.04] focus:outline-none"
                          />
                        </div>
                        <div className="border-r border-white/[0.06]">
                          <input
                            type="text"
                            value={row.transportadora}
                            onChange={(e) => updateRowField("transportadora", e.target.value)}
                            onPaste={(e) => handleSmartPaste(e, 3)}
                            placeholder="Transp..."
                            className="w-full bg-transparent px-3 py-1.5 text-[11px] font-mono uppercase text-slate-300 focus:bg-white/[0.04] focus:outline-none"
                          />
                        </div>
                        <div className="border-r border-white/[0.06]">
                          <input
                            type="text"
                            value={row.notaFiscal}
                            onChange={(e) => updateRowField("notaFiscal", e.target.value)}
                            onPaste={(e) => handleSmartPaste(e, 4)}
                            placeholder="NF..."
                            className="w-full bg-transparent px-3 py-1.5 text-[11px] font-mono text-slate-300 focus:bg-white/[0.04] focus:outline-none"
                          />
                        </div>
                        <div className="border-r border-white/[0.06]">
                          <input
                            type="text"
                            value={row.lacre}
                            onChange={(e) => updateRowField("lacre", e.target.value)}
                            onPaste={(e) => handleSmartPaste(e, 5)}
                            placeholder="Lacre..."
                            className="w-full bg-transparent px-3 py-1.5 text-[11px] font-mono uppercase text-slate-300 focus:bg-white/[0.04] focus:outline-none"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={row.placa}
                            onChange={(e) => updateRowField("placa", e.target.value)}
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── TOAST FLUTUANTE ── */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className={cn(
              "fixed bottom-6 right-6 z-[300] flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-semibold",
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
