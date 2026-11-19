// ============================================================
// NEXUS ERP — Systems / systemRegistry.ts
// Catálogo Padrão de Sistemas de Saldo (Laboratório)
// Totalmente isolado no frontend / localStorage
// ============================================================

import { BusinessSystem } from "./types"

// Sistema começa limpo — sem dados de exemplo pré-carregados.
// Cada usuário cria seus próprios sistemas de saldo.
export const DEFAULT_BUSINESS_SYSTEMS: BusinessSystem[] = []
