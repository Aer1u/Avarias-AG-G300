// ============================================================
// NEXUS ERP — Resources / LinkedResourcesSection.tsx
// Seção de Recursos Vinculados para o Painel de Propriedades (MapPropertiesPanel)
// Exibe recursos alocados ao local selecionado e permite vincular novos
// com busca direta na tabela oficial base_codigos
// ============================================================

"use client"

import React, { useState } from "react"
import type { MapObject } from "../MapLibrary/types"
import { useResourceStore } from "./useResourceStore"
import type { LinkageType } from "./types"
import ProductBaseCodigoSelector from "./ProductBaseCodigoSelector"
import AddBaseCodigoModal from "./AddBaseCodigoModal"
import type { BaseCodigoItem } from "./baseCodigosService"

interface LinkedResourcesSectionProps {
  selectedObject: MapObject
  onOpenResourceEngine?: () => void
}

export default function LinkedResourcesSection({
  selectedObject,
  onOpenResourceEngine,
}: LinkedResourcesSectionProps) {
  const {
    types,
    instances,
    addInstance,
    getInstancesByLocationId,
    linkResourceToLocation,
    unlinkResourceFromLocation,
  } = useResourceStore()

  const [isQuickLinkOpen, setIsQuickLinkOpen] = useState(false)
  const [linkMode, setLinkMode] = useState<"base_codigos" | "existing">("base_codigos")
  const [selectedInstanceId, setSelectedInstanceId] = useState("")
  const [linkageType, setLinkageType] = useState<LinkageType>("primario")
  const [quantity, setQuantity] = useState<number>(1)
  const [unit, setUnit] = useState<string>("pallets")
  const [selectedProductFromBase, setSelectedProductFromBase] = useState<BaseCodigoItem | null>(null)
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false)

  const linkedInstances = getInstancesByLocationId(selectedObject.id)

  // Instâncias já criadas disponíveis para vincular
  const availableToLink = instances.filter(
    (inst) => !inst.linkedLocations.some((l) => l.locationId === selectedObject.id)
  )

  const handleConfirmLink = () => {
    if (linkMode === "base_codigos" && selectedProductFromBase) {
      // Verifica se já existe instância para este SKU
      const existingInst = instances.find((i) => i.code === selectedProductFromBase["Código"])
      let targetInstId: string

      if (existingInst) {
        targetInstId = existingInst.id
      } else {
        const newInst = addInstance({
          typeId: "rt_produto",
          code: selectedProductFromBase["Código"],
          label: selectedProductFromBase["Descrição"],
          status: "ativo",
          responsible: "Supervisão G300",
          props: {
            sku: selectedProductFromBase["Código"],
            descricao: selectedProductFromBase["Descrição"],
            grade: selectedProductFromBase.Grade || "",
            tipo: selectedProductFromBase.Tipo || "",
          },
          linkedLocations: [],
        })
        targetInstId = newInst.id
      }

      linkResourceToLocation(targetInstId, {
        locationId: selectedObject.id,
        locationLabel: selectedObject.label || selectedObject.type,
        locationPath: selectedObject.label || selectedObject.type,
        locationType: selectedObject.type,
        locationClassification: selectedObject.classification,
        linkageType,
        quantity,
        unit,
      })

      setSelectedProductFromBase(null)
      setIsQuickLinkOpen(false)
    } else if (linkMode === "existing" && selectedInstanceId) {
      const inst = instances.find((i) => i.id === selectedInstanceId)
      if (!inst) return
      const typeDef = types.find((t) => t.id === inst.typeId)

      linkResourceToLocation(selectedInstanceId, {
        locationId: selectedObject.id,
        locationLabel: selectedObject.label || selectedObject.type,
        locationPath: selectedObject.label || selectedObject.type,
        locationType: selectedObject.type,
        locationClassification: selectedObject.classification,
        linkageType,
        quantity,
        unit: typeDef?.unitOfMeasure || "un",
      })

      setSelectedInstanceId("")
      setIsQuickLinkOpen(false)
    }
  }

  return (
    <div className="space-y-2.5 p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <span>🔷</span>
          <span>Recursos Vinculados ({linkedInstances.length})</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsAddProductModalOpen(true)}
            className="text-[10px] px-2 py-0.5 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-800/50 rounded font-semibold transition-colors"
            title="Cadastrar novo SKU na tabela base_codigos"
          >
            + Cadastrar Produto
          </button>
          <button
            onClick={() => setIsQuickLinkOpen((v) => !v)}
            className="text-[10px] px-2 py-0.5 bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-800/50 rounded font-semibold transition-colors"
          >
            {isQuickLinkOpen ? "Fechar" : "+ Vincular"}
          </button>
        </div>
      </div>

      {/* Formulário de Vínculo com base_codigos */}
      {isQuickLinkOpen && (
        <div className="p-3 bg-slate-900 rounded-xl border border-purple-800/40 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-[10px] uppercase font-bold text-purple-400">
              Vincular a este Espaço
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLinkMode("base_codigos")}
                className={`text-[9px] px-2 py-0.5 rounded transition-colors ${
                  linkMode === "base_codigos"
                    ? "bg-purple-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                base_codigos
              </button>
              <button
                type="button"
                onClick={() => setLinkMode("existing")}
                className={`text-[9px] px-2 py-0.5 rounded transition-colors ${
                  linkMode === "existing"
                    ? "bg-blue-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Outros Recursos
              </button>
            </div>
          </div>

          {linkMode === "base_codigos" ? (
            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 block font-medium">
                Puxar Produto da tabela base_codigos
              </label>
              <ProductBaseCodigoSelector
                onSelectProduct={(prod) => {
                  setSelectedProductFromBase(prod)
                }}
                placeholder="Digite SKU ou Nome (ex: 1705-01, ESPREMEDOR)..."
              />

              {selectedProductFromBase && (
                <div className="p-2 bg-purple-950/40 border border-purple-800/60 rounded-lg text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400">
                      {selectedProductFromBase["Código"]}
                    </span>
                    {selectedProductFromBase.Grade && (
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded">
                        Grade: {selectedProductFromBase.Grade}
                      </span>
                    )}
                    {selectedProductFromBase.Tipo && (
                      <span className="text-[9px] bg-blue-950 text-blue-300 border border-blue-800/40 px-1 rounded">
                        {selectedProductFromBase.Tipo}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-200 mt-0.5 font-medium">
                    {selectedProductFromBase["Descrição"]}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[9px] text-slate-400 block">Recursos já Cadastrados</label>
              <select
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="">— Selecione um recurso —</option>
                {availableToLink.map((inst) => {
                  const type = types.find((t) => t.id === inst.typeId)
                  return (
                    <option key={inst.id} value={inst.id}>
                      {type?.icon || "🔷"} {inst.label} ({inst.code})
                    </option>
                  )
                })}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[9px] text-slate-400 block">Vínculo</label>
              <select
                value={linkageType}
                onChange={(e) => setLinkageType(e.target.value as LinkageType)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-slate-200"
              >
                <option value="primario">Primário</option>
                <option value="secundario">Secundário</option>
                <option value="temporario">Temporário</option>
                <option value="referencia">Referência</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] text-slate-400 block">Qtd Nominal</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="text-[9px] text-slate-400 block">Unidade</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-slate-200"
              />
            </div>
          </div>

          <button
            onClick={handleConfirmLink}
            disabled={
              (linkMode === "base_codigos" && !selectedProductFromBase) ||
              (linkMode === "existing" && !selectedInstanceId)
            }
            className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all ${
              (linkMode === "base_codigos" && selectedProductFromBase) ||
              (linkMode === "existing" && selectedInstanceId)
                ? "bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white shadow-md cursor-pointer"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            Vincular Produto ao Local
          </button>
        </div>
      )}

      {/* Lista de Recursos Vinculados */}
      {linkedInstances.length === 0 ? (
        <div className="text-[11px] text-slate-500 italic p-2.5 bg-slate-900/40 rounded-lg border border-slate-800/60 text-center">
          Nenhum produto ou recurso vinculado a este local. Use o botão acima para puxar da base_codigos.
        </div>
      ) : (
        <div className="space-y-1.5">
          {linkedInstances.map((inst) => {
            const type = types.find((t) => t.id === inst.typeId)
            const link = inst.linkedLocations.find((l) => l.locationId === selectedObject.id)

            return (
              <div
                key={inst.id}
                className="p-2 bg-slate-900/90 border border-slate-800 rounded-lg flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span>{type?.icon || "📦"}</span>
                    <span className="font-semibold text-slate-200 truncate">{inst.label}</span>
                    <span className="text-[10px] text-amber-400 font-mono font-bold">({inst.code})</span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                    {link?.linkageType}
                    {link?.quantity !== undefined && ` · ${link.quantity} ${link.unit || ""}`}
                  </div>
                </div>

                <button
                  onClick={() => unlinkResourceFromLocation(inst.id, selectedObject.id)}
                  className="text-red-400 hover:text-red-300 p-1 text-xs rounded hover:bg-red-950/40 transition-colors"
                  title="Desvincular deste local"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {onOpenResourceEngine && (
        <button
          onClick={onOpenResourceEngine}
          className="w-full py-1 text-[10px] text-slate-400 hover:text-amber-300 bg-slate-900/50 hover:bg-slate-900 rounded border border-slate-800 transition-colors"
        >
          Abrir Gerenciador do Motor de Recursos ➔
        </button>
      )}

      {/* Modal Cadastrar Produto na base_codigos */}
      <AddBaseCodigoModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        onSuccess={(created) => {
          setSelectedProductFromBase(created)
          setIsQuickLinkOpen(true)
          setLinkMode("base_codigos")
        }}
      />
    </div>
  )
}
