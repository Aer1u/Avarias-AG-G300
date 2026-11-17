// ============================================================
// NEXUS ERP — Resources / resourceRegistry.ts
// Catálogo padrão de Tipos de Recurso pré-definidos pelo sistema
// ============================================================

import type { ResourceType } from "./types"

function nowIso() {
  return new Date().toISOString()
}

export const BUILT_IN_RESOURCE_TYPES: ResourceType[] = [
  // ── 1. PRODUTO ──────────────────────────────────────────────
  {
    id: "rt_produto",
    name: "Produto / SKU",
    slug: "produto",
    category: "produto",
    icon: "📦",
    color: "#3b82f6",
    description: "Item de estoque identificado por SKU. Pode ser armazenado em drives, prateleiras e áreas.",
    unitOfMeasure: "un",
    isBuiltIn: true,
    tags: ["estoque", "sku", "produto"],
    fields: [
      { id: "pf1", key: "sku",       label: "SKU",              type: "text",   required: true,  order: 1, placeholder: "Ex: SKU-00123" },
      { id: "pf2", key: "descricao", label: "Descrição",        type: "text",   required: false, order: 2 },
      { id: "pf3", key: "pesoBruto", label: "Peso Bruto (kg)",  type: "number", required: false, order: 3, unit: "kg" },
      { id: "pf4", key: "pesoLiq",   label: "Peso Líquido (kg)", type: "number", required: false, order: 4, unit: "kg" },
      { id: "pf5", key: "altura",    label: "Altura (cm)",      type: "number", required: false, order: 5, unit: "cm" },
      { id: "pf6", key: "familia",   label: "Família",          type: "text",   required: false, order: 6 },
      { id: "pf7", key: "categoria", label: "Categoria",        type: "text",   required: false, order: 7 },
    ],
    linkageRules: [
      {
        id: "lr_produto_drive",
        name: "Produto em Drive-In",
        allowedLocationTypes: ["drive_in"],
        allowedClassifications: [],
        maxLocationsPerResource: undefined,
        maxResourcesPerLocation: undefined,
        requiresConfirmation: false,
      },
      {
        id: "lr_produto_area",
        name: "Produto em Área / Setor",
        allowedLocationTypes: ["custom_area", "floor"],
        allowedClassifications: ["armazenagem", "quarentena", "staging"],
        maxLocationsPerResource: undefined,
        maxResourcesPerLocation: undefined,
        requiresConfirmation: false,
      },
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },

  // ── 2. EMBALAGEM ─────────────────────────────────────────────
  {
    id: "rt_embalagem",
    name: "Embalagem",
    slug: "embalagem",
    category: "embalagem",
    icon: "🗃️",
    color: "#8b5cf6",
    description: "Caixa, pallet, saco, tambor ou outro tipo de embalagem.",
    unitOfMeasure: "un",
    isBuiltIn: true,
    tags: ["embalagem", "palete", "caixa"],
    fields: [
      { id: "ef1", key: "tipo",       label: "Tipo",             type: "select", required: true,  order: 1, options: ["Pallet PBR", "Caixa Papelão", "Saco", "Tambor", "Big Bag", "Outros"] },
      { id: "ef2", key: "material",   label: "Material",         type: "text",   required: false, order: 2 },
      { id: "ef3", key: "capacidade", label: "Capacidade (kg)",  type: "number", required: false, order: 3, unit: "kg" },
      { id: "ef4", key: "dimensoes",  label: "Dimensões (LxCxA cm)", type: "text", required: false, order: 4, placeholder: "Ex: 100x120x14" },
      { id: "ef5", key: "retornavel", label: "Retornável",       type: "boolean",required: false, order: 5 },
    ],
    linkageRules: [
      {
        id: "lr_emb_drive",
        name: "Embalagem em Drive-In ou Área",
        allowedLocationTypes: ["drive_in", "custom_area"],
        allowedClassifications: [],
        requiresConfirmation: false,
      },
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },

  // ── 3. EQUIPAMENTO ───────────────────────────────────────────
  {
    id: "rt_equipamento",
    name: "Equipamento",
    slug: "equipamento",
    category: "equipamento",
    icon: "🔧",
    color: "#f59e0b",
    description: "Empilhadeira, transpaleteira, escada ou outro equipamento operacional.",
    unitOfMeasure: "un",
    isBuiltIn: true,
    tags: ["equipamento", "empilhadeira", "paleteira"],
    fields: [
      { id: "eqf1", key: "tipo",       label: "Tipo",             type: "select", required: true,  order: 1, options: ["Empilhadeira Retrátil", "Empilhadeira Contrabalançada", "Transpaleteira Elétrica", "Paleteira Manual", "Escada", "Plataforma", "Outros"] },
      { id: "eqf2", key: "capacidade", label: "Capacidade (ton)", type: "number", required: false, order: 2, unit: "ton" },
      { id: "eqf3", key: "marca",      label: "Marca / Modelo",   type: "text",   required: false, order: 3 },
      { id: "eqf4", key: "patrimonio", label: "Patrimônio",       type: "text",   required: false, order: 4 },
      { id: "eqf5", key: "altura_max", label: "Altura Máx. (m)", type: "number", required: false, order: 5, unit: "m" },
    ],
    linkageRules: [
      {
        id: "lr_eq_any",
        name: "Equipamento em qualquer local",
        allowedLocationTypes: ["drive_in", "custom_area", "floor"],
        maxLocationsPerResource: 1,
        requiresConfirmation: true,
        notes: "Um equipamento só pode estar em um local por vez.",
      },
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },

  // ── 4. MATERIAL ──────────────────────────────────────────────
  {
    id: "rt_material",
    name: "Material / Insumo",
    slug: "material",
    category: "material",
    icon: "🧱",
    color: "#10b981",
    description: "Matéria-prima ou insumo de produção/manutenção.",
    unitOfMeasure: "un",
    isBuiltIn: true,
    tags: ["material", "insumo"],
    fields: [
      { id: "mf1", key: "descricao",  label: "Descrição",        type: "text",   required: true,  order: 1 },
      { id: "mf2", key: "unidade",    label: "Unidade de Medida",type: "select", required: true,  order: 2, options: ["un", "kg", "m", "m²", "m³", "litro", "caixa"] },
      { id: "mf3", key: "fornecedor", label: "Fornecedor",       type: "text",   required: false, order: 3 },
      { id: "mf4", key: "lote",       label: "Referência de Lote",type: "text",  required: false, order: 4 },
    ],
    linkageRules: [
      {
        id: "lr_mat_area",
        name: "Material em qualquer área",
        allowedLocationTypes: ["drive_in", "custom_area"],
        requiresConfirmation: false,
      },
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },

  // ── 5. DOCUMENTO ─────────────────────────────────────────────
  {
    id: "rt_documento",
    name: "Documento",
    slug: "documento",
    category: "documento",
    icon: "📄",
    color: "#6366f1",
    description: "NF, OS, laudo, certificado ou qualquer documento associado a um local.",
    isBuiltIn: true,
    tags: ["documento", "nf", "laudo"],
    fields: [
      { id: "df1", key: "tipo",       label: "Tipo de Documento",type: "select", required: true,  order: 1, options: ["Nota Fiscal", "Ordem de Serviço", "Laudo Técnico", "Certificado", "Contrato", "Relatório", "Outros"] },
      { id: "df2", key: "numero",     label: "Número / Código",  type: "text",   required: true,  order: 2 },
      { id: "df3", key: "emissao",    label: "Data de Emissão",  type: "date",   required: false, order: 3 },
      { id: "df4", key: "validade",   label: "Validade",         type: "date",   required: false, order: 4 },
      { id: "df5", key: "responsavel",label: "Responsável",      type: "text",   required: false, order: 5 },
      { id: "df6", key: "url",        label: "Link do Documento", type: "url",   required: false, order: 6 },
    ],
    linkageRules: [
      {
        id: "lr_doc_any",
        name: "Documento em qualquer local",
        allowedLocationTypes: ["drive_in", "custom_area", "floor"],
        requiresConfirmation: false,
      },
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },

  // ── 6. VAGA ──────────────────────────────────────────────────
  {
    id: "rt_vaga",
    name: "Vaga / Slot",
    slug: "vaga",
    category: "vaga",
    icon: "🅿️",
    color: "#ec4899",
    description: "Posição de estacionamento, slot de doca ou vaga de equipamento.",
    isBuiltIn: true,
    tags: ["vaga", "doca", "slot"],
    fields: [
      { id: "vf1", key: "tipo",        label: "Tipo de Vaga",     type: "select", required: true,  order: 1, options: ["Doca de Recebimento", "Doca de Expedição", "Estacionamento", "Slot de Equipamento", "Vaga Livre"] },
      { id: "vf2", key: "capacidade",  label: "Capacidade",       type: "text",   required: false, order: 2, placeholder: "Ex: 1 caminhão, 2 pallets" },
      { id: "vf3", key: "restricoes",  label: "Restrições",       type: "textarea",required: false, order: 3 },
    ],
    linkageRules: [
      {
        id: "lr_vaga_area",
        name: "Vaga em área específica",
        allowedLocationTypes: ["custom_area"],
        allowedClassifications: ["doca", "estacionamento", "circulacao"],
        maxLocationsPerResource: 1,
        maxResourcesPerLocation: 1,
        requiresConfirmation: true,
        notes: "Uma vaga ocupa exclusivamente uma área.",
      },
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
]

export const BUILT_IN_TYPE_IDS = new Set(BUILT_IN_RESOURCE_TYPES.map((t) => t.id))
