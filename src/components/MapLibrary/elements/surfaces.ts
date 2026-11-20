// ============================================================
// NEXUS ERP — MapLibrary / elements / surfaces.ts
// Elementos de Pisos e Bases de Apoio (Grama, Concreto, Asfalto, etc.)
// ============================================================

import React from "react"
import Konva from "konva"
import type { MapElementDefinition, SvgPreviewProps, MapObject } from "../types"
import { FLOOR_SURFACES, type FloorMaterialType } from "../floorSurfaces"

function createSurfaceElement(matType: FloorMaterialType): MapElementDefinition {
  const surface = FLOOR_SURFACES[matType]

  return {
    type: `floor_${matType}`,
    category: "area",
    label: surface.name,
    description: surface.description,
    defaultWidth: 400,
    defaultHeight: 300,
    defaultProps: {
      floorMaterial: matType,
      surfaceName: surface.name,
    },
    propsSchema: [
      {
        key: "floorMaterial",
        label: "Material",
        type: "select",
        options: [
          { value: "concrete", label: "🏗️ Concreto Industrial" },
          { value: "grass", label: "🌿 Grama / Solo Natural" },
          { value: "asphalt", label: "🛣️ Asfalto / Pátio" },
          { value: "epoxy", label: "🧪 Epóxi Polido" },
          { value: "gravel", label: "🪨 Brita / Cascalho" },
          { value: "deck", label: "🪵 Deck / Madeira" },
        ],
      },
    ],
    PreviewSVG: ({ width, height }: SvgPreviewProps) => {
      return React.createElement(
        "svg",
        { width, height, viewBox: `0 0 ${width} ${height}`, xmlns: "http://www.w3.org/2000/svg" },
        // Fundo
        React.createElement("rect", {
          x: 2,
          y: 2,
          width: width - 4,
          height: height - 4,
          rx: 4,
          fill: surface.color,
          stroke: surface.strokeColor,
          strokeWidth: 1.5,
        }),
        // Ícone indicador central
        React.createElement(
          "text",
          {
            x: width / 2,
            y: height / 2 + 5,
            textAnchor: "middle",
            fontSize: 16,
            className: "select-none",
          },
          surface.icon
        )
      )
    },
    renderKonva: (obj: MapObject) => {
      const group = new Konva.Group({ x: 0, y: 0 })
      const w = obj.width
      const h = obj.height

      // Retângulo de base do piso
      const rect = new Konva.Rect({
        width: w,
        height: h,
        fill: obj.color || surface.color,
        stroke: obj.strokeColor || surface.strokeColor,
        strokeWidth: 2,
        cornerRadius: 3,
      })
      group.add(rect)

      // Detalhes visuais específicos do material
      if (matType === "concrete") {
        // Juntas de dilatação em cruz
        const step = 80
        for (let x = step; x < w; x += step) {
          group.add(
            new Konva.Line({
              points: [x, 0, x, h],
              stroke: "rgba(148, 163, 184, 0.25)",
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
              stroke: "rgba(148, 163, 184, 0.25)",
              strokeWidth: 1,
              dash: [4, 4],
              listening: false,
            })
          )
        }
      } else if (matType === "grass") {
        // Tufos de grama sutis e decorativos
        const step = 60
        for (let x = 30; x < w - 20; x += step) {
          for (let y = 30; y < h - 20; y += step) {
            group.add(
              new Konva.Line({
                points: [x, y, x - 3, y - 6, x, y, x + 3, y - 6],
                stroke: "rgba(34, 197, 94, 0.4)",
                strokeWidth: 1.2,
                listening: false,
              })
            )
          }
        }
      } else if (matType === "asphalt") {
        // Borda dupla técnica de pavimento
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
      } else if (matType === "deck") {
        // Tábuas de madeira paralelas
        const plankH = 20
        for (let y = plankH; y < h; y += plankH) {
          group.add(
            new Konva.Line({
              points: [0, y, w, y],
              stroke: "rgba(180, 83, 9, 0.35)",
              strokeWidth: 1,
              listening: false,
            })
          )
        }
      }

      // Rótulo informativo no canto superior
      const labelText = `${surface.icon} ${(obj.label || surface.name).toUpperCase()}`
      const badge = new Konva.Text({
        x: 8,
        y: 8,
        text: labelText,
        fontSize: 10,
        fontFamily: "sans-serif",
        fontStyle: "bold",
        fill: surface.strokeColor,
        listening: false,
      })
      group.add(badge)

      return group
    },
  }
}

export const surfaceElements: MapElementDefinition[] = [
  createSurfaceElement("concrete"),
  createSurfaceElement("grass"),
  createSurfaceElement("asphalt"),
  createSurfaceElement("epoxy"),
  createSurfaceElement("gravel"),
  createSurfaceElement("deck"),
]
