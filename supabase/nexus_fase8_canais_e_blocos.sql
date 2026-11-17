-- ============================================================
-- NEXUS ERP — FASE 8: CANAIS DE ARMAZENAGEM & BLOCOS ESTRUTURAIS
-- Mapeamento e Hierarquia Estrutural: Galpão -> Bloco -> Rua -> Drive-In -> Canais -> Posições
-- ============================================================

-- 1. Tabela de Canais de Armazenagem (Storage Channels)
-- O canal é o agrupamento físico e lógico das posições-palete de um vão/túnel
CREATE TABLE IF NOT EXISTS public.storage_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  drive_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  lane_index INTEGER NOT NULL DEFAULT 1,
  code TEXT NOT NULL,                     -- Código técnico (ex: G300004G0281-C01)
  name TEXT NOT NULL,                     -- Nome personalizado (ex: Canal MKLOG, Canal Jaqueline)
  levels INTEGER NOT NULL DEFAULT 4,
  depth INTEGER NOT NULL DEFAULT 4,
  capacity INTEGER NOT NULL DEFAULT 16,   -- Calculado: levels * depth
  current_occupancy INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'operacional' CHECK (status IN ('operacional', 'bloqueado', 'manutencao')),
  pallet_model_id TEXT DEFAULT 'pbr1',
  dimensions JSONB DEFAULT '{"widthM": 1.40, "lengthM": 5.48, "heightM": 6.00}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(drive_id, lane_index),
  UNIQUE(workspace_id, code)
);

-- 2. Habilita RLS
ALTER TABLE public.storage_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem visualizar canais de seus workspaces"
  ON public.storage_channels FOR SELECT
  USING (workspace_id IN (SELECT get_my_workspaces()));

CREATE POLICY "Membros podem inserir canais em seus workspaces"
  ON public.storage_channels FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_my_workspaces()));

CREATE POLICY "Membros podem atualizar canais em seus workspaces"
  ON public.storage_channels FOR UPDATE
  USING (workspace_id IN (SELECT get_my_workspaces()));

CREATE POLICY "Membros podem excluir canais em seus workspaces"
  ON public.storage_channels FOR DELETE
  USING (workspace_id IN (SELECT get_my_workspaces()));

-- 3. Índices de Busca e Performance
CREATE INDEX IF NOT EXISTS idx_storage_channels_drive_id ON public.storage_channels(drive_id);
CREATE INDEX IF NOT EXISTS idx_storage_channels_name ON public.storage_channels(workspace_id, name);
CREATE INDEX IF NOT EXISTS idx_storage_channels_code ON public.storage_channels(workspace_id, code);

-- 4. Gatilho de Atualização de Updated_at
CREATE OR REPLACE TRIGGER trg_storage_channels_updated_at
  BEFORE UPDATE ON public.storage_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
