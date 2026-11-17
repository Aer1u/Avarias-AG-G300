// ============================================================
// NEXUS ERP — MapLibrary / types.ts
// Sistema de tipos central da biblioteca vetorial autoral.
// Todos os elementos do mapeamento implementam estas interfaces.
// ============================================================

import type Konva from "konva"
import type React from "react"

// ── Categorias ──────────────────────────────────────────────
export type MapCategory =
  | "architectural"   // A. Estruturas arquitetônicas
  | "storage"         // B. Estruturas de armazenagem
  | "equipment"       // C. Equipamentos operacionais
  | "logistics"       // D. Objetos logísticos
  | "orientation"     // E. Elementos de orientação
  | "geometric"       // F. Elementos geométricos
  | "area"            // Delimitações, pisos e regiões operacionais

// ── Unidades e Dimensões Físicas Reais (2D & 3D Ready) ───────
export type LengthUnit = "m" | "cm" | "mm"

export interface PhysicalDimensions {
  width: number                 // Largura real (eixo X)
  length: number                // Comprimento / Profundidade no plano (eixo Y)
  height: number                // Altura vertical (eixo Z)
  elevationZ?: number           // Cota do chão em relação ao piso (Z0)
  unit: LengthUnit              // 'm' | 'cm' | 'mm'
  lockAspectRatio: boolean      // Manter proporção original ao redimensionar
  minWidth?: number
  maxWidth?: number
  minLength?: number
  maxLength?: number
  minHeight?: number
  maxHeight?: number
}

// ── Objeto no canvas ─────────────────────────────────────────
export interface MapObject {
  id: string
  type: string                        // ex: 'wall' | 'pallet_rack' | 'custom_area' | 'floor'
  category: MapCategory
  // Posição e geometria no Canvas (em pixels de apresentação)
  x: number
  y: number
  width: number
  height: number
  rotation: number                    // graus (0–360)
  points?: number[]                   // Vértices [x1, y1, x2, y2, ...] para regiões e polígonos irregulares

  // Dimensões Físicas Reais Independentes da Instância (Universal e 3D Ready)
  physicalDimensions?: PhysicalDimensions

  // Hierarquia Espacial Aninhada
  parentId?: string                   // ID da região ou piso ao qual pertence (Galpão -> Piso -> Setor -> Drive)
  // Classificação & Atributos Operacionais do Espaço
  classification?: string             // Classificação livre da organização (ex: "Piso Operacional", "Quarentena", "Expedição")
  calculatedAreaM2?: number           // Área real calculada em metros quadrados
  responsible?: string                // Responsável pelo setor/área
  operationalSituation?: string       // "ativa" | "interditada" | "manutencao" | "inventario"
  restrictions?: string               // Regras de utilização e restrições de acesso
  // Estado
  locked: boolean
  visible: boolean
  layerId: string
  // Aparência
  label?: string
  color?: string                      // fill principal
  strokeColor?: string
  opacity?: number                    // 0–1
  // Props específicas do tipo
  props: Record<string, unknown>
  // Vinculação a registros operacionais
  linkedRecordId?: string
  linkedRecordTable?: string
}

// ── Schema de propriedade configurável ───────────────────────
export type PropFieldType =
  | "text"
  | "number"
  | "boolean"
  | "color"
  | "select"

export interface MapPropField {
  key: string
  label: string
  type: PropFieldType
  min?: number
  max?: number
  step?: number
  options?: { value: string; label: string }[]
  unit?: string                       // ex: "m", "kg", "un"
}

// ── Definição de um tipo de elemento ─────────────────────────
export interface MapElementDefinition {
  type: string
  category: MapCategory
  label: string                       // nome exibido na biblioteca
  description: string
  // Dimensões padrão (pixels no canvas, escala 1:1 com px)
  defaultWidth: number
  defaultHeight: number
  defaultPhysicalDimensions?: PhysicalDimensions
  defaultProps: Record<string, unknown>
  propsSchema: MapPropField[]         // campos editáveis no painel de propriedades
  // Preview SVG no painel da biblioteca (componente React puro)
  PreviewSVG: React.FC<SvgPreviewProps>
  // Renderizador Konva: cria e retorna um Group posicionado em (0,0)
  renderKonva: (obj: MapObject) => Konva.Group
}

// ── Props padrão do PreviewSVG ────────────────────────────────
export interface SvgPreviewProps {
  width: number
  height: number
  color?: string
  strokeColor?: string
}

// ── Camada ────────────────────────────────────────────────────
export interface MapLayer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  color?: string                      // cor indicadora na UI
  order: number                       // ordem de renderização (menor = fundo)
}

// ── Estado global do editor ──────────────────────────────────
export interface MapEditorState {
  objects: MapObject[]
  layers: MapLayer[]
  selectedId: string | null
  activeLayerId: string
  snapEnabled: boolean
  gridSize: number                    // px por célula da grade
  zoom: number                        // fator (1 = 100%)
  pan: { x: number; y: number }
}

// ── Cores padrão do sistema ──────────────────────────────────
export const MAP_COLORS = {
  wall:        { fill: "#475569", stroke: "#94a3b8" },
  door:        { fill: "#1e293b", stroke: "#64748b" },
  window:      { fill: "#0f172a", stroke: "#7dd3fc" },
  column:      { fill: "#334155", stroke: "#64748b" },
  area:        { fill: "rgba(99,102,241,0.08)", stroke: "#6366f1" },
  rack:        { fill: "rgba(234,179,8,0.10)", stroke: "#ca8a04" },
  shelf:       { fill: "rgba(234,179,8,0.10)", stroke: "#a16207" },
  pallet:      { fill: "rgba(59,130,246,0.15)", stroke: "#3b82f6" },
  box:         { fill: "rgba(16,185,129,0.15)", stroke: "#10b981" },
  forklift:    { fill: "#1e293b", stroke: "#94a3b8" },
  arrow:       { fill: "#f59e0b", stroke: "#d97706" },
  marker:      { fill: "#ef4444", stroke: "#dc2626" },
  geometric:   { fill: "rgba(100,116,139,0.12)", stroke: "#64748b" },
} as const

// ── Utilitários de geometria ─────────────────────────────────
export function snapToGrid(value: number, grid: number): number {
  return Math.round(value / grid) * grid
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}
