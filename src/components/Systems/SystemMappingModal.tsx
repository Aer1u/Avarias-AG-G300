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
import { persistPositionItemsToSupabase, hydrateSystemItemsFromSupabase } from "@/lib/workspaceItemsSync"
import { ensureDriveChannels } from "../MapLibrary/spatialContainment"
import { filterItemsForDriveChannel } from "@/lib/driveOccupancy"
import {
  isOpenSystem,
  getSystemMappedStats,
  getLinkedStructuresForSystem,
  resolveSystemForChannel,
  findSystemByRef,
  type LinkedStructureEntry,
} from "@/lib/systemVisuals"
import { cn } from "@/lib/utils"

interface SystemMappingModalProps {
  isOpen: boolean
  onClose: () => void
  system: BusinessSystem
  allObjects?: MapObject[]
  workspaceId?: string
  levelsConfig?: DimensionConfig
  depthConfig?: DimensionConfig
  onUpdateObject?: (id: string, partial: Partial<MapObject>) => void
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
  onUpdateObject,
}: SystemMappingModalProps) {
  const isOpenSys = isOpenSystem(system)
  const { updateSystem } = useSystemStore(workspaceId)
  const [selectedObjectId, setSelectedObjectId] = useState("")
  const [selectedLinkChannelId, setSelectedLinkChannelId] = useState<string>("__ALL__")
  const [role, setRole] = useState<StorageRole>("armazenamento")
  const [stockControlMode, setStockControlMode] = useState<StockControlMode>(
    isOpenSys ? "livre" : system.defaultControlMode
  )

  // Painel do DriveInGrid ao selecionar uma posição vinculada
  const [inspectingParticipant, setInspectingParticipant] = useState<StorageParticipantConfig | null>(null)
  const [inspectingObject, setInspectingObject] = useState<MapObject | null>(null)
  const [activeChannelIndex, setActiveChannelIndex] = useState(0)
  const [isEditModeActive, setIsEditModeActive] = useState(false)
  const [itemsVersion, setItemsVersion] = useState(0)

  // Sub-modal de Item / Palete do Canal (Estilo G300 MapeamentoItemModal)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MapeamentoItem | null>(null)
  const [itemCoords, setItemCoords] = useState<{ lvl: number; prof: number }>({ lvl: 1, prof: 1 })
  const [batchCoords, setBatchCoords] = useState<{ lvl: number; prof: number }[] | null>(null)
  const [balanceError, setBalanceError] = useState<string>("")

  // Sincroniza registros -> saldo da Origem (Chão) ao abrir (ou hidrata direto para Sistema Aberto)
  useEffect(() => {
    if (!isOpen) return
    let active = true
    const syncTask = isOpenSys
      ? hydrateSystemItemsFromSupabase(system)
      : fetchAndSyncSystemBalances(system)
    syncTask.then(() => {
      if (!active) return
      setBalanceError("")
      setItemsVersion((v) => v + 1)
    })
    return () => {
      active = false
    }
  }, [isOpen, system, isOpenSys])

  const balanceSnapshot = useMemo(() => {
    void itemsVersion
    return getSystemBalanceSnapshot(system)
  }, [system, itemsVersion])

  const mappedStats = useMemo(() => {
    void itemsVersion
    return getSystemMappedStats(system)
  }, [system, itemsVersion])

  const originObjectId = useMemo(
    () => (isOpenSys ? "" : getOriginObjectId(system)),
    [system, isOpenSys]
  )

  const availableStocks = useMemo(() => {
    void itemsVersion
    return isOpenSys ? [] : getAvailableStocksFromOrigin(system)
  }, [system, itemsVersion, isOpenSys])

  const linkedStructures = useMemo(() => {
    void itemsVersion
    return getLinkedStructuresForSystem(system, allObjects)
  }, [system, allObjects, itemsVersion])

  const selectedFormObject = useMemo(
    () => allObjects.find((o) => o.id === selectedObjectId) || null,
    [allObjects, selectedObjectId]
  )

  const selectedFormChannels = useMemo(() => {
    if (
      !selectedFormObject ||
      (selectedFormObject.type !== "drive_in" && selectedFormObject.type !== "drive_through")
    ) {
      return []
    }
    return ensureDriveChannels(selectedFormObject)
  }, [selectedFormObject])

  if (!isOpen) return null

  const participants = system.participants || []
  const linkedMapById = new Map(linkedStructures.map((e) => [e.storageObjectId, e]))
  // Mostra objetos ainda não totalmente vinculados (incluindo Drives com canais parciais)
  const availableObjects = allObjects.filter((o) => {
    const existing = linkedMapById.get(o.id)
    if (!existing) return true
    if (existing.isDrive && existing.totalChannelsCount > existing.linkedChannels.length) {
      return true
    }
    return false
  })

  // ── Vincular nova estrutura ou canal específico ──────────────
  const handleLinkObject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedObjectId) return
    const obj = allObjects.find(o => o.id === selectedObjectId)
    if (!obj) return

    const effectiveRole: StorageRole = isOpenSys && role === "origem" ? "armazenamento" : role
    const isDriveObj = obj.type === "drive_in" || obj.type === "drive_through"
    const channels = isDriveObj ? ensureDriveChannels(obj) : []
    const isChannelSpecific =
      isDriveObj && channels.length > 1 && selectedLinkChannelId && selectedLinkChannelId !== "__ALL__"

    // Atualiza props do objeto/canal no mapa se onUpdateObject estiver disponível
    if (onUpdateObject) {
      if (isChannelSpecific) {
        const updatedChannels = channels.map((ch) =>
          ch.id === selectedLinkChannelId || ch.code === selectedLinkChannelId
            ? {
                ...ch,
                stockControlMode: isOpenSys ? ("livre" as const) : stockControlMode,
                stockSystemRef: system.code,
              }
            : ch
        )
        onUpdateObject(obj.id, {
          props: {
            ...obj.props,
            channels: updatedChannels,
          },
        })
      } else {
        const updatedChannels = isDriveObj
          ? channels.map((ch) => ({
              ...ch,
              stockControlMode: isOpenSys ? ("livre" as const) : stockControlMode,
              stockSystemRef: system.code,
            }))
          : obj.props?.channels
        onUpdateObject(obj.id, {
          props: {
            ...obj.props,
            stockControlMode: isOpenSys ? "livre" : stockControlMode,
            stockSystemRef: system.code,
            ...(updatedChannels ? { channels: updatedChannels } : {}),
          },
        })
      }
    }

    const alreadyParticipant = participants.some((p) => p.storageObjectId === obj.id)
    const newParticipant: StorageParticipantConfig = {
      storageObjectId: obj.id,
      storageObjectLabel: obj.label || obj.id,
      storageType: obj.type || obj.category || "storage",
      role: effectiveRole,
      stockControlMode: isOpenSys ? "livre" : stockControlMode,
      permissions: {
        allowInbound: true,
        allowOutbound: true,
        allowReturnToOrigin: !isOpenSys && effectiveRole !== "origem",
      },
      configuredAt: new Date().toISOString(),
    }

    const patch: Partial<BusinessSystem> = {
      participants: alreadyParticipant
        ? participants.map((p) => (p.storageObjectId === obj.id ? newParticipant : p))
        : [...participants, newParticipant],
    }
    if (!isOpenSys && effectiveRole === "origem" && !system.originStorageId) {
      patch.originStorageId = obj.id
      patch.originStorageLabel = obj.label || obj.id
    }

    updateSystem(system.id, patch)
    setSelectedObjectId("")
    setSelectedLinkChannelId("__ALL__")
  }

  const handleUnlink = (storageObjectId: string) => {
    updateSystem(system.id, {
      participants: participants.filter(p => p.storageObjectId !== storageObjectId),
    })

    if (onUpdateObject) {
      const obj = allObjects.find((o) => o.id === storageObjectId)
      if (obj) {
        const nextProps = { ...obj.props }
        if (findSystemByRef(nextProps.stockSystemRef as string | undefined, [system])) {
          nextProps.stockSystemRef = ""
          if (!isOpenSys) {
            nextProps.stockControlMode = "livre"
          }
        }
        if (Array.isArray(nextProps.channels)) {
          nextProps.channels = (nextProps.channels as Array<Record<string, unknown>>).map((ch) => {
            if (findSystemByRef(ch?.stockSystemRef as string | undefined, [system])) {
              return { ...ch, stockSystemRef: "", stockControlMode: undefined }
            }
            return ch
          })
        }
        onUpdateObject(obj.id, { props: nextProps })
      }
    }

    if (inspectingParticipant?.storageObjectId === storageObjectId) {
      setInspectingParticipant(null)
      setInspectingObject(null)
    }
  }

  const handleToggleControlMode = (storageObjectId: string) => {
    if (isOpenSys) return
    const existing = participants.find((p) => p.storageObjectId === storageObjectId)
    if (!existing) return
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

  // ── Inspecionar estrutura ou canal (abre DriveInGrid ou Relação do Compartimento) ──
  const handleInspectEntry = (entry: LinkedStructureEntry, channelIdx: number = 0) => {
    const existingPart = participants.find((p) => p.storageObjectId === entry.storageObjectId)
    const fallbackPart: StorageParticipantConfig = existingPart || {
      storageObjectId: entry.storageObjectId,
      storageObjectLabel: entry.storageObjectLabel,
      storageType: entry.storageType,
      role: entry.role,
      stockControlMode: entry.stockControlMode,
      permissions: {
        allowInbound: true,
        allowOutbound: true,
        allowReturnToOrigin: !isOpenSys && !entry.isOrigin,
      },
      configuredAt: new Date().toISOString(),
    }
    setBalanceError("")
    setInspectingParticipant(fallbackPart)
    setInspectingObject(entry.object || null)
    setActiveChannelIndex(Math.max(0, channelIdx))
    setIsEditModeActive(false)
  }

  // ── Itens do canal (localStorage com chave = sys_{systemId}_{objectId}) ──
  const activeObjectId = inspectingObject?.id || inspectingParticipant?.storageObjectId || ""
  const channelKey = activeObjectId ? `sys_${system.id}_${activeObjectId}` : ""
  const driveChannels =
    inspectingObject && inspectingObject.type !== "compartment"
      ? ensureDriveChannels(inspectingObject)
      : []
  const currentDriveChannel =
    driveChannels[Math.min(activeChannelIndex, Math.max(0, driveChannels.length - 1))] || null

  const allObjectChannelItems: MapeamentoItem[] = (activeObjectId && itemsVersion >= 0)
    ? getLocalItems().filter(it => it.mapeamentoId === channelKey)
    : []

  const channelItems: MapeamentoItem[] =
    driveChannels.length > 1 && currentDriveChannel
      ? filterItemsForDriveChannel(
          allObjectChannelItems,
          currentDriveChannel,
          driveChannels,
          inspectingObject?.label || inspectingParticipant?.storageObjectLabel
        )
      : allObjectChannelItems

  const isInspectingOrigin = Boolean(!isOpenSys && activeObjectId && originObjectId === activeObjectId)
  const enforceDriveStockLimit = Boolean(
    !isOpenSys &&
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

  const handleEditItem = (updated: MapeamentoItem): boolean => {
    setBalanceError("")
    const currentChannelItems = getLocalItems().filter((it) => it.mapeamentoId === channelKey)
    const nextChannelItems =
      updated.quantidade > 0
        ? currentChannelItems.map((it) => (it.id === updated.id ? updated : it))
        : currentChannelItems.filter((it) => it.id !== updated.id)

    if (!isOpenSys && activeObjectId && !isInspectingOrigin) {
      const res = applyNonOriginPositionChange(
        system,
        activeObjectId,
        currentChannelItems,
        nextChannelItems,
        { enforceStockLimit: enforceDriveStockLimit }
      )
      if (!res.ok) {
        setBalanceError(res.errorMessage)
        return false
      }
    } else {
      const others = getLocalItems().filter((it) => it.mapeamentoId !== channelKey)
      saveLocalItems([...others, ...nextChannelItems])
      persistPositionItemsToSupabase(channelKey, nextChannelItems, system.workspaceId).catch(() => {})
      if (!isOpenSys) {
        syncSupabaseUniversalBalances(system).catch(() => {})
      }
    }
    setItemsVersion((v) => v + 1)
    return true
  }

  const handleSaveModalItems = (saved: MapeamentoItem[] | MapeamentoItem): boolean => {
    setBalanceError("")
    const savedArr = Array.isArray(saved) ? saved : [saved]
    const targetPosicao =
      driveChannels.length > 1 && currentDriveChannel
        ? currentDriveChannel.code || currentDriveChannel.name
        : inspectingObject?.label || inspectingParticipant?.storageObjectLabel || activeObjectId || "POS"

    const formatted = savedArr.map(it => ({
      ...it,
      mapeamentoId: channelKey,
      posicao: targetPosicao,
    }))

    const currentChannelItems = getLocalItems().filter((it) => it.mapeamentoId === channelKey)
    const replacedIds = new Set(formatted.map(it => it.id))
    const remainingInChannel = currentChannelItems.filter(it => !replacedIds.has(it.id))
    const nextChannelItems = [...remainingInChannel, ...formatted]

    if (!isOpenSys && activeObjectId && !isInspectingOrigin) {
      const res = applyNonOriginPositionChange(
        system,
        activeObjectId,
        currentChannelItems,
        nextChannelItems,
        { enforceStockLimit: enforceDriveStockLimit }
      )
      if (!res.ok) {
        setBalanceError(res.errorMessage)
        return false
      }
    } else {
      const others = getLocalItems().filter(it => it.mapeamentoId !== channelKey)
      saveLocalItems([...others, ...nextChannelItems])
      persistPositionItemsToSupabase(channelKey, nextChannelItems, system.workspaceId).catch(() => {})
      if (!isOpenSys) {
        syncSupabaseUniversalBalances(system).catch(() => {})
      }
    }

    setIsItemModalOpen(false)
    setEditingItem(null)
    setItemsVersion(v => v + 1)
    return true
  }

  const handleDeleteItem = (itemId: string) => {
    setBalanceError("")
    const currentChannelItems = getLocalItems().filter((it) => it.mapeamentoId === channelKey)
    const nextChannelItems = currentChannelItems.filter(it => it.id !== itemId)
    if (!isOpenSys && activeObjectId && !isInspectingOrigin) {
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
      if (!isOpenSys) {
        syncSupabaseUniversalBalances(system).catch(() => {})
      }
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
                    isOpenSys
                      ? "bg-emerald-950/60 border-emerald-700/50 text-emerald-300"
                      : inspectingParticipant.stockControlMode === "vinculado_saldo"
                      ? "bg-blue-950/60 border-blue-700/50 text-blue-300"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  )}>
                    {isOpenSys
                      ? "Sistema Livre (Sem Saldo)"
                      : inspectingParticipant.stockControlMode === "vinculado_saldo"
                      ? "Saldo Obrigatório"
                      : "Livre"}
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
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
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

              {!isInspectingCompartment && driveChannels.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3 pb-2 border-b border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                    Canais ({driveChannels.length}):
                  </span>
                  {driveChannels.map((ch, idx) => {
                    const active = idx === Math.min(activeChannelIndex, driveChannels.length - 1)
                    const isChannelLinked =
                      inspectingObject &&
                      resolveSystemForChannel(inspectingObject, ch, [system])?.id === system.id
                    return (
                      <button
                        key={ch.id || idx}
                        type="button"
                        onClick={() => setActiveChannelIndex(idx)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1.5",
                          active
                            ? "bg-blue-600 border-blue-500 text-white shadow-sm"
                            : isChannelLinked
                            ? "bg-slate-800/90 border-slate-600 text-slate-200 hover:text-white"
                            : "bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300"
                        )}
                        title={
                          isChannelLinked
                            ? `Vinculado ao sistema ${system.code}`
                            : "Canal não vinculado a este sistema"
                        }
                      >
                        {isChannelLinked && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: system.color }}
                          />
                        )}
                        <span>{ch.name || ch.code || `Canal ${idx + 1}`}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {isInspectingCompartment ? (
                <CompartmentRelationView
                  mapeamentoId={channelKey || `sys_${system.id}_${inspectingParticipant.storageObjectId}`}
                  positionLabel={inspectingParticipant.storageObjectLabel}
                  canEdit={isEditModeActive}
                  onItemsChanged={() => setItemsVersion(v => v + 1)}
                  system={system}
                  objectId={inspectingParticipant.storageObjectId}
                  allObjects={allObjects}
                  stockControlMode={isOpenSys ? "livre" : inspectingParticipant.stockControlMode}
                />
              ) : (
                <MapeamentoDriveInGrid
                  positionId={
                    driveChannels.length > 1 && currentDriveChannel
                      ? `${inspectingDisplayName} · ${currentDriveChannel.name || currentDriveChannel.code}`
                      : inspectingDisplayName
                  }
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

                <div className={`grid grid-cols-1 ${selectedFormChannels.length > 1 ? "sm:grid-cols-3" : isOpenSys ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-2.5`}>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Selecionar Estrutura *</label>
                    <select
                      required
                      value={selectedObjectId}
                      onChange={e => {
                        setSelectedObjectId(e.target.value)
                        setSelectedLinkChannelId("__ALL__")
                      }}
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

                  {selectedFormChannels.length > 1 && (
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Canal do Drive-In</label>
                      <select
                        value={selectedLinkChannelId}
                        onChange={e => setSelectedLinkChannelId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="__ALL__">Todos os canais ({selectedFormChannels.length})</option>
                        {selectedFormChannels.map((ch) => (
                          <option key={ch.id} value={ch.id}>
                            📥 {ch.name || ch.code} (Vão {ch.laneIndex})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Papel Operacional</label>
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value as StorageRole)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="armazenamento">Armazenamento (Drive-In / Racks)</option>
                      {!isOpenSys && <option value="origem">Origem dos Saldos (CHÃO)</option>}
                      <option value="quarentena">Quarentena / Retenção</option>
                      <option value="retrabalho">Bancada de Retrabalho</option>
                      <option value="expedicao">Doca / Expedição</option>
                      <option value="transito">Corredor de Trânsito</option>
                    </select>
                  </div>

                  {!isOpenSys && (
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
                  )}
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

              {/* Resumo de Saldo / Mapeamento */}
              <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/70 flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
                {isOpenSys ? (
                  <div className="flex flex-wrap items-center gap-3 font-mono">
                    <span className="text-emerald-300 font-bold">
                      Sistema Livre (Sem Registro de Saldo)
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-200">
                      Total Mapeado: <strong className="text-emerald-400">{mappedStats.totalUnits.toLocaleString("pt-BR")} un.</strong>
                    </span>
                    <span className="text-blue-300">
                      SKUs: <strong>{mappedStats.totalSkus}</strong>
                    </span>
                    <span className="text-amber-300">
                      Posições Ocupadas: <strong>{mappedStats.occupiedSlotsCount}</strong>
                    </span>
                  </div>
                ) : (
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
                )}
                <span className="text-[10px] text-slate-500">
                  Clique em uma estrutura ou canal para gerenciar ou mapear itens
                </span>
              </div>

              {/* Lista de Estruturas e Canais Vinculados */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers size={13} className="text-amber-400" />
                    <span>Estruturas & Canais Vinculados ({linkedStructures.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Clique no cartão ou em um canal para abrir o Grid (G300-style)
                  </span>
                </div>

                {linkedStructures.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs bg-slate-950/30 rounded-xl border border-dashed border-slate-800">
                    <Layers size={28} className="mx-auto mb-2 text-slate-600" />
                    <p>Nenhuma estrutura física ou canal vinculado.</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Selecione uma estrutura acima ou vincule pelo painel lateral do Drive/Canal.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedStructures.map((entry) => {
                      const obj = entry.object
                      const lvlCount = Number(obj?.props?.levels) || 4
                      const depth = Number(obj?.props?.depth) || 4
                      const posTotal = entry.totalUnits
                      const firstLinkedIdx =
                        entry.linkedChannels.length > 0
                          ? Math.max(0, entry.linkedChannels[0].laneIndex - 1)
                          : 0

                      return (
                        <div
                          key={entry.storageObjectId}
                          className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl hover:border-blue-700/60 hover:bg-slate-900/60 transition-all cursor-pointer group space-y-2.5"
                          onClick={() => handleInspectEntry(entry, firstLinkedIdx)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className="w-9 h-9 rounded-lg bg-slate-900 border flex items-center justify-center text-base shadow shrink-0 transition-colors"
                                style={{ borderColor: `${system.color}70` }}
                              >
                                {entry.isCompartment ? "📦" : entry.isOrigin ? "📍" : entry.role === "quarentena" ? "🛑" : "📥"}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <strong className="text-white text-xs truncate">{entry.storageObjectLabel}</strong>
                                  <span className="text-[9px] text-slate-500 font-mono">({entry.storageType})</span>
                                  {entry.isOrigin && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      ORIGEM / CHÃO
                                    </span>
                                  )}
                                  {entry.isDrive && entry.totalChannelsCount > 0 && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700">
                                      {entry.linkedChannels.length}/{entry.totalChannelsCount} canal(is)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                                  <span>Papel: <strong>{entry.role}</strong></span>
                                  <span>·</span>
                                  <span>
                                    {entry.isCompartment
                                      ? "Armazenamento Aberto (sem nível / prof.)"
                                      : `${lvlCount} nível(is) × ${depth} prof.`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-emerald-300">
                                {posTotal} un.
                              </span>

                              {isOpenSys ? (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-emerald-950/60 border-emerald-700/60 text-emerald-300">
                                  Livre (Sem Saldo)
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); handleToggleControlMode(entry.storageObjectId) }}
                                  className={cn(
                                    "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1",
                                    entry.stockControlMode === "vinculado_saldo"
                                      ? "bg-blue-950/70 border-blue-700/60 text-blue-300 hover:bg-blue-900"
                                      : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                                  )}
                                  title="Clique para alternar o modo de controle"
                                >
                                  {entry.stockControlMode === "vinculado_saldo" ? (
                                    <><Lock size={9} /> Saldo Obrig.</>
                                  ) : "Livre"}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); handleUnlink(entry.storageObjectId) }}
                                className="p-1 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                                title="Desvincular"
                              >
                                <Trash2 size={13} />
                              </button>

                              <span className="text-[10px] text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                                {entry.isCompartment ? "Ver relação →" : "Ver canal →"}
                              </span>
                            </div>
                          </div>

                          {/* Canais individuais vinculados neste Drive-In */}
                          {entry.isDrive && entry.linkedChannels.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/70">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                                Canais vinculados:
                              </span>
                              {entry.linkedChannels.map((ch) => (
                                <button
                                  key={ch.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleInspectEntry(entry, Math.max(0, ch.laneIndex - 1))
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/60 text-[10px] font-mono text-slate-200 transition-colors"
                                  title={`Abrir ${ch.name || ch.code} no Grid`}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: system.color }}
                                  />
                                  <span className="font-bold">{ch.name || ch.code}</span>
                                  {ch.code && ch.name !== ch.code && (
                                    <span className="text-slate-500">({ch.code})</span>
                                  )}
                                  <span className="text-slate-400">
                                    · {ch.occupiedSlots}/{ch.levels * ch.depth} pos.
                                  </span>
                                  {ch.totalUnits > 0 && (
                                    <span className="text-emerald-400 font-bold">
                                      · {ch.totalUnits} un.
                                    </span>
                                  )}
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>{linkedStructures.length} estrutura(s) mapeada(s) · Sistema {system.code}</span>
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
