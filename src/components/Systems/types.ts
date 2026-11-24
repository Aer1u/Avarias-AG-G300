// ============================================================
// NEXUS ERP — Systems / types.ts
// Arquitetura Universal de Sistemas de Saldo (Laboratório)
// ESCOPO: Mapeamento & Configuração isolado
// NÃO altera tabelas legadas nem interfere no módulo operacional
// ============================================================

export type StockControlMode = "livre" | "vinculado_saldo"

export type SystemStyle = "completo" | "aberto"

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
  systemStyle?: SystemStyle    // "completo" (Registros+Mapeamento+Confronto) | "aberto" (só Mapeamento+Confronto)
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

// ── REGISTROS DE SALDO DO SISTEMA ─────────────────────────────
export interface SystemStockRecord {
  id: string
  systemId: string
  sku: string
  description: string
  quantity: number
  date?: string
  data?: string
  entrada?: number | null
  saida?: number | null
  tipo_avaria?: string | null
  turno?: number | null
  origem?: string | null
  transportadora?: string | null
  nota_fiscal?: number | string | null
  placa?: string | null
  container?: string | null
  lacre?: string | null
  observacao?: string | null
  lotNumber?: string
  positionLabel?: string       // ex: "CHÃO", "DRIVE G300-01", "BOX-04"
  positionObjectId?: string   // MapObject.id se vinculado a uma estrutura física
  registeredBy?: string
  registeredAt: string
  notes?: string
  isNew?: boolean
  isDirty?: boolean
}

// ── CONFRONTO ANALÍTICO CONFIGURÁVEL (JSON) ───────────────────
export interface ConfrontoImportedItem {
  sku: string
  description: string
  quantity: number
  rawLine?: string
}

export interface SystemConfrontoConfig {
  id: string
  systemId: string
  name: string                 // ex: "A501", "G501", "SAP-WMS", "ESTOQUE_BA"
  description?: string
  importedItems: ConfrontoImportedItem[]
  totalItems: number
  totalQuantity: number
  importedAt: string
  importedBy?: string
  status: "ativo" | "arquivado"
}

// Linha de conciliação analítica resultante do confronto
export interface ConfrontoComparisonRow {
  sku: string
  description: string
  systemQty: number            // Saldo presente no Sistema / Mapeamento
  confrontoQty: number         // Saldo da Relação Importada (ex: A501)
  diff: number                 // systemQty - confrontoQty
  status: "match" | "missing" | "excess" | "only_system" | "only_confronto"
}

export interface ConfrontoSummary {
  confrontoName: string
  totalSkus: number
  totalSystemQty: number
  totalConfrontoQty: number
  matchCount: number
  divergenceCount: number
  accuracyPercentage: number
}
