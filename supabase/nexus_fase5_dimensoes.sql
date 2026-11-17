-- ============================================================
-- NEXUS ERP — nexus_fase5_dimensoes.sql
-- Nomenclatura e Identificação Universal de Dimensões
-- Permite que cada organização configure livremente sequências,
-- nomes e identificadores para Níveis, Profundidades, Posições e Lados.
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Tabela de Configuração de Dimensões ───────────────────
CREATE TABLE IF NOT EXISTS public.dimension_configs (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Escopo (Livre por galpão, ambiente ou tipo de estrutura)
  warehouse_id          text,                        -- ex: "G300" ou ID do galpão
  environment_id        uuid,                        -- FK opcional
  structure_type        text,                        -- ex: "drive_in", "pallet_rack", "cantilever"
  
  -- Identidade da Dimensão
  category              text NOT NULL,               -- 'level' | 'depth' | 'position' | 'side' | 'custom'
  name                  text NOT NULL,               -- ex: "Profundidades do Drive"
  display_name          text NOT NULL,               -- ex: "Profundidade", "Túnel"
  description           text,
  
  -- Regras de Sequência e Orientação
  sequence_type         text NOT NULL DEFAULT 'numeric'
                          CHECK (sequence_type IN ('numeric', 'numeric_pad', 'alphabetic', 'alphanumeric', 'custom_list')),
  orientation           text NOT NULL DEFAULT 'front_to_back'
                          CHECK (orientation IN ('bottom_to_top', 'top_to_bottom', 'front_to_back', 'back_to_front', 'left_to_right', 'right_to_left')),
  prefix                text DEFAULT '',
  suffix                text DEFAULT '',
  padding_digits        integer DEFAULT 1,
  custom_values         jsonb DEFAULT '[]'::jsonb,   -- Array de strings para sequence_type = 'custom_list'
  
  default_count         integer NOT NULL DEFAULT 4,
  
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Itens Resolvidos da Dimensão (Ordem Física x Identificação) ──
CREATE TABLE IF NOT EXISTS public.dimension_items (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dimension_config_id   uuid NOT NULL REFERENCES public.dimension_configs(id) ON DELETE CASCADE,
  
  -- Separação estrita entre Ordem Física e Identificador Externo
  physical_index        integer NOT NULL,            -- 0, 1, 2, 3...
  identifier            text NOT NULL,               -- "1", "A", "01", "G", "N1"
  display_name          text NOT NULL,               -- "Nível 1 (Chão)", "Profundidade C"
  search_aliases        text[] DEFAULT '{}',         -- Aliases para o Spotlight
  is_active             boolean NOT NULL DEFAULT true,
  
  created_at            timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (dimension_config_id, physical_index),
  UNIQUE (dimension_config_id, identifier)
);

-- ── 3. Posições Físicas Tridimensionais ──────────────────────
CREATE TABLE IF NOT EXISTS public.structure_positions (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  location_id           uuid,                        -- ID do Drive ou Estrutura
  
  -- Índices físicos
  level_index           integer NOT NULL,
  depth_index           integer NOT NULL,
  lane_index            integer DEFAULT 0,
  
  -- Nomenclaturas resolvidas conforme a configuração da organização
  level_identifier      text NOT NULL,               -- "1", "A", "Térreo"
  depth_identifier      text NOT NULL,               -- "1", "A", "Fundo"
  position_code         text NOT NULL,               -- "G300004G0281-N2-P3"
  
  -- Situação operacional
  status                text NOT NULL DEFAULT 'livre'
                          CHECK (status IN ('livre', 'ocupado', 'avaria', 'bloqueado')),
  pallet_barcode        text,
  product_sku           text,
  
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS dimension_configs_workspace_idx ON public.dimension_configs(workspace_id);
CREATE INDEX IF NOT EXISTS dimension_items_config_idx      ON public.dimension_items(dimension_config_id);
CREATE INDEX IF NOT EXISTS structure_positions_code_idx    ON public.structure_positions(workspace_id, position_code);

-- ── 4. Row Level Security ────────────────────────────────────
ALTER TABLE public.dimension_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dimension_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view dimension configs"
  ON public.dimension_configs FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Members manage dimension configs"
  ON public.dimension_configs FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Members view dimension items"
  ON public.dimension_items FOR SELECT
  USING (dimension_config_id IN (SELECT id FROM public.dimension_configs WHERE workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())));

CREATE POLICY "Members manage dimension items"
  ON public.dimension_items FOR ALL
  USING (dimension_config_id IN (SELECT id FROM public.dimension_configs WHERE workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())));

CREATE POLICY "Members view structure positions"
  ON public.structure_positions FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Members manage structure positions"
  ON public.structure_positions FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
