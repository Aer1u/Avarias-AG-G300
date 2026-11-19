// ============================================================
// NEXUS ERP — Resources / baseCodigosService.ts
// Integração Oficial com a Tabela base_codigos do Supabase
// Fonte canônica de dados de Produtos (SKU, Descrição, Grade, Tipo)
// ============================================================

import { supabase } from "@/lib/supabase"

export interface BaseCodigoItem {
  Código: string
  Descrição: string
  Grade?: string | null
  Tipo?: string | null
}

export interface NewBaseCodigoPayload {
  codigo: string
  descricao: string
  grade?: string
  tipo?: string
}

/**
 * Busca produtos na tabela base_codigos
 * Permite filtrar por Código (SKU) ou Descrição com ilike
 */
export async function searchBaseCodigos(
  query = "",
  limit = 20
): Promise<{ data: BaseCodigoItem[]; error: string | null }> {
  try {
    let req = supabase
      .from("base_codigos")
      .select('"Código", "Descrição", "Grade", "Tipo"')

    const q = query.trim().toUpperCase()
    if (q) {
      req = req.or(`"Código".ilike.%${q}%,"Descrição".ilike.%${q}%`)
    }

    const { data, error } = await req.order('"Código"', { ascending: true }).limit(limit)

    if (error) {
      console.warn("Erro ao buscar base_codigos:", error.message)
      return { data: [], error: error.message }
    }

    return { data: (data as BaseCodigoItem[]) || [], error: null }
  } catch (err: any) {
    return { data: [], error: err.message || "Erro inesperado" }
  }
}

/**
 * Cadastra um novo produto diretamente na tabela base_codigos
 */
export async function insertBaseCodigo(
  payload: NewBaseCodigoPayload
): Promise<{ success: boolean; data?: BaseCodigoItem; error?: string }> {
  const codigo = payload.codigo.trim().toUpperCase()
  const descricao = payload.descricao.trim().toUpperCase()
  const grade = payload.grade?.trim() || null
  const tipo = payload.tipo?.trim() || null

  if (!codigo || !descricao) {
    return { success: false, error: "Código e Descrição são obrigatórios." }
  }

  try {
    const record = {
      "Código": codigo,
      "Descrição": descricao,
      "Grade": grade,
      "Tipo": tipo,
    }

    const { data, error } = await supabase
      .from("base_codigos")
      .insert([record])
      .select()

    if (error) {
      return { success: false, error: error.message }
    }

    const inserted = data?.[0] as BaseCodigoItem
    return { success: true, data: inserted || record }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro inesperado ao cadastrar produto." }
  }
}

/**
 * Obtém a contagem total de produtos cadastrados na base_codigos
 */
export async function getBaseCodigosCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("base_codigos")
      .select("*", { count: "exact", head: true })
    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}
