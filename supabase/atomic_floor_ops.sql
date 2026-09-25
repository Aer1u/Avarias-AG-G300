-- =============================================================
--  ATOMIC FLOOR / POSITION OPERATIONS (BULLETPROOF & SANITIZED)
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
  v_posicao         text := TRIM(COALESCE(payload->>'Posição', payload->>'Posicao', payload->>'posicao'));
  v_codigo          text := TRIM(UPPER(COALESCE(payload->>'Código', payload->>'Codigo', payload->>'sku')));
  v_quantidade      int  := COALESCE((payload->>'Quantidade')::int, (payload->>'quantidade')::int, 0);
  v_nivel           int  := COALESCE((payload->>'Nível')::int, (payload->>'Nivel')::int, 0);
  v_prof            int  := COALESCE((payload->>'Profundidade')::int, (payload->>'profundidade')::int, 1);
  v_tombada         int  := COALESCE((payload->>'Parte Tombada')::int, (payload->>'ParteTombada')::int, 0);
  v_molhada         int  := COALESCE((payload->>'Parte Molhada')::int, (payload->>'ParteMolhada')::int, 0);
  v_id_palete       text := TRIM(COALESCE(payload->>'Id Palete', payload->>'IdPalete'));
  v_observacao      text := TRIM(COALESCE(payload->>'Observação', payload->>'Observacao'));

  v_total_floor_qty int  := 0;
  v_remaining       int  := 0;
  r_floor           RECORD;
BEGIN
  IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Quantidade inválida (%) para inserção na posição %.', v_quantidade, v_posicao;
  END IF;

  IF v_codigo IS NULL OR v_codigo = '' THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Código SKU não pode ser vazio.';
  END IF;

  IF v_posicao IS NULL OR LOWER(v_posicao) = 'chão' OR LOWER(v_posicao) = 'chao' THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Esta função é apenas para posições (não Chão).';
  END IF;

  -- Validate total floor stock across ALL floor records for this SKU (fuzzy match spaces and case)
  IF LOWER(v_posicao) != 'retrabalho' THEN
    SELECT COALESCE(SUM("Quantidade"), 0)
      INTO v_total_floor_qty
      FROM mapeamento
     WHERE LOWER(TRIM(COALESCE("Posição", "Posicao", ''))) IN ('chão', 'chao')
       AND TRIM(UPPER(COALESCE("Código", "Codigo", ''))) = v_codigo;

    IF v_total_floor_qty < v_quantidade THEN
      RAISE EXCEPTION 'ATOMIC_ERROR: Saldo insuficiente no Chão para SKU %. Necessário: %, Disponível no Chão: %.',
        v_codigo, v_quantidade, v_total_floor_qty;
    END IF;
  END IF;

  -- Insert into target position
  INSERT INTO mapeamento (
    "Posição", "Código", "Quantidade", "Nível", "Profundidade",
    "Parte Tombada", "Parte Molhada", "Id Palete", "Observação"
  ) VALUES (
    v_posicao, v_codigo, v_quantidade, v_nivel, v_prof,
    v_tombada, v_molhada, NULLIF(v_id_palete, ''), NULLIF(v_observacao, '')
  );

  -- Multi-row floor consumption
  IF LOWER(v_posicao) != 'retrabalho' THEN
    v_remaining := v_quantidade;

    FOR r_floor IN (
      SELECT id, "Quantidade"
        FROM mapeamento
       WHERE LOWER(TRIM(COALESCE("Posição", "Posicao", ''))) IN ('chão', 'chao')
         AND TRIM(UPPER(COALESCE("Código", "Codigo", ''))) = v_codigo
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

  -- Global Integrity Sweep: delete any 0 or negative quantity or blank records
  DELETE FROM mapeamento
   WHERE "Quantidade" IS NULL OR "Quantidade" <= 0
      OR TRIM(COALESCE("Código", '')) = ''
      OR TRIM(COALESCE("Posição", '')) = '';
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
  v_sku             text := TRIM(UPPER(COALESCE(p_sku, '')));
  v_pos             text := TRIM(COALESCE(p_position, ''));
  v_diff            int := p_new_qty - p_old_qty;
  v_abs_diff        int := ABS(v_diff);
  v_nivel           int  := COALESCE((p_extra->>'Nível')::int, (p_extra->>'Nivel')::int, NULL);
  v_prof            int  := COALESCE((p_extra->>'Profundidade')::int, NULL);
  v_tombada         int  := COALESCE((p_extra->>'Parte Tombada')::int, (p_extra->>'ParteTombada')::int, NULL);
  v_molhada         int  := COALESCE((p_extra->>'Parte Molhada')::int, (p_extra->>'ParteMolhada')::int, NULL);
  v_id_palete       text := TRIM(COALESCE(p_extra->>'Id Palete', p_extra->>'IdPalete', ''));

  v_total_floor_qty int  := 0;
  v_remaining       int  := 0;
  v_floor_id        bigint;
  v_floor_qty       int;
  r_floor           RECORD;
BEGIN
  -- If new qty <= 0, DELETE the pallet record and return any remaining old_qty to floor if position is not Chão/Retrabalho
  IF p_new_qty <= 0 THEN
    DELETE FROM mapeamento WHERE id = p_record_id;

    IF LOWER(v_pos) NOT IN ('chão', 'chao', 'retrabalho') AND p_old_qty > 0 THEN
      -- Return p_old_qty to Chão
      SELECT id, "Quantidade" INTO v_floor_id, v_floor_qty
        FROM mapeamento
       WHERE LOWER(TRIM(COALESCE("Posição", "Posicao", ''))) IN ('chão', 'chao')
         AND TRIM(UPPER(COALESCE("Código", "Codigo", ''))) = v_sku
       ORDER BY id ASC LIMIT 1 FOR UPDATE;

      IF FOUND THEN
        UPDATE mapeamento SET "Quantidade" = v_floor_qty + p_old_qty WHERE id = v_floor_id;
      ELSE
        INSERT INTO mapeamento ("Posição", "Código", "Quantidade", "Nível", "Profundidade")
        VALUES ('Chão', v_sku, p_old_qty, 0, 1);
      END IF;
    END IF;

    -- Cleanup and exit
    DELETE FROM mapeamento WHERE "Quantidade" IS NULL OR "Quantidade" <= 0;
    RETURN;
  END IF;

  -- Normal update for p_new_qty > 0
  UPDATE mapeamento SET
    "Quantidade"    = p_new_qty,
    "Nível"         = COALESCE(v_nivel,    "Nível"),
    "Profundidade"  = COALESCE(v_prof,     "Profundidade"),
    "Parte Tombada" = COALESCE(v_tombada,  "Parte Tombada"),
    "Parte Molhada" = COALESCE(v_molhada,  "Parte Molhada"),
    "Id Palete"     = NULLIF(COALESCE(NULLIF(v_id_palete, ''), "Id Palete"), '')
  WHERE id = p_record_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Registro id=% não encontrado.', p_record_id;
  END IF;

  IF LOWER(v_pos) IN ('chão', 'chao', 'retrabalho') OR v_diff = 0 THEN
    -- Cleanup and exit
    DELETE FROM mapeamento WHERE "Quantidade" IS NULL OR "Quantidade" <= 0;
    RETURN;
  END IF;

  IF v_diff > 0 THEN
    -- Increasing pallet qty -> Deduct from Chão
    SELECT COALESCE(SUM("Quantidade"), 0)
      INTO v_total_floor_qty
      FROM mapeamento
     WHERE LOWER(TRIM(COALESCE("Posição", "Posicao", ''))) IN ('chão', 'chao')
       AND TRIM(UPPER(COALESCE("Código", "Codigo", ''))) = v_sku;

    IF v_total_floor_qty < v_diff THEN
      RAISE EXCEPTION 'ATOMIC_ERROR: Saldo insuficiente no Chão para aumentar SKU % em % un. Disponível: %.',
        v_sku, v_diff, v_total_floor_qty;
    END IF;

    v_remaining := v_diff;
    FOR r_floor IN (
      SELECT id, "Quantidade"
        FROM mapeamento
       WHERE LOWER(TRIM(COALESCE("Posição", "Posicao", ''))) IN ('chão', 'chao')
         AND TRIM(UPPER(COALESCE("Código", "Codigo", ''))) = v_sku
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
    -- Decreasing pallet qty -> Return v_abs_diff to Chão
    SELECT id, "Quantidade" INTO v_floor_id, v_floor_qty
      FROM mapeamento
     WHERE LOWER(TRIM(COALESCE("Posição", "Posicao", ''))) IN ('chão', 'chao')
       AND TRIM(UPPER(COALESCE("Código", "Codigo", ''))) = v_sku
     ORDER BY id ASC LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      UPDATE mapeamento SET "Quantidade" = v_floor_qty + v_abs_diff WHERE id = v_floor_id;
    ELSE
      INSERT INTO mapeamento ("Posição", "Código", "Quantidade", "Nível", "Profundidade")
      VALUES ('Chão', v_sku, v_abs_diff, 0, 1);
    END IF;
  END IF;

  -- Global Integrity Sweep
  DELETE FROM mapeamento
   WHERE "Quantidade" IS NULL OR "Quantidade" <= 0
      OR TRIM(COALESCE("Código", '')) = ''
      OR TRIM(COALESCE("Posição", '')) = '';
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
       WHERE LOWER(TRIM(COALESCE("Posição", "Posicao", ''))) IN ('chão', 'chao')
         AND TRIM(UPPER(COALESCE("Código", "Codigo", ''))) = v_sku
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

  -- Global Integrity Sweep
  DELETE FROM mapeamento
   WHERE "Quantidade" IS NULL OR "Quantidade" <= 0
      OR TRIM(COALESCE("Código", '')) = ''
      OR TRIM(COALESCE("Posição", '')) = '';
END;
$$;

-- Cleanup script for any corrupted 0-qty or empty-pos rows in Supabase
DELETE FROM mapeamento
 WHERE "Quantidade" IS NULL OR "Quantidade" <= 0
    OR TRIM(COALESCE("Código", '')) = ''
    OR TRIM(COALESCE("Posição", '')) = '';

GRANT EXECUTE ON FUNCTION rpc_add_to_position(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_update_quantity(bigint,int,int,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_delete_from_position(bigint,text,text,int,int,int) TO authenticated;
