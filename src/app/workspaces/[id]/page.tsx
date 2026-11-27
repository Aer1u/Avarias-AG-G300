"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Map, Lock, Eye, Edit3 } from "lucide-react"
import { useIAM } from "@/providers/IAMProvider"
import { workspacesService, canUserEditWorkspace, type WorkspaceMap } from "@/lib/workspacesService"
import { GlobalAdminBar } from "@/components/IAM/GlobalAdminBar"

// ── Mesmo motor do Lab — importação dinâmica sem SSR (Konva/Three.js) ──
const UniversalMapEditor = dynamic(
  () => import("@/components/laboratorio/UniversalMapEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center text-slate-600 text-sm gap-2">
        <span className="animate-spin">⏳</span>
        Carregando editor de mapeamento...
      </div>
    ),
  }
)

export default function WorkspaceEditorPage() {
  const params = useParams()
  const router = useRouter()
  const { userEmail, isAuthenticated, isAdminForWorkspace } = useIAM()

  const workspaceId = typeof params?.id === "string" ? params.id : ""
  const isAdmin = isAdminForWorkspace(workspaceId)

  const [workspace, setWorkspace] = useState<WorkspaceMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  
  // O padrão é SEMPRE entrar como Visualizador (leitura).
  // Editores autorizados/donos precisam clicar conscientemente para habilitar o Modo Edição.
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    let active = true

    Promise.resolve()
      .then(async () => {
        if (!active) return
        const localWs = workspacesService.getWorkspaceById(workspaceId)
        if (localWs) {
          setWorkspace(localWs)
          setNotFound(false)
          setLoading(false)
        } else {
          setLoading(true)
          setNotFound(false)
        }

        const remoteWs = await workspacesService.fetchWorkspaceById(workspaceId)
        if (!active) return
        if (remoteWs) {
          setWorkspace(remoteWs)
          setNotFound(false)
        } else if (!localWs) {
          setNotFound(true)
        }
      })
      .catch(() => {
        if (!active) return
        if (!workspacesService.getWorkspaceById(workspaceId)) {
          setNotFound(true)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [workspaceId])

  // ── Estados de carregamento / não autenticado ──────────────────
  if (!isAuthenticated || !userEmail) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400">
        <Lock size={36} className="text-amber-500" />
        <p className="text-sm">Você precisa estar autenticado para acessar este workspace.</p>
        <button
          onClick={() => router.push("/workspaces")}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
        >
          ← Voltar aos Workspaces
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center text-slate-500 text-sm gap-2">
        <span className="animate-spin">⏳</span> Carregando workspace...
      </div>
    )
  }

  if (notFound || !workspace) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400">
        <Map size={36} className="text-slate-600" />
        <p className="text-sm">Workspace não encontrado.</p>
        <button
          onClick={() => router.push("/workspaces")}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
        >
          ← Voltar aos Workspaces
        </button>
      </div>
    )
  }

  // ── Regra de Autorização ──────────────────────────────────────
  // Todos podem entrar como visualizador (padrão inicial).
  // Apenas o dono ou Administradores têm permissão para ativar o modo de edição.
  const hasEditPermission = canUserEditWorkspace(workspace, userEmail, isAdmin)
  const isReadOnly = !hasEditPermission || !isEditMode

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      <GlobalAdminBar currentWorkspaceId={workspaceId} />

      {/* Header do Workspace */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-slate-800/80 bg-slate-900 shrink-0">
        <button
          onClick={() => router.push("/workspaces")}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs"
        >
          <ArrowLeft size={14} />
          Workspaces
        </button>
        <span className="text-slate-700">›</span>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-amber-600 flex items-center justify-center">
            <Map size={11} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-200 truncate max-w-xs">
            {workspace.name}
          </span>
        </div>

        {/* Informação do proprietário */}
        <span className="ml-1 text-[10px] text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1">
          <span>Criado por:</span>
          <strong className="text-slate-200">{workspace.ownerName || workspace.ownerEmail}</strong>
        </span>

        {/* Badge de status operacional */}
        {isReadOnly ? (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/50 text-indigo-400 flex items-center gap-1">
            <Eye size={10} />
            Visualizador (Leitura)
          </span>
        ) : (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 flex items-center gap-1">
            <Edit3 size={10} />
            Modo Edição Ativo
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Em Modo Edição exibe atalho rápido para retornar ao Visualizador; no Modo Visualizador fica oculto no menu ⋮ */}
          {hasEditPermission && isEditMode && (
            <button
              onClick={() => setIsEditMode(false)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Sair do modo edição e voltar ao modo visualizador"
            >
              <Eye size={12} className="text-indigo-400" />
              <span>Voltar para Visualizador</span>
            </button>
          )}

          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-500">
            Workspace Oficial
          </span>
        </div>
      </header>

      {/* Editor — mesmo motor do Lab, com o flag readOnly quando for visualizador */}
      <UniversalMapEditor
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        workspaceOwnerEmail={userEmail || undefined}
        workspaceIsAdmin={isAdmin}
        readOnly={isReadOnly}
        canEnableEditMode={hasEditPermission}
        onEnableEditMode={() => setIsEditMode(true)}
        onWorkspaceSaved={(count) => {
          setWorkspace((prev) =>
            prev ? { ...prev, objectsCount: count, updatedAt: new Date().toISOString() } : prev
          )
        }}
      />
    </div>
  )
}
