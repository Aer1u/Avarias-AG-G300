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

  // Posição no 2D (top-left) convertida para metros
  const topLeftXM = obj.x / ppm
  const topLeftYM = obj.y / ppm

  // Extrai estrutura interna e contagens reais do objeto (suporta levels, depth, lanes e channels)
  const props = obj.props || {}
  const levelsCount = typeof props.levels === "number"
    ? props.levels
    : typeof props.levelsCount === "number"
    ? props.levelsCount
    : 4
  const depthsCount = typeof props.depth === "number"
    ? props.depth
    : typeof props.depthsCount === "number"
    ? props.depthsCount
    : 4
  // Dimensões físicas fiéis: prioriza as dimensões em pixels do objeto convertidas para metros
  // Para palete com escala legada antiga (60x80 px), normaliza automaticamente para PBR (1.0m x 1.2m)
  const isLegacyPallet = obj.type === "pallet" && (obj.width >= 40 || phys.width >= 2.0)
  const widthM = isLegacyPallet ? 1.0 : (obj.width > 0 ? pixelsToMeters(obj.width, ppm) : (phys.width > 0 ? phys.width : 1.4))
  const depthM = isLegacyPallet ? 1.2 : (obj.height > 0 ? pixelsToMeters(obj.height, ppm) : (phys.length > 0 ? phys.length : 4.0))

  const channelsCount = Array.isArray(props.channels) && props.channels.length > 0 ? props.channels.length : 0
  const propLanes = typeof props.lanes === "number" ? props.lanes : 0
  const widthBasedLanes = Math.max(1, Math.round(widthM / 1.35))
  const lanesCount = Math.max(1, propLanes, channelsCount, widthM > 2.0 ? widthBasedLanes : 1)
  
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

  // Âncora universal no centro da base (Z=elevationM)
  // No 2D: X cresce para a direita (tela), Y cresce para baixo (tela).
  // No 3D (Z vertical, câmera olha de Y- para Y+):
  //   • X 3D = X 2D (direita = direita)
  //   • Y 3D = Y 2D (mesmo sentido; câmera posicionada em Y negativo olha para Y positivo)
  // Mantemos o mesmo sinal para que esquerda/direita e topo/fundo sejam idênticos entre 2D e 3D.
  const centerX = topLeftXM + widthM / 2
  const centerY = topLeftYM + depthM / 2
  const baseZ = elevationM

  // Rotação em torno do eixo vertical Z
  // No 2D, rotação positiva = horário (CW). No 3D com Z-up, rotação positiva = anti-horário (CCW) vista de cima.
  // Negamos para manter correspondência visual: 90° no 2D = 90° CW no 3D vista de cima.
  const rotDeg = obj.rotation || 0
  const rotRad = -(rotDeg * Math.PI) / 180

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
      lanesCount,
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

  // Converte centro da base 3D de volta para Top-Left do 2D (mesmo sistema de coordenadas sem negação)
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
    rotation: Math.round((-spatial.rotationZDeg) % 360),
    physicalDimensions: {
      ...curDims,
      width,
      length: depth,
      height,
      elevationZ: spatial.position.z,
    },
  }
}
