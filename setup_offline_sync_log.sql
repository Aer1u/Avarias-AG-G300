-- ============================================================
-- offline_sync_log: registro consolidado de operacoes offline
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.offline_sync_log (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sincronizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo_operacao       TEXT NOT NULL,
  tabela              TEXT NOT NULL,
  record_id           TEXT,
  campo               TEXT,
  delta               NUMERIC,
  sku                 TEXT,
  posicao             TEXT,
  nivel               NUMERIC,
  profundidade        NUMERIC,
  quantidade_anterior NUMERIC,
  quantidade_nova     NUMERIC,
  status              TEXT NOT NULL DEFAULT ''synced'',
  error_message       TEXT,
  payload_json        JSONB,
  audit_json          JSONB
);

CREATE INDEX IF NOT EXISTS idx_offline_sync_log_sku       ON public.offline_sync_log (sku);
CREATE INDEX IF NOT EXISTS idx_offline_sync_log_posicao   ON public.offline_sync_log (posicao);
CREATE INDEX IF NOT EXISTS idx_offline_sync_log_criado_em ON public.offline_sync_log (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_offline_sync_log_status    ON public.offline_sync_log (status);

ALTER TABLE public.offline_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offline_sync_log_insert" ON public.offline_sync_log
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "offline_sync_log_select" ON public.offline_sync_log
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE VIEW public.offline_sync_summary AS
SELECT
  DATE_TRUNC(''day'', sincronizado_em)                   AS dia,
  tipo_operacao,
  posicao,
  sku,
  COUNT(*)                                               AS total_operacoes,
  SUM(CASE WHEN status = ''error'' THEN 1 ELSE 0 END)   AS total_erros,
  SUM(CASE WHEN delta < 0 THEN ABS(delta) ELSE 0 END)   AS total_devolvido_chao,
  SUM(CASE WHEN delta > 0 THEN delta      ELSE 0 END)   AS total_consumido_chao
FROM public.offline_sync_log
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC, 3, 4;
