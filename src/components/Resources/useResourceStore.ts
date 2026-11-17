// ============================================================
// NEXUS ERP — Resources / useResourceStore.ts
// Store e Hook de gerenciamento do Motor Universal de Recursos
// Persistência local (localStorage) com fallback e catálogo padrão
// ============================================================

import { useState, useEffect, useCallback, useMemo } from "react"
import type { MapObject } from "../MapLibrary/types"
import type {
  ResourceType,
  ResourceInstance,
  ResourceLocation,
  ResourceCategory,
  LinkageValidationResult,
} from "./types"
import { BUILT_IN_RESOURCE_TYPES } from "./resourceRegistry"

const STORAGE_KEY_TYPES = "nexus_resource_types_v1"
const STORAGE_KEY_INSTANCES = "nexus_resource_instances_v1"

// ── Dados Iniciais Demonstrativos de Recursos Vinculados ao Mapa G300 ──
const INITIAL_DEMO_INSTANCES: ResourceInstance[] = [
  {
    id: "inst_prod_01",
    typeId: "rt_produto",
    code: "SKU-90210",
    label: "Leite Integral UHT 1L (Fardo c/ 12)",
    status: "ativo",
    props: {
      sku: "SKU-90210",
      descricao: "Leite Integral UHT 1L longa vida",
      pesoBruto: 12.6,
      familia: "Laticínios",
      categoria: "Alimentos Secos",
    },
    linkedLocations: [
      {
        id: "loc_link_1",
        locationId: "drive_G300004G0281",
        locationLabel: "Drive G300004G0281",
        locationPath: "Galpão G300 › Bloco 01 › Rua 01 › Drive G300004G0281 › Canal MKLOG",
        locationType: "drive_in",
        linkageType: "primario",
        quantity: 16,
        unit: "pallets",
        notes: "Armazenamento consolidado no canal MKLOG",
        linkedAt: new Date().toISOString(),
      },
    ],
    responsible: "Supervisão G300",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "inst_equip_01",
    typeId: "rt_equipamento",
    code: "EMP-04",
    label: "Empilhadeira Retrátil 2.5T",
    status: "em_uso",
    props: {
      tipo: "Empilhadeira Retrátil",
      capacidade: 2.5,
      marca: "Still FM-X 14",
      patrimonio: "PAT-004481",
      altura_max: 8.5,
    },
    linkedLocations: [
      {
        id: "loc_link_2",
        locationId: "rua_01",
        locationLabel: "Rua 01",
        locationPath: "Galpão G300 › Bloco 01 › Rua 01",
        locationType: "custom_area",
        linkageType: "primario",
        quantity: 1,
        unit: "un",
        notes: "Alocada para manobra na Rua 01",
        linkedAt: new Date().toISOString(),
      },
    ],
    responsible: "Operador Carlos",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "inst_emb_01",
    typeId: "rt_embalagem",
    code: "PBR-LOTE-40",
    label: "Lote de Paletes PBR 1 Padronizados",
    status: "ativo",
    props: {
      tipo: "Pallet PBR",
      material: "Madeira Tratada",
      capacidade: 1200,
      dimensoes: "100x120x14",
      retornavel: true,
    },
    linkedLocations: [
      {
        id: "loc_link_3",
        locationId: "drive_G300004G0301",
        locationLabel: "Drive G300004G0301",
        locationPath: "Galpão G300 › Bloco 01 › Rua 01 › Drive G300004G0301",
        locationType: "drive_in",
        linkageType: "primario",
        quantity: 20,
        unit: "pallets",
        notes: "Posições nominais parametrizadas",
        linkedAt: new Date().toISOString(),
      },
    ],
    responsible: "Líder Logístico",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "inst_doc_01",
    typeId: "rt_documento",
    code: "NF-89211",
    label: "NF Entrada 89211 - Carga Laticínios",
    status: "ativo",
    props: {
      tipo: "Nota Fiscal",
      numero: "NF-89211",
      emissao: "2026-11-15",
      responsavel: "Recebimento Central",
    },
    linkedLocations: [
      {
        id: "loc_link_4",
        locationId: "drive_G300004G0281",
        locationLabel: "Drive G300004G0281",
        locationPath: "Galpão G300 › Bloco 01 › Rua 01 › Drive G300004G0281",
        locationType: "drive_in",
        linkageType: "referencia",
        notes: "Documento fiscal de origem do lote armazenado",
        linkedAt: new Date().toISOString(),
      },
    ],
    responsible: "Conferência Fiscal",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export function useResourceStore() {
  const [types, setTypes] = useState<ResourceType[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_TYPES)
        if (saved) return JSON.parse(saved)
      } catch (err) {
        console.warn("Falha ao ler tipos de recursos do localStorage", err)
      }
    }
    return BUILT_IN_RESOURCE_TYPES
  })

  const [instances, setInstances] = useState<ResourceInstance[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_INSTANCES)
        if (saved) return JSON.parse(saved)
      } catch (err) {
        console.warn("Falha ao ler instâncias de recursos do localStorage", err)
      }
    }
    return INITIAL_DEMO_INSTANCES
  })

  // Sincroniza tipos no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TYPES, JSON.stringify(types))
    } catch {
      // Ignora erro de quota em ambiente restrito
    }
  }, [types])

  // Sincroniza instâncias no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_INSTANCES, JSON.stringify(instances))
    } catch {
      // Ignora erro de quota
    }
  }, [instances])

  // ── 1. Ações sobre Tipos de Recurso ──────────────────────────
  const addType = useCallback((typeData: Omit<ResourceType, "id" | "createdAt" | "updatedAt">) => {
    const id = `rt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const now = new Date().toISOString()
    const newType: ResourceType = {
      ...typeData,
      id,
      createdAt: now,
      updatedAt: now,
    }
    setTypes((prev) => [...prev, newType])
    return newType
  }, [])

  const updateType = useCallback((id: string, updates: Partial<ResourceType>) => {
    setTypes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t))
    )
  }, [])

  const deleteType = useCallback((id: string) => {
    setTypes((prev) => prev.filter((t) => t.id !== id))
    // Opcional: manter instâncias ou alertar
  }, [])

  // ── 2. Ações sobre Instâncias de Recurso ──────────────────────
  const addInstance = useCallback(
    (instanceData: Omit<ResourceInstance, "id" | "createdAt" | "updatedAt">) => {
      const id = `inst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      const now = new Date().toISOString()
      const newInst: ResourceInstance = {
        ...instanceData,
        id,
        createdAt: now,
        updatedAt: now,
      }
      setInstances((prev) => [newInst, ...prev])
      return newInst
    },
    []
  )

  const updateInstance = useCallback((id: string, updates: Partial<ResourceInstance>) => {
    setInstances((prev) =>
      prev.map((inst) =>
        inst.id === id ? { ...inst, ...updates, updatedAt: new Date().toISOString() } : inst
      )
    )
  }, [])

  const deleteInstance = useCallback((id: string) => {
    setInstances((prev) => prev.filter((inst) => inst.id !== id))
  }, [])

  // ── 3. Ações de Vínculo: Recurso ↔ Local(is) Físico(s) ───────
  const linkResourceToLocation = useCallback(
    (
      instanceId: string,
      locationData: Omit<ResourceLocation, "id" | "linkedAt">
    ) => {
      const linkId = `link_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      const newLink: ResourceLocation = {
        ...locationData,
        id: linkId,
        linkedAt: new Date().toISOString(),
      }

      setInstances((prev) =>
        prev.map((inst) => {
          if (inst.id !== instanceId) return inst
          // Se já possui o mesmo locationId, atualiza os dados em vez de duplicar
          const exists = inst.linkedLocations.some((l) => l.locationId === locationData.locationId)
          let updatedLinks: ResourceLocation[]
          if (exists) {
            updatedLinks = inst.linkedLocations.map((l) =>
              l.locationId === locationData.locationId ? { ...l, ...newLink } : l
            )
          } else {
            updatedLinks = [...inst.linkedLocations, newLink]
          }
          return {
            ...inst,
            linkedLocations: updatedLinks,
            updatedAt: new Date().toISOString(),
          }
        })
      )
      return newLink
    },
    []
  )

  const unlinkResourceFromLocation = useCallback((instanceId: string, locationId: string) => {
    setInstances((prev) =>
      prev.map((inst) => {
        if (inst.id !== instanceId) return inst
        return {
          ...inst,
          linkedLocations: inst.linkedLocations.filter((l) => l.locationId !== locationId),
          updatedAt: new Date().toISOString(),
        }
      })
    )
  }, [])

  // ── 4. Consultas e Filtros ───────────────────────────────────
  const getInstancesByLocationId = useCallback(
    (locationId: string): ResourceInstance[] => {
      return instances.filter((inst) =>
        inst.linkedLocations.some((l) => l.locationId === locationId)
      )
    },
    [instances]
  )

  // Validação de Regras de Vínculo
  const validateLinkage = useCallback(
    (
      instance: ResourceInstance,
      targetLocation: MapObject
    ): LinkageValidationResult => {
      const typeDef = types.find((t) => t.id === instance.typeId)
      const warnings: string[] = []
      const errors: string[] = []

      if (!typeDef) {
        return { valid: true, warnings: ["Tipo de recurso não encontrado"], errors: [] }
      }

      for (const rule of typeDef.linkageRules) {
        // Verifica tipo de local permitido
        if (
          rule.allowedLocationTypes.length > 0 &&
          !rule.allowedLocationTypes.includes(targetLocation.type) &&
          !rule.allowedLocationTypes.includes(targetLocation.category)
        ) {
          errors.push(
            `A regra "${rule.name}" não permite vínculo com local do tipo "${targetLocation.type}" (${targetLocation.category})`
          )
        }

        // Verifica classificação permitida
        if (
          rule.allowedClassifications &&
          rule.allowedClassifications.length > 0 &&
          targetLocation.classification &&
          !rule.allowedClassifications.includes(targetLocation.classification)
        ) {
          warnings.push(
            `Classificação "${targetLocation.classification}" não está explicitamente recomendada para este recurso.`
          )
        }

        // Verifica máximo de locais por recurso (ex: equipamento em apenas 1 local)
        if (rule.maxLocationsPerResource && instance.linkedLocations.length >= rule.maxLocationsPerResource) {
          const isAlreadyLinked = instance.linkedLocations.some(
            (l) => l.locationId === targetLocation.id
          )
          if (!isAlreadyLinked) {
            errors.push(
              `Limite excedido: este recurso só pode estar em ${rule.maxLocationsPerResource} local(is) simultaneamente.`
            )
          }
        }
      }

      return {
        valid: errors.length === 0,
        warnings,
        errors,
      }
    },
    [types]
  )

  // Contagem por categoria
  const countsByCategory = useMemo(() => {
    const counts: Record<ResourceCategory, number> = {
      produto: 0,
      embalagem: 0,
      equipamento: 0,
      material: 0,
      documento: 0,
      arquivo: 0,
      vaga: 0,
      unidade: 0,
      custom: 0,
    }
    for (const inst of instances) {
      const type = types.find((t) => t.id === inst.typeId)
      if (type && counts[type.category] !== undefined) {
        counts[type.category]++
      } else {
        counts.custom++
      }
    }
    return counts
  }, [instances, types])

  return {
    types,
    instances,
    countsByCategory,
    addType,
    updateType,
    deleteType,
    addInstance,
    updateInstance,
    deleteInstance,
    linkResourceToLocation,
    unlinkResourceFromLocation,
    getInstancesByLocationId,
    validateLinkage,
  }
}
