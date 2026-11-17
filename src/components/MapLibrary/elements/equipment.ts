// ============================================================
// NEXUS ERP — MapLibrary / elements / equipment.ts
// Grupo C: Equipamentos Operacionais & Grupo D: Objetos Logísticos
// 100% SVG e Geometria Vetorial Autoral — Sem dependências externas
// ============================================================

import React from "react"
import Konva from "konva"
import type { MapElementDefinition, SvgPreviewProps, MapObject } from "../types"
import { MAP_COLORS } from "../types"

// ════════════════════════════════════════════════════════════
// GRUPO C: EQUIPAMENTOS OPERACIONAIS
// ════════════════════════════════════════════════════════════

// ── 1. forklift — Empilhadeira ──────────────────────────────
const forklift: MapElementDefinition = {
  type: "forklift",
  category: "equipment",
  label: "Empilhadeira",
  description: "Empilhadeira contrabalançada em escala real (1.15m x 2.80m) com torre e garfos",
  defaultWidth: 24,
  defaultHeight: 56,
  defaultProps: { capacity_t: 2.5, direction: "north" },
  propsSchema: [
    { key: "capacity_t", label: "Capacidade (ton)", type: "number", min: 1, max: 15, step: 0.5 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 50 80", xmlns: "http://www.w3.org/2000/svg" },
      // Garfos (frente / norte)
      React.createElement("rect", { x: 12, y: 5, width: 5, height: 22, fill: "#e2e8f0" }),
      React.createElement("rect", { x: 33, y: 5, width: 5, height: 22, fill: "#e2e8f0" }),
      React.createElement("line", { x1: 10, y1: 27, x2: 40, y2: 27, stroke: "#94a3b8", strokeWidth: 3 }),
      // Cabine e chassi
      React.createElement("rect", { x: 8, y: 27, width: 34, height: 46, rx: 6, fill: "#f59e0b", stroke: "#b45309", strokeWidth: 1.5 }),
      // Banco / cabine
      React.createElement("rect", { x: 14, y: 35, width: 22, height: 22, rx: 2, fill: "#1e293b", stroke: "#475569" }),
      // Rodas
      React.createElement("rect", { x: 4, y: 30, width: 5, height: 12, rx: 1, fill: "#0f172a" }),
      React.createElement("rect", { x: 41, y: 30, width: 5, height: 12, rx: 1, fill: "#0f172a" }),
      React.createElement("rect", { x: 5, y: 58, width: 5, height: 10, rx: 1, fill: "#0f172a" }),
      React.createElement("rect", { x: 40, y: 58, width: 5, height: 10, rx: 1, fill: "#0f172a" })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height

    const forkH = h * 0.28
    const forkW = Math.max(3, w * 0.1)

    // Garfos frontais
    group.add(
      new Konva.Rect({ x: w * 0.22, y: 0, width: forkW, height: forkH, fill: "#cbd5e1" }),
      new Konva.Rect({ x: w * 0.68, y: 0, width: forkW, height: forkH, fill: "#cbd5e1" }),
      new Konva.Line({ points: [w * 0.15, forkH, w * 0.85, forkH], stroke: "#94a3b8", strokeWidth: 3 })
    )

    // Rodas (4)
    const wheelW = Math.max(4, w * 0.1)
    const wheelH = Math.max(8, h * 0.16)
    group.add(
      new Konva.Rect({ x: 0, y: forkH + 4, width: wheelW, height: wheelH, fill: "#0f172a", cornerRadius: 1 }),
      new Konva.Rect({ x: w - wheelW, y: forkH + 4, width: wheelW, height: wheelH, fill: "#0f172a", cornerRadius: 1 }),
      new Konva.Rect({ x: 1, y: h - wheelH - 4, width: wheelW, height: wheelH * 0.8, fill: "#0f172a", cornerRadius: 1 }),
      new Konva.Rect({ x: w - wheelW - 1, y: h - wheelH - 4, width: wheelW, height: wheelH * 0.8, fill: "#0f172a", cornerRadius: 1 })
    )

    // Chassi
    group.add(
      new Konva.Rect({
        x: wheelW,
        y: forkH,
        width: w - wheelW * 2,
        height: h - forkH,
        fill: "#f59e0b",
        stroke: "#b45309",
        strokeWidth: 1.5,
        cornerRadius: 6,
      })
    )

    // Teto da cabine de proteção (protetor de operador)
    group.add(
      new Konva.Rect({
        x: w * 0.24,
        y: forkH + (h - forkH) * 0.18,
        width: w * 0.52,
        height: (h - forkH) * 0.45,
        fill: "#1e293b",
        stroke: "#475569",
        strokeWidth: 1,
        cornerRadius: 3,
      })
    )

    // Volante
    group.add(
      new Konva.Circle({
        x: w / 2,
        y: forkH + (h - forkH) * 0.26,
        radius: Math.max(2, w * 0.08),
        stroke: "#94a3b8",
        strokeWidth: 1,
      })
    )

    return group
  },
}

// ── 2. pallet_jack — Paleteira ──────────────────────────────
const pallet_jack: MapElementDefinition = {
  type: "pallet_jack",
  category: "equipment",
  label: "Paleteira",
  description: "Transpaleteira em escala física real (0.68m x 1.55m) com timão e garfos",
  defaultWidth: 14,
  defaultHeight: 32,
  defaultProps: { type: "manual" },
  propsSchema: [
    { key: "type", label: "Tipo", type: "select", options: [{ value: "manual", label: "Manual" }, { value: "electric", label: "Elétrica" }] },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 40 90", xmlns: "http://www.w3.org/2000/svg" },
      // Garfos
      React.createElement("rect", { x: 8, y: 5, width: 7, height: 50, rx: 2, fill: "#f59e0b" }),
      React.createElement("rect", { x: 25, y: 5, width: 7, height: 50, rx: 2, fill: "#f59e0b" }),
      // Base da bomba
      React.createElement("rect", { x: 6, y: 55, width: 28, height: 16, rx: 4, fill: "#1e293b", stroke: "#f59e0b", strokeWidth: 1 }),
      // Timão
      React.createElement("line", { x1: 20, y1: 71, x2: 20, y2: 86, stroke: "#94a3b8", strokeWidth: 2 }),
      React.createElement("circle", { cx: 20, cy: 86, r: 3, fill: "#cbd5e1" })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height

    const forkH = h * 0.55
    const forkW = w * 0.22

    // Dois garfos frontais
    group.add(
      new Konva.Rect({ x: w * 0.15, y: 0, width: forkW, height: forkH, fill: "#f59e0b", cornerRadius: 2 }),
      new Konva.Rect({ x: w * 0.63, y: 0, width: forkW, height: forkH, fill: "#f59e0b", cornerRadius: 2 })
    )

    // Base hidráulica / motor
    const baseH = h * 0.22
    group.add(
      new Konva.Rect({
        x: w * 0.1,
        y: forkH,
        width: w * 0.8,
        height: baseH,
        fill: "#1e293b",
        stroke: "#f59e0b",
        strokeWidth: 1.5,
        cornerRadius: 4,
      })
    )

    // Haste de comando (timão)
    group.add(
      new Konva.Line({
        points: [w / 2, forkH + baseH, w / 2, h - 6],
        stroke: "#94a3b8",
        strokeWidth: 3,
        lineCap: "round",
      }),
      new Konva.Circle({
        x: w / 2,
        y: h - 6,
        radius: Math.max(3, w * 0.1),
        fill: "#f59e0b",
        stroke: "#1e293b",
        strokeWidth: 1,
      })
    )

    return group
  },
}

// ── 3. tow_truck — Rebocador ────────────────────────────────
const tow_truck: MapElementDefinition = {
  type: "tow_truck",
  category: "equipment",
  label: "Rebocador",
  description: "Trator rebocador elétrico industrial",
  defaultWidth: 50,
  defaultHeight: 80,
  defaultProps: { capacity_t: 1.5 },
  propsSchema: [
    { key: "capacity_t", label: "Capacidade (t)", type: "number", min: 0.5, max: 10 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 50 70", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 8, y: 10, width: 34, height: 48, rx: 8, fill: "#0284c7", stroke: "#0369a1", strokeWidth: 1.5 }),
      React.createElement("circle", { cx: 25, cy: 30, r: 8, fill: "#1e293b" }),
      React.createElement("circle", { cx: 25, cy: 62, r: 4, fill: "#94a3b8" }) // engate traseiro
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height

    // Chassi arredondado
    group.add(
      new Konva.Rect({
        x: 4,
        y: 4,
        width: w - 8,
        height: h - 14,
        fill: "#0284c7",
        stroke: "#0369a1",
        strokeWidth: 2,
        cornerRadius: 8,
      })
    )

    // Cabine do operador
    group.add(
      new Konva.Circle({
        x: w / 2,
        y: h * 0.4,
        radius: Math.min(w, h) * 0.2,
        fill: "#0f172a",
        stroke: "#38bdf8",
        strokeWidth: 1,
      })
    )

    // Engate de reboque na traseira
    group.add(
      new Konva.Circle({
        x: w / 2,
        y: h - 5,
        radius: 4,
        fill: "#e2e8f0",
        stroke: "#475569",
        strokeWidth: 1.5,
      })
    )

    return group
  },
}

// ── 4. cart — Carrinho Industrial ───────────────────────────
const cart: MapElementDefinition = {
  type: "cart",
  category: "equipment",
  label: "Carrinho de Transporte",
  description: "Carrinho de 4 rodas para picking e movimentação interna",
  defaultWidth: 50,
  defaultHeight: 70,
  defaultProps: { type: "platform" },
  propsSchema: [
    { key: "type", label: "Modelo", type: "select", options: [{ value: "platform", label: "Plataforma" }, { value: "cage", label: "Gaiola / Roll" }] },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 50 60", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 8, y: 12, width: 34, height: 42, fill: "rgba(59,130,246,0.15)", stroke: "#3b82f6", strokeWidth: 1.5, rx: 2 }),
      React.createElement("line", { x1: 12, y1: 8, x2: 38, y2: 8, stroke: "#94a3b8", strokeWidth: 3 }), // manopla
      React.createElement("circle", { cx: 12, cy: 16, r: 3, fill: "#0f172a" }),
      React.createElement("circle", { cx: 38, cy: 16, r: 3, fill: "#0f172a" }),
      React.createElement("circle", { cx: 12, cy: 50, r: 3, fill: "#0f172a" }),
      React.createElement("circle", { cx: 38, cy: 50, r: 3, fill: "#0f172a" })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height

    // Alça frontal
    group.add(
      new Konva.Line({
        points: [w * 0.15, 4, w * 0.85, 4],
        stroke: "#94a3b8",
        strokeWidth: 3,
        lineCap: "round",
      })
    )

    // Plataforma
    group.add(
      new Konva.Rect({
        x: 4,
        y: 8,
        width: w - 8,
        height: h - 10,
        fill: "rgba(59,130,246,0.15)",
        stroke: "#3b82f6",
        strokeWidth: 1.5,
        cornerRadius: 3,
      })
    )

    // 4 Rodízios
    const ro = 4
    group.add(
      new Konva.Circle({ x: 10, y: 14, radius: ro, fill: "#0f172a", stroke: "#64748b", strokeWidth: 1 }),
      new Konva.Circle({ x: w - 10, y: 14, radius: ro, fill: "#0f172a", stroke: "#64748b", strokeWidth: 1 }),
      new Konva.Circle({ x: 10, y: h - 8, radius: ro, fill: "#0f172a", stroke: "#64748b", strokeWidth: 1 }),
      new Konva.Circle({ x: w - 10, y: h - 8, radius: ro, fill: "#0f172a", stroke: "#64748b", strokeWidth: 1 })
    )

    return group
  },
}

// ── 5. conveyor — Esteira Transportadora ────────────────────
const conveyor: MapElementDefinition = {
  type: "conveyor",
  category: "equipment",
  label: "Esteira Transportadora",
  description: "Esteira de roletes com direção de transporte",
  defaultWidth: 40,
  defaultHeight: 200,
  defaultProps: { speed: "normal" },
  propsSchema: [
    { key: "speed", label: "Velocidade", type: "select", options: [{ value: "slow", label: "Lenta" }, { value: "normal", label: "Normal" }, { value: "fast", label: "Rápida" }] },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 35 70", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 5, y: 5, width: 25, height: 60, fill: "#1e293b", stroke: "#94a3b8", strokeWidth: 1.5 }),
      [15, 25, 35, 45, 55].map((y) =>
        React.createElement("line", { key: y, x1: 5, y1: y, x2: 30, y2: y, stroke: "#64748b", strokeWidth: 1 })
      ),
      React.createElement("polygon", { points: "17,20 12,28 22,28", fill: "#38bdf8" })
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
        fill: "#1e293b",
        stroke: "#94a3b8",
        strokeWidth: 2,
      })
    )

    // Roletes transversais
    const step = 14
    for (let y = step; y < h; y += step) {
      group.add(
        new Konva.Line({
          points: [0, y, w, y],
          stroke: "#475569",
          strokeWidth: 1,
        })
      )
    }

    // Setas indicativas de direção ao longo da esteira
    const arrowCount = Math.max(1, Math.floor(h / 60))
    for (let i = 0; i < arrowCount; i++) {
      const ay = (i + 1) * (h / (arrowCount + 1))
      group.add(
        new Konva.Arrow({
          points: [w / 2, ay + 12, w / 2, ay - 12],
          pointerLength: 6,
          pointerWidth: 6,
          fill: "#38bdf8",
          stroke: "#38bdf8",
          strokeWidth: 1.5,
        })
      )
    }

    return group
  },
}

// ── 6. machine — Máquina Industrial ─────────────────────────
const machine: MapElementDefinition = {
  type: "machine",
  category: "equipment",
  label: "Máquina Industrial",
  description: "Equipamento ou maquinário estático de processo",
  defaultWidth: 100,
  defaultHeight: 100,
  defaultProps: { label: "MÁQ-01" },
  propsSchema: [
    { key: "label", label: "Tag / Identificação", type: "text" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 50 50", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 5, y: 5, width: 40, height: 40, fill: "#1e293b", stroke: "#e2e8f0", strokeWidth: 1.5, rx: 4 }),
      React.createElement("circle", { cx: 25, cy: 25, r: 12, fill: "none", stroke: "#f59e0b", strokeWidth: 2 }),
      React.createElement("circle", { cx: 25, cy: 25, r: 4, fill: "#f59e0b" })
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
        fill: "#1e293b",
        stroke: "#94a3b8",
        strokeWidth: 2,
        cornerRadius: 4,
      })
    )

    // Símbolo de motor/engrenagem estilizada no centro
    const cx = w / 2
    const cy = h / 2
    const r = Math.min(w, h) * 0.22

    group.add(
      new Konva.Circle({
        x: cx,
        y: cy,
        radius: r,
        stroke: "#f59e0b",
        strokeWidth: 2,
      }),
      new Konva.Circle({
        x: cx,
        y: cy,
        radius: r * 0.35,
        fill: "#f59e0b",
      })
    )

    // Rótulo
    const labelText = String(obj.props.label || obj.label || "MÁQ")
    group.add(
      new Konva.Text({
        x: 0,
        y: h - 18,
        width: w,
        text: labelText,
        align: "center",
        fontSize: 10,
        fontFamily: "sans-serif",
        fontStyle: "bold",
        fill: "#cbd5e1",
      })
    )

    return group
  },
}

// ════════════════════════════════════════════════════════════
// GRUPO D: OBJETOS LOGÍSTICOS
// ════════════════════════════════════════════════════════════

// ── 7. pallet — Pallet ──────────────────────────────────────
const pallet: MapElementDefinition = {
  type: "pallet",
  category: "logistics",
  label: "Palete (PBR / EUR)",
  description: "Palete de madeira com tábuas e blocos de suporte",
  defaultWidth: 60,
  defaultHeight: 80,
  defaultProps: { type: "PBR", loaded: false },
  propsSchema: [
    { key: "type", label: "Padrão", type: "select", options: [{ value: "PBR", label: "PBR (1.0 x 1.2m)" }, { value: "EUR", label: "Euro (0.8 x 1.2m)" }] },
    { key: "loaded", label: "Carga Carregada", type: "boolean" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 40 50", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 4, y: 4, width: 32, height: 42, fill: "rgba(59,130,246,0.15)", stroke: "#3b82f6", strokeWidth: 1.5, rx: 1 }),
      [12, 20, 28, 36].map((y) =>
        React.createElement("line", { key: y, x1: 4, y1: y, x2: 36, y2: y, stroke: "#3b82f6", strokeWidth: 1 })
      )
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height
    const isLoaded = Boolean(obj.props.loaded)

    // Deck base
    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: isLoaded ? "rgba(59,130,246,0.35)" : MAP_COLORS.pallet.fill,
        stroke: MAP_COLORS.pallet.stroke,
        strokeWidth: 1.5,
        cornerRadius: 1,
      })
    )

    // Tábuas horizontais
    const slats = 5
    for (let i = 1; i < slats; i++) {
      group.add(
        new Konva.Line({
          points: [0, (i * h) / slats, w, (i * h) / slats],
          stroke: MAP_COLORS.pallet.stroke,
          strokeWidth: 1,
        })
      )
    }

    // Blocos de apoio visíveis nas laterais
    group.add(
      new Konva.Rect({ x: 2, y: 2, width: 6, height: 8, fill: "#1e3a8a" }),
      new Konva.Rect({ x: w - 8, y: 2, width: 6, height: 8, fill: "#1e3a8a" }),
      new Konva.Rect({ x: 2, y: h - 10, width: 6, height: 8, fill: "#1e3a8a" }),
      new Konva.Rect({ x: w - 8, y: h - 10, width: 6, height: 8, fill: "#1e3a8a" })
    )

    return group
  },
}

// ── 8. box — Caixa ──────────────────────────────────────────
const box: MapElementDefinition = {
  type: "box",
  category: "logistics",
  label: "Caixa de Papelão",
  description: "Caixa ou embalagem com fechamento em abas",
  defaultWidth: 40,
  defaultHeight: 40,
  defaultProps: { label: "" },
  propsSchema: [
    { key: "label", label: "Etiqueta", type: "text" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 40 40", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 6, y: 6, width: 28, height: 28, fill: "rgba(16,185,129,0.15)", stroke: "#10b981", strokeWidth: 1.5 }),
      React.createElement("line", { x1: 6, y1: 20, x2: 34, y2: 20, stroke: "#10b981", strokeWidth: 1 }),
      React.createElement("line", { x1: 20, y1: 6, x2: 20, y2: 34, stroke: "#10b981", strokeWidth: 1 })
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
        fill: MAP_COLORS.box.fill,
        stroke: MAP_COLORS.box.stroke,
        strokeWidth: 1.5,
      })
    )

    // Abas de fechamento (cruz central com fita adesiva)
    group.add(
      new Konva.Line({ points: [w / 2, 0, w / 2, h], stroke: "#059669", strokeWidth: 1 }),
      new Konva.Line({ points: [0, h / 2, w, h / 2], stroke: "#059669", strokeWidth: 1 })
    )

    return group
  },
}

// ── 9. container — Contêiner Marítimo ────────────────────────
const container: MapElementDefinition = {
  type: "container",
  category: "logistics",
  label: "Contêiner (20ft / 40ft)",
  description: "Contêiner intermodal de carga com costelas corrugadas",
  defaultWidth: 80,
  defaultHeight: 240,
  defaultProps: { size: "40ft" },
  propsSchema: [
    { key: "size", label: "Tamanho", type: "select", options: [{ value: "20ft", label: "20 Pés" }, { value: "40ft", label: "40 Pés" }] },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 35 70", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 4, y: 4, width: 27, height: 62, fill: "#b91c1c", stroke: "#ef4444", strokeWidth: 1.5, rx: 1 }),
      [14, 22, 30, 38, 46, 54].map((y) =>
        React.createElement("line", { key: y, x1: 4, y1: y, x2: 31, y2: y, stroke: "#7f1d1d", strokeWidth: 1 })
      )
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height

    // Casco do contêiner
    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: "#b91c1c",
        stroke: "#f87171",
        strokeWidth: 2,
        cornerRadius: 2,
      })
    )

    // Costelas corrugadas transversais
    const step = 14
    for (let y = step; y < h; y += step) {
      group.add(
        new Konva.Line({
          points: [2, y, w - 2, y],
          stroke: "#7f1d1d",
          strokeWidth: 1.5,
        })
      )
    }

    // Cantoneiras nos 4 cantos
    const cornerSize = Math.max(4, w * 0.12)
    group.add(
      new Konva.Rect({ x: 1, y: 1, width: cornerSize, height: cornerSize, fill: "#450a0a" }),
      new Konva.Rect({ x: w - cornerSize - 1, y: 1, width: cornerSize, height: cornerSize, fill: "#450a0a" }),
      new Konva.Rect({ x: 1, y: h - cornerSize - 1, width: cornerSize, height: cornerSize, fill: "#450a0a" }),
      new Konva.Rect({ x: w - cornerSize - 1, y: h - cornerSize - 1, width: cornerSize, height: cornerSize, fill: "#450a0a" })
    )

    return group
  },
}

// ── 10. big_bag — Big Bag ───────────────────────────────────
const big_bag: MapElementDefinition = {
  type: "big_bag",
  category: "logistics",
  label: "Big Bag",
  description: "Contentor flexível intermediário (FIBC) com 4 alças",
  defaultWidth: 70,
  defaultHeight: 70,
  defaultProps: { capacity_kg: 1000 },
  propsSchema: [
    { key: "capacity_kg", label: "Capacidade (kg)", type: "number", min: 500, max: 2500, step: 250 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 50 50", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 8, y: 8, width: 34, height: 34, rx: 6, fill: "rgba(245,158,11,0.15)", stroke: "#f59e0b", strokeWidth: 1.5 }),
      // 4 alças nos cantos
      React.createElement("circle", { cx: 12, cy: 12, r: 2.5, fill: "#f59e0b" }),
      React.createElement("circle", { cx: 38, cy: 12, r: 2.5, fill: "#f59e0b" }),
      React.createElement("circle", { cx: 12, cy: 38, r: 2.5, fill: "#f59e0b" }),
      React.createElement("circle", { cx: 38, cy: 38, r: 2.5, fill: "#f59e0b" })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height

    group.add(
      new Konva.Rect({
        x: 4,
        y: 4,
        width: w - 8,
        height: h - 8,
        fill: "rgba(245,158,11,0.15)",
        stroke: "#f59e0b",
        strokeWidth: 2,
        cornerRadius: 8,
      })
    )

    // 4 olhais / alças de içamento nos cantos
    const loopOffset = Math.max(6, w * 0.15)
    group.add(
      new Konva.Circle({ x: loopOffset, y: loopOffset, radius: 4, fill: "#f59e0b", stroke: "#78350f", strokeWidth: 1 }),
      new Konva.Circle({ x: w - loopOffset, y: loopOffset, radius: 4, fill: "#f59e0b", stroke: "#78350f", strokeWidth: 1 }),
      new Konva.Circle({ x: loopOffset, y: h - loopOffset, radius: 4, fill: "#f59e0b", stroke: "#78350f", strokeWidth: 1 }),
      new Konva.Circle({ x: w - loopOffset, y: h - loopOffset, radius: 4, fill: "#f59e0b", stroke: "#78350f", strokeWidth: 1 })
    )

    return group
  },
}

// ── 11. load_unit — Unidade de Carga ────────────────────────
const load_unit: MapElementDefinition = {
  type: "load_unit",
  category: "logistics",
  label: "Unidade de Carga (UC)",
  description: "Lote consolidado ou gaiola de expedição/recebimento",
  defaultWidth: 60,
  defaultHeight: 60,
  defaultProps: { label: "UC-01" },
  propsSchema: [
    { key: "label", label: "Código UC", type: "text" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 40 40", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 5, y: 5, width: 30, height: 30, fill: "rgba(139,92,246,0.15)", stroke: "#8b5cf6", strokeWidth: 1.5, strokeDasharray: "3 2" }),
      React.createElement("text", { x: 20, y: 24, fill: "#c4b5fd", fontSize: 9, fontWeight: "bold", textAnchor: "middle" }, "UC")
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
        fill: "rgba(139,92,246,0.15)",
        stroke: "#8b5cf6",
        strokeWidth: 2,
        dash: [4, 3],
        cornerRadius: 3,
      })
    )

    const labelText = String(obj.props.label || obj.label || "UC")
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
        fill: "#c4b5fd",
      })
    )

    return group
  },
}

// ── 12. volume — Volume ─────────────────────────────────────
const volume: MapElementDefinition = {
  type: "volume",
  category: "logistics",
  label: "Volume Fracionado",
  description: "Volume solto ou pacote com indicação de peso",
  defaultWidth: 50,
  defaultHeight: 50,
  defaultProps: { weight_kg: 10 },
  propsSchema: [
    { key: "weight_kg", label: "Peso (kg)", type: "number", min: 0.1, max: 500 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 40 40", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("polygon", { points: "20,5 35,15 35,32 20,38 5,32 5,15", fill: "rgba(16,185,129,0.15)", stroke: "#10b981", strokeWidth: 1.5 })
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
        fill: "rgba(16,185,129,0.12)",
        stroke: "#10b981",
        strokeWidth: 1.5,
        cornerRadius: 2,
      }),
      new Konva.Line({
        points: [0, 0, w, h],
        stroke: "#059669",
        strokeWidth: 0.8,
        dash: [2, 3],
      })
    )

    return group
  },
}

// ── 13. product — Produto ───────────────────────────────────
const product: MapElementDefinition = {
  type: "product",
  category: "logistics",
  label: "Item / SKU",
  description: "Item unitário ou SKU identificado com marcador",
  defaultWidth: 32,
  defaultHeight: 32,
  defaultProps: { sku: "SKU-01" },
  propsSchema: [
    { key: "sku", label: "Código SKU", type: "text" },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 35 35", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("circle", { cx: 17.5, cy: 17.5, r: 12, fill: "rgba(56,189,248,0.2)", stroke: "#38bdf8", strokeWidth: 1.5 }),
      React.createElement("circle", { cx: 17.5, cy: 17.5, r: 4, fill: "#38bdf8" })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const r = Math.min(obj.width, obj.height) / 2

    group.add(
      new Konva.Circle({
        x: obj.width / 2,
        y: obj.height / 2,
        radius: r,
        fill: "rgba(56,189,248,0.2)",
        stroke: "#38bdf8",
        strokeWidth: 1.5,
      }),
      new Konva.Circle({
        x: obj.width / 2,
        y: obj.height / 2,
        radius: r * 0.35,
        fill: "#38bdf8",
      })
    )

    return group
  },
}

// ── 14. human_operator — Ser Humano / Operador Logístico ────
const human_operator: MapElementDefinition = {
  type: "human_operator",
  category: "equipment",
  label: "Ser Humano / Operador",
  description: "Referência antropomórfica de escala real (ombros 0.60m x altura 1.75m) com capacete e colete EPI",
  defaultWidth: 14,
  defaultHeight: 12,
  defaultProps: {
    role: "operador",
    helmetColor: "#facc15", // amarelo padrão EPI
  },
  propsSchema: [
    {
      key: "role",
      label: "Função / Perfil",
      type: "select",
      options: [
        { value: "operador", label: "Operador de Empilhadeira / Paleteira" },
        { value: "conferente", label: "Conferente de Avarias" },
        { value: "supervisor", label: "Supervisor de Logística" },
        { value: "pedestre", label: "Pedestre / Visitante" },
      ],
    },
    {
      key: "helmetColor",
      label: "Cor do Capacete EPI",
      type: "color",
    },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 40 32", xmlns: "http://www.w3.org/2000/svg" },
      // Ombros e tronco
      React.createElement("ellipse", { cx: 20, cy: 16, rx: 17, ry: 10, fill: "#f97316", stroke: "#c2410c", strokeWidth: 1.5 }),
      // Faixas refletivas do colete
      React.createElement("line", { x1: 9, y1: 10, x2: 9, y2: 22, stroke: "#ffffff", strokeWidth: 2, strokeOpacity: 0.9 }),
      React.createElement("line", { x1: 31, y1: 10, x2: 31, y2: 22, stroke: "#ffffff", strokeWidth: 2, strokeOpacity: 0.9 }),
      // Braços / mãos
      React.createElement("circle", { cx: 5, cy: 9, r: 3, fill: "#fdba74" }),
      React.createElement("circle", { cx: 35, cy: 9, r: 3, fill: "#fdba74" }),
      // Capacete visto de cima com aba apontando para frente (Norte)
      React.createElement("ellipse", { cx: 20, cy: 15, rx: 7.5, ry: 8.5, fill: "#facc15", stroke: "#ca8a04", strokeWidth: 1.5 }),
      React.createElement("path", { d: "M 15 8 Q 20 4 25 8", stroke: "#0f172a", strokeWidth: 2, fill: "none" })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height
    const helmetCol = String(obj.props.helmetColor || "#facc15")

    // Tronco / Ombros com Colete Refletivo de Alta Visibilidade (Laranja)
    group.add(
      new Konva.Ellipse({
        x: w / 2,
        y: h / 2,
        radiusX: w * 0.46,
        radiusY: h * 0.42,
        fill: "#f97316",
        stroke: "#c2410c",
        strokeWidth: 1.5,
      })
    )

    // Faixas refletivas do colete (prateadas)
    const stripeW = Math.max(1.5, w * 0.08)
    group.add(
      new Konva.Line({
        points: [w * 0.26, h * 0.15, w * 0.26, h * 0.85],
        stroke: "#ffffff",
        strokeWidth: stripeW,
        opacity: 0.9,
      }),
      new Konva.Line({
        points: [w * 0.74, h * 0.15, w * 0.74, h * 0.85],
        stroke: "#ffffff",
        strokeWidth: stripeW,
        opacity: 0.9,
      })
    )

    // Braços e mãos estendidos para frente
    const handR = Math.max(1.5, w * 0.12)
    group.add(
      new Konva.Circle({ x: w * 0.14, y: h * 0.25, radius: handR, fill: "#fdba74" }),
      new Konva.Circle({ x: w * 0.86, y: h * 0.25, radius: handR, fill: "#fdba74" })
    )

    // Cabeça / Capacete de Segurança EPI visto do topo
    const headRx = Math.max(3, w * 0.25)
    const headRy = Math.max(3, h * 0.32)
    group.add(
      new Konva.Ellipse({
        x: w / 2,
        y: h / 2,
        radiusX: headRx,
        radiusY: headRy,
        fill: helmetCol,
        stroke: "#0f172a",
        strokeWidth: 1,
      })
    )

    // Aba da frente do capacete (indicando a direção do olhar/caminhada para cima/norte)
    group.add(
      new Konva.Arc({
        x: w / 2,
        y: h / 2 - headRy * 0.5,
        innerRadius: headRx * 0.6,
        outerRadius: headRx * 0.95,
        angle: 120,
        rotation: 210,
        fill: "#0f172a",
      })
    )

    return group
  },
}

// ── Exportação ──────────────────────────────────────────────
export const equipmentElements: MapElementDefinition[] = [
  // Grupo C: Equipamentos & Pessoal Operacional
  human_operator, // Ser Humano como 1ª referência antropomórfica de escala
  forklift,
  pallet_jack,
  tow_truck,
  cart,
  conveyor,
  machine,
  // Grupo D: Objetos Logísticos
  pallet,
  box,
  container,
  big_bag,
  load_unit,
  volume,
  product,
]
