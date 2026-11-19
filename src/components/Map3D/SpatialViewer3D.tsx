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

import React, { useEffect, useRef, useCallback } from "react"
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
  snapEnabled?: boolean
  gridSize?: number
  onSelect: (id: string | null) => void
  onUpdateObject?: (id: string, partial: Partial<MapObject>) => void
  onModeChange?: (mode: SpatialViewMode) => void
}

export function SpatialViewer3D({
  mode,
  objects,
  selectedId,
  snapEnabled = true,
  gridSize = 20,
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

  // Refs Three.js
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null)
  const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const selectionBoxRef = useRef<THREE.Box3Helper | null>(null)
  const objectsGroupRef = useRef<THREE.Group | null>(null)
  const animFrameIdRef = useRef<number | null>(null)

  // ── 1. INICIALIZAÇÃO DA CENA THREE.JS ─────────────────────────
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || 800
    const height = container.clientHeight || 600

    // Cena
    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#070a13")
    scene.fog = new THREE.FogExp2("#070a13", 0.002)
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
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Iluminação
    const ambientLight = new THREE.AmbientLight("#f8fafc", 0.75)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight("#ffffff", 1.8)
    sunLight.position.set(50, -60, 80)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    sunLight.shadow.camera.near = 10
    sunLight.shadow.camera.far = 300
    const d = 80
    sunLight.shadow.camera.left = -d
    sunLight.shadow.camera.right = d
    sunLight.shadow.camera.top = d
    sunLight.shadow.camera.bottom = -d
    sunLight.shadow.bias = -0.0005
    scene.add(sunLight)

    const fillLight = new THREE.DirectionalLight("#93c5fd", 0.7)
    fillLight.position.set(-40, 50, 50)
    scene.add(fillLight)

    // Grid métrico no solo (Z = 0)
    const gridHelper = new THREE.GridHelper(400, 400, 0x3b82f6, 0x1e293b)
    gridHelper.rotation.x = Math.PI / 2
    gridHelper.position.z = -0.01
    scene.add(gridHelper)

    // Grupo de objetos do mapa
    const objectsGroup = new THREE.Group()
    objectsGroup.name = "map_objects_group"
    scene.add(objectsGroup)
    objectsGroupRef.current = objectsGroup

    // ── CÂMERAS ───────────────────────────────────────────────
    const aspect = width / height

    // Câmera Perspectiva (3D Livre)
    const perspCam = new THREE.PerspectiveCamera(50, aspect, 0.5, 1200)
    perspCam.up.set(0, 0, 1)
    perspCam.position.set(45, -55, 40)
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
    orthoCam.position.set(isoDist, -isoDist, isoDist * 0.816)
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
    controls.target.set(20, 20, 0)
    controls.update()
    controlsRef.current = controls

    // Realce de seleção (Bounding Box Helper)
    const boxHelper = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color("#38bdf8"))
    boxHelper.visible = false
    scene.add(boxHelper)
    selectionBoxRef.current = boxHelper

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

      // Mantém a direção atual ou orienta em ângulo isométrico se a câmera estiver fora
      const dir = perspCam.position.clone().sub(currentTarget).normalize()
      const dist = 75
      orthoCam.position.set(
        currentTarget.x + (dir.x !== 0 ? dir.x * dist : dist),
        currentTarget.y + (dir.y !== 0 ? dir.y * dist : -dist),
        currentTarget.z + (dir.z > 0 ? dir.z * dist : dist * 0.816)
      )
      orthoCam.lookAt(currentTarget)
      orthoCam.updateProjectionMatrix()
    } else {
      // 3D Livre: Câmera perspectiva com navegação orbital completa
      controls.object = perspCam
      controls.enableRotate = true
      controls.maxPolarAngle = Math.PI / 2 - 0.01

      const dir = orthoCam.position.clone().sub(currentTarget).normalize()
      const dist = 60
      perspCam.position.set(
        currentTarget.x + (dir.x !== 0 ? dir.x * dist : dist * 0.7),
        currentTarget.y + (dir.y !== 0 ? dir.y * dist : -dist * 0.9),
        currentTarget.z + (dir.z > 0 ? dir.z * dist : dist * 0.7)
      )
      perspCam.lookAt(currentTarget)
      perspCam.updateProjectionMatrix()
    }

    controls.update()
  }, [mode])

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
      const spatial = mapObjectToSpatial(obj, DEFAULT_PIXELS_PER_METER)
      const mesh3D = buildSpatial3DObject(spatial)
      group.add(mesh3D)
    })
  }, [objects])

  // ── 4. REALCE DO OBJETO SELECIONADO ──────────────────────────
  useEffect(() => {
    const box = selectionBoxRef.current
    const group = objectsGroupRef.current
    if (!box || !group) return

    if (!selectedId) {
      box.visible = false
      return
    }

    const selectedMesh = group.getObjectByName(selectedId)
    if (selectedMesh) {
      const b3 = new THREE.Box3().setFromObject(selectedMesh)
      b3.expandByScalar(0.08)
      box.box.copy(b3)
      box.visible = true
    } else {
      box.visible = false
    }
  }, [selectedId, objects])

  // ── 5. SELEÇÃO VIA RAYCASTER (CLIQUE) ────────────────────────
  useEffect(() => {
    const container = mountRef.current
    const renderer = rendererRef.current
    if (!container || !renderer) return

    let clickStartPos = { x: 0, y: 0 }

    const onPointerDown = (e: MouseEvent) => {
      clickStartPos = { x: e.clientX, y: e.clientY }
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

      const intersects = raycaster.intersectObjects(group.children, true)

      if (intersects.length > 0) {
        let curr: THREE.Object3D | null = intersects[0].object
        let foundId: string | null = null

        while (curr && curr !== group) {
          if (curr.userData && curr.userData.objectId) {
            foundId = curr.userData.objectId
            break
          }
          curr = curr.parent
        }

        onSelect(foundId)
      } else {
        onSelect(null)
      }
    }

    const dom = renderer.domElement
    dom.addEventListener("mousedown", onPointerDown)
    dom.addEventListener("mouseup", onPointerUp)

    return () => {
      dom.removeEventListener("mousedown", onPointerDown)
      dom.removeEventListener("mouseup", onPointerUp)
    }
  }, [onSelect])

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

      const dist = maxDim * 2.2
      ortho.position.set(center.x + dist, center.y - dist, center.z + dist * 0.816)
      ortho.lookAt(center)
    } else if (perspCamRef.current) {
      const persp = perspCamRef.current
      const dist = maxDim * 1.6
      persp.position.set(center.x + dist * 0.8, center.y - dist * 1.1, center.z + dist * 0.8)
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
              cam.up.set(0, 1, 0)
              cam.position.set(t.x, t.y, t.z + 90)
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
