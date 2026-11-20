// ============================================================
// NEXUS ERP — MapLibrary / floorSurfaces.ts
// Catálogo Oficial de Pisos e Superfícies de Apoio
// Permite criar e customizar bases para estruturas (Concreto, Grama, Asfalto, etc.)
// ============================================================

export type FloorMaterialType =
  | "concrete"
  | "grass"
  | "asphalt"
  | "epoxy"
  | "gravel"
  | "deck"

export interface FloorSurfaceDefinition {
  id: FloorMaterialType
  name: string
  category: "internal" | "external"
  icon: string
  description: string
  color: string          // Cor de preenchimento 2D (Konva / Canvas)
  strokeColor: string    // Cor da borda 2D
  opacity: number
  threeColor: string     // Cor Three.js 3D
  roughness: number      // Rugosidade 3D (0 a 1)
  metalness: number      // Metalicidade 3D
}

export const FLOOR_SURFACES: Record<FloorMaterialType, FloorSurfaceDefinition> = {
  concrete: {
    id: "concrete",
    name: "Concreto Industrial",
    category: "internal",
    icon: "🏗️",
    description: "Piso de concreto armado de alta resistência e juntas estruturais",
    color: "rgba(51, 65, 85, 0.55)",
    strokeColor: "#64748b",
    opacity: 1,
    threeColor: "#475569",
    roughness: 0.8,
    metalness: 0.05,
  },
  grass: {
    id: "grass",
    name: "Grama / Solo Natural",
    category: "external",
    icon: "🌿",
    description: "Solo vegetal gramado para áreas externas e entorno operacional",
    color: "rgba(22, 101, 52, 0.65)",
    strokeColor: "#22c55e",
    opacity: 1,
    threeColor: "#15803d",
    roughness: 0.95,
    metalness: 0.0,
  },
  asphalt: {
    id: "asphalt",
    name: "Asfalto / Pátio de Manobra",
    category: "external",
    icon: "🛣️",
    description: "Pavimentação asfáltica para tráfego pesado de carretas e docas",
    color: "rgba(15, 23, 42, 0.85)",
    strokeColor: "#334155",
    opacity: 1,
    threeColor: "#18181b",
    roughness: 0.9,
    metalness: 0.1,
  },
  epoxy: {
    id: "epoxy",
    name: "Epóxi Industrial / Polido",
    category: "internal",
    icon: "🧪",
    description: "Piso resinado brilhante de alta limpeza e estanqueidade",
    color: "rgba(3, 105, 161, 0.45)",
    strokeColor: "#0284c7",
    opacity: 1,
    threeColor: "#0284c7",
    roughness: 0.25,
    metalness: 0.2,
  },
  gravel: {
    id: "gravel",
    name: "Brita / Cascalho",
    category: "external",
    icon: "🪨",
    description: "Superfície de cascalho drenante para estacionamento e contenção",
    color: "rgba(87, 83, 78, 0.6)",
    strokeColor: "#a8a29e",
    opacity: 1,
    threeColor: "#57534e",
    roughness: 1.0,
    metalness: 0.0,
  },
  deck: {
    id: "deck",
    name: "Deck de Madeira",
    category: "internal",
    icon: "🪵",
    description: "Piso estruturado em réguas de madeira para mezaninos e passarelas",
    color: "rgba(120, 53, 15, 0.5)",
    strokeColor: "#b45309",
    opacity: 1,
    threeColor: "#78350f",
    roughness: 0.6,
    metalness: 0.05,
  },
}

export const FLOOR_SURFACES_LIST = Object.values(FLOOR_SURFACES)
