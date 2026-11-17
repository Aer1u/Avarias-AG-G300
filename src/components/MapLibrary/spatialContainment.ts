// ============================================================
// NEXUS ERP — MapLibrary / spatialContainment.ts
// Motor de Reconhecimento Espacial de Contenção & Gestão de Canais
// Permite que o sistema reconheça automaticamente quais Drives ou
// objetos estão delimitados dentro de uma Área, Setor, Bloco ou Piso.
// ============================================================

import type { MapObject } from "./types"
import type { StorageChannel } from "./dimensionsTypes"

// ── 1. Algoritmo Pnpoly (Ray-Casting) para Polígonos Livres ───
export function isPointInsidePolygon(px: number, py: number, points: number[]): boolean {
  if (points.length < 6) return false
  let inside = false
  const numPoints = points.length / 2

  for (let i = 0, j = numPoints - 1; i < numPoints; j = i++) {
    const xi = points[i * 2]
    const yi = points[i * 2 + 1]
    const xj = points[j * 2]
    const yj = points[j * 2 + 1]

    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi || 0.00001) + xi
    if (intersect) inside = !inside
  }

  return inside
}

// ── 2. Teste se um Ponto está dentro de um Retângulo ───────────
export function isPointInsideRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh
}

// ── 3. Teste se um Objeto está Contido em uma Área Delimitada ─
export function isObjectContainedInArea(child: MapObject, container: MapObject): boolean {
  if (child.id === container.id) return false

  // Usa o centro geométrico do objeto filho
  const centerX = child.x + (child.width || 0) / 2
  const centerY = child.y + (child.height || 0) / 2

  // Se o container tiver vértices poligonais livres
  if (container.points && container.points.length >= 6) {
    return isPointInsidePolygon(centerX, centerY, container.points)
  }

  // Se o container for retangular (Piso, Bloco ou Área)
  return isPointInsideRect(
    centerX,
    centerY,
    container.x,
    container.y,
    container.width || 0,
    container.height || 0
  )
}

// ── 4. Motor de Resolução de Contenção Espacial Universal ──────
// Retorna um mapa { [objectId]: containerAreaId } associando
// automaticamente cada elemento à área ou bloco que o delimita.
export function resolveSpatialContainment(objects: MapObject[]): {
  containmentMap: Map<string, string>      // objectId -> containerId mais específico
  containerObjects: Map<string, string[]>  // containerId -> list of child objectIds
} {
  const containmentMap = new Map<string, string>()
  const containerObjects = new Map<string, string[]>()

  // Áreas candidatas a conter outros elementos (pisos, blocos, setores)
  const areas = objects.filter((o) => o.category === "area" || o.type === "floor")

  // Ordena áreas da menor para a maior em área ocupada (para que a mais interna vença)
  const sortedAreas = [...areas].sort((a, b) => {
    const areaA = (a.width || 0) * (a.height || 0)
    const areaB = (b.width || 0) * (b.height || 0)
    return areaA - areaB
  })

  // Para cada objeto do mapa que não seja a própria área
  for (const obj of objects) {
    // 1. Se tem vínculo explícito com Rua (streetId), agrupa sob a Rua
    const streetId = obj.props?.streetId ? String(obj.props.streetId) : undefined
    if (streetId && objects.some((o) => o.id === streetId)) {
      containmentMap.set(obj.id, streetId)
      continue
    }

    // 2. Se tem parentId explícito válido, respeita
    if (obj.parentId && objects.some((o) => o.id === obj.parentId)) {
      containmentMap.set(obj.id, obj.parentId)
      continue
    }

    // 3. Se for o próprio piso principal ou não tiver pai, busca por geometria espacial
    for (const area of sortedAreas) {
      if (area.id === obj.id) continue

      if (isObjectContainedInArea(obj, area)) {
        containmentMap.set(obj.id, area.id)
        break // A menor área que contém o objeto é o container mais direto (ex: Bloco antes de Galpão)
      }
    }
  }

  // Preenche containerObjects inverso
  containmentMap.forEach((parent, child) => {
    const current = containerObjects.get(parent) || []
    current.push(child)
    containerObjects.set(parent, current)
  })

  return { containmentMap, containerObjects }
}

// ── 5. Gerador e Sincronizador de Canais para Drive-In ──────────
// Sincroniza a lista de canais de um Drive-In conforme seus vãos (lanes),
// preservando nomes personalizados dados pelo usuário (ex: "Canal MKLOG").
export function ensureDriveChannels(drive: MapObject): StorageChannel[] {
  const props = drive.props || {}
  const driveCode = String(props.code || drive.label || drive.id.slice(0, 8))
  const lanes = Math.max(1, Number(props.lanes || 1))
  const levels = Math.max(1, Number(props.levels || 4))
  const depth = Math.max(1, Number(props.depth || 4))
  const palletModelId = String(props.palletModel || "pbr1")

  const existingChannels: StorageChannel[] = Array.isArray(props.channels)
    ? (props.channels as StorageChannel[])
    : []

  const channels: StorageChannel[] = []

  for (let i = 1; i <= lanes; i++) {
    const defaultCode = `${driveCode}-C${String(i).padStart(2, "0")}`
    const existing = existingChannels.find((c) => c.laneIndex === i)

    if (existing) {
      channels.push({
        ...existing,
        levels,
        depth,
        capacity: levels * depth,
        palletModelId,
      })
    } else {
      channels.push({
        id: `chan_${drive.id}_${i}`,
        code: defaultCode,
        name: `Canal ${i}`,
        driveId: drive.id,
        laneIndex: i,
        levels,
        depth,
        capacity: levels * depth,
        occupancy: 0,
        status: "operacional",
        palletModelId,
      })
    }
  }

  return channels
}
