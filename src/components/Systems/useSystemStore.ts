// ============================================================
// NEXUS ERP — Systems / useSystemStore.ts
// Hook de Gerenciamento de Sistemas de Saldo (Laboratório)
// Persistência Híbrida: Supabase (business_systems & system_storage_participants) + localStorage
// ============================================================

"use client"

import { useState, useEffect, useCallback } from "react"
import { BusinessSystem, StorageParticipantConfig, StockControlMode } from "./types"
import { DEFAULT_BUSINESS_SYSTEMS } from "./systemRegistry"
import { supabase } from "@/lib/supabase"

const STORAGE_KEY = "nexus_balance_systems_v1"

export function useSystemStore() {
  const [systems, setSystems] = useState<BusinessSystem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // ── Carregar do Supabase com fallback ao localStorage ──────
  const loadSystems = useCallback(async () => {
    try {
      // 1. Tenta carregar do Supabase
      const { data: dbSystems, error: sysError } = await supabase
        .from("business_systems")
        .select("*")
        .order("created_at", { ascending: true })

      const { data: dbParticipants } = await supabase
        .from("system_storage_participants")
        .select("*")

      if (!sysError && dbSystems && dbSystems.length > 0) {
        const mapped: BusinessSystem[] = dbSystems.map((row: any) => ({
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
          workspaceId: row.workspace_id || "00000000-0000-0000-0000-000000000000",
          participants: (dbParticipants || [])
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped))
        setIsLoaded(true)
        return
      }
    } catch (e) {
      console.warn("Falha ao buscar sistemas do Supabase, tentando cache local:", e)
    }

    // 2. Fallback ao cache local (localStorage)
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSystems(parsed)
          setIsLoaded(true)
          return
        }
      }
    } catch (e) {
      console.warn("Falha ao ler sistemas do localStorage:", e)
    }

    setSystems([])
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    loadSystems()
  }, [loadSystems])

  // Salva no cache local
  const persistLocally = useCallback((newSystems: BusinessSystem[]) => {
    setSystems(newSystems)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSystems))
    } catch (e) {
      console.warn("Falha ao salvar sistemas no localStorage:", e)
    }
  }, [])

  // Cadastrar novo sistema (Supabase + local)
  const addSystem = useCallback(
    (newSystem: Omit<BusinessSystem, "id" | "createdAt" | "updatedAt">) => {
      const sysId = crypto.randomUUID()
      const now = new Date().toISOString()
      const system: BusinessSystem = {
        ...newSystem,
        id: sysId,
        createdAt: now,
        updatedAt: now,
      }

      persistLocally([...systems, system])

      // Persiste no Supabase em segundo plano
      supabase
        .from("business_systems")
        .insert({
          id: sysId,
          workspace_id: "00000000-0000-0000-0000-000000000000",
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
          if (error) console.error("Erro salvando sistema no Supabase:", error)
        })

      return system
    },
    [systems, persistLocally]
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

      // Atualiza no Supabase
      supabase
        .from("business_systems")
        .update({
          code: partial.code,
          name: partial.name,
          description: partial.description,
          color: partial.color,
          icon: partial.icon,
          default_control_mode: partial.defaultControlMode,
          origin_storage_id: partial.originStorageId || null,
          origin_storage_label: partial.originStorageLabel || null,
          status: partial.status,
          responsible: partial.responsible || null,
          updated_at: new Date().toISOString(),
        })
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

      supabase
        .from("business_systems")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("Erro removendo sistema no Supabase:", error)
        })
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
    [systems, persistLocally]
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

  // Restaurar sistemas padrão de fábrica
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
