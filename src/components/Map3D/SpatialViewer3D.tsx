// =============================================================================
// NEXUS ERP — MOTOR UNIVERSAL DE VISUALIZAÇÃO ESPACIAL
// SpatialViewer3D.tsx — Motor de renderização Three.js (Isométrico & 3D Livre)
// ── Características:
//    • Cena tridimensional única compartilhada entre os modos Isométrico e 3D Livre
//    • Z como eixo vertical em metros (camera.up.set(0, 0, 1))
//    • Câmera Ortográfica no modo Isométrico COM ROTAÇÃO DE CÂMERA 360° TOTALMENTE LIBERADA
//    • Câmera Perspectiva no modo 3D Livre com órbita e navegação espacial
//    • Sincronização em tempo real de câmera sem congelamento de closure
//    • Raycaster para seleção sincronizada por UUID com realce visual
//    • Enquadramento automático (fitToScreen) e grid métrico no solo
// =============================================================================

"use client"

import React, { useEffect, useRef, useCallback, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { MapObject } from "../MapLibrary/types"
import type { SpatialViewMode } from "./types"
import { mapObjectToSpatial, DEFAULT_PIXELS_PER_METER } from "./spatialAdapter"
import { buildSpatial3DObject } from "./geometryCatalog"

interface SpatialViewer3DProps {
  mode: "isometric" | "3d"
  objects: MapObject[]
  selectedId: string | null
  selectedChannelId?: string | null
  snapEnabled?: boolean
  gridSize?: number
  readOnly?: boolean
  onSelect: (id: string | null, channelId?: string | null) => void
  onUpdateObject?: (id: string, partial: Partial<MapObject>) => void
  onModeChange?: (mode: SpatialViewMode) => void
}

export function SpatialViewer3D({
  mode,
  objects,
  selectedId,
  selectedChannelId = null,
  snapEnabled = true,
  gridSize = 20,
  readOnly = false,
  onSelect,
  onUpdateObject,
  onModeChange,
}: SpatialViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  // Ref reativa do modo atual (garante que o loop de animação nunca fique com closure stale)
  const modeRef = useRef<"isometric" | "3d">(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const readOnlyRef = useRef<boolean>(readOnly)
  useEffect(() => {
    readOnlyRef.current = readOnly
  }, [readOnly])

  const selectedIdRef = useRef<string | null>(selectedId)
  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  const selectedChannelIdRef = useRef<string | null>(selectedChannelId ?? null)
  useEffect(() => {
    selectedChannelIdRef.current = selectedChannelId ?? null
  }, [selectedChannelId])

  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  const [shadowsEnabled, setShadowsEnabled] = useState(true)
  const shadowsEnabledRef = useRef<boolean>(shadowsEnabled)
  useEffect(() => {
    shadowsEnabledRef.current = shadowsEnabled
  }, [shadowsEnabled])

  const [sideViewIsolated, setSideViewIsolated] = useState(false)
  const isSideViewActive = sideViewIsolated && Boolean(selectedId)
  const wasSideViewIsolatedRef = useRef(false)
  const savedCameraBeforeSideRef = useRef<{
    pos: THREE.Vector3
    target: THREE.Vector3
    orthoFrustum?: { left: number; right: number; top: number; bottom: number }
  } | null>(null)

  // Refs Three.js
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null)
  const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const selectionBoxRef = useRef<THREE.Box3Helper | null>(null)
  const channelHighlightRef = useRef<THREE.Mesh | null>(null)
  const objectsGroupRef = useRef<THREE.Group | null>(null)
  const gridHelperRef = useRef<THREE.GridHelper | null>(null)
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null)
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null)
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null)
  const animFrameIdRef = useRef<number | null>(null)

  // ── 1. INICIALIZAÇÃO DA CENA THREE.JS ─────────────────────────
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || 800
    const height = container.clientHeight || 600

    // Cena
    const initialBg = readOnlyRef.current ? "#0b1120" : "#070a13"
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(initialBg)
    scene.fog = new THREE.FogExp2(initialBg, 0.002)
    sceneRef.current = scene

    // Convenção cartesiana universal: Z é o eixo vertical (altura)
    THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

    // Renderer WebGL
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = shadowsEnabledRef.current
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.32
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Iluminação de estúdio/galpão (3 pontos + Hemisphere Z-up)
    const ambientLight = new THREE.AmbientLight("#f8fafc", readOnlyRef.current ? 0.9 : 0.75)
    scene.add(ambientLight)
    ambientLightRef.current = ambientLight

    const hemiLight = new THREE.HemisphereLight("#f1f5f9", "#334155", readOnlyRef.current ? 1.15 : 0.95)
    hemiLight.position.set(0, 0, 1) // Z-up: céu em +Z, rebote do piso em -Z
    scene.add(hemiLight)
    hemiLightRef.current = hemiLight

    const sunLight = new THREE.DirectionalLight("#fffaf0", 1.95)
    sunLight.position.set(60, -80, 110)
    sunLight.castShadow = shadowsEnabledRef.current
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    sunLight.shadow.camera.near = 10
    sunLight.shadow.camera.far = 350
    const d = 120
    sunLight.shadow.camera.left = -d
    sunLight.shadow.camera.right = d
    sunLight.shadow.camera.top = d
    sunLight.shadow.camera.bottom = -d
    sunLight.shadow.bias = -0.0004
    sunLight.shadow.normalBias = 0.02
    scene.add(sunLight)
    sunLightRef.current = sunLight

    const fillLight = new THREE.DirectionalLight("#bae6fd", 1.05)
    fillLight.position.set(-65, 55, 75)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight("#fed7aa", 0.65)
    rimLight.position.set(0, 85, 55)
    scene.add(rimLight)

    // Grid métrico no solo (Z = 0) — ocultado no modo visualizador
    const gridHelper = new THREE.GridHelper(400, 400, 0x3b82f6, 0x1e293b)
    gridHelper.rotation.x = Math.PI / 2
    gridHelper.position.z = -0.01
    gridHelper.visible = !readOnlyRef.current
    scene.add(gridHelper)
    gridHelperRef.current = gridHelper

    // Grupo de objetos do mapa
    const objectsGroup = new THREE.Group()
    objectsGroup.name = "map_objects_group"
    scene.add(objectsGroup)
    objectsGroupRef.current = objectsGroup

    // ── CÂMERAS ───────────────────────────────────────────────
    const aspect = width / height

    // ── SISTEMA DE COORDENADAS (alinhado com o 2D) ────────────────
    // 2D: X cresce para direita, Y cresce para baixo (origem top-left)
    // 3D: X cresce para direita (igual), Y cresce para baixo/fundo (igual ao 2D)
    // Câmera olha de Z positivo (cima) + Y negativo (atrás da tela) para Y positivo (frente)
    // Assim esquerda/direita e topo/fundo são IDÊNTICOS entre 2D e 3D.

    // Câmera Perspectiva (3D Livre) — vista isométrica padrão alinhada com 2D
    const perspCam = new THREE.PerspectiveCamera(50, aspect, 0.5, 1200)
    perspCam.up.set(0, 0, 1)
    // Câmera posicionada ao Sul (Y mais negativo) e acima (+Z), olhando para o mapa (Y negativo)
    perspCam.position.set(20, -65, 45)
    perspCamRef.current = perspCam

    // Câmera Ortográfica (Isométrico técnico)
    const frustumSize = 45
    const orthoCam = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      -500,
      1200
    )
    orthoCam.up.set(0, 0, 1)
    const isoDist = 70
    // Mesmo sistema: câmera ao Sul e acima do centro
    orthoCam.position.set(20, -20 - isoDist * 0.5, isoDist * 0.85)
    orthoCamRef.current = orthoCam

    // Controles OrbitControls configurados para Z-up
    const initialCam = modeRef.current === "isometric" ? orthoCam : perspCam
    const controls = new OrbitControls(initialCam, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enableRotate = true // ROTAÇÃO HABILITADA NOS DOIS MODOS (atendendo ao pedido)
    controls.enablePan = true
    controls.enableZoom = true
    controls.maxPolarAngle = Math.PI / 2 - 0.01 // Não passa por baixo do solo
    controls.minDistance = 2
    controls.maxDistance = 500
    // Target centralizado nos objetos (Y negativo = quadrante inferior do 2D)
    controls.target.set(20, -20, 0)
    controls.update()
    controlsRef.current = controls

    // Realce de seleção (Bounding Box Helper)
    const boxHelper = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color("#38bdf8"))
    boxHelper.visible = false
    scene.add(boxHelper)
    selectionBoxRef.current = boxHelper

    // Realce de piso para canal individual selecionado
    const channelHighlightGeo = new THREE.PlaneGeometry(1, 1)
    const channelHighlightMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#38bdf8"),
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const channelFloorHighlight = new THREE.Mesh(channelHighlightGeo, channelHighlightMat)
    channelFloorHighlight.visible = false
    channelFloorHighlight.renderOrder = 10
    scene.add(channelFloorHighlight)
    channelHighlightRef.current = channelFloorHighlight

    // Loop de animação sempre lendo modeRef.current (sem closure estática)
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate)

      if (controlsRef.current && rendererRef.current && sceneRef.current) {
        controlsRef.current.update()
        const currentMode = modeRef.current
        const activeCam = currentMode === "isometric" ? orthoCamRef.current! : perspCamRef.current!
        rendererRef.current.render(sceneRef.current, activeCam)
      }
    }
    animate()

    // Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      const asp = w / h

      if (perspCamRef.current) {
        perspCamRef.current.aspect = asp
        perspCamRef.current.updateProjectionMatrix()
      }

      if (orthoCamRef.current) {
        const fs = frustumSize
        orthoCamRef.current.left = (-fs * asp) / 2
        orthoCamRef.current.right = (fs * asp) / 2
        orthoCamRef.current.top = fs / 2
        orthoCamRef.current.bottom = -fs / 2
        orthoCamRef.current.updateProjectionMatrix()
      }

      rendererRef.current.setSize(w, h)
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current)
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, []) // Inicializa o WebGL apenas uma vez

  // ── 2. SINCRONIZAÇÃO DA TROCA DE MODO (ISOMÉTRICO ↔ 3D LIVRE) ─
  useEffect(() => {
    const controls = controlsRef.current
    const orthoCam = orthoCamRef.current
    const perspCam = perspCamRef.current
    if (!controls || !orthoCam || !perspCam) return

    const currentTarget = controls.target.clone()

    if (mode === "isometric") {
      // Isométrico técnico: Câmera ortográfica COM ROTAÇÃO LIVRE HABILITADA
      controls.object = orthoCam
      controls.enableRotate = true // Rotação liberada para inspecionar qualquer ângulo no isométrico!
      controls.maxPolarAngle = Math.PI / 2 - 0.01

      // Herda direção atual da câmera perspectiva para manter continuidade visual
      const dir = perspCam.position.clone().sub(currentTarget).normalize()
      const dist = 75
      orthoCam.position.set(
        currentTarget.x + (dir.x !== 0 ? dir.x * dist : -dist * 0.5),
        currentTarget.y + (dir.y !== 0 ? dir.y * dist : -dist * 0.9),
        currentTarget.z + (dir.z > 0 ? dir.z * dist : dist * 0.816)
      )
      orthoCam.lookAt(currentTarget)
      orthoCam.updateProjectionMatrix()
    } else {
      // 3D Livre: Câmera perspectiva com navegação orbital completa
      controls.object = perspCam
      controls.enableRotate = true
      controls.maxPolarAngle = Math.PI / 2 - 0.01

      // Herda direção atual da câmera ortográfica
      const dir = orthoCam.position.clone().sub(currentTarget).normalize()
      const dist = 60
      perspCam.position.set(
        currentTarget.x + (dir.x !== 0 ? dir.x * dist : -dist * 0.3),
        currentTarget.y + (dir.y !== 0 ? dir.y * dist : -dist * 0.9),
        currentTarget.z + (dir.z > 0 ? dir.z * dist : dist * 0.7)
      )
      perspCam.lookAt(currentTarget)
      perspCam.updateProjectionMatrix()
    }

    controls.update()
  }, [mode])

  // ── 2b. REATIVIDADE DO MODO VISUALIZADOR (GRID + LUZ + FUNDO) ──
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = !readOnly
    }
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = readOnly ? 0.9 : 0.75
    }
    if (hemiLightRef.current) {
      hemiLightRef.current.intensity = readOnly ? 1.15 : 0.95
    }
    if (sceneRef.current) {
      const bg = readOnly ? "#0b1120" : "#070a13"
      sceneRef.current.background = new THREE.Color(bg)
      sceneRef.current.fog = new THREE.FogExp2(bg, 0.002)
    }
  }, [readOnly])

  // ── 2c. ALTERNÂNCIA DE SOMBRAS EM TEMPO REAL ───────────────────
  useEffect(() => {
    const renderer = rendererRef.current
    const sunLight = sunLightRef.current
    const scene = sceneRef.current
    if (!renderer || !sunLight || !scene) return

    renderer.shadowMap.enabled = shadowsEnabled
    renderer.shadowMap.needsUpdate = true
    sunLight.castShadow = shadowsEnabled

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => {
            m.needsUpdate = true
          })
        } else if (obj.material) {
          obj.material.needsUpdate = true
        }
      }
    })
  }, [shadowsEnabled])

  // ── 3. RENDERIZAÇÃO DOS OBJETOS NA CENA ───────────────────────
  useEffect(() => {
    const group = objectsGroupRef.current
    if (!group) return

    // Limpa malhas anteriores
    while (group.children.length > 0) {
      const child = group.children[0]
      group.remove(child)
    }

    // Constrói cada geometria espacial
    objects.forEach((obj) => {
      if (obj.visible === false) return
      if (readOnly && (obj.type === "coordinates" || obj.type === "dimension_line")) return
      const spatial = mapObjectToSpatial(obj, DEFAULT_PIXELS_PER_METER)
      const mesh3D = buildSpatial3DObject(spatial, readOnly)
      group.add(mesh3D)
    })
  }, [objects, readOnly])

  // ── 4. REALCE DO OBJETO / CANAL INDIVIDUAL SELECIONADO ─────────
  useEffect(() => {
    const box = selectionBoxRef.current
    const channelFloor = channelHighlightRef.current
    const group = objectsGroupRef.current
    if (!box || !group) return

    if (!selectedId) {
      box.visible = false
      if (channelFloor) channelFloor.visible = false
      return
    }

    const selectedMesh = group.getObjectByName(selectedId)
    if (selectedMesh) {
      selectedMesh.updateWorldMatrix(true, true)

      let targetLaneObj: THREE.Object3D | null = null
      if (selectedChannelId) {
        selectedMesh.traverse((child) => {
          if (
            !targetLaneObj &&
            child.userData &&
            (child.userData.channelId === selectedChannelId ||
              child.userData.channelCode === selectedChannelId)
          ) {
            targetLaneObj = child
          }
        })
      }

      const highlightTarget = targetLaneObj || selectedMesh
      if (isSideViewActive) {
        box.visible = false
      } else {
        const b3 = new THREE.Box3().setFromObject(highlightTarget)
        b3.expandByScalar(targetLaneObj ? 0.05 : 0.08)
        box.box.copy(b3)
        box.visible = true
      }

      if (channelFloor) {
        const laneData = (targetLaneObj as THREE.Object3D | null)?.userData
        if (targetLaneObj && laneData && typeof laneData.laneWidth === "number") {
          const localCenter = new THREE.Vector3(Number(laneData.laneCenterX) || 0, 0, 0.045)
          localCenter.applyMatrix4(selectedMesh.matrixWorld)
          channelFloor.position.copy(localCenter)
          channelFloor.rotation.set(0, 0, selectedMesh.rotation.z)
          channelFloor.scale.set(Number(laneData.laneWidth), Number(laneData.depth) || 4, 1)
          channelFloor.visible = true
        } else {
          channelFloor.visible = false
        }
      }
    } else {
      box.visible = false
      if (channelFloor) channelFloor.visible = false
    }
  }, [selectedId, selectedChannelId, objects, isSideViewActive])

  // ── 4b. MODO VISTA LATERAL ISOLADA (oculta demais objetos) ────
  useEffect(() => {
    const group = objectsGroupRef.current
    const controls = controlsRef.current
    if (!group || !controls) return

    const activeMode = modeRef.current
    const activeCam = activeMode === "isometric" ? orthoCamRef.current : perspCamRef.current

    if (isSideViewActive && selectedId) {
      const selectedMesh = group.getObjectByName(selectedId)
      if (!selectedMesh) return

      // Salva posição e frustum da câmera antes de isolar
      if (!wasSideViewIsolatedRef.current && activeCam) {
        savedCameraBeforeSideRef.current = {
          pos: activeCam.position.clone(),
          target: controls.target.clone(),
          orthoFrustum: orthoCamRef.current
            ? {
                left: orthoCamRef.current.left,
                right: orthoCamRef.current.right,
                top: orthoCamRef.current.top,
                bottom: orthoCamRef.current.bottom,
              }
            : undefined,
        }
        wasSideViewIsolatedRef.current = true
      }

      if (gridHelperRef.current) {
        gridHelperRef.current.visible = false
      }

      // Oculta todos os outros objetos da cena
      group.children.forEach((child) => {
        child.visible = child.name === selectedId
      })

      // Se um canal individual estiver selecionado, isola apenas esse canal e seus montantes laterais
      let targetLaneObj: THREE.Object3D | null = null
      if (selectedChannelId) {
        selectedMesh.traverse((c) => {
          if (
            !targetLaneObj &&
            c.userData &&
            (c.userData.channelId === selectedChannelId || c.userData.channelCode === selectedChannelId)
          ) {
            targetLaneObj = c
          }
        })
      }

      if (targetLaneObj) {
        const laneData = (targetLaneObj as THREE.Object3D).userData
        const activeChanId = laneData.channelId
        const activeLaneIdx = Number(laneData.laneIndex)

        selectedMesh.children.forEach((child) => {
          if (child.userData?.channelId) {
            child.visible = child.userData.channelId === activeChanId
          } else if (typeof child.userData?.columnLineIndex === "number") {
            const colIdx = child.userData.columnLineIndex
            child.visible = colIdx === activeLaneIdx || colIdx === activeLaneIdx + 1
          } else {
            child.visible = true
          }
        })
      } else {
        selectedMesh.traverse((c) => {
          c.visible = true
        })
      }

      selectedMesh.updateWorldMatrix(true, true)

      // Calcula bounding box apenas da parte visível do selecionado
      const isoBox = new THREE.Box3()
      selectedMesh.traverse((c) => {
        if (c instanceof THREE.Mesh && c.visible) {
          // Ignora hitbox transparente da contagem de box se possível, ou inclui tudo do canal
          if (c.material instanceof THREE.MeshBasicMaterial && c.material.opacity === 0) return
          isoBox.expandByObject(c)
        }
      })
      if (isoBox.isEmpty()) {
        isoBox.setFromObject(targetLaneObj || selectedMesh)
      }

      const center = new THREE.Vector3()
      const size = new THREE.Vector3()
      isoBox.getCenter(center)
      isoBox.getSize(size)

      // Eixo lateral (+X local do objeto rotacionado) — mostra entrada à esquerda e fundo à direita
      const rotZ = selectedMesh.rotation.z
      const sideDir = new THREE.Vector3(Math.cos(rotZ), Math.sin(rotZ), 0)
      const maxSpan = Math.max(size.x, size.y, size.z, 2.5)
      const dist = maxSpan * 1.65

      controls.target.copy(center)

      if (activeMode === "isometric" && orthoCamRef.current) {
        const ortho = orthoCamRef.current
        const container = mountRef.current
        const aspect = container && container.clientHeight > 0 ? container.clientWidth / container.clientHeight : 1.5
        const fs = Math.max(size.y, size.z, size.x, 3) * 1.35
        ortho.left = (-fs * aspect) / 2
        ortho.right = (fs * aspect) / 2
        ortho.top = fs / 2
        ortho.bottom = -fs / 2
        ortho.up.set(0, 0, 1)
        ortho.position.copy(center).addScaledVector(sideDir, dist).add(new THREE.Vector3(0, 0, dist * 0.06))
        ortho.lookAt(center)
        ortho.updateProjectionMatrix()
      } else if (perspCamRef.current) {
        const persp = perspCamRef.current
        persp.up.set(0, 0, 1)
        persp.position.copy(center).addScaledVector(sideDir, dist).add(new THREE.Vector3(0, 0, dist * 0.06))
        persp.lookAt(center)
      }

      controls.update()
    } else {
      // Restaura visibilidade de todos os objetos e canais
      group.children.forEach((child) => {
        child.visible = true
        child.traverse((c) => {
          c.visible = true
        })
      })

      if (gridHelperRef.current) {
        gridHelperRef.current.visible = !readOnly
      }

      if (wasSideViewIsolatedRef.current) {
        wasSideViewIsolatedRef.current = false
        const saved = savedCameraBeforeSideRef.current
        savedCameraBeforeSideRef.current = null
        if (saved && activeCam) {
          if (activeMode === "isometric" && orthoCamRef.current && saved.orthoFrustum) {
            orthoCamRef.current.left = saved.orthoFrustum.left
            orthoCamRef.current.right = saved.orthoFrustum.right
            orthoCamRef.current.top = saved.orthoFrustum.top
            orthoCamRef.current.bottom = saved.orthoFrustum.bottom
            orthoCamRef.current.updateProjectionMatrix()
          }
          activeCam.up.set(0, 0, 1)
          activeCam.position.copy(saved.pos)
          controls.target.copy(saved.target)
          activeCam.lookAt(saved.target)
          controls.update()
        }
      }
    }
  }, [isSideViewActive, selectedId, selectedChannelId, objects, readOnly, mode])

  // ── 5. SELEÇÃO E DESELEÇÃO VIA RAYCASTER (CLIQUE E ESC) ───────
  useEffect(() => {
    const container = mountRef.current
    const renderer = rendererRef.current
    if (!container || !renderer) return

    let clickStartPos = { x: 0, y: 0 }

    const onPointerDown = (e: MouseEvent) => {
      clickStartPos = { x: e.clientX, y: e.clientY }
    }

    const extractHitInfo = (hitObj: THREE.Object3D, group: THREE.Group) => {
      let curr: THREE.Object3D | null = hitObj
      let foundId: string | null = null
      let foundChannelId: string | null = null
      let foundChannelCode: string | null = null
      let foundIsArea = false

      while (curr && curr !== group) {
        if (curr.userData) {
          if (!foundChannelId && curr.userData.channelId) {
            foundChannelId = String(curr.userData.channelId)
            foundChannelCode = curr.userData.channelCode ? String(curr.userData.channelCode) : null
          }
          if (!foundId && curr.userData.objectId) {
            foundId = String(curr.userData.objectId)
            const sp = curr.userData.spatial
            if (sp && (sp.category === "area" || sp.type === "floor")) {
              foundIsArea = true
            }
          }
        }
        curr = curr.parent
      }
      return { foundId, foundChannelId, foundChannelCode, foundIsArea }
    }

    const onPointerUp = (e: MouseEvent) => {
      const dist = Math.hypot(e.clientX - clickStartPos.x, e.clientY - clickStartPos.y)
      if (dist > 5) return // Foi arrasto de câmera, não clique de seleção
      if (e.button !== 0) return

      const rect = renderer.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )

      const raycaster = new THREE.Raycaster()
      const currentMode = modeRef.current
      const cam = currentMode === "isometric" ? orthoCamRef.current! : perspCamRef.current!
      raycaster.setFromCamera(mouse, cam)

      const group = objectsGroupRef.current
      if (!group) return

      const isVisibleInHierarchy = (obj: THREE.Object3D, root: THREE.Group) => {
        let cur: THREE.Object3D | null = obj
        while (cur && cur !== root) {
          if (!cur.visible) return false
          cur = cur.parent
        }
        return true
      }

      const rawIntersects = raycaster.intersectObjects(group.children, true)
      const intersects = rawIntersects.filter((hit) => isVisibleInHierarchy(hit.object, group))

      if (intersects.length > 0) {
        let primary = extractHitInfo(intersects[0].object, group)

        // Se o primeiro acerto foi uma coluna compartilhada na divisa do Drive-In,
        // verifica o próximo acerto do mesmo objeto para capturar o canal clicado
        if (primary.foundId && !primary.foundChannelId && intersects.length > 1) {
          for (let i = 1; i < intersects.length; i++) {
            const candidate = extractHitInfo(intersects[i].object, group)
            if (candidate.foundId === primary.foundId && candidate.foundChannelId) {
              primary = candidate
              break
            }
          }
        }

        const { foundId, foundChannelId, foundChannelCode, foundIsArea } = primary

        if (!foundId) {
          setSideViewIsolated(false)
          onSelectRef.current(null, null)
          return
        }

        // No modo visualizador, clicar no piso/área vazia quando algo está selecionado deseleciona
        if (readOnlyRef.current && foundIsArea && selectedIdRef.current) {
          setSideViewIsolated(false)
          onSelectRef.current(null, null)
          return
        }

        // Toggle: clicar novamente no mesmo canal ou objeto selecionado deseleciona
        const curId = selectedIdRef.current
        const curChan = selectedChannelIdRef.current
        const isSameObject = foundId === curId
        const isSameChannel = foundChannelId
          ? curChan === foundChannelId || (foundChannelCode !== null && curChan === foundChannelCode)
          : !curChan

        if (isSameObject && isSameChannel) {
          setSideViewIsolated(false)
          onSelectRef.current(null, null)
          return
        }

        onSelectRef.current(foundId, foundChannelId ?? null)
      } else {
        setSideViewIsolated(false)
        onSelectRef.current(null, null)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSideViewIsolated(false)
        if (selectedIdRef.current) {
          onSelectRef.current(null, null)
        }
      }
    }

    const dom = renderer.domElement
    dom.addEventListener("mousedown", onPointerDown)
    dom.addEventListener("mouseup", onPointerUp)
    window.addEventListener("keydown", onKeyDown)

    return () => {
      dom.removeEventListener("mousedown", onPointerDown)
      dom.removeEventListener("mouseup", onPointerUp)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  // ── 6. ENQUADRAMENTO AUTOMÁTICO (fitToScreen) ────────────────
  const fitToScreen = useCallback(() => {
    const group = objectsGroupRef.current
    const controls = controlsRef.current
    if (!group || !controls) return

    const box = new THREE.Box3()
    if (group.children.length === 0) {
      box.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(30, 30, 6))
    } else {
      box.setFromObject(group)
    }

    const center = new THREE.Vector3()
    box.getCenter(center)
    const size = new THREE.Vector3()
    box.getSize(size)

    controls.target.copy(center)

    const maxDim = Math.max(size.x, size.y, size.z, 20)
    const currentMode = modeRef.current

    if (currentMode === "isometric" && orthoCamRef.current) {
      const ortho = orthoCamRef.current
      const container = mountRef.current
      const aspect = container ? container.clientWidth / container.clientHeight : 1.5
      const fs = maxDim * 1.5
      ortho.left = (-fs * aspect) / 2
      ortho.right = (fs * aspect) / 2
      ortho.top = fs / 2
      ortho.bottom = -fs / 2
      ortho.updateProjectionMatrix()

      // Câmera iso: de trás (Y-) e acima (Z+), olhando para o centro
      const dist = maxDim * 2.2
      ortho.position.set(center.x - dist * 0.5, center.y - dist * 0.9, center.z + dist * 0.816)
      ortho.lookAt(center)
    } else if (perspCamRef.current) {
      const persp = perspCamRef.current
      const dist = maxDim * 1.6
      // Câmera 3D: de trás (Y-) e acima (Z+), olhando para o centro — igual orientação ao 2D
      persp.position.set(center.x - dist * 0.3, center.y - dist * 1.0, center.z + dist * 0.75)
      persp.lookAt(center)
    }

    controls.update()
  }, [])

  // Enquadra na primeira carga
  useEffect(() => {
    if (objects.length > 0) {
      const t = setTimeout(fitToScreen, 120)
      return () => clearTimeout(t)
    }
  }, [mode, fitToScreen, objects.length])

  return (
    <div className="flex-1 h-full w-full bg-slate-950 relative overflow-hidden select-none">
      {/* Canvas WebGL Three.js */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* ── HUD Flutuante de Câmera & Controles ─────────────────── */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-auto">
        {/* Dica de interação */}
        <div className="bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 px-3 py-1.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2.5">
          {mode === "isometric" ? (
            <>
              <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
              <span>
                <strong>Modo Isométrico:</strong> Projeção Ortográfica ·{" "}
                <kbd className="bg-slate-800 px-1 rounded text-slate-200">Arrastar</kbd> Girar Câmera 360° ·{" "}
                <kbd className="bg-slate-800 px-1 rounded text-slate-200">Botão Direito</kbd> Pan ·{" "}
                <kbd className="bg-slate-800 px-1 rounded text-slate-200">Scroll</kbd> Zoom
              </span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                <strong>Modo 3D Livre:</strong> Câmera Perspectiva ·{" "}
                <kbd className="bg-slate-800 px-1 rounded text-slate-200">Arrastar</kbd> Girar Câmera 360° ·{" "}
                <kbd className="bg-slate-800 px-1 rounded text-slate-200">Botão Direito</kbd> Pan ·{" "}
                <kbd className="bg-slate-800 px-1 rounded text-slate-200">Scroll</kbd> Zoom
              </span>
            </>
          )}
        </div>

        {/* Barra de Ações Rápidas de Câmera */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md">
          {selectedId && (
            <>
              <button
                onClick={() => setSideViewIsolated((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  isSideViewActive
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-950/50"
                    : "bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 hover:text-white border-indigo-700/60"
                }`}
                title={
                  isSideViewActive
                    ? "Sair da vista lateral isolada e mostrar todos os objetos"
                    : "Ocultar demais objetos e visualizar o selecionado de lado"
                }
              >
                <span>📐</span>
                <span>{isSideViewActive ? "Sair do Lado" : "Ver de Lado"}</span>
              </button>

              <button
                onClick={() => {
                  setSideViewIsolated(false)
                  onSelectRef.current(null, null)
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-950/80 hover:bg-sky-900 text-sky-300 hover:text-white text-xs font-bold transition-all border border-sky-700/60"
                title="Deselecionar item ou canal atual (Esc)"
              >
                <span>✕</span>
                <span>Deselecionar</span>
              </button>
            </>
          )}

          {/* Enquadrar Tudo */}
          <button
            onClick={fitToScreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/80 hover:bg-blue-900 text-blue-300 hover:text-white text-xs font-bold transition-all border border-blue-800/50"
            title="Enquadrar todas as estruturas na tela (Shift+1)"
          >
            <span>🎯</span>
            <span>Enquadrar</span>
          </button>

          {/* Visão Superior (Top View 3D alinhada 100% com o 2D) */}
          <button
            onClick={() => {
              const controls = controlsRef.current
              const currentMode = modeRef.current
              const cam = currentMode === "isometric" ? orthoCamRef.current : perspCamRef.current
              if (!controls || !cam) return
              const t = controls.target
              cam.up.set(0, 0, 1)
              cam.position.set(t.x, t.y - 0.01, t.z + 90)
              cam.lookAt(t)
              controls.update()
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            title="Vista Superior 3D (Planta 100% alinhada com o 2D)"
          >
            Topo
          </button>

          {/* Visão Frontal */}
          <button
            onClick={() => {
              const controls = controlsRef.current
              const currentMode = modeRef.current
              const cam = currentMode === "isometric" ? orthoCamRef.current : perspCamRef.current
              if (!controls || !cam) return
              const t = controls.target
              cam.up.set(0, 0, 1)
              cam.position.set(t.x, t.y - 80, t.z + 12)
              cam.lookAt(t)
              controls.update()
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            title="Vista Frontal"
          >
            Frente
          </button>

          {/* Alternar Sombras */}
          <button
            onClick={() => setShadowsEnabled((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              shadowsEnabled
                ? "bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border-amber-700/60"
                : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700/60"
            }`}
            title={shadowsEnabled ? "Desativar sombras em tempo real" : "Ativar sombras em tempo real"}
          >
            <span className={`h-2 w-2 rounded-full ${shadowsEnabled ? "bg-amber-400" : "bg-slate-500"}`} />
            <span>{shadowsEnabled ? "Sombras On" : "Sombras Off"}</span>
          </button>

          {/* Restaurar Orientação Isométrica Padrão */}
          <button
            onClick={() => {
              const controls = controlsRef.current
              const currentMode = modeRef.current
              const cam = currentMode === "isometric" ? orthoCamRef.current : perspCamRef.current
              if (!controls || !cam) return
              const t = controls.target
              const d = 75
              cam.up.set(0, 0, 1)
              cam.position.set(t.x + d * 0.7, t.y - d * 0.9, t.z + d * 0.816)
              cam.lookAt(t)
              controls.update()
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            title="Restaurar Ângulo Isométrico Padrão"
          >
            Iso
          </button>
        </div>
      </div>
    </div>
  )
}
