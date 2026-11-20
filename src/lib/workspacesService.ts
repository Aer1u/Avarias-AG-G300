// =============================================================================
// NEXUS ERP — SERVIÇO DE WORKSPACES (GOVERNANÇA & MAPAS DE USUÁRIOS)
// Regras Oficiais:
// 1. VISUALIZAÇÃO UNIVERSAL: Qualquer usuário autenticado pode visualizar todos
//    os workspaces e entrar neles como VISUALIZADOR (somente leitura).
// 2. EDIÇÃO RESTRITA: Apenas o PROPRIETÁRIO do mapa ou ADMINISTRADORES (níveis 1 a 3)
//    podem editar, mover objetos ou salvar alterações no workspace.
// 3. CRIAÇÃO SELETIVA: Nem todos podem criar workspaces. Apenas Administradores ou
//    usuários definidos nominalmente pelo Administrador na lista de criadores autorizados.
// Persistência Híbrida: Supabase (business_systems __NEXUS_WORKSPACE_STATE__) + localStorage
// =============================================================================

import { supabase } from "./supabase"
import { DEFAULT_WORKSPACE_UUID, toWorkspaceUuid } from "./workspaceUuid"
import { ITEMS_ANCHOR_CODE } from "./workspaceItemsSync"

export type WorkspaceStatus = "active" | "archived"

export interface WorkspaceMap {
  /** ID único do workspace */
  id: string
  /** Nome do mapa definido pelo usuário */
  name: string
  /** Descrição opcional */
  description: string
  /** Status do workspace */
  status: WorkspaceStatus
  /** Thumbnail em base64 (snapshot do canvas), opcional */
  thumbnail?: string
  /** Email do criador/dono */
  ownerEmail: string
  /** Nome do criador/dono */
  ownerName: string
  /** Número de objetos no mapa */
  objectsCount: number
  /** Dados do mapa (objetos MapObject[] e configs) serializado como JSON string */
  mapData?: string
  /** Data de criação (ISO 8601) */
  createdAt: string
  /** Data da última edição (ISO 8601) */
  updatedAt: string
  /** Tags opcionais para organização */
  tags?: string[]
}

const STORAGE_KEY = "nexus_ws_maps_v1"
const CREATORS_KEY = "nexus_ws_authorized_creators_v1"
const DELETED_KEY = "nexus_ws_deleted_ids_v1"

const WS_STATE_CODE = "__NEXUS_WORKSPACE_STATE__"
const WS_CREATORS_CODE = "__NEXUS_WS_CREATORS__"

// Workspace demonstrativo inicial para que os visualizadores tenham o que explorar na 1ª visita
const DEFAULT_INITIAL_WORKSPACE: WorkspaceMap = {
  id: "ws_demo_g300",
  name: "Galpão Operacional G300 — Mapeamento Central",
  description:
    "Layout oficial do armazém central com ruas de circulação, blocos de armazenagem e estruturas Drive-In.",
  status: "active",
  ownerEmail: "profissionaltrgm@gmail.com",
  ownerName: "Platform Owner",
  objectsCount: 0,
  createdAt: "2026-01-15T10:00:00.000Z",
  updatedAt: "2026-01-15T10:00:00.000Z",
  tags: ["Oficial", "Produção", "G300"],
}

class WorkspacesService {
  private static instance: WorkspacesService
  private writeQueueByWsId = new Map<string, Promise<{ success: boolean; error?: string }>>()

  private constructor() {}

  public static getInstance(): WorkspacesService {
    if (!WorkspacesService.instance) {
      WorkspacesService.instance = new WorkspacesService()
    }
    return WorkspacesService.instance
  }

  private getDeletedIds(): Set<string> {
    if (typeof window === "undefined") return new Set()
    try {
      const raw = localStorage.getItem(DELETED_KEY)
      if (!raw) return new Set()
      const parsed = JSON.parse(raw)
      return new Set(Array.isArray(parsed) ? parsed : [])
    } catch {
      return new Set()
    }
  }

  private markDeletedId(id: string): void {
    if (typeof window === "undefined") return
    try {
      const set = this.getDeletedIds()
      set.add(id)
      localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(set)))
    } catch {
      // ignore storage errors
    }
  }

  private getRawLocalWorkspaces(): { list: WorkspaceMap[]; hadStorage: boolean } {
    if (typeof window === "undefined") {
      return { list: [DEFAULT_INITIAL_WORKSPACE], hadStorage: false }
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return { list: [], hadStorage: false }
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return { list: parsed, hadStorage: true }
      }
      return { list: [], hadStorage: false }
    } catch {
      return { list: [], hadStorage: false }
    }
  }

  private async upsertWorkspaceToSupabase(
    ws: WorkspaceMap
  ): Promise<{ success: boolean; error?: string }> {
    const prev = this.writeQueueByWsId.get(ws.id) || Promise.resolve({ success: true })

    const next = prev
      .catch(() => ({ success: true }))
      .then(async () => {
        try {
          const wsUuid = toWorkspaceUuid(ws.id)
          const serialized = JSON.stringify(ws)

          const { data: existing, error: selErr } = await supabase
            .from("business_systems")
            .select("id")
            .eq("workspace_id", wsUuid)
            .eq("code", WS_STATE_CODE)
            .maybeSingle()

          if (selErr) {
            console.warn("Aviso ao consultar estado do workspace no Supabase:", selErr.message)
            return { success: false, error: selErr.message }
          }

          const payload = {
            workspace_id: wsUuid,
            code: WS_STATE_CODE,
            name: ws.name,
            description: serialized,
            color: "#f59e0b",
            icon: "🗺️",
            default_control_mode: "vinculado_saldo",
            status: ws.status === "archived" ? "inativo" : "ativo",
            responsible: ws.ownerEmail || null,
            updated_at: ws.updatedAt || new Date().toISOString(),
          }

          if (existing?.id) {
            const { error: updErr } = await supabase
              .from("business_systems")
              .update(payload)
              .eq("id", existing.id)

            if (updErr) {
              console.warn("Erro ao atualizar workspace no Supabase:", updErr.message)
              return { success: false, error: updErr.message }
            }
          } else {
            const newId =
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : undefined
            const { error: insErr } = await supabase
              .from("business_systems")
              .insert({
                ...(newId ? { id: newId } : {}),
                ...payload,
              })

            if (insErr) {
              console.warn("Erro ao inserir workspace no Supabase:", insErr.message)
              return { success: false, error: insErr.message }
            }
          }

          return { success: true }
        } catch (err: unknown) {
          const msg =
            err instanceof Error
              ? err.message
              : "Erro de rede ao salvar workspace no Supabase."
          console.warn("Exceção ao persistir workspace no Supabase:", msg)
          return { success: false, error: msg }
        }
      })

    this.writeQueueByWsId.set(ws.id, next)
    return next
  }

  private async upsertCreatorsToSupabase(creators: string[]): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from("business_systems")
        .select("id")
        .eq("workspace_id", DEFAULT_WORKSPACE_UUID)
        .eq("code", WS_CREATORS_CODE)
        .maybeSingle()

      const payload = {
        workspace_id: DEFAULT_WORKSPACE_UUID,
        code: WS_CREATORS_CODE,
        name: "Authorized Workspace Creators",
        description: JSON.stringify(creators),
        status: "ativo",
        default_control_mode: "livre",
        updated_at: new Date().toISOString(),
      }

      if (existing?.id) {
        await supabase.from("business_systems").update(payload).eq("id", existing.id)
      } else {
        await supabase.from("business_systems").insert(payload)
      }
    } catch {
      // ignore offline error
    }
  }

  // ── 1. GESTÃO DE CRIADORES AUTORIZADOS ───────────────────────

  /** Lista de emails com permissão especial concedida pelo Admin para criar workspaces */
  public getAuthorizedCreators(): string[] {
    if (typeof window === "undefined") return []
    try {
      const stored = localStorage.getItem(CREATORS_KEY)
      if (!stored) return []
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  /** Adiciona um usuário à lista de criadores autorizados (apenas Admin) */
  public addAuthorizedCreator(email: string, isAdmin: boolean): { success: boolean; error?: string } {
    if (!isAdmin) {
      return { success: false, error: "Apenas administradores podem conceder permissão de criação de workspace." }
    }
    const clean = email.trim().toLowerCase()
    if (!clean) return { success: false, error: "Email inválido." }

    const current = this.getAuthorizedCreators()
    if (current.includes(clean)) return { success: true }

    const updated = [...current, clean]
    localStorage.setItem(CREATORS_KEY, JSON.stringify(updated))
    this.upsertCreatorsToSupabase(updated).catch(() => {})
    return { success: true }
  }

  /** Remove um usuário da lista de criadores autorizados (apenas Admin) */
  public removeAuthorizedCreator(email: string, isAdmin: boolean): { success: boolean; error?: string } {
    if (!isAdmin) {
      return { success: false, error: "Apenas administradores podem revogar permissão de criação de workspace." }
    }
    const clean = email.trim().toLowerCase()
    const current = this.getAuthorizedCreators()
    const updated = current.filter((e) => e.toLowerCase() !== clean)
    localStorage.setItem(CREATORS_KEY, JSON.stringify(updated))
    this.upsertCreatorsToSupabase(updated).catch(() => {})
    return { success: true }
  }

  public canUserCreate(userEmail: string | undefined | null, isAdmin: boolean): boolean {
    if (isAdmin) return true
    if (!userEmail) return false
    const authorized = this.getAuthorizedCreators()
    return authorized.map((e) => e.toLowerCase()).includes(userEmail.toLowerCase())
  }

  public canUserEdit(
    ws: WorkspaceMap | null | undefined,
    userEmail: string | undefined | null,
    isAdmin: boolean
  ): boolean {
    if (isAdmin) return true
    if (!ws || !userEmail) return false
    return (ws.ownerEmail || "").toLowerCase() === userEmail.toLowerCase()
  }

  // ── 2. LEITURA & SINCRONIZAÇÃO DE WORKSPACES ─────────────────

  public getAllWorkspaces(): WorkspaceMap[] {
    if (typeof window === "undefined") return [DEFAULT_INITIAL_WORKSPACE]
    const { list, hadStorage } = this.getRawLocalWorkspaces()
    const deletedIds = this.getDeletedIds()
    const filtered = list.filter((w) => w && !deletedIds.has(w.id))

    if (filtered.length > 0) return filtered
    if (!hadStorage && !deletedIds.has(DEFAULT_INITIAL_WORKSPACE.id)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([DEFAULT_INITIAL_WORKSPACE]))
      return [DEFAULT_INITIAL_WORKSPACE]
    }
    return []
  }

  /**
   * Sincroniza workspaces e criadores autorizados do Supabase,
   * mesclando com eventuais edições locais pendentes (e subindo dados pré-existentes).
   */
  public async syncFromSupabase(): Promise<WorkspaceMap[]> {
    try {
      const { data, error } = await supabase
        .from("business_systems")
        .select("*")
        .in("code", [WS_STATE_CODE, WS_CREATORS_CODE])
        .order("updated_at", { ascending: false })

      if (!error && Array.isArray(data)) {
        const deletedIds = this.getDeletedIds()
        const fromDbMap = new Map<string, WorkspaceMap>()

        for (const row of data) {
          if (row.code === WS_CREATORS_CODE) {
            try {
              const parsed = JSON.parse(String(row.description || "[]"))
              if (Array.isArray(parsed) && typeof window !== "undefined") {
                localStorage.setItem(CREATORS_KEY, JSON.stringify(parsed))
              }
            } catch {
              // ignore invalid creators JSON
            }
            continue
          }

          if (row.code === WS_STATE_CODE) {
            try {
              const parsed = JSON.parse(String(row.description || "{}")) as Partial<WorkspaceMap>
              if (parsed && parsed.id && !deletedIds.has(parsed.id)) {
                const ws: WorkspaceMap = {
                  id: String(parsed.id),
                  name: String(parsed.name || row.name || "Workspace"),
                  description: String(parsed.description || ""),
                  status: parsed.status === "archived" || row.status === "inativo" ? "archived" : "active",
                  thumbnail: parsed.thumbnail,
                  ownerEmail: String(parsed.ownerEmail || row.responsible || "admin@nexus.local"),
                  ownerName: String(parsed.ownerName || parsed.ownerEmail || row.name || "Owner"),
                  objectsCount: Number(parsed.objectsCount) || 0,
                  mapData: parsed.mapData,
                  createdAt: String(parsed.createdAt || row.created_at || new Date().toISOString()),
                  updatedAt: String(parsed.updatedAt || row.updated_at || new Date().toISOString()),
                  tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                }
                const prev = fromDbMap.get(ws.id)
                if (!prev || new Date(ws.updatedAt).getTime() > new Date(prev.updatedAt).getTime()) {
                  fromDbMap.set(ws.id, ws)
                }
              }
            } catch {
              // ignore invalid workspace row
            }
          }
        }

        const { list: localList, hadStorage } = this.getRawLocalWorkspaces()
        const mergedMap = new Map<string, WorkspaceMap>(fromDbMap)
        const toUpload: WorkspaceMap[] = []

        for (const localWs of localList) {
          if (!localWs || !localWs.id || deletedIds.has(localWs.id)) continue
          const dbWs = mergedMap.get(localWs.id)

          if (!dbWs) {
            const isDefaultPlaceholder =
              localWs.id === DEFAULT_INITIAL_WORKSPACE.id && !localWs.mapData
            if (!isDefaultPlaceholder || fromDbMap.size === 0) {
              mergedMap.set(localWs.id, localWs)
              // Migra para nuvem workspaces criados localmente ou demo já editado
              if (localWs.id !== DEFAULT_INITIAL_WORKSPACE.id || Boolean(localWs.mapData)) {
                toUpload.push(localWs)
              }
            }
          } else {
            const localHasData = Boolean(localWs.mapData)
            const dbHasData = Boolean(dbWs.mapData)
            const localTime = new Date(localWs.updatedAt || 0).getTime()
            const dbTime = new Date(dbWs.updatedAt || 0).getTime()

            if ((localHasData && !dbHasData) || (localHasData && localTime > dbTime + 1000)) {
              mergedMap.set(localWs.id, localWs)
              toUpload.push(localWs)
            }
          }
        }

        let merged = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )

        if (merged.length === 0 && !hadStorage && !deletedIds.has(DEFAULT_INITIAL_WORKSPACE.id)) {
          merged = [DEFAULT_INITIAL_WORKSPACE]
        }

        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        }

        // Sobe para a nuvem quaisquer mapas/workspaces locais que ainda não estavam lá
        toUpload.forEach((ws) => {
          this.upsertWorkspaceToSupabase(ws).catch(() => {})
        })

        return merged
      }
    } catch (err) {
      console.warn("Aviso ao sincronizar workspaces do Supabase:", err)
    }

    return this.getAllWorkspaces()
  }

  /**
   * Busca um workspace garantindo sincronização prévia com o Supabase.
   */
  public async fetchWorkspaceById(id: string): Promise<WorkspaceMap | null> {
    const list = await this.syncFromSupabase()
    return list.find((w) => w.id === id) || null
  }

  public getVisibleWorkspaces(): WorkspaceMap[] {
    return this.getAllWorkspaces()
  }

  public getWorkspaceById(id: string): WorkspaceMap | null {
    return this.getAllWorkspaces().find((w) => w.id === id) || null
  }

  // ── 3. CRIAÇÃO SELETIVA ──────────────────────────────────────

  public createWorkspace(
    data: { name: string; description?: string; ownerEmail: string; ownerName: string; tags?: string[] },
    isAdmin: boolean
  ): { success: boolean; workspace?: WorkspaceMap; error?: string } {
    if (!this.canUserCreate(data.ownerEmail, isAdmin)) {
      return {
        success: false,
        error:
          "Acesso Restrito: Apenas administradores ou usuários expressamente autorizados têm permissão para criar novos workspaces.",
      }
    }

    if (!data.name?.trim()) {
      return { success: false, error: "O nome do workspace é obrigatório." }
    }
    if (!data.ownerEmail?.trim()) {
      return { success: false, error: "Usuário não autenticado." }
    }

    const now = new Date().toISOString()
    const newWs: WorkspaceMap = {
      id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: data.name.trim(),
      description: data.description?.trim() || "",
      status: "active",
      ownerEmail: data.ownerEmail,
      ownerName: data.ownerName || data.ownerEmail,
      objectsCount: 0,
      mapData: undefined,
      createdAt: now,
      updatedAt: now,
      tags: data.tags || [],
    }

    const current = this.getAllWorkspaces()
    const updated = [newWs, ...current]
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    }

    this.upsertWorkspaceToSupabase(newWs).catch(() => {})

    return { success: true, workspace: newWs }
  }

  public async createWorkspaceAsync(
    data: { name: string; description?: string; ownerEmail: string; ownerName: string; tags?: string[] },
    isAdmin: boolean
  ): Promise<{ success: boolean; workspace?: WorkspaceMap; error?: string }> {
    const res = this.createWorkspace(data, isAdmin)
    if (res.success && res.workspace) {
      await this.upsertWorkspaceToSupabase(res.workspace)
    }
    return res
  }

  // ── 4. ATUALIZAÇÃO / EDIÇÃO ──────────────────────────────────

  public updateWorkspace(
    id: string,
    partial: Partial<WorkspaceMap>,
    userEmail: string,
    isAdmin: boolean
  ): { success: boolean; workspace?: WorkspaceMap; error?: string; syncPromise?: Promise<{ success: boolean; error?: string }> } {
    const current = this.getAllWorkspaces()
    const idx = current.findIndex((w) => w.id === id)

    if (idx === -1) return { success: false, error: "Workspace não encontrado." }

    const ws = current[idx]
    if (!this.canUserEdit(ws, userEmail, isAdmin)) {
      return {
        success: false,
        error:
          "Acesso Negado: Você está navegando em modo visualizador e não tem permissão para editar este workspace.",
      }
    }

    const updatedWs: WorkspaceMap = {
      ...ws,
      ...partial,
      id: ws.id,
      ownerEmail: ws.ownerEmail,
      createdAt: ws.createdAt,
      updatedAt: new Date().toISOString(),
    }

    current[idx] = updatedWs
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    }

    const syncPromise = this.upsertWorkspaceToSupabase(updatedWs)

    return { success: true, workspace: updatedWs, syncPromise }
  }

  public saveMapData(
    id: string,
    mapData: string,
    objectsCount: number,
    userEmail: string,
    isAdmin: boolean,
    thumbnail?: string
  ): { success: boolean; error?: string } {
    const res = this.updateWorkspace(id, { mapData, objectsCount, thumbnail }, userEmail, isAdmin)
    return { success: res.success, error: res.error }
  }

  /**
   * Salva o mapa localmente e aguarda confirmação real da persistência no Supabase.
   */
  public async saveMapDataAsync(
    id: string,
    mapData: string,
    objectsCount: number,
    userEmail: string,
    isAdmin: boolean,
    thumbnail?: string
  ): Promise<{ success: boolean; error?: string }> {
    const res = this.updateWorkspace(id, { mapData, objectsCount, thumbnail }, userEmail, isAdmin)
    if (!res.success) {
      return { success: false, error: res.error }
    }
    if (res.syncPromise) {
      const dbRes = await res.syncPromise
      if (!dbRes.success) {
        return { success: false, error: dbRes.error }
      }
    }
    return { success: true }
  }

  // ── 5. ARQUIVAMENTO & EXCLUSÃO ───────────────────────────────

  public archiveWorkspace(
    id: string,
    userEmail: string,
    isAdmin: boolean
  ): { success: boolean; error?: string } {
    const res = this.updateWorkspace(id, { status: "archived" }, userEmail, isAdmin)
    return { success: res.success, error: res.error }
  }

  public restoreWorkspace(
    id: string,
    userEmail: string,
    isAdmin: boolean
  ): { success: boolean; error?: string } {
    const res = this.updateWorkspace(id, { status: "active" }, userEmail, isAdmin)
    return { success: res.success, error: res.error }
  }

  public deleteWorkspace(
    id: string,
    userEmail: string,
    isAdmin: boolean
  ): { success: boolean; error?: string } {
    const current = this.getAllWorkspaces()
    const ws = current.find((w) => w.id === id)

    if (!ws) return { success: false, error: "Workspace não encontrado." }
    if (!this.canUserEdit(ws, userEmail, isAdmin)) {
      return { success: false, error: "Acesso Negado: Você não pode excluir este workspace." }
    }

    this.markDeletedId(id)
    const filtered = current.filter((w) => w.id !== id)
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    }

    // Remove do Supabase em segundo plano
    ;(async () => {
      try {
        const wsUuid = toWorkspaceUuid(id)
        const { data: itemsAnchor } = await supabase
          .from("business_systems")
          .select("id")
          .eq("workspace_id", wsUuid)
          .eq("code", ITEMS_ANCHOR_CODE)
          .maybeSingle()

        if (itemsAnchor?.id) {
          await supabase.from("universal_records").delete().eq("system_id", itemsAnchor.id)
          await supabase.from("business_systems").delete().eq("id", itemsAnchor.id)
        }

        await supabase
          .from("business_systems")
          .delete()
          .eq("workspace_id", wsUuid)
          .eq("code", WS_STATE_CODE)
      } catch (err) {
        console.warn("Aviso ao excluir workspace no Supabase:", err)
      }
    })()

    return { success: true }
  }
}

export const workspacesService = WorkspacesService.getInstance()

export function canUserEditWorkspace(
  ws: WorkspaceMap | null | undefined,
  userEmail: string | undefined | null,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true
  if (!ws || !userEmail) return false
  return (ws.ownerEmail || "").toLowerCase() === userEmail.toLowerCase()
}

export function canUserCreateWorkspace(
  userEmail: string | undefined | null,
  isAdmin: boolean
): boolean {
  return workspacesService.canUserCreate(userEmail, isAdmin)
}
