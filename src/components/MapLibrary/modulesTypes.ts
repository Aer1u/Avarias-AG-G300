// ============================================================
// NEXUS ERP — MapLibrary / modulesTypes.ts
// Tipos do Construtor de Módulos, Entidades, Campos Customizados
// e Integração com Mapeamento Universal
// ============================================================

export type FieldDataType =
  | "text"
  | "number"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "select"
  | "multi_select"
  | "location_ref"
  | "entity_ref"
  | "file"
  | "image"

export interface CustomFieldDefinition {
  id: string
  key: string
  label: string
  dataType: FieldDataType
  isRequired: boolean
  isUnique?: boolean
  defaultValue?: string
  options?: { value: string; label: string; color?: string }[]
  refEntityId?: string
  order: number
}

export interface CustomEntityDefinition {
  id: string
  moduleId?: string
  slug: string
  name: string
  pluralName: string
  description?: string
  isLinkableToMap: boolean
  fields: CustomFieldDefinition[]
}

export interface BusinessModuleDefinition {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  color: string
  isActive: boolean
  entities: CustomEntityDefinition[]
}

// Registro real de dados associado a uma entidade
export interface CustomEntityRecord {
  id: string
  entityId: string
  locationId?: string     // Vínculo chave com a localização do mapa (Drive, Sala, Posição)
  title: string
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// Configuração de Hierarquia Física
export interface HierarchyLevel {
  id: string
  level: number           // 0: Empresa/Galpão, 1: Área, 2: Chão/Rua, 3: Bloco, 4: Drive, 5: Posição
  name: string
  pluralName: string
  codePrefix?: string
  canContainSublevels: boolean
  icon: string
  color: string
}

// Regra de Endereçamento Universal
export interface AddressingRuleConfig {
  id: string
  name: string
  prefix: string                // ex: "G300"
  aisleLength: number           // dígitos do corredor/chão (ex: 3 -> "004")
  sideType: "par_impar" | "letra" | "livre" // "G", "D", "E", "PAR", "ÍMPAR"
  blockDigits: number           // dígitos do bloco (ex: 2 -> "02")
  seqDigits: number             // dígitos da posição/drive (ex: 2 ou 3)
  separator: string             // ex: "" ou "-"
  examplePreview: string
}
