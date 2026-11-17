// ============================================================
// NEXUS ERP — Resources / types.ts
// Motor Universal de Recursos
// Define as interfaces para tipos, instâncias, vínculos e regras
// ESCOPO: Mapeamento & Configuração — NÃO é módulo operacional
// ============================================================

// ── Categorias de Recurso ────────────────────────────────────
export type ResourceCategory =
  | "produto"      // SKU, item de estoque
  | "embalagem"    // Caixa, pallet, saco, tambor
  | "equipamento"  // Empilhadeira, transpaleteira
  | "material"     // Matéria-prima, insumo
  | "documento"    // NF, OS, laudo, certificado
  | "arquivo"      // Arquivo digital vinculado
  | "vaga"         // Slot de doca, posição de estacionamento
  | "unidade"      // Unidade de medida personalizada
  | "custom"       // Tipo definido pelo usuário

// ── Metadados de cada categoria ──────────────────────────────
export const RESOURCE_CATEGORY_META: Record<
  ResourceCategory,
  { label: string; icon: string; color: string; description: string }
> = {
  produto:     { label: "Produto",      icon: "📦", color: "#3b82f6", description: "SKU / item de estoque" },
  embalagem:   { label: "Embalagem",    icon: "🗃️", color: "#8b5cf6", description: "Caixa, pallet, saco, tambor" },
  equipamento: { label: "Equipamento",  icon: "🔧", color: "#f59e0b", description: "Empilhadeira, transpaleteira, escada" },
  material:    { label: "Material",     icon: "🧱", color: "#10b981", description: "Matéria-prima, insumo" },
  documento:   { label: "Documento",   icon: "📄", color: "#6366f1", description: "NF, OS, laudo, certificado" },
  arquivo:     { label: "Arquivo",      icon: "🗂️", color: "#64748b", description: "Arquivo digital vinculado" },
  vaga:        { label: "Vaga",         icon: "🅿️", color: "#ec4899", description: "Slot de doca, posição de estacionamento" },
  unidade:     { label: "Unidade",      icon: "📐", color: "#0ea5e9", description: "Unidade de medida personalizada" },
  custom:      { label: "Personalizado",icon: "🔷", color: "#a78bfa", description: "Tipo definido pelo usuário" },
}

// ── Campo Dinâmico de um Tipo de Recurso ─────────────────────
export type ResourceFieldType =
  | "text"
  | "number"
  | "select"
  | "boolean"
  | "date"
  | "textarea"
  | "url"

export interface ResourceField {
  id: string
  key: string                   // identificador técnico (camelCase)
  label: string                 // rótulo para o usuário
  type: ResourceFieldType
  required: boolean
  defaultValue?: string | number | boolean
  options?: string[]            // para type === "select"
  unit?: string                 // ex: "kg", "m", "un"
  placeholder?: string
  order: number
}

// ── Regra de Vinculação ──────────────────────────────────────
export interface LinkageRule {
  id: string
  name: string
  allowedLocationTypes: string[]        // ex: ["drive_in", "custom_area"]
  allowedClassifications?: string[]     // ex: ["rua", "bloco", "armazenagem"]
  forbiddenClassifications?: string[]   // ex: ["corredor", "externo"]
  maxLocationsPerResource?: number      // null = ilimitado
  maxResourcesPerLocation?: number      // null = ilimitado
  requiresConfirmation: boolean
  notes?: string
}

// ── Tipo de Recurso (Catálogo) ───────────────────────────────
export interface ResourceType {
  id: string
  name: string                          // ex: "Produto de Prateleira"
  slug: string                          // ex: "produto_prateleira"
  category: ResourceCategory
  icon?: string                         // emoji ou código de ícone
  color?: string                        // cor de destaque (#hex)
  description?: string
  fields: ResourceField[]               // campos configuráveis desta categoria
  linkageRules: LinkageRule[]           // regras de como este tipo se vincula a locais
  unitOfMeasure?: string                // "un", "kg", "m²", "cx", "pallet"
  tags?: string[]
  isBuiltIn: boolean                    // true = pré-definido pelo sistema
  createdAt: string
  updatedAt: string
}

// ── Localização vinculada a uma instância ────────────────────
export type LinkageType = "primario" | "secundario" | "temporario" | "referencia"

export interface ResourceLocation {
  id: string
  locationId: string                    // MapObject.id
  locationLabel: string                 // ex: "Drive G300004G0281"
  locationPath: string                  // ex: "Galpão G300 › Rua 01 › Drive G300004G0281"
  locationType: string                  // MapObject.type
  locationClassification?: string      // MapObject.classification
  linkageType: LinkageType
  quantity?: number
  unit?: string
  notes?: string
  linkedAt: string
}

// ── Status de uma Instância ──────────────────────────────────
export type ResourceStatus =
  | "ativo"
  | "inativo"
  | "pendente"
  | "bloqueado"
  | "em_uso"
  | "manutencao"

export const RESOURCE_STATUS_META: Record<
  ResourceStatus,
  { label: string; color: string; icon: string }
> = {
  ativo:      { label: "Ativo",         color: "#10b981", icon: "✅" },
  inativo:    { label: "Inativo",       color: "#6b7280", icon: "⬜" },
  pendente:   { label: "Pendente",      color: "#f59e0b", icon: "⏳" },
  bloqueado:  { label: "Bloqueado",     color: "#ef4444", icon: "⛔" },
  em_uso:     { label: "Em Uso",        color: "#3b82f6", icon: "🔄" },
  manutencao: { label: "Manutenção",    color: "#a78bfa", icon: "🔧" },
}

// ── Instância de um Recurso ──────────────────────────────────
export interface ResourceInstance {
  id: string
  typeId: string                        // ResourceType.id
  code: string                          // código técnico (ex: "EMP-04", "SKU-00123")
  label: string                         // nome legível
  status: ResourceStatus
  props: Record<string, unknown>        // campos dinâmicos do tipo
  linkedLocations: ResourceLocation[]   // vínculos com locais do mapa
  responsible?: string
  notes?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

// ── Estado Global do Motor de Recursos ──────────────────────
export interface ResourceStore {
  types: ResourceType[]
  instances: ResourceInstance[]
}

// ── Resultado de Validação de Vínculo ───────────────────────
export interface LinkageValidationResult {
  valid: boolean
  warnings: string[]
  errors: string[]
}
