// =============================================================================
// SYSTEM: IAM — Provedor Global de Autorização
// OWNER:  Platform (Nível 1 — Proprietário Global)
// SCOPE:  Toda a aplicação (wraps src/app/layout.tsx)
// PURPOSE: Carrega a sessão real do Supabase Auth e determina o nível de
//          autoridade do usuário autenticado consultando as tabelas
//          nexus_iam_platform_owners e nexus_iam_platform_admins.
//          Expõe o contexto via useIAM() para qualquer página ou componente.
// =============================================================================

"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuthorityLevel } from '@/components/IAM/types'

// ---------------------------------------------------------------------------
// Tipos do contexto
// ---------------------------------------------------------------------------
export interface IAMSession {
  /** UUID real do Supabase Auth (auth.users.id) */
  userId: string | null
  userEmail: string | null
  userName: string | null
  /** 1=Owner, 2=Global Admin, 3=WS Admin, 4=Operacional, null=não autenticado */
  authorityLevel: AuthorityLevel | null
  /** true enquanto a sessão está sendo carregada */
  loading: boolean
  /** true se autenticado */
  isAuthenticated: boolean
  /** true somente para o Proprietário Global (nível 1) */
  isPlatformOwner: boolean
  /** true para Proprietário + Administradores Globais (nível ≤ 2) */
  isPlatformAdmin: boolean
  /** true para qualquer nível com acesso administrativo (nível ≤ 3) */
  isAnyAdmin: boolean
  /** Recarrega a sessão e consultas IAM */
  refresh: () => void
}

const IAMContext = createContext<IAMSession>({
  userId: null,
  userEmail: null,
  userName: null,
  authorityLevel: null,
  loading: true,
  isAuthenticated: false,
  isPlatformOwner: false,
  isPlatformAdmin: false,
  isAnyAdmin: false,
  refresh: () => {},
})

// ---------------------------------------------------------------------------
// Provedor
// ---------------------------------------------------------------------------
export function IAMProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<IAMSession>({
    userId: null,
    userEmail: null,
    userName: null,
    authorityLevel: null,
    loading: true,
    isAuthenticated: false,
    isPlatformOwner: false,
    isPlatformAdmin: false,
    isAnyAdmin: false,
    refresh: () => {},
  })

  const resolveAuthority = useCallback(async (userId: string | null, userEmail: string | null, userName: string | null) => {
    if (!userId) {
      setSession(prev => ({
        ...prev,
        userId: null,
        userEmail: null,
        userName: null,
        authorityLevel: null,
        loading: false,
        isAuthenticated: false,
        isPlatformOwner: false,
        isPlatformAdmin: false,
        isAnyAdmin: false,
      }))
      return
    }

    try {
      // 0. Reconhecimento Direto do Proprietário Global por E-mail Soberano
      const isMasterOwnerEmail = userEmail?.trim().toLowerCase() === 'profissionaltrgm@gmail.com';
      if (isMasterOwnerEmail) {
        setSession(prev => ({
          ...prev,
          userId,
          userEmail,
          userName: userName || 'Proprietário Global',
          authorityLevel: 1,
          loading: false,
          isAuthenticated: true,
          isPlatformOwner: true,
          isPlatformAdmin: true,
          isAnyAdmin: true,
        }));

        // Registra e sincroniza no Supabase em segundo plano
        Promise.resolve(
          supabase
            .from('nexus_iam_platform_owners')
            .upsert({
              user_id: userId,
              user_email: userEmail,
              user_name: userName || 'Proprietário Global',
              title: 'Platform Owner',
              is_primary: true
            }, { onConflict: 'user_id' })
        ).catch(() => {});

        return;
      }

      // 1. Verifica Proprietário Global (Nível 1)
      const { data: ownerRow } = await supabase
        .from('nexus_iam_platform_owners')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (ownerRow) {
        setSession(prev => ({
          ...prev,
          userId,
          userEmail,
          userName,
          authorityLevel: 1,
          loading: false,
          isAuthenticated: true,
          isPlatformOwner: true,
          isPlatformAdmin: true,
          isAnyAdmin: true,
        }))
        return
      }

      // 2. Verifica Administrador Global (Nível 2)
      const { data: adminRow } = await supabase
        .from('nexus_iam_platform_admins')
        .select('id, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()

      if (adminRow) {
        setSession(prev => ({
          ...prev,
          userId,
          userEmail,
          userName,
          authorityLevel: 2,
          loading: false,
          isAuthenticated: true,
          isPlatformOwner: false,
          isPlatformAdmin: true,
          isAnyAdmin: true,
        }))
        return
      }

      // 3. Verifica Administrador de Workspace (Nível 3)
      const { data: wsAdminRow } = await supabase
        .from('nexus_iam_workspace_admin_assignments')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()

      if (wsAdminRow) {
        setSession(prev => ({
          ...prev,
          userId,
          userEmail,
          userName,
          authorityLevel: 3,
          loading: false,
          isAuthenticated: true,
          isPlatformOwner: false,
          isPlatformAdmin: false,
          isAnyAdmin: true,
        }))
        return
      }

      // 4. Usuário Operacional (Nível 4)
      setSession(prev => ({
        ...prev,
        userId,
        userEmail,
        userName,
        authorityLevel: 4,
        loading: false,
        isAuthenticated: true,
        isPlatformOwner: false,
        isPlatformAdmin: false,
        isAnyAdmin: false,
      }))
    } catch (err) {
      console.error('[IAMProvider] Erro ao resolver autoridade:', err)
      // Falha segura: usuário operacional
      setSession(prev => ({
        ...prev,
        userId,
        userEmail,
        userName,
        authorityLevel: 4,
        loading: false,
        isAuthenticated: true,
        isPlatformOwner: false,
        isPlatformAdmin: false,
        isAnyAdmin: false,
      }))
    }
  }, [])

  const refresh = useCallback(async () => {
    setSession(prev => ({ ...prev, loading: true }))
    const { data: { session: sbSession } } = await supabase.auth.getSession()
    const user = sbSession?.user ?? null
    await resolveAuthority(
      user?.id ?? null,
      user?.email ?? null,
      user?.user_metadata?.full_name ?? user?.email ?? null
    )
  }, [resolveAuthority])

  useEffect(() => {
    // Carga inicial
    supabase.auth.getSession().then(({ data: { session: sbSession } }) => {
      const user = sbSession?.user ?? null
      resolveAuthority(
        user?.id ?? null,
        user?.email ?? null,
        user?.user_metadata?.full_name ?? user?.email ?? null
      )
    })

    // Escuta mudanças de sessão (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sbSession) => {
      const user = sbSession?.user ?? null
      resolveAuthority(
        user?.id ?? null,
        user?.email ?? null,
        user?.user_metadata?.full_name ?? user?.email ?? null
      )
    })

    return () => subscription.unsubscribe()
  }, [resolveAuthority])

  // Injeta o `refresh` no contexto
  const value: IAMSession = { ...session, refresh }

  return <IAMContext.Provider value={value}>{children}</IAMContext.Provider>
}

// ---------------------------------------------------------------------------
// Hook de consumo
// ---------------------------------------------------------------------------
export function useIAM(): IAMSession {
  return useContext(IAMContext)
}
