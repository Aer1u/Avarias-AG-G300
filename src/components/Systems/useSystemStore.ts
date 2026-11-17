// ============================================================
// NEXUS ERP — Systems / useSystemStore.ts
// Hook de Gerenciamento de Sistemas de Saldo (Laboratório)
// Persistência local isolada em localStorage
// ============================================================

"use client"

import { useState, useEffect, useCallback } from "react"
import { BusinessSystem, StorageParticipantConfig, StockControlMode } from "./types"
import { DEFAULT_BUSINESS_SYSTEMS } from "./systemRegistry"

const STORAGE_KEY = "nexus_balance_systems_v1"

export function useSystemStore() {
  const [systems, setSystems] = useState<BusinessSystem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Carrega do localStorage ou inicia com os padrões
  useEffect(() => {
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
    setSystems(DEFAULT_BUSINESS_SYSTEMS)
    setIsLoaded(true)
  }, [])

  // Salva no localStorage quando o estado mudar
  const persistSystems = useCallback((newSystems: BusinessSystem[]) => {
    setSystems(newSystems)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSystems))
    } catch (e) {
      console.warn("Falha ao salvar sistemas no localStorage:", e)
    }
  }, [])

  // Cadastrar novo sistema
  const addSystem = useCallback(
    (newSystem: Omit<BusinessSystem, "id" | "createdAt" | "updatedAt">) => {
      const system: BusinessSystem = {
        ...newSystem,
        id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      persistSystems([...systems, system])
      return system
    },
    [systems, persistSystems]
  )

  // Atualizar sistema
  const updateSystem = useCallback(
    (id: string, partial: Partial<BusinessSystem>) => {
      const updated = systems.map((sys) =>
        sys.id === id
          ? { ...sys, ...partial, updatedAt: new Date().toISOString() }
          : sys
      )
      persistSystems(updated)
    },
    [systems, persistSystems]
  )

  // Remover sistema
  const deleteSystem = useCallback(
    (id: string) => {
      const filtered = systems.filter((sys) => sys.id !== id)
      persistSystems(filtered)
    },
    [systems, persistSystems]
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
      persistSystems(updated)
    },
    [systems, persistSystems]
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
      persistSystems(updated)
    },
    [systems, persistSystems]
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
    persistSystems(DEFAULT_BUSINESS_SYSTEMS)
  }, [persistSystems])

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
