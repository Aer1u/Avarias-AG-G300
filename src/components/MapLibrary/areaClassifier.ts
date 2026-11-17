// ============================================================
// NEXUS ERP — MapLibrary / areaClassifier.ts
// Motor de Cálculo Geométrico de Áreas, Escala e Classificações
// Permite delimitar pisos, setores e calcular m² reais via Shoelace
// ============================================================

import type { MapObject } from "./types"

// Escala padrão: 20 pixels equivalem a 1 metro linear (1 pixel = 0.05m)
export const DEFAULT_PIXELS_PER_METER = 20

// ── Classificações Padrão Iniciais (Totalmente Editáveis) ────
export interface AreaClassification {
  id: string
  name: string
  description: string
  color: string
  borderColor: string
  defaultRestrictions?: string
}

export const INITIAL_AREA_CLASSIFICATIONS: AreaClassification[] = [
  {
    id: "piso_geral",
    name: "Piso Geral / Galpão",
    description: "Contorno perimetral do piso do armazém",
    color: "rgba(30, 41, 59, 0.4)",
    borderColor: "#475569",
  },
  {
    id: "area_avarias",
    name: "Área de Avarias",
    description: "Região de retenção, triagem e inspeção de danos",
    color: "rgba(245, 158, 11, 0.12)",
    borderColor: "#f59e0b",
    defaultRestrictions: "Acesso restrito a conferentes e operadores de retrabalho",
  },
  {
    id: "rua",
    name: "Rua / Via de Acesso",
    description: "Rua operacional demarcada para manobra de empilhadeiras e acesso a drives",
    color: "rgba(15, 23, 42, 0.45)",
    borderColor: "#eab308",
    defaultRestrictions: "Tráfego exclusivo para empilhadeiras e movimentação de pallets",
  },
  {
    id: "circulacao",
    name: "Corredor / Circulação",
    description: "Vias de tráfego de empilhadeiras e pedestres",
    color: "rgba(56, 189, 248, 0.08)",
    borderColor: "#38bdf8",
    defaultRestrictions: "Velocidade máx 10km/h. Sentido único nas vias demarcadas",
  },
  {
    id: "bloco",
    name: "Bloco de Armazenagem",
    description: "Delimitação de bloco físico com agrupamento de ruas, módulos e drives",
    color: "rgba(99, 102, 241, 0.12)",
    borderColor: "#6366f1",
    defaultRestrictions: "Tráfego restrito a veículos operacionais autorizados",
  },
  {
    id: "picking",
    name: "Setor de Picking",
    description: "Área de fracionamento e separação de pedidos",
    color: "rgba(16, 185, 129, 0.12)",
    borderColor: "#10b981",
  },
  {
    id: "quarentena",
    name: "Quarentena / Bloqueio",
    description: "Setor com restrição física total aguardando laudo",
    color: "rgba(239, 68, 68, 0.15)",
    borderColor: "#ef4444",
    defaultRestrictions: "Movimentação proibida sem autorização da supervisão",
  },
  {
    id: "expedicao",
    name: "Expedição / Staging",
    description: "Área de consolidação de cargas e conferência de saída",
    color: "rgba(139, 92, 246, 0.12)",
    borderColor: "#8b5cf6",
  },
]

// ── Cálculo de Área em Metros Quadrados (m²) ────────────────
export function calculateAreaM2(
  obj: MapObject,
  pixelsPerMeter: number = DEFAULT_PIXELS_PER_METER
): number {
  const ppm = Math.max(1, pixelsPerMeter)

  // 1. Caso seja polígono com pontos [x1, y1, x2, y2, ...]
  if (obj.points && obj.points.length >= 6) {
    let areaPixels = 0
    const pts = obj.points
    const n = pts.length / 2

    // Fórmula de Gauss (Shoelace)
    for (let i = 0; i < n; i++) {
      const x1 = pts[i * 2]
      const y1 = pts[i * 2 + 1]
      const nextIdx = (i + 1) % n
      const x2 = pts[nextIdx * 2]
      const y2 = pts[nextIdx * 2 + 1]

      areaPixels += x1 * y2 - x2 * y1
    }

    const absPixels = Math.abs(areaPixels) / 2
    // Converte de pixels² para m²
    const m2 = absPixels / (ppm * ppm)
    return Math.round(m2 * 10) / 10
  }

  // 2. Caso retangular padrão
  const widthMeters = obj.width / ppm
  const heightMeters = obj.height / ppm
  const m2 = widthMeters * heightMeters
  return Math.round(m2 * 10) / 10
}

// ── Detecção Geométrica de Continência (Áreas Aninhadas) ────
// Verifica se a bounding box de childObj está contida dentro de parentObj
export function isObjectInsideArea(child: MapObject, parent: MapObject): boolean {
  if (child.id === parent.id) return false

  return (
    child.x >= parent.x &&
    child.y >= parent.y &&
    child.x + child.width <= parent.x + parent.width &&
    child.y + child.height <= parent.y + parent.height
  )
}
