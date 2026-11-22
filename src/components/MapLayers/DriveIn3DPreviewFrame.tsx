// =============================================================================
// NEXUS ERP — MapLayers / DriveIn3DPreviewFrame.tsx
// Miniatura 3D isolada apenas do canal selecionado em rotação suave
// =============================================================================

"use client"

import React, { useEffect, useRef } from "react"
import * as THREE from "three"
import type { MapObject } from "../MapLibrary/types"
import { mapObjectToSpatial, DEFAULT_PIXELS_PER_METER } from "../Map3D/spatialAdapter"
import { buildSpatial3DObject } from "../Map3D/geometryCatalog"

interface DriveIn3DPreviewFrameProps {
  object: MapObject
  channelId?: string | null
  channelLabel?: string | null
}

function isVisibleInHierarchy(obj: THREE.Object3D, root: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = obj
  while (cur && cur !== root) {
    if (!cur.visible) return false
    cur = cur.parent
  }
  return true
}

export default function DriveIn3DPreviewFrame({
  object,
  channelId,
  channelLabel,
}: DriveIn3DPreviewFrameProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = Math.max(160, container.clientWidth || 240)
    const height = Math.max(130, container.clientHeight || 190)

    THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#090f1d")

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.28
    container.appendChild(renderer.domElement)

    // Iluminação de estúdio Z-up
    const ambient = new THREE.AmbientLight("#f8fafc", 1.0)
    scene.add(ambient)

    const hemi = new THREE.HemisphereLight("#f1f5f9", "#334155", 1.1)
    hemi.position.set(0, 0, 1)
    scene.add(hemi)

    const keyLight = new THREE.DirectionalLight("#fffaf0", 1.85)
    keyLight.position.set(18, -22, 28)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight("#bae6fd", 0.95)
    fillLight.position.set(-18, 16, 20)
    scene.add(fillLight)

    // Pivô giratório centrado exatamente no canal isolado
    const turntablePivot = new THREE.Group()
    scene.add(turntablePivot)

    const spatial = mapObjectToSpatial(object, DEFAULT_PIXELS_PER_METER)
    const structureGroup = buildSpatial3DObject(spatial, true)
    structureGroup.position.set(0, 0, 0)
    structureGroup.rotation.set(0, 0, 0)
    turntablePivot.add(structureGroup)

    // Isola APENAS o canal selecionado e suas colunas laterais (oculta o restante do Drive-In)
    let targetLane: THREE.Object3D | null = null
    if (channelId) {
      structureGroup.traverse((child) => {
        if (
          !targetLane &&
          child.userData &&
          (child.userData.channelId === channelId || child.userData.channelCode === channelId)
        ) {
          targetLane = child
        }
      })
    } else {
      structureGroup.traverse((child) => {
        if (!targetLane && child.userData?.channelId) {
          targetLane = child
        }
      })
    }

    if (targetLane) {
      const laneData = (targetLane as THREE.Object3D).userData
      const activeChanId = laneData.channelId
      const activeLaneIdx = Number(laneData.laneIndex)
      const laneCenterX = Number(laneData.laneCenterX) || 0

      structureGroup.children.forEach((child) => {
        if (child.userData?.channelId) {
          child.visible = child.userData.channelId === activeChanId
        } else if (typeof child.userData?.columnLineIndex === "number") {
          const colIdx = child.userData.columnLineIndex
          child.visible = colIdx === activeLaneIdx || colIdx === activeLaneIdx + 1
        } else {
          child.visible = false
        }
      })

      // Centraliza o canal isolado exatamente no eixo X=0 do pivô de rotação
      structureGroup.position.x = -laneCenterX
    }

    const localDisposables: Array<{ dispose: () => void }> = []

    // Medição apenas das malhas visíveis do canal isolado
    structureGroup.updateWorldMatrix(true, true)
    const box = new THREE.Box3()
    structureGroup.traverse((c) => {
      if (c instanceof THREE.Mesh && isVisibleInHierarchy(c, structureGroup)) {
        if (c.material instanceof THREE.MeshBasicMaterial && c.material.opacity === 0) return
        box.expandByObject(c)
      }
    })
    if (box.isEmpty()) {
      box.set(new THREE.Vector3(-0.8, -2, 0), new THREE.Vector3(0.8, 2, 4))
    }

    const boxSize = new THREE.Vector3()
    const boxCenter = new THREE.Vector3()
    box.getSize(boxSize)
    box.getCenter(boxCenter)

    const radius = Math.max(boxSize.length() / 2, 1.4)

    // Disco de piso sutil sob o canal isolado
    const baseGeo = new THREE.CircleGeometry(radius * 1.1, 48)
    const baseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0f172a"),
      roughness: 0.9,
      metalness: 0.1,
    })
    const baseDisc = new THREE.Mesh(baseGeo, baseMat)
    baseDisc.position.set(0, 0, -0.02)
    turntablePivot.add(baseDisc)
    localDisposables.push(baseGeo, baseMat)

    const ringGeo = new THREE.RingGeometry(radius * 1.07, radius * 1.1, 48)
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#38bdf8"),
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    })
    const ringMesh = new THREE.Mesh(ringGeo, ringMat)
    ringMesh.position.set(0, 0, -0.01)
    turntablePivot.add(ringMesh)
    localDisposables.push(ringGeo, ringMat)

    // Câmera Perspectiva enquadrando apenas o canal com leve elevação
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.2, 400)
    camera.up.set(0, 0, 1)

    const fitDistance = (asp: number) => {
      const fovRad = THREE.MathUtils.degToRad(camera.fov)
      const hFov = 2 * Math.atan(Math.tan(fovRad / 2) * Math.max(0.4, asp))
      const limitingHalfFov = Math.min(fovRad / 2, hFov / 2)
      const dist = (radius / Math.sin(limitingHalfFov)) * 1.12
      const lookCenter = new THREE.Vector3(0, 0, boxCenter.z * 0.92)
      camera.position.set(0, -dist * 0.9, lookCenter.z + dist * 0.42)
      camera.lookAt(lookCenter)
    }
    fitDistance(width / height)

    // Rotação contínua suave + arraste manual opcional
    let isDragging = false
    let lastX = 0
    const onPointerDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      isDragging = true
      lastX = e.clientX
    }
    const onPointerMove = (e: MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      turntablePivot.rotation.z += dx * 0.012
    }
    const onPointerUp = () => {
      isDragging = false
    }

    const dom = renderer.domElement
    dom.addEventListener("mousedown", onPointerDown)
    window.addEventListener("mousemove", onPointerMove)
    window.addEventListener("mouseup", onPointerUp)

    const clock = new THREE.Clock()
    let frameId = 0
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.1)
      if (!isDragging) {
        turntablePivot.rotation.z += dt * 0.45
      }
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w <= 0 || h <= 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      fitDistance(w / h)
      renderer.setSize(w, h)
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(frameId)
      dom.removeEventListener("mousedown", onPointerDown)
      window.removeEventListener("mousemove", onPointerMove)
      window.removeEventListener("mouseup", onPointerUp)
      localDisposables.forEach((d) => d.dispose())
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [object, channelId])

  return (
    <div className="flex-1 min-h-[160px] rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col overflow-hidden shadow-inner">
      <div className="px-2.5 py-1.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <span>🧊</span>
          <span>Canal 3D no Plano</span>
        </span>
        {channelLabel && (
          <span className="text-[9px] font-mono font-bold text-sky-400 truncate max-w-[120px]">
            {channelLabel}
          </span>
        )}
      </div>
      <div
        ref={mountRef}
        className="flex-1 min-h-0 w-full cursor-grab active:cursor-grabbing"
        title="Prévia 3D isolada do canal em rotação suave (arraste para girar manualmente)"
      />
    </div>
  )
}
