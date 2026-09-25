-- ============================================================
-- movimentacoes_embalagens — Registro de Entradas e Saídas
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS public.movimentacoes_embalagens (
  id             BIGSERIAL PRIMARY KEY,
  tipo           TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SAÍDA')),
  codigo_produto TEXT,
  quantidade     INTEGER NOT NULL DEFAULT 0,
  usuario        TEXT,
  data           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  motivo         TEXT
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_mov_emb_codigo_produto ON public.movimentacoes_embalagens (codigo_produto);
CREATE INDEX IF NOT EXISTS idx_mov_emb_data           ON public.movimentacoes_embalagens (data DESC);
CREATE INDEX IF NOT EXISTS idx_mov_emb_tipo           ON public.movimentacoes_embalagens (tipo);

-- Enable Row Level Security
ALTER TABLE public.movimentacoes_embalagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated select" ON public.movimentacoes_embalagens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON public.movimentacoes_embalagens
  FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT ON public.movimentacoes_embalagens TO anon;
GRANT SELECT, INSERT ON public.movimentacoes_embalagens TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.movimentacoes_embalagens_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.movimentacoes_embalagens_id_seq TO authenticated;
