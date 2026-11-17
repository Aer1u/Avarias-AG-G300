// ============================================================
// NEXUS ERP — MapLibrary / elements / storage.ts
// Grupo B: Estruturas de Armazenagem
// 100% SVG e Geometria Vetorial Autoral — Sem dependências externas
// ============================================================

import React from "react"
import Konva from "konva"
import type { MapElementDefinition, SvgPreviewProps, MapObject } from "../types"
import { MAP_COLORS } from "../types"
import { STANDARD_PALLET_MODELS } from "../palletModels"

// Escala padrão do canvas: 20px = 1 metro
const DEFAULT_PPM = 20

// ── 1. pallet_rack — Porta-Paletes Convencional ─────────────
const pallet_rack: MapElementDefinition = {
  type: "pallet_rack",
  category: "storage",
  label: "Porta-Paletes",
  description: "Porta-paletes convencional com montantes e longarinas",
  defaultWidth: 240,
  defaultHeight: 80,
  defaultProps: { modules: 3, positions: 2, levels: 4, depth: 80 },
  propsSchema: [
    { key: "modules", label: "Módulos", type: "number", min: 1, max: 20 },
    { key: "positions", label: "Posições/Módulo", type: "number", min: 1, max: 6 },
    { key: "levels", label: "Níveis", type: "number", min: 1, max: 10 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 60 40", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 2, y: 5, width: 56, height: 30, fill: "rgba(234,179,8,0.12)", stroke: "#ca8a04", strokeWidth: 1.5, rx: 1 }),
      React.createElement("line", { x1: 20, y1: 5, x2: 20, y2: 35, stroke: "#ca8a04", strokeWidth: 1.5 }),
      React.createElement("line", { x1: 40, y1: 5, x2: 40, y2: 35, stroke: "#ca8a04", strokeWidth: 1.5 }),
      React.createElement("line", { x1: 2, y1: 20, x2: 58, y2: 20, stroke: "#eab308", strokeWidth: 1, strokeDasharray: "2 2" })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const modules = Math.max(1, Number(obj.props.modules) || 3)
    const w = obj.width
    const h = obj.height

    // Fundo
    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: MAP_COLORS.rack.fill,
        stroke: MAP_COLORS.rack.stroke,
        strokeWidth: 2,
        cornerRadius: 2,
      })
    )

    // Montantes verticais
    const modW = w / modules
    for (let i = 0; i <= modules; i++) {
      const colX = Math.min(w, i * modW)
      // Coluna dupla reforçada
      group.add(
        new Konva.Rect({
          x: Math.max(0, colX - 2),
          y: 0,
          width: 4,
          height: h,
          fill: "#ca8a04",
        })
      )
    }

    // Longarinas intermediárias (divisão das posições)
    const positions = Math.max(1, Number(obj.props.positions) || 2)
    const posH = h / positions
    for (let j = 1; j < positions; j++) {
      group.add(
        new Konva.Line({
          points: [0, j * posH, w, j * posH],
          stroke: "#eab308",
          strokeWidth: 1,
          dash: [4, 4],
        })
      )
    }

    return group
  },
}

// ── 2. drive_in — Drive-In ──────────────────────────────────
const drive_in: MapElementDefinition = {
  type: "drive_in",
  category: "storage",
  label: "Drive-In",
  description: "Armazenamento LIFO de alta densidade dimensionado proporcionalmente ao modelo de pallet",
  defaultWidth: 28,
  defaultHeight: 110,
  defaultProps: { lanes: 1, depth: 4, levels: 4, capacity: 16, palletModel: "pbr1" },
  propsSchema: [
    { key: "lanes", label: "Ruas / Vãos", type: "number", min: 1, max: 10 },
    // depth, levels, palletModel e capacity são gerenciados pelo DriveOperationalCard — não aparecem aqui
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 60 50", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 4, y: 4, width: 52, height: 42, fill: "rgba(234,179,8,0.15)", stroke: "#ca8a04", strokeWidth: 1.5 }),
      React.createElement("line", { x1: 4, y1: 4, x2: 56, y2: 4, stroke: "#eab308", strokeWidth: 3 }), // fundo fechado
      React.createElement("line", { x1: 20, y1: 4, x2: 20, y2: 46, stroke: "#ca8a04", strokeWidth: 1, strokeDasharray: "2 2" }),
      React.createElement("line", { x1: 40, y1: 4, x2: 40, y2: 46, stroke: "#ca8a04", strokeWidth: 1, strokeDasharray: "2 2" }),
      React.createElement("polygon", { points: "30,12 26,20 34,20", fill: "#eab308" })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const lanes  = Math.max(1, Number(obj.props.lanes)  || 1)
    const depth  = Math.max(1, Number(obj.props.depth)  || 4)
    const levels = Math.max(1, Number(obj.props.levels) || 4)
    const capacity = levels * depth * lanes

    // ── Escala e Modelo de Pallet ──────────────────────────────
    const ppm = Number(obj.props?.pixelsPerMeter) || DEFAULT_PPM
    const palletModelId = String(obj.props?.palletModel || "pbr1")
    const model = STANDARD_PALLET_MODELS.find((m) => m.id === palletModelId)
                  || STANDARD_PALLET_MODELS[0]

    // Folgas operacionais (ABNT/RMI)
    const clearancePerDepth = 0.12  // 12 cm entre pallets em profundidade
    const entryClearance    = 0.20  // 20 cm na boca de entrada da empilhadeira
    const clearancePerLane  = 0.40  // 40 cm lateral por vão (trilhos + montantes)

    // Tamanho de cada slot de profundidade = 1 pallet + folga
    const slotLengthM = model.lengthM + clearancePerDepth          // ex: PBR = 1.20+0.12 = 1.32m
    const laneWidthM  = model.widthM  + clearancePerLane            // ex: PBR = 1.00+0.40 = 1.40m

    // Dimensões reais do túnel em metros
    const realLengthM = depth * slotLengthM + entryClearance        // ex: 4×1.32+0.20 = 5.48m
    const realWidthM  = lanes * laneWidthM                          // ex: 1×1.40 = 1.40m

    // Dimensões em pixels (respeitando o tamanho real do objeto no canvas)
    // O objeto pode ter sido redimensionado manualmente pelo usuário — usamos o tamanho real
    // calculado a partir do pallet, mas pintamos dentro do bounding-box do objeto
    const w = obj.width  || Math.round(realWidthM  * ppm)
    const h = obj.height || Math.round(realLengthM * ppm)

    // Passo proporcional por profundidade (em px), derivado do modelo de pallet
    const slotH  = (h - Math.round(entryClearance * ppm)) / depth   // px por slot de profundidade
    const laneW  = w / lanes                                          // px por vão

    // ── Fundo do Bloco ─────────────────────────────────────────
    group.add(
      new Konva.Rect({
        x: 0, y: 0, width: w, height: h,
        fill: "rgba(202,138,4,0.10)",
        stroke: "#ca8a04",
        strokeWidth: 2,
      })
    )

    // ── Parede do Fundo (topo = parte mais distante da entrada) ─
    group.add(
      new Konva.Line({
        points: [0, 0, w, 0],
        stroke: "#eab308",
        strokeWidth: 5,
      })
    )

    // ── Slots de Profundidade — 1 slot = 1 pallet do modelo ────
    for (let d = 0; d < depth; d++) {
      const slotY = d * slotH

      for (let l = 0; l < lanes; l++) {
        const slotX = l * laneW

        // Contorno do pallet proporcional ao modelo escolhido
        // Margem lateral = folga dos trilhos (proporção real)
        const marginX = Math.max(1.5, laneW * (clearancePerLane / 2) / (laneWidthM))
        const marginY = Math.max(1.5, slotH * 0.06)

        const pw = laneW - marginX * 2
        const ph = slotH - marginY * 2

        // Fundo do pallet (simulando a madeira)
        group.add(
          new Konva.Rect({
            x: slotX + marginX,
            y: slotY + marginY,
            width: pw,
            height: ph,
            fill: "rgba(217, 119, 6, 0.15)",
            stroke: "rgba(202, 138, 4, 0.7)",
            strokeWidth: 1,
            cornerRadius: 1,
          })
        )

        // Travessa central do pallet (elemento visual de autenticidade)
        if (ph > 8) {
          group.add(
            new Konva.Line({
              points: [slotX + marginX, slotY + slotH / 2, slotX + marginX + pw, slotY + slotH / 2],
              stroke: "rgba(202, 138, 4, 0.35)",
              strokeWidth: 0.8,
              dash: [3, 2],
            })
          )
        }
      }

      // Linha divisória entre profundidades (separador físico do trilho)
      if (d > 0) {
        group.add(
          new Konva.Line({
            points: [0, slotY, w, slotY],
            stroke: "#ca8a04",
            strokeWidth: 1,
            dash: [4, 3],
            opacity: 0.6,
          })
        )
      }
    }

    // ── Folga de Entrada da Empilhadeira (zona livre na boca) ───
    const entryZoneH = Math.round(entryClearance * ppm)
    group.add(
      new Konva.Rect({
        x: 0,
        y: h - entryZoneH,
        width: w,
        height: entryZoneH,
        fill: "rgba(56,189,248,0.07)",
        stroke: "rgba(56,189,248,0.3)",
        strokeWidth: 0.5,
        dash: [3, 2],
      })
    )

    // ── Divisórias das Ruas (montantes verticais) ───────────────
    if (lanes > 1) {
      for (let i = 1; i < lanes; i++) {
        group.add(
          new Konva.Line({
            points: [i * laneW, 0, i * laneW, h],
            stroke: "#ca8a04",
            strokeWidth: 2,
          })
        )
      }
    }

    // ── Rótulo Central com Níveis × Profundidade = Capacidade ──
    const labelText = `${levels}N×${depth}P=${capacity}`
    const fontSize = Math.max(6, Math.min(9, Math.round(w / (labelText.length * 0.7))))
    group.add(
      new Konva.Text({
        x: 1,
        y: h * 0.42 - 5,
        width: w - 2,
        align: "center",
        text: labelText,
        fontSize,
        fontFamily: "monospace",
        fontStyle: "bold",
        fill: "#fbbf24",
        listening: false,
      })
    )

    // ── Rótulo dos Canais (Nomes Personalizados no Canvas 2D) ──
    const rawChannels = Array.isArray(obj.props.channels) ? (obj.props.channels as any[]) : []
    for (let i = 0; i < lanes; i++) {
      const chan = rawChannels[i]
      if (chan && chan.name && !chan.name.startsWith("Canal ")) {
        const cx = i * laneW
        group.add(
          new Konva.Text({
            x: cx + 1,
            y: 3,
            width: laneW - 2,
            align: "center",
            text: chan.name.slice(0, 10),
            fontSize: 7,
            fontFamily: "sans-serif",
            fontStyle: "bold",
            fill: "#38bdf8",
            listening: false,
          })
        )
      }
    }

    // ── Seta de Entrada (embocadura) ───────────────────────────
    for (let i = 0; i < lanes; i++) {
      const cx = i * laneW + laneW / 2
      group.add(
        new Konva.Arrow({
          points: [cx, h - 2, cx, h - entryZoneH + 2],
          pointerLength: 4,
          pointerWidth: 4,
          fill: "#38bdf8",
          stroke: "#38bdf8",
          strokeWidth: 1.5,
          opacity: 0.8,
        })
      )
    }

    return group
  },
}

// ── 3. drive_through — Drive-Through ────────────────────────
const drive_through: MapElementDefinition = {
  type: "drive_through",
  category: "storage",
  label: "Drive-Through",
  description: "Estrutura FIFO com acesso de entrada e saída por lados opostos",
  defaultWidth: 200,
  defaultHeight: 160,
  defaultProps: { lanes: 4, depth: 4 },
  propsSchema: [
    { key: "lanes", label: "Ruas", type: "number", min: 1, max: 10 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 60 50", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 4, y: 4, width: 52, height: 42, fill: "rgba(234,179,8,0.15)", stroke: "#ca8a04", strokeWidth: 1.5 }),
      React.createElement("polygon", { points: "30,8 26,16 34,16", fill: "#eab308" }),
      React.createElement("polygon", { points: "30,34 26,42 34,42", fill: "#eab308" })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const lanes = Math.max(1, Number(obj.props.lanes) || 4)
    const w = obj.width
    const h = obj.height

    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: "rgba(202,138,4,0.12)",
        stroke: "#ca8a04",
        strokeWidth: 2,
      })
    )

    const laneW = w / lanes
    for (let i = 1; i < lanes; i++) {
      group.add(
        new Konva.Line({
          points: [i * laneW, 0, i * laneW, h],
          stroke: "#ca8a04",
          strokeWidth: 1.5,
          dash: [6, 4],
        })
      )
    }

    // Setas de passagem contínua (entrada sul -> saída norte)
    for (let i = 0; i < lanes; i++) {
      const cx = i * laneW + laneW / 2
      group.add(
        new Konva.Arrow({
          points: [cx, h - 10, cx, 10],
          pointerLength: 6,
          pointerWidth: 6,
          fill: "#eab308",
          stroke: "#eab308",
          strokeWidth: 1.5,
        })
      )
    }

    return group
  },
}

// ── 4. push_back — Push-Back ────────────────────────────────
const push_back: MapElementDefinition = {
  type: "push_back",
  category: "storage",
  label: "Push-Back",
  description: "Carros deslizantes sobre trilhos inclinados por gravidade",
  defaultWidth: 200,
  defaultHeight: 120,
  defaultProps: { lanes: 3, depth: 4 },
  propsSchema: [
    { key: "lanes", label: "Canais", type: "number", min: 1, max: 8 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 60 40", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 4, y: 4, width: 52, height: 32, fill: "rgba(234,179,8,0.15)", stroke: "#ca8a04", strokeWidth: 1.5 }),
      React.createElement("line", { x1: 4, y1: 36, x2: 56, y2: 4, stroke: "#eab308", strokeWidth: 1, strokeDasharray: "3 2" }),
      React.createElement("polygon", { points: "30,16 25,24 35,24", fill: "#eab308" })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const lanes = Math.max(1, Number(obj.props.lanes) || 3)
    const w = obj.width
    const h = obj.height

    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: "rgba(202,138,4,0.12)",
        stroke: "#ca8a04",
        strokeWidth: 2,
      })
    )

    const laneW = w / lanes
    for (let i = 0; i < lanes; i++) {
      const lx = i * laneW
      if (i > 0) {
        group.add(
          new Konva.Line({
            points: [lx, 0, lx, h],
            stroke: "#ca8a04",
            strokeWidth: 1.5,
          })
        )
      }
      // Rampa de roletes simulada por trilhos inclinados
      group.add(
        new Konva.Line({
          points: [lx + 4, h - 4, lx + laneW - 4, 4],
          stroke: "#a16207",
          strokeWidth: 1,
          dash: [4, 4],
        })
      )
      // Seta indicativa
      group.add(
        new Konva.Arrow({
          points: [lx + laneW / 2, h - 10, lx + laneW / 2, 20],
          pointerLength: 6,
          pointerWidth: 6,
          fill: "#eab308",
          stroke: "#eab308",
          strokeWidth: 1.5,
        })
      )
    }

    return group
  },
}

// ── 5. flow_rack — Flow Rack ────────────────────────────────
const flow_rack: MapElementDefinition = {
  type: "flow_rack",
  category: "storage",
  label: "Flow Rack",
  description: "Pistas com esteiras de roletes acionadas por gravidade FIFO",
  defaultWidth: 200,
  defaultHeight: 100,
  defaultProps: { lanes: 4, levels: 3 },
  propsSchema: [
    { key: "lanes", label: "Pistas", type: "number", min: 1, max: 10 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 60 40", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 4, y: 4, width: 52, height: 32, fill: "rgba(234,179,8,0.12)", stroke: "#ca8a04", strokeWidth: 1.5 }),
      [12, 20, 28, 36, 44].map((x) =>
        React.createElement("line", { key: x, x1: x, y1: 4, x2: x, y2: 36, stroke: "#eab308", strokeWidth: 0.8, strokeDasharray: "2 2" })
      ),
      React.createElement("polygon", { points: "30,14 36,20 30,26", fill: "#eab308" })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height
    const lanes = Math.max(1, Number(obj.props.lanes) || 4)

    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: "rgba(234,179,8,0.1)",
        stroke: "#ca8a04",
        strokeWidth: 2,
      })
    )

    // Roletes transversais em toda a extensão
    const rollerCount = Math.floor(w / 12)
    for (let r = 1; r < rollerCount; r++) {
      group.add(
        new Konva.Line({
          points: [r * 12, 0, r * 12, h],
          stroke: "#a16207",
          strokeWidth: 0.8,
          dash: [2, 3],
        })
      )
    }

    // Setas indicando fluxo da esquerda para direita
    const laneH = h / lanes
    for (let l = 0; l < lanes; l++) {
      const cy = l * laneH + laneH / 2
      group.add(
        new Konva.Arrow({
          points: [15, cy, w - 15, cy],
          pointerLength: 6,
          pointerWidth: 6,
          fill: "#ca8a04",
          stroke: "#ca8a04",
          strokeWidth: 1.5,
        })
      )
    }

    return group
  },
}

// ── 6. cantilever — Cantilever ──────────────────────────────
const cantilever: MapElementDefinition = {
  type: "cantilever",
  category: "storage",
  label: "Cantilever",
  description: "Braços livres para perfis, tubos e materiais compridos",
  defaultWidth: 160,
  defaultHeight: 60,
  defaultProps: { arms: 4, arm_length: 60 },
  propsSchema: [
    { key: "arms", label: "Colunas com Braços", type: "number", min: 2, max: 12 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 60 40", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("line", { x1: 5, y1: 20, x2: 55, y2: 20, stroke: "#713f12", strokeWidth: 3 }),
      [10, 23, 37, 50].map((x) =>
        React.createElement("g", { key: x },
          React.createElement("rect", { x: x - 2, y: 17, width: 4, height: 6, fill: "#ca8a04" }),
          React.createElement("line", { x1: x, y1: 8, x2: x, y2: 32, stroke: "#eab308", strokeWidth: 1.5 })
        )
      )
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height
    const arms = Math.max(2, Number(obj.props.arms) || 4)

    // Coluna central horizontal
    const centerY = h / 2
    group.add(
      new Konva.Line({
        points: [0, centerY, w, centerY],
        stroke: "#713f12",
        strokeWidth: 6,
      })
    )

    // Braços perpendiculares
    const spacing = w / (arms - 1 || 1)
    for (let a = 0; a < arms; a++) {
      const ax = a * spacing
      // Coluna de sustentação
      group.add(
        new Konva.Rect({
          x: Math.max(0, ax - 4),
          y: centerY - 6,
          width: 8,
          height: 12,
          fill: "#ca8a04",
          stroke: "#713f12",
          strokeWidth: 1,
        })
      )
      // Braço superior
      group.add(
        new Konva.Line({
          points: [ax, centerY - 6, ax, 0],
          stroke: "#eab308",
          strokeWidth: 2,
        })
      )
      // Braço inferior
      group.add(
        new Konva.Line({
          points: [ax, centerY + 6, ax, h],
          stroke: "#eab308",
          strokeWidth: 2,
        })
      )
    }

    return group
  },
}

// ── 7. shelf — Estante ──────────────────────────────────────
const shelf: MapElementDefinition = {
  type: "shelf",
  category: "storage",
  label: "Estante",
  description: "Estante de picking manual com múltiplos compartimentos",
  defaultWidth: 180,
  defaultHeight: 40,
  defaultProps: { sections: 4, levels: 5 },
  propsSchema: [
    { key: "sections", label: "Divisões / Vãos", type: "number", min: 1, max: 12 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 60 30", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 2, y: 6, width: 56, height: 18, fill: "rgba(234,179,8,0.15)", stroke: "#a16207", strokeWidth: 1.5 }),
      React.createElement("line", { x1: 16, y1: 6, x2: 16, y2: 24, stroke: "#a16207", strokeWidth: 1 }),
      React.createElement("line", { x1: 30, y1: 6, x2: 30, y2: 24, stroke: "#a16207", strokeWidth: 1 }),
      React.createElement("line", { x1: 44, y1: 6, x2: 44, y2: 24, stroke: "#a16207", strokeWidth: 1 })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height
    const sections = Math.max(1, Number(obj.props.sections) || 4)

    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: MAP_COLORS.shelf.fill,
        stroke: MAP_COLORS.shelf.stroke,
        strokeWidth: 1.5,
        cornerRadius: 1,
      })
    )

    const secW = w / sections
    for (let s = 1; s < sections; s++) {
      group.add(
        new Konva.Line({
          points: [s * secW, 0, s * secW, h],
          stroke: MAP_COLORS.shelf.stroke,
          strokeWidth: 1,
        })
      )
    }

    return group
  },
}

// ── 8. mezzanine — Mezanino ─────────────────────────────────
const mezzanine: MapElementDefinition = {
  type: "mezzanine",
  category: "storage",
  label: "Mezanino",
  description: "Piso intermediário elevado para expansão de área útil",
  defaultWidth: 240,
  defaultHeight: 160,
  defaultProps: { levels: 2 },
  propsSchema: [
    { key: "levels", label: "Níveis", type: "number", min: 1, max: 4 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 60 45", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 3, y: 3, width: 54, height: 39, fill: "rgba(100,116,139,0.15)", stroke: "#94a3b8", strokeWidth: 1.5, strokeDasharray: "4 2" }),
      React.createElement("line", { x1: 3, y1: 20, x2: 57, y2: 20, stroke: "#64748b", strokeWidth: 0.8 }),
      React.createElement("rect", { x: 40, y: 25, width: 14, height: 14, fill: "#334155", stroke: "#cbd5e1", strokeWidth: 1 })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height

    // Piso em estrutura metálica
    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: "rgba(100,116,139,0.1)",
        stroke: "#94a3b8",
        strokeWidth: 2,
        dash: [6, 4],
      })
    )

    // Vigamento interno
    const beams = 5
    for (let b = 1; b < beams; b++) {
      group.add(
        new Konva.Line({
          points: [0, (b * h) / beams, w, (b * h) / beams],
          stroke: "#475569",
          strokeWidth: 1,
        })
      )
    }

    // Escada de acesso no canto
    const stairW = Math.min(40, w * 0.25)
    const stairH = Math.min(50, h * 0.35)
    group.add(
      new Konva.Rect({
        x: w - stairW,
        y: h - stairH,
        width: stairW,
        height: stairH,
        fill: "#1e293b",
        stroke: "#cbd5e1",
        strokeWidth: 1.5,
      })
    )
    for (let st = 1; st < 5; st++) {
      group.add(
        new Konva.Line({
          points: [w - stairW, h - stairH + (st * stairH) / 5, w, h - stairH + (st * stairH) / 5],
          stroke: "#64748b",
          strokeWidth: 1,
        })
      )
    }

    return group
  },
}

// ── 9. compartment — Compartimento ──────────────────────────
const compartment: MapElementDefinition = {
  type: "compartment",
  category: "storage",
  label: "Compartimento",
  description: "Célula única ou gaveta com código de posição",
  defaultWidth: 60,
  defaultHeight: 60,
  defaultProps: { label: "A1", capacity: 1 },
  propsSchema: [
    { key: "label", label: "Identificador", type: "text" },
    { key: "capacity", label: "Capacidade Máxima", type: "number", min: 1, max: 100 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 40 40", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 4, y: 4, width: 32, height: 32, fill: "rgba(234,179,8,0.15)", stroke: "#ca8a04", strokeWidth: 1.5, rx: 2 }),
      React.createElement("text", { x: 20, y: 24, fill: "#eab308", fontSize: 11, fontWeight: "bold", textAnchor: "middle" }, "A1")
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
        fill: MAP_COLORS.rack.fill,
        stroke: MAP_COLORS.rack.stroke,
        strokeWidth: 1.5,
        cornerRadius: 3,
      })
    )

    const labelText = String(obj.props.label || obj.label || "A1")
    group.add(
      new Konva.Text({
        x: 0,
        y: h / 2 - 7,
        width: w,
        text: labelText,
        align: "center",
        fontSize: Math.min(14, Math.max(10, h * 0.25)),
        fontFamily: "sans-serif",
        fontStyle: "bold",
        fill: "#eab308",
      })
    )

    return group
  },
}

// ── 10. storage_module — Módulo de Armazenagem ──────────────
const storage_module: MapElementDefinition = {
  type: "storage_module",
  category: "storage",
  label: "Módulo de Armazenagem",
  description: "Matriz configurável de posições (linhas × colunas)",
  defaultWidth: 200,
  defaultHeight: 200,
  defaultProps: { rows: 4, cols: 4 },
  propsSchema: [
    { key: "rows", label: "Linhas", type: "number", min: 1, max: 20 },
    { key: "cols", label: "Colunas", type: "number", min: 1, max: 20 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 50 50", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 4, y: 4, width: 42, height: 42, fill: "rgba(234,179,8,0.1)", stroke: "#ca8a04", strokeWidth: 1.5 }),
      React.createElement("line", { x1: 18, y1: 4, x2: 18, y2: 46, stroke: "#ca8a04", strokeWidth: 1 }),
      React.createElement("line", { x1: 32, y1: 4, x2: 32, y2: 46, stroke: "#ca8a04", strokeWidth: 1 }),
      React.createElement("line", { x1: 4, y1: 18, x2: 46, y2: 18, stroke: "#ca8a04", strokeWidth: 1 }),
      React.createElement("line", { x1: 4, y1: 32, x2: 46, y2: 32, stroke: "#ca8a04", strokeWidth: 1 })
    ),
  renderKonva: (obj: MapObject) => {
    const group = new Konva.Group({ x: 0, y: 0 })
    const w = obj.width
    const h = obj.height
    const rows = Math.max(1, Number(obj.props.rows) || 4)
    const cols = Math.max(1, Number(obj.props.cols) || 4)

    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: "rgba(234,179,8,0.08)",
        stroke: "#ca8a04",
        strokeWidth: 2,
      })
    )

    const cellW = w / cols
    const cellH = h / rows

    for (let c = 1; c < cols; c++) {
      group.add(
        new Konva.Line({
          points: [c * cellW, 0, c * cellW, h],
          stroke: "#a16207",
          strokeWidth: 1,
        })
      )
    }

    for (let r = 1; r < rows; r++) {
      group.add(
        new Konva.Line({
          points: [0, r * cellH, w, r * cellH],
          stroke: "#a16207",
          strokeWidth: 1,
        })
      )
    }

    return group
  },
}

// ── 11. shelf_rack — Prateleira ─────────────────────────────
const shelf_rack: MapElementDefinition = {
  type: "shelf_rack",
  category: "storage",
  label: "Prateleira Linear",
  description: "Trilho ou prateleira metálica suspensa linear",
  defaultWidth: 160,
  defaultHeight: 24,
  defaultProps: { levels: 3 },
  propsSchema: [
    { key: "levels", label: "Níveis", type: "number", min: 1, max: 6 },
  ],
  PreviewSVG: ({ width, height }: SvgPreviewProps) =>
    React.createElement(
      "svg",
      { width, height, viewBox: "0 0 60 25", xmlns: "http://www.w3.org/2000/svg" },
      React.createElement("rect", { x: 4, y: 6, width: 52, height: 12, fill: "rgba(234,179,8,0.2)", stroke: "#ca8a04", strokeWidth: 1.5, rx: 1 }),
      React.createElement("line", { x1: 8, y1: 6, x2: 8, y2: 18, stroke: "#ca8a04", strokeWidth: 2 }),
      React.createElement("line", { x1: 52, y1: 6, x2: 52, y2: 18, stroke: "#ca8a04", strokeWidth: 2 })
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
        fill: "rgba(234,179,8,0.15)",
        stroke: "#ca8a04",
        strokeWidth: 1.5,
      })
    )

    // Travessas nas duas pontas
    group.add(
      new Konva.Line({
        points: [6, 0, 6, h],
        stroke: "#a16207",
        strokeWidth: 2,
      })
    )
    group.add(
      new Konva.Line({
        points: [w - 6, 0, w - 6, h],
        stroke: "#a16207",
        strokeWidth: 2,
      })
    )

    return group
  },
}

// ── Exportação ──────────────────────────────────────────────
export const storageElements: MapElementDefinition[] = [
  pallet_rack,
  drive_in,
  drive_through,
  push_back,
  flow_rack,
  cantilever,
  shelf,
  mezzanine,
  compartment,
  storage_module,
  shelf_rack,
]
