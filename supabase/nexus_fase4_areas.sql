-- ============================================================
-- NEXUS ERP — nexus_fase4_areas.sql
-- Persistência de Áreas, Pisos e Regiões do Mapeamento Universal
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- ── Tabela de Áreas / Pisos / Regiões Delimitadas ────────────
CREATE TABLE IF NOT EXISTS public.map_areas (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  environment_id        uuid,                       -- FK para environments (opcional)
  parent_id             uuid REFERENCES public.map_areas(id) ON DELETE SET NULL,

  -- Identidade
  name                  text NOT NULL DEFAULT '',
  identifier            text,                       -- Código livre da organização (ex: AREA-001)
  area_type             text NOT NULL DEFAULT 'custom_area',  -- 'floor' | 'custom_area' | ...
  classification        text,                       -- Livre: 'area_avarias', 'circulacao', etc.
  description           text,

  -- Geometria vetorial
  polygon_points        jsonb,                      -- [x1,y1,x2,y2,...] relativo à bounding box
  canvas_x              numeric NOT NULL DEFAULT 0,
  canvas_y              numeric NOT NULL DEFAULT 0,
  canvas_w              numeric NOT NULL DEFAULT 100,
  canvas_h              numeric NOT NULL DEFAULT 100,
  rotation              numeric NOT NULL DEFAULT 0,

  -- Escala e dimensões reais
  real_area_m2          numeric,                    -- Calculado pelo Shoelace
  real_width_m          numeric,                    -- Para pisos: dimensão real
  real_height_m         numeric,
  pixels_per_meter      numeric DEFAULT 20,

  -- Aparência
  color                 text,
  stroke_color          text,
  opacity               numeric DEFAULT 1 CHECK (opacity >= 0 AND opacity <= 1),

  -- Dados Operacionais
  responsible           text,
  operational_situation text DEFAULT 'ativa'
                          CHECK (operational_situation IN ('ativa','interditada','manutencao','inventario')),
  restrictions          text,

  -- Campos personalizados livres
  custom_props          jsonb DEFAULT '{}'::jsonb,

  -- Metadados
  locked                boolean NOT NULL DEFAULT false,
  visible               boolean NOT NULL DEFAULT true,
  layer_id              text DEFAULT 'areas',

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS map_areas_workspace_id_idx   ON public.map_areas(workspace_id);
CREATE INDEX IF NOT EXISTS map_areas_parent_id_idx      ON public.map_areas(parent_id);
CREATE INDEX IF NOT EXISTS map_areas_classification_idx ON public.map_areas(classification);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_map_areas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_map_areas_updated_at ON public.map_areas;
CREATE TRIGGER trg_map_areas_updated_at
  BEFORE UPDATE ON public.map_areas
  FOR EACH ROW EXECUTE FUNCTION public.set_map_areas_updated_at();

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.map_areas ENABLE ROW LEVEL SECURITY;

-- Membros do workspace podem ver áreas
CREATE POLICY "Workspace members can view areas"
  ON public.map_areas FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Membros podem criar áreas no seu workspace
CREATE POLICY "Workspace members can insert areas"
  ON public.map_areas FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Membros podem atualizar áreas do seu workspace
CREATE POLICY "Workspace members can update areas"
  ON public.map_areas FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Apenas admins podem excluir áreas
CREATE POLICY "Admins can delete areas"
  ON public.map_areas FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── Função: Árvore Recursiva de Áreas ────────────────────────
-- Retorna a hierarquia completa de uma área raiz
CREATE OR REPLACE FUNCTION public.get_area_tree(p_workspace_id uuid, p_root_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  parent_id uuid,
  name text,
  identifier text,
  area_type text,
  classification text,
  canvas_x numeric,
  canvas_y numeric,
  canvas_w numeric,
  canvas_h numeric,
  real_area_m2 numeric,
  operational_situation text,
  depth integer
) AS $$
WITH RECURSIVE area_tree AS (
  -- Raízes (sem pai, ou filho do p_root_id informado)
  SELECT
    a.id, a.parent_id, a.name, a.identifier, a.area_type, a.classification,
    a.canvas_x, a.canvas_y, a.canvas_w, a.canvas_h, a.real_area_m2,
    a.operational_situation,
    0 AS depth
  FROM public.map_areas a
  WHERE a.workspace_id = p_workspace_id
    AND (
      (p_root_id IS NULL AND a.parent_id IS NULL)
      OR (p_root_id IS NOT NULL AND a.parent_id = p_root_id)
    )

  UNION ALL

  SELECT
    child.id, child.parent_id, child.name, child.identifier, child.area_type,
    child.classification, child.canvas_x, child.canvas_y, child.canvas_w,
    child.canvas_h, child.real_area_m2, child.operational_situation,
    parent.depth + 1
  FROM public.map_areas child
  INNER JOIN area_tree parent ON child.parent_id = parent.id
  WHERE child.workspace_id = p_workspace_id
)
SELECT * FROM area_tree ORDER BY depth, name;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Dados de Exemplo: Piso G300 ───────────────────────────────
-- (Apenas insere se não houver dados — para demonstração)
-- Descomente se quiser popular um workspace de teste:

/*
INSERT INTO public.map_areas (
  workspace_id, name, identifier, area_type, classification,
  canvas_x, canvas_y, canvas_w, canvas_h,
  real_width_m, real_height_m, pixels_per_meter,
  color, stroke_color,
  operational_situation
) VALUES
(
  '<SEU_WORKSPACE_ID>',
  'Galpão G300', 'GAL-G300', 'floor', 'piso_geral',
  40, 30, 920, 640,
  46, 32, 20,
  'rgba(30,41,59,0.3)', '#334155',
  'ativa'
);
*/
