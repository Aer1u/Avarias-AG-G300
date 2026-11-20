// ============================================================
// NEXUS ERP — MapLayers / ViewerDriveInModal.tsx
// Modal de Posição / Drive-In / Compartimento do Workspace
// Integrado ao motor de conservação de saldo (systemBalanceService)
// e isolado das tabelas legadas do módulo G300.
// ============================================================

"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MapPin, Printer, X, AlertCircle, Package } from "lucide-react"
import type { MapObject } from "../MapLibrary/types"
import type { DimensionConfig } from "../MapLibrary/dimensionsTypes"
import {
  DEFAULT_G300_LEVELS_CONFIG,
  DEFAULT_G300_DEPTH_CONFIG,
  generateDimensionItems,
} from "../MapLibrary/dimensionManager"
import { MapeamentoDriveInGrid } from "@/components/mapeamentos/MapeamentoDriveInGrid"
import { MapeamentoItemModal } from "@/components/mapeamentos/MapeamentoItemModal"
import CompartmentRelationView from "./CompartmentRelationView"
import { useSystemStore } from "../Systems/useSystemStore"
import {
  getLocalItems,
  saveLocalItems,
  type MapeamentoConfig,
  type MapeamentoItem,
} from "@/lib/mapeamentosStorage"
import {
  fetchAndSyncSystemBalances,
  getOriginObjectId,
  getSystemBalanceSnapshot,
  getAvailableStocksFromOrigin,
  applyNonOriginPositionChange,
  syncSupabaseUniversalBalances,
} from "../Systems/systemBalanceService"
import {
  hydratePositionKeyFromSupabase,
  persistPositionItemsToSupabase,
} from "@/lib/workspaceItemsSync"

interface ChannelInfo {
  id: string
  code: string
  name: string
  laneIndex?: number
  levels?: number
  depth?: number
  capacity?: number
  occupancy?: number
  status?: string
}

interface ViewerDriveInModalProps {
  isOpen: boolean
  onClose: () => void
  object: MapObject | null
  initialChannelId?: string
  isAdmin: boolean
  workspaceId?: string
  allObjects?: MapObject[]
  levelsConfig?: DimensionConfig
  depthConfig?: DimensionConfig
}

export default function ViewerDriveInModal({
  isOpen,
  onClose,
  object,
  initialChannelId,
  isAdmin,
  workspaceId,
  allObjects = [],
  levelsConfig: mapLevelsConfig = DEFAULT_G300_LEVELS_CONFIG,
  depthConfig: mapDepthConfig = DEFAULT_G300_DEPTH_CONFIG,
}: ViewerDriveInModalProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string>("")
  const [isEditMode, setIsEditMode] = useState(false)
  const [itemsVersion, setItemsVersion] = useState(0)
  const [loading, setLoading] = useState(false)
  const [balanceError, setBalanceError] = useState<string>("")

  // Estado do sub-modal MapeamentoItemModal (para Drive-Ins)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MapeamentoItem | null>(null)
  const [editingSlotItems, setEditingSlotItems] = useState<MapeamentoItem[] | null>(null)
  const [itemCoords, setItemCoords] = useState<{ lvl: number; prof: number }>({
    lvl: 1,
    prof: 1,
  })
  const [batchCoords, setBatchCoords] = useState<{ lvl: number; prof: number }[] | null>(null)

  const { systems } = useSystemStore(workspaceId)
  const isCompartment = object?.type === "compartment"

  // Sistema e Participante vinculados a este objeto no Workspace
  const { linkedSystem, linkedParticipant } = useMemo(() => {
    if (!object) return { linkedSystem: undefined, linkedParticipant: undefined }
    const stockSysRef = String(object.props?.stockSystemRef || "")
    const sys =
      systems.find(
        (s) =>
          s.originStorageId === object.id ||
          s.participants?.some((p) => p.storageObjectId === object.id)
      ) ||
      (stockSysRef
        ? systems.find((s) => s.code === stockSysRef || s.id === stockSysRef)
        : undefined)
    const part = sys?.participants?.find((p) => p.storageObjectId === object.id)
    return { linkedSystem: sys, linkedParticipant: part }
  }, [object, systems])

  // Chave de armazenamento isolada do G300
  const objectMapeamentoKey = useMemo(() => {
    if (!object) return ""
    if (linkedSystem) {
      return `sys_${linkedSystem.id}_${object.id}`
    }
    if (isCompartment) {
      return `comp_${workspaceId || "lab"}_${object.id}`
    }
    return `ws_${workspaceId || "lab"}_${object.id}`
  }, [object, linkedSystem, isCompartment, workspaceId])

  const handleClose = useCallback(() => {
    setIsEditMode(false)
    setBalanceError("")
    setIsItemModalOpen(false)
    setEditingItem(null)
    setEditingSlotItems(null)
    setBatchCoords(null)
    setSelectedChannelId("")
    onClose()
  }, [onClose])

  // Sincroniza registros -> saldo na Origem (Chão) ou hidrata posição livre ao abrir
  useEffect(() => {
    if (!isOpen || !object) return
    let cancelled = false
    Promise.resolve()
      .then(async () => {
        if (cancelled) return
        setLoading(true)
        setBalanceError("")
        if (linkedSystem) {
          await fetchAndSyncSystemBalances(linkedSystem)
        } else {
          await hydratePositionKeyFromSupabase(objectMapeamentoKey, workspaceId)
        }
      })
      .then(() => {
        if (!cancelled) {
          setItemsVersion((v) => v + 1)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, object, linkedSystem, objectMapeamentoKey, workspaceId])

  // Extrai canais cadastrados no drive (nunca para compartimento)
  const channels: ChannelInfo[] = useMemo(() => {
    if (isCompartment) return []
    if (!object?.props?.channels || !Array.isArray(object.props.channels)) {
      return []
    }
    return object.props.channels as ChannelInfo[]
  }, [object, isCompartment])

  // Canal efetivamente selecionado (derivado de forma segura sem setState em useEffect)
  const effectiveSelectedChannelId = useMemo(() => {
    if (selectedChannelId && channels.some((c) => (c.code || c.id) === selectedChannelId)) {
      return selectedChannelId
    }
    if (initialChannelId) {
      return initialChannelId
    }
    if (channels.length > 0) {
      return String(channels[0].code || channels[0].id)
    }
    return String(object?.props?.code || object?.label || object?.id || "")
  }, [selectedChannelId, channels, initialChannelId, object])

  // Canal atualmente selecionado
  const currentChannel = useMemo(() => {
    return (
      channels.find(
        (c) => c.code === effectiveSelectedChannelId || c.id === effectiveSelectedChannelId
      ) || null
    )
  }, [channels, effectiveSelectedChannelId])

  // Nome fiel à nomenclatura do objeto
  const objectDisplayName = useMemo<string>(() => {
    if (!object) return ""
    return String(object.label || object.props?.label || object.props?.code || object.id || "")
  }, [object])

  // Código efetivo da posição / canal para persistência e filtro
  const effectivePositionCode = useMemo<string>(() => {
    if (currentChannel) {
      return String(currentChannel.code || currentChannel.name || effectiveSelectedChannelId)
    }
    return String(object?.props?.code || object?.label || object?.id || "")
  }, [currentChannel, effectiveSelectedChannelId, object])

  const positionDisplayName = useMemo<string>(() => {
    if (channels.length > 1 && currentChannel) {
      return `${objectDisplayName} · ${currentChannel.name || effectivePositionCode}`
    }
    return objectDisplayName || effectivePositionCode
  }, [channels.length, currentChannel, objectDisplayName, effectivePositionCode])

  const levelCount = Math.max(1, Number(object?.props?.levels || currentChannel?.levels) || 4)
  const depthCount = Math.max(1, Number(object?.props?.depth || currentChannel?.depth) || 4)
  const capacity = levelCount * depthCount

  // Nomenclatura específica DESTE objeto (ou fallback do mapa)
  const resolvedLevelsConfig: DimensionConfig = useMemo(() => {
    const cfg =
      (object?.props?.levelsConfig as DimensionConfig | undefined) || mapLevelsConfig
    return {
      ...cfg,
      defaultCount: levelCount,
      items: generateDimensionItems(
        levelCount,
        cfg.sequenceType,
        cfg.orientation,
        cfg.prefix,
        cfg.suffix,
        cfg.paddingDigits,
        cfg.customValues
      ),
    }
  }, [object?.props?.levelsConfig, mapLevelsConfig, levelCount])

  const resolvedDepthConfig: DimensionConfig = useMemo(() => {
    const cfg =
      (object?.props?.depthConfig as DimensionConfig | undefined) || mapDepthConfig
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
  }, [object?.props?.depthConfig, mapDepthConfig, depthCount])

  const levelRangeLabel = useMemo(() => {
    const items = resolvedLevelsConfig.items
    if (items.length === 0) return `1-${levelCount}`
    if (items.length === 1) return items[0].identifier
    return `${items[0].identifier}-${items[items.length - 1].identifier}`
  }, [resolvedLevelsConfig, levelCount])

  const depthRangeLabel = useMemo(() => {
    const items = resolvedDepthConfig.items
    if (items.length === 0) return `1-${depthCount}`
    if (items.length === 1) return items[0].identifier
    return `${items[0].identifier}-${items[items.length - 1].identifier}`
  }, [resolvedDepthConfig, depthCount])

  // Configuração visual para o MapeamentoDriveInGrid
  const driveConfig: MapeamentoConfig = useMemo(
    () => ({
      id: objectMapeamentoKey || "ws_drive",
      nome: linkedSystem ? linkedSystem.name : "Drive-In",
      descricao: linkedSystem
        ? `Vinculado ao sistema ${linkedSystem.name}`
        : "Estrutura do mapa",
      categoria: linkedSystem ? linkedSystem.name : "Workspace",
      cor: "blue",
      icone: "Box",
      camposPersonalizados: [],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    }),
    [objectMapeamentoKey, linkedSystem]
  )

  const originObjectId = useMemo(
    () => (linkedSystem ? getOriginObjectId(linkedSystem) : null),
    [linkedSystem]
  )

  const isOriginObject = Boolean(object && originObjectId && originObjectId === object.id)

  const enforceStockLimit = Boolean(
    linkedSystem &&
      !isOriginObject &&
      (linkedParticipant?.stockControlMode === "vinculado_saldo" ||
        (!linkedParticipant?.stockControlMode &&
          linkedSystem.defaultControlMode === "vinculado_saldo"))
  )

  const balanceSnapshot = useMemo(() => {
    void itemsVersion
    if (!linkedSystem) return null
    return getSystemBalanceSnapshot(linkedSystem)
  }, [linkedSystem, itemsVersion])

  const availableStocks = useMemo(() => {
    void itemsVersion
    if (!linkedSystem || isOriginObject) return []
    return getAvailableStocksFromOrigin(linkedSystem)
  }, [linkedSystem, isOriginObject, itemsVersion])

  // Todos os itens armazenados neste objeto (todos os canais do objeto)
  const allObjectItems: MapeamentoItem[] = useMemo(() => {
    void itemsVersion
    if (!objectMapeamentoKey) return []
    return getLocalItems().filter((it) => it.mapeamentoId === objectMapeamentoKey)
  }, [objectMapeamentoKey, itemsVersion])

  // Itens do canal ativo (para Drive-Ins com múltiplos canais)
  const visibleDriveItems: MapeamentoItem[] = useMemo(() => {
    if (channels.length <= 1) return allObjectItems
    const channelCodes = new Set(channels.map((c) => String(c.code || c.name || c.id)))
    const isFirstChannel =
      Boolean(channels[0]) &&
      (channels[0].code || channels[0].id) === effectiveSelectedChannelId
    return allObjectItems.filter((it) => {
      if (it.posicao === effectivePositionCode) return true
      return isFirstChannel && !channelCodes.has(it.posicao)
    })
  }, [allObjectItems, channels, effectiveSelectedChannelId, effectivePositionCode])

  const occupiedCount = useMemo(() => {
    const slots = new Set<string>()
    visibleDriveItems.forEach((it) => {
      slots.add(`${it.nivel}_${it.profundidade}`)
    })
    return slots.size
  }, [visibleDriveItems])

  const commitObjectItems = useCallback(
    (nextObjectItems: MapeamentoItem[]): boolean => {
      if (!object || !objectMapeamentoKey) return false
      setBalanceError("")
      const currentObjectItems = getLocalItems().filter(
        (it) => it.mapeamentoId === objectMapeamentoKey
      )

      if (linkedSystem && !isOriginObject) {
        const res = applyNonOriginPositionChange(
          linkedSystem,
          object.id,
          currentObjectItems,
          nextObjectItems,
          { enforceStockLimit }
        )
        if (!res.ok) {
          setBalanceError(res.errorMessage)
          return false
        }
      } else {
        const others = getLocalItems().filter((it) => it.mapeamentoId !== objectMapeamentoKey)
        saveLocalItems([...others, ...nextObjectItems])
        persistPositionItemsToSupabase(
          objectMapeamentoKey,
          nextObjectItems,
          workspaceId || linkedSystem?.workspaceId
        ).catch(() => {})
        if (linkedSystem) {
          syncSupabaseUniversalBalances(linkedSystem).catch(() => {})
        }
      }
      setItemsVersion((v) => v + 1)
      return true
    },
    [object, objectMapeamentoKey, linkedSystem, isOriginObject, enforceStockLimit, workspaceId]
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
    setEditingSlotItems(null)
    setIsItemModalOpen(true)
  }

  const handleEditItem = (updated: MapeamentoItem) => {
    const currentObjectItems = getLocalItems().filter(
      (it) => it.mapeamentoId === objectMapeamentoKey
    )
    const nextObjectItems =
      updated.quantidade > 0
        ? currentObjectItems.map((it) => (it.id === updated.id ? updated : it))
        : currentObjectItems.filter((it) => it.id !== updated.id)
    commitObjectItems(nextObjectItems)
  }

  const handleEditSlot = (slotItems: MapeamentoItem[]) => {
    if (slotItems.length === 0) return
    setBalanceError("")
    setEditingItem(null)
    setEditingSlotItems(slotItems)
    setItemCoords({ lvl: slotItems[0].nivel, prof: slotItems[0].profundidade })
    setBatchCoords(null)
    setIsItemModalOpen(true)
  }

  const handleSaveModalItems = (saved: MapeamentoItem[] | MapeamentoItem) => {
    const savedArr = Array.isArray(saved) ? saved : [saved]
    const formatted = savedArr.map((it) => ({
      ...it,
      mapeamentoId: objectMapeamentoKey,
      posicao: effectivePositionCode || object?.label || object?.id || "POS",
    }))

    const currentObjectItems = getLocalItems().filter(
      (it) => it.mapeamentoId === objectMapeamentoKey
    )
    const replacedIds = new Set<string>([
      ...formatted.map((it) => it.id),
      ...(editingSlotItems ? editingSlotItems.map((it) => it.id) : []),
    ])
    const remaining = currentObjectItems.filter((it) => !replacedIds.has(it.id))
    const ok = commitObjectItems([...remaining, ...formatted])
    if (ok) {
      setIsItemModalOpen(false)
      setEditingItem(null)
      setEditingSlotItems(null)
      setBatchCoords(null)
    }
  }

  const handleDeleteItem = (itemId: string) => {
    const currentObjectItems = getLocalItems().filter(
      (it) => it.mapeamentoId === objectMapeamentoKey
    )
    const nextObjectItems = currentObjectItems.filter((it) => it.id !== itemId)
    commitObjectItems(nextObjectItems)
  }

  const handleSwapItems = (
    source: { lvl: number; d: number },
    target: { lvl: number; d: number }
  ) => {
    const all = getLocalItems()
    const belongsToChannel = (it: MapeamentoItem) => {
      if (it.mapeamentoId !== objectMapeamentoKey) return false
      if (channels.length <= 1) return true
      const channelCodes = new Set(channels.map((c) => String(c.code || c.name || c.id)))
      const isFirstChannel =
        Boolean(channels[0]) &&
        (channels[0].code || channels[0].id) === effectiveSelectedChannelId
      return (
        it.posicao === effectivePositionCode ||
        (isFirstChannel && !channelCodes.has(it.posicao))
      )
    }

    const srcItems = all.filter(
      (it) => belongsToChannel(it) && it.nivel === source.lvl && it.profundidade === source.d
    )
    const tgtItems = all.filter(
      (it) => belongsToChannel(it) && it.nivel === target.lvl && it.profundidade === target.d
    )
    const others = all.filter(
      (it) =>
        !(belongsToChannel(it) && it.nivel === source.lvl && it.profundidade === source.d) &&
        !(belongsToChannel(it) && it.nivel === target.lvl && it.profundidade === target.d)
    )
    const nextAll = [
      ...srcItems.map((it) => ({ ...it, nivel: target.lvl, profundidade: target.d })),
      ...tgtItems.map((it) => ({ ...it, nivel: source.lvl, profundidade: source.d })),
      ...others,
    ]
    saveLocalItems(nextAll)
    persistPositionItemsToSupabase(
      objectMapeamentoKey,
      nextAll.filter((it) => it.mapeamentoId === objectMapeamentoKey),
      workspaceId || linkedSystem?.workspaceId
    ).catch(() => {})
    setItemsVersion((v) => v + 1)
  }

  if (!isOpen || !object) return null

  const isOverflow = occupiedCount > capacity

  return (
    <>
      <AnimatePresence>
        <div key="viewer-drivein-overlay" className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-6 transition-colors">
          {/* Backdrop com blur escuro */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Principal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-7xl max-h-[96vh] md:max-h-[92vh] rounded-3xl md:rounded-[3rem] bg-slate-900 p-4 sm:p-6 md:p-8 shadow-2xl border border-slate-800 flex flex-col overflow-y-auto md:overflow-hidden custom-scrollbar text-white"
          >
            {/* ── HEADER ────────────────────────────────────────────────────── */}
            <div className="flex flex-row items-center justify-between gap-2 mb-3 md:mb-4 shrink-0">
              <div className="flex items-center gap-3 md:gap-4">
                <div
                  className={`h-10 w-10 md:h-14 md:w-14 rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-xl transition-all shrink-0 ${
                    isCompartment
                      ? "bg-amber-600 shadow-amber-900/30"
                      : "bg-blue-600 shadow-blue-900/30"
                  }`}
                >
                  {isCompartment ? (
                    <Package size={18} className="md:w-6 md:h-6" />
                  ) : (
                    <MapPin size={18} className="md:w-6 md:h-6" />
                  )}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base md:text-3xl font-light text-white transition-colors leading-tight font-mono">
                      {objectDisplayName || effectivePositionCode}
                    </h3>
                    {!isCompartment && currentChannel && channels.length > 1 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {currentChannel.name || currentChannel.code}
                      </span>
                    )}
                    {!isCompartment && Boolean(object?.props?.code) && String(object?.props?.code) !== objectDisplayName && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800/80 text-amber-300 border border-slate-700">
                        {String(object?.props?.code)}
                      </span>
                    )}
                    {isCompartment && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Espaço Aberto
                      </span>
                    )}
                    {linkedSystem && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {linkedSystem.icon} {linkedSystem.name}
                        {isOriginObject ? " · ORIGEM / CHÃO" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 md:mt-1 flex-wrap">
                    {isCompartment ? (
                      <span className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-[0.15em]">
                        Armazenamento Aberto • Sem Nível / Profundidade
                      </span>
                    ) : (
                      <>
                        <span className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-[0.15em]">
                          {occupiedCount} / {capacity} PALETES • {levelCount}{" "}
                          {(resolvedLevelsConfig.displayName || "NÍVEIS").toUpperCase()} ({levelRangeLabel}) •{" "}
                          {depthCount} {(resolvedDepthConfig.displayName || "PROF.").toUpperCase()} ({depthRangeLabel})
                        </span>
                        {isOverflow && (
                          <span className="flex items-center gap-1 rounded-full bg-red-900/40 px-2 py-0.5 text-[9px] font-semibold uppercase text-red-400 border border-red-800/60">
                            <AlertCircle size={10} /> Excesso
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Direita: Ações */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  title="Imprimir Mapa de Mapeamento"
                  className="h-9 px-3 md:h-11 md:px-5 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 transition-all border bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs font-semibold uppercase tracking-wider shadow-sm"
                >
                  <Printer size={15} />
                  <span className="hidden sm:inline">Imprimir Mapa</span>
                </button>

                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setIsEditMode((v) => !v)}
                    title="Habilitar Modo Edição e Movimentação"
                    className={`h-9 px-3 md:h-11 md:px-6 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 transition-all border text-xs font-bold uppercase tracking-wider ${
                      isEditMode
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-600/30"
                        : "bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-600/30"
                    }`}
                  >
                    <span>{isEditMode ? "Concluir" : "Editar"}</span>
                  </button>
                ) : (
                  <span className="h-9 px-3 md:h-11 md:px-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-1.5 border bg-indigo-950/60 text-indigo-400 border-indigo-800/50 text-[11px] font-bold uppercase tracking-wider">
                    <span>👁️</span>
                    <span className="hidden sm:inline">Visualização</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleClose}
                  className="h-9 w-9 md:h-11 md:w-11 rounded-xl md:rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all border border-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ── BARRA DE CONSERVAÇÃO DE SALDO DO SISTEMA (para Drive-In vinculado) ── */}
            {!isCompartment && linkedSystem && balanceSnapshot && (
              <div className="mb-3 px-4 py-2 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
                <div className="flex flex-wrap items-center gap-3 font-mono">
                  <span className="text-slate-300">
                    Entradas - Saídas ={" "}
                    <strong className="text-emerald-400">{balanceSnapshot.totalSystemNet} un.</strong>
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="text-amber-300">
                    Disponível no Chão (Origem): <strong>{balanceSnapshot.totalOrigin} un.</strong>
                  </span>
                  <span className="text-blue-300">
                    Alocado em Posições: <strong>{balanceSnapshot.totalAllocated} un.</strong>
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {enforceStockLimit
                    ? "Alocações consomem saldo do Chão; remoções devolvem ao Chão"
                    : "Modo livre (sem bloqueio de saldo)"}
                </span>
              </div>
            )}

            {balanceError && (
              <div className="mb-3 flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-rose-950/70 border border-rose-700/60 text-xs text-rose-200 shrink-0">
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

            {/* ── BARRA DE SELEÇÃO DE CANAIS (se houver múltiplos) ───────────── */}
            {channels.length > 0 && (
              <div className="flex items-center gap-1.5 pb-3 border-b border-slate-800 overflow-x-auto custom-scrollbar shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pr-2 shrink-0">
                  Canais do Drive:
                </span>
                {channels.map((chan) => {
                  const isSelected = (chan.code || chan.id) === effectiveSelectedChannelId
                  return (
                    <button
                      key={chan.id}
                      type="button"
                      onClick={() => setSelectedChannelId(chan.code || chan.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shrink-0 ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20"
                          : "bg-slate-800/70 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <span className="text-sm">📥</span>
                      <span className="font-mono">{chan.code}</span>
                      {chan.name && <span className="opacity-70 text-[10px]">({chan.name})</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── CORPO: RELAÇÃO DO COMPARTIMENTO OU GRID DO DRIVE-IN ──────── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1 pt-2">
              {isCompartment ? (
                <CompartmentRelationView
                  mapeamentoId={objectMapeamentoKey}
                  positionLabel={String(object.props?.label || object.label || effectivePositionCode)}
                  canEdit={isAdmin && isEditMode}
                  onItemsChanged={() => setItemsVersion((v) => v + 1)}
                  system={linkedSystem}
                  objectId={object.id}
                  allObjects={allObjects}
                  stockControlMode={linkedParticipant?.stockControlMode}
                />
              ) : loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs gap-3">
                  <span className="animate-spin text-2xl">⏳</span>
                  <span>Sincronizando saldos do Drive-In...</span>
                </div>
              ) : (
                <MapeamentoDriveInGrid
                  positionId={positionDisplayName}
                  items={visibleDriveItems}
                  capacity={capacity}
                  levelCount={levelCount}
                  startLevel={1}
                  levelsConfig={resolvedLevelsConfig}
                  depthConfig={resolvedDepthConfig}
                  isBlocked={false}
                  observation={(object.props?.observation as string) || ""}
                  config={driveConfig}
                  isEditModeActive={isAdmin && isEditMode}
                  setIsEditModeActive={setIsEditMode}
                  onAddItem={handleAddItem}
                  onEditItem={handleEditItem}
                  onEditSlot={handleEditSlot}
                  onDeleteItem={handleDeleteItem}
                  onSwapItems={handleSwapItems}
                  isLoggedIn={isAdmin}
                />
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Sub-modal de inserção / edição de Paletes (Drive-In) */}
      {isItemModalOpen && !isCompartment && (
        <MapeamentoItemModal
          isOpen={isItemModalOpen}
          onClose={() => {
            setIsItemModalOpen(false)
            setEditingItem(null)
            setEditingSlotItems(null)
            setBatchCoords(null)
          }}
          onSave={handleSaveModalItems}
          config={driveConfig}
          posicao={positionDisplayName}
          posicoesDisponiveis={[positionDisplayName]}
          nivelInicial={itemCoords.lvl}
          profundidadeInicial={itemCoords.prof}
          levelLabel={resolvedLevelsConfig.items[itemCoords.lvl - 1]?.identifier}
          depthLabel={resolvedDepthConfig.items[itemCoords.prof - 1]?.identifier}
          itemParaEditar={editingItem}
          itensParaEditar={editingSlotItems}
          batchCoords={batchCoords}
          availableStocks={!isOriginObject ? availableStocks : []}
          enforceStockLimit={enforceStockLimit}
        />
      )}
    </>
  )
}
