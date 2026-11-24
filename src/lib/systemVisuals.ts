// =============================================================================
// NEXUS ERP — lib/systemVisuals.ts
// Helpers puros para:
// 1. Identificação visual unificada de Sistemas (2D Konva, 3D Three.js, Sidebar)
// 2. Resolução de Sistema vinculado em Drive, Canal individual ou Compartimento
// 3. Agregação de saldo físico direto das posições mapeadas (Sistema Aberto)
// =============================================================================

import type { MapObject, SystemVisualRef } from "@/components/MapLibrary/types"
import type { StorageChannel } from "@/components/MapLibrary/dimensionsTypes"
import type { BusinessSystem, SystemStockRecord } from "@/components/Systems/types"
import { getLocalItems, type MapeamentoItem } from "./mapeamentosStorage"
import { isItemBelongingToObject } from "./driveOccupancy"

export function isOpenSystem(
  sys?: Pick<BusinessSystem | SystemVisualRef, "systemStyle"> | null
): boolean {
  return sys?.systemStyle === "aberto"
}

export function normalizeHexColor(hex?: string | null, fallback = "#3b82f6"): string {
  if (!hex || typeof hex !== "string") return fallback
  const trimmed = hex.trim()
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const r = trimmed[1]
    const g = trimmed[2]
    const b = trimmed[3]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return fallback
}

export function hexToRgba(hex?: string | null, alpha = 1): string {
  const clean = normalizeHexColor(hex).slice(1)
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`
}

export function getContrastTextColor(hex?: string | null): string {
  const clean = normalizeHexColor(hex).slice(1)
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? "#0f172a" : "#ffffff"
}

export function findSystemByRef<T extends SystemVisualRef>(
  ref: string | undefined | null,
  systems: T[]
): T | undefined {
  if (!ref || !systems || systems.length === 0) return undefined
  const clean = String(ref).trim().toLowerCase()
  if (!clean) return undefined
  return systems.find(
    (s) =>
      s.id.toLowerCase() === clean ||
      s.code.toLowerCase() === clean ||
      s.name.toLowerCase() === clean
  )
}

/**
 * Resolve o sistema principal vinculado a um objeto do mapa
 * (por propriedade `stockSystemRef`, `originStorageId` ou lista `participants`).
 */
export function resolveSystemForObject<T extends SystemVisualRef>(
  obj: Pick<MapObject, "id" | "props">,
  systems: T[]
): T | undefined {
  if (!obj || !systems || systems.length === 0) return undefined
  const directRef = obj.props?.stockSystemRef as string | undefined
  const directMatch = findSystemByRef(directRef, systems)
  if (directMatch) return directMatch

  const participantMatch = systems.find(
    (s) =>
      s.originStorageId === obj.id ||
      (Array.isArray(s.participants) &&
        s.participants.some((p) => p.storageObjectId === obj.id))
  )
  if (participantMatch) return participantMatch

  // Fallback: se algum canal individual estiver vinculado, usa o primeiro encontrado
  const rawChannels = Array.isArray(obj.props?.channels)
    ? (obj.props.channels as Array<Partial<StorageChannel>>)
    : []
  for (const ch of rawChannels) {
    const chSys = findSystemByRef(ch?.stockSystemRef, systems)
    if (chSys) return chSys
  }
  return undefined
}

/**
 * Resolve o sistema efetivo de um canal específico de Drive-In:
 * - Se o canal tiver `stockSystemRef` próprio, usa o do canal.
 * - Se o canal estiver marcado explicitamente como `stockControlMode === "livre"` SEM `stockSystemRef`
 *   e o Drive estiver em `"vinculado_saldo"` ou `"livre"`, verifica se há `stockSystemRef` do canal antes de herdar do Drive.
 * - Caso não tenha `stockSystemRef` no canal e não esteja forçado independente (`livre` sem ref), herda do Drive.
 */
export function resolveSystemForChannel<T extends SystemVisualRef>(
  obj: Pick<MapObject, "id" | "props">,
  channel: Partial<StorageChannel> | null | undefined,
  systems: T[]
): T | undefined {
  if (!systems || systems.length === 0) return undefined
  if (channel?.stockSystemRef) {
    const byChannel = findSystemByRef(channel.stockSystemRef, systems)
    if (byChannel) return byChannel
  }
  // Canal explicitamente definido como "livre" sem referência própria de sistema
  // não herda bloqueio/vínculo do Drive pai.
  if (channel?.stockControlMode === "livre" && !channel?.stockSystemRef) {
    return undefined
  }
  const driveRef = obj.props?.stockSystemRef as string | undefined
  if (driveRef) {
    const byDrive = findSystemByRef(driveRef, systems)
    if (byDrive) return byDrive
  }
  return systems.find(
    (s) =>
      s.originStorageId === obj.id ||
      (Array.isArray(s.participants) &&
        s.participants.some((p) => p.storageObjectId === obj.id))
  )
}

/**
 * Retorna todos os sistemas distintos vinculados a um objeto (incluindo canais individuais).
 */
export function getSystemsLinkedToObject<T extends SystemVisualRef>(
  obj: Pick<MapObject, "id" | "props">,
  systems: T[]
): T[] {
  if (!obj || !systems || systems.length === 0) return []
  const foundMap = new Map<string, T>()

  const direct = findSystemByRef(obj.props?.stockSystemRef as string | undefined, systems)
  if (direct) foundMap.set(direct.id, direct)

  systems.forEach((s) => {
    if (
      s.originStorageId === obj.id ||
      (Array.isArray(s.participants) &&
        s.participants.some((p) => p.storageObjectId === obj.id))
    ) {
      foundMap.set(s.id, s)
    }
  })

  const rawChannels = Array.isArray(obj.props?.channels)
    ? (obj.props.channels as Array<Partial<StorageChannel>>)
    : []
  rawChannels.forEach((ch) => {
    const chSys = findSystemByRef(ch?.stockSystemRef, systems)
    if (chSys) foundMap.set(chSys.id, chSys)
  })

  return Array.from(foundMap.values())
}

/**
 * Verifica se um objeto do mapa pertence ao sistema filtrado (`activeSystemFilterId`).
 */
export function isObjectMatchingSystemFilter(
  obj: Pick<MapObject, "id" | "props">,
  activeSystemFilterId: string | null | undefined,
  systems: SystemVisualRef[]
): boolean {
  if (!activeSystemFilterId) return true
  const linked = getSystemsLinkedToObject(obj, systems)
  return linked.some((s) => s.id === activeSystemFilterId)
}

/**
 * Lê diretamente dos itens mapeados no mapa (`sys_${system.id}_*`) e sintetiza
 * registros de saldo por SKU para Confronto Analítico de Sistemas Abertos.
 * Sem uso de `universal_records`.
 */
export function getMappedStockRecordsForSystem(
  system: Pick<BusinessSystem, "id">,
  allItems?: MapeamentoItem[]
): SystemStockRecord[] {
  if (!system?.id) return []
  const items = allItems ?? getLocalItems()
  const prefix = `sys_${system.id}_`
  const sysItems = items.filter(
    (it) =>
      typeof it.mapeamentoId === "string" &&
      it.mapeamentoId.startsWith(prefix) &&
      (Number(it.quantidade) || 0) > 0 &&
      String(it.sku || "").trim().length > 0
  )

  return sysItems.map((it) => ({
    id: `mapped_${it.id}`,
    systemId: system.id,
    sku: String(it.sku).trim().toUpperCase(),
    description: it.descricao?.trim() || "Item mapeado",
    quantity: Number(it.quantidade) || 0,
    positionLabel: it.posicao || undefined,
    registeredAt: it.atualizadoEm || it.criadoEm || new Date().toISOString(),
    notes: it.idPalete ? `Palete ${it.idPalete}` : undefined,
  }))
}

export interface SystemMappedStats {
  totalUnits: number
  totalSkus: number
  mappedEntries: number
  mappedObjectsCount: number
  occupiedSlotsCount: number
}

export function getSystemMappedStats(
  system: Pick<BusinessSystem, "id">,
  allItems?: MapeamentoItem[]
): SystemMappedStats {
  if (!system?.id) {
    return {
      totalUnits: 0,
      totalSkus: 0,
      mappedEntries: 0,
      mappedObjectsCount: 0,
      occupiedSlotsCount: 0,
    }
  }
  const items = allItems ?? getLocalItems()
  const prefix = `sys_${system.id}_`
  const sysItems = items.filter(
    (it) =>
      typeof it.mapeamentoId === "string" &&
      it.mapeamentoId.startsWith(prefix) &&
      (Number(it.quantidade) || 0) > 0
  )

  const skus = new Set<string>()
  const objectIds = new Set<string>()
  const slotKeys = new Set<string>()
  let totalUnits = 0

  sysItems.forEach((it) => {
    totalUnits += Number(it.quantidade) || 0
    if (it.sku) skus.add(String(it.sku).trim().toUpperCase())
    const objId = it.mapeamentoId.slice(prefix.length)
    if (objId) objectIds.add(objId)
    slotKeys.add(`${it.mapeamentoId}_${it.posicao || ""}_${it.nivel}_${it.profundidade}`)
  })

  return {
    totalUnits,
    totalSkus: skus.size,
    mappedEntries: sysItems.length,
    mappedObjectsCount: objectIds.size,
    occupiedSlotsCount: slotKeys.size,
  }
}

export function getObjectSystemItems(
  systemId: string,
  objectId: string,
  allItems?: MapeamentoItem[]
): MapeamentoItem[] {
  const items = allItems ?? getLocalItems()
  const prefix = `sys_${systemId}_`
  return items.filter(
    (it) =>
      typeof it.mapeamentoId === "string" &&
      it.mapeamentoId.startsWith(prefix) &&
      isItemBelongingToObject(it, objectId) &&
      (Number(it.quantidade) || 0) > 0
  )
}
