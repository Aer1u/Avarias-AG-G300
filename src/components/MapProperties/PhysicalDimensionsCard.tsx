// ============================================================
// NEXUS ERP — MapProperties / PhysicalDimensionsCard.tsx
// Painel Universal de Dimensões Físicas Reais, Unidades e Escala
// Separa rigorosamente dimensões reais de escala e zoom da câmera.
// Compatível com 2D e visualização 3D futura (X, Y, Z, Z0).
// ============================================================

"use client"

import React, { useState } from "react"
import type { MapObject, LengthUnit, PhysicalDimensions } from "../MapLibrary/types"
import {
  ensurePhysicalDimensions,
  toMeters,
  fromMeters,
  convertUnit,
  realToPixels,
} from "../MapLibrary/unitConverter"

interface PhysicalDimensionsCardProps {
  selectedObject: MapObject
  pixelsPerMeter?: number
  onUpdateObject: (partial: Partial<MapObject>) => void
  onSaveAsModelDefault?: (modelType: string, dims: PhysicalDimensions) => void
}

export default function PhysicalDimensionsCard({
  selectedObject,
  pixelsPerMeter = 20,
  onUpdateObject,
  onSaveAsModelDefault,
}: PhysicalDimensionsCardProps) {
  const dims = ensurePhysicalDimensions(selectedObject, pixelsPerMeter)
  const currentUnit: LengthUnit = dims.unit || "m"

  const [savedSuccess, setSavedSuccess] = useState(false)

  // ── Altera a unidade de exibição sem mudar a medida física ──
  const handleChangeUnit = (newUnit: LengthUnit) => {
    if (newUnit === currentUnit) return
    const newWidth = convertUnit(dims.width, currentUnit, newUnit)
    const newLength = convertUnit(dims.length, currentUnit, newUnit)
    const newHeight = convertUnit(dims.height, currentUnit, newUnit)
    const newElev = dims.elevationZ !== undefined ? convertUnit(dims.elevationZ, currentUnit, newUnit) : 0

    const updatedDims: PhysicalDimensions = {
      ...dims,
      unit: newUnit,
      width: newWidth,
      length: newLength,
      height: newHeight,
      elevationZ: newElev,
    }

    onUpdateObject({ physicalDimensions: updatedDims })
  }

  // ── Altera Largura Física (X) e reflete nos pixels do Canvas ──
  const handleChangeWidth = (val: number) => {
    const rawVal = Math.max(0.01, val)
    let newLength = dims.length

    // Se a proporção estiver travada, recalcula o comprimento proporcionalmente
    if (dims.lockAspectRatio && dims.width > 0) {
      const ratio = dims.length / dims.width
      newLength = rawVal * ratio
    }

    const widthMeters = toMeters(rawVal, currentUnit)
    const lengthMeters = toMeters(newLength, currentUnit)

    const newPxW = realToPixels(widthMeters, pixelsPerMeter)
    const newPxH = realToPixels(lengthMeters, pixelsPerMeter)

    onUpdateObject({
      width: newPxW,
      height: newPxH,
      physicalDimensions: {
        ...dims,
        width: rawVal,
        length: newLength,
      },
    })
  }

  // ── Altera Comprimento Físico (Y) e reflete nos pixels do Canvas ──
  const handleChangeLength = (val: number) => {
    const rawVal = Math.max(0.01, val)
    let newWidth = dims.width

    // Se a proporção estiver travada, recalcula a largura proporcionalmente
    if (dims.lockAspectRatio && dims.length > 0) {
      const ratio = dims.width / dims.length
      newWidth = rawVal * ratio
    }

    const widthMeters = toMeters(newWidth, currentUnit)
    const lengthMeters = toMeters(rawVal, currentUnit)

    const newPxW = realToPixels(widthMeters, pixelsPerMeter)
    const newPxH = realToPixels(lengthMeters, pixelsPerMeter)

    onUpdateObject({
      width: newPxW,
      height: newPxH,
      physicalDimensions: {
        ...dims,
        width: newWidth,
        length: rawVal,
      },
    })
  }

  // ── Altera Altura Vertical (Z) — 3D Ready ──────────────────
  const handleChangeHeight = (val: number) => {
    const rawVal = Math.max(0.01, val)
    onUpdateObject({
      physicalDimensions: {
        ...dims,
        height: rawVal,
      },
    })
  }

  // ── Altera Cota de Elevação do Chão (Z0) ───────────────────
  const handleChangeElevationZ = (val: number) => {
    onUpdateObject({
      physicalDimensions: {
        ...dims,
        elevationZ: val,
      },
    })
  }

  // ── Alterna Cadeado de Proporção ───────────────────────────
  const handleToggleLockRatio = () => {
    onUpdateObject({
      physicalDimensions: {
        ...dims,
        lockAspectRatio: !dims.lockAspectRatio,
      },
    })
  }

  // ── Salvar como Padrão do Modelo ──────────────────────────
  const handleSaveAsDefault = () => {
    onSaveAsModelDefault?.(selectedObject.type, dims)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2500)
  }

  const formatStep = currentUnit === "mm" ? 10 : currentUnit === "cm" ? 1 : 0.05

  return (
    <div className="space-y-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">📐</span>
          <div>
            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block">
              Dimensões Físicas Reais
            </span>
            <span className="text-[9px] text-slate-500">
              Escala ambiente: {pixelsPerMeter} px/metro
            </span>
          </div>
        </div>

        {/* Seletor de Unidade */}
        <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          {(["m", "cm", "mm"] as LengthUnit[]).map((u) => (
            <button
              key={u}
              onClick={() => handleChangeUnit(u)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                currentUnit === u
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs com Bloqueio de Proporção */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Plano 2D (X × Y)
          </span>
          <button
            onClick={handleToggleLockRatio}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors ${
              dims.lockAspectRatio
                ? "bg-blue-950/70 border-blue-700/60 text-blue-300"
                : "border-slate-800 text-slate-500 hover:text-slate-300"
            }`}
            title={dims.lockAspectRatio ? "Proporção travada (1:1)" : "Proporção livre"}
          >
            <span>{dims.lockAspectRatio ? "🔒" : "🔓"}</span>
            <span>{dims.lockAspectRatio ? "Travada" : "Livre"}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Largura (X) */}
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
            <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
              <span>Largura (X)</span>
              <span className="font-mono text-slate-400">{currentUnit}</span>
            </div>
            <input
              type="number"
              step={formatStep}
              min={0.01}
              value={Number(dims.width.toFixed(3))}
              onChange={(e) => handleChangeWidth(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-xs text-blue-300 font-bold focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Comprimento (Y) */}
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
            <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
              <span>Comprimento (Y)</span>
              <span className="font-mono text-slate-400">{currentUnit}</span>
            </div>
            <input
              type="number"
              step={formatStep}
              min={0.01}
              value={Number(dims.length.toFixed(3))}
              onChange={(e) => handleChangeLength(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-xs text-blue-300 font-bold focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Dimensões Tridimensionais (3D Ready: Z e Z0) */}
      <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
          Dimensão Vertical & Cota (3D Ready)
        </span>
        <div className="grid grid-cols-2 gap-2">
          {/* Altura Z */}
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
            <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
              <span>Altura (Z)</span>
              <span className="font-mono text-slate-400">{currentUnit}</span>
            </div>
            <input
              type="number"
              step={formatStep}
              min={0.01}
              value={Number(dims.height.toFixed(3))}
              onChange={(e) => handleChangeHeight(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Elevação Z0 */}
          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
            <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
              <span>Cota Chão (Z₀)</span>
              <span className="font-mono text-slate-400">{currentUnit}</span>
            </div>
            <input
              type="number"
              step={formatStep}
              value={Number((dims.elevationZ || 0).toFixed(3))}
              onChange={(e) => handleChangeElevationZ(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Ação: Salvar como padrão do modelo */}
      <div className="pt-2 border-t border-slate-800/60">
        <button
          onClick={handleSaveAsDefault}
          className="w-full py-1.5 px-2 rounded-lg border border-slate-800 bg-slate-900/90 hover:bg-slate-800 text-[10px] text-slate-300 font-medium transition-colors flex items-center justify-center gap-1.5"
          title="Salvar estas medidas físicas como o tamanho sugerido para novos objetos deste modelo"
        >
          <span>💾</span>
          <span>{savedSuccess ? "✅ Padrão do Modelo Atualizado!" : "Definir como Padrão do Modelo"}</span>
        </button>
      </div>
    </div>
  )
}
