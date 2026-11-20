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

const STORAGE_KEY_PREFIX = "nexus_balance_systems_v1"
const DEFAULT_WORKSPACE_UUID = "00000000-0000-0000-0000-000000000000"
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// IDs legados dos modelos de exemplo que existiam na carga inicial do SQL
const LEGACY_SEEDED_SYSTEM_IDS = new Set([
  "d8dd4876-f850-4cc5-83cc-992fd071d4ff",
  "46c2a877-8220-431b-adf6-b5c35b17f12b",
  "4b5fec5b-00d3-4ced-8f65-028e9e72622c",
  "c12db68d-94de-4102-89dc-18323837d2ef",
])

/**
 * Converte qualquer workspaceId (ex: "ws_demo_g300" ou UUID) em um UUID válido
 * e determinístico para o campo UUID `workspace_id` do Supabase.
 */
export function toWorkspaceUuid(workspaceId?: string | null): string {
  if (!workspaceId || !workspaceId.trim()) return DEFAULT_WORKSPACE_UUID
  const clean = workspaceId.trim()
  if (UUID_REGEX.test(clean)) return clean.toLowerCase()

  // Hash determinístico de 128 bits (4 x 32 bits FNV-1a com seeds distintas)
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
  const hexParts = seeds.map((seed, idx) => {
    let h = seed >>> 0
    const input = `${idx}:${clean}`
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, "0")
  })
  const hex = hexParts.join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
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
        const systemIds = dbSystems.map((r: any) => r.id)
        let dbParticipants: any[] = []
        if (systemIds.length > 0) {
          const { data: partData } = await supabase
            .from("system_storage_participants")
            .select("*")
            .in("system_id", systemIds)
          dbParticipants = partData || []
        }

        const mapped: BusinessSystem[] = dbSystems
          .filter((row: any) => !LEGACY_SEEDED_SYSTEM_IDS.has(row.id))
          .map((row: any) => ({
            id: row.id,
            code: row.code,
            name: row.name,
            description: row.description || "",
            color: row.color || "#3b82f6",
            icon: row.icon || "📦",
            status: row.status || "ativo",
            defaultControlMode: (row.default_control_mode as StockControlMode) || "vinculado_saldo",
            originStorageId: row.origin_storage_id || "",
            originStorageLabel: row.origin_storage_label || "",
            responsible: row.responsible || "",
            workspaceId: row.workspace_id || wsUuid,
            participants: dbParticipants
              .filter((p: any) => p.system_id === row.id)
              .map((p: any) => ({
                storageObjectId: p.storage_object_id,
                storageObjectLabel: p.storage_object_label,
                storageType: p.storage_type,
                role: p.role,
                stockControlMode: p.stock_control_mode as StockControlMode,
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
          }))

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
          const cleaned = parsed.filter(
            (sys: any) => sys && !LEGACY_SEEDED_SYSTEM_IDS.has(sys.id)
          )
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
    loadSystems()
  }, [loadSystems])

  // Salva no cache local
  const persistLocally = useCallback(
    (newSystems: BusinessSystem[]) => {
      setSystems(newSystems)
      try {
        localStorage.setItem(storageKey, JSON.stringify(newSystems))
      } catch (e) {
        console.warn("Falha ao salvar sistemas no localStorage:", e)
      }
    },
    [storageKey]
  )

  // Cadastrar novo sistema (Supabase + local)
  const addSystem = useCallback(
    (newSystem: Omit<BusinessSystem, "id" | "createdAt" | "updatedAt">) => {
      const sysId = crypto.randomUUID()
      const now = new Date().toISOString()
      const system: BusinessSystem = {
        ...newSystem,
        id: sysId,
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
          default_control_mode: newSystem.defaultControlMode || "vinculado_saldo",
          origin_storage_id: newSystem.originStorageId || null,
          origin_storage_label: newSystem.originStorageLabel || null,
          status: newSystem.status || "ativo",
          responsible: newSystem.responsible || null,
        })
        .then(({ error }) => {
          if (error) {
            console.error("Erro salvando sistema no Supabase:", error)
            return
          }
          if (Array.isArray(newSystem.participants) && newSystem.participants.length > 0) {
            supabase
              .from("system_storage_participants")
              .upsert(
                newSystem.participants.map((p) => ({
                  workspace_id: wsUuid,
                  system_id: sysId,
                  storage_object_id: p.storageObjectId,
                  storage_object_label: p.storageObjectLabel,
                  storage_type: p.storageType || "compartment",
                  role: p.role || "origem",
                  stock_control_mode: p.stockControlMode || "vinculado_saldo",
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
      const updated = systems.map((sys) =>
        sys.id === id
          ? { ...sys, ...partial, updatedAt: new Date().toISOString() }
          : sys
      )
      persistLocally(updated)

      const dbPatch: Record<string, any> = {
        updated_at: new Date().toISOString(),
      }
      if (partial.code !== undefined) dbPatch.code = partial.code
      if (partial.name !== undefined) dbPatch.name = partial.name
      if (partial.description !== undefined) dbPatch.description = partial.description
      if (partial.color !== undefined) dbPatch.color = partial.color
      if (partial.icon !== undefined) dbPatch.icon = partial.icon
      if (partial.defaultControlMode !== undefined) {
        dbPatch.default_control_mode = partial.defaultControlMode
      }
      if (partial.originStorageId !== undefined) {
        dbPatch.origin_storage_id = partial.originStorageId || null
      }
      if (partial.originStorageLabel !== undefined) {
        dbPatch.origin_storage_label = partial.originStorageLabel || null
      }
      if (partial.status !== undefined) dbPatch.status = partial.status
      if (partial.responsible !== undefined) {
        dbPatch.responsible = partial.responsible || null
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
    [systems, persistLocally]
  )

  // Vincular objeto de armazenamento (Drive, Área, etc.) a um sistema
  const linkStorageToSystem = useCallback(
    (systemId: string, participant: StorageParticipantConfig) => {
      const updated = systems.map((sys) => {
        if (sys.id !== systemId) return sys
        const existingIdx = sys.participants.findIndex(
          (p) => p.storageObjectId === participant.storageObjectId
        )
        let newParticipants: StorageParticipantConfig[]
        if (existingIdx >= 0) {
          newParticipants = [...sys.participants]
          newParticipants[existingIdx] = participant
        } else {
          newParticipants = [...sys.participants, participant]
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
            storage_object_id: participant.storageObjectId,
            storage_object_label: participant.storageObjectLabel,
            storage_type: participant.storageType || "drive_in",
            role: participant.role || "armazenamento",
            stock_control_mode: participant.stockControlMode || "vinculado_saldo",
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
