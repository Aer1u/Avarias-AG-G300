// ============================================================
// NEXUS ERP — MapLibrary / palletModels.ts
// Modelos de Referência de Pallets e Cálculo Proporcional de Túneis
// Permite que cada profundidade de um Drive-In seja dimensionada
// proporcionalmente ao modelo de pallet de referência adotado.
// ============================================================

export interface PalletModel {
  id: string
  name: string
  widthM: number       // Largura nominal em metros (ex: 1.00m PBR)
  lengthM: number      // Comprimento / Profundidade nominal em metros (ex: 1.20m PBR)
  heightM: number      // Altura do pallet com carga típica (ex: 1.45m)
  tareWeightKg: number // Peso do pallet vazio
  maxLoadKg: number    // Carga máxima suportada
  description: string
}

export const STANDARD_PALLET_MODELS: PalletModel[] = [
  {
    id: "pbr1",
    name: "PBR 1 (Padrão Brasil)",
    widthM: 1.00,
    lengthM: 1.20,
    heightM: 1.45,
    tareWeightKg: 28,
    maxLoadKg: 1200,
    description: "Pallet padrão brasileiro regulamentado pela ABRAS (1000 × 1200 mm)",
  },
  {
    id: "euro",
    name: "Euro Pallet (EUR / EPAL)",
    widthM: 0.80,
    lengthM: 1.20,
    heightM: 1.45,
    tareWeightKg: 25,
    maxLoadKg: 1500,
    description: "Pallet padrão europeu normalizado (800 × 1200 mm)",
  },
  {
    id: "industrial",
    name: "Industrial / Químico (ISO)",
    widthM: 1.20,
    lengthM: 1.20,
    heightM: 1.50,
    tareWeightKg: 35,
    maxLoadKg: 1500,
    description: "Pallet quadrado para indústrias químicas e tambores (1200 × 1200 mm)",
  },
  {
    id: "gma",
    name: "Americano (GMA / 40×48\")",
    widthM: 1.02,
    lengthM: 1.22,
    heightM: 1.45,
    tareWeightKg: 20,
    maxLoadKg: 1100,
    description: "Grocery Manufacturers Association norte-americano (1016 × 1219 mm)",
  },
  {
    id: "custom",
    name: "Personalizado / Sob Medida",
    widthM: 1.00,
    lengthM: 1.20,
    heightM: 1.45,
    tareWeightKg: 25,
    maxLoadKg: 1200,
    description: "Dimensões específicas definidas pela organização",
  },
]

// ── Cálculo Proporcional das Dimensões do Drive-In ───────────
// Calcula a largura e profundidade reais mínimas necessárias
// para suportar N paletes em profundidade com folgas operacionais.
export function calculateDrivePhysicalDimensions(
  depthCount: number,
  lanesCount: number = 1,
  palletModelId: string = "pbr1",
  customWidthM?: number,
  customLengthM?: number
): {
  realWidthM: number
  realLengthM: number
  clearanceDepthM: number
  clearanceWidthM: number
} {
  const model = STANDARD_PALLET_MODELS.find((m) => m.id === palletModelId) || STANDARD_PALLET_MODELS[0]

  const pWidth = customWidthM || model.widthM
  const pLength = customLengthM || model.lengthM

  // Folgas operacionais de segurança recomendadas pela ABNT/RMI:
  // - Folga entre pallets em profundidade no túnel: 10 cm (0.10m)
  // - Folga frontal de entrada/manobra da empilhadeira: 20 cm (0.20m)
  // - Folga lateral de cada lado do vão para os trilhos de apoio: 20 cm (0.20m) por vão
  const clearancePerDepth = 0.12 // 12 cm de folga por posição
  const entryClearance = 0.20    // 20 cm na entrada do túnel
  const clearancePerLane = 0.40  // 40 cm total de folga lateral por rua (trilhos + montantes)

  const realLengthM = depthCount * (pLength + clearancePerDepth) + entryClearance
  const realWidthM = lanesCount * (pWidth + clearancePerLane)

  return {
    realWidthM: Math.round(realWidthM * 100) / 100,
    realLengthM: Math.round(realLengthM * 100) / 100,
    clearanceDepthM: clearancePerDepth,
    clearanceWidthM: clearancePerLane,
  }
}
