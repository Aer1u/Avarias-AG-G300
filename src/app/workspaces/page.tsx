"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Map,
  Plus,
  Search,
  Layers,
  Clock,
  User,
  Archive,
  Trash2,
  Edit3,
  FolderOpen,
  ArrowLeft,
  Box,
  Lock,
  RefreshCcw,
  Eye,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react"
import { useIAM } from "@/providers/IAMProvider"
import {
  workspacesService,
  canUserCreateWorkspace,
  canUserEditWorkspace,
  type WorkspaceMap,
} from "@/lib/workspacesService"
import { GlobalAdminBar } from "@/components/IAM/GlobalAdminBar"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "agora mesmo"
    if (mins < 60) return `há ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `há ${hours}h`
    const days = Math.floor(hours / 24)
    return `há ${days} dia${days > 1 ? "s" : ""}`
  } catch {
    return ""
  }
}

// ─── Componente Principal ───────────────────────────────────────────────────

export default function WorkspacesPage() {
  const router = useRouter()
  const { userEmail, userName, isAuthenticated, isAnyAdmin, authorityLevel } = useIAM()

  const isAdmin = isAnyAdmin || (authorityLevel !== null && authorityLevel <= 3)

  const [workspaces, setWorkspaces] = useState<WorkspaceMap[]>([])
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [createError, setCreateError] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Modal de gerenciamento de criadores autorizados (Admin)
  const [managingCreators, setManagingCreators] = useState(false)
  const [authorizedCreators, setAuthorizedCreators] = useState<string[]>([])
  const [newCreatorEmail, setNewCreatorEmail] = useState("")
  const [creatorError, setCreatorError] = useState("")

  // Permissão de criação para o usuário atual
  const canCreate = canUserCreateWorkspace(userEmail, isAdmin)

  // Carrega workspaces (TODOS visualizam TODOS os workspaces)
  const load = useCallback(() => {
    const list = workspacesService.getAllWorkspaces()
    setWorkspaces(list)
    setAuthorizedCreators(workspacesService.getAuthorizedCreators())

    // Sincroniza do Supabase em segundo plano
    workspacesService.syncFromSupabase().then((synced) => {
      setWorkspaces(synced)
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ─── Criar Workspace ──────────────────────────────────────────
  function handleCreate() {
    if (!newName.trim()) {
      setCreateError("O nome é obrigatório.")
      return
    }
    const result = workspacesService.createWorkspace(
      {
        name: newName.trim(),
        description: newDesc.trim(),
        ownerEmail: userEmail || "desconhecido@nexus.corp",
        ownerName: userName || userEmail || "Usuário",
      },
      isAdmin
    )
    if (!result.success || !result.workspace) {
      setCreateError(result.error || "Erro ao criar workspace.")
      return
    }
    setCreating(false)
    setNewName("")
    setNewDesc("")
    setCreateError("")
    router.push(`/workspaces/${result.workspace.id}`)
  }

  // ─── Gerenciar Criadores Autorizados ──────────────────────────
  function handleAddCreator() {
    if (!newCreatorEmail.trim()) return
    const res = workspacesService.addAuthorizedCreator(newCreatorEmail.trim(), isAdmin)
    if (!res.success) {
      setCreatorError(res.error || "Erro ao autorizar criador.")
      return
    }
    setNewCreatorEmail("")
    setCreatorError("")
    setAuthorizedCreators(workspacesService.getAuthorizedCreators())
  }

  function handleRemoveCreator(email: string) {
    workspacesService.removeAuthorizedCreator(email, isAdmin)
    setAuthorizedCreators(workspacesService.getAuthorizedCreators())
  }

  // ─── Arquivar / Restaurar ─────────────────────────────────────
  function handleArchive(ws: WorkspaceMap) {
    if (ws.status === "archived") {
      workspacesService.restoreWorkspace(ws.id, userEmail || "", isAdmin)
    } else {
      workspacesService.archiveWorkspace(ws.id, userEmail || "", isAdmin)
    }
    load()
  }

  // ─── Excluir ──────────────────────────────────────────────────
  function handleDelete(id: string) {
    workspacesService.deleteWorkspace(id, userEmail || "", isAdmin)
    setDeletingId(null)
    load()
  }

  // ─── Filtros ──────────────────────────────────────────────────
  const filtered = workspaces.filter((ws) => {
    if (!showArchived && ws.status === "archived") return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      ws.name.toLowerCase().includes(q) ||
      ws.description.toLowerCase().includes(q) ||
      ws.ownerName.toLowerCase().includes(q) ||
      ws.ownerEmail.toLowerCase().includes(q)
    )
  })

  const active = workspaces.filter((ws) => ws.status === "active")
  const archived = workspaces.filter((ws) => ws.status === "archived")

  // ─── Guard: Não autenticado ──────────────────────────────────
  if (!isAuthenticated || !userEmail) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400">
        <Lock size={36} className="text-amber-500" />
        <p className="text-sm">Você precisa estar autenticado para acessar a galeria de Workspaces.</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
        >
          Voltar ao início
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      <GlobalAdminBar />

      {/* Header */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs"
          >
            <ArrowLeft size={14} />
            Início
          </button>
          <span className="text-slate-700">›</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center">
              <Map size={14} className="text-white" />
            </div>
            <span className="font-semibold text-sm text-white">Workspaces</span>
          </div>

          {/* Badge de governança */}
          <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-slate-800 border-slate-700 text-slate-300 flex items-center gap-1">
            <Eye size={10} className="text-indigo-400" />
            Galeria Pública · Todos Podem Visualizar
          </span>

          <div className="ml-auto flex items-center gap-2">
            {/* Botão de gestão de criadores exclusivo para Admin */}
            {isAdmin && (
              <button
                onClick={() => setManagingCreators(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                title="Definir quais usuários podem criar workspaces"
              >
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>Definir Criadores</span>
                {authorizedCreators.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-emerald-950 border border-emerald-800/80 text-[10px] text-emerald-400 rounded-full font-bold">
                    {authorizedCreators.length}
                  </span>
                )}
              </button>
            )}

            {/* Botão criar workspace (com restrição por regra) */}
            {canCreate ? (
              <button
                onClick={() => {
                  setCreating(true)
                  setCreateError("")
                  setNewName("")
                  setNewDesc("")
                }}
                className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-lg shadow-amber-900/40"
              >
                <Plus size={14} />
                Novo Workspace
              </button>
            ) : (
              <div className="relative group">
                <button
                  disabled
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-500 text-xs font-medium cursor-not-allowed"
                >
                  <Lock size={12} className="text-amber-500/70" />
                  <span>Novo Workspace</span>
                </button>
                <div className="absolute right-0 top-full mt-1.5 w-60 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                  A criação de novos workspaces é restrita a administradores e usuários autorizados pelo gestor.
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Métricas rápidas */}
      <div className="shrink-0 border-b border-slate-800/60 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <Layers size={12} className="text-amber-400" />
              <strong className="text-white">{active.length}</strong> mapas disponíveis
            </span>
            <span className="flex items-center gap-1.5">
              <Archive size={12} />
              <strong className="text-slate-300">{archived.length}</strong> arquivados
            </span>
            <span className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              👁️ Qualquer colaborador pode navegar e inspecionar em 2D, 3D e Isométrico
            </span>
          </div>

          <div className="text-[11px] text-slate-400">
            Você está conectado como: <strong className="text-slate-200">{userName || userEmail}</strong>{" "}
            {canCreate ? (
              <span className="text-emerald-400">(Autorizado a criar)</span>
            ) : (
              <span className="text-slate-500">(Modo visualizador)</span>
            )}
          </div>
        </div>
      </div>

      {/* Barra de busca + filtros */}
      <div className="shrink-0 max-w-7xl mx-auto w-full px-4 pt-4 pb-2 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar mapas por nome, descrição ou autor..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-600/60"
          />
        </div>
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
            showArchived
              ? "bg-slate-700 border-slate-600 text-slate-200"
              : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
          }`}
        >
          <Archive size={12} />
          Arquivados
        </button>
        <button
          onClick={load}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          title="Atualizar lista"
        >
          <RefreshCcw size={12} />
        </button>
      </div>

      {/* Grid de Workspaces */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center">
              <Map size={28} className="text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300 mb-1">
                {search ? "Nenhum workspace encontrado" : "Nenhum workspace cadastrado"}
              </p>
              <p className="text-xs text-slate-500">
                {search
                  ? "Tente outro termo de busca."
                  : canCreate
                  ? "Clique em \"Novo Workspace\" para criar seu primeiro mapa."
                  : "Solicite a um administrador permissão para criar workspaces."}
              </p>
            </div>
            {!search && canCreate && (
              <button
                onClick={() => {
                  setCreating(true)
                  setCreateError("")
                  setNewName("")
                  setNewDesc("")
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all"
              >
                <Plus size={14} />
                Criar primeiro workspace
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                ws={ws}
                isAdmin={isAdmin}
                currentUserEmail={userEmail || ""}
                onOpen={() => router.push(`/workspaces/${ws.id}`)}
                onArchive={() => handleArchive(ws)}
                onDeleteRequest={() => setDeletingId(ws.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal Criar Workspace */}
      {creating && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setCreating(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center">
                <Map size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Novo Workspace</h2>
                <p className="text-[11px] text-slate-400">Você será o proprietário deste mapa.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Nome do mapa *
                </label>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Ex: Galpão Central — Setor Leste"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-600/60"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                  Descrição (opcional)
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Descreva o propósito deste mapa..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-600/60 resize-none"
                />
              </div>
            </div>

            {createError && (
              <p className="mt-3 text-xs text-red-400 bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setCreating(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all"
              >
                Criar e Abrir Editor →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gerenciar Criadores Autorizados (Exclusivo Administrador) */}
      {managingCreators && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setManagingCreators(false)}
        >
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Criadores de Workspaces Autorizados</h2>
                  <p className="text-[11px] text-slate-400">
                    Defina quem além dos administradores pode criar novos mapas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingCreators(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Input adicionar criador */}
            <div className="flex gap-2 mb-4">
              <input
                type="email"
                value={newCreatorEmail}
                onChange={(e) => setNewCreatorEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCreator()}
                placeholder="Digite o e-mail do usuário (ex: maria@nexus.corp)..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-600/60"
              />
              <button
                onClick={handleAddCreator}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition-all"
              >
                <UserPlus size={13} />
                <span>Autorizar</span>
              </button>
            </div>

            {creatorError && (
              <p className="mb-3 text-xs text-red-400 bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-1.5">
                {creatorError}
              </p>
            )}

            {/* Lista de autorizados */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-slate-300 font-medium">Administradores da Plataforma</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                  Acesso Nativo
                </span>
              </div>

              {authorizedCreators.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/30 rounded-xl border border-dashed border-slate-800">
                  Nenhum usuário avulso autorizado no momento. Apenas administradores podem criar.
                </div>
              ) : (
                authorizedCreators.map((email) => (
                  <div
                    key={email}
                    className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-200 font-mono text-[11px]">{email}</span>
                    <button
                      onClick={() => handleRemoveCreator(email)}
                      className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition-colors"
                      title="Revogar permissão de criação"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 text-right">
              <button
                onClick={() => setManagingCreators(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {deletingId && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDeletingId(null)}
        >
          <div
            className="w-full max-w-sm bg-slate-900 border border-red-900/50 rounded-2xl shadow-2xl p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-800/50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-400" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Excluir workspace?</h3>
            <p className="text-xs text-slate-400 mb-5">
              Essa ação é irreversível. O mapa e todas as suas configurações serão excluídos.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold transition-all"
              >
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Card de Workspace ───────────────────────────────────────────────────────

interface WorkspaceCardProps {
  ws: WorkspaceMap
  isAdmin: boolean
  currentUserEmail: string
  onOpen: () => void
  onArchive: () => void
  onDeleteRequest: () => void
}

function WorkspaceCard({ ws, isAdmin, currentUserEmail, onOpen, onArchive, onDeleteRequest }: WorkspaceCardProps) {
  const isOwner = (ws.ownerEmail || "").toLowerCase() === (currentUserEmail || "").toLowerCase()
  const canEdit = canUserEditWorkspace(ws, currentUserEmail, isAdmin)
  const isArchived = ws.status === "archived"

  return (
    <div
      className={`group relative rounded-2xl border flex flex-col overflow-hidden transition-all duration-200 cursor-pointer
        ${
          isArchived
            ? "border-slate-800 bg-slate-900/40 opacity-60"
            : "border-slate-800 bg-slate-900/60 hover:border-amber-600/60 hover:bg-slate-900 hover:shadow-xl hover:shadow-amber-900/10"
        }`}
      onClick={onOpen}
    >
      {/* Thumbnail / Preview */}
      <div className="relative h-32 bg-slate-800/60 flex items-center justify-center overflow-hidden border-b border-slate-800">
        {ws.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ws.thumbnail} alt={ws.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <Box size={32} />
            <span className="text-[10px] font-medium">Prévia Espacial</span>
          </div>
        )}

        {/* Badge de status */}
        {isArchived && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Archive size={9} />
            Arquivado
          </div>
        )}

        {/* Badge papel do usuário no mapa */}
        <div className="absolute top-2 right-2">
          {canEdit ? (
            <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-[9px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Edit3 size={8} />
              Editor
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-[9px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
              <Eye size={8} />
              Visualizador
            </span>
          )}
        </div>

        {/* Contagem de objetos */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700/60 text-[10px] text-slate-400 flex items-center gap-1">
          <Layers size={9} />
          {ws.objectsCount} obj.
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <div>
          <h3 className="text-sm font-semibold text-white leading-tight truncate">{ws.name}</h3>
          {ws.description && (
            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{ws.description}</p>
          )}
        </div>

        {/* Criador do mapa */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
          <User size={10} className="text-slate-500" />
          <span className="truncate">
            Criado por: <strong className="text-slate-300">{isOwner ? "Você" : ws.ownerName || ws.ownerEmail}</strong>
          </span>
        </div>

        {/* Rodapé do card com botão de entrar */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/70 mt-auto">
          <div className="flex items-center gap-1">
            <Clock size={9} />
            <span title={formatDate(ws.updatedAt)}>{relativeTime(ws.updatedAt)}</span>
          </div>

          <span
            className={`font-semibold flex items-center gap-1 ${
              canEdit ? "text-amber-400 group-hover:text-amber-300" : "text-indigo-400 group-hover:text-indigo-300"
            }`}
          >
            {canEdit ? "Editar Mapa →" : "Visualizar Mapa 👁️"}
          </span>
        </div>
      </div>

      {/* Ações de Gestão (Apenas para Dono ou Admin) */}
      {canEdit && (
        <div
          className="absolute top-2 left-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 p-1 rounded-xl border border-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onArchive}
            title={isArchived ? "Restaurar" : "Arquivar"}
            className="p-1 rounded text-slate-400 hover:text-blue-400 transition-colors"
          >
            {isArchived ? <FolderOpen size={11} /> : <Archive size={11} />}
          </button>
          <button
            onClick={onDeleteRequest}
            title="Excluir workspace"
            className="p-1 rounded text-slate-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  )
}
