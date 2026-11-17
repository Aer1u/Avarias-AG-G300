// ============================================================
// NEXUS ERP — MapLibrary / elements / architectural.ts
// Elementos arquitetônicos da biblioteca vetorial.
// Vista superior (top-down). Sem dependências externas de ícones.
// ============================================================

import React from "react"
import Konva from "konva"
import type { MapElementDefinition, SvgPreviewProps, MapObject } from "../types"
import { MAP_COLORS } from "../types"

// ── 1. wall — Parede ─────────────────────────────────────────
const wall: MapElementDefinition = {
  type: "wall",
  category: "architectural",
  label: "Parede",
  description: "Parede estrutural sólida (vista superior)",
  defaultWidth: 120,
  defaultHeight: 12,
  defaultProps: { thickness: 12 },
  propsSchema: [
    { key: "thickness", label: "Espessura", type: "number", min: 4, max: 60, step: 2, unit: "px" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: `0 0 ${width} ${height}`, xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", {
        x: 0,
        y: 0,
        width,
        height,
        fill: MAP_COLORS.wall.fill,
        stroke: MAP_COLORS.wall.stroke,
        strokeWidth: 2,
      })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: obj.width,
        height: obj.height,
        fill: MAP_COLORS.wall.fill,
        stroke: MAP_COLORS.wall.stroke,
        strokeWidth: 2,
      })
    )
    return group
  },
}

// ── 2. partition — Parede Divisória ──────────────────────────
const partition: MapElementDefinition = {
  type: "partition",
  category: "architectural",
  label: "Parede Divisória",
  description: "Parede divisória leve com hachura diagonal (vista superior)",
  defaultWidth: 100,
  defaultHeight: 6,
  defaultProps: { thickness: 6 },
  propsSchema: [
    { key: "thickness", label: "Espessura", type: "number", min: 4, max: 60, step: 2, unit: "px" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) => {
    // Hachura: linhas diagonais dentro do retângulo
    const spacing = 6
    const lines: React.ReactElement[] = []
    for (let i = -height; i < width + height; i += spacing) {
      lines.push(
        React.createElement("line", {
          key: i,
          x1: i,
          y1: 0,
          x2: i + height,
          y2: height,
          stroke: MAP_COLORS.wall.stroke,
          strokeWidth: 0.8,
          opacity: 0.7,
        })
      )
    }
    return React.createElement(
      "svg",
      { width, height, viewBox: `0 0 ${width} ${height}`, xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", {
        x: 0,
        y: 0,
        width,
        height,
        fill: "#334155",
        stroke: MAP_COLORS.wall.stroke,
        strokeWidth: 1.5,
      }),
      React.createElement(
        "clipPath",
        { id: "partition-clip" },
        React.createElement("rect", { x: 0, y: 0, width, height })
      ),
      React.createElement("g", { clipPath: "url(#partition-clip)" }, ...lines)
    )
  },
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: obj.width,
        height: obj.height,
        fill: "#334155",
        stroke: MAP_COLORS.wall.stroke,
        strokeWidth: 1.5,
      })
    )
    // Hachura diagonal
    const spacing = 8
    for (let i = -obj.height; i < obj.width + obj.height; i += spacing) {
      group.add(
        new Konva.Line({
          points: [i, 0, i + obj.height, obj.height],
          stroke: MAP_COLORS.wall.stroke,
          strokeWidth: 0.8,
          opacity: 0.7,
        })
      )
    }
    return group
  },
}

// ── 3. door — Porta ──────────────────────────────────────────
const door: MapElementDefinition = {
  type: "door",
  category: "architectural",
  label: "Porta",
  description: "Porta com folha e arco de abertura 90° (vista superior)",
  defaultWidth: 60,
  defaultHeight: 60,
  defaultProps: { width: 60, swing: "left" },
  propsSchema: [
    {
      key: "swing",
      label: "Abertura",
      type: "select",
      options: [
        { value: "left", label: "Esquerda" },
        { value: "right", label: "Direita" },
      ],
    },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) => {
    const swing = "left"
    // Linha de parede nos extremos, gap no meio para a porta
    // Folha: linha da borda inferior até o pivot
    // Arco: quarto de círculo
    const wallThick = 4
    const doorW = width
    const arcR = doorW

    // pivot no canto (swing=left: pivot no lado esquerdo)
    const pivotX = swing === "left" ? 0 : width
    const arcStartX = swing === "left" ? doorW : 0
    const arcEndY = wallThick

    return React.createElement(
      "svg",
      { width, height, viewBox: `0 0 ${width} ${height}`, xmlns: "http://www.w3.org/2000/svg" },
      // Parede (topo = borda da abertura)
      React.createElement("line", {
        x1: 0, y1: 0, x2: width, y2: 0,
        stroke: MAP_COLORS.wall.fill, strokeWidth: wallThick,
      }),
      // Folha da porta
      React.createElement("line", {
        x1: pivotX,
        y1: wallThick / 2,
        x2: swing === "left" ? width : 0,
        y2: height,
        stroke: MAP_COLORS.door.stroke,
        strokeWidth: 1,
      }),
      // Arco de abertura
      React.createElement("path", {
        d: swing === "left"
          ? `M ${width} ${wallThick / 2} A ${arcR} ${arcR} 0 0 0 ${pivotX} ${height}`
          : `M 0 ${wallThick / 2} A ${arcR} ${arcR} 0 0 1 ${width} ${height}`,
        fill: "none",
        stroke: MAP_COLORS.door.stroke,
        strokeWidth: 1,
        strokeDasharray: "3 2",
        opacity: 0.8,
      })
    )
  },
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const swing = (obj.props.swing as string) ?? "left"
    const wallThick = 4
    const doorW = obj.width
    const pivotX = swing === "left" ? 0 : doorW

    // Parede (linha)
    group.add(
      new Konva.Line({
        points: [0, 0, doorW, 0],
        stroke: MAP_COLORS.wall.fill,
        strokeWidth: wallThick,
      })
    )
    // Folha da porta
    group.add(
      new Konva.Line({
        points: [
          pivotX,
          wallThick / 2,
          swing === "left" ? doorW : 0,
          obj.height,
        ],
        stroke: MAP_COLORS.door.stroke,
        strokeWidth: 1,
      })
    )
    // Arco (90°): Konva.Arc usa ângulos em graus
    group.add(
      new Konva.Arc({
        x: pivotX,
        y: wallThick / 2,
        innerRadius: 0,
        outerRadius: doorW,
        angle: 90,
        rotation: swing === "left" ? 0 : 90,
        fill: "transparent",
        stroke: MAP_COLORS.door.stroke,
        strokeWidth: 1,
        dash: [3, 2],
        opacity: 0.8,
      })
    )
    return group
  },
}

// ── 4. window — Janela ───────────────────────────────────────
const window_: MapElementDefinition = {
  type: "window",
  category: "architectural",
  label: "Janela",
  description: "Janela com vidro (vista superior)",
  defaultWidth: 80,
  defaultHeight: 12,
  defaultProps: { thickness: 12, panes: 3 },
  propsSchema: [
    { key: "thickness", label: "Espessura", type: "number", min: 4, max: 40, step: 2, unit: "px" },
    { key: "panes", label: "Divisões de vidro", type: "number", min: 1, max: 6, step: 1 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) => {
    const panes = 3
    const paneLines: React.ReactElement[] = []
    // Linhas internas paralelas para simular vidro
    for (let i = 1; i <= panes; i++) {
      const y = (height / (panes + 1)) * i
      paneLines.push(
        React.createElement("line", {
          key: i,
          x1: 2,
          y1: y,
          x2: width - 2,
          y2: y,
          stroke: MAP_COLORS.window.stroke,
          strokeWidth: 0.8,
          opacity: 0.9,
        })
      )
    }
    return React.createElement(
      "svg",
      { width, height, viewBox: `0 0 ${width} ${height}`, xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", {
        x: 0, y: 0, width, height,
        fill: MAP_COLORS.window.fill,
        stroke: MAP_COLORS.window.stroke,
        strokeWidth: 1.5,
      }),
      ...paneLines
    )
  },
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const panes = (obj.props.panes as number) ?? 3
    group.add(
      new Konva.Rect({
        x: 0, y: 0,
        width: obj.width,
        height: obj.height,
        fill: MAP_COLORS.window.fill,
        stroke: MAP_COLORS.window.stroke,
        strokeWidth: 1.5,
      })
    )
    for (let i = 1; i <= panes; i++) {
      const y = (obj.height / (panes + 1)) * i
      group.add(
        new Konva.Line({
          points: [2, y, obj.width - 2, y],
          stroke: MAP_COLORS.window.stroke,
          strokeWidth: 0.8,
          opacity: 0.9,
        })
      )
    }
    return group
  },
}

// ── 5. column — Coluna ───────────────────────────────────────
const column: MapElementDefinition = {
  type: "column",
  category: "architectural",
  label: "Coluna",
  description: "Coluna estrutural quadrada ou redonda (vista superior)",
  defaultWidth: 20,
  defaultHeight: 20,
  defaultProps: { size: 20, shape: "square" },
  propsSchema: [
    { key: "size", label: "Tamanho", type: "number", min: 10, max: 60, step: 2, unit: "px" },
    {
      key: "shape",
      label: "Formato",
      type: "select",
      options: [
        { value: "square", label: "Quadrada" },
        { value: "round", label: "Redonda" },
      ],
    },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) => {
    const cx = width / 2
    const cy = height / 2
    const r = Math.min(width, height) / 2 - 1
    return React.createElement(
      "svg",
      { width, height, viewBox: `0 0 ${width} ${height}`, xmlns: "http://www.w3.org/2000/svg" },
      // Square representation in preview
      React.createElement("rect", {
        x: 1, y: 1, width: width - 2, height: height - 2,
        fill: MAP_COLORS.column.fill,
        stroke: MAP_COLORS.column.stroke,
        strokeWidth: 1.5,
      }),
      // X interno (hachura cruzada)
      React.createElement("line", { x1: 2, y1: 2, x2: width - 2, y2: height - 2, stroke: MAP_COLORS.column.stroke, strokeWidth: 1 }),
      React.createElement("line", { x1: width - 2, y1: 2, x2: 2, y2: height - 2, stroke: MAP_COLORS.column.stroke, strokeWidth: 1 })
    )
  },
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const shape = (obj.props.shape as string) ?? "square"
    const size = obj.width

    if (shape === "round") {
      const r = size / 2
      group.add(
        new Konva.Circle({
          x: r, y: r, radius: r,
          fill: MAP_COLORS.column.fill,
          stroke: MAP_COLORS.column.stroke,
          strokeWidth: 1.5,
        })
      )
      // X interno
      group.add(new Konva.Line({ points: [2, 2, size - 2, size - 2], stroke: MAP_COLORS.column.stroke, strokeWidth: 1 }))
      group.add(new Konva.Line({ points: [size - 2, 2, 2, size - 2], stroke: MAP_COLORS.column.stroke, strokeWidth: 1 }))
    } else {
      group.add(
        new Konva.Rect({
          x: 0, y: 0, width: size, height: size,
          fill: MAP_COLORS.column.fill,
          stroke: MAP_COLORS.column.stroke,
          strokeWidth: 1.5,
        })
      )
      // X interno
      group.add(new Konva.Line({ points: [2, 2, size - 2, size - 2], stroke: MAP_COLORS.column.stroke, strokeWidth: 1 }))
      group.add(new Konva.Line({ points: [size - 2, 2, 2, size - 2], stroke: MAP_COLORS.column.stroke, strokeWidth: 1 }))
    }
    return group
  },
}

// ── 6. stairs — Escada ───────────────────────────────────────
const stairs: MapElementDefinition = {
  type: "stairs",
  category: "architectural",
  label: "Escada",
  description: "Escada com degraus (vista superior)",
  defaultWidth: 60,
  defaultHeight: 100,
  defaultProps: { steps: 8, direction: "up" },
  propsSchema: [
    { key: "steps", label: "Número de degraus", type: "number", min: 2, max: 20, step: 1 },
    {
      key: "direction",
      label: "Direção de subida",
      type: "select",
      options: [
        { value: "up", label: "Para cima" },
        { value: "down", label: "Para baixo" },
      ],
    },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) => {
    const steps = 8
    const stepH = height / steps
    const lines: React.ReactElement[] = []
    for (let i = 1; i < steps; i++) {
      const y = i * stepH
      lines.push(
        React.createElement("line", {
          key: i,
          x1: 0, y1: y, x2: width, y2: y,
          stroke: "#94a3b8",
          strokeWidth: 1,
        })
      )
    }
    return React.createElement(
      "svg",
      { width, height, viewBox: `0 0 ${width} ${height}`, xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", {
        x: 0, y: 0, width, height,
        fill: "#1e293b",
        stroke: "#64748b",
        strokeWidth: 1.5,
      }),
      ...lines,
      // Seta indicadora de subida
      React.createElement("polygon", {
        points: `${width / 2},4 ${width / 2 - 6},14 ${width / 2 + 6},14`,
        fill: "#94a3b8",
        opacity: 0.8,
      })
    )
  },
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const steps = (obj.props.steps as number) ?? 8
    const stepH = obj.height / steps

    group.add(
      new Konva.Rect({
        x: 0, y: 0, width: obj.width, height: obj.height,
        fill: "#1e293b",
        stroke: "#64748b",
        strokeWidth: 1.5,
      })
    )
    for (let i = 1; i < steps; i++) {
      const y = i * stepH
      group.add(
        new Konva.Line({
          points: [0, y, obj.width, y],
          stroke: "#94a3b8",
          strokeWidth: 1,
        })
      )
    }
    // Seta de direção
    const arrowY = obj.props.direction === "down" ? obj.height - 14 : 4
    group.add(
      new Konva.Line({
        points: [
          obj.width / 2, arrowY,
          obj.width / 2 - 6, arrowY + 10,
          obj.width / 2 + 6, arrowY + 10,
          obj.width / 2, arrowY,
        ],
        fill: "#94a3b8",
        stroke: "#94a3b8",
        strokeWidth: 1,
        closed: true,
        opacity: 0.8,
      })
    )
    return group
  },
}

// ── 7. ramp — Rampa ──────────────────────────────────────────
const ramp: MapElementDefinition = {
  type: "ramp",
  category: "architectural",
  label: "Rampa",
  description: "Rampa com seta de sentido de subida (vista superior)",
  defaultWidth: 80,
  defaultHeight: 40,
  defaultProps: { direction: "up" },
  propsSchema: [
    {
      key: "direction",
      label: "Sentido",
      type: "select",
      options: [
        { value: "up", label: "Subindo" },
        { value: "down", label: "Descendo" },
      ],
    },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) => {
    // Seta diagonal de canto a canto
    const arrowTip = { x: width - 6, y: 6 }
    const arrowBase = { x: 6, y: height - 6 }
    return React.createElement(
      "svg",
      { width, height, viewBox: `0 0 ${width} ${height}`, xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", {
        x: 0, y: 0, width, height,
        fill: "#1e293b",
        stroke: "#64748b",
        strokeWidth: 1.5,
      }),
      // Linha diagonal
      React.createElement("line", {
        x1: arrowBase.x, y1: arrowBase.y,
        x2: arrowTip.x, y2: arrowTip.y,
        stroke: "#94a3b8",
        strokeWidth: 1.5,
      }),
      // Cabeça da seta (triângulo no canto superior direito)
      React.createElement("polygon", {
        points: `${arrowTip.x},${arrowTip.y} ${arrowTip.x - 10},${arrowTip.y} ${arrowTip.x},${arrowTip.y + 10}`,
        fill: "#94a3b8",
      }),
      // Linha curta na base
      React.createElement("line", {
        x1: 2, y1: height - 2,
        x2: width * 0.3, y2: height - 2,
        stroke: "#64748b",
        strokeWidth: 2,
      })
    )
  },
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    group.add(
      new Konva.Rect({
        x: 0, y: 0, width: obj.width, height: obj.height,
        fill: "#1e293b",
        stroke: "#64748b",
        strokeWidth: 1.5,
      })
    )
    const dir = (obj.props.direction as string) ?? "up"
    const ax = dir === "up" ? obj.width - 6 : 6
    const ay = dir === "up" ? 6 : obj.height - 6
    const bx = dir === "up" ? 6 : obj.width - 6
    const by = dir === "up" ? obj.height - 6 : 6

    group.add(new Konva.Line({ points: [bx, by, ax, ay], stroke: "#94a3b8", strokeWidth: 1.5 }))
    // Ponta da seta
    group.add(
      new Konva.Line({
        points: [ax, ay, ax - 10 * (dir === "up" ? 0 : -1), ay, ax, ay + 10],
        stroke: "#94a3b8",
        fill: "#94a3b8",
        strokeWidth: 1,
        closed: true,
      })
    )
    // Base
    group.add(
      new Konva.Line({
        points: dir === "up"
          ? [0, obj.height, obj.width * 0.3, obj.height]
          : [obj.width * 0.7, 0, obj.width, 0],
        stroke: "#64748b",
        strokeWidth: 2,
      })
    )
    return group
  },
}

// ── 8. gate — Portão ─────────────────────────────────────────
const gate: MapElementDefinition = {
  type: "gate",
  category: "architectural",
  label: "Portão",
  description: "Portão com batentes laterais e folhas (vista superior)",
  defaultWidth: 80,
  defaultHeight: 16,
  defaultProps: { opening: 80, type: "single" },
  propsSchema: [
    { key: "opening", label: "Largura da abertura", type: "number", min: 40, max: 200, step: 4, unit: "px" },
    {
      key: "type",
      label: "Tipo",
      type: "select",
      options: [
        { value: "single", label: "Folha simples" },
        { value: "double", label: "Folha dupla" },
      ],
    },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) => {
    const poleW = width * 0.12
    const gateType = "double"
    const midX = width / 2
    return React.createElement(
      "svg",
      { width, height, viewBox: `0 0 ${width} ${height}`, xmlns: "http://www.w3.org/2000/svg" },
      // Batente esquerdo
      React.createElement("rect", { x: 0, y: 0, width: poleW, height, fill: MAP_COLORS.wall.fill, stroke: MAP_COLORS.wall.stroke, strokeWidth: 1.5 }),
      // Batente direito
      React.createElement("rect", { x: width - poleW, y: 0, width: poleW, height, fill: MAP_COLORS.wall.fill, stroke: MAP_COLORS.wall.stroke, strokeWidth: 1.5 }),
      // Folha(s)
      gateType === "double"
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement("line", { x1: poleW, y1: height / 2, x2: midX - 2, y2: height / 2, stroke: "#94a3b8", strokeWidth: 2 }),
            React.createElement("line", { x1: midX + 2, y1: height / 2, x2: width - poleW, y2: height / 2, stroke: "#94a3b8", strokeWidth: 2 })
          )
        : React.createElement("line", { x1: poleW, y1: height / 2, x2: width - poleW, y2: height / 2, stroke: "#94a3b8", strokeWidth: 2 })
    )
  },
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const poleW = obj.width * 0.12
    const gateType = (obj.props.type as string) ?? "single"
    const midX = obj.width / 2

    // Batentes
    group.add(new Konva.Rect({ x: 0, y: 0, width: poleW, height: obj.height, fill: MAP_COLORS.wall.fill, stroke: MAP_COLORS.wall.stroke, strokeWidth: 1.5 }))
    group.add(new Konva.Rect({ x: obj.width - poleW, y: 0, width: poleW, height: obj.height, fill: MAP_COLORS.wall.fill, stroke: MAP_COLORS.wall.stroke, strokeWidth: 1.5 }))

    // Folhas
    if (gateType === "double") {
      group.add(new Konva.Line({ points: [poleW, obj.height / 2, midX - 2, obj.height / 2], stroke: "#94a3b8", strokeWidth: 2 }))
      group.add(new Konva.Line({ points: [midX + 2, obj.height / 2, obj.width - poleW, obj.height / 2], stroke: "#94a3b8", strokeWidth: 2 }))
    } else {
      group.add(new Konva.Line({ points: [poleW, obj.height / 2, obj.width - poleW, obj.height / 2], stroke: "#94a3b8", strokeWidth: 2 }))
    }
    return group
  },
}

// ── 9. elevator — Elevador ───────────────────────────────────
const elevator: MapElementDefinition = {
  type: "elevator",
  category: "architectural",
  label: "Elevador",
  description: "Elevador com borda dupla, cruz interna e seta (vista superior)",
  defaultWidth: 60,
  defaultHeight: 60,
  defaultProps: { width: 60, depth: 60 },
  propsSchema: [
    { key: "width", label: "Largura", type: "number", min: 40, max: 120, step: 4, unit: "px" },
    { key: "depth", label: "Profundidade", type: "number", min: 40, max: 120, step: 4, unit: "px" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) => {
    const pad = 4
    const cx = width / 2
    const cy = height / 2
    return React.createElement(
      "svg",
      { width, height, viewBox: `0 0 ${width} ${height}`, xmlns: "http://www.w3.org/2000/svg" },
      // Borda externa
      React.createElement("rect", { x: 0, y: 0, width, height, fill: "#1e293b", stroke: "#64748b", strokeWidth: 2 }),
      // Borda interna
      React.createElement("rect", { x: pad, y: pad, width: width - pad * 2, height: height - pad * 2, fill: "none", stroke: "#64748b", strokeWidth: 1 }),
      // Cruz interna
      React.createElement("line", { x1: pad, y1: cy, x2: width - pad, y2: cy, stroke: "#94a3b8", strokeWidth: 1 }),
      React.createElement("line", { x1: cx, y1: pad, x2: cx, y2: height - pad, stroke: "#94a3b8", strokeWidth: 1 }),
      // Seta vertical para cima
      React.createElement("polygon", {
        points: `${cx},${pad + 4} ${cx - 5},${pad + 12} ${cx + 5},${pad + 12}`,
        fill: "#94a3b8",
      })
    )
  },
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const pad = 4
    const cx = obj.width / 2
    const cy = obj.height / 2

    // Borda externa
    group.add(new Konva.Rect({ x: 0, y: 0, width: obj.width, height: obj.height, fill: "#1e293b", stroke: "#64748b", strokeWidth: 2 }))
    // Borda interna
    group.add(new Konva.Rect({ x: pad, y: pad, width: obj.width - pad * 2, height: obj.height - pad * 2, fill: "transparent", stroke: "#64748b", strokeWidth: 1 }))
    // Cruz
    group.add(new Konva.Line({ points: [pad, cy, obj.width - pad, cy], stroke: "#94a3b8", strokeWidth: 1 }))
    group.add(new Konva.Line({ points: [cx, pad, cx, obj.height - pad], stroke: "#94a3b8", strokeWidth: 1 }))
    // Seta vertical
    group.add(
      new Konva.Line({
        points: [cx, pad + 4, cx - 5, pad + 12, cx + 5, pad + 12, cx, pad + 4],
        fill: "#94a3b8",
        stroke: "#94a3b8",
        strokeWidth: 1,
        closed: true,
      })
    )
    return group
  },
}

// ── 10. delimited_area — Área Delimitada ─────────────────────
const delimited_area: MapElementDefinition = {
  type: "delimited_area",
  category: "architectural",
  label: "Área Delimitada",
  description: "Área delimitada com borda tracejada e fill semitransparente (vista superior)",
  defaultWidth: 160,
  defaultHeight: 120,
  defaultProps: { label: "", borderStyle: "dashed" },
  propsSchema: [
    { key: "label", label: "Rótulo", type: "text" },
    {
      key: "borderStyle",
      label: "Estilo da borda",
      type: "select",
      options: [
        { value: "dashed", label: "Tracejado" },
        { value: "solid", label: "Sólido" },
        { value: "dotted", label: "Pontilhado" },
      ],
    },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) => {
    const dashMap: Record<string, string> = {
      dashed: "6 3",
      solid: "none",
      dotted: "2 3",
    }
    const dash = dashMap["dashed"]
    return React.createElement(
      "svg",
      { width, height, viewBox: `0 0 ${width} ${height}`, xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", {
        x: 1, y: 1, width: width - 2, height: height - 2,
        fill: MAP_COLORS.area.fill,
        stroke: MAP_COLORS.area.stroke,
        strokeWidth: 1.5,
        strokeDasharray: dash === "none" ? undefined : dash,
      }),
      React.createElement(
        "text",
        {
          x: width / 2, y: height / 2 + 4,
          textAnchor: "middle",
          fill: MAP_COLORS.area.stroke,
          fontSize: 10,
          fontFamily: "sans-serif",
          opacity: 0.8,
        },
        "Área"
      )
    )
  },
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const borderStyle = (obj.props.borderStyle as string) ?? "dashed"
    const dashMap: Record<string, number[]> = {
      dashed: [6, 3],
      solid: [],
      dotted: [2, 3],
    }
    const dash = dashMap[borderStyle] ?? [6, 3]

    group.add(
      new Konva.Rect({
        x: 0, y: 0,
        width: obj.width,
        height: obj.height,
        fill: MAP_COLORS.area.fill,
        stroke: MAP_COLORS.area.stroke,
        strokeWidth: 1.5,
        dash: dash.length > 0 ? dash : undefined,
      })
    )

    const label = (obj.props.label as string) ?? ""
    if (label) {
      group.add(
        new Konva.Text({
          x: 0,
          y: obj.height / 2 - 7,
          width: obj.width,
          text: label,
          align: "center",
          fill: MAP_COLORS.area.stroke,
          fontSize: 12,
          fontFamily: "sans-serif",
          opacity: 0.9,
        })
      )
    }
    return group
  },
}

// ── Exportação ────────────────────────────────────────────────
export const architecturalElements: MapElementDefinition[] = [
  wall,
  partition,
  door,
  window_,
  column,
  stairs,
  ramp,
  gate,
  elevator,
  delimited_area,
]
