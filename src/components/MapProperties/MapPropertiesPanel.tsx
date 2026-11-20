// ============================================================
// NEXUS ERP — MapProperties / MapPropertiesPanel.tsx
// Painel lateral de propriedades do elemento selecionado
// Suporte a: elementos padrão, áreas polígonos, pisos
// com AreaPropertiesCard inline para objetos category "area"
// ============================================================

"use client"

import React, { useState } from "react"
import type { MapObject, MapPropField } from "../MapLibrary/types"
import { ELEMENT_BY_TYPE } from "../MapLibrary/registry"
import DriveOperationalCard from "./DriveOperationalCard"
import CompartmentOperationalCard from "./CompartmentOperationalCard"
import LinkedResourcesSection from "../Resources/LinkedResourcesSection"
import type { CustomEntityRecord } from "../MapLibrary/modulesTypes"
import { INITIAL_AREA_CLASSIFICATIONS, calculateAreaM2 } from "../MapLibrary/areaClassifier"
import { FLOOR_SURFACES, FLOOR_SURFACES_LIST, type FloorMaterialType } from "../MapLibrary/floorSurfaces"

import type { DimensionConfig } from "../MapLibrary/dimensionsTypes"
import type { PhysicalDimensions } from "../MapLibrary/types"
import PhysicalDimensionsCard from "./PhysicalDimensionsCard"
import ObjectDimensionConfigSection from "./ObjectDimensionConfigSection"

interface MapPropertiesPanelProps {
  selectedObject: MapObject | null
  onUpdateObject: (updated: Partial<MapObject>) => void
  onUpdateProp: (key: string, value: unknown) => void
  onDuplicate: () => void
  onDelete: () => void
  onBringForward: () => void
  onSendBackward: () => void
  records: CustomEntityRecord[]
  onAddRecord: (record: Partial<CustomEntityRecord>) => void
  allObjects?: MapObject[]
  selectedChannelId?: string | null
  levelsConfig?: DimensionConfig
  depthConfig?: DimensionConfig
  pixelsPerMeter?: number
  onSaveAsModelDefault?: (modelType: string, dims: PhysicalDimensions) => void
  onOpenResourceEngine?: () => void
  workspaceId?: string
}

// ── Card de Classificação e Atributos da Área ─────────────────
function AreaPropertiesCard({
  obj,
  onUpdateObject,
  allObjects,
}: {
  obj: MapObject
  onUpdateObject: (partial: Partial<MapObject>) => void
  allObjects: MapObject[]
}) {
  const [newFieldKey, setNewFieldKey] = useState("")
  const [newFieldVal, setNewFieldVal] = useState("")

  const areaM2 = calculateAreaM2(obj)
  const customProps = (obj.props.customFields as Record<string, string>) || {}

  const isFloor = obj.type === "floor"
  const potentialParents = allObjects.filter(
    (o) => o.category === "area" && o.id !== obj.id
  )

  const addCustomField = () => {
    if (!newFieldKey.trim()) return
    const updated = { ...customProps, [newFieldKey.trim()]: newFieldVal }
    onUpdateObject({ props: { ...obj.props, customFields: updated } })
    setNewFieldKey("")
    setNewFieldVal("")
  }

  const removeCustomField = (key: string) => {
    const updated = { ...customProps }
    delete updated[key]
    onUpdateObject({ props: { ...obj.props, customFields: updated } })
  }

  return (
    <div className="space-y-3">
      {/* Badge de tipo */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{isFloor ? "🏢" : "📐"}</span>
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
            {isFloor ? "Piso / Planta" : "Área Delimitada"}
          </div>
          <div className="text-[11px] text-slate-400">
            Entidade espacial com geometria, atributos e relacionamentos
          </div>
        </div>
      </div>

      {/* Nome e Identificador */}
      <div className="space-y-2 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Nome</label>
          <input
            type="text"
            value={obj.label || ""}
            onChange={(e) => onUpdateObject({ label: e.target.value })}
            placeholder="Ex: Área de Avarias, Piso 1, Quarentena"
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Identificador</label>
          <input
            type="text"
            value={String(obj.props.identifier || "")}
            onChange={(e) => onUpdateObject({ props: { ...obj.props, identifier: e.target.value } })}
            placeholder="Ex: AREA-001, G300-AVARIAS"
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Superfície / Material de Apoio (Pisos e Solos) */}
      <div className="space-y-1.5 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span>🏗️</span>
            <span>Tipo de Superfície de Apoio</span>
          </span>
          <span className="text-[9px] text-blue-400 font-normal">Base do Chão</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {FLOOR_SURFACES_LIST.map((mat) => {
            const isSelected =
              obj.props.floorMaterial === mat.id ||
              obj.type === `floor_${mat.id}` ||
              (mat.id === "concrete" && !obj.props.floorMaterial && obj.type === "floor")

            return (
              <button
                key={mat.id}
                type="button"
                onClick={() => {
                  onUpdateObject({
                    color: mat.color,
                    strokeColor: mat.strokeColor,
                    classification: mat.id === "grass" ? "grama" : mat.id === "asphalt" ? "asfalto" : "piso_geral",
                    props: {
                      ...obj.props,
                      floorMaterial: mat.id,
                      surfaceName: mat.name,
                    },
                  })
                }}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "bg-slate-800 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/50"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
                title={mat.description}
              >
                <span className="text-base shrink-0">{mat.icon}</span>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold leading-tight truncate">{mat.name}</div>
                  <div className="text-[9px] text-slate-500 capitalize">{mat.category === "external" ? "Externo" : "Interno"}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Classificação */}
      <div className="space-y-1.5 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Classificação
        </label>
        <div className="grid grid-cols-2 gap-1">
          {INITIAL_AREA_CLASSIFICATIONS.map((cls) => (
            <button
              key={cls.id}
              onClick={() =>
                onUpdateObject({
                  classification: cls.id,
                  color: cls.color,
                  strokeColor: cls.borderColor,
                })
              }
              className={`text-left px-2 py-1.5 rounded-md border text-[10px] transition-all ${
                obj.classification === cls.id
                  ? "border-opacity-100 font-bold"
                  : "border-slate-700/40 text-slate-500 hover:text-slate-200"
              }`}
              style={
                obj.classification === cls.id
                  ? { borderColor: cls.borderColor, color: cls.borderColor, background: cls.color }
                  : {}
              }
              title={cls.description}
            >
              {cls.name}
            </button>
          ))}
        </div>

        {/* Classificação livre */}
        <div className="mt-1">
          <label className="text-[10px] text-slate-500">Classificação personalizada</label>
          <input
            type="text"
            value={obj.classification || ""}
            onChange={(e) => onUpdateObject({ classification: e.target.value })}
            placeholder="Ou digite livremente..."
            className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Cores */}
      <div className="flex gap-3 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">Preenchimento</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={obj.color?.replace(/rgba\([^)]+\)/, "#6366f1") || "#6366f1"}
              onChange={(e) => onUpdateObject({ color: e.target.value + "26" })}
              className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 font-mono truncate">
              {obj.color || "padrão"}
            </span>
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-semibold text-slate-400">Borda</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={obj.strokeColor || "#6366f1"}
              onChange={(e) => onUpdateObject({ strokeColor: e.target.value })}
              className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 font-mono truncate">
              {obj.strokeColor || "#6366f1"}
            </span>
          </div>
        </div>
      </div>

      {/* Área Calculada */}
      {areaM2 > 0 && (
        <div className="flex items-center justify-between px-2.5 py-2 bg-emerald-950/20 rounded-lg border border-emerald-800/30">
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" />
              <path d="M9 3v18M3 9h18" strokeDasharray="3 3" />
            </svg>
            <span className="text-[11px] text-emerald-400 font-semibold">Área Calculada</span>
          </div>
          <span className="text-sm font-bold font-mono text-emerald-300">{areaM2} m²</span>
        </div>
      )}

      {/* Regras de Utilização & Responsabilidade */}
      <div className="space-y-2 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Regras de Utilização & Responsabilidade
        </span>

        <div className="space-y-1.5">
          <div>
            <label className="text-[10px] text-slate-500">Responsável pelo Setor / Espaço</label>
            <input
              type="text"
              value={obj.responsible || ""}
              onChange={(e) => onUpdateObject({ responsible: e.target.value })}
              placeholder="Ex: Supervisão G300, Líder de Avarias"
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-500">Condição de Utilização</label>
            <select
              value={obj.operationalSituation || "ativa"}
              onChange={(e) => onUpdateObject({ operationalSituation: e.target.value })}
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
            >
              <option value="ativa">✅ Liberado para Uso</option>
              <option value="interditada">⛔ Acesso Restrito / Interditado</option>
              <option value="manutencao">🔧 Em Adequação Estrutural</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-500">Restrições & Regras de Acesso</label>
            <textarea
              value={obj.restrictions || ""}
              onChange={(e) => onUpdateObject({ restrictions: e.target.value })}
              placeholder="Descreva restrições de tráfego, equipamentos permitidos, produtos proibidos..."
              rows={2}
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Área Pai (Hierarquia) */}
      {potentialParents.length > 0 && (
        <div className="space-y-1 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Área Pai (Hierarquia)
          </label>
          <select
            value={obj.parentId || ""}
            onChange={(e) => onUpdateObject({ parentId: e.target.value || undefined })}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none"
          >
            <option value="">— Sem área pai (nível raiz) —</option>
            {potentialParents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label || p.type} ({p.classification || "sem classificação"})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Piso: Propriedades Reais */}
      {isFloor && (
        <div className="space-y-2 p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/40">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            🏢 Dimensões Reais do Piso
          </span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">Largura real (m)</label>
              <input
                type="number"
                value={Number(obj.props.realWidthM || 0)}
                onChange={(e) =>
                  onUpdateObject({ props: { ...obj.props, realWidthM: Number(e.target.value) } })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Comprimento real (m)</label>
              <input
                type="number"
                value={Number(obj.props.realHeightM || 0)}
                onChange={(e) =>
                  onUpdateObject({ props: { ...obj.props, realHeightM: Number(e.target.value) } })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500">Escala (px por metro)</label>
              <input
                type="number"
                value={Number(obj.props.pixelsPerMeter || 20)}
                min={1}
                onChange={(e) =>
                  onUpdateObject({ props: { ...obj.props, pixelsPerMeter: Number(e.target.value) } })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* Campos Personalizados */}
      <div className="space-y-2 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Campos Personalizados
        </span>

        {Object.entries(customProps).length > 0 && (
          <div className="space-y-1">
            {Object.entries(customProps).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5 group">
                <span className="text-[10px] text-slate-400 font-mono flex-1 truncate">{key}</span>
                <span className="text-[10px] text-slate-200 flex-1 truncate">{val}</span>
                <button
                  onClick={() => removeCustomField(key)}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-300 text-[10px] transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1">
          <input
            type="text"
            value={newFieldKey}
            onChange={(e) => setNewFieldKey(e.target.value)}
            placeholder="Campo"
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-blue-600"
          />
          <input
            type="text"
            value={newFieldVal}
            onChange={(e) => setNewFieldVal(e.target.value)}
            placeholder="Valor"
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-blue-600"
            onKeyDown={(e) => e.key === "Enter" && addCustomField()}
          />
          <button
            onClick={addCustomField}
            className="px-2 py-1 bg-blue-900/60 text-blue-300 border border-blue-800/40 rounded text-[10px] hover:bg-blue-800/60 transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MapPropertiesPanel({
  selectedObject,
  onUpdateObject,
  onUpdateProp,
  onDuplicate,
  onDelete,
  onBringForward,
  onSendBackward,
  records,
  onAddRecord,
  allObjects = [],
  selectedChannelId,
  levelsConfig,
  depthConfig,
  pixelsPerMeter = 20,
  onSaveAsModelDefault,
  onOpenResourceEngine,
  workspaceId,
}: MapPropertiesPanelProps) {
  const isCompartment = selectedObject?.type === "compartment"
  const isDrive = Boolean(
    selectedObject &&
      !isCompartment &&
      (selectedObject.type.includes("drive") ||
        selectedObject.category === "storage" ||
        Array.isArray(selectedObject.props?.channels))
  )

  const [activeTab, setActiveTab] = useState<"visual" | "operational">(
    isDrive || isCompartment ? "operational" : "visual"
  )

  // Quando seleciona um Drive-In ou estrutura de armazenagem, abre direto na aba de Estrutura & Canais
  React.useEffect(() => {
    if (isDrive || isCompartment) {
      setActiveTab("operational")
    }
  }, [selectedObject?.id, isDrive, isCompartment])

  if (!selectedObject) {
    return (
      <div className="w-full h-full bg-slate-900 border-l border-slate-800 p-4 text-slate-100 flex flex-col items-center justify-center text-center select-none">
        <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18M15 3v18M3 9h18M3 15h18" strokeDasharray="2 2" />
          </svg>
        </div>
        <h4 className="text-xs font-semibold text-slate-300 mb-1">Nenhum objeto selecionado</h4>
        <p className="text-[11px] text-slate-500 max-w-[200px]">
          Clique em um elemento do mapa para visualizar e editar suas dimensões físicas e dados operacionais.
        </p>
      </div>
    )
  }

  const elemDef = ELEMENT_BY_TYPE.get(selectedObject.type)
  const isArea = selectedObject.category === "area"

  return (
    <div className="w-full h-full bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col select-none overflow-y-auto">
      {/* Cabeçalho do Objeto */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400">
            {isArea
              ? selectedObject.type === "floor"
                ? "🏢 Piso"
                : "📐 Área"
              : elemDef?.label || selectedObject.type}
          </span>
          <h3 className="text-xs font-bold text-slate-100 truncate max-w-[180px]">
            {selectedObject.label || selectedObject.id.slice(0, 8)}
          </h3>
        </div>
        <button
          onClick={() => onUpdateObject({ locked: !selectedObject.locked })}
          className={`px-2 py-1 text-[10px] rounded font-medium transition-colors ${
            selectedObject.locked
              ? "bg-red-950/60 text-red-400 border border-red-800/40"
              : "bg-slate-800 text-slate-400 hover:text-slate-200"
          }`}
          title={selectedObject.locked ? "Objeto bloqueado" : "Bloquear objeto"}
        >
          {selectedObject.locked ? "Travado" : "Livre"}
        </button>
      </div>

      {/* Abas */}
      {!isArea && (
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-2 pt-1.5 gap-1">
          <button
            onClick={() => setActiveTab("visual")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 text-center ${
              activeTab === "visual"
                ? "border-blue-500 text-blue-400 bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            📐 Dimensões & Geometria
          </button>
          <button
            onClick={() => setActiveTab("operational")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 text-center ${
              activeTab === "operational"
                ? "border-amber-500 text-amber-400 bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            🏗️ Estrutura & Restrições
          </button>
        </div>
      )}

      <div className="p-3.5 space-y-4 flex-1">
        {/* Área: mostra AreaPropertiesCard diretamente sem abas */}
        {isArea ? (
          <>
            <AreaPropertiesCard
              obj={selectedObject}
              onUpdateObject={onUpdateObject}
              allObjects={allObjects}
            />
            <LinkedResourcesSection
              selectedObject={selectedObject}
              onOpenResourceEngine={onOpenResourceEngine}
            />
          </>
        ) : activeTab === "operational" ? (
          <>
            {isCompartment ? (
              <CompartmentOperationalCard
                selectedObject={selectedObject}
                onUpdateObject={onUpdateObject}
                onUpdateProp={onUpdateProp}
                allObjects={allObjects}
                workspaceId={workspaceId}
              />
            ) : (
              <DriveOperationalCard
                selectedObject={selectedObject}
                selectedChannelId={selectedChannelId}
                onUpdateObject={onUpdateObject}
                onUpdateProp={onUpdateProp}
                levelsConfig={levelsConfig}
                depthConfig={depthConfig}
                allObjects={allObjects}
                workspaceId={workspaceId}
              />
            )}
            <LinkedResourcesSection
              selectedObject={selectedObject}
              onOpenResourceEngine={onOpenResourceEngine}
            />
          </>
        ) : (
          <>
            {/* Atalho se for Drive-In ou Compartimento e estiver na aba de geometria */}
            {(isDrive || isCompartment) && (
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300">
                  {isCompartment ? "📦 Espaço Aberto & Vínculo" : "🏗️ Configuração de Canais & Teste"}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("operational")}
                  className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] transition-colors"
                >
                  {isCompartment ? "Abrir Espaço ▶" : "Abrir Canais & Teste ▶"}
                </button>
              </div>
            )}

            {/* Ações Especiais para Palete (Padrão PBR em escala métrica real) */}
            {selectedObject.type === "pallet" && (
              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-600/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                    <span>📦</span>
                    <span>Padronização PBR (1.0m × 1.2m)</span>
                  </span>
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                    Escala Real
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Calibra este palete para coincidir perfeitamente com os slots do Drive-In:
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateObject({
                        width: 20,
                        height: 24,
                        physicalDimensions: {
                          width: 1.0,
                          length: 1.2,
                          height: 0.14,
                          elevationZ: 0,
                          unit: "m",
                          lockAspectRatio: false,
                        },
                      })
                    }}
                    className="flex-1 py-1 px-2 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-[10px] transition-colors shadow-sm"
                  >
                    📐 Calibrar para PBR (20×24 px)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateProp("loaded", !selectedObject.props?.loaded)
                    }}
                    className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-colors"
                  >
                    {selectedObject.props?.loaded ? "📦 Carga Ativa" : "Vazio"}
                  </button>
                </div>
              </div>
            )}

            {/* Dimensões Físicas Reais (2D & 3D Ready) */}
            <PhysicalDimensionsCard
              selectedObject={selectedObject}
              pixelsPerMeter={pixelsPerMeter}
              onUpdateObject={onUpdateObject}
              onSaveAsModelDefault={onSaveAsModelDefault}
            />

            {/* Identificação */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Identificação / Tag</label>
              <input
                type="text"
                value={selectedObject.label || ""}
                onChange={(e) => onUpdateObject({ label: e.target.value })}
                placeholder="Ex: PP-01, RUA-A, MÁQ-04"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Geometria */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Posicionamento & Escala
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-500">Posição X</label>
                  <input
                    type="number"
                    value={Math.round(selectedObject.x)}
                    onChange={(e) => onUpdateObject({ x: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Posição Y</label>
                  <input
                    type="number"
                    value={Math.round(selectedObject.y)}
                    onChange={(e) => onUpdateObject({ y: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Largura (px)</label>
                  <input
                    type="number"
                    value={Math.round(selectedObject.width)}
                    onChange={(e) =>
                      onUpdateObject({ width: Math.max(10, Number(e.target.value)) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Altura (px)</label>
                  <input
                    type="number"
                    value={Math.round(selectedObject.height)}
                    onChange={(e) =>
                      onUpdateObject({ height: Math.max(10, Number(e.target.value)) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                    <span>Rotação</span>
                    <span className="font-mono text-slate-300">
                      {Math.round(selectedObject.rotation || 0)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={Math.round(selectedObject.rotation || 0)}
                    onChange={(e) => onUpdateObject({ rotation: Number(e.target.value) })}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Parâmetros Técnicos */}
            {elemDef && elemDef.propsSchema.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Parâmetros Técnicos
                </span>
                <div className="space-y-2">
                  {elemDef.propsSchema.map((field: MapPropField) => {
                    const val =
                      selectedObject.props[field.key] ?? elemDef.defaultProps[field.key]

                    if (field.type === "number") {
                      return (
                        <div key={field.key} className="flex items-center justify-between gap-2">
                          <label className="text-[11px] text-slate-300">{field.label}</label>
                          <input
                            type="number"
                            min={field.min}
                            max={field.max}
                            step={field.step || 1}
                            value={val !== undefined ? Number(val) : ""}
                            onChange={(e) => onUpdateProp(field.key, Number(e.target.value))}
                            className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono text-right"
                          />
                        </div>
                      )
                    }

                    if (field.type === "select") {
                      return (
                        <div key={field.key} className="space-y-1">
                          <label className="text-[11px] text-slate-300">{field.label}</label>
                          <select
                            value={String(val || "")}
                            onChange={(e) => onUpdateProp(field.key, e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                          >
                            {field.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    }

                    if (field.type === "color") {
                      return (
                        <div key={field.key} className="flex items-center justify-between gap-2">
                          <label className="text-[11px] text-slate-300">{field.label}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={String(val || "#3b82f6")}
                              onChange={(e) => onUpdateProp(field.key, e.target.value)}
                              className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
                            />
                            <span className="font-mono text-[10px] text-slate-400">
                              {String(val || "")}
                            </span>
                          </div>
                        </div>
                      )
                    }

                    if (field.type === "boolean") {
                      return (
                        <div key={field.key} className="flex items-center justify-between">
                          <label className="text-[11px] text-slate-300">{field.label}</label>
                          <input
                            type="checkbox"
                            checked={Boolean(val)}
                            onChange={(e) => onUpdateProp(field.key, e.target.checked)}
                            className="rounded border-slate-700 text-blue-600 focus:ring-0"
                          />
                        </div>
                      )
                    }

                    return (
                      <div key={field.key} className="space-y-1">
                        <label className="text-[11px] text-slate-300">{field.label}</label>
                        <input
                          type="text"
                          value={String(val || "")}
                          onChange={(e) => onUpdateProp(field.key, e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Nomenclatura das Dimensões no Próprio Objeto (Porta-Paletes, Cantilever, etc — nunca Compartimento) */}
            {selectedObject.category === "storage" && selectedObject.type !== "drive_in" && selectedObject.type !== "compartment" && (
              <div className="pt-2 border-t border-slate-800/80">
                <ObjectDimensionConfigSection
                  levelsCount={Number(selectedObject.props.levels || 4)}
                  depthCount={Number(selectedObject.props.depth || selectedObject.props.positions || 3)}
                  objectLevelsConfig={selectedObject.props.levelsConfig as DimensionConfig}
                  objectDepthConfig={selectedObject.props.depthConfig as DimensionConfig}
                  onUpdateProp={onUpdateProp}
                />
              </div>
            )}
          </>
        )}

        {/* Ações Rápidas — sempre visíveis */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Ações Rápidas
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={onBringForward}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-medium transition-colors"
            >
              Trazer p/ Frente
            </button>
            <button
              onClick={onSendBackward}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-medium transition-colors"
            >
              Enviar p/ Trás
            </button>
            <button
              onClick={onDuplicate}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-medium transition-colors"
            >
              Duplicar (Ctrl+D)
            </button>
            <button
              onClick={onDelete}
              className="px-2 py-1.5 bg-red-950/40 hover:bg-red-950/70 border border-red-900/40 text-red-400 hover:text-red-200 rounded text-[11px] font-medium transition-colors"
            >
              Excluir (Del)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
