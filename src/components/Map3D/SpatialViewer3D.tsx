// =============================================================================
// NEXUS ERP — MOTOR UNIVERSAL DE VISUALIZAÇÃO ESPACIAL
// SpatialViewer3D.tsx — Motor Three.js (Bird's-Eye 3D · Full Top 90° · 3D Livre)
// ── Características:
//    • Cena, geometrias, materiais, iluminação e sombras únicos compartilhados
//    • Bird's-Eye 3D (Padrão): projeção ortográfica com inclinação fixa de 20°
//    • Full Top: projeção ortográfica estritamente vertical a 90° (tilt = 0°)
//    • 3D Livre: câmera perspectiva com movimentação orbital 360° livre (OrbitControls)
//    • Em Bird's-Eye e Full Top: rotação 90° horária via tecla R, scroll zoom limitado e pan botão direito
// =============================================================================

"use client"

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { MapObject, SystemVisualRef } from "../MapLibrary/types"
import type { SpatialViewMode } from "./types"
import { mapObjectToSpatial, DEFAULT_PIXELS_PER_METER } from "./spatialAdapter"
import { buildSpatial3DObject } from "./geometryCatalog"
import { ITEMS_UPDATED_EVENT } from "@/lib/driveOccupancy"

const CAMERA_DIST = 180
const BIRDSEYE_TILT_RAD = THREE.MathUtils.degToRad(20) // Inclinação fixa dentro de 15°–25°
const FULLTOP_TILT_RAD = 0 // 90° vertical em relação ao solo
const DEFAULT_BASE_FRUSTUM = 45
const MIN_ZOOM = 0.25
const MAX_ZOOM = 12
const DAMP_SPEED = 11

export interface SpatialViewer3DHandle {
  fitToScreen: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  rotateClockwise90: () => void
  navigateToObject: (obj: MapObject) => void
}

interface SpatialViewer3DProps {
  mode: "birdseye" | "fulltop" | "3d"
  objects: MapObject[]
  selectedId: string | null
  selectedChannelId?: string | null
  readOnly?: boolean
  onSelect: (id: string | null, channelId?: string | null) => void
  onModeChange?: (mode: SpatialViewMode) => void
  systems?: SystemVisualRef[]
  activeSystemFilterId?: string | null
}

interface CameraNavState {
  target: THREE.Vector3
  currentAzimuth: number
  targetAzimuth: number
  currentTilt: number
  targetTilt: number
  currentZoom: number
  targetZoom: number
  baseFrustum: number
}

function getTiltForOrthoMode(mode: "birdseye" | "fulltop" | "3d"): number {
  return mode === "fulltop" ? FULLTOP_TILT_RAD : BIRDSEYE_TILT_RAD
}

function applyOrthoFrustum(
  cam: THREE.OrthographicCamera,
  baseFrustum: number,
  aspect: number,
  zoom: number
) {
  const safeAspect = Math.max(0.2, aspect)
  cam.left = (-baseFrustum * safeAspect) / 2
  cam.right = (baseFrustum * safeAspect) / 2
  cam.top = baseFrustum / 2
  cam.bottom = -baseFrustum / 2
  cam.zoom = zoom
  cam.updateProjectionMatrix()
}

function applyCameraPose(
  cam: THREE.OrthographicCamera,
  target: THREE.Vector3,
  azimuth: number,
  tilt: number
) {
  const sinT = Math.sin(tilt)
  const cosT = Math.cos(tilt)
  const sinA = Math.sin(azimuth)
  const cosA = Math.cos(azimuth)

  // Posiciona a câmera acima (+Z) e deslocada conforme inclinação fixa e orientação horária
  cam.position.set(
    target.x - CAMERA_DIST * sinT * sinA,
    target.y - CAMERA_DIST * sinT * cosA,
    target.z + CAMERA_DIST * cosT
  )

  // Vetor up estritamente ortogonal à direção de visão (zero gimbal lock mesmo em tilt = 0°)
  cam.up.set(cosT * sinA, cosT * cosA, sinT)
  cam.lookAt(target)
}

function normalizeAngleDeg(rad: number): number {
  const deg = Math.round(THREE.MathUtils.radToDeg(rad)) % 360
  return ((deg % 360) + 360) % 360
}

export const SpatialViewer3D = forwardRef<SpatialViewer3DHandle, SpatialViewer3DProps>(
  function SpatialViewer3D(
    {
      mode,
      objects,
      selectedId,
      selectedChannelId = null,
      readOnly = false,
      onSelect,
      onModeChange,
      systems = [],
      activeSystemFilterId = null,
    },
    ref
  ) {
    const mountRef = useRef<HTMLDivElement>(null)

    const modeRef = useRef<"birdseye" | "fulltop" | "3d">(mode)
    const prevModeRef = useRef<"birdseye" | "fulltop" | "3d">(mode)
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

    const [shadowsEnabled, setShadowsEnabled] = useState(false)
    const shadowsEnabledRef = useRef<boolean>(shadowsEnabled)
    useEffect(() => {
      shadowsEnabledRef.current = shadowsEnabled
    }, [shadowsEnabled])

    const [orientationDeg, setOrientationDeg] = useState<number>(0)
    const [itemsVersion, setItemsVersion] = useState<number>(0)
    const [webglError, setWebglError] = useState<string | null>(null)

    useEffect(() => {
      const onItemsUpdated = () => setItemsVersion((v) => v + 1)
      window.addEventListener(ITEMS_UPDATED_EVENT, onItemsUpdated)
      return () => window.removeEventListener(ITEMS_UPDATED_EVENT, onItemsUpdated)
    }, [])

    const [sideViewIsolated, setSideViewIsolated] = useState(false)
    const isSideViewActive = sideViewIsolated && Boolean(selectedId)
    const isSideViewActiveRef = useRef(isSideViewActive)
    useEffect(() => {
      isSideViewActiveRef.current = isSideViewActive
    }, [isSideViewActive])

    const wasSideViewIsolatedRef = useRef(false)
    const savedBeforeSideRef = useRef<{
      target: THREE.Vector3
      azimuth: number
      zoom: number
      baseFrustum: number
      perspPos: THREE.Vector3
      perspTarget: THREE.Vector3
    } | null>(null)

    // Estado determinístico da câmera ortográfica (Bird's-Eye & Full Top)
    const navRef = useRef<CameraNavState>({
      target: new THREE.Vector3(20, -20, 0),
      currentAzimuth: 0,
      targetAzimuth: 0,
      currentTilt: getTiltForOrthoMode(mode),
      targetTilt: getTiltForOrthoMode(mode),
      currentZoom: 1,
      targetZoom: 1,
      baseFrustum: DEFAULT_BASE_FRUSTUM,
    })

    // Refs Three.js compartilhados
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
    const hasFittedInitialRef = useRef(false)

    // Helpers pré-alocados
    const raycasterRef = useRef(new THREE.Raycaster())
    const pointerNdcRef = useRef(new THREE.Vector2())

    // ── Ações programáticas de navegação ──────────────────────────
    const rotateClockwise90 = useCallback(() => {
      if (isSideViewActiveRef.current || modeRef.current === "3d") return
      navRef.current.targetAzimuth += Math.PI / 2
      setOrientationDeg((prev) => (prev + 90) % 360)
    }, [])

    const zoomByFactor = useCallback((factor: number) => {
      if (isSideViewActiveRef.current) return
      if (modeRef.current === "3d") {
        const persp = perspCamRef.current
        const controls = controlsRef.current
        if (!persp || !controls) return
        const offset = persp.position.clone().sub(controls.target)
        const currentDist = offset.length()
        const nextDist = THREE.MathUtils.clamp(currentDist / factor, 4, 480)
        offset.normalize().multiplyScalar(nextDist)
        persp.position.copy(controls.target).add(offset)
        controls.update()
        return
      }
      const nav = navRef.current
      nav.targetZoom = THREE.MathUtils.clamp(nav.targetZoom * factor, MIN_ZOOM, MAX_ZOOM)
    }, [])

    const resetZoom = useCallback(() => {
      if (isSideViewActiveRef.current) return
      if (modeRef.current === "3d") {
        const persp = perspCamRef.current
        const controls = controlsRef.current
        if (!persp || !controls) return
        const offset = persp.position.clone().sub(controls.target).normalize().multiplyScalar(65)
        persp.position.copy(controls.target).add(offset)
        controls.update()
        return
      }
      navRef.current.targetZoom = 1
    }, [])

    const fitToScreen = useCallback(() => {
      const group = objectsGroupRef.current
      const orthoCam = orthoCamRef.current
      const perspCam = perspCamRef.current
      const controls = controlsRef.current
      const container = mountRef.current
      if (!group || !orthoCam || !perspCam || !controls || !container) return

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

      if (modeRef.current === "3d") {
        const maxDim = Math.max(size.x, size.y, size.z, 20)
        const dist = maxDim * 1.5
        controls.target.copy(center)
        perspCam.up.set(0, 0, 1)
        perspCam.position.set(
          center.x - dist * 0.3,
          center.y - dist * 1.0,
          center.z + dist * 0.75
        )
        perspCam.lookAt(center)
        controls.update()
        return
      }

      const nav = navRef.current
      nav.target.set(center.x, center.y, center.z * 0.25)
      nav.baseFrustum = DEFAULT_BASE_FRUSTUM

      const aspect =
        container.clientHeight > 0 ? container.clientWidth / container.clientHeight : 1.5
      const az = nav.targetAzimuth
      const tilt = nav.targetTilt
      const spanX = Math.max(size.x, 12)
      const spanY = Math.max(size.y, 12)
      const horzSpan = Math.abs(Math.cos(az)) * spanX + Math.abs(Math.sin(az)) * spanY
      const vertSpan =
        (Math.abs(Math.sin(az)) * spanX + Math.abs(Math.cos(az)) * spanY) *
          Math.max(0.4, Math.cos(tilt)) +
        size.z * Math.sin(tilt)

      const neededFrustumH = Math.max(vertSpan, horzSpan / Math.max(0.2, aspect)) * 1.18
      const fitZoom = THREE.MathUtils.clamp(
        DEFAULT_BASE_FRUSTUM / Math.max(4, neededFrustumH),
        MIN_ZOOM,
        MAX_ZOOM
      )

      nav.targetZoom = fitZoom
      if (!hasFittedInitialRef.current) {
        nav.currentZoom = fitZoom
        nav.currentAzimuth = nav.targetAzimuth
        nav.currentTilt = nav.targetTilt
      }

      applyOrthoFrustum(orthoCam, nav.baseFrustum, aspect, nav.currentZoom)
      applyCameraPose(orthoCam, nav.target, nav.currentAzimuth, nav.currentTilt)
    }, [])

    const navigateToObject = useCallback((obj: MapObject) => {
      const spatial = mapObjectToSpatial(obj, DEFAULT_PIXELS_PER_METER)
      const objSpan = Math.max(spatial.dimensions.width, spatial.dimensions.depth, 6)

      if (modeRef.current === "3d") {
        const persp = perspCamRef.current
        const controls = controlsRef.current
        if (!persp || !controls) return
        const dest = new THREE.Vector3(
          spatial.position.x,
          spatial.position.y,
          spatial.position.z
        )
        const dir = persp.position.clone().sub(controls.target).normalize()
        const dist = Math.max(10, objSpan * 2.2)
        controls.target.copy(dest)
        persp.position.copy(dest).addScaledVector(dir, dist)
        controls.update()
        return
      }

      const nav = navRef.current
      nav.target.set(spatial.position.x, spatial.position.y, spatial.position.z)
      nav.targetZoom = THREE.MathUtils.clamp(
        DEFAULT_BASE_FRUSTUM / (objSpan * 2.2),
        MIN_ZOOM,
        MAX_ZOOM
      )
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        fitToScreen,
        zoomIn: () => zoomByFactor(1.25),
        zoomOut: () => zoomByFactor(0.8),
        resetZoom,
        rotateClockwise90,
        navigateToObject,
      }),
      [fitToScreen, zoomByFactor, resetZoom, rotateClockwise90, navigateToObject]
    )

    // ── 1. INICIALIZAÇÃO ÚNICA DA CENA THREE.JS ──────────────────
    useEffect(() => {
      const container = mountRef.current
      if (!container) return

      const width = container.clientWidth || 800
      const height = container.clientHeight || 600
      const aspect = width / height

      const initialBg = readOnlyRef.current ? "#0b1120" : "#070a13"
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(initialBg)
      scene.fog = new THREE.FogExp2(initialBg, 0.0018)
      sceneRef.current = scene

      THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

      let renderer: THREE.WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({
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
      } catch (err) {
        console.error("Falha ao inicializar WebGL no SpatialViewer3D:", err)
        setWebglError("Não foi possível iniciar o renderizador 3D (WebGL indisponível neste navegador).")
        return
      }

      // Iluminação preservada (estúdio/galpão Z-up)
      const ambientLight = new THREE.AmbientLight("#f8fafc", readOnlyRef.current ? 0.9 : 0.75)
      scene.add(ambientLight)
      ambientLightRef.current = ambientLight

      const hemiLight = new THREE.HemisphereLight(
        "#f1f5f9",
        "#334155",
        readOnlyRef.current ? 1.15 : 0.95
      )
      hemiLight.position.set(0, 0, 1)
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

      // Grupo único de objetos do galpão compartilhado por todos os modos
      const objectsGroup = new THREE.Group()
      objectsGroup.name = "map_objects_group"
      scene.add(objectsGroup)
      objectsGroupRef.current = objectsGroup

      // Câmera 1: Ortográfica Determinística (Bird's-Eye 3D & Full Top)
      const nav = navRef.current
      const orthoCam = new THREE.OrthographicCamera(
        (-nav.baseFrustum * aspect) / 2,
        (nav.baseFrustum * aspect) / 2,
        nav.baseFrustum / 2,
        -nav.baseFrustum / 2,
        -500,
        1200
      )
      orthoCamRef.current = orthoCam
      applyOrthoFrustum(orthoCam, nav.baseFrustum, aspect, nav.currentZoom)
      applyCameraPose(orthoCam, nav.target, nav.currentAzimuth, nav.currentTilt)

      // Câmera 2: Perspectiva com OrbitControls (somente quando mode === "3d")
      const perspCam = new THREE.PerspectiveCamera(50, aspect, 0.5, 1200)
      perspCam.up.set(0, 0, 1)
      perspCam.position.set(20, -65, 45)
      perspCamRef.current = perspCam

      const controls = new OrbitControls(perspCam, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.enableRotate = true
      controls.enablePan = true
      controls.enableZoom = true
      controls.maxPolarAngle = Math.PI / 2 - 0.01
      controls.minDistance = 2
      controls.maxDistance = 500
      controls.target.set(20, -20, 0)
      controls.enabled = modeRef.current === "3d"
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

      // Loop de renderização unificado
      const clock = new THREE.Clock()
      const animate = () => {
        animFrameIdRef.current = requestAnimationFrame(animate)

        const dt = Math.min(clock.getDelta(), 0.1)
        const r = rendererRef.current
        const s = sceneRef.current
        if (!r || !s) return

        if (modeRef.current === "3d") {
          const persp = perspCamRef.current
          const ctrl = controlsRef.current
          if (!persp || !ctrl) return
          ctrl.update()
          r.render(s, persp)
          return
        }

        const cam = orthoCamRef.current
        if (!cam) return

        if (!isSideViewActiveRef.current) {
          const n = navRef.current
          let needsFrustumUpdate = false

          if (Math.abs(n.targetAzimuth - n.currentAzimuth) > 0.0002) {
            n.currentAzimuth = THREE.MathUtils.damp(
              n.currentAzimuth,
              n.targetAzimuth,
              DAMP_SPEED,
              dt
            )
          } else {
            n.currentAzimuth = n.targetAzimuth
          }

          if (Math.abs(n.targetTilt - n.currentTilt) > 0.0002) {
            n.currentTilt = THREE.MathUtils.damp(n.currentTilt, n.targetTilt, DAMP_SPEED, dt)
          } else {
            n.currentTilt = n.targetTilt
          }

          if (Math.abs(n.targetZoom - n.currentZoom) > 0.0005) {
            n.currentZoom = THREE.MathUtils.damp(n.currentZoom, n.targetZoom, DAMP_SPEED + 3, dt)
            needsFrustumUpdate = true
          } else if (n.currentZoom !== n.targetZoom) {
            n.currentZoom = n.targetZoom
            needsFrustumUpdate = true
          }

          if (needsFrustumUpdate) {
            cam.zoom = n.currentZoom
            cam.updateProjectionMatrix()
          }

          applyCameraPose(cam, n.target, n.currentAzimuth, n.currentTilt)
        }

        r.render(s, cam)
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
          const n = navRef.current
          applyOrthoFrustum(orthoCamRef.current, n.baseFrustum, asp, n.currentZoom)
        }

        rendererRef.current.setSize(w, h)
      }

      const resizeObserver = new ResizeObserver(handleResize)
      resizeObserver.observe(container)

      return () => {
        resizeObserver.disconnect()
        if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current)
        controls.dispose()
        channelHighlightGeo.dispose()
        channelHighlightMat.dispose()
        renderer.dispose()
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
      }
    }, [])

    // ── 2. SINCRONIZAÇÃO DE TRANSIÇÃO ENTRE MODOS PRESERVANDO NAVEGAÇÃO ──
    useEffect(() => {
      const prevMode = prevModeRef.current
      prevModeRef.current = mode

      const controls = controlsRef.current
      const perspCam = perspCamRef.current
      const orthoCam = orthoCamRef.current
      if (!controls || !perspCam || !orthoCam) return

      const nav = navRef.current

      if (mode === "3d") {
        controls.enabled = true
        controls.enableRotate = true

        // Herda alvo e enquadramento da câmera ortográfica ao entrar no 3D Livre
        controls.target.copy(nav.target)
        const visibleH = (orthoCam.top - orthoCam.bottom) / Math.max(0.2, nav.currentZoom)
        const halfFov = THREE.MathUtils.degToRad(perspCam.fov / 2)
        const dist = THREE.MathUtils.clamp(visibleH / (2 * Math.tan(halfFov)), 14, 240)
        const tilt = prevMode === "fulltop" ? THREE.MathUtils.degToRad(35) : Math.max(nav.currentTilt, THREE.MathUtils.degToRad(30))
        const az = nav.currentAzimuth

        perspCam.up.set(0, 0, 1)
        perspCam.position.set(
          nav.target.x - dist * Math.sin(tilt) * Math.sin(az),
          nav.target.y - dist * Math.sin(tilt) * Math.cos(az),
          nav.target.z + dist * Math.cos(tilt)
        )
        perspCam.lookAt(controls.target)
        controls.update()
        return
      }

      // Bird's-Eye 3D ou Full Top: bloqueia OrbitControls e ativa câmera ortográfica determinística
      controls.enabled = false

      if (prevMode === "3d") {
        // Retorna do 3D Livre preservando alvo central, escala aproximada e orientação 90° mais próxima
        nav.target.copy(controls.target)
        const offset = perspCam.position.clone().sub(controls.target)
        const dist = Math.max(10, offset.length())
        const halfFov = THREE.MathUtils.degToRad(perspCam.fov / 2)
        const visibleH = 2 * dist * Math.tan(halfFov)
        const mappedZoom = THREE.MathUtils.clamp(
          nav.baseFrustum / Math.max(4, visibleH),
          MIN_ZOOM,
          MAX_ZOOM
        )
        nav.currentZoom = mappedZoom
        nav.targetZoom = mappedZoom

        // Arredonda azimute para o múltiplo de 90° mais próximo
        const rawAz = Math.atan2(-offset.x, -offset.y)
        const snappedAz = Math.round(rawAz / (Math.PI / 2)) * (Math.PI / 2)
        nav.currentAzimuth = rawAz
        nav.targetAzimuth = snappedAz
        setOrientationDeg(normalizeAngleDeg(snappedAz))

        const horizDist = Math.hypot(offset.x, offset.y)
        nav.currentTilt = Math.atan2(horizDist, Math.max(0.01, offset.z))
      }

      nav.targetTilt = getTiltForOrthoMode(mode)
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
        sceneRef.current.fog = new THREE.FogExp2(bg, 0.0018)
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

    // ── 3. RENDERIZAÇÃO DOS OBJETOS NA CENA COMPARTILHADA ──────────
    useEffect(() => {
      const group = objectsGroupRef.current
      if (!group) return
      void itemsVersion

      const disposedGeos = new Set<THREE.BufferGeometry>()
      group.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          if (child.geometry && !disposedGeos.has(child.geometry)) {
            disposedGeos.add(child.geometry)
            child.geometry.dispose()
          }
        }
      })

      while (group.children.length > 0) {
        group.remove(group.children[0])
      }

      objects.forEach((obj) => {
        if (obj.visible === false) return
        if (
          readOnly &&
          (obj.type === "coordinates" ||
            obj.type === "dimension_line" ||
            obj.type === "pallet" ||
            obj.type === "box")
        )
          return
        const spatial = mapObjectToSpatial(obj, DEFAULT_PIXELS_PER_METER)
        const mesh3D = buildSpatial3DObject(spatial, readOnly, { systems, activeSystemFilterId })
        group.add(mesh3D)
      })
    }, [objects, readOnly, itemsVersion, systems, activeSystemFilterId])

    // Enquadramento automático SOMENTE na primeira carga dos objetos (preserva estado ao alternar modos)
    useEffect(() => {
      if (objects.length > 0 && !hasFittedInitialRef.current) {
        const t = setTimeout(() => {
          fitToScreen()
          hasFittedInitialRef.current = true
        }, 100)
        return () => clearTimeout(t)
      }
    }, [objects.length, fitToScreen])

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
    }, [selectedId, selectedChannelId, objects, isSideViewActive, itemsVersion])

    // ── 4b. MODO VISTA LATERAL ISOLADA (oculta demais objetos) ────
    useEffect(() => {
      const group = objectsGroupRef.current
      const ortho = orthoCamRef.current
      const persp = perspCamRef.current
      const controls = controlsRef.current
      if (!group || !ortho || !persp || !controls) return

      if (isSideViewActive && selectedId) {
        const selectedMesh = group.getObjectByName(selectedId)
        if (!selectedMesh) return

        if (!wasSideViewIsolatedRef.current) {
          const nav = navRef.current
          savedBeforeSideRef.current = {
            target: nav.target.clone(),
            azimuth: nav.targetAzimuth,
            zoom: nav.targetZoom,
            baseFrustum: nav.baseFrustum,
            perspPos: persp.position.clone(),
            perspTarget: controls.target.clone(),
          }
          wasSideViewIsolatedRef.current = true
        }

        if (gridHelperRef.current) {
          gridHelperRef.current.visible = false
        }

        group.children.forEach((child) => {
          child.visible = child.name === selectedId
        })

        let targetLaneObj: THREE.Object3D | null = null
        if (selectedChannelId) {
          selectedMesh.traverse((c) => {
            if (
              !targetLaneObj &&
              c.userData &&
              (c.userData.channelId === selectedChannelId ||
                c.userData.channelCode === selectedChannelId)
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

        const isoBox = new THREE.Box3()
        selectedMesh.traverse((c) => {
          if (c instanceof THREE.Mesh && c.visible) {
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

        const rotZ = selectedMesh.rotation.z
        const sideDir = new THREE.Vector3(Math.cos(rotZ), Math.sin(rotZ), 0)
        const maxSpan = Math.max(size.x, size.y, size.z, 2.5)
        const dist = maxSpan * 1.65

        if (modeRef.current === "3d") {
          controls.target.copy(center)
          persp.up.set(0, 0, 1)
          persp.position
            .copy(center)
            .addScaledVector(sideDir, dist)
            .add(new THREE.Vector3(0, 0, dist * 0.06))
          persp.lookAt(center)
          controls.update()
        } else {
          const container = mountRef.current
          const aspect =
            container && container.clientHeight > 0
              ? container.clientWidth / container.clientHeight
              : 1.5
          const fs = Math.max(size.y, size.z, size.x, 3) * 1.35

          applyOrthoFrustum(ortho, fs, aspect, 1)
          ortho.up.set(0, 0, 1)
          ortho.position
            .copy(center)
            .addScaledVector(sideDir, dist)
            .add(new THREE.Vector3(0, 0, dist * 0.04))
          ortho.lookAt(center)
        }
      } else {
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
          const saved = savedBeforeSideRef.current
          savedBeforeSideRef.current = null
          if (saved) {
            if (modeRef.current === "3d") {
              persp.up.set(0, 0, 1)
              persp.position.copy(saved.perspPos)
              controls.target.copy(saved.perspTarget)
              persp.lookAt(saved.perspTarget)
              controls.update()
            } else {
              const nav = navRef.current
              nav.target.copy(saved.target)
              nav.currentAzimuth = saved.azimuth
              nav.targetAzimuth = saved.azimuth
              nav.currentZoom = saved.zoom
              nav.targetZoom = saved.zoom
              nav.baseFrustum = saved.baseFrustum
              const desiredTilt = getTiltForOrthoMode(modeRef.current)
              nav.currentTilt = desiredTilt
              nav.targetTilt = desiredTilt

              const container = mountRef.current
              const aspect =
                container && container.clientHeight > 0
                  ? container.clientWidth / container.clientHeight
                  : 1.5
              applyOrthoFrustum(ortho, nav.baseFrustum, aspect, nav.currentZoom)
              applyCameraPose(ortho, nav.target, nav.currentAzimuth, nav.currentTilt)
            }
          }
        }
      }
    }, [isSideViewActive, selectedId, selectedChannelId, objects, readOnly, mode, itemsVersion])

    // ── 5. CONTROLES DETERMINÍSTICOS (BIRD'S-EYE / FULL TOP) + SELEÇÃO RAYCASTER ──
    useEffect(() => {
      const renderer = rendererRef.current
      if (!renderer) return
      const dom = renderer.domElement

      let leftClickStart = { x: 0, y: 0 }
      let isRightPanning = false
      let lastPanPos = { x: 0, y: 0 }

      const onMouseDown = (e: MouseEvent) => {
        if (e.button === 0) {
          leftClickStart = { x: e.clientX, y: e.clientY }
        } else if (e.button === 2) {
          if (modeRef.current === "3d") return
          e.preventDefault()
          isRightPanning = true
          lastPanPos = { x: e.clientX, y: e.clientY }
          dom.style.cursor = "grabbing"
        }
      }

      const onMouseMove = (e: MouseEvent) => {
        if (modeRef.current === "3d") return
        if (!isRightPanning || isSideViewActiveRef.current) return
        const ortho = orthoCamRef.current
        if (!ortho) return

        const dx = e.clientX - lastPanPos.x
        const dy = e.clientY - lastPanPos.y
        lastPanPos = { x: e.clientX, y: e.clientY }

        const w = dom.clientWidth || 1
        const h = dom.clientHeight || 1
        const nav = navRef.current
        const visibleW = (ortho.right - ortho.left) / nav.currentZoom
        const visibleH = (ortho.top - ortho.bottom) / nav.currentZoom
        const worldPerPixelX = visibleW / w
        const worldPerPixelY = visibleH / h

        const az = nav.currentAzimuth
        const tilt = nav.currentTilt
        const cosA = Math.cos(az)
        const sinA = Math.sin(az)
        const cosT = Math.max(0.25, Math.cos(tilt))

        nav.target.x -= cosA * dx * worldPerPixelX
        nav.target.y -= -sinA * dx * worldPerPixelX

        const floorStepY = (dy * worldPerPixelY) / cosT
        nav.target.x += sinA * floorStepY
        nav.target.y += cosA * floorStepY
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
              foundChannelCode = curr.userData.channelCode
                ? String(curr.userData.channelCode)
                : null
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

      const onMouseUp = (e: MouseEvent) => {
        if (e.button === 2) {
          isRightPanning = false
          dom.style.cursor = ""
          return
        }

        if (e.button !== 0) return
        const dist = Math.hypot(e.clientX - leftClickStart.x, e.clientY - leftClickStart.y)
        if (dist > 5) return

        const activeCam =
          modeRef.current === "3d" ? perspCamRef.current : orthoCamRef.current
        const group = objectsGroupRef.current
        if (!activeCam || !group) return

        const rect = dom.getBoundingClientRect()
        pointerNdcRef.current.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        )

        const raycaster = raycasterRef.current
        raycaster.setFromCamera(pointerNdcRef.current, activeCam)

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

          if (readOnlyRef.current && foundIsArea && selectedIdRef.current) {
            setSideViewIsolated(false)
            onSelectRef.current(null, null)
            return
          }

          const curId = selectedIdRef.current
          const curChan = selectedChannelIdRef.current
          const isSameObject = foundId === curId
          const isSameChannel = foundChannelId
            ? curChan === foundChannelId ||
              (foundChannelCode !== null && curChan === foundChannelCode)
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

      const onWheel = (e: WheelEvent) => {
        if (modeRef.current === "3d") return
        e.preventDefault()
        if (isSideViewActiveRef.current) return
        const ortho = orthoCamRef.current
        if (!ortho) return

        const nav = navRef.current
        const prevZoom = nav.targetZoom
        const zoomFactor = e.deltaY < 0 ? 1.14 : 0.875
        const nextZoom = THREE.MathUtils.clamp(prevZoom * zoomFactor, MIN_ZOOM, MAX_ZOOM)
        if (Math.abs(nextZoom - prevZoom) < 0.0001) return

        const rect = dom.getBoundingClientRect()
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1

        const visW = (ortho.right - ortho.left) / prevZoom
        const visH = (ortho.top - ortho.bottom) / prevZoom
        const rightOff = ndcX * (visW / 2)
        const upOff = ndcY * (visH / 2)

        const az = nav.currentAzimuth
        const tilt = nav.currentTilt
        const cosA = Math.cos(az)
        const sinA = Math.sin(az)
        const cosT = Math.max(0.25, Math.cos(tilt))

        const groundOffX = cosA * rightOff + sinA * (upOff / cosT)
        const groundOffY = -sinA * rightOff + cosA * (upOff / cosT)
        const ratio = 1 - prevZoom / nextZoom

        nav.target.x += groundOffX * ratio
        nav.target.y += groundOffY * ratio
        nav.targetZoom = nextZoom
      }

      const onContextMenu = (e: MouseEvent) => {
        e.preventDefault()
      }

      const onKeyDown = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement | null)?.tagName
        if (tag && ["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return
        if ((e.target as HTMLElement | null)?.isContentEditable) return

        if (e.key === "Escape") {
          setSideViewIsolated(false)
          if (selectedIdRef.current) {
            onSelectRef.current(null, null)
          }
          return
        }

        if (
          modeRef.current !== "3d" &&
          (e.key === "r" || e.key === "R") &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey
        ) {
          e.preventDefault()
          rotateClockwise90()
        }
      }

      dom.addEventListener("mousedown", onMouseDown)
      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("mouseup", onMouseUp)
      dom.addEventListener("wheel", onWheel, { passive: false })
      dom.addEventListener("contextmenu", onContextMenu)
      window.addEventListener("keydown", onKeyDown)

      return () => {
        dom.removeEventListener("mousedown", onMouseDown)
        window.removeEventListener("mousemove", onMouseMove)
        window.removeEventListener("mouseup", onMouseUp)
        dom.removeEventListener("wheel", onWheel)
        dom.removeEventListener("contextmenu", onContextMenu)
        window.removeEventListener("keydown", onKeyDown)
      }
    }, [rotateClockwise90])

    return (
      <div className="flex-1 h-full w-full bg-slate-950 relative overflow-hidden select-none">
        {/* Canvas WebGL Three.js */}
        <div
          ref={mountRef}
          className={`w-full h-full ${
            mode === "3d" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          }`}
        />

        {webglError && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 text-slate-300 p-6 text-center gap-2">
            <span className="text-2xl">🧊</span>
            <p className="text-sm font-semibold text-amber-300">{webglError}</p>
            <p className="text-xs text-slate-400">
              Você pode alternar para o Editor 2D na barra superior para continuar operando normalmente.
            </p>
          </div>
        )}

        {/* ── HUD Flutuante de Câmera & Controles ─────────────────── */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-auto">
          {/* Dica de interação */}
          <div className="bg-slate-900/95 border border-slate-800 text-[11px] text-slate-300 px-3 py-1.5 rounded-xl shadow-2xl flex items-center gap-2.5">
            {mode === "birdseye" ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>
                  <strong>Bird&apos;s-Eye 3D (20°):</strong> Ortográfica ·{" "}
                  <kbd className="bg-slate-800 px-1 rounded text-slate-200">R</kbd> Girar 90° ·{" "}
                  <kbd className="bg-slate-800 px-1 rounded text-slate-200">Botão Direito</kbd> Pan ·{" "}
                  <kbd className="bg-slate-800 px-1 rounded text-slate-200">Scroll</kbd> Zoom
                </span>
              </>
            ) : mode === "fulltop" ? (
              <>
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                <span>
                  <strong>Full Top (90°):</strong> Ortográfica ·{" "}
                  <kbd className="bg-slate-800 px-1 rounded text-slate-200">R</kbd> Girar 90° ·{" "}
                  <kbd className="bg-slate-800 px-1 rounded text-slate-200">Botão Direito</kbd> Pan ·{" "}
                  <kbd className="bg-slate-800 px-1 rounded text-slate-200">Scroll</kbd> Zoom
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                <span>
                  <strong>Modo 3D Livre:</strong> Câmera Perspectiva ·{" "}
                  <kbd className="bg-slate-800 px-1 rounded text-slate-200">Arrastar</kbd> Girar 360° ·{" "}
                  <kbd className="bg-slate-800 px-1 rounded text-slate-200">Botão Direito</kbd> Pan ·{" "}
                  <kbd className="bg-slate-800 px-1 rounded text-slate-200">Scroll</kbd> Zoom
                </span>
              </>
            )}
          </div>

          {/* Barra de Ações Rápidas de Câmera */}
          <div className="flex items-center gap-1.5 bg-slate-900/95 p-1.5 rounded-2xl border border-slate-800 shadow-2xl flex-wrap justify-end">
            {/* Alternador Rápido: exibido apenas no Modo Editor (no Visualizador fica dentro do botão da Câmera) */}
            {!readOnly && onModeChange && (
              <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800 gap-0.5">
                <button
                  onClick={() => {
                    setSideViewIsolated(false)
                    onModeChange("birdseye")
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    mode === "birdseye"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Bird's-Eye 3D (Padrão) — Visão superior ortográfica com inclinação fixa de 20°"
                >
                  <span>🦅</span>
                  <span>Bird&apos;s-Eye 3D</span>
                </button>
                <button
                  onClick={() => {
                    setSideViewIsolated(false)
                    onModeChange("fulltop")
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    mode === "fulltop"
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Full Top — Visão ortográfica estritamente vertical a 90°"
                >
                  <span>🗺️</span>
                  <span>Full Top</span>
                </button>
                <button
                  onClick={() => {
                    setSideViewIsolated(false)
                    onModeChange("3d")
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    mode === "3d"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="3D Livre — Câmera Perspectiva com movimentação orbital 360°"
                >
                  <span>🌐</span>
                  <span>3D Livre</span>
                </button>
              </div>
            )}

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

            {/* Controle específico do modo ativo */}
            {mode !== "3d" ? (
              <button
                onClick={rotateClockwise90}
                disabled={isSideViewActive}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 hover:text-white text-xs font-bold transition-colors border border-slate-700/70"
                title="Girar câmera 90° no sentido horário (Tecla R)"
              >
                <span>↻</span>
                <span>90°</span>
                <span className="font-mono text-[10px] text-emerald-300 bg-slate-950 px-1.5 py-0.5 rounded">
                  {orientationDeg}°
                </span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    const persp = perspCamRef.current
                    const controls = controlsRef.current
                    if (!persp || !controls) return
                    const t = controls.target
                    persp.up.set(0, 0, 1)
                    persp.position.set(t.x, t.y - 0.01, t.z + 90)
                    persp.lookAt(t)
                    controls.update()
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
                  title="Vista Superior no 3D Livre"
                >
                  Topo
                </button>
                <button
                  onClick={() => {
                    const persp = perspCamRef.current
                    const controls = controlsRef.current
                    if (!persp || !controls) return
                    const t = controls.target
                    persp.up.set(0, 0, 1)
                    persp.position.set(t.x, t.y - 80, t.z + 12)
                    persp.lookAt(t)
                    controls.update()
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
                  title="Vista Frontal no 3D Livre"
                >
                  Frente
                </button>
              </>
            )}

            {/* Enquadrar Tudo — no Visualizador fica oculto dentro do menu ⋮ */}
            {!readOnly && (
              <button
                onClick={() => {
                  setSideViewIsolated(false)
                  fitToScreen()
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/80 hover:bg-blue-900 text-blue-300 hover:text-white text-xs font-bold transition-all border border-blue-800/50"
                title="Enquadrar todas as estruturas na tela"
              >
                <span>🎯</span>
                <span>Enquadrar</span>
              </button>
            )}

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
              <span
                className={`h-2 w-2 rounded-full ${shadowsEnabled ? "bg-amber-400" : "bg-slate-500"}`}
              />
              <span>{shadowsEnabled ? "Sombras On" : "Sombras Off"}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }
)
