-- =============================================================
--  ATOMIC FLOOR / POSITION OPERATIONS (ACCENT-SAFE & ROBUST)
--  Execute once in the Supabase SQL Editor.
-- =============================================================

-- ---------------------------------------------------------
-- 1. rpc_add_to_position
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_add_to_position(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_posicao    text := COALESCE(payload->>'Posição', payload->>'Posicao', payload->>'posicao');
  v_codigo     text := COALESCE(payload->>'Código', payload->>'Codigo', payload->>'sku');
  v_quantidade int  := COALESCE((payload->>'Quantidade')::int, (payload->>'quantidade')::int, 0);
  v_nivel      int  := COALESCE((payload->>'Nível')::int, (payload->>'Nivel')::int, 0);
  v_prof       int  := COALESCE((payload->>'Profundidade')::int, (payload->>'profundidade')::int, 1);
  v_tombada    int  := COALESCE((payload->>'Parte Tombada')::int, (payload->>'ParteTombada')::int, 0);
  v_molhada    int  := COALESCE((payload->>'Parte Molhada')::int, (payload->>'ParteMolhada')::int, 0);
  v_id_palete  text := COALESCE(payload->>'Id Palete', payload->>'IdPalete');
  v_observacao text := COALESCE(payload->>'Observação', payload->>'Observacao');
  v_floor_id   bigint;
  v_floor_qty  int;
  v_remaining  int;
BEGIN
  IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Quantidade invalida (%) para insercao na posicao %.', v_quantidade, v_posicao;
  END IF;

  IF v_posicao IS NULL OR v_posicao = 'Chão' OR v_posicao = 'Chao' THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Esta funcao e apenas para posicoes (nao Chao).';
  END IF;

  IF v_posicao != 'Retrabalho' THEN
    SELECT id, "Quantidade" INTO v_floor_id, v_floor_qty
      FROM mapeamento
     WHERE ("Posição" = 'Chão' OR "Posição" = 'Chao')
       AND ("Código" = v_codigo OR "Código" = UPPER(v_codigo))
     ORDER BY id ASC LIMIT 1 FOR UPDATE;

    IF NOT FOUND OR COALESCE(v_floor_qty, 0) < v_quantidade THEN
      RAISE EXCEPTION 'ATOMIC_ERROR: Saldo insuficiente no Chao para SKU %. Necessario: %, Disponivel: %.',
        v_codigo, v_quantidade, COALESCE(v_floor_qty, 0);
    END IF;
  END IF;

  INSERT INTO mapeamento (
    "Posição", "Código", "Quantidade", "Nível", "Profundidade",
    "Parte Tombada", "Parte Molhada", "Id Palete", "Observação"
  ) VALUES (
    v_posicao, v_codigo, v_quantidade, v_nivel, v_prof,
    v_tombada, v_molhada, v_id_palete, v_observacao
  );

  IF v_posicao != 'Retrabalho' AND v_floor_id IS NOT NULL THEN
    v_remaining := v_floor_qty - v_quantidade;
    IF v_remaining <= 0 THEN
      DELETE FROM mapeamento WHERE id = v_floor_id;
    ELSE
      UPDATE mapeamento SET "Quantidade" = v_remaining WHERE id = v_floor_id;
    END IF;
  END IF;
END;
$$;

-- ---------------------------------------------------------
-- 2. rpc_update_quantity
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_update_quantity(
  p_record_id bigint,
  p_new_qty   int,
  p_old_qty   int,
  p_sku       text,
  p_position  text,
  p_extra     jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_diff      int := p_new_qty - p_old_qty;
  v_abs_diff  int := ABS(v_diff);
  v_nivel     int  := COALESCE((p_extra->>'Nível')::int, (p_extra->>'Nivel')::int, NULL);
  v_prof      int  := COALESCE((p_extra->>'Profundidade')::int, NULL);
  v_tombada   int  := COALESCE((p_extra->>'Parte Tombada')::int, (p_extra->>'ParteTombada')::int, NULL);
  v_molhada   int  := COALESCE((p_extra->>'Parte Molhada')::int, (p_extra->>'ParteMolhada')::int, NULL);
  v_id_palete text := COALESCE(p_extra->>'Id Palete', p_extra->>'IdPalete');
  v_floor_id  bigint;
  v_floor_qty int;
  v_remaining int;
BEGIN
  IF p_new_qty < 0 THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Quantidade negativa (%) nao permitida.', p_new_qty;
  END IF;

  UPDATE mapeamento SET
    "Quantidade"    = p_new_qty,
    "Nível"         = COALESCE(v_nivel,    "Nível"),
    "Profundidade"  = COALESCE(v_prof,     "Profundidade"),
    "Parte Tombada" = COALESCE(v_tombada,  "Parte Tombada"),
    "Parte Molhada" = COALESCE(v_molhada,  "Parte Molhada"),
    "Id Palete"     = COALESCE(v_id_palete,"Id Palete")
  WHERE id = p_record_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Registro id=% nao encontrado.', p_record_id;
  END IF;

  IF p_position = 'Chão' OR p_position = 'Chao' OR p_position = 'Retrabalho' OR v_diff = 0 THEN
    RETURN;
  END IF;

  IF v_diff > 0 THEN
    SELECT id, "Quantidade" INTO v_floor_id, v_floor_qty
      FROM mapeamento
     WHERE ("Posição" = 'Chão' OR "Posição" = 'Chao')
       AND ("Código" = p_sku OR "Código" = UPPER(p_sku))
     ORDER BY id ASC LIMIT 1 FOR UPDATE;

    IF NOT FOUND OR COALESCE(v_floor_qty, 0) < v_diff THEN
      RAISE EXCEPTION 'ATOMIC_ERROR: Saldo insuficiente no Chao para aumentar SKU % em % un. Disponivel: %.',
        p_sku, v_diff, COALESCE(v_floor_qty, 0);
    END IF;

    v_remaining := v_floor_qty - v_diff;
    IF v_remaining <= 0 THEN
      DELETE FROM mapeamento WHERE id = v_floor_id;
    ELSE
      UPDATE mapeamento SET "Quantidade" = v_remaining WHERE id = v_floor_id;
    END IF;
  ELSE
    SELECT id, "Quantidade" INTO v_floor_id, v_floor_qty
      FROM mapeamento
     WHERE ("Posição" = 'Chão' OR "Posição" = 'Chao')
       AND ("Código" = p_sku OR "Código" = UPPER(p_sku))
     ORDER BY id ASC LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      UPDATE mapeamento SET "Quantidade" = v_floor_qty + v_abs_diff WHERE id = v_floor_id;
    ELSE
      INSERT INTO mapeamento ("Posição", "Código", "Quantidade", "Nível", "Profundidade")
      VALUES ('Chão', p_sku, v_abs_diff, 0, 1);
    END IF;
  END IF;
END;
$$;

-- ---------------------------------------------------------
-- 3. rpc_delete_from_position
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_delete_from_position(
  p_record_id  bigint,
  p_target_pos text,
  p_sku        text,
  p_qty        int,
  p_tombada    int DEFAULT 0,
  p_molhada    int DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_floor_id  bigint;
  v_floor_qty int;
BEGIN
  DELETE FROM mapeamento WHERE id = p_record_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Registro id=% nao encontrado para remocao.', p_record_id;
  END IF;

  IF p_target_pos = 'Chão' OR p_target_pos = 'Chao' THEN
    SELECT id, "Quantidade" INTO v_floor_id, v_floor_qty
      FROM mapeamento
     WHERE ("Posição" = 'Chão' OR "Posição" = 'Chao')
       AND ("Código" = p_sku OR "Código" = UPPER(p_sku))
     ORDER BY id ASC LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      UPDATE mapeamento SET "Quantidade" = v_floor_qty + p_qty WHERE id = v_floor_id;
    ELSE
      INSERT INTO mapeamento ("Posição", "Código", "Quantidade", "Nível", "Profundidade", "Parte Tombada", "Parte Molhada", "Id Palete")
      VALUES ('Chão', p_sku, p_qty, 0, 1, p_tombada, p_molhada, NULL);
    END IF;
  ELSE
    INSERT INTO mapeamento ("Posição", "Código", "Quantidade", "Nível", "Profundidade", "Parte Tombada", "Parte Molhada", "Id Palete")
    VALUES (p_target_pos, p_sku, p_qty, 0, 1, p_tombada, p_molhada, NULL);
  END IF;
END;
$$;

-- ---------------------------------------------------------
-- CLEANUP ORPHAN / 0-QTY ROWS
-- ---------------------------------------------------------
DELETE FROM mapeamento
 WHERE "Quantidade" IS NULL OR "Quantidade" <= 0
    OR "Código" IS NULL OR "Código" = ''
    OR "Posição" IS NULL OR "Posição" = '';

GRANT EXECUTE ON FUNCTION rpc_add_to_position(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_update_quantity(bigint,int,int,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_delete_from_position(bigint,text,text,int,int,int) TO authenticated;
