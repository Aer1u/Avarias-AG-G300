"use client"

import { supabase } from "@/lib/supabase"

export interface CustomField {
  id: string
  nome: string
  tipo: 'text' | 'number' | 'select' | 'date'
  opcoes?: string[] // Para tipo select
  obrigatorio?: boolean
  placeholder?: string
}

export interface MapeamentoConfig {
  id: string
  nome: string
  descricao: string
  categoria: string
  cor: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan'
  icone: 'Box' | 'Package' | 'AlertTriangle' | 'Layers' | 'MapPin' | 'Tag'
  observacoes?: string
  camposPersonalizados: CustomField[]
  criadoEm: string
  atualizadoEm: string
}

export interface MapeamentoItem {
  id: string
  mapeamentoId: string
  posicao: string
  nivel: number
  profundidade: number
  sku: string
  descricao: string
  quantidade: number
  idPalete?: string
  customValues: Record<string, any>
  criadoEm: string
  atualizadoEm: string
}

export interface MapeamentoPosicao {
  id: string
  mapeamentoId: string
  codigo: string // ex: "01F0011", "CHAO-01", "BOX-A", "PULMAO-01"
  tipo: 'drive_in' | 'chao' | 'porta_palete' | 'blocado'
  capacidade: number
  nivelCount: number
  profundidadeCount: number
  setor?: string // ex: "Rua 1F", "Área de Chão", "Blocado 1"
  lado?: 'PAR' | 'IMPAR' | 'UNICO'
  status: 'Aberto' | 'Bloqueado'
  observacao?: string
  criadoEm: string
  atualizadoEm: string
}

const STORAGE_KEY_CONFIGS = 'ag_mapeamentos_configs_v2'
const STORAGE_KEY_ITEMS = 'ag_mapeamentos_items_v2'
const STORAGE_KEY_POSICOES = 'ag_mapeamentos_posicoes_v2'

export const COLOR_THEMES: Record<MapeamentoConfig['cor'], {
  name: string
  primary: string
  bgSoft: string
  border: string
  badge: string
  glow: string
}> = {
  blue: {
    name: 'Azul Operacional',
    primary: '#3b82f6',
    bgSoft: 'rgba(59,130,246,0.1)',
    border: 'rgba(59,130,246,0.3)',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    glow: 'rgba(59,130,246,0.2)',
  },
  emerald: {
    name: 'Verde Esmeralda',
    primary: '#10b981',
    bgSoft: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.3)',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    glow: 'rgba(16,185,129,0.2)',
  },
  violet: {
    name: 'Violeta / Roxo',
    primary: '#8b5cf6',
    bgSoft: 'rgba(139,92,246,0.1)',
    border: 'rgba(139,92,246,0.3)',
    badge: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
    glow: 'rgba(139,92,246,0.2)',
  },
  amber: {
    name: 'Âmbar Atenção',
    primary: '#f59e0b',
    bgSoft: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.3)',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    glow: 'rgba(245,158,11,0.2)',
  },
  rose: {
    name: 'Rosa Avarias',
    primary: '#f43f5e',
    bgSoft: 'rgba(244,63,94,0.1)',
    border: 'rgba(244,63,94,0.3)',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    glow: 'rgba(244,63,94,0.2)',
  },
  cyan: {
    name: 'Ciano Técnico',
    primary: '#06b6d4',
    bgSoft: 'rgba(6,182,212,0.1)',
    border: 'rgba(6,182,212,0.3)',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    glow: 'rgba(6,182,212,0.2)',
  },
}

// Nenhum exemplo predefinido por padrão - o sistema começa limpo conforme solicitado pelo usuário
export const DEFAULT_PRESET_MAPPINGS: MapeamentoConfig[] = []

// ── LOCAL STORAGE FALLBACK HELPERS ───────────────────────────────────────────

export function getLocalConfigs(): MapeamentoConfig[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIGS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn('Erro ao ler mapeamentos do storage:', err)
    return []
  }
}

export function saveLocalConfigs(configs: MapeamentoConfig[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(configs))
  } catch (err) {
    console.warn('Erro ao salvar mapeamentos no storage:', err)
  }
}

export function getLocalItems(mapeamentoId?: string): MapeamentoItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITEMS)
    if (!raw) return []
    const all: MapeamentoItem[] = JSON.parse(raw)
    if (!Array.isArray(all)) return []
    if (mapeamentoId) {
      return all.filter(item => item.mapeamentoId === mapeamentoId)
    }
    return all
  } catch (err) {
    console.warn('Erro ao ler itens de mapeamento do storage:', err)
    return []
  }
}

export function saveLocalItems(items: MapeamentoItem[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items))
  } catch (err) {
    console.warn('Erro ao salvar itens no storage:', err)
  }
}

export function getLocalPosicoes(mapeamentoId?: string): MapeamentoPosicao[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_POSICOES)
    if (!raw) return []
    const all: MapeamentoPosicao[] = JSON.parse(raw)
    if (!Array.isArray(all)) return []
    if (mapeamentoId) {
      return all.filter(p => p.mapeamentoId === mapeamentoId)
    }
    return all
  } catch (err) {
    console.warn('Erro ao ler posições do storage:', err)
    return []
  }
}

export function saveLocalPosicoes(posicoes: MapeamentoPosicao[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_POSICOES, JSON.stringify(posicoes))
  } catch (err) {
    console.warn('Erro ao salvar posições no storage:', err)
  }
}

// ── SUPABASE + LOCAL HYBRID REPOSITORY ───────────────────────────────────────

/**
 * Busca todas as configurações de mapeamentos (Supabase com fallback para LocalStorage)
 */
export async function fetchMapeamentoConfigs(): Promise<MapeamentoConfig[]> {
  try {
    const { data, error } = await supabase
      .from('mapeamentos_config')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      const mapped: MapeamentoConfig[] = data.map(row => ({
        id: String(row.id),
        nome: row.nome || 'Mapeamento Sem Nome',
        descricao: row.descricao || '',
        categoria: row.categoria || 'Geral',
        cor: (row.cor_tema as any) || 'blue',
        icone: (row.icone as any) || 'Box',
        observacoes: row.observacoes || '',
        camposPersonalizados: Array.isArray(row.campos_personalizados) ? row.campos_personalizados : [],
        criadoEm: row.created_at || new Date().toISOString(),
        atualizadoEm: row.updated_at || new Date().toISOString(),
      }))
      saveLocalConfigs(mapped)
      return mapped
    }
  } catch (err) {
    console.warn('Supabase mapeamentos_config não acessível, usando cache local:', err)
  }

  return getLocalConfigs()
}

/**
 * Salva ou atualiza uma configuração de mapeamento no Supabase e no LocalStorage
 */
export async function saveMapeamentoConfig(config: MapeamentoConfig): Promise<void> {
  const localList = getLocalConfigs()
  const idx = localList.findIndex(c => c.id === config.id)
  if (idx >= 0) {
    localList[idx] = { ...config, atualizadoEm: new Date().toISOString() }
  } else {
    localList.unshift({ ...config, criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() })
  }
  saveLocalConfigs(localList)

  try {
    await supabase.from('mapeamentos_config').upsert({
      id: config.id,
      nome: config.nome,
      descricao: config.descricao,
      categoria: config.categoria,
      cor_tema: config.cor,
      icone: config.icone,
      observacoes: config.observacoes,
      campos_personalizados: config.camposPersonalizados,
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('Não foi possível sincronizar mapeamento_config com Supabase:', err)
  }
}

/**
 * Exclui um mapeamento e todos os seus itens
 */
export async function deleteMapeamento(mapeamentoId: string): Promise<void> {
  const configs = getLocalConfigs().filter(c => c.id !== mapeamentoId)
  saveLocalConfigs(configs)

  const items = getLocalItems().filter(i => i.mapeamentoId !== mapeamentoId)
  saveLocalItems(items)

  const posicoes = getLocalPosicoes().filter(p => p.mapeamentoId !== mapeamentoId)
  saveLocalPosicoes(posicoes)

  try {
    await supabase.from('mapeamentos_config').delete().eq('id', mapeamentoId)
    await supabase.from('mapeamentos_itens').delete().eq('mapeamento_id', mapeamentoId)
    await supabase.from('mapeamentos_posicoes').delete().eq('mapeamento_id', mapeamentoId)
  } catch (err) {
    console.warn('Não foi possível excluir do Supabase:', err)
  }
}

/**
 * Busca os itens de mapeamento (Supabase com fallback para LocalStorage)
 */
export async function fetchMapeamentoItens(mapeamentoId?: string): Promise<MapeamentoItem[]> {
  try {
    let query = supabase.from('mapeamentos_itens').select('*')
    if (mapeamentoId) {
      query = query.eq('mapeamento_id', mapeamentoId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      const mapped: MapeamentoItem[] = data.map(row => ({
        id: String(row.id),
        mapeamentoId: String(row.mapeamento_id),
        posicao: row.posicao,
        nivel: Number(row.nivel ?? 0),
        profundidade: Number(row.profundidade ?? 1),
        sku: row.codigo || '',
        descricao: row.descricao || '',
        quantidade: Number(row.quantidade ?? 1),
        idPalete: row.id_palete || undefined,
        customValues: row.dados_personalizados || {},
        criadoEm: row.created_at || new Date().toISOString(),
        atualizadoEm: row.updated_at || new Date().toISOString(),
      }))

      // Atualiza cache local
      if (mapeamentoId) {
        const others = getLocalItems().filter(i => i.mapeamentoId !== mapeamentoId)
        saveLocalItems([...others, ...mapped])
      } else {
        saveLocalItems(mapped)
      }

      return mapped
    }
  } catch (err) {
    console.warn('Supabase mapeamentos_itens não acessível, usando cache local:', err)
  }

  return getLocalItems(mapeamentoId)
}

/**
 * Salva ou atualiza um item de mapeamento
 */
export async function saveMapeamentoItem(item: MapeamentoItem): Promise<void> {
  const all = getLocalItems()
  const idx = all.findIndex(i => i.id === item.id)
  if (idx >= 0) {
    all[idx] = { ...item, atualizadoEm: new Date().toISOString() }
  } else {
    all.push({ ...item, criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() })
  }
  saveLocalItems(all)

  try {
    await supabase.from('mapeamentos_itens').upsert({
      id: item.id,
      mapeamento_id: item.mapeamentoId,
      posicao: item.posicao,
      nivel: item.nivel,
      profundidade: item.profundidade,
      codigo: item.sku,
      descricao: item.descricao,
      quantidade: item.quantidade,
      id_palete: item.idPalete || null,
      dados_personalizados: item.customValues || {},
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('Não foi possível sincronizar item com Supabase:', err)
  }
}

/**
 * Exclui um item de mapeamento
 */
export async function deleteMapeamentoItem(itemId: string): Promise<void> {
  const all = getLocalItems().filter(i => i.id !== itemId)
  saveLocalItems(all)

  try {
    await supabase.from('mapeamentos_itens').delete().eq('id', itemId)
  } catch (err) {
    console.warn('Não foi possível excluir item do Supabase:', err)
  }
}

/**
 * Busca as posições cadastradas para um mapeamento (Supabase com fallback para LocalStorage)
 */
export async function fetchMapeamentoPosicoes(mapeamentoId?: string): Promise<MapeamentoPosicao[]> {
  const local = getLocalPosicoes(mapeamentoId)

  try {
    let query = supabase.from('mapeamentos_posicoes').select('*')
    if (mapeamentoId) {
      query = query.eq('mapeamento_id', mapeamentoId)
    }

    const { data, error } = await query.order('codigo', { ascending: true })

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped: MapeamentoPosicao[] = data.map(row => ({
        id: String(row.id),
        mapeamentoId: String(row.mapeamento_id),
        codigo: row.codigo || '',
        tipo: (row.tipo as any) || 'drive_in',
        capacidade: Number(row.capacidade ?? 16),
        nivelCount: Number(row.nivel_count ?? 3),
        profundidadeCount: Number(row.profundidade_count ?? 4),
        setor: row.setor || undefined,
        lado: (row.lado as any) || undefined,
        status: (row.status as any) || 'Aberto',
        observacao: row.observacao || '',
        criadoEm: row.created_at || new Date().toISOString(),
        atualizadoEm: row.updated_at || new Date().toISOString(),
      }))

      // Mescla itens do Supabase com eventuais posições locais não sincronizadas
      const remoteIds = new Set(mapped.map(m => m.id))
      const unsyncedLocal = local.filter(l => !remoteIds.has(l.id))
      const combined = [...mapped, ...unsyncedLocal]

      // Atualiza cache local
      if (mapeamentoId) {
        const others = getLocalPosicoes().filter(p => p.mapeamentoId !== mapeamentoId)
        saveLocalPosicoes([...others, ...combined])
      } else {
        saveLocalPosicoes(combined)
      }

      return combined
    } else if (error) {
      console.warn('Supabase mapeamentos_posicoes com aviso/erro, usando dados locais:', error.message || error)
    }
  } catch (err) {
    console.warn('Supabase mapeamentos_posicoes não acessível, usando cache local:', err)
  }

  return local
}

/**
 * Salva ou atualiza uma posição cadastrada
 */
export async function saveMapeamentoPosicao(pos: MapeamentoPosicao): Promise<void> {
  const all = getLocalPosicoes()
  const idx = all.findIndex(p => p.id === pos.id || (p.codigo === pos.codigo && p.mapeamentoId === pos.mapeamentoId))
  if (idx >= 0) {
    all[idx] = { ...pos, id: all[idx].id, atualizadoEm: new Date().toISOString() }
  } else {
    all.push({ ...pos, criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() })
  }
  saveLocalPosicoes(all)

  try {
    const { error } = await supabase.from('mapeamentos_posicoes').upsert({
      id: pos.id,
      mapeamento_id: pos.mapeamentoId,
      codigo: pos.codigo,
      tipo: pos.tipo,
      capacidade: pos.capacidade,
      nivel_count: pos.nivelCount,
      profundidade_count: pos.profundidadeCount,
      setor: pos.setor || null,
      lado: pos.lado || null,
      status: pos.status,
      observacao: pos.observacao || null,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.warn('Supabase mapeamentos_posicoes upsert falhou (usando armazenamento local):', error.message || error)
    }
  } catch (err) {
    console.warn('Não foi possível sincronizar posição com Supabase:', err)
  }
}

/**
 * Salva múltiplas posições de uma só vez (criação em lote ou importação)
 */
export async function bulkSaveMapeamentoPosicoes(posicoes: MapeamentoPosicao[]): Promise<void> {
  if (posicoes.length === 0) return
  const all = getLocalPosicoes()
  const existingCodes = new Set(posicoes.map(p => `${p.mapeamentoId}_${p.codigo}`))
  const filtered = all.filter(p => !existingCodes.has(`${p.mapeamentoId}_${p.codigo}`) && !posicoes.some(n => n.id === p.id))
  saveLocalPosicoes([...filtered, ...posicoes])

  try {
    const payload = posicoes.map(pos => ({
      id: pos.id,
      mapeamento_id: pos.mapeamentoId,
      codigo: pos.codigo,
      tipo: pos.tipo,
      capacidade: pos.capacidade,
      nivel_count: pos.nivelCount,
      profundidade_count: pos.profundidadeCount,
      setor: pos.setor || null,
      lado: pos.lado || null,
      status: pos.status,
      observacao: pos.observacao || null,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('mapeamentos_posicoes').upsert(payload)
    if (error) {
      console.warn('Supabase mapeamentos_posicoes bulk upsert falhou (usando armazenamento local):', error.message || error)
    }
  } catch (err) {
    console.warn('Não foi possível salvar posições em lote no Supabase:', err)
  }
}

/**
 * Exclui uma posição cadastrada
 */
export async function deleteMapeamentoPosicao(posId: string): Promise<void> {
  const all = getLocalPosicoes().filter(p => p.id !== posId)
  saveLocalPosicoes(all)

  try {
    await supabase.from('mapeamentos_posicoes').delete().eq('id', posId)
  } catch (err) {
    console.warn('Não foi possível excluir posição do Supabase:', err)
  }
}

// Aliases para compatibilidade síncrona imediata onde aplicável
export const getMapeamentosConfigs = getLocalConfigs
export const saveMapeamentosConfigs = saveLocalConfigs
export const getMapeamentoItems = getLocalItems
export const getMapeamentoPosicoes = getLocalPosicoes
