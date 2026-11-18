-- ==============================================================================
-- NEXUS ERP — Sistema Central de Identidade, Papéis e Permissões (RBAC)
-- ADENDO: HIERARQUIA GLOBAL DE AUTORIDADE (Platform Owner & Platform Admins)
-- Arquivo: supabase/nexus_iam_rbac_identity_permissions.sql
-- 
-- 100% ISOLADO E NÃO-DESTRUTIVO:
-- Todas as tabelas são prefixadas com "nexus_iam_" para NUNCA conflitar com 
-- tabelas pré-existentes do Supabase.
-- ==============================================================================

-- Limpeza de políticas que possam ter sido criadas nas tabelas pré-existentes
DROP POLICY IF EXISTS "Workspaces visíveis para membros" ON public.workspaces;
DROP POLICY IF EXISTS "Membros visíveis para colegas do workspace" ON public.workspace_members;

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. HIERARQUIA GLOBAL: NÍVEL 1 (PROPRIETÁRIO GLOBAL) & NÍVEL 2 (ADMINS GLOBAIS)
-- ==============================================================================

-- Nível 1: Proprietário Global da Plataforma (Platform Owner)
-- Autoridade máxima independente de workspaces; nenhum outro admin pode alterá-lo.
CREATE TABLE IF NOT EXISTS public.nexus_iam_platform_owners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
    title TEXT NOT NULL DEFAULT 'Proprietário Institucional',
    is_primary BOOLEAN NOT NULL DEFAULT true,
    transfer_lock BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Nível 2: Administradores Globais da Plataforma (Platform Admins)
-- Usuários nomeados exclusivamente pelo Proprietário Global.
CREATE TABLE IF NOT EXISTS public.nexus_iam_platform_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    appointed_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    title TEXT NOT NULL DEFAULT 'Administrador Global',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
    can_manage_workspaces BOOLEAN NOT NULL DEFAULT false,
    can_create_workspaces BOOLEAN NOT NULL DEFAULT false,
    can_manage_local_admins BOOLEAN NOT NULL DEFAULT false,
    can_view_all_audit_logs BOOLEAN NOT NULL DEFAULT false,
    can_manage_global_policies BOOLEAN NOT NULL DEFAULT false,
    delegation_ceiling_level INTEGER NOT NULL DEFAULT 3, -- Não pode conceder privilégios acima de seu teto
    appointed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Permissões específicas delegadas a Administradores Globais
CREATE TABLE IF NOT EXISTS public.nexus_iam_platform_admin_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_admin_id UUID NOT NULL REFERENCES public.nexus_iam_platform_admins(id) ON DELETE CASCADE,
    permission_code TEXT NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_platform_admin_perm UNIQUE (platform_admin_id, permission_code)
);

-- Workspaces específicos que um Administrador Global pode administrar
CREATE TABLE IF NOT EXISTS public.nexus_iam_platform_admin_workspace_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_admin_id UUID NOT NULL REFERENCES public.nexus_iam_platform_admins(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL,
    can_manage_members BOOLEAN NOT NULL DEFAULT true,
    can_manage_roles BOOLEAN NOT NULL DEFAULT true,
    can_manage_settings BOOLEAN NOT NULL DEFAULT false,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_platform_admin_ws UNIQUE (platform_admin_id, workspace_id)
);

-- ==============================================================================
-- 3. WORKSPACES & MEMBROS DO NEXUS IAM
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.nexus_iam_workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.nexus_iam_workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.nexus_iam_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'invited', 'inactive')),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_nexus_workspace_member UNIQUE (workspace_id, user_id)
);

-- ==============================================================================
-- 4. NÍVEL 3: ADMINISTRADORES DE WORKSPACE & LIMITES ADMINISTRATIVOS
-- ==============================================================================

-- Nomeação explícita de Administrador de Workspace
CREATE TABLE IF NOT EXISTS public.nexus_iam_workspace_admin_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.nexus_iam_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    appointed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Proprietário ou Admin Global
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
    can_delegate_maps BOOLEAN NOT NULL DEFAULT true,
    can_create_local_roles BOOLEAN NOT NULL DEFAULT true,
    can_manage_environments BOOLEAN NOT NULL DEFAULT true,
    can_manage_modules BOOLEAN NOT NULL DEFAULT true,
    appointed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_nexus_ws_admin UNIQUE (workspace_id, user_id)
);

-- Limites Administrativos (Teto de autoridade que o admin local NÃO pode ultrapassar)
CREATE TABLE IF NOT EXISTS public.nexus_iam_workspace_admin_constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_admin_assignment_id UUID NOT NULL REFERENCES public.nexus_iam_workspace_admin_assignments(id) ON DELETE CASCADE,
    max_assignable_role_level INTEGER NOT NULL DEFAULT 4, -- Nível 4 = Operacional
    blocked_permission_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    cannot_delete_maps BOOLEAN NOT NULL DEFAULT false,
    cannot_manage_security BOOLEAN NOT NULL DEFAULT true,
    enforced_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 5. PERMISSÕES & PAPÉIS (ROLES)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.nexus_iam_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    allowed_scopes TEXT[] NOT NULL DEFAULT ARRAY['workspace', 'module', 'map', 'object'],
    is_system_permission BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.nexus_iam_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.nexus_iam_workspaces(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_nexus_role_code UNIQUE (workspace_id, code)
);

CREATE TABLE IF NOT EXISTS public.nexus_iam_role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES public.nexus_iam_roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.nexus_iam_permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_nexus_role_permission UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.nexus_iam_user_role_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.nexus_iam_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.nexus_iam_roles(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'workspace', 'environment', 'module', 'map', 'object')),
    scope_id TEXT NOT NULL DEFAULT '*',
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 6. GRUPOS & POLÍTICAS DE ACESSO
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.nexus_iam_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.nexus_iam_workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_nexus_group_code UNIQUE (workspace_id, code)
);

CREATE TABLE IF NOT EXISTS public.nexus_iam_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES public.nexus_iam_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_nexus_group_member UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.nexus_iam_group_role_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.nexus_iam_workspaces(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.nexus_iam_groups(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.nexus_iam_roles(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'workspace', 'environment', 'module', 'map', 'object')),
    scope_id TEXT NOT NULL DEFAULT '*',
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.nexus_iam_access_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.nexus_iam_workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
    priority INTEGER NOT NULL DEFAULT 100,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'workspace', 'environment', 'module', 'map', 'object')),
    scope_id TEXT NOT NULL DEFAULT '*',
    permission_codes TEXT[] NOT NULL,
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.nexus_iam_access_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.nexus_iam_workspaces(id) ON DELETE CASCADE,
    beneficiary_type TEXT NOT NULL CHECK (beneficiary_type IN ('user', 'group')),
    beneficiary_id UUID NOT NULL,
    permission_id UUID NOT NULL REFERENCES public.nexus_iam_permissions(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'workspace', 'environment', 'module', 'map', 'object')),
    scope_id TEXT NOT NULL DEFAULT '*',
    effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 7. GERENCIAMENTO DE MAPAS (PARTICIPANTES & ACESSO)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.nexus_iam_map_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.nexus_iam_workspaces(id) ON DELETE CASCADE,
    map_id TEXT NOT NULL,
    participant_type TEXT NOT NULL CHECK (participant_type IN ('user', 'group', 'workspace')),
    participant_id UUID,
    role_id UUID NOT NULL REFERENCES public.nexus_iam_roles(id) ON DELETE RESTRICT,
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_nexus_map_participant UNIQUE (workspace_id, map_id, participant_type, participant_id)
);

CREATE TABLE IF NOT EXISTS public.nexus_iam_map_access_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.nexus_iam_workspaces(id) ON DELETE CASCADE,
    map_id TEXT NOT NULL UNIQUE,
    access_mode TEXT NOT NULL DEFAULT 'private' CHECK (access_mode IN ('private', 'workspace', 'groups', 'individual')),
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    allow_export BOOLEAN NOT NULL DEFAULT true,
    allow_duplicate BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 8. AUDITORIA & SEGURANÇA
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.nexus_iam_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.nexus_iam_workspaces(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    action TEXT NOT NULL, -- Ex: 'PLATFORM_OWNER_APPOINTED', 'PLATFORM_ADMIN_MODIFIED', 'CONSTRAINT_ENFORCED'
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    user_agent TEXT,
    result TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (result IN ('SUCCESS', 'DENIED', 'ERROR')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.nexus_iam_security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.nexus_iam_workspaces(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 9. ÍNDICES DE PERFORMANCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_nexus_platform_owners_user ON public.nexus_iam_platform_owners(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_platform_admins_user ON public.nexus_iam_platform_admins(user_id, status);
CREATE INDEX IF NOT EXISTS idx_nexus_ws_admins_user ON public.nexus_iam_workspace_admin_assignments(user_id, workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_nexus_user_role_asg_lookup ON public.nexus_iam_user_role_assignments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_nexus_map_participants_lookup ON public.nexus_iam_map_participants(map_id, is_active);
CREATE INDEX IF NOT EXISTS idx_nexus_audit_logs_actor ON public.nexus_iam_audit_logs(actor_id, created_at DESC);

-- ==============================================================================
-- 10. FUNÇÕES DE AUTORIDADE GLOBAL & VERIFICAÇÃO DE HIERARQUIA
-- ==============================================================================

-- Verifica se um usuário é o Proprietário Global (Nível 1)
CREATE OR REPLACE FUNCTION public.nexus_is_platform_owner(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.nexus_iam_platform_owners
        WHERE user_id = p_user_id
    );
END;
$$;

-- Verifica se um usuário é Administrador Global (Nível 2)
CREATE OR REPLACE FUNCTION public.nexus_is_platform_admin(
    p_user_id UUID,
    p_required_capability TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Se for o Proprietário Global, possui todas as capacidades
    IF public.nexus_is_platform_owner(p_user_id) THEN
        RETURN TRUE;
    END IF;

    IF p_required_capability IS NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.nexus_iam_platform_admins
            WHERE user_id = p_user_id AND status = 'active'
        );
    END IF;

    -- Avalia capacidades específicas
    RETURN EXISTS (
        SELECT 1 FROM public.nexus_iam_platform_admins pa
        WHERE pa.user_id = p_user_id AND pa.status = 'active'
          AND (
            (p_required_capability = 'manage_workspaces' AND pa.can_manage_workspaces) OR
            (p_required_capability = 'create_workspaces' AND pa.can_create_workspaces) OR
            (p_required_capability = 'manage_local_admins' AND pa.can_manage_local_admins) OR
            (p_required_capability = 'view_all_audit_logs' AND pa.can_view_all_audit_logs) OR
            (p_required_capability = 'manage_global_policies' AND pa.can_manage_global_policies)
          )
    );
END;
$$;

-- Retorna o nível de autoridade numérica do usuário (1 = Owner, 2 = Global Admin, 3 = WS Admin, 4 = Operacional)
CREATE OR REPLACE FUNCTION public.nexus_get_admin_level(
    p_user_id UUID,
    p_workspace_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Nível 1: Proprietário Global
    IF public.nexus_is_platform_owner(p_user_id) THEN
        RETURN 1;
    END IF;

    -- Nível 2: Administrador Global
    IF public.nexus_is_platform_admin(p_user_id) THEN
        RETURN 2;
    END IF;

    -- Nível 3: Administrador de Workspace
    IF p_workspace_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.nexus_iam_workspace_admin_assignments
            WHERE user_id = p_user_id AND workspace_id = p_workspace_id AND status = 'active'
        ) THEN
            RETURN 3;
        END IF;
    END IF;

    -- Nível 4: Operacional
    RETURN 4;
END;
$$;

-- Motor Geral de Permissões: nexus_has_permission() com hierarquia de 4 níveis
CREATE OR REPLACE FUNCTION public.nexus_has_permission(
    p_user_id UUID,
    p_permission_code TEXT,
    p_scope_type TEXT DEFAULT 'workspace',
    p_scope_id TEXT DEFAULT '*'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_explicit_deny BOOLEAN;
    v_has_direct_grant BOOLEAN;
    v_has_role_permission BOOLEAN;
    v_user_level INTEGER;
BEGIN
    -- REGRA SUPREMA: NÍVEL 1 (Proprietário Global) tem autoridade absoluta em tudo
    IF public.nexus_is_platform_owner(p_user_id) THEN
        RETURN TRUE;
    END IF;

    -- NÍVEL 2 (Administrador Global): verifica permissão explícita ou delegação
    IF public.nexus_is_platform_admin(p_user_id) THEN
        -- Se for ação de administração e tiver a capacidade
        IF p_permission_code LIKE 'workspace.manage%' AND public.nexus_is_platform_admin(p_user_id, 'manage_workspaces') THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- 1. Explicit Deny sempre vence para Níveis 2, 3 e 4
    SELECT EXISTS (
        SELECT 1 FROM public.nexus_iam_access_grants ag
        JOIN public.nexus_iam_permissions p ON p.id = ag.permission_id
        WHERE ag.beneficiary_id = p_user_id
          AND ag.status = 'active'
          AND ag.effect = 'deny'
          AND p.code = p_permission_code
          AND (ag.expires_at IS NULL OR ag.expires_at > now())
          AND (ag.scope_id = '*' OR ag.scope_id = p_scope_id)
    ) INTO v_has_explicit_deny;

    IF v_has_explicit_deny THEN
        RETURN FALSE;
    END IF;

    -- 2. Concessão Direta
    SELECT EXISTS (
        SELECT 1 FROM public.nexus_iam_access_grants ag
        JOIN public.nexus_iam_permissions p ON p.id = ag.permission_id
        WHERE ag.beneficiary_id = p_user_id
          AND ag.status = 'active'
          AND ag.effect = 'allow'
          AND p.code = p_permission_code
          AND (ag.expires_at IS NULL OR ag.expires_at > now())
          AND (ag.scope_id = '*' OR ag.scope_id = p_scope_id)
    ) INTO v_has_direct_grant;

    IF v_has_direct_grant THEN
        RETURN TRUE;
    END IF;

    -- 3. Atribuição de Papéis
    SELECT EXISTS (
        SELECT 1 FROM public.nexus_iam_user_role_assignments ura
        JOIN public.nexus_iam_role_permissions rp ON rp.role_id = ura.role_id
        JOIN public.nexus_iam_permissions p ON p.id = rp.permission_id
        WHERE ura.user_id = p_user_id
          AND ura.status = 'active'
          AND p.code = p_permission_code
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
          AND (ura.scope_id = '*' OR ura.scope_id = p_scope_id)
    ) INTO v_has_role_permission;

    IF v_has_role_permission THEN
        RETURN TRUE;
    END IF;

    -- 4. Grupos de Usuários
    SELECT EXISTS (
        SELECT 1 FROM public.nexus_iam_group_members gm
        JOIN public.nexus_iam_group_role_assignments gra ON gra.group_id = gm.group_id
        JOIN public.nexus_iam_role_permissions rp ON rp.role_id = gra.role_id
        JOIN public.nexus_iam_permissions p ON p.id = rp.permission_id
        WHERE gm.user_id = p_user_id
          AND gra.status = 'active'
          AND p.code = p_permission_code
          AND (gra.expires_at IS NULL OR gra.expires_at > now())
          AND (gra.scope_id = '*' OR gra.scope_id = p_scope_id)
    ) INTO v_has_role_permission;

    RETURN v_has_role_permission;
END;
$$;

-- ==============================================================================
-- 11. SEED DE PERMISSÕES PADRÃO
-- ==============================================================================

INSERT INTO public.nexus_iam_permissions (code, category, name, description, allowed_scopes) VALUES
('map.view', 'Mapas', 'Visualizar Mapa', 'Permite visualizar layout e posições do mapa', ARRAY['workspace', 'module', 'map']),
('map.create', 'Mapas', 'Criar Mapa', 'Permite criar novos mapas', ARRAY['workspace', 'module']),
('map.edit', 'Mapas', 'Editar Mapa', 'Permite modificar configurações e layout do mapa', ARRAY['workspace', 'module', 'map']),
('map.delete', 'Mapas', 'Excluir Mapa', 'Permite remover mapas definitivamente', ARRAY['workspace', 'module', 'map']),
('map.duplicate', 'Mapas', 'Duplicar Mapa', 'Permite clonar mapas existentes', ARRAY['workspace', 'module', 'map']),
('map.export', 'Mapas', 'Exportar Mapa', 'Permite exportar mapas em PDF, imagem ou JSON', ARRAY['workspace', 'module', 'map']),
('map.share', 'Mapas', 'Compartilhar Mapa', 'Permite compartilhar mapa com usuários ou grupos', ARRAY['workspace', 'module', 'map']),
('map.manage_access', 'Mapas', 'Gerenciar Acesso do Mapa', 'Permite configurar permissões de participantes no mapa', ARRAY['workspace', 'module', 'map']),
('map.publish', 'Mapas', 'Publicar Mapa', 'Permite publicar versão operacional do mapa', ARRAY['workspace', 'module', 'map']),
('map.archive', 'Mapas', 'Arquivar Mapa', 'Permite arquivar mapa inativo', ARRAY['workspace', 'module', 'map']),
('object.view', 'Objetos', 'Visualizar Objetos', 'Permite visualizar posições e estruturas', ARRAY['workspace', 'map', 'object']),
('object.create', 'Objetos', 'Criar Objeto', 'Permite desenhar novas posições, drives e racks', ARRAY['workspace', 'map']),
('object.edit', 'Objetos', 'Editar Objeto', 'Permite alterar dimensões e dados do objeto', ARRAY['workspace', 'map', 'object']),
('object.delete', 'Objetos', 'Excluir Objeto', 'Permite apagar objetos do mapa', ARRAY['workspace', 'map', 'object']),
('object.move', 'Objetos', 'Mover Objeto', 'Permite reposicionar objetos no grid', ARRAY['workspace', 'map', 'object']),
('object.configure', 'Objetos', 'Configurar Objeto', 'Permite definir capacidades, níveis e vínculos de saldo', ARRAY['workspace', 'map', 'object']),
('structure.view', 'Estrutura', 'Visualizar Estrutura', 'Visualiza paredes, pilares e zonas', ARRAY['workspace', 'map']),
('structure.manage', 'Estrutura', 'Gerenciar Estrutura', 'Modifica paredes, pilares, portas e áreas físicas', ARRAY['workspace', 'map']),
('history.view', 'Histórico', 'Visualizar Histórico', 'Permite auditar histórico de alterações do mapa', ARRAY['workspace', 'map']),
('history.restore', 'Histórico', 'Restaurar Versão', 'Permite restaurar versões anteriores do mapa', ARRAY['workspace', 'map']),
('workspace.manage_members', 'Administração', 'Gerenciar Membros', 'Convida, suspende e remove usuários do workspace', ARRAY['workspace']),
('workspace.manage_roles', 'Administração', 'Gerenciar Papéis', 'Cria e edita papéis e permissões no workspace', ARRAY['workspace']),
('workspace.manage_settings', 'Administração', 'Configurações do Workspace', 'Modifica configurações gerais do workspace', ARRAY['workspace']),
('workspace.manage_security', 'Administração', 'Segurança e Auditoria', 'Visualiza logs de auditoria e eventos de segurança', ARRAY['workspace']),
('module.manage_access', 'Administração', 'Gerenciar Acesso a Módulos', 'Concede e revoga acesso a módulos específicos', ARRAY['workspace', 'module']),
('environment.manage_access', 'Administração', 'Gerenciar Acesso a Ambientes', 'Controla acesso a ambientes como Produção e Laboratório', ARRAY['workspace', 'environment'])
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    allowed_scopes = EXCLUDED.allowed_scopes;

-- ==============================================================================
-- 12. SEED DE PAPÉIS DO SISTEMA
-- ==============================================================================

INSERT INTO public.nexus_iam_roles (workspace_id, code, name, description, is_system_role, is_active) VALUES
(NULL, 'owner', 'Proprietário', 'Controle irrestrito sobre a organização, workspaces e segurança', true, true),
(NULL, 'admin', 'Administrador', 'Administração operacional, membros, papéis e recursos', true, true),
(NULL, 'gestor', 'Gestor', 'Gestão tática de módulos, ambientes e mapas', true, true),
(NULL, 'map_admin', 'Administrador de Mapa', 'Gestão completa de mapas e participantes específicos', true, true),
(NULL, 'editor', 'Editor', 'Edição de layouts, objetos e configurações de mapas atribuídos', true, true),
(NULL, 'collaborator', 'Colaborador', 'Criação e movimentação com restrições de exclusão', true, true),
(NULL, 'viewer', 'Visualizador', 'Apenas leitura e visualização de mapas e objetos', true, true)
ON CONFLICT (workspace_id, code) DO NOTHING;

-- Associação automática de todas as permissões para o papel 'owner' e 'admin'
DO $$
DECLARE
    r_owner UUID;
    r_admin UUID;
    r_viewer UUID;
    r_editor UUID;
    perm RECORD;
BEGIN
    SELECT id INTO r_owner FROM public.nexus_iam_roles WHERE code = 'owner' AND workspace_id IS NULL;
    SELECT id INTO r_admin FROM public.nexus_iam_roles WHERE code = 'admin' AND workspace_id IS NULL;
    SELECT id INTO r_viewer FROM public.nexus_iam_roles WHERE code = 'viewer' AND workspace_id IS NULL;
    SELECT id INTO r_editor FROM public.nexus_iam_roles WHERE code = 'editor' AND workspace_id IS NULL;

    FOR perm IN SELECT id, code FROM public.nexus_iam_permissions LOOP
        INSERT INTO public.nexus_iam_role_permissions (role_id, permission_id) 
        VALUES (r_owner, perm.id) ON CONFLICT DO NOTHING;

        INSERT INTO public.nexus_iam_role_permissions (role_id, permission_id) 
        VALUES (r_admin, perm.id) ON CONFLICT DO NOTHING;

        IF perm.code IN ('map.view', 'object.view', 'structure.view', 'history.view') THEN
            INSERT INTO public.nexus_iam_role_permissions (role_id, permission_id) 
            VALUES (r_viewer, perm.id) ON CONFLICT DO NOTHING;
        END IF;

        IF perm.code IN ('map.view', 'map.edit', 'map.duplicate', 'map.export', 'object.view', 'object.create', 'object.edit', 'object.move', 'object.configure', 'structure.view', 'history.view') THEN
            INSERT INTO public.nexus_iam_role_permissions (role_id, permission_id) 
            VALUES (r_editor, perm.id) ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END $$;

-- ==============================================================================
-- 13. RLS SEGURO (SEM RECURSÃO E IDEMPOTENTE)
-- ==============================================================================

ALTER TABLE public.nexus_iam_platform_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexus_iam_platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexus_iam_workspace_admin_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexus_iam_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexus_iam_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexus_iam_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexus_iam_user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexus_iam_map_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexus_iam_map_access_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexus_iam_audit_logs ENABLE ROW LEVEL SECURITY;

-- Limpeza prévia para garantir re-execução sem erro
DROP POLICY IF EXISTS "Platform Owner visível para autenticados" ON public.nexus_iam_platform_owners;
DROP POLICY IF EXISTS "Permissões visíveis para autenticados" ON public.nexus_iam_permissions;
DROP POLICY IF EXISTS "Papéis visíveis para autenticados" ON public.nexus_iam_roles;
DROP POLICY IF EXISTS "Role permissions visíveis para autenticados" ON public.nexus_iam_role_permissions;
DROP POLICY IF EXISTS "Usuário vê suas próprias atribuições" ON public.nexus_iam_user_role_assignments;
DROP POLICY IF EXISTS "Participantes de mapas visíveis" ON public.nexus_iam_map_participants;
DROP POLICY IF EXISTS "Inserção de auditoria permitida" ON public.nexus_iam_audit_logs;

-- Proprietários: Visível para autenticados para checagem institucional
CREATE POLICY "Platform Owner visível para autenticados" ON public.nexus_iam_platform_owners
    FOR SELECT TO authenticated USING (true);

-- Catálogo: Leitura pública para autenticados
CREATE POLICY "Permissões visíveis para autenticados" ON public.nexus_iam_permissions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Papéis visíveis para autenticados" ON public.nexus_iam_roles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Role permissions visíveis para autenticados" ON public.nexus_iam_role_permissions
    FOR SELECT TO authenticated USING (true);

-- Atribuições: Usuário vê as suas próprias
CREATE POLICY "Usuário vê suas próprias atribuições" ON public.nexus_iam_user_role_assignments
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.nexus_is_platform_owner(auth.uid()));

-- Participantes de mapas: Usuário vê onde é participante
CREATE POLICY "Participantes de mapas visíveis" ON public.nexus_iam_map_participants
    FOR SELECT TO authenticated USING (participant_id = auth.uid() OR public.nexus_has_permission(auth.uid(), 'map.view', 'map', map_id));

-- Inserção de auditoria
CREATE POLICY "Inserção de auditoria permitida" ON public.nexus_iam_audit_logs
    FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
