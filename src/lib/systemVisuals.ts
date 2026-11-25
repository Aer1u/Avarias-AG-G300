// =============================================================================
// NEXUS ERP — lib/systemVisuals.ts
// Helpers puros para:
// 1. Identificação visual unificada de Sistemas (2D Konva, 3D Three.js, Sidebar)
// 2. Resolução de Sistema vinculado em Drive, Canal individual ou Compartimento
// 3. Listagem completa de Estruturas e Canais vinculados a um Sistema
// 4. Agregação de saldo físico direto das posições mapeadas (Sistema Livre/Aberto)
// =============================================================================

import type { MapObject, SystemVisualRef } from "@/components/MapLibrary/types"
import type { StorageChannel } from "@/components/MapLibrary/dimensionsTypes"
import type { BusinessSystem, StorageRole, SystemStockRecord } from "@/components/Systems/types"
import { ensureDriveChannels } from "@/components/MapLibrary/spatialContainment"
import { getLocalItems, type MapeamentoItem } from "./mapeamentosStorage"
import {
  filterItemsForDriveChannel,
  getChannelOccupiedSlots,
  isItemBelongingToObject,
} from "./driveOccupancy"

/**
 * Um sistema é "Livre / Aberto" quando foi configurado com estilo "aberto"
 * OU quando seu modo padrão é "livre" (sem registro de saldo nem saldo no chão).
 */
export function isOpenSystem(
  sys?: Pick<BusinessSystem | SystemVisualRef, "systemStyle" | "defaultControlMode"> | null
): boolean {
  if (!sys) return false
  return sys.systemStyle === "aberto" || sys.defaultControlMode === "livre"
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

function hasChannelLevelSystemOnly(obj: Pick<MapObject, "props">): boolean {
  const objMode = obj.props?.stockControlMode as string | undefined
  const objRef = String(obj.props?.stockSystemRef || "").trim()
  if (objRef) return false
  if (objMode !== "livre") return false
  const rawChannels = Array.isArray(obj.props?.channels)
    ? (obj.props.channels as Array<Partial<StorageChannel>>)
    : []
  return rawChannels.some((ch) => Boolean(String(ch?.stockSystemRef || "").trim()))
}

/**
 * Resolve o sistema principal vinculado a um objeto do mapa
 * (por propriedade `stockSystemRef`, `originStorageId`, `participants` ou canal individual).
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
 * - Se o canal estiver marcado como `"livre"` sem `stockSystemRef`, retorna `undefined`.
 * - Se o canal estiver marcado como `"vinculado_saldo"` sem `stockSystemRef`, retorna `undefined`.
 * - Se o canal herda do Drive (`stockControlMode === undefined`):
 *   - Caso o Drive tenha sido vinculado apenas no nível de canais individuais, retorna `undefined` para canais não configurados.
 *   - Caso contrário, herda do Drive (`obj.props.stockSystemRef`, `originStorageId` ou `participants`).
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
  if (channel?.stockControlMode === "livre") {
    return undefined
  }
  if (channel?.stockControlMode === "vinculado_saldo" && !channel?.stockSystemRef) {
    return undefined
  }

  const driveRef = obj.props?.stockSystemRef as string | undefined
  if (driveRef) {
    const byDrive = findSystemByRef(driveRef, systems)
    if (byDrive) return byDrive
  }

  if (hasChannelLevelSystemOnly(obj)) {
    return undefined
  }

  if (obj.props?.stockControlMode === "livre") {
    const originMatch = systems.find((s) => s.originStorageId === obj.id)
    if (originMatch) return originMatch
    return systems.find(
      (s) =>
        Array.isArray(s.participants) &&
        s.participants.some((p) => p.storageObjectId === obj.id)
    )
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

export interface LinkedChannelSummary {
  id: string
  code: string
  name: string
  laneIndex: number
  levels: number
  depth: number
  occupiedSlots: number
  totalUnits: number
  linkedVia: "channel" | "drive" | "participant"
}

export interface LinkedStructureEntry {
  storageObjectId: string
  storageObjectLabel: string
  storageType: string
  role: StorageRole
  stockControlMode: "livre" | "vinculado_saldo"
  object?: MapObject
  isOrigin: boolean
  isDrive: boolean
  isCompartment: boolean
  totalChannelsCount: number
  linkedChannels: LinkedChannelSummary[]
  totalUnits: number
  occupiedSlots: number
  inParticipantsList: boolean
}

/**
 * Retorna TODAS as estruturas e canais vinculados a um sistema, consolidando:
 * - Participantes cadastrados em `system.participants`
 * - Objeto de origem (`system.originStorageId`)
 * - Objetos com `props.stockSystemRef` apontando para o sistema
 * - Canais individuais com `channel.stockSystemRef` apontando para o sistema
 */
export function getLinkedStructuresForSystem(
  system: BusinessSystem,
  allObjects: MapObject[] = [],
  allItems?: MapeamentoItem[]
): LinkedStructureEntry[] {
  if (!system) return []

  const items = allItems ?? getLocalItems()
  const sysPrefix = `sys_${system.id}_`
  const sysItems = items.filter(
    (it) =>
      typeof it.mapeamentoId === "string" &&
      it.mapeamentoId.startsWith(sysPrefix) &&
      (Number(it.quantidade) || 0) > 0
  )

  const openSys = isOpenSystem(system)
  const participantMap = new Map(
    (system.participants || []).map((p) => [p.storageObjectId, p])
  )
  const objectMap = new Map(allObjects.map((o) => [o.id, o]))
  const orderedIds: string[] = []
  const seen = new Set<string>()

  const pushId = (id: string) => {
    if (!id || seen.has(id)) return
    seen.add(id)
    orderedIds.push(id)
  }

  // 1. Mantém ordem dos participantes registrados
  ;(system.participants || []).forEach((p) => pushId(p.storageObjectId))

  // 2. Garante objeto de origem (se sistema completo)
  if (!openSys && system.originStorageId) {
    pushId(system.originStorageId)
  }

  // 3. Descobre objetos do mapa vinculados por `props.stockSystemRef` ou por canal individual
  allObjects.forEach((obj) => {
    const driveMatch = findSystemByRef(obj.props?.stockSystemRef as string | undefined, [system])
    if (driveMatch) {
      pushId(obj.id)
      return
    }
    const rawChannels = Array.isArray(obj.props?.channels)
      ? (obj.props.channels as Array<Partial<StorageChannel>>)
      : []
    const hasChannelMatch = rawChannels.some((ch) =>
      Boolean(findSystemByRef(ch?.stockSystemRef, [system]))
    )
    if (hasChannelMatch) {
      pushId(obj.id)
    }
  })

  const entries: LinkedStructureEntry[] = []

  orderedIds.forEach((objId) => {
    const obj = objectMap.get(objId)
    const part = participantMap.get(objId)
    const isOrigin = Boolean(!openSys && system.originStorageId === objId)
    const objType = obj?.type || part?.storageType || "storage"
    const isCompartment = objType === "compartment"
    const isDrive = objType === "drive_in" || objType === "drive_through"
    const objLabel = obj?.label || part?.storageObjectLabel || objId
    const objItems = sysItems.filter((it) => it.mapeamentoId === `${sysPrefix}${objId}`)

    const linkedChannels: LinkedChannelSummary[] = []
    let totalChannelsCount = 0

    if (obj && isDrive) {
      const channels = ensureDriveChannels(obj)
      totalChannelsCount = channels.length

      channels.forEach((chan) => {
        const resolved = resolveSystemForChannel(obj, chan, [system])
        const matchesSystem = resolved?.id === system.id
        if (!matchesSystem) return

        const chanDirectMatch = Boolean(findSystemByRef(chan.stockSystemRef, [system]))
        const driveDirectMatch = Boolean(
          findSystemByRef(obj.props?.stockSystemRef as string | undefined, [system])
        )
        const linkedVia: LinkedChannelSummary["linkedVia"] = chanDirectMatch
          ? "channel"
          : driveDirectMatch
          ? "drive"
          : "participant"

        const chanItems = filterItemsForDriveChannel(
          objItems,
          chan,
          channels,
          objLabel
        )
        const occupiedList = getChannelOccupiedSlots(obj, chan, channels, objItems)
        const totalUnits = chanItems.reduce((sum, it) => sum + (Number(it.quantidade) || 0), 0)

        linkedChannels.push({
          id: chan.id,
          code: chan.code || chan.name || `C${chan.laneIndex}`,
          name: chan.name || chan.code || `Canal ${chan.laneIndex}`,
          laneIndex: chan.laneIndex,
          levels: Math.max(1, Number(chan.levels || obj.props?.levels) || 4),
          depth: Math.max(1, Number(chan.depth || obj.props?.depth) || 4),
          occupiedSlots: occupiedList.length,
          totalUnits,
          linkedVia,
        })
      })
    }

    const totalUnits = objItems.reduce((sum, it) => sum + (Number(it.quantidade) || 0), 0)
    const occupiedSlots = isDrive
      ? linkedChannels.reduce((sum, ch) => sum + ch.occupiedSlots, 0)
      : objItems.length

    const effectiveControlMode: "livre" | "vinculado_saldo" = openSys
      ? "livre"
      : part?.stockControlMode ||
        (obj?.props?.stockControlMode as "livre" | "vinculado_saldo" | undefined) ||
        system.defaultControlMode ||
        "vinculado_saldo"

    entries.push({
      storageObjectId: objId,
      storageObjectLabel: objLabel,
      storageType: objType,
      role: part?.role || (isOrigin ? "origem" : "armazenamento"),
      stockControlMode: effectiveControlMode,
      object: obj,
      isOrigin,
      isDrive,
      isCompartment,
      totalChannelsCount,
      linkedChannels,
      totalUnits,
      occupiedSlots,
      inParticipantsList: Boolean(part),
    })
  })

  return entries
}

/**
 * Lê diretamente dos itens mapeados no mapa (`sys_${system.id}_*`) e sintetiza
 * registros de saldo por SKU para Confronto Analítico de Sistemas Livres/Abertos.
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
