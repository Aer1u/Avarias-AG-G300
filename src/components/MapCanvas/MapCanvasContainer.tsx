// ============================================================
// NEXUS ERP — MapCanvas / MapCanvasContainer.tsx
// Motor de renderização e interatividade com Konva.js
// ── Suporte a:
//    • Pan livre com Espaço + Mouse, Botão do Meio, Botão Direito ou clique no vazio
//    • Zoom inteligente centrado no ponteiro do mouse
//    • Enquadramento automático (fitToScreen) com cálculo de bounding box
//    • HUD flutuante de navegação rápida
//    • Redimensionamento interativo com alças do Transformer e bloqueio de proporção
//    • Sincronização em tempo real de dimensões físicas e pixels
// ============================================================

"use client"

import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, useState } from "react"
import Konva from "konva"
import type { MapObject } from "../MapLibrary/types"
import { ELEMENT_BY_TYPE } from "../MapLibrary/registry"
import { INITIAL_AREA_CLASSIFICATIONS } from "../MapLibrary/areaClassifier"
import { pixelsToReal, ensurePhysicalDimensions } from "../MapLibrary/unitConverter"
import { FLOOR_SURFACES, type FloorMaterialType } from "../MapLibrary/floorSurfaces"
import { ensureDriveChannels } from "../MapLibrary/spatialContainment"

export interface MapCanvasHandle {
  navigateTo: (obj: MapObject) => void
  fitToScreen: () => void
}

interface MapCanvasContainerProps {
  objects: MapObject[]
  selectedId: string | null
  selectedChannelId?: string | null
  snapEnabled: boolean
  gridSize: number
  zoom: number
  tool: "select" | "pan" | "draw_area" | "draw_floor"
  readOnly?: boolean
  onToolChange?: (tool: "select" | "pan" | "draw_area" | "draw_floor") => void
  onSelect: (id: string | null, channelId?: string | null) => void
  onUpdateObject: (id: string, partial: Partial<MapObject>) => void
  onZoomChange: (newZoom: number) => void
  onAddObject?: (obj: MapObject) => void
}

function getAreaFill(classification?: string, readOnly: boolean = false): { fill: string; stroke: string } {
  if (readOnly) {
    if (classification === "grama") return { fill: "rgba(22, 163, 74, 0.78)", stroke: "#4ade80" }
    if (classification === "asfalto") return { fill: "rgba(39, 39, 42, 0.94)", stroke: "#71717a" }
    if (classification === "piso_geral") return { fill: "rgba(71, 85, 105, 0.72)", stroke: "#94a3b8" }
    if (classification === "area_avarias") return { fill: "rgba(245, 158, 11, 0.28)", stroke: "#fbbf24" }
    if (classification === "rua") return { fill: "rgba(51, 65, 85, 0.85)", stroke: "#facc15" }
    if (classification === "circulacao") return { fill: "rgba(14, 165, 233, 0.26)", stroke: "#38bdf8" }
    if (classification === "bloco") return { fill: "rgba(99, 102, 241, 0.26)", stroke: "#818cf8" }
    if (classification === "picking") return { fill: "rgba(16, 185, 129, 0.28)", stroke: "#34d399" }
    if (classification === "quarentena") return { fill: "rgba(239, 68, 68, 0.30)", stroke: "#f87171" }
    if (classification === "expedicao") return { fill: "rgba(139, 92, 246, 0.28)", stroke: "#a78bfa" }
    const cls = INITIAL_AREA_CLASSIFICATIONS.find((c) => c.id === classification)
    if (cls) return { fill: boostRgbaColor(cls.color, 0.28), stroke: cls.borderColor }
    return { fill: "rgba(99, 102, 241, 0.28)", stroke: "#818cf8" }
  }
  if (classification === "grama") return { fill: "rgba(22, 101, 52, 0.65)", stroke: "#22c55e" }
  if (classification === "asfalto") return { fill: "rgba(15, 23, 42, 0.85)", stroke: "#334155" }
  const cls = INITIAL_AREA_CLASSIFICATIONS.find((c) => c.id === classification)
  if (cls) return { fill: cls.color, stroke: cls.borderColor }
  return { fill: "rgba(99,102,241,0.10)", stroke: "#6366f1" }
}

function boostRgbaColor(colorStr: string, minAlpha: number): string {
  const m = colorStr.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i)
  if (!m) return colorStr
  const r = Number(m[1])
  const g = Number(m[2])
  const b = Number(m[3])
  const a = m[4] !== undefined ? Number(m[4]) : 1
  const nextAlpha = Math.max(minAlpha, Math.min(0.88, a < minAlpha ? Math.max(minAlpha, a * 2.4) : a))
  return `rgba(${r}, ${g}, ${b}, ${nextAlpha.toFixed(2)})`
}

function resolveViewerAreaFill(
  objColor: string | undefined,
  fallbackFill: string,
  readOnly: boolean,
  isDarkBaseSlate: boolean
): string {
  if (!readOnly) return objColor || fallbackFill
  if (!objColor) return fallbackFill
  const norm = objColor.replace(/\s+/g, "").toLowerCase()
  // Pisos salvos com slate muito escuro/apagado ganham o tom rico do visualizador
  if (
    isDarkBaseSlate &&
    (norm.startsWith("rgba(30,41,59") ||
      norm.startsWith("rgba(15,23,42") ||
      norm === "#0f172a" ||
      norm === "#1e293b")
  ) {
    return fallbackFill
  }
  return boostRgbaColor(objColor, 0.28)
}

const MapCanvasContainer = forwardRef<MapCanvasHandle, MapCanvasContainerProps>(
  function MapCanvasContainer(
    {
      objects,
      selectedId,
      selectedChannelId,
      snapEnabled,
      gridSize,
      zoom,
      tool,
      readOnly = false,
      onToolChange,
      onSelect,
      onUpdateObject,
      onZoomChange,
      onAddObject,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<Konva.Stage | null>(null)
    const gridLayerRef = useRef<Konva.Layer | null>(null)
    const objectsLayerRef = useRef<Konva.Layer | null>(null)
    const transformerRef = useRef<Konva.Transformer | null>(null)

    // Cache de nós Konva
    const nodeMapRef = useRef<Map<string, Konva.Group | Konva.Line>>(new Map())

    // ── Refs sempre atualizadas para snap e readOnly (evita closures stale nos handlers Konva) ──
    const snapEnabledRef = useRef(snapEnabled)
    const gridSizeRef = useRef(gridSize)
    const readOnlyRef = useRef(readOnly)
    useEffect(() => { snapEnabledRef.current = snapEnabled }, [snapEnabled])
    useEffect(() => { gridSizeRef.current = gridSize }, [gridSize])
    useEffect(() => { readOnlyRef.current = readOnly }, [readOnly])

    // Estado para Pan Livre com Espaço / Botão do Meio / Botão Direito / Fundo
    const isSpacePressedRef = useRef(false)
    const isPanningRef = useRef(false)
    const panStartPosRef = useRef<{ x: number; y: number; stageX: number; stageY: number }>({
      x: 0,
      y: 0,
      stageX: 0,
      stageY: 0,
    })

    const [isSpaceActive, setIsSpaceActive] = useState(false)

    // Estado do modo draw_area / draw_floor
    const drawModeRef = useRef<{
      active: boolean
      points: number[]
      previewLine: Konva.Line | null
      guideLine: Konva.Line | null
      dots: Konva.Circle[]
    }>({ active: false, points: [], previewLine: null, guideLine: null, dots: [] })

    // Snap helper — lê sempre as refs (valor atual, sem closure stale)
    const snap = useCallback(
      (val: number) => {
        if (!snapEnabledRef.current) return val
        return Math.round(val / gridSizeRef.current) * gridSizeRef.current
      },
      [] // sem dependências — usa refs
    )

    // Helper de restrição de arrasto pelo grid em tempo real (movimento por grid durante o drag)
    const createDragBoundFunc = useCallback((isPolyLine: boolean = false, baseObj?: MapObject) => {
      return function (pos: Konva.Vector2d): Konva.Vector2d {
        const stage = stageRef.current
        if (!stage || !snapEnabledRef.current) return pos

        const scaleX = stage.scaleX() || 1
        const scaleY = stage.scaleY() || 1
        const stageX = stage.x()
        const stageY = stage.y()
        const step = gridSizeRef.current || 20

        if (isPolyLine && baseObj) {
          const localDx = (pos.x - stageX) / scaleX
          const localDy = (pos.y - stageY) / scaleY

          const targetX = baseObj.x + localDx
          const targetY = baseObj.y + localDy

          const snappedTargetX = Math.round(targetX / step) * step
          const snappedTargetY = Math.round(targetY / step) * step

          const snappedDx = snappedTargetX - baseObj.x
          const snappedDy = snappedTargetY - baseObj.y

          return {
            x: stageX + snappedDx * scaleX,
            y: stageY + snappedDy * scaleY,
          }
        }

        const localX = (pos.x - stageX) / scaleX
        const localY = (pos.y - stageY) / scaleY

        const snappedX = Math.round(localX / step) * step
        const snappedY = Math.round(localY / step) * step

        return {
          x: stageX + snappedX * scaleX,
          y: stageY + snappedY * scaleY,
        }
      }
    }, [])

    // ── fitToScreen: Centraliza e Enquadra todo o Conteúdo ─────
    const fitToScreen = useCallback(() => {
      const stage = stageRef.current
      if (!stage) return

      const containerW = stage.width()
      const containerH = stage.height()

      if (objects.length === 0) {
        stage.position({ x: 40, y: 40 })
        stage.scale({ x: 1, y: 1 })
        stage.batchDraw()
        onZoomChange(100)
        return
      }

      // Calcula Bounding Box de todos os elementos
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      objects.forEach((obj) => {
        minX = Math.min(minX, obj.x)
        minY = Math.min(minY, obj.y)
        maxX = Math.max(maxX, obj.x + obj.width)
        maxY = Math.max(maxY, obj.y + obj.height)
      })

      const contentW = Math.max(60, maxX - minX)
      const contentH = Math.max(60, maxY - minY)
      const padding = 80

      const availableW = Math.max(100, containerW - padding * 2)
      const availableH = Math.max(100, containerH - padding * 2)

      const scaleX = availableW / contentW
      const scaleY = availableH / contentH
      const fitScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 2.5)

      // Centraliza no meio exato do container
      const targetX = (containerW - contentW * fitScale) / 2 - minX * fitScale
      const targetY = (containerH - contentH * fitScale) / 2 - minY * fitScale

      const anim = new Konva.Tween({
        node: stage,
        duration: 0.35,
        easing: Konva.Easings.EaseInOut,
        x: targetX,
        y: targetY,
        scaleX: fitScale,
        scaleY: fitScale,
        onFinish: () => {
          onZoomChange(Math.round(fitScale * 100))
          anim.destroy()
        },
      })
      anim.play()
    }, [objects, onZoomChange])

    // ── navigateTo: centraliza e destaca o objeto ────────────
    const navigateTo = useCallback(
      (obj: MapObject) => {
        const stage = stageRef.current
        if (!stage) return

        const containerW = stage.width()
        const containerH = stage.height()

        const cx = obj.x + obj.width / 2
        const cy = obj.y + obj.height / 2

        const targetScale = 1.4
        const targetX = containerW / 2 - cx * targetScale
        const targetY = containerH / 2 - cy * targetScale

        const anim = new Konva.Tween({
          node: stage,
          duration: 0.35,
          easing: Konva.Easings.EaseInOut,
          x: targetX,
          y: targetY,
          scaleX: targetScale,
          scaleY: targetScale,
          onFinish: () => {
            onZoomChange(Math.round(targetScale * 100))
            anim.destroy()

            const node = nodeMapRef.current.get(obj.id)
            if (node) {
              const flashTween = new Konva.Tween({
                node,
                duration: 0.25,
                opacity: 0.35,
                onFinish: () => {
                  new Konva.Tween({
                    node,
                    duration: 0.35,
                    opacity: 1,
                    onFinish: () => flashTween.destroy(),
                  }).play()
                },
              })
              flashTween.play()
            }
          },
        })
        anim.play()
      },
      [onZoomChange]
    )

    // Expõe para o pai via ref
    useImperativeHandle(ref, () => ({ navigateTo, fitToScreen }), [navigateTo, fitToScreen])

    // ── Inicialização do Stage ─────────────────────────────────
    useEffect(() => {
      if (!containerRef.current) return

      const width = containerRef.current.offsetWidth
      const height = containerRef.current.offsetHeight

      const stage = new Konva.Stage({
        container: containerRef.current,
        width,
        height,
        draggable: false,
      })
      stageRef.current = stage

      // Camadas
      const gridLayer = new Konva.Layer()
      stage.add(gridLayer)
      gridLayerRef.current = gridLayer

      const objectsLayer = new Konva.Layer()
      stage.add(objectsLayer)
      objectsLayerRef.current = objectsLayer

      // Transformer com feedback visual elegante
      const tr = new Konva.Transformer({
        rotateEnabled: true,
        enabledAnchors: [
          "top-left",
          "top-right",
          "bottom-left",
          "bottom-right",
          "middle-left",
          "middle-right",
          "top-center",
          "bottom-center",
        ],
        borderStroke: "#3b82f6",
        borderDash: [4, 4],
        anchorFill: "#3b82f6",
        anchorStroke: "#ffffff",
        anchorSize: 8,
        anchorCornerRadius: 2,
      })
      objectsLayer.add(tr)
      transformerRef.current = tr

      // Previne menu de contexto para liberar botão direito para Pan livre
      stage.on("contextmenu", (e) => {
        e.evt.preventDefault()
      })

      // Clique no vazio desmarca seleção
      stage.on("click tap", (e) => {
        if (!isPanningRef.current && (e.target === stage || e.target.getLayer() === gridLayer)) {
          onSelect(null)
        }
      })

      // Zoom via Scroll fluido
      stage.on("wheel", (e) => {
        e.evt.preventDefault()
        const scaleBy = 1.08
        const oldScale = stage.scaleX()
        const pointer = stage.getPointerPosition()!

        const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy
        const clamped = Math.min(Math.max(newScale, 0.15), 6)

        stage.scale({ x: clamped, y: clamped })
        const newPos = {
          x: pointer.x - (pointer.x - stage.x()) * (clamped / oldScale),
          y: pointer.y - (pointer.y - stage.y()) * (clamped / oldScale),
        }
        stage.position(newPos)
        onZoomChange(Math.round(clamped * 100))
        stage.batchDraw()
      })

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (!containerRef.current) return
        const nw = containerRef.current.offsetWidth
        const nh = containerRef.current.offsetHeight
        stage.width(nw)
        stage.height(nh)
        drawGrid()
      })
      ro.observe(containerRef.current)

      return () => {
        ro.disconnect()
        stage.destroy()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Listener da Barra de Espaço para Pan Universal ────────
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return
        if (e.code === "Space" && !e.repeat) {
          isSpacePressedRef.current = true
          setIsSpaceActive(true)
        }
        // Atalho Shift+1 ou Home para enquadrar tudo
        if ((e.shiftKey && e.key === "!") || e.key === "Home") {
          e.preventDefault()
          fitToScreen()
        }
      }

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === "Space") {
          isSpacePressedRef.current = false
          setIsSpaceActive(false)
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      window.addEventListener("keyup", handleKeyUp)
      return () => {
        window.removeEventListener("keydown", handleKeyDown)
        window.removeEventListener("keyup", handleKeyUp)
      }
    }, [fitToScreen])

    // ── Lógica de Pan Livre com Mouse (Espaço, Botão Meio, Botão Direito ou Vazio) ──
    useEffect(() => {
      const stage = stageRef.current
      if (!stage) return

      const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
        const isMiddleClick = e.evt.button === 1
        const isRightClick = e.evt.button === 2
        const isSpace = isSpacePressedRef.current
        const isBackgroundClick =
          (e.target === stage || e.target.getLayer() === gridLayerRef.current) && tool === "select"

        // Se for modo de desenho, não intercepta clique esquerdo
        if ((tool === "draw_area" || tool === "draw_floor") && !isMiddleClick && !isRightClick && !isSpace) {
          return
        }

        if (tool === "pan" || isMiddleClick || isRightClick || isSpace || isBackgroundClick) {
          isPanningRef.current = true
          panStartPosRef.current = {
            x: e.evt.clientX,
            y: e.evt.clientY,
            stageX: stage.x(),
            stageY: stage.y(),
          }
          stage.container().style.cursor = "grabbing"
        }
      }

      const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isPanningRef.current) return
        const dx = e.evt.clientX - panStartPosRef.current.x
        const dy = e.evt.clientY - panStartPosRef.current.y

        stage.position({
          x: panStartPosRef.current.stageX + dx,
          y: panStartPosRef.current.stageY + dy,
        })
        stage.batchDraw()
      }

      const handleMouseUp = () => {
        if (isPanningRef.current) {
          isPanningRef.current = false
          stage.container().style.cursor = isSpacePressedRef.current
            ? "grab"
            : tool === "pan"
            ? "grab"
            : tool === "draw_area" || tool === "draw_floor"
            ? "crosshair"
            : "default"
        }
      }

      stage.on("mousedown", handleMouseDown)
      stage.on("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)

      return () => {
        stage.off("mousedown", handleMouseDown)
        stage.off("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }
    }, [tool])

    // ── Atualiza Grade (oculta automaticamente no Modo Visualizador) ──
    const drawGrid = useCallback(() => {
      const gl = gridLayerRef.current
      const st = stageRef.current
      if (!gl || !st) return

      gl.destroyChildren()

      if (readOnlyRef.current || readOnly) {
        gl.batchDraw()
        return
      }

      const step = Math.max(5, gridSize)
      const w = Math.max(st.width() * 4, 4000)
      const h = Math.max(st.height() * 4, 4000)

      const strokeMinor = snapEnabled ? "#1e293b" : "#131b2e"
      const strokeMajor = snapEnabled ? "#334155" : "#1e293b"

      for (let x = -w; x <= w; x += step) {
        const isMajor = x % (step * 5) === 0
        gl.add(
          new Konva.Line({
            points: [x, -h, x, h],
            stroke: isMajor ? strokeMajor : strokeMinor,
            strokeWidth: isMajor ? 1 : 0.5,
            listening: false,
          })
        )
      }

      for (let y = -h; y <= h; y += step) {
        const isMajor = y % (step * 5) === 0
        gl.add(
          new Konva.Line({
            points: [-w, y, w, y],
            stroke: isMajor ? strokeMajor : strokeMinor,
            strokeWidth: isMajor ? 1 : 0.5,
            listening: false,
          })
        )
      }

      gl.batchDraw()
    }, [gridSize, snapEnabled, readOnly])

    useEffect(() => {
      drawGrid()
    }, [drawGrid])

    // ── Cursor do Container ────────────────────────────────────
    useEffect(() => {
      const stage = stageRef.current
      if (!stage) return
      if (isSpaceActive) {
        stage.container().style.cursor = "grab"
      } else if (tool === "pan") {
        stage.container().style.cursor = "grab"
      } else if (tool === "draw_area" || tool === "draw_floor") {
        stage.container().style.cursor = "crosshair"
      } else {
        stage.container().style.cursor = "default"
      }
    }, [tool, isSpaceActive])

    // ── Sincroniza Zoom com Props ──────────────────────────────
    useEffect(() => {
      const stage = stageRef.current
      if (!stage) return
      const currentScale = stage.scaleX()
      const targetScale = zoom / 100
      if (Math.abs(currentScale - targetScale) > 0.01) {
        stage.scale({ x: targetScale, y: targetScale })
        stage.batchDraw()
      }
    }, [zoom])

    // ── Helpers de conversão de coordenadas ───────────────────
    const getStagePoint = useCallback((stage: Konva.Stage) => {
      const pos = stage.getPointerPosition()
      if (!pos) return null
      const scale = stage.scaleX()
      return {
        x: (pos.x - stage.x()) / scale,
        y: (pos.y - stage.y()) / scale,
      }
    }, [])

    // ── Finaliza polígono desenhado ────────────────────────────
    const finalizeDrawArea = useCallback(
      (isFloor: boolean) => {
        const dm = drawModeRef.current
        if (dm.points.length < 6) {
          dm.previewLine?.destroy()
          dm.guideLine?.destroy()
          dm.dots.forEach((d) => d.destroy())
          objectsLayerRef.current?.batchDraw()
          drawModeRef.current = { active: false, points: [], previewLine: null, guideLine: null, dots: [] }
          return
        }

        const xs = dm.points.filter((_, i) => i % 2 === 0)
        const ys = dm.points.filter((_, i) => i % 2 !== 0)
        const minX = Math.min(...xs)
        const minY = Math.min(...ys)
        const maxX = Math.max(...xs)
        const maxY = Math.max(...ys)

        const relPoints = dm.points.map((v, i) => (i % 2 === 0 ? v - minX : v - minY))

        const newObj: MapObject = {
          id: `area_${crypto.randomUUID().slice(0, 8)}`,
          type: isFloor ? "floor" : "custom_area",
          category: "area",
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          rotation: 0,
          locked: false,
          visible: true,
          layerId: "areas",
          label: isFloor ? "Novo Piso" : "Nova Área",
          points: relPoints,
          classification: isFloor ? "piso_geral" : "area_avarias",
          color: isFloor ? "rgba(30,41,59,0.4)" : "rgba(245,158,11,0.12)",
          strokeColor: isFloor ? "#475569" : "#f59e0b",
          opacity: 1,
          props: isFloor
            ? { realWidthM: 0, realHeightM: 0, pixelsPerMeter: 20, floorName: "Piso 1" }
            : {},
        }

        dm.previewLine?.destroy()
        dm.guideLine?.destroy()
        dm.dots.forEach((d) => d.destroy())
        drawModeRef.current = { active: false, points: [], previewLine: null, guideLine: null, dots: [] }

        objectsLayerRef.current?.batchDraw()
        onAddObject?.(newObj)
      },
      [onAddObject]
    )

    // ── Lógica do Draw Area Mode ───────────────────────────────
    useEffect(() => {
      const stage = stageRef.current
      const layer = objectsLayerRef.current
      if (!stage || !layer) return
      if (tool !== "draw_area" && tool !== "draw_floor") return

      const isFloor = tool === "draw_floor"

      const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
        // Se estiver fazendo pan com espaço ou botão direito, ignora
        if (isSpacePressedRef.current || e.evt.button !== 0) return
        if (e.target !== stage && e.target.getLayer() !== gridLayerRef.current) return
        const pt = getStagePoint(stage)
        if (!pt) return

        const dm = drawModeRef.current
        const sx = snap(pt.x)
        const sy = snap(pt.y)

        if (dm.points.length >= 6) {
          const fx = dm.points[0]
          const fy = dm.points[1]
          const dist = Math.sqrt((sx - fx) ** 2 + (sy - fy) ** 2)
          if (dist < 20) {
            finalizeDrawArea(isFloor)
            return
          }
        }

        dm.points.push(sx, sy)
        dm.active = true

        if (!dm.previewLine) {
          const line = new Konva.Line({
            points: dm.points,
            stroke: isFloor ? "#94a3b8" : "#f59e0b",
            strokeWidth: 2,
            dash: [6, 3],
            closed: false,
            listening: false,
          })
          layer.add(line)
          dm.previewLine = line
        } else {
          dm.previewLine.points(dm.points)
        }

        const dot = new Konva.Circle({
          x: sx,
          y: sy,
          radius: dm.points.length === 2 ? 6 : 4,
          fill: dm.points.length === 2 ? "#10b981" : isFloor ? "#94a3b8" : "#f59e0b",
          stroke: "#0f172a",
          strokeWidth: 1.5,
          listening: false,
        })
        layer.add(dot)
        dm.dots.push(dot)

        layer.batchDraw()
      }

      const handleMouseMove = () => {
        const dm = drawModeRef.current
        if (!dm.active || dm.points.length < 2) return

        const pt = getStagePoint(stage)
        if (!pt) return

        const sx = snap(pt.x)
        const sy = snap(pt.y)

        if (!dm.guideLine) {
          const gl = new Konva.Line({
            points: [dm.points[dm.points.length - 2], dm.points[dm.points.length - 1], sx, sy],
            stroke: isFloor ? "#94a3b8" : "#f59e0b",
            strokeWidth: 1.5,
            dash: [4, 4],
            listening: false,
            opacity: 0.6,
          })
          layer.add(gl)
          dm.guideLine = gl
        } else {
          dm.guideLine.points([dm.points[dm.points.length - 2], dm.points[dm.points.length - 1], sx, sy])
        }

        layer.batchDraw()
      }

      const handleDblClick = () => {
        const dm = drawModeRef.current
        if (dm.active && dm.points.length >= 6) {
          finalizeDrawArea(isFloor)
        }
      }

      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          const dm = drawModeRef.current
          dm.previewLine?.destroy()
          dm.guideLine?.destroy()
          dm.dots.forEach((d) => d.destroy())
          drawModeRef.current = { active: false, points: [], previewLine: null, guideLine: null, dots: [] }
          layer.batchDraw()
        }
      }

      stage.on("click.drawArea", handleClick)
      stage.on("mousemove.drawArea", handleMouseMove)
      stage.on("dblclick.drawArea", handleDblClick)
      window.addEventListener("keydown", handleEsc)

      return () => {
        stage.off("click.drawArea")
        stage.off("mousemove.drawArea")
        stage.off("dblclick.drawArea")
        window.removeEventListener("keydown", handleEsc)

        const dm = drawModeRef.current
        dm.previewLine?.destroy()
        dm.guideLine?.destroy()
        dm.dots.forEach((d) => d.destroy())
        drawModeRef.current = { active: false, points: [], previewLine: null, guideLine: null, dots: [] }
        layer.batchDraw()
      }
    }, [tool, snap, getStagePoint, finalizeDrawArea])

    // ── Renderização Reativa dos Objetos ──────────────────────
    useEffect(() => {
      const layer = objectsLayerRef.current
      const tr = transformerRef.current
      if (!layer || !tr) return

      const oldNodes = Array.from(nodeMapRef.current.values())
      oldNodes.forEach((node) => node.destroy())
      nodeMapRef.current.clear()

      const areaObjects = objects.filter((o) => o.category === "area")
      const otherObjects = objects.filter((o) => o.category !== "area")
      const renderOrder = [...areaObjects, ...otherObjects]

      renderOrder.forEach((obj) => {
        // Se o usuário ocultou o objeto (olhinho na hierarquia), não renderiza no canvas
        if (obj.visible === false) return
        // Oculta guias puramente de CAD/edição no modo visualizador
        if (readOnly && (obj.type === "coordinates" || obj.type === "dimension_line")) return

        let node: Konva.Group | Konva.Line

        if (obj.category === "area" && obj.points && obj.points.length >= 6) {
          const { fill, stroke } = getAreaFill(obj.classification, readOnly)
          const absPoints = obj.points.map((v, i) => (i % 2 === 0 ? v + obj.x : v + obj.y))
          const isDarkBase = obj.type === "floor" || obj.classification === "piso_geral" || obj.classification === "rua"

          const polyLine = new Konva.Line({
            points: absPoints,
            fill: resolveViewerAreaFill(obj.color, fill, readOnly, isDarkBase),
            stroke: obj.strokeColor || stroke,
            strokeWidth: 2,
            closed: true,
            opacity: obj.opacity ?? 1,
            dash: readOnly ? undefined : [8, 4],
            listening: true,
          })
          polyLine.id(obj.id)
          polyLine.draggable(!readOnly && !obj.locked && tool === "select")
          polyLine.dragBoundFunc(createDragBoundFunc(true, obj))

          polyLine.on("click tap", (e) => {
            e.cancelBubble = true
            onSelect(obj.id)
          })

          polyLine.on("dragend", () => {
            const dx = polyLine.x()
            const dy = polyLine.y()
            const nx = snap(obj.x + dx)
            const ny = snap(obj.y + dy)
            polyLine.position({ x: 0, y: 0 })
            onUpdateObject(obj.id, { x: nx, y: ny })
            layer.batchDraw()
          })

          layer.add(polyLine)
          const group = new Konva.Group()
          group.id(obj.id + "_g")
          nodeMapRef.current.set(obj.id, polyLine as unknown as Konva.Group)
          layer.add(group)
          node = polyLine as unknown as Konva.Group
        } else if (obj.category === "area") {
          const isStreet = obj.classification === "rua" || obj.classification === "circulacao"
          const { fill, stroke } = getAreaFill(obj.classification, readOnly)
          const group = new Konva.Group()
          group.id(obj.id)
          group.position({ x: obj.x, y: obj.y })
          group.rotation(obj.rotation || 0)
          group.draggable(!readOnly && !obj.locked && tool === "select")
          group.dragBoundFunc(createDragBoundFunc(false))
          group.opacity(obj.opacity ?? 1)

          if (isStreet) {
            // ── DESENHO ELEGANTE E SUCINTO DA RUA / CORREDOR OPERACIONAL ──
            const w = obj.width
            const h = obj.height

            // 1. Piso de circulação
            group.add(
              new Konva.Rect({
                width: w,
                height: h,
                fill: resolveViewerAreaFill(
                  obj.color,
                  readOnly ? "rgba(51, 65, 85, 0.85)" : "rgba(15, 23, 42, 0.45)",
                  readOnly,
                  true
                ),
                stroke: readOnly ? "#475569" : "#334155",
                strokeWidth: 1,
                cornerRadius: 2,
              })
            )

            // 2. Faixas demarcatórias laterais (amarelo de segurança industrial)
            const isVertical = h >= w
            if (isVertical) {
              // Faixa esquerda e direita da rua
              group.add(
                new Konva.Line({
                  points: [2, 0, 2, h],
                  stroke: readOnly ? "#facc15" : "#eab308",
                  strokeWidth: 1.5,
                  dash: readOnly ? undefined : [8, 4],
                  opacity: readOnly ? 0.9 : 0.85,
                }),
                new Konva.Line({
                  points: [w - 2, 0, w - 2, h],
                  stroke: readOnly ? "#facc15" : "#eab308",
                  strokeWidth: 1.5,
                  dash: readOnly ? undefined : [8, 4],
                  opacity: readOnly ? 0.9 : 0.85,
                })
              )
              // Linha divisória de pista no centro (se a rua for larga)
              if (w >= 50) {
                group.add(
                  new Konva.Line({
                    points: [w / 2, 8, w / 2, h - 8],
                    stroke: "rgba(234, 179, 8, 0.45)",
                    strokeWidth: 1,
                    dash: [12, 10],
                  })
                )
              }
              // Setas de sentido de tráfego (apenas no editor)
              if (!readOnly) {
                const step = Math.max(120, h / 3)
                for (let y = step / 2; y < h; y += step) {
                  group.add(
                    new Konva.Arrow({
                      points: [w / 2, y + 14, w / 2, y - 6],
                      pointerLength: 4,
                      pointerWidth: 4,
                      fill: "rgba(56, 189, 248, 0.4)",
                      stroke: "rgba(56, 189, 248, 0.4)",
                      strokeWidth: 1,
                      listening: false,
                    })
                  )
                }
              }
            } else {
              // Rua horizontal
              group.add(
                new Konva.Line({
                  points: [0, 2, w, 2],
                  stroke: readOnly ? "#facc15" : "#eab308",
                  strokeWidth: 1.5,
                  dash: readOnly ? undefined : [8, 4],
                  opacity: readOnly ? 0.9 : 0.85,
                }),
                new Konva.Line({
                  points: [0, h - 2, w, h - 2],
                  stroke: readOnly ? "#facc15" : "#eab308",
                  strokeWidth: 1.5,
                  dash: readOnly ? undefined : [8, 4],
                  opacity: readOnly ? 0.9 : 0.85,
                })
              )
            }

            // 3. Rótulo da Rua sucinto e minimalista
            const streetLabel = new Konva.Text({
              x: 4,
              y: 8,
              width: w - 8,
              text: (obj.label || "RUA").toUpperCase(),
              align: "center",
              fontSize: Math.min(10, Math.max(8, Math.round(w / 6))),
              fontFamily: "monospace",
              fontStyle: "bold",
              fill: readOnly ? "rgba(241, 245, 249, 0.9)" : "rgba(226, 232, 240, 0.75)",
              letterSpacing: 1.5,
              listening: false,
            })
            group.add(streetLabel)
          } else {
            // Retângulo padrão de Área / Bloco / Piso de Apoio
            const isFloor = obj.type === "floor" || Boolean(obj.props?.floorMaterial) || obj.classification === "piso_geral"
            const matType =
              (obj.props?.floorMaterial as FloorMaterialType) ||
              (obj.classification === "grama"
                ? "grass"
                : obj.classification === "asfalto"
                ? "asphalt"
                : "concrete")
            const surfaceDef = FLOOR_SURFACES[matType]
            const viewerSurfaceFill = isFloor && surfaceDef ? surfaceDef.viewerColor : fill
            const viewerSurfaceStroke = isFloor && surfaceDef ? surfaceDef.viewerStrokeColor : stroke

            const rect = new Konva.Rect({
              width: obj.width,
              height: obj.height,
              fill: resolveViewerAreaFill(
                obj.color,
                readOnly ? viewerSurfaceFill : fill,
                readOnly,
                isFloor
              ),
              stroke: readOnly && isFloor && (!obj.strokeColor || obj.strokeColor === "#475569")
                ? viewerSurfaceStroke
                : obj.strokeColor || stroke,
              strokeWidth: isFloor ? 2 : obj.classification === "bloco" ? 2 : 1.5,
              dash: readOnly || isFloor ? undefined : obj.classification === "bloco" ? [6, 4] : [8, 4],
              cornerRadius: isFloor ? 4 : 0,
            })
            group.add(rect)

            // Detalhes visuais do material de piso / apoio
            if (isFloor) {
              const w = obj.width
              const h = obj.height
              if (matType === "concrete" && !readOnly) {
                const step = 80
                for (let x = step; x < w; x += step) {
                  group.add(
                    new Konva.Line({
                      points: [x, 0, x, h],
                      stroke: "rgba(148, 163, 184, 0.2)",
                      strokeWidth: 1,
                      dash: [4, 4],
                      listening: false,
                    })
                  )
                }
                for (let y = step; y < h; y += step) {
                  group.add(
                    new Konva.Line({
                      points: [0, y, w, y],
                      stroke: "rgba(148, 163, 184, 0.2)",
                      strokeWidth: 1,
                      dash: [4, 4],
                      listening: false,
                    })
                  )
                }
              } else if (matType === "grass") {
                const step = 60
                for (let x = 30; x < w - 20; x += step) {
                  for (let y = 30; y < h - 20; y += step) {
                    group.add(
                      new Konva.Line({
                        points: [x, y, x - 3, y - 6, x, y, x + 3, y - 6],
                        stroke: readOnly ? "rgba(74, 222, 128, 0.55)" : "rgba(34, 197, 94, 0.4)",
                        strokeWidth: 1.2,
                        listening: false,
                      })
                    )
                  }
                }
              } else if (matType === "asphalt" && !readOnly) {
                group.add(
                  new Konva.Rect({
                    x: 4,
                    y: 4,
                    width: w - 8,
                    height: h - 8,
                    stroke: "rgba(71, 85, 105, 0.4)",
                    strokeWidth: 1,
                    dash: [6, 6],
                    listening: false,
                  })
                )
              }
            }

            const prefix = isFloor && surfaceDef ? `${surfaceDef.icon} ` : ""
            const lbl = new Konva.Text({
              text: `${prefix}${obj.label || ""}`,
              fontSize: 11,
              fill: readOnly && isFloor && (!obj.strokeColor || obj.strokeColor === "#475569")
                ? viewerSurfaceStroke
                : obj.strokeColor || stroke,
              fontStyle: "bold",
              padding: 4,
              listening: false,
            })
            group.add(lbl)
          }

          group.on("click tap", (e) => {
            e.cancelBubble = true
            onSelect(obj.id)
          })
          group.on("dragend", () => {
            const nx = snap(group.x())
            const ny = snap(group.y())
            group.position({ x: nx, y: ny })
            onUpdateObject(obj.id, { x: nx, y: ny })
            layer.batchDraw()
          })
          group.on("transformend", () => {
            const scaleX = group.scaleX()
            const scaleY = group.scaleY()
            group.scaleX(1)
            group.scaleY(1)
            const newW = Math.max(10, Math.round(obj.width * scaleX))
            const newH = Math.max(10, Math.round(obj.height * scaleY))
            const newRot = Math.round(group.rotation() % 360)

            const curDims = obj.physicalDimensions || ensurePhysicalDimensions(obj, 20)
            const realW = pixelsToReal(newW, 20, curDims.unit)
            const realL = pixelsToReal(newH, 20, curDims.unit)

            onUpdateObject(obj.id, {
              x: snap(group.x()),
              y: snap(group.y()),
              width: newW,
              height: newH,
              rotation: newRot < 0 ? newRot + 360 : newRot,
              physicalDimensions: {
                ...curDims,
                width: realW,
                length: realL,
              },
            })
          })

          layer.add(group)
          nodeMapRef.current.set(obj.id, group)
          node = group
        } else {
          const def = ELEMENT_BY_TYPE.get(obj.type)
          if (!def) return

          const group = def.renderKonva(obj, { readOnly })
          group.id(obj.id)
          group.position({ x: obj.x, y: obj.y })
          group.rotation(obj.rotation || 0)
          group.draggable(!readOnly && !obj.locked && tool === "select")
          group.dragBoundFunc(createDragBoundFunc(false))

          // ── Suporte a Seleção Individual de Canal em Drive-In / Drive-Through ──
          const isDriveIn = obj.type === "drive_in" || obj.type === "drive_through"
          if (isDriveIn) {
            const lanes = Math.max(1, Number(obj.props?.lanes) || 1)
            const laneW = obj.width / lanes
            const channels = ensureDriveChannels(obj)

            for (let l = 0; l < lanes; l++) {
              const chan = channels[l] || channels.find((c) => c.laneIndex === l + 1)
              const chanId = chan ? (chan.id || chan.code) : `${obj.id}_chan_${l + 1}`
              const isChannelSelected =
                selectedId === obj.id &&
                (selectedChannelId === chanId ||
                  selectedChannelId === chan?.code ||
                  (!selectedChannelId && l === 0))

              const cx = l * laneW
              const cy = 0
              const cw = laneW
              const ch = obj.height

              // Hitbox interativo de seleção para cada canal individual
              const chanHitbox = new Konva.Rect({
                x: cx,
                y: cy,
                width: cw,
                height: ch,
                fill: isChannelSelected ? "rgba(56, 189, 248, 0.20)" : "transparent",
                stroke: isChannelSelected ? "#38bdf8" : undefined,
                strokeWidth: isChannelSelected ? 2.5 : 0,
                shadowColor: isChannelSelected ? "#0284c7" : undefined,
                shadowBlur: isChannelSelected ? 8 : 0,
                listening: true,
                name: `channel_hitbox_${l}`,
              })

              chanHitbox.on("click tap", (e) => {
                e.cancelBubble = true
                onSelect(obj.id, chanId)
              })

              // Se o canal estiver selecionado, desenha cantoneiras (apenas no editor) e badge do canal
              if (isChannelSelected) {
                if (!readOnly) {
                  const cornerSize = 5
                  const corners = [
                    [cx - 1, cy - 1],
                    [cx + cw - cornerSize + 1, cy - 1],
                    [cx - 1, cy + ch - cornerSize + 1],
                    [cx + cw - cornerSize + 1, cy + ch - cornerSize + 1],
                  ]
                  corners.forEach(([px, py]) => {
                    group.add(
                      new Konva.Rect({
                        x: px,
                        y: py,
                        width: cornerSize,
                        height: cornerSize,
                        fill: "#38bdf8",
                        stroke: "#ffffff",
                        strokeWidth: 1,
                        cornerRadius: 1,
                        listening: false,
                      })
                    )
                  })
                }

                // Badge do canal selecionado
                const chanTitle = chan ? (chan.name || chan.code) : `Canal ${l + 1}`
                const badgeText = new Konva.Text({
                  x: cx + 3,
                  y: cy + 3,
                  text: `📍 ${chanTitle}`,
                  fontSize: Math.min(9, Math.max(7, Math.round(cw / 8))),
                  fontStyle: "bold",
                  fontFamily: "monospace",
                  fill: "#ffffff",
                  padding: 2,
                  listening: false,
                })
                const badgeBg = new Konva.Rect({
                  x: cx + 2,
                  y: cy + 2,
                  width: badgeText.width() + 4,
                  height: badgeText.height() + 2,
                  fill: "rgba(2, 132, 199, 0.9)",
                  cornerRadius: 3,
                  listening: false,
                })
                group.add(badgeBg)
                group.add(badgeText)
              }

              group.add(chanHitbox)
            }
          }

          group.on("click tap", (e) => {
            e.cancelBubble = true
            if (isDriveIn) {
              const channels = ensureDriveChannels(obj)
              const firstId = channels[0]?.id || channels[0]?.code
              onSelect(obj.id, firstId)
            } else {
              onSelect(obj.id)
            }
          })

          group.on("dragend", () => {
            const nx = snap(group.x())
            const ny = snap(group.y())
            group.position({ x: nx, y: ny })
            onUpdateObject(obj.id, { x: nx, y: ny })
            layer.batchDraw()
          })

          group.on("transformend", () => {
            const scaleX = group.scaleX()
            const scaleY = group.scaleY()
            group.scaleX(1)
            group.scaleY(1)
            const newW = Math.max(10, Math.round(obj.width * scaleX))
            const newH = Math.max(10, Math.round(obj.height * scaleY))
            const newRot = Math.round(group.rotation() % 360)

            const curDims = obj.physicalDimensions || ensurePhysicalDimensions(obj, 20)
            const realW = pixelsToReal(newW, 20, curDims.unit)
            const realL = pixelsToReal(newH, 20, curDims.unit)

            onUpdateObject(obj.id, {
              x: snap(group.x()),
              y: snap(group.y()),
              width: newW,
              height: newH,
              rotation: newRot < 0 ? newRot + 360 : newRot,
              physicalDimensions: {
                ...curDims,
                width: realW,
                length: realL,
              },
            })
          })

          layer.add(group)
          nodeMapRef.current.set(obj.id, group)
          node = group
        }

        void node
      })

      // Atualiza nós no transformer (desativado em modo somente-leitura / visualizador)
      if (selectedId && !readOnly) {
        const selectedNode = nodeMapRef.current.get(selectedId)
        const selectedObj = objects.find((o) => o.id === selectedId)
        const isDriveIn = selectedObj?.type === "drive_in" || selectedObj?.type === "drive_through"

        // Para Drive-In, o canal selecionado possui sua própria moldura e cantoneiras de objeto individual.
        // Ocultamos o transformer externo para focar visualmente apenas naquele canal específico.
        if (isDriveIn) {
          tr.nodes([])
        } else if (selectedNode && selectedNode instanceof Konva.Group) {
          tr.keepRatio(Boolean(selectedObj?.physicalDimensions?.lockAspectRatio))
          tr.nodes([selectedNode])
          tr.moveToTop()
        } else {
          tr.nodes([])
        }
      } else {
        tr.nodes([])
      }

      layer.batchDraw()
    }, [objects, selectedId, selectedChannelId, tool, readOnly, onSelect, onUpdateObject, snap, createDragBoundFunc])

    return (
      <div
        ref={containerRef}
        className="flex-1 h-full w-full bg-slate-950 overflow-hidden relative select-none"
      >
        {/* HUD Flutuante de Navegação e Enquadramento Rápido no Canto Inferior Direito */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-auto">
          {/* Dica de Atalhos de Movimento */}
          <div className="bg-slate-900/90 border border-slate-800 text-[10px] text-slate-400 px-2.5 py-1.5 rounded-lg shadow-xl backdrop-blur flex items-center gap-2">
            <span>🖱️ <strong>Pan:</strong> Segure <kbd className="bg-slate-800 px-1 rounded text-slate-200">Espaço</kbd> ou arraste c/ botão direito / meio</span>
          </div>

          {/* Botões de Ação de Câmera */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-2xl backdrop-blur">
            <button
              onClick={() => fitToScreen()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-950/70 hover:bg-blue-900/80 border border-blue-800/60 text-blue-300 hover:text-white text-xs font-bold transition-all shadow-sm"
              title="Enquadrar todo o conteúdo na tela (Shift+1)"
            >
              <span>🎯</span>
              <span>Enquadrar Tudo</span>
            </button>

            <div className="h-4 w-px bg-slate-800 mx-1" />

            <button
              onClick={() => onZoomChange(Math.max(zoom - 15, 20))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors"
              title="Reduzir Zoom"
            >
              −
            </button>
            <button
              onClick={() => onZoomChange(100)}
              className="px-2 text-xs font-mono text-slate-300 hover:text-blue-400 font-bold"
              title="Resetar Zoom para 100%"
            >
              {zoom}%
            </button>
            <button
              onClick={() => onZoomChange(Math.min(zoom + 15, 400))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors"
              title="Aumentar Zoom"
            >
              +
            </button>
          </div>
        </div>
      </div>
    )
  }
)

export default MapCanvasContainer
