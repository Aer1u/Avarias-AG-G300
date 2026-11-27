// =============================================================================
// NEXUS ERP — driveOccupancy.ts
// Helpers puros para resolução de chaves (ws_ / comp_ / sys_), isolamento de
// canais com nomes repetidos e cálculo real de slots ocupados (2D / 3D / Sidebar)
// =============================================================================

import type { MapeamentoItem } from "./mapeamentosStorage"
import type { MapObject } from "@/components/MapLibrary/types"
import type { StorageChannel } from "@/components/MapLibrary/dimensionsTypes"

export const ITEMS_UPDATED_EVENT = "nexus:items-updated"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KNOWN_OBJECT_PREFIXES = [
  "drive_",
  "comp_",
  "floor_",
  "area_",
  "pallet_",
  "rack_",
  "wall_",
  "col_",
  "dock_",
  "equip_",
  "obj_",
  "item_",
]

export interface ParsedPositionKey {
  kind: "sys" | "comp" | "ws" | "unknown"
  systemId?: string
  workspaceId?: string
  objectId: string
}

/**
 * Extrai workspaceId / systemId e objectId de chaves como:
 * - `ws_ws_demo_g300_drive_G300004G0301` -> workspaceId="ws_demo_g300", objectId="drive_G300004G0301"
 * - `ws_ws_173999_abc123_drive_123`      -> workspaceId="ws_173999_abc123", objectId="drive_123"
 * - `comp_lab_<uuid>`                    -> workspaceId="lab", objectId="<uuid>"
 * - `sys_<uuid>_drive_G300004G0301`      -> systemId="<uuid>", objectId="drive_G300004G0301"
 */
export function parsePositionKeyParts(
  mapeamentoId: string,
  workspaceHint?: string | null
): ParsedPositionKey {
  if (!mapeamentoId) return { kind: "unknown", objectId: "" }

  if (mapeamentoId.startsWith("sys_")) {
    const rest = mapeamentoId.slice(4)
    if (rest.length > 37 && rest[36] === "_" && UUID_PATTERN.test(rest.slice(0, 36))) {
      return {
        kind: "sys",
        systemId: rest.slice(0, 36),
        objectId: rest.slice(37),
      }
    }
    const sep = rest.indexOf("_")
    if (sep > 0) {
      return {
        kind: "sys",
        systemId: rest.slice(0, sep),
        objectId: rest.slice(sep + 1),
      }
    }
    return { kind: "sys", objectId: rest }
  }

  if (mapeamentoId.startsWith("comp_") || mapeamentoId.startsWith("ws_")) {
    const kind = mapeamentoId.startsWith("comp_") ? "comp" : "ws"
    const rest = mapeamentoId.slice(kind === "comp" ? 5 : 3)

    // 1. Se houver workspaceHint explícito e válido, usa como prefixo exato
    const cleanHint = typeof workspaceHint === "string" ? workspaceHint.trim() : ""
    if (cleanHint && !UUID_PATTERN.test(cleanHint) && rest.startsWith(`${cleanHint}_`)) {
      return {
        kind,
        workspaceId: cleanHint,
        objectId: rest.slice(cleanHint.length + 1),
      }
    }

    // 2. Padrões conhecidos de workspaceId gerado pelo Nexus
    if (rest.startsWith("ws_demo_g300_")) {
      return {
        kind,
        workspaceId: "ws_demo_g300",
        objectId: rest.slice("ws_demo_g300_".length),
      }
    }
    const wsTimestampMatch = rest.match(/^(ws_\d+_[a-z0-9]+)_(.+)$/i)
    if (wsTimestampMatch) {
      return {
        kind,
        workspaceId: wsTimestampMatch[1],
        objectId: wsTimestampMatch[2],
      }
    }
    if (rest.startsWith("lab_")) {
      return {
        kind,
        workspaceId: "lab",
        objectId: rest.slice(4),
      }
    }

    // 3. ObjectId UUID no final (36 chars)
    if (rest.length > 37 && rest[rest.length - 37] === "_" && UUID_PATTERN.test(rest.slice(-36))) {
      return {
        kind,
        workspaceId: rest.slice(0, rest.length - 37),
        objectId: rest.slice(-36),
      }
    }

    // 4. Prefixos conhecidos de objectId (ex: drive_G300004G0301, comp_123, floor_abc)
    for (const objPrefix of KNOWN_OBJECT_PREFIXES) {
      const idx = rest.indexOf(`_${objPrefix}`)
      if (idx > 0) {
        return {
          kind,
          workspaceId: rest.slice(0, idx),
          objectId: rest.slice(idx + 1),
        }
      }
    }

    // 5. Fallback para separador simples
    const lastSep = rest.lastIndexOf("_")
    if (lastSep > 0) {
      return {
        kind,
        workspaceId: rest.slice(0, lastSep),
        objectId: rest.slice(lastSep + 1),
      }
    }
    return { kind, objectId: rest }
  }

  return { kind: "unknown", objectId: mapeamentoId }
}

/**
 * Verifica se um item pertence a um MapObject específico (independentemente de estar
 * salvo em chave `ws_`, `comp_` ou `sys_`).
 */
export function isItemBelongingToObject(
  item: Pick<MapeamentoItem, "mapeamentoId">,
  objectId: string
): boolean {
  if (!item?.mapeamentoId || !objectId) return false
  const key = item.mapeamentoId
  if (!key.startsWith("ws_") && !key.startsWith("comp_") && !key.startsWith("sys_")) {
    return false
  }
  const parsed = parsePositionKeyParts(key)
  if (parsed.objectId === objectId) return true
  return key.endsWith(`_${objectId}`)
}

/**
 * Filtra os itens de um canal específico dentro de um objeto Drive-In,
 * evitando colisão quando vários canais possuem o mesmo `name` (ex: "Avarias de Jaqueline").
 */
export function filterItemsForDriveChannel(
  allObjectItems: MapeamentoItem[],
  channel: Partial<StorageChannel> | null | undefined,
  allChannels: Array<Partial<StorageChannel>>,
  objectLabel?: string
): MapeamentoItem[] {
  if (!allObjectItems || allObjectItems.length === 0) return []
  if (allChannels.length <= 1 || !channel) return allObjectItems

  // Conta quantos canais compartilham o mesmo nome
  const nameFrequency = new Map<string, number>()
  allChannels.forEach((c) => {
    const n = String(c.name || "").trim()
    if (n) nameFrequency.set(n, (nameFrequency.get(n) || 0) + 1)
  })

  // Identifica chaves fortes (code / id) de OUTROS canais para nunca capturá-las por engano
  const ownCode = String(channel.code || "").trim()
  const ownId = String(channel.id || "").trim()
  const ownName = String(channel.name || "").trim()
  const isOwnNameUnique = Boolean(ownName && nameFrequency.get(ownName) === 1)

  const ownStrongKeys = new Set<string>(
    [
      ownCode,
      ownId,
      objectLabel && ownCode ? `${objectLabel} · ${ownCode}` : "",
      objectLabel && isOwnNameUnique ? `${objectLabel} · ${ownName}` : "",
    ].filter(Boolean)
  )

  const allKnownKeys = new Set<string>()
  allChannels.forEach((c) => {
    if (c.code) allKnownKeys.add(c.code)
    if (c.id) allKnownKeys.add(c.id)
    if (c.name) allKnownKeys.add(c.name)
    if (objectLabel && c.code) allKnownKeys.add(`${objectLabel} · ${c.code}`)
    if (objectLabel && c.name) allKnownKeys.add(`${objectLabel} · ${c.name}`)
  })

  const isFirstChannel =
    Boolean(allChannels[0]) &&
    (allChannels[0].id === channel.id || allChannels[0].code === channel.code)

  return allObjectItems.filter((it) => {
    const pos = String(it.posicao || "").trim()
    if (ownStrongKeys.has(pos)) return true
    if (isOwnNameUnique && pos === ownName) return true
    return isFirstChannel && !allKnownKeys.has(pos)
  })
}

export interface OccupiedSlotCoord {
  level: number
  depth: number
}

/**
 * Retorna todos os slots únicos (level, depth) ocupados de um canal Drive-In.
 * Quando `includeTestPositions` é `false` (ex.: modo visualizador), ignora os
 * paletes de teste (`occupiedPositions`) do modo edição e considera somente dados reais.
 */
export function getChannelOccupiedSlots(
  object: MapObject,
  channel: Partial<StorageChannel>,
  allChannels: Array<Partial<StorageChannel>>,
  allLocalItems: MapeamentoItem[],
  includeTestPositions: boolean = true
): OccupiedSlotCoord[] {
  const levels = Math.max(1, Number(channel?.levels || object.props?.levels) || 4)
  const depths = Math.max(1, Number(channel?.depth || object.props?.depth) || 4)

  const slotsMap = new Map<string, OccupiedSlotCoord>()

  if (includeTestPositions && Array.isArray(channel?.occupiedPositions)) {
    channel.occupiedPositions.forEach((pos: { level?: number; depth?: number }) => {
      const lvl = Math.max(1, Math.min(levels, Number(pos?.level) || 1))
      const dep = Math.max(1, Math.min(depths, Number(pos?.depth) || 1))
      slotsMap.set(`${lvl}_${dep}`, { level: lvl, depth: dep })
    })
  }

  const objectItems = allLocalItems.filter((it) => isItemBelongingToObject(it, object.id))
  const objLabel = String(object.label || object.props?.label || object.props?.code || "").trim()
  const channelItems = filterItemsForDriveChannel(objectItems, channel, allChannels, objLabel)

  channelItems.forEach((it) => {
    if ((Number(it.quantidade) || 0) <= 0) return
    const lvl = Math.max(1, Math.min(levels, Number(it.nivel) || 1))
    const dep = Math.max(1, Math.min(depths, Number(it.profundidade) || 1))
    slotsMap.set(`${lvl}_${dep}`, { level: lvl, depth: dep })
  })

  return Array.from(slotsMap.values())
}

/**
 * Retorna a quantidade total de slots/paletes ocupados de um objeto no mapa.
 */
export function getObjectOccupiedSlotCount(
  object: MapObject,
  allLocalItems: MapeamentoItem[],
  channels: Array<Partial<StorageChannel>>,
  includeTestPositions: boolean = true
): number {
  if (object.type === "compartment") {
    const compItems = allLocalItems.filter(
      (it) => isItemBelongingToObject(it, object.id) && (Number(it.quantidade) || 0) > 0
    )
    const palletIds = new Set<string>()
    let simpleCount = 0
    compItems.forEach((it) => {
      const pid = String(it.idPalete || "").trim().toUpperCase()
      if (!pid || pid === "NAN" || pid === "-" || pid === "S/ID" || pid === "N/A") {
        simpleCount++
      } else {
        palletIds.add(pid)
      }
    })
    return palletIds.size + simpleCount
  }

  if (channels.length === 0) return 0
  let total = 0
  channels.forEach((chan) => {
    total += getChannelOccupiedSlots(
      object,
      chan,
      channels,
      allLocalItems,
      includeTestPositions
    ).length
  })
  return total
}
