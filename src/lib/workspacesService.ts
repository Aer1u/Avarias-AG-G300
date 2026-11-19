// =============================================================================
// NEXUS ERP — SERVIÇO DE WORKSPACES (GOVERNANÇA & MAPAS DE USUÁRIOS)
// Regras Oficiais:
// 1. VISUALIZAÇÃO UNIVERSAL: Qualquer usuário autenticado pode visualizar todos
//    os workspaces e entrar neles como VISUALIZADOR (somente leitura).
// 2. EDIÇÃO RESTRITA: Apenas o PROPRIETÁRIO do mapa ou ADMINISTRADORES (níveis 1 a 3)
//    podem editar, mover objetos ou salvar alterações no workspace.
// 3. CRIAÇÃO SELETIVA: Nem todos podem criar workspaces. Apenas Administradores ou
//    usuários definidos nominalmente pelo Administrador na lista de criadores autorizados.
// Persistência: localStorage ("nexus_ws_maps_v1" & "nexus_ws_authorized_creators_v1")
// =============================================================================

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
  /** Dados do mapa (objetos MapObject[]) serializado como JSON string */
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

// Workspace demonstrativo inicial para que os visualizadores tenham o que explorar na 1ª visita
const DEFAULT_INITIAL_WORKSPACE: WorkspaceMap = {
  id: "ws_demo_g300",
  name: "Galpão Operacional G300 — Mapeamento Central",
  description: "Layout oficial do armazém central com ruas de circulação, blocos de armazenagem e estruturas Drive-In.",
  status: "active",
  ownerEmail: "profissionaltrgm@gmail.com",
  ownerName: "Platform Owner",
  objectsCount: 16,
  createdAt: "2026-01-15T10:00:00.000Z",
  updatedAt: new Date().toISOString(),
  tags: ["Oficial", "Produção", "G300"],
}

class WorkspacesService {
  private static instance: WorkspacesService
  private constructor() {}

  public static getInstance(): WorkspacesService {
    if (!WorkspacesService.instance) {
      WorkspacesService.instance = new WorkspacesService()
    }
    return WorkspacesService.instance
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
    return { success: true }
  }

  /** Remove um usuário da lista de criadores autorizados (apenas Admin) */
  public removeAuthorizedCreator(email: string, isAdmin: boolean): { success: boolean; error?: string } {
    if (!isAdmin) {
      return { success: false, error: "Apenas administradores podem revogar permissão de criação de workspace." }
    }
    const clean = email.trim().toLowerCase()
    const current = this.getAuthorizedCreators()
    const updated = current.filter(e => e.toLowerCase() !== clean)
    localStorage.setItem(CREATORS_KEY, JSON.stringify(updated))
    return { success: true }
  }

  /**
   * Verifica se o usuário atual tem permissão para CRIAR workspaces.
   * Regra: Administradores (nível 1, 2 ou 3) OU emails presentes na lista de criadores autorizados.
   */
  public canUserCreate(userEmail: string | undefined | null, isAdmin: boolean): boolean {
    if (isAdmin) return true
    if (!userEmail) return false
    const authorized = this.getAuthorizedCreators()
    return authorized.map(e => e.toLowerCase()).includes(userEmail.toLowerCase())
  }

  /**
   * Verifica se o usuário atual tem permissão para EDITAR/SALVAR o workspace.
   * Regra: Administradores OU o criador/dono do mapa.
   * Todos os demais entram como VISUALIZADOR.
   */
  public canUserEdit(
    ws: WorkspaceMap | null | undefined,
    userEmail: string | undefined | null,
    isAdmin: boolean
  ): boolean {
    if (isAdmin) return true
    if (!ws || !userEmail) return false
    return (ws.ownerEmail || "").toLowerCase() === userEmail.toLowerCase()
  }

  // ── 2. LEITURA DE WORKSPACES (TODOS PODEM VISUALIZAR) ────────

  /**
   * Retorna todos os workspaces do sistema.
   * Todo mundo consegue visualizar a lista e entrar como visualizador.
   */
  public getAllWorkspaces(): WorkspaceMap[] {
    if (typeof window === "undefined") return [DEFAULT_INITIAL_WORKSPACE]
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([DEFAULT_INITIAL_WORKSPACE]))
        return [DEFAULT_INITIAL_WORKSPACE]
      }
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([DEFAULT_INITIAL_WORKSPACE]))
      return [DEFAULT_INITIAL_WORKSPACE]
    } catch {
      return [DEFAULT_INITIAL_WORKSPACE]
    }
  }

  /** Retorna workspaces para listagem geral (todos visualizam todos) */
  public getVisibleWorkspaces(): WorkspaceMap[] {
    return this.getAllWorkspaces()
  }

  public getWorkspaceById(id: string): WorkspaceMap | null {
    return this.getAllWorkspaces().find((w) => w.id === id) || null
  }

  // ── 3. CRIAÇÃO SELETIVA ──────────────────────────────────────

  /**
   * Cria um novo workspace.
   * Bloqueado se o usuário não for Admin e nem criador autorizado.
   */
  public createWorkspace(
    data: { name: string; description?: string; ownerEmail: string; ownerName: string; tags?: string[] },
    isAdmin: boolean
  ): { success: boolean; workspace?: WorkspaceMap; error?: string } {
    if (!this.canUserCreate(data.ownerEmail, isAdmin)) {
      return {
        success: false,
        error: "Acesso Restrito: Apenas administradores ou usuários expressamente autorizados têm permissão para criar novos workspaces.",
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

    return { success: true, workspace: newWs }
  }

  // ── 4. ATUALIZAÇÃO / EDIÇÃO ──────────────────────────────────

  public updateWorkspace(
    id: string,
    partial: Partial<WorkspaceMap>,
    userEmail: string,
    isAdmin: boolean
  ): { success: boolean; workspace?: WorkspaceMap; error?: string } {
    const current = this.getAllWorkspaces()
    const idx = current.findIndex((w) => w.id === id)

    if (idx === -1) return { success: false, error: "Workspace não encontrado." }

    const ws = current[idx]
    if (!this.canUserEdit(ws, userEmail, isAdmin)) {
      return {
        success: false,
        error: "Acesso Negado: Você está navegando em modo visualizador e não tem permissão para editar este workspace.",
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))

    return { success: true, workspace: updatedWs }
  }

  /**
   * Salva o estado do mapa.
   * Só o proprietário ou administradores podem salvar.
   */
  public saveMapData(
    id: string,
    mapData: string,
    objectsCount: number,
    userEmail: string,
    isAdmin: boolean,
    thumbnail?: string
  ): { success: boolean; error?: string } {
    return this.updateWorkspace(id, { mapData, objectsCount, thumbnail }, userEmail, isAdmin)
  }

  // ── 5. ARQUIVAMENTO & EXCLUSÃO ───────────────────────────────

  public archiveWorkspace(
    id: string,
    userEmail: string,
    isAdmin: boolean
  ): { success: boolean; error?: string } {
    return this.updateWorkspace(id, { status: "archived" }, userEmail, isAdmin)
  }

  public restoreWorkspace(
    id: string,
    userEmail: string,
    isAdmin: boolean
  ): { success: boolean; error?: string } {
    return this.updateWorkspace(id, { status: "active" }, userEmail, isAdmin)
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

    const filtered = current.filter((w) => w.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))

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
