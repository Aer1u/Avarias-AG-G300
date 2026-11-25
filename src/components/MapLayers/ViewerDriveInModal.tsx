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
import { ensureDriveChannels } from "../MapLibrary/spatialContainment"
import { MapeamentoDriveInGrid } from "@/components/mapeamentos/MapeamentoDriveInGrid"
import { MapeamentoItemModal } from "@/components/mapeamentos/MapeamentoItemModal"
import CompartmentRelationView from "./CompartmentRelationView"
import DriveIn3DPreviewFrame from "./DriveIn3DPreviewFrame"
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
  hydrateSystemItemsFromSupabase,
  persistPositionItemsToSupabase,
} from "@/lib/workspaceItemsSync"
import {
  filterItemsForDriveChannel,
  ITEMS_UPDATED_EVENT,
} from "@/lib/driveOccupancy"
import { isOpenSystem } from "@/lib/systemVisuals"
import { LocalErrorBoundary } from "../LocalErrorBoundary"

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
  stockControlMode?: "livre" | "vinculado_saldo"
  stockSystemRef?: string
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

  // Extrai canais cadastrados ou derivados dos vãos do drive (nunca para compartimento)
  const channels: ChannelInfo[] = useMemo(() => {
    if (!object || isCompartment) return []
    return ensureDriveChannels(object)
  }, [object, isCompartment])

  // Canal único aberto no modal (somente o canal selecionado)
  const currentChannel = useMemo(() => {
    if (channels.length === 0) return null
    if (initialChannelId) {
      const byIdOrCode = channels.find(
        (c) => c.id === initialChannelId || c.code === initialChannelId
      )
      if (byIdOrCode) return byIdOrCode
      const byName = channels.find((c) => c.name === initialChannelId)
      if (byName) return byName
    }
    return channels[0]
  }, [channels, initialChannelId])

  const findSystemByRef = useCallback(
    (ref: string) => {
      const norm = ref.trim().toUpperCase()
      if (!norm) return undefined
      return systems.find(
        (s) =>
          s.id.toUpperCase() === norm ||
          s.code.trim().toUpperCase() === norm ||
          s.name.trim().toUpperCase() === norm
      )
    },
    [systems]
  )

  // Sistema e Participante vinculados a este canal (ou objeto) no Workspace
  const { linkedSystem, linkedParticipant, channelForceFree } = useMemo(() => {
    if (!object) {
      return { linkedSystem: undefined, linkedParticipant: undefined, channelForceFree: false }
    }

    const originSys = systems.find((s) => s.originStorageId === object.id)
    const participantSys = systems.find((s) =>
      s.participants?.some((p) => p.storageObjectId === object.id)
    )
    const objMode = object.props?.stockControlMode as "livre" | "vinculado_saldo" | undefined
    const objSysRef = String(object.props?.stockSystemRef || "").trim()

    if (!isCompartment && currentChannel) {
      const chanMode = currentChannel.stockControlMode
      const chanSysRef = String(currentChannel.stockSystemRef || "").trim()

      // 1) Se o canal aponta diretamente para um sistema (inclusive Sistema Livre)
      if (chanSysRef) {
        const sys = findSystemByRef(chanSysRef)
        if (sys) {
          const part = sys.participants?.find((p) => p.storageObjectId === object.id)
          return {
            linkedSystem: sys,
            linkedParticipant: part,
            channelForceFree: chanMode === "livre" || isOpenSystem(sys),
          }
        }
      }

      // 2) Canal explicitamente configurado como "livre" sem sistema vinculado SEMPRE sobrepõe o Drive-In geral
      if (chanMode === "livre") {
        return { linkedSystem: undefined, linkedParticipant: undefined, channelForceFree: true }
      }

      // 3) Canal explicitamente configurado como "vinculado_saldo" sem sistema selecionado: não herda o sistema geral do Drive-In
      if (chanMode === "vinculado_saldo") {
        return { linkedSystem: undefined, linkedParticipant: undefined, channelForceFree: true }
      }
    }

    // Fallback para configuração geral do Drive-In / Objeto
    if (objSysRef) {
      const sys = findSystemByRef(objSysRef)
      if (sys) {
        const part = sys.participants?.find((p) => p.storageObjectId === object.id)
        return {
          linkedSystem: sys,
          linkedParticipant: part,
          channelForceFree: objMode === "livre" || isOpenSystem(sys),
        }
      }
    }

    if (objMode === "livre" && !originSys) {
      return { linkedSystem: undefined, linkedParticipant: undefined, channelForceFree: true }
    }

    const sys = originSys || participantSys
    const part = sys?.participants?.find((p) => p.storageObjectId === object.id)
    return {
      linkedSystem: sys,
      linkedParticipant: part,
      channelForceFree: Boolean(sys && isOpenSystem(sys)),
    }
  }, [object, systems, isCompartment, currentChannel, findSystemByRef])

  const isLinkedOpenSystem = isOpenSystem(linkedSystem)

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
          if (isLinkedOpenSystem) {
            await hydrateSystemItemsFromSupabase(linkedSystem)
          } else {
            await fetchAndSyncSystemBalances(linkedSystem)
          }
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
  }, [isOpen, object, linkedSystem, isLinkedOpenSystem, objectMapeamentoKey, workspaceId])

  // Mantém a visualização sincronizada quando itens são hidratados ou editados externamente
  useEffect(() => {
    if (!isOpen) return
    const onItemsUpdated = () => setItemsVersion((v) => v + 1)
    window.addEventListener(ITEMS_UPDATED_EVENT, onItemsUpdated)
    return () => window.removeEventListener(ITEMS_UPDATED_EVENT, onItemsUpdated)
  }, [isOpen])

  // Nome fiel à nomenclatura do objeto
  const objectDisplayName = useMemo<string>(() => {
    if (!object) return ""
    return String(object.label || object.props?.label || object.props?.code || object.id || "")
  }, [object])

  // Código efetivo da posição / canal para persistência e filtro
  const effectivePositionCode = useMemo<string>(() => {
    if (currentChannel) {
      return String(currentChannel.code || currentChannel.name || currentChannel.id)
    }
    return String(object?.props?.code || object?.label || object?.id || "")
  }, [currentChannel, object])

  const positionDisplayName = useMemo<string>(() => {
    if (currentChannel) {
      const chanName = currentChannel.name || effectivePositionCode
      return objectDisplayName ? `${objectDisplayName} · ${chanName}` : chanName
    }
    return objectDisplayName || effectivePositionCode
  }, [currentChannel, objectDisplayName, effectivePositionCode])

  const posicoesDisponiveisList = useMemo<string[]>(
    () => (positionDisplayName ? [positionDisplayName] : []),
    [positionDisplayName]
  )

  const levelCount = Math.max(1, Number(currentChannel?.levels || object?.props?.levels) || 4)
  const depthCount = Math.max(1, Number(currentChannel?.depth || object?.props?.depth) || 4)
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
    () => (linkedSystem && !isLinkedOpenSystem ? getOriginObjectId(linkedSystem) : null),
    [linkedSystem, isLinkedOpenSystem]
  )

  const isOriginObject = Boolean(
    object && !isLinkedOpenSystem && originObjectId && originObjectId === object.id
  )

  const enforceStockLimit = useMemo(() => {
    if (!linkedSystem || isLinkedOpenSystem || isOriginObject || channelForceFree) return false
    if (!isCompartment && currentChannel?.stockControlMode === "livre") {
      return false
    }
    if (!isCompartment && currentChannel?.stockControlMode === "vinculado_saldo") {
      return true
    }
    if (object?.props?.stockControlMode === "vinculado_saldo") {
      return true
    }
    if (object?.props?.stockControlMode === "livre") {
      return false
    }
    if (linkedParticipant?.stockControlMode === "livre") {
      return false
    }
    if (linkedParticipant?.stockControlMode === "vinculado_saldo") {
      return true
    }
    return Boolean(currentChannel?.stockSystemRef || object?.props?.stockSystemRef) || true
  }, [
    linkedSystem,
    isLinkedOpenSystem,
    isOriginObject,
    channelForceFree,
    isCompartment,
    currentChannel,
    object,
    linkedParticipant,
  ])

  const balanceSnapshot = useMemo(() => {
    void itemsVersion
    if (!linkedSystem || isLinkedOpenSystem) return null
    return getSystemBalanceSnapshot(linkedSystem)
  }, [linkedSystem, isLinkedOpenSystem, itemsVersion])

  const availableStocks = useMemo(() => {
    void itemsVersion
    if (!linkedSystem || isLinkedOpenSystem || isOriginObject) return []
    return getAvailableStocksFromOrigin(linkedSystem)
  }, [linkedSystem, isLinkedOpenSystem, isOriginObject, itemsVersion])

  // Todos os itens armazenados neste objeto (todos os canais do objeto)
  const allObjectItems: MapeamentoItem[] = useMemo(() => {
    void itemsVersion
    if (!objectMapeamentoKey) return []
    return getLocalItems().filter((it) => it.mapeamentoId === objectMapeamentoKey)
  }, [objectMapeamentoKey, itemsVersion])

  // Itens do canal ativo (somente o canal selecionado, sem colisão quando nomes se repetem)
  const visibleDriveItems: MapeamentoItem[] = useMemo(() => {
    return filterItemsForDriveChannel(
      allObjectItems,
      currentChannel as Parameters<typeof filterItemsForDriveChannel>[1],
      channels as Parameters<typeof filterItemsForDriveChannel>[2],
      objectDisplayName
    )
  }, [allObjectItems, channels, currentChannel, objectDisplayName])

  const occupiedCount = useMemo(() => {
    const slots = new Set<string>()
    visibleDriveItems.forEach((it) => {
      if ((Number(it.quantidade) || 0) <= 0) return
      slots.add(`${Number(it.nivel) || 1}_${Number(it.profundidade) || 1}`)
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

      if (linkedSystem && !isLinkedOpenSystem && !isOriginObject) {
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
        if (linkedSystem && !isLinkedOpenSystem) {
          syncSupabaseUniversalBalances(linkedSystem).catch(() => {})
        }
      }
      setItemsVersion((v) => v + 1)
      return true
    },
    [
      object,
      objectMapeamentoKey,
      linkedSystem,
      isLinkedOpenSystem,
      isOriginObject,
      enforceStockLimit,
      workspaceId,
    ]
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

  const handleEditItem = (updated: MapeamentoItem): boolean => {
    const currentObjectItems = getLocalItems().filter(
      (it) => it.mapeamentoId === objectMapeamentoKey
    )
    const nextObjectItems =
      updated.quantidade > 0
        ? currentObjectItems.map((it) => (it.id === updated.id ? updated : it))
        : currentObjectItems.filter((it) => it.id !== updated.id)
    return commitObjectItems(nextObjectItems)
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

  const handleSaveModalItems = (saved: MapeamentoItem[] | MapeamentoItem): boolean => {
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
    return ok
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
    const objItems = all.filter((it) => it.mapeamentoId === objectMapeamentoKey)
    const channelIds = new Set(
      filterItemsForDriveChannel(
        objItems,
        currentChannel as Parameters<typeof filterItemsForDriveChannel>[1],
        channels as Parameters<typeof filterItemsForDriveChannel>[2],
        objectDisplayName
      ).map((it) => it.id)
    )
    const belongsToChannel = (it: MapeamentoItem) =>
      it.mapeamentoId === objectMapeamentoKey && channelIds.has(it.id)

    const now = new Date().toISOString()
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
      ...srcItems.map((it) => ({
        ...it,
        nivel: target.lvl,
        profundidade: target.d,
        atualizadoEm: now,
      })),
      ...tgtItems.map((it) => ({
        ...it,
        nivel: source.lvl,
        profundidade: source.d,
        atualizadoEm: now,
      })),
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
        <div key="viewer-drivein-overlay" className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-3 transition-colors">
          {/* Backdrop com blur escuro */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Principal (sem rolagem interna para o Grid do Canal) */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-7xl h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.5rem)] max-h-[880px] rounded-2xl md:rounded-3xl bg-slate-900 p-3 sm:p-5 md:p-6 shadow-2xl border border-slate-800 flex flex-col overflow-hidden text-white"
          >
            {/* ── HEADER ────────────────────────────────────────────────────── */}
            <div className="flex flex-row items-center justify-between gap-2 mb-2.5 sm:mb-3 shrink-0">
              <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
                <div
                  className={`h-9 w-9 md:h-11 md:w-11 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-xl transition-all shrink-0 ${
                    isCompartment
                      ? "bg-amber-600 shadow-amber-900/30"
                      : "bg-blue-600 shadow-blue-900/30"
                  }`}
                >
                  {isCompartment ? (
                    <Package size={18} className="md:w-5 md:h-5" />
                  ) : (
                    <MapPin size={18} className="md:w-5 md:h-5" />
                  )}
                </div>
                <div className="text-left min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base md:text-2xl font-light text-white transition-colors leading-tight font-mono truncate">
                      {objectDisplayName || effectivePositionCode}
                    </h3>
                    {!isCompartment && currentChannel && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/40 font-semibold">
                        {currentChannel.name || currentChannel.code}
                        {currentChannel.code && currentChannel.name !== currentChannel.code
                          ? ` · ${currentChannel.code}`
                          : ""}
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
                      <span
                        className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
                        style={{
                          backgroundColor: `${linkedSystem.color}22`,
                          borderColor: `${linkedSystem.color}66`,
                          color: "#ffffff",
                        }}
                      >
                        {linkedSystem.icon} {linkedSystem.name} ({linkedSystem.code})
                        {isLinkedOpenSystem
                          ? " · Sistema Livre"
                          : isOriginObject
                          ? " · ORIGEM / CHÃO"
                          : ""}
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
              <div className="flex items-center gap-2 shrink-0">
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

            {/* ── BARRA DE CONSERVAÇÃO DE SALDO DO SISTEMA (apenas para sistema com saldo) ── */}
            {!isCompartment && linkedSystem && !isLinkedOpenSystem && balanceSnapshot && (
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

            {!isCompartment && linkedSystem && isLinkedOpenSystem && (
              <div
                className="mb-3 px-4 py-2 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0"
                style={{
                  backgroundColor: `${linkedSystem.color}12`,
                  borderColor: `${linkedSystem.color}40`,
                }}
              >
                <span className="text-slate-200 font-medium flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: linkedSystem.color }}
                  />
                  <span>
                    <strong>{linkedSystem.name}</strong> ({linkedSystem.code}) — Sistema Livre sem registro de saldo
                  </span>
                </span>
                <span className="text-[10px] text-emerald-300 font-semibold">
                  Lançamento direto nas posições · Alimenta o Confronto
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

            {/* ── CORPO: RELAÇÃO DO COMPARTIMENTO OU GRID DO CANAL SELECIONADO ──────── */}
            <div
              className={
                isCompartment
                  ? "flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 -mr-1 pt-2"
                  : "flex-1 min-h-0 overflow-hidden flex flex-col pt-1"
              }
            >
              <LocalErrorBoundary fallbackTitle="Erro ao carregar conteúdo da posição">
                {isCompartment ? (
                  <CompartmentRelationView
                    mapeamentoId={objectMapeamentoKey}
                    positionLabel={String(object.props?.label || object.label || effectivePositionCode)}
                    canEdit={isAdmin && isEditMode}
                    onItemsChanged={() => setItemsVersion((v) => v + 1)}
                    system={linkedSystem}
                    objectId={object.id}
                    allObjects={allObjects}
                    workspaceId={workspaceId}
                    stockControlMode={
                      (object.props?.stockControlMode as "livre" | "vinculado_saldo" | undefined) ??
                      linkedParticipant?.stockControlMode
                    }
                  />
                ) : loading ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs gap-3">
                    <span className="animate-spin text-2xl">⏳</span>
                    <span>Sincronizando saldos do canal...</span>
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
                    isBlocked={currentChannel?.status === "bloqueado"}
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
                    fitToViewport={true}
                    sidePreview={
                      <LocalErrorBoundary compact fallbackTitle="Prévia 3D indisponível">
                        <DriveIn3DPreviewFrame
                          object={object}
                          channelId={currentChannel?.id || currentChannel?.code}
                          channelLabel={currentChannel?.name || currentChannel?.code}
                        />
                      </LocalErrorBoundary>
                    }
                  />
                )}
              </LocalErrorBoundary>
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
          posicoesDisponiveis={posicoesDisponiveisList}
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
