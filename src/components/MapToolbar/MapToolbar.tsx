// ============================================================
// NEXUS ERP — MapToolbar / MapToolbar.tsx
// Barra de ferramentas superior do editor de mapeamento
// ============================================================

"use client"

import React, { useState, useRef, useEffect } from "react"
import {
  Camera,
  MoreVertical,
  ChevronDown,
  Check,
  Hand,
  MousePointerClick,
  Maximize2,
  Edit3,
  Search,
  Eye,
  Compass,
  Map as MapIcon,
  Box,
  Layers,
  Database,
} from "lucide-react"
import type { SpatialViewMode } from "../Map3D/types"
import type { MapObject } from "../MapLibrary/types"
import type { BusinessSystem } from "../Systems/types"
import { getLinkedStructuresForSystem, isOpenSystem } from "@/lib/systemVisuals"

interface MapToolbarProps {
  tool: "select" | "pan" | "draw_area" | "draw_floor"
  snapEnabled: boolean
  gridSize: number
  zoom: number
  objectsCount: number
  spatialMode?: SpatialViewMode
  readOnly?: boolean
  canEnableEditMode?: boolean
  onEnableEditMode?: () => void
  onOpenSystemDataPanel?: () => void
  onSpatialModeChange?: (mode: SpatialViewMode) => void
  systems?: BusinessSystem[]
  objects?: MapObject[]
  activeSystemFilterId?: string | null
  onSelectSystemFilter?: (systemId: string | null) => void
  onToolChange: (tool: "select" | "pan" | "draw_area" | "draw_floor") => void
  onToggleSnap: () => void
  onGridSizeChange: (size: number) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onFitToScreen?: () => void
  onClear: () => void
  onLoadTemplate: () => void
  onOpenMassGenerator: () => void
  onOpenHierarchyConfig: () => void
  onOpenModuleBuilder: () => void
  onOpenDimensionConfig: () => void
  onOpenSearch: () => void
  onOpenNewFloor: () => void
  onOpenResourceEngine?: () => void
  onOpenSystemManager?: () => void
  onOpenIAM?: () => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
}

const VIEWER_CAMERA_MODES: Array<{
  id: SpatialViewMode
  label: string
  description: string
  badgeClass: string
  icon: "birdseye" | "fulltop" | "3d" | "2d"
}> = [
  {
    id: "birdseye",
    label: "Bird's-Eye 3D",
    description: "Ortográfica superior com inclinação de 20°",
    badgeClass: "text-emerald-400 bg-emerald-950/60 border-emerald-700/50",
    icon: "birdseye",
  },
  {
    id: "fulltop",
    label: "Full Top",
    description: "Visão ortográfica vertical a 90°",
    badgeClass: "text-sky-400 bg-sky-950/60 border-sky-700/50",
    icon: "fulltop",
  },
  {
    id: "3d",
    label: "3D Livre",
    description: "Câmera perspectiva com órbita 360°",
    badgeClass: "text-purple-400 bg-purple-950/60 border-purple-700/50",
    icon: "3d",
  },
  {
    id: "2d",
    label: "Planta 2D",
    description: "Visualização plana vetorial",
    badgeClass: "text-blue-400 bg-blue-950/60 border-blue-700/50",
    icon: "2d",
  },
]

function renderCameraModeIcon(kind: "birdseye" | "fulltop" | "3d" | "2d") {
  if (kind === "birdseye") return <Compass size={14} className="text-emerald-400 shrink-0" />
  if (kind === "fulltop") return <MapIcon size={14} className="text-sky-400 shrink-0" />
  if (kind === "3d") return <Box size={14} className="text-purple-400 shrink-0" />
  return <Layers size={14} className="text-blue-400 shrink-0" />
}

export default function MapToolbar({
  tool,
  snapEnabled,
  gridSize,
  zoom,
  objectsCount,
  spatialMode = "2d",
  readOnly = false,
  canEnableEditMode = false,
  onEnableEditMode,
  onOpenSystemDataPanel,
  onSpatialModeChange,
  systems = [],
  objects = [],
  activeSystemFilterId = null,
  onSelectSystemFilter,
  onToolChange,
  onToggleSnap,
  onGridSizeChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitToScreen,
  onClear,
  onLoadTemplate,
  onOpenMassGenerator,
  onOpenHierarchyConfig,
  onOpenModuleBuilder,
  onOpenDimensionConfig,
  onOpenSearch,
  onOpenNewFloor,
  onOpenResourceEngine,
  onOpenSystemManager,
  onOpenIAM,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: MapToolbarProps) {
  const [isCameraMenuOpen, setIsCameraMenuOpen] = useState(false)
  const [isSystemMenuOpen, setIsSystemMenuOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const cameraMenuRef = useRef<HTMLDivElement>(null)
  const systemMenuRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!readOnly) return
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (cameraMenuRef.current && !cameraMenuRef.current.contains(target)) {
        setIsCameraMenuOpen(false)
      }
      if (systemMenuRef.current && !systemMenuRef.current.contains(target)) {
        setIsSystemMenuOpen(false)
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setIsMoreMenuOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCameraMenuOpen(false)
        setIsSystemMenuOpen(false)
        setIsMoreMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [readOnly])

  // ── MODO VISUALIZADOR: INTERFACE LIMPA COM MENU DE CÂMERA, SISTEMAS NO MAPA & 3 PONTINHOS ──
  if (readOnly) {
    const activeCamera =
      VIEWER_CAMERA_MODES.find((m) => m.id === spatialMode) || VIEWER_CAMERA_MODES[0]
    const activeSystem =
      activeSystemFilterId
        ? systems.find((s) => s.id === activeSystemFilterId) || null
        : null

    return (
      <div className="h-11 bg-slate-900/95 border-b border-slate-800 px-3 flex items-center justify-between text-slate-100 select-none shrink-0 gap-2 relative z-30">
        {/* Esquerda: Seletor de Câmera + Seletor Sistemas no Mapa + status discreto */}
        <div className="flex items-center gap-2">
          <div ref={cameraMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setIsCameraMenuOpen((prev) => !prev)
                setIsSystemMenuOpen(false)
                setIsMoreMenuOpen(false)
              }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                isCameraMenuOpen
                  ? "bg-slate-800 border-sky-500/70 text-white shadow-lg"
                  : "bg-slate-950/90 hover:bg-slate-800 border-slate-700/80 text-slate-200"
              }`}
              title="Alterar modo de câmera"
            >
              <Camera size={15} className="text-sky-400 shrink-0" />
              <span>{activeCamera.label}</span>
              <ChevronDown
                size={13}
                className={`text-slate-400 transition-transform ${
                  isCameraMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isCameraMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl p-1.5 z-50 backdrop-blur-md">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Modos de Câmera
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {VIEWER_CAMERA_MODES.map((cam) => {
                    const isSelected = spatialMode === cam.id
                    return (
                      <button
                        key={cam.id}
                        type="button"
                        onClick={() => {
                          onSpatialModeChange?.(cam.id)
                          setIsCameraMenuOpen(false)
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-slate-800/95 border border-slate-600/80 text-white"
                            : "hover:bg-slate-800/60 border border-transparent text-slate-300"
                        }`}
                      >
                        {renderCameraModeIcon(cam.icon)}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold leading-tight">
                            {cam.label}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {cam.description}
                          </div>
                        </div>
                        {isSelected && <Check size={14} className="text-sky-400 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Seletor Sistemas no Mapa (ao lado do seletor de câmeras) */}
          {systems.length > 0 && onSelectSystemFilter && (
            <div ref={systemMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsSystemMenuOpen((prev) => !prev)
                  setIsCameraMenuOpen(false)
                  setIsMoreMenuOpen(false)
                }}
                style={
                  activeSystem
                    ? {
                        backgroundColor: `${activeSystem.color}24`,
                        borderColor: activeSystem.color,
                      }
                    : undefined
                }
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  activeSystem
                    ? "text-white shadow-md"
                    : isSystemMenuOpen
                    ? "bg-slate-800 border-amber-500/70 text-white shadow-lg"
                    : "bg-slate-950/90 hover:bg-slate-800 border-slate-700/80 text-slate-200"
                }`}
                title="Selecionar sistema no mapa"
              >
                {activeSystem ? (
                  <>
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0 border border-white/30"
                      style={{ backgroundColor: activeSystem.color }}
                    />
                    <span>{activeSystem.icon}</span>
                    <span className="font-mono font-bold">{activeSystem.code}</span>
                    <span className="hidden sm:inline truncate max-w-[110px] text-slate-200 font-normal">
                      {activeSystem.name}
                    </span>
                  </>
                ) : (
                  <>
                    <Layers size={14} className="text-amber-400 shrink-0" />
                    <span>Sistemas no Mapa</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {systems.length}
                    </span>
                  </>
                )}
                <ChevronDown
                  size={13}
                  className={`text-slate-400 transition-transform ${
                    isSystemMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isSystemMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-80 max-h-96 overflow-y-auto custom-scrollbar bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl p-1.5 z-50 backdrop-blur-md">
                  <div className="px-2 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Sistemas no Mapa</span>
                    {activeSystem && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSystemFilter(null)
                          setIsSystemMenuOpen(false)
                        }}
                        className="text-sky-400 hover:text-sky-300 font-semibold normal-case cursor-pointer"
                      >
                        Mostrar todos
                      </button>
                    )}
                  </div>

                  <div className="space-y-0.5 mt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSystemFilter(null)
                        setIsSystemMenuOpen(false)
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                        !activeSystemFilterId
                          ? "bg-slate-800/95 border border-slate-600/80 text-white font-semibold"
                          : "hover:bg-slate-800/60 border border-transparent text-slate-300"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Layers size={14} className="text-slate-400 shrink-0" />
                        <span>Todos os sistemas (sem filtro)</span>
                      </span>
                      {!activeSystemFilterId && <Check size={14} className="text-sky-400 shrink-0" />}
                    </button>

                    <div className="my-1 border-t border-slate-800" />

                    {systems.map((sys) => {
                      const isSelected = activeSystemFilterId === sys.id
                      const linkedCount = getLinkedStructuresForSystem(sys, objects).length
                      const isLivre = isOpenSystem(sys)
                      return (
                        <button
                          key={sys.id}
                          type="button"
                          onClick={() => {
                            onSelectSystemFilter(isSelected ? null : sys.id)
                            setIsSystemMenuOpen(false)
                          }}
                          style={
                            isSelected
                              ? {
                                  backgroundColor: `${sys.color}22`,
                                  borderColor: sys.color,
                                }
                              : undefined
                          }
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors border cursor-pointer ${
                            isSelected
                              ? "text-white"
                              : "hover:bg-slate-800/60 border-transparent text-slate-300"
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-sm shrink-0 border border-white/30"
                            style={{ backgroundColor: sys.color }}
                          />
                          <span className="text-sm shrink-0">{sys.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-white">
                                {sys.code}
                              </span>
                              <span className="text-xs font-medium text-slate-200 truncate">
                                {sys.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                              <span
                                className={`px-1 rounded border font-mono ${
                                  isLivre
                                    ? "bg-emerald-950/60 border-emerald-700/50 text-emerald-300"
                                    : "bg-blue-950/60 border-blue-800/50 text-blue-300"
                                }`}
                              >
                                {isLivre ? "Livre" : "Saldo"}
                              </span>
                              <span>· {linkedCount} estrutura{linkedCount !== 1 ? "s" : ""}</span>
                            </div>
                          </div>
                          {isSelected && <Check size={14} className="text-sky-400 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-950/50 border border-indigo-800/40 text-indigo-300 text-[10px] font-semibold uppercase tracking-wider">
            <Eye size={11} />
            <span>Visualizador</span>
          </div>

          <span className="hidden lg:inline text-[11px] font-mono text-slate-500">
            {objectsCount} objetos
          </span>
        </div>

        {/* Direita: Busca + Zoom + Gerenciar Dados (ADM) + Menu 3 Pontinhos */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700/60 text-slate-200 text-xs font-medium transition-all cursor-pointer"
            title="Buscar estruturas no mapa (Ctrl+K)"
          >
            <Search size={13} className="text-slate-400" />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="text-[9px] bg-slate-900 px-1 py-0.5 rounded font-mono text-slate-400">
              ⌃K
            </kbd>
          </button>

          <div className="flex items-center gap-0.5 bg-slate-950 px-1.5 py-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={onZoomOut}
              className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 text-xs cursor-pointer"
              title="Diminuir zoom"
            >
              −
            </button>
            <button
              type="button"
              onClick={onZoomReset}
              className="text-xs font-mono text-slate-300 px-1.5 hover:text-blue-400 min-w-[36px] text-center cursor-pointer"
              title="Resetar zoom para 100%"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={onZoomIn}
              className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 text-xs cursor-pointer"
              title="Aumentar zoom"
            >
              +
            </button>
          </div>

          {onOpenSystemDataPanel && (
            <button
              type="button"
              onClick={onOpenSystemDataPanel}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700/90 hover:bg-emerald-600 text-white shadow-sm transition-all cursor-pointer"
              title="Gerenciar dados dos sistemas (Registros, Mapeamento, Confronto)"
            >
              <Database size={13} />
              <span className="hidden md:inline">Gerenciar Dados</span>
            </button>
          )}

          {/* Menu 3 Pontinhos: Navegar, Inspecionar, Enquadrar e Modo Edição */}
          <div ref={moreMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setIsMoreMenuOpen((prev) => !prev)
                setIsCameraMenuOpen(false)
                setIsSystemMenuOpen(false)
              }}
              aria-label="Mais opções do visualizador"
              title="Mais opções (Navegar, Inspecionar, Enquadrar)"
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                isMoreMenuOpen
                  ? "bg-slate-800 border-slate-500 text-white shadow-lg"
                  : "bg-slate-950/90 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white"
              }`}
            >
              <MoreVertical size={16} />
            </button>

            {isMoreMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl p-1.5 z-50 backdrop-blur-md">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Ferramentas
                </div>

                <div className="space-y-0.5 mt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onToolChange("pan")
                      setIsMoreMenuOpen(false)
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                      tool === "pan"
                        ? "bg-blue-600/20 border border-blue-500/50 text-white font-semibold"
                        : "hover:bg-slate-800/70 border border-transparent text-slate-300"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Hand size={14} className={tool === "pan" ? "text-blue-400" : "text-slate-400"} />
                      <span>Navegar</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <kbd className="text-[9px] bg-slate-800 px-1 py-0.5 rounded font-mono text-slate-400">
                        H
                      </kbd>
                      {tool === "pan" && <Check size={13} className="text-blue-400" />}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onToolChange("select")
                      setIsMoreMenuOpen(false)
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                      tool === "select"
                        ? "bg-blue-600/20 border border-blue-500/50 text-white font-semibold"
                        : "hover:bg-slate-800/70 border border-transparent text-slate-300"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <MousePointerClick
                        size={14}
                        className={tool === "select" ? "text-blue-400" : "text-slate-400"}
                      />
                      <span>Inspecionar</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <kbd className="text-[9px] bg-slate-800 px-1 py-0.5 rounded font-mono text-slate-400">
                        V
                      </kbd>
                      {tool === "select" && <Check size={13} className="text-blue-400" />}
                    </span>
                  </button>
                </div>

                {onFitToScreen && (
                  <>
                    <div className="my-1.5 border-t border-slate-800" />
                    <button
                      type="button"
                      onClick={() => {
                        onFitToScreen()
                        setIsMoreMenuOpen(false)
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800/70 hover:text-white transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Maximize2 size={14} className="text-sky-400" />
                        <span>Enquadrar</span>
                      </span>
                      <kbd className="text-[9px] bg-slate-800 px-1 py-0.5 rounded font-mono text-slate-400">
                        ⇧1
                      </kbd>
                    </button>
                  </>
                )}

                {canEnableEditMode && onEnableEditMode && (
                  <>
                    <div className="my-1.5 border-t border-slate-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false)
                        onEnableEditMode()
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-emerald-300 hover:bg-emerald-950/60 hover:text-emerald-200 border border-transparent hover:border-emerald-700/50 transition-colors cursor-pointer font-semibold"
                    >
                      <span className="flex items-center gap-2">
                        <Edit3 size={14} className="text-emerald-400" />
                        <span>Modo Edição</span>
                      </span>
                      <span className="text-[10px] text-emerald-500">Ativar →</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── MODO EDITOR NORMAL (ADMIN / PROPRIETÁRIO) ─────────────────
  return (
    <div className="h-12 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between text-slate-100 select-none shrink-0 gap-2">
      {/* Esquerda: Modos de Visualização & Interação */}
      <div className="flex items-center gap-2">
        {/* Alternador Compacto de Visualização: 2D · Bird's-Eye 3D · Full Top · 3D Livre */}
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 gap-0.5 shadow-inner">
          <button
            onClick={() => onSpatialModeChange?.("2d")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
              spatialMode === "2d"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Editor 2D — Planta Konva"
          >
            <span>📐</span>
            <span>2D</span>
          </button>

          <button
            onClick={() => onSpatialModeChange?.("birdseye")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
              spatialMode === "birdseye"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Bird's-Eye 3D (Padrão) — Câmera ortográfica superior com inclinação fixa de 20°"
          >
            <span>🦅</span>
            <span>Bird&apos;s-Eye 3D</span>
          </button>

          <button
            onClick={() => onSpatialModeChange?.("fulltop")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
              spatialMode === "fulltop"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Full Top — Câmera ortográfica estritamente vertical a 90°"
          >
            <span>🗺️</span>
            <span>Full Top</span>
          </button>

          <button
            onClick={() => onSpatialModeChange?.("3d")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
              spatialMode === "3d"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="3D Livre — Câmera Perspectiva com movimentação orbital 360°"
          >
            <span>🌐</span>
            <span>3D Livre</span>
          </button>
        </div>

        <div className="h-5 w-px bg-slate-800" />

        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 gap-0.5">
          {/* Selecionar */}
          <button
            onClick={() => onToolChange("select")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              tool === "select"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
            title="Selecionar e mover elementos (V)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 3l14 9-7 1-4 7z" />
            </svg>
            <span>Mover</span>
          </button>

          {/* Pan */}
          <button
            onClick={() => onToolChange("pan")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              tool === "pan"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
            title="Navegar no Canvas (H)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8" />
              <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8V9a2 2 0 1 1 4 0" />
            </svg>
            <span>Pan</span>
          </button>

          {/* Desenhar Área */}
          <button
            onClick={() => onToolChange("draw_area")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              tool === "draw_area"
                ? "bg-amber-600 text-white"
                : "text-slate-400 hover:text-amber-300"
            }`}
            title="Desenhar área livre: clique para adicionar vértices, duplo-clique ou retorne ao ponto inicial para fechar"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="3,20 12,4 21,20" />
              <circle cx="3" cy="20" r="2" fill="currentColor" />
              <circle cx="12" cy="4" r="2" fill="currentColor" />
              <circle cx="21" cy="20" r="2" fill="currentColor" />
            </svg>
            <span>Área</span>
          </button>

          {/* Piso */}
          <button
            onClick={() => onOpenNewFloor()}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              tool === "draw_floor"
                ? "bg-slate-500 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Criar novo piso configurável"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="13" width="20" height="8" rx="1" />
              <rect x="6" y="4" width="12" height="8" rx="1" />
              <line x1="8" y1="13" x2="8" y2="21" />
              <line x1="16" y1="13" x2="16" y2="21" />
            </svg>
            <span>Piso</span>
          </button>
        </div>

        <div className="h-5 w-px bg-slate-800 mx-0.5" />

        {/* Histórico: Desfazer e Refazer */}
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 gap-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1 rounded text-xs transition-colors ${
              canUndo
                ? "text-slate-300 hover:text-white hover:bg-slate-800"
                : "text-slate-600 cursor-not-allowed"
            }`}
            title="Desfazer alteração (Ctrl+Z)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1 rounded text-xs transition-colors ${
              canRedo
                ? "text-slate-300 hover:text-white hover:bg-slate-800"
                : "text-slate-600 cursor-not-allowed"
            }`}
            title="Refazer alteração (Ctrl+Y)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
            </svg>
          </button>
        </div>

        <div className="h-5 w-px bg-slate-800 mx-0.5" />

        {/* Snap e Grade */}
        <div className="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800">
          {/* Botão Snap on/off */}
          <button
            onClick={onToggleSnap}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
              snapEnabled
                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                : "text-slate-500 hover:text-slate-300"
            }`}
            title={snapEnabled ? "Snap ativo — objetos encaixam na grade" : "Snap desativado — movimento livre"}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
            </svg>
            <span>Snap</span>
          </button>

          {/* Separador */}
          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* Label */}
          <span className="text-[10px] text-slate-500 font-medium pr-0.5">Grade:</span>

          {/* Chips de tamanho de grid */}
          {([5, 10, 20, 25, 50, 100] as const).map((size) => (
            <button
              key={size}
              onClick={() => onGridSizeChange(size)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                gridSize === size
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:text-slate-200 hover:bg-slate-800"
              }`}
              title={`Grade de ${size}px${size <= 10 ? " — Fino" : size <= 25 ? " — Médio" : " — Grosso"}`}
            >
              {size}
            </button>
          ))}

          {/* Input customizado */}
          <input
            type="number"
            min={1}
            max={200}
            value={gridSize}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v >= 1 && v <= 200) onGridSizeChange(v)
            }}
            className="w-10 bg-slate-900 border border-slate-700 text-[10px] text-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:border-blue-500"
            title="Tamanho personalizado da grade (1–200px)"
          />
          <span className="text-[10px] text-slate-600">px</span>
        </div>
      </div>

      {/* Centro: Ferramentas de Evolução Arquitetural */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenMassGenerator}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900/80 border border-blue-800/60 text-blue-300 hover:text-white text-xs font-bold transition-all shadow-sm"
          title="Criar centenas de drives automaticamente ou importar de planilha"
        >
          <span>⚡</span>
          <span>Geração em Massa</span>
        </button>

        <button
          onClick={onOpenHierarchyConfig}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-950/70 hover:bg-purple-900/80 border border-purple-800/60 text-purple-300 hover:text-white text-xs font-bold transition-all shadow-sm"
          title="Configurar níveis hierárquicos e regras de código de endereçamento"
        >
          <span>🏢</span>
          <span>Hierarquia</span>
        </button>

        <button
          onClick={onOpenDimensionConfig}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-pink-950/70 hover:bg-pink-900/80 border border-pink-800/60 text-pink-300 hover:text-white text-xs font-bold transition-all shadow-sm"
          title="Configurar modelos padrão de nomenclatura de dimensões (Níveis, Profundidades, etc.) para novas importações"
        >
          <span>📏</span>
          <span>Padrões Dimensões</span>
        </button>

        <button
          onClick={onOpenModuleBuilder}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900/80 border border-amber-800/60 text-amber-300 hover:text-white text-xs font-bold transition-all shadow-sm"
          title="Criar e gerenciar módulos personalizados"
        >
          <span>🧱</span>
          <span>Módulos</span>
        </button>

        {onOpenResourceEngine && (
          <button
            onClick={onOpenResourceEngine}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-800/60 text-emerald-300 hover:text-white text-xs font-bold transition-all shadow-sm"
            title="Motor Universal de Recursos — Contabilizar Produtos, Embalagens, Equipamentos, Documentos e Vagas"
          >
            <span>🔷</span>
            <span>Recursos</span>
          </button>
        )}

        {onOpenSystemManager && (
          <button
            onClick={onOpenSystemManager}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900/80 border border-blue-800/60 text-blue-300 hover:text-white text-xs font-bold transition-all shadow-sm"
            title="Sistemas de Saldo — Gerenciar Avarias G300, Retrabalho, Quarentena, Origem (CHÃO) e Regras de Preenchimento"
          >
            <span>🔐</span>
            <span>Sistemas de Saldo</span>
          </button>
        )}

        {onOpenIAM && (
          <button
            onClick={onOpenIAM}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-800/60 text-indigo-300 hover:text-white text-xs font-bold transition-all shadow-sm"
            title="NEXUS IAM — Gestão Central de Identidade, Papéis e Permissões"
          >
            <span>🛡️</span>
            <span>IAM & Permissões</span>
          </button>
        )}
      </div>

      {/* Direita: Search + Zoom + Ações */}
      <div className="flex items-center gap-1.5">
        {/* Busca Universal */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-medium transition-all"
          title="Busca Universal — localizar qualquer elemento no mapa (Ctrl+K)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span>Buscar</span>
          <kbd className="text-[9px] bg-slate-700 px-1 py-0.5 rounded font-mono">⌃K</kbd>
        </button>

        {/* Zoom */}
        <div className="flex items-center gap-0.5 bg-slate-950 px-1.5 py-1 rounded-lg border border-slate-800">
          <button
            onClick={onZoomOut}
            className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
          >
            −
          </button>
          <button
            onClick={onZoomReset}
            className="text-xs font-mono text-slate-300 px-1.5 hover:text-blue-400 min-w-[36px] text-center"
            title="Resetar para 100%"
          >
            {zoom}%
          </button>
          <button
            onClick={onZoomIn}
            className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
          >
            +
          </button>
        </div>

        {/* Botão Enquadrar Tudo */}
        {onFitToScreen && (
          <button
            onClick={onFitToScreen}
            className="p-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs transition-colors flex items-center gap-1 px-1.5"
            title="Enquadrar todo o conteúdo na tela (Shift+1)"
          >
            <span>🎯</span>
            <span className="text-[10px] hidden md:inline">Enquadrar</span>
          </button>
        )}

        <span className="text-[11px] font-mono text-slate-500 min-w-[36px]">
          {objectsCount} obj
        </span>

        <button
          onClick={onLoadTemplate}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 hover:bg-indigo-900/60 transition-colors"
          title="Carregar layout demonstrativo de CD"
        >
          Demo
        </button>

        <button
          onClick={onClear}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 text-slate-400 hover:text-red-300 hover:bg-red-950/40 transition-colors"
          title="Limpar todos os elementos"
        >
          Limpar
        </button>
      </div>
    </div>
  )
}
