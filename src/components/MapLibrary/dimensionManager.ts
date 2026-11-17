// ============================================================
// NEXUS ERP — MapLibrary / dimensionManager.ts
// Motor de Resolução de Nomenclaturas e Dimensões Universais
// Calcula sequências (1..N, A..Z, alfanuméricas, listas customizadas),
// gera a matriz de posições físicas e assegura a independência por organização.
// ============================================================

import type {
  DimensionConfig,
  DimensionItem,
  SequenceType,
  DimensionOrientation,
  StructurePositionSlot,
} from "./dimensionsTypes"

// Converte índice numérico em letra do alfabeto (0 -> A, 1 -> B... 25 -> Z, 26 -> AA)
export function indexToAlphabet(index: number): string {
  let result = ""
  let n = index
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

// ── Gera a lista de DimensionItem separando ordem física de identificador ──
export function generateDimensionItems(
  count: number,
  sequenceType: SequenceType,
  orientation: DimensionOrientation,
  prefix: string = "",
  suffix: string = "",
  paddingDigits: number = 2,
  customValues: string[] = []
): DimensionItem[] {
  const items: DimensionItem[] = []
  const total = Math.max(1, count)

  for (let physicalIndex = 0; physicalIndex < total; physicalIndex++) {
    // Ordem de numeração dependendo da orientação
    const seqIndex =
      orientation === "top_to_bottom" || orientation === "back_to_front" || orientation === "right_to_left"
        ? total - 1 - physicalIndex
        : physicalIndex

    let identifier = ""
    let displayName = ""

    switch (sequenceType) {
      case "numeric": {
        const num = seqIndex + 1
        identifier = `${prefix}${num}${suffix}`
        displayName = identifier
        break
      }
      case "numeric_pad": {
        const num = String(seqIndex + 1).padStart(paddingDigits, "0")
        identifier = `${prefix}${num}${suffix}`
        displayName = identifier
        break
      }
      case "alphabetic": {
        const letter = indexToAlphabet(seqIndex)
        identifier = `${prefix}${letter}${suffix}`
        displayName = identifier
        break
      }
      case "alphanumeric": {
        const num = seqIndex + 1
        identifier = `${prefix || "N"}${num}${suffix}`
        displayName = identifier
        break
      }
      case "custom_list": {
        if (customValues && customValues[seqIndex]) {
          identifier = customValues[seqIndex]
          displayName = customValues[seqIndex]
        } else {
          identifier = `${seqIndex + 1}`
          displayName = `${seqIndex + 1}`
        }
        break
      }
    }

    items.push({
      physicalIndex,
      identifier,
      displayName,
      isActive: true,
      searchAlias: [identifier.toLowerCase()],
    })
  }

  return items
}

// ── Configurações Padrão de Exemplo (G300 vs Galpão Alternativo) ──
export const DEFAULT_G300_LEVELS_CONFIG: DimensionConfig = {
  id: "dim_levels_g300",
  category: "level",
  name: "Níveis Verticais G300",
  displayName: "Nível",
  sequenceType: "numeric",
  orientation: "bottom_to_top", // Nível 1 no chão, 2, 3, 4 subindo
  defaultCount: 4,
  prefix: "",
  suffix: "",
  paddingDigits: 1,
  items: generateDimensionItems(4, "numeric", "bottom_to_top"),
  scope: { warehouseId: "G300", structureType: "drive_in" },
}

export const DEFAULT_G300_DEPTH_CONFIG: DimensionConfig = {
  id: "dim_depth_g300",
  category: "depth",
  name: "Profundidades do Drive G300",
  displayName: "Profundidade",
  sequenceType: "numeric",
  orientation: "front_to_back", // Profundidade 1 na entrada, 2, 3, 4 no fundo
  defaultCount: 4,
  prefix: "",
  suffix: "",
  paddingDigits: 1,
  items: generateDimensionItems(4, "numeric", "front_to_back"),
  scope: { warehouseId: "G300", structureType: "drive_in" },
}

// Exemplo da outra organização citada pelo usuário (Profundidades em Letras A, B, C, D, E)
export const ALTERNATIVE_ALPHA_DEPTH_CONFIG: DimensionConfig = {
  id: "dim_depth_alpha",
  category: "depth",
  name: "Profundidades Alfabéticas",
  displayName: "Profundidade",
  sequenceType: "alphabetic",
  orientation: "front_to_back",
  defaultCount: 5,
  items: generateDimensionItems(5, "alphabetic", "front_to_back"),
  scope: { warehouseId: "GALPAO_B", structureType: "drive_in" },
}

// ── Gerador da Matriz Tridimensional de Posições de um Drive-In ──
export function generateDrivePositionsMatrix(
  structureId: string,
  structureCode: string,
  levelsCount: number,
  depthCount: number,
  levelsConfig: DimensionConfig = DEFAULT_G300_LEVELS_CONFIG,
  depthConfig: DimensionConfig = DEFAULT_G300_DEPTH_CONFIG,
  currentOccupancyCount: number = 0,
  avariaRecords: { locationId?: string; data?: Record<string, unknown>; title?: string }[] = []
): StructurePositionSlot[][] {
  const matrix: StructurePositionSlot[][] = []

  // Garante que temos itens para os counts solicitados
  const levelItems =
    levelsConfig.items.length === levelsCount
      ? levelsConfig.items
      : generateDimensionItems(levelsCount, levelsConfig.sequenceType, levelsConfig.orientation, levelsConfig.prefix, levelsConfig.suffix, levelsConfig.paddingDigits, levelsConfig.customValues)

  const depthItems =
    depthConfig.items.length === depthCount
      ? depthConfig.items
      : generateDimensionItems(depthCount, depthConfig.sequenceType, depthConfig.orientation, depthConfig.prefix, depthConfig.suffix, depthConfig.paddingDigits, depthConfig.customValues)

  // Distribuição simulada de ocupação e avaria para o exemplo
  let filledSoFar = 0

  // Linhas = Níveis (Do mais alto para o chão na renderização visual)
  for (let lIdx = levelsCount - 1; lIdx >= 0; lIdx--) {
    const row: StructurePositionSlot[] = []
    const levelItem = levelItems[lIdx] || { identifier: String(lIdx + 1), displayName: `N${lIdx + 1}` }

    for (let dIdx = 0; dIdx < depthCount; dIdx++) {
      const depthItem = depthItems[dIdx] || { identifier: String(dIdx + 1), displayName: `P${dIdx + 1}` }
      const slotId = `${structureId}_L${levelItem.identifier}_D${depthItem.identifier}`
      const positionCode = `${structureCode}-N${levelItem.identifier}-P${depthItem.identifier}`

      // Checa se há registro de avaria explícito associado a este nível
      const hasAvaria = avariaRecords.some((r) => {
        const titleMatch = r.title && r.title.toLowerCase().includes(`nível ${levelItem.identifier}`)
        const codeMatch = r.data && String(r.data.positionCode || "").includes(positionCode)
        return titleMatch || codeMatch
      })

      let status: "livre" | "ocupado" | "avaria" | "bloqueado" = "livre"
      if (hasAvaria) {
        status = "avaria"
      } else if (filledSoFar < currentOccupancyCount) {
        status = "ocupado"
        filledSoFar++
      }

      row.push({
        id: slotId,
        structureId,
        levelIndex: lIdx,
        depthIndex: dIdx,
        levelIdentifier: levelItem.identifier,
        depthIdentifier: depthItem.identifier,
        positionCode,
        status,
      })
    }

    matrix.push(row)
  }

  return matrix
}
