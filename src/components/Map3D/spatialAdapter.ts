// =============================================================================
// NEXUS ERP — MOTOR UNIVERSAL DE VISUALIZAÇÃO ESPACIAL
// spatialAdapter.ts — Adaptador canônico bidirecional entre 2D (px) e 3D (metros)
// Mantém rigorosamente consistência de coordenadas, dimensões e identificadores.
// Sistema Cartesiano: X = Largura (m), Y = Profundidade (m), Z = Altura (m)
// =============================================================================

import type { MapObject } from "../MapLibrary/types"
import type { UniversalSpatialObject, Vector3M, Dimensions3M } from "./types"
import { pixelsToMeters, realToPixels, ensurePhysicalDimensions } from "../MapLibrary/unitConverter"

export const DEFAULT_PIXELS_PER_METER = 20

/**
 * Converte um MapObject existente do NEXUS ERP para o modelo UniversalSpatialObject
 * respeitando o sistema cartesiano XYZ (Z como altura vertical) e âncora no centro da base.
 */
export function mapObjectToSpatial(
  obj: MapObject,
  pixelsPerMeter: number = DEFAULT_PIXELS_PER_METER
): UniversalSpatialObject {
  const ppm = Math.max(1, pixelsPerMeter)
  const phys = ensurePhysicalDimensions(obj, ppm)

  const widthM = phys.width > 0 ? phys.width : Math.max(0.2, pixelsToMeters(obj.width, ppm))
  const depthM = phys.length > 0 ? phys.length : Math.max(0.2, pixelsToMeters(obj.height, ppm))
  
  // Altura padrão por categoria/tipo caso não definida
  let heightM = phys.height
  if (!heightM || heightM <= 0) {
    if (obj.category === "storage") heightM = 5.0
    else if (obj.category === "equipment") heightM = 2.4
    else if (obj.type === "wall") heightM = 6.0
    else if (obj.type === "column") heightM = 7.0
    else if (obj.category === "area") heightM = 0.05
    else heightM = 1.8
  }

  const elevationM = phys.elevationZ || 0

  // Posição no 2D (top-left) convertida para metros
  const topLeftXM = obj.x / ppm
  const topLeftYM = obj.y / ppm

  // Âncora universal no centro da base (Z=elevationM)
  const centerX = topLeftXM + widthM / 2
  const centerY = topLeftYM + depthM / 2
  const baseZ = elevationM

  // Rotação em torno do eixo vertical Z
  const rotDeg = obj.rotation || 0
  const rotRad = (rotDeg * Math.PI) / 180

  // Converte pontos de polígono (se houver) para metros relativos ao centro da base
  let pointsM: { x: number; y: number }[] | undefined
  if (obj.points && obj.points.length >= 6) {
    pointsM = []
    for (let i = 0; i < obj.points.length; i += 2) {
      const px = obj.points[i]
      const py = obj.points[i + 1]
      pointsM.push({
        x: px / ppm - widthM / 2,
        y: py / ppm - depthM / 2,
      })
    }
  }

  // Extrai estrutura interna se for rack/drive-in
  const props = obj.props || {}
  const levelsCount = typeof props.levelsCount === "number" ? props.levelsCount : 4
  const depthsCount = typeof props.depthsCount === "number" ? props.depthsCount : 3

  return {
    id: obj.id,
    type: obj.type,
    category: obj.category,
    label: obj.label,
    position: { x: centerX, y: centerY, z: baseZ },
    dimensions: { width: widthM, depth: depthM, height: heightM },
    rotationZDeg: rotDeg,
    rotationZRad: rotRad,
    anchor: "center_base",
    color: obj.color || "#475569",
    strokeColor: obj.strokeColor || "#94a3b8",
    opacity: typeof obj.opacity === "number" ? obj.opacity : 1,
    locked: Boolean(obj.locked),
    visible: obj.visible !== false,
    pointsM,
    internalStructure: {
      hasLevels: obj.category === "storage" || obj.type.includes("drive") || obj.type.includes("rack"),
      levelsCount,
      depthsCount,
      levelHeightM: heightM / Math.max(1, levelsCount),
    },
    props,
    raw: obj,
  }
}

/**
 * Converte coordenadas e dimensões espaciais de volta para atualização do MapObject 2D
 */
export function spatialToMapObjectPartial(
  spatial: UniversalSpatialObject,
  pixelsPerMeter: number = DEFAULT_PIXELS_PER_METER
): Partial<MapObject> {
  const ppm = Math.max(1, pixelsPerMeter)
  const { width, depth, height } = spatial.dimensions

  // Converte centro da base 3D de volta para Top-Left do 2D
  const topLeftXM = spatial.position.x - width / 2
  const topLeftYM = spatial.position.y - depth / 2

  const xPx = Math.round(topLeftXM * ppm)
  const yPx = Math.round(topLeftYM * ppm)
  const widthPx = realToPixels(width, ppm)
  const heightPx = realToPixels(depth, ppm)

  const curDims = spatial.raw.physicalDimensions || ensurePhysicalDimensions(spatial.raw, ppm)

  return {
    x: xPx,
    y: yPx,
    width: widthPx,
    height: heightPx,
    rotation: Math.round(spatial.rotationZDeg % 360),
    physicalDimensions: {
      ...curDims,
      width,
      length: depth,
      height,
      elevationZ: spatial.position.z,
    },
  }
}
