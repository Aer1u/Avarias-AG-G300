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

import React, { useState, useMemo, useEffect } from "react"
import {
  Layers,
  Search,
  Eye,
  EyeOff,
  MapPin,
  Box,
  Building2,
  Info,
  ChevronRight,
  ChevronDown,
  BarChart3,
  LayoutGrid,
  Package,
  Warehouse,
  Rows3,
} from "lucide-react"
import type { MapObject, SystemVisualRef } from "../MapLibrary/types"
import type { StorageChannel } from "../MapLibrary/dimensionsTypes"
import { ensureDriveChannels, resolveSpatialContainment } from "../MapLibrary/spatialContainment"
import { getLocalItems, type MapeamentoItem } from "@/lib/mapeamentosStorage"
import {
  filterItemsForDriveChannel,
  getChannelOccupiedSlots,
  getObjectOccupiedSlotCount,
  isItemBelongingToObject,
  ITEMS_UPDATED_EVENT,
} from "@/lib/driveOccupancy"
import {
  getSystemsLinkedToObject,
  isObjectMatchingSystemFilter,
  resolveSystemForChannel,
  resolveSystemForObject,
  isOpenSystem,
} from "@/lib/systemVisuals"

interface ViewerNavigationSidebarProps {
  objects: MapObject[]
  selectedId: string | null
  selectedChannelId?: string | null
  systems?: SystemVisualRef[]
  activeSystemFilterId?: string | null
  onSelectAndLocate: (obj: MapObject) => void
  onSelectChannel?: (obj: MapObject, channelId: string) => void
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
  selectedChannelId,
  systems = [],
  activeSystemFilterId = null,
  onSelectAndLocate,
  onSelectChannel,
  onToggleVisibility,
  onToggleAllVisibility,
  onOpenDriveInGrid,
}: ViewerNavigationSidebarProps) {
  const [activeTab, setActiveTab] = useState<"system" | "tree" | "details">("system")
  const [systemBreakdownMode, setSystemBreakdownMode] = useState<"blocks" | "drives">("blocks")
  const [systemSearch, setSystemSearch] = useState("")
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set())
  const [expandedDrives, setExpandedDrives] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())
  const [itemsVersion, setItemsVersion] = useState(0)

  useEffect(() => {
    const onItemsUpdated = () => setItemsVersion((v) => v + 1)
    window.addEventListener(ITEMS_UPDATED_EVENT, onItemsUpdated)
    return () => window.removeEventListener(ITEMS_UPDATED_EVENT, onItemsUpdated)
  }, [])

  const viewerObjects = useMemo(
    () =>
      objects.filter(
        (o) =>
          o.type !== "coordinates" &&
          o.type !== "dimension_line" &&
          o.type !== "pallet" &&
          o.type !== "box"
      ),
    [objects]
  )

  const tree = useMemo(() => buildTree(viewerObjects), [viewerObjects])

  const selectedObject = useMemo(() => {
    return viewerObjects.find((o) => o.id === selectedId) || null
  }, [viewerObjects, selectedId])

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
    void itemsVersion
    if (!selectedObject) return null
    const ppm = Number(selectedObject.props?.pixelsPerMeter) || 20
    const wM = selectedObject.physicalDimensions?.width || selectedObject.width / ppm
    const lM = selectedObject.physicalDimensions?.length || selectedObject.height / ppm
    const hM = selectedObject.physicalDimensions?.height || 5.0
    const areaM2 = Math.round(wM * lM * 10) / 10

    const isCompartment = selectedObject.type === "compartment"
    const levels = isCompartment ? 0 : Number(selectedObject.props?.levels) || 4
    const depth = isCompartment ? 0 : Number(selectedObject.props?.depth) || 4
    const lanes = isCompartment ? 0 : Math.max(1, Number(selectedObject.props?.lanes) || 1)
    const capacity = isCompartment ? 0 : levels * depth * lanes

    const channels = !isCompartment ? ensureDriveChannels(selectedObject) : []
    const occupiedSlots = getObjectOccupiedSlotCount(
      selectedObject,
      getLocalItems(),
      channels,
      false
    )

    const resolvedSystem = resolveSystemForObject(selectedObject, systems)
    const linkedSystems = getSystemsLinkedToObject(selectedObject, systems)

    return {
      isCompartment,
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
      systemId: resolvedSystem?.id || (selectedObject.props?.systemId as string) || null,
      systemLabel: resolvedSystem?.name || (selectedObject.props?.systemLabel as string) || null,
      resolvedSystem,
      linkedSystems,
      situation: selectedObject.operationalSituation || "ativa",
      responsible: selectedObject.responsible || null,
      restrictions: selectedObject.restrictions || null,
    }
  }, [selectedObject, itemsVersion, systems])

  // Mini-dashboard completo do Sistema (Paletes, SKUs, Drive-Ins, Canais, Blocos)
  const systemDashboard = useMemo(() => {
    void itemsVersion

    const allItems: MapeamentoItem[] = getLocalItems().filter(
      (it) => (Number(it.quantidade) || 0) > 0
    )
    const scopedItems = activeSystemFilterId
      ? allItems.filter(
          (it) =>
            typeof it.mapeamentoId === "string" &&
            it.mapeamentoId.startsWith(`sys_${activeSystemFilterId}_`)
        )
      : allItems

    const objectById = new Map(viewerObjects.map((o) => [o.id, o]))
    const { containmentMap } = resolveSpatialContainment(viewerObjects)

    const resolveBlockContainer = (obj: MapObject): { id: string; label: string; obj?: MapObject } => {
      const visited = new Set<string>()
      let currentId: string | undefined = obj.id
      let fallbackArea: MapObject | undefined
      let fallbackFloor: MapObject | undefined

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId)
        const currentObj = objectById.get(currentId)
        const parentId =
          (currentObj?.props?.streetId as string | undefined) ||
          currentObj?.parentId ||
          containmentMap.get(currentId)

        if (!parentId || visited.has(parentId)) break
        const parentObj = objectById.get(parentId)
        if (!parentObj) break

        if (parentObj.classification === "bloco") {
          return {
            id: parentObj.id,
            label: parentObj.label || parentObj.id,
            obj: parentObj,
          }
        }
        if (!fallbackArea && parentObj.category === "area" && parentObj.type !== "floor") {
          fallbackArea = parentObj
        }
        if (!fallbackFloor && parentObj.type === "floor") {
          fallbackFloor = parentObj
        }
        currentId = parentObj.id
      }

      if (fallbackArea) {
        return {
          id: fallbackArea.id,
          label: fallbackArea.label || fallbackArea.id,
          obj: fallbackArea,
        }
      }
      if (fallbackFloor) {
        return {
          id: fallbackFloor.id,
          label: fallbackFloor.label || fallbackFloor.id,
          obj: fallbackFloor,
        }
      }
      return { id: "__sem_bloco__", label: "Sem Bloco" }
    }

    interface ChannelMetric {
      id: string
      code: string
      name: string
      paletes: number
      capacidade: number
      skusCount: number
      units: number
      system?: SystemVisualRef
    }

    interface StructureMetric {
      obj: MapObject
      label: string
      isCompartment: boolean
      blockId: string
      blockLabel: string
      paletes: number
      capacidade: number
      skusCount: number
      skuSet: Set<string>
      units: number
      canaisTotal: number
      canaisOcupados: number
      occupancyPct: number
      channels: ChannelMetric[]
      linkedSystems: SystemVisualRef[]
    }

    interface BlockMetric {
      id: string
      label: string
      obj?: MapObject
      paletes: number
      capacidade: number
      skusCount: number
      skuSet: Set<string>
      units: number
      driveInsCount: number
      compartmentsCount: number
      canaisTotal: number
      canaisOcupados: number
      occupancyPct: number
      structures: StructureMetric[]
    }

    const storageObjects = viewerObjects.filter(
      (o) =>
        o.type === "drive_in" ||
        o.type === "drive_through" ||
        o.type === "compartment" ||
        o.category === "storage"
    )

    const structures: StructureMetric[] = []
    const globalSkuSet = new Set<string>()
    let totalPaletes = 0
    let totalCapacidade = 0
    let totalUnits = 0
    let totalDriveIns = 0
    let totalCompartments = 0
    let totalCanais = 0
    let totalCanaisOcupados = 0

    storageObjects.forEach((obj) => {
      const isCompartment = obj.type === "compartment"
      const objLabel = String(obj.label || obj.props?.label || obj.props?.code || obj.id).trim()
      const objItems = scopedItems.filter((it) => isItemBelongingToObject(it, obj.id))
      const linkedSystems = getSystemsLinkedToObject(obj, systems)
      const block = resolveBlockContainer(obj)

      if (isCompartment) {
        if (activeSystemFilterId && !isObjectMatchingSystemFilter(obj, activeSystemFilterId, systems)) {
          return
        }
        const paletes = getObjectOccupiedSlotCount(obj, objItems, [], false)
        const skuSet = new Set<string>()
        let units = 0
        objItems.forEach((it) => {
          units += Number(it.quantidade) || 0
          const sku = String(it.sku || "").trim().toUpperCase()
          if (sku) {
            skuSet.add(sku)
            globalSkuSet.add(sku)
          }
        })

        totalPaletes += paletes
        totalUnits += units
        totalCompartments += 1

        structures.push({
          obj,
          label: objLabel,
          isCompartment: true,
          blockId: block.id,
          blockLabel: block.label,
          paletes,
          capacidade: 0,
          skusCount: skuSet.size,
          skuSet,
          units,
          canaisTotal: 0,
          canaisOcupados: 0,
          occupancyPct: 0,
          channels: [],
          linkedSystems,
        })
        return
      }

      const allChannels = ensureDriveChannels(obj)
      const scopedChannels = activeSystemFilterId
        ? allChannels.filter(
            (chan) => resolveSystemForChannel(obj, chan, systems)?.id === activeSystemFilterId
          )
        : allChannels

      if (activeSystemFilterId && scopedChannels.length === 0) {
        return
      }

      const driveSkuSet = new Set<string>()
      const channelMetrics: ChannelMetric[] = []
      let drivePaletes = 0
      let driveCapacidade = 0
      let driveUnits = 0
      let driveCanaisOcupados = 0

      scopedChannels.forEach((chan) => {
        const chanSys = resolveSystemForChannel(obj, chan, systems)
        const chanScopedObjItems = objItems.filter((it) => {
          if (chanSys) {
            return it.mapeamentoId === `sys_${chanSys.id}_${obj.id}`
          }
          return it.mapeamentoId.startsWith("ws_") || it.mapeamentoId.startsWith("comp_")
        })
        const chanItems = filterItemsForDriveChannel(chanScopedObjItems, chan, allChannels, objLabel)
        const chanPaletes = getChannelOccupiedSlots(obj, chan, allChannels, chanScopedObjItems, false, {
          channelSystemId: chanSys?.id ?? null,
          isolateByChannelSystem: true,
          activeSystemFilterId,
        }).length
        const chanLevels = Math.max(1, Number(chan.levels || obj.props?.levels) || 4)
        const chanDepth = Math.max(1, Number(chan.depth || obj.props?.depth) || 4)
        const chanCap = chanLevels * chanDepth
        const chanSkuSet = new Set<string>()
        let chanUnits = 0

        chanItems.forEach((it) => {
          chanUnits += Number(it.quantidade) || 0
          const sku = String(it.sku || "").trim().toUpperCase()
          if (sku) {
            chanSkuSet.add(sku)
            driveSkuSet.add(sku)
            globalSkuSet.add(sku)
          }
        })

        if (chanPaletes > 0 || chanUnits > 0) {
          driveCanaisOcupados += 1
        }
        drivePaletes += chanPaletes
        driveCapacidade += chanCap
        driveUnits += chanUnits

        channelMetrics.push({
          id: chan.id,
          code: chan.code || chan.name || `C${chan.laneIndex}`,
          name: chan.name || chan.code || `Canal ${chan.laneIndex}`,
          paletes: chanPaletes,
          capacidade: chanCap,
          skusCount: chanSkuSet.size,
          units: chanUnits,
          system: chanSys,
        })
      })

      totalPaletes += drivePaletes
      totalCapacidade += driveCapacidade
      totalUnits += driveUnits
      totalDriveIns += 1
      totalCanais += scopedChannels.length
      totalCanaisOcupados += driveCanaisOcupados

      structures.push({
        obj,
        label: objLabel,
        isCompartment: false,
        blockId: block.id,
        blockLabel: block.label,
        paletes: drivePaletes,
        capacidade: driveCapacidade,
        skusCount: driveSkuSet.size,
        skuSet: driveSkuSet,
        units: driveUnits,
        canaisTotal: scopedChannels.length,
        canaisOcupados: driveCanaisOcupados,
        occupancyPct: driveCapacidade > 0 ? Math.round((drivePaletes / driveCapacidade) * 100) : 0,
        channels: channelMetrics,
        linkedSystems,
      })
    })

    // Agrupamento por Bloco
    const blockMap = new Map<string, BlockMetric>()
    structures.forEach((st) => {
      let grp = blockMap.get(st.blockId)
      if (!grp) {
        const blockObj = st.blockId !== "__sem_bloco__" ? objectById.get(st.blockId) : undefined
        grp = {
          id: st.blockId,
          label: st.blockLabel,
          obj: blockObj,
          paletes: 0,
          capacidade: 0,
          skusCount: 0,
          skuSet: new Set<string>(),
          units: 0,
          driveInsCount: 0,
          compartmentsCount: 0,
          canaisTotal: 0,
          canaisOcupados: 0,
          occupancyPct: 0,
          structures: [],
        }
        blockMap.set(st.blockId, grp)
      }
      grp.paletes += st.paletes
      grp.capacidade += st.capacidade
      grp.units += st.units
      if (st.isCompartment) grp.compartmentsCount += 1
      else grp.driveInsCount += 1
      grp.canaisTotal += st.canaisTotal
      grp.canaisOcupados += st.canaisOcupados
      st.skuSet.forEach((sku) => grp!.skuSet.add(sku))
      grp.skusCount = grp.skuSet.size
      grp.occupancyPct = grp.capacidade > 0 ? Math.round((grp.paletes / grp.capacidade) * 100) : 0
      grp.structures.push(st)
    })

    const blocks = Array.from(blockMap.values()).sort((a, b) => {
      if (a.id === "__sem_bloco__") return 1
      if (b.id === "__sem_bloco__") return -1
      return a.label.localeCompare(b.label, "pt-BR", { numeric: true })
    })
    blocks.forEach((b) => {
      b.structures.sort((a, c) => a.label.localeCompare(c.label, "pt-BR", { numeric: true }))
    })

    const sortedStructures = [...structures].sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR", { numeric: true })
    )

    const activeSystem = activeSystemFilterId
      ? systems.find((s) => s.id === activeSystemFilterId) || null
      : null

    return {
      activeSystem,
      totalPaletes,
      totalCapacidade,
      occupancyPct: totalCapacidade > 0 ? Math.round((totalPaletes / totalCapacidade) * 100) : 0,
      totalSkus: globalSkuSet.size,
      totalUnits,
      totalDriveIns,
      totalCompartments,
      totalCanais,
      totalCanaisOcupados,
      totalBlocos: blocks.filter((b) => b.id !== "__sem_bloco__").length,
      blocks,
      structures: sortedStructures,
    }
  }, [viewerObjects, itemsVersion, activeSystemFilterId, systems])

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

    const linkedObjSystems = getSystemsLinkedToObject(obj, systems)
    const matchesSystemFilter = isObjectMatchingSystemFilter(obj, activeSystemFilterId, systems)

    return (
      <div key={obj.id} className="select-none">
        <div
          onClick={() => handleSelect(obj)}
          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-xl text-xs transition-colors cursor-pointer group ${
            isSelected
              ? "bg-blue-600/30 text-white border border-blue-500/60 shadow-sm"
              : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
          } ${activeSystemFilterId && !matchesSystemFilter && !hasChildren ? "opacity-35" : ""}`}
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

          {/* Indicadores de Sistema(s) vinculado(s) */}
          {linkedObjSystems.length > 0 && (
            <div className="flex items-center gap-1 shrink-0" title={linkedObjSystems.map((s) => s.name).join(", ")}>
              {linkedObjSystems.slice(0, 2).map((sys) => (
                <span
                  key={sys.id}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border"
                  style={{
                    backgroundColor: `${sys.color}20`,
                    borderColor: `${sys.color}66`,
                    color: sys.color,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: sys.color }}
                  />
                  {sys.code}
                </span>
              ))}
              {linkedObjSystems.length > 2 && (
                <span className="text-[9px] text-slate-400 font-mono">+{linkedObjSystems.length - 2}</span>
              )}
            </div>
          )}

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
          {obj.type === "compartment" && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenDriveInGrid?.(obj)
              }}
              className="text-[9px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 font-mono shrink-0 border border-amber-800/60 hover:bg-amber-900 transition-colors flex items-center gap-1"
              title="Abrir Relação de Itens deste Compartimento"
            >
              <span>📦</span>
              <span>Relação</span>
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

      {/* Abas: Sistema (Mini-Dashboard) ↔ Estrutura ↔ Inspeção */}
      <div className="flex border-b border-slate-800 bg-slate-950 shrink-0">
        <button
          onClick={() => setActiveTab("system")}
          className={`flex-1 py-2 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "system"
              ? "border-emerald-500 text-emerald-400 bg-slate-900/70"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <BarChart3 size={12} />
          <span>Sistema</span>
        </button>

        <button
          onClick={() => setActiveTab("tree")}
          className={`flex-1 py-2 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "tree"
              ? "border-blue-500 text-blue-400 bg-slate-900/60"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <Layers size={12} />
          <span>Estrutura ({objects.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("details")}
          className={`flex-1 py-2 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "details"
              ? "border-amber-500 text-amber-400 bg-slate-900/60"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <Info size={12} />
          <span>Inspeção {selectedObject ? "●" : ""}</span>
        </button>
      </div>

      {/* Conteúdo Aba: Sistema (Mini-Dashboard) */}
      {activeTab === "system" ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {/* Indicador informativo do sistema selecionado na barra superior */}
            {systems.length > 0 && (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/75 border border-slate-800/90">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: systemDashboard.activeSystem?.color || "#10b981",
                    }}
                  />
                  <span className="text-[11px] font-semibold text-white truncate">
                    {systemDashboard.activeSystem
                      ? systemDashboard.activeSystem.name
                      : `Todos os Sistemas (${systems.length})`}
                  </span>
                </div>
                {systemDashboard.activeSystem && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                    {isOpenSystem(systemDashboard.activeSystem) ? "Livre" : "Saldo"}
                  </span>
                )}
              </div>
            )}

            {/* KPIs Principais do Sistema */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800/90 space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wider">Paletes</span>
                  <Package size={12} className="text-amber-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <strong className="text-lg font-bold text-white font-mono leading-tight">
                    {systemDashboard.totalPaletes.toLocaleString("pt-BR")}
                  </strong>
                  {systemDashboard.totalCapacidade > 0 && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      / {systemDashboard.totalCapacidade.toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-amber-400/90 font-medium block">
                  {systemDashboard.occupancyPct}% ocupado
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800/90 space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wider">SKUs</span>
                  <LayoutGrid size={12} className="text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <strong className="text-lg font-bold text-white font-mono leading-tight">
                    {systemDashboard.totalSkus.toLocaleString("pt-BR")}
                  </strong>
                  <span className="text-[10px] text-slate-500">únicos</span>
                </div>
                <span className="text-[10px] text-emerald-400/90 font-medium block">
                  {systemDashboard.totalUnits.toLocaleString("pt-BR")} unid.
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800/90 space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wider">Drive-Ins</span>
                  <Warehouse size={12} className="text-blue-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <strong className="text-lg font-bold text-white font-mono leading-tight">
                    {systemDashboard.totalDriveIns}
                  </strong>
                  {systemDashboard.totalCompartments > 0 && (
                    <span className="text-[10px] text-slate-500">
                      +{systemDashboard.totalCompartments} comp.
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-blue-400/90 font-medium block">
                  {systemDashboard.totalBlocos > 0
                    ? `${systemDashboard.totalBlocos} bloco${systemDashboard.totalBlocos > 1 ? "s" : ""}`
                    : `${systemDashboard.blocks.length} agrup.`}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800/90 space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wider">Canais</span>
                  <Rows3 size={12} className="text-violet-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <strong className="text-lg font-bold text-white font-mono leading-tight">
                    {systemDashboard.totalCanais}
                  </strong>
                  <span className="text-[10px] text-slate-500">totais</span>
                </div>
                <span className="text-[10px] text-violet-300/90 font-medium block">
                  {systemDashboard.totalCanaisOcupados} em uso ·{" "}
                  {Math.max(0, systemDashboard.totalCanais - systemDashboard.totalCanaisOcupados)} livres
                </span>
              </div>
            </div>

            {/* Barra de Ocupação Consolidada */}
            {systemDashboard.totalCapacidade > 0 && (
              <div className="px-2.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-medium">Ocupação global das posições</span>
                  <strong className="text-white font-mono">
                    {systemDashboard.totalPaletes}/{systemDashboard.totalCapacidade} ({systemDashboard.occupancyPct}%)
                  </strong>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 to-amber-400 transition-all"
                    style={{ width: `${Math.min(100, systemDashboard.occupancyPct)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Subdivisões: Blocos e Drive-Ins isolados */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Subdivisões
                </span>
                <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSystemBreakdownMode("blocks")}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                      systemBreakdownMode === "blocks"
                        ? "bg-slate-800 text-white"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Por Bloco ({systemDashboard.blocks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSystemBreakdownMode("drives")}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                      systemBreakdownMode === "drives"
                        ? "bg-slate-800 text-white"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Por Drive-In ({systemDashboard.structures.length})
                  </button>
                </div>
              </div>

              {/* Busca rápida dentro das subdivisões */}
              {systemDashboard.structures.length > 4 && (
                <div className="relative">
                  <Search
                    size={11}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    value={systemSearch}
                    onChange={(e) => setSystemSearch(e.target.value)}
                    placeholder="Filtrar bloco ou drive-in..."
                    className="w-full pl-7 pr-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {systemDashboard.structures.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs rounded-xl bg-slate-950/40 border border-slate-800/60">
                  <Box size={22} className="mx-auto mb-1.5 text-slate-600" />
                  <p className="font-medium text-slate-400">Nenhuma estrutura neste escopo</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Selecione outro sistema ou visualize Todos.
                  </p>
                </div>
              ) : systemBreakdownMode === "blocks" ? (
                /* Visão isolada por Bloco -> Drive-Ins -> Canais */
                <div className="space-y-2">
                  {systemDashboard.blocks
                    .filter((blk) => {
                      const q = systemSearch.trim().toLowerCase()
                      if (!q) return true
                      return (
                        blk.label.toLowerCase().includes(q) ||
                        blk.structures.some((s) => s.label.toLowerCase().includes(q))
                      )
                    })
                    .map((blk) => {
                      const isBlkCollapsed = collapsedBlocks.has(blk.id)
                      const filteredStructures = systemSearch.trim()
                        ? blk.structures.filter((s) => {
                            const q = systemSearch.trim().toLowerCase()
                            return (
                              blk.label.toLowerCase().includes(q) ||
                              s.label.toLowerCase().includes(q)
                            )
                          })
                        : blk.structures

                      return (
                        <div
                          key={blk.id}
                          className="rounded-xl bg-slate-950/75 border border-slate-800/90 overflow-hidden"
                        >
                          {/* Cabeçalho do Bloco */}
                          <div
                            onClick={() =>
                              setCollapsedBlocks((prev) => {
                                const next = new Set(prev)
                                if (next.has(blk.id)) next.delete(blk.id)
                                else next.add(blk.id)
                                return next
                              })
                            }
                            className="p-2.5 cursor-pointer hover:bg-slate-900/70 transition-colors space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isBlkCollapsed ? (
                                  <ChevronRight size={13} className="text-slate-500 shrink-0" />
                                ) : (
                                  <ChevronDown size={13} className="text-slate-400 shrink-0" />
                                )}
                                <Building2 size={13} className="text-indigo-400 shrink-0" />
                                <span className="text-xs font-bold text-white truncate">
                                  {blk.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {blk.capacidade > 0 && (
                                  <span className="text-[10px] font-mono font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded">
                                    {blk.occupancyPct}%
                                  </span>
                                )}
                                {blk.obj && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onSelectAndLocate(blk.obj!)
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                                    title="Centralizar bloco no mapa"
                                  >
                                    <MapPin size={11} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Métricas isoladas do Bloco */}
                            <div className="grid grid-cols-4 gap-1 text-center pt-0.5">
                              <div className="px-1 py-1 rounded bg-slate-900/90 border border-slate-800/80">
                                <span className="text-[9px] text-slate-500 block">Paletes</span>
                                <strong className="text-[11px] font-mono text-white">
                                  {blk.paletes}
                                </strong>
                              </div>
                              <div className="px-1 py-1 rounded bg-slate-900/90 border border-slate-800/80">
                                <span className="text-[9px] text-slate-500 block">SKUs</span>
                                <strong className="text-[11px] font-mono text-emerald-300">
                                  {blk.skusCount}
                                </strong>
                              </div>
                              <div className="px-1 py-1 rounded bg-slate-900/90 border border-slate-800/80">
                                <span className="text-[9px] text-slate-500 block">Drives</span>
                                <strong className="text-[11px] font-mono text-blue-300">
                                  {blk.driveInsCount}
                                </strong>
                              </div>
                              <div className="px-1 py-1 rounded bg-slate-900/90 border border-slate-800/80">
                                <span className="text-[9px] text-slate-500 block">Canais</span>
                                <strong className="text-[11px] font-mono text-violet-300">
                                  {blk.canaisOcupados}/{blk.canaisTotal}
                                </strong>
                              </div>
                            </div>
                          </div>

                          {/* Drive-Ins isolados dentro do Bloco */}
                          {!isBlkCollapsed && (
                            <div className="border-t border-slate-800/80 bg-slate-900/40 p-1.5 space-y-1.5">
                              {filteredStructures.map((st) => {
                                const isSelected = st.obj.id === selectedId
                                const isExpanded = expandedDrives.has(st.obj.id)
                                return (
                                  <div
                                    key={st.obj.id}
                                    className={`rounded-lg border transition-colors ${
                                      isSelected
                                        ? "bg-blue-950/40 border-blue-500/60"
                                        : "bg-slate-950/70 border-slate-800/80 hover:border-slate-700"
                                    }`}
                                  >
                                    <div
                                      onClick={() => onSelectAndLocate(st.obj)}
                                      className="p-2 cursor-pointer space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          {!st.isCompartment && st.channels.length > 0 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setExpandedDrives((prev) => {
                                                  const next = new Set(prev)
                                                  if (next.has(st.obj.id)) next.delete(st.obj.id)
                                                  else next.add(st.obj.id)
                                                  return next
                                                })
                                              }}
                                              className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800"
                                              title="Expandir canais deste Drive-In"
                                            >
                                              {isExpanded ? (
                                                <ChevronDown size={11} />
                                              ) : (
                                                <ChevronRight size={11} />
                                              )}
                                            </button>
                                          )}
                                          <span className="text-[11px] font-semibold text-white truncate">
                                            {st.label}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              onOpenDriveInGrid?.(st.obj)
                                            }}
                                            className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/90 text-blue-300 border border-blue-800/60 hover:bg-blue-700 hover:text-white font-mono transition-colors"
                                            title={
                                              st.isCompartment
                                                ? "Abrir relação de itens"
                                                : "Abrir Grid de Paletes"
                                            }
                                          >
                                            {st.isCompartment ? "Relação" : "Grid"}
                                          </button>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                        <span>
                                          <strong className="text-amber-300">{st.paletes}</strong>
                                          {st.capacidade > 0 ? `/${st.capacidade}` : ""} pal.
                                        </span>
                                        <span>
                                          <strong className="text-emerald-300">{st.skusCount}</strong>{" "}
                                          SKU{st.skusCount === 1 ? "" : "s"}
                                        </span>
                                        {!st.isCompartment ? (
                                          <span>
                                            <strong className="text-violet-300">
                                              {st.canaisOcupados}/{st.canaisTotal}
                                            </strong>{" "}
                                            can.
                                          </span>
                                        ) : (
                                          <span className="text-amber-400/80">Compart.</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Canais individuais do Drive-In */}
                                    {isExpanded && st.channels.length > 0 && (
                                      <div className="border-t border-slate-800/70 px-2 py-1.5 space-y-1 bg-slate-900/50">
                                        {st.channels.map((ch) => (
                                          <button
                                            key={ch.id}
                                            type="button"
                                            onClick={() => {
                                              onSelectChannel?.(st.obj, ch.id || ch.code)
                                              onOpenDriveInGrid?.(st.obj, ch.code || ch.id)
                                            }}
                                            className="w-full flex items-center justify-between gap-2 px-1.5 py-1 rounded bg-slate-950/80 hover:bg-blue-950/60 border border-slate-800/80 hover:border-blue-600/50 text-left transition-colors"
                                          >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <span
                                                className="w-2 h-2 rounded-sm shrink-0"
                                                style={{
                                                  backgroundColor: ch.system?.color || "#475569",
                                                }}
                                              />
                                              <span
                                                className="text-[10px] font-semibold text-slate-200 truncate"
                                                title={ch.name && ch.code && ch.name !== ch.code ? `${ch.name} (${ch.code})` : ch.name || ch.code}
                                              >
                                                {ch.name || ch.code}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[9px] font-mono text-slate-400 shrink-0">
                                              <span>
                                                <strong className="text-amber-300">{ch.paletes}</strong>
                                                /{ch.capacidade}p
                                              </span>
                                              <span>
                                                <strong className="text-emerald-300">
                                                  {ch.skusCount}
                                                </strong>{" "}
                                                SKU
                                              </span>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              ) : (
                /* Visão isolada direta por Drive-In */
                <div className="space-y-1.5">
                  {systemDashboard.structures
                    .filter((st) => {
                      const q = systemSearch.trim().toLowerCase()
                      if (!q) return true
                      return (
                        st.label.toLowerCase().includes(q) ||
                        st.blockLabel.toLowerCase().includes(q)
                      )
                    })
                    .map((st) => {
                      const isSelected = st.obj.id === selectedId
                      const isExpanded = expandedDrives.has(st.obj.id)
                      return (
                        <div
                          key={st.obj.id}
                          className={`rounded-xl border overflow-hidden transition-colors ${
                            isSelected
                              ? "bg-blue-950/40 border-blue-500/60"
                              : "bg-slate-950/75 border-slate-800/90 hover:border-slate-700"
                          }`}
                        >
                          <div
                            onClick={() => onSelectAndLocate(st.obj)}
                            className="p-2.5 cursor-pointer space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {!st.isCompartment && st.channels.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setExpandedDrives((prev) => {
                                          const next = new Set(prev)
                                          if (next.has(st.obj.id)) next.delete(st.obj.id)
                                          else next.add(st.obj.id)
                                          return next
                                        })
                                      }}
                                      className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800"
                                      title="Ver canais individuais"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown size={11} />
                                      ) : (
                                        <ChevronRight size={11} />
                                      )}
                                    </button>
                                  )}
                                  <span className="text-xs font-bold text-white truncate">
                                    {st.label}
                                  </span>
                                </div>
                                <span className="text-[10px] text-indigo-300/80 block pl-0.5 truncate">
                                  {st.blockLabel}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onSelectAndLocate(st.obj)
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800"
                                  title="Localizar no mapa"
                                >
                                  <MapPin size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onOpenDriveInGrid?.(st.obj)
                                  }}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/90 text-blue-300 border border-blue-800/60 hover:bg-blue-700 hover:text-white font-mono transition-colors"
                                >
                                  {st.isCompartment ? "Relação" : "Grid"}
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-1 text-center">
                              <div className="px-1 py-1 rounded bg-slate-900/90 border border-slate-800/80">
                                <span className="text-[9px] text-slate-500 block">Paletes</span>
                                <strong className="text-[11px] font-mono text-amber-300">
                                  {st.paletes}
                                </strong>
                              </div>
                              <div className="px-1 py-1 rounded bg-slate-900/90 border border-slate-800/80">
                                <span className="text-[9px] text-slate-500 block">SKUs</span>
                                <strong className="text-[11px] font-mono text-emerald-300">
                                  {st.skusCount}
                                </strong>
                              </div>
                              <div className="px-1 py-1 rounded bg-slate-900/90 border border-slate-800/80">
                                <span className="text-[9px] text-slate-500 block">Canais</span>
                                <strong className="text-[11px] font-mono text-violet-300">
                                  {st.isCompartment ? "—" : `${st.canaisOcupados}/${st.canaisTotal}`}
                                </strong>
                              </div>
                              <div className="px-1 py-1 rounded bg-slate-900/90 border border-slate-800/80">
                                <span className="text-[9px] text-slate-500 block">Ocup.</span>
                                <strong className="text-[11px] font-mono text-slate-200">
                                  {st.capacidade > 0 ? `${st.occupancyPct}%` : `${st.units}u`}
                                </strong>
                              </div>
                            </div>
                          </div>

                          {isExpanded && st.channels.length > 0 && (
                            <div className="border-t border-slate-800/80 px-2 py-1.5 space-y-1 bg-slate-900/40">
                              {st.channels.map((ch) => (
                                <button
                                  key={ch.id}
                                  type="button"
                                  onClick={() => {
                                    onSelectChannel?.(st.obj, ch.id || ch.code)
                                    onOpenDriveInGrid?.(st.obj, ch.code || ch.id)
                                  }}
                                  className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-slate-950/80 hover:bg-blue-950/60 border border-slate-800/80 hover:border-blue-600/50 text-left transition-colors"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span
                                      className="w-2 h-2 rounded-sm shrink-0"
                                      style={{
                                        backgroundColor: ch.system?.color || "#475569",
                                      }}
                                    />
                                    <span
                                      className="text-[10px] font-semibold text-slate-200 truncate"
                                      title={ch.name && ch.code && ch.name !== ch.code ? `${ch.name} (${ch.code})` : ch.name || ch.code}
                                    >
                                      {ch.name || ch.code}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[9px] font-mono text-slate-400 shrink-0">
                                    <span>
                                      <strong className="text-amber-300">{ch.paletes}</strong>/
                                      {ch.capacidade}p
                                    </span>
                                    <span>
                                      <strong className="text-emerald-300">{ch.skusCount}</strong> SKU
                                    </span>
                                    <span>{ch.units}u</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === "tree" ? (
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

              {/* Se for Compartimento: Espaço Aberto (sem nível/profundidade) */}
              {details.isCompartment && (
                <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
                      <span>📦</span>
                      <span>Armazenamento Aberto</span>
                    </span>
                    <span className="text-[9px] font-bold text-amber-300 font-mono bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                      Espaço Livre
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Compartimento sem subdivisão de nível ou profundidade. Visualize a relação de paletes agrupados e itens livres:
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenDriveInGrid?.(selectedObject)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
                  >
                    <span>📦</span>
                    <span>Abrir Relação do Compartimento</span>
                  </button>
                </div>
              )}

              {/* Se for Drive-In ou Armazenamento estruturado (exceto Compartimento): Capacidade e Posições */}
              {!details.isCompartment && (selectedObject.type === "drive_in" || selectedObject.category === "storage") && (
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
                        {(selectedObject.props.channels as StorageChannel[]).map((chan) => {
                          const isChanActive =
                            (chan.id && chan.id === selectedChannelId) ||
                            (chan.code && chan.code === selectedChannelId)
                          const chanSys = resolveSystemForChannel(selectedObject, chan, systems)
                          const isChanDimmed = Boolean(
                            activeSystemFilterId && chanSys?.id !== activeSystemFilterId
                          )

                          return (
                            <button
                              key={chan.id || chan.code}
                              type="button"
                              onClick={() => {
                                onSelectChannel?.(selectedObject, chan.id || chan.code)
                                onOpenDriveInGrid?.(selectedObject, chan.code || chan.id)
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl transition-all text-left group ${
                                isChanDimmed
                                  ? "bg-slate-900/35 border border-slate-800/45 text-slate-500 opacity-40 grayscale hover:opacity-75"
                                  : isChanActive
                                  ? "bg-blue-950/80 border-2 border-blue-500 shadow-md ring-1 ring-blue-500/40"
                                  : "bg-slate-900/90 hover:bg-blue-950/60 border border-slate-800 hover:border-blue-600/60"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-sm shrink-0 border border-white/20"
                                  style={{
                                    backgroundColor: isChanDimmed
                                      ? "#475569"
                                      : chanSys?.color || "#334155",
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`font-mono text-xs font-bold ${
                                        isChanDimmed
                                          ? "text-slate-500"
                                          : "text-white group-hover:text-blue-300"
                                      }`}
                                    >
                                      {chan.code}
                                    </span>
                                    {chanSys && (
                                      <span
                                        className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border"
                                        style={
                                          isChanDimmed
                                            ? {
                                                backgroundColor: "rgba(51,65,85,0.25)",
                                                borderColor: "rgba(71,85,105,0.5)",
                                                color: "#64748b",
                                              }
                                            : {
                                                backgroundColor: `${chanSys.color}20`,
                                                borderColor: `${chanSys.color}66`,
                                                color: chanSys.color,
                                              }
                                        }
                                      >
                                        {chanSys.icon} {chanSys.code}
                                      </span>
                                    )}
                                    {isChanActive && (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500 text-white font-bold">
                                        Ativo
                                      </span>
                                    )}
                                  </div>
                                  {chan.name && (
                                    <span className="text-[10px] text-slate-400 block truncate">
                                      {chan.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded border font-semibold transition-colors shrink-0 ${
                                  isChanDimmed
                                    ? "bg-slate-900/60 text-slate-500 border-slate-800"
                                    : "bg-blue-950 text-blue-400 border-blue-800/60 group-hover:bg-blue-600 group-hover:text-white"
                                }`}
                              >
                                {isChanDimmed ? "Desab." : "Ver Canal →"}
                              </span>
                            </button>
                          )
                        })}
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

                {details.linkedSystems.length > 0 ? (
                  <div className="space-y-1 pt-1 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">
                      {details.linkedSystems.length > 1 ? "Sistemas Vinculados:" : "Sistema Vinculado:"}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {details.linkedSystems.map((sys) => (
                        <span
                          key={sys.id}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold border"
                          style={{
                            backgroundColor: `${sys.color}1f`,
                            borderColor: `${sys.color}66`,
                            color: "#f8fafc",
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ backgroundColor: sys.color }}
                          />
                          <span>{sys.icon}</span>
                          <span>{sys.name}</span>
                          <span className="font-mono text-[9px] opacity-80">
                            {isOpenSystem(sys) ? "Livre" : "Saldo"}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  details.systemLabel && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Sistema Vinculado:</span>
                      <strong className="text-blue-400">{details.systemLabel}</strong>
                    </div>
                  )
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
