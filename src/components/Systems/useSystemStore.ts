// ============================================================
// NEXUS ERP — Systems / useSystemStore.ts
// Hook de Gerenciamento de Sistemas de Saldo (Workspace / Laboratório)
// Persistência Híbrida: Supabase (business_systems & system_storage_participants) + localStorage
// Isolado por workspace_id e sem dados de exemplo pré-carregados
// ============================================================

"use client"

import { useState, useEffect, useCallback } from "react"
import { BusinessSystem, StorageParticipantConfig, StockControlMode } from "./types"
import { DEFAULT_BUSINESS_SYSTEMS } from "./systemRegistry"
import { supabase } from "@/lib/supabase"
import { toWorkspaceUuid } from "@/lib/workspaceUuid"
import { deleteSystemItemsFromSupabase } from "@/lib/workspaceItemsSync"

const STORAGE_KEY_PREFIX = "nexus_balance_systems_v1"
export const OPEN_SYSTEM_ORIGIN_SENTINEL = "__OPEN_SYSTEM__"
export const SYSTEMS_UPDATED_EVENT = "nexus:systems-updated"

// IDs legados dos modelos de exemplo que existiam na carga inicial do SQL
const LEGACY_SEEDED_SYSTEM_IDS = new Set([
  "d8dd4876-f850-4cc5-83cc-992fd071d4ff",
  "46c2a877-8220-431b-adf6-b5c35b17f12b",
  "4b5fec5b-00d3-4ced-8f65-028e9e72622c",
  "c12db68d-94de-4102-89dc-18323837d2ef",
])

export { toWorkspaceUuid }

interface DbBusinessSystemRow {
  id: string
  code: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  status?: string | null
  default_control_mode?: string | null
  origin_storage_id?: string | null
  origin_storage_label?: string | null
  responsible?: string | null
  workspace_id?: string | null
  created_at: string
  updated_at: string
}

interface DbParticipantRow {
  system_id: string
  storage_object_id: string
  storage_object_label: string
  storage_type: string
  role: StorageParticipantConfig["role"]
  stock_control_mode?: string | null
  allow_inbound?: boolean | null
  allow_outbound?: boolean | null
  allow_return_to_origin?: boolean | null
  configured_at?: string | null
}

function broadcastSystemsUpdate(storageKey: string, nextSystems: BusinessSystem[]) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(SYSTEMS_UPDATED_EVENT, {
      detail: { storageKey, systems: nextSystems },
    })
  )
}

export function useSystemStore(workspaceId?: string) {
  const wsUuid = toWorkspaceUuid(workspaceId)
  const storageKey = workspaceId
    ? `${STORAGE_KEY_PREFIX}_${workspaceId}`
    : STORAGE_KEY_PREFIX

  const [systems, setSystems] = useState<BusinessSystem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // ── Carregar do Supabase com fallback ao localStorage ──────
  const loadSystems = useCallback(async () => {
    try {
      // 1. Tenta carregar do Supabase filtrado pelo workspace atual
      const { data: dbSystems, error: sysError } = await supabase
        .from("business_systems")
        .select("*")
        .eq("workspace_id", wsUuid)
        .order("created_at", { ascending: true })

      if (!sysError && Array.isArray(dbSystems)) {
        const rows = dbSystems as DbBusinessSystemRow[]
        const systemIds = rows.map((r) => r.id)
        let dbParticipants: DbParticipantRow[] = []
        if (systemIds.length > 0) {
          const { data: partData } = await supabase
            .from("system_storage_participants")
            .select("*")
            .in("system_id", systemIds)
          dbParticipants = (partData as DbParticipantRow[] | null) || []
        }

        const mapped: BusinessSystem[] = rows
          .filter(
            (row) =>
              !LEGACY_SEEDED_SYSTEM_IDS.has(row.id) &&
              !String(row.code || "").startsWith("__NEXUS_")
          )
          .map((row) => {
            const isOpen = row.origin_storage_id === OPEN_SYSTEM_ORIGIN_SENTINEL
            return {
              id: row.id,
              code: row.code,
              name: row.name,
              description: row.description || "",
              color: row.color || "#3b82f6",
              icon: row.icon || "📦",
              systemStyle: isOpen ? "aberto" : "completo",
              status: (row.status as BusinessSystem["status"]) || "ativo",
              defaultControlMode: isOpen
                ? "livre"
                : (row.default_control_mode as StockControlMode) || "vinculado_saldo",
              originStorageId: isOpen ? "" : row.origin_storage_id || "",
              originStorageLabel: isOpen ? "" : row.origin_storage_label || "",
              responsible: row.responsible || "",
              workspaceId: row.workspace_id || wsUuid,
              participants: dbParticipants
                .filter((p) => p.system_id === row.id)
                .map((p) => ({
                  storageObjectId: p.storage_object_id,
                  storageObjectLabel: p.storage_object_label,
                  storageType: p.storage_type,
                  role: p.role,
                  stockControlMode: isOpen
                    ? "livre"
                    : (p.stock_control_mode as StockControlMode) || "vinculado_saldo",
                  permissions: {
                    allowInbound: p.allow_inbound ?? true,
                    allowOutbound: p.allow_outbound ?? true,
                    allowReturnToOrigin: p.allow_return_to_origin ?? true,
                  },
                  configuredAt: p.configured_at || row.created_at,
                })),
              allowedMovementTypes: ["entrada", "transferencia", "baixa"],
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            }
          })

        setSystems(mapped)
        try {
          localStorage.setItem(storageKey, JSON.stringify(mapped))
          // Limpa cache global antigo se continha modelos de exemplo
          if (workspaceId) {
            localStorage.removeItem(STORAGE_KEY_PREFIX)
          }
        } catch {
          // ignore storage quota errors
        }
        broadcastSystemsUpdate(storageKey, mapped)
        setIsLoaded(true)
        return
      }
    } catch (e) {
      console.warn("Falha ao buscar sistemas do Supabase, tentando cache local:", e)
    }

    // 2. Fallback ao cache local (apenas se o Supabase falhou/offline)
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .filter((sys: BusinessSystem) => sys && !LEGACY_SEEDED_SYSTEM_IDS.has(sys.id))
            .map((sys: BusinessSystem) => ({
              ...sys,
              systemStyle: sys.systemStyle === "aberto" ? "aberto" : "completo",
            })) as BusinessSystem[]
          setSystems(cleaned)
          setIsLoaded(true)
          return
        }
      }
    } catch (e) {
      console.warn("Falha ao ler sistemas do localStorage:", e)
    }

    setSystems([])
    setIsLoaded(true)
  }, [wsUuid, storageKey, workspaceId])

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadSystems()
    })
  }, [loadSystems])

  // Sincronização em tempo real entre múltiplas instâncias de useSystemStore na mesma página
  useEffect(() => {
    if (typeof window === "undefined") return
    const handleSync = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ storageKey?: string; systems?: BusinessSystem[] }>
      if (
        customEvt.detail?.storageKey === storageKey &&
        Array.isArray(customEvt.detail.systems)
      ) {
        setSystems(customEvt.detail.systems)
      }
    }
    window.addEventListener(SYSTEMS_UPDATED_EVENT, handleSync)
    return () => {
      window.removeEventListener(SYSTEMS_UPDATED_EVENT, handleSync)
    }
  }, [storageKey])

  // Salva no cache local e notifica demais instâncias
  const persistLocally = useCallback(
    (newSystems: BusinessSystem[]) => {
      setSystems(newSystems)
      try {
        localStorage.setItem(storageKey, JSON.stringify(newSystems))
      } catch (e) {
        console.warn("Falha ao salvar sistemas no localStorage:", e)
      }
      broadcastSystemsUpdate(storageKey, newSystems)
    },
    [storageKey]
  )

  // Cadastrar novo sistema (Supabase + local)
  const addSystem = useCallback(
    (newSystem: Omit<BusinessSystem, "id" | "createdAt" | "updatedAt">) => {
      const sysId = crypto.randomUUID()
      const now = new Date().toISOString()
      const isOpen = newSystem.systemStyle === "aberto"
      const normalizedControlMode: StockControlMode = isOpen
        ? "livre"
        : newSystem.defaultControlMode || "vinculado_saldo"

      const system: BusinessSystem = {
        ...newSystem,
        id: sysId,
        systemStyle: isOpen ? "aberto" : "completo",
        defaultControlMode: normalizedControlMode,
        originStorageId: isOpen ? "" : newSystem.originStorageId || "",
        originStorageLabel: isOpen ? "" : newSystem.originStorageLabel || "",
        workspaceId: wsUuid,
        createdAt: now,
        updatedAt: now,
      }

      persistLocally([...systems, system])

      // Persiste no Supabase em segundo plano
      supabase
        .from("business_systems")
        .insert({
          id: sysId,
          workspace_id: wsUuid,
          code: newSystem.code,
          name: newSystem.name,
          description: newSystem.description || "",
          color: newSystem.color || "#3b82f6",
          icon: newSystem.icon || "📦",
          default_control_mode: normalizedControlMode,
          origin_storage_id: isOpen
            ? OPEN_SYSTEM_ORIGIN_SENTINEL
            : newSystem.originStorageId || null,
          origin_storage_label: isOpen ? null : newSystem.originStorageLabel || null,
          status: newSystem.status || "ativo",
          responsible: newSystem.responsible || null,
        })
        .then(({ error }) => {
          if (error) {
            console.error("Erro salvando sistema no Supabase:", error)
            return
          }
          if (Array.isArray(system.participants) && system.participants.length > 0) {
            supabase
              .from("system_storage_participants")
              .upsert(
                system.participants.map((p) => ({
                  workspace_id: wsUuid,
                  system_id: sysId,
                  storage_object_id: p.storageObjectId,
                  storage_object_label: p.storageObjectLabel,
                  storage_type: p.storageType || "compartment",
                  role: p.role || "origem",
                  stock_control_mode: isOpen
                    ? "livre"
                    : p.stockControlMode || "vinculado_saldo",
                })),
                { onConflict: "system_id,storage_object_id" }
              )
              .then(({ error: partErr }) => {
                if (partErr) console.error("Erro salvando participante origem:", partErr)
              })
          }
        })

      return system
    },
    [systems, persistLocally, wsUuid]
  )

  // Atualizar sistema (Supabase + local)
  const updateSystem = useCallback(
    (id: string, partial: Partial<BusinessSystem>) => {
      const currentSys = systems.find((s) => s.id === id)
      const nextStyle = partial.systemStyle ?? currentSys?.systemStyle ?? "completo"
      const isOpen = nextStyle === "aberto"

      const normalizedPartial: Partial<BusinessSystem> = {
        ...partial,
        systemStyle: nextStyle,
        ...(isOpen
          ? {
              defaultControlMode: "livre",
              originStorageId: "",
              originStorageLabel: "",
            }
          : {}),
      }

      const updated = systems.map((sys) =>
        sys.id === id
          ? { ...sys, ...normalizedPartial, updatedAt: new Date().toISOString() }
          : sys
      )
      persistLocally(updated)

      const dbPatch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (normalizedPartial.code !== undefined) dbPatch.code = normalizedPartial.code
      if (normalizedPartial.name !== undefined) dbPatch.name = normalizedPartial.name
      if (normalizedPartial.description !== undefined) dbPatch.description = normalizedPartial.description
      if (normalizedPartial.color !== undefined) dbPatch.color = normalizedPartial.color
      if (normalizedPartial.icon !== undefined) dbPatch.icon = normalizedPartial.icon
      if (normalizedPartial.defaultControlMode !== undefined) {
        dbPatch.default_control_mode = normalizedPartial.defaultControlMode
      }
      if (isOpen) {
        dbPatch.origin_storage_id = OPEN_SYSTEM_ORIGIN_SENTINEL
        dbPatch.origin_storage_label = null
        dbPatch.default_control_mode = "livre"
      } else {
        if (partial.originStorageId !== undefined || partial.systemStyle === "completo") {
          dbPatch.origin_storage_id = partial.originStorageId || null
        }
        if (partial.originStorageLabel !== undefined || partial.systemStyle === "completo") {
          dbPatch.origin_storage_label = partial.originStorageLabel || null
        }
      }
      if (normalizedPartial.status !== undefined) dbPatch.status = normalizedPartial.status
      if (normalizedPartial.responsible !== undefined) {
        dbPatch.responsible = normalizedPartial.responsible || null
      }

      supabase
        .from("business_systems")
        .update(dbPatch)
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("Erro atualizando sistema no Supabase:", error)
        })
    },
    [systems, persistLocally]
  )

  // Remover sistema (Supabase + local)
  const deleteSystem = useCallback(
    (id: string) => {
      const filtered = systems.filter((sys) => sys.id !== id)
      persistLocally(filtered)

      ;(async () => {
        try {
          await deleteSystemItemsFromSupabase(id, wsUuid)
          await supabase.from("universal_movements").delete().eq("system_id", id)
          await supabase.from("universal_balances").delete().eq("system_id", id)
          await supabase.from("universal_records").delete().eq("system_id", id)
          const { error } = await supabase.from("business_systems").delete().eq("id", id)
          if (error) console.error("Erro removendo sistema no Supabase:", error)
        } catch (err) {
          console.error("Erro removendo sistema no Supabase:", err)
        }
      })()
    },
    [systems, persistLocally, wsUuid]
  )

  // Vincular objeto de armazenamento (Drive, Área, etc.) a um sistema
  const linkStorageToSystem = useCallback(
    (systemId: string, participant: StorageParticipantConfig) => {
      const targetSystem = systems.find((s) => s.id === systemId)
      const effectiveParticipant: StorageParticipantConfig =
        targetSystem?.systemStyle === "aberto"
          ? { ...participant, stockControlMode: "livre" }
          : participant

      const updated = systems.map((sys) => {
        if (sys.id !== systemId) return sys
        const existingIdx = sys.participants.findIndex(
          (p) => p.storageObjectId === effectiveParticipant.storageObjectId
        )
        let newParticipants: StorageParticipantConfig[]
        if (existingIdx >= 0) {
          newParticipants = [...sys.participants]
          newParticipants[existingIdx] = effectiveParticipant
        } else {
          newParticipants = [...sys.participants, effectiveParticipant]
        }
        return { ...sys, participants: newParticipants, updatedAt: new Date().toISOString() }
      })
      persistLocally(updated)

      // Salva participante no Supabase
      supabase
        .from("system_storage_participants")
        .upsert(
          {
            workspace_id: wsUuid,
            system_id: systemId,
            storage_object_id: effectiveParticipant.storageObjectId,
            storage_object_label: effectiveParticipant.storageObjectLabel,
            storage_type: effectiveParticipant.storageType || "drive_in",
            role: effectiveParticipant.role || "armazenamento",
            stock_control_mode: effectiveParticipant.stockControlMode || "vinculado_saldo",
          },
          { onConflict: "system_id,storage_object_id" }
        )
        .then(({ error }) => {
          if (error) console.error("Erro salvando participante no Supabase:", error)
        })
    },
    [systems, persistLocally, wsUuid]
  )

  // Desvincular objeto de armazenamento de um sistema
  const unlinkStorageFromSystem = useCallback(
    (systemId: string, storageObjectId: string) => {
      const updated = systems.map((sys) => {
        if (sys.id !== systemId) return sys
        return {
          ...sys,
          participants: sys.participants.filter(
            (p) => p.storageObjectId !== storageObjectId
          ),
          updatedAt: new Date().toISOString(),
        }
      })
      persistLocally(updated)

      supabase
        .from("system_storage_participants")
        .delete()
        .eq("system_id", systemId)
        .eq("storage_object_id", storageObjectId)
        .then(({ error }) => {
          if (error) console.error("Erro desvinculando participante no Supabase:", error)
        })
    },
    [systems, persistLocally]
  )

  // Obter todos os sistemas dos quais um objeto participa
  const getSystemsForStorage = useCallback(
    (storageObjectId: string): { system: BusinessSystem; config: StorageParticipantConfig }[] => {
      const result: { system: BusinessSystem; config: StorageParticipantConfig }[] = []
      systems.forEach((sys) => {
        const config = sys.participants.find((p) => p.storageObjectId === storageObjectId)
        if (config) {
          result.push({ system: sys, config })
        }
      })
      return result
    },
    [systems]
  )

  // Obter configuração de participante específica
  const getParticipantConfig = useCallback(
    (systemId: string, storageObjectId: string): StorageParticipantConfig | undefined => {
      const sys = systems.find((s) => s.id === systemId)
      return sys?.participants.find((p) => p.storageObjectId === storageObjectId)
    },
    [systems]
  )

  // Restaurar sistemas padrão (vazio)
  const resetToDefaults = useCallback(() => {
    persistLocally(DEFAULT_BUSINESS_SYSTEMS)
  }, [persistLocally])

  return {
    systems,
    isLoaded,
    addSystem,
    updateSystem,
    deleteSystem,
    linkStorageToSystem,
    unlinkStorageFromSystem,
    getSystemsForStorage,
    getParticipantConfig,
    resetToDefaults,
  }
}
