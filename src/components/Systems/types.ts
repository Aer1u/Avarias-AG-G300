// ============================================================
// NEXUS ERP — Systems / types.ts
// Arquitetura Universal de Sistemas de Saldo (Laboratório)
// ESCOPO: Mapeamento & Configuração isolado
// NÃO altera tabelas legadas nem interfere no módulo operacional
// ============================================================

export type StockControlMode = "livre" | "vinculado_saldo"

export type StorageRole =
  | "origem"         // ex: Objeto CHÃO que recebe o saldo inicial
  | "armazenamento"   // ex: Drive-In, Porta-Paletes
  | "quarentena"     // ex: Área de Quarentena
  | "retrabalho"     // ex: Bancada de Retrabalho
  | "expedicao"      // ex: Doca / Staging
  | "transito"       // ex: Corredor / Trânsito

export interface StoragePermissions {
  allowInbound: boolean      // pode receber saldos deste sistema
  allowOutbound: boolean     // pode transferir/enviar saldos deste sistema
  allowReturnToOrigin: boolean // pode devolver para a origem (ex: de volta ao CHÃO)
}

export interface StorageParticipantConfig {
  storageObjectId: string    // MapObject.id
  storageObjectLabel: string // Label do objeto (ex: "Drive G300004G0281" ou "CHÃO")
  storageType: string        // "drive_in", "custom_area", etc.
  role: StorageRole
  stockControlMode: StockControlMode
  permissions: StoragePermissions
  maxCapacityUnits?: number
  allowedResourceCategories?: string[] // ex: ["produto"]
  notes?: string
  configuredAt: string
}

export interface BusinessSystem {
  id: string
  code: string                 // ex: "AVARIAS_G300", "RETRABALHO", "QUARENTENA"
  name: string                 // ex: "Sistema de Avarias G300"
  description: string
  color: string                // cor de identificação (#hex)
  icon: string                 // emoji ou identificador de ícone
  originStorageId?: string     // MapObject.id do objeto de origem (ex: ID do CHÃO)
  originStorageLabel?: string  // Nome legível da origem (ex: "CHÃO G300")
  status: "ativo" | "inativo" | "configuracao"
  defaultControlMode: StockControlMode // padrão para novos objetos vinculados
  participants: StorageParticipantConfig[] // objetos do mapa que participam
  allowedMovementTypes: string[] // ex: ["transferencia", "ajuste", "baixa"]
  responsible?: string
  workspaceId: string          // para isolamento multi-tenant futuro
  createdAt: string
  updatedAt: string
}

export interface SystemStore {
  systems: BusinessSystem[]
}
