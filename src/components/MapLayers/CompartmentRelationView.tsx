// ============================================================
// NEXUS ERP — MapLayers / CompartmentRelationView.tsx
// Relação de Itens do Compartimento (Espaço de Armazenamento Aberto)
// Design fiel à aba "Não alocados" do módulo Mapeamentos (G300 Avarias):
// - Grid 2 colunas: "Paletes Agrupados" + "Livres (Sem Alocação / Sem Agrupamento)"
// - Linhas expansíveis para paletes mistos/agrupados ("╰ sub")
// - Classificação por linha, Observação, Busca, Drag & Drop, Dividir, Juntar, Excluir
// ============================================================

"use client"

import React, { useState, useMemo, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronRight,
  Search,
  Plus,
  Scissors,
  GitMerge,
  Trash2,
  Package,
  Layers,
  Edit2,
  X,
  Check,
  RefreshCw,
  Send,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { MapeamentoItem, MapeamentoConfig } from "@/lib/mapeamentosStorage"
import { getLocalItems, saveLocalItems } from "@/lib/mapeamentosStorage"
import {
  ClassificacaoPalete,
  CLASSIFICACAO_OPTIONS,
  extractRowClassificacao,
  isDevolucao,
} from "@/lib/mapeamentoUtils"
import { MapeamentoItemModal } from "../mapeamentos/MapeamentoItemModal"
import type { BusinessSystem } from "../Systems/types"
import type { MapObject } from "../MapLibrary/types"
import {
  fetchAndSyncSystemBalances,
  getOriginObjectId,
  getSystemBalanceSnapshot,
  getAvailableStocksFromOrigin,
  applyNonOriginPositionChange,
  moveSkuBetweenSystemPositions,
  syncSupabaseUniversalBalances,
} from "../Systems/systemBalanceService"
import {
  hydratePositionKeyFromSupabase,
  hydrateSystemItemsFromSupabase,
  persistPositionItemsToSupabase,
} from "@/lib/workspaceItemsSync"
import { ITEMS_UPDATED_EVENT } from "@/lib/driveOccupancy"
import { isOpenSystem } from "@/lib/systemVisuals"

const fmtNum = (val: number, locale = "pt-BR") =>
  val !== 0 && Math.abs(val) < 1
    ? val.toLocaleString(locale, { maximumFractionDigits: 2 })
    : Math.round(val).toLocaleString(locale)

const isInvalidPalletId = (v: unknown): boolean => {
  if (v === null || v === undefined) return true
  const s = String(v).trim().toUpperCase()
  return !s || s === "NAN" || s === "-" || s === "S/ID" || s === "N/A"
}

interface PalletGroup {
  key: string
  label: string
  isSimple: boolean
  items: MapeamentoItem[]
}

interface CompartmentRelationViewProps {
  mapeamentoId: string
  positionLabel: string
  canEdit?: boolean
  onItemsChanged?: (items: MapeamentoItem[]) => void
  system?: BusinessSystem | null
  objectId?: string
  allObjects?: MapObject[]
  workspaceId?: string
  stockControlMode?: "livre" | "vinculado_saldo"
}

export default function CompartmentRelationView({
  mapeamentoId,
  positionLabel,
  canEdit = false,
  onItemsChanged,
  system = null,
  objectId,
  allObjects = [],
  workspaceId,
  stockControlMode,
}: CompartmentRelationViewProps) {
  const [itemsVersion, setItemsVersion] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedPallets, setExpandedPallets] = useState<Set<string>>(new Set())
  const [balanceError, setBalanceError] = useState<string>("")
  const [isSyncing, setIsSyncing] = useState(false)

  // Modais de Item / Dividir / Juntar / Excluir / Transferência Drag-and-Drop / Mover para Posição
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MapeamentoItem | null>(null)

  const [moveTargetItem, setMoveTargetItem] = useState<MapeamentoItem | null>(null)
  const [moveDestObjectId, setMoveDestObjectId] = useState<string>("")
  const [moveQty, setMoveQty] = useState<string>("")
  const [moveLevel, setMoveLevel] = useState<number>(1)
  const [moveDepth, setMoveDepth] = useState<number>(1)

  const [draggedItem, setDraggedItem] = useState<MapeamentoItem | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferPayload, setTransferPayload] = useState<{
    sourceItem: MapeamentoItem
    targetId: string | null
    targetType: "mix" | "ungroup" | "new_mix" | "new_standalone_mix"
    targetBaseItem?: MapeamentoItem
  } | null>(null)
  const [transferQuantity, setTransferQuantity] = useState<string>("")

  const [splitTarget, setSplitTarget] = useState<MapeamentoItem | null>(null)
  const [splitQty, setSplitQty] = useState<string>("")

  const [mergeTarget, setMergeTarget] = useState<{ sku: string; items: MapeamentoItem[] } | null>(null)
  const [mergeQuantities, setMergeQuantities] = useState<Record<string, number | "">>({})

  const [deleteTarget, setDeleteTarget] = useState<MapeamentoItem | null>(null)
  const [deleteQty, setDeleteQty] = useState<string>("")

  const isOpenSys = isOpenSystem(system)
  const originObjectId = useMemo(
    () => (system && !isOpenSys ? getOriginObjectId(system) : null),
    [system, isOpenSys]
  )
  const isSystemOrigin = Boolean(system && !isOpenSys && objectId && originObjectId === objectId)
  const isNonOriginSystemParticipant = Boolean(
    system && !isOpenSys && objectId && (!originObjectId || originObjectId !== objectId)
  )
  const enforceStockLimit = Boolean(
    system &&
      !isOpenSys &&
      !isSystemOrigin &&
      (stockControlMode === "vinculado_saldo" ||
        (!stockControlMode && system.defaultControlMode !== "livre"))
  )

  // Sincroniza saldo da Origem (Chão) ou hidrata compartimento livre ao abrir
  useEffect(() => {
    if (!system && !mapeamentoId) return
    let active = true
    Promise.resolve()
      .then(async () => {
        if (active) setIsSyncing(true)
        if (system) {
          if (isOpenSys) {
            await hydrateSystemItemsFromSupabase(system)
          } else {
            await fetchAndSyncSystemBalances(system)
          }
        } else {
          await hydratePositionKeyFromSupabase(mapeamentoId, workspaceId)
        }
      })
      .then(() => {
        if (active) setItemsVersion((v) => v + 1)
      })
      .finally(() => {
        if (active) setIsSyncing(false)
      })
    return () => {
      active = false
    }
  }, [system, isOpenSys, mapeamentoId, workspaceId])

  useEffect(() => {
    const onItemsUpdated = () => setItemsVersion((v) => v + 1)
    window.addEventListener(ITEMS_UPDATED_EVENT, onItemsUpdated)
    return () => window.removeEventListener(ITEMS_UPDATED_EVENT, onItemsUpdated)
  }, [])

  // Carrega itens do compartimento a partir do storage
  const items: MapeamentoItem[] = useMemo(() => {
    void itemsVersion
    if (!mapeamentoId) return []
    return getLocalItems().filter((it) => it.mapeamentoId === mapeamentoId)
  }, [mapeamentoId, itemsVersion])

  const balanceSnapshot = useMemo(() => {
    void itemsVersion
    if (!system || isOpenSys) return null
    return getSystemBalanceSnapshot(system)
  }, [system, isOpenSys, itemsVersion])

  const availableStocks = useMemo(() => {
    void itemsVersion
    if (!system || isOpenSys || !isNonOriginSystemParticipant) return []
    return getAvailableStocksFromOrigin(system)
  }, [system, isOpenSys, isNonOriginSystemParticipant, itemsVersion])

  const destinationPositions = useMemo(() => {
    if (!system || !objectId) return []
    const participants = system.participants || []
    return participants
      .filter((p) => p.storageObjectId !== objectId)
      .map((p) => {
        const obj = allObjects.find((o) => o.id === p.storageObjectId)
        const isComp = obj?.type === "compartment" || p.storageType === "compartment"
        return {
          id: p.storageObjectId,
          label: obj?.label || p.storageObjectLabel || p.storageObjectId,
          isCompartment: isComp,
          levels: isComp ? 0 : Number(obj?.props?.levels) || 4,
          depth: isComp ? 0 : Number(obj?.props?.depth) || 4,
          role: p.role,
        }
      })
  }, [system, objectId, allObjects])

  const commitItemsForChannel = useCallback(
    (nextChannelItems: MapeamentoItem[]): boolean => {
      if (!canEdit) return false
      setBalanceError("")
      if (system && !isOpenSys && objectId && isNonOriginSystemParticipant) {
        const res = applyNonOriginPositionChange(
          system,
          objectId,
          items,
          nextChannelItems,
          { enforceStockLimit }
        )
        if (!res.ok) {
          setBalanceError(res.errorMessage)
          return false
        }
        setItemsVersion((v) => v + 1)
        onItemsChanged?.(nextChannelItems)
        return true
      }

      const others = getLocalItems().filter((it) => it.mapeamentoId !== mapeamentoId)
      saveLocalItems([...others, ...nextChannelItems])
      persistPositionItemsToSupabase(
        mapeamentoId,
        nextChannelItems,
        workspaceId || system?.workspaceId
      ).catch(() => {})
      if (system && !isOpenSys) {
        syncSupabaseUniversalBalances(system).catch(() => {})
      }
      setItemsVersion((v) => v + 1)
      onItemsChanged?.(nextChannelItems)
      return true
    },
    [
      canEdit,
      mapeamentoId,
      onItemsChanged,
      system,
      isOpenSys,
      objectId,
      isNonOriginSystemParticipant,
      items,
      enforceStockLimit,
      workspaceId,
    ]
  )

  const fakeConfig: MapeamentoConfig = useMemo(
    () => ({
      id: mapeamentoId || "comp_open_space",
      nome: positionLabel || "Compartimento",
      descricao: "Armazenamento aberto sem nível ou profundidade",
      categoria: "Armazenamento Aberto",
      cor: "amber",
      icone: "Box",
      camposPersonalizados: [],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    }),
    [mapeamentoId, positionLabel]
  )

  // Filtro de busca por SKU, Descrição, ID Palete ou Observação
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      const obs = String(it.customValues?.observacao ?? "").toLowerCase()
      return (
        (it.sku || "").toLowerCase().includes(q) ||
        (it.descricao || "").toLowerCase().includes(q) ||
        (it.idPalete || "").toLowerCase().includes(q) ||
        obs.includes(q)
      )
    })
  }, [items, searchQuery])

  // Agrupamento idêntico ao "Não alocados"
  const { agrupados, desagrupados, totalUnits, uniqueSkus } = useMemo(() => {
    const grouped: PalletGroup[] = []
    const seen = new Map<string, number>()
    let simpleCount = 0

    filteredItems.forEach((item) => {
      const rawId = item.idPalete
      if (isInvalidPalletId(rawId)) {
        const key = `__simple_${simpleCount++}_${item.id}`
        grouped.push({ key, label: "Palete Simples", isSimple: true, items: [item] })
      } else {
        const id = String(rawId).trim().toUpperCase()
        if (seen.has(id)) {
          grouped[seen.get(id)!].items.push(item)
        } else {
          seen.set(id, grouped.length)
          grouped.push({ key: id, label: id, isSimple: false, items: [item] })
        }
      }
    })

    const totalUnits = filteredItems.reduce((sum, i) => sum + (Number(i.quantidade) || 0), 0)
    const uniqueSkus = new Set(filteredItems.map((i) => i.sku).filter(Boolean)).size

    return {
      agrupados: grouped.filter((g) => !g.isSimple),
      desagrupados: grouped.filter((g) => g.isSimple),
      totalUnits,
      uniqueSkus,
    }
  }, [filteredItems])

  const togglePallet = (key: string) => {
    setExpandedPallets((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const getNextPalletId = useCallback(() => {
    const used = new Set<number>()
    items.forEach((it) => {
      const idStr = String(it.idPalete || "").trim().toUpperCase()
      if (idStr.startsWith("P.")) {
        const n = parseInt(idStr.slice(2), 10)
        if (!isNaN(n)) used.add(n)
      }
    })
    let candidate = 1
    while (used.has(candidate)) candidate++
    return `P.${String(candidate).padStart(3, "0")}`
  }, [items])

  // ── Handlers de Edição ──────────────────────────────────────
  const handleSaveModalItems = (saved: MapeamentoItem[] | MapeamentoItem): boolean => {
    const arr = Array.isArray(saved) ? saved : [saved]
    const formatted = arr.map((it) => ({
      ...it,
      mapeamentoId,
      posicao: positionLabel,
      nivel: 0,
      profundidade: 0,
    }))
    const replacedIds = new Set(formatted.map((it) => it.id))
    const remaining = items.filter((it) => !replacedIds.has(it.id))
    const ok = commitItemsForChannel([...remaining, ...formatted])
    if (ok) {
      setIsItemModalOpen(false)
      setEditingItem(null)
    }
    return ok
  }

  const handleUpdateClassificacao = (item: MapeamentoItem, nextVal: ClassificacaoPalete) => {
    if (!canEdit) return
    const next = items.map((it) =>
      it.id === item.id
        ? {
            ...it,
            customValues: {
              ...(it.customValues || {}),
              classificacao: nextVal,
            },
            atualizadoEm: new Date().toISOString(),
          }
        : it
    )
    commitItemsForChannel(next)
  }

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, item: MapeamentoItem) => {
    if (!canEdit) return
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = "copyMove"
    e.dataTransfer.setData("text/plain", item.id)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverTarget(null)
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    if (!canEdit) return
    e.preventDefault()
    setDragOverTarget(targetId)
    e.dataTransfer.dropEffect = "move"
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverTarget(null)
  }

  const handleDrop = (
    e: React.DragEvent,
    targetType: "mix" | "ungroup" | "new_mix" | "new_standalone_mix",
    targetId: string | null,
    targetBaseItem?: MapeamentoItem
  ) => {
    e.preventDefault()
    setDragOverTarget(null)
    if (!canEdit || !draggedItem) return

    if (draggedItem.id === targetBaseItem?.id) return
    if (targetType === "mix" && draggedItem.idPalete?.toUpperCase() === targetId?.toUpperCase()) return
    if (targetType === "ungroup" && isInvalidPalletId(draggedItem.idPalete)) return

    setTransferPayload({ sourceItem: draggedItem, targetId, targetType, targetBaseItem })
    setTransferQuantity(String(draggedItem.quantidade || 0))
    setTransferModalOpen(true)
  }

  const handleConfirmTransfer = () => {
    if (!transferPayload) return
    const dbQty = Number(transferPayload.sourceItem.quantidade) || 0
    const qtToMove = parseFloat(transferQuantity.replace(",", "."))
    if (isNaN(qtToMove) || qtToMove <= 0 || qtToMove > dbQty) return

    let finalTargetId: string | undefined = transferPayload.targetId || undefined
    const extraUpdates = new Map<string, string>()

    if (transferPayload.targetType === "new_mix") {
      finalTargetId = getNextPalletId()
      if (transferPayload.targetBaseItem) {
        extraUpdates.set(transferPayload.targetBaseItem.id, finalTargetId)
      }
    } else if (transferPayload.targetType === "new_standalone_mix") {
      finalTargetId = getNextPalletId()
    } else if (transferPayload.targetType === "ungroup") {
      finalTargetId = undefined
    }

    const now = new Date().toISOString()
    let updated: MapeamentoItem[]

    if (qtToMove === dbQty) {
      updated = items.map((it) => {
        if (it.id === transferPayload.sourceItem.id) {
          return { ...it, idPalete: finalTargetId, atualizadoEm: now }
        }
        if (extraUpdates.has(it.id)) {
          return { ...it, idPalete: extraUpdates.get(it.id), atualizadoEm: now }
        }
        return it
      })
    } else {
      const src = transferPayload.sourceItem
      const newChild: MapeamentoItem = {
        ...src,
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        quantidade: qtToMove,
        idPalete: finalTargetId,
        criadoEm: now,
        atualizadoEm: now,
      }
      updated = [
        ...items.map((it) => {
          if (it.id === src.id) {
            return { ...it, quantidade: dbQty - qtToMove, atualizadoEm: now }
          }
          if (extraUpdates.has(it.id)) {
            return { ...it, idPalete: extraUpdates.get(it.id), atualizadoEm: now }
          }
          return it
        }),
        newChild,
      ]
    }

    commitItemsForChannel(updated)
    setTransferModalOpen(false)
    setTransferPayload(null)
    setDraggedItem(null)
  }

  const handleConfirmSplit = () => {
    if (!splitTarget) return
    const total = Number(splitTarget.quantidade) || 0
    const extracted = parseInt(splitQty, 10) || 0
    if (extracted <= 0 || extracted >= total) return

    const now = new Date().toISOString()
    const newItem: MapeamentoItem = {
      ...splitTarget,
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      quantidade: extracted,
      idPalete: undefined,
      criadoEm: now,
      atualizadoEm: now,
    }
    const next = [
      ...items.map((it) =>
        it.id === splitTarget.id ? { ...it, quantidade: total - extracted, atualizadoEm: now } : it
      ),
      newItem,
    ]
    commitItemsForChannel(next)
    setSplitTarget(null)
    setSplitQty("")
  }

  const handleConfirmMerge = () => {
    if (!mergeTarget) return
    const now = new Date().toISOString()
    const targetIds = new Set(mergeTarget.items.map((i) => i.id))
    const next = items
      .map((it) => {
        if (!targetIds.has(it.id)) return it
        const rawVal = mergeQuantities[it.id]
        const q = rawVal !== undefined && rawVal !== "" ? Number(rawVal) : it.quantidade
        if (q <= 0) return null
        return { ...it, quantidade: q, atualizadoEm: now }
      })
      .filter((x): x is MapeamentoItem => x !== null)

    commitItemsForChannel(next)
    setMergeTarget(null)
    setMergeQuantities({})
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    const total = Number(deleteTarget.quantidade) || 0
    const qtDel = parseFloat(deleteQty.replace(",", "."))
    if (isNaN(qtDel) || qtDel <= 0 || qtDel > total) return

    const next =
      qtDel >= total
        ? items.filter((it) => it.id !== deleteTarget.id)
        : items.map((it) =>
            it.id === deleteTarget.id
              ? { ...it, quantidade: total - qtDel, atualizadoEm: new Date().toISOString() }
              : it
          )

    commitItemsForChannel(next)
    setDeleteTarget(null)
    setDeleteQty("")
  }

  const renderPalletTable = (
    title: string,
    groupData: PalletGroup[],
    isEmptyText: string,
    isAgrupados: boolean,
    freePallets?: PalletGroup[]
  ) => (
    <div
      className={cn(
        "flex flex-col h-[500px] rounded-3xl md:rounded-[2.5rem] bg-slate-900/95 border border-slate-800 shadow-xl shadow-slate-950/50 overflow-hidden transition-colors relative",
        isAgrupados && dragOverTarget === "LEFT_TABLE_CONTAINER"
          ? "ring-4 ring-blue-500/50 bg-blue-900/15"
          : "",
        !isAgrupados && dragOverTarget === "RIGHT_TABLE_CONTAINER"
          ? "ring-4 ring-amber-500/40 bg-amber-900/10"
          : ""
      )}
      onDragOver={(e) => {
        if (!canEdit || !draggedItem) return
        if (isAgrupados && isInvalidPalletId(draggedItem.idPalete)) {
          e.preventDefault()
          if (dragOverTarget !== "LEFT_TABLE_CONTAINER") {
            handleDragOver(e, "LEFT_TABLE_CONTAINER")
          }
        } else if (!isAgrupados && !isInvalidPalletId(draggedItem.idPalete)) {
          e.preventDefault()
          if (dragOverTarget !== "RIGHT_TABLE_CONTAINER") {
            handleDragOver(e, "RIGHT_TABLE_CONTAINER")
          }
        }
      }}
      onDragLeave={(e) => {
        if (
          (isAgrupados && dragOverTarget === "LEFT_TABLE_CONTAINER") ||
          (!isAgrupados && dragOverTarget === "RIGHT_TABLE_CONTAINER")
        ) {
          handleDragLeave(e)
        }
      }}
      onDrop={(e) => {
        if (!canEdit || !draggedItem) return
        if (isAgrupados && isInvalidPalletId(draggedItem.idPalete)) {
          e.preventDefault()
          e.stopPropagation()
          handleDrop(e, "new_standalone_mix", null, undefined)
        } else if (!isAgrupados && !isInvalidPalletId(draggedItem.idPalete)) {
          e.preventDefault()
          e.stopPropagation()
          handleDrop(e, "ungroup", null, undefined)
        }
      }}
    >
      {/* Header do Card — idêntico ao "Não alocados" */}
      <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center shrink-0">
        <h4 className="text-sm font-semibold text-slate-200 tracking-tight">{title}</h4>
        <span className="text-[10px] font-medium text-slate-300 bg-slate-700 px-2.5 py-1 rounded-full">
          {groupData.length} registros
        </span>
      </div>

      {/* Corpo com Tabela */}
      <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative">
        {groupData.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-500 italic p-6 text-center">
            {isEmptyText}
          </div>
        ) : (
          <table className="w-full min-w-[580px] text-left">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
              <tr className="border-b border-slate-800">
                <th className="px-1 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400 w-5" />
                <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400">
                  ID Palete
                </th>
                <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400">
                  Produto
                </th>
                <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400">
                  Descrição
                </th>
                <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400 text-right">
                  Qtd
                </th>
                <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400">
                  Classif.
                </th>
                <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400">
                  Obs
                </th>
                {canEdit && (
                  <th className="px-2 py-2 text-[8px] font-semibold uppercase tracking-widest text-slate-400 text-center whitespace-nowrap">
                    Ação
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {groupData.map((group) => {
                const isExpanded = expandedPallets.has(group.key)
                const totalQty = group.items.reduce((s, i) => s + (Number(i.quantidade) || 0), 0)
                const isComposite = !group.isSimple
                const singleItem = group.items[0]
                const compositeDevCount = isComposite
                  ? group.items.filter((i) => isDevolucao(i.customValues)).length
                  : 0
                const rowClassif = extractRowClassificacao(singleItem?.customValues)
                const obs = singleItem?.customValues?.observacao
                const strObs = obs && obs !== 0 ? String(obs) : "-"
                const isCrit = strObs.endsWith("!")

                return (
                  <React.Fragment key={group.key}>
                    <tr
                      onClick={() => isComposite && togglePallet(group.key)}
                      onDragOver={(e) => {
                        if (
                          canEdit &&
                          draggedItem &&
                          draggedItem.id !== singleItem?.id &&
                          group.label !== draggedItem.idPalete?.toUpperCase()
                        ) {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDragOver(e, group.key)
                        }
                      }}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => {
                        if (
                          canEdit &&
                          draggedItem &&
                          draggedItem.id !== singleItem?.id &&
                          group.label !== draggedItem.idPalete?.toUpperCase()
                        ) {
                          e.preventDefault()
                          e.stopPropagation()
                          if (isComposite) {
                            handleDrop(e, "mix", group.label, undefined)
                          } else {
                            handleDrop(e, "new_mix", null, singleItem)
                          }
                        }
                      }}
                      draggable={canEdit && !isComposite}
                      onDragStart={
                        canEdit && !isComposite ? (e) => handleDragStart(e, singleItem) : undefined
                      }
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "group transition-all duration-200 relative",
                        isComposite
                          ? "border-b-2 border-slate-700/50 cursor-pointer hover:bg-blue-500/5"
                          : "border-b border-slate-800 hover:bg-slate-800/30",
                        dragOverTarget === group.key ? "bg-blue-900/30 ring-2 ring-blue-400 z-10" : "",
                        draggedItem?.id === singleItem?.id ? "opacity-50" : ""
                      )}
                    >
                      {/* Expand toggle */}
                      <td className="px-1 py-1.5 w-5">
                        {isComposite ? (
                          <span
                            className={cn(
                              "inline-flex items-center justify-center h-4 w-4 rounded-full text-blue-400 bg-blue-500/10 transition-transform",
                              isExpanded && "rotate-90"
                            )}
                          >
                            <ChevronRight size={10} strokeWidth={3} />
                          </span>
                        ) : null}
                      </td>

                      {/* ID Palete */}
                      <td className="px-2 py-1.5">
                        {group.isSimple ? (
                          <span className="text-[9px] italic text-slate-400 whitespace-nowrap">
                            S/ ALOCAÇÃO
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 flex-nowrap">
                            <span className="text-[9px] font-semibold text-blue-300 tracking-wide whitespace-nowrap">
                              {group.label}
                            </span>
                            <span className="text-[8px] font-medium text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded-full whitespace-nowrap">
                              {group.items.length} SKUs
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Produto */}
                      <td className="px-2 py-1.5">
                        {isComposite ? (
                          <span className="text-[9px] text-slate-600 italic">—</span>
                        ) : (
                          <span className="text-[10px] font-normal text-slate-300 tracking-tight">
                            {singleItem.sku || "—"}
                          </span>
                        )}
                      </td>

                      {/* Descrição */}
                      <td className="px-2 py-1.5 max-w-[140px]">
                        {isComposite ? (
                          <span className="text-[8px] text-slate-400 italic">
                            Misto c/ {group.items.length} itens
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400 uppercase truncate block max-w-[140px]">
                            {singleItem.descricao || "—"}
                          </span>
                        )}
                      </td>

                      {/* Qtd */}
                      <td className="px-2 py-1.5 text-right">
                        <span className="text-[11px] font-semibold text-slate-200">
                          {fmtNum(totalQty)}
                        </span>
                      </td>

                      {/* Classif. */}
                      <td
                        className="px-2 py-1.5"
                        onClick={(e) => (isComposite ? undefined : e.stopPropagation())}
                      >
                        {isComposite ? (
                          compositeDevCount > 0 ? (
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                              {compositeDevCount} Dev.
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-500 italic">Por linha</span>
                          )
                        ) : canEdit ? (
                          <select
                            value={rowClassif}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleUpdateClassificacao(
                                singleItem,
                                e.target.value as ClassificacaoPalete
                              )
                            }
                            className={cn(
                              "text-[9px] font-semibold rounded-lg px-1.5 py-1 border outline-none cursor-pointer transition-colors",
                              rowClassif === "Devolução"
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                                : rowClassif === "Normal"
                                ? "bg-slate-800 border-slate-700 text-slate-200"
                                : "bg-transparent border-slate-700/70 text-slate-500"
                            )}
                          >
                            {CLASSIFICACAO_OPTIONS.map((opt) => (
                              <option
                                key={opt.value || "empty"}
                                value={opt.value}
                                className="bg-slate-900 text-slate-100"
                              >
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={cn(
                              "text-[9px] font-semibold px-1.5 py-0.5 rounded-md border inline-block whitespace-nowrap",
                              rowClassif === "Devolução"
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                                : rowClassif === "Normal"
                                ? "bg-slate-800 border-slate-700 text-slate-300"
                                : "border-transparent text-slate-500"
                            )}
                          >
                            {rowClassif || "Não definido"}
                          </span>
                        )}
                      </td>

                      {/* Obs */}
                      <td className="px-2 py-1.5">
                        {!isComposite && (
                          <span
                            className={cn(
                              "text-[9px] italic truncate block max-w-[90px] px-1 py-0.5 rounded w-fit",
                              isCrit
                                ? "text-red-400 bg-red-950/30 border border-red-900/40 not-italic"
                                : "text-slate-400"
                            )}
                          >
                            {strObs}
                          </span>
                        )}
                      </td>

                      {/* Ação */}
                      {canEdit && (
                        <td className="px-2 py-1.5 text-center whitespace-nowrap">
                          {!isComposite && (
                            <div className="flex items-center justify-center gap-0.5">
                              {destinationPositions.length > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setMoveTargetItem(singleItem)
                                    setMoveDestObjectId(destinationPositions[0]?.id || "")
                                    setMoveQty(String(singleItem.quantidade || 1))
                                    setMoveLevel(1)
                                    setMoveDepth(1)
                                  }}
                                  className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                                  title="Mover para outra posição do sistema"
                                >
                                  <Send size={11} />
                                </button>
                              )}
                              {!isSystemOrigin && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingItem(singleItem)
                                    setIsItemModalOpen(true)
                                  }}
                                  className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                  title="Editar item"
                                >
                                  <Edit2 size={11} />
                                </button>
                              )}
                              {Number(singleItem.quantidade) > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSplitTarget(singleItem)
                                    setSplitQty("")
                                  }}
                                  className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                  title="Retirar peças"
                                >
                                  <Scissors size={11} />
                                </button>
                              )}
                              {(() => {
                                const sameSku = freePallets
                                  ? freePallets.filter((g) => g.items[0]?.sku === singleItem.sku)
                                  : []
                                if (sameSku.length > 1) {
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setMergeTarget({
                                          sku: singleItem.sku,
                                          items: sameSku.map((g) => g.items[0]),
                                        })
                                        setMergeQuantities({})
                                      }}
                                      className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                                      title="Mover peças"
                                    >
                                      <GitMerge size={11} />
                                    </button>
                                  )
                                }
                                return null
                              })()}
                              {!isSystemOrigin && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeleteTarget(singleItem)
                                    setDeleteQty(String(singleItem.quantidade || "0"))
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                  title={
                                    isNonOriginSystemParticipant
                                      ? "Remover (devolve saldo ao Chão)"
                                      : "Excluir"
                                  }
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>

                    {/* Sub-rows */}
                    <AnimatePresence>
                      {isComposite &&
                        isExpanded &&
                        group.items.map((sub, si) => {
                          const subClassif = extractRowClassificacao(sub.customValues)
                          const subObs = sub.customValues?.observacao
                          const strSubObs = subObs && subObs !== 0 ? String(subObs) : "-"
                          return (
                            <motion.tr
                              key={sub.id}
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                              transition={{ delay: si * 0.04 }}
                              draggable={canEdit}
                              onDragStartCapture={canEdit ? (e) => handleDragStart(e, sub) : undefined}
                              onDragEnd={handleDragEnd}
                              className={cn(
                                "bg-blue-500/5 border-b border-blue-500/10",
                                canEdit && "cursor-grab active:cursor-grabbing",
                                draggedItem?.id === sub.id ? "opacity-50" : ""
                              )}
                            >
                              <td className="px-1 py-1">
                                <div className="w-px h-full bg-blue-700 mx-auto opacity-50" />
                              </td>
                              <td className="px-2 py-1">
                                <span className="text-[8px] font-medium text-blue-400 pl-1.5 border-l-2 border-blue-500/40">
                                  ╰ sub
                                </span>
                              </td>
                              <td className="px-2 py-1">
                                <span className="text-[10px] font-medium text-slate-300">
                                  {sub.sku || "—"}
                                </span>
                              </td>
                              <td className="px-2 py-1 max-w-[140px]">
                                <span className="text-[8px] text-slate-400 uppercase truncate block max-w-[140px]">
                                  {sub.descricao || "—"}
                                </span>
                              </td>
                              <td className="px-2 py-1 text-right">
                                <span className="text-[10px] font-medium text-slate-400">
                                  {fmtNum(sub.quantidade)}
                                </span>
                              </td>
                              <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                                {canEdit ? (
                                  <select
                                    value={subClassif}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) =>
                                      handleUpdateClassificacao(
                                        sub,
                                        e.target.value as ClassificacaoPalete
                                      )
                                    }
                                    className={cn(
                                      "text-[8px] font-semibold rounded-md px-1 py-0.5 border outline-none cursor-pointer transition-colors",
                                      subClassif === "Devolução"
                                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                                        : subClassif === "Normal"
                                        ? "bg-slate-800 border-slate-700 text-slate-200"
                                        : "bg-transparent border-slate-700/70 text-slate-500"
                                    )}
                                  >
                                    {CLASSIFICACAO_OPTIONS.map((opt) => (
                                      <option
                                        key={opt.value || "empty"}
                                        value={opt.value}
                                        className="bg-slate-900 text-slate-100"
                                      >
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-[8px] text-slate-400">
                                    {subClassif || "Não definido"}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1">
                                <span className="text-[8px] text-slate-400 truncate block max-w-[80px]">
                                  {strSubObs}
                                </span>
                              </td>
                              {canEdit && (
                                <td className="px-2 py-1 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-0.5">
                                    {destinationPositions.length > 0 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setMoveTargetItem(sub)
                                          setMoveDestObjectId(destinationPositions[0]?.id || "")
                                          setMoveQty(String(sub.quantidade || 1))
                                          setMoveLevel(1)
                                          setMoveDepth(1)
                                        }}
                                        className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                                        title="Mover para outra posição"
                                      >
                                        <Send size={10} />
                                      </button>
                                    )}
                                    {!isSystemOrigin && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingItem(sub)
                                            setIsItemModalOpen(true)
                                          }}
                                          className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                          title="Editar sub-item"
                                        >
                                          <Edit2 size={10} />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setDeleteTarget(sub)
                                            setDeleteQty(String(sub.quantidade || "0"))
                                          }}
                                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                          title={
                                            isNonOriginSystemParticipant
                                              ? "Remover (devolve ao Chão)"
                                              : "Excluir sub-item"
                                          }
                                        >
                                          <Trash2 size={10} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              )}
                            </motion.tr>
                          )
                        })}
                    </AnimatePresence>
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Banner de Conservação de Saldo (apenas sistema com saldo) ou Banner de Sistema Livre */}
      {system && !isOpenSys && balanceSnapshot && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-amber-950/25 border border-amber-800/40 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <span>{system.icon}</span>
              <span>
                {isSystemOrigin
                  ? `Origem dos Saldos (CHÃO) — ${system.name}`
                  : `Participante de ${system.name}`}
              </span>
            </span>
            <span className="text-[11px] text-slate-300 font-mono">
              Entradas - Saídas = <strong>{fmtNum(balanceSnapshot.totalSystemNet)}</strong> un.
            </span>
            <span className="text-[11px] text-amber-300 font-mono">
              No Chão: <strong>{fmtNum(balanceSnapshot.totalOrigin)}</strong> un.
            </span>
            <span className="text-[11px] text-blue-300 font-mono">
              Em Posições: <strong>{fmtNum(balanceSnapshot.totalAllocated)}</strong> un.
            </span>
          </div>
          {isSyncing && (
            <span className="text-[10px] text-amber-400 animate-pulse">
              Sincronizando saldo...
            </span>
          )}
        </div>
      )}

      {system && isOpenSys && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl border text-xs"
          style={{
            backgroundColor: `${system.color}14`,
            borderColor: `${system.color}45`,
          }}
        >
          <span className="font-bold text-white flex items-center gap-2">
            <span>{system.icon}</span>
            <span>
              {system.name} ({system.code}) · Sistema Livre (Sem Registro de Saldo)
            </span>
          </span>
          <span className="text-[11px] text-emerald-300 font-semibold">
            Lançamento livre · Alimenta o Confronto
          </span>
        </div>
      )}

      {balanceError && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-200">
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

      {/* Barra superior: KPIs + Busca + Botão Adicionar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <Layers size={13} className="text-blue-400" />
            <span className="text-slate-400">Agrupados:</span>
            <strong className="text-white font-mono">{agrupados.length}</strong>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <Package size={13} className="text-amber-400" />
            <span className="text-slate-400">Livres:</span>
            <strong className="text-white font-mono">{desagrupados.length}</strong>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-slate-400">SKUs Únicos:</span>
            <strong className="text-emerald-400 font-mono">{uniqueSkus}</strong>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-slate-400">Total Peças:</span>
            <strong className="text-white font-mono">{fmtNum(totalUnits)}</strong>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar SKU, descrição, palete..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {canEdit && !isSystemOrigin && (
            <button
              type="button"
              onClick={() => {
                setEditingItem(null)
                setIsItemModalOpen(true)
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 shrink-0 cursor-pointer transition-colors"
            >
              <Plus size={14} />
              <span>Adicionar Item</span>
            </button>
          )}
          {isSystemOrigin && (
            <span className="px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-800/40 text-[10px] font-semibold text-amber-300 shrink-0">
              Saldo alimentado via Registros
            </span>
          )}
        </div>
      </div>

      {/* Grid 2 Colunas idêntico ao "Não alocados" */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start w-full">
        {renderPalletTable(
          "Paletes Agrupados",
          agrupados,
          "Nenhum palete agrupado no momento.",
          true
        )}
        {renderPalletTable(
          "Livres (Sem Alocação / Sem Agrupamento)",
          desagrupados,
          "Nenhum item livre. Todos estão agrupados ou a lista está vazia.",
          false,
          desagrupados
        )}
      </div>

      {/* Modal Adicionar / Editar Item (sem nível e sem profundidade) */}
      {isItemModalOpen && (
        <MapeamentoItemModal
          isOpen={isItemModalOpen}
          onClose={() => {
            setIsItemModalOpen(false)
            setEditingItem(null)
          }}
          onSave={handleSaveModalItems}
          config={fakeConfig}
          posicao={positionLabel}
          posicoesDisponiveis={[positionLabel]}
          nivelInicial={0}
          profundidadeInicial={0}
          itemParaEditar={editingItem}
          isOpenSpace={true}
          availableStocks={isNonOriginSystemParticipant ? availableStocks : []}
          enforceStockLimit={Boolean(isNonOriginSystemParticipant && enforceStockLimit)}
        />
      )}

      {/* Modal Transferência / Agrupamento Drag & Drop */}
      <AnimatePresence>
        {transferModalOpen && transferPayload && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTransferModalOpen(false)}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  {transferPayload.targetType === "ungroup"
                    ? "Desagrupar Item"
                    : transferPayload.targetType === "mix"
                    ? `Agrupar em ${transferPayload.targetId}`
                    : "Criar Novo Palete Agrupado"}
                </h3>
                <button
                  onClick={() => setTransferModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Item: <strong className="text-white font-mono">{transferPayload.sourceItem.sku}</strong>{" "}
                ({fmtNum(transferPayload.sourceItem.quantidade)} un. disponíveis)
              </p>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 block mb-1.5">
                Quantidade a mover
              </label>
              <input
                type="number"
                min={1}
                max={transferPayload.sourceItem.quantidade}
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(e.target.value)}
                className="w-full h-11 rounded-xl bg-slate-950 border border-slate-700 px-3 text-center text-base font-bold text-white focus:outline-none focus:border-blue-500 mb-5"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setTransferModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmTransfer}
                  className="flex-[2] py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center justify-center gap-1.5"
                >
                  <Check size={14} /> Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Retirar / Dividir Peças */}
      <AnimatePresence>
        {splitTarget && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSplitTarget(null)}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100"
            >
              <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-400 mb-3 mx-auto">
                <Scissors size={20} />
              </div>
              <h3 className="text-base font-semibold text-center uppercase tracking-tight mb-1">
                Retirar peças
              </h3>
              <p className="text-[11px] text-center text-slate-400 mb-4">
                Retirar peças de <strong className="text-white">{splitTarget.sku}</strong> (
                {fmtNum(splitTarget.quantidade)} un.) em nova linha livre.
              </p>
              <input
                type="number"
                min={1}
                max={Number(splitTarget.quantidade) - 1}
                value={splitQty}
                onChange={(e) => setSplitQty(e.target.value)}
                placeholder="Quantidade a retirar"
                className="w-full h-12 rounded-xl bg-slate-950 border border-slate-700 text-center text-lg font-bold text-white focus:outline-none focus:border-blue-500 mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setSplitTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  disabled={
                    !(parseInt(splitQty, 10) > 0 && parseInt(splitQty, 10) < Number(splitTarget.quantidade))
                  }
                  onClick={handleConfirmSplit}
                  className="flex-[2] py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-bold text-white flex items-center justify-center gap-1.5"
                >
                  <Scissors size={14} /> Retirar Peças
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Mover / Juntar Peças */}
      <AnimatePresence>
        {mergeTarget && (() => {
          const totalAvail = mergeTarget.items.reduce((s, i) => s + (Number(i.quantidade) || 0), 0)
          const totalResult = mergeTarget.items.reduce((s, i) => {
            const val = mergeQuantities[i.id]
            const q = val !== undefined && val !== "" ? Number(val) : Number(i.quantidade) || 0
            return s + (isNaN(q) ? 0 : q)
          }, 0)
          const valid = Math.abs(totalResult - totalAvail) < 0.001

          return (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMergeTarget(null)}
                className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100"
              >
                <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-400 mb-3 mx-auto">
                  <GitMerge size={20} />
                </div>
                <h3 className="text-base font-semibold text-center uppercase tracking-tight mb-1">
                  Mover Peças — {mergeTarget.sku}
                </h3>
                <p className="text-[11px] text-center text-slate-400 mb-4">
                  Ajuste a quantidade final de cada linha (defina 0 para consolidar). O total deve permanecer {fmtNum(totalAvail)}.
                </p>
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 space-y-2 max-h-60 overflow-y-auto custom-scrollbar mb-4">
                  {mergeTarget.items.map((it, idx) => {
                    const val = mergeQuantities[it.id] !== undefined ? mergeQuantities[it.id] : it.quantidade
                    return (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60 last:border-0"
                      >
                        <span className="text-slate-300">Linha {idx + 1}</span>
                        <input
                          type="number"
                          min={0}
                          value={val}
                          onChange={(e) =>
                            setMergeQuantities((prev) => ({
                              ...prev,
                              [it.id]: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-24 rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-right font-bold text-white"
                        />
                      </div>
                    )
                  })}
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800 font-bold">
                    <span className={valid ? "text-emerald-400" : "text-red-400"}>Total Resultante</span>
                    <span className={valid ? "text-emerald-400" : "text-red-400"}>
                      {fmtNum(totalResult)} / {fmtNum(totalAvail)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMergeTarget(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={!valid}
                    onClick={handleConfirmMerge}
                    className="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold text-white flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw size={14} /> Confirmar
                  </button>
                </div>
              </motion.div>
            </div>
          )
        })()}
      </AnimatePresence>

      {/* Modal Excluir Item */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteTarget(null)}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100"
            >
              <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-red-500/10 text-red-400 mb-3 mx-auto">
                <Trash2 size={20} />
              </div>
              <h3 className="text-base font-semibold text-center uppercase tracking-tight mb-1">
                Excluir Registro
              </h3>
              <p className="text-[11px] text-center text-slate-400 mb-4">
                SKU <strong className="text-white font-mono">{deleteTarget.sku}</strong> — informe a quantidade a remover (máx. {fmtNum(deleteTarget.quantidade)}).
              </p>
              <input
                type="number"
                min={1}
                max={deleteTarget.quantidade}
                value={deleteQty}
                onChange={(e) => setDeleteQty(e.target.value)}
                className="w-full h-12 rounded-xl bg-slate-950 border border-slate-700 text-center text-lg font-bold text-white focus:outline-none focus:border-red-500 mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-[2] py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} /> Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Mover para outra Posição do Sistema */}
      <AnimatePresence>
        {moveTargetItem && system && objectId && (() => {
          const destInfo = destinationPositions.find((d) => d.id === moveDestObjectId)
          const parsedQ = parseFloat(moveQty.replace(",", "."))
          const validQty =
            !isNaN(parsedQ) && parsedQ > 0 && parsedQ <= (Number(moveTargetItem.quantidade) || 0)

          return (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMoveTargetItem(null)}
                className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                      <Send size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Mover Saldo para Posição</h3>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {moveTargetItem.sku} · Disp. no item: {fmtNum(moveTargetItem.quantidade)} un.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMoveTargetItem(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Posição de Destino (no sistema {system.code})
                    </label>
                    <select
                      value={moveDestObjectId}
                      onChange={(e) => setMoveDestObjectId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    >
                      {destinationPositions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.isCompartment ? "📦" : "📥"} {d.label}{" "}
                          {d.role === "origem" ? "(Origem / Chão)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Quantidade a Mover
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={moveTargetItem.quantidade}
                      value={moveQty}
                      onChange={(e) => setMoveQty(e.target.value)}
                      className="w-full h-11 rounded-xl bg-slate-950 border border-slate-700 text-center text-base font-bold text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {destInfo && !destInfo.isCompartment && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                          Nível (1-{Math.max(1, destInfo.levels)})
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, destInfo.levels)}
                          value={moveLevel}
                          onChange={(e) => setMoveLevel(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full h-9 rounded-xl bg-slate-950 border border-slate-700 text-center text-xs font-bold text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                          Profundidade (1-{Math.max(1, destInfo.depth)})
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, destInfo.depth)}
                          value={moveDepth}
                          onChange={(e) => setMoveDepth(Number(e.target.value) || 1)}
                          className="w-full h-9 rounded-xl bg-slate-950 border border-slate-700 text-center text-xs font-bold text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMoveTargetItem(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!validQty || !moveDestObjectId || !destInfo}
                    onClick={() => {
                      if (!destInfo || !validQty) return
                      const res = moveSkuBetweenSystemPositions({
                        system,
                        fromObjectId: objectId,
                        toObjectId: destInfo.id,
                        toPositionLabel: destInfo.label,
                        sourceItem: moveTargetItem,
                        quantityToMove: parsedQ,
                        targetLevel: destInfo.isCompartment ? 0 : moveLevel,
                        targetDepth: destInfo.isCompartment ? 0 : moveDepth,
                      })
                      if (!res.ok) {
                        setBalanceError(res.errorMessage)
                      } else {
                        setMoveTargetItem(null)
                        setItemsVersion((v) => v + 1)
                        onItemsChanged?.(
                          getLocalItems().filter((it) => it.mapeamentoId === mapeamentoId)
                        )
                      }
                    }}
                    className="flex-[2] py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-xs font-bold text-white flex items-center justify-center gap-1.5"
                  >
                    <Send size={13} /> Confirmar Movimentação
                  </button>
                </div>
              </motion.div>
            </div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
