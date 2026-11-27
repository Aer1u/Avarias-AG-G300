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
      return <span className="text-[#89919e]">—</span>
    }
    const avatarBg =
      accent === "sky"
        ? "bg-[#159BFF]/20 text-[#159BFF]"
        : "bg-[#4edea3]/20 text-[#4edea3]"
    const label = people.length === 1 ? people[0] : `${people.length} pessoas`
    return (
      <div className="flex items-center gap-2" title={people.join(", ")}>
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold text-[10px] shrink-0 ${avatarBg}`}
        >
          {people.length}
        </div>
        <span className="text-[#d4e4fa] font-medium text-xs truncate max-w-[115px] cursor-help">
          {label}
        </span>
      </div>
    )
  }

  const renderTipoEmbarqueBadge = (tipo: ControlePKRow["tipo_de_embarque"]) => {
    if (!tipo) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border bg-slate-500/10 text-slate-400 border-slate-500/30 whitespace-nowrap">
          <span className="w-1 h-1 rounded-full bg-current"></span>
          Não definido
        </span>
      )
    }
    if (tipo === "Simples") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border bg-[#4edea3]/10 text-[#4edea3] border-[#4edea3]/30 whitespace-nowrap">
          <span className="w-1 h-1 rounded-full bg-current"></span>
          Simples
        </span>
      )
    }
    if (tipo === "Normal") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border bg-[#159BFF]/10 text-[#159BFF] border-[#159BFF]/30 whitespace-nowrap">
          <span className="w-1 h-1 rounded-full bg-current"></span>
          Normal
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border bg-red-500/10 text-red-400 border-red-500/30 whitespace-nowrap">
        <span className="w-1 h-1 rounded-full bg-current"></span>
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
      return <span className="text-slate-600">—</span>
    }

    const dur = calculateDuration(inicio, final)
    const accentClasses =
      accent === "sky"
        ? "bg-sky-500/10 text-sky-300 border-sky-500/25 hover:bg-sky-500/20 hover:border-sky-400/40"
        : accent === "amber"
          ? "bg-amber-500/10 text-amber-300 border-amber-500/25 hover:bg-amber-500/20 hover:border-amber-400/40"
          : "bg-emerald-500/10 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-400/40"

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
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold cursor-default transition-colors outline-none whitespace-nowrap ${accentClasses}`}
      >
        <Clock size={11} className="opacity-75 shrink-0" />
        <span>{dur ? dur.formatted : "Incompleto"}</span>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col text-slate-100"
      style={{ background: "linear-gradient(135deg, #07090f 0%, #0b0f1a 100%)" }}
    >
      <GlobalAdminBar currentWorkspaceId="ws_mkbr" />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 35% at 50% -5%, rgba(16,185,129,0.09) 0%, transparent 70%)",
        }}
      />

      {/* Menu superior */}
      <header className="relative z-20 w-full border-b border-white/[0.06] bg-slate-950/70 backdrop-blur-xl">
        <div className="w-full px-3 sm:px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/mkbr")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              <ChevronLeft size={15} />
              Voltar
            </button>

            <div className="h-5 w-px bg-white/10 hidden sm:block" />

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                MKBR
              </span>
              <span className="text-slate-600 text-xs">/</span>
              <span className="text-sm font-bold text-slate-200 tracking-tight">
                Controle PK
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchRows()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
              title="Atualizar dados"
            >
              <RefreshCw
                size={14}
                className={loading ? "animate-spin text-emerald-400" : ""}
              />
              <span className="hidden md:inline">Atualizar</span>
            </button>

            <button
              onClick={() => setShowModuleModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              <Repeat2 size={15} />
              Selecionar Módulo
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="relative z-10 flex-1 w-full px-3 sm:px-5 py-4 space-y-4 bg-[#051424]">
        {/* Toast de feedback */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`rounded-xl px-4 py-3 border flex items-center justify-between gap-3 text-xs font-medium ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : feedback.type === "error"
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    : "bg-sky-500/10 border-sky-500/30 text-sky-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === "success" ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <AlertTriangle size={15} />
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
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 shrink-0">
                  <Database size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Tabela ou colunas de{" "}
                    <code className="font-mono text-amber-400">controle_pk</code>{" "}
                    pendentes no Supabase
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Execute o SQL abaixo no{" "}
                    <strong className="text-slate-200">
                      Supabase Dashboard → SQL Editor
                    </strong>{" "}
                    e clique em Verificar Tabela.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => void handleCopySql()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold cursor-pointer"
                >
                  {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                  {copiedSql ? "SQL Copiado!" : "Copiar SQL"}
                </button>
                <button
                  onClick={() => void fetchRows()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <RefreshCw size={14} />
                  Verificar Tabela
                </button>
              </div>
            </div>
            <pre className="p-3.5 rounded-xl bg-slate-950/90 border border-white/[0.06] text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
              {SQL_SETUP_SCRIPT}
            </pre>
          </div>
        )}

        {/* Abas principais: Dashboard (Consolidado) vs Tabela */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {canViewDashboard && (
              <button
                type="button"
                onClick={() => setMainTab("dashboard")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all border cursor-pointer ${
                  mainTab === "dashboard"
                    ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <BarChart3 size={13} />
                Dashboard
              </button>
            )}

            {canViewTable && (
              <button
                type="button"
                onClick={() => setMainTab("tabela")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all border cursor-pointer ${
                  mainTab === "tabela"
                    ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Table2 size={13} />
                Tabela
                <span
                  className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] leading-none ${
                    mainTab === "tabela"
                      ? "bg-white/20 text-white"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {periodFilteredRows.length}
                </span>
              </button>
            )}
          </div>

          {mainTab === "dashboard" && (
            canEdit ? (
              <button
                type="button"
                onClick={() => {
                  setMainTab("tabela")
                  setShowAddModal(true)
                }}
                disabled={tableMissing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 text-xs font-semibold tracking-wide transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={14} className="text-emerald-400" />
                <span>Novo Aviso</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 text-xs font-medium">
                <Lock size={12} className="text-slate-500" />
                <span>Modo Leitura</span>
              </div>
            )
          )}
        </div>

        {/* Filtro de Período (expande os 12 mini calendários ao clicar) */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
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
              className={`inline-flex items-center gap-2 px-2.5 py-1 -ml-1 rounded-lg border transition-colors cursor-pointer ${
                showCalendars
                  ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-200"
                  : "bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.08] text-slate-200"
              }`}
            >
              <Calendar size={14} className="text-emerald-400 shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {activeWeekRange
                  ? `Semanal: ${activeWeekRange.label}`
                  : selectedMonth === null
                    ? `Todos os Períodos (${rows.length})`
                    : selectedDay !== null
                      ? `${String(selectedDay).padStart(2, "0")} de ${MONTHS_PT[selectedMonth - 1].name} de ${selectedYear}`
                      : `${MONTHS_PT[selectedMonth - 1].name} de ${selectedYear}`}
              </span>
              {(activeWeekRange !== null || selectedMonth !== null) && (
                <span className="text-[10px] font-mono text-slate-400">
                  · {periodFilteredRows.length}{" "}
                  {periodFilteredRows.length === 1 ? "aviso" : "avisos"}
                </span>
              )}
              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform duration-200 ${
                  showCalendars ? "rotate-180 text-emerald-300" : ""
                }`}
              />
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              {showCalendars && (
                <div className="inline-flex items-center rounded-lg border border-white/[0.08] bg-slate-900/80 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear((y) => y - 1)
                      setSelectedDay(null)
                      setSelectedWeekAnchorIso(null)
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                    title="Ano anterior"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="px-2 text-xs font-mono font-bold text-white">
                    {selectedYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear((y) => y + 1)
                      setSelectedDay(null)
                      setSelectedWeekAnchorIso(null)
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
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
                    className="p-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 transition-colors cursor-pointer"
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
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                    activeWeekRange
                      ? "bg-sky-500/20 border-sky-500/40 text-sky-200"
                      : "bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.08] text-slate-300 hover:text-white"
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
                    className="p-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 transition-colors cursor-pointer"
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
                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Mês Atual
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
                className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                  selectedMonth === null && !activeWeekRange
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.08] text-slate-400 hover:text-slate-200"
                }`}
              >
                Todos ({rows.length})
              </button>
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
                <div className="pt-3 mt-2.5 border-t border-white/[0.05] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-1.5">
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
                  className={`relative rounded-xl overflow-hidden border transition-all flex flex-col ${
                    isSelected
                      ? "border-emerald-400/80 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                      : isWeekMonth
                        ? "border-sky-400/70 bg-sky-500/10 shadow-lg shadow-sky-500/10"
                        : isCurrentRealMonth
                          ? "border-amber-400/60 bg-amber-500/[0.06]"
                          : "border-white/[0.07] bg-slate-900/65 hover:border-white/15"
                  }`}
                >
                  {/* Cabeçalho do quadradinho do mês (clique seleciona o mês inteiro) */}
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
                        ? "bg-emerald-500/25 border-emerald-400/30 text-emerald-200"
                        : isWeekMonth
                          ? "bg-sky-500/20 border-sky-400/30 text-sky-200"
                          : isCurrentRealMonth
                            ? "bg-amber-500/20 border-amber-400/30 text-amber-200 hover:bg-amber-500/30"
                            : "bg-white/[0.04] border-white/[0.06] text-slate-300 hover:bg-white/[0.08]"
                    }`}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <span
                        className={`text-[10px] font-bold tracking-wider ${
                          isSelected
                            ? "text-emerald-200"
                            : isWeekMonth
                              ? "text-sky-200"
                              : ""
                        }`}
                      >
                        {m.short}
                      </span>
                      {isCurrentRealMonth && (
                        <span className="text-[7px] font-bold uppercase tracking-wider px-1 rounded bg-amber-400/25 text-amber-200">
                          Atual
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold leading-none ${
                        isSelected
                          ? "text-emerald-200"
                          : isWeekMonth
                            ? "text-sky-200"
                            : count > 0
                              ? "text-white"
                              : "text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>

                  {/* Grade clicável dos dias dentro do quadradinho do mês */}
                  <div className="p-1.5 space-y-0.5 flex-1">
                    <div className="grid grid-cols-7 gap-[1px] text-[7px] font-semibold text-slate-500/80 text-center select-none">
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
                            className={`h-[15px] rounded-[3px] font-mono text-[8px] leading-none tabular-nums flex items-center justify-center transition-colors cursor-pointer ${
                              isSelectedDay
                                ? "bg-emerald-500 text-slate-950 font-bold shadow-sm"
                                : isInSelectedWeek
                                  ? isToday
                                    ? "bg-sky-400 text-slate-950 ring-1 ring-amber-300 font-bold shadow-sm"
                                    : "bg-sky-400/85 text-slate-950 font-bold shadow-sm hover:bg-sky-300"
                                  : isToday
                                    ? "bg-amber-400/25 text-amber-200 ring-1 ring-amber-400/80 font-bold hover:bg-amber-400/35"
                                    : dayCount > 0
                                      ? "bg-sky-500/20 text-sky-200 font-semibold hover:bg-sky-500/35"
                                      : "text-slate-500 hover:bg-white/[0.08] hover:text-slate-200"
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.16 }}
            >
              <ControlePKDashboard
                rows={periodFilteredRows}
                loading={loading}
                periodLabel={
                  activeWeekRange
                    ? `Semana ${activeWeekRange.label}`
                    : selectedMonth === null
                      ? `Todos os Períodos (${rows.length} avisos)`
                      : selectedDay !== null
                        ? `${String(selectedDay).padStart(2, "0")} de ${MONTHS_PT[selectedMonth - 1].name} de ${selectedYear}`
                        : `${MONTHS_PT[selectedMonth - 1].name} de ${selectedYear}`
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key="pk-tabela"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.16 }}
              className="space-y-4"
            >
        {/* Barra de filtros, busca, botão sucinto + Aviso e menu 3 pontinhos */}
        <div className="rounded-2xl border border-[#273647] bg-[#0d1c2d] px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-lg">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "todos", label: `Todos (${stats.total})` },
                { id: "pendentes", label: `Pendentes (${stats.pendentes})` },
                {
                  id: "atualizados",
                  label: `Atualizados (${stats.atualizados})`,
                },
                { id: "Simples", label: `Simples (${stats.simples})` },
                { id: "Normal", label: `Normal (${stats.normal})` },
                { id: "Complexa", label: `Complexa (${stats.complexa})` },
              ] as { id: FilterTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                  filterTab === tab.id
                    ? tab.id === "Complexa"
                      ? "bg-red-500/20 text-red-400 border border-red-500/40"
                      : "bg-[#159BFF] text-[#003157] border border-[#159BFF]"
                    : "bg-[#122131] text-[#bfc7d5] border border-[#273647]/80 hover:bg-[#1c2b3c] hover:text-[#d4e4fa]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#89919e]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar aviso, empresa, solicitante..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#051424] border border-[#273647] focus:border-[#159BFF]/60 text-xs text-white placeholder:text-[#89919e] outline-none"
              />
            </div>

            {canEdit ? (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                disabled={tableMissing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4edea3] hover:bg-[#3cc990] text-[#003157] text-xs font-semibold tracking-wide transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                title="Adicionar um ou vários avisos"
              >
                <Plus size={14} />
                <span>Aviso</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 text-xs font-medium shrink-0">
                <Lock size={12} className="text-slate-500" />
                <span>Leitor</span>
              </div>
            )}

            <div className="relative" ref={actionsMenuRef}>
              <button
                type="button"
                onClick={() => setShowActionsMenu((prev) => !prev)}
                aria-label="Opções de configuração"
                title="Configurações e ações"
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  showActionsMenu
                    ? "bg-[#122131] border-[#159BFF]/60 text-white"
                    : "bg-[#122131] hover:bg-[#1c2b3c] border-[#273647] text-[#bfc7d5] hover:text-white"
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
                    className="absolute right-0 top-full mt-2 z-40 w-56 rounded-2xl border border-[#273647] bg-[#0d1c2d]/95 backdrop-blur-xl shadow-2xl p-1.5 space-y-1"
                  >
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionsMenu(false)
                          setShowImportModal(true)
                        }}
                        disabled={tableMissing}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-[#9fcaff] hover:bg-[#159BFF]/15 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <UploadCloud size={15} className="text-[#159BFF] shrink-0" />
                        <span>Atualizar via Planilha</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowActionsMenu(false)
                        handleExportExcel()
                      }}
                      disabled={filteredRows.length === 0}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-[#d4e4fa] hover:bg-[#122131] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download size={15} className="text-[#4edea3] shrink-0" />
                      <span>Exportar Excel</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Tabela principal Controle PK (estilo Dashboard) */}
        <div className="bg-[#0d1c2d] rounded-2xl p-4 md:p-5 shadow-2xl relative overflow-hidden border border-[#273647] text-[#d4e4fa]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#273647] text-[#89919e] font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3 font-medium whitespace-nowrap">
                    Aviso
                  </th>
                  <th className="py-3 px-3 font-medium text-center whitespace-nowrap">
                    Data Sep.
                  </th>
                  <th className="py-3 px-3 font-medium whitespace-nowrap">
                    Pessoa
                  </th>
                  <th className="py-3 px-3 font-medium text-center whitespace-nowrap">
                    Peças
                  </th>
                  <th className="py-3 px-3 font-medium text-center whitespace-nowrap">
                    SKUs
                  </th>
                  <th className="py-3 px-3 font-medium text-center whitespace-nowrap">
                    Tempo Sep.
                  </th>
                  <th className="py-3 px-3 font-medium text-center whitespace-nowrap">
                    Embarque
                  </th>
                  <th className="py-3 px-3 font-medium whitespace-nowrap">
                    Conferente
                  </th>
                  <th className="py-3 px-3 font-medium text-center whitespace-nowrap">
                    Tempo Conf.
                  </th>
                  <th className="py-3 px-3 font-medium text-center whitespace-nowrap">
                    Tempo Emb.
                  </th>
                  <th className="py-3 px-3 font-medium whitespace-nowrap">
                    Empresa
                  </th>
                  <th className="py-3 px-3 font-medium whitespace-nowrap">
                    Solicitante
                  </th>
                  <th className="py-3 px-3 font-medium whitespace-nowrap">
                    Notas
                  </th>
                  <th className="py-3 px-3 font-medium text-right whitespace-nowrap">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#273647]/50">
                {loading ? (
                  <tr>
                    <td
                      colSpan={14}
                      className="px-6 py-12 text-center text-[#89919e] text-xs"
                    >
                      <Loader2
                        size={18}
                        className="animate-spin text-[#4edea3] mx-auto mb-2"
                      />
                      Carregando registros de Controle PK...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={14}
                      className="px-6 py-12 text-center text-[#89919e] text-xs"
                    >
                      <FileSpreadsheet
                        size={22}
                        className="mx-auto mb-2 text-[#89919e]"
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
                              ? "bg-[#122131]"
                              : "hover:bg-[#122131]/60"
                          }`}
                        >
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleExpand(row)}
                                title={
                                  isExpanded
                                    ? "Recolher detalhes do aviso"
                                    : "Clique para visualizar detalhes"
                                }
                                className="inline-flex items-center gap-1 font-mono text-xs font-normal text-white hover:text-[#9fcaff] transition-colors cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronDown
                                    size={13}
                                    className="text-[#4edea3] shrink-0"
                                  />
                                ) : (
                                  <ChevronRight
                                    size={13}
                                    className="text-[#89919e] group-hover:text-[#4edea3] shrink-0 transition-colors"
                                  />
                                )}
                                <span>{row.aviso}</span>
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-xs font-mono text-[#d4e4fa]">
                              <Calendar
                                size={11}
                                className="text-[#89919e] shrink-0"
                              />
                              <span>
                                {effectiveDateIso
                                  ? formatDateBr(effectiveDateIso)
                                  : "—"}
                              </span>
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {renderPeopleBadgeCell(row.pessoa, "sky")}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-center text-[#9fcaff] whitespace-nowrap">
                            {Number(row.pecas || 0).toLocaleString("pt-BR")}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-center text-[#d0bcff] whitespace-nowrap">
                            {Number(row.skus || 0).toLocaleString("pt-BR")}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {renderDurationCell(
                              row.inicio,
                              row.final,
                              "Separação",
                              "sky"
                            )}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {renderTipoEmbarqueBadge(row.tipo_de_embarque)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {renderPeopleBadgeCell(row.conferente, "emerald")}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {renderDurationCell(
                              row.conferencia_inicial,
                              row.conferencia_final,
                              "Conferência",
                              "emerald"
                            )}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {renderDurationCell(
                              row.horario_inicio_embalagem,
                              row.horario_final_embalagem,
                              "Embalagem",
                              "amber"
                            )}
                          </td>
                          <td className="py-3 px-3 text-xs font-medium text-[#d4e4fa] max-w-[140px] truncate" title={row.empresa || undefined}>
                            {row.empresa || (
                              <span className="text-[#89919e]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-xs text-[#bfc7d5] min-w-[130px] max-w-[220px]">
                            {row.solicitante ? (
                              <span
                                className="line-clamp-2 break-words leading-snug"
                                title={row.solicitante}
                              >
                                {row.solicitante}
                              </span>
                            ) : (
                              <span className="text-[#89919e]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-[#d4e4fa] max-w-[115px] truncate" title={row.notas || undefined}>
                            {row.notas || (
                              <span className="text-[#89919e]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-0.5">
                              {canEdit ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(row)}
                                    className="p-1.5 rounded-lg text-[#89919e] hover:text-[#9fcaff] hover:bg-[#159BFF]/10 transition-colors cursor-pointer"
                                    title={`Editar aviso ${row.aviso}`}
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteRow(row)}
                                    className="p-1.5 rounded-lg text-[#89919e] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                    title={`Remover aviso ${row.aviso}`}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              ) : (
                                <span className="p-1.5 text-slate-600 cursor-not-allowed" title="Apenas visualização">
                                  <Lock size={12} />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-[#051424]/70">
                            <td colSpan={14} className="px-4 py-4">
                              <div className="rounded-xl border border-[#273647] bg-[#122131] p-5 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#273647]/60">
                                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#4edea3]">
                                    Detalhes Manuais — Aviso{" "}
                                    <span className="font-mono font-normal text-white">
                                      {row.aviso}
                                    </span>
                                  </h3>

                                  {rowEmbDur && (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#159BFF]/10 border border-[#159BFF]/30 text-[#9fcaff] text-xs font-mono">
                                      <Clock size={12} />
                                      <span>
                                        Tempo Embalagem: {rowEmbDur.formatted}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                  <div className="rounded-xl bg-[#0d1c2d] border border-[#273647] px-3.5 py-2.5">
                                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#89919e] mb-1">
                                      Embalador
                                    </span>
                                    <div className="text-xs text-[#d4e4fa]">
                                      {row.embalador ? (
                                        <span title={row.embalador} className="cursor-help">
                                          {splitPeopleNames(row.embalador).length > 1
                                            ? `${splitPeopleNames(row.embalador).length} pessoas (${row.embalador})`
                                            : row.embalador}
                                        </span>
                                      ) : (
                                        <span className="text-[#89919e]">—</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="rounded-xl bg-[#0d1c2d] border border-[#273647] px-3.5 py-2.5">
                                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#89919e] mb-1">
                                      Horário Início Embalagem
                                    </span>
                                    <p className="text-xs font-mono text-[#d4e4fa]">
                                      {row.horario_inicio_embalagem || (
                                        <span className="text-[#89919e]">—</span>
                                      )}
                                    </p>
                                  </div>

                                  <div className="rounded-xl bg-[#0d1c2d] border border-[#273647] px-3.5 py-2.5">
                                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#89919e] mb-1">
                                      Horário Final Embalagem
                                    </span>
                                    <p className="text-xs font-mono text-[#d4e4fa]">
                                      {row.horario_final_embalagem || (
                                        <span className="text-[#89919e]">—</span>
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
              background: "rgba(2,6,23,0.8)",
            }}
            onClick={() => setShowImportModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-[#0B1120]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header modal */}
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Atualizar Controle PK pela Planilha
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      <strong className="text-sky-400">PD destino</strong>{" "}
                      atualiza Separação (Pessoa, Peças, SKUs, Início, Final, Tipo) ·{" "}
                      <strong className="text-emerald-400">PD origem</strong>{" "}
                      atualiza Conferência (Conferente, Conf. Inicial, Conf. Final).
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body modal */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Colunas consideradas */}
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] px-4 py-3 text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                  <span className="text-slate-300 font-semibold">
                    Colunas lidas:
                  </span>
                  {[
                    "Confirmado por",
                    "Produto",
                    "PD destino",
                    "PD origem",
                    "Qtd.real destino UMB",
                    "Hora da confirmação",
                  ].map((col) => (
                    <span
                      key={col}
                      className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-200 font-mono text-[10px]"
                    >
                      {col}
                    </span>
                  ))}
                </div>

                {/* Upload ou Colagem */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-2xl border-2 border-dashed border-slate-700 hover:border-sky-500/60 bg-slate-900/40 hover:bg-sky-500/5 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
                  >
                    <UploadCloud size={26} className="text-sky-400 mb-2" />
                    <p className="text-xs font-semibold text-white">
                      {importFileName
                        ? importFileName
                        : "Clique para selecionar arquivo (.xlsx, .xls, .csv)"}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
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
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Ou cole os dados copiados do Excel (com cabeçalho):
                    </label>
                    <textarea
                      value={importPasteText}
                      onChange={(e) => handlePasteTextChange(e.target.value)}
                      rows={4}
                      placeholder="Cole aqui as linhas copiadas da planilha..."
                      className="flex-1 w-full rounded-xl bg-slate-900/80 border border-white/[0.08] focus:border-sky-500/50 p-3 text-[11px] font-mono text-slate-200 placeholder:text-slate-600 outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Aviso de colunas ausentes */}
                {parseResult && parseResult.missingColumns.length > 0 && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">
                        Colunas não identificadas no cabeçalho:
                      </span>{" "}
                      {parseResult.missingColumns.join(", ")}
                    </div>
                  </div>
                )}

                {/* Preview da agregação */}
                {parseResult && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-slate-400">
                          Linhas lidas:{" "}
                          <strong className="text-white font-mono">
                            {parseResult.totalRawRows}
                          </strong>
                        </span>
                        <span className="text-emerald-400">
                          Avisos encontrados (PD destino / PD origem):{" "}
                          <strong className="font-mono">
                            {importAggregation.matchedUpdates.length}
                          </strong>
                        </span>
                        <span className="text-slate-400">
                          Avisos da tabela não encontrados:{" "}
                          <strong className="text-amber-400 font-mono">
                            {importAggregation.unmatchedAvisos.length}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {importAggregation.unmatchedAvisos.length > 0 && (
                      <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5 space-y-1.5">
                        <span className="block text-[11px] font-semibold text-amber-300">
                          Avisos da tabela não encontrados nesta planilha (
                          {importAggregation.unmatchedAvisos.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                          {importAggregation.unmatchedAvisos.map((aviso) => (
                            <span
                              key={aviso}
                              className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-amber-500/25 font-mono text-[10px] text-amber-200"
                            >
                              {aviso}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {importAggregation.matchedUpdates.length > 0 ? (
                      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                        <div className="overflow-x-auto max-h-60">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-white/[0.03] border-b border-white/[0.06] sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                  Aviso
                                </th>
                                <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400 text-center">
                                  Data Sep.
                                </th>
                                <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                  Pessoa (Sep.)
                                </th>
                                <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400 text-center">
                                  Peças
                                </th>
                                <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400 text-center">
                                  SKUs
                                </th>
                                <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-sky-400 text-center">
                                  Tempo de Sep.
                                </th>
                                <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400 text-center">
                                  Tipo
                                </th>
                                <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
                                  Conferente
                                </th>
                                <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-emerald-400 text-center">
                                  Tempo de Conf.
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                              {importAggregation.matchedUpdates.map((item) => (
                                <tr key={item.aviso} className="text-xs">
                                  <td className="px-3 py-2 font-mono font-bold text-white whitespace-nowrap">
                                    {item.aviso}
                                    <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                                      ({item.linhasSeparacao}S/{item.linhasConferencia}C)
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 font-mono text-center text-slate-300 whitespace-nowrap">
                                    {item.data_separacao
                                      ? formatDateBr(item.data_separacao)
                                      : "Manter linha"}
                                  </td>
                                  <td className="px-3 py-2 text-slate-300">
                                    {item.hasSeparacao ? item.pessoa || "—" : "—"}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-center text-sky-300">
                                    {item.hasSeparacao
                                      ? item.pecas.toLocaleString("pt-BR")
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-center text-indigo-300">
                                    {item.hasSeparacao ? item.skus : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-center">
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
                                  <td className="px-3 py-2 text-center">
                                    {item.hasSeparacao ? (
                                      renderTipoEmbarqueBadge(
                                        item.tipo_de_embarque
                                      )
                                    ) : (
                                      <span className="text-slate-600">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-emerald-200/90">
                                    {item.hasConferencia
                                      ? item.conferente || "—"
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-center">
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
                      </div>
                    ) : (
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center text-xs text-slate-400">
                        {rows.length === 0
                          ? "Cadastre pelo menos um número de aviso na tabela principal antes de importar."
                          : "Nenhum dos avisos cadastrados foi encontrado nas colunas PD destino ou PD origem desta planilha."}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer modal */}
              <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-3 bg-slate-950/50">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleApplyImport()}
                  disabled={
                    isApplyingImport ||
                    importAggregation.matchedUpdates.length === 0
                  }
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isApplyingImport ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  Atualizar {importAggregation.matchedUpdates.length}{" "}
                  {importAggregation.matchedUpdates.length === 1
                    ? "Aviso"
                    : "Avisos"}
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
              background: "rgba(2,6,23,0.75)",
            }}
            onClick={() => setShowModuleModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
              style={{
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-8 pt-8 pb-5 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mb-4">
                  <Repeat2 size={22} className="text-white/70" />
                </div>
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  Selecionar Módulo
                </h2>
                <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-widest">
                  Escolha o módulo desejado
                </p>
              </div>

              <div className="px-6 pb-6 flex flex-col gap-3">
                {MODULES.map((mod) => {
                  const Icon = mod.icon
                  return (
                    <button
                      key={mod.id}
                      onClick={() => {
                        setShowModuleModal(false)
                        router.push(mod.href)
                      }}
                      className={`w-full rounded-2xl p-4 flex items-center justify-between border-2 transition-all duration-200 cursor-pointer text-left ${
                        mod.active
                          ? mod.hoverBorder
                          : `border-transparent bg-white/5 ${mod.hoverBorder}`
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-xl ${mod.iconBg} shadow-lg`}
                        >
                          <Icon size={22} className="text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white">
                              {mod.name}
                            </p>
                            {mod.active && (
                              <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Atual
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {mod.subtitle}
                          </p>
                        </div>
                      </div>
                      <ArrowRight size={16} className={mod.textAccent} />
                    </button>
                  )
                })}

                <button
                  onClick={() => {
                    setShowModuleModal(false)
                    router.push("/")
                  }}
                  className="mt-1 w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Tela Inicial de Módulos
                </button>
              </div>

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
              background: "rgba(2,6,23,0.8)",
            }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.form
              onSubmit={(e) => void handleAddAvisos(e)}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-[#0B1120]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                    <Plus size={17} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Adicionar Aviso(s)
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Digite um aviso ou cole vários para adicionar em massa.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Número(s) do Aviso *
                  </label>
                  {addAvisosPreview.uniqueTokens.length > 0 && (
                    <span className="text-[10px] font-mono text-emerald-400">
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/[0.08] focus:border-emerald-500/50 text-xs text-white font-mono uppercase placeholder:text-slate-600 placeholder:normal-case outline-none resize-y min-h-[120px]"
                />
                <p className="text-[11px] text-slate-500">
                  Depois de adicionar, use o botão de editar na linha para
                  preencher Empresa, Qtde. Notas, Data de Faturamento e
                  Solicitante.
                </p>
              </div>

              <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-2 bg-slate-950/50">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-300 cursor-pointer"
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isAddingAviso ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  {addAvisosPreview.toInsert.length > 1
                    ? `Adicionar ${addAvisosPreview.toInsert.length} Avisos`
                    : "Adicionar Aviso"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Edição de Aviso (Empresa, Qtde. Notas, Data de Faturamento, Solicitante) */}
      <AnimatePresence>
        {editingRow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[135] flex items-center justify-center p-2 sm:p-3"
            style={{
              backdropFilter: "blur(14px)",
              background: "rgba(2,6,23,0.8)",
            }}
            onClick={() => setEditingRow(null)}
          >
            <motion.form
              onSubmit={(e) => void handleSaveEditModal(e)}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-6xl max-h-[96vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0B1120]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400">
                    <Pencil size={14} />
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-2.5">
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                      Editar Aviso
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      Preencha ou edite todas as colunas do registro.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="px-4 py-3 space-y-2.5 overflow-y-auto lg:overflow-visible flex-1">
                {/* 1. Dados do Aviso e Faturamento */}
                <div className="space-y-2">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-amber-400">
                    Dados do Aviso e Faturamento
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-sky-500/50 text-[11px] text-white font-mono uppercase outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Data Separação
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-sky-500/50 text-[11px] text-slate-200 font-mono outline-none [color-scheme:dark]"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-sky-500/50 text-[11px] text-white placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-sky-500/50 text-[11px] text-white font-mono placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Qtde. Notas
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-sky-500/50 text-[11px] text-white font-mono placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Data de Faturamento
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-sky-500/50 text-[11px] text-slate-200 font-mono outline-none [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
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
                      placeholder="Nome do solicitante, observações ou instruções detalhadas..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-sky-500/50 text-[11px] text-white placeholder:text-slate-600 outline-none resize-none min-h-[30px]"
                    />
                  </div>
                </div>

                {/* 2. Separação */}
                <div className="pt-2.5 border-t border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-sky-400">
                      Separação
                    </span>
                    {(() => {
                      const sepDur = calculateDuration(
                        editDraft.inicio,
                        editDraft.final
                      )
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/25 text-sky-300 text-[10px] font-mono">
                          <Clock size={10} />
                          Tempo Separação: {sepDur ? sepDur.formatted : "—"}
                        </span>
                      )
                    })()}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-sky-500/50 text-[11px] text-white placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-sky-500/50 text-[11px] text-white font-mono placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-sky-500/50 text-[11px] text-white font-mono placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Tipo de Embarque
                      </label>
                      <select
                        value={editDraft.tipo_de_embarque}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            tipo_de_embarque: e.target.value as "" | TipoEmbarque,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-sky-500/50 text-[11px] text-white outline-none cursor-pointer"
                      >
                        <option value="">Automático / Aguardando</option>
                        <option value="Simples">Simples</option>
                        <option value="Normal">Normal</option>
                        <option value="Complexa">Complexa</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Início Separação
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-sky-500/50 text-[11px] text-slate-200 font-mono placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Final Separação
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-sky-500/50 text-[11px] text-slate-200 font-mono placeholder:text-slate-600 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Conferência */}
                <div className="pt-2.5 border-t border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                      Conferência
                    </span>
                    {(() => {
                      const confDur = calculateDuration(
                        editDraft.conferencia_inicial,
                        editDraft.conferencia_final
                      )
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[10px] font-mono">
                          <Clock size={10} />
                          Tempo Conferência: {confDur ? confDur.formatted : "—"}
                        </span>
                      )
                    })()}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-emerald-500/50 text-[11px] text-white placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Início Conferência
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-emerald-500/50 text-[11px] text-slate-200 font-mono placeholder:text-slate-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Final Conferência
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-emerald-500/50 text-[11px] text-slate-200 font-mono placeholder:text-slate-600 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Embalagem */}
                <div className="pt-2.5 border-t border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
                      Embalagem
                    </span>
                  </div>

                  {(() => {
                    const embDur = calculateDuration(
                      editDraft.horario_inicio_embalagem,
                      editDraft.horario_final_embalagem
                    )
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                        <div>
                          <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
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
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-amber-500/50 text-[11px] text-white placeholder:text-slate-600 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                            Início Embalagem
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
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-amber-500/50 text-[11px] text-slate-200 font-mono outline-none [color-scheme:dark]"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                            Final Embalagem
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
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/[0.08] focus:border-amber-500/50 text-[11px] text-slate-200 font-mono outline-none [color-scheme:dark]"
                          />
                        </div>

                        <div>
                          <span className="block text-[9px] font-semibold uppercase tracking-wider text-amber-400/90 mb-1">
                            Tempo Embalagem
                          </span>
                          <div
                            className={`w-full px-2.5 py-1.5 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 ${
                              embDur
                                ? "bg-amber-500/15 border-amber-500/35 text-amber-300 font-semibold"
                                : "bg-slate-900/50 border-white/[0.06] text-slate-500"
                            }`}
                          >
                            <Clock size={11} className="shrink-0" />
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

              <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-end gap-2 bg-slate-950/50 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-semibold text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Save size={13} />
                  )}
                  Salvar Alterações
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
            className="fixed z-[160] pointer-events-none w-60 rounded-xl border border-white/15 bg-slate-950/95 backdrop-blur-xl shadow-2xl px-3.5 py-2.5 text-xs"
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-white/[0.08]">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  hoverTooltip.accent === "sky"
                    ? "text-sky-400"
                    : hoverTooltip.accent === "amber"
                      ? "text-amber-400"
                      : "text-emerald-400"
                }`}
              >
                {hoverTooltip.title}
              </span>
              {hoverTooltip.humanDuration && (
                <span className="text-[10px] font-mono text-slate-400">
                  {hoverTooltip.humanDuration}
                </span>
              )}
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400 font-sans">Início:</span>
                <span className="text-white font-semibold whitespace-nowrap">
                  {hoverTooltip.inicio || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400 font-sans">Final:</span>
                <span className="text-white font-semibold whitespace-nowrap">
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
