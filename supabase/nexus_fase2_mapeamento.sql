-- ============================================================
-- NEXUS ERP — FASE 2: MAPEAMENTO (Banco)
-- environments, location_types, locations
-- + RLS por workspace
-- Rodar no Supabase SQL Editor APÓS a Fase 1
-- ============================================================

-- ----------------------------------------------------------------
-- 1. ENVIRONMENTS (Ambientes)
-- Um workspace pode ter múltiplos ambientes (armazéns, lojas, etc).
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.environments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  settings      JSONB NOT NULL DEFAULT '{}',  -- configs visuais, escala, etc
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.environments IS 'Ambientes físicos de um workspace (armazéns, plantas, pavimentos)';
COMMENT ON COLUMN public.environments.settings IS 'Configurações do ambiente: escala, unidade, dimensões, etc';

CREATE TRIGGER environments_updated_at
  BEFORE UPDATE ON public.environments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 2. LOCATION_TYPES (Tipos de Localização)
-- Define a nomenclatura e comportamento de cada nível hierárquico.
-- Cada workspace configura seus próprios tipos.
-- Ex: Rua → Módulo → Nível → Posição
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.location_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,          -- ex: "Rua", "Prateleira", "Posição"
  level         INT NOT NULL,           -- profundidade hierárquica (0 = raiz)
  icon          TEXT,                   -- nome de ícone ou emoji
  color         TEXT,                   -- cor para representação visual
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, level)           -- um tipo por nível por workspace
);

COMMENT ON TABLE public.location_types IS 'Tipos de localização configuráveis por workspace (hierarquia)';
COMMENT ON COLUMN public.location_types.level IS 'Nível na hierarquia: 0 = raiz, 1 = filho, 2 = neto, etc';

-- ----------------------------------------------------------------
-- 3. LOCATIONS (Localizações)
-- Nós da hierarquia de posições dentro de um ambiente.
-- Auto-referencial: cada localização pode ter um pai.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  environment_id  UUID NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  type_id         UUID REFERENCES public.location_types(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  code            TEXT,                 -- código de identificação (ex: A-01-02)
  description     TEXT,
  -- Dimensões físicas (opcionais)
  width_m         NUMERIC(10,3),
  height_m        NUMERIC(10,3),
  depth_m         NUMERIC(10,3),
  -- Capacidade
  max_weight_kg   NUMERIC(10,3),
  max_volume_m3   NUMERIC(10,3),
  max_items       INT,
  -- Estado
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_blocked      BOOLEAN NOT NULL DEFAULT false,
  block_reason    TEXT,
  -- Posição no canvas 2D (preenchida pelo editor visual)
  canvas_x        NUMERIC(10,2),
  canvas_y        NUMERIC(10,2),
  canvas_w        NUMERIC(10,2),
  canvas_h        NUMERIC(10,2),
  canvas_rotation NUMERIC(6,2) DEFAULT 0,
  -- Metadados extensíveis
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.locations IS 'Localizações hierárquicas dentro dos ambientes';
COMMENT ON COLUMN public.locations.parent_id IS 'Referência ao pai na hierarquia (NULL = raiz do ambiente)';
COMMENT ON COLUMN public.locations.code IS 'Código único de identificação da posição';
COMMENT ON COLUMN public.locations.canvas_x IS 'Coordenada X no editor 2D (pixels ou unidades de escala)';

CREATE TRIGGER locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_locations_workspace    ON public.locations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_locations_environment  ON public.locations(environment_id);
CREATE INDEX IF NOT EXISTS idx_locations_parent       ON public.locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_locations_code         ON public.locations(workspace_id, code);

-- ----------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ----------------------------------------------------------------

-- environments
ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "environments: membros do workspace"
  ON public.environments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_id
        AND wm.profile_id = auth.uid()
    )
  );

-- location_types
ALTER TABLE public.location_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "location_types: membros do workspace"
  ON public.location_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_id
        AND wm.profile_id = auth.uid()
    )
  );

-- locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations: membros do workspace"
  ON public.locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_id
        AND wm.profile_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 5. FUNÇÃO HELPER: get_location_tree(environment_id)
-- Retorna a árvore completa de localizações de um ambiente,
-- com nível de profundidade e caminho (path).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_location_tree(p_environment_id UUID)
RETURNS TABLE (
  id              UUID,
  parent_id       UUID,
  type_id         UUID,
  name            TEXT,
  code            TEXT,
  depth           INT,
  path            TEXT,
  is_active       BOOLEAN,
  is_blocked      BOOLEAN
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH RECURSIVE loc_tree AS (
    -- raízes (sem pai)
    SELECT
      l.id, l.parent_id, l.type_id, l.name, l.code,
      0 AS depth,
      l.name AS path
    FROM public.locations l
    WHERE l.environment_id = p_environment_id
      AND l.parent_id IS NULL

    UNION ALL

    -- filhos recursivos
    SELECT
      l.id, l.parent_id, l.type_id, l.name, l.code,
      lt.depth + 1,
      lt.path || ' › ' || l.name
    FROM public.locations l
    JOIN loc_tree lt ON l.parent_id = lt.id
    WHERE l.environment_id = p_environment_id
  )
  SELECT
    t.id, t.parent_id, t.type_id, t.name, t.code,
    t.depth, t.path,
    l.is_active, l.is_blocked
  FROM loc_tree t
  JOIN public.locations l ON l.id = t.id
  ORDER BY t.path;
$$;

-- ================================================================
-- FIM DA FASE 2 — MAPEAMENTO (Banco)
-- Próximo: Editor 2D com Konva.js consumindo estas tabelas
-- ================================================================
