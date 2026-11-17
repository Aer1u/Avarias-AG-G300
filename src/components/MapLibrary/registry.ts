// ============================================================
// NEXUS ERP — MapLibrary / registry.ts
// Registro central de todos os elementos da biblioteca.
// Importar e combinar os grupos de elementos aqui.
// ============================================================

import type { MapElementDefinition, MapCategory } from "./types"

// Importações dos grupos (preenchidas conforme cada arquivo é criado)
import { architecturalElements } from "./elements/architectural"
import { storageElements }       from "./elements/storage"
import { equipmentElements }     from "./elements/equipment"
import { orientationElements }   from "./elements/orientation"

// ── Registro plano de todos os elementos ────────────────────
export const ALL_ELEMENTS: MapElementDefinition[] = [
  ...architecturalElements,
  ...storageElements,
  ...equipmentElements,
  ...orientationElements,
]

// ── Lookup por type ──────────────────────────────────────────
export const ELEMENT_BY_TYPE = new Map<string, MapElementDefinition>(
  ALL_ELEMENTS.map(e => [e.type, e])
)

// ── Elementos agrupados por categoria ───────────────────────
export const ELEMENTS_BY_CATEGORY = new Map<MapCategory, MapElementDefinition[]>()

for (const el of ALL_ELEMENTS) {
  const list = ELEMENTS_BY_CATEGORY.get(el.category) ?? []
  list.push(el)
  ELEMENTS_BY_CATEGORY.set(el.category, list)
}

// ── Metadados das categorias (labels e ordem) ───────────────
export const CATEGORY_META: Record<MapCategory, { label: string; order: number; icon: string }> = {
  architectural: { label: "Arquitetura",   order: 1, icon: "🏗️" },
  storage:       { label: "Armazenagem",   order: 2, icon: "📦" },
  equipment:     { label: "Equipamentos",  order: 3, icon: "🔧" },
  logistics:     { label: "Logística",     order: 4, icon: "🚛" },
  orientation:   { label: "Orientação",    order: 5, icon: "🧭" },
  geometric:     { label: "Geométricos",   order: 6, icon: "⬜" },
  area:          { label: "Áreas",         order: 7, icon: "📐" },
}

// ── Helper: busca por texto ──────────────────────────────────
export function searchElements(query: string): MapElementDefinition[] {
  const q = query.toLowerCase().trim()
  if (!q) return ALL_ELEMENTS
  return ALL_ELEMENTS.filter(e =>
    e.label.toLowerCase().includes(q) ||
    e.description.toLowerCase().includes(q) ||
    e.type.includes(q)
  )
}
