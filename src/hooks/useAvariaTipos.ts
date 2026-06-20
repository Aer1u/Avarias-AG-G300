import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"

export interface AvariaTipo {
  nome: string
  cor_hex: string
  label?: string | null
  ativo: boolean
  ordem: number
}

// Helper: convert hex color to inline style object for badge
export function hexToStyle(hex: string, alpha = 0.12): React.CSSProperties {
  let r = 0, g = 0, b = 0
  const h = hex.replace("#", "")
  if (h.length === 6) {
    r = parseInt(h.slice(0, 2), 16)
    g = parseInt(h.slice(2, 4), 16)
    b = parseInt(h.slice(4, 6), 16)
  } else if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16)
    g = parseInt(h[1] + h[1], 16)
    b = parseInt(h[2] + h[2], 16)
  }
  return {
    color: hex,
    backgroundColor: `rgba(${r},${g},${b},${alpha})`,
    borderColor: `rgba(${r},${g},${b},0.3)`,
  }
}

export function hexToBarStyle(hex: string): React.CSSProperties {
  return { backgroundColor: hex }
}

const CONFIG_KEY = "avaria_tipos"

let cachedTipos: AvariaTipo[] | null = null
let fetchPromise: Promise<AvariaTipo[]> | null = null

export function useAvariaTipos() {
  const [tipos, setTipos] = useState<AvariaTipo[]>(cachedTipos || [])
  const [loading, setLoading] = useState(!cachedTipos)

  const fetchTipos = useCallback(async (force = false): Promise<AvariaTipo[]> => {
    if (cachedTipos && !force) {
      setTipos(cachedTipos)
      setLoading(false)
      return cachedTipos
    }

    if (fetchPromise && !force) {
      const result = await fetchPromise
      setTipos(result)
      setLoading(false)
      return result
    }

    fetchPromise = supabase
      .from("app_configs")
      .select("valor")
      .eq("chave", CONFIG_KEY)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) throw error
        const arr: AvariaTipo[] = (data?.valor ?? []) as AvariaTipo[]
        const active = arr.filter(t => t.ativo !== false).sort((a, b) => a.ordem - b.ordem)
        cachedTipos = active
        fetchPromise = null
        return active
      })

    try {
      const result = await fetchPromise
      setTipos(result)
      setLoading(false)
      return result
    } catch (err: any) {
      console.error("Erro ao buscar tipos de avaria:", err.message)
      fetchPromise = null
      setLoading(false)
      return []
    }
  }, [])

  const refresh = useCallback(() => {
    cachedTipos = null
    fetchPromise = null
    setLoading(true)
    fetchTipos(true).then((result) => setTipos(result))
  }, [fetchTipos])

  useEffect(() => {
    fetchTipos()
  }, [fetchTipos])

  return { tipos, loading, refresh }
}

// Standalone helper to save the full tipos array to app_configs
export async function saveAvariaTipos(tipos: AvariaTipo[]): Promise<void> {
  const { error } = await supabase
    .from("app_configs")
    .upsert(
      {
        chave: CONFIG_KEY,
        valor: tipos,
        descricao: "Tipos de avaria com cores",
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "chave" }
    )
  if (error) throw error
  // Invalidate cache
  cachedTipos = null
  fetchPromise = null
}
