/**
 * NEXUS ERP — Sistema Central de Identidade, Papéis e Permissões (RBAC)
 * ADENDO: Hierarquia Global de Autoridade (Platform Owner, Platform Admins, Workspace Admins)
 */

export type AuthorityLevel = 1 | 2 | 3 | 4;

export const AUTHORITY_LEVEL_LABELS: Record<AuthorityLevel, { name: string; tag: string; description: string }> = {
  1: {
    name: 'Proprietário Global (Platform Owner)',
    tag: 'NÍVEL 1 — SOBERANO',
    description: 'Autoridade máxima da plataforma inteira. Imutável por outros administradores.'
  },
  2: {
    name: 'Administrador Global (Platform Admin)',
    tag: 'NÍVEL 2 — DELEGADO GLOBAL',
    description: 'Nomeado pelo proprietário com competências administrativas globais específicas.'
  },
  3: {
    name: 'Administrador de Workspace (Workspace Admin)',
    tag: 'NÍVEL 3 — GESTOR LOCAL',
    description: 'Administração local do workspace sujeita a limites e tetos delegatórios.'
  },
  4: {
    name: 'Usuário Operacional',
    tag: 'NÍVEL 4 — OPERACIONAL',
    description: 'Gestores de módulo, administradores de mapa, editores, colaboradores e visualizadores.'
  }
};

export interface PlatformOwner {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  title: string;
  is_primary: boolean;
  created_at: string;
}

export interface PlatformAdmin {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  title: string;
  status: 'active' | 'suspended' | 'revoked';
  can_manage_workspaces: boolean;
  can_create_workspaces: boolean;
  can_manage_local_admins: boolean;
  can_view_all_audit_logs: boolean;
  can_manage_global_policies: boolean;
  delegation_ceiling_level: AuthorityLevel;
  appointed_by: string;
  appointed_at: string;
}

export interface WorkspaceAdminAssignment {
  id: string;
  workspace_id: string;
  workspace_name?: string;
  user_id: string;
  user_name: string;
  user_email: string;
  status: 'active' | 'suspended' | 'revoked';
  can_delegate_maps: boolean;
  can_create_local_roles: boolean;
  can_manage_environments: boolean;
  can_manage_modules: boolean;
  appointed_by: string;
  appointed_at: string;
  constraints?: WorkspaceAdminConstraint;
}

export interface WorkspaceAdminConstraint {
  id?: string;
  workspace_admin_assignment_id?: string;
  max_assignable_role_level: AuthorityLevel;
  blocked_permission_codes: PermissionCode[];
  cannot_delete_maps: boolean;
  cannot_manage_security: boolean;
  enforced_by?: string;
}

export type ScopeType = 'organization' | 'workspace' | 'environment' | 'module' | 'map' | 'object';

export type RoleCode = 
  | 'owner' 
  | 'admin' 
  | 'gestor' 
  | 'map_admin' 
  | 'editor' 
  | 'collaborator' 
  | 'viewer' 
  | 'custom';

export type PermissionCode =
  // Mapas
  | 'map.view'
  | 'map.create'
  | 'map.edit'
  | 'map.delete'
  | 'map.duplicate'
  | 'map.export'
  | 'map.share'
  | 'map.manage_access'
  | 'map.publish'
  | 'map.archive'
  // Objetos
  | 'object.view'
  | 'object.create'
  | 'object.edit'
  | 'object.delete'
  | 'object.move'
  | 'object.configure'
  // Estrutura
  | 'structure.view'
  | 'structure.manage'
  // Histórico
  | 'history.view'
  | 'history.restore'
  // Administração
  | 'workspace.manage_members'
  | 'workspace.manage_roles'
  | 'workspace.manage_settings'
  | 'workspace.manage_security'
  | 'module.manage_access'
  | 'environment.manage_access'
  // Módulo Controle PK (MKBR)
  | 'pk.dashboard.view'
  | 'pk.table.view'
  | 'pk.record.manage'
  // Módulo G300 (Estoque & Avarias)
  | 'g300.drivein.view'
  | 'g300.estoque_ba.view'
  | 'g300.confrontos.view'
  | 'g300.produtos.view'
  | 'g300.registros.view'
  | 'g300.retrabalhos.view'
  | 'g300.embalagens.view'
  | 'g300.relatorios.view'
  | 'g300.inventory.manage'
  // Módulo Linha BR (MKBR)
  | 'br.formacao_paletes.view'
  | 'br.paletes_formados.view'
  | 'br.dashboard.view'
  | 'br.paletes.manage';

export type PermissionCategory = 'Mapas' | 'Objetos' | 'Estrutura' | 'Histórico' | 'Administração' | 'Controle PK' | 'G300 Estoque & Avarias' | 'Linha BR';

export interface Permission {
  id: string;
  code: PermissionCode;
  category: PermissionCategory;
  name: string;
  description: string;
  allowed_scopes: ScopeType[];
  is_system_permission?: boolean;
}

export interface Role {
  id: string;
  workspace_id?: string | null;
  code: RoleCode | string;
  name: string;
  description: string;
  is_system_role: boolean;
  is_active: boolean;
  permissions: PermissionCode[];
  authority_level: AuthorityLevel;
  created_at?: string;
  updated_at?: string;
}

export interface UserRoleAssignment {
  id: string;
  workspace_id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  role_id: string;
  role?: Role;
  scope_type: ScopeType;
  scope_id: string;
  granted_by?: string;
  granted_at: string;
  expires_at?: string | null;
  status: 'active' | 'revoked' | 'expired';
}

export interface AccessGrant {
  id: string;
  workspace_id: string;
  beneficiary_type: 'user' | 'group';
  beneficiary_id: string;
  permission_code: PermissionCode;
  scope_type: ScopeType;
  scope_id: string;
  effect: 'allow' | 'deny';
  reason?: string;
  expires_at?: string | null;
  status: 'active' | 'revoked' | 'expired';
}

export interface MapParticipant {
  id: string;
  workspace_id: string;
  map_id: string;
  participant_type: 'user' | 'group' | 'workspace';
  participant_id?: string | null;
  participant_name?: string;
  participant_email?: string;
  role_id: string;
  role?: Role;
  granted_by?: string;
  granted_at: string;
  expires_at?: string | null;
  is_active: boolean;
}

export type MapAccessMode = 'private' | 'workspace' | 'groups' | 'individual';

export interface MapAccessSettings {
  id: string;
  workspace_id: string;
  map_id: string;
  access_mode: MapAccessMode;
  owner_id?: string | null;
  is_archived: boolean;
  allow_export: boolean;
  allow_duplicate: boolean;
}

export interface IAMAuditLog {
  id: string;
  workspace_id?: string;
  actor_id?: string;
  actor_email?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  ip_address?: string;
  result: 'SUCCESS' | 'DENIED' | 'ERROR';
  created_at: string;
}

export interface PermissionEvaluationContext {
  userId: string;
  permissionCode: PermissionCode;
  scopeType: ScopeType;
  scopeId: string;
  targetMapId?: string;
  targetWorkspaceId?: string;
}

export interface PermissionEvaluationResult {
  allowed: boolean;
  reason: string;
  evaluatedRule?: string;
  inheritedFrom?: ScopeType | 'PLATFORM_OWNER' | 'PLATFORM_ADMIN';
  effectiveAuthorityLevel: AuthorityLevel;
}
