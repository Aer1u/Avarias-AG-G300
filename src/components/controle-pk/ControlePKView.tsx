"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import * as XLSX from "xlsx"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Repeat2,
  X,
  Tv,
  Fan,
  LayoutGrid,
  ArrowRight,
  Plus,
  UploadCloud,
  Download,
  RefreshCw,
  Search,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Loader2,
  Database,
  Calendar,
  Save,
  EllipsisVertical,
  Pencil,
  BarChart3,
  Table2,
  Lock,
  Shield,
  ShieldAlert,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuthz } from "@/components/IAM/useAuthz"
import { GlobalAdminBar } from "@/components/IAM/GlobalAdminBar"
import { ControlePKDashboard } from "./ControlePKDashboard"
import {
  ControlePKRow,
  TipoEmbarque,
  AggregatedAvisoUpdate,
  ParseResult,
  normalizeAviso,
  classifyTipoEmbarque,
  parseWorkbookBuffer,
  parseDelimitedText,
  aggregatePkByPdDestino,
  calculateDuration,
  formatDateBr,
  getTodayIsoLocal,
} from "./pkSpreadsheetParser"

const MODULES = [
  {
    id: "g300",
    name: "G300",
    subtitle: "Avarias e Mapeamento G300",
    href: "/g300/avarias",
    icon: Tv,
    iconBg: "bg-blue-600",
    hoverBorder: "hover:border-blue-500/60 hover:bg-blue-500/10",
    textAccent: "text-blue-400",
    active: false,
  },
  {
    id: "mkbr",
    name: "MKBR",
    subtitle: "Processos da Linha BR",
    href: "/mkbr",
    icon: Fan,
    iconBg: "bg-emerald-600",
    hoverBorder: "border-emerald-500/60 bg-emerald-500/10",
    textAccent: "text-emerald-400",
    active: true,
  },
  {
    id: "mapeamentos",
    name: "Mapeamentos",
    subtitle: "Mapeamento Livre do Armazém",
    href: "/mapeamentos",
    icon: LayoutGrid,
    iconBg: "bg-purple-600",
    hoverBorder: "hover:border-purple-500/60 hover:bg-purple-500/10",
    textAccent: "text-purple-400",
    active: false,
  },
]

const SQL_SETUP_SCRIPT = `CREATE TABLE IF NOT EXISTS public.controle_pk (
  id BIGSERIAL PRIMARY KEY,
  aviso TEXT NOT NULL UNIQUE,
  local TEXT DEFAULT 'PKBR',
  data_separacao DATE DEFAULT CURRENT_DATE,
  pessoa TEXT,
  pecas NUMERIC NOT NULL DEFAULT 0,
  skus INTEGER NOT NULL DEFAULT 0,
  inicio TEXT,
  final TEXT,
  tipo_de_embarque TEXT CHECK (tipo_de_embarque IN ('Simples', 'Normal', 'Complexa') OR tipo_de_embarque IS NULL),
  conferente TEXT,
  conferencia_inicial TEXT,
  conferencia_final TEXT,
  empresa TEXT,
  notas TEXT,
  data_faturamento DATE,
  qtde_notas INTEGER,
  solicitante TEXT,
  embalador TEXT,
  horario_inicio_embalagem TEXT,
  horario_final_embalagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.controle_pk
  ADD COLUMN IF NOT EXISTS local TEXT DEFAULT 'PKBR',
  ADD COLUMN IF NOT EXISTS data_separacao DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS conferente TEXT,
  ADD COLUMN IF NOT EXISTS conferencia_inicial TEXT,
  ADD COLUMN IF NOT EXISTS conferencia_final TEXT,
  ADD COLUMN IF NOT EXISTS empresa TEXT,
  ADD COLUMN IF NOT EXISTS notas TEXT,
  ADD COLUMN IF NOT EXISTS data_faturamento DATE,
  ADD COLUMN IF NOT EXISTS qtde_notas INTEGER,
  ADD COLUMN IF NOT EXISTS solicitante TEXT,
  ADD COLUMN IF NOT EXISTS embalador TEXT,
  ADD COLUMN IF NOT EXISTS horario_inicio_embalagem TEXT,
  ADD COLUMN IF NOT EXISTS horario_final_embalagem TEXT;

UPDATE public.controle_pk
SET data_separacao = (created_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE data_separacao IS NULL;

CREATE INDEX IF NOT EXISTS idx_controle_pk_data_separacao ON public.controle_pk (data_separacao DESC);
CREATE INDEX IF NOT EXISTS idx_controle_pk_local ON public.controle_pk (local);

ALTER TABLE public.controle_pk ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all select on controle_pk" ON public.controle_pk;
CREATE POLICY "Allow all select on controle_pk" ON public.controle_pk FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow all insert on controle_pk" ON public.controle_pk;
CREATE POLICY "Allow all insert on controle_pk" ON public.controle_pk FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all update on controle_pk" ON public.controle_pk;
CREATE POLICY "Allow all update on controle_pk" ON public.controle_pk FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all delete on controle_pk" ON public.controle_pk;
CREATE POLICY "Allow all delete on controle_pk" ON public.controle_pk FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.controle_pk TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.controle_pk_id_seq TO anon, authenticated;`

const REQUIRED_COLUMNS: (keyof ControlePKRow)[] = [
  "local",
  "data_separacao",
  "conferente",
  "conferencia_inicial",
  "conferencia_final",
  "empresa",
  "notas",
  "data_faturamento",
  "qtde_notas",
  "solicitante",
  "embalador",
  "horario_inicio_embalagem",
  "horario_final_embalagem",
]

function hasMissingColumns(rows: ControlePKRow[]): boolean {
  if (rows.length === 0) return false
  const first = rows[0]
  return REQUIRED_COLUMNS.some(
    (col) => !Object.prototype.hasOwnProperty.call(first, col)
  )
}


const MONTHS_PT = [
  { month: 1, short: "JAN", name: "Janeiro" },
  { month: 2, short: "FEV", name: "Fevereiro" },
  { month: 3, short: "MAR", name: "Março" },
  { month: 4, short: "ABR", name: "Abril" },
  { month: 5, short: "MAI", name: "Maio" },
  { month: 6, short: "JUN", name: "Junho" },
  { month: 7, short: "JUL", name: "Julho" },
  { month: 8, short: "AGO", name: "Agosto" },
  { month: 9, short: "SET", name: "Setembro" },
  { month: 10, short: "OUT", name: "Outubro" },
  { month: 11, short: "NOV", name: "Novembro" },
  { month: 12, short: "DEZ", name: "Dezembro" },
] as const

function getRowYearMonthDay(
  row: ControlePKRow
): { year: number; month: number; day: number } | null {
  const iso = (row.data_separacao || row.created_at?.slice(0, 10) || "").trim()
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }
  return { year, month, day }
}

function getMiniCalendarCells(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d)
  }
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }
  return cells
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function getRowIsoDate(row: ControlePKRow): string | null {
  const ymd = getRowYearMonthDay(row)
  return ymd ? toIsoDate(ymd.year, ymd.month, ymd.day) : null
}

function shiftIsoDate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y, m - 1, d + deltaDays)
  return toIsoDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

function getWeekRangeFromIso(iso: string): {
  startIso: string
  endIso: string
  label: string
} {
  const [y, m, d] = iso.split("-").map(Number)
  const anchor = new Date(y, m - 1, d)
  const dayOfWeek = anchor.getDay()
  const startDt = new Date(y, m - 1, d - dayOfWeek)
  const endDt = new Date(y, m - 1, d + (6 - dayOfWeek))
  const startIso = toIsoDate(
    startDt.getFullYear(),
    startDt.getMonth() + 1,
    startDt.getDate()
  )
  const endIso = toIsoDate(
    endDt.getFullYear(),
    endDt.getMonth() + 1,
    endDt.getDate()
  )
  const fmtShort = (dt: Date) =>
    `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`
  return {
    startIso,
    endIso,
    label: `${fmtShort(startDt)} – ${fmtShort(endDt)}/${endDt.getFullYear()}`,
  }
}

interface EditAvisoDraft {
  aviso: string
  data_separacao: string
  pessoa: string
  pecas: string
  skus: string
  inicio: string
  final: string
  tipo_de_embarque: "" | TipoEmbarque
  conferente: string
  conferencia_inicial: string
  conferencia_final: string
  empresa: string
  qtde_notas: string
  data_faturamento: string
  solicitante: string
  notas: string
  embalador: string
  horario_inicio_embalagem: string
  horario_final_embalagem: string
}

type FilterTab =
  | "todos"
  | "pendentes"
  | "atualizados"
  | "Simples"
  | "Normal"
  | "Complexa"

export function ControlePKView() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const actionsMenuRef = useRef<HTMLDivElement>(null)

  const [showModuleModal, setShowModuleModal] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [rows, setRows] = useState<ControlePKRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [columnsMissing, setColumnsMissing] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info"
    text: string
  } | null>(null)

  // Manual aviso creation (single or bulk via modal)
  const [showAddModal, setShowAddModal] = useState(false)
  const [novoAvisoInput, setNovoAvisoInput] = useState("")
  const [isAddingAviso, setIsAddingAviso] = useState(false)

  // Expandable row details (read-only view; edit via Edit modal)
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null)

  // Edit modal for all columns of controle_pk
  const [editingRow, setEditingRow] = useState<ControlePKRow | null>(null)
  const [editDraft, setEditDraft] = useState<EditAvisoDraft>({
    aviso: "",
    data_separacao: "",
    pessoa: "",
    pecas: "0",
    skus: "0",
    inicio: "",
    final: "",
    tipo_de_embarque: "",
    conferente: "",
    conferencia_inicial: "",
    conferencia_final: "",
    empresa: "",
    qtde_notas: "",
    data_faturamento: "",
    solicitante: "",
    notas: "",
    embalador: "",
    horario_inicio_embalagem: "",
    horario_final_embalagem: "",
  })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Mini calendar month/year filter (defaults to current month & year)
  const [todayInfo] = useState(() => {
    const [y, m, d] = getTodayIsoLocal().split("-").map(Number)
    return { year: y, month: m, day: d }
  })
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const [y] = getTodayIsoLocal().split("-").map(Number)
    return y
  })
  const [selectedMonth, setSelectedMonth] = useState<number | null>(() => {
    const [, m] = getTodayIsoLocal().split("-").map(Number)
    return m
  })
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedWeekAnchorIso, setSelectedWeekAnchorIso] = useState<
    string | null
  >(null)
  const [showCalendars, setShowCalendars] = useState(false)

  // Main navigation tab (Dashboard consolidated view vs Table view)
  const [mainTab, setMainTab] = useState<"dashboard" | "tabela">("dashboard")

  // Governança e Controle de Acesso (IAM)
  const {
    activeUser,
    authorityLevel,
    isPlatformOwner,
    isPlatformAdmin,
    can
  } = useAuthz(undefined, "ws_mkbr")

  // Permissões granulares do módulo Controle PK vinculadas ao IAM:
  // 1. O Proprietário Global (ProfissionalTrgm@gmail.com) e Admins possuem controle total
  const isMasterOrAdmin = isPlatformOwner || isPlatformAdmin || authorityLevel <= 3

  // 2. Edição: permitido para Dono/Admins ou papéis com permissão explícita no IAM
  const canEdit = isMasterOrAdmin || can("pk.record.manage") || can("object.edit")

  // 3. Visão do Dashboard: aberta por padrão no workspace, gerenciada pelo IAM
  const canViewDashboard = true

  // 4. Visão da Tabela: aberta por padrão no workspace, gerenciada pelo IAM
  const canViewTable = true

  // Sincroniza a aba ativa caso o usuário possua acesso a apenas uma das abas
  useEffect(() => {
    if (canViewTable && !canViewDashboard && mainTab === "dashboard") {
      setMainTab("tabela")
    } else if (!canViewTable && canViewDashboard && mainTab === "tabela") {
      setMainTab("dashboard")
    }
  }, [canViewTable, canViewDashboard, mainTab])

  // Filters
  const [search, setSearch] = useState("")
  const [filterTab, setFilterTab] = useState<FilterTab>("todos")

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFileName, setImportFileName] = useState<string | null>(null)
  const [importPasteText, setImportPasteText] = useState("")
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [isApplyingImport, setIsApplyingImport] = useState(false)

  // Floating tooltip for Tempo de Separação / Conferência / Embalagem
  const [hoverTooltip, setHoverTooltip] = useState<{
    title: string
    inicio: string | null
    final: string | null
    humanDuration: string | null
    accent: "sky" | "emerald" | "amber"
    top: number
    left: number
    placeBelow: boolean
  } | null>(null)

  const showToast = useCallback(
    (type: "success" | "error" | "info", text: string) => {
      setFeedback({ type, text })
    },
    []
  )

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 5000)
    return () => clearTimeout(t)
  }, [feedback])

  const hasHoverTooltip = hoverTooltip !== null

  useEffect(() => {
    if (!hasHoverTooltip) return
    const clearTooltip = () => setHoverTooltip(null)
    window.addEventListener("scroll", clearTooltip, { capture: true, passive: true })
    return () => {
      window.removeEventListener("scroll", clearTooltip, { capture: true })
    }
  }, [hasHoverTooltip])

  useEffect(() => {
    if (!showActionsMenu) return
    const handlePointerDown = (e: MouseEvent) => {
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(e.target as Node)
      ) {
        setShowActionsMenu(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowActionsMenu(false)
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [showActionsMenu])

  const loadAllControlePkRows = useCallback(async () => {
    const PAGE_SIZE = 1000
    const allRows: ControlePKRow[] = []
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from("controle_pk")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw error
      const batch = (data as ControlePKRow[]) || []
      allRows.push(...batch)
      if (batch.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    return allRows
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const loaded = await loadAllControlePkRows()
      setTableMissing(false)
      setColumnsMissing(hasMissingColumns(loaded))
      setRows(loaded)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao carregar Controle PK."
      if (
        (typeof err === "object" &&
          err !== null &&
          "code" in err &&
          ((err as { code?: string }).code === "PGRST205" ||
            (err as { code?: string }).code === "42P01")) ||
        message.includes("controle_pk")
      ) {
        setTableMissing(true)
        setColumnsMissing(false)
        setRows([])
        return
      }
      showToast("error", message)
    } finally {
      setLoading(false)
    }
  }, [loadAllControlePkRows, showToast])

  useEffect(() => {
    let active = true
    loadAllControlePkRows()
      .then((loaded) => {
        if (!active) return
        setTableMissing(false)
        setColumnsMissing(hasMissingColumns(loaded))
        setRows(loaded)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        const message =
          err instanceof Error ? err.message : "Erro ao carregar Controle PK."
        if (
          (typeof err === "object" &&
            err !== null &&
            "code" in err &&
            ((err as { code?: string }).code === "PGRST205" ||
              (err as { code?: string }).code === "42P01")) ||
          message.includes("controle_pk")
        ) {
          setTableMissing(true)
          setColumnsMissing(false)
          setRows([])
        } else {
          showToast("error", message)
        }
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadAllControlePkRows, showToast])

  const addAvisosPreview = useMemo(() => {
    const tokens = novoAvisoInput
      .split(/[\n,;\t\s]+/)
      .map((t) => normalizeAviso(t))
      .filter(Boolean)
    const uniqueTokens = Array.from(new Set(tokens))
    const existingSet = new Set(rows.map((r) => normalizeAviso(r.aviso)))
    const toInsert = uniqueTokens.filter((a) => !existingSet.has(a))
    const duplicates = uniqueTokens.length - toInsert.length
    return { uniqueTokens, toInsert, duplicates }
  }, [novoAvisoInput, rows])

  // Add one or multiple avisos manually
  const handleAddAvisos = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!canEdit) {
      showToast("error", "Ação não permitida: seu usuário possui perfil de apenas leitura.")
      return
    }
    const { uniqueTokens, toInsert, duplicates } = addAvisosPreview
    if (uniqueTokens.length === 0) return

    if (toInsert.length === 0) {
      showToast("info", "Todos os avisos informados já estão cadastrados.")
      return
    }

    setIsAddingAviso(true)
    try {
      const dateValue = getTodayIsoLocal()
      const payload = toInsert.map((aviso) => ({
        aviso,
        local: "PKBR",
        data_separacao: dateValue,
        pecas: 0,
        skus: 0,
      }))

      const { error } = await supabase.from("controle_pk").insert(payload)
      if (error) throw error

      setNovoAvisoInput("")
      setShowAddModal(false)
      if (selectedWeekAnchorIso) {
        const range = getWeekRangeFromIso(selectedWeekAnchorIso)
        if (dateValue < range.startIso || dateValue > range.endIso) {
          const todayRange = getWeekRangeFromIso(dateValue)
          setSelectedWeekAnchorIso(todayRange.startIso)
          setSelectedYear(todayInfo.year)
          setSelectedMonth(todayInfo.month)
          setSelectedDay(null)
        }
      } else if (
        (selectedMonth !== null &&
          (selectedYear !== todayInfo.year ||
            selectedMonth !== todayInfo.month)) ||
        (selectedDay !== null && selectedDay !== todayInfo.day)
      ) {
        setSelectedYear(todayInfo.year)
        setSelectedMonth(todayInfo.month)
        setSelectedDay(null)
      }
      await fetchRows()
      const dupSuffix =
        duplicates > 0 ? ` (${duplicates} já cadastrado${duplicates > 1 ? "s" : ""})` : ""
      showToast(
        "success",
        toInsert.length === 1
          ? `Aviso ${toInsert[0]} adicionado.${dupSuffix}`
          : `${toInsert.length} avisos adicionados.${dupSuffix}`
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao salvar aviso."
      if (
        message.includes("PGRST204") ||
        REQUIRED_COLUMNS.some((col) => message.includes(col))
      ) {
        setColumnsMissing(true)
      }
      showToast("error", message)
    } finally {
      setIsAddingAviso(false)
    }
  }

  const handleToggleExpand = (row: ControlePKRow) => {
    setExpandedRowId((prev) => (prev === row.id ? null : row.id))
  }

  const handleOpenEditModal = (row: ControlePKRow) => {
    setEditingRow(row)
    setEditDraft({
      aviso: row.aviso,
      data_separacao: row.data_separacao || "",
      pessoa: row.pessoa || "",
      pecas: String(Number(row.pecas ?? 0)),
      skus: String(Number(row.skus ?? 0)),
      inicio: row.inicio || "",
      final: row.final || "",
      tipo_de_embarque: row.tipo_de_embarque || "",
      conferente: row.conferente || "",
      conferencia_inicial: row.conferencia_inicial || "",
      conferencia_final: row.conferencia_final || "",
      empresa: row.empresa || "",
      qtde_notas:
        row.qtde_notas !== null && row.qtde_notas !== undefined
          ? String(row.qtde_notas)
          : "",
      data_faturamento: row.data_faturamento || "",
      solicitante: row.solicitante || "",
      notas: row.notas || "",
      embalador: row.embalador || "",
      horario_inicio_embalagem: row.horario_inicio_embalagem || "",
      horario_final_embalagem: row.horario_final_embalagem || "",
    })
  }

  const handleSaveEditModal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) {
      showToast("error", "Ação não permitida: seu usuário possui perfil de apenas leitura.")
      return
    }
    if (!editingRow) return
    const normalizedAviso = normalizeAviso(editDraft.aviso)
    if (!normalizedAviso) {
      showToast("error", "O número do aviso não pode ficar vazio.")
      return
    }

    const duplicate = rows.find(
      (r) =>
        r.id !== editingRow.id && normalizeAviso(r.aviso) === normalizedAviso
    )
    if (duplicate) {
      showToast("error", `Já existe outro registro com o aviso ${normalizedAviso}.`)
      return
    }

    setIsSavingEdit(true)
    try {
      const parsedPecas =
        editDraft.pecas.trim() !== ""
          ? Math.max(0, Math.round(Number(editDraft.pecas)))
          : 0
      const parsedSkus =
        editDraft.skus.trim() !== ""
          ? Math.max(0, Math.round(Number(editDraft.skus)))
          : 0
      const safePecas = Number.isFinite(parsedPecas) ? parsedPecas : 0
      const safeSkus = Number.isFinite(parsedSkus) ? parsedSkus : 0
      const parsedQtdeNotas =
        editDraft.qtde_notas.trim() !== ""
          ? Math.max(0, Math.round(Number(editDraft.qtde_notas)))
          : null

      const resolvedTipo: TipoEmbarque | null =
        editDraft.tipo_de_embarque || classifyTipoEmbarque(safeSkus)

      const payload = {
        aviso: normalizedAviso,
        data_separacao: editDraft.data_separacao.trim() || null,
        pessoa: editDraft.pessoa.trim() || null,
        pecas: safePecas,
        skus: safeSkus,
        inicio: editDraft.inicio.trim() || null,
        final: editDraft.final.trim() || null,
        tipo_de_embarque: resolvedTipo,
        conferente: editDraft.conferente.trim() || null,
        conferencia_inicial: editDraft.conferencia_inicial.trim() || null,
        conferencia_final: editDraft.conferencia_final.trim() || null,
        empresa: editDraft.empresa.trim() || null,
        qtde_notas:
          parsedQtdeNotas !== null && Number.isFinite(parsedQtdeNotas)
            ? parsedQtdeNotas
            : null,
        data_faturamento: editDraft.data_faturamento.trim() || null,
        solicitante: editDraft.solicitante.trim() || null,
        notas: editDraft.notas.trim() || null,
        embalador: editDraft.embalador.trim() || null,
        horario_inicio_embalagem:
          editDraft.horario_inicio_embalagem.trim() || null,
        horario_final_embalagem:
          editDraft.horario_final_embalagem.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("controle_pk")
        .update(payload)
        .eq("id", editingRow.id)
      if (error) throw error

      setRows((prev) =>
        prev.map((r) => (r.id === editingRow.id ? { ...r, ...payload } : r))
      )
      showToast("success", `Aviso ${normalizedAviso} atualizado.`)
      setEditingRow(null)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erro ao atualizar aviso."
      if (
        msg.includes("PGRST204") ||
        REQUIRED_COLUMNS.some((col) => msg.includes(col))
      ) {
        setColumnsMissing(true)
      }
      showToast("error", msg)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteRow = async (row: ControlePKRow) => {
    if (!canEdit) {
      showToast("error", "Ação não permitida: seu usuário possui perfil de apenas leitura.")
      return
    }
    try {
      const { error } = await supabase
        .from("controle_pk")
        .delete()
        .eq("id", row.id)
      if (error) throw error
      if (expandedRowId === row.id) {
        setExpandedRowId(null)
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      showToast("info", `Aviso ${row.aviso} removido.`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao remover aviso."
      showToast("error", message)
    }
  }

  // Handle spreadsheet file upload
  const handleFileSelected = (file: File) => {
    setImportFileName(file.name)
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const buf = evt.target?.result
          if (!(buf instanceof ArrayBuffer)) return
          const parsed = parseWorkbookBuffer(buf)
          setParseResult(parsed)
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Falha ao ler arquivo Excel."
          showToast("error", msg)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (evt) => {
        const txt = String(evt.target?.result ?? "")
        setImportPasteText(txt)
        setParseResult(parseDelimitedText(txt))
      }
      reader.readAsText(file, "UTF-8")
    }
  }

  const handlePasteTextChange = (txt: string) => {
    setImportPasteText(txt)
    setImportFileName(null)
    if (txt.trim()) {
      setParseResult(parseDelimitedText(txt))
    } else {
      setParseResult(null)
    }
  }

  // Preview aggregation against currently registered avisos (matching PD destino / PD origem)
  const importAggregation = useMemo(() => {
    if (!parseResult || parseResult.rows.length === 0) {
      return {
        matchedUpdates: [] as AggregatedAvisoUpdate[],
        unmatchedAvisos: [] as string[],
      }
    }
    const registeredAvisos = rows.map((r) => r.aviso)
    return aggregatePkByPdDestino(parseResult.rows, registeredAvisos)
  }, [parseResult, rows])

  const handleApplyImport = async () => {
    if (!canEdit) {
      showToast("error", "Ação não permitida: seu usuário possui perfil de apenas leitura.")
      return
    }
    const updates = importAggregation.matchedUpdates
    if (updates.length === 0) {
      showToast(
        "info",
        "Nenhum aviso cadastrado foi encontrado nas colunas PD destino ou PD origem da planilha."
      )
      return
    }

    setIsApplyingImport(true)
    try {
      const nowIso = new Date().toISOString()
      const rowByAviso = new Map(
        rows.map((r) => [normalizeAviso(r.aviso), r] as const)
      )

      const CHUNK_SIZE = 15
      let updatedCount = 0

      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE)
        const chunkResults = await Promise.all(
          chunk.map(async (u) => {
            const target = rowByAviso.get(normalizeAviso(u.aviso))
            if (!target) return null

            const updatePayload: Record<string, unknown> = {
              local: "PKBR",
              updated_at: nowIso,
            }
            if (u.hasSeparacao) {
              updatePayload.pessoa = u.pessoa || null
              updatePayload.pecas = u.pecas
              updatePayload.skus = u.skus
              updatePayload.inicio = u.inicio
              updatePayload.final = u.final
              updatePayload.tipo_de_embarque = u.tipo_de_embarque
              if (u.data_separacao) {
                updatePayload.data_separacao = u.data_separacao
              } else if (!target.data_separacao) {
                updatePayload.data_separacao =
                  target.created_at?.slice(0, 10) || getTodayIsoLocal()
              }
            }
            if (u.hasConferencia) {
              updatePayload.conferente = u.conferente || null
              updatePayload.conferencia_inicial = u.conferencia_inicial
              updatePayload.conferencia_final = u.conferencia_final
            }

            const { error } = await supabase
              .from("controle_pk")
              .update(updatePayload)
              .eq("id", target.id)
            if (error) throw error
            return u.aviso
          })
        )
        updatedCount += chunkResults.filter(Boolean).length
      }

      await fetchRows()
      setShowImportModal(false)
      setParseResult(null)
      setImportPasteText("")
      setImportFileName(null)
      showToast(
        "success",
        `${updatedCount} ${updatedCount === 1 ? "aviso atualizado" : "avisos atualizados"} (PD destino / PD origem).`
      )
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Erro ao atualizar registros no Supabase."
      if (
        msg.includes("PGRST204") ||
        REQUIRED_COLUMNS.some((col) => msg.includes(col))
      ) {
        setColumnsMissing(true)
      }
      showToast("error", msg)
    } finally {
      setIsApplyingImport(false)
    }
  }

  // Month counts, per-day counts (12x31) & period-filtered rows (drives KPIs, tabs, table & export)
  const { monthCounts, monthDayCounts } = useMemo(() => {
    const mCounts = new Array<number>(13).fill(0)
    const dCounts = Array.from({ length: 13 }, () => new Array<number>(32).fill(0))
    for (const r of rows) {
      const ymd = getRowYearMonthDay(r)
      if (ymd && ymd.year === selectedYear) {
        mCounts[ymd.month] += 1
        dCounts[ymd.month][ymd.day] += 1
      }
    }
    return { monthCounts: mCounts, monthDayCounts: dCounts }
  }, [rows, selectedYear])

  const activeWeekRange = useMemo(
    () =>
      selectedWeekAnchorIso
        ? getWeekRangeFromIso(selectedWeekAnchorIso)
        : null,
    [selectedWeekAnchorIso]
  )

  const selectWeekFromIso = useCallback((iso: string) => {
    const range = getWeekRangeFromIso(iso)
    const [y, m] = iso.split("-").map(Number)
    setSelectedWeekAnchorIso(range.startIso)
    setSelectedYear(y)
    setSelectedMonth(m)
    setSelectedDay(null)
  }, [])

  const monthOnlyRows = useMemo(() => {
    if (selectedMonth === null) return rows
    return rows.filter((r) => {
      const ymd = getRowYearMonthDay(r)
      return (
        ymd !== null && ymd.year === selectedYear && ymd.month === selectedMonth
      )
    })
  }, [rows, selectedYear, selectedMonth])

  const periodFilteredRows = useMemo(() => {
    if (activeWeekRange) {
      return rows.filter((r) => {
        const iso = getRowIsoDate(r)
        return (
          iso !== null &&
          iso >= activeWeekRange.startIso &&
          iso <= activeWeekRange.endIso
        )
      })
    }
    if (selectedMonth === null || selectedDay === null) return monthOnlyRows
    return monthOnlyRows.filter((r) => {
      const ymd = getRowYearMonthDay(r)
      return ymd !== null && ymd.day === selectedDay
    })
  }, [activeWeekRange, rows, monthOnlyRows, selectedMonth, selectedDay])

  // Metrics & Filtering (scoped to selected period)
  const stats = useMemo(() => {
    const total = periodFilteredRows.length
    const atualizados = periodFilteredRows.filter(
      (r) => r.skus > 0 || Boolean(r.pessoa) || Boolean(r.conferente)
    ).length
    const pendentes = total - atualizados
    const pecas = periodFilteredRows.reduce(
      (s, r) => s + (Number(r.pecas) || 0),
      0
    )
    const skus = periodFilteredRows.reduce(
      (s, r) => s + (Number(r.skus) || 0),
      0
    )
    const simples = periodFilteredRows.filter(
      (r) => r.tipo_de_embarque === "Simples"
    ).length
    const normal = periodFilteredRows.filter(
      (r) => r.tipo_de_embarque === "Normal"
    ).length
    const complexa = periodFilteredRows.filter(
      (r) => r.tipo_de_embarque === "Complexa"
    ).length
    return {
      total,
      atualizados,
      pendentes,
      pecas,
      skus,
      simples,
      normal,
      complexa,
    }
  }, [periodFilteredRows])

  const filteredRows = useMemo(() => {
    let list = periodFilteredRows
    if (filterTab === "pendentes") {
      list = list.filter((r) => r.skus === 0 && !r.pessoa && !r.conferente)
    } else if (filterTab === "atualizados") {
      list = list.filter(
        (r) => r.skus > 0 || Boolean(r.pessoa) || Boolean(r.conferente)
      )
    } else if (
      filterTab === "Simples" ||
      filterTab === "Normal" ||
      filterTab === "Complexa"
    ) {
      list = list.filter((r) => r.tipo_de_embarque === filterTab)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.aviso.toLowerCase().includes(q) ||
          formatDateBr(r.data_separacao || r.created_at)
            .toLowerCase()
            .includes(q) ||
          (r.empresa || "").toLowerCase().includes(q) ||
          (r.notas || "").toLowerCase().includes(q) ||
          (r.pessoa || "").toLowerCase().includes(q) ||
          (r.conferente || "").toLowerCase().includes(q) ||
          (r.solicitante || "").toLowerCase().includes(q) ||
          (r.embalador || "").toLowerCase().includes(q) ||
          (r.tipo_de_embarque || "").toLowerCase().includes(q)
      )
    }
    return list
  }, [periodFilteredRows, filterTab, search])

  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      showToast("info", "Não há registros visíveis para exportar.")
      return
    }
    const dataToExport = filteredRows.map((r) => {
      const sepDur = calculateDuration(r.inicio, r.final)
      const confDur = calculateDuration(
        r.conferencia_inicial,
        r.conferencia_final
      )
      const embDur = calculateDuration(
        r.horario_inicio_embalagem,
        r.horario_final_embalagem
      )
      return {
        Aviso: r.aviso,
        "Data da Separação":
          formatDateBr(r.data_separacao || r.created_at) || "",
        Pessoa: r.pessoa || "",
        Peças: r.pecas,
        SKUs: r.skus,
        "Início Separação": r.inicio || "",
        "Final Separação": r.final || "",
        "Tempo de Separação": sepDur?.formatted || "",
        "Tipo de Embarque": r.tipo_de_embarque || "",
        Conferente: r.conferente || "",
        "Conferência Inicial": r.conferencia_inicial || "",
        "Conferência Final": r.conferencia_final || "",
        "Tempo de Conferência": confDur?.formatted || "",
        Empresa: r.empresa || "",
        Notas: r.notas || "",
        "Data Faturamento": formatDateBr(r.data_faturamento) || "",
        "Qtde. Notas": r.qtde_notas ?? "",
        Solicitante: r.solicitante || "",
        Embalador: r.embalador || "",
        "Horário Início Embalagem": r.horario_inicio_embalagem || "",
        "Horário Final Embalagem": r.horario_final_embalagem || "",
        "Tempo de Embalagem": embDur?.formatted || "",
      }
    })
    const ws = XLSX.utils.json_to_sheet(dataToExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Controle PK")
    XLSX.writeFile(
      wb,
      `Controle_PK_${new Date().toISOString().split("T")[0]}.xlsx`
    )
  }

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SQL_SETUP_SCRIPT)
      setCopiedSql(true)
      setTimeout(() => setCopiedSql(false), 2500)
    } catch {
      showToast("error", "Não foi possível copiar automaticamente.")
    }
  }

  const splitPeopleNames = (raw: string | null | undefined): string[] => {
    if (!raw) return []
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }

  const renderPeopleBadgeCell = (
    raw: string | null | undefined,
    accent: "sky" | "emerald"
  ) => {
    const people = splitPeopleNames(raw)
    if (people.length === 0) {
      return <span className="text-slate-600 font-light">—</span>
    }
    const avatarBg =
      accent === "sky"
        ? "bg-sky-500/18 text-sky-300"
        : "bg-emerald-500/18 text-emerald-300"
    const label = people.length === 1 ? people[0] : `${people.length} pessoas`
    return (
      <div className="flex items-center gap-1.5" title={people.join(", ")}>
        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center font-medium text-[10px] tabular-nums shrink-0 ${avatarBg}`}
        >
          {people.length}
        </div>
        <span className="text-slate-200 font-light text-[11px] truncate max-w-[115px] cursor-help">
          {label}
        </span>
      </div>
    )
  }

  const renderTipoEmbarqueBadge = (tipo: ControlePKRow["tipo_de_embarque"]) => {
    if (!tipo) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.04] text-[11px] font-light text-slate-400 whitespace-nowrap">
          Não definido
        </span>
      )
    }
    if (tipo === "Simples") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/12 text-[11px] font-normal text-emerald-300 whitespace-nowrap">
          Simples
        </span>
      )
    }
    if (tipo === "Normal") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-sky-500/12 text-[11px] font-normal text-sky-300 whitespace-nowrap">
          Normal
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-500/12 text-[11px] font-normal text-rose-300 whitespace-nowrap">
        Complexa
      </span>
    )
  }

  const openTimeTooltip = (
    el: HTMLElement,
    title: string,
    inicio: string | null,
    final: string | null,
    humanDuration: string | null,
    accent: "sky" | "emerald" | "amber"
  ) => {
    const rect = el.getBoundingClientRect()
    const placeBelow = rect.top < 120
    const clampedLeft = Math.min(
      Math.max(rect.left + rect.width / 2, 125),
      typeof window !== "undefined" ? window.innerWidth - 125 : rect.left
    )
    setHoverTooltip({
      title,
      inicio,
      final,
      humanDuration,
      accent,
      top: placeBelow ? rect.bottom + 8 : rect.top - 8,
      left: clampedLeft,
      placeBelow,
    })
  }

  const renderDurationCell = (
    inicio: string | null,
    final: string | null,
    title: string,
    accent: "sky" | "emerald" | "amber"
  ) => {
    if (!inicio && !final) {
      return <span className="text-slate-600 font-light">—</span>
    }

    const dur = calculateDuration(inicio, final)
    const accentClasses =
      accent === "sky"
        ? "bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
        : accent === "amber"
          ? "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
          : "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"

    return (
      <div
        tabIndex={0}
        onMouseEnter={(e) =>
          openTimeTooltip(
            e.currentTarget,
            title,
            inicio,
            final,
            dur?.human || null,
            accent
          )
        }
        onFocus={(e) =>
          openTimeTooltip(
            e.currentTarget,
            title,
            inicio,
            final,
            dur?.human || null,
            accent
          )
        }
        onMouseLeave={() => setHoverTooltip(null)}
        onBlur={() => setHoverTooltip(null)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-light tabular-nums cursor-default transition-colors outline-none whitespace-nowrap ${accentClasses}`}
      >
        <Clock size={10} className="opacity-70 shrink-0" />
        <span>{dur ? dur.formatted : "Incompleto"}</span>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col bg-[#080d18] text-slate-200 font-light"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 35% at 50% -10%, rgba(16,185,129,0.07), rgba(56,189,248,0.05) 45%, transparent 75%)",
      }}
    >
      <GlobalAdminBar currentWorkspaceId="ws_mkbr" />

      {/* Menu superior */}
      <header className="relative z-20 w-full border-b border-white/[0.06] bg-[#080d18]/85 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => router.push("/mkbr")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 -ml-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] text-xs font-normal transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ChevronLeft size={14} />
              <span>Voltar</span>
            </button>

            <div className="h-4 w-px bg-white/[0.08] hidden sm:block" />

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-medium text-emerald-400">MKBR</span>
              <span className="text-slate-600 text-xs">/</span>
              <h1 className="text-base font-normal text-white tracking-tight">
                Controle PK
              </h1>
            </div>
          </div>

          {(canViewDashboard || canViewTable) && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.03] shrink-0">
              {canViewDashboard && (
                <button
                  type="button"
                  onClick={() => setMainTab("dashboard")}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    mainTab === "dashboard"
                      ? "bg-emerald-500/18 text-emerald-200 font-normal"
                      : "text-slate-400 font-light hover:text-slate-200 hover:bg-white/[0.04]"
                  }`}
                >
                  <BarChart3
                    size={12}
                    className={mainTab === "dashboard" ? "text-emerald-300" : ""}
                  />
                  <span>Dashboard</span>
                </button>
              )}

              {canViewTable && (
                <button
                  type="button"
                  onClick={() => setMainTab("tabela")}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    mainTab === "tabela"
                      ? "bg-sky-500/18 text-sky-200 font-normal"
                      : "text-slate-400 font-light hover:text-slate-200 hover:bg-white/[0.04]"
                  }`}
                >
                  <Table2
                    size={12}
                    className={mainTab === "tabela" ? "text-sky-300" : ""}
                  />
                  <span>Tabela</span>
                  <span
                    className={`px-1.5 py-px rounded text-[10px] tabular-nums ${
                      mainTab === "tabela"
                        ? "bg-sky-400/15 text-sky-200 font-normal"
                        : "bg-white/[0.05] text-slate-400 font-light"
                    }`}
                  >
                    {periodFilteredRows.length}
                  </span>
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void fetchRows()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.05] text-xs font-normal transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              title="Atualizar dados"
            >
              <RefreshCw
                size={13}
                className={loading ? "animate-spin text-emerald-400" : "text-sky-400"}
              />
              <span className="hidden md:inline">Atualizar</span>
            </button>

            <button
              onClick={() => setShowModuleModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/12 hover:bg-emerald-500/20 text-emerald-300 text-xs font-normal transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Repeat2 size={14} />
              <span className="hidden sm:inline">Selecionar módulo</span>
              <span className="sm:hidden">Módulo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="relative z-10 flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Toast de feedback */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-normal ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : feedback.type === "error"
                    ? "bg-rose-500/10 text-rose-300"
                    : "bg-sky-500/10 text-sky-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === "success" ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <AlertTriangle size={14} />
                )}
                <span>{feedback.text}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Aviso caso a tabela controle_pk ou novas colunas ainda não existam no Supabase */}
        {(tableMissing || columnsMissing) && (
          <div className="border-y border-amber-500/25 bg-amber-500/[0.03] py-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Database size={17} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-normal text-slate-100">
                    Tabela ou colunas de{" "}
                    <code className="font-mono text-amber-300">controle_pk</code>{" "}
                    pendentes no Supabase
                  </h2>
                  <p className="text-xs font-light text-slate-400 mt-0.5">
                    Execute o SQL abaixo no{" "}
                    <strong className="font-normal text-slate-200">
                      Supabase Dashboard → SQL Editor
                    </strong>{" "}
                    e clique em Verificar tabela.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => void handleCopySql()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-normal cursor-pointer"
                >
                  {copiedSql ? <Check size={13} /> : <Copy size={13} />}
                  {copiedSql ? "SQL copiado" : "Copiar SQL"}
                </button>
                <button
                  onClick={() => void fetchRows()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-normal cursor-pointer"
                >
                  <RefreshCw size={13} />
                  Verificar tabela
                </button>
              </div>
            </div>
            <pre className="p-3.5 rounded-lg bg-black/30 border border-white/[0.06] text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
              {SQL_SETUP_SCRIPT}
            </pre>
          </div>
        )}


        {/* Filtro de Período (barra aberta sem card grosso) */}
        <div className="pb-3 border-b border-white/[0.05]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowCalendars((prev) => !prev)}
              aria-expanded={showCalendars}
              title={
                showCalendars
                  ? "Recolher calendários"
                  : "Clique para expandir os 12 calendários e filtrar por mês ou dia"
              }
              className={`inline-flex items-center gap-2 px-2.5 py-1.5 -ml-2 rounded-lg transition-colors cursor-pointer ${
                showCalendars
                  ? "bg-white/[0.05] text-slate-100"
                  : "hover:bg-white/[0.04] text-slate-300"
              }`}
            >
              <Calendar size={14} className="text-emerald-400/90 shrink-0" />
              <span className="text-xs font-normal">
                {activeWeekRange
                  ? `Semanal · ${activeWeekRange.label}`
                  : selectedMonth === null
                    ? `Todos os períodos (${rows.length})`
                    : selectedDay !== null
                      ? `${String(selectedDay).padStart(2, "0")} de ${MONTHS_PT[selectedMonth - 1].name} de ${selectedYear}`
                      : `${MONTHS_PT[selectedMonth - 1].name} de ${selectedYear}`}
              </span>
              {(activeWeekRange !== null || selectedMonth !== null) && (
                <span className="text-xs font-light text-slate-500 tabular-nums">
                  · {periodFilteredRows.length}{" "}
                  {periodFilteredRows.length === 1 ? "aviso" : "avisos"}
                </span>
              )}
              <ChevronDown
                size={13}
                className={`text-slate-500 transition-transform duration-200 ${
                  showCalendars ? "rotate-180 text-emerald-300" : ""
                }`}
              />
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              {showCalendars && (
                <div className="inline-flex items-center gap-1 mr-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear((y) => y - 1)
                      setSelectedDay(null)
                      setSelectedWeekAnchorIso(null)
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                    title="Ano anterior"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="px-1.5 text-xs font-normal text-slate-200 tabular-nums">
                    {selectedYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear((y) => y + 1)
                      setSelectedDay(null)
                      setSelectedWeekAnchorIso(null)
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                    title="Próximo ano"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}

              <div className="inline-flex items-center gap-0.5">
                {activeWeekRange && (
                  <button
                    type="button"
                    onClick={() =>
                      selectWeekFromIso(
                        shiftIsoDate(activeWeekRange.startIso, -7)
                      )
                    }
                    className="p-1 rounded-lg text-sky-300 hover:bg-sky-400/10 transition-colors cursor-pointer"
                    title="Semana anterior"
                  >
                    <ChevronLeft size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (activeWeekRange) {
                      setSelectedWeekAnchorIso(null)
                    } else {
                      const anchorIso =
                        selectedMonth !== null && selectedDay !== null
                          ? toIsoDate(selectedYear, selectedMonth, selectedDay)
                          : getTodayIsoLocal()
                      selectWeekFromIso(anchorIso)
                    }
                  }}
                  title={
                    activeWeekRange
                      ? "Clique para sair do filtro semanal"
                      : "Filtrar por semana (Domingo a Sábado)"
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-normal transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeWeekRange
                      ? "bg-sky-400/15 text-sky-300"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                  }`}
                >
                  Semanal
                </button>
                {activeWeekRange && (
                  <button
                    type="button"
                    onClick={() =>
                      selectWeekFromIso(
                        shiftIsoDate(activeWeekRange.startIso, 7)
                      )
                    }
                    className="p-1 rounded-lg text-sky-300 hover:bg-sky-400/10 transition-colors cursor-pointer"
                    title="Próxima semana"
                  >
                    <ChevronRight size={13} />
                  </button>
                )}
              </div>

              {(activeWeekRange !== null ||
                selectedYear !== todayInfo.year ||
                selectedMonth !== todayInfo.month ||
                selectedDay !== null) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWeekAnchorIso(null)
                    setSelectedYear(todayInfo.year)
                    setSelectedMonth(todayInfo.month)
                    setSelectedDay(null)
                  }}
                  className="px-2.5 py-1 rounded-lg text-amber-300/90 hover:bg-amber-400/10 text-xs font-normal transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Mês atual
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (activeWeekRange) {
                    setSelectedWeekAnchorIso(null)
                    setSelectedMonth(null)
                  } else {
                    setSelectedMonth((prev) =>
                      prev === null ? todayInfo.month : null
                    )
                  }
                  setSelectedDay(null)
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-normal transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedMonth === null && !activeWeekRange
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                }`}
              >
                Todos ({rows.length})
              </button>

              {mainTab === "dashboard" && (
                <>
                  <div className="h-3.5 w-px bg-white/[0.08] mx-0.5 hidden sm:block" />
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMainTab("tabela")
                        setShowAddModal(true)
                      }}
                      disabled={tableMissing}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-normal transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                    >
                      <Plus size={13} />
                      <span>Novo aviso</span>
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-slate-500 text-xs font-light px-1.5">
                      <Lock size={12} />
                      <span>Modo leitura</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {showCalendars && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="pt-3 mt-2.5 border-t border-white/[0.05] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2">
                  {MONTHS_PT.map((m) => {
                    const isCurrentRealMonth =
                      selectedYear === todayInfo.year && m.month === todayInfo.month
                    const isSelected = !activeWeekRange && selectedMonth === m.month
                    const monthStartIso = toIsoDate(selectedYear, m.month, 1)
                    const monthEndIso = toIsoDate(
                      selectedYear,
                      m.month,
                      new Date(selectedYear, m.month, 0).getDate()
                    )
                    const isWeekMonth =
                      activeWeekRange !== null &&
                      activeWeekRange.startIso <= monthEndIso &&
                      activeWeekRange.endIso >= monthStartIso
                    const count = monthCounts[m.month]
                    const cells = getMiniCalendarCells(selectedYear, m.month)
                    const paddedCells = [...cells]
                    while (paddedCells.length < 42) {
                      paddedCells.push(null)
                    }

                    return (
                      <div
                        key={m.month}
                        className={`relative rounded-lg overflow-hidden border transition-colors flex flex-col ${
                          isSelected
                            ? "border-emerald-400/50 bg-emerald-500/[0.06]"
                            : isWeekMonth
                              ? "border-sky-400/50 bg-sky-500/[0.06]"
                              : isCurrentRealMonth
                                ? "border-amber-400/40 bg-amber-500/[0.03]"
                                : "border-white/[0.06] bg-white/[0.015] hover:border-white/15"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWeekAnchorIso(null)
                            setSelectedMonth(m.month)
                            setSelectedDay(null)
                          }}
                          title={`${m.name} de ${selectedYear} — ${count} ${count === 1 ? "aviso" : "avisos"} (clique para ver o mês inteiro)${isCurrentRealMonth ? " · Mês atual" : ""}`}
                          className={`w-full px-2 py-1 flex items-center justify-between border-b transition-colors cursor-pointer ${
                            isSelected
                              ? "border-emerald-400/20 text-emerald-200"
                              : isWeekMonth
                                ? "border-sky-400/20 text-sky-200"
                                : isCurrentRealMonth
                                  ? "border-amber-400/20 text-amber-200"
                                  : "border-white/[0.05] text-slate-300 hover:bg-white/[0.03]"
                          }`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[10px] font-medium">
                              {m.short}
                            </span>
                            {isCurrentRealMonth && (
                              <span className="text-[8px] font-normal text-amber-300/80">
                                · atual
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-normal tabular-nums leading-none ${
                              isSelected
                                ? "text-emerald-200"
                                : isWeekMonth
                                  ? "text-sky-200"
                                  : count > 0
                                    ? "text-slate-200"
                                    : "text-slate-600"
                            }`}
                          >
                            {count}
                          </span>
                        </button>

                        <div className="p-1.5 space-y-0.5 flex-1">
                          <div className="grid grid-cols-7 gap-[1px] text-[7px] font-light text-slate-500 text-center select-none">
                            <span>D</span>
                            <span>S</span>
                            <span>T</span>
                            <span>Q</span>
                            <span>Q</span>
                            <span>S</span>
                            <span>S</span>
                          </div>

                          <div className="grid grid-cols-7 gap-[1px]">
                            {paddedCells.map((day, idx) => {
                              if (day === null) {
                                return <span key={idx} className="h-[15px]" />
                              }
                              const dayCount = monthDayCounts[m.month][day]
                              const dayIso = toIsoDate(selectedYear, m.month, day)
                              const isInSelectedWeek =
                                activeWeekRange !== null &&
                                dayIso >= activeWeekRange.startIso &&
                                dayIso <= activeWeekRange.endIso
                              const isSelectedDay = isSelected && selectedDay === day
                              const isToday =
                                isCurrentRealMonth && day === todayInfo.day
                              const dateLabel = `${String(day).padStart(2, "0")}/${String(m.month).padStart(2, "0")}/${selectedYear}`

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setSelectedWeekAnchorIso(null)
                                    if (isSelected && selectedDay === day) {
                                      setSelectedDay(null)
                                    } else {
                                      setSelectedMonth(m.month)
                                      setSelectedDay(day)
                                    }
                                  }}
                                  title={`${dateLabel} — ${dayCount} ${dayCount === 1 ? "aviso" : "avisos"}${isToday ? " (Hoje)" : ""}${isInSelectedWeek ? " · Semana selecionada" : ""}`}
                                  className={`h-[15px] rounded-[3px] text-[8px] leading-none tabular-nums flex items-center justify-center transition-colors cursor-pointer ${
                                    isSelectedDay
                                      ? "bg-emerald-400 text-slate-950 font-medium"
                                      : isInSelectedWeek
                                        ? isToday
                                          ? "bg-sky-400 text-slate-950 font-medium"
                                          : "bg-sky-400/80 text-slate-950 font-medium hover:bg-sky-300"
                                        : isToday
                                          ? "bg-amber-400/20 text-amber-200 font-normal"
                                          : dayCount > 0
                                            ? "bg-sky-400/15 text-sky-200 font-normal hover:bg-sky-400/30"
                                            : "text-slate-500 font-light hover:bg-white/[0.06] hover:text-slate-200"
                                  }`}
                                >
                                  {day}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          {mainTab === "dashboard" ? (
            <motion.div
              key="pk-dashboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
            >
              <ControlePKDashboard
                rows={periodFilteredRows}
                loading={loading}
                periodLabel={
                  activeWeekRange
                    ? `Semana ${activeWeekRange.label}`
                    : selectedMonth === null
                      ? `Todos os períodos (${rows.length} avisos)`
                      : selectedDay !== null
                        ? `${String(selectedDay).padStart(2, "0")} de ${MONTHS_PT[selectedMonth - 1].name} de ${selectedYear}`
                        : `${MONTHS_PT[selectedMonth - 1].name} de ${selectedYear}`
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key="pk-tabela"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
              className="space-y-4"
            >
        {/* Barra de filtros aberta (com cores suaves e alinhada) */}
        <div className="pb-3 border-b border-white/[0.05] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "todos", label: "Todos", count: stats.total, activeCls: "bg-sky-500/18 text-sky-200" },
                { id: "pendentes", label: "Pendentes", count: stats.pendentes, activeCls: "bg-amber-500/18 text-amber-200" },
                { id: "atualizados", label: "Atualizados", count: stats.atualizados, activeCls: "bg-emerald-500/18 text-emerald-200" },
                { id: "Simples", label: "Simples", count: stats.simples, activeCls: "bg-emerald-500/18 text-emerald-200" },
                { id: "Normal", label: "Normal", count: stats.normal, activeCls: "bg-sky-500/18 text-sky-200" },
                { id: "Complexa", label: "Complexa", count: stats.complexa, activeCls: "bg-rose-500/18 text-rose-200" },
              ] as { id: FilterTab; label: string; count: number; activeCls: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  filterTab === tab.id
                    ? `${tab.activeCls} font-normal`
                    : "text-slate-400 font-light hover:text-slate-200 hover:bg-white/[0.04]"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[11px] tabular-nums ${filterTab === tab.id ? "opacity-80" : "text-slate-500"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar aviso, empresa, solicitante..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] focus:border-sky-400/40 text-xs font-light text-slate-100 placeholder:text-slate-500 outline-none transition-colors"
              />
            </div>

            {canEdit ? (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                disabled={tableMissing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-normal transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                title="Adicionar um ou vários avisos"
              >
                <Plus size={14} />
                <span>Aviso</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-500 text-xs font-light shrink-0">
                <Lock size={12} />
                <span>Leitor</span>
              </div>
            )}

            <div className="relative" ref={actionsMenuRef}>
              <button
                type="button"
                onClick={() => setShowActionsMenu((prev) => !prev)}
                aria-label="Opções de configuração"
                title="Configurações e ações"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  showActionsMenu
                    ? "bg-white/[0.08] text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <EllipsisVertical size={15} />
              </button>

              <AnimatePresence>
                {showActionsMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 top-full mt-2 z-40 w-52 rounded-xl border border-white/[0.08] bg-[#101724]/95 backdrop-blur-xl shadow-xl p-1 space-y-0.5"
                  >
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionsMenu(false)
                          setShowImportModal(true)
                        }}
                        disabled={tableMissing}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-normal text-sky-300 hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <UploadCloud size={14} className="shrink-0" />
                        <span>Atualizar via planilha</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowActionsMenu(false)
                        handleExportExcel()
                      }}
                      disabled={filteredRows.length === 0}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-normal text-slate-200 hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download size={14} className="text-emerald-300 shrink-0" />
                      <span>Exportar Excel</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Tabela principal Controle PK (compacta, alinhada e com cabeçalho maior que as linhas) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-slate-300 text-xs font-medium">
                <th className="py-2 pr-2 font-medium whitespace-nowrap">
                  Aviso
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap">
                  Data sep.
                </th>
                <th className="py-2 px-2 font-medium whitespace-nowrap">
                  Pessoa
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap">
                  Peças
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap">
                  SKUs
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap">
                  Tempo sep.
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap">
                  Embarque
                </th>
                <th className="py-2 px-2 font-medium whitespace-nowrap">
                  Conferente
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap">
                  Tempo conf.
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap">
                  Tempo emb.
                </th>
                <th className="py-2 px-2 font-medium whitespace-nowrap">
                  Empresa
                </th>
                <th className="py-2 px-2 font-medium whitespace-nowrap">
                  Solicitante
                </th>
                <th className="py-2 px-2 font-medium whitespace-nowrap">
                  Notas
                </th>
                <th className="py-2 pl-2 font-medium text-right whitespace-nowrap">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td
                    colSpan={14}
                    className="px-4 py-10 text-center text-slate-500 text-xs font-light"
                  >
                    <Loader2
                      size={16}
                      className="animate-spin text-emerald-400 mx-auto mb-2"
                    />
                    Carregando registros de Controle PK...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={14}
                    className="px-4 py-10 text-center text-slate-500 text-xs font-light"
                  >
                    <FileSpreadsheet
                      size={18}
                      className="mx-auto mb-2 text-slate-600"
                    />
                    {rows.length === 0
                      ? 'Nenhum aviso cadastrado. Clique em "+ Aviso" ao lado da busca para começar.'
                      : periodFilteredRows.length === 0 && activeWeekRange
                        ? `Nenhum aviso encontrado na semana ${activeWeekRange.label}.`
                        : periodFilteredRows.length === 0 && selectedMonth !== null
                          ? selectedDay !== null
                            ? `Nenhum aviso encontrado em ${String(selectedDay).padStart(2, "0")}/${String(selectedMonth).padStart(2, "0")}/${selectedYear}.`
                            : `Nenhum aviso encontrado em ${MONTHS_PT[selectedMonth - 1].name} de ${selectedYear}.`
                          : "Nenhum registro encontrado para os filtros aplicados."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const effectiveDateIso =
                    row.data_separacao || row.created_at?.slice(0, 10) || ""
                  const isExpanded = expandedRowId === row.id
                  const rowEmbDur = calculateDuration(
                    row.horario_inicio_embalagem,
                    row.horario_final_embalagem
                  )
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className={`transition-colors group ${
                          isExpanded
                            ? "bg-white/[0.03]"
                            : "hover:bg-white/[0.025]"
                        }`}
                      >
                        <td className="py-1.5 pr-2 whitespace-nowrap align-middle">
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(row)}
                            title={
                              isExpanded
                                ? "Recolher detalhes do aviso"
                                : "Clique para visualizar detalhes"
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-normal text-white hover:text-sky-300 tabular-nums transition-colors cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronDown
                                size={12}
                                className="text-emerald-400 shrink-0"
                              />
                            ) : (
                              <ChevronRight
                                size={12}
                                className="text-slate-500 group-hover:text-emerald-400 shrink-0 transition-colors"
                              />
                            )}
                            <span>{row.aviso}</span>
                          </button>
                        </td>
                        <td className="py-1.5 px-2 text-center whitespace-nowrap align-middle">
                          <span className="text-[11px] font-light text-slate-300 tabular-nums">
                            {effectiveDateIso
                              ? formatDateBr(effectiveDateIso)
                              : "—"}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 whitespace-nowrap align-middle">
                          {renderPeopleBadgeCell(row.pessoa, "sky")}
                        </td>
                        <td className="py-1.5 px-2 text-[11px] font-normal text-center text-sky-300 tabular-nums whitespace-nowrap align-middle">
                          {Number(row.pecas || 0).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-1.5 px-2 text-[11px] font-normal text-center text-violet-300 tabular-nums whitespace-nowrap align-middle">
                          {Number(row.skus || 0).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-1.5 px-2 text-center whitespace-nowrap align-middle">
                          {renderDurationCell(
                            row.inicio,
                            row.final,
                            "Separação",
                            "sky"
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-center whitespace-nowrap align-middle">
                          {renderTipoEmbarqueBadge(row.tipo_de_embarque)}
                        </td>
                        <td className="py-1.5 px-2 whitespace-nowrap align-middle">
                          {renderPeopleBadgeCell(row.conferente, "emerald")}
                        </td>
                        <td className="py-1.5 px-2 text-center whitespace-nowrap align-middle">
                          {renderDurationCell(
                            row.conferencia_inicial,
                            row.conferencia_final,
                            "Conferência",
                            "emerald"
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-center whitespace-nowrap align-middle">
                          {renderDurationCell(
                            row.horario_inicio_embalagem,
                            row.horario_final_embalagem,
                            "Embalagem",
                            "amber"
                          )}
                        </td>
                        <td
                          className="py-1.5 px-2 text-[11px] font-light text-slate-200 max-w-[125px] truncate align-middle"
                          title={row.empresa || undefined}
                        >
                          {row.empresa || (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-[11px] font-light text-slate-400 min-w-[115px] max-w-[190px] align-middle">
                          {row.solicitante ? (
                            <span
                              className="line-clamp-1 break-words"
                              title={row.solicitante}
                            >
                              {row.solicitante}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td
                          className="py-1.5 px-2 text-[11px] font-light text-slate-300 tabular-nums max-w-[100px] truncate align-middle"
                          title={row.notas || undefined}
                        >
                          {row.notas || (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-1.5 pl-2 text-right whitespace-nowrap align-middle">
                          <div className="inline-flex items-center justify-end gap-0.5">
                            {canEdit ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(row)}
                                  className="p-1 rounded-md text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors cursor-pointer"
                                  title={`Editar aviso ${row.aviso}`}
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteRow(row)}
                                  className="p-1 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title={`Remover aviso ${row.aviso}`}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            ) : (
                              <span
                                className="p-1 text-slate-600 cursor-not-allowed"
                                title="Apenas visualização"
                              >
                                <Lock size={11} />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-white/[0.02]">
                          <td colSpan={14} className="px-4 py-3">
                            <div className="space-y-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/[0.05]">
                                <h3 className="text-xs font-normal text-emerald-300">
                                  Detalhes manuais · Aviso{" "}
                                  <span className="text-white tabular-nums">
                                    {row.aviso}
                                  </span>
                                </h3>

                                {rowEmbDur && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 text-[11px] font-light text-sky-300 tabular-nums">
                                    <Clock size={11} className="opacity-75" />
                                    <span>
                                      Tempo embalagem: {rowEmbDur.formatted}
                                    </span>
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                  <span className="block text-[11px] font-normal text-slate-400 mb-0.5">
                                    Embalador
                                  </span>
                                  <div className="text-[11px] font-light text-slate-200">
                                    {row.embalador ? (
                                      <span
                                        title={row.embalador}
                                        className="cursor-help"
                                      >
                                        {splitPeopleNames(row.embalador).length > 1
                                          ? `${splitPeopleNames(row.embalador).length} pessoas (${row.embalador})`
                                          : row.embalador}
                                      </span>
                                    ) : (
                                      <span className="text-slate-600">—</span>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <span className="block text-[11px] font-normal text-slate-400 mb-0.5">
                                    Início da embalagem
                                  </span>
                                  <p className="text-[11px] font-light text-slate-200 tabular-nums">
                                    {row.horario_inicio_embalagem || (
                                      <span className="text-slate-600">—</span>
                                    )}
                                  </p>
                                </div>

                                <div>
                                  <span className="block text-[11px] font-normal text-slate-400 mb-0.5">
                                    Final da embalagem
                                  </span>
                                  <p className="text-[11px] font-light text-slate-200 tabular-nums">
                                    {row.horario_final_embalagem || (
                                      <span className="text-slate-600">—</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modal de Importação / Atualização por Planilha */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center p-4"
            style={{
              backdropFilter: "blur(14px)",
              background: "rgba(4,7,14,0.78)",
            }}
            onClick={() => setShowImportModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/[0.08] bg-[#0f1622]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header modal */}
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={18} className="text-sky-300 shrink-0" />
                  <div>
                    <h2 className="text-[15px] font-normal text-white">
                      Atualizar Controle PK pela planilha
                    </h2>
                    <p className="text-xs font-light text-slate-400 mt-0.5">
                      <span className="text-sky-300 font-normal">PD destino</span>{" "}
                      atualiza Separação (Pessoa, Peças, SKUs, Início, Final, Tipo) ·{" "}
                      <span className="text-emerald-300 font-normal">PD origem</span>{" "}
                      atualiza Conferência (Conferente, Conf. Inicial, Conf. Final).
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body modal */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Colunas consideradas */}
                <div className="text-xs font-light text-slate-400 flex flex-wrap items-center gap-x-2.5 gap-y-1 pb-3 border-b border-white/[0.05]">
                  <span className="text-slate-300 font-normal">
                    Colunas lidas:
                  </span>
                  {[
                    "Confirmado por",
                    "Produto",
                    "PD destino",
                    "PD origem",
                    "Qtd.real destino UMB",
                    "Hora da confirmação",
                  ].map((col, idx, arr) => (
                    <span key={col} className="text-slate-300">
                      {col}
                      {idx < arr.length - 1 ? " ·" : ""}
                    </span>
                  ))}
                </div>

                {/* Upload ou Colagem */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl border border-dashed border-white/[0.12] hover:border-sky-400/50 bg-white/[0.02] hover:bg-sky-500/[0.04] p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
                  >
                    <UploadCloud size={24} className="text-sky-300/90 mb-2" />
                    <p className="text-xs font-normal text-slate-100">
                      {importFileName
                        ? importFileName
                        : "Clique para selecionar arquivo (.xlsx, .xls, .csv)"}
                    </p>
                    <p className="text-[11px] font-light text-slate-500 mt-1">
                      Outras colunas da planilha serão ignoradas automaticamente
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.tsv,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleFileSelected(f)
                        e.target.value = ""
                      }}
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="text-xs font-light text-slate-400 mb-1.5">
                      Ou cole os dados copiados do Excel (com cabeçalho):
                    </label>
                    <textarea
                      value={importPasteText}
                      onChange={(e) => handlePasteTextChange(e.target.value)}
                      rows={4}
                      placeholder="Cole aqui as linhas copiadas da planilha..."
                      className="flex-1 w-full rounded-xl bg-white/[0.03] border border-white/[0.08] focus:border-sky-400/50 p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Aviso de colunas ausentes */}
                {parseResult && parseResult.missingColumns.length > 0 && (
                  <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-normal">
                        Colunas não identificadas no cabeçalho:
                      </span>{" "}
                      {parseResult.missingColumns.join(", ")}
                    </div>
                  </div>
                )}

                {/* Preview da agregação */}
                {parseResult && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-4 text-xs font-light">
                      <span className="text-slate-400">
                        Linhas lidas:{" "}
                        <strong className="text-slate-100 font-normal tabular-nums">
                          {parseResult.totalRawRows}
                        </strong>
                      </span>
                      <span className="text-emerald-300">
                        Avisos encontrados:{" "}
                        <strong className="font-normal tabular-nums">
                          {importAggregation.matchedUpdates.length}
                        </strong>
                      </span>
                      <span className="text-slate-400">
                        Não encontrados:{" "}
                        <strong className="text-amber-300 font-normal tabular-nums">
                          {importAggregation.unmatchedAvisos.length}
                        </strong>
                      </span>
                    </div>

                    {importAggregation.unmatchedAvisos.length > 0 && (
                      <div className="rounded-lg bg-amber-500/[0.07] px-3.5 py-2.5 space-y-1.5">
                        <span className="block text-xs font-normal text-amber-300">
                          Avisos da tabela não encontrados nesta planilha (
                          {importAggregation.unmatchedAvisos.length}):
                        </span>
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1 text-xs font-light text-amber-200/90 tabular-nums">
                          {importAggregation.unmatchedAvisos.join(", ")}
                        </div>
                      </div>
                    )}

                    {importAggregation.matchedUpdates.length > 0 ? (
                      <div className="overflow-x-auto max-h-60 border-t border-white/[0.06]">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-[#0f1622] border-b border-white/[0.06] sticky top-0">
                            <tr className="text-xs font-medium text-slate-300">
                              <th className="px-2 py-2 font-medium">
                                Aviso
                              </th>
                              <th className="px-2 py-2 font-medium text-center">
                                Data sep.
                              </th>
                              <th className="px-2 py-2 font-medium">
                                Pessoa (sep.)
                              </th>
                              <th className="px-2 py-2 font-medium text-center">
                                Peças
                              </th>
                              <th className="px-2 py-2 font-medium text-center">
                                SKUs
                              </th>
                              <th className="px-2 py-2 font-medium text-sky-300 text-center">
                                Tempo sep.
                              </th>
                              <th className="px-2 py-2 font-medium text-center">
                                Tipo
                              </th>
                              <th className="px-2 py-2 font-medium text-emerald-300">
                                Conferente
                              </th>
                              <th className="px-2 py-2 font-medium text-emerald-300 text-center">
                                Tempo conf.
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {importAggregation.matchedUpdates.map((item) => (
                              <tr key={item.aviso} className="text-[11px] font-light">
                                <td className="px-2 py-1.5 font-normal text-slate-100 tabular-nums whitespace-nowrap">
                                  {item.aviso}
                                  <span className="ml-1 text-[10px] font-light text-slate-500">
                                    ({item.linhasSeparacao}S/{item.linhasConferencia}C)
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-center text-slate-300 tabular-nums whitespace-nowrap">
                                  {item.data_separacao
                                    ? formatDateBr(item.data_separacao)
                                    : "Manter linha"}
                                </td>
                                <td className="px-2 py-1.5 text-slate-300">
                                  {item.hasSeparacao ? item.pessoa || "—" : "—"}
                                </td>
                                <td className="px-2 py-1.5 text-center text-sky-300 tabular-nums">
                                  {item.hasSeparacao
                                    ? item.pecas.toLocaleString("pt-BR")
                                    : "—"}
                                </td>
                                <td className="px-2 py-1.5 text-center text-violet-300 tabular-nums">
                                  {item.hasSeparacao ? item.skus : "—"}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  {item.hasSeparacao ? (
                                    renderDurationCell(
                                      item.inicio,
                                      item.final,
                                      "Separação",
                                      "sky"
                                    )
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  {item.hasSeparacao ? (
                                    renderTipoEmbarqueBadge(
                                      item.tipo_de_embarque
                                    )
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-emerald-200/90">
                                  {item.hasConferencia
                                    ? item.conferente || "—"
                                    : "—"}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  {item.hasConferencia ? (
                                    renderDurationCell(
                                      item.conferencia_inicial,
                                      item.conferencia_final,
                                      "Conferência",
                                      "emerald"
                                    )
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-xs font-light text-slate-500">
                        {rows.length === 0
                          ? "Cadastre pelo menos um número de aviso na tabela principal antes de importar."
                          : "Nenhum dos avisos cadastrados foi encontrado nas colunas PD destino ou PD origem desta planilha."}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer modal */}
              <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-lg hover:bg-white/[0.05] text-xs font-normal text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleApplyImport()}
                  disabled={
                    isApplyingImport ||
                    importAggregation.matchedUpdates.length === 0
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-normal transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isApplyingImport ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  Atualizar {importAggregation.matchedUpdates.length}{" "}
                  {importAggregation.matchedUpdates.length === 1
                    ? "aviso"
                    : "avisos"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal para selecionar outro módulo */}
      <AnimatePresence>
        {showModuleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] flex items-center justify-center p-4"
            style={{
              backdropFilter: "blur(16px)",
              background: "rgba(4,7,14,0.78)",
            }}
            onClick={() => setShowModuleModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/[0.08] bg-[#0f1622]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-7 pb-4 text-center">
                <Repeat2 size={20} className="text-slate-400 mx-auto mb-3" />
                <h2 className="text-base font-normal text-white tracking-tight">
                  Selecionar módulo
                </h2>
                <p className="text-xs font-light text-slate-400 mt-1">
                  Escolha o módulo desejado
                </p>
              </div>

              <div className="px-6 pb-6 flex flex-col divide-y divide-white/[0.05]">
                {MODULES.map((mod) => {
                  const Icon = mod.icon
                  return (
                    <button
                      key={mod.id}
                      onClick={() => {
                        setShowModuleModal(false)
                        router.push(mod.href)
                      }}
                      className="w-full py-3.5 px-2 flex items-center justify-between hover:bg-white/[0.03] rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${mod.iconBg}`}
                        >
                          <Icon size={18} className="text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-normal text-slate-100">
                              {mod.name}
                            </p>
                            {mod.active && (
                              <span className="text-[11px] font-light text-emerald-300">
                                · atual
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-light text-slate-400 mt-0.5">
                            {mod.subtitle}
                          </p>
                        </div>
                      </div>
                      <ArrowRight size={15} className={mod.textAccent} />
                    </button>
                  )
                })}

                <div className="pt-4">
                  <button
                    onClick={() => {
                      setShowModuleModal(false)
                      router.push("/")
                    }}
                    className="w-full py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-normal text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    Tela inicial de módulos
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowModuleModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal para Adicionar Aviso(s) (individual ou em massa) */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[135] flex items-center justify-center p-4"
            style={{
              backdropFilter: "blur(14px)",
              background: "rgba(4,7,14,0.78)",
            }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.form
              onSubmit={(e) => void handleAddAvisos(e)}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/[0.08] bg-[#0f1622]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Plus size={16} className="text-emerald-300" />
                  <div>
                    <h2 className="text-[15px] font-normal text-white">
                      Adicionar aviso(s)
                    </h2>
                    <p className="text-xs font-light text-slate-400">
                      Digite um aviso ou cole vários para adicionar em massa.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-light text-slate-400">
                    Número(s) do aviso *
                  </label>
                  {addAvisosPreview.uniqueTokens.length > 0 && (
                    <span className="text-xs font-light text-emerald-300 tabular-nums">
                      {addAvisosPreview.toInsert.length}{" "}
                      {addAvisosPreview.toInsert.length === 1 ? "novo" : "novos"}
                      {addAvisosPreview.duplicates > 0
                        ? ` · ${addAvisosPreview.duplicates} já cadastrado${addAvisosPreview.duplicates > 1 ? "s" : ""}`
                        : ""}
                    </span>
                  )}
                </div>
                <textarea
                  autoFocus
                  rows={5}
                  value={novoAvisoInput}
                  onChange={(e) => setNovoAvisoInput(e.target.value)}
                  placeholder={"Ex:\n123456\n123457\nOu separados por vírgula / espaço"}
                  disabled={tableMissing || isAddingAviso}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-emerald-400/50 text-xs text-white font-mono uppercase placeholder:text-slate-600 placeholder:normal-case outline-none resize-y min-h-[120px]"
                />
                <p className="text-xs font-light text-slate-500">
                  Depois de adicionar, use o botão de editar na linha para
                  preencher Empresa, Qtde. Notas, Data de Faturamento e
                  Solicitante.
                </p>
              </div>

              <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg hover:bg-white/[0.05] text-xs font-normal text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    tableMissing ||
                    isAddingAviso ||
                    addAvisosPreview.uniqueTokens.length === 0
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-normal transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isAddingAviso ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  {addAvisosPreview.toInsert.length > 1
                    ? `Adicionar ${addAvisosPreview.toInsert.length} avisos`
                    : "Adicionar aviso"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Edição de Aviso (compacto, sem barra de rolagem no desktop) */}
      <AnimatePresence>
        {editingRow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[135] flex items-center justify-center p-2 sm:p-3"
            style={{
              backdropFilter: "blur(14px)",
              background: "rgba(4,7,14,0.78)",
            }}
            onClick={() => setEditingRow(null)}
          >
            <motion.form
              onSubmit={(e) => void handleSaveEditModal(e)}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-6xl max-h-[96vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/[0.08] bg-[#0f1622]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <Pencil size={14} className="text-sky-300" />
                  <div className="flex flex-wrap items-baseline gap-x-2.5">
                    <h2 className="text-sm font-normal text-white">
                      Editar aviso
                    </h2>
                    <p className="text-[11px] font-light text-slate-400">
                      Preencha ou edite as colunas do registro.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="px-5 py-3.5 space-y-3 overflow-y-auto lg:overflow-visible flex-1">
                {/* 1. Dados do Aviso e Faturamento */}
                <div className="space-y-2">
                  <span className="block text-xs font-normal text-amber-300">
                    Dados do aviso e faturamento
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Aviso *
                      </label>
                      <input
                        type="text"
                        value={editDraft.aviso}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            aviso: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-sky-400/50 text-[11px] text-white font-light tabular-nums uppercase outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Data separação
                      </label>
                      <input
                        type="date"
                        value={editDraft.data_separacao}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            data_separacao: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-sky-400/50 text-[11px] text-slate-200 font-light tabular-nums outline-none [color-scheme:dark]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Empresa
                      </label>
                      <input
                        type="text"
                        value={editDraft.empresa}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            empresa: e.target.value,
                          }))
                        }
                        placeholder="Nome da empresa..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-sky-400/50 text-[11px] text-white font-light placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Notas
                      </label>
                      <input
                        type="text"
                        value={editDraft.notas}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            notas: e.target.value,
                          }))
                        }
                        placeholder="Número(s) da(s) nota(s)..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-sky-400/50 text-[11px] text-white font-light tabular-nums placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Qtde. notas
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={editDraft.qtde_notas}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            qtde_notas: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-sky-400/50 text-[11px] text-white font-light tabular-nums placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Data de faturamento
                      </label>
                      <input
                        type="date"
                        value={editDraft.data_faturamento}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            data_faturamento: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-sky-400/50 text-[11px] text-slate-200 font-light tabular-nums outline-none [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-light text-slate-400 mb-1">
                      Solicitante
                    </label>
                    <textarea
                      rows={1}
                      value={editDraft.solicitante}
                      onChange={(e) =>
                        setEditDraft((d) => ({
                          ...d,
                          solicitante: e.target.value,
                        }))
                      }
                      placeholder="Nome do solicitante, observações ou instruções..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-sky-400/50 text-[11px] text-white font-light placeholder:text-slate-600 outline-none resize-none min-h-[30px]"
                    />
                  </div>
                </div>

                {/* 2. Separação */}
                <div className="pt-2.5 border-t border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-normal text-sky-300">
                      Separação
                    </span>
                    {(() => {
                      const sepDur = calculateDuration(
                        editDraft.inicio,
                        editDraft.final
                      )
                      return (
                        <span className="inline-flex items-center gap-1 text-[11px] font-light text-sky-300 tabular-nums">
                          <Clock size={10} className="opacity-70" />
                          Tempo separação: {sepDur ? sepDur.formatted : "—"}
                        </span>
                      )
                    })()}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Pessoa
                      </label>
                      <input
                        type="text"
                        value={editDraft.pessoa}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            pessoa: e.target.value,
                          }))
                        }
                        placeholder="Separador(es)..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-sky-400/50 text-[11px] text-white font-light placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Peças
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={editDraft.pecas}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            pecas: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-sky-400/50 text-[11px] text-white font-light tabular-nums placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        SKUs
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={editDraft.skus}
                        onChange={(e) => {
                          const nextSkusStr = e.target.value
                          const prevSkusNum = Math.max(
                            0,
                            Math.round(Number(editDraft.skus) || 0)
                          )
                          const nextSkusNum = Math.max(
                            0,
                            Math.round(Number(nextSkusStr) || 0)
                          )
                          const prevAuto = classifyTipoEmbarque(prevSkusNum) || ""
                          const nextAuto = classifyTipoEmbarque(nextSkusNum) || ""
                          setEditDraft((d) => ({
                            ...d,
                            skus: nextSkusStr,
                            tipo_de_embarque:
                              d.tipo_de_embarque === "" ||
                              d.tipo_de_embarque === prevAuto
                                ? nextAuto
                                : d.tipo_de_embarque,
                          }))
                        }}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-sky-400/50 text-[11px] text-white font-light tabular-nums placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Tipo de embarque
                      </label>
                      <select
                        value={editDraft.tipo_de_embarque}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            tipo_de_embarque: e.target.value as "" | TipoEmbarque,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#0f1622] border border-white/[0.08] focus:border-sky-400/50 text-[11px] text-white font-light outline-none cursor-pointer"
                      >
                        <option value="">Automático / Aguardando</option>
                        <option value="Simples">Simples</option>
                        <option value="Normal">Normal</option>
                        <option value="Complexa">Complexa</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Início separação
                      </label>
                      <input
                        type="text"
                        value={editDraft.inicio}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            inicio: e.target.value,
                          }))
                        }
                        placeholder="DD/MM/AAAA HH:MM:SS"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-sky-400/50 text-[11px] text-slate-200 font-light tabular-nums placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Final separação
                      </label>
                      <input
                        type="text"
                        value={editDraft.final}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            final: e.target.value,
                          }))
                        }
                        placeholder="DD/MM/AAAA HH:MM:SS"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-sky-400/50 text-[11px] text-slate-200 font-light tabular-nums placeholder:text-slate-600 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Conferência */}
                <div className="pt-2.5 border-t border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-normal text-emerald-300">
                      Conferência
                    </span>
                    {(() => {
                      const confDur = calculateDuration(
                        editDraft.conferencia_inicial,
                        editDraft.conferencia_final
                      )
                      return (
                        <span className="inline-flex items-center gap-1 text-[11px] font-light text-emerald-300 tabular-nums">
                          <Clock size={10} className="opacity-70" />
                          Tempo conferência: {confDur ? confDur.formatted : "—"}
                        </span>
                      )
                    })()}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Conferente
                      </label>
                      <input
                        type="text"
                        value={editDraft.conferente}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            conferente: e.target.value,
                          }))
                        }
                        placeholder="Nome do conferente..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-emerald-400/50 text-[11px] text-white font-light placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Início conferência
                      </label>
                      <input
                        type="text"
                        value={editDraft.conferencia_inicial}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            conferencia_inicial: e.target.value,
                          }))
                        }
                        placeholder="DD/MM/AAAA HH:MM:SS ou HH:MM:SS"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-emerald-400/50 text-[11px] text-slate-200 font-light tabular-nums placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-light text-slate-400 mb-1">
                        Final conferência
                      </label>
                      <input
                        type="text"
                        value={editDraft.conferencia_final}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            conferencia_final: e.target.value,
                          }))
                        }
                        placeholder="DD/MM/AAAA HH:MM:SS ou HH:MM:SS"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-emerald-400/50 text-[11px] text-slate-200 font-light tabular-nums placeholder:text-slate-600 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Embalagem */}
                <div className="pt-2.5 border-t border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-normal text-amber-300">
                      Embalagem
                    </span>
                  </div>

                  {(() => {
                    const embDur = calculateDuration(
                      editDraft.horario_inicio_embalagem,
                      editDraft.horario_final_embalagem
                    )
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-end">
                        <div>
                          <label className="block text-[10px] font-light text-slate-400 mb-1">
                            Embalador
                          </label>
                          <input
                            type="text"
                            value={editDraft.embalador}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                embalador: e.target.value,
                              }))
                            }
                            placeholder="Nome do embalador..."
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-amber-400/50 text-[11px] text-white font-light placeholder:text-slate-600 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-light text-slate-400 mb-1">
                            Início embalagem
                          </label>
                          <input
                            type="time"
                            step={1}
                            value={editDraft.horario_inicio_embalagem}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                horario_inicio_embalagem: e.target.value,
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-amber-400/50 text-[11px] text-slate-200 font-light tabular-nums outline-none [color-scheme:dark]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-light text-slate-400 mb-1">
                            Final embalagem
                          </label>
                          <input
                            type="time"
                            step={1}
                            value={editDraft.horario_final_embalagem}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                horario_final_embalagem: e.target.value,
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-amber-400/50 text-[11px] text-slate-200 font-light tabular-nums outline-none [color-scheme:dark]"
                          />
                        </div>

                        <div>
                          <span className="block text-[10px] font-light text-amber-300/80 mb-1">
                            Tempo embalagem
                          </span>
                          <div
                            className={`w-full px-2.5 py-1.5 rounded-lg border text-[11px] font-light tabular-nums flex items-center gap-1.5 ${
                              embDur
                                ? "bg-amber-500/10 border-amber-400/30 text-amber-300"
                                : "bg-white/[0.02] border-white/[0.06] text-slate-500"
                            }`}
                          >
                            <Clock size={11} className="shrink-0 opacity-75" />
                            <span>
                              {embDur ? embDur.formatted : "Preencha início/final"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>

              <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-3.5 py-1.5 rounded-lg hover:bg-white/[0.05] text-xs font-normal text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-xs font-normal transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Save size={13} />
                  )}
                  Salvar alterações
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip flutuante com Início e Final para Tempo de Separação e Conferência */}
      <AnimatePresence>
        {hoverTooltip && (
          <motion.div
            initial={{ opacity: 0, y: hoverTooltip.placeBelow ? -4 : 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            style={{
              top: hoverTooltip.top,
              left: hoverTooltip.left,
              transform: hoverTooltip.placeBelow
                ? "translate(-50%, 0)"
                : "translate(-50%, -100%)",
            }}
            className="fixed z-[160] pointer-events-none w-56 rounded-xl border border-white/10 bg-[#0f1622]/95 backdrop-blur-xl shadow-xl px-3.5 py-2.5 text-xs"
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-white/[0.06]">
              <span
                className={`text-[11px] font-normal ${
                  hoverTooltip.accent === "sky"
                    ? "text-sky-300"
                    : hoverTooltip.accent === "amber"
                      ? "text-amber-300"
                      : "text-emerald-300"
                }`}
              >
                {hoverTooltip.title}
              </span>
              {hoverTooltip.humanDuration && (
                <span className="text-[11px] font-light text-slate-400 tabular-nums">
                  {hoverTooltip.humanDuration}
                </span>
              )}
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400 font-light">Início</span>
                <span className="text-slate-100 font-normal tabular-nums whitespace-nowrap">
                  {hoverTooltip.inicio || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400 font-light">Final</span>
                <span className="text-slate-100 font-normal tabular-nums whitespace-nowrap">
                  {hoverTooltip.final || "—"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
