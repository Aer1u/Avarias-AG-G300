// =============================================================================
// SYSTEM: IAM & GOVERNANÇA GLOBAL
// OWNER:  Platform Owner (Nível 1) / Platform Admin (Nível 2)
// SCOPE:  Global – invisível por padrão para TODOS, incluindo o proprietário.
// ACTIVATE: Pressione Ctrl+Shift+D para revelar o painel de desenvolvedor.
// =============================================================================

"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Shield, ShieldCheck, ExternalLink, Settings, X, Code2 } from 'lucide-react'
import { useIAM } from '@/providers/IAMProvider'
import { AdminCenterModal } from './AdminCenter/AdminCenterModal'

interface GlobalAdminBarProps {
  currentWorkspaceId?: string
  currentMapId?: string
}

export function GlobalAdminBar({ currentWorkspaceId = 'ws_g300', currentMapId }: GlobalAdminBarProps) {
  const router = useRouter()
  const { authorityLevel, isPlatformOwner, isPlatformAdmin, userEmail, userName } = useIAM()
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [devModeActive, setDevModeActive] = useState(false)

  // Escuta Ctrl+Shift+D — ativa/desativa modo dev (apenas para privilegiados)
  const isPrivileged = isPlatformOwner || isPlatformAdmin || authorityLevel === 1 || authorityLevel === 2

  useEffect(() => {
    if (!isPrivileged) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setDevModeActive(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPrivileged])

  // Sem privilégio: nada renderizado
  if (!isPrivileged) return null

  const isOwner = authorityLevel === 1 || isPlatformOwner

  return (
    <>
      {/* ── Botão Sutil de Modo Desenvolvedor (quando barra está oculta) ── */}
      {!devModeActive && (
        <button
          onClick={() => setDevModeActive(true)}
          className="fixed bottom-3 right-3 z-40 p-2 rounded-xl bg-slate-900/40 hover:bg-slate-900/90 border border-slate-800/40 hover:border-slate-700 text-slate-500 hover:text-slate-300 opacity-25 hover:opacity-100 transition-all shadow-md backdrop-blur-sm"
          title="Opções de desenvolvimento e governança"
        >
          <Code2 size={14} />
        </button>
      )}

      {/* ── Barra Admin — visível quando ativada pelo botão sutil ou Ctrl+Shift+D ── */}
      {devModeActive && (
        <div className="w-full bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-between text-xs select-none sticky top-0 z-40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {isOwner ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-bold border border-amber-500/30 text-[10px]">
                  <Crown size={12} className="text-amber-400" />
                  PROPRIETÁRIO GLOBAL
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/30 text-[10px]">
                  <Shield size={12} className="text-indigo-400" />
                  ADMIN GLOBAL
                </span>
              )}
              <span className="text-slate-400 hidden sm:inline">•</span>
              <span className="text-slate-300 hidden sm:inline font-medium">
                {userName || userEmail}
              </span>
            </div>

            {/* Badge modo dev */}
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30 text-[10px]">
              <Code2 size={11} />
              MODO DEV
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdminModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold transition-all hover:scale-[1.02]"
              title="Abrir Central Administrativa e Matriz de Permissões"
            >
              <ShieldCheck size={13} />
              <span>Central IAM</span>
            </button>

            <button
              onClick={() => router.push('/iam')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
              title="Ir para a página completa de Governança"
            >
              <span>Console</span>
              <ExternalLink size={11} />
            </button>

            {/* Fechar barra dev */}
            <button
              onClick={() => setDevModeActive(false)}
              className="h-6 w-6 rounded-lg bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors"
              title="Ocultar painel de desenvolvedor"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal IAM ── */}
      {showAdminModal && (
        <AdminCenterModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          currentMapId={currentMapId}
          currentWorkspaceId={currentWorkspaceId}
        />
      )}
    </>
  )
}
