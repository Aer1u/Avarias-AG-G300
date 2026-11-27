// =============================================================================
// SYSTEM: MÓDULO G300 (ESTOQUE, AVARIAS, RUAS & DRIVE-IN)
// OWNER:  Workspace Admin G300 (Nível 3)
// SCOPE:  Operações de Armazém G300
// PURPOSE: Ponto central de exportação (barrel) de todos os componentes e abas do G300
// =============================================================================

export { DriveInGrid } from "./DriveInGrid"
export { AddPalletModal } from "./AddPalletModal"
export { WarehouseTable } from "./WarehouseTable"
export { MetricCard } from "./MetricCard"
export { OriginDonutChart } from "./OriginDonutChart"
export { default as RegistrosTab } from "./RegistrosTab"
export { default as RetrabalhosTab } from "./RetrabalhosTab"
export { default as EmbalagensTab } from "./EmbalagensTab"
export { default as RelatorioRecebimentoTab } from "./RelatorioRecebimentoTab"
export { EstoqueBATab } from "./EstoqueBATab"
export { ProdutosTab } from "./ProdutosTab"
export { ConfrontosTab } from "./ConfrontosTab"
export { GeralTab } from "./GeralTab"
export { MapeamentoTab } from "./MapeamentoTab"
export { ClassificacoesTab, ClassificacoesPrintReport } from "./ClassificacoesTab"
export type { DevolucaoPrintPayload } from "./ClassificacoesTab"

