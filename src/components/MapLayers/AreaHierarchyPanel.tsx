// ============================================================
// NEXUS ERP — MapLayers / AreaHierarchyPanel.tsx
// Painel de Árvore Hierárquica de Áreas, Ruas e Estruturas
// Permite navegação, localização no canvas e controle de visibilidade (👁️)
// ============================================================

"use client"

import React, { useState, useMemo } from "react"
import type { MapObject } from "../MapLibrary/types"
import { calculateAreaM2 } from "../MapLibrary/areaClassifier"
import { resolveSpatialContainment, ensureDriveChannels } from "../MapLibrary/spatialContainment"

interface AreaHierarchyPanelProps {
  objects: MapObject[]
  selectedId: string | null
  onSelectAndLocate: (obj: MapObject) => void
  onToggleVisibility?: (id: string, visible: boolean) => void
  onToggleAllVisibility?: (visible: boolean) => void
}

interface TreeNode {
  obj: MapObject
  children: TreeNode[]
  depth: number
  isSpatialContainment?: boolean // Verdadeiro se foi inferido geometricamente
}

function buildTree(objects: MapObject[]): TreeNode[] {
  const { containmentMap } = resolveSpatialContainment(objects)
  const roots: TreeNode[] = []
  const nodeById = new Map<string, TreeNode>()

  // Cria os nós
  objects.forEach((obj) => {
    nodeById.set(obj.id, { obj, children: [], depth: 0 })
  })

  // Distribui na árvore respeitando vínculo de rua, parentId ou contenção espacial
  objects.forEach((obj) => {
    const node = nodeById.get(obj.id)!
    const spatialParentId = containmentMap.get(obj.id)
    const effectiveParentId = (obj.props?.streetId as string) || obj.parentId || spatialParentId

    if (effectiveParentId && nodeById.has(effectiveParentId) && effectiveParentId !== obj.id) {
      if (!obj.parentId && !obj.props?.streetId && spatialParentId) {
        node.isSpatialContainment = true
      }
      nodeById.get(effectiveParentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  // Calcula profundidades
  function assignDepth(nodes: TreeNode[], depth: number) {
    nodes.forEach((n) => {
      n.depth = depth
      assignDepth(n.children, depth + 1)
    })
  }
  assignDepth(roots, 0)

  return roots
}

function typeIcon(type: string, category: string, classification?: string): string {
  if (type === "floor") return "🏢"
  if (classification === "bloco") return "🧱"
  if (classification === "rua" || classification === "circulacao") return "🛣️"
  if (category === "area") return "📐"
  if (type === "drive_in") return "📥"
  if (category === "storage") return "📦"
  if (category === "equipment") return "🔧"
  if (category === "architectural") return "🏛️"
  return "📍"
}

function situationColor(situation?: string): string {
  switch (situation) {
    case "interditada": return "text-red-400"
    case "manutencao": return "text-amber-400"
    case "inventario": return "text-blue-400"
    default: return "text-emerald-400"
  }
}

function situationLabel(situation?: string): string {
  switch (situation) {
    case "interditada": return "⛔"
    case "manutencao": return "🔧"
    case "inventario": return "📋"
    default: return "✅"
  }
}

interface TreeItemProps {
  node: TreeNode
  selectedId: string | null
  collapsed: Set<string>
  onToggleCollapse: (id: string) => void
  onSelectAndLocate: (obj: MapObject) => void
  onToggleVisibility?: (id: string, visible: boolean) => void
  allObjects: MapObject[]
}

function TreeItem({
  node,
  selectedId,
  collapsed,
  onToggleCollapse,
  onSelectAndLocate,
  onToggleVisibility,
  allObjects,
}: TreeItemProps) {
  const { obj, children, depth } = node
  const isSelected = selectedId === obj.id
  const isCollapsed = collapsed.has(obj.id)
  const hasChildren = children.length > 0
  const areaM2 = obj.category === "area" ? calculateAreaM2(obj) : null
  const isVisible = obj.visible !== false

  const channels = obj.type === "drive_in" ? ensureDriveChannels(obj) : []

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs group ${
          isSelected
            ? "bg-blue-950/80 border border-blue-600/60 text-white shadow-sm"
            : isVisible
            ? "hover:bg-slate-800/60 text-slate-200"
            : "hover:bg-slate-800/40 text-slate-500 opacity-60"
        }`}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
        onClick={() => onSelectAndLocate(obj)}
      >
        {/* Botão de Expandir / Recolher */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse(obj.id)
            }}
            className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-200 shrink-0"
            title={isCollapsed ? "Expandir" : "Recolher"}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="currentColor"
              className={`transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
            >
              <polygon points="1,0 7,4 1,8" />
            </svg>
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Botão de Visibilidade (Olhinho 👁️) */}
        {onToggleVisibility && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleVisibility(obj.id, !isVisible)
            }}
            className={`w-5 h-5 flex items-center justify-center rounded shrink-0 transition-colors ${
              isVisible
                ? "text-slate-400 hover:text-white hover:bg-slate-700/60"
                : "text-red-400 bg-red-950/50 border border-red-800/40"
            }`}
            title={isVisible ? "Clique para ocultar do mapa" : "Clique para exibir no mapa"}
          >
            {isVisible ? (
              // Ícone Olho Aberto
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              // Ícone Olho Riscado
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </button>
        )}

        {/* Ícone do Tipo */}
        <span className="text-sm shrink-0" title={`${obj.category} | ${obj.type}`}>
          {typeIcon(obj.type, obj.category, obj.classification)}
        </span>

        {/* Nome / Label do Objeto */}
        <span
          className={`flex-1 font-medium truncate text-[11px] ${
            !isVisible ? "line-through text-slate-500" : ""
          }`}
        >
          {obj.label || String(obj.props?.code ?? obj.type)}
        </span>

        {/* Vínculo Estrutural com Rua (badge) */}
        {Boolean(obj.props?.streetName) && (
          <span
            className="text-[9px] bg-amber-950/70 text-amber-300 border border-amber-800/40 px-1 py-0.2 rounded shrink-0 font-mono"
            title={`Vinculado à ${String(obj.props?.streetName ?? "")}`}
          >
            🛣️ {String(obj.props?.streetName ?? "")}
          </span>
        )}

        {/* Indicador de Delimitação Espacial Automática */}
        {node.isSpatialContainment && (
          <span
            className="text-[9px] bg-indigo-950/80 text-indigo-300 border border-indigo-800/40 px-1 rounded shrink-0"
            title="Objeto geometricamente contido dentro desta delimitação"
          >
            Delimitado
          </span>
        )}

        {/* Capacidade do Drive */}
        {obj.type === "drive_in" && (
          <span className="text-[9px] bg-amber-950/80 text-amber-400 border border-amber-700/50 px-1 rounded font-mono shrink-0">
            {Number(obj.props?.capacity || 0)}v
          </span>
        )}

        {/* Situação */}
        {obj.operationalSituation && (
          <span
            className={`text-[10px] shrink-0 ${situationColor(obj.operationalSituation)}`}
            title={obj.operationalSituation}
          >
            {situationLabel(obj.operationalSituation)}
          </span>
        )}

        {/* Área m² */}
        {areaM2 !== null && areaM2 > 0 && (
          <span className="text-[9px] text-slate-500 shrink-0 font-mono">
            {areaM2}m²
          </span>
        )}

        {/* Badge com contagem de filhos */}
        {hasChildren && (
          <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-full shrink-0 font-mono">
            {children.length}
          </span>
        )}
      </div>

      {/* Canais Estruturais do Drive-In */}
      {obj.type === "drive_in" && !isCollapsed && channels.length > 0 && (
        <div className="space-y-0.5 mt-0.5 mb-1">
          {channels.map((chan) => (
            <div
              key={chan.id}
              onClick={() => onSelectAndLocate(obj)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-800/60 text-[10px] text-amber-300/90 font-mono cursor-pointer transition-colors group"
              style={{ paddingLeft: `${24 + depth * 14}px` }}
              title={`Canal: ${chan.name} | Vão ${chan.laneIndex} | Capacidade Nominal: ${chan.capacity} posições`}
            >
              <span className="text-[10px]">🏷️</span>
              <span className="font-semibold text-slate-200 truncate">{chan.name}</span>
              <span className="text-[9px] text-slate-500 font-normal">({chan.code})</span>
              <span className="ml-auto text-[9px] bg-amber-950/60 text-amber-400 border border-amber-800/40 px-1 rounded">
                {chan.capacity}v
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filhos Recursivos */}
      {hasChildren && !isCollapsed && (
        <div className="space-y-0.5 mt-0.5">
          {children.map((child) => (
            <TreeItem
              key={child.obj.id}
              node={child}
              selectedId={selectedId}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              onSelectAndLocate={onSelectAndLocate}
              onToggleVisibility={onToggleVisibility}
              allObjects={allObjects}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AreaHierarchyPanel({
  objects,
  selectedId,
  onSelectAndLocate,
  onToggleVisibility,
  onToggleAllVisibility,
}: AreaHierarchyPanelProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<"all" | "areas" | "streets" | "drives">("all")

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExpandAll = () => {
    setCollapsed(new Set())
  }

  const handleCollapseAll = () => {
    const allIds = new Set(objects.map((o) => o.id))
    setCollapsed(allIds)
  }

  // Filtra objetos
  const displayObjects = useMemo(() => {
    let list = objects

    if (categoryFilter === "areas") {
      list = list.filter((o) => o.category === "area" && o.classification !== "rua" && o.classification !== "circulacao")
    } else if (categoryFilter === "streets") {
      list = list.filter((o) => o.classification === "rua" || o.classification === "circulacao")
    } else if (categoryFilter === "drives") {
      list = list.filter((o) => o.type === "drive_in" || o.category === "storage")
    }

    if (filter.trim()) {
      const q = filter.toLowerCase()
      list = list.filter((o) => {
        const chanNames = o.type === "drive_in"
          ? ensureDriveChannels(o).map((c) => c.name.toLowerCase() + " " + c.code.toLowerCase()).join(" ")
          : ""
        return (
          (o.label || "").toLowerCase().includes(q) ||
          o.type.toLowerCase().includes(q) ||
          (o.classification || "").toLowerCase().includes(q) ||
          String(o.props?.code || "").toLowerCase().includes(q) ||
          String(o.props?.streetName || "").toLowerCase().includes(q) ||
          chanNames.includes(q)
        )
      })
    }
    return list
  }, [objects, categoryFilter, filter])

  const tree = useMemo(() => buildTree(displayObjects), [displayObjects])

  const totalHiddenCount = objects.filter((o) => o.visible === false).length
  const totalDrives = objects.filter((o) => o.type === "drive_in").length
  const totalStreets = objects.filter((o) => o.classification === "rua" || o.classification === "circulacao").length

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-none">
      {/* Cabeçalho */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🌳</span>
            <span className="text-xs uppercase font-bold tracking-wider text-slate-300">
              Hierarquia Estrutural
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
              {objects.length} itens
            </span>
            {totalHiddenCount > 0 && (
              <span className="text-[10px] bg-red-950/80 text-red-400 border border-red-800/40 px-1.5 py-0.5 rounded font-mono">
                {totalHiddenCount} ocultos
              </span>
            )}
          </div>
        </div>

        {/* Barra de Ações Rápidas (Mostrar/Ocultar e Expandir/Recolher) */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <div className="flex items-center gap-1">
            {onToggleAllVisibility && (
              <>
                <button
                  onClick={() => onToggleAllVisibility(true)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded flex items-center gap-1 transition-colors"
                  title="Tornar todos os elementos visíveis no mapa"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>Exibir Todos</span>
                </button>
                <button
                  onClick={() => onToggleAllVisibility(false)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-400 hover:text-red-400 rounded flex items-center gap-1 transition-colors"
                  title="Ocultar todos os elementos do mapa"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                  <span>Ocultar Todos</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleExpandAll}
              className="px-1.5 py-1 bg-slate-800/70 hover:bg-slate-700 text-[10px] text-slate-400 hover:text-slate-200 rounded transition-colors"
              title="Expandir todos os nós"
            >
              ⊞ Expandir
            </button>
            <button
              onClick={handleCollapseAll}
              className="px-1.5 py-1 bg-slate-800/70 hover:bg-slate-700 text-[10px] text-slate-400 hover:text-slate-200 rounded transition-colors"
              title="Recolher todos os nós"
            >
              ⊟ Recolher
            </button>
          </div>
        </div>

        {/* Campo de Filtro / Busca */}
        <div className="relative">
          <input
            type="text"
            placeholder="Filtrar por nome, rua, código, canal..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-md pl-7 pr-7 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <span className="absolute left-2 top-1.5 text-slate-500 text-xs">🔍</span>
          {filter && (
            <button
              onClick={() => setFilter("")}
              className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filtros por Categoria */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors whitespace-nowrap ${
              categoryFilter === "all"
                ? "bg-blue-600 text-white font-medium shadow-sm"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Todos ({objects.length})
          </button>
          <button
            onClick={() => setCategoryFilter("streets")}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors whitespace-nowrap ${
              categoryFilter === "streets"
                ? "bg-amber-600 text-white font-medium shadow-sm"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            🛣️ Ruas ({totalStreets})
          </button>
          <button
            onClick={() => setCategoryFilter("drives")}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors whitespace-nowrap ${
              categoryFilter === "drives"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            📥 Drives ({totalDrives})
          </button>
          <button
            onClick={() => setCategoryFilter("areas")}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors whitespace-nowrap ${
              categoryFilter === "areas"
                ? "bg-emerald-600 text-white font-medium shadow-sm"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            📐 Áreas
          </button>
        </div>
      </div>

      {/* Lista da Árvore */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-xs text-center px-4">
            <span className="text-3xl mb-2">📐</span>
            <span className="font-medium text-slate-400">
              {filter ? "Nenhum elemento encontrado" : "Nenhuma estrutura no mapa"}
            </span>
            <span className="text-[11px] text-slate-600 mt-1">
              {filter ? "Tente buscar por outro termo" : "Arraste elementos da Biblioteca ou gere áreas"}
            </span>
          </div>
        ) : (
          tree.map((node) => (
            <TreeItem
              key={node.obj.id}
              node={node}
              selectedId={selectedId}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
              onSelectAndLocate={onSelectAndLocate}
              onToggleVisibility={onToggleVisibility}
              allObjects={objects}
            />
          ))
        )}
      </div>

      {/* Rodapé Informativo / Legenda */}
      <div className="px-3 py-2 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex items-center gap-2">
          <span>👁️ Alternar visibilidade</span>
          <span>·</span>
          <span>Clique para focar</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
          <span>Galpão ➔ Bloco ➔ Rua ➔ Drive ➔ Canal</span>
        </div>
      </div>
    </div>
  )
}
