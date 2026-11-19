// ============================================================
// NEXUS ERP — MapToolbar / MapToolbar.tsx
// Barra de ferramentas superior do editor de mapeamento
// ============================================================

"use client"

import React from "react"

interface MapToolbarProps {
  tool: "select" | "pan" | "draw_area" | "draw_floor"
  snapEnabled: boolean
  gridSize: number
  zoom: number
  objectsCount: number
  spatialMode?: "2d" | "isometric" | "3d"
  readOnly?: boolean
  onSpatialModeChange?: (mode: "2d" | "isometric" | "3d") => void
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

export default function MapToolbar({
  tool,
  snapEnabled,
  gridSize,
  zoom,
  objectsCount,
  spatialMode = "2d",
  readOnly = false,
  onSpatialModeChange,
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
  // ── MODO VISUALIZADOR: SUMIR TUDO DE EDIÇÃO ──────────────────
  if (readOnly) {
    return (
      <div className="h-12 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between text-slate-100 select-none shrink-0 gap-2">
        {/* Esquerda: Modos de Visualização & Interação (Leitura) */}
        <div className="flex items-center gap-2">
          {/* Alternador 2D · Isométrico · 3D Livre */}
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 gap-0.5 shadow-inner">
            <button
              onClick={() => onSpatialModeChange?.("2d")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                spatialMode === "2d"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Visualização 2D — Planta Superior"
            >
              <span>📐</span>
              <span>2D</span>
            </button>

            <button
              onClick={() => onSpatialModeChange?.("isometric")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                spatialMode === "isometric"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Visualização Isométrica Técnica"
            >
              <span>🧊</span>
              <span>Isométrico</span>
            </button>

            <button
              onClick={() => onSpatialModeChange?.("3d")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                spatialMode === "3d"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Visualização 3D Livre com Navegação Orbital 360°"
            >
              <span>🌐</span>
              <span>3D Livre</span>
            </button>
          </div>

          <div className="h-5 w-px bg-slate-800" />

          {/* Ferramentas do Visualizador: Pan (Navegar) & Selecionar (Inspecionar) */}
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 gap-0.5">
            <button
              onClick={() => onToolChange("pan")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                tool === "pan"
                  ? "bg-blue-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Navegar pelo mapa (Arrastar tela / H)"
            >
              <span>🖐️</span>
              <span>Navegar</span>
            </button>

            <button
              onClick={() => onToolChange("select")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                tool === "select"
                  ? "bg-blue-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Inspecionar e selecionar estruturas (V)"
            >
              <span>🔍</span>
              <span>Inspecionar</span>
            </button>
          </div>

          <div className="h-5 w-px bg-slate-800" />

          {/* Badge Visualizador */}
          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 flex items-center gap-1.5 shadow-sm">
            <span>👁️</span>
            <span>Modo Visualizador</span>
          </span>
        </div>

        {/* Direita: Enquadrar + Zoom + Busca + Contagem */}
        <div className="flex items-center gap-2">
          {/* Busca Universal */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-medium transition-all"
            title="Buscar estruturas no mapa (Ctrl+K)"
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
              title="Resetar zoom para 100%"
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

          {/* Enquadrar */}
          {onFitToScreen && (
            <button
              onClick={onFitToScreen}
              className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs transition-colors flex items-center gap-1 px-2 font-medium"
              title="Enquadrar todo o galpão na tela (Shift+1)"
            >
              <span>🎯</span>
              <span>Enquadrar</span>
            </button>
          )}

          <span className="text-[11px] font-mono text-slate-500 pl-1">
            {objectsCount} estruturas
          </span>
        </div>
      </div>
    )
  }

  // ── MODO EDITOR NORMAL (ADMIN / PROPRIETÁRIO) ─────────────────
  return (
    <div className="h-12 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between text-slate-100 select-none shrink-0 gap-2">
      {/* Esquerda: Modos de Visualização & Interação */}
      <div className="flex items-center gap-2">
        {/* Alternador Compacto de Visualização: 2D · Isométrico · 3D Livre */}
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 gap-0.5 shadow-inner">
          <button
            onClick={() => onSpatialModeChange?.("2d")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
              spatialMode === "2d"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Visualização 2D — Planta Superior"
          >
            <span>📐</span>
            <span>2D</span>
          </button>

          <button
            onClick={() => onSpatialModeChange?.("isometric")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
              spatialMode === "isometric"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Visualização Isométrica Técnica — Câmera Ortográfica Axonométrica"
          >
            <span>🧊</span>
            <span>Isométrico</span>
          </button>

          <button
            onClick={() => onSpatialModeChange?.("3d")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
              spatialMode === "3d"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Visualização 3D Livre — Câmera Perspectiva com Navegação Orbital 360°"
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
