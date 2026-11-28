"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Map, Lock } from "lucide-react"
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

      {/* Editor — barra superior unificada + motor espacial (readOnly quando visualizador) */}
      <UniversalMapEditor
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        workspaceOwnerEmail={userEmail || undefined}
        workspaceIsAdmin={isAdmin}
        readOnly={isReadOnly}
        canEnableEditMode={hasEditPermission}
        onEnableEditMode={() => setIsEditMode(true)}
        onBackToWorkspaces={() => router.push("/workspaces")}
        onExitEditMode={hasEditPermission && isEditMode ? () => setIsEditMode(false) : undefined}
        onWorkspaceSaved={(count) => {
          setWorkspace((prev) =>
            prev ? { ...prev, objectsCount: count, updatedAt: new Date().toISOString() } : prev
          )
        }}
      />
    </div>
  )
}
