// ============================================================
// NEXUS ERP — Resources / ResourceEngineModal.tsx
// Painel do Motor Universal de Recursos
// Contabiliza e gerencia Produtos, Embalagens, Equipamentos, Materiais,
// Documentos, Arquivos, Vagas, Unidades e Tipos Personalizados
// ============================================================

"use client"

import React, { useState, useMemo } from "react"
import type { MapObject } from "../MapLibrary/types"
import type {
  ResourceCategory,
  ResourceInstance,
  ResourceType,
  ResourceStatus,
} from "./types"
import { RESOURCE_CATEGORY_META, RESOURCE_STATUS_META } from "./types"
import { useResourceStore } from "./useResourceStore"
import ResourceInstanceModal from "./ResourceInstanceModal"
import ResourceTypeModal from "./ResourceTypeModal"
import ResourceLocationLinker from "./ResourceLocationLinker"
import AddBaseCodigoModal from "./AddBaseCodigoModal"

interface ResourceEngineModalProps {
  isOpen: boolean
  onClose: () => void
  allObjects: MapObject[]
  onLocateObject?: (objId: string) => void
}

export default function ResourceEngineModal({
  isOpen,
  onClose,
  allObjects,
  onLocateObject,
}: ResourceEngineModalProps) {
  const {
    types,
    instances,
    countsByCategory,
    addType,
    updateType,
    deleteType,
    addInstance,
    updateInstance,
    deleteInstance,
    linkResourceToLocation,
    unlinkResourceFromLocation,
    validateLinkage,
  } = useResourceStore()

  const [activeTab, setActiveTab] = useState<"instances" | "types" | "links">("instances")
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | "all">("all")
  const [statusFilter, setStatusFilter] = useState<ResourceStatus | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Modais de Criação / Edição
  const [isInstanceModalOpen, setIsInstanceModalOpen] = useState(false)
  const [editingInstance, setEditingInstance] = useState<ResourceInstance | null>(null)

  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<ResourceType | null>(null)

  const [isLinkerOpen, setIsLinkerOpen] = useState(false)
  const [linkingInstance, setLinkingInstance] = useState<ResourceInstance | null>(null)

  const [isAddBaseCodigoModalOpen, setIsAddBaseCodigoModalOpen] = useState(false)

  // Filtra instâncias
  const filteredInstances = useMemo(() => {
    return instances.filter((inst) => {
      const type = types.find((t) => t.id === inst.typeId)
      if (selectedCategory !== "all" && type?.category !== selectedCategory) return false
      if (statusFilter !== "all" && inst.status !== statusFilter) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchLabel = inst.label.toLowerCase().includes(q)
        const matchCode = inst.code.toLowerCase().includes(q)
        const matchLoc = inst.linkedLocations.some((l) =>
          l.locationLabel.toLowerCase().includes(q) || l.locationPath.toLowerCase().includes(q)
        )
        return matchLabel || matchCode || matchLoc
      }
      return true
    })
  }, [instances, types, selectedCategory, statusFilter, searchQuery])

  // Contagem de locais físicos únicos vinculados
  const uniqueLinkedLocationsCount = useMemo(() => {
    const locSet = new Set<string>()
    instances.forEach((inst) => {
      inst.linkedLocations.forEach((l) => locSet.add(l.locationId))
    })
    return locSet.size
  }, [instances])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-5xl text-slate-100 overflow-hidden flex flex-col h-[90vh]">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔷</span>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                Mapeamento & Configuração · Motor Universal
              </div>
              <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Motor Universal de Recursos
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono font-normal">
                  {instances.length} recursos · {uniqueLinkedLocationsCount} locais vinculados
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddBaseCodigoModalOpen(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-700 to-fuchsia-700 hover:from-purple-600 hover:to-fuchsia-600 text-white font-semibold rounded-lg text-xs shadow-md shadow-purple-900/40 flex items-center gap-1.5 transition-all"
              title="Cadastrar novo SKU na tabela base_codigos do Supabase"
            >
              <span>+</span>
              <span>Cadastrar Produto (base_codigos)</span>
            </button>
            <button
              onClick={() => {
                setEditingInstance(null)
                setIsInstanceModalOpen(true)
              }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-xs shadow-md shadow-amber-900/40 flex items-center gap-1.5 transition-all"
            >
              <span>+ Novo Recurso</span>
            </button>
            <button
              onClick={() => {
                setEditingType(null)
                setIsTypeModalOpen(true)
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
            >
              <span>⚙️ Novo Tipo</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Abas e Métricas de Resumo */}
        <div className="bg-slate-950/70 border-b border-slate-800/80 px-4 pt-3 flex flex-col gap-3">
          {/* Métricas Rápidas por Categoria */}
          <div className="grid grid-cols-5 gap-2 text-xs">
            <div className="p-2 bg-slate-900/90 border border-slate-800 rounded-lg flex items-center gap-2">
              <span className="text-lg">📦</span>
              <div>
                <span className="text-[10px] text-slate-400 block">Produtos / SKUs</span>
                <span className="font-bold text-blue-400 font-mono text-sm">{countsByCategory.produto}</span>
              </div>
            </div>

            <div className="p-2 bg-slate-900/90 border border-slate-800 rounded-lg flex items-center gap-2">
              <span className="text-lg">🗃️</span>
              <div>
                <span className="text-[10px] text-slate-400 block">Embalagens / Paletes</span>
                <span className="font-bold text-purple-400 font-mono text-sm">{countsByCategory.embalagem}</span>
              </div>
            </div>

            <div className="p-2 bg-slate-900/90 border border-slate-800 rounded-lg flex items-center gap-2">
              <span className="text-lg">🔧</span>
              <div>
                <span className="text-[10px] text-slate-400 block">Equipamentos</span>
                <span className="font-bold text-amber-400 font-mono text-sm">{countsByCategory.equipamento}</span>
              </div>
            </div>

            <div className="p-2 bg-slate-900/90 border border-slate-800 rounded-lg flex items-center gap-2">
              <span className="text-lg">📄</span>
              <div>
                <span className="text-[10px] text-slate-400 block">Documentos & NFs</span>
                <span className="font-bold text-indigo-400 font-mono text-sm">{countsByCategory.documento}</span>
              </div>
            </div>

            <div className="p-2 bg-slate-900/90 border border-slate-800 rounded-lg flex items-center gap-2">
              <span className="text-lg">🗺️</span>
              <div>
                <span className="text-[10px] text-slate-400 block">Locais Vinculados</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">{uniqueLinkedLocationsCount}</span>
              </div>
            </div>
          </div>

          {/* Abas Superiores */}
          <div className="flex border-b border-slate-800 gap-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("instances")}
              className={`pb-2.5 flex items-center gap-1.5 transition-colors border-b-2 ${
                activeTab === "instances"
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>📋 Recursos Cadastrados ({instances.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("types")}
              className={`pb-2.5 flex items-center gap-1.5 transition-colors border-b-2 ${
                activeTab === "types"
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>⚙️ Catálogo de Tipos ({types.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("links")}
              className={`pb-2.5 flex items-center gap-1.5 transition-colors border-b-2 ${
                activeTab === "links"
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>🗺️ Matriz de Vínculos Físicos</span>
            </button>
          </div>
        </div>

        {/* Conteúdo da Aba */}
        <div className="flex-1 overflow-hidden flex flex-col p-4">
          {/* ABA 1: INSTÂNCIAS DE RECURSO */}
          {activeTab === "instances" && (
            <div className="flex flex-col h-full space-y-3">
              {/* Barra de Filtros */}
              <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
                {/* Categorias Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedCategory === "all"
                        ? "bg-amber-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Todos ({instances.length})
                  </button>
                  {Object.entries(RESOURCE_CATEGORY_META).map(([catKey, meta]) => (
                    <button
                      key={catKey}
                      onClick={() => setSelectedCategory(catKey as ResourceCategory)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${
                        selectedCategory === catKey
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                      <span className="text-[10px] opacity-75 font-mono">
                        ({countsByCategory[catKey as ResourceCategory] || 0})
                      </span>
                    </button>
                  ))}
                </div>

                {/* Busca e Status */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Buscar por código, nome, local..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1 text-xs text-slate-200 placeholder-slate-500 w-56 focus:outline-none focus:border-amber-500"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ResourceStatus | "all")}
                    className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="all">Status: Todos</option>
                    {Object.entries(RESOURCE_STATUS_META).map(([stKey, stMeta]) => (
                      <option key={stKey} value={stKey}>
                        {stMeta.icon} {stMeta.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabela de Instâncias */}
              <div className="flex-1 overflow-y-auto bg-slate-950/60 rounded-xl border border-slate-800">
                {filteredInstances.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
                    <span className="text-3xl mb-2">📦</span>
                    <span className="font-medium text-slate-400">Nenhum recurso encontrado</span>
                    <span className="text-[11px] text-slate-600 mt-1">
                      Crie um novo recurso ou altere os filtros acima.
                    </span>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Recurso & Código</th>
                        <th className="py-2.5 px-3">Tipo / Categoria</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Locais Vinculados</th>
                        <th className="py-2.5 px-3">Responsável</th>
                        <th className="py-2.5 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {filteredInstances.map((inst) => {
                        const type = types.find((t) => t.id === inst.typeId)
                        const statusMeta = RESOURCE_STATUS_META[inst.status] || RESOURCE_STATUS_META.ativo

                        return (
                          <tr key={inst.id} className="hover:bg-slate-900/60 transition-colors">
                            <td className="py-2 px-3">
                              <div className="font-semibold text-slate-100 font-sans text-xs">
                                {inst.label}
                              </div>
                              <span className="text-[10px] text-amber-400">{inst.code}</span>
                            </td>

                            <td className="py-2 px-3">
                              <span className="inline-flex items-center gap-1 font-sans text-slate-300">
                                <span>{type?.icon || "🔷"}</span>
                                <span>{type?.name || "Custom"}</span>
                              </span>
                            </td>

                            <td className="py-2 px-3">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans"
                                style={{
                                  backgroundColor: `${statusMeta.color}20`,
                                  color: statusMeta.color,
                                  border: `1px solid ${statusMeta.color}40`,
                                }}
                              >
                                <span>{statusMeta.icon}</span>
                                <span>{statusMeta.label}</span>
                              </span>
                            </td>

                            <td className="py-2 px-3">
                              {inst.linkedLocations.length === 0 ? (
                                <span className="text-slate-500 text-[10px] italic">Sem local</span>
                              ) : (
                                <div className="space-y-0.5">
                                  {inst.linkedLocations.map((link) => (
                                    <div
                                      key={link.id}
                                      className="flex items-center gap-1.5 text-[10px] text-slate-300 font-sans"
                                    >
                                      <span className="text-amber-400">📍</span>
                                      <span className="font-semibold">{link.locationLabel}</span>
                                      {link.quantity !== undefined && (
                                        <span className="bg-slate-800 px-1 rounded text-slate-400 font-mono">
                                          {link.quantity} {link.unit || ""}
                                        </span>
                                      )}
                                      {onLocateObject && (
                                        <button
                                          onClick={() => onLocateObject(link.locationId)}
                                          className="text-blue-400 hover:text-blue-300 underline text-[9px]"
                                          title="Focar no mapa"
                                        >
                                          ver no mapa
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>

                            <td className="py-2 px-3 font-sans text-slate-400">
                              {inst.responsible || "—"}
                            </td>

                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 font-sans">
                                <button
                                  onClick={() => {
                                    setLinkingInstance(inst)
                                    setIsLinkerOpen(true)
                                  }}
                                  className="px-2 py-1 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/40 rounded text-[10px]"
                                  title="Gerenciar locais vinculados"
                                >
                                  🔗 Vincular
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingInstance(inst)
                                    setIsInstanceModalOpen(true)
                                  }}
                                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                                  title="Editar recurso"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Remover recurso ${inst.label} (${inst.code})?`)) {
                                      deleteInstance(inst.id)
                                    }
                                  }}
                                  className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded text-[10px]"
                                  title="Excluir recurso"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ABA 2: CATÁLOGO DE TIPOS */}
          {activeTab === "types" && (
            <div className="overflow-y-auto space-y-3 flex-1">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs text-slate-400">
                  Tipos e modelos de dados configurados para classificação universal
                </span>
                <button
                  onClick={() => {
                    setEditingType(null)
                    setIsTypeModalOpen(true)
                  }}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold"
                >
                  + Criar Tipo Customizado
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {types.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xl">{t.icon || "🔷"}</span>
                        {t.isBuiltIn ? (
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                            Nativo
                          </span>
                        ) : (
                          <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-800/40 px-1.5 py-0.2 rounded font-mono">
                            Customizado
                          </span>
                        )}
                      </div>

                      <h3 className="text-xs font-bold text-slate-100 mt-1">{t.name}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                        {t.description || "Sem descrição informada."}
                      </p>

                      <div className="mt-2 text-[10px] text-slate-500 space-y-1">
                        <div>
                          <strong>Campos dinâmicos:</strong> {t.fields.length} atributos
                        </div>
                        <div>
                          <strong>Regras de vínculo:</strong> {t.linkageRules.length} regras
                        </div>
                        {t.unitOfMeasure && (
                          <div>
                            <strong>Unidade padrão:</strong> {t.unitOfMeasure}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {instances.filter((i) => i.typeId === t.id).length} instâncias
                      </span>
                      {!t.isBuiltIn && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingType(t)
                              setIsTypeModalOpen(true)
                            }}
                            className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800 text-xs"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Excluir tipo ${t.name}?`)) {
                                deleteType(t.id)
                              }
                            }}
                            className="text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-950/50 text-xs"
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA 3: MATRIZ DE VÍNCULOS FÍSICOS */}
          {activeTab === "links" && (
            <div className="overflow-y-auto space-y-3 flex-1">
              <span className="text-xs text-slate-400 block pb-1">
                Visão consolidada de todas as estruturas e áreas do mapa que possuem recursos associados
              </span>

              <div className="space-y-2">
                {allObjects
                  .filter((obj) =>
                    instances.some((inst) =>
                      inst.linkedLocations.some((l) => l.locationId === obj.id)
                    )
                  )
                  .map((obj) => {
                    const linked = instances.filter((inst) =>
                      inst.linkedLocations.some((l) => l.locationId === obj.id)
                    )

                    return (
                      <div
                        key={obj.id}
                        className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">
                              {obj.type === "drive_in" ? "📥" : obj.classification === "rua" ? "🛣️" : "📐"}
                            </span>
                            <span className="font-bold text-xs text-slate-100">
                              {obj.label || String(obj.props?.code ?? obj.type)}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 rounded font-mono">
                              {obj.classification || obj.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-amber-400 font-mono">
                              {linked.length} recursos vinculados
                            </span>
                            {onLocateObject && (
                              <button
                                onClick={() => onLocateObject(obj.id)}
                                className="px-2 py-0.5 bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800/40 rounded text-[10px]"
                              >
                                Localizar no Mapa
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Lista dos Recursos vinculados a este local */}
                        <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                          {linked.map((inst) => {
                            const linkInfo = inst.linkedLocations.find((l) => l.locationId === obj.id)
                            const type = types.find((t) => t.id === inst.typeId)

                            return (
                              <div
                                key={inst.id}
                                className="p-2 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between text-xs font-sans"
                              >
                                <div>
                                  <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                                    <span>{type?.icon || "🔷"}</span>
                                    <span>{inst.label}</span>
                                    <span className="text-[10px] text-amber-400 font-mono">({inst.code})</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    Tipo: {linkInfo?.linkageType}
                                    {linkInfo?.quantity !== undefined &&
                                      ` · Qtd: ${linkInfo.quantity} ${linkInfo.unit || ""}`}
                                  </div>
                                </div>

                                <button
                                  onClick={() => unlinkResourceFromLocation(inst.id, obj.id)}
                                  className="text-red-400 hover:text-red-300 text-xs px-2 py-1 bg-red-950/40 rounded"
                                  title="Desvincular"
                                >
                                  ✕
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>
            NEXUS ERP · Motor Universal de Recursos · Suporte a Produtos, Embalagens, Equipamentos, Documentos e Vagas
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Modais Aninhados */}
      {isInstanceModalOpen && (
        <ResourceInstanceModal
          isOpen={isInstanceModalOpen}
          onClose={() => {
            setIsInstanceModalOpen(false)
            setEditingInstance(null)
          }}
          onSave={(data) => {
            if (editingInstance) {
              updateInstance(editingInstance.id, data)
            } else {
              addInstance(data)
            }
          }}
          types={types}
          initialInstance={editingInstance}
        />
      )}

      {isTypeModalOpen && (
        <ResourceTypeModal
          isOpen={isTypeModalOpen}
          onClose={() => {
            setIsTypeModalOpen(false)
            setEditingType(null)
          }}
          onSave={(typeData) => {
            if (editingType) {
              updateType(editingType.id, typeData)
            } else {
              addType(typeData)
            }
          }}
          initialType={editingType}
        />
      )}

      {isLinkerOpen && linkingInstance && (
        <ResourceLocationLinker
          isOpen={isLinkerOpen}
          onClose={() => {
            setIsLinkerOpen(false)
            setLinkingInstance(null)
          }}
          instance={linkingInstance}
          typeDef={types.find((t) => t.id === linkingInstance.typeId)}
          allObjects={allObjects}
          onLink={(instId, locData) => {
            linkResourceToLocation(instId, locData)
          }}
          onUnlink={(instId, locId) => {
            unlinkResourceFromLocation(instId, locId)
          }}
          validateLinkage={validateLinkage}
        />
      )}

      {isAddBaseCodigoModalOpen && (
        <AddBaseCodigoModal
          isOpen={isAddBaseCodigoModalOpen}
          onClose={() => setIsAddBaseCodigoModalOpen(false)}
        />
      )}
    </div>
  )
}
