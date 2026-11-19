// ============================================================
// NEXUS ERP — MapLayers / ViewerNavigationSidebar.tsx
// Barra Lateral Exclusiva de Navegação e Inspeção (Modo Visualizador)
// Contempla:
// • Árvore hierárquica completa com botões de ocultar/mostrar (👁️)
// • Ação de ir até o local com enquadramento da câmera
// • Informações detalhadas de quantidades, dimensões e capacidade
// • 100% somente leitura (sem nenhum controle de edição)
// ============================================================

"use client"

import React, { useState, useMemo } from "react"
import {
  Layers,
  Search,
  Eye,
  EyeOff,
  MapPin,
  Maximize2,
  Box,
  Building2,
  Info,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Sparkles,
} from "lucide-react"
import type { MapObject } from "../MapLibrary/types"
import { resolveSpatialContainment } from "../MapLibrary/spatialContainment"
import { calculateAreaM2 } from "../MapLibrary/areaClassifier"

interface ViewerNavigationSidebarProps {
  objects: MapObject[]
  selectedId: string | null
  onSelectAndLocate: (obj: MapObject) => void
  onToggleVisibility: (id: string, visible: boolean) => void
  onToggleAllVisibility: (visible: boolean) => void
  onOpenDriveInGrid?: (object: MapObject, channelId?: string) => void
}

interface TreeNode {
  obj: MapObject
  children: TreeNode[]
  depth: number
}

function buildTree(objects: MapObject[]): TreeNode[] {
  const { containmentMap } = resolveSpatialContainment(objects)
  const roots: TreeNode[] = []
  const nodeById = new Map<string, TreeNode>()

  objects.forEach((obj) => {
    nodeById.set(obj.id, { obj, children: [], depth: 0 })
  })

  objects.forEach((obj) => {
    const node = nodeById.get(obj.id)!
    const spatialParentId = containmentMap.get(obj.id)
    const effectiveParentId = (obj.props?.streetId as string) || obj.parentId || spatialParentId

    if (effectiveParentId && nodeById.has(effectiveParentId) && effectiveParentId !== obj.id) {
      nodeById.get(effectiveParentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  function assignDepth(nodes: TreeNode[], depth: number) {
    nodes.forEach((n) => {
      n.depth = depth
      assignDepth(n.children, depth + 1)
    })
  }
  assignDepth(roots, 0)
  return roots
}

function getObjectIcon(obj: MapObject): string {
  if (obj.type === "floor") return "🏢"
  if (obj.classification === "bloco") return "🧱"
  if (obj.classification === "rua" || obj.classification === "circulacao") return "🛣️"
  if (obj.category === "area") return "📐"
  if (obj.type === "drive_in") return "📥"
  if (obj.category === "storage") return "📦"
  if (obj.category === "equipment") return "🔧"
  if (obj.category === "architectural") return "🏛️"
  return "📍"
}

export default function ViewerNavigationSidebar({
  objects,
  selectedId,
  onSelectAndLocate,
  onToggleVisibility,
  onToggleAllVisibility,
  onOpenDriveInGrid,
}: ViewerNavigationSidebarProps) {
  const [activeTab, setActiveTab] = useState<"tree" | "details">("tree")
  const [search, setSearch] = useState("")
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())

  const tree = useMemo(() => buildTree(objects), [objects])

  const selectedObject = useMemo(() => {
    return objects.find((o) => o.id === selectedId) || null
  }, [objects, selectedId])

  // Se um objeto for selecionado, alterna para a aba de inspeção caso o usuário queira
  const handleSelect = (obj: MapObject) => {
    onSelectAndLocate(obj)
  }

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCollapsedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleCount = objects.filter((o) => o.visible !== false).length
  const allVisible = visibleCount === objects.length

  // Métricas do objeto selecionado
  const details = useMemo(() => {
    if (!selectedObject) return null
    const ppm = Number(selectedObject.props?.pixelsPerMeter) || 20
    const wM = selectedObject.physicalDimensions?.width || selectedObject.width / ppm
    const lM = selectedObject.physicalDimensions?.length || selectedObject.height / ppm
    const hM = selectedObject.physicalDimensions?.height || 5.0
    const areaM2 = Math.round(wM * lM * 10) / 10

    const levels = Number(selectedObject.props?.levels) || 4
    const depth = Number(selectedObject.props?.depth) || 4
    const lanes = Math.max(1, Number(selectedObject.props?.lanes) || 1)
    const capacity = levels * depth * lanes

    const channels = Array.isArray(selectedObject.props?.channels) ? selectedObject.props.channels : []
    let occupiedSlots = 0
    channels.forEach((c: any) => {
      if (Array.isArray(c.occupiedPositions)) occupiedSlots += c.occupiedPositions.length
    })

    return {
      wM: wM.toFixed(2),
      lM: lM.toFixed(2),
      hM: hM.toFixed(2),
      areaM2,
      levels,
      depth,
      lanes,
      capacity,
      occupiedSlots,
      occupancyPct: capacity > 0 ? Math.round((occupiedSlots / capacity) * 100) : 0,
      systemId: (selectedObject.props?.systemId as string) || null,
      systemLabel: (selectedObject.props?.systemLabel as string) || null,
      situation: selectedObject.operationalSituation || "ativa",
      responsible: selectedObject.responsible || null,
      restrictions: selectedObject.restrictions || null,
    }
  }, [selectedObject])

  // Renderiza nó recursivo da árvore
  const renderNode = (node: TreeNode) => {
    const { obj, children, depth } = node
    const isSelected = obj.id === selectedId
    const isVisible = obj.visible !== false
    const isCollapsed = collapsedNodes.has(obj.id)
    const hasChildren = children.length > 0

    // Filtro de busca
    if (search.trim()) {
      const matchSelf = (obj.label || obj.id).toLowerCase().includes(search.toLowerCase())
      const matchChildren = children.some((c) =>
        (c.obj.label || c.obj.id).toLowerCase().includes(search.toLowerCase())
      )
      if (!matchSelf && !matchChildren) return null
    }

    return (
      <div key={obj.id} className="select-none">
        <div
          onClick={() => handleSelect(obj)}
          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-xl text-xs transition-colors cursor-pointer group ${
            isSelected
              ? "bg-blue-600/30 text-white border border-blue-500/60 shadow-sm"
              : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
        >
          {/* Seta recolher/expandir */}
          {hasChildren ? (
            <button
              onClick={(e) => toggleCollapse(obj.id, e)}
              className="p-0.5 text-slate-500 hover:text-slate-300 rounded"
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          ) : (
            <span className="w-3" />
          )}

          {/* Ícone */}
          <span className="text-xs shrink-0">{getObjectIcon(obj)}</span>

          {/* Nome */}
          <span className="truncate flex-1 font-medium">{obj.label || obj.id}</span>

          {/* Badge de tipo/capacidade */}
          {obj.type === "drive_in" && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenDriveInGrid?.(obj)
              }}
              className="text-[9px] px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 font-mono shrink-0 border border-blue-800/60 hover:bg-blue-900 transition-colors flex items-center gap-1"
              title="Abrir Grid de Paletes deste Drive"
            >
              <span>📥</span>
              <span>Grid</span>
            </button>
          )}

          {/* Botão de Localizar (Câmera) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleSelect(obj)
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-all shrink-0"
            title="Ir até esta posição no mapa"
          >
            <MapPin size={11} />
          </button>

          {/* Olhinho: Visibilidade */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleVisibility(obj.id, !isVisible)
            }}
            className={`p-1 rounded transition-colors shrink-0 ${
              isVisible
                ? "text-slate-400 hover:text-white"
                : "text-slate-600 hover:text-slate-400"
            }`}
            title={isVisible ? "Ocultar no mapa" : "Mostrar no mapa"}
          >
            {isVisible ? <Eye size={12} /> : <EyeOff size={12} className="text-rose-400" />}
          </button>
        </div>

        {/* Filhos */}
        {hasChildren && !isCollapsed && (
          <div className="space-y-0.5 mt-0.5">{children.map(renderNode)}</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 border-r border-slate-800 select-none overflow-hidden text-slate-100">
      {/* Header do Painel */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
            <Layers size={13} />
          </div>
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Navegador Espacial
          </span>
        </div>
        <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/70 px-2 py-0.5 rounded-full border border-indigo-800/50">
          Leitura
        </span>
      </div>

      {/* Abas: Estrutura & Navegação ↔ Inspeção Detalhada */}
      <div className="flex border-b border-slate-800 bg-slate-950 shrink-0">
        <button
          onClick={() => setActiveTab("tree")}
          className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "tree"
              ? "border-blue-500 text-blue-400 bg-slate-900/60"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <span>🌳</span>
          <span>Estrutura ({objects.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("details")}
          className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "details"
              ? "border-amber-500 text-amber-400 bg-slate-900/60"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <span>🔍</span>
          <span>Inspeção {selectedObject ? "●" : ""}</span>
        </button>
      </div>

      {/* Conteúdo Aba: Estrutura */}
      {activeTab === "tree" ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Busca + Ações Globais */}
          <div className="p-2.5 border-b border-slate-800 bg-slate-950/30 space-y-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar por nome ou setor..."
                className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span>{visibleCount} visíveis</span>
              <button
                onClick={() => onToggleAllVisibility(!allVisible)}
                className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
              >
                {allVisible ? <EyeOff size={11} /> : <Eye size={11} />}
                <span>{allVisible ? "Ocultar Todos" : "Mostrar Todos"}</span>
              </button>
            </div>
          </div>

          {/* Árvore Hierárquica */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
            {tree.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <Box size={24} className="mx-auto mb-2 text-slate-600" />
                <p>Nenhuma estrutura encontrada.</p>
              </div>
            ) : (
              tree.map(renderNode)
            )}
          </div>
        </div>
      ) : (
        /* Conteúdo Aba: Inspeção Detalhada */
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-4">
          {!selectedObject || !details ? (
            <div className="py-16 text-center text-slate-500 text-xs space-y-2">
              <Info size={32} className="mx-auto text-slate-600" />
              <p className="font-semibold text-slate-300">Nenhum objeto selecionado</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                Clique em qualquer Drive-In, Rua ou Área no mapa (ou na aba Estrutura) para ver as métricas e capacidades.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Card de Identificação */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl p-2 rounded-xl bg-slate-900 border border-slate-800">
                      {getObjectIcon(selectedObject)}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-white leading-tight">
                        {selectedObject.label || selectedObject.id}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Tipo: {selectedObject.type} {selectedObject.classification ? `· ${selectedObject.classification}` : ""}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onSelectAndLocate(selectedObject)}
                  className="w-full py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow"
                >
                  <MapPin size={12} />
                  <span>Centralizar no Mapa</span>
                </button>
              </div>

              {/* Dimensões Físicas Reais */}
              <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-2">
                <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block">
                  Dimensões Métricas (PBR Real)
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">Largura</span>
                    <strong className="text-white text-xs font-mono">{details.wM} m</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">Comprimento</span>
                    <strong className="text-white text-xs font-mono">{details.lM} m</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">Altura</span>
                    <strong className="text-white text-xs font-mono">{details.hM} m</strong>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 text-center pt-1">
                  Área em planta: <strong className="text-white font-mono">{details.areaM2} m²</strong>
                </div>
              </div>

              {/* Se for Drive-In ou Armazenamento: Capacidade e Posições */}
              {(selectedObject.type === "drive_in" || selectedObject.category === "storage") && (
                <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
                      <span>📥</span>
                      <span>Capacidade de Armazenamento</span>
                    </span>
                    <span className="text-xs font-bold text-amber-300 font-mono">
                      {details.capacity} Paletes
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[9px] text-slate-400 block">Níveis</span>
                      <strong className="text-white font-mono">{details.levels}N</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[9px] text-slate-400 block">Profundidade</span>
                      <strong className="text-white font-mono">{details.depth}P</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[9px] text-slate-400 block">Vãos / Ruas</span>
                      <strong className="text-white font-mono">{details.lanes}V</strong>
                    </div>
                  </div>

                  {/* Barra de Ocupação */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Ocupação atual:</span>
                      <strong className="text-amber-300 font-mono">
                        {details.occupiedSlots} / {details.capacity} ({details.occupancyPct}%)
                      </strong>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all"
                        style={{ width: `${Math.min(100, details.occupancyPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Botão de Abrir Grid Principal */}
                  <button
                    type="button"
                    onClick={() => onOpenDriveInGrid?.(selectedObject)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all cursor-pointer mt-2"
                  >
                    <span>📥</span>
                    <span>Abrir Grid do Drive-In (Paletes)</span>
                  </button>

                  {/* Canais Individuais (se houver) */}
                  {Array.isArray(selectedObject.props?.channels) && selectedObject.props.channels.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Canais Individuais deste Drive:
                      </span>
                      <div className="space-y-1">
                        {(selectedObject.props.channels as any[]).map((chan) => (
                          <button
                            key={chan.id || chan.code}
                            type="button"
                            onClick={() => onOpenDriveInGrid?.(selectedObject, chan.code || chan.id)}
                            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900/90 hover:bg-blue-950/60 border border-slate-800 hover:border-blue-600/60 transition-all text-left group"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs">📥</span>
                              <div>
                                <span className="font-mono text-xs font-bold text-white group-hover:text-blue-300">
                                  {chan.code}
                                </span>
                                {chan.name && (
                                  <span className="text-[10px] text-slate-400 block">
                                    {chan.name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/60 font-semibold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              Ver Canal →
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Situação Operacional */}
              <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Operação & Governança
                </span>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Situação:</span>
                  <span className="font-bold text-emerald-400 uppercase tracking-wider text-[10px] bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                    {details.situation}
                  </span>
                </div>

                {details.responsible && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Responsável:</span>
                    <strong className="text-slate-200">{details.responsible}</strong>
                  </div>
                )}

                {details.systemLabel && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Sistema Vinculado:</span>
                    <strong className="text-blue-400">{details.systemLabel}</strong>
                  </div>
                )}

                {details.restrictions && (
                  <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-400">
                    <span className="text-amber-400 font-semibold block mb-0.5">⚠️ Restrições:</span>
                    <p className="leading-relaxed text-[10px] text-slate-300">{details.restrictions}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
