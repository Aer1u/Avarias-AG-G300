// ============================================================
// NEXUS ERP — Systems / systemBalanceService.ts
// Motor de Contabilização e Conservação de Saldo dos Sistemas
//
// INVARIANTE CENTRAL:
//   Entradas - Saídas = Saldo na Origem (Chão) + Σ Saldos nas demais Posições
//
// Regras:
// 1. Toda Entrada nos Registros gera saldo no Objeto Origem (Chão).
// 2. Alocações/movimentações para outras posições do sistema consomem
//    saldo do Objeto Origem (ou devolvem à Origem ao remover/reduzir).
// 3. Toda Saída nos Registros só é permitida se houver saldo disponível
//    no Objeto Origem (Chão).
// ============================================================

import { supabase } from "@/lib/supabase"
import {
  getLocalItems,
  saveLocalItems,
  type MapeamentoItem,
} from "@/lib/mapeamentosStorage"
import { systemDataService } from "./systemDataService"
import { toWorkspaceUuid } from "./useSystemStore"
import type { BusinessSystem, SystemStockRecord } from "./types"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normalizeSku(sku?: string | null): string {
  return String(sku || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function getRecordSignedQty(rec: SystemStockRecord): number {
  const hasEnt = rec.entrada !== undefined && rec.entrada !== null
  const hasSai = rec.saida !== undefined && rec.saida !== null
  if (hasEnt || hasSai) {
    return (Number(rec.entrada) || 0) - (Number(rec.saida) || 0)
  }
  return Number(rec.quantity) || 0
}

export function getOriginObjectId(system?: BusinessSystem | null): string | null {
  if (!system) return null
  if (system.originStorageId && system.originStorageId.trim() !== "") {
    return system.originStorageId.trim()
  }
  const originParticipant = system.participants?.find((p) => p.role === "origem")
  return originParticipant?.storageObjectId || null
}

export function getSystemPositionKey(systemId: string, objectId: string): string {
  return `sys_${systemId}_${objectId}`
}

export function parseSystemPositionKey(
  mapeamentoId: string,
  systemId: string
): string | null {
  const prefix = `sys_${systemId}_`
  if (!mapeamentoId.startsWith(prefix)) return null
  return mapeamentoId.slice(prefix.length)
}

export interface SystemBalanceSnapshot {
  originObjectId: string | null
  recordsNetBySku: Map<string, number>
  allocatedBySku: Map<string, number>
  originItemsBySku: Map<string, number>
  expectedOriginBySku: Map<string, number>
  descBySku: Map<string, string>
  positionTotalsByObjectId: Map<string, number>
  totalSystemNet: number
  totalOrigin: number
  totalAllocated: number
}

/**
 * Calcula o retrato completo de saldos de um sistema (Registros vs Origem vs Posições).
 */
export function getSystemBalanceSnapshot(
  system: BusinessSystem,
  recordsOverride?: SystemStockRecord[]
): SystemBalanceSnapshot {
  const originObjectId = getOriginObjectId(system)
  const records = recordsOverride ?? systemDataService.getRecordsBySystem(system.id)

  const recordsNetBySku = new Map<string, number>()
  const descBySku = new Map<string, string>()

  records.forEach((rec) => {
    const sku = normalizeSku(rec.sku)
    if (!sku) return
    const signed = getRecordSignedQty(rec)
    recordsNetBySku.set(sku, (recordsNetBySku.get(sku) || 0) + signed)
    if (rec.description && rec.description !== "-" && !descBySku.has(sku)) {
      descBySku.set(sku, rec.description)
    }
  })

  const allItems = getLocalItems()
  const prefix = `sys_${system.id}_`
  const systemItems = allItems.filter((it) => it.mapeamentoId.startsWith(prefix))

  const allocatedBySku = new Map<string, number>()
  const originItemsBySku = new Map<string, number>()
  const positionTotalsByObjectId = new Map<string, number>()

  systemItems.forEach((it) => {
    const objId = it.mapeamentoId.slice(prefix.length)
    const sku = normalizeSku(it.sku)
    const qty = Number(it.quantidade) || 0
    if (!sku || qty <= 0) return

    if (it.descricao && it.descricao !== "-" && !descBySku.has(sku)) {
      descBySku.set(sku, it.descricao)
    }

    positionTotalsByObjectId.set(
      objId,
      (positionTotalsByObjectId.get(objId) || 0) + qty
    )

    if (originObjectId && objId === originObjectId) {
      originItemsBySku.set(sku, (originItemsBySku.get(sku) || 0) + qty)
    } else {
      allocatedBySku.set(sku, (allocatedBySku.get(sku) || 0) + qty)
    }
  })

  const allSkus = new Set<string>([
    ...recordsNetBySku.keys(),
    ...allocatedBySku.keys(),
    ...originItemsBySku.keys(),
  ])

  const expectedOriginBySku = new Map<string, number>()
  let totalSystemNet = 0
  let totalOrigin = 0
  let totalAllocated = 0

  allSkus.forEach((sku) => {
    const net = recordsNetBySku.get(sku) || 0
    const alloc = allocatedBySku.get(sku) || 0
    const expectedOrigin = Math.max(0, net - alloc)
    expectedOriginBySku.set(sku, expectedOrigin)
    totalSystemNet += net
    totalAllocated += alloc
    totalOrigin += expectedOrigin
  })

  return {
    originObjectId,
    recordsNetBySku,
    allocatedBySku,
    originItemsBySku,
    expectedOriginBySku,
    descBySku,
    positionTotalsByObjectId,
    totalSystemNet,
    totalOrigin,
    totalAllocated,
  }
}

/**
 * Retorna os estoques disponíveis no Objeto Origem (Chão) para alocação nos Drives/Posições.
 */
export function getAvailableStocksFromOrigin(
  system: BusinessSystem,
  recordsOverride?: SystemStockRecord[]
): { sku: string; produto: string; descricao: string; available: number }[] {
  const snap = getSystemBalanceSnapshot(system, recordsOverride)
  const result: { sku: string; produto: string; descricao: string; available: number }[] = []

  snap.expectedOriginBySku.forEach((qty, sku) => {
    if (qty > 0) {
      result.push({
        sku,
        produto: sku,
        descricao: snap.descBySku.get(sku) || "Item do Sistema",
        available: qty,
      })
    }
  })

  return result.sort((a, b) => a.sku.localeCompare(b.sku))
}

/**
 * Reconcilia de forma idempotente os itens do Objeto Origem (Chão)
 * para garantir que:
 *   Soma no Chão (por SKU) === (Entradas - Saídas) - Alocado nas demais posições.
 * Preserva agrupamentos de paletes (idPalete), classificações e observações existentes.
 */
export function syncOriginWithSystemBalance(
  system: BusinessSystem,
  recordsOverride?: SystemStockRecord[]
): SystemBalanceSnapshot {
  const originObjectId = getOriginObjectId(system)
  const snap = getSystemBalanceSnapshot(system, recordsOverride)

  if (!originObjectId) {
    return snap
  }

  const originKey = getSystemPositionKey(system.id, originObjectId)
  const allItems = getLocalItems()
  const otherItems = allItems.filter((it) => it.mapeamentoId !== originKey)
  const originItems = allItems
    .filter((it) => it.mapeamentoId === originKey)
    .map((it) => ({ ...it }))

  const allSkus = new Set<string>([
    ...snap.expectedOriginBySku.keys(),
    ...snap.originItemsBySku.keys(),
  ])

  const now = new Date().toISOString()
  let changed = false

  allSkus.forEach((sku) => {
    const expected = Math.max(0, snap.expectedOriginBySku.get(sku) || 0)
    const matching = originItems.filter((it) => normalizeSku(it.sku) === sku)
    const current = matching.reduce((sum, it) => sum + (Number(it.quantidade) || 0), 0)
    const diff = expected - current

    if (diff > 0) {
      changed = true
      // Preferir incrementar item livre (sem idPalete) existente para preservar paletes agrupados
      const freeItem = matching.find(
        (it) => !it.idPalete || it.idPalete.trim() === ""
      )
      if (freeItem) {
        freeItem.quantidade = (Number(freeItem.quantidade) || 0) + diff
        freeItem.atualizadoEm = now
      } else {
        originItems.push({
          id: `item_org_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          mapeamentoId: originKey,
          posicao: system.originStorageLabel || "CHÃO",
          nivel: 0,
          profundidade: 0,
          sku,
          descricao: snap.descBySku.get(sku) || "Item de Origem",
          quantidade: diff,
          idPalete: undefined,
          customValues: {},
          criadoEm: now,
          atualizadoEm: now,
        })
      }
    } else if (diff < 0) {
      changed = true
      let toDeduct = Math.abs(diff)
      // Deduzir primeiro de itens livres (sem idPalete), depois dos agrupados se necessário
      const ordered = [...matching].sort((a, b) => {
        const aFree = !a.idPalete ? 0 : 1
        const bFree = !b.idPalete ? 0 : 1
        return aFree - bFree
      })

      for (const it of ordered) {
        if (toDeduct <= 0) break
        const q = Number(it.quantidade) || 0
        if (q <= toDeduct) {
          toDeduct -= q
          it.quantidade = 0
        } else {
          it.quantidade = q - toDeduct
          it.atualizadoEm = now
          toDeduct = 0
        }
      }
    }
  })

  if (changed) {
    const cleanedOrigin = originItems.filter((it) => (Number(it.quantidade) || 0) > 0)
    saveLocalItems([...otherItems, ...cleanedOrigin])
  }

  return getSystemBalanceSnapshot(system, recordsOverride)
}

/**
 * Busca registros do Supabase (universal_records) se o sistema tiver UUID válido,
 * atualiza o cache local e reconcilia o Objeto Origem (Chão).
 */
export async function fetchAndSyncSystemBalances(
  system: BusinessSystem
): Promise<{ records: SystemStockRecord[]; snapshot: SystemBalanceSnapshot }> {
  if (UUID_REGEX.test(system.id)) {
    try {
      const { data: dbRows, error } = await supabase
        .from("universal_records")
        .select("*")
        .eq("system_id", system.id)
        .order("created_at", { ascending: false })
        .limit(500)

      if (!error && Array.isArray(dbRows)) {
        const mapped: SystemStockRecord[] = dbRows.map((row: Record<string, unknown>) => {
          const meta =
            row.metadata && typeof row.metadata === "object"
              ? (row.metadata as Record<string, unknown>)
              : {}
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
          const dateStr =
            typeof meta.data === "string"
              ? meta.data
              : typeof row.created_at === "string"
              ? row.created_at.slice(0, 10)
              : ""

          return {
            id: String(row.id),
            systemId: system.id,
            sku: String(row.resource_id || ""),
            description: String(meta.description || row.resource_id || ""),
            quantity: Number(row.quantity) || 0,
            data: dateStr,
            entrada: entVal !== null && entVal !== undefined ? Number(entVal) : null,
            saida: saiVal !== null && saiVal !== undefined ? Number(saiVal) : null,
            tipo_avaria: meta.tipo_avaria ? String(meta.tipo_avaria) : "Sem Avaria",
            turno:
              meta.turno !== undefined && meta.turno !== null ? Number(meta.turno) : 1,
            origem: meta.origem ? String(meta.origem) : "Recebimento",
            transportadora: meta.transportadora ? String(meta.transportadora) : "",
            nota_fiscal:
              meta.nota_fiscal !== undefined && meta.nota_fiscal !== null
                ? (meta.nota_fiscal as string | number)
                : (row.document_ref as string | null) ?? null,
            placa: meta.placa ? String(meta.placa) : "",
            lacre: meta.lacre ? String(meta.lacre) : "",
            observacao:
              meta.observacao !== undefined
                ? String(meta.observacao || "")
                : String(row.justification || ""),
            positionLabel:
              typeof meta.positionLabel === "string"
                ? meta.positionLabel
                : system.originStorageLabel || "CHÃO",
            positionObjectId:
              typeof row.storage_object_id === "string"
                ? row.storage_object_id
                : system.originStorageId,
            registeredBy: row.responsible ? String(row.responsible) : undefined,
            registeredAt: String(row.created_at || new Date().toISOString()),
            isNew: false,
            isDirty: false,
          }
        })

        systemDataService.replaceRecordsForSystem(system.id, mapped)
        const snapshot = syncOriginWithSystemBalance(system, mapped)
        return { records: mapped, snapshot }
      }
    } catch (err) {
      console.warn("Falha ao sincronizar registros/saldos com Supabase:", err)
    }
  }

  const localRecords = systemDataService.getRecordsBySystem(system.id)
  const snapshot = syncOriginWithSystemBalance(system, localRecords)
  return { records: localRecords, snapshot }
}

/**
 * Valida se uma alteração ou exclusão nos Registros (Entradas / Saídas)
 * preserva a regra:
 *   - Saídas só podem ocorrer se o saldo estiver na Origem (Chão).
 *   - Entradas - Saídas >= Saldo alocado nas demais posições do sistema.
 */
export function validateSystemRecordsChange(
  system: BusinessSystem,
  proposedRecords: SystemStockRecord[],
  affectedSkus?: string[]
): { ok: true } | { ok: false; sku: string; errorMessage: string } {
  const snap = getSystemBalanceSnapshot(system, proposedRecords)

  const skusToCheck = affectedSkus
    ? Array.from(new Set(affectedSkus.map((s) => normalizeSku(s)).filter(Boolean)))
    : Array.from(
        new Set([
          ...snap.recordsNetBySku.keys(),
          ...snap.allocatedBySku.keys(),
        ])
      )

  for (const sku of skusToCheck) {
    const proposedNet = snap.recordsNetBySku.get(sku) || 0
    const allocatedInDrives = snap.allocatedBySku.get(sku) || 0
    const resultingOrigin = proposedNet - allocatedInDrives

    if (proposedNet < 0) {
      return {
        ok: false,
        sku,
        errorMessage: `Saldo insuficiente para o produto ${sku}: o total de saídas supera as entradas em ${Math.abs(proposedNet)} un.`,
      }
    }

    if (resultingOrigin < 0) {
      const currentSnap = getSystemBalanceSnapshot(system)
      const currentOrigin = currentSnap.expectedOriginBySku.get(sku) || 0
      return {
        ok: false,
        sku,
        errorMessage: `Saída/alteração bloqueada para ${sku}: o saldo precisa estar no Chão (Origem)! Disponível no Chão: ${currentOrigin} un. · Alocado em posições: ${allocatedInDrives} un. Devolva o saldo ao Chão antes de dar saída.`,
      }
    }
  }

  return { ok: true }
}

/**
 * Valida e aplica uma alteração de itens em uma posição NÃO-ORIGEM do sistema:
 * - Se a quantidade de algum SKU aumentou (+delta): valida e consome do Objeto Origem (Chão).
 * - Se a quantidade de algum SKU diminuiu (-delta): devolve automaticamente ao Objeto Origem (Chão).
 */
export function applyNonOriginPositionChange(
  system: BusinessSystem,
  targetObjectId: string,
  previousItems: MapeamentoItem[],
  nextItems: MapeamentoItem[],
  options?: { enforceStockLimit?: boolean }
): { ok: true } | { ok: false; errorMessage: string } {
  const enforce = options?.enforceStockLimit ?? true
  const originObjectId = getOriginObjectId(system)

  // Se a posição é a própria Origem, não executa transferência Origem -> Origem
  if (originObjectId && originObjectId === targetObjectId) {
    return { ok: true }
  }

  // Garante que a Origem está em dia antes de checar disponibilidade
  const snap = syncOriginWithSystemBalance(system)

  const prevBySku = new Map<string, number>()
  previousItems.forEach((it) => {
    const sku = normalizeSku(it.sku)
    if (!sku) return
    prevBySku.set(sku, (prevBySku.get(sku) || 0) + (Number(it.quantidade) || 0))
  })

  const nextBySku = new Map<string, number>()
  nextItems.forEach((it) => {
    const sku = normalizeSku(it.sku)
    if (!sku) return
    nextBySku.set(sku, (nextBySku.get(sku) || 0) + (Number(it.quantidade) || 0))
  })

  const allSkus = new Set<string>([...prevBySku.keys(), ...nextBySku.keys()])

  if (enforce) {
    for (const sku of allSkus) {
      const prevQty = prevBySku.get(sku) || 0
      const nextQty = nextBySku.get(sku) || 0
      const delta = nextQty - prevQty
      if (delta > 0) {
        const availableInOrigin = snap.expectedOriginBySku.get(sku) || 0
        if (delta > availableInOrigin) {
          return {
            ok: false,
            errorMessage: `Saldo insuficiente no Chão (Origem) para o produto ${sku}. Disponível na Origem: ${availableInOrigin} un. · Solicitado: ${delta} un.`,
          }
        }
      }
    }
  }

  // Persiste os itens da posição destino e reconcilia a Origem automaticamente
  const targetKey = getSystemPositionKey(system.id, targetObjectId)
  const others = getLocalItems().filter((it) => it.mapeamentoId !== targetKey)
  saveLocalItems([...others, ...nextItems])

  // Atualiza a Origem (abate o que entrou na posição ou devolve o que saiu dela)
  syncOriginWithSystemBalance(system)

  // Persiste movimentação/saldos no Supabase em segundo plano se UUID válido
  if (UUID_REGEX.test(system.id)) {
    const wsUuid = toWorkspaceUuid(system.workspaceId)
    allSkus.forEach((sku) => {
      const delta = (nextBySku.get(sku) || 0) - (prevBySku.get(sku) || 0)
      if (delta !== 0 && originObjectId) {
        supabase
          .from("universal_movements")
          .insert({
            workspace_id: wsUuid,
            system_id: system.id,
            resource_id: sku,
            from_storage_id: delta > 0 ? originObjectId : targetObjectId,
            to_storage_id: delta > 0 ? targetObjectId : originObjectId,
            quantity: Math.abs(delta),
            unit: "un",
            justification:
              delta > 0
                ? "Alocação da Origem (Chão) para posição"
                : "Retorno da posição para Origem (Chão)",
          })
          .then(({ error }) => {
            if (error) {
              console.warn("Aviso ao registrar universal_movements:", error.message)
            }
          })
      }
    })

    syncSupabaseUniversalBalances(system).catch(() => {})
  }

  return { ok: true }
}

/**
 * Move quantidade de um SKU entre duas posições do mesmo sistema
 * (ex: Origem -> Drive-In, Drive-In -> Origem, ou Posição A -> Posição B).
 */
export function moveSkuBetweenSystemPositions(params: {
  system: BusinessSystem
  fromObjectId: string
  toObjectId: string
  toPositionLabel: string
  sourceItem: MapeamentoItem
  quantityToMove: number
  targetLevel?: number
  targetDepth?: number
}): { ok: true } | { ok: false; errorMessage: string } {
  const {
    system,
    fromObjectId,
    toObjectId,
    toPositionLabel,
    sourceItem,
    quantityToMove,
    targetLevel = 1,
    targetDepth = 1,
  } = params

  if (fromObjectId === toObjectId) {
    return { ok: false, errorMessage: "Selecione uma posição de destino diferente da origem." }
  }
  const availableInSource = Number(sourceItem.quantidade) || 0
  if (quantityToMove <= 0 || quantityToMove > availableInSource) {
    return {
      ok: false,
      errorMessage: `Quantidade inválida para movimentação (máximo disponível no item: ${availableInSource} un.).`,
    }
  }

  const fromKey = getSystemPositionKey(system.id, fromObjectId)
  const toKey = getSystemPositionKey(system.id, toObjectId)
  const allItems = getLocalItems()
  const now = new Date().toISOString()

  const updatedAll: MapeamentoItem[] = []
  for (const it of allItems) {
    if (it.id === sourceItem.id && it.mapeamentoId === fromKey) {
      const remaining = availableInSource - quantityToMove
      if (remaining > 0) {
        updatedAll.push({ ...it, quantidade: remaining, atualizadoEm: now })
      }
    } else {
      updatedAll.push(it)
    }
  }

  const newTargetItem: MapeamentoItem = {
    id: `item_mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    mapeamentoId: toKey,
    posicao: toPositionLabel,
    nivel: targetLevel,
    profundidade: targetDepth,
    sku: normalizeSku(sourceItem.sku),
    descricao: sourceItem.descricao || "Item Movimentado",
    quantidade: quantityToMove,
    idPalete: undefined,
    customValues: { ...(sourceItem.customValues || {}) },
    criadoEm: now,
    atualizadoEm: now,
  }

  updatedAll.push(newTargetItem)
  saveLocalItems(updatedAll)

  // Garante consistência da Origem
  syncOriginWithSystemBalance(system)

  if (UUID_REGEX.test(system.id)) {
    const wsUuid = toWorkspaceUuid(system.workspaceId)
    supabase
      .from("universal_movements")
      .insert({
        workspace_id: wsUuid,
        system_id: system.id,
        resource_id: normalizeSku(sourceItem.sku),
        from_storage_id: fromObjectId,
        to_storage_id: toObjectId,
        quantity: quantityToMove,
        unit: "un",
        pallet_id: sourceItem.idPalete || null,
        justification: `Movimentação entre posições (${sourceItem.posicao} -> ${toPositionLabel})`,
      })
      .then(({ error }) => {
        if (error) {
          console.warn("Aviso ao registrar universal_movements:", error.message)
        }
      })

    syncSupabaseUniversalBalances(system).catch(() => {})
  }

  return { ok: true }
}

/**
 * Sincroniza o resumo de saldos por (system_id, storage_object_id, resource_id)
 * na tabela `universal_balances` do Supabase.
 */
export async function syncSupabaseUniversalBalances(
  system: BusinessSystem
): Promise<void> {
  if (!UUID_REGEX.test(system.id)) return
  const wsUuid = toWorkspaceUuid(system.workspaceId)
  const prefix = `sys_${system.id}_`
  const systemItems = getLocalItems().filter((it) => it.mapeamentoId.startsWith(prefix))

  const grouped = new Map<string, { storageObjectId: string; sku: string; qty: number }>()
  systemItems.forEach((it) => {
    const storageObjectId = it.mapeamentoId.slice(prefix.length)
    const sku = normalizeSku(it.sku)
    const qty = Number(it.quantidade) || 0
    if (!storageObjectId || !sku || qty <= 0) return
    const key = `${storageObjectId}::${sku}`
    const prev = grouped.get(key)
    if (prev) {
      prev.qty += qty
    } else {
      grouped.set(key, { storageObjectId, sku, qty })
    }
  })

  try {
    await supabase.from("universal_balances").delete().eq("system_id", system.id)
    if (grouped.size > 0) {
      const now = new Date().toISOString()
      const rows = Array.from(grouped.values()).map((g) => ({
        workspace_id: wsUuid,
        system_id: system.id,
        storage_object_id: g.storageObjectId,
        resource_id: g.sku,
        quantity: g.qty,
        unit: "un",
        last_movement_at: now,
        updated_at: now,
      }))
      await supabase.from("universal_balances").insert(rows)
    }
  } catch (err) {
    console.warn("Aviso ao atualizar universal_balances:", err)
  }
}
