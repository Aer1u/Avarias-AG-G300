-- ============================================================
-- NEXUS ERP — nexus_fase6_escala_e_dimensoes.sql
-- Sistema Universal de Dimensões Físicas, Escala Real e Modelos
-- Permite dimensões padrão por modelo e medidas independentes por instância.
-- Compatível com representação 2D e expansão futura para 3D (X, Y, Z, Z0).
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Tabela de Dimensões Padrão dos Modelos (Templates de Objetos) ──
CREATE TABLE IF NOT EXISTS public.model_dimension_defaults (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  model_type            text NOT NULL,               -- ex: 'drive_in', 'pallet_jack', 'forklift', 'wall'
  
  -- Dimensões físicas padrão recomendadas
  default_width         numeric NOT NULL DEFAULT 1.0,  -- Largura (X)
  default_length        numeric NOT NULL DEFAULT 1.0,  -- Comprimento / Profundidade no plano (Y)
  default_height        numeric NOT NULL DEFAULT 2.0,  -- Altura vertical (Z)
  default_elevation_z   numeric NOT NULL DEFAULT 0.0,  -- Elevação do chão (Z0)
  
  unit                  text NOT NULL DEFAULT 'm'
                          CHECK (unit IN ('m', 'cm', 'mm')),
  lock_aspect_ratio     boolean NOT NULL DEFAULT false,
  
  -- Restrições físicas
  min_width             numeric,
  max_width             numeric,
  min_length            numeric,
  max_length            numeric,
  min_height            numeric,
  max_height            numeric,
  
  updated_by            uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (workspace_id, model_type)
);

-- ── 2. Extensão da Tabela de Instâncias de Objetos (locations) ─
-- Adiciona colunas para garantir que cada instância mantenha suas
-- próprias dimensões físicas independentes do modelo original e dos demais objetos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'real_width') THEN
    ALTER TABLE public.locations
      ADD COLUMN real_width numeric,
      ADD COLUMN real_length numeric,
      ADD COLUMN real_height numeric,
      ADD COLUMN elevation_z numeric DEFAULT 0.0,
      ADD COLUMN dimension_unit text DEFAULT 'm' CHECK (dimension_unit IN ('m', 'cm', 'mm')),
      ADD COLUMN lock_aspect_ratio boolean DEFAULT false;
  END IF;
END $$;

-- ── 3. Índices ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS model_dim_defaults_workspace_idx ON public.model_dimension_defaults(workspace_id);
CREATE INDEX IF NOT EXISTS model_dim_defaults_model_idx     ON public.model_dimension_defaults(model_type);

-- ── 4. Trigger de Atualização ────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_model_dim_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_model_dim_updated_at ON public.model_dimension_defaults;
CREATE TRIGGER trg_model_dim_updated_at
  BEFORE UPDATE ON public.model_dimension_defaults
  FOR EACH ROW EXECUTE FUNCTION public.set_model_dim_updated_at();

-- ── 5. Row Level Security ────────────────────────────────────
ALTER TABLE public.model_dimension_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view model defaults"
  ON public.model_dimension_defaults FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members manage model defaults"
  ON public.model_dimension_defaults FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );
