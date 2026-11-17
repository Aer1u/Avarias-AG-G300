-- ============================================================
-- NEXUS ERP — FASE 3: CONSTRUTOR DE MÓDULOS, ENTIDADES & ENDEREÇAMENTO
-- Multi-tenant: modules, entities, custom_fields, entity_records,
-- addressing_rules, location_bindings
-- + RLS por workspace
-- ============================================================

-- ----------------------------------------------------------------
-- 1. ADDRESSING_RULES (Regras de Endereçamento Universal)
-- Permite que a organização configure como os códigos são formados.
-- Ex: G300004G0281 -> { prefix: 'G300', block_digits: 3, side: 'G', seq_digits: 4 }
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.addressing_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  environment_id  UUID REFERENCES public.environments(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,              -- ex: "Padrão Drives Avarias G300"
  description     TEXT,
  pattern_format  TEXT NOT NULL,              -- ex: "{prefix}{aisle:3}{side}{seq:4}"
  separator       TEXT DEFAULT '',            -- delimitador (ex: '-' ou vazio)
  parity_rule     TEXT DEFAULT 'none',        -- 'even_odd', 'continuous', 'none'
  even_side_label TEXT DEFAULT 'PAR',
  odd_side_label  TEXT DEFAULT 'ÍMPAR',
  config          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.addressing_rules IS 'Padrões e regras de composição de endereços configuráveis por workspace';

CREATE TRIGGER addressing_rules_updated_at
  BEFORE UPDATE ON public.addressing_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 2. MODULES (Módulos de Negócio Customizáveis)
-- Ex: "Controle de Avarias", "Manutenção de Empilhadeiras", "Estoque Físico"
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.modules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,                -- ex: "avarias", "manutencao"
  name          TEXT NOT NULL,                -- ex: "Controle de Avarias"
  description   TEXT,
  icon          TEXT DEFAULT 'box',
  color         TEXT DEFAULT '#f59e0b',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, slug)
);

COMMENT ON TABLE public.modules IS 'Módulos de negócio da organização';

CREATE TRIGGER modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 3. ENTITIES (Cadastros Dinâmicos dentro dos Módulos)
-- Ex: "Ocorrências de Avaria", "Laudos Técnicos", "Pallets Conferidos"
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  module_id     UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,                -- ex: "ocorrencias", "pallets_avaria"
  name          TEXT NOT NULL,                -- ex: "Ocorrência de Avaria"
  plural_name   TEXT NOT NULL,                -- ex: "Ocorrências de Avaria"
  description   TEXT,
  is_linkable_to_map BOOLEAN NOT NULL DEFAULT true, -- se pode ser vinculado a locais do mapa
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, slug)
);

COMMENT ON TABLE public.entities IS 'Tabelas dinâmicas/cadastros definidos pelo usuário';

CREATE TRIGGER entities_updated_at
  BEFORE UPDATE ON public.entities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 4. CUSTOM_FIELDS (Campos Personalizados do Cadastro)
-- Define a tipagem, ordem e obrigatoriedade de cada atributo
-- ----------------------------------------------------------------
CREATE TYPE public.field_data_type AS ENUM (
  'text',
  'number',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi_select',
  'location_ref',    -- referência a um elemento do Mapeamento Universal
  'entity_ref',      -- relacionamento com outro cadastro
  'file',
  'image'
);

CREATE TABLE IF NOT EXISTS public.custom_fields (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_id       UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,              -- identificador do campo (ex: 'tipo_avaria')
  label           TEXT NOT NULL,              -- rótulo exibido na UI (ex: 'Tipo de Avaria')
  data_type       public.field_data_type NOT NULL DEFAULT 'text',
  is_required     BOOLEAN NOT NULL DEFAULT false,
  is_unique       BOOLEAN NOT NULL DEFAULT false,
  default_value   TEXT,
  options         JSONB DEFAULT '[]',         -- opções para select/multi_select
  ref_entity_id   UUID REFERENCES public.entities(id) ON DELETE SET NULL, -- se for entity_ref
  display_order   INT NOT NULL DEFAULT 0,
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_id, key)
);

COMMENT ON TABLE public.custom_fields IS 'Definições de campos de um cadastro dinâmico';

-- ----------------------------------------------------------------
-- 5. ENTITY_RECORDS (Dados Reais dos Registros Customizados)
-- Guarda os dados das instâncias em JSONB tipado e validado
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entity_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_id       UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  location_id     UUID REFERENCES public.locations(id) ON DELETE SET NULL, -- Vínculo opcional ao Drive/Local do Mapa!
  title           TEXT,                       -- resumo legível do registro
  data            JSONB NOT NULL DEFAULT '{}',-- valores dos campos customizados
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.entity_records IS 'Registros das entidades personalizadas com vínculo geográfico/operacional';
CREATE INDEX IF NOT EXISTS idx_records_location ON public.entity_records(location_id);
CREATE INDEX IF NOT EXISTS idx_records_entity   ON public.entity_records(entity_id);

CREATE TRIGGER entity_records_updated_at
  BEFORE UPDATE ON public.entity_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ----------------------------------------------------------------
ALTER TABLE public.addressing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addressing_rules: membros do workspace"
  ON public.addressing_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_id
        AND wm.profile_id = auth.uid()
    )
  );

CREATE POLICY "modules: membros do workspace"
  ON public.modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_id
        AND wm.profile_id = auth.uid()
    )
  );

CREATE POLICY "entities: membros do workspace"
  ON public.entities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_id
        AND wm.profile_id = auth.uid()
    )
  );

CREATE POLICY "custom_fields: membros do workspace"
  ON public.custom_fields FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_id
        AND wm.profile_id = auth.uid()
    )
  );

CREATE POLICY "entity_records: membros do workspace"
  ON public.entity_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_id
        AND wm.profile_id = auth.uid()
    )
  );
