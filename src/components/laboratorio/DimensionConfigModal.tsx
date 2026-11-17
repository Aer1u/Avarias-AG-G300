// ============================================================
// NEXUS ERP — laboratorio / DimensionConfigModal.tsx
// Modal de Configuração Universal de Nomenclatura e Dimensões
// Permite que cada organização configure livremente a nomenclatura,
// sequências (1..N, A..E, etc.), orientação e identificadores das dimensões físicas.
// ============================================================

"use client"

import React, { useState } from "react"
import type {
  DimensionConfig,
  DimensionCategory,
  SequenceType,
  DimensionOrientation,
} from "../MapLibrary/dimensionsTypes"
import {
  DEFAULT_G300_LEVELS_CONFIG,
  DEFAULT_G300_DEPTH_CONFIG,
  ALTERNATIVE_ALPHA_DEPTH_CONFIG,
  generateDimensionItems,
} from "../MapLibrary/dimensionManager"

interface DimensionConfigModalProps {
  isOpen: boolean
  onClose: () => void
  levelsConfig: DimensionConfig
  depthConfig: DimensionConfig
  onSaveLevelsConfig: (config: DimensionConfig) => void
  onSaveDepthConfig: (config: DimensionConfig) => void
}

export default function DimensionConfigModal({
  isOpen,
  onClose,
  levelsConfig,
  depthConfig,
  onSaveLevelsConfig,
  onSaveDepthConfig,
}: DimensionConfigModalProps) {
  const [activeTab, setActiveTab] = useState<DimensionCategory>("depth")

  // Estados locais editáveis
  const [currentLevels, setCurrentLevels] = useState<DimensionConfig>(levelsConfig)
  const [currentDepth, setCurrentDepth] = useState<DimensionConfig>(depthConfig)

  if (!isOpen) return null

  const isLevelTab = activeTab === "level"
  const currentConfig = isLevelTab ? currentLevels : currentDepth
  const setCurrentConfig = isLevelTab ? setCurrentLevels : setCurrentDepth

  const handleApplyPreset = (preset: "g300" | "alpha" | "custom") => {
    if (activeTab === "depth") {
      if (preset === "g300") {
        setCurrentDepth({
          ...DEFAULT_G300_DEPTH_CONFIG,
          items: generateDimensionItems(5, "numeric", "front_to_back"),
          defaultCount: 5,
        })
      } else if (preset === "alpha") {
        setCurrentDepth({
          ...ALTERNATIVE_ALPHA_DEPTH_CONFIG,
          items: generateDimensionItems(5, "alphabetic", "front_to_back"),
          defaultCount: 5,
        })
      } else {
        const customList = ["Entrada", "Meio-1", "Meio-2", "Fundo"]
        setCurrentDepth({
          id: "dim_depth_custom",
          category: "depth",
          name: "Profundidades Nomeadas",
          displayName: "Profundidade",
          sequenceType: "custom_list",
          orientation: "front_to_back",
          defaultCount: 4,
          customValues: customList,
          items: generateDimensionItems(4, "custom_list", "front_to_back", "", "", 1, customList),
          scope: { structureType: "drive_in" },
        })
      }
    } else {
      if (preset === "g300") {
        setCurrentLevels({
          ...DEFAULT_G300_LEVELS_CONFIG,
          items: generateDimensionItems(4, "numeric", "bottom_to_top"),
          defaultCount: 4,
        })
      } else if (preset === "alpha") {
        setCurrentLevels({
          id: "dim_levels_alpha",
          category: "level",
          name: "Níveis em Letras",
          displayName: "Nível",
          sequenceType: "alphabetic",
          orientation: "bottom_to_top",
          defaultCount: 4,
          items: generateDimensionItems(4, "alphabetic", "bottom_to_top"),
          scope: { structureType: "drive_in" },
        })
      } else {
        const customList = ["Chão (N1)", "Intermediário (N2)", "Aéreo (N3)", "Topo (N4)"]
        setCurrentLevels({
          id: "dim_levels_custom",
          category: "level",
          name: "Níveis Descritivos",
          displayName: "Nível",
          sequenceType: "custom_list",
          orientation: "bottom_to_top",
          defaultCount: 4,
          customValues: customList,
          items: generateDimensionItems(4, "custom_list", "bottom_to_top", "", "", 1, customList),
          scope: { structureType: "drive_in" },
        })
      }
    }
  }

  const handleUpdateField = <K extends keyof DimensionConfig>(
    field: K,
    val: DimensionConfig[K]
  ) => {
    setCurrentConfig((prev) => {
      const next = { ...prev, [field]: val }
      // Recalcula items se mudou sequenceType, count ou orientation
      const items = generateDimensionItems(
        next.defaultCount,
        next.sequenceType,
        next.orientation,
        next.prefix,
        next.suffix,
        next.paddingDigits,
        next.customValues
      )
      return { ...next, items }
    })
  }

  const handleSave = () => {
    onSaveLevelsConfig(currentLevels)
    onSaveDepthConfig(currentDepth)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col text-slate-100 overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold text-sm">
              📏
            </div>
            <div>
              <h2 className="text-sm font-bold">Nomenclatura & Identificação Universal de Dimensões</h2>
              <p className="text-[11px] text-slate-400">
                Configure como cada galpão ou organização denomina seus níveis, profundidades e posições
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">
            ×
          </button>
        </div>

        {/* Abas das Dimensões */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab("depth")}
            className={`py-2 px-3 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === "depth"
                ? "border-purple-500 text-purple-300 bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📥 Profundidades (Túnel / Vãos)
          </button>
          <button
            onClick={() => setActiveTab("level")}
            className={`py-2 px-3 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === "level"
                ? "border-purple-500 text-purple-300 bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            🪜 Níveis Verticais (Alturas)
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Presets Rápidos Reais */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Exemplos do Mundo Real (Presets Rápidos)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleApplyPreset("g300")}
                className="p-2.5 rounded-lg border border-slate-800 hover:border-blue-500/60 bg-slate-900/80 text-left transition-colors"
              >
                <div className="font-bold text-blue-400 text-[11px]">🏢 Galpão G300</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {activeTab === "depth" ? "Profundidades 1, 2, 3, 4, 5" : "Níveis 1, 2, 3, 4 (Numérico)"}
                </div>
              </button>

              <button
                onClick={() => handleApplyPreset("alpha")}
                className="p-2.5 rounded-lg border border-slate-800 hover:border-purple-500/60 bg-slate-900/80 text-left transition-colors"
              >
                <div className="font-bold text-purple-400 text-[11px]">🏭 Outro Galpão</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {activeTab === "depth" ? "Profundidades A, B, C, D, E" : "Níveis A, B, C, D (Alfabético)"}
                </div>
              </button>

              <button
                onClick={() => handleApplyPreset("custom")}
                className="p-2.5 rounded-lg border border-slate-800 hover:border-amber-500/60 bg-slate-900/80 text-left transition-colors"
              >
                <div className="font-bold text-amber-400 text-[11px]">✨ Personalizado</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {activeTab === "depth" ? "Entrada, Meio, Fundo" : "Chão, N2, Aéreo, Topo"}
                </div>
              </button>
            </div>
          </div>

          {/* Configuração Detalhada */}
          <div className="grid grid-cols-2 gap-4">
            {/* Coluna Esquerda: Definições de Sequência */}
            <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Definições da Dimensão
              </span>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Nome Exibido</label>
                <input
                  type="text"
                  value={currentConfig.displayName}
                  onChange={(e) => handleUpdateField("displayName", e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Tipo de Sequência</label>
                <select
                  value={currentConfig.sequenceType}
                  onChange={(e) => handleUpdateField("sequenceType", e.target.value as SequenceType)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                >
                  <option value="numeric">Numérica (1, 2, 3, 4, 5...)</option>
                  <option value="numeric_pad">Numérica com zero (01, 02, 03...)</option>
                  <option value="alphabetic">Alfabética (A, B, C, D, E...)</option>
                  <option value="alphanumeric">Alfanumérica (Prefixo + Número, ex: N1, N2)</option>
                  <option value="custom_list">Lista de Nomes Personalizados</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Sentido / Orientação</label>
                <select
                  value={currentConfig.orientation}
                  onChange={(e) =>
                    handleUpdateField("orientation", e.target.value as DimensionOrientation)
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                >
                  {isLevelTab ? (
                    <>
                      <option value="bottom_to_top">De Baixo para Cima (Chão = 1)</option>
                      <option value="top_to_bottom">De Cima para Baixo (Topo = 1)</option>
                    </>
                  ) : (
                    <>
                      <option value="front_to_back">Da Entrada para o Fundo (LIFO padrão)</option>
                      <option value="back_to_front">Do Fundo para a Entrada</option>
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Qtd. Padrão</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={currentConfig.defaultCount}
                    onChange={(e) => handleUpdateField("defaultCount", Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Prefixo Opcional</label>
                  <input
                    type="text"
                    placeholder="Ex: N ou P"
                    value={currentConfig.prefix || ""}
                    onChange={(e) => handleUpdateField("prefix", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Coluna Direita: Separação entre Ordem Física e Identificador */}
            <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex flex-col">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Tabela de Mapeamento (Ordem Física × Identificação)
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  A ordem física interna é imutável; a identificação externa é totalmente configurável.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto max-h-56 border border-slate-800 rounded-lg">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="py-1.5 px-2 font-mono">Ordem</th>
                      <th className="py-1.5 px-2">Identificador</th>
                      <th className="py-1.5 px-2">Exibição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {currentConfig.items.map((item) => (
                      <tr key={item.physicalIndex} className="hover:bg-slate-800/40">
                        <td className="py-1 px-2 text-slate-500">#{item.physicalIndex + 1}</td>
                        <td className="py-1 px-2 font-bold text-amber-400">{item.identifier}</td>
                        <td className="py-1 px-2 text-slate-300 font-sans">{item.displayName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-2 bg-purple-950/30 border border-purple-900/40 rounded-lg text-[10px] text-purple-300 leading-tight">
                💡 <strong>Princípio de Independência:</strong> Alterar as nomenclaturas de "1..5" para "A..E"
                não corrompe o histórico nem as chaves de banco de dados, apenas a camada de representação e busca.
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-slate-800 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors"
          >
            Salvar Nomenclaturas
          </button>
        </div>
      </div>
    </div>
  )
}
