-- =============================================================
--  ATOMIC FLOOR / POSITION OPERATIONS  (v3 - SAFE & MINIMAL)
--  Execute once in the Supabase SQL Editor.
--
--  Design principles:
--    1. RPCs only do what they say — no hidden "integrity sweeps" that
--       could wipe legitimate rows.
--    2. rpc_update_quantity NEVER deletes the position row — it only
--       updates the quantity and adjusts floor stock.
--    3. Deletion of a position row only happens via rpc_delete_from_position
--       (which the front-end explicitly calls when the user removes a row).
--    4. Floor consumption / return uses TRIM+UPPER so spacing/case
--       differences in SKU codes no longer cause false "not found".
-- =============================================================

-- ---------------------------------------------------------
-- 1. rpc_add_to_position
--    Insert a row at a real position and deduct from Chão.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_add_to_position(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_posicao    text := TRIM(COALESCE(payload->>'Posição', payload->>'Posicao', payload->>'posicao'));
  v_codigo     text := TRIM(UPPER(COALESCE(payload->>'Código', payload->>'Codigo', payload->>'sku')));
  v_quantidade int  := COALESCE((payload->>'Quantidade')::int, (payload->>'quantidade')::int, 0);
  v_nivel      int  := COALESCE((payload->>'Nível')::int, (payload->>'Nivel')::int, 0);
  v_prof       int  := COALESCE((payload->>'Profundidade')::int, (payload->>'profundidade')::int, 1);
  v_tombada    int  := COALESCE((payload->>'Parte Tombada')::int, (payload->>'ParteTombada')::int, 0);
  v_molhada    int  := COALESCE((payload->>'Parte Molhada')::int, (payload->>'ParteMolhada')::int, 0);
  v_id_palete  text := NULLIF(TRIM(COALESCE(payload->>'Id Palete', payload->>'IdPalete', '')), '');
  v_observacao text := NULLIF(TRIM(COALESCE(payload->>'Observação', payload->>'Observacao', '')), '');

  v_total_floor_qty int := 0;
  v_remaining       int := 0;
  r_floor           RECORD;
BEGIN
  -- Basic guards
  IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Quantidade inválida (%) para inserção na posição %.', v_quantidade, v_posicao;
  END IF;

  IF v_codigo IS NULL OR v_codigo = '' THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Código SKU não pode ser vazio.';
  END IF;

  IF v_posicao IS NULL OR LOWER(v_posicao) IN ('chão', 'chao', '') THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Esta função é apenas para posições reais (não Chão).';
  END IF;

  -- Check floor balance before touching anything (skip for Retrabalho)
  IF LOWER(v_posicao) != 'retrabalho' THEN
    SELECT COALESCE(SUM("Quantidade"), 0)
      INTO v_total_floor_qty
      FROM mapeamento
     WHERE LOWER(TRIM(COALESCE("Posição", ''))) IN ('chão', 'chao')
       AND TRIM(UPPER(COALESCE("Código", ''))) = v_codigo;

    IF v_total_floor_qty < v_quantidade THEN
      RAISE EXCEPTION 'ATOMIC_ERROR: Saldo insuficiente no Chão para SKU %. Necessário: %, Disponível: %.',
        v_codigo, v_quantidade, v_total_floor_qty;
    END IF;
  END IF;

  -- Insert into real position
  INSERT INTO mapeamento (
    "Posição", "Código", "Quantidade", "Nível", "Profundidade",
    "Parte Tombada", "Parte Molhada", "Id Palete", "Observação"
  ) VALUES (
    v_posicao, v_codigo, v_quantidade, v_nivel, v_prof,
    v_tombada, v_molhada, v_id_palete, v_observacao
  );

  -- Consume from Chão (skip for Retrabalho)
  IF LOWER(v_posicao) != 'retrabalho' THEN
    v_remaining := v_quantidade;

    FOR r_floor IN (
      SELECT id, "Quantidade"
        FROM mapeamento
       WHERE LOWER(TRIM(COALESCE("Posição", ''))) IN ('chão', 'chao')
         AND TRIM(UPPER(COALESCE("Código", ''))) = v_codigo
       ORDER BY id ASC
       FOR UPDATE
    ) LOOP
      EXIT WHEN v_remaining <= 0;

      IF COALESCE(r_floor."Quantidade", 0) <= v_remaining THEN
        v_remaining := v_remaining - COALESCE(r_floor."Quantidade", 0);
        DELETE FROM mapeamento WHERE id = r_floor.id;
      ELSE
        UPDATE mapeamento
           SET "Quantidade" = r_floor."Quantidade" - v_remaining
         WHERE id = r_floor.id;
        v_remaining := 0;
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- ---------------------------------------------------------
-- 2. rpc_update_quantity
--    Update a row's quantity and adjust Chão accordingly.
--    IMPORTANT: This function NEVER deletes the position row.
--    Use rpc_delete_from_position if you want to remove a row.
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
  v_sku      text := TRIM(UPPER(COALESCE(p_sku, '')));
  v_pos      text := TRIM(COALESCE(p_position, ''));
  v_diff     int  := p_new_qty - p_old_qty;
  v_abs_diff int  := ABS(v_diff);

  v_nivel     int  := (p_extra->>'Nível')::int;
  v_prof      int  := (p_extra->>'Profundidade')::int;
  v_tombada   int  := (p_extra->>'Parte Tombada')::int;
  v_molhada   int  := (p_extra->>'Parte Molhada')::int;
  v_id_palete text := NULLIF(TRIM(COALESCE(p_extra->>'Id Palete', '')), '');

  v_total_floor_qty int := 0;
  v_remaining       int := 0;
  v_floor_id        bigint;
  v_floor_qty       int;
  r_floor           RECORD;
BEGIN
  -- Safety: new quantity must not be negative
  IF p_new_qty < 0 THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Quantidade negativa (%) não permitida.', p_new_qty;
  END IF;

  -- Update the position row (quantity + optional extra fields)
  UPDATE mapeamento SET
    "Quantidade"    = GREATEST(p_new_qty, 0),
    "Nível"         = COALESCE(v_nivel,     "Nível"),
    "Profundidade"  = COALESCE(v_prof,      "Profundidade"),
    "Parte Tombada" = COALESCE(v_tombada,   "Parte Tombada"),
    "Parte Molhada" = COALESCE(v_molhada,   "Parte Molhada"),
    "Id Palete"     = COALESCE(v_id_palete, "Id Palete")
  WHERE id = p_record_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Registro id=% não encontrado.', p_record_id;
  END IF;

  -- Skip floor adjustment for Chão / Retrabalho rows or if qty didn't change
  IF LOWER(v_pos) IN ('chão', 'chao', 'retrabalho') OR v_diff = 0 THEN
    RETURN;
  END IF;

  IF v_diff > 0 THEN
    -- Quantity INCREASED at position → consume from Chão
    SELECT COALESCE(SUM("Quantidade"), 0)
      INTO v_total_floor_qty
      FROM mapeamento
     WHERE LOWER(TRIM(COALESCE("Posição", ''))) IN ('chão', 'chao')
       AND TRIM(UPPER(COALESCE("Código", ''))) = v_sku;

    IF v_total_floor_qty < v_diff THEN
      RAISE EXCEPTION 'ATOMIC_ERROR: Saldo insuficiente no Chão para aumentar SKU % em % un. Disponível: %.',
        v_sku, v_diff, v_total_floor_qty;
    END IF;

    v_remaining := v_diff;
    FOR r_floor IN (
      SELECT id, "Quantidade"
        FROM mapeamento
       WHERE LOWER(TRIM(COALESCE("Posição", ''))) IN ('chão', 'chao')
         AND TRIM(UPPER(COALESCE("Código", ''))) = v_sku
       ORDER BY id ASC
       FOR UPDATE
    ) LOOP
      EXIT WHEN v_remaining <= 0;

      IF COALESCE(r_floor."Quantidade", 0) <= v_remaining THEN
        v_remaining := v_remaining - COALESCE(r_floor."Quantidade", 0);
        DELETE FROM mapeamento WHERE id = r_floor.id;
      ELSE
        UPDATE mapeamento
           SET "Quantidade" = r_floor."Quantidade" - v_remaining
         WHERE id = r_floor.id;
        v_remaining := 0;
      END IF;
    END LOOP;

  ELSE
    -- Quantity DECREASED at position → return difference to Chão
    SELECT id, "Quantidade" INTO v_floor_id, v_floor_qty
      FROM mapeamento
     WHERE LOWER(TRIM(COALESCE("Posição", ''))) IN ('chão', 'chao')
       AND TRIM(UPPER(COALESCE("Código", ''))) = v_sku
     ORDER BY id ASC LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      UPDATE mapeamento SET "Quantidade" = v_floor_qty + v_abs_diff WHERE id = v_floor_id;
    ELSE
      INSERT INTO mapeamento ("Posição", "Código", "Quantidade", "Nível", "Profundidade")
      VALUES ('Chão', v_sku, v_abs_diff, 0, 1);
    END IF;
  END IF;
END;
$$;

-- ---------------------------------------------------------
-- 3. rpc_delete_from_position
--    Remove a row and return its quantity to Chão (or another
--    target position like Retrabalho).
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
  v_sku        text := TRIM(UPPER(COALESCE(p_sku, '')));
  v_target_pos text := TRIM(COALESCE(p_target_pos, 'Chão'));
  v_floor_id   bigint;
  v_floor_qty  int;
BEGIN
  DELETE FROM mapeamento WHERE id = p_record_id;

  IF p_qty > 0 AND v_sku != '' THEN
    IF LOWER(v_target_pos) IN ('chão', 'chao') THEN
      SELECT id, "Quantidade" INTO v_floor_id, v_floor_qty
        FROM mapeamento
       WHERE LOWER(TRIM(COALESCE("Posição", ''))) IN ('chão', 'chao')
         AND TRIM(UPPER(COALESCE("Código", ''))) = v_sku
       ORDER BY id ASC LIMIT 1 FOR UPDATE;

      IF FOUND THEN
        UPDATE mapeamento SET "Quantidade" = v_floor_qty + p_qty WHERE id = v_floor_id;
      ELSE
        INSERT INTO mapeamento ("Posição", "Código", "Quantidade", "Nível", "Profundidade", "Parte Tombada", "Parte Molhada", "Id Palete")
        VALUES ('Chão', v_sku, p_qty, 0, 1, p_tombada, p_molhada, NULL);
      END IF;
    ELSE
      INSERT INTO mapeamento ("Posição", "Código", "Quantidade", "Nível", "Profundidade", "Parte Tombada", "Parte Molhada", "Id Palete")
      VALUES (v_target_pos, v_sku, p_qty, 0, 1, p_tombada, p_molhada, NULL);
    END IF;
  END IF;
END;
$$;

-- One-time cleanup of corrupted ghost rows (run ONCE, not inside RPCs)
DELETE FROM mapeamento
 WHERE ("Quantidade" IS NULL OR "Quantidade" <= 0)
   AND (TRIM(COALESCE("Posição", '')) NOT IN ('', 'Chão', 'Chao'))
   AND ("Código" IS NOT NULL AND TRIM("Código") != '');

GRANT EXECUTE ON FUNCTION rpc_add_to_position(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_update_quantity(bigint,int,int,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_delete_from_position(bigint,text,text,int,int,int) TO authenticated;
