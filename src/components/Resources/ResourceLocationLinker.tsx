// ============================================================
// NEXUS ERP — Resources / ResourceLocationLinker.tsx
// Componente de Vinculação de Recursos a Locais Físicos do Mapa
// Permite associar uma instância a 1 ou N locais com validação de regras
// ============================================================

"use client"

import React, { useState, useMemo } from "react"
import type { MapObject } from "../MapLibrary/types"
import type { ResourceInstance, ResourceType, LinkageType, LinkageValidationResult } from "./types"

interface ResourceLocationLinkerProps {
  isOpen: boolean
  onClose: () => void
  instance: ResourceInstance
  typeDef?: ResourceType
  allObjects: MapObject[]
  onLink: (
    instanceId: string,
    locationData: {
      locationId: string
      locationLabel: string
      locationPath: string
      locationType: string
      locationClassification?: string
      linkageType: LinkageType
      quantity?: number
      unit?: string
      notes?: string
    }
  ) => void
  onUnlink: (instanceId: string, locationId: string) => void
  validateLinkage: (instance: ResourceInstance, targetLocation: MapObject) => LinkageValidationResult
}

export default function ResourceLocationLinker({
  isOpen,
  onClose,
  instance,
  typeDef,
  allObjects,
  onLink,
  onUnlink,
  validateLinkage,
}: ResourceLocationLinkerProps) {
  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [linkageType, setLinkageType] = useState<LinkageType>("primario")
  const [quantity, setQuantity] = useState<number>(1)
  const [unit, setUnit] = useState<string>(typeDef?.unitOfMeasure || "un")
  const [notes, setNotes] = useState("")

  // Filtra locais disponíveis (excluindo paredes, portas e orientação)
  const candidateLocations = useMemo(() => {
    return allObjects.filter(
      (o) =>
        o.category === "storage" ||
        o.category === "area" ||
        o.type === "drive_in" ||
        o.type === "floor" ||
        o.classification === "rua" ||
        o.classification === "bloco" ||
        o.props?.type === "dock"
    )
  }, [allObjects])

  // Resolve o caminho hierárquico legível de um objeto
  const resolveLocationPath = (obj: MapObject): string => {
    const parts: string[] = [obj.label || obj.props?.code ? String(obj.label || obj.props?.code) : obj.type]
    let current = obj
    let depth = 0
    while (current.parentId && depth < 5) {
      const parent = allObjects.find((o) => o.id === current.parentId)
      if (!parent) break
      parts.unshift(parent.label || parent.type)
      current = parent
      depth++
    }
    return parts.join(" › ")
  }

  const selectedTargetObject = candidateLocations.find((l) => l.id === selectedLocationId)

  // Validação em tempo real
  const validationResult: LinkageValidationResult = useMemo(() => {
    if (!selectedTargetObject) return { valid: true, warnings: [], errors: [] }
    return validateLinkage(instance, selectedTargetObject)
  }, [instance, selectedTargetObject, validateLinkage])

  const handleConfirmLink = () => {
    if (!selectedTargetObject) return
    if (!validationResult.valid) return

    onLink(instance.id, {
      locationId: selectedTargetObject.id,
      locationLabel: selectedTargetObject.label || selectedTargetObject.type,
      locationPath: resolveLocationPath(selectedTargetObject),
      locationType: selectedTargetObject.type,
      locationClassification: selectedTargetObject.classification,
      linkageType,
      quantity,
      unit,
      notes: notes.trim() || undefined,
    })

    setSelectedLocationId("")
    setNotes("")
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-xl text-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{typeDef?.icon || "🔷"}</span>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Vincular Locais Físicos
              </div>
              <h2 className="text-sm font-semibold text-slate-100">
                {instance.label} <span className="text-xs font-mono text-slate-400">({instance.code})</span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* Corpo */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Locais Atualmente Vinculados */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Locais Atualmente Vinculados ({instance.linkedLocations.length})
            </span>

            {instance.linkedLocations.length === 0 ? (
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs text-slate-500 text-center">
                Nenhum local físico vinculado a este recurso. Adicione um local abaixo.
              </div>
            ) : (
              <div className="space-y-1.5">
                {instance.linkedLocations.map((link) => (
                  <div
                    key={link.id}
                    className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200 truncate">{link.locationLabel}</span>
                        <span className="text-[9px] bg-blue-950/80 text-blue-300 border border-blue-800/50 px-1.5 rounded uppercase font-mono">
                          {link.linkageType}
                        </span>
                        {link.quantity !== undefined && (
                          <span className="text-[10px] bg-amber-950/60 text-amber-300 px-1.5 rounded font-mono">
                            {link.quantity} {link.unit || ""}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                        {link.locationPath}
                      </div>
                      {link.notes && (
                        <div className="text-[10px] text-slate-500 italic mt-0.5">
                          Nota: {link.notes}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => onUnlink(instance.id, link.locationId)}
                      className="px-2 py-1 bg-red-950/50 hover:bg-red-900/60 text-red-400 border border-red-800/40 rounded text-[11px] shrink-0 transition-colors"
                      title="Desvincular deste local"
                    >
                      Desvincular
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adicionar Novo Vínculo */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <span>➕</span>
              <span>Adicionar Novo Local</span>
            </span>

            {/* Seleção do Local */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Local Físico no Mapa
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">— Selecione uma estrutura, rua ou área do mapa —</option>
                {candidateLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.type === "drive_in" ? "📥" : loc.classification === "rua" ? "🛣️" : "📐"}{" "}
                    {loc.label || String(loc.props?.code ?? loc.type)} ({loc.classification || loc.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Parâmetros do Vínculo */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Tipo de Vínculo
                </label>
                <select
                  value={linkageType}
                  onChange={(e) => setLinkageType(e.target.value as LinkageType)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="primario">Primário (Principal)</option>
                  <option value="secundario">Secundário (Reserva)</option>
                  <option value="temporario">Temporário</option>
                  <option value="referencia">Referência / Documental</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Quantidade
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Unidade
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="ex: un, pallets"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Observações de Alocação
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Alocado para retrabalho de avarias no vão 01"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
              />
            </div>

            {/* Alertas de Regra de Validação */}
            {selectedTargetObject && (
              <div className="space-y-1 text-xs">
                {validationResult.errors.map((err, i) => (
                  <div key={i} className="p-2 bg-red-950/70 border border-red-800/60 rounded text-red-300 flex items-start gap-1.5">
                    <span>⛔</span>
                    <span>{err}</span>
                  </div>
                ))}
                {validationResult.warnings.map((warn, i) => (
                  <div key={i} className="p-2 bg-amber-950/60 border border-amber-800/50 rounded text-amber-300 flex items-start gap-1.5">
                    <span>⚠️</span>
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleConfirmLink}
              disabled={!selectedLocationId || !validationResult.valid}
              className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                selectedLocationId && validationResult.valid
                  ? "bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-900/40 cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <span>🔗</span>
              <span>Confirmar Vínculo com Local</span>
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>Regras de vinculação ativas para {typeDef?.name || "este recurso"}</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
