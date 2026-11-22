// =============================================================================
// NEXUS ERP — MOTOR UNIVERSAL DE VISUALIZAÇÃO ESPACIAL
// 2D · BIRD'S-EYE 3D · FULL TOP · 3D LIVRE
// types.ts — Tipos espaciais universais, contratos de geometria e câmeras
// =============================================================================

import type { MapObject, MapCategory, PhysicalDimensions } from "../MapLibrary/types"

export type SpatialViewMode = "2d" | "birdseye" | "fulltop" | "3d"

export interface Vector3M {
  x: number // Metros (largura)
  y: number // Metros (profundidade / comprimento no plano)
  z: number // Metros (altura vertical - Z é o eixo vertical)
}

export interface Dimensions3M {
  width: number  // Largura em metros (eixo X)
  depth: number  // Profundidade em metros (eixo Y)
  height: number // Altura em metros (eixo Z vertical)
}

export type AnchorPoint = "center_base" | "top_left"

/**
 * Objeto espacial universal canônico (em metros no espaço XYZ).
 * Utilizado pelos motores de renderização 3D (Three.js) e Isométrico,
 * e derivado diretamente do modelo de dados MapObject do NEXUS.
 */
export interface UniversalSpatialObject {
  id: string
  type: string
  category: MapCategory
  label?: string

  // Posição canônica métrica (Âncora no centro da base Z=0)
  position: Vector3M

  // Dimensões físicas reais em metros
  dimensions: Dimensions3M

  // Rotação em torno do eixo vertical Z (em radianos e graus)
  rotationZDeg: number
  rotationZRad: number

  // Âncora
  anchor: AnchorPoint

  // Propriedades visuais e de material
  color: string
  strokeColor: string
  opacity: number
  locked: boolean
  visible: boolean

  // Polígonos para áreas irregulares (convertidos para metros)
  pointsM?: { x: number; y: number }[]

  // Estruturas internas (ex: níveis e profundidades operacionais de Drive-In / Porta-palete)
  internalStructure?: InternalStructureConfig

  // Propriedades operacionais originais
  props: Record<string, unknown>

  // Referência ao objeto de origem
  raw: MapObject
}

export interface InternalStructureConfig {
  hasLevels: boolean
  levelsCount: number
  depthsCount: number
  lanesCount?: number
  baysCount?: number
  levelHeightM?: number
  bayWidthM?: number
  palletCapacityPerPosition?: number
}

export interface CameraStateConfig {
  mode: SpatialViewMode
  position: Vector3M
  target: Vector3M
  zoom: number
  fov?: number
}

export interface SpatialSelectionEvent {
  objectId: string | null
  point?: Vector3M
  normal?: Vector3M
}
