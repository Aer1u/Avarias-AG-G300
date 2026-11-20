// =============================================================================
// NEXUS ERP — MOTOR UNIVERSAL DE VISUALIZAÇÃO ESPACIAL
// geometryCatalog.ts — Catálogo de Modelos Tridimensionais Paramétricos Reais
// ── Estruturas reais em Three.js:
//    • Galpões, Pisos e Áreas de Piso
//    • Ruas e Corredores Operacionais (com faixas industriais)
//    • Porta-Paletes (Racks com montantes e longarinas)
//    • Drive-In (estruturas completas com colunas, trilhos, níveis e profundidades)
//    • Paredes e Colunas Arquitetônicas
//    • Equipamentos, Docas, Paletes com Carga PBR
// Convenção Espacial: X = Largura, Y = Profundidade, Z = Altura Vertical
// Âncora: Centro da Base (Z=0)
// =============================================================================

import * as THREE from "three"
import type { UniversalSpatialObject } from "./types"
import { FLOOR_SURFACES, type FloorMaterialType } from "../MapLibrary/floorSurfaces"

// Cache compartilhado de materiais para máxima performance
const materialsCache = new Map<string, THREE.Material>()

function getMaterial(key: string, creator: () => THREE.Material): THREE.Material {
  let mat = materialsCache.get(key)
  if (!mat) {
    mat = creator()
    materialsCache.set(key, mat)
  }
  return mat
}

/**
 * Cria a representação geométrica tridimensional real de um objeto do catálogo
 */
export function buildSpatial3DObject(spatial: UniversalSpatialObject): THREE.Group {
  const group = new THREE.Group()
  group.name = spatial.id
  group.userData = { objectId: spatial.id, spatial }

  const { width, depth, height } = spatial.dimensions
  const type = spatial.type.toLowerCase()
  const cat = spatial.category

  // 1. ÁREAS, PISOS E RUAS
  if (cat === "area" || type === "floor" || type === "custom_area") {
    buildAreaGeometry(group, spatial)
  }
  // 2. PORTA-PALETES / RACKS
  else if (type.includes("rack") || type === "pallet_rack") {
    buildPalletRackGeometry(group, spatial)
  }
  // 3. DRIVE-IN E DRIVES
  else if (type.includes("drive") || type === "drive_in") {
    buildDriveInGeometry(group, spatial)
  }
  // 4. ESTRUTURAS ARQUITETÔNICAS (Paredes, Colunas, Portas, Janelas)
  else if (type === "wall") {
    buildWallGeometry(group, spatial)
  } else if (type === "column") {
    buildColumnGeometry(group, spatial)
  }
  // 5. DOCAS E EXPEDIÇÃO
  else if (type === "dock" || type.includes("dock")) {
    buildDockGeometry(group, spatial)
  }
  // 6. PALETES E CARGAS
  else if (type === "pallet" || type === "box") {
    buildPalletWithLoadGeometry(group, spatial)
  }
  // 7. EQUIPAMENTOS (Empilhadeira, Carrinhos)
  else if (cat === "equipment" || type === "forklift") {
    buildForkliftGeometry(group, spatial)
  }
  // 8. BLOCOS E ELEMENTOS GENÉRICOS
  else {
    buildGenericSolidGeometry(group, spatial)
  }

  // Posiciona o grupo no espaço universal (Z para cima)
  group.position.set(spatial.position.x, spatial.position.y, spatial.position.z)
  group.rotation.z = spatial.rotationZRad

  return group
}

// ─────────────────────────────────────────────────────────────
// 1. ÁREAS, PISOS E RUAS DE TRÁFEGO
// ─────────────────────────────────────────────────────────────
function buildAreaGeometry(group: THREE.Group, spatial: UniversalSpatialObject) {
  const { width, depth } = spatial.dimensions
  const isStreet =
    spatial.raw.classification === "rua" ||
    spatial.raw.classification === "circulacao" ||
    spatial.type === "street"

  // Detecção de material de solo / piso de apoio (Grama, Concreto, Asfalto, etc.)
  const rawMat =
    (spatial.raw.props?.floorMaterial as FloorMaterialType) ||
    (spatial.raw.type.startsWith("floor_")
      ? (spatial.raw.type.replace("floor_", "") as FloorMaterialType)
      : undefined)
  const surfaceDef = rawMat && FLOOR_SURFACES[rawMat] ? FLOOR_SURFACES[rawMat] : undefined

  const areaColor = surfaceDef
    ? surfaceDef.threeColor
    : isStreet
    ? "#1e293b"
    : spatial.color || (spatial.type === "floor" ? "#0f172a" : "#334155")
  const hThickness = surfaceDef ? 0.05 : 0.04

  // Chão delimitado
  const floorMat = getMaterial(`floor_${areaColor}_${surfaceDef ? surfaceDef.id : "default"}`, () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(areaColor),
      roughness: surfaceDef ? surfaceDef.roughness : 0.85,
      metalness: surfaceDef ? surfaceDef.metalness : 0.1,
      transparent: true,
      opacity: isStreet ? 0.95 : surfaceDef ? 0.95 : 0.65,
    })
  )

  const floorGeo = new THREE.BoxGeometry(width, depth, hThickness)
  const floorMesh = new THREE.Mesh(floorGeo, floorMat)
  floorMesh.position.set(0, 0, hThickness / 2)
  floorMesh.receiveShadow = true
  group.add(floorMesh)

  // Se for rua, desenha faixas de tráfego de segurança (amarelo industrial)
  if (isStreet) {
    const stripeMat = getMaterial("stripe_yellow", () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#eab308"),
        roughness: 0.5,
      })
    )

    const stripeW = 0.08
    const stripeGeo = new THREE.BoxGeometry(stripeW, depth, hThickness + 0.005)

    // Faixa esquerda e direita
    const leftStripe = new THREE.Mesh(stripeGeo, stripeMat)
    leftStripe.position.set(-width / 2 + stripeW / 2 + 0.05, 0, (hThickness + 0.005) / 2)
    group.add(leftStripe)

    const rightStripe = new THREE.Mesh(stripeGeo, stripeMat)
    rightStripe.position.set(width / 2 - stripeW / 2 - 0.05, 0, (hThickness + 0.005) / 2)
    group.add(rightStripe)

    // Linha tracejada central se for rua larga
    if (width >= 2.5) {
      const dashLength = 0.8
      const gap = 0.6
      const totalDash = Math.floor(depth / (dashLength + gap))
      const dashGeo = new THREE.BoxGeometry(0.06, dashLength, hThickness + 0.006)

      for (let i = 0; i < totalDash; i++) {
        const yPos = -depth / 2 + (i + 0.5) * (dashLength + gap)
        const dashMesh = new THREE.Mesh(dashGeo, stripeMat)
        dashMesh.position.set(0, yPos, (hThickness + 0.006) / 2)
        group.add(dashMesh)
      }
    }
  } else {
    // Moldura de contorno suave para blocos e setores
    const borderMat = getMaterial(`border_${spatial.strokeColor}`, () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(spatial.strokeColor || "#6366f1"),
        linewidth: 2,
      })
    )
    const edges = new THREE.EdgesGeometry(floorGeo)
    const line = new THREE.LineSegments(edges, borderMat)
    line.position.copy(floorMesh.position)
    group.add(line)
  }
}

// ─────────────────────────────────────────────────────────────
// 2. PORTA-PALETES (RACKS CONVENCIONAIS)
// ─────────────────────────────────────────────────────────────
function buildPalletRackGeometry(group: THREE.Group, spatial: UniversalSpatialObject) {
  const { width, depth, height } = spatial.dimensions
  const levels = spatial.internalStructure?.levelsCount || 4

  const columnProfileMat = getMaterial("rack_column_blue", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#1e40af"), roughness: 0.5, metalness: 0.6 })
  )
  const beamMat = getMaterial("rack_beam_orange", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#ea580c"), roughness: 0.4, metalness: 0.5 })
  )

  const colWidth = 0.08
  const colGeo = new THREE.BoxGeometry(colWidth, colWidth, height)

  // 4 colunas nos 4 cantos
  const halfW = width / 2 - colWidth / 2
  const halfD = depth / 2 - colWidth / 2
  const zCenter = height / 2

  const corners = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [halfW, halfD],
  ]

  corners.forEach(([cx, cy]) => {
    const col = new THREE.Mesh(colGeo, columnProfileMat)
    col.position.set(cx, cy, zCenter)
    col.castShadow = true
    group.add(col)
  })

  // Longarinas (vigas horizontais) em cada nível
  const beamH = 0.08
  const beamFrontBackGeo = new THREE.BoxGeometry(width, colWidth, beamH)
  const beamSideGeo = new THREE.BoxGeometry(colWidth, depth, beamH)

  for (let l = 1; l <= levels; l++) {
    const levelZ = (height / (levels + 1)) * l

    // Viga frontal e traseira
    const beamFront = new THREE.Mesh(beamFrontBackGeo, beamMat)
    beamFront.position.set(0, halfD, levelZ)
    group.add(beamFront)

    const beamBack = new THREE.Mesh(beamFrontBackGeo, beamMat)
    beamBack.position.set(0, -halfD, levelZ)
    group.add(beamBack)

    // Travessas laterais
    const beamLeft = new THREE.Mesh(beamSideGeo, beamMat)
    beamLeft.position.set(-halfW, 0, levelZ)
    group.add(beamLeft)

    const beamRight = new THREE.Mesh(beamSideGeo, beamMat)
    beamRight.position.set(halfW, 0, levelZ)
    group.add(beamRight)
  }
}

// ─────────────────────────────────────────────────────────────
// 3. DRIVE-IN (ESTRUTURA COMPLETA MULTI-VÃOS COM NÍVEIS, PROFUNDIDADES E PALETES DE TESTE)
// ─────────────────────────────────────────────────────────────
function buildDriveInGeometry(group: THREE.Group, spatial: UniversalSpatialObject) {
  const { width, depth, height } = spatial.dimensions
  const props = spatial.props || {}
  const channelsCount = Array.isArray(props.channels) && props.channels.length > 0 ? props.channels.length : 0
  const propLanes = Number(props.lanes) || Number(spatial.internalStructure?.lanesCount) || 0
  const widthBasedLanes = Math.max(1, Math.round(width / 1.35))
  // Se canais ou propLanes > 1, ou largura > 2.0m, SEMPRE usa o número real de vãos consistente
  const lanes = Math.max(1, propLanes, channelsCount, width > 2.0 ? widthBasedLanes : 1)

  const levels = spatial.internalStructure?.levelsCount || Number(props.levels) || 4
  const depths = spatial.internalStructure?.depthsCount || Number(props.depth) || 4
  const laneWidth = width / lanes

  const driveColumnMat = getMaterial("drive_col_indigo", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#3730a3"), roughness: 0.4, metalness: 0.7 })
  )
  const driveRailMat = getMaterial("drive_rail_amber", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#d97706"), roughness: 0.3, metalness: 0.8 })
  )
  const frameBraceMat = getMaterial("drive_brace_silver", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#64748b"), roughness: 0.5, metalness: 0.7 })
  )

  const colDim = 0.08
  const colGeo = new THREE.BoxGeometry(colDim, colDim, height)

  // 1. Montantes Estruturais Verticais (colunas nas divisas dos vãos)
  for (let i = 0; i <= lanes; i++) {
    const colX = -width / 2 + i * laneWidth

    for (let d = 0; d <= depths; d++) {
      const yPos = -depth / 2 + (depth / Math.max(1, depths)) * d

      const colMesh = new THREE.Mesh(colGeo, driveColumnMat)
      colMesh.position.set(colX, yPos, height / 2)
      colMesh.castShadow = true
      group.add(colMesh)
    }
  }

  // 2. Trilhos Longitudinais de Apoio dos Paletes em Cada Vão
  // No Drive-In real, o Nível 1 (chão) repousa sobre o piso de concreto.
  // Os pares de trilhos aéreos sustentam os níveis elevados (N2, N3, N4...)
  const railThick = 0.06
  const railGeo = new THREE.BoxGeometry(railThick, depth, railThick)
  const bracketGeo = new THREE.BoxGeometry(0.12, 0.06, 0.04)
  const levelSpacing = height / Math.max(1, levels)

  for (let l = 0; l < lanes; l++) {
    const vXLeft = -width / 2 + l * laneWidth + 0.07
    const vXRight = -width / 2 + (l + 1) * laneWidth - 0.07

    // Trilhos aéreos para os níveis superiores (a partir do nível 2)
    for (let lvl = 2; lvl <= levels; lvl++) {
      const lz = levelSpacing * (lvl - 1)

      // Trilho esquerdo e direito deste vão
      const railL = new THREE.Mesh(railGeo, driveRailMat)
      railL.position.set(vXLeft, 0, lz)
      group.add(railL)

      const railR = new THREE.Mesh(railGeo, driveRailMat)
      railR.position.set(vXRight, 0, lz)
      group.add(railR)

      // Braços de suporte (consolos) conectando trilho às colunas ao longo das profundidades
      for (let d = 0; d <= depths; d++) {
        const yPos = -depth / 2 + (depth / Math.max(1, depths)) * d

        const bL = new THREE.Mesh(bracketGeo, driveRailMat)
        bL.position.set(vXLeft - 0.03, yPos, lz - 0.02)
        group.add(bL)

        const bR = new THREE.Mesh(bracketGeo, driveRailMat)
        bR.position.set(vXRight + 0.03, yPos, lz - 0.02)
        group.add(bR)
      }
    }

    // Travamento superior no topo de cada vão
    const topBeamGeo = new THREE.BoxGeometry(laneWidth, 0.06, 0.06)
    const topFront = new THREE.Mesh(topBeamGeo, frameBraceMat)
    topFront.position.set(-width / 2 + (l + 0.5) * laneWidth, depth / 2, height)
    group.add(topFront)

    const topBack = new THREE.Mesh(topBeamGeo, frameBraceMat)
    topBack.position.set(-width / 2 + (l + 0.5) * laneWidth, -depth / 2, height)
    group.add(topBack)
  }

  // 3. RENDERIZAÇÃO REAL DOS PALETES EM TESTE DE PREENCHIMENTO (OCUPAÇÃO)
  const rawChannels = Array.isArray(spatial.props?.channels) ? (spatial.props.channels as any[]) : []
  const slotStepY = depth / Math.max(1, depths)

  // Materiais para os paletes dentro do drive
  const testPalletWoodMat = getMaterial("drive_pallet_wood", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#b45309"), roughness: 0.8, metalness: 0.1 })
  )
  const testPalletBoxMat = getMaterial("drive_pallet_box", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#eab308"), roughness: 0.65, metalness: 0.05 })
  )

  const pWidth = Math.max(0.6, laneWidth * 0.72)
  const pDepth = Math.max(0.7, slotStepY * 0.82)
  const baseH = 0.12
  const loadH = Math.min(1.4, levelSpacing * 0.75)

  const pDeckGeo = new THREE.BoxGeometry(pWidth, pDepth, baseH)
  const pLoadGeo = new THREE.BoxGeometry(pWidth * 0.94, pDepth * 0.94, loadH)

  // Varre os canais e extrai posições ocupadas
  const channelsToRender = rawChannels.length > 0
    ? rawChannels
    : Array.from({ length: lanes }, (_, idx) => ({
        id: `chan_auto_${idx + 1}`,
        laneIndex: idx + 1,
        occupiedPositions: [],
      }))

  channelsToRender.forEach((chan, idx) => {
    const laneIdx = (typeof chan.laneIndex === "number" ? chan.laneIndex : idx + 1) - 1
    if (laneIdx < 0 || laneIdx >= lanes) return

    const occupiedList: Array<{ level: number; depth: number }> = Array.isArray(chan.occupiedPositions)
      ? chan.occupiedPositions
      : []

    occupiedList.forEach((pos) => {
      const lvl = Math.max(1, Math.min(levels, Number(pos.level) || 1))
      const dep = Math.max(1, Math.min(depths, Number(pos.depth) || 1))

      const posX = -width / 2 + (laneIdx + 0.5) * laneWidth
      // No 2D, profundidade 1 fica no topo (+depth/2) e depth N fica na entrada (-depth/2)
      const posY = depth / 2 - (dep - 0.5) * slotStepY

      // Nível 1 repousa diretamente no chão do galpão (Z = 0.02 para assentar perfeitamente sobre o piso/grid).
      // Níveis 2..N repousam sobre os trilhos aéreos correspondentes (lz + railThick / 2):
      const railLz = levelSpacing * (lvl - 1)
      const posZ = lvl === 1 ? 0.02 : railLz + railThick / 2

      const palletMeshGroup = new THREE.Group()

      // Estrado de madeira
      const deck = new THREE.Mesh(pDeckGeo, testPalletWoodMat)
      deck.position.set(0, 0, baseH / 2)
      palletMeshGroup.add(deck)

      // Carga em caixas industriais
      const load = new THREE.Mesh(pLoadGeo, testPalletBoxMat)
      load.position.set(0, 0, baseH + loadH / 2)
      load.castShadow = true
      palletMeshGroup.add(load)

      palletMeshGroup.position.set(posX, posY, posZ)
      group.add(palletMeshGroup)
    })
  })
}

// ─────────────────────────────────────────────────────────────
// 4. PAREDES E COLUNAS ARQUITETÔNICAS
// ─────────────────────────────────────────────────────────────
function buildWallGeometry(group: THREE.Group, spatial: UniversalSpatialObject) {
  const { width, depth, height } = spatial.dimensions
  const wallMat = getMaterial("arch_wall_concrete", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#475569"), roughness: 0.9, metalness: 0.05 })
  )

  const wallGeo = new THREE.BoxGeometry(width, depth, height)
  const wallMesh = new THREE.Mesh(wallGeo, wallMat)
  wallMesh.position.set(0, 0, height / 2)
  wallMesh.castShadow = true
  wallMesh.receiveShadow = true
  group.add(wallMesh)
}

function buildColumnGeometry(group: THREE.Group, spatial: UniversalSpatialObject) {
  const { width, depth, height } = spatial.dimensions
  const radius = Math.max(0.15, Math.min(width, depth) / 2)

  const colMat = getMaterial("arch_col_steel", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#334155"), roughness: 0.5, metalness: 0.7 })
  )

  const colGeo = new THREE.CylinderGeometry(radius, radius, height, 16)
  // Trata cilindro para Z vertical
  colGeo.rotateX(Math.PI / 2)
  const colMesh = new THREE.Mesh(colGeo, colMat)
  colMesh.position.set(0, 0, height / 2)
  colMesh.castShadow = true
  group.add(colMesh)
}

// ─────────────────────────────────────────────────────────────
// 5. DOCAS DE CARGA E DESCARGA
// ─────────────────────────────────────────────────────────────
function buildDockGeometry(group: THREE.Group, spatial: UniversalSpatialObject) {
  const { width, depth, height } = spatial.dimensions
  const dockMat = getMaterial("dock_mat_yellow_black", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#0284c7"), roughness: 0.5, metalness: 0.4 })
  )

  const rampHeight = Math.min(height, 1.2)
  const dockGeo = new THREE.BoxGeometry(width, depth, rampHeight)
  const dockMesh = new THREE.Mesh(dockGeo, dockMat)
  dockMesh.position.set(0, 0, rampHeight / 2)
  group.add(dockMesh)

  // Batentes de borracha pretos de absorção
  const bumperMat = getMaterial("bumper_black", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#0f172a"), roughness: 0.95 })
  )
  const bumperGeo = new THREE.BoxGeometry(0.2, 0.15, rampHeight * 0.8)

  const b1 = new THREE.Mesh(bumperGeo, bumperMat)
  b1.position.set(-width / 2 + 0.3, depth / 2 + 0.05, rampHeight / 2)
  group.add(b1)

  const b2 = new THREE.Mesh(bumperGeo, bumperMat)
  b2.position.set(width / 2 - 0.3, depth / 2 + 0.05, rampHeight / 2)
  group.add(b2)
}

// ─────────────────────────────────────────────────────────────
// 6. PALETE DE MADEIRA COM CARGA PROCEDURAL
// ─────────────────────────────────────────────────────────────
function buildPalletWithLoadGeometry(group: THREE.Group, spatial: UniversalSpatialObject) {
  // Se as dimensões forem desproporcionais/herdadas do padrão antigo de 60x80px (ex: 3m x 4m),
  // normaliza visualmente para o padrão PBR (1.0m x 1.2m) idêntico ao Drive-In
  const isLegacy = spatial.dimensions.width > 1.8 || spatial.dimensions.depth > 2.0
  const width = isLegacy ? 1.0 : spatial.dimensions.width
  const depth = isLegacy ? 1.2 : spatial.dimensions.depth
  const height = isLegacy ? 1.2 : spatial.dimensions.height

  const woodMat = getMaterial("pallet_wood", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#b45309"), roughness: 0.85, metalness: 0.05 })
  )
  const boxMat = getMaterial("pallet_load_kraft", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#d97706"), roughness: 0.75, metalness: 0.05 })
  )

  // Tablado de madeira inferior do palete (0.14m de altura)
  const palletH = 0.14
  const palletGeo = new THREE.BoxGeometry(width, depth, palletH)
  const palletMesh = new THREE.Mesh(palletGeo, woodMat)
  palletMesh.position.set(0, 0, palletH / 2)
  group.add(palletMesh)

  // Carga (caixas de papelão empilhadas no palete)
  if (height > palletH) {
    const loadH = height - palletH
    const loadW = width * 0.92
    const loadD = depth * 0.92
    const loadGeo = new THREE.BoxGeometry(loadW, loadD, loadH)
    const loadMesh = new THREE.Mesh(loadGeo, boxMat)
    loadMesh.position.set(0, 0, palletH + loadH / 2)
    loadMesh.castShadow = true
    group.add(loadMesh)
  }
}

// ─────────────────────────────────────────────────────────────
// 7. EQUIPAMENTOS (EMPILHADEIRA PROCEDURAL)
// ─────────────────────────────────────────────────────────────
function buildForkliftGeometry(group: THREE.Group, spatial: UniversalSpatialObject) {
  const { width, depth, height } = spatial.dimensions

  const bodyMat = getMaterial("forklift_orange", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#f97316"), roughness: 0.3, metalness: 0.6 })
  )
  const cabinMat = getMaterial("forklift_frame_dark", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#1e293b"), roughness: 0.6, metalness: 0.7 })
  )

  // Corpo / Chassi
  const bodyH = height * 0.45
  const bodyGeo = new THREE.BoxGeometry(width * 0.8, depth * 0.65, bodyH)
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat)
  bodyMesh.position.set(0, -depth * 0.1, bodyH / 2)
  group.add(bodyMesh)

  // Torre frontal (mastro de elevação)
  const mastH = height
  const mastGeo = new THREE.BoxGeometry(width * 0.6, 0.08, mastH)
  const mastMesh = new THREE.Mesh(mastGeo, cabinMat)
  mastMesh.position.set(0, depth / 2 - 0.04, mastH / 2)
  group.add(mastMesh)

  // Garfos frontais
  const forkMat = getMaterial("fork_steel", () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#94a3b8"), roughness: 0.2, metalness: 0.9 })
  )
  const forkGeo = new THREE.BoxGeometry(0.08, depth * 0.45, 0.04)

  const forkL = new THREE.Mesh(forkGeo, forkMat)
  forkL.position.set(-width * 0.2, depth / 2 + (depth * 0.45) / 2, 0.02)
  group.add(forkL)

  const forkR = new THREE.Mesh(forkGeo, forkMat)
  forkR.position.set(width * 0.2, depth / 2 + (depth * 0.45) / 2, 0.02)
  group.add(forkR)
}

// ─────────────────────────────────────────────────────────────
// 8. SÓLIDO PARAMÉTRICO GENÉRICO
// ─────────────────────────────────────────────────────────────
function buildGenericSolidGeometry(group: THREE.Group, spatial: UniversalSpatialObject) {
  const { width, depth, height } = spatial.dimensions
  const solidColor = spatial.color || "#64748b"

  const solidMat = getMaterial(`solid_${solidColor}`, () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(solidColor),
      roughness: 0.6,
      metalness: 0.3,
    })
  )

  const geo = new THREE.BoxGeometry(width, depth, height)
  const mesh = new THREE.Mesh(geo, solidMat)
  mesh.position.set(0, 0, height / 2)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)

  // Linhas de borda elegantes
  const edges = new THREE.EdgesGeometry(geo)
  const lineMat = getMaterial(`edge_${spatial.strokeColor}`, () =>
    new THREE.LineBasicMaterial({ color: new THREE.Color(spatial.strokeColor || "#94a3b8") })
  )
  const lines = new THREE.LineSegments(edges, lineMat)
  lines.position.copy(mesh.position)
  group.add(lines)
}
