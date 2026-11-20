// ============================================================
// NEXUS ERP — Systems / SystemMappingModal.tsx
// Modal de Mapeamento de Posições Físicas do Sistema
// Estilo G300: ao clicar numa posição vinculada, exibe o
// MapeamentoDriveInGrid idêntico ao do módulo de Mapeamentos.
// ============================================================

"use client"

import React, { useState, useEffect, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  X,
  Layers,
  Plus,
  Trash2,
  Lock,
  ArrowLeft,
  Box,
  AlertCircle,
} from "lucide-react"
import { useSystemStore } from "./useSystemStore"
import type { BusinessSystem, StorageParticipantConfig, StorageRole, StockControlMode } from "./types"
import type { MapObject } from "../MapLibrary/types"
import type { DimensionConfig } from "../MapLibrary/dimensionsTypes"
import {
  DEFAULT_G300_LEVELS_CONFIG,
  DEFAULT_G300_DEPTH_CONFIG,
  generateDimensionItems,
} from "../MapLibrary/dimensionManager"
import { MapeamentoDriveInGrid } from "../mapeamentos/MapeamentoDriveInGrid"
import { MapeamentoItemModal } from "../mapeamentos/MapeamentoItemModal"
import CompartmentRelationView from "../MapLayers/CompartmentRelationView"
import type { MapeamentoItem, MapeamentoConfig } from "@/lib/mapeamentosStorage"
import { getLocalItems, saveLocalItems } from "@/lib/mapeamentosStorage"
import {
  fetchAndSyncSystemBalances,
  getOriginObjectId,
  getSystemBalanceSnapshot,
  getAvailableStocksFromOrigin,
  applyNonOriginPositionChange,
  syncSupabaseUniversalBalances,
} from "./systemBalanceService"
import { persistPositionItemsToSupabase } from "@/lib/workspaceItemsSync"
import { cn } from "@/lib/utils"

interface SystemMappingModalProps {
  isOpen: boolean
  onClose: () => void
  system: BusinessSystem
  allObjects?: MapObject[]
  workspaceId?: string
  levelsConfig?: DimensionConfig
  depthConfig?: DimensionConfig
}

/** Cria um MapeamentoConfig mínimo com base num MapObject para usar no DriveInGrid */
function buildFakeConfig(obj: MapObject): MapeamentoConfig {
  return {
    id: `sys_map_${obj.id}`,
    nome: obj.label || obj.id,
    descricao: `Canal vinculado ao mapeamento do sistema`,
    categoria: "Sistema de Saldo",
    cor: "blue",
    icone: "Box",
    camposPersonalizados: [],
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  }
}

export default function SystemMappingModal({
  isOpen,
  onClose,
  system,
  allObjects = [],
  workspaceId,
  levelsConfig: mapLevelsConfig = DEFAULT_G300_LEVELS_CONFIG,
  depthConfig: mapDepthConfig = DEFAULT_G300_DEPTH_CONFIG,
}: SystemMappingModalProps) {
  const { updateSystem } = useSystemStore(workspaceId)
  const [selectedObjectId, setSelectedObjectId] = useState("")
  const [role, setRole] = useState<StorageRole>("armazenamento")
  const [stockControlMode, setStockControlMode] = useState<StockControlMode>(system.defaultControlMode)

  // Painel do DriveInGrid ao selecionar uma posição vinculada
  const [inspectingParticipant, setInspectingParticipant] = useState<StorageParticipantConfig | null>(null)
  const [inspectingObject, setInspectingObject] = useState<MapObject | null>(null)
  const [isEditModeActive, setIsEditModeActive] = useState(false)
  const [itemsVersion, setItemsVersion] = useState(0)

  // Sub-modal de Item / Palete do Canal (Estilo G300 MapeamentoItemModal)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MapeamentoItem | null>(null)
  const [itemCoords, setItemCoords] = useState<{ lvl: number; prof: number }>({ lvl: 1, prof: 1 })
  const [batchCoords, setBatchCoords] = useState<{ lvl: number; prof: number }[] | null>(null)
  const [balanceError, setBalanceError] = useState<string>("")

  // Sincroniza registros -> saldo da Origem (Chão) ao abrir
  useEffect(() => {
    if (!isOpen) return
    let active = true
    fetchAndSyncSystemBalances(system).then(() => {
      if (!active) return
      setBalanceError("")
      setItemsVersion((v) => v + 1)
    })
    return () => {
      active = false
    }
  }, [isOpen, system])

  const balanceSnapshot = useMemo(() => {
    void itemsVersion
    return getSystemBalanceSnapshot(system)
  }, [system, itemsVersion])

  const originObjectId = useMemo(() => getOriginObjectId(system), [system])

  const availableStocks = useMemo(() => {
    void itemsVersion
    return getAvailableStocksFromOrigin(system)
  }, [system, itemsVersion])

  if (!isOpen) return null

  const participants = system.participants || []
  const linkedIds = new Set(participants.map(p => p.storageObjectId))
  const availableObjects = allObjects.filter(o => !linkedIds.has(o.id))

  // ── Vincular nova estrutura ───────────────────────────────────
  const handleLinkObject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedObjectId) return
    const obj = allObjects.find(o => o.id === selectedObjectId)
    if (!obj) return

    const newParticipant: StorageParticipantConfig = {
      storageObjectId: obj.id,
      storageObjectLabel: obj.label || obj.id,
      storageType: obj.type || obj.category || "storage",
      role,
      stockControlMode,
      permissions: {
        allowInbound: true,
        allowOutbound: true,
        allowReturnToOrigin: role !== "origem",
      },
      configuredAt: new Date().toISOString(),
    }

    const patch: Partial<BusinessSystem> = {
      participants: [...participants, newParticipant],
    }
    if (role === "origem" && !system.originStorageId) {
      patch.originStorageId = obj.id
      patch.originStorageLabel = obj.label || obj.id
    }

    updateSystem(system.id, patch)
    setSelectedObjectId("")
  }

  const handleUnlink = (storageObjectId: string) => {
    updateSystem(system.id, {
      participants: participants.filter(p => p.storageObjectId !== storageObjectId),
    })
    if (inspectingParticipant?.storageObjectId === storageObjectId) {
      setInspectingParticipant(null)
      setInspectingObject(null)
    }
  }

  const handleToggleControlMode = (storageObjectId: string) => {
    updateSystem(system.id, {
      participants: participants.map(p => {
        if (p.storageObjectId !== storageObjectId) return p
        return {
          ...p,
          stockControlMode: p.stockControlMode === "vinculado_saldo" ? "livre" : "vinculado_saldo",
        }
      }),
    })
  }

  // ── Inspecionar canal (abre DriveInGrid ou Relação do Compartimento) ──
  const handleInspect = (p: StorageParticipantConfig) => {
    const obj = allObjects.find(o => o.id === p.storageObjectId)
    setBalanceError("")
    setInspectingParticipant(p)
    setInspectingObject(obj || null)
    setIsEditModeActive(false)
  }

  // ── Itens do canal (localStorage com chave = sys_{systemId}_{objectId}) ──
  const activeObjectId = inspectingObject?.id || inspectingParticipant?.storageObjectId || ""
  const channelKey = activeObjectId ? `sys_${system.id}_${activeObjectId}` : ""
  const channelItems: MapeamentoItem[] = (activeObjectId && itemsVersion >= 0)
    ? getLocalItems().filter(it => it.mapeamentoId === channelKey)
    : []

  const isInspectingOrigin = Boolean(activeObjectId && originObjectId === activeObjectId)
  const enforceDriveStockLimit = Boolean(
    !isInspectingOrigin &&
      (inspectingParticipant?.stockControlMode === "vinculado_saldo" ||
        (!inspectingParticipant?.stockControlMode && system.defaultControlMode === "vinculado_saldo"))
  )

  const handleAddItem = (
    nivel: number,
    profundidade: number,
    batch?: { lvl: number; prof: number }[]
  ) => {
    setBalanceError("")
    setItemCoords({ lvl: nivel, prof: profundidade })
    setBatchCoords(batch || null)
    setEditingItem(null)
    setIsItemModalOpen(true)
  }

  const handleEditItem = (updated: MapeamentoItem) => {
    setBalanceError("")
    const currentChannelItems = getLocalItems().filter((it) => it.mapeamentoId === channelKey)
    const nextChannelItems =
      updated.quantidade > 0
        ? currentChannelItems.map((it) => (it.id === updated.id ? updated : it))
        : currentChannelItems.filter((it) => it.id !== updated.id)

    if (activeObjectId && !isInspectingOrigin) {
      const res = applyNonOriginPositionChange(
        system,
        activeObjectId,
        currentChannelItems,
        nextChannelItems,
        { enforceStockLimit: enforceDriveStockLimit }
      )
      if (!res.ok) {
        setBalanceError(res.errorMessage)
        return
      }
    } else {
      const others = getLocalItems().filter((it) => it.mapeamentoId !== channelKey)
      saveLocalItems([...others, ...nextChannelItems])
      persistPositionItemsToSupabase(channelKey, nextChannelItems, system.workspaceId).catch(() => {})
      syncSupabaseUniversalBalances(system).catch(() => {})
    }
    setItemsVersion((v) => v + 1)
  }

  const handleSaveModalItems = (saved: MapeamentoItem[] | MapeamentoItem) => {
    setBalanceError("")
    const savedArr = Array.isArray(saved) ? saved : [saved]

    const formatted = savedArr.map(it => ({
      ...it,
      mapeamentoId: channelKey,
      posicao: inspectingObject?.label || inspectingParticipant?.storageObjectLabel || activeObjectId || "POS",
    }))

    const currentChannelItems = getLocalItems().filter((it) => it.mapeamentoId === channelKey)
    const replacedIds = new Set(formatted.map(it => it.id))
    const remainingInChannel = currentChannelItems.filter(it => !replacedIds.has(it.id))
    const nextChannelItems = [...remainingInChannel, ...formatted]

    if (activeObjectId && !isInspectingOrigin) {
      const res = applyNonOriginPositionChange(
        system,
        activeObjectId,
        currentChannelItems,
        nextChannelItems,
        { enforceStockLimit: enforceDriveStockLimit }
      )
      if (!res.ok) {
        setBalanceError(res.errorMessage)
        return
      }
    } else {
      const others = getLocalItems().filter(it => it.mapeamentoId !== channelKey)
      saveLocalItems([...others, ...nextChannelItems])
      persistPositionItemsToSupabase(channelKey, nextChannelItems, system.workspaceId).catch(() => {})
      syncSupabaseUniversalBalances(system).catch(() => {})
    }

    setIsItemModalOpen(false)
    setEditingItem(null)
    setItemsVersion(v => v + 1)
  }

  const handleDeleteItem = (itemId: string) => {
    setBalanceError("")
    const currentChannelItems = getLocalItems().filter((it) => it.mapeamentoId === channelKey)
    const nextChannelItems = currentChannelItems.filter(it => it.id !== itemId)
    if (activeObjectId && !isInspectingOrigin) {
      const res = applyNonOriginPositionChange(
        system,
        activeObjectId,
        currentChannelItems,
        nextChannelItems,
        { enforceStockLimit: enforceDriveStockLimit }
      )
      if (!res.ok) {
        setBalanceError(res.errorMessage)
        return
      }
    } else {
      const others = getLocalItems().filter(it => it.mapeamentoId !== channelKey)
      saveLocalItems([...others, ...nextChannelItems])
      persistPositionItemsToSupabase(channelKey, nextChannelItems, system.workspaceId).catch(() => {})
      syncSupabaseUniversalBalances(system).catch(() => {})
    }
    setItemsVersion(v => v + 1)
  }

  const handleSwapItems = (
    source: { lvl: number; d: number },
    target: { lvl: number; d: number }
  ) => {
    const all = getLocalItems()
    const isInChannel = (it: MapeamentoItem) => it.mapeamentoId === channelKey
    const srcItems = all.filter(it => isInChannel(it) && it.nivel === source.lvl && it.profundidade === source.d)
    const tgtItems = all.filter(it => isInChannel(it) && it.nivel === target.lvl && it.profundidade === target.d)
    const others = all.filter(it =>
      !(isInChannel(it) && it.nivel === source.lvl && it.profundidade === source.d) &&
      !(isInChannel(it) && it.nivel === target.lvl && it.profundidade === target.d)
    )
    const nextAll = [
      ...srcItems.map(it => ({ ...it, nivel: target.lvl, profundidade: target.d })),
      ...tgtItems.map(it => ({ ...it, nivel: source.lvl, profundidade: source.d })),
      ...others,
    ]
    saveLocalItems(nextAll)
    persistPositionItemsToSupabase(
      channelKey,
      nextAll.filter((it) => it.mapeamentoId === channelKey),
      system.workspaceId
    ).catch(() => {})
    setItemsVersion(v => v + 1)
  }

  const isInspectingCompartment =
    inspectingObject?.type === "compartment" ||
    inspectingParticipant?.storageType === "compartment"

  // Nível e profundidade do objeto selecionado (não aplicável a Compartimento)
  const levels = !isInspectingCompartment && inspectingObject
    ? Math.max(1, Number(inspectingObject.props?.levels) || 4)
    : 4
  const depthCount = !isInspectingCompartment && inspectingObject
    ? Math.max(1, Number(inspectingObject.props?.depth) || 4)
    : 4
  const capacity = levels * depthCount

  const resolvedLevelsConfig: DimensionConfig = (() => {
    const cfg =
      (inspectingObject?.props?.levelsConfig as DimensionConfig | undefined) || mapLevelsConfig
    return {
      ...cfg,
      defaultCount: levels,
      items: generateDimensionItems(
        levels,
        cfg.sequenceType,
        cfg.orientation,
        cfg.prefix,
        cfg.suffix,
        cfg.paddingDigits,
        cfg.customValues
      ),
    }
  })()

  const resolvedDepthConfig: DimensionConfig = (() => {
    const cfg =
      (inspectingObject?.props?.depthConfig as DimensionConfig | undefined) || mapDepthConfig
    return {
      ...cfg,
      defaultCount: depthCount,
      items: generateDimensionItems(
        depthCount,
        cfg.sequenceType,
        cfg.orientation,
        cfg.prefix,
        cfg.suffix,
        cfg.paddingDigits,
        cfg.customValues
      ),
    }
  })()

  const inspectingDisplayName =
    inspectingObject?.label ||
    inspectingParticipant?.storageObjectLabel ||
    inspectingParticipant?.storageObjectId ||
    ""

  const fakeConfig = inspectingParticipant
    ? inspectingObject
      ? buildFakeConfig(inspectingObject)
      : {
          id: `sys_map_${inspectingParticipant.storageObjectId}`,
          nome: inspectingParticipant.storageObjectLabel,
          descricao: "Canal vinculado ao mapeamento do sistema",
          categoria: "Sistema de Saldo",
          cor: "blue" as const,
          icone: "Box" as const,
          camposPersonalizados: [],
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        }
    : null

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            {inspectingParticipant && (
              <button
                onClick={() => { setInspectingParticipant(null); setInspectingObject(null) }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mr-1"
                title="Voltar para a lista de posições"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shadow-md shrink-0"
              style={{ backgroundColor: `${system.color}25`, border: `1.5px solid ${system.color}80` }}
            >
              {system.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  {inspectingParticipant
                    ? `Canal: ${inspectingParticipant.storageObjectLabel}`
                    : `Mapeamento de Posições — ${system.name}`}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold border border-slate-700">
                  {system.code}
                </span>
                {inspectingParticipant && (
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded border",
                    inspectingParticipant.stockControlMode === "vinculado_saldo"
                      ? "bg-blue-950/60 border-blue-700/50 text-blue-300"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  )}>
                    {inspectingParticipant.stockControlMode === "vinculado_saldo" ? "Saldo Obrigatório" : "Livre"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {inspectingParticipant
                  ? `Papel: ${inspectingParticipant.role} · Tipo: ${inspectingParticipant.storageType}`
                  : "Associação de estruturas físicas (Drives, Áreas e Chão) a este sistema de saldo."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Visualização do Canal (DriveInGrid ou Relação do Compartimento) ── */}
        <AnimatePresence mode="wait">
          {inspectingParticipant && fakeConfig ? (
            <motion.div
              key="channel-view"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="flex-1 overflow-y-auto custom-scrollbar p-4"
            >
              {balanceError && (
                <div className="mb-3 flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-200">
                  <span className="flex items-center gap-2">
                    <AlertCircle size={14} className="text-rose-400 shrink-0" />
                    <span>{balanceError}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setBalanceError("")}
                    className="text-rose-300 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Toggle Edição */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Box size={13} className={isInspectingCompartment ? "text-amber-400" : "text-blue-400"} />
                  {isInspectingCompartment
                    ? "Espaço Aberto — Armazenamento sem nível ou profundidade"
                    : `Canal de Armazenamento — ${levels} Nível(is) · Capacidade: ${capacity} posições`}
                </span>
                <button
                  onClick={() => setIsEditModeActive(v => !v)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors",
                    isEditModeActive
                      ? "bg-amber-900/60 border-amber-700 text-amber-300"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                  )}
                >
                  {isEditModeActive ? "✏️ Modo Edição Ativo" : "🔒 Modo Visualização"}
                </button>
              </div>

              {isInspectingCompartment ? (
                <CompartmentRelationView
                  mapeamentoId={channelKey || `sys_${system.id}_${inspectingParticipant.storageObjectId}`}
                  positionLabel={inspectingParticipant.storageObjectLabel}
                  canEdit={isEditModeActive}
                  onItemsChanged={() => setItemsVersion(v => v + 1)}
                  system={system}
                  objectId={inspectingParticipant.storageObjectId}
                  allObjects={allObjects}
                  stockControlMode={inspectingParticipant.stockControlMode}
                />
              ) : (
                <MapeamentoDriveInGrid
                  positionId={inspectingDisplayName}
                  items={channelItems}
                  capacity={capacity}
                  levelCount={levels}
                  startLevel={1}
                  levelsConfig={resolvedLevelsConfig}
                  depthConfig={resolvedDepthConfig}
                  config={fakeConfig}
                  isEditModeActive={isEditModeActive}
                  setIsEditModeActive={setIsEditModeActive}
                  onAddItem={handleAddItem}
                  onEditItem={handleEditItem}
                  onDeleteItem={handleDeleteItem}
                  onSwapItems={handleSwapItems}
                  isLoggedIn={true}
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="list-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-hidden flex flex-col min-h-0"
            >
              {/* Formulário: Vincular Estrutura */}
              <form onSubmit={handleLinkObject} className="p-4 border-b border-slate-800 bg-slate-950/40 space-y-3 shrink-0">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">
                  Vincular Nova Estrutura do Mapa
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Selecionar Estrutura *</label>
                    <select
                      required
                      value={selectedObjectId}
                      onChange={e => setSelectedObjectId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">— Escolha um objeto do mapa —</option>
                      {availableObjects.map(o => (
                        <option key={o.id} value={o.id}>
                          📦 {o.label || o.id} ({o.classification || o.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Papel Operacional</label>
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value as StorageRole)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="armazenamento">Armazenamento (Drive-In / Racks)</option>
                      <option value="origem">Origem dos Saldos (CHÃO)</option>
                      <option value="quarentena">Quarentena / Retenção</option>
                      <option value="retrabalho">Bancada de Retrabalho</option>
                      <option value="expedicao">Doca / Expedição</option>
                      <option value="transito">Corredor de Trânsito</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Regra de Saldo</label>
                    <select
                      value={stockControlMode}
                      onChange={e => setStockControlMode(e.target.value as StockControlMode)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="vinculado_saldo">Saldo Obrigatório (Bloqueia sem saldo)</option>
                      <option value="livre">Livre (Permite preenchimento direto)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={!selectedObjectId}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                  >
                    <Plus size={13} /> Vincular ao Sistema
                  </button>
                </div>
              </form>

              {/* Resumo de Conservação de Saldo */}
              <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/70 flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
                <div className="flex flex-wrap items-center gap-3 font-mono">
                  <span className="text-slate-300">
                    Entradas - Saídas = <strong className="text-emerald-400">{balanceSnapshot.totalSystemNet} un.</strong>
                  </span>
                  <span className="text-slate-500">|</span>
                  <span className="text-amber-300">
                    Na Origem (Chão): <strong>{balanceSnapshot.totalOrigin} un.</strong>
                  </span>
                  <span className="text-blue-300">
                    Em Posições: <strong>{balanceSnapshot.totalAllocated} un.</strong>
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Clique em uma posição para gerenciar ou alocar saldo
                </span>
              </div>

              {/* Lista de Participantes */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers size={13} className="text-amber-400" />
                    <span>Estruturas Vinculadas ({participants.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Clique no cartão para ver o canal (G300-style)
                  </span>
                </div>

                {participants.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs bg-slate-950/30 rounded-xl border border-dashed border-slate-800">
                    <Layers size={28} className="mx-auto mb-2 text-slate-600" />
                    <p>Nenhuma estrutura física vinculada.</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Selecione uma estrutura acima para mapeá-la.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {participants.map(p => {
                      const obj = allObjects.find(o => o.id === p.storageObjectId)
                      const isComp = obj?.type === "compartment" || p.storageType === "compartment"
                      const lvlCount = Number(obj?.props?.levels) || 4
                      const depth = Number(obj?.props?.depth) || 4
                      const posTotal = balanceSnapshot.positionTotalsByObjectId.get(p.storageObjectId) || 0
                      const isOriginCard = originObjectId === p.storageObjectId
                      return (
                        <div
                          key={p.storageObjectId}
                          className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl hover:border-blue-700/60 hover:bg-slate-900/60 transition-all cursor-pointer group"
                          onClick={() => handleInspect(p)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-base shadow group-hover:border-blue-600/60 transition-colors">
                                {isComp ? "📦" : p.role === "origem" ? "📍" : p.role === "quarentena" ? "🛑" : "📥"}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <strong className="text-white text-xs">{p.storageObjectLabel}</strong>
                                  <span className="text-[9px] text-slate-500 font-mono">({p.storageType})</span>
                                  {isOriginCard && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      ORIGEM / CHÃO
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                                  <span>Papel: <strong>{p.role}</strong></span>
                                  <span>·</span>
                                  <span>
                                    {isComp
                                      ? "Armazenamento Aberto (sem nível / prof.)"
                                      : `${lvlCount} nível(is) × ${depth} prof.`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-emerald-300">
                                {posTotal} un.
                              </span>

                              <button
                                onClick={e => { e.stopPropagation(); handleToggleControlMode(p.storageObjectId) }}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1",
                                  p.stockControlMode === "vinculado_saldo"
                                    ? "bg-blue-950/70 border-blue-700/60 text-blue-300 hover:bg-blue-900"
                                    : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                                )}
                                title="Clique para alternar o modo de controle"
                              >
                                {p.stockControlMode === "vinculado_saldo" ? (
                                  <><Lock size={9} /> Saldo Obrig.</>
                                ) : "Livre"}
                              </button>

                              <button
                                onClick={e => { e.stopPropagation(); handleUnlink(p.storageObjectId) }}
                                className="p-1 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                                title="Desvincular"
                              >
                                <Trash2 size={13} />
                              </button>

                              <span className="text-[10px] text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                                {isComp ? "Ver relação →" : "Ver canal →"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>{participants.length} estrutura(s) mapeada(s) · Sistema {system.code}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            Concluir
          </button>
        </div>
      </div>

      {/* Sub-modal de inserção/edição de Paletes (G300 MapeamentoItemModal) */}
      {isItemModalOpen && fakeConfig && inspectingParticipant && (
        <MapeamentoItemModal
          isOpen={isItemModalOpen}
          onClose={() => {
            setIsItemModalOpen(false)
            setEditingItem(null)
          }}
          onSave={handleSaveModalItems}
          config={fakeConfig}
          posicao={inspectingDisplayName}
          posicoesDisponiveis={[inspectingDisplayName]}
          nivelInicial={itemCoords.lvl}
          profundidadeInicial={itemCoords.prof}
          levelLabel={resolvedLevelsConfig.items[itemCoords.lvl - 1]?.identifier}
          depthLabel={resolvedDepthConfig.items[itemCoords.prof - 1]?.identifier}
          itemParaEditar={editingItem}
          batchCoords={batchCoords}
          availableStocks={!isInspectingOrigin ? availableStocks : []}
          enforceStockLimit={enforceDriveStockLimit}
        />
      )}
    </div>
  )
}
