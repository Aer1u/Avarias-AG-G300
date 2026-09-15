-- =============================================================
--  ATOMIC FLOOR / POSITION OPERATIONS
--  Execute once in the Supabase SQL Editor.
--  Each function runs inside a single PostgreSQL transaction.
--  If any step fails, the entire transaction is rolled back.
-- =============================================================

-- ---------------------------------------------------------
-- 1. rpc_add_to_position
--    INSERT pallet into position + consume from Chao.
--    Raises exception (full rollback) if Chao insufficient.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_add_to_position(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_posicao    text := payload->>'Posicao';
  v_codigo     text := payload->>'Codigo';
  v_quantidade int  := (payload->>'Quantidade')::int;
  v_nivel      int  := COALESCE((payload->>'Nivel')::int, 0);
  v_prof       int  := COALESCE((payload->>'Profundidade')::int, 1);
  v_tombada    int  := COALESCE((payload->>'ParteTombada')::int, 0);
  v_molhada    int  := COALESCE((payload->>'ParteMolhada')::int, 0);
  v_id_palete  text := payload->>'IdPalete';
  v_observacao text := payload->>'Observacao';
  v_floor_id   bigint;
  v_floor_qty  int;
  v_remaining  int;
BEGIN
  IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Quantidade invalida (%) para insercao na posicao %.', v_quantidade, v_posicao;
  END IF;
  IF v_posicao IS NULL OR v_posicao = 'Chao' THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Esta funcao e apenas para posicoes (nao Chao).';
  END IF;

  -- Only check/consume floor for non-Retrabalho positions
  IF v_posicao != 'Retrabalho' THEN
    SELECT id, "Quantidade" INTO v_floor_id, v_floor_qty
      FROM mapeamento
     WHERE "Posicao" = 'Chao' AND "Codigo" = v_codigo
     ORDER BY id ASC LIMIT 1 FOR UPDATE;
    IF NOT FOUND OR v_floor_qty < v_quantidade THEN
      RAISE EXCEPTION 'ATOMIC_ERROR: Saldo insuficiente no Chao para SKU %. Necessario: %, Disponivel: %.',
        v_codigo, v_quantidade, COALESCE(v_floor_qty, 0);
    END IF;
  END IF;

  -- Insert into target position
  INSERT INTO mapeamento (
    "Posicao", "Codigo", "Quantidade", "Nivel", "Profundidade",
    "Parte Tombada", "Parte Molhada", "Id Palete", "Observacao"
  ) VALUES (
    v_posicao, v_codigo, v_quantidade, v_nivel, v_prof,
    v_tombada, v_molhada, v_id_palete, v_observacao
  );

  -- Consume from floor
  IF v_posicao != 'Retrabalho' THEN
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
--    UPDATE pallet qty + adjust Chao atomically.
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
  v_nivel     int  := COALESCE((p_extra->>'Nivel')::int, NULL);
  v_prof      int  := COALESCE((p_extra->>'Profundidade')::int, NULL);
  v_tombada   int  := COALESCE((p_extra->>'ParteTombada')::int, NULL);
  v_molhada   int  := COALESCE((p_extra->>'ParteMolhada')::int, NULL);
  v_id_palete text := p_extra->>'IdPalete';
  v_floor_id  bigint;
  v_floor_qty int;
  v_remaining int;
BEGIN
  IF p_new_qty < 0 THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Quantidade negativa (%) nao permitida.', p_new_qty;
  END IF;

  -- Update the pallet record
  UPDATE mapeamento SET
    "Quantidade"    = p_new_qty,
    "Nivel"         = COALESCE(v_nivel,   "Nivel"),
    "Profundidade"  = COALESCE(v_prof,    "Profundidade"),
    "Parte Tombada" = COALESCE(v_tombada, "Parte Tombada"),
    "Parte Molhada" = COALESCE(v_molhada, "Parte Molhada"),
    "Id Palete"     = COALESCE(v_id_palete, "Id Palete")
  WHERE id = p_record_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Registro id=% nao encontrado.', p_record_id;
  END IF;

  -- No floor adjustment for Chao/Retrabalho or zero diff
  IF p_position = 'Chao' OR p_position = 'Retrabalho' OR v_diff = 0 THEN RETURN; END IF;

  IF v_diff > 0 THEN
    -- Qty increased: consume from floor
    SELECT id, "Quantidade" INTO v_floor_id, v_floor_qty
      FROM mapeamento WHERE "Posicao" = 'Chao' AND "Codigo" = p_sku
     ORDER BY id ASC LIMIT 1 FOR UPDATE;
    IF NOT FOUND OR v_floor_qty < v_diff THEN
      RAISE EXCEPTION 'ATOMIC_ERROR: Saldo insuficiente no Chao para aumentar SKU % em % un. Disponivel: %.',
        p_sku, v_diff, COALESCE(v_floor_qty, 0);
    END IF;
    v_remaining := v_floor_qty - v_diff;
    IF v_remaining <= 0 THEN DELETE FROM mapeamento WHERE id = v_floor_id;
    ELSE UPDATE mapeamento SET "Quantidade" = v_remaining WHERE id = v_floor_id; END IF;
  ELSE
    -- Qty decreased: return surplus to floor
    SELECT id, "Quantidade" INTO v_floor_id, v_floor_qty
      FROM mapeamento WHERE "Posicao" = 'Chao' AND "Codigo" = p_sku
     ORDER BY id ASC LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE mapeamento SET "Quantidade" = v_floor_qty + v_abs_diff WHERE id = v_floor_id;
    ELSE
      INSERT INTO mapeamento ("Posicao", "Codigo", "Quantidade", "Nivel", "Profundidade")
      VALUES ('Chao', p_sku, v_abs_diff, 0, 1);
    END IF;
  END IF;
END;
$$;

-- ---------------------------------------------------------
-- 3. rpc_delete_from_position
--    DELETE pallet + return stock to target atomically.
--    Raises if record not found (no phantom stock).
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_delete_from_position(
  p_record_id bigint,
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
  -- Delete source record first
  DELETE FROM mapeamento WHERE id = p_record_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Registro id=% nao encontrado para remocao.', p_record_id;
  END IF;

  -- Return to target position
  IF p_target_pos = 'Chao' THEN
    -- Try to merge with existing floor record
    SELECT id, "Quantidade" INTO v_floor_id, v_floor_qty
      FROM mapeamento WHERE "Posicao" = 'Chao' AND "Codigo" = p_sku
     ORDER BY id ASC LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE mapeamento SET "Quantidade" = v_floor_qty + p_qty WHERE id = v_floor_id;
    ELSE
      INSERT INTO mapeamento ("Posicao","Codigo","Quantidade","Nivel","Profundidade","Parte Tombada","Parte Molhada","Id Palete")
      VALUES ('Chao', p_sku, p_qty, 0, 1, p_tombada, p_molhada, NULL);
    END IF;
  ELSE
    INSERT INTO mapeamento ("Posicao","Codigo","Quantidade","Nivel","Profundidade","Parte Tombada","Parte Molhada","Id Palete")
    VALUES (p_target_pos, p_sku, p_qty, 0, 1, p_tombada, p_molhada, NULL);
  END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION rpc_add_to_position(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_update_quantity(bigint,int,int,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_delete_from_position(bigint,text,text,int,int,int) TO authenticated;
