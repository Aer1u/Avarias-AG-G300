// ============================================================
// NEXUS ERP — UniversalMapEditor.tsx
// Orquestrador central do Mapeamento Universal & Construtor de Módulos
// ── Integra:
//    • Biblioteca Autoral Vetorial
//    • Canvas Konva 2D (draw_area, draw_floor, navigateTo)
//    • Geração em Massa / CSV
//    • Hierarquia Livre Configurável
//    • Padrões de Endereçamento Universal
//    • Registros Operacionais Vinculados
//    • Busca Universal Spotlight (Ctrl+K)
//    • Árvore de Hierarquia de Áreas
//    • Painel de Classificação de Áreas com Atributos Livres
//    • Novo Piso Configurável
// ============================================================

"use client"

import React, { useState, useCallback, useEffect, useRef } from "react"
import type { MapObject, MapElementDefinition } from "../MapLibrary/types"
import type {
  BusinessModuleDefinition,
  CustomEntityRecord,
  HierarchyLevel,
  AddressingRuleConfig,
} from "../MapLibrary/modulesTypes"
import { DEFAULT_G300_RULE } from "../MapLibrary/addressing"
import MapLibraryPanel from "../MapLibrary/MapLibraryPanel"
import MapCanvasContainer, { type MapCanvasHandle } from "../MapCanvas/MapCanvasContainer"
import { SpatialViewer3D } from "../Map3D/SpatialViewer3D"
import type { SpatialViewMode } from "../Map3D/types"
import MapPropertiesPanel from "../MapProperties/MapPropertiesPanel"
import MapToolbar from "../MapToolbar/MapToolbar"
import UniversalSearchSpotlight from "../MapToolbar/UniversalSearchSpotlight"
import AreaHierarchyPanel from "../MapLayers/AreaHierarchyPanel"
import ViewerNavigationSidebar from "../MapLayers/ViewerNavigationSidebar"
import ViewerDriveInModal from "../MapLayers/ViewerDriveInModal"
import MassGeneratorModal from "./MassGeneratorModal"
import HierarchyConfigModal from "./HierarchyConfigModal"
import ModuleBuilderModal from "./ModuleBuilderModal"
import DimensionConfigModal from "./DimensionConfigModal"
import ResourceEngineModal from "../Resources/ResourceEngineModal"
import SystemManagerModal from "../Systems/SystemManagerModal"
import SystemDataPanel from "../Systems/SystemDataPanel"
import { AdminCenterModal } from "../IAM/AdminCenter/AdminCenterModal"
import { useAuthz } from "../IAM/useAuthz"
import type { DimensionConfig } from "../MapLibrary/dimensionsTypes"
import type { PhysicalDimensions } from "../MapLibrary/types"
import {
  DEFAULT_G300_LEVELS_CONFIG,
  DEFAULT_G300_DEPTH_CONFIG,
} from "../MapLibrary/dimensionManager"
import { useMapHistory } from "./useMapHistory"
import {
  ensurePhysicalDimensions,
  realToPixels,
  toMeters,
} from "../MapLibrary/unitConverter"
import {
  FLOOR_SURFACES,
  FLOOR_SURFACES_LIST,
  type FloorMaterialType,
} from "../MapLibrary/floorSurfaces"
import { ensureDriveChannels } from "../MapLibrary/spatialContainment"

// ── Dados Iniciais: Hierarquia Configurável ───────────────────
const INITIAL_HIERARCHY: HierarchyLevel[] = [
  { id: "lvl_0", level: 0, name: "Galpão Principal", pluralName: "Galpões", canContainSublevels: true, icon: "🏢", color: "#3b82f6" },
  { id: "lvl_1", level: 1, name: "Área de Avarias", pluralName: "Áreas", canContainSublevels: true, icon: "📦", color: "#f59e0b" },
  { id: "lvl_2", level: 2, name: "Chão / Corredor", pluralName: "Chãos", canContainSublevels: true, icon: "🛣️", color: "#10b981" },
  { id: "lvl_3", level: 3, name: "Bloco", pluralName: "Blocos", canContainSublevels: true, icon: "🧱", color: "#8b5cf6" },
  { id: "lvl_4", level: 4, name: "Drive", pluralName: "Drives", canContainSublevels: true, icon: "📥", color: "#38bdf8" },
  { id: "lvl_5", level: 5, name: "Posição de Pallet", pluralName: "Posições", canContainSublevels: false, icon: "📍", color: "#ec4899" },
]

// ── Dados Iniciais: Módulos de Negócio ───────────────────────
const INITIAL_MODULES: BusinessModuleDefinition[] = [
  {
    id: "mod_avarias",
    slug: "avarias",
    name: "Controle de Avarias",
    description: "Gestão operacional de caixas amassadas, pallets avariados e laudos",
    icon: "⚠️",
    color: "#f59e0b",
    isActive: true,
    entities: [
      {
        id: "ent_avarias",
        moduleId: "mod_avarias",
        slug: "ocorrencias",
        name: "Ocorrência de Avaria",
        pluralName: "Ocorrências de Avaria",
        description: "Registro de danos e inspeção física",
        isLinkableToMap: true,
        fields: [
          { id: "f1", key: "locationCode", label: "Endereço do Drive", dataType: "location_ref", isRequired: true, order: 1 },
          { id: "f2", key: "severity", label: "Gravidade", dataType: "select", isRequired: true, order: 2 },
          { id: "f3", key: "responsible", label: "Responsável", dataType: "text", isRequired: false, order: 3 },
          { id: "f4", key: "status", label: "Situação", dataType: "select", isRequired: true, order: 4 },
        ],
      },
      {
        id: "ent_pallets_avaria",
        moduleId: "mod_avarias",
        slug: "pallets",
        name: "Pallet Avariado",
        pluralName: "Pallets Avariados",
        description: "Pallets individuais retidos no setor",
        isLinkableToMap: true,
        fields: [
          { id: "p1", key: "palletCode", label: "Código do Pallet", dataType: "text", isRequired: true, order: 1 },
          { id: "p2", key: "sku", label: "Produto / SKU", dataType: "text", isRequired: true, order: 2 },
          { id: "p3", key: "quantity", label: "Quantidade de Caixas", dataType: "number", isRequired: true, order: 3 },
        ],
      },
    ],
  },
  {
    id: "mod_manutencao",
    slug: "manutencao",
    name: "Manutenção & Patrimônio",
    description: "Ordens de serviço para empilhadeiras, estruturas e transpaleteiras",
    icon: "🔧",
    color: "#3b82f6",
    isActive: true,
    entities: [
      {
        id: "ent_os",
        moduleId: "mod_manutencao",
        slug: "ordens_servico",
        name: "Ordem de Serviço",
        pluralName: "Ordens de Serviço",
        isLinkableToMap: true,
        fields: [
          { id: "os1", key: "equipamento", label: "Equipamento", dataType: "text", isRequired: true, order: 1 },
          { id: "os2", key: "tipo", label: "Tipo de Manutenção", dataType: "select", isRequired: true, order: 2 },
        ],
      },
    ],
  },
]

// ── Registros Operacionais Iniciais ──────────────────────────
const INITIAL_RECORDS: CustomEntityRecord[] = [
  {
    id: "rec_1",
    entityId: "ent_avarias",
    locationId: "drive_G300004G0281",
    title: "Pallet tombado no nível 2 com risco de queda",
    data: {
      locationCode: "G300004G0281",
      severity: "alta",
      chao: "004",
      bloco: "1",
      lado: "G",
      responsible: "Carlos Silveira",
      status: "aberta",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "rec_2",
    entityId: "ent_avarias",
    locationId: "drive_G300004G0301",
    title: "Caixas rasgadas - SKU 9942",
    data: {
      locationCode: "G300004G0301",
      severity: "media",
      chao: "004",
      bloco: "1",
      lado: "G",
      responsible: "Mariana Souza",
      status: "em_analise",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// ── Modal: Novo Piso / Superfície de Apoio ───────────────────
interface NewFloorModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (
    floorName: string,
    widthM: number,
    heightM: number,
    ppm: number,
    material: FloorMaterialType
  ) => void
}

function NewFloorModal({ isOpen, onClose, onConfirm }: NewFloorModalProps) {
  const [floorName, setFloorName] = useState("Piso Concreto 1")
  const [selectedMaterial, setSelectedMaterial] = useState<FloorMaterialType>("concrete")
  const [widthM, setWidthM] = useState(100)
  const [heightM, setHeightM] = useState(60)
  const [ppm, setPpm] = useState(5)

  if (!isOpen) return null

  const handleSelectMaterial = (mat: FloorMaterialType) => {
    setSelectedMaterial(mat)
    const def = FLOOR_SURFACES[mat]
    if (floorName.startsWith("Piso") || floorName.startsWith("Área") || floorName.startsWith("Pátio")) {
      if (mat === "grass") setFloorName("Área de Grama 1")
      else if (mat === "asphalt") setFloorName("Pátio Asfalto 1")
      else if (mat === "gravel") setFloorName("Pátio Brita 1")
      else setFloorName(`${def.name} 1`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg text-slate-100 max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <span className="text-2xl">🏢</span>
          <div>
            <h2 className="text-sm font-bold">Novo Piso / Superfície de Apoio</h2>
            <p className="text-[11px] text-slate-400">
              Escolha o tipo de solo/material e configure as dimensões reais de apoio
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-white text-lg">×</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Seletor de Tipo de Superfície / Material */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Tipo de Solo / Superfície</label>
            <div className="grid grid-cols-2 gap-2">
              {FLOOR_SURFACES_LIST.map((mat) => {
                const isSelected = selectedMaterial === mat.id
                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => handleSelectMaterial(mat.id)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-slate-800 border-blue-500 text-white shadow-md ring-2 ring-blue-500/40"
                        : "bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-2xl shrink-0 mt-0.5">{mat.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-snug">{mat.name}</div>
                      <div className="text-[10px] text-slate-500 leading-tight line-clamp-2 mt-0.5">
                        {mat.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">Nome do Piso / Apoio</label>
            <input
              type="text"
              value={floorName}
              onChange={(e) => setFloorName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Largura real (m)</label>
              <input
                type="number"
                value={widthM}
                min={1}
                onChange={(e) => setWidthM(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Comprimento real (m)</label>
              <input
                type="number"
                value={heightM}
                min={1}
                onChange={(e) => setHeightM(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">
              Escala (pixels por metro) — {widthM * ppm}px × {heightM * ppm}px no canvas
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={ppm}
                onChange={(e) => setPpm(Number(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="font-mono text-sm text-blue-300 w-12 text-right">{ppm} px/m</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5">
            O piso funciona como base de apoio (<span className="text-blue-300 font-semibold">{widthM}m × {heightM}m</span>) e fica posicionado no nível inferior para suportar paletes, porta-paletes e estruturas.
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 flex gap-3 justify-end bg-slate-950/50">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200">
            Cancelar
          </button>
          <button
            onClick={() => {
              onConfirm(floorName, widthM, heightM, ppm, selectedMaterial)
              onClose()
            }}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors shadow-lg"
          >
            Criar Piso
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Props opcionais do Workspace Oficial ─────────────────────
export interface UniversalMapEditorProps {
  /** ID do workspace no service (undefined = modo Lab, sem persistência automática) */
  workspaceId?: string
  /** Nome exibido no header do editor quando no modo workspace */
  workspaceName?: string
  /** Email do usuário dono/operador (para autorização no service) */
  workspaceOwnerEmail?: string
  /** Flag de admin (para autorização no service) */
  workspaceIsAdmin?: boolean
  /** Modo somente leitura para visualizadores (bloqueia edições e salvamentos) */
  readOnly?: boolean
  /** Callback chamado após cada save bem-sucedido (para atualizar UI pai) */
  onWorkspaceSaved?: (objectsCount: number) => void
}

// ── Componente Principal ──────────────────────────────────────
export default function UniversalMapEditor({
  workspaceId,
  workspaceName,
  workspaceOwnerEmail,
  workspaceIsAdmin = false,
  readOnly = false,
  onWorkspaceSaved,
}: UniversalMapEditorProps = {}) {
  // Histórico de alterações com suporte a Desfazer / Refazer (Undo / Redo)
  const { objects, setObjects, resetHistory, undo, redo, canUndo, canRedo } = useMapHistory([])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [spatialMode, setSpatialMode] = useState<SpatialViewMode>("2d")
  const [tool, setTool] = useState<"select" | "pan" | "draw_area" | "draw_floor">("select")
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [gridSize, setGridSize] = useState(20)
  const [zoom, setZoom] = useState(100)

  // ── Workspace: estado de save & hidratação ────────────────────
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasHydratedRef = useRef(false)
  const skipNextAutoSaveRef = useRef(false)

  // Nomenclaturas Universais de Dimensões (Configuração por organização)
  const [levelsConfig, setLevelsConfig] = useState<DimensionConfig>(DEFAULT_G300_LEVELS_CONFIG)
  const [depthConfig, setDepthConfig] = useState<DimensionConfig>(DEFAULT_G300_DEPTH_CONFIG)

  // Dimensões padrão dos modelos (salvas explicitamente pelo usuário)
  const [modelDefaults, setModelDefaults] = useState<Record<string, PhysicalDimensions>>({})

  // ── Workspace: carrega mapa salvo do Supabase na montagem ─────
  useEffect(() => {
    if (!workspaceId) return
    let active = true
    hasHydratedRef.current = false

    Promise.all([
      import("@/lib/workspacesService").then(({ workspacesService }) =>
        workspacesService.fetchWorkspaceById(workspaceId)
      ),
      import("@/lib/workspaceItemsSync").then(({ hydrateWorkspaceItemsFromSupabase }) =>
        hydrateWorkspaceItemsFromSupabase(workspaceId)
      ),
    ])
      .then(([ws]) => {
        if (!active) return
        if (ws?.mapData) {
          try {
            const parsed = JSON.parse(ws.mapData)
            if (Array.isArray(parsed)) {
              skipNextAutoSaveRef.current = true
              resetHistory(parsed)
            } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.objects)) {
              skipNextAutoSaveRef.current = true
              resetHistory(parsed.objects)
              if (parsed.levelsConfig) setLevelsConfig(parsed.levelsConfig)
              if (parsed.depthConfig) setDepthConfig(parsed.depthConfig)
              if (parsed.modelDefaults && typeof parsed.modelDefaults === "object") {
                setModelDefaults(parsed.modelDefaults)
              }
            }
          } catch {
            // mapData corrompido — começa em branco
          }
        }
      })
      .finally(() => {
        if (active) {
          hasHydratedRef.current = true
        }
      })

    return () => {
      active = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const serializeMapPayload = useCallback(() => {
    return JSON.stringify({
      version: 2,
      objects,
      levelsConfig,
      depthConfig,
      modelDefaults,
    })
  }, [objects, levelsConfig, depthConfig, modelDefaults])

  // ── Workspace: auto-save com debounce após qualquer mudança (apenas editores) ──
  useEffect(() => {
    if (readOnly) return // Visualizador NUNCA sobrescreve dados
    if (!workspaceId || !workspaceOwnerEmail) return
    if (!hasHydratedRef.current) return
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false
      return
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus("saving")

    saveTimerRef.current = setTimeout(() => {
      import("@/lib/workspacesService").then(async ({ workspacesService }) => {
        const result = await workspacesService.saveMapDataAsync(
          workspaceId,
          serializeMapPayload(),
          objects.length,
          workspaceOwnerEmail,
          workspaceIsAdmin
        )
        if (result.success) {
          setSaveStatus("saved")
          onWorkspaceSaved?.(objects.length)
          setTimeout(() => setSaveStatus("idle"), 2500)
        } else {
          setSaveStatus("error")
          setTimeout(() => setSaveStatus("idle"), 4000)
        }
      })
    }, 800)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, levelsConfig, depthConfig, modelDefaults, workspaceId, workspaceOwnerEmail, workspaceIsAdmin, readOnly])

  // ── Workspace: salvar imediatamente (Ctrl+S / botão manual) ──
  const handleManualSave = useCallback(() => {
    if (readOnly) return
    if (!workspaceId || !workspaceOwnerEmail) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current) // Cancela debounce pendente
    setSaveStatus("saving")
    import("@/lib/workspacesService").then(async ({ workspacesService }) => {
      const result = await workspacesService.saveMapDataAsync(
        workspaceId,
        serializeMapPayload(),
        objects.length,
        workspaceOwnerEmail,
        workspaceIsAdmin
      )
      if (result.success) {
        setSaveStatus("saved")
        onWorkspaceSaved?.(objects.length)
        setTimeout(() => setSaveStatus("idle"), 2500)
      } else {
        setSaveStatus("error")
        setTimeout(() => setSaveStatus("idle"), 4000)
      }
    })
  }, [workspaceId, workspaceOwnerEmail, workspaceIsAdmin, objects.length, serializeMapPayload, onWorkspaceSaved, readOnly])

  // Painel esquerdo: aba ativa ("library" | "hierarchy")
  const [leftTab, setLeftTab] = useState<"library" | "hierarchy">("library")

  // Visibilidade (olhinho): toggle individual ou em massa
  const handleToggleVisibility = useCallback((id: string, visible: boolean) => {
    setObjects((prev) =>
      prev.map((obj) => (obj.id === id ? { ...obj, visible } : obj))
    )
  }, [])

  const handleToggleAllVisibility = useCallback((visible: boolean) => {
    setObjects((prev) => prev.map((obj) => ({ ...obj, visible })))
  }, [])

  // Painéis com Largura Arrastável e Colapsável (Resizable Splitters)
  const [leftWidth, setLeftWidth] = useState(290)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
  const [rightWidth, setRightWidth] = useState(330)
  const [isRightCollapsed, setIsRightCollapsed] = useState(false)

  const isResizingLeft = useRef(false)
  const isResizingRight = useRef(false)

  const handleMouseDownResizeLeft = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingLeft.current = true
    document.body.style.cursor = "col-resize"
  }

  const handleMouseDownResizeRight = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingRight.current = true
    document.body.style.cursor = "col-resize"
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft.current) {
        const newW = Math.max(220, Math.min(520, e.clientX))
        setLeftWidth(newW)
      } else if (isResizingRight.current) {
        const newW = Math.max(260, Math.min(560, window.innerWidth - e.clientX))
        setRightWidth(newW)
      }
    }

    const handleMouseUp = () => {
      if (isResizingLeft.current || isResizingRight.current) {
        isResizingLeft.current = false
        isResizingRight.current = false
        document.body.style.cursor = ""
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [])

  // Estado da Arquitetura Configurável
  const [hierarchyLevels, setHierarchyLevels] = useState<HierarchyLevel[]>(INITIAL_HIERARCHY)
  const [addressRule, setAddressRule] = useState<AddressingRuleConfig>(DEFAULT_G300_RULE)
  const [modules, setModules] = useState<BusinessModuleDefinition[]>(INITIAL_MODULES)
  const [records, setRecords] = useState<CustomEntityRecord[]>(INITIAL_RECORDS)

  // Modais
  const [isMassGenOpen, setIsMassGenOpen] = useState(false)
  const [isHierarchyOpen, setIsHierarchyOpen] = useState(false)
  const [isModuleBuilderOpen, setIsModuleBuilderOpen] = useState(false)
  const [isDimensionModalOpen, setIsDimensionModalOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNewFloorOpen, setIsNewFloorOpen] = useState(false)
  const [isResourceEngineOpen, setIsResourceEngineOpen] = useState(false)
  const [isSystemManagerOpen, setIsSystemManagerOpen] = useState(false)
  const [isSystemDataPanelOpen, setIsSystemDataPanelOpen] = useState(false)
  const [isIAMOpen, setIsIAMOpen] = useState(false)
  const [driveInModalState, setDriveInModalState] = useState<{
    isOpen: boolean
    object: MapObject | null
    channelId?: string
    initialChannelId?: string
  }>({ isOpen: false, object: null })

  // Motor de Autorização & RBAC (NEXUS IAM)
  const { can, activeUser, primaryRole, isPlatformOwner, isPlatformAdmin } = useAuthz("MAP-LAB-01")
  const canViewIAM = isPlatformOwner || isPlatformAdmin || can('workspace.manage_roles')

  // Ref para o canvas (navegação programática)
  const canvasRef = useRef<MapCanvasHandle>(null)

  const selectedObject = objects.find((o) => o.id === selectedId) || null

  // ── Salvar dimensões como padrão do modelo (ação explícita) ──
  const handleSaveAsModelDefault = useCallback((modelType: string, dims: PhysicalDimensions) => {
    setModelDefaults((prev) => ({ ...prev, [modelType]: dims }))
  }, [])

  // ── Adicionar elemento da biblioteca ────────────────────────
  const handleAddElement = useCallback(
    (elemDef: MapElementDefinition) => {
      const id = crypto.randomUUID()
      const customDefault = modelDefaults[elemDef.type]

      // Se o usuário já configurou um padrão para este modelo, usa as medidas dele
      let widthPx = elemDef.defaultWidth
      let heightPx = elemDef.defaultHeight

      if (customDefault) {
        widthPx = realToPixels(toMeters(customDefault.width, customDefault.unit), 20)
        heightPx = realToPixels(toMeters(customDefault.length, customDefault.unit), 20)
      }

      const newObj: MapObject = {
        id,
        type: elemDef.type,
        category: elemDef.category,
        x: 120 + Math.floor(Math.random() * 60),
        y: 120 + Math.floor(Math.random() * 60),
        width: widthPx,
        height: heightPx,
        rotation: 0,
        locked: false,
        visible: true,
        layerId: elemDef.category === "area" || elemDef.type.startsWith("floor_") ? "areas" : "default",
        label: elemDef.label,
        physicalDimensions: customDefault
          ? { ...customDefault }
          : ensurePhysicalDimensions({ width: widthPx, height: heightPx, category: elemDef.category }, 20),
        props: { ...elemDef.defaultProps },
      }
      // Pisos e bases de apoio vão sempre para a camada de base (fundo do canvas)
      const isFloorBase = elemDef.category === "area" || elemDef.type.startsWith("floor_")
      if (isFloorBase) {
        setObjects((prev) => [newObj, ...prev])
      } else {
        setObjects((prev) => [...prev, newObj])
      }
      setSelectedId(id)
      setTool("select")
    },
    [modelDefaults, setObjects]
  )

  // ── Adicionar objeto vindo do canvas (draw_area / draw_floor) ─
  const handleAddObject = useCallback((obj: MapObject) => {
    setObjects((prev) => [...prev, obj])
    setSelectedId(obj.id)
    setTool("select") // Volta p/ select após desenhar
  }, [])

  // ── Adicionar múltiplos objetos (Gerador em Massa / CSV) ─────
  const handleAddMassObjects = useCallback((newObjects: MapObject[]) => {
    setObjects((prev) => [...prev, ...newObjects])
    if (newObjects.length > 0) {
      setSelectedId(newObjects[0].id)
    }
  }, [])

  // ── Atualizar objeto selecionado ─────────────────────────────
  const handleUpdateObject = useCallback(
    (partial: Partial<MapObject>) => {
      if (!selectedId) return
      if (!can('object.edit', selectedId)) {
        alert(`⚠️ Ação Bloqueada por Permissão (RBAC):\nSeu papel atual (${primaryRole?.name || 'Visualizador'}) não possui a permissão 'object.edit' para modificar este objeto.`);
        return
      }
      setObjects((prev) =>
        prev.map((obj) => (obj.id === selectedId ? { ...obj, ...partial } : obj))
      )
    },
    [selectedId, can, primaryRole]
  )

  const handleUpdateObjectById = useCallback(
    (id: string, partial: Partial<MapObject>) => {
      if (!can('object.edit', id)) {
        alert(`⚠️ Ação Bloqueada por Permissão (RBAC):\nSeu papel atual (${primaryRole?.name || 'Visualizador'}) não possui a permissão 'object.edit'.`);
        return
      }
      setObjects((prev) =>
        prev.map((obj) => (obj.id === id ? { ...obj, ...partial } : obj))
      )
    },
    [can, primaryRole]
  )

  // ── Atualizar propriedade técnica parametrizada ──────────────
  const handleUpdateProp = useCallback(
    (key: string, value: unknown) => {
      if (!selectedId) return
      if (!can('object.edit', selectedId)) {
        alert(`⚠️ Ação Bloqueada por Permissão (RBAC):\nSeu papel atual (${primaryRole?.name || 'Visualizador'}) não possui a permissão 'object.edit'.`);
        return
      }
      setObjects((prev) =>
        prev.map((obj) => {
          if (obj.id !== selectedId) return obj
          return { ...obj, props: { ...obj.props, [key]: value } }
        })
      )
    },
    [selectedId, can, primaryRole]
  )

  // ── Adicionar registro vinculado ─────────────────────────────
  const handleAddRecord = useCallback((recordPartial: Partial<CustomEntityRecord>) => {
    const newRecord: CustomEntityRecord = {
      id: `rec_${crypto.randomUUID().slice(0, 8)}`,
      entityId: recordPartial.entityId || "ent_avarias",
      locationId: recordPartial.locationId,
      title: recordPartial.title || "Nova Ocorrência",
      data: recordPartial.data || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setRecords((prev) => [newRecord, ...prev])
  }, [])

  // ── Salvar Módulo atualizado pelo Construtor ─────────────────
  const handleSaveModule = useCallback((updatedModule: BusinessModuleDefinition) => {
    setModules((prev) =>
      prev.map((m) => (m.id === updatedModule.id ? updatedModule : m))
    )
  }, [])

  // ── Duplicar objeto ──────────────────────────────────────────
  const handleDuplicate = useCallback(() => {
    if (!selectedObject) return
    if (!can('object.create')) {
      alert(`⚠️ Ação Bloqueada por Permissão (RBAC):\nSeu papel atual (${primaryRole?.name || 'Sem Papel'}) não possui permissão 'object.create' para criar ou duplicar objetos.`);
      return
    }
    const newId = crypto.randomUUID()
    const cloned: MapObject = {
      ...selectedObject,
      id: newId,
      x: selectedObject.x + 30,
      y: selectedObject.y + 30,
      label: `${selectedObject.label || selectedObject.type} (Cópia)`,
      props: { ...selectedObject.props },
      points: selectedObject.points ? [...selectedObject.points] : undefined,
    }
    setObjects((prev) => [...prev, cloned])
    setSelectedId(newId)
  }, [selectedObject, can, primaryRole])

  // ── Excluir objeto ───────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!selectedId) return
    if (!can('object.delete', selectedId)) {
      alert(`⚠️ Ação Bloqueada por Permissão (RBAC):\nSeu papel atual (${primaryRole?.name || 'Sem Papel'}) não possui permissão 'object.delete' para remover objetos.`);
      return
    }
    setObjects((prev) => prev.filter((o) => o.id !== selectedId))
    setSelectedId(null)
  }, [selectedId, can, primaryRole])

  // ── Ordenação de Camadas ─────────────────────────────────────
  const handleBringForward = useCallback(() => {
    if (!selectedId) return
    setObjects((prev) => {
      const idx = prev.findIndex((o) => o.id === selectedId)
      if (idx === -1 || idx === prev.length - 1) return prev
      const copy = [...prev]
      const [item] = copy.splice(idx, 1)
      copy.splice(idx + 1, 0, item)
      return copy
    })
  }, [selectedId])

  const handleSendBackward = useCallback(() => {
    if (!selectedId) return
    setObjects((prev) => {
      const idx = prev.findIndex((o) => o.id === selectedId)
      if (idx <= 0) return prev
      const copy = [...prev]
      const [item] = copy.splice(idx, 1)
      copy.splice(idx - 1, 0, item)
      return copy
    })
  }, [selectedId])

  // ── Seleção Geral e de Canal Individual ──────────────────────
  const handleSelect = useCallback((id: string | null, channelId?: string | null) => {
    setSelectedId(id)
    setSelectedChannelId(channelId ?? null)
  }, [])

  // ── Busca Universal: Localizar e Navegar ─────────────────────
  const handleSelectAndLocate = useCallback((obj: MapObject, channelId?: string | null) => {
    setSelectedId(obj.id)
    setSelectedChannelId(channelId ?? null)
    setIsSearchOpen(false)
    // Aguarda frame para o canvas ter o nó renderizado
    requestAnimationFrame(() => {
      canvasRef.current?.navigateTo(obj)
    })
  }, [])

  const handleLocateById = useCallback((objId: string) => {
    const found = objects.find((o) => o.id === objId)
    if (found) {
      handleSelectAndLocate(found)
    }
  }, [objects, handleSelectAndLocate])

  // ── Criar Novo Piso / Apoio ──────────────────────────────────
  const handleCreateFloor = useCallback(
    (
      floorName: string,
      widthM: number,
      heightM: number,
      ppm: number,
      material: FloorMaterialType = "concrete"
    ) => {
      const surface = FLOOR_SURFACES[material] || FLOOR_SURFACES.concrete
      const id = `floor_${crypto.randomUUID().slice(0, 8)}`
      const widthPx = widthM * ppm
      const heightPx = heightM * ppm

      const floorObj: MapObject = {
        id,
        type: "floor",
        category: "area",
        x: 60,
        y: 60,
        width: widthPx,
        height: heightPx,
        rotation: 0,
        locked: false,
        visible: true,
        layerId: "areas",
        label: floorName,
        classification: material === "grass" ? "grama" : material === "asphalt" ? "asfalto" : "piso_geral",
        color: surface.color,
        strokeColor: surface.strokeColor,
        opacity: surface.opacity,
        props: {
          realWidthM: widthM,
          realHeightM: heightM,
          pixelsPerMeter: ppm,
          floorName,
          floorMaterial: material,
        },
      }
      setObjects((prev) => [floorObj, ...prev]) // Piso vai para a base (fundo)
      setSelectedId(id)
    },
    []
  )

  // ── Template de Exemplo ──────────────────────────────────────
  const handleLoadTemplate = useCallback(() => {
    const demo: MapObject[] = [
      // Piso do galpão
      {
        id: "floor_g300",
        type: "floor",
        category: "area",
        x: 40,
        y: 30,
        width: 920,
        height: 640,
        rotation: 0,
        locked: true,
        visible: true,
        layerId: "areas",
        label: "Galpão G300",
        classification: "piso_geral",
        color: "rgba(30,41,59,0.3)",
        strokeColor: "#334155",
        opacity: 1,
        props: { realWidthM: 46, realHeightM: 32, pixelsPerMeter: 20, floorName: "Galpão G300" },
      },
      // Área de avarias
      {
        id: "area_avarias",
        type: "custom_area",
        category: "area",
        x: 60,
        y: 50,
        width: 480,
        height: 580,
        rotation: 0,
        locked: false,
        visible: true,
        layerId: "areas",
        label: "ÁREA DE AVARIAS G300",
        classification: "area_avarias",
        color: "rgba(245,158,11,0.10)",
        strokeColor: "#f59e0b",
        opacity: 1,
        parentId: "floor_g300",
        operationalSituation: "ativa",
        responsible: "Supervisão G300",
        restrictions: "Acesso restrito a conferentes e operadores de retrabalho",
        props: {},
      },
      // Corredor
      {
        id: "area_corredor",
        type: "custom_area",
        category: "area",
        x: 220,
        y: 50,
        width: 60,
        height: 580,
        rotation: 0,
        locked: false,
        visible: true,
        layerId: "areas",
        label: "CORREDOR PRINCIPAL",
        classification: "circulacao",
        color: "rgba(56,189,248,0.07)",
        strokeColor: "#38bdf8",
        opacity: 1,
        parentId: "area_avarias",
        props: {},
      },
      // Parede Norte
      {
        id: "w1",
        type: "wall",
        category: "architectural",
        x: 60,
        y: 40,
        width: 860,
        height: 14,
        rotation: 0,
        locked: true,
        visible: true,
        layerId: "arch",
        label: "Parede Norte G300",
        props: { thickness: 14 },
      },
      // Doca
      {
        id: "d1",
        type: "gate",
        category: "architectural",
        x: 100,
        y: 35,
        width: 100,
        height: 24,
        rotation: 0,
        locked: false,
        visible: true,
        layerId: "arch",
        label: "DOCA 01 - AVARIAS",
        props: { type: "dock" },
      },
      // ── BLOCO 01: Delimitação de Bloco Físico que agrupa os Drives ───
      {
        id: "bloco_01",
        type: "custom_area",
        category: "area",
        x: 80,
        y: 145,
        width: 100,
        height: 340,
        rotation: 0,
        locked: false,
        visible: true,
        layerId: "areas",
        label: "BLOCO 01 - DRIVE-IN",
        classification: "bloco",
        color: "rgba(99, 102, 241, 0.08)",
        strokeColor: "#6366f1",
        opacity: 1,
        parentId: "area_avarias",
        operationalSituation: "ativa",
        responsible: "Líder de Bloco G300",
        restrictions: "Tráfego exclusivo de empilhadeiras em operação de armazenagem",
        props: { blocoCode: "B01" },
      },
      // ── RUA 01: Corredor de Acesso dos Drives-In ─────────────
      // Rua: faixa de circulação 50px larg. dentro do Bloco 01
      {
        id: "rua_01",
        type: "custom_area",
        category: "area",
        x: 85,
        y: 150,
        width: 90,
        height: 330,
        rotation: 0,
        locked: false,
        visible: true,
        layerId: "areas",
        label: "Rua 01",
        classification: "rua",
        color: "rgba(15, 23, 42, 0.45)",
        strokeColor: "#eab308",
        opacity: 1,
        parentId: "bloco_01",
        props: { identifier: "RUA-01", blocoCode: "B01" },
      },
      // ── DRIVES: cada drive tem width/height calculados pela física do pallet ──
      // Escala: 20px = 1m
      // PBR 1: 1.00m × 1.20m | folga profundidade: 0.12m | entrada: 0.20m | trilhos: 0.40m
      // slot_h = (1.20+0.12) × 20 = 26.4px ≈ 26px | lane_w = (1.00+0.40) × 20 = 28px
      //
      // Drive 1 — G300004G0281 — 4N × 4P = 16 pallets (Canal MKLOG)
      {
        id: "drive_G300004G0281",
        type: "drive_in", category: "storage",
        x: 100, y: 170,
        width: 28, height: 110,
        rotation: 0, locked: false, visible: true, layerId: "storage",
        label: "G300004G0281",
        props: {
          code: "G300004G0281", chao: "004", bloco: "1", lado: "G",
          levels: 4, depth: 4, capacity: 16, currentOccupancy: 12,
          status: "operacional", lanes: 1, palletModel: "pbr1",
          streetId: "rua_01", streetName: "Rua 01",
          channels: [
            {
              id: "chan_G300004G0281_1",
              code: "G300004G0281-C01",
              name: "Canal MKLOG",
              driveId: "drive_G300004G0281",
              laneIndex: 1,
              levels: 4,
              depth: 4,
              capacity: 16,
              occupancy: 12,
              status: "operacional",
            },
          ],
        },
      },
      // Drive 2 — G300004G0301 — 4N × 5P = 20 pallets (Canal Jaqueline)
      {
        id: "drive_G300004G0301",
        type: "drive_in", category: "storage",
        x: 136, y: 170,
        width: 28, height: 134,
        rotation: 0, locked: false, visible: true, layerId: "storage",
        label: "G300004G0301",
        props: {
          code: "G300004G0301", chao: "004", bloco: "1", lado: "G",
          levels: 4, depth: 5, capacity: 20, currentOccupancy: 19,
          status: "operacional", lanes: 1, palletModel: "pbr1",
          streetId: "rua_01", streetName: "Rua 01",
          channels: [
            {
              id: "chan_G300004G0301_1",
              code: "G300004G0301-C01",
              name: "Canal Jaqueline",
              driveId: "drive_G300004G0301",
              laneIndex: 1,
              levels: 4,
              depth: 5,
              capacity: 20,
              occupancy: 19,
              status: "operacional",
            },
          ],
        },
      },
      // Drive 3 — G300003G0281 — 5N × 6P = 30 pallets (Canal Produtos Gerais)
      {
        id: "drive_G300003G0281",
        type: "drive_in", category: "storage",
        x: 100, y: 310,
        width: 28, height: 160,
        rotation: 0, locked: false, visible: true, layerId: "storage",
        label: "G300003G0281",
        props: {
          code: "G300003G0281", chao: "003", bloco: "1", lado: "G",
          levels: 5, depth: 6, capacity: 30, currentOccupancy: 24,
          status: "operacional", lanes: 1, palletModel: "pbr1",
          streetId: "rua_01", streetName: "Rua 01",
          channels: [
            {
              id: "chan_G300003G0281_1",
              code: "G300003G0281-C01",
              name: "Canal Produtos Gerais",
              driveId: "drive_G300003G0281",
              laneIndex: 1,
              levels: 5,
              depth: 6,
              capacity: 30,
              occupancy: 24,
              status: "operacional",
            },
          ],
        },
      },
      // Drive 4 — G300002G0281 — 3N × 4P = 12 pallets (Canal Quarentena)
      {
        id: "drive_G300002G0281",
        type: "drive_in", category: "storage",
        x: 136, y: 350,
        width: 28, height: 110,
        rotation: 0, locked: false, visible: true, layerId: "storage",
        label: "G300002G0281",
        props: {
          code: "G300002G0281", chao: "002", bloco: "1", lado: "G",
          levels: 3, depth: 4, capacity: 12, currentOccupancy: 0,
          status: "bloqueado", lanes: 1, palletModel: "pbr1",
          streetId: "rua_01", streetName: "Rua 01",
          channels: [
            {
              id: "chan_G300002G0281_1",
              code: "G300002G0281-C01",
              name: "Canal Quarentena",
              driveId: "drive_G300002G0281",
              laneIndex: 1,
              levels: 3,
              depth: 4,
              capacity: 12,
              occupancy: 0,
              status: "bloqueado",
            },
          ],
        },
      },
      // ── CORREDOR entre drives e equipamentos ──────────────────
      // Corredor com 2.0m = 40px de largura para a empilhadeira manobrar
      // ── EQUIPAMENTOS em escala real ─────────────────────────
      // Humano: 0.60m×0.40m (vista de topo) = 12px×8px  — referência de escala
      {
        id: "human_op1",
        type: "human_operator", category: "equipment",
        x: 180, y: 194,
        width: 12, height: 8,
        rotation: 0, locked: false, visible: true, layerId: "equip",
        label: "Operador Humano",
        props: { role: "operador", helmetColor: "#facc15" },
      },
      // Paleteira Manual: 0.70m×1.55m = 14px×31px
      {
        id: "pal_jack1",
        type: "pallet_jack", category: "equipment",
        x: 180, y: 210,
        width: 14, height: 31,
        rotation: 0, locked: false, visible: true, layerId: "equip",
        label: "Paleteira PAL-01",
        props: { type: "manual" },
      },
      // Empilhadeira: 1.20m×2.80m = 24px×56px
      {
        id: "eq1",
        type: "forklift", category: "equipment",
        x: 176, y: 300,
        width: 24, height: 56,
        rotation: 0, locked: false, visible: true, layerId: "equip",
        label: "EMP-04",
        props: { capacity_t: 2.5 },
      },
      // Indicador de Norte
      {
        id: "no1",
        type: "north_indicator", category: "orientation",
        x: 900, y: 50,
        width: 44, height: 44,
        rotation: 0, locked: false, visible: true, layerId: "orient",
        label: "Norte", props: {},
      },
    ]

    resetHistory(demo)
    setSelectedId("drive_G300004G0281")
    requestAnimationFrame(() => {
      setTimeout(() => {
        canvasRef.current?.fitToScreen()
      }, 80)
    })
  }, [resetHistory])

  // ── Auto-carregar demonstração com proporções reais na montagem inicial ─
  const hasInitialized = useRef(false)
  useEffect(() => {
    if (!hasInitialized.current && objects.length === 0) {
      hasInitialized.current = true
      handleLoadTemplate()
    }
  }, [handleLoadTemplate, objects.length])

  // ── Atalhos de Teclado ───────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return

      if (readOnly) {
        if (e.key === "v" || e.key === "V") setTool("select")
        if (e.key === "h" || e.key === "H") setTool("pan")
        if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
          e.preventDefault()
          setIsSearchOpen((v) => !v)
        }
        return
      }

      if (e.key === "v" || e.key === "V") setTool("select")
      if (e.key === "h" || e.key === "H") setTool("pan")
      if (e.key === "a" || e.key === "A") setTool("draw_area")
      if (e.key === "Delete" || e.key === "Backspace") handleDelete()
      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault()
        handleDuplicate()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && ((e.key === "y" || e.key === "Y") || (e.shiftKey && (e.key === "z" || e.key === "Z")))) {
        e.preventDefault()
        redo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        setIsSearchOpen((v) => !v)
      }
      // Ctrl+S → salva imediatamente (só no modo workspace)
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault()
        handleManualSave()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleDelete, handleDuplicate, handleManualSave, readOnly, undo, redo])

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 overflow-hidden">
      {/* Barra de Ferramentas Superior */}
      <MapToolbar
        tool={tool}
        snapEnabled={snapEnabled}
        gridSize={gridSize}
        zoom={zoom}
        objectsCount={objects.length}
        spatialMode={spatialMode}
        readOnly={readOnly}
        onSpatialModeChange={setSpatialMode}
        onToolChange={setTool}
        onToggleSnap={() => setSnapEnabled((v) => !v)}
        onGridSizeChange={setGridSize}
        onZoomIn={() => setZoom((z) => Math.min(z + 15, 400))}
        onZoomOut={() => setZoom((z) => Math.max(z - 15, 20))}
        onZoomReset={() => setZoom(100)}
        onFitToScreen={() => canvasRef.current?.fitToScreen()}
        onClear={() => { resetHistory([]); setSelectedId(null) }}
        onLoadTemplate={handleLoadTemplate}
        onOpenMassGenerator={() => setIsMassGenOpen(true)}
        onOpenHierarchyConfig={() => setIsHierarchyOpen(true)}
        onOpenModuleBuilder={() => setIsModuleBuilderOpen(true)}
        onOpenDimensionConfig={() => setIsDimensionModalOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNewFloor={() => setIsNewFloorOpen(true)}
        onOpenResourceEngine={() => setIsResourceEngineOpen(true)}
        onOpenSystemManager={() => setIsSystemManagerOpen(true)}
        onOpenIAM={canViewIAM ? () => setIsIAMOpen(true) : undefined}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />

      {/* Barra de contexto do Workspace (Save status OU Banner de Visualizador) */}
      {workspaceId && (
        readOnly ? (
          <div className="shrink-0 flex items-center gap-3 px-4 py-1.5 border-b border-indigo-900/60 bg-indigo-950/40 text-[11px] backdrop-blur">
            <span className="flex items-center gap-1.5 text-indigo-400 font-bold uppercase tracking-wider bg-indigo-900/50 px-2 py-0.5 rounded-md border border-indigo-700/50">
              <span>👁️</span>
              <span>Modo Visualizador</span>
            </span>
            <span className="text-slate-400">
              Navegação livre e inspeção (2D, 3D e Isométrico) · Alterações bloqueadas
            </span>
            <span className="text-slate-600">· {objects.length} objetos</span>
            <div className="ml-auto flex items-center gap-2">
              {/* Botão de dados — disponível para ADMs no modo visualizador */}
              {workspaceIsAdmin && (
                <button
                  onClick={() => setIsSystemDataPanelOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-600 text-white shadow transition-all"
                  title="Gerenciar dados dos sistemas (Registros, Mapeamento, Confronto)"
                >
                  🗂️ Gerenciar Dados
                </button>
              )}
              <span className="text-slate-500 text-[10px]">
                Workspace: <strong className="text-slate-300">{workspaceName || workspaceId}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="shrink-0 flex items-center gap-3 px-4 py-1 border-b border-slate-800 bg-slate-900/60 text-[11px]">
            <span className="text-slate-500">Workspace:</span>
            <span className="font-semibold text-amber-400 truncate max-w-xs">{workspaceName || workspaceId}</span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-600">{objects.length} objetos</span>

            <div className="ml-auto flex items-center gap-3">
              {/* Status de save */}
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="inline-block w-3 h-3 border-2 border-slate-500 border-t-slate-200 rounded-full animate-spin" />
                  Salvando...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  ✓ Salvo
                </span>
              )}
              {saveStatus === "error" && (
                <span className="flex items-center gap-1.5 text-red-400">
                  ⚠ Erro ao salvar
                </span>
              )}

              {/* Botão salvar manual */}
              <button
                onClick={handleManualSave}
                disabled={saveStatus === "saving"}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold transition-colors"
                title="Salvar agora (Ctrl+S)"
              >
                💾 Salvar
                <kbd className="text-[9px] opacity-60 font-mono ml-0.5">Ctrl+S</kbd>
              </button>
            </div>
          </div>
        )
      )}

      {/* Dica contextual do modo draw_area */}
      {!readOnly && (tool === "draw_area" || tool === "draw_floor") && (
        <div className="bg-amber-950/70 border-b border-amber-800/50 px-4 py-1.5 flex items-center gap-3 text-amber-200 text-xs shrink-0">
          <span className="text-sm">📐</span>
          <span>
            <strong>Modo Desenho Livre:</strong> Clique para adicionar vértices · Duplo-clique ou
            retorne ao primeiro ponto (círculo verde) para fechar · <kbd className="bg-amber-900/80 px-1 rounded">Esc</kbd> cancela
          </span>
        </div>
      )}

      {/* Área Central com Splitters Arrastáveis e Painéis Colapsáveis */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Botão flutuante para reabrir painel esquerdo quando recolhido */}
        {isLeftCollapsed && (
          <button
            onClick={() => setIsLeftCollapsed(false)}
            className="absolute left-2 top-3 z-30 bg-slate-900 hover:bg-slate-800 text-slate-300 p-1.5 rounded-lg border border-slate-700 shadow-xl text-xs flex items-center gap-1 transition-all"
            title="Expandir Biblioteca (Ctrl+B)"
          >
            <span>▶</span>
            <span className="text-[10px] font-bold">Biblioteca</span>
          </button>
        )}

        {/* Painel Esquerdo: ViewerNavigationSidebar no modo visualizador, ou Biblioteca + Hierarquia no modo editor */}
        <div
          style={{ width: isLeftCollapsed ? 0 : leftWidth }}
          className={`flex flex-col bg-slate-900 border-r border-slate-800 shrink-0 overflow-hidden transition-[width] duration-150 relative ${
            isLeftCollapsed ? "invisible" : "visible"
          }`}
        >
          {/* Botão para recolher no topo do painel esquerdo */}
          <div className="h-6 bg-slate-950 px-2 flex items-center justify-between border-b border-slate-800 text-[10px] text-slate-500">
            <span>{readOnly ? "NAVEGAÇÃO & INSPEÇÃO" : "PAINEL LATERAL"}</span>
            <button
              onClick={() => setIsLeftCollapsed(true)}
              className="text-slate-400 hover:text-white px-1 py-0.5 rounded hover:bg-slate-800"
              title="Recolher painel esquerdo"
            >
              ◀ Ocultar
            </button>
          </div>

          {readOnly ? (
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              <ViewerNavigationSidebar
                objects={objects}
                selectedId={selectedId}
                selectedChannelId={selectedChannelId}
                onSelectAndLocate={handleSelectAndLocate}
                onSelectChannel={(obj, chanId) => handleSelect(obj.id, chanId)}
                onToggleVisibility={handleToggleVisibility}
                onToggleAllVisibility={handleToggleAllVisibility}
                onOpenDriveInGrid={(obj, chanId) =>
                  setDriveInModalState({ isOpen: true, object: obj, initialChannelId: chanId })
                }
              />
            </div>
          ) : (
            <>
              {/* ── Abas: Biblioteca ↔ Hierarquia ─────────────────── */}
              <div className="flex border-b border-slate-800 bg-slate-950 shrink-0">
                <button
                  onClick={() => setLeftTab("library")}
                  className={`flex-1 h-8 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                    leftTab === "library"
                      ? "border-blue-500 text-blue-400 bg-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/60"
                  }`}
                  title="Biblioteca de Elementos"
                >
                  📚 Biblioteca
                </button>
                <button
                  onClick={() => setLeftTab("hierarchy")}
                  className={`flex-1 h-8 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                    leftTab === "hierarchy"
                      ? "border-amber-500 text-amber-400 bg-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/60"
                  }`}
                  title="Hierarquia Estrutural do Mapa"
                >
                  🌳 Hierarquia
                  {objects.filter((o) => o.visible === false).length > 0 && (
                    <span className="text-[9px] bg-red-900/80 text-red-400 border border-red-700/50 px-1 rounded-full">
                      {objects.filter((o) => o.visible === false).length}
                    </span>
                  )}
                </button>
              </div>

              {/* Conteúdo da aba ativa — ocupa todo o espaço restante */}
              <div className="flex-1 overflow-hidden min-h-0">
                {leftTab === "library" ? (
                  <MapLibraryPanel onAddElement={handleAddElement} />
                ) : (
                  <AreaHierarchyPanel
                    objects={objects}
                    selectedId={selectedId}
                    onSelectAndLocate={handleSelectAndLocate}
                    onToggleVisibility={handleToggleVisibility}
                    onToggleAllVisibility={handleToggleAllVisibility}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Splitter arrastável da Esquerda */}
        {!isLeftCollapsed && (
          <div
            onMouseDown={handleMouseDownResizeLeft}
            className="w-1.5 hover:w-2 bg-slate-950 hover:bg-blue-500 cursor-col-resize transition-all z-20 shrink-0 border-r border-slate-800/80 group flex items-center justify-center"
            title="Arraste para redimensionar a largura do painel esquerdo"
          >
            <div className="h-8 w-0.5 bg-slate-700 group-hover:bg-white rounded-full" />
          </div>
        )}

        {/* Renderizador Espacial Universal: 2D Konva ou 3D Three.js (Isométrico / 3D Livre) */}
        {spatialMode === "2d" ? (
          <MapCanvasContainer
            ref={canvasRef}
            objects={objects}
            selectedId={selectedId}
            selectedChannelId={selectedChannelId}
            snapEnabled={snapEnabled}
            gridSize={gridSize}
            zoom={zoom}
            tool={tool}
            readOnly={readOnly}
            onToolChange={setTool}
            onSelect={handleSelect}
            onUpdateObject={handleUpdateObjectById}
            onZoomChange={setZoom}
            onAddObject={handleAddObject}
          />
        ) : (
          <SpatialViewer3D
            mode={spatialMode}
            objects={objects}
            selectedId={selectedId}
            snapEnabled={snapEnabled}
            gridSize={gridSize}
            onSelect={handleSelect}
            onUpdateObject={handleUpdateObjectById}
            onModeChange={setSpatialMode}
          />
        )}

        {/* Pill Flutuante de Acesso Rápido (Modo Visualizador) */}
        {readOnly && selectedObject && (selectedObject.type === "drive_in" || selectedObject.category === "storage") && (() => {
          if (selectedObject.type === "compartment") {
            const compLabel = String(selectedObject.props?.label || selectedObject.label || selectedObject.id)
            return (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border border-amber-500/80 shadow-2xl rounded-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">📦</span>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {compLabel}
                    </span>
                    <span className="text-[10px] text-amber-300/90 font-mono">
                      Armazenamento Aberto · Sem nível / profundidade
                    </span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setDriveInModalState({
                      isOpen: true,
                      object: selectedObject,
                    })
                  }
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Abrir Relação</span>
                  <span>→</span>
                </button>
              </div>
            )
          }

          const channels = ensureDriveChannels(selectedObject)
          const currentChannel = selectedChannelId
            ? channels.find((c) => c.id === selectedChannelId || c.code === selectedChannelId) || channels[0]
            : channels[0]
          const chanTitle = currentChannel?.name || currentChannel?.code || selectedObject.label || selectedObject.id
          const chanCap = currentChannel?.capacity || Number(selectedObject.props?.capacity) || 16

          return (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border border-blue-500/80 shadow-2xl rounded-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2">
                <span className="text-base">📥</span>
                <div>
                  <span className="text-xs font-bold text-white block">
                    {chanTitle}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {chanCap} Paletes · {selectedObject.label || selectedObject.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() =>
                  setDriveInModalState({
                    isOpen: true,
                    object: selectedObject,
                    initialChannelId: currentChannel?.code || currentChannel?.id,
                  })
                }
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <span>Abrir Grid do Canal (G300)</span>
                <span>→</span>
              </button>
            </div>
          )
        })()}

        {/* Splitter arrastável da Direita (Apenas no Modo Editor) */}
        {!readOnly && !isRightCollapsed && (
          <div
            onMouseDown={handleMouseDownResizeRight}
            className="w-1.5 hover:w-2 bg-slate-950 hover:bg-blue-500 cursor-col-resize transition-all z-20 shrink-0 border-l border-slate-800/80 group flex items-center justify-center"
            title="Arraste para redimensionar a largura do painel direito"
          >
            <div className="h-8 w-0.5 bg-slate-700 group-hover:bg-white rounded-full" />
          </div>
        )}

        {/* Botão flutuante para reabrir painel direito quando recolhido (Apenas no Modo Editor) */}
        {!readOnly && isRightCollapsed && (
          <button
            onClick={() => setIsRightCollapsed(false)}
            className="absolute right-2 top-3 z-30 bg-slate-900 hover:bg-slate-800 text-slate-300 p-1.5 rounded-lg border border-slate-700 shadow-xl text-xs flex items-center gap-1 transition-all"
            title="Expandir Propriedades"
          >
            <span className="text-[10px] font-bold">Propriedades</span>
            <span>◀</span>
          </button>
        )}

        {/* Painel de Propriedades (Apenas no Modo Editor) */}
        {!readOnly && (
          <div
            style={{ width: isRightCollapsed ? 0 : rightWidth }}
            className={`flex flex-col bg-slate-900 border-l border-slate-800 shrink-0 overflow-hidden transition-[width] duration-150 relative ${
              isRightCollapsed ? "invisible" : "visible"
            }`}
          >
            {/* Botão para recolher no topo do painel direito */}
            <div className="h-6 bg-slate-950 px-2 flex items-center justify-between border-b border-slate-800 text-[10px] text-slate-500 shrink-0">
              <span>PROPRIEDADES & OPERAÇÃO</span>
              <button
                onClick={() => setIsRightCollapsed(true)}
                className="text-slate-400 hover:text-white px-1 py-0.5 rounded hover:bg-slate-800"
                title="Recolher painel direito"
              >
                Ocultar ▶
              </button>
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
              <MapPropertiesPanel
                selectedObject={selectedObject}
                selectedChannelId={selectedChannelId}
                onUpdateObject={handleUpdateObject}
                onUpdateProp={handleUpdateProp}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onBringForward={handleBringForward}
                onSendBackward={handleSendBackward}
                records={records}
                onAddRecord={handleAddRecord}
                allObjects={objects}
                levelsConfig={levelsConfig}
                depthConfig={depthConfig}
                pixelsPerMeter={20}
                onSaveAsModelDefault={handleSaveAsModelDefault}
                onOpenResourceEngine={() => setIsResourceEngineOpen(true)}
                workspaceId={workspaceId}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modais */}
      <UniversalSearchSpotlight
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        objects={objects}
        onSelectAndLocate={handleSelectAndLocate}
      />

      <NewFloorModal
        isOpen={isNewFloorOpen}
        onClose={() => setIsNewFloorOpen(false)}
        onConfirm={handleCreateFloor}
      />

      <MassGeneratorModal
        isOpen={isMassGenOpen}
        onClose={() => setIsMassGenOpen(false)}
        onAddObjects={handleAddMassObjects}
      />

      <HierarchyConfigModal
        isOpen={isHierarchyOpen}
        onClose={() => setIsHierarchyOpen(false)}
        hierarchy={hierarchyLevels}
        addressRule={addressRule}
        onSaveHierarchy={setHierarchyLevels}
        onSaveAddressRule={setAddressRule}
      />

      <ModuleBuilderModal
        isOpen={isModuleBuilderOpen}
        onClose={() => setIsModuleBuilderOpen(false)}
        modules={modules}
        onSaveModule={handleSaveModule}
      />

      <DimensionConfigModal
        isOpen={isDimensionModalOpen}
        onClose={() => setIsDimensionModalOpen(false)}
        levelsConfig={levelsConfig}
        depthConfig={depthConfig}
        onSaveLevelsConfig={setLevelsConfig}
        onSaveDepthConfig={setDepthConfig}
      />

      {/* Modal do Motor Universal de Recursos */}
      <ResourceEngineModal
        isOpen={isResourceEngineOpen}
        onClose={() => setIsResourceEngineOpen(false)}
        allObjects={objects}
        onLocateObject={handleLocateById}
      />

      {/* Modal de Sistemas de Saldo — apenas no Modo Edição (configuração de estrutura) */}
      {!readOnly && (
        <SystemManagerModal
          isOpen={isSystemManagerOpen}
          onClose={() => setIsSystemManagerOpen(false)}
          allObjects={objects}
          workspaceId={workspaceId}
        />
      )}

      {/* Painel de Dados dos Sistemas — apenas no Modo Visualização para ADMs */}
      {readOnly && (
        <SystemDataPanel
          isOpen={isSystemDataPanelOpen}
          onClose={() => setIsSystemDataPanelOpen(false)}
          allObjects={objects}
          workspaceId={workspaceId}
          levelsConfig={levelsConfig}
          depthConfig={depthConfig}
        />
      )}

      {/* Modal Drive-In Grid Oficial / Relação de Compartimento (Modo Visualizador) */}
      <ViewerDriveInModal
        isOpen={driveInModalState.isOpen}
        onClose={() => setDriveInModalState({ isOpen: false, object: null })}
        object={driveInModalState.object}
        initialChannelId={driveInModalState.initialChannelId || driveInModalState.channelId}
        isAdmin={workspaceIsAdmin}
        workspaceId={workspaceId}
        allObjects={objects}
        levelsConfig={levelsConfig}
        depthConfig={depthConfig}
      />

      {/* Modal da Central de Identidade, Papéis e Permissões (NEXUS IAM) */}
      <AdminCenterModal
        isOpen={isIAMOpen}
        onClose={() => setIsIAMOpen(false)}
        currentMapId="MAP-LAB-01"
      />
    </div>
  )
}
