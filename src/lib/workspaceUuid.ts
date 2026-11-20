// ============================================================
// NEXUS ERP — workspaceUuid.ts
// Conversão determinística de IDs de Workspace para UUID válido
// ============================================================

export const DEFAULT_WORKSPACE_UUID = "00000000-0000-0000-0000-000000000000"
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Converte qualquer workspaceId (ex: "ws_demo_g300", "ws_173..." ou UUID)
 * em um UUID v4-like determinístico para colunas UUID no Supabase.
 */
export function toWorkspaceUuid(workspaceId?: string | null): string {
  if (!workspaceId || !workspaceId.trim()) return DEFAULT_WORKSPACE_UUID
  const clean = workspaceId.trim()
  if (UUID_REGEX.test(clean)) return clean.toLowerCase()

  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
  const hexParts = seeds.map((seed, idx) => {
    let h = seed >>> 0
    const input = `${idx}:${clean}`
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, "0")
  })
  const hex = hexParts.join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
