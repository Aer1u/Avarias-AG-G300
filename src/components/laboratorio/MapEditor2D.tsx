"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Konva from "konva"

// ----------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------
export type Tool = "select" | "pan" | "rect" | "line" | "wall" | "polygon"

interface DrawnObject {
  id: string
  type: "rect" | "line" | "wall" | "polygon"
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function drawGrid(layer: Konva.Layer, width: number, height: number, step: number) {
  layer.destroyChildren()
  const color = "#1e293b"
  for (let x = 0; x <= width + step; x += step)
    layer.add(new Konva.Line({ points: [x, 0, x, height], stroke: color, strokeWidth: 1 }))
  for (let y = 0; y <= height + step; y += step)
    layer.add(new Konva.Line({ points: [0, y, width, y], stroke: color, strokeWidth: 1 }))
  layer.batchDraw()
}

function snapToGrid(v: number, step: number) {
  return Math.round(v / step) * step
}

// ----------------------------------------------------------------
// MapEditor2D
// ----------------------------------------------------------------
export default function MapEditor2D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef     = useRef<Konva.Stage | null>(null)
  const gridLayerRef = useRef<Konva.Layer | null>(null)
  const layerRef     = useRef<Konva.Layer | null>(null)
  const trRef        = useRef<Konva.Transformer | null>(null)

  const [tool, setTool]       = useState<Tool>("select")
  const [zoom, setZoom]       = useState(100)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [objects, setObjects] = useState<DrawnObject[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // estado de desenho em andamento
  const isDrawing   = useRef(false)
  const drawStart   = useRef({ x: 0, y: 0 })
  const previewNode = useRef<Konva.Node | null>(null)   // rect / line / wall group
  // polígono
  const polyPoints  = useRef<number[]>([])
  const polyLines   = useRef<Konva.Line[]>([])
  const polyDots    = useRef<Konva.Circle[]>([])
  const polyPreview = useRef<Konva.Line | null>(null)

  const GRID_STEP   = 20
  const WALL_WIDTH  = 10

  // ---- Setup inicial ----
  useEffect(() => {
    if (!containerRef.current) return
    const W = containerRef.current.offsetWidth
    const H = containerRef.current.offsetHeight

    const stage = new Konva.Stage({ container: containerRef.current, width: W, height: H })
    stageRef.current = stage

    const gridLayer = new Konva.Layer()
    stage.add(gridLayer)
    gridLayerRef.current = gridLayer
    drawGrid(gridLayer, W, H, GRID_STEP)

    const layer = new Konva.Layer()
    stage.add(layer)
    layerRef.current = layer

    const tr = new Konva.Transformer({
      rotateEnabled: true,
      enabledAnchors: ["top-left","top-right","bottom-left","bottom-right","middle-left","middle-right","top-center","bottom-center"],
      borderStroke: "#3b82f6",
      anchorFill: "#3b82f6",
      anchorStroke: "#1d4ed8",
      anchorSize: 7,
    })
    layer.add(tr)
    trRef.current = tr

    // clique vazio → deselecionar
    stage.on("click tap", (e) => {
      if (e.target === stage) {
        tr.nodes([])
        setSelectedId(null)
        layer.batchDraw()
      }
    })

    // scroll → zoom
    stage.on("wheel", (e) => {
      e.evt.preventDefault()
      const by = 1.08
      const old = stage.scaleX()
      const ptr = stage.getPointerPosition()!
      const ns  = e.evt.deltaY < 0 ? Math.min(old * by, 5) : Math.max(old / by, 0.2)
      stage.scale({ x: ns, y: ns })
      stage.position({
        x: ptr.x - (ptr.x - stage.x()) * (ns / old),
        y: ptr.y - (ptr.y - stage.y()) * (ns / old),
      })
      setZoom(Math.round(ns * 100))
      stage.batchDraw()
    })

    // resize
    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return
      const nw = containerRef.current.offsetWidth
      const nh = containerRef.current.offsetHeight
      stage.width(nw); stage.height(nh)
      drawGrid(gridLayer, nw, nh, GRID_STEP)
    })
    ro.observe(containerRef.current)
    return () => { ro.disconnect(); stage.destroy() }
  }, [])

  // ---- Snap helper ----
  const getPos = useCallback(() => {
    const stage = stageRef.current!
    const raw = stage.getRelativePointerPosition()!
    return snapEnabled
      ? { x: snapToGrid(raw.x, GRID_STEP), y: snapToGrid(raw.y, GRID_STEP) }
      : raw
  }, [snapEnabled])

  // ---- Registra objeto permanente ----
  const registerNode = useCallback((node: Konva.Node, type: DrawnObject["type"]) => {
    const layer = layerRef.current!
    const tr    = trRef.current!
    const id    = crypto.randomUUID()
    node.id(id)
    node.draggable(true)

    // selecionar ao clicar
    const selectThis = () => {
      if (["line","wall"].includes(type)) return   // linhas não usam transformer
      tr.nodes([node])
      setSelectedId(id)
      layer.batchDraw()
    }
    node.on("click tap", selectThis)

    setObjects(prev => [...prev, { id, type }])
    setSelectedId(id)
    if (!["line","wall"].includes(type)) tr.nodes([node])
    layer.batchDraw()
  }, [])

  // ---- Cancelar polígono ----
  const cancelPolygon = useCallback(() => {
    polyPoints.current = []
    polyLines.current.forEach(l => l.destroy())
    polyLines.current = []
    polyDots.current.forEach(d => d.destroy())
    polyDots.current = []
    polyPreview.current?.destroy()
    polyPreview.current = null
    layerRef.current?.batchDraw()
  }, [])

  // ---- Fechar polígono ----
  const closePolygon = useCallback(() => {
    const pts = polyPoints.current
    if (pts.length < 6) { cancelPolygon(); return }

    const layer = layerRef.current!
    // limpa auxiliares
    polyLines.current.forEach(l => l.destroy())
    polyDots.current.forEach(d => d.destroy())
    polyPreview.current?.destroy()
    polyLines.current = []; polyDots.current = []; polyPreview.current = null

    const poly = new Konva.Line({
      points: pts,
      closed: true,
      fill: "rgba(139,92,246,0.15)",
      stroke: "#8b5cf6",
      strokeWidth: 1.5,
    })
    layer.add(poly)
    registerNode(poly, "polygon")
    polyPoints.current = []
  }, [registerNode, cancelPolygon])

  // ---- Bindings de mouse por ferramenta ----
  useEffect(() => {
    const stage = stageRef.current
    const layer = layerRef.current
    if (!stage || !layer) return

    stage.draggable(tool === "pan")
    stage.container().style.cursor =
      tool === "pan"     ? "grab"      :
      tool === "select"  ? "default"   : "crosshair"

    stage.off("mousedown.t mousemove.t mouseup.t click.t dblclick.t")

    // ---- RECT ----
    if (tool === "rect") {
      stage.on("mousedown.t", (e) => {
        if (e.target !== stage) return
        isDrawing.current = true
        drawStart.current = getPos()
        const r = new Konva.Rect({
          ...drawStart.current, width: 0, height: 0,
          fill: "rgba(59,130,246,0.15)", stroke: "#3b82f6",
          strokeWidth: 1.5, dash: [4, 3],
        })
        layer.add(r); previewNode.current = r
      })
      stage.on("mousemove.t", () => {
        if (!isDrawing.current) return
        const p = getPos()
        const r = previewNode.current as Konva.Rect
        r.setAttrs({
          x: Math.min(p.x, drawStart.current.x),
          y: Math.min(p.y, drawStart.current.y),
          width: Math.abs(p.x - drawStart.current.x),
          height: Math.abs(p.y - drawStart.current.y),
        })
        layer.batchDraw()
      })
      stage.on("mouseup.t", () => {
        if (!isDrawing.current) return
        isDrawing.current = false
        const r = previewNode.current as Konva.Rect
        if (r.width() < 8 || r.height() < 8) { r.destroy(); previewNode.current = null; return }
        r.dash([]); previewNode.current = null
        registerNode(r, "rect")
      })
    }

    // ---- LINE ----
    if (tool === "line") {
      stage.on("mousedown.t", (e) => {
        if (e.target !== stage) return
        isDrawing.current = true
        const p = getPos()
        drawStart.current = p
        const l = new Konva.Line({
          points: [p.x, p.y, p.x, p.y],
          stroke: "#64748b", strokeWidth: 1.5, lineCap: "round",
        })
        layer.add(l); previewNode.current = l
      })
      stage.on("mousemove.t", () => {
        if (!isDrawing.current) return
        const p = getPos()
        const l = previewNode.current as Konva.Line
        l.points([drawStart.current.x, drawStart.current.y, p.x, p.y])
        layer.batchDraw()
      })
      stage.on("mouseup.t", () => {
        if (!isDrawing.current) return
        isDrawing.current = false
        const l = previewNode.current as Konva.Line
        const pts = l.points()
        const dx = pts[2] - pts[0], dy = pts[3] - pts[1]
        if (Math.hypot(dx, dy) < 8) { l.destroy(); previewNode.current = null; return }
        previewNode.current = null
        registerNode(l, "line")
      })
    }

    // ---- WALL ----
    if (tool === "wall") {
      stage.on("mousedown.t", (e) => {
        if (e.target !== stage) return
        isDrawing.current = true
        const p = getPos()
        drawStart.current = p
        // parede = grupo com linha central + 2 bordas
        const group = new Konva.Group()
        const inner = new Konva.Line({
          points: [0, 0, 0, 0],
          stroke: "#94a3b8", strokeWidth: WALL_WIDTH,
          lineCap: "butt",
        })
        const border1 = new Konva.Line({
          points: [0, 0, 0, 0],
          stroke: "#cbd5e1", strokeWidth: 1, lineCap: "butt",
        })
        const border2 = border1.clone()
        group.add(inner, border1, border2)
        group.position(p)
        layer.add(group); previewNode.current = group
      })
      stage.on("mousemove.t", () => {
        if (!isDrawing.current) return
        const p  = getPos()
        const gr = previewNode.current as Konva.Group
        const s  = drawStart.current
        const dx = p.x - s.x, dy = p.y - s.y
        const len = Math.hypot(dx, dy)
        if (len < 1) return
        const nx = -dy / len * (WALL_WIDTH / 2)
        const ny =  dx / len * (WALL_WIDTH / 2)
        const lines = gr.children as Konva.Line[]
        lines[0].points([0, 0, dx, dy])
        lines[1].points([nx, ny, dx + nx, dy + ny])
        lines[2].points([-nx, -ny, dx - nx, dy - ny])
        layer.batchDraw()
      })
      stage.on("mouseup.t", () => {
        if (!isDrawing.current) return
        isDrawing.current = false
        const gr = previewNode.current as Konva.Group
        const lines = gr.children as Konva.Line[]
        const pts = lines[0].points()
        if (Math.hypot(pts[2], pts[3]) < 8) { gr.destroy(); previewNode.current = null; return }
        previewNode.current = null
        registerNode(gr, "wall")
      })
    }

    // ---- POLYGON ----
    if (tool === "polygon") {
      stage.on("click.t", (e) => {
        if (e.target !== stage && !(e.target instanceof Konva.Circle)) return
        const p = getPos()

        // primeiro ponto
        if (polyPoints.current.length === 0) {
          const dot = new Konva.Circle({
            x: p.x, y: p.y, radius: 5,
            fill: "#8b5cf6", stroke: "#c4b5fd", strokeWidth: 1,
          })
          dot.on("click", () => closePolygon())
          layer.add(dot)
          polyDots.current.push(dot)
          polyPoints.current = [p.x, p.y]

          const preview = new Konva.Line({
            points: [p.x, p.y, p.x, p.y],
            stroke: "#8b5cf6", strokeWidth: 1.5, dash: [4, 3],
          })
          layer.add(preview); polyPreview.current = preview
        } else {
          // segmento confirmado
          const pts = polyPoints.current
          const seg = new Konva.Line({
            points: [pts[pts.length - 2], pts[pts.length - 1], p.x, p.y],
            stroke: "#8b5cf6", strokeWidth: 1.5,
          })
          layer.add(seg); polyLines.current.push(seg)
          polyPoints.current.push(p.x, p.y)

          // dot clicável para fechar
          const dot = new Konva.Circle({
            x: p.x, y: p.y, radius: 4,
            fill: "#7c3aed", stroke: "#c4b5fd", strokeWidth: 1,
          })
          dot.on("click", () => closePolygon())
          layer.add(dot); polyDots.current.push(dot)
        }
        layer.batchDraw()
      })

      stage.on("mousemove.t", () => {
        if (polyPoints.current.length === 0 || !polyPreview.current) return
        const p   = getPos()
        const pts = polyPoints.current
        polyPreview.current.points([pts[pts.length - 2], pts[pts.length - 1], p.x, p.y])
        layer.batchDraw()
      })

      stage.on("dblclick.t", () => closePolygon())
    }

    return () => { stage.off("mousedown.t mousemove.t mouseup.t click.t dblclick.t") }
  }, [tool, getPos, registerNode, closePolygon, cancelPolygon])

  // ---- Teclas de atalho ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["INPUT","TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === "v" || e.key === "V") setTool("select")
      if (e.key === "h" || e.key === "H") setTool("pan")
      if (e.key === "r" || e.key === "R") setTool("rect")
      if (e.key === "l" || e.key === "L") setTool("line")
      if (e.key === "w" || e.key === "W") setTool("wall")
      if (e.key === "p" || e.key === "P") setTool("polygon")
      if (e.key === "Escape") { cancelPolygon(); setTool("select") }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) deleteSelected()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedId, cancelPolygon])

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    const layer = layerRef.current!
    layer.findOne(`#${selectedId}`)?.destroy()
    trRef.current?.nodes([])
    setObjects(prev => prev.filter(o => o.id !== selectedId))
    setSelectedId(null)
    layer.batchDraw()
  }, [selectedId])

  const changeZoom = (factor: number) => {
    const s = stageRef.current; if (!s) return
    const ns = Math.min(Math.max(s.scaleX() * factor, 0.2), 5)
    s.scale({ x: ns, y: ns }); setZoom(Math.round(ns * 100)); s.batchDraw()
  }
  const resetZoom = () => {
    const s = stageRef.current; if (!s) return
    s.scale({ x: 1, y: 1 }); s.position({ x: 0, y: 0 })
    setZoom(100); s.batchDraw()
  }

  // ---- Render ----
  return (
    <div className="flex flex-col h-full bg-slate-950 select-none">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0 flex-wrap">

        {/* Ferramentas */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <TBtn active={tool==="select"} onClick={()=>setTool("select")} title="Selecionar (V)">
            <IconSelect/>
          </TBtn>
          <TBtn active={tool==="pan"} onClick={()=>setTool("pan")} title="Mover canvas (H)">
            <IconHand/>
          </TBtn>
        </div>

        <Sep/>

        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <TBtn active={tool==="rect"} onClick={()=>setTool("rect")} title="Retângulo (R)">
            <IconRect/>
          </TBtn>
          <TBtn active={tool==="line"} onClick={()=>setTool("line")} title="Linha (L)">
            <IconLine/>
          </TBtn>
          <TBtn active={tool==="wall"} onClick={()=>setTool("wall")} title="Parede (W)">
            <IconWall/>
          </TBtn>
          <TBtn active={tool==="polygon"} onClick={()=>setTool("polygon")} title="Polígono (P) — duplo-clique para fechar">
            <IconPoly/>
          </TBtn>
        </div>

        <Sep/>

        {/* Zoom */}
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <TBtn active={false} onClick={()=>changeZoom(1.2)} title="Zoom in">
            <span className="text-sm font-bold">+</span>
          </TBtn>
          <button onClick={resetZoom} className="font-mono w-14 text-center text-xs text-slate-400 hover:text-white transition-colors">
            {zoom}%
          </button>
          <TBtn active={false} onClick={()=>changeZoom(1/1.2)} title="Zoom out">
            <span className="text-sm font-bold">−</span>
          </TBtn>
        </div>

        <Sep/>

        {/* Snap */}
        <button
          onClick={() => setSnapEnabled(v => !v)}
          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${
            snapEnabled ? "text-blue-400 bg-blue-950/40 border border-blue-800/40" : "text-slate-500 hover:text-slate-300"
          }`}
          title="Snap na grade"
        >
          <IconGrid/> Snap
        </button>

        {/* Dica polígono */}
        {tool === "polygon" && (
          <span className="text-[11px] text-purple-400 ml-2">
            Clique para adicionar pontos · clique no 1º ponto ou duplo-clique para fechar · Esc cancela
          </span>
        )}

        {/* Deletar */}
        {selectedId && (
          <>
            <Sep/>
            <button onClick={deleteSelected} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-950/40 border border-red-900/40 transition-colors">
              <IconTrash/> Deletar
            </button>
          </>
        )}

        <div className="ml-auto text-xs text-slate-700 font-mono">{objects.length} obj</div>
      </div>

      {/* ── Canvas ── */}
      <div ref={containerRef} className="flex-1 w-full" />
    </div>
  )
}

// ── Sub-componentes ──
function Sep() { return <div className="w-px h-5 bg-slate-700 mx-1" /> }

function TBtn({ active, onClick, title, children }: {
  active: boolean; onClick: () => void; title: string; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} title={title} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
      active ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"
    }`}>
      {children}
    </button>
  )
}

// Ícones inline SVG
const IconSelect = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l14 9-7 1-4 7z"/></svg>
const IconHand   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8V9a2 2 0 1 1 4 0"/></svg>
const IconRect   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
const IconLine   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5"/></svg>
const IconWall   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="9" width="20" height="6" rx="1"/><line x1="2" y1="12" x2="22" y2="12" strokeDasharray="3 3"/></svg>
const IconPoly   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 22,20 2,20"/></svg>
const IconGrid   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>
const IconTrash  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>
