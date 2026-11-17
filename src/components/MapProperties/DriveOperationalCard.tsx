// ============================================================
// NEXUS ERP — MapProperties / DriveOperationalCard.tsx
// Painel de Configuração Estrutural & Restrições do Drive-In
// MODO MAPEAMENTO & CONFIGURAÇÃO:
// Define a estrutura física, canais, capacidades nominais,
// restrições de armazenagem e parâmetros técnicos de utilização.
// (NÃO executa operações nem cadastra estoques/avarias)
// ============================================================

"use client"

import React, { useMemo } from "react"
import type { MapObject } from "../MapLibrary/types"
import type { DimensionConfig, StorageChannel } from "../MapLibrary/dimensionsTypes"
import { DEFAULT_G300_LEVELS_CONFIG, DEFAULT_G300_DEPTH_CONFIG } from "../MapLibrary/dimensionManager"
import { STANDARD_PALLET_MODELS, calculateDrivePhysicalDimensions } from "../MapLibrary/palletModels"
import { ensureDriveChannels } from "../MapLibrary/spatialContainment"
import DriveTunnelPositionsViewer from "./DriveTunnelPositionsViewer"
import ObjectDimensionConfigSection from "./ObjectDimensionConfigSection"
import { useSystemStore } from "../Systems/useSystemStore"

interface DriveOperationalCardProps {
  selectedObject: MapObject
  onUpdateObject: (partial: Partial<MapObject>) => void
  onUpdateProp: (key: string, value: unknown) => void
  levelsConfig?: DimensionConfig
  depthConfig?: DimensionConfig
  allObjects?: MapObject[]
}

export default function DriveOperationalCard({
  selectedObject,
  onUpdateObject,
  onUpdateProp,
  levelsConfig = DEFAULT_G300_LEVELS_CONFIG,
  depthConfig = DEFAULT_G300_DEPTH_CONFIG,
  allObjects = [],
}: DriveOperationalCardProps) {
  const props = selectedObject.props || {}
  const code = String(props.code || selectedObject.label || selectedObject.id.slice(0, 8))
  const chao = String(props.chao || "001")
  const bloco = String(props.bloco || "1")
  const lado = String(props.lado || "PAR")
  const responsible = String(props.responsible || "Supervisão Logística G300")
  const purpose = String(props.purpose || "Armazenagem Geral")

  // Vínculos Estruturais (Rua, Bloco, Área Pai)
  const streetId = String(props.streetId || "")
  const streetName = String(props.streetName || "")
  const blocoId = String(props.blocoId || "")

  const streetOptions = useMemo(() => {
    return allObjects.filter(
      (o) =>
        o.classification === "rua" ||
        o.classification === "circulacao" ||
        (o.category === "area" && (o.label || "").toLowerCase().includes("rua"))
    )
  }, [allObjects])

  const blockOptions = useMemo(() => {
    return allObjects.filter(
      (o) =>
        o.classification === "bloco" ||
        (o.category === "area" && (o.label || "").toLowerCase().includes("bloco"))
    )
  }, [allObjects])

  const parentAreaOptions = useMemo(() => {
    return allObjects.filter(
      (o) => (o.category === "area" || o.type === "floor") && o.id !== selectedObject.id
    )
  }, [allObjects, selectedObject.id])

  const handleSelectStreet = (stId: string) => {
    if (!stId) {
      onUpdateProp("streetId", undefined)
      onUpdateProp("streetName", undefined)
      return
    }
    const found = streetOptions.find((s) => s.id === stId)
    if (found) {
      onUpdateProp("streetId", found.id)
      onUpdateProp("streetName", found.label || found.id)
      // Se a rua tiver pai (ex: bloco), sugere vínculo
      if (found.parentId && !selectedObject.parentId) {
        onUpdateObject({ parentId: found.parentId })
      }
    }
  }

  const handleSelectBlock = (bId: string) => {
    if (!bId) {
      onUpdateProp("blocoId", undefined)
      return
    }
    const found = blockOptions.find((b) => b.id === bId)
    if (found) {
      onUpdateProp("blocoId", found.id)
      onUpdateProp("bloco", found.label || found.id)
    }
  }

  // Dimensões Estruturais
  const levels = Math.max(1, Number(props.levels || 4))
  const depth = Math.max(1, Number(props.depth || 4))
  const lanes = Math.max(1, Number(props.lanes || 1))

  // Capacidade Nominal Estrita (somente leitura derivada)
  const capacity = levels * depth * lanes
  const palletModelId = String(props.palletModel || "pbr1")
  const selectedPallet =
    STANDARD_PALLET_MODELS.find((m) => m.id === palletModelId) || STANDARD_PALLET_MODELS[0]

  // Limites Físicos & Parâmetros Estruturais
  const maxLoadKgPerPosition = Number(props.maxLoadKgPerPosition || 1200)
  const maxLoadTonPerLane = Number(props.maxLoadTonPerLane || 15)
  const maxHeightPerLevelM = Number(props.maxHeightPerLevelM || 1.65)

  // Controle de Preenchimento & Vínculo de Saldo
  const { systems, linkStorageToSystem } = useSystemStore()
  const stockControlMode = String(props.stockControlMode || "livre") as "livre" | "vinculado_saldo"
  const stockSystemRef = String(props.stockSystemRef || "")

  // Restrições de Armazenagem & Regras de Utilização
  const allowedCategories = String(
    props.allowedCategories || "Produtos Gerais, Secos, Embalados"
  )
  const forbiddenCategories = String(
    props.forbiddenCategories || "Inflamáveis, Químicos Corrosivos"
  )
  const allowedEquipment = String(
    props.allowedEquipment || "Empilhadeira Retrátil / Patolada com Guia"
  )
  const flowRule = String(props.flowRule || "LIFO (Last-In, First-Out)")

  // Nomenclatura específica DESTE objeto
  const objectLevelsConfig: DimensionConfig =
    (props.levelsConfig as DimensionConfig) || levelsConfig
  const objectDepthConfig: DimensionConfig =
    (props.depthConfig as DimensionConfig) || depthConfig

  // Canais de Armazenagem do Drive-In
  const channels: StorageChannel[] = useMemo(() => {
    return ensureDriveChannels(selectedObject)
  }, [selectedObject])

  const handleUpdateChannelName = (channelId: string, newName: string) => {
    const updated = channels.map((c) => (c.id === channelId ? { ...c, name: newName } : c))
    onUpdateProp("channels", updated)
  }

  // Redimensionamento Físico Dinâmico do Túnel no Canvas
  const applyDriveGeometry = (newDepth: number, newLanes: number, modelId: string) => {
    const dims = calculateDrivePhysicalDimensions(newDepth, newLanes, modelId)
    const ppm = Number(selectedObject.props?.pixelsPerMeter) || 20
    const newHeight = Math.round(dims.realLengthM * ppm)
    const newWidth = Math.round(dims.realWidthM * ppm)
    onUpdateObject({ width: newWidth, height: newHeight })
  }

  const handleUpdateLevels = (newLevels: number) => {
    const val = Math.max(1, newLevels)
    onUpdateProp("levels", val)
    onUpdateProp("capacity", val * depth * lanes)
  }

  const handleUpdateDepth = (newDepth: number) => {
    const val = Math.max(1, newDepth)
    onUpdateProp("depth", val)
    onUpdateProp("capacity", levels * val * lanes)
    applyDriveGeometry(val, lanes, palletModelId)
  }

  const handleUpdateLanes = (newLanes: number) => {
    const val = Math.max(1, newLanes)
    onUpdateProp("lanes", val)
    onUpdateProp("capacity", levels * depth * val)
    applyDriveGeometry(depth, val, palletModelId)
  }

  const handleSelectPalletModel = (modelId: string) => {
    onUpdateProp("palletModel", modelId)
    applyDriveGeometry(depth, lanes, modelId)
  }

  const tunnelDims = calculateDrivePhysicalDimensions(depth, lanes, palletModelId)

  return (
    <div className="space-y-3.5 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-slate-100 text-xs">
      {/* ── 1. IDENTIFICAÇÃO & LOCALIZAÇÃO FÍSICA ──────────────── */}
      <div className="space-y-2 pb-2.5 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
            Estrutura de Armazenagem · Drive-In
          </span>
          <span className="text-[9px] bg-slate-900 border border-slate-700/80 text-slate-300 font-mono px-1.5 py-0.5 rounded">
            LIFO
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Código Técnico</label>
            <input
              type="text"
              value={code}
              onChange={(e) => onUpdateProp("code", e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Nome / Etiqueta</label>
            <input
              type="text"
              value={String(selectedObject.label || "")}
              onChange={(e) => onUpdateObject({ label: e.target.value })}
              placeholder="Ex: Drive Sul 01"
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
          <div>
            <span className="text-[9px] text-slate-500 block">Chão / Corredor</span>
            <input
              type="text"
              value={chao}
              onChange={(e) => onUpdateProp("chao", e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-200 font-mono mt-0.5"
            />
          </div>
          <div>
            <span className="text-[9px] text-slate-500 block">Bloco Físico</span>
            <input
              type="text"
              value={bloco}
              onChange={(e) => onUpdateProp("bloco", e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-200 font-mono mt-0.5"
            />
          </div>
          <div>
            <span className="text-[9px] text-slate-500 block">Lado</span>
            <select
              value={lado}
              onChange={(e) => onUpdateProp("lado", e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-200 mt-0.5"
            >
              <option value="PAR">PAR</option>
              <option value="IMPAR">ÍMPAR</option>
              <option value="G">G (Esquerdo)</option>
              <option value="D">D (Direito)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-[9px] text-slate-400 block mb-0.5">Finalidade de Armazenagem</label>
            <select
              value={purpose}
              onChange={(e) => onUpdateProp("purpose", e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200"
            >
              <option value="Armazenagem Geral">Armazenagem Geral</option>
              <option value="Triagem de Avarias">Triagem de Avarias</option>
              <option value="Quarentena Técnica">Quarentena Técnica</option>
              <option value="Pulmão de Entrada">Pulmão de Entrada</option>
              <option value="Staging de Expedição">Staging de Expedição</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] text-slate-400 block mb-0.5">Responsável Técnico</label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => onUpdateProp("responsible", e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* ── 2. VÍNCULO ESTRUTURAL & ENDEREÇAMENTO (RUA & BLOCO) ──── */}
      <div className="space-y-2 p-2.5 bg-amber-950/20 rounded-lg border border-amber-800/40">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
            <span>🔗</span>
            <span>Vínculo Estrutural & Endereçamento</span>
          </span>
          {streetName && (
            <span className="text-[9px] bg-amber-900/60 text-amber-300 border border-amber-700/50 px-1.5 py-0.2 rounded font-mono">
              🛣️ {streetName}
            </span>
          )}
        </div>

        {/* Seleção da Rua / Corredor de Acesso */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-300 font-medium flex items-center justify-between">
            <span>Rua / Corredor de Acesso</span>
            {streetId && (
              <button
                type="button"
                onClick={() => handleSelectStreet("")}
                className="text-[9px] text-red-400 hover:text-red-300"
              >
                Desvincular
              </button>
            )}
          </label>
          <select
            value={streetId}
            onChange={(e) => handleSelectStreet(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 font-medium focus:outline-none focus:border-amber-500"
          >
            <option value="">— Selecionar Rua no Mapa —</option>
            {streetOptions.map((st) => (
              <option key={st.id} value={st.id}>
                🛣️ {st.label || st.id} ({st.classification || "rua"})
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 mt-1">
            <input
              type="text"
              placeholder="Ou digite o nome da rua (ex: Rua 01)..."
              value={streetName}
              onChange={(e) => onUpdateProp("streetName", e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[11px] text-slate-300 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Seleção do Bloco Estrutural e Área Pai */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-900/30">
          <div>
            <label className="text-[9px] text-slate-400 block mb-0.5">Bloco Estrutural</label>
            <select
              value={blocoId}
              onChange={(e) => handleSelectBlock(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-slate-200"
            >
              <option value="">— Selecionar Bloco —</option>
              {blockOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  🧱 {b.label || b.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] text-slate-400 block mb-0.5">Área / Galpão Pai</label>
            <select
              value={selectedObject.parentId || ""}
              onChange={(e) => onUpdateObject({ parentId: e.target.value || undefined })}
              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-slate-200"
            >
              <option value="">— Nível Raiz / Sem Pai —</option>
              {parentAreaOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.type === "floor" ? "🏢" : "📐"} {p.label || p.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Visualizador de Endereço Hierárquico Completo */}
        <div className="mt-1 p-1.5 bg-slate-950/70 rounded border border-slate-800/80 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
          <span className="text-amber-400">Hierarquia:</span>
          <span className="text-slate-300 truncate">
            {selectedObject.parentId ? "Galpão" : "Raiz"} ➔ {bloco ? `Bloco ${bloco}` : "Bloco 1"} ➔ {streetName ? streetName : "Sem Rua"} ➔ {code}
          </span>
        </div>
      </div>

      {/* ── 2. ESTRUTURA FÍSICA & DIMENSÕES ────────────────────── */}
      <div className="space-y-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          Estrutura Física & Dimensões
        </span>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 block">Níveis Verticais</label>
            <input
              type="number"
              min={1}
              max={12}
              value={levels}
              onChange={(e) => handleUpdateLevels(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-xs text-amber-400 font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block">Profundidade</label>
            <input
              type="number"
              min={1}
              max={20}
              value={depth}
              onChange={(e) => handleUpdateDepth(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-xs text-amber-400 font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block">Vãos Frontais</label>
            <input
              type="number"
              min={1}
              max={10}
              value={lanes}
              onChange={(e) => handleUpdateLanes(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-xs text-amber-400 font-bold"
            />
          </div>
        </div>

        {/* Pallet de Referência */}
        <div className="pt-1.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Pallet de Referência:</span>
            <span className="text-[10px] font-mono text-cyan-400">
              {tunnelDims.realWidthM.toFixed(2)}m larg. × {tunnelDims.realLengthM.toFixed(2)}m comp.
            </span>
          </div>
          <select
            value={palletModelId}
            onChange={(e) => handleSelectPalletModel(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            {STANDARD_PALLET_MODELS.map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">
                {m.name} ({m.widthM.toFixed(2)}m × {m.lengthM.toFixed(2)}m)
              </option>
            ))}
          </select>
          <p className="text-[9px] text-slate-500">
            Dimensionamento proporcional com folgas ABNT/RMI (12cm entre pallets + 20cm embocadura + 40cm trilhos).
          </p>
        </div>
      </div>

      {/* ── 3. CANAIS DE ARMAZENAGEM (VÃOS / TÚNEIS) ───────────── */}
      <div className="space-y-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">🏷️</span>
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
              Canais de Armazenagem ({channels.length})
            </span>
          </div>
          <span className="text-[9px] text-slate-400 font-mono">
            {lanes} vão(s) frontal(is)
          </span>
        </div>

        <p className="text-[10px] text-slate-400 leading-tight">
          O canal agrupa física e logicamente as posições do túnel. Nomeie cada canal livremente:
        </p>

        <div className="space-y-1.5">
          {channels.map((chan) => (
            <div
              key={chan.id}
              className="p-2 bg-slate-950/80 rounded border border-slate-800/80 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-slate-400 font-semibold">
                  {chan.code}
                </span>
                <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                  Vão {chan.laneIndex} · {chan.capacity} paletes ({levels}N×{depth}P)
                </span>
              </div>

              <input
                type="text"
                value={chan.name}
                onChange={(e) => handleUpdateChannelName(chan.id, e.target.value)}
                placeholder="Ex: Canal MKLOG, Canal Jaqueline, Canal Quarentena"
                className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. CAPACIDADES NOMINAIS & LIMITES DE CARGA ─────────── */}
      <div className="space-y-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          Capacidade Nominal & Limites Físicos
        </span>

        {/* Capacidade Nominal Calculada */}
        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] text-amber-300 font-medium block">
              Capacidade Nominal Total:
            </span>
            <span className="text-[9px] text-slate-400">
              {levels} Níveis × {depth} Profundidades {lanes > 1 ? `× ${lanes} Vãos` : ""}
            </span>
          </div>
          <span className="font-mono font-bold text-amber-400 text-sm">
            {capacity} pallets
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 text-[10px]">
          <div>
            <label className="text-slate-400 block mb-0.5">Carga Máx / Posição</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={maxLoadKgPerPosition}
                onChange={(e) => onUpdateProp("maxLoadKgPerPosition", Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-right font-mono text-slate-200"
              />
              <span className="text-slate-500 text-[9px]">kg</span>
            </div>
          </div>
          <div>
            <label className="text-slate-400 block mb-0.5">Carga Máx / Vão</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={maxLoadTonPerLane}
                onChange={(e) => onUpdateProp("maxLoadTonPerLane", Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-right font-mono text-slate-200"
              />
              <span className="text-slate-500 text-[9px]">ton</span>
            </div>
          </div>
          <div>
            <label className="text-slate-400 block mb-0.5">Altura Útil Máx</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.05"
                value={maxHeightPerLevelM}
                onChange={(e) => onUpdateProp("maxHeightPerLevelM", Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-right font-mono text-slate-200"
              />
              <span className="text-slate-500 text-[9px]">m</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. RESTRIÇÕES DE ARMAZENAGEM & REGRAS DE USO ──────── */}
      <div className="space-y-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          Restrições de Armazenagem & Regras
        </span>

        <div className="space-y-1.5">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">
              Categorias de Produtos Permitidos
            </label>
            <input
              type="text"
              value={allowedCategories}
              onChange={(e) => onUpdateProp("allowedCategories", e.target.value)}
              placeholder="Ex: Secos, Alimentos, Embalados"
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">
              Categorias Proibidas / Restritas
            </label>
            <input
              type="text"
              value={forbiddenCategories}
              onChange={(e) => onUpdateProp("forbiddenCategories", e.target.value)}
              placeholder="Ex: Inflamáveis, Corrosivos, Perecíveis"
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-red-300 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[9px] text-slate-400 block mb-0.5">Equipamento Compatível</label>
              <input
                type="text"
                value={allowedEquipment}
                onChange={(e) => onUpdateProp("allowedEquipment", e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200"
              />
            </div>
            <div>
              <label className="text-[9px] text-slate-400 block mb-0.5">Regra de Fluxo Físico</label>
              <select
                value={flowRule}
                onChange={(e) => onUpdateProp("flowRule", e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200"
              >
                <option value="LIFO (Last-In, First-Out)">LIFO (Drive-In)</option>
                <option value="FIFO (First-In, First-Out)">FIFO (Drive-Through)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. CONTROLE DE ACESSO A PREENCHIMENTO ────────────── */}
      <div className="space-y-2.5 p-2.5 rounded-lg border border-slate-700/60"
        style={{ background: stockControlMode === "vinculado_saldo" ? "rgba(16,30,54,0.85)" : "rgba(15,23,42,0.80)" }}>
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5"
            style={{ color: stockControlMode === "vinculado_saldo" ? "#60a5fa" : "#94a3b8" }}>
            <span>🔐</span>
            <span>Controle de Acesso a Preenchimento</span>
          </span>
          {/* Badge de modo atual */}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono border ${
            stockControlMode === "vinculado_saldo"
              ? "bg-blue-900/60 border-blue-700/50 text-blue-300"
              : "bg-slate-800/80 border-slate-700/50 text-slate-400"
          }`}>
            {stockControlMode === "vinculado_saldo" ? "Saldo Obrigatório" : "Livre"}
          </span>
        </div>

        {/* Seleção do modo — radio visual */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-400">
            Define se as posições deste Drive podem ser preenchidas livremente ou apenas quando
            houver saldo registrado no sistema operacional:
          </p>

          {/* Opção: Livre */}
          <button
            type="button"
            onClick={() => onUpdateProp("stockControlMode", "livre")}
            className={`w-full flex items-start gap-2.5 p-2 rounded-lg border text-left transition-colors ${
              stockControlMode === "livre"
                ? "bg-slate-800/80 border-slate-600 ring-1 ring-slate-500/60"
                : "bg-slate-900/50 border-slate-800/60 hover:border-slate-700"
            }`}
          >
            <span className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
              stockControlMode === "livre"
                ? "border-slate-400 bg-slate-400"
                : "border-slate-600 bg-transparent"
            }`}>
              {stockControlMode === "livre" && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 block" />
              )}
            </span>
            <div>
              <span className={`text-[11px] font-semibold block ${
                stockControlMode === "livre" ? "text-slate-200" : "text-slate-500"
              }`}>Livre — sem verificação de saldo</span>
              <span className="text-[9px] text-slate-500 leading-tight">
                As posições podem ser preenchidas manualmente, sem consulta ao sistema de saldo.
                Indicado para Drives de uso interno, triagem ou quarentena.
              </span>
            </div>
          </button>

          {/* Opção: Vinculado ao Saldo */}
          <button
            type="button"
            onClick={() => onUpdateProp("stockControlMode", "vinculado_saldo")}
            className={`w-full flex items-start gap-2.5 p-2 rounded-lg border text-left transition-colors ${
              stockControlMode === "vinculado_saldo"
                ? "bg-blue-950/50 border-blue-700/60 ring-1 ring-blue-600/40"
                : "bg-slate-900/50 border-slate-800/60 hover:border-slate-700"
            }`}
          >
            <span className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
              stockControlMode === "vinculado_saldo"
                ? "border-blue-400 bg-blue-400"
                : "border-slate-600 bg-transparent"
            }`}>
              {stockControlMode === "vinculado_saldo" && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 block" />
              )}
            </span>
            <div>
              <span className={`text-[11px] font-semibold block ${
                stockControlMode === "vinculado_saldo" ? "text-blue-300" : "text-slate-500"
              }`}>Vinculado ao Saldo — requer saldo no sistema</span>
              <span className="text-[9px] text-slate-500 leading-tight">
                O módulo operacional somente permitirá o preenchimento de posições se houver saldo
                disponível no sistema de referência. Indicado para Drives de armazenagem controlada.
              </span>
            </div>
          </button>
        </div>

        {/* Campo: Sistema de Saldo de Referência — aparece só quando vinculado */}
        {stockControlMode === "vinculado_saldo" && (
          <div className="pt-1.5 border-t border-blue-900/40 space-y-1.5 animate-in fade-in duration-200">
            <label className="text-[10px] text-blue-300 font-medium flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>📋</span>
                <span>Sistema de Saldo Vinculado</span>
              </span>
              {stockSystemRef && (
                <span className="text-[9px] text-blue-400 font-mono">
                  {stockSystemRef}
                </span>
              )}
            </label>

            {/* Dropdown com os Sistemas do Catálogo */}
            <select
              value={stockSystemRef}
              onChange={(e) => {
                const chosenCode = e.target.value
                onUpdateProp("stockSystemRef", chosenCode)
                const foundSys = systems.find((s) => s.code === chosenCode || s.id === chosenCode)
                if (foundSys) {
                  linkStorageToSystem(foundSys.id, {
                    storageObjectId: selectedObject.id,
                    storageObjectLabel: String(selectedObject.label || selectedObject.id),
                    storageType: selectedObject.type,
                    role: "armazenamento",
                    stockControlMode: "vinculado_saldo",
                    permissions: {
                      allowInbound: true,
                      allowOutbound: true,
                      allowReturnToOrigin: true,
                    },
                    configuredAt: new Date().toISOString(),
                  })
                }
              }}
              className="w-full bg-blue-950/60 border border-blue-700/60 rounded px-2 py-1 text-xs text-blue-100 font-semibold focus:outline-none focus:border-blue-400"
            >
              <option value="">— Selecionar Sistema de Saldo —</option>
              {systems.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.icon} {s.name} ({s.code}) {s.originStorageLabel ? `— Origem: ${s.originStorageLabel}` : ""}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <input
                type="text"
                value={stockSystemRef}
                onChange={(e) => onUpdateProp("stockSystemRef", e.target.value)}
                placeholder="Ou digite o código do sistema (ex: AVARIAS_G300, RETRABALHO)..."
                className="w-full bg-blue-950/40 border border-blue-800/50 rounded px-2 py-0.5 text-[11px] text-blue-200 placeholder-blue-800/70 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <p className="text-[9px] text-blue-400/80 leading-tight">
              O módulo operacional futuro verificará se há saldo registrado neste sistema
              (originado no objeto CHÃO/Entrada) antes de permitir alocar mercadorias neste Drive.
            </p>
          </div>
        )}

        {/* Aviso de escopo */}
        <div className="flex items-start gap-1.5 p-1.5 bg-amber-950/30 border border-amber-900/40 rounded text-[9px] text-amber-700/80 leading-tight">
          <span className="text-amber-600 flex-shrink-0 mt-0.5">⚠️</span>
          <span>
            Esta é uma <strong className="text-amber-600">configuração estrutural</strong>. O controle
            efetivo de saldo será aplicado pelo módulo operacional futuro — não pelo editor de mapeamento.
          </span>
        </div>
      </div>

      {/* ── 7. NOMENCLATURA & IDENTIFICAÇÃO DE DIMENSÕES ──────── */}
      <ObjectDimensionConfigSection
        levelsCount={levels}
        depthCount={depth}
        objectLevelsConfig={objectLevelsConfig}
        objectDepthConfig={objectDepthConfig}
        onUpdateProp={onUpdateProp}
      />

      {/* ── 8. INSPETOR ESTRUTURAL DE ENDEREÇAMENTO ───────────── */}
      <DriveTunnelPositionsViewer
        structureId={selectedObject.id}
        structureCode={code}
        levelsCount={levels}
        depthCount={depth}
        capacity={capacity}
        levelsConfig={objectLevelsConfig}
        depthConfig={objectDepthConfig}
        channels={channels}
      />
    </div>
  )
}
