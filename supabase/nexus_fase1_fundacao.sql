-- ============================================================
-- NEXUS ERP — FASE 1: FUNDAÇÃO
-- Multi-tenant: profiles, workspaces, workspace_members
-- + RLS + triggers de automação
-- Rodar no Supabase SQL Editor
-- ============================================================

-- ----------------------------------------------------------------
-- 1. PROFILES
-- Extensão da tabela auth.users do Supabase.
-- Um profile é criado automaticamente ao registrar um usuário.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Perfis dos usuários, extensão de auth.users';

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: cria profile automaticamente ao criar usuário no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------
-- 2. WORKSPACES (Organizações)
-- Cada workspace é uma organização/tenant isolado.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,         -- identificador URL-friendly
  logo_url    TEXT,
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  settings    JSONB NOT NULL DEFAULT '{}',  -- configurações globais do workspace
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workspaces IS 'Organizações/tenants do sistema';
COMMENT ON COLUMN public.workspaces.slug IS 'Identificador único URL-friendly, ex: minha-empresa';
COMMENT ON COLUMN public.workspaces.settings IS 'Configurações globais do workspace (JSONB extensível)';

CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 3. WORKSPACE_MEMBERS
-- Relacionamento entre usuários e workspaces.
-- Um usuário pode pertencer a múltiplos workspaces com papéis diferentes.
-- ----------------------------------------------------------------
CREATE TYPE public.workspace_role AS ENUM (
  'owner',    -- dono total do workspace
  'admin',    -- administrador com controle amplo
  'member',   -- membro padrão
  'viewer'    -- somente leitura
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          public.workspace_role NOT NULL DEFAULT 'member',
  invited_by    UUID REFERENCES public.profiles(id),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, profile_id)        -- um usuário: um papel por workspace
);

COMMENT ON TABLE public.workspace_members IS 'Membros de cada workspace com seus papéis';

-- ----------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS)
-- Isolamento completo entre organizações.
-- ----------------------------------------------------------------

-- profiles: cada usuário vê e edita apenas o próprio perfil
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: leitura própria"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: edição própria"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- workspaces: membros veem workspaces dos quais participam
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspaces: visível para membros"
  ON public.workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = id
        AND wm.profile_id = auth.uid()
    )
  );

CREATE POLICY "workspaces: criação autenticada"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "workspaces: edição pelo owner ou admin"
  ON public.workspaces FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = id
        AND wm.profile_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- workspace_members: membros veem outros membros do mesmo workspace
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members: visível para membros do workspace"
  ON public.workspace_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_id
        AND wm.profile_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members: inserção pelo owner ou admin"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_id
        AND wm.profile_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "workspace_members: remoção pelo owner ou admin"
  ON public.workspace_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_id
        AND wm.profile_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
    OR profile_id = auth.uid()   -- usuário pode sair do próprio workspace
  );

-- ----------------------------------------------------------------
-- 5. FUNÇÃO HELPER: get_my_workspaces()
-- Retorna os workspaces do usuário autenticado com seu papel.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_workspaces()
RETURNS TABLE (
  workspace_id  UUID,
  name          TEXT,
  slug          TEXT,
  logo_url      TEXT,
  role          public.workspace_role,
  joined_at     TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    w.id,
    w.name,
    w.slug,
    w.logo_url,
    wm.role,
    wm.joined_at
  FROM public.workspaces w
  JOIN public.workspace_members wm ON wm.workspace_id = w.id
  WHERE wm.profile_id = auth.uid()
  ORDER BY wm.joined_at;
$$;

-- ----------------------------------------------------------------
-- 6. FUNÇÃO: criar workspace + adicionar owner como membro
-- Atomicamente cria workspace e garante que owner é membro.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_workspace(
  p_name  TEXT,
  p_slug  TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES (p_name, p_slug, auth.uid())
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, profile_id, role)
  VALUES (v_workspace_id, auth.uid(), 'owner');

  RETURN v_workspace_id;
END;
$$;

-- ================================================================
-- FIM DA FASE 1 — FUNDAÇÃO
-- Próxima fase: modules + entities (Fase 1b) ou Editor 2D (Fase 2)
-- ================================================================
