// ============================================================
// NEXUS ERP — Systems / systemDataService.ts
// Serviço Central de Registros e Confrontos em JSON Estruturado
// Armazena relações importadas (ex: A501, G501) e saldos do sistema
// ============================================================

import type {
  SystemStockRecord,
  SystemConfrontoConfig,
  ConfrontoImportedItem,
  ConfrontoComparisonRow,
  ConfrontoSummary,
} from "./types"

const RECORDS_STORAGE_KEY = "nexus_system_stock_records_v1"
const CONFRONTOS_STORAGE_KEY = "nexus_system_confrontos_json_v1"

class SystemDataService {
  private static instance: SystemDataService
  private constructor() {}

  public static getInstance(): SystemDataService {
    if (!SystemDataService.instance) {
      SystemDataService.instance = new SystemDataService()
    }
    return SystemDataService.instance
  }

  // ── 1. REGISTROS DE SALDO DO SISTEMA ─────────────────────────

  public getAllRecords(): SystemStockRecord[] {
    if (typeof window === "undefined") return []
    try {
      const stored = localStorage.getItem(RECORDS_STORAGE_KEY)
      if (!stored) return []
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  public getRecordsBySystem(systemId: string): SystemStockRecord[] {
    return this.getAllRecords().filter((r) => r.systemId === systemId)
  }

  public addRecord(
    data: Omit<SystemStockRecord, "id" | "registeredAt">
  ): SystemStockRecord {
    const newRecord: SystemStockRecord = {
      ...data,
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sku: data.sku.trim().toUpperCase(),
      description: data.description?.trim() || "Item sem descrição",
      quantity: Math.max(0, Number(data.quantity) || 0),
      registeredAt: new Date().toISOString(),
    }

    const current = this.getAllRecords()
    const updated = [newRecord, ...current]
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updated))
    return newRecord
  }

  public addRecordsBatch(
    records: Omit<SystemStockRecord, "id" | "registeredAt">[]
  ): number {
    const now = new Date().toISOString()
    const newRecords: SystemStockRecord[] = records.map((r, idx) => ({
      ...r,
      id: `rec_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      sku: r.sku.trim().toUpperCase(),
      description: r.description?.trim() || "Item sem descrição",
      quantity: Math.max(0, Number(r.quantity) || 0),
      registeredAt: now,
    }))

    const current = this.getAllRecords()
    const updated = [...newRecords, ...current]
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updated))
    return newRecords.length
  }

  public deleteRecord(id: string): void {
    const current = this.getAllRecords()
    const filtered = current.filter((r) => r.id !== id)
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(filtered))
  }

  public updateRecord(id: string, updates: Partial<SystemStockRecord>): void {
    const current = this.getAllRecords()
    const updated = current.map(r => r.id === id ? { ...r, ...updates } : r)
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updated))
  }

  public saveRecordsBatch(records: SystemStockRecord[]): void {
    const current = this.getAllRecords()
    const recIds = new Set(records.map(r => r.id))
    const unchanged = current.filter(r => !recIds.has(r.id))
    const updated = [...records, ...unchanged]
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updated))
  }

  public replaceRecordsForSystem(systemId: string, records: SystemStockRecord[]): void {
    const current = this.getAllRecords()
    const otherSystems = current.filter(r => r.systemId !== systemId)
    const updated = [...records, ...otherSystems]
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updated))
  }

  public clearRecordsBySystem(systemId: string): void {
    const current = this.getAllRecords()
    const filtered = current.filter((r) => r.systemId !== systemId)
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(filtered))
  }

  // ── 2. CONFRONTOS CONFIGURÁVEIS (RELAÇÃO EM TABELA JSON) ──────

  public getAllConfrontos(): SystemConfrontoConfig[] {
    if (typeof window === "undefined") return []
    try {
      const stored = localStorage.getItem(CONFRONTOS_STORAGE_KEY)
      if (!stored) return []
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  public getConfrontosBySystem(systemId: string): SystemConfrontoConfig[] {
    return this.getAllConfrontos().filter((c) => c.systemId === systemId)
  }

  public getConfrontoById(id: string): SystemConfrontoConfig | null {
    return this.getAllConfrontos().find((c) => c.id === id) || null
  }

  /**
   * Salva ou atualiza uma relação de confronto em JSON estruturado
   * (ex: "A501", "G501", "SAP-WMS")
   */
  public saveConfronto(
    data: Omit<SystemConfrontoConfig, "id" | "importedAt" | "totalItems" | "totalQuantity" | "status"> & {
      id?: string
      status?: "ativo" | "arquivado"
    }
  ): SystemConfrontoConfig {
    const totalItems = data.importedItems.length
    const totalQuantity = data.importedItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)
    const now = new Date().toISOString()

    const confrontoId = data.id || `conf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

    const newConfronto: SystemConfrontoConfig = {
      ...data,
      id: confrontoId,
      name: data.name.trim().toUpperCase(),
      description: data.description?.trim() || "",
      importedItems: data.importedItems,
      totalItems,
      totalQuantity,
      importedAt: now,
      status: data.status || "ativo",
    }

    const current = this.getAllConfrontos()
    const existingIdx = current.findIndex((c) => c.id === confrontoId)

    let updated: SystemConfrontoConfig[]
    if (existingIdx >= 0) {
      updated = [...current]
      updated[existingIdx] = newConfronto
    } else {
      updated = [newConfronto, ...current]
    }

    localStorage.setItem(CONFRONTOS_STORAGE_KEY, JSON.stringify(updated))
    return newConfronto
  }

  public deleteConfronto(id: string): void {
    const current = this.getAllConfrontos()
    const filtered = current.filter((c) => c.id !== id)
    localStorage.setItem(CONFRONTOS_STORAGE_KEY, JSON.stringify(filtered))
  }

  // ── 3. PARSER INTELIGENTE DE TEXTO IMPORTADO (EXCEL/SHEETS/CSV) ─

  /**
   * Analisa linhas de texto coladas do Excel/Google Sheets ou CSV.
   * Suporta separadores por TAB (\t), ponto-e-vírgula (;) ou vírgula (,).
   * Lida com formatação de números brasileira (ex: "1.250,50" ou "42").
   */
  public parseImportText(rawText: string): ConfrontoImportedItem[] {
    if (!rawText || !rawText.trim()) return []

    const lines = rawText.trim().split("\n").map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return []

    // Detecta se a 1ª linha é cabeçalho
    let startIndex = 0
    const firstLineLower = lines[0].toLowerCase()
    if (
      firstLineLower.includes("código") ||
      firstLineLower.includes("codigo") ||
      firstLineLower.includes("sku") ||
      firstLineLower.includes("descri") ||
      firstLineLower.includes("quant") ||
      firstLineLower.includes("qtd")
    ) {
      startIndex = 1
    }

    const itemsMap = new Map<string, ConfrontoImportedItem>()

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue

      // Tenta separar por TAB primeiro, senão por ponto-e-vírgula, senão por vírgula
      let cols: string[] = []
      if (line.includes("\t")) {
        cols = line.split("\t")
      } else if (line.includes(";")) {
        cols = line.split(";")
      } else if (line.includes(",")) {
        cols = line.split(",")
      } else {
        // Separa por espaços duplos
        cols = line.split(/\s{2,}/)
      }

      if (cols.length === 0) continue

      const sku = (cols[0] || "").trim().toUpperCase()
      if (!sku) continue

      let description = "-"
      let qtyStr = "0"

      if (cols.length >= 3) {
        description = (cols[1] || "-").trim()
        qtyStr = (cols[2] || "0").trim()
      } else if (cols.length === 2) {
        // Se só tem 2 colunas, verifica se a 2ª é número
        const maybeQty = Number(cols[1].replace(/\./g, "").replace(",", "."))
        if (!isNaN(maybeQty)) {
          qtyStr = cols[1].trim()
          description = `Item ${sku}`
        } else {
          description = cols[1].trim()
          qtyStr = "1"
        }
      }

      // Converte quantidade com formatação brasileira ou universal
      const cleanQtyStr = qtyStr.replace(/\./g, "").replace(",", ".")
      const quantity = Math.max(0, Number(cleanQtyStr) || 0)

      if (itemsMap.has(sku)) {
        // Agrupa itens repetidos somando a quantidade
        const existing = itemsMap.get(sku)!
        existing.quantity += quantity
        if (description !== "-" && existing.description === "-") {
          existing.description = description
        }
      } else {
        itemsMap.set(sku, {
          sku,
          description: description || `Item ${sku}`,
          quantity,
          rawLine: line,
        })
      }
    }

    return Array.from(itemsMap.values())
  }

  // ── 4. MOTOR DE CONFRONTO E ANÁLISE EM TEMPO REAL ─────────────

  /**
   * Compara os saldos do Sistema (registros ou posições mapeadas)
   * com a relação importada configurada (ex: A501).
   */
  public calculateComparison(
    systemRecords: SystemStockRecord[],
    confronto: SystemConfrontoConfig
  ): { rows: ConfrontoComparisonRow[]; summary: ConfrontoSummary } {
    // 1. Agrupa saldos líquidos (Entradas - Saídas) do sistema por SKU
    const systemMap = new Map<string, { qty: number; desc: string }>()
    systemRecords.forEach((rec) => {
      const sku = rec.sku.toUpperCase().trim()
      const prev = systemMap.get(sku) || { qty: 0, desc: rec.description }
      const hasSignedFields =
        (rec.entrada !== undefined && rec.entrada !== null) ||
        (rec.saida !== undefined && rec.saida !== null)
      const signedQty = hasSignedFields
        ? (Number(rec.entrada) || 0) - (Number(rec.saida) || 0)
        : Number(rec.quantity) || 0
      systemMap.set(sku, {
        qty: prev.qty + signedQty,
        desc: rec.description || prev.desc,
      })
    })

    // 2. Agrupa saldos da relação importada por SKU
    const confrontoMap = new Map<string, { qty: number; desc: string }>()
    confronto.importedItems.forEach((item) => {
      const sku = item.sku.toUpperCase().trim()
      const prev = confrontoMap.get(sku) || { qty: 0, desc: item.description }
      confrontoMap.set(sku, {
        qty: prev.qty + item.quantity,
        desc: item.description || prev.desc,
      })
    })

    // 3. Conjunto com todos os SKUs de ambos os lados
    const allSkus = new Set<string>([...systemMap.keys(), ...confrontoMap.keys()])
    const rows: ConfrontoComparisonRow[] = []

    let totalSystemQty = 0
    let totalConfrontoQty = 0
    let matchCount = 0
    let divergenceCount = 0

    allSkus.forEach((sku) => {
      const sys = systemMap.get(sku)
      const conf = confrontoMap.get(sku)

      const systemQty = sys ? sys.qty : 0
      const confrontoQty = conf ? conf.qty : 0
      const diff = systemQty - confrontoQty
      const description = (sys?.desc && sys.desc !== "-") ? sys.desc : (conf?.desc || "-")

      totalSystemQty += systemQty
      totalConfrontoQty += confrontoQty

      let status: ConfrontoComparisonRow["status"]
      if (sys && conf) {
        if (diff === 0) {
          status = "match"
          matchCount++
        } else if (diff < 0) {
          status = "missing" // Falta no sistema físico em relação ao confronto
          divergenceCount++
        } else {
          status = "excess" // Sobra no sistema físico em relação ao confronto
          divergenceCount++
        }
      } else if (sys && !conf) {
        status = "only_system"
        divergenceCount++
      } else {
        status = "only_confronto"
        divergenceCount++
      }

      rows.push({
        sku,
        description,
        systemQty,
        confrontoQty,
        diff,
        status,
      })
    })

    // Ordena divergentes primeiro
    rows.sort((a, b) => {
      if (a.status !== "match" && b.status === "match") return -1
      if (a.status === "match" && b.status !== "match") return 1
      return Math.abs(b.diff) - Math.abs(a.diff)
    })

    const totalSkus = allSkus.size
    const accuracyPercentage =
      totalSkus > 0 ? Math.round((matchCount / totalSkus) * 100) : 100

    const summary: ConfrontoSummary = {
      confrontoName: confronto.name,
      totalSkus,
      totalSystemQty,
      totalConfrontoQty,
      matchCount,
      divergenceCount,
      accuracyPercentage,
    }

    return { rows, summary }
  }
}

export const systemDataService = SystemDataService.getInstance()
