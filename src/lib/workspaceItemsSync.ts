"use client"

// =============================================================================
// NEXUS ERP — workspaceItemsSync.ts
// Persistência em nuvem (Supabase) dos itens alocados em Drive-Ins e Compartimentos
// do módulo Workspace (chaves sys_*, comp_*, ws_*).
//
// Armazena snapshots por `mapeamentoId` em `universal_records` ancorados no
// registro reservado `business_systems` (code = "__NEXUS_WS_ITEMS__"), garantindo
// sincronização imediata entre computadores com isolamento total das tabelas G300.
// =============================================================================

import { supabase } from "./supabase"
import { getLocalItems, saveLocalItems, type MapeamentoItem } from "./mapeamentosStorage"
import { DEFAULT_WORKSPACE_UUID, UUID_REGEX, toWorkspaceUuid } from "./workspaceUuid"
import type { BusinessSystem } from "@/components/Systems/types"

export const ITEMS_ANCHOR_CODE = "__NEXUS_WS_ITEMS__"
const LOCAL_TS_STORAGE_KEY = "nexus_ws_items_ts_v1"

const anchorIdCache = new Map<string, string>()
const systemWsUuidCache = new Map<string, string>()
const writeQueueByKey = new Map<string, Promise<void>>()

function isWorkspacePositionKey(key: string): boolean {
  return key.startsWith("sys_") || key.startsWith("comp_") || key.startsWith("ws_")
}

import { parsePositionKeyParts } from "./driveOccupancy"

function parseKeyParts(mapeamentoId: string, workspaceHint?: string | null) {
  return parsePositionKeyParts(mapeamentoId, workspaceHint)
}

function getLocalTimestamps(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(LOCAL_TS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function setLocalTimestamp(mapeamentoId: string, iso: string): void {
  if (typeof window === "undefined") return
  try {
    const map = getLocalTimestamps()
    map[mapeamentoId] = iso
    localStorage.setItem(LOCAL_TS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore storage errors
  }
}

async function resolveWorkspaceUuidForKey(
  mapeamentoId: string,
  workspaceHint?: string | null
): Promise<string> {
  if (workspaceHint && workspaceHint.trim()) {
    return toWorkspaceUuid(workspaceHint)
  }

  const parsed = parseKeyParts(mapeamentoId, workspaceHint)
  if (parsed.workspaceId) {
    return toWorkspaceUuid(parsed.workspaceId)
  }

  if (parsed.systemId) {
    const cached = systemWsUuidCache.get(parsed.systemId)
    if (cached) return cached

    if (UUID_REGEX.test(parsed.systemId)) {
      try {
        const { data } = await supabase
          .from("business_systems")
          .select("workspace_id")
          .eq("id", parsed.systemId)
          .maybeSingle()
        if (data?.workspace_id) {
          systemWsUuidCache.set(parsed.systemId, data.workspace_id)
          return data.workspace_id
        }
      } catch {
        // fallback below
      }
    }
  }

  return DEFAULT_WORKSPACE_UUID
}

async function ensureItemsAnchorSystemId(wsUuid: string): Promise<string | null> {
  const cached = anchorIdCache.get(wsUuid)
  if (cached) return cached

  try {
    const { data: existing, error: selErr } = await supabase
      .from("business_systems")
      .select("id")
      .eq("workspace_id", wsUuid)
      .eq("code", ITEMS_ANCHOR_CODE)
      .maybeSingle()

    if (!selErr && existing?.id) {
      anchorIdCache.set(wsUuid, existing.id)
      return existing.id
    }

    const newId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : undefined

    const { data: inserted, error: insErr } = await supabase
      .from("business_systems")
      .insert({
        ...(newId ? { id: newId } : {}),
        workspace_id: wsUuid,
        code: ITEMS_ANCHOR_CODE,
        name: "Workspace Position Items Store",
        description: "Armazenamento interno de posições e lotes do Workspace",
        status: "ativo",
        default_control_mode: "livre",
      })
      .select("id")
      .maybeSingle()

    if (!insErr && inserted?.id) {
      anchorIdCache.set(wsUuid, inserted.id)
      return inserted.id
    }

    // Corrida de inserção paralela: busca novamente
    const { data: retry } = await supabase
      .from("business_systems")
      .select("id")
      .eq("workspace_id", wsUuid)
      .eq("code", ITEMS_ANCHOR_CODE)
      .maybeSingle()

    if (retry?.id) {
      anchorIdCache.set(wsUuid, retry.id)
      return retry.id
    }
  } catch (err) {
    console.warn("Aviso ao resolver âncora de itens do workspace:", err)
  }

  return null
}

/**
 * Persiste no Supabase a lista completa de itens de uma posição (`mapeamentoId`).
 * Usa fila por chave para evitar sobrescrita fora de ordem.
 */
export function persistPositionItemsToSupabase(
  mapeamentoId: string,
  items: MapeamentoItem[],
  workspaceHint?: string | null
): Promise<void> {
  if (!mapeamentoId || !isWorkspacePositionKey(mapeamentoId)) {
    return Promise.resolve()
  }

  const now = new Date().toISOString()
  setLocalTimestamp(mapeamentoId, now)

  const snapshot = items.map((it) => ({ ...it }))
  const prevQueue = writeQueueByKey.get(mapeamentoId) || Promise.resolve()

  const nextTask = prevQueue
    .catch(() => {})
    .then(async () => {
      try {
        const wsUuid = await resolveWorkspaceUuidForKey(mapeamentoId, workspaceHint)
        const anchorId = await ensureItemsAnchorSystemId(wsUuid)
        if (!anchorId) return

        const parsed = parseKeyParts(mapeamentoId, workspaceHint)
        const storageObjectId = parsed.objectId || mapeamentoId

        const { data: existingRows, error: findErr } = await supabase
          .from("universal_records")
          .select("id")
          .eq("system_id", anchorId)
          .eq("resource_id", mapeamentoId)
          .order("created_at", { ascending: false })

        if (findErr) {
          console.warn("Aviso ao consultar snapshot de posição:", findErr.message)
          return
        }

        const payload = {
          workspace_id: wsUuid,
          system_id: anchorId,
          record_type: "ajuste",
          resource_id: mapeamentoId,
          storage_object_id: storageObjectId,
          quantity: Math.max(1, snapshot.length),
          unit: "un",
          status: "concluido",
          metadata: {
            mapeamentoId,
            items: snapshot,
            updatedAt: now,
          },
        }

        if (existingRows && existingRows.length > 0) {
          const primaryId = existingRows[0].id
          const { error: updErr } = await supabase
            .from("universal_records")
            .update(payload)
            .eq("id", primaryId)
          if (updErr) {
            console.error("Erro ao atualizar snapshot de posição no Supabase:", updErr.message)
          }
          // Remove eventuais duplicatas antigas
          if (existingRows.length > 1) {
            const dupIds = existingRows.slice(1).map((r) => r.id)
            const { error: delErr } = await supabase
              .from("universal_records")
              .delete()
              .in("id", dupIds)
            if (delErr) {
              console.warn("Aviso ao remover duplicatas de posição:", delErr.message)
            }
          }
        } else {
          const { error: insErr } = await supabase.from("universal_records").insert(payload)
          if (insErr) {
            console.error("Erro ao inserir snapshot de posição no Supabase:", insErr.message)
            // Em caso de âncora expirada (FK), invalida cache e tenta uma vez
            anchorIdCache.delete(wsUuid)
            const freshAnchorId = await ensureItemsAnchorSystemId(wsUuid)
            if (freshAnchorId && freshAnchorId !== anchorId) {
              const { error: retryErr } = await supabase
                .from("universal_records")
                .insert({ ...payload, system_id: freshAnchorId })
              if (retryErr) {
                console.error("Falha na retentativa de inserção de posição:", retryErr.message)
              }
            }
          }
        }
      } catch (err) {
        console.warn("Aviso ao salvar itens da posição no Supabase:", err)
      }
    })

  writeQueueByKey.set(mapeamentoId, nextTask)
  return nextTask
}

interface DbSnapshotRow {
  resource_id?: string | null
  metadata?: {
    mapeamentoId?: string
    items?: MapeamentoItem[]
    updatedAt?: string
  } | null
  created_at?: string | null
}

function mergeRowsIntoLocalStorage(
  dbRows: DbSnapshotRow[],
  scopeKeysPredicate: (mapeamentoId: string) => boolean,
  workspaceHint?: string | null
): void {
  const localAll = getLocalItems()
  const localTsMap = getLocalTimestamps()

  const dbByKey = new Map<string, { items: MapeamentoItem[]; updatedAt: string }>()
  for (const row of dbRows) {
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {}
    const key = String(meta.mapeamentoId || row.resource_id || "")
    if (!key || !scopeKeysPredicate(key)) continue
    const rowUpdatedAt = String(meta.updatedAt || row.created_at || "")
    const prev = dbByKey.get(key)
    if (!prev || rowUpdatedAt > prev.updatedAt) {
      const itemsArr: MapeamentoItem[] = Array.isArray(meta.items) ? meta.items : []
      dbByKey.set(key, {
        items: itemsArr,
        updatedAt: rowUpdatedAt,
      })
    }
  }

  // Agrupa itens locais que pertencem ao escopo atual
  const localByKey = new Map<string, MapeamentoItem[]>()
  const outsideScope: MapeamentoItem[] = []
  for (const it of localAll) {
    if (scopeKeysPredicate(it.mapeamentoId)) {
      const list = localByKey.get(it.mapeamentoId) || []
      list.push(it)
      localByKey.set(it.mapeamentoId, list)
    } else {
      outsideScope.push(it)
    }
  }

  const mergedInScope: MapeamentoItem[] = []
  const allScopeKeys = new Set<string>([...dbByKey.keys(), ...localByKey.keys()])
  const keysToUpload: Array<{ key: string; items: MapeamentoItem[] }> = []

  allScopeKeys.forEach((key) => {
    const dbEntry = dbByKey.get(key)
    const localItems = localByKey.get(key) || []
    const localTs = localTsMap[key]

    if (dbEntry && localItems.length === 0) {
      // Computador novo ou cache local vazio -> usa nuvem
      mergedInScope.push(...dbEntry.items)
      if (dbEntry.updatedAt) setLocalTimestamp(key, dbEntry.updatedAt)
    } else if (dbEntry && localItems.length > 0) {
      const dbTime = dbEntry.updatedAt ? new Date(dbEntry.updatedAt).getTime() : 0
      const localTime = localTs ? new Date(localTs).getTime() : 0
      if (!localTs || dbTime >= localTime) {
        mergedInScope.push(...dbEntry.items)
        if (dbEntry.updatedAt) setLocalTimestamp(key, dbEntry.updatedAt)
      } else {
        // Local é mais recente (edição pendente)
        mergedInScope.push(...localItems)
        keysToUpload.push({ key, items: localItems })
      }
    } else if (!dbEntry && localItems.length > 0) {
      // Dados locais pré-existentes no computador A que ainda não estavam na nuvem -> sobe para nuvem!
      mergedInScope.push(...localItems)
      keysToUpload.push({ key, items: localItems })
    }
  })

  saveLocalItems([...outsideScope, ...mergedInScope])

  // Migra em segundo plano itens locais que ainda não existiam no Supabase
  keysToUpload.forEach(({ key, items }) => {
    persistPositionItemsToSupabase(key, items, workspaceHint).catch(() => {})
  })
}

/**
 * Hidrata do Supabase todas as posições vinculadas a um sistema (`sys_${system.id}_*`).
 * Deve ser chamada ANTES de `syncOriginWithSystemBalance` ao abrir em outro computador.
 */
export async function hydrateSystemItemsFromSupabase(system: BusinessSystem): Promise<void> {
  if (!system?.id) return
  if (system.workspaceId) {
    systemWsUuidCache.set(system.id, toWorkspaceUuid(system.workspaceId))
  }
  const wsUuid = toWorkspaceUuid(system.workspaceId)
  const prefix = `sys_${system.id}_`

  try {
    const { data: anchor } = await supabase
      .from("business_systems")
      .select("id")
      .eq("workspace_id", wsUuid)
      .eq("code", ITEMS_ANCHOR_CODE)
      .maybeSingle()

    let dbRows: DbSnapshotRow[] = []
    if (anchor?.id) {
      anchorIdCache.set(wsUuid, anchor.id)
      const { data, error } = await supabase
        .from("universal_records")
        .select("resource_id, metadata, created_at")
        .eq("system_id", anchor.id)
        .like("resource_id", `${prefix}%`)

      if (!error && Array.isArray(data)) {
        dbRows = data as DbSnapshotRow[]
      }
    }

    mergeRowsIntoLocalStorage(dbRows, (key) => key.startsWith(prefix), wsUuid)
  } catch (err) {
    console.warn("Aviso ao hidratar posições do sistema:", err)
  }
}

/**
 * Hidrata do Supabase todas as posições de um Workspace (sistemas + compartimentos/drives livres).
 */
export async function hydrateWorkspaceItemsFromSupabase(workspaceId: string): Promise<void> {
  if (!workspaceId) return
  const wsUuid = toWorkspaceUuid(workspaceId)

  try {
    const { data: anchor } = await supabase
      .from("business_systems")
      .select("id")
      .eq("workspace_id", wsUuid)
      .eq("code", ITEMS_ANCHOR_CODE)
      .maybeSingle()

    let dbRows: DbSnapshotRow[] = []
    if (anchor?.id) {
      anchorIdCache.set(wsUuid, anchor.id)
      const { data, error } = await supabase
        .from("universal_records")
        .select("resource_id, metadata, created_at")
        .eq("system_id", anchor.id)

      if (!error && Array.isArray(data)) {
        dbRows = data as DbSnapshotRow[]
      }
    }

    // Descobre quais sistemas pertencem a este workspace para incluir no escopo
    const { data: wsSystems } = await supabase
      .from("business_systems")
      .select("id")
      .eq("workspace_id", wsUuid)

    const wsSystemPrefixes = new Set<string>(
      ((wsSystems as Array<{ id: string }> | null) || []).map((s) => `sys_${s.id}_`)
    )
    const compPrefix = `comp_${workspaceId}_`
    const wsPrefix = `ws_${workspaceId}_`

    const inScope = (key: string) => {
      if (key.startsWith(compPrefix) || key.startsWith(wsPrefix)) return true
      for (const p of wsSystemPrefixes) {
        if (key.startsWith(p)) return true
      }
      // Também captura linhas vindas do próprio DB deste workspace
      return dbRows.some((r) => String(r.resource_id || "") === key)
    }

    mergeRowsIntoLocalStorage(dbRows, inScope, wsUuid)
  } catch (err) {
    console.warn("Aviso ao hidratar itens do workspace:", err)
  }
}

/**
 * Hidrata uma única posição específica (`comp_*` ou `ws_*` ou `sys_*`) do Supabase.
 */
export async function hydratePositionKeyFromSupabase(
  mapeamentoId: string,
  workspaceHint?: string | null
): Promise<void> {
  if (!mapeamentoId || !isWorkspacePositionKey(mapeamentoId)) return
  try {
    const wsUuid = await resolveWorkspaceUuidForKey(mapeamentoId, workspaceHint)
    const { data: anchor } = await supabase
      .from("business_systems")
      .select("id")
      .eq("workspace_id", wsUuid)
      .eq("code", ITEMS_ANCHOR_CODE)
      .maybeSingle()

    let dbRows: DbSnapshotRow[] = []
    if (anchor?.id) {
      anchorIdCache.set(wsUuid, anchor.id)
      const { data, error } = await supabase
        .from("universal_records")
        .select("resource_id, metadata, created_at")
        .eq("system_id", anchor.id)
        .eq("resource_id", mapeamentoId)

      if (!error && Array.isArray(data)) {
        dbRows = data as DbSnapshotRow[]
      }
    }

    mergeRowsIntoLocalStorage(dbRows, (key) => key === mapeamentoId, wsUuid)
  } catch (err) {
    console.warn("Aviso ao hidratar posição específica:", err)
  }
}

/**
 * Remove snapshots de posições de um sistema excluído.
 */
export async function deleteSystemItemsFromSupabase(
  systemId: string,
  workspaceId?: string | null
): Promise<void> {
  if (!systemId) return
  const prefix = `sys_${systemId}_`

  const filtered = getLocalItems().filter((it) => !it.mapeamentoId.startsWith(prefix))
  saveLocalItems(filtered)

  try {
    const wsUuid = await resolveWorkspaceUuidForKey(`${prefix}x`, workspaceId)
    const { data: anchor } = await supabase
      .from("business_systems")
      .select("id")
      .eq("workspace_id", wsUuid)
      .eq("code", ITEMS_ANCHOR_CODE)
      .maybeSingle()

    if (anchor?.id) {
      await supabase
        .from("universal_records")
        .delete()
        .eq("system_id", anchor.id)
        .like("resource_id", `${prefix}%`)
    }
  } catch (err) {
    console.warn("Aviso ao remover posições do sistema no Supabase:", err)
  }
}
