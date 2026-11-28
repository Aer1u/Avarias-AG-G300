import * as XLSX from "xlsx"

export type TipoEmbarque = "Simples" | "Normal" | "Complexa"

export interface ControlePKRow {
  id: number
  aviso: string
  local?: string | null
  data_separacao: string | null
  pessoa: string | null
  pecas: number
  skus: number
  inicio: string | null
  final: string | null
  tipo_de_embarque: TipoEmbarque | null
  conferente: string | null
  conferencia_inicial: string | null
  conferencia_final: string | null
  empresa: string | null
  notas: string | null
  data_faturamento: string | null
  qtde_notas: number | null
  solicitante: string | null
  embalador: string | null
  horario_inicio_embalagem: string | null
  horario_final_embalagem: string | null
  created_at?: string
  updated_at?: string
}

export interface ParsedSpreadsheetRow {
  confirmadoPor: string
  produto: string
  pdDestino: string
  pdOrigem: string
  qtdDestino: number
  dataSeparacao: string | null
  horaConfirmacaoRaw: string
  horaDisplay: string
  horaSortMs: number | null
  rowOrder: number
}

export interface AggregatedAvisoUpdate {
  aviso: string
  hasSeparacao: boolean
  data_separacao: string | null
  pessoa: string
  pecas: number
  skus: number
  inicio: string | null
  final: string | null
  tipo_de_embarque: TipoEmbarque | null
  linhasSeparacao: number
  hasConferencia: boolean
  conferente: string
  conferencia_inicial: string | null
  conferencia_final: string | null
  linhasConferencia: number
}

export interface ParseResult {
  rows: ParsedSpreadsheetRow[]
  missingColumns: string[]
  totalRawRows: number
}

export function normalizeAviso(value: unknown): string {
  let s = String(value ?? "")
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase()
  if (s.endsWith(".0") && /^\d+\.0$/.test(s)) {
    s = s.slice(0, -2)
  }
  return s
}

function canonicalAvisoKey(normalizedAviso: string): string {
  if (/^0+\d+$/.test(normalizedAviso)) {
    return normalizedAviso.replace(/^0+/, "") || "0"
  }
  return normalizedAviso
}

function normalizeHeader(header: string): string {
  return header
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[._\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function parseBrNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0
  if (typeof val === "number") return Number.isFinite(val) ? val : 0
  let s = String(val).trim().replace(/\s/g, "").replace(/[^\d.,\-]/g, "")
  if (!s) return 0

  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".")
    } else {
      s = s.replace(/,/g, "")
    }
  } else if (s.includes(",")) {
    s = s.replace(",", ".")
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "")
  }

  const parsed = Number(s)
  return Number.isFinite(parsed) ? parsed : 0
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

export function parseConfirmationTime(rawVal: unknown): {
  display: string
  sortMs: number | null
} {
  if (rawVal === null || rawVal === undefined) {
    return { display: "", sortMs: null }
  }

  if (rawVal instanceof Date && Number.isFinite(rawVal.getTime())) {
    const hh = rawVal.getHours()
    const mm = rawVal.getMinutes()
    const ss = rawVal.getSeconds()
    const ms = Date.UTC(
      rawVal.getFullYear(),
      rawVal.getMonth(),
      rawVal.getDate(),
      hh,
      mm,
      ss
    )
    return {
      display: `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`,
      sortMs: Number.isFinite(ms) ? ms : null,
    }
  }

  if (typeof rawVal === "number" && Number.isFinite(rawVal)) {
    // Excel serial date/time
    const frac = rawVal >= 1 ? rawVal % 1 : rawVal
    const totalSeconds = Math.round(frac * 86400) % 86400
    const hh = Math.floor(totalSeconds / 3600)
    const mm = Math.floor((totalSeconds % 3600) / 60)
    const ss = totalSeconds % 60
    const display = `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`

    if (rawVal >= 1) {
      const excelEpochMs = Date.UTC(1899, 11, 30)
      return { display, sortMs: excelEpochMs + Math.round(rawVal * 86400000) }
    }
    return { display, sortMs: totalSeconds * 1000 }
  }

  const s = String(rawVal).trim()
  if (!s || s === "-" || s.toLowerCase() === "nan") {
    return { display: "", sortMs: null }
  }

  // Case 1: "DD/MM/YYYY HH:mm(:ss)" or "DD.MM.YYYY HH:mm(:ss)" or "DD/MM/YY HH:mm(:ss)"
  const brDateTime = s.match(
    /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/
  )
  if (brDateTime) {
    const day = Number(brDateTime[1])
    const month = Number(brDateTime[2])
    let year = Number(brDateTime[3])
    if (year < 100) year += 2000
    const hh = Number(brDateTime[4])
    const mm = Number(brDateTime[5])
    const ss = Number(brDateTime[6] ?? 0)
    const ms = Date.UTC(year, month - 1, day, hh, mm, ss)
    return {
      display: `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`,
      sortMs: Number.isFinite(ms) ? ms : null,
    }
  }

  // Case 2: ISO "YYYY-MM-DD(T| )HH:mm(:ss)"
  const isoDateTime = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/
  )
  if (isoDateTime) {
    const year = Number(isoDateTime[1])
    const month = Number(isoDateTime[2])
    const day = Number(isoDateTime[3])
    const hh = Number(isoDateTime[4])
    const mm = Number(isoDateTime[5])
    const ss = Number(isoDateTime[6] ?? 0)
    const ms = Date.UTC(year, month - 1, day, hh, mm, ss)
    return {
      display: `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`,
      sortMs: Number.isFinite(ms) ? ms : null,
    }
  }

  // Case 3: Time only "HH:mm" or "HH:mm:ss" (or AM/PM)
  const timeOnly = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i)
  if (timeOnly) {
    let hh = Number(timeOnly[1])
    const mm = Number(timeOnly[2])
    const ss = Number(timeOnly[3] ?? 0)
    const meridiem = timeOnly[4]?.toUpperCase()
    if (meridiem === "PM" && hh < 12) hh += 12
    if (meridiem === "AM" && hh === 12) hh = 0
    const sortMs = (hh * 3600 + mm * 60 + ss) * 1000
    return {
      display: `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`,
      sortMs,
    }
  }

  // Fallback: extract any HH:mm:ss or HH:mm substring
  const anyTime = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (anyTime) {
    const hh = Number(anyTime[1])
    const mm = Number(anyTime[2])
    const ss = Number(anyTime[3] ?? 0)
    return {
      display: `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`,
      sortMs: (hh * 3600 + mm * 60 + ss) * 1000,
    }
  }

  return { display: s, sortMs: null }
}

export function classifyTipoEmbarque(skus: number): TipoEmbarque | null {
  if (skus <= 0) return null
  if (skus <= 10) return "Simples"
  if (skus <= 20) return "Normal"
  return "Complexa"
}

export interface DurationResult {
  formatted: string
  human: string
  totalSeconds: number
}

export function formatDurationHuman(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec) || sec <= 0) return "—"
  const r = Math.round(sec)
  if (r <= 0) return "—"
  if (r < 60) return `${r}s`

  const totalMinutes = Math.round(r / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`

  const totalHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (totalHours < 24) {
    return minutes > 0 ? `${totalHours}h ${minutes}min` : `${totalHours}h`
  }

  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (hours === 0 && minutes === 0) {
    return days === 1 ? "1 dia" : `${days} dias`
  }
  const parts = [`${days}d`]
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}min`)
  return parts.join(" ")
}

export function formatDurationDetailed(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec) || sec <= 0) return "—"
  const r = Math.round(sec)
  if (r <= 0) return "—"
  if (r < 60) return `${r}s`

  const days = Math.floor(r / 86400)
  const hours = Math.floor((r % 86400) / 3600)
  const minutes = Math.floor((r % 3600) / 60)
  const seconds = r % 60

  if (days > 0) {
    if (hours === 0 && minutes === 0 && seconds === 0) {
      return days === 1 ? "1 dia" : `${days} dias`
    }
    const parts = [`${days}d`]
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (seconds > 0 && hours === 0) parts.push(`${pad2(seconds)}s`)
    return parts.join(" ")
  }

  if (hours > 0) {
    const parts = [`${hours}h`]
    if (minutes > 0 || seconds > 0) parts.push(`${pad2(minutes)}m`)
    if (seconds > 0) parts.push(`${pad2(seconds)}s`)
    return parts.join(" ")
  }

  return `${minutes}m ${pad2(seconds)}s`
}

export function calculateDuration(
  startRaw: string | null | undefined,
  endRaw: string | null | undefined
): DurationResult | null {
  if (!startRaw || !endRaw) return null
  const start = parseConfirmationTime(startRaw)
  const end = parseConfirmationTime(endRaw)
  if (start.sortMs === null || end.sortMs === null) return null

  let diffMs = end.sortMs - start.sortMs
  // Suporte a virada de turno na madrugada (ex: 23:50 -> 00:15)
  if (diffMs < 0 && start.sortMs < 86400000 && end.sortMs < 86400000) {
    diffMs += 86400000
  }
  if (diffMs < 0) diffMs = 0

  const totalSeconds = Math.round(diffMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const formatted =
    days > 0
      ? `${days}d ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
      : `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`

  let human: string
  if (totalSeconds <= 0) {
    human = "0s"
  } else if (days > 0 && hours === 0 && minutes === 0 && seconds === 0) {
    human = days === 1 ? "1 dia" : `${days} dias`
  } else {
    const humanParts: string[] = []
    if (days > 0) humanParts.push(`${days}d`)
    if (hours > 0) humanParts.push(`${hours}h`)
    if (minutes > 0) humanParts.push(`${minutes}m`)
    if (seconds > 0 || humanParts.length === 0) humanParts.push(`${seconds}s`)
    human = humanParts.join(" ")
  }

  return {
    formatted,
    human,
    totalSeconds,
  }
}

export function getTodayIsoLocal(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export function formatDateBr(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return ""
  const s = String(isoOrDate).trim()
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`
  }
  const brMatch = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/)
  if (brMatch) {
    let year = Number(brMatch[3])
    if (year < 100) year += 2000
    return `${pad2(Number(brMatch[1]))}/${pad2(Number(brMatch[2]))}/${year}`
  }
  return s
}

export function parseSpreadsheetDate(rawVal: unknown): string | null {
  if (rawVal === null || rawVal === undefined || rawVal === "") return null

  if (rawVal instanceof Date && Number.isFinite(rawVal.getTime())) {
    return `${rawVal.getFullYear()}-${pad2(rawVal.getMonth() + 1)}-${pad2(rawVal.getDate())}`
  }

  if (typeof rawVal === "number" && Number.isFinite(rawVal)) {
    if (rawVal < 1) return null
    const excelEpochMs = Date.UTC(1899, 11, 30)
    const dt = new Date(excelEpochMs + Math.floor(rawVal) * 86400000)
    if (!Number.isFinite(dt.getTime())) return null
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
  }

  const s = String(rawVal).trim()
  if (!s || s === "-" || s.toLowerCase() === "nan") return null

  const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:$|[\sT])/)
  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Number(isoMatch[2])
    const day = Number(isoMatch[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }

  const brMatch = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:$|[\sT])/)
  if (brMatch) {
    const day = Number(brMatch[1])
    const month = Number(brMatch[2])
    let year = Number(brMatch[3])
    if (year < 100) year += 2000
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }

  return null
}

const COLUMN_ALIASES = {
  confirmadoPor: ["confirmado por", "confirmadopor"],
  produto: ["produto"],
  pdDestino: ["pd destino", "pddestino", "pd de destino", "posicao destino"],
  pdOrigem: ["pd origem", "pdorigem", "pd de origem", "posicao origem"],
  qtdDestino: [
    "qtd real destino umb",
    "qtd real dest umb",
    "qtd real destino",
    "qtd destino umb",
    "qtddestino",
    "qtd destino",
    "quantidade destino",
  ],
  horaConfirmacao: [
    "hora da confirmacao",
    "hora de confirmacao",
    "hora confirmacao",
    "hora confirm",
    "hr confirmacao",
    "horaconfirmacao",
    "hora da separacao",
    "hora de separacao",
    "hora separacao",
  ],
  dataConfirmacao: [
    "data da separacao",
    "data de separacao",
    "data separacao",
    "dt separacao",
    "data da confirmacao",
    "data de confirmacao",
    "data confirmacao",
    "data confirm",
    "dt confirmacao",
    "dt confirm",
    "data",
  ],
}

function findColumnKey(
  headers: string[],
  aliases: string[]
): string | undefined {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }))
  for (const alias of aliases) {
    const exact = normalized.find((h) => h.norm === alias)
    if (exact) return exact.raw
  }
  for (const alias of aliases) {
    const partial = normalized.find(
      (h) =>
        h.norm.includes(alias) &&
        !(alias === "data" && h.norm.includes("criacao"))
    )
    if (partial) return partial.raw
  }
  return undefined
}

function mapRawObjects(records: Record<string, unknown>[]): ParseResult {
  if (records.length === 0) {
    return {
      rows: [],
      missingColumns: [
        "Confirmado por",
        "Produto",
        "PD destino",
        "PD origem",
        "Qtd.real destino UMB",
        "Hora da confirmação",
      ],
      totalRawRows: 0,
    }
  }

  const headers = Object.keys(records[0])
  const kConfirmado = findColumnKey(headers, COLUMN_ALIASES.confirmadoPor)
  const kProduto = findColumnKey(headers, COLUMN_ALIASES.produto)
  const kPdDestino = findColumnKey(headers, COLUMN_ALIASES.pdDestino)
  const kPdOrigem = findColumnKey(headers, COLUMN_ALIASES.pdOrigem)
  const kQtdDestino = findColumnKey(headers, COLUMN_ALIASES.qtdDestino)
  const kHora = findColumnKey(headers, COLUMN_ALIASES.horaConfirmacao)
  const kData = findColumnKey(headers, COLUMN_ALIASES.dataConfirmacao)

  const missingColumns: string[] = []
  if (!kConfirmado) missingColumns.push("Confirmado por")
  if (!kProduto) missingColumns.push("Produto")
  if (!kPdDestino) missingColumns.push("PD destino")
  if (!kPdOrigem) missingColumns.push("PD origem")
  if (!kQtdDestino) missingColumns.push("Qtd.real destino UMB")
  if (!kHora) missingColumns.push("Hora da confirmação")

  const rows: ParsedSpreadsheetRow[] = records.map((rec, idx) => {
    const rawHora = kHora ? rec[kHora] : ""
    const parsedTime = parseConfirmationTime(rawHora)
    const parsedDate =
      (kData ? parseSpreadsheetDate(rec[kData]) : null) ??
      parseSpreadsheetDate(rawHora)

    // Combine separate Date + Time columns into a full UTC timestamp so cross-day
    // confirmations (e.g. 03/11 17:43 -> 04/11 06:46) sort chronologically by date+time.
    let combinedSortMs = parsedTime.sortMs
    if (parsedDate && parsedTime.display) {
      const dateMatch = parsedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      const timeMatch = parsedTime.display.match(/^(\d{2}):(\d{2}):(\d{2})$/)
      if (dateMatch && timeMatch) {
        const utcMs = Date.UTC(
          Number(dateMatch[1]),
          Number(dateMatch[2]) - 1,
          Number(dateMatch[3]),
          Number(timeMatch[1]),
          Number(timeMatch[2]),
          Number(timeMatch[3])
        )
        if (Number.isFinite(utcMs)) {
          combinedSortMs = utcMs
        }
      }
    }

    return {
      confirmadoPor: String((kConfirmado ? rec[kConfirmado] : "") ?? "").trim(),
      produto: String((kProduto ? rec[kProduto] : "") ?? "")
        .trim()
        .toUpperCase(),
      pdDestino: normalizeAviso(kPdDestino ? rec[kPdDestino] : ""),
      pdOrigem: normalizeAviso(kPdOrigem ? rec[kPdOrigem] : ""),
      qtdDestino: parseBrNumber(kQtdDestino ? rec[kQtdDestino] : 0),
      dataSeparacao: parsedDate,
      horaConfirmacaoRaw: String(rawHora ?? "").trim(),
      horaDisplay: parsedTime.display,
      horaSortMs: combinedSortMs,
      rowOrder: idx,
    }
  })

  return {
    rows,
    missingColumns,
    totalRawRows: records.length,
  }
}

function countMatchedHeaderColumns(cells: string[]): number {
  const clean = cells.filter(Boolean)
  if (clean.length === 0) return 0
  let hits = 0
  if (findColumnKey(clean, COLUMN_ALIASES.confirmadoPor)) hits += 1
  if (findColumnKey(clean, COLUMN_ALIASES.produto)) hits += 1
  if (findColumnKey(clean, COLUMN_ALIASES.pdDestino)) hits += 1
  if (findColumnKey(clean, COLUMN_ALIASES.pdOrigem)) hits += 1
  if (findColumnKey(clean, COLUMN_ALIASES.qtdDestino)) hits += 1
  if (findColumnKey(clean, COLUMN_ALIASES.horaConfirmacao)) hits += 1
  return hits
}

function splitDelimitedLine(line: string, sep: string): string[] {
  if (sep === "\t") {
    return line.split("\t").map((c) => c.replace(/^"|"$/g, "").trim())
  }
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

export function parseWorkbookBuffer(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "array" })
  if (wb.SheetNames.length === 0) {
    return { rows: [], missingColumns: [], totalRawRows: 0 }
  }

  let bestResult: ParseResult | null = null
  let bestScore = -1

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: "",
    })

    let headerRowIdx = 0
    let maxHits = -1
    const scanLimit = Math.min(matrix.length, 25)
    for (let r = 0; r < scanLimit; r++) {
      const rowCells = (matrix[r] || []).map((c) => String(c ?? "").trim())
      const hits = countMatchedHeaderColumns(rowCells)
      if (hits > maxHits) {
        maxHits = hits
        headerRowIdx = r
      }
      if (hits >= 5) break
    }

    const records = XLSX.utils
      .sheet_to_json<Record<string, unknown>>(sheet, {
        range: headerRowIdx,
        raw: true,
        defval: "",
      })
      .filter((rec) =>
        Object.values(rec).some((v) => String(v ?? "").trim() !== "")
      )

    const result = mapRawObjects(records)
    const score = (6 - result.missingColumns.length) * 100000 + result.rows.length
    if (score > bestScore) {
      bestScore = score
      bestResult = result
    }
    if (result.missingColumns.length === 0 && result.rows.length > 0) {
      return result
    }
  }

  return bestResult ?? { rows: [], missingColumns: [], totalRawRows: 0 }
}

export function parseDelimitedText(text: string): ParseResult {
  const cleanText = text.replace(/^\uFEFF/, "")
  const lines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "")

  if (lines.length < 2) {
    return { rows: [], missingColumns: [], totalRawRows: 0 }
  }

  const detectSeparator = (line: string) =>
    line.includes("\t") ? "\t" : line.includes(";") ? ";" : ","

  let headerLineIdx = 0
  let bestHits = -1
  let bestSep = detectSeparator(lines[0])
  const scanLimit = Math.min(lines.length - 1, 15)
  for (let i = 0; i < scanLimit; i++) {
    const sep = detectSeparator(lines[i])
    const cells = splitDelimitedLine(lines[i], sep)
    const hits = countMatchedHeaderColumns(cells)
    if (hits > bestHits) {
      bestHits = hits
      headerLineIdx = i
      bestSep = sep
    }
    if (hits >= 5) break
  }

  const headers = splitDelimitedLine(lines[headerLineIdx], bestSep)
  const records: Record<string, unknown>[] = []

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const cols = splitDelimitedLine(lines[i], bestSep)
    const rec: Record<string, unknown> = {}
    headers.forEach((h, colIdx) => {
      if (h) rec[h] = cols[colIdx] ?? ""
    })
    if (Object.values(rec).some((v) => String(v ?? "").trim() !== "")) {
      records.push(rec)
    }
  }

  return mapRawObjects(records)
}

function extractUniqueConfirmers(group: ParsedSpreadsheetRow[]): string {
  const set = new Set<string>()
  group.forEach((r) => {
    if (r.confirmadoPor) set.add(r.confirmadoPor)
  })
  return Array.from(set).join(", ")
}

function formatRowDateTime(row: ParsedSpreadsheetRow): string {
  return row.dataSeparacao
    ? `${formatDateBr(row.dataSeparacao)} ${row.horaDisplay}`
    : row.horaDisplay
}

function extractStartEndTimes(group: ParsedSpreadsheetRow[]): {
  inicio: string | null
  final: string | null
} {
  const withTime = group.filter((r) => r.horaDisplay !== "")
  if (withTime.length === 0) return { inicio: null, final: null }
  if (withTime.length === 1) {
    const dt = formatRowDateTime(withTime[0])
    return { inicio: dt, final: dt }
  }
  const allSortable = withTime.every((r) => r.horaSortMs !== null)
  if (allSortable) {
    const allHaveDateEpoch = withTime.every(
      (r) => (r.horaSortMs ?? 0) >= 86400000
    )
    const allTimeOnly = withTime.every((r) => (r.horaSortMs ?? 0) < 86400000)

    const sorted = [...withTime].sort((a, b) => {
      const aMs =
        allHaveDateEpoch || allTimeOnly
          ? (a.horaSortMs ?? 0)
          : (a.horaSortMs ?? 0) % 86400000
      const bMs =
        allHaveDateEpoch || allTimeOnly
          ? (b.horaSortMs ?? 0)
          : (b.horaSortMs ?? 0) % 86400000
      return aMs - bMs || a.rowOrder - b.rowOrder
    })

    const firstRow = sorted[0]
    const lastRow = sorted[sorted.length - 1]

    return {
      inicio: formatRowDateTime(firstRow),
      final: formatRowDateTime(lastRow),
    }
  }
  return {
    inicio: formatRowDateTime(withTime[0]),
    final: formatRowDateTime(withTime[withTime.length - 1]),
  }
}

export function aggregatePkByPdDestino(
  spreadsheetRows: ParsedSpreadsheetRow[],
  registeredAvisos: string[]
): {
  matchedUpdates: AggregatedAvisoUpdate[]
  unmatchedAvisos: string[]
} {
  const rowsByPdDestino = new Map<string, ParsedSpreadsheetRow[]>()
  const rowsByPdDestinoCanonical = new Map<string, ParsedSpreadsheetRow[]>()
  const rowsByPdOrigem = new Map<string, ParsedSpreadsheetRow[]>()
  const rowsByPdOrigemCanonical = new Map<string, ParsedSpreadsheetRow[]>()

  const pushMap = (
    map: Map<string, ParsedSpreadsheetRow[]>,
    key: string,
    row: ParsedSpreadsheetRow
  ) => {
    const list = map.get(key)
    if (list) list.push(row)
    else map.set(key, [row])
  }

  spreadsheetRows.forEach((r) => {
    if (r.pdDestino) {
      pushMap(rowsByPdDestino, r.pdDestino, r)
      const canonDest = canonicalAvisoKey(r.pdDestino)
      if (canonDest !== r.pdDestino) {
        pushMap(rowsByPdDestinoCanonical, canonDest, r)
      }
    }
    if (r.pdOrigem) {
      pushMap(rowsByPdOrigem, r.pdOrigem, r)
      const canonOrig = canonicalAvisoKey(r.pdOrigem)
      if (canonOrig !== r.pdOrigem) {
        pushMap(rowsByPdOrigemCanonical, canonOrig, r)
      }
    }
  })

  const matchedUpdates: AggregatedAvisoUpdate[] = []
  const unmatchedAvisos: string[] = []

  registeredAvisos.forEach((rawAviso) => {
    const aviso = normalizeAviso(rawAviso)
    if (!aviso) return
    const canonical = canonicalAvisoKey(aviso)

    const sepMap = new Map<number, ParsedSpreadsheetRow>()
    ;[
      ...(rowsByPdDestino.get(aviso) ?? []),
      ...(rowsByPdDestinoCanonical.get(canonical) ?? []),
      ...(canonical !== aviso ? (rowsByPdDestino.get(canonical) ?? []) : []),
    ].forEach((r) => sepMap.set(r.rowOrder, r))
    const sepGroup = Array.from(sepMap.values())

    const confMap = new Map<number, ParsedSpreadsheetRow>()
    ;[
      ...(rowsByPdOrigem.get(aviso) ?? []),
      ...(rowsByPdOrigemCanonical.get(canonical) ?? []),
      ...(canonical !== aviso ? (rowsByPdOrigem.get(canonical) ?? []) : []),
    ].forEach((r) => confMap.set(r.rowOrder, r))
    const confGroup = Array.from(confMap.values())

    if (sepGroup.length === 0 && confGroup.length === 0) {
      unmatchedAvisos.push(aviso)
      return
    }

    const hasSeparacao = sepGroup.length > 0
    const hasConferencia = confGroup.length > 0

    // Separação (PD destino)
    const pessoa = hasSeparacao ? extractUniqueConfirmers(sepGroup) : ""
    const pecas = hasSeparacao
      ? Math.round(
          sepGroup.reduce((sum, r) => sum + (Number(r.qtdDestino) || 0), 0)
        )
      : 0
    const skusSet = new Set<string>()
    sepGroup.forEach((r) => {
      if (r.produto) skusSet.add(r.produto)
    })
    const skus = hasSeparacao
      ? skusSet.size > 0
        ? skusSet.size
        : sepGroup.length
      : 0
    const sepTimes = hasSeparacao
      ? extractStartEndTimes(sepGroup)
      : { inicio: null, final: null }
    const sepWithDate = hasSeparacao
      ? sepGroup.filter((r) => r.dataSeparacao !== null)
      : []
    const dataSeparacao =
      sepWithDate.length > 0
        ? [...sepWithDate].sort(
            (a, b) => (a.horaSortMs ?? a.rowOrder) - (b.horaSortMs ?? b.rowOrder)
          )[0].dataSeparacao
        : null

    // Conferência (PD origem)
    const conferente = hasConferencia ? extractUniqueConfirmers(confGroup) : ""
    const confTimes = hasConferencia
      ? extractStartEndTimes(confGroup)
      : { inicio: null, final: null }

    matchedUpdates.push({
      aviso,
      hasSeparacao,
      data_separacao: dataSeparacao,
      pessoa,
      pecas,
      skus,
      inicio: sepTimes.inicio,
      final: sepTimes.final,
      tipo_de_embarque: hasSeparacao ? classifyTipoEmbarque(skus) : null,
      linhasSeparacao: sepGroup.length,
      hasConferencia,
      conferente,
      conferencia_inicial: confTimes.inicio,
      conferencia_final: confTimes.final,
      linhasConferencia: confGroup.length,
    })
  })

  return {
    matchedUpdates,
    unmatchedAvisos,
  }
}
