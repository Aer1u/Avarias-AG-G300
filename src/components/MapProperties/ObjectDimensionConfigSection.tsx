// ============================================================
// NEXUS ERP — MapProperties / ObjectDimensionConfigSection.tsx
// Nomenclatura e Identificação de Dimensões POR OBJETO (Não-Universal)
// Cada instância de objeto pode configurar livremente como seus níveis,
// profundidades e posições são identificados e sequenciados de forma independente.
// ============================================================

"use client"

import React, { useState } from "react"
import type {
  DimensionConfig,
  SequenceType,
  DimensionOrientation,
} from "../MapLibrary/dimensionsTypes"
import {
  generateDimensionItems,
  DEFAULT_G300_LEVELS_CONFIG,
  DEFAULT_G300_DEPTH_CONFIG,
} from "../MapLibrary/dimensionManager"

interface ObjectDimensionConfigSectionProps {
  levelsCount: number
  depthCount: number
  objectLevelsConfig?: DimensionConfig
  objectDepthConfig?: DimensionConfig
  onUpdateProp: (key: string, value: unknown) => void
}

export default function ObjectDimensionConfigSection({
  levelsCount,
  depthCount,
  objectLevelsConfig,
  objectDepthConfig,
  onUpdateProp,
}: ObjectDimensionConfigSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeDimension, setActiveDimension] = useState<"depth" | "level">("depth")

  // Resolução da configuração atual específica desta instância de objeto
  const levelsConfig: DimensionConfig = objectLevelsConfig || {
    ...DEFAULT_G300_LEVELS_CONFIG,
    defaultCount: levelsCount,
    items: generateDimensionItems(levelsCount, DEFAULT_G300_LEVELS_CONFIG.sequenceType, DEFAULT_G300_LEVELS_CONFIG.orientation),
  }

  const depthConfig: DimensionConfig = objectDepthConfig || {
    ...DEFAULT_G300_DEPTH_CONFIG,
    defaultCount: depthCount,
    items: generateDimensionItems(depthCount, DEFAULT_G300_DEPTH_CONFIG.sequenceType, DEFAULT_G300_DEPTH_CONFIG.orientation),
  }

  const isLevel = activeDimension === "level"
  const activeConfig = isLevel ? levelsConfig : depthConfig
  const currentCount = isLevel ? levelsCount : depthCount

  // ── Atualiza configuração de dimensão da instância ──────────
  const updateDimension = (partial: Partial<DimensionConfig>) => {
    const targetPropKey = isLevel ? "levelsConfig" : "depthConfig"
    const base = isLevel ? levelsConfig : depthConfig

    const newConfig: DimensionConfig = {
      ...base,
      ...partial,
    }

    // Recalcula os itens resolvidos
    const items = generateDimensionItems(
      currentCount,
      newConfig.sequenceType,
      newConfig.orientation,
      newConfig.prefix,
      newConfig.suffix,
      newConfig.paddingDigits,
      newConfig.customValues
    )

    newConfig.items = items
    onUpdateProp(targetPropKey, newConfig)
  }

  // ── Presets rápidos para este objeto individual ────────────
  const applyPresetToObject = (type: "numeric" | "alphabetic" | "pad" | "alphanumeric" | "custom") => {
    if (type === "numeric") {
      updateDimension({
        sequenceType: "numeric",
        prefix: "",
        suffix: "",
        paddingDigits: 1,
      })
    } else if (type === "alphabetic") {
      updateDimension({
        sequenceType: "alphabetic",
        prefix: "",
        suffix: "",
      })
    } else if (type === "pad") {
      updateDimension({
        sequenceType: "numeric_pad",
        prefix: "",
        suffix: "",
        paddingDigits: 2,
      })
    } else if (type === "alphanumeric") {
      updateDimension({
        sequenceType: "alphanumeric",
        prefix: isLevel ? "N" : "P",
        suffix: "",
      })
    } else {
      const customList = isLevel
        ? ["Chão", "Nível 1", "Nível 2", "Aéreo"]
        : ["Entrada", "Vão-2", "Vão-3", "Fundo"]
      updateDimension({
        sequenceType: "custom_list",
        customValues: customList,
      })
    }
  }

  return (
    <div className="bg-slate-900/90 rounded-lg border border-slate-800/80 overflow-hidden text-slate-100 select-none">
      {/* Botão de Toggle da Seção */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🏷️</span>
          <div>
            <span className="text-[11px] font-bold text-slate-200 block leading-tight">
              Nomenclatura Deste Objeto
            </span>
            <span className="text-[9px] text-amber-400 font-mono">
              Níveis: {levelsConfig.sequenceType === "alphabetic" ? "A..D" : "1..4"} · Prof: {depthConfig.sequenceType === "alphabetic" ? "A..E" : "1..5"}
            </span>
          </div>
        </div>
        <span className="text-slate-500 text-xs">{isOpen ? "▲" : "▼"}</span>
      </button>

      {/* Conteúdo Aberto: Configuração Exclusiva Deste Objeto */}
      {isOpen && (
        <div className="p-3 border-t border-slate-800/80 space-y-3 bg-slate-950/60">
          <div className="p-2 bg-amber-950/20 border border-amber-900/40 rounded text-[10px] text-amber-300 leading-relaxed">
            ⚡ <strong>Configuração Individual da Instância:</strong> As alterações aqui afetam
            <strong> somente este objeto</strong>, permitindo que outros drives ou estruturas usem nomenclaturas distintas.
          </div>

          {/* Abas: Níveis x Profundidades deste objeto */}
          <div className="flex border-b border-slate-800 gap-1 pb-1">
            <button
              type="button"
              onClick={() => setActiveDimension("depth")}
              className={`flex-1 py-1 text-[11px] font-bold rounded transition-colors text-center ${
                !isLevel
                  ? "bg-purple-950/80 text-purple-300 border border-purple-800/50"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              📥 Profundidade ({depthCount} pos.)
            </button>
            <button
              type="button"
              onClick={() => setActiveDimension("level")}
              className={`flex-1 py-1 text-[11px] font-bold rounded transition-colors text-center ${
                isLevel
                  ? "bg-purple-950/80 text-purple-300 border border-purple-800/50"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🪜 Níveis ({levelsCount} nív.)
            </button>
          </div>

          {/* Presets de 1 clique para este objeto */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">
              Padrão de Sequência Deste Objeto
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => applyPresetToObject("numeric")}
                className={`px-2 py-1.5 rounded border text-[10px] font-mono text-center transition-colors ${
                  activeConfig.sequenceType === "numeric" && !activeConfig.prefix
                    ? "bg-blue-600 border-blue-500 text-white font-bold"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                1, 2, 3, 4
              </button>
              <button
                type="button"
                onClick={() => applyPresetToObject("alphabetic")}
                className={`px-2 py-1.5 rounded border text-[10px] font-mono text-center transition-colors ${
                  activeConfig.sequenceType === "alphabetic"
                    ? "bg-purple-600 border-purple-500 text-white font-bold"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                A, B, C, D
              </button>
              <button
                type="button"
                onClick={() => applyPresetToObject("pad")}
                className={`px-2 py-1.5 rounded border text-[10px] font-mono text-center transition-colors ${
                  activeConfig.sequenceType === "numeric_pad"
                    ? "bg-blue-600 border-blue-500 text-white font-bold"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                01, 02, 03
              </button>
              <button
                type="button"
                onClick={() => applyPresetToObject("alphanumeric")}
                className={`px-2 py-1.5 rounded border text-[10px] font-mono text-center transition-colors ${
                  activeConfig.sequenceType === "alphanumeric"
                    ? "bg-emerald-600 border-emerald-500 text-white font-bold"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {isLevel ? "N1, N2..." : "P1, P2..."}
              </button>
              <button
                type="button"
                onClick={() => applyPresetToObject("custom")}
                className={`col-span-2 px-2 py-1.5 rounded border text-[10px] text-center transition-colors ${
                  activeConfig.sequenceType === "custom_list"
                    ? "bg-amber-600 border-amber-500 text-white font-bold"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                ✨ Nomes Personalizados
              </button>
            </div>
          </div>

          {/* Sentido e Orientação */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 block font-semibold">
              Sentido / Orientação
            </label>
            <select
              value={activeConfig.orientation}
              onChange={(e) => updateDimension({ orientation: e.target.value as DimensionOrientation })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
            >
              {isLevel ? (
                <>
                  <option value="bottom_to_top">De baixo para cima (Chão = 1º)</option>
                  <option value="top_to_bottom">De cima para baixo (Topo = 1º)</option>
                </>
              ) : (
                <>
                  <option value="front_to_back">Da entrada para o fundo (LIFO padrão)</option>
                  <option value="back_to_front">Do fundo para a entrada</option>
                </>
              )}
            </select>
          </div>

          {/* Prévia ao Vivo das Posições Deste Objeto */}
          <div className="bg-slate-900 p-2 rounded border border-slate-800 space-y-1">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">
              Prévia das Identificações Deste Objeto:
            </span>
            <div className="flex flex-wrap gap-1 font-mono text-[10px]">
              {activeConfig.items.map((it) => (
                <span
                  key={it.physicalIndex}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700 font-bold"
                >
                  {it.identifier}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
