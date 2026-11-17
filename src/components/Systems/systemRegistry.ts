// ============================================================
// NEXUS ERP — Systems / systemRegistry.ts
// Catálogo Padrão de Sistemas de Saldo (Laboratório)
// Totalmente isolado no frontend / localStorage
// ============================================================

import { BusinessSystem } from "./types"

export const DEFAULT_BUSINESS_SYSTEMS: BusinessSystem[] = [
  {
    id: "sys_avarias_g300",
    code: "AVARIAS_G300",
    name: "Sistema de Avarias G300",
    description: "Administra entradas físicas de avarias recebidas no CHÃO e distribui em Drives e vãos autorizados.",
    color: "#f59e0b", // Âmbar / Laranja
    icon: "⚠️",
    originStorageId: "chao_g300",
    originStorageLabel: "CHÃO G300 (Área de Recebimento)",
    status: "ativo",
    defaultControlMode: "vinculado_saldo",
    participants: [],
    allowedMovementTypes: ["entrada", "transferencia", "baixa", "devolucao"],
    responsible: "Supervisão de Avarias G300",
    workspaceId: "workspace_default",
    createdAt: "2026-11-17T00:00:00Z",
    updatedAt: "2026-11-17T00:00:00Z",
  },
  {
    id: "sys_retrabalho",
    code: "RETRABALHO",
    name: "Sistema de Retrabalho",
    description: "Controla o saldo de itens que passam por recuperação técnica, troca de embalagem e montagem de kits.",
    color: "#3b82f6", // Azul
    icon: "🔧",
    originStorageId: "",
    originStorageLabel: "Bancada Central de Retrabalho",
    status: "ativo",
    defaultControlMode: "vinculado_saldo",
    participants: [],
    allowedMovementTypes: ["entrada", "transferencia", "ajuste", "consumo"],
    responsible: "Equipe Técnica de Retrabalho",
    workspaceId: "workspace_default",
    createdAt: "2026-11-17T00:00:00Z",
    updatedAt: "2026-11-17T00:00:00Z",
  },
  {
    id: "sys_quarentena",
    code: "QUARENTENA",
    name: "Sistema de Quarentena",
    description: "Isola lotes sob análise de qualidade, laudos de conformidade ou retenções administrativas.",
    color: "#ef4444", // Vermelho
    icon: "🛑",
    originStorageId: "",
    originStorageLabel: "Gaiola / Bloco de Quarentena",
    status: "ativo",
    defaultControlMode: "livre", // Quarentena permite alocar livremente para segregação imediata
    participants: [],
    allowedMovementTypes: ["entrada", "transferencia", "liberacao", "descarte"],
    responsible: "Controle de Qualidade (CQ)",
    workspaceId: "workspace_default",
    createdAt: "2026-11-17T00:00:00Z",
    updatedAt: "2026-11-17T00:00:00Z",
  },
  {
    id: "sys_erp_principal",
    code: "ERP_PRINCIPAL",
    name: "ERP Principal (Almoxarifado)",
    description: "Sincronização de saldos de estoque contábil do ERP para armazenagem em Porta-Paletes e pulmões.",
    color: "#10b981", // Esmeralda / Verde
    icon: "🏢",
    originStorageId: "",
    originStorageLabel: "Doca de Entrada WMS",
    status: "ativo",
    defaultControlMode: "vinculado_saldo",
    participants: [],
    allowedMovementTypes: ["recebimento", "transferencia", "expedicao"],
    responsible: "Coordenação de Armazenagem",
    workspaceId: "workspace_default",
    createdAt: "2026-11-17T00:00:00Z",
    updatedAt: "2026-11-17T00:00:00Z",
  },
]
