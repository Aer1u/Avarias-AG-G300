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

function parseThreeColor(input: string | undefined, fallbackHex: string): { color: string; alpha: number | null } {
  if (!input) return { color: fallbackHex, alpha: null }
  const m = input.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i)
  if (m) {
    const r = Number(m[1]).toString(16).padStart(2, "0")
    const g = Number(m[2]).toString(16).padStart(2, "0")
    const b = Number(m[3]).toString(16).padStart(2, "0")
    const alpha = m[4] !== undefined ? Number(m[4]) : 1
    return { color: `#${r}${g}${b}`, alpha }
  }
  return { color: input, alpha: null }
}

/**
 * Cria a representação geométrica tridimensional real de um objeto do catálogo
 */
export function buildSpatial3DObject(spatial: UniversalSpatialObject, readOnly: boolean = false): THREE.Group {
  const group = new THREE.Group()
  group.name = spatial.id
  group.userData = { objectId: spatial.id, spatial }

  const type = spatial.type.toLowerCase()
  const cat = spatial.category

  // Oculta elementos puramente auxiliares de edição no modo visualizador
  if (readOnly && (type === "coordinates" || type === "dimension_line")) {
    group.visible = false
    return group
  }

  // 1. ÁREAS, PISOS E RUAS
  if (cat === "area" || type === "floor" || type === "custom_area") {
    buildAreaGeometry(group, spatial, readOnly)
  }
  // 2. PORTA-PALETES / RACKS
  else if (type.includes("rack") || type === "pallet_rack") {
    buildPalletRackGeometry(group, spatial, readOnly)
  }
  // 3. DRIVE-IN E DRIVES
  else if (type.includes("drive") || type === "drive_in") {
    buildDriveInGeometry(group, spatial, readOnly)
  }
  // 4. ESTRUTURAS ARQUITETÔNICAS (Paredes, Colunas, Portas, Janelas)
  else if (type === "wall") {
    buildWallGeometry(group, spatial, readOnly)
  } else if (type === "column") {
    buildColumnGeometry(group, spatial, readOnly)
  }
  // 5. DOCAS E EXPEDIÇÃO
  else if (type === "dock" || type.includes("dock")) {
    buildDockGeometry(group, spatial)
  }
  // 6. PALETES E CARGAS
  else if (type === "pallet" || type === "box") {
    buildPalletWithLoadGeometry(group, spatial)
  }
  // 7. COMPARTIMENTO (ESPAÇO ABERTO DE ARMAZENAMENTO NO PISO)
  else if (type === "compartment") {
    buildCompartmentGeometry(group, spatial, readOnly)
  }
  // 8. EQUIPAMENTOS (Empilhadeira, Carrinhos)
  else if (cat === "equipment" || type === "forklift") {
    buildForkliftGeometry(group, spatial)
  }
  // 9. BLOCOS E ELEMENTOS GENÉRICOS
  else {
    buildGenericSolidGeometry(group, spatial, readOnly)
  }

  // Posiciona o grupo no espaço universal (Z para cima)
  group.position.set(spatial.position.x, spatial.position.y, spatial.position.z)
  group.rotation.z = spatial.rotationZRad

  return group
}

// ─────────────────────────────────────────────────────────────
// 1. ÁREAS, PISOS E RUAS DE TRÁFEGO
// ─────────────────────────────────────────────────────────────
const VIEWER_CLASSIFICATION_COLORS: Record<string, { color: string; opacity: number }> = {
  piso_geral: { color: "#475569", opacity: 0.96 },
  area_avarias: { color: "#d97706", opacity: 0.52 },
  bloco: { color: "#4f46e5", opacity: 0.45 },
  picking: { color: "#059669", opacity: 0.5 },
  quarentena: { color: "#dc2626", opacity: 0.55 },
  expedicao: { color: "#7c3aed", opacity: 0.48 },
  circulacao: { color: "#0284c7", opacity: 0.55 },
}

function buildAreaGeometry(group: THREE.Group, spatial: UniversalSpatialObject, readOnly: boolean) {
  const { width, depth } = spatial.dimensions
  const classification = spatial.raw.classification || ""
  const isStreet =
    classification === "rua" ||
    classification === "circulacao" ||
    spatial.type === "street"

  // Detecção de material de solo / piso de apoio (Grama, Concreto, Asfalto, etc.)
  const rawMat =
    (spatial.raw.props?.floorMaterial as FloorMaterialType) ||
    (spatial.raw.type.startsWith("floor_")
      ? (spatial.raw.type.replace("floor_", "") as FloorMaterialType)
      : undefined)
  const surfaceDef = rawMat && FLOOR_SURFACES[rawMat] ? FLOOR_SURFACES[rawMat] : undefined

  const parsedSpatialColor = parseThreeColor(spatial.color, "#334155")
  const viewerCls = VIEWER_CLASSIFICATION_COLORS[classification]

  let areaColor: string
  let opacity: number

  if (readOnly) {
    if (surfaceDef) {
      areaColor = surfaceDef.threeColor
      opacity = 0.98
    } else if (isStreet) {
      areaColor = classification === "circulacao" ? "#0284c7" : "#334155"
      opacity = 0.96
    } else if (viewerCls) {
      const isDarkDefault =
        parsedSpatialColor.color === "#0f172a" || parsedSpatialColor.color === "#1e293b"
      areaColor = !spatial.color || isDarkDefault ? viewerCls.color : parsedSpatialColor.color
      opacity = viewerCls.opacity
    } else if (spatial.type === "floor") {
      areaColor = "#475569"
      opacity = 0.95
    } else {
      areaColor = parsedSpatialColor.color
      opacity = Math.max(0.55, parsedSpatialColor.alpha ?? 0.65)
    }
  } else {
    areaColor = surfaceDef
      ? surfaceDef.threeColor
      : isStreet
      ? "#1e293b"
      : spatial.color
      ? parsedSpatialColor.color
      : spatial.type === "floor"
      ? "#0f172a"
      : "#334155"
    opacity = isStreet ? 0.95 : surfaceDef ? 0.95 : 0.65
  }

  const isBaseFloor = spatial.type === "floor" || classification === "piso_geral" || Boolean(surfaceDef)
  const hThickness = isStreet ? 0.024 : isBaseFloor ? 0.02 : 0.022
  const zOffset = isStreet ? 0.026 : isBaseFloor ? 0 : 0.012
  const modeKey = readOnly ? "viewer" : "editor"

  // Chão delimitado
  const floorMat = getMaterial(`floor_${modeKey}_${areaColor}_${opacity}_${surfaceDef ? surfaceDef.id : "default"}`, () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(areaColor),
      roughness: surfaceDef ? surfaceDef.roughness : 0.85,
      metalness: surfaceDef ? surfaceDef.metalness : 0.1,
      transparent: opacity < 0.99,
      opacity,
    })
  )

  let floorGeo: THREE.BufferGeometry
  let meshCenterZ: number
  if (spatial.pointsM && spatial.pointsM.length >= 3) {
    const shape = new THREE.Shape()
    shape.moveTo(spatial.pointsM[0].x, spatial.pointsM[0].y)
    for (let i = 1; i < spatial.pointsM.length; i++) {
      shape.lineTo(spatial.pointsM[i].x, spatial.pointsM[i].y)
    }
    shape.closePath()
    floorGeo = new THREE.ExtrudeGeometry(shape, {
      depth: hThickness,
      bevelEnabled: false,
    })
    meshCenterZ = zOffset
  } else {
    floorGeo = new THREE.BoxGeometry(width, depth, hThickness)
    meshCenterZ = zOffset + hThickness / 2
  }

  const floorMesh = new THREE.Mesh(floorGeo, floorMat)
  floorMesh.position.set(0, 0, meshCenterZ)
  floorMesh.receiveShadow = true
  group.add(floorMesh)

  const topZ = zOffset + hThickness

  // Se for rua, desenha faixas de tráfego de segurança (amarelo industrial)
  if (isStreet) {
    const stripeMat = getMaterial("stripe_yellow", () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#eab308"),
        roughness: 0.5,
      })
    )

    const isVerticalStreet = depth >= width
    const stripeW = 0.08
    const stripeH = 0.005

    if (isVerticalStreet) {
      const stripeGeo = new THREE.BoxGeometry(stripeW, depth, stripeH)
      const leftStripe = new THREE.Mesh(stripeGeo, stripeMat)
      leftStripe.position.set(-width / 2 + stripeW / 2 + 0.05, 0, topZ + stripeH / 2)
      group.add(leftStripe)

      const rightStripe = new THREE.Mesh(stripeGeo, stripeMat)
      rightStripe.position.set(width / 2 - stripeW / 2 - 0.05, 0, topZ + stripeH / 2)
      group.add(rightStripe)

      if (width >= 2.5) {
        const dashLength = 0.8
        const gap = 0.6
        const totalDash = Math.floor(depth / (dashLength + gap))
        const dashGeo = new THREE.BoxGeometry(0.06, dashLength, stripeH)

        for (let i = 0; i < totalDash; i++) {
          const yPos = -depth / 2 + (i + 0.5) * (dashLength + gap)
          const dashMesh = new THREE.Mesh(dashGeo, stripeMat)
          dashMesh.position.set(0, yPos, topZ + stripeH / 2 + 0.001)
          group.add(dashMesh)
        }
      }
    } else {
      const stripeGeo = new THREE.BoxGeometry(width, stripeW, stripeH)
      const topStripe = new THREE.Mesh(stripeGeo, stripeMat)
      topStripe.position.set(0, depth / 2 - stripeW / 2 - 0.05, topZ + stripeH / 2)
      group.add(topStripe)

      const bottomStripe = new THREE.Mesh(stripeGeo, stripeMat)
      bottomStripe.position.set(0, -depth / 2 + stripeW / 2 + 0.05, topZ + stripeH / 2)
      group.add(bottomStripe)

      if (depth >= 2.5) {
        const dashLength = 0.8
        const gap = 0.6
        const totalDash = Math.floor(width / (dashLength + gap))
        const dashGeo = new THREE.BoxGeometry(dashLength, 0.06, stripeH)

        for (let i = 0; i < totalDash; i++) {
          const xPos = -width / 2 + (i + 0.5) * (dashLength + gap)
          const dashMesh = new THREE.Mesh(dashGeo, stripeMat)
          dashMesh.position.set(xPos, 0, topZ + stripeH / 2 + 0.001)
          group.add(dashMesh)
        }
      }
    }
  } else {
    // Moldura de contorno suave para blocos e setores
    const parsedStroke = parseThreeColor(spatial.strokeColor, "#6366f1")
    const borderMat = getMaterial(`border_${parsedStroke.color}`, () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(parsedStroke.color),
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
function buildPalletRackGeometry(group: THREE.Group, spatial: UniversalSpatialObject, readOnly: boolean) {
  const { width, depth, height } = spatial.dimensions
  const levels = spatial.internalStructure?.levelsCount || 4
  const modeKey = readOnly ? "viewer" : "editor"

  const columnProfileMat = getMaterial(`rack_column_blue_${modeKey}`, () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(readOnly ? "#2563eb" : "#1e40af"), roughness: 0.45, metalness: 0.55 })
  )
  const beamMat = getMaterial(`rack_beam_orange_${modeKey}`, () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(readOnly ? "#f97316" : "#ea580c"), roughness: 0.35, metalness: 0.45 })
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
function buildDriveInGeometry(group: THREE.Group, spatial: UniversalSpatialObject, readOnly: boolean) {
  const { width, depth, height } = spatial.dimensions
  const props = spatial.props || {}
  const channelsCount = Array.isArray(props.channels) && props.channels.length > 0 ? props.channels.length : 0
  const propLanes = Number(props.lanes) || Number(spatial.internalStructure?.lanesCount) || 0
  const widthBasedLanes = Math.max(1, Math.round(width / 1.35))
  const lanes =
    propLanes > 0 || channelsCount > 0
      ? Math.max(1, propLanes, channelsCount)
      : Math.max(1, width > 2.0 ? widthBasedLanes : 1)

  const levels = spatial.internalStructure?.levelsCount || Number(props.levels) || 4
  const depths = spatial.internalStructure?.depthsCount || Number(props.depth) || 4
  const laneWidth = width / lanes
  const modeKey = readOnly ? "viewer" : "editor"

  const isDriveThrough = spatial.type.toLowerCase() === "drive_through"

  const driveColumnMat = getMaterial(`drive_col_indigo_${modeKey}`, () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(readOnly ? "#3b82f6" : "#3730a3"), roughness: 0.35, metalness: 0.65 })
  )
  const driveRailMat = getMaterial(`drive_rail_${modeKey}`, () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(readOnly ? "#94a3b8" : "#d97706"), roughness: 0.3, metalness: 0.75 })
  )
  const frameBraceMat = getMaterial(`drive_brace_silver_${modeKey}`, () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(readOnly ? "#cbd5e1" : "#94a3b8"), roughness: 0.4, metalness: 0.75 })
  )
  const rearBeamMat = getMaterial(`drive_rear_orange_${modeKey}`, () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(readOnly ? "#f97316" : "#ea580c"), roughness: 0.35, metalness: 0.55 })
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

    // Travessa longitudinal superior conectando as colunas da entrada ao fundo
    const longTopGeo = new THREE.BoxGeometry(0.05, depth, 0.05)
    const longTopMesh = new THREE.Mesh(longTopGeo, rearBeamMat)
    longTopMesh.position.set(colX, 0, height)
    group.add(longTopMesh)
  }

  // 2. Trilhos Longitudinais de Apoio dos Paletes em Cada Vão
  // No Drive-In real, o Nível 1 (chão) repousa sobre o piso de concreto.
  // Os pares de trilhos aéreos sustentam os níveis elevados (N2, N3, N4...)
  const railThick = 0.06
  const railGeo = new THREE.BoxGeometry(railThick, depth, railThick)
  const bracketGeo = new THREE.BoxGeometry(0.12, 0.06, 0.04)
  const levelSpacing = height / Math.max(1, levels)

  for (let l = 0; l < lanes; l++) {
    const laneCenterX = -width / 2 + (l + 0.5) * laneWidth
    const vXLeft = -width / 2 + l * laneWidth + 0.07
    const vXRight = -width / 2 + (l + 0.5) * laneWidth + laneWidth / 2 - 0.07

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

    // Travamento superior frontal (entrada, y = -depth/2) e traseiro (fundo, y = +depth/2)
    const topBeamGeo = new THREE.BoxGeometry(laneWidth, 0.06, 0.06)
    const topBackWall = new THREE.Mesh(topBeamGeo, rearBeamMat)
    topBackWall.position.set(laneCenterX, depth / 2, height)
    group.add(topBackWall)

    const topEntryPortal = new THREE.Mesh(topBeamGeo, rearBeamMat)
    topEntryPortal.position.set(laneCenterX, -depth / 2, height)
    group.add(topEntryPortal)

    // ── RIGIDIFICAÇÃO POR TRAVAMENTO POSTERIOR (Parte de trás do canal: y = +depth/2) ──
    // Apenas para Drive-In (acesso único), mantendo a entrada (-depth/2) totalmente livre
    if (!isDriveThrough) {
      const rearY = depth / 2
      const rearHorizontalGeo = new THREE.BoxGeometry(laneWidth, 0.05, 0.05)

      // Travessas horizontais posteriores em cada nível (e base)
      const rearTieHeights: number[] = [0.22]
      for (let lvl = 1; lvl < levels; lvl++) {
        rearTieHeights.push(levelSpacing * lvl)
      }
      rearTieHeights.push(height)

      rearTieHeights.forEach((tz, idx) => {
        // O topo (height) já tem a viga superior; desenha travessas intermediárias e base
        if (idx < rearTieHeights.length - 1) {
          const tieBeam = new THREE.Mesh(rearHorizontalGeo, rearBeamMat)
          tieBeam.position.set(laneCenterX, rearY, tz)
          tieBeam.castShadow = true
          group.add(tieBeam)
        }
      })

      // Contraventamentos verticais em X (diagonais cruzadas na face posterior de cada módulo de altura)
      const braceSpanX = Math.max(0.25, laneWidth - colDim * 0.8)
      for (let seg = 0; seg < rearTieHeights.length - 1; seg++) {
        const z0 = rearTieHeights[seg]
        const z1 = rearTieHeights[seg + 1]
        const dz = z1 - z0
        if (dz <= 0.1) continue

        const diagLen = Math.hypot(braceSpanX, dz)
        const angle = Math.atan2(dz, braceSpanX)
        const diagGeo = new THREE.BoxGeometry(diagLen, 0.028, 0.028)
        const zMid = (z0 + z1) / 2

        const diagA = new THREE.Mesh(diagGeo, frameBraceMat)
        diagA.position.set(laneCenterX, rearY, zMid)
        diagA.rotation.y = angle
        diagA.castShadow = true
        group.add(diagA)

        const diagB = new THREE.Mesh(diagGeo, frameBraceMat)
        diagB.position.set(laneCenterX, rearY, zMid)
        diagB.rotation.y = -angle
        diagB.castShadow = true
        group.add(diagB)
      }
    }
  }

  // 3. RENDERIZAÇÃO REAL DOS PALETES EM TESTE DE PREENCHIMENTO (OCUPAÇÃO)
  type DriveChannelData = {
    id?: string
    laneIndex?: number
    occupiedPositions?: Array<{ level: number; depth: number }>
  }
  const rawChannels: DriveChannelData[] = Array.isArray(spatial.props?.channels)
    ? (spatial.props.channels as DriveChannelData[])
    : []
  const slotStepY = depth / Math.max(1, depths)

  // Materiais para os paletes dentro do drive
  const testPalletWoodMat = getMaterial(`drive_pallet_wood_${modeKey}`, () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(readOnly ? "#d97706" : "#b45309"), roughness: 0.75, metalness: 0.1 })
  )
  const testPalletBoxMat = getMaterial(`drive_pallet_box_${modeKey}`, () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(readOnly ? "#fbbf24" : "#eab308"), roughness: 0.55, metalness: 0.05 })
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
function buildWallGeometry(group: THREE.Group, spatial: UniversalSpatialObject, readOnly: boolean) {
  const { width, depth, height } = spatial.dimensions
  const modeKey = readOnly ? "viewer" : "editor"
  const wallMat = getMaterial(`arch_wall_concrete_${modeKey}`, () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(readOnly ? "#64748b" : "#475569"), roughness: 0.85, metalness: 0.05 })
  )

  const wallGeo = new THREE.BoxGeometry(width, depth, height)
  const wallMesh = new THREE.Mesh(wallGeo, wallMat)
  wallMesh.position.set(0, 0, height / 2)
  wallMesh.castShadow = true
  wallMesh.receiveShadow = true
  group.add(wallMesh)
}

function buildColumnGeometry(group: THREE.Group, spatial: UniversalSpatialObject, readOnly: boolean) {
  const { width, depth, height } = spatial.dimensions
  const radius = Math.max(0.15, Math.min(width, depth) / 2)
  const modeKey = readOnly ? "viewer" : "editor"

  const colMat = getMaterial(`arch_col_steel_${modeKey}`, () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(readOnly ? "#475569" : "#334155"), roughness: 0.45, metalness: 0.65 })
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
function buildGenericSolidGeometry(group: THREE.Group, spatial: UniversalSpatialObject, readOnly: boolean) {
  const { width, depth, height } = spatial.dimensions
  const parsedColor = parseThreeColor(spatial.color, readOnly ? "#64748b" : "#475569")
  const parsedStroke = parseThreeColor(spatial.strokeColor, "#94a3b8")
  const modeKey = readOnly ? "viewer" : "editor"

  const solidMat = getMaterial(`solid_${modeKey}_${parsedColor.color}`, () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(parsedColor.color),
      roughness: 0.55,
      metalness: 0.25,
    })
  )

  const geo = new THREE.BoxGeometry(width, depth, height)
  const mesh = new THREE.Mesh(geo, solidMat)
  mesh.position.set(0, 0, height / 2)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)

  if (!readOnly) {
    // Linhas de borda técnicas no modo editor
    const edges = new THREE.EdgesGeometry(geo)
    const lineMat = getMaterial(`edge_${parsedStroke.color}`, () =>
      new THREE.LineBasicMaterial({ color: new THREE.Color(parsedStroke.color) })
    )
    const lines = new THREE.LineSegments(edges, lineMat)
    lines.position.copy(mesh.position)
    group.add(lines)
  }
}

// ─────────────────────────────────────────────────────────────
// 9. COMPARTIMENTO (ESPAÇO ABERTO DEMARCADO NO CHÃO)
// ─────────────────────────────────────────────────────────────
function buildCompartmentGeometry(group: THREE.Group, spatial: UniversalSpatialObject, readOnly: boolean) {
  const { width, depth } = spatial.dimensions
  const padH = 0.08
  const modeKey = readOnly ? "viewer" : "editor"

  const padMat = getMaterial(`compartment_open_pad_${modeKey}`, () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(readOnly ? "#f59e0b" : "#ca8a04"),
      roughness: 0.65,
      metalness: 0.15,
      transparent: true,
      opacity: readOnly ? 0.55 : 0.25,
    })
  )

  const geo = new THREE.BoxGeometry(width, depth, padH)
  const mesh = new THREE.Mesh(geo, padMat)
  mesh.position.set(0, 0, padH / 2)
  mesh.receiveShadow = true
  group.add(mesh)

  const borderMat = getMaterial(`compartment_open_border_${modeKey}`, () =>
    new THREE.LineBasicMaterial({ color: new THREE.Color(readOnly ? "#fbbf24" : "#eab308") })
  )
  const edges = new THREE.EdgesGeometry(geo)
  const lines = new THREE.LineSegments(edges, borderMat)
  lines.position.copy(mesh.position)
  group.add(lines)
}
