// ============================================================
// NEXUS ERP — MapLibrary / dimensionsTypes.ts
// Sistema Universal de Nomenclatura e Identificação de Dimensões
// Permite que cada organização configure como suas dimensões físicas
// e operacionais são denominadas, numeradas e identificadas sem padrões fixos.
// ============================================================

export type DimensionCategory =
  | "level"         // Níveis verticais de armazenagem
  | "depth"         // Profundidade física no túnel/estrutura
  | "position"      // Posição individual de pallet/vão
  | "side"          // Lados (PAR/ÍMPAR, G/D, Esquerdo/Direito)
  | "street"        // Ruas / Vias de acesso
  | "block"         // Blocos físicos
  | "module"        // Módulos estruturais
  | "aisle"         // Corredores
  | "row"           // Fileiras
  | "column"        // Colunas
  | "custom"        // Dimensão personalizada livre da organização

export type SequenceType =
  | "numeric"       // 1, 2, 3, 4, 5...
  | "numeric_pad"   // 01, 02, 03... (com padding configurável)
  | "alphabetic"    // A, B, C, D...
  | "alphanumeric"  // Prefixo + Número (ex: N1, N2... ou P01, P02...)
  | "custom_list"   // Lista textual explícita (ex: ["Térreo", "Nível 1", "Nível 2", "Aéreo"])

export type DimensionOrientation =
  | "bottom_to_top"   // Padrão de níveis verticais (chão para o teto)
  | "top_to_bottom"   // Do topo para o chão
  | "front_to_back"   // Da entrada do túnel para o fundo (LIFO)
  | "back_to_front"   // Do fundo para a entrada
  | "left_to_right"   // Da esquerda para a direita
  | "right_to_left"   // Da direita para a esquerda

// ── Item individual de uma dimensão (Separação entre ordem e identificação) ──
export interface DimensionItem {
  physicalIndex: number     // 0, 1, 2, 3... Ordem física real do elemento
  identifier: string        // "1", "A", "01", "G", "N1" (código de identificação único)
  displayName: string       // "Nível 1 (Chão)", "Profundidade C" (rótulo para exibição na UI)
  searchAlias?: string[]    // Aliases para o Spotlight (ex: ["terreiro", "chao", "base"])
  isActive: boolean         // Permite desativar um item individual sem quebrar a ordem
}

// ── Configuração completa de uma dimensão ─────────────────────
export interface DimensionConfig {
  id: string
  category: DimensionCategory
  name: string              // Nome interno (ex: "Profundidades do Drive")
  displayName: string       // Nome exibido na interface (ex: "Profundidade", "Túnel")
  description?: string
  
  // Regras de sequência
  sequenceType: SequenceType
  orientation: DimensionOrientation
  prefix?: string           // Para alfanumérico (ex: "N" para N1, N2...)
  suffix?: string
  paddingDigits?: number    // Ex: 2 para "01", "02"
  customValues?: string[]   // Para custom_list (ex: ["Térreo", "N1", "N2", "Aéreo"])
  
  // Quantidade de elementos
  defaultCount: number
  
  // Itens resolvidos gerados
  items: DimensionItem[]
  
  // Escopo de aplicação (Permite independência entre Galpões, Áreas e Estruturas)
  scope: {
    organizationId?: string
    warehouseId?: string    // ID do Galpão (ex: "G300")
    areaId?: string         // ID da Área/Setor
    structureType?: string  // ex: "drive_in", "pallet_rack", "cantilever"
  }
  
  // Exceções configuradas por estrutura específica (ID do objeto -> override de itens)
  exceptions?: Record<string, Partial<DimensionConfig>>
}

// ── Representação de uma Posição Física Tridimensional ────────
export interface StructurePositionSlot {
  id: string                // ID composto estável
  structureId: string       // ID do Drive ou Porta-Paletes
  channelId?: string        // ID do Canal ao qual pertence a posição
  levelIndex: number        // Ordem física do nível (0 = mais baixo)
  depthIndex: number        // Ordem física da profundidade (0 = entrada)
  laneIndex?: number        // Ordem da rua/vão (se houver)
  
  // Nomenclaturas resolvidas conforme a configuração da organização
  levelIdentifier: string   // "1", "A", "01", "Térreo"
  depthIdentifier: string   // "1", "A", "01", "Fundo"
  positionCode: string      // Código final (ex: "G300004G0281-N2-P3")
  
  // Estado operacional da posição
  status: "livre" | "ocupado" | "avaria" | "bloqueado"
  palletId?: string
  palletBarcode?: string
  productSku?: string
  linkedRecordIds?: string[]
}

// ── 1.4. Canal de Armazenagem (Storage Channel) ───────────────
// Unidade de armazenagem composta por um conjunto de posições-palete
// distribuídas em níveis e profundidades no vão frontal do Drive-In.
// NÃO é uma posição individual: é o agrupamento lógico e físico das posições.
export interface StorageOccupiedSlot {
  level: number       // 1, 2, ... levels
  depth: number       // 1, 2, ... depth
  palletModelId?: string
  loaded?: boolean
  tag?: string
}

export interface StorageChannel {
  id: string                      // ID único do canal
  code: string                    // Código identificador técnico (ex: "G300004G0281-C01")
  name: string                    // Nome personalizado (ex: "Canal MKLOG", "Canal Jaqueline", "Canal Quarentena")
  driveId: string                 // Drive-In associado
  moduleId?: string               // Módulo estrutural associado
  laneIndex: number               // Vão frontal associado (1, 2, 3...)
  levels: number                  // Quantidade de níveis verticais
  depth: number                   // Quantidade de profundidades de paletes
  capacity: number                // Capacidade total (levels * depth)
  occupancy: number               // Posições atualmente ocupadas
  status: "operacional" | "bloqueado" | "manutencao"
  dimensions?: {
    widthM: number                // Largura do canal em metros
    lengthM: number               // Profundidade do túnel em metros
    heightM: number               // Altura útil vertical em metros
  }
  palletModelId?: string          // Padrão de pallet associado (PBR1, Euro, etc.)
  stockControlMode?: "livre" | "vinculado_saldo"  // Controle individual por canal
  stockSystemRef?: string                        // Sistema de saldo vinculado individual do canal
  occupiedPositions?: StorageOccupiedSlot[]     // Posições com paletes (para teste ou operação)
  notes?: string                  // Observações operacionais
}
