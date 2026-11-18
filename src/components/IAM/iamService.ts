// =============================================================================
// SYSTEM: IAM & GOVERNANÇA GLOBAL
// OWNER:  Platform Owner (Nível 1) / Platform Admin (Nível 2)
// SCOPE:  Global (toda a plataforma NEXUS ERP)
// PURPOSE: Serviço singleton de governança IAM com motor determinístico
//          de autorização em 4 níveis (Owner -> Global Admin -> WS Admin -> Operacional).
//          Sem dados fictícios/exemplos: integrado com Supabase e persistência real.
// =============================================================================

import { 
  PermissionCode, 
  Role, 
  UserRoleAssignment, 
  AccessGrant, 
  MapParticipant, 
  IAMAuditLog, 
  PermissionEvaluationContext, 
  PermissionEvaluationResult, 
  ScopeType, 
  AuthorityLevel, 
  PlatformOwner, 
  PlatformAdmin, 
  WorkspaceAdminAssignment, 
  WorkspaceAdminConstraint 
} from './types';
import { DEFAULT_ROLES } from './defaultRoles';
import { supabase } from '@/lib/supabase';

const LOCAL_STORAGE_KEY_ROLES = 'nexus_iam_roles_v2';
const LOCAL_STORAGE_KEY_ASSIGNMENTS = 'nexus_iam_assignments_v2';
const LOCAL_STORAGE_KEY_GRANTS = 'nexus_iam_grants_v2';
const LOCAL_STORAGE_KEY_PARTICIPANTS = 'nexus_iam_participants_v2';
const LOCAL_STORAGE_KEY_AUDIT = 'nexus_iam_audit_logs_v2';
const LOCAL_STORAGE_KEY_PLATFORM_OWNER = 'nexus_iam_platform_owner_v2';
const LOCAL_STORAGE_KEY_PLATFORM_ADMINS = 'nexus_iam_platform_admins_v2';
const LOCAL_STORAGE_KEY_WS_ADMINS = 'nexus_iam_ws_admins_v2';

export interface IAMUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'active' | 'suspended';
  authorityLevel: AuthorityLevel;
}

export class IAMService {
  private static instance: IAMService;

  private platformOwner: PlatformOwner | null = null;
  private platformAdmins: PlatformAdmin[] = [];
  private workspaceAdmins: WorkspaceAdminAssignment[] = [];
  private roles: Role[] = [];
  private assignments: UserRoleAssignment[] = [];
  private grants: AccessGrant[] = [];
  private participants: MapParticipant[] = [];
  private auditLogs: IAMAuditLog[] = [];

  private constructor() {
    this.init();
    if (typeof window !== 'undefined') {
      this.syncWithSupabase().catch(err => console.warn('[IAMService] Sync inicial offline/cache:', err));
    }
  }

  public static getInstance(): IAMService {
    if (!IAMService.instance) {
      IAMService.instance = new IAMService();
    }
    return IAMService.instance;
  }

  private init() {
    if (typeof window === 'undefined') return;

    try {
      // 1. Platform Owner (Nível 1)
      const savedOwner = localStorage.getItem(LOCAL_STORAGE_KEY_PLATFORM_OWNER);
      if (savedOwner) {
        this.platformOwner = JSON.parse(savedOwner);
      } else {
        this.platformOwner = {
          id: 'po_master',
          user_id: 'master_owner_id',
          user_name: 'Proprietário Global',
          user_email: 'ProfissionalTrgm@gmail.com',
          title: 'Platform Owner',
          is_primary: true,
          created_at: new Date().toISOString()
        };
        this.persistPlatformOwner();
      }

      // 2. Platform Admins (Nível 2)
      const savedGlobalAdmins = localStorage.getItem(LOCAL_STORAGE_KEY_PLATFORM_ADMINS);
      if (savedGlobalAdmins) {
        this.platformAdmins = JSON.parse(savedGlobalAdmins);
      } else {
        this.platformAdmins = [];
      }

      // 3. Workspace Admins (Nível 3)
      const savedWsAdmins = localStorage.getItem(LOCAL_STORAGE_KEY_WS_ADMINS);
      if (savedWsAdmins) {
        this.workspaceAdmins = JSON.parse(savedWsAdmins);
      } else {
        this.workspaceAdmins = [];
      }

      // 4. Roles (Catálogo padrão do sistema)
      const savedRoles = localStorage.getItem(LOCAL_STORAGE_KEY_ROLES);
      if (savedRoles) {
        this.roles = JSON.parse(savedRoles);
      } else {
        this.roles = [...DEFAULT_ROLES];
        this.persistRoles();
      }

      // 5. Assignments
      const savedAssign = localStorage.getItem(LOCAL_STORAGE_KEY_ASSIGNMENTS);
      if (savedAssign) {
        this.assignments = JSON.parse(savedAssign);
      } else {
        this.assignments = [];
      }

      // 6. Grants
      const savedGrants = localStorage.getItem(LOCAL_STORAGE_KEY_GRANTS);
      if (savedGrants) {
        this.grants = JSON.parse(savedGrants);
      } else {
        this.grants = [];
      }

      // 7. Participants
      const savedParticipants = localStorage.getItem(LOCAL_STORAGE_KEY_PARTICIPANTS);
      if (savedParticipants) {
        this.participants = JSON.parse(savedParticipants);
      } else {
        this.participants = [];
      }

      // 8. Audit
      const savedAudit = localStorage.getItem(LOCAL_STORAGE_KEY_AUDIT);
      if (savedAudit) {
        this.auditLogs = JSON.parse(savedAudit);
      } else {
        this.auditLogs = [];
      }
    } catch (e) {
      console.error('[IAMService] Erro ao carregar cache local:', e);
      this.roles = [...DEFAULT_ROLES];
    }
  }

  /**
   * Sincroniza dados com as tabelas reais do Supabase
   */
  public async syncWithSupabase(): Promise<void> {
    try {
      // 1. Platform Owner
      const { data: owners } = await supabase
        .from('nexus_iam_platform_owners')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1);

      if (owners && owners.length > 0) {
        this.platformOwner = owners[0] as PlatformOwner;
        this.persistPlatformOwner();
      }

      // 2. Platform Admins
      const { data: admins } = await supabase
        .from('nexus_iam_platform_admins')
        .select('*')
        .order('appointed_at', { ascending: false });

      if (admins) {
        this.platformAdmins = admins as PlatformAdmin[];
        this.persistPlatformAdmins();
      }

      // 3. Workspace Admins
      const { data: wsAdmins } = await supabase
        .from('nexus_iam_workspace_admin_assignments')
        .select('*')
        .order('appointed_at', { ascending: false });

      if (wsAdmins) {
        this.workspaceAdmins = wsAdmins as WorkspaceAdminAssignment[];
        this.persistWorkspaceAdmins();
      }

      // 4. Assignments
      const { data: asgs } = await supabase
        .from('nexus_iam_user_role_assignments')
        .select('*')
        .eq('status', 'active');

      if (asgs) {
        this.assignments = asgs as UserRoleAssignment[];
        this.persistAssignments();
      }

      // 5. Audit logs
      const { data: logs } = await supabase
        .from('nexus_iam_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (logs) {
        this.auditLogs = logs as IAMAuditLog[];
        this.persistAudit();
      }
    } catch (err) {
      console.warn('[IAMService] Sincronização Supabase em fallback local:', err);
    }
  }

  // --- Persistência Local ---
  private persistPlatformOwner() {
    if (typeof window !== 'undefined') {
      if (this.platformOwner) {
        localStorage.setItem(LOCAL_STORAGE_KEY_PLATFORM_OWNER, JSON.stringify(this.platformOwner));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_PLATFORM_OWNER);
      }
    }
  }

  private persistPlatformAdmins() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY_PLATFORM_ADMINS, JSON.stringify(this.platformAdmins));
    }
  }

  private persistWorkspaceAdmins() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY_WS_ADMINS, JSON.stringify(this.workspaceAdmins));
    }
  }

  private persistRoles() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY_ROLES, JSON.stringify(this.roles));
    }
  }

  private persistAssignments() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY_ASSIGNMENTS, JSON.stringify(this.assignments));
    }
  }

  private persistGrants() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY_GRANTS, JSON.stringify(this.grants));
    }
  }

  private persistAudit() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY_AUDIT, JSON.stringify(this.auditLogs.slice(0, 500)));
    }
  }

  // --- HIERARQUIA: NÍVEL 1 (PROPRIETÁRIO GLOBAL) ---
  public getPlatformOwner(): PlatformOwner | null {
    return this.platformOwner;
  }

  public setPlatformOwner(owner: PlatformOwner) {
    this.platformOwner = owner;
    this.persistPlatformOwner();
  }

  public isPlatformOwner(userId: string, userEmail?: string): boolean {
    if (userEmail && userEmail.trim().toLowerCase() === 'profissionaltrgm@gmail.com') return true;
    if (this.platformOwner?.user_email?.trim().toLowerCase() === 'profissionaltrgm@gmail.com') {
      if (userId && this.platformOwner.user_id === userId) return true;
    }
    if (!userId || !this.platformOwner?.user_id) return false;
    return this.platformOwner.user_id === userId;
  }

  // --- HIERARQUIA: NÍVEL 2 (ADMINISTRADORES GLOBAIS) ---
  public getPlatformAdmins(): PlatformAdmin[] {
    return this.platformAdmins;
  }

  public isPlatformAdmin(userId: string, userEmail?: string): boolean {
    if (!userId) return false;
    if (this.isPlatformOwner(userId, userEmail)) return true;
    return this.platformAdmins.some(pa => pa.user_id === userId && pa.status === 'active');
  }

  public appointPlatformAdmin(admin: Omit<PlatformAdmin, 'id' | 'appointed_at'>): PlatformAdmin {
    const newAdmin: PlatformAdmin = {
      ...admin,
      id: `pa_${Date.now()}`,
      appointed_at: new Date().toISOString()
    };
    this.platformAdmins.push(newAdmin);
    this.persistPlatformAdmins();

    // Persiste no Supabase em segundo plano
    supabase
      .from('nexus_iam_platform_admins')
      .insert({
        user_id: newAdmin.user_id,
        user_email: newAdmin.user_email,
        user_name: newAdmin.user_name,
        title: newAdmin.title,
        status: newAdmin.status,
        can_manage_workspaces: newAdmin.can_manage_workspaces,
        can_create_workspaces: newAdmin.can_create_workspaces,
        can_manage_local_admins: newAdmin.can_manage_local_admins,
        can_view_all_audit_logs: newAdmin.can_view_all_audit_logs,
        can_manage_global_policies: newAdmin.can_manage_global_policies,
        delegation_ceiling_level: newAdmin.delegation_ceiling_level,
        appointed_by: newAdmin.appointed_by
      })
      .then(({ error }) => {
        if (error) console.error('[IAMService] Erro ao persistir admin no Supabase:', error);
      });

    this.logAudit({
      action: 'PLATFORM_ADMIN_APPOINTED',
      resource_type: 'platform_admin',
      resource_id: newAdmin.id,
      new_value: { ...newAdmin }
    });

    return newAdmin;
  }

  public updatePlatformAdmin(adminId: string, updates: Partial<PlatformAdmin>): void {
    const idx = this.platformAdmins.findIndex(a => a.id === adminId);
    if (idx !== -1) {
      const old = { ...this.platformAdmins[idx] };
      this.platformAdmins[idx] = { ...this.platformAdmins[idx], ...updates };
      this.persistPlatformAdmins();

      // Sincroniza com Supabase
      supabase
        .from('nexus_iam_platform_admins')
        .update(updates)
        .eq('id', adminId)
        .then(({ error }) => {
          if (error) console.error('[IAMService] Erro ao atualizar admin no Supabase:', error);
        });

      this.logAudit({
        action: 'PLATFORM_ADMIN_MODIFIED',
        resource_type: 'platform_admin',
        resource_id: adminId,
        old_value: old as unknown as Record<string, unknown>,
        new_value: this.platformAdmins[idx] as unknown as Record<string, unknown>
      });
    }
  }

  // --- HIERARQUIA: NÍVEL 3 (ADMINISTRADORES DE WORKSPACE & LIMITES) ---
  public getWorkspaceAdmins(): WorkspaceAdminAssignment[] {
    return this.workspaceAdmins;
  }

  public getWorkspaceAdmin(workspaceId: string, userId: string): WorkspaceAdminAssignment | undefined {
    return this.workspaceAdmins.find(w => w.workspace_id === workspaceId && w.user_id === userId && w.status === 'active');
  }

  public updateWorkspaceAdminConstraints(assignmentId: string, constraints: WorkspaceAdminConstraint): void {
    const asg = this.workspaceAdmins.find(a => a.id === assignmentId);
    if (asg) {
      const old = asg.constraints ? { ...asg.constraints } : null;
      asg.constraints = { ...asg.constraints, ...constraints };
      this.persistWorkspaceAdmins();

      this.logAudit({
        action: 'ADMIN_CONSTRAINTS_ENFORCED',
        resource_type: 'workspace_admin_assignment',
        resource_id: assignmentId,
        old_value: old as any,
        new_value: asg.constraints as any
      });
    }
  }

  // --- RETORNA NÍVEL DE AUTORIDADE DO USUÁRIO ---
  public getUserAuthorityLevel(userId: string, workspaceId?: string, userEmail?: string): AuthorityLevel {
    if (userEmail && userEmail.trim().toLowerCase() === 'profissionaltrgm@gmail.com') return 1;
    if (!userId) return 4;
    if (this.isPlatformOwner(userId, userEmail)) return 1;
    if (this.isPlatformAdmin(userId, userEmail)) return 2;
    if (workspaceId && this.workspaceAdmins.some(w => w.user_id === userId && w.workspace_id === workspaceId && w.status === 'active')) {
      return 3;
    }
    return 4;
  }

  // --- OBTÉM TODOS OS USUÁRIOS REAIS REGISTRADOS ---
  public getAllActiveUsers(currentUser?: { id: string; email?: string | null; name?: string | null }): IAMUser[] {
    const map = new Map<string, IAMUser>();

    // 1. Current user logado
    if (currentUser?.id) {
      const level = this.getUserAuthorityLevel(currentUser.id);
      map.set(currentUser.id, {
        id: currentUser.id,
        name: currentUser.name || currentUser.email || 'Usuário Atual',
        email: currentUser.email || '',
        status: 'active',
        authorityLevel: level
      });
    }

    // 2. Platform Owner
    if (this.platformOwner?.user_id) {
      map.set(this.platformOwner.user_id, {
        id: this.platformOwner.user_id,
        name: this.platformOwner.user_name || 'Proprietário Global',
        email: this.platformOwner.user_email || '',
        status: 'active',
        authorityLevel: 1
      });
    }

    // 3. Platform Admins
    for (const pa of this.platformAdmins) {
      if (pa.user_id && !map.has(pa.user_id)) {
        map.set(pa.user_id, {
          id: pa.user_id,
          name: pa.user_name || pa.user_email,
          email: pa.user_email,
          status: pa.status === 'active' ? 'active' : 'suspended',
          authorityLevel: 2
        });
      }
    }

    // 4. Workspace Admins
    for (const wa of this.workspaceAdmins) {
      if (wa.user_id && !map.has(wa.user_id)) {
        map.set(wa.user_id, {
          id: wa.user_id,
          name: wa.user_name || wa.user_email,
          email: wa.user_email,
          status: wa.status === 'active' ? 'active' : 'suspended',
          authorityLevel: 3
        });
      }
    }

    // 5. Assignments
    for (const asg of this.assignments) {
      if (asg.user_id && !map.has(asg.user_id)) {
        const level = this.getUserAuthorityLevel(asg.user_id, asg.workspace_id);
        map.set(asg.user_id, {
          id: asg.user_id,
          name: asg.user_name || asg.user_email || asg.user_id,
          email: asg.user_email || '',
          status: asg.status === 'active' ? 'active' : 'suspended',
          authorityLevel: level
        });
      }
    }

    return Array.from(map.values());
  }

  // --- ROLES & ASSIGNMENTS ---
  public getRoles(): Role[] {
    return this.roles;
  }

  public getRoleById(id: string): Role | undefined {
    return this.roles.find(r => r.id === id);
  }

  public getAssignments(): UserRoleAssignment[] {
    return this.assignments;
  }

  public getUserAssignments(userId: string): UserRoleAssignment[] {
    return this.assignments.filter(a => a.user_id === userId && a.status === 'active');
  }

  public assignRole(
    userId: string, 
    roleId: string, 
    scopeType: ScopeType = 'workspace', 
    scopeId: string = '*',
    userEmail?: string,
    userName?: string,
    concedenteId?: string
  ): UserRoleAssignment {
    // Validação de Teto de Delegação (Authority Ceiling)
    if (concedenteId && !this.isPlatformOwner(concedenteId)) {
      const concedenteLevel = this.getUserAuthorityLevel(concedenteId);
      const targetRole = this.getRoleById(roleId);
      if (targetRole && targetRole.authority_level < concedenteLevel) {
        throw new Error(
          `Violação de Limite Administrativo: Um administrador de nível ${concedenteLevel} não pode atribuir um papel de nível ${targetRole.authority_level}.`
        );
      }
    }

    const existing = this.assignments.find(
      a => a.user_id === userId && a.role_id === roleId && a.scope_type === scopeType && a.scope_id === scopeId
    );

    if (existing) {
      existing.status = 'active';
      this.persistAssignments();
      return existing;
    }

    const newAsg: UserRoleAssignment = {
      id: `asg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      workspace_id: scopeId || 'ws_default',
      user_id: userId,
      user_email: userEmail || `${userId}@nexuserp.com`,
      user_name: userName || userId,
      role_id: roleId,
      scope_type: scopeType,
      scope_id: scopeId,
      granted_by: concedenteId,
      granted_at: new Date().toISOString(),
      status: 'active'
    };

    this.assignments.push(newAsg);
    this.persistAssignments();

    // Persiste no Supabase em segundo plano
    supabase
      .from('nexus_iam_user_role_assignments')
      .insert({
        workspace_id: newAsg.workspace_id,
        user_id: newAsg.user_id,
        user_email: newAsg.user_email,
        user_name: newAsg.user_name,
        role_id: newAsg.role_id,
        scope_type: newAsg.scope_type,
        scope_id: newAsg.scope_id,
        granted_by: newAsg.granted_by,
        status: newAsg.status
      })
      .then(({ error }) => {
        if (error) console.error('[IAMService] Erro ao persistir atribuição no Supabase:', error);
      });

    this.logAudit({
      action: 'ROLE_ASSIGNED',
      resource_type: 'user_role_assignment',
      resource_id: newAsg.id,
      new_value: { userId, roleId, scopeType, scopeId }
    });

    return newAsg;
  }

  // --- MOTOR DE AUTORIZAÇÃO DETERMINÍSTICO (RBAC + ABAC + 4 NÍVEIS) ---
  public evaluate(context: PermissionEvaluationContext): PermissionEvaluationResult {
    const { userId, permissionCode, scopeId, targetMapId, targetWorkspaceId } = context;
    const authLevel = this.getUserAuthorityLevel(userId, targetWorkspaceId);

    // REGRA 1: NÍVEL 1 (Platform Owner) tem autoridade irrestrita e absoluta
    if (authLevel === 1) {
      return {
        allowed: true,
        reason: 'Autorizado com privilégio soberano irrestrito do Proprietário Global (Platform Owner).',
        evaluatedRule: 'PLATFORM_OWNER_SOVEREIGN',
        inheritedFrom: 'PLATFORM_OWNER',
        effectiveAuthorityLevel: 1
      };
    }

    // REGRA 2: Verificação de Limites de Administrador de Workspace (Constraints)
    if (targetWorkspaceId) {
      const wsAdmin = this.getWorkspaceAdmin(targetWorkspaceId, userId);
      if (wsAdmin && wsAdmin.constraints) {
        const c = wsAdmin.constraints;
        if (c.blocked_permission_codes && c.blocked_permission_codes.includes(permissionCode)) {
          return {
            allowed: false,
            reason: `Ação bloqueada pelo limite administrativo imposto pelo Proprietário Global na delegação deste workspace.`,
            evaluatedRule: 'ADMIN_CONSTRAINT_BLOCK',
            effectiveAuthorityLevel: authLevel
          };
        }
        if (permissionCode === 'map.delete' && c.cannot_delete_maps) {
          return {
            allowed: false,
            reason: `Exclusão de mapas bloqueada expressamente nas restrições deste administrador local.`,
            evaluatedRule: 'ADMIN_CANNOT_DELETE_MAPS',
            effectiveAuthorityLevel: authLevel
          };
        }
        if (permissionCode.includes('manage_security') && c.cannot_manage_security) {
          return {
            allowed: false,
            reason: `Gestão de segurança e auditoria restrita aos níveis superiores.`,
            evaluatedRule: 'ADMIN_CANNOT_MANAGE_SECURITY',
            effectiveAuthorityLevel: authLevel
          };
        }
      }
    }

    // REGRA 3: Negação Explícita Individual (Explicit Deny)
    const denyGrant = this.grants.find(
      g => g.beneficiary_id === userId && 
           g.permission_code === permissionCode && 
           g.status === 'active' && 
           g.effect === 'deny' &&
           (g.scope_id === '*' || g.scope_id === scopeId || g.scope_id === targetMapId)
    );

    if (denyGrant) {
      return {
        allowed: false,
        reason: `Acesso negado expressamente por política restritiva (Deny Grant).`,
        evaluatedRule: 'EXPLICIT_DENY',
        effectiveAuthorityLevel: authLevel
      };
    }

    // REGRA 4: Concessão Direta Individual (Direct Grant)
    const directAllow = this.grants.find(
      g => g.beneficiary_id === userId && 
           g.permission_code === permissionCode && 
           g.status === 'active' && 
           g.effect === 'allow' &&
           (g.scope_id === '*' || g.scope_id === scopeId || g.scope_id === targetMapId)
    );

    if (directAllow) {
      return {
        allowed: true,
        reason: 'Permissão concedida por atribuição direta individual.',
        evaluatedRule: 'DIRECT_GRANT',
        effectiveAuthorityLevel: authLevel
      };
    }

    // REGRA 5: Papéis Atribuídos ao Usuário
    const userAssignments = this.assignments.filter(
      a => a.user_id === userId && a.status === 'active'
    );

    for (const asg of userAssignments) {
      const role = this.getRoleById(asg.role_id);
      if (!role || !role.is_active) continue;

      if (role.permissions.includes(permissionCode)) {
        if (asg.scope_id === '*' || asg.scope_type === 'workspace' || asg.scope_type === 'organization') {
          return {
            allowed: true,
            reason: `Autorizado pelo papel '${role.name}' no escopo ${asg.scope_type}.`,
            evaluatedRule: 'ROLE_PERMISSION_INHERITED',
            inheritedFrom: asg.scope_type,
            effectiveAuthorityLevel: authLevel
          };
        }

        if (asg.scope_id === scopeId || (targetMapId && asg.scope_id === targetMapId)) {
          return {
            allowed: true,
            reason: `Autorizado pelo papel '${role.name}' com escopo específico neste recurso.`,
            evaluatedRule: 'ROLE_PERMISSION_SCOPED',
            inheritedFrom: asg.scope_type,
            effectiveAuthorityLevel: authLevel
          };
        }
      }
    }

    // REGRA 6: Padrão Restritivo (Least Privilege Default Deny)
    return {
      allowed: false,
      reason: `Usuário não possui autoridade nem papel com a permissão '${permissionCode}'.`,
      evaluatedRule: 'DEFAULT_DENY',
      effectiveAuthorityLevel: authLevel
    };
  }

  // --- AUDITORIA ---
  public logAudit(entry: Omit<IAMAuditLog, 'id' | 'created_at' | 'result'> & { result?: 'SUCCESS' | 'DENIED' | 'ERROR' }) {
    const log: IAMAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
      result: entry.result || 'SUCCESS',
      ...entry
    };
    this.auditLogs.unshift(log);
    this.persistAudit();

    // Persiste no Supabase em segundo plano
    supabase
      .from('nexus_iam_audit_logs')
      .insert({
        workspace_id: log.workspace_id,
        actor_id: log.actor_id,
        actor_email: log.actor_email,
        action: log.action,
        resource_type: log.resource_type,
        resource_id: log.resource_id,
        old_value: log.old_value,
        new_value: log.new_value,
        ip_address: log.ip_address,
        result: log.result
      })
      .then(({ error }) => {
        if (error) console.warn('[IAMService] Auditoria salva localmente (tabela remota pendente):', error.message);
      });
  }

  public getAuditLogs(): IAMAuditLog[] {
    return this.auditLogs;
  }
}
