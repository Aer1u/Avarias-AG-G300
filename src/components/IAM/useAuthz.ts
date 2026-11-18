// =============================================================================
// SYSTEM: IAM & GOVERNANÇA GLOBAL
// OWNER:  Platform Owner (Nível 1) / Platform Admin (Nível 2)
// SCOPE:  Global e Workspace-aware
// PURPOSE: Hook React para avaliação de autorização (RBAC/ABAC) baseada
//          no usuário real autenticado no Supabase e catálogo de permissões.
// =============================================================================

import { useState, useCallback, useMemo, useEffect } from 'react';
import { PermissionCode, ScopeType, Role, UserRoleAssignment, AuthorityLevel } from './types';
import { IAMService, IAMUser } from './iamService';
import { supabase } from '@/lib/supabase';

const ACTIVE_USER_STORAGE_KEY = 'nexus_iam_active_test_user_id';

export function useAuthz(targetMapId?: string, targetWorkspaceId: string = 'ws_g300') {
  const iam = useMemo(() => IAMService.getInstance(), []);

  // Usuário real autenticado no Supabase Auth
  const [realUser, setRealUser] = useState<{ id: string; email?: string | null; name?: string | null } | null>(null);
  const [activeUserId, setActiveUserId] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Monitora sessão real do Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuário'
        };
        setRealUser(u);
        const stored = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_USER_STORAGE_KEY) : null;
        setActiveUserId(stored || u.id);
      } else {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_USER_STORAGE_KEY) : null;
        setActiveUserId(stored || 'guest_user');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuário'
        };
        setRealUser(u);
        const stored = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_USER_STORAGE_KEY) : null;
        setActiveUserId(stored || u.id);
      } else {
        setRealUser(null);
        setActiveUserId('guest_user');
      }
      setRefreshTrigger(prev => prev + 1);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Lista dinâmica de todos os usuários reais registrados
  const allUsers = useMemo<IAMUser[]>(() => {
    return iam.getAllActiveUsers(realUser || undefined);
  }, [iam, realUser, refreshTrigger]);

  // Usuário ativo na avaliação de permissões
  const activeUser = useMemo<IAMUser>(() => {
    const found = allUsers.find(u => u.id === activeUserId);
    if (found) {
      const level = iam.getUserAuthorityLevel(found.id, targetWorkspaceId);
      return { ...found, authorityLevel: level };
    }
    const defaultLevel = iam.getUserAuthorityLevel(activeUserId, targetWorkspaceId);
    return {
      id: activeUserId || 'guest_user',
      name: realUser?.name || 'Usuário Operacional',
      email: realUser?.email || '',
      status: 'active',
      authorityLevel: defaultLevel
    };
  }, [allUsers, activeUserId, iam, targetWorkspaceId, realUser, refreshTrigger]);

  const switchActiveUser = useCallback((userId: string) => {
    setActiveUserId(userId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId);
    }
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const assignments = useMemo<UserRoleAssignment[]>(() => {
    return iam.getUserAssignments(activeUserId);
  }, [iam, activeUserId, refreshTrigger]);

  const activeRoles = useMemo<Role[]>(() => {
    return assignments
      .map(a => iam.getRoleById(a.role_id))
      .filter((r): r is Role => Boolean(r));
  }, [assignments, iam]);

  const primaryRole = useMemo<Role | undefined>(() => {
    return activeRoles[0];
  }, [activeRoles]);

  const isMasterUser = useMemo(() => {
    return realUser?.email?.trim().toLowerCase() === 'profissionaltrgm@gmail.com';
  }, [realUser]);

  const isPlatformOwner = useMemo(() => {
    if (isMasterUser) return true;
    return iam.isPlatformOwner(activeUserId, realUser?.email || undefined);
  }, [iam, activeUserId, realUser, isMasterUser, refreshTrigger]);

  const isPlatformAdmin = useMemo(() => {
    if (isMasterUser) return true;
    return iam.isPlatformAdmin(activeUserId);
  }, [iam, activeUserId, isMasterUser, refreshTrigger]);

  const authorityLevel = useMemo<AuthorityLevel>(() => {
    if (isMasterUser) return 1;
    return iam.getUserAuthorityLevel(activeUserId, targetWorkspaceId, realUser?.email || undefined);
  }, [iam, activeUserId, targetWorkspaceId, realUser, isMasterUser, refreshTrigger]);

  /**
   * Avalia se o usuário atual tem a permissão solicitada considerando os 4 níveis de autoridade
   */
  const can = useCallback((
    permissionCode: PermissionCode, 
    scopeId: string = '*',
    scopeType: ScopeType = 'workspace'
  ): boolean => {
    if (isMasterUser || isPlatformOwner || authorityLevel === 1) return true;
    const result = iam.evaluate({
      userId: activeUserId,
      permissionCode,
      scopeType,
      scopeId,
      targetMapId,
      targetWorkspaceId
    });
    return result.allowed;
  }, [iam, activeUserId, targetMapId, targetWorkspaceId, isMasterUser, isPlatformOwner, authorityLevel, refreshTrigger]);

  /**
   * Oposto do can()
   */
  const cannot = useCallback((
    permissionCode: PermissionCode, 
    scopeId: string = '*',
    scopeType: ScopeType = 'workspace'
  ): boolean => {
    return !can(permissionCode, scopeId, scopeType);
  }, [can]);

  /**
   * Explica deterministamente a decisão tomada pelo motor
   */
  const explain = useCallback((
    permissionCode: PermissionCode, 
    scopeId: string = '*'
  ) => {
    return iam.evaluate({
      userId: activeUserId,
      permissionCode,
      scopeType: 'workspace',
      scopeId,
      targetMapId,
      targetWorkspaceId
    });
  }, [iam, activeUserId, targetMapId, targetWorkspaceId, refreshTrigger]);

  return {
    activeUser,
    activeUserId,
    allUsers,
    switchActiveUser,
    authorityLevel,
    isPlatformOwner,
    isPlatformAdmin,
    primaryRole,
    activeRoles,
    assignments,
    can,
    cannot,
    explain,
    platformOwner: iam.getPlatformOwner(),
    platformAdmins: iam.getPlatformAdmins(),
    workspaceAdmins: iam.getWorkspaceAdmins(),
    refreshAuthz: () => {
      iam.syncWithSupabase().then(() => setRefreshTrigger(prev => prev + 1));
    }
  };
}
