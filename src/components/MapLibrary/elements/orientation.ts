// ============================================================
// NEXUS ERP — MapLibrary / elements / orientation.ts
// Grupo E: Elementos de Orientação & Grupo F: Elementos Geométricos
// 100% SVG e Geometria Vetorial Autoral — Sem dependências externas
// ============================================================

import React from "react"
import Konva from "konva"
import type { MapElementDefinition, SvgPreviewProps, MapObject } from "../types"
import { MAP_COLORS } from "../types"

// ════════════════════════════════════════════════════════════
// GRUPO E: ELEMENTOS DE ORIENTAÇÃO
// ════════════════════════════════════════════════════════════

// ── 1. arrow — Seta de Fluxo ────────────────────────────────
const arrow: MapElementDefinition = {
  type: "arrow",
  category: "orientation",
  label: "Seta de Fluxo",
  description: "Indicador direcional de fluxo logístico de pessoas ou máquinas",
  defaultWidth: 80,
  defaultHeight: 30,
  defaultProps: { color: "#f59e0b" },
  propsSchema: [
    { key: "color", label: "Cor da Seta", type: "color" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 60 30", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("line", { x1: 5, y1: 15, x2: 45, y2: 15, stroke: "#f59e0b", strokeWidth: 3 }),
      React.createElement("polygon", { points: "45,8 57,15 45,22", fill: "#f59e0b" })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height
    const color = (obj.props.color as string) || "#f59e0b"

    group.add(
      new Konva.Arrow({
        points: [0, h / 2, w, h / 2],
        pointerLength: Math.min(16, w * 0.25),
        pointerWidth: Math.min(14, h * 0.8),
        fill: color,
        stroke: color,
        strokeWidth: 3,
      })
    )

    return group
  },
}

// ── 2. marker — Marcador (Pin) ──────────────────────────────
const marker: MapElementDefinition = {
  type: "marker",
  category: "orientation",
  label: "Marcador (Pin)",
  description: "Ponto de interesse ou advertência com pino georreferenciado",
  defaultWidth: 32,
  defaultHeight: 44,
  defaultProps: { label: "1", color: "#ef4444" },
  propsSchema: [
    { key: "label", label: "Número / Tag", type: "text" },
    { key: "color", label: "Cor do Pin", type: "color" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 35 45", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("path", { d: "M 17.5 4 C 10 4 5 10 5 17 C 5 26 17.5 42 17.5 42 C 17.5 42 30 26 30 17 C 30 10 25 4 17.5 4 Z", fill: "#ef4444" }),
      React.createElement("circle", { cx: 17.5, cy: 16, r: 6, fill: "#ffffff" }),
      React.createElement("circle", { cx: 17.5, cy: 16, r: 2.5, fill: "#ef4444" })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height
    const color = (obj.props.color as string) || "#ef4444"

    // Cabeça do pino
    const r = w / 2
    group.add(
      new Konva.Circle({
        x: r,
        y: r,
        radius: r,
        fill: color,
      })
    )

    // Triângulo pontiagudo apontando para baixo
    group.add(
      new Konva.Line({
        points: [0, r, w, r, r, h],
        closed: true,
        fill: color,
      })
    )

    // Miolo branco com tag
    group.add(
      new Konva.Circle({
        x: r,
        y: r,
        radius: r * 0.55,
        fill: "#ffffff",
      })
    )

    const labelText = String(obj.props.label || "1")
    group.add(
      new Konva.Text({
        x: 0,
        y: r - 5,
        width: w,
        text: labelText,
        align: "center",
        fontSize: 10,
        fontFamily: "sans-serif",
        fontStyle: "bold",
        fill: "#0f172a",
      })
    )

    return group
  },
}

// ── 3. identifier — Identificador de Rua / Posição ──────────
const identifier: MapElementDefinition = {
  type: "identifier",
  category: "orientation",
  label: "Identificador (Tag)",
  description: "Etiqueta visual de endereço logístico ou rua",
  defaultWidth: 70,
  defaultHeight: 28,
  defaultProps: { label: "RUA 01" },
  propsSchema: [
    { key: "label", label: "Texto da Etiqueta", type: "text" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 50 25", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 2, y: 2, width: 46, height: 21, rx: 3, fill: "#0f172a", stroke: "#38bdf8", strokeWidth: 1.5 }),
      React.createElement("text", { x: 25, y: 16, fill: "#38bdf8", fontSize: 9, fontWeight: "bold", textAnchor: "middle" }, "RUA 01")
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height

    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: "#0f172a",
        stroke: "#38bdf8",
        strokeWidth: 1.5,
        cornerRadius: 4,
      })
    )

    const labelText = String(obj.props.label || obj.label || "RUA 01")
    group.add(
      new Konva.Text({
        x: 0,
        y: h / 2 - 6,
        width: w,
        text: labelText,
        align: "center",
        fontSize: 11,
        fontFamily: "sans-serif",
        fontStyle: "bold",
        fill: "#38bdf8",
      })
    )

    return group
  },
}

// ── 4. dimension_line — Linha de Medição / Cota ─────────────
const dimension_line: MapElementDefinition = {
  type: "dimension_line",
  category: "orientation",
  label: "Cota de Medição",
  description: "Linha de cota arquitetônica com setas e medida em metros",
  defaultWidth: 140,
  defaultHeight: 24,
  defaultProps: { value: "14.00 m" },
  propsSchema: [
    { key: "value", label: "Medida Exibida", type: "text" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 60 25", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("line", { x1: 5, y1: 16, x2: 55, y2: 16, stroke: "#94a3b8", strokeWidth: 1 }),
      React.createElement("line", { x1: 5, y1: 8, x2: 5, y2: 24, stroke: "#94a3b8", strokeWidth: 1.5 }),
      React.createElement("line", { x1: 55, y1: 8, x2: 55, y2: 24, stroke: "#94a3b8", strokeWidth: 1.5 }),
      React.createElement("text", { x: 30, y: 12, fill: "#94a3b8", fontSize: 8, textAnchor: "middle" }, "14 m")
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height

    const midY = h * 0.65

    // Linha central
    group.add(
      new Konva.Line({
        points: [0, midY, w, midY],
        stroke: "#94a3b8",
        strokeWidth: 1,
      })
    )

    // Travessas nas extremidades
    group.add(
      new Konva.Line({ points: [0, 4, 0, h], stroke: "#94a3b8", strokeWidth: 1.5 }),
      new Konva.Line({ points: [w, 4, w, h], stroke: "#94a3b8", strokeWidth: 1.5 })
    )

    // Texto da cota acima da linha
    const val = String(obj.props.value || `${(w / 10).toFixed(1)} m`)
    group.add(
      new Konva.Text({
        x: 0,
        y: 0,
        width: w,
        text: val,
        align: "center",
        fontSize: 10,
        fontFamily: "sans-serif",
        fill: "#cbd5e1",
      })
    )

    return group
  },
}

// ── 5. north_indicator — Rosa dos Ventos / Norte ────────────
const north_indicator: MapElementDefinition = {
  type: "north_indicator",
  category: "orientation",
  label: "Indicador do Norte",
  description: "Seta técnica de orientação cardinal com indicação Norte",
  defaultWidth: 44,
  defaultHeight: 44,
  defaultProps: {},
  propsSchema: [],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 40 40", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("circle", { cx: 20, cy: 20, r: 16, fill: "#0f172a", stroke: "#64748b", strokeWidth: 1 }),
      React.createElement("polygon", { points: "20,6 14,20 20,17", fill: "#ef4444" }),
      React.createElement("polygon", { points: "20,6 26,20 20,17", fill: "#991b1b" }),
      React.createElement("polygon", { points: "20,34 14,20 20,23", fill: "#94a3b8" }),
      React.createElement("polygon", { points: "20,34 26,20 20,23", fill: "#475569" }),
      React.createElement("text", { x: 20, y: 14, fill: "#ffffff", fontSize: 7, fontWeight: "bold", textAnchor: "middle" }, "N")
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const cx = obj.width / 2
    const cy = obj.height / 2
    const r = Math.min(cx, cy) - 2

    group.add(
      new Konva.Circle({
        x: cx,
        y: cy,
        radius: r,
        fill: "#0f172a",
        stroke: "#64748b",
        strokeWidth: 1.5,
      })
    )

    // Agulha Norte (vermelha)
    group.add(
      new Konva.Line({
        points: [cx, cy - r + 4, cx - r * 0.35, cy, cx, cy - r * 0.15],
        closed: true,
        fill: "#ef4444",
      }),
      new Konva.Line({
        points: [cx, cy - r + 4, cx + r * 0.35, cy, cx, cy - r * 0.15],
        closed: true,
        fill: "#b91c1c",
      })
    )

    // Agulha Sul (cinza)
    group.add(
      new Konva.Line({
        points: [cx, cy + r - 4, cx - r * 0.35, cy, cx, cy + r * 0.15],
        closed: true,
        fill: "#94a3b8",
      }),
      new Konva.Line({
        points: [cx, cy + r - 4, cx + r * 0.35, cy, cx, cy + r * 0.15],
        closed: true,
        fill: "#64748b",
      })
    )

    // Letra N
    group.add(
      new Konva.Text({
        x: cx - 5,
        y: cy - r * 0.7,
        text: "N",
        fontSize: 8,
        fontFamily: "sans-serif",
        fontStyle: "bold",
        fill: "#ffffff",
      })
    )

    return group
  },
}

// ── 6. coordinates — Origem / Eixos de Coordenadas ──────────
const coordinates: MapElementDefinition = {
  type: "coordinates",
  category: "orientation",
  label: "Origem dos Eixos (X, Y)",
  description: "Ponto zero de referência métrica e orientação cartesiana",
  defaultWidth: 60,
  defaultHeight: 60,
  defaultProps: {},
  propsSchema: [],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 40 40", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("line", { x1: 6, y1: 34, x2: 34, y2: 34, stroke: "#ef4444", strokeWidth: 2 }), // X
      React.createElement("line", { x1: 6, y1: 34, x2: 6, y2: 6, stroke: "#10b981", strokeWidth: 2 }),  // Y
      React.createElement("circle", { cx: 6, cy: 34, r: 3, fill: "#38bdf8" }),
      React.createElement("text", { x: 36, y: 36, fill: "#ef4444", fontSize: 8, fontWeight: "bold" }, "X"),
      React.createElement("text", { x: 4, y: 5, fill: "#10b981", fontSize: 8, fontWeight: "bold" }, "Y")
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height

    // Eixo X (vermelho)
    group.add(
      new Konva.Arrow({
        points: [8, h - 8, w - 4, h - 8],
        pointerLength: 6,
        pointerWidth: 6,
        fill: "#ef4444",
        stroke: "#ef4444",
        strokeWidth: 2,
      }),
      new Konva.Text({
        x: w - 12,
        y: h - 22,
        text: "X",
        fontSize: 10,
        fontFamily: "sans-serif",
        fontStyle: "bold",
        fill: "#ef4444",
      })
    )

    // Eixo Y (verde)
    group.add(
      new Konva.Arrow({
        points: [8, h - 8, 8, 4],
        pointerLength: 6,
        pointerWidth: 6,
        fill: "#10b981",
        stroke: "#10b981",
        strokeWidth: 2,
      }),
      new Konva.Text({
        x: 14,
        y: 2,
        text: "Y",
        fontSize: 10,
        fontFamily: "sans-serif",
        fontStyle: "bold",
        fill: "#10b981",
      })
    )

    // Ponto de origem
    group.add(
      new Konva.Circle({
        x: 8,
        y: h - 8,
        radius: 3,
        fill: "#38bdf8",
      })
    )

    return group
  },
}

// ── 7. location_symbol — Símbolo de Localização ─────────────
const location_symbol: MapElementDefinition = {
  type: "location_symbol",
  category: "orientation",
  label: "Símbolo de Localização",
  description: "Alvo geométrico com losango e código de endereço",
  defaultWidth: 50,
  defaultHeight: 50,
  defaultProps: { code: "A-01" },
  propsSchema: [
    { key: "code", label: "Código de Endereçamento", type: "text" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 40 40", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("circle", { cx: 20, cy: 20, r: 16, fill: "rgba(56,189,248,0.1)", stroke: "#38bdf8", strokeWidth: 1.5 }),
      React.createElement("polygon", { points: "20,6 34,20 20,34 6,20", fill: "none", stroke: "#0284c7", strokeWidth: 1 }),
      React.createElement("text", { x: 20, y: 23, fill: "#38bdf8", fontSize: 8, fontWeight: "bold", textAnchor: "middle" }, "A-01")
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const cx = obj.width / 2
    const cy = obj.height / 2
    const r = Math.min(cx, cy) - 2

    group.add(
      new Konva.Circle({
        x: cx,
        y: cy,
        radius: r,
        fill: "rgba(56,189,248,0.1)",
        stroke: "#38bdf8",
        strokeWidth: 1.5,
      }),
      new Konva.Line({
        points: [cx, cy - r * 0.7, cx + r * 0.7, cy, cx, cy + r * 0.7, cx - r * 0.7, cy],
        closed: true,
        stroke: "#0284c7",
        strokeWidth: 1,
      })
    )

    const code = String(obj.props.code || "A-01")
    group.add(
      new Konva.Text({
        x: 0,
        y: cy - 5,
        width: obj.width,
        text: code,
        align: "center",
        fontSize: 9,
        fontFamily: "sans-serif",
        fontStyle: "bold",
        fill: "#38bdf8",
      })
    )

    return group
  },
}

// ════════════════════════════════════════════════════════════
// GRUPO F: ELEMENTOS GEOMÉTRICOS
// ════════════════════════════════════════════════════════════

// ── 8. geo_rect — Retângulo ─────────────────────────────────
const geo_rect: MapElementDefinition = {
  type: "geo_rect",
  category: "geometric",
  label: "Retângulo",
  description: "Forma geométrica retangular com preenchimento e cantos arredondados",
  defaultWidth: 120,
  defaultHeight: 80,
  defaultProps: { radius: 0, fill: "rgba(100,116,139,0.15)", stroke: "#64748b" },
  propsSchema: [
    { key: "radius", label: "Raio dos Cantos", type: "number", min: 0, max: 40 },
    { key: "fill", label: "Preenchimento", type: "color" },
    { key: "stroke", label: "Cor da Borda", type: "color" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 50 35", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 4, y: 4, width: 42, height: 27, fill: "rgba(100,116,139,0.2)", stroke: "#64748b", strokeWidth: 1.5, rx: 2 })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: obj.width,
        height: obj.height,
        fill: (obj.props.fill as string) || "rgba(100,116,139,0.15)",
        stroke: (obj.props.stroke as string) || "#64748b",
        strokeWidth: 1.5,
        cornerRadius: Number(obj.props.radius) || 0,
      })
    )
    return group
  },
}

// ── 9. geo_circle — Círculo / Elipse ────────────────────────
const geo_circle: MapElementDefinition = {
  type: "geo_circle",
  category: "geometric",
  label: "Círculo / Elipse",
  description: "Forma circular ou elíptica vetorial",
  defaultWidth: 80,
  defaultHeight: 80,
  defaultProps: { fill: "rgba(100,116,139,0.15)", stroke: "#64748b" },
  propsSchema: [
    { key: "fill", label: "Preenchimento", type: "color" },
    { key: "stroke", label: "Cor da Borda", type: "color" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 40 40", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("circle", { cx: 20, cy: 20, r: 16, fill: "rgba(100,116,139,0.2)", stroke: "#64748b", strokeWidth: 1.5 })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    group.add(
      new Konva.Ellipse({
        x: obj.width / 2,
        y: obj.height / 2,
        radiusX: obj.width / 2,
        radiusY: obj.height / 2,
        fill: (obj.props.fill as string) || "rgba(100,116,139,0.15)",
        stroke: (obj.props.stroke as string) || "#64748b",
        strokeWidth: 1.5,
      })
    )
    return group
  },
}

// ── 10. geo_line — Linha Reta ───────────────────────────────
const geo_line: MapElementDefinition = {
  type: "geo_line",
  category: "geometric",
  label: "Linha Reta",
  description: "Segmento de reta vetorial com espessura configurável",
  defaultWidth: 120,
  defaultHeight: 4,
  defaultProps: { stroke: "#64748b", strokeWidth: 2 },
  propsSchema: [
    { key: "strokeWidth", label: "Espessura", type: "number", min: 1, max: 20 },
    { key: "stroke", label: "Cor", type: "color" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 50 20", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("line", { x1: 4, y1: 10, x2: 46, y2: 10, stroke: "#64748b", strokeWidth: 2 })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    group.add(
      new Konva.Line({
        points: [0, obj.height / 2, obj.width, obj.height / 2],
        stroke: (obj.props.stroke as string) || "#64748b",
        strokeWidth: Number(obj.props.strokeWidth) || 2,
      })
    )
    return group
  },
}

// ── 11. geo_polygon — Polígono Regular ──────────────────────
const geo_polygon: MapElementDefinition = {
  type: "geo_polygon",
  category: "geometric",
  label: "Polígono Regular",
  description: "Polígono equilátero (triângulo, hexágono, octógono...)",
  defaultWidth: 80,
  defaultHeight: 80,
  defaultProps: { sides: 6, fill: "rgba(100,116,139,0.15)", stroke: "#64748b" },
  propsSchema: [
    { key: "sides", label: "Lados", type: "number", min: 3, max: 12 },
    { key: "fill", label: "Preenchimento", type: "color" },
    { key: "stroke", label: "Cor da Borda", type: "color" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 40 40", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("polygon", { points: "20,4 35,12 35,28 20,36 5,28 5,12", fill: "rgba(100,116,139,0.2)", stroke: "#64748b", strokeWidth: 1.5 })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const sides = Math.max(3, Number(obj.props.sides) || 6)
    const cx = obj.width / 2
    const cy = obj.height / 2
    const r = Math.min(cx, cy) - 2

    const points: number[] = []
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2
      points.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
    }

    group.add(
      new Konva.Line({
        points,
        closed: true,
        fill: (obj.props.fill as string) || "rgba(100,116,139,0.15)",
        stroke: (obj.props.stroke as string) || "#64748b",
        strokeWidth: 1.5,
      })
    )

    return group
  },
}

// ── 12. geo_curve — Curva / Arco Suave ──────────────────────
const geo_curve: MapElementDefinition = {
  type: "geo_curve",
  category: "geometric",
  label: "Curva / Arco",
  description: "Curva livre de concordância viária ou arquitetônica",
  defaultWidth: 100,
  defaultHeight: 60,
  defaultProps: { stroke: "#64748b", strokeWidth: 2 },
  propsSchema: [
    { key: "strokeWidth", label: "Espessura", type: "number", min: 1, max: 20 },
    { key: "stroke", label: "Cor", type: "color" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 50 35", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("path", { d: "M 5 30 Q 25 5 45 30", fill: "none", stroke: "#64748b", strokeWidth: 2 })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height

    group.add(
      new Konva.Line({
        points: [0, h, w / 2, 0, w, h],
        tension: 0.5,
        stroke: (obj.props.stroke as string) || "#64748b",
        strokeWidth: Number(obj.props.strokeWidth) || 2,
      })
    )

    return group
  },
}

// ── 13. free_area — Área Livre ──────────────────────────────
const free_area: MapElementDefinition = {
  type: "free_area",
  category: "geometric",
  label: "Área Livre (Zonas)",
  description: "Polígono ou retângulo tracejado para demarcação de pátios e áreas",
  defaultWidth: 180,
  defaultHeight: 120,
  defaultProps: { label: "PÁTIO LIVRE", fill: "rgba(99,102,241,0.06)", stroke: "#6366f1" },
  propsSchema: [
    { key: "label", label: "Descrição", type: "text" },
    { key: "stroke", label: "Cor da Marcação", type: "color" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 50 35", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 4, y: 4, width: 42, height: 27, fill: "rgba(99,102,241,0.08)", stroke: "#6366f1", strokeWidth: 1.5, strokeDasharray: "4 3", rx: 2 })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height

    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: (obj.props.fill as string) || "rgba(99,102,241,0.06)",
        stroke: (obj.props.stroke as string) || "#6366f1",
        strokeWidth: 1.5,
        dash: [6, 4],
        cornerRadius: 4,
      })
    )

    const labelText = String(obj.props.label || obj.label || "")
    if (labelText) {
      group.add(
        new Konva.Text({
          x: 10,
          y: 10,
          text: labelText,
          fontSize: 11,
          fontFamily: "sans-serif",
          fontStyle: "bold",
          fill: (obj.props.stroke as string) || "#818cf8",
        })
      )
    }

    return group
  },
}

// ── Exportação ──────────────────────────────────────────────
export const orientationElements: MapElementDefinition[] = [
  // Grupo E
  arrow,
  marker,
  identifier,
  dimension_line,
  north_indicator,
  coordinates,
  location_symbol,
  // Grupo F
  geo_rect,
  geo_circle,
  geo_line,
  geo_polygon,
  geo_curve,
  free_area,
]
