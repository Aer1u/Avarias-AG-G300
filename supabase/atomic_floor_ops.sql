-- =============================================================
--  ATOMIC FLOOR / POSITION OPERATIONS  (v4 - BULLETPROOF FLOOR & SLOT MERGE)
--  Execute once in the Supabase SQL Editor.
--
--  Design principles:
--    1. RPCs only do what they say — no hidden "integrity sweeps".
--    2. rpc_add_to_position MERGES with existing row in slot if present
--       (preventing duplicate stacked rows like 48 un).
--    3. Robust floor matching checks ALL floor position variants:
--       'Chão', 'chao', 'S/P', 'NÃO INFORMADO', '-', '', NULL, 'Chão G300', etc.
--    4. Robust SKU matching removes spaces and hyphens so formatting differences
--       never cause false "0 disponível" errors.
-- =============================================================

-- ---------------------------------------------------------
-- 1. rpc_add_to_position
--    Add quantity to a position slot (merge if slot row exists,
--    or insert new row) and consume from Chão stock.
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
  v_existing_id     bigint := NULL;
  v_existing_qty    int := 0;
  v_existing_tomb   int := 0;
  v_existing_molh   int := 0;
  r_floor           RECORD;
BEGIN
  -- Basic guards
  IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Quantidade inválida (%) para inserção na posição %.', v_quantidade, v_posicao;
  END IF;

  IF v_codigo IS NULL OR v_codigo = '' THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Código SKU não pode ser vazio.';
  END IF;

  IF v_posicao IS NULL OR LOWER(TRIM(v_posicao)) IN ('chão', 'chao', 's/p', 'não informado', '-', '') THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Esta função é apenas para posições reais (não Chão).';
  END IF;

  -- Check floor balance before touching anything (skip for Retrabalho)
  IF LOWER(TRIM(v_posicao)) != 'retrabalho' THEN
    SELECT COALESCE(SUM("Quantidade"), 0)
      INTO v_total_floor_qty
      FROM mapeamento
     WHERE (
       LOWER(TRIM(COALESCE("Posição", ''))) IN ('chão', 'chao', 's/p', 'não informado', '-', '')
       OR "Posição" IS NULL
       OR LOWER(TRIM("Posição")) LIKE 'chão%'
       OR LOWER(TRIM("Posição")) LIKE 'chao%'
     )
     AND (
       TRIM(UPPER(COALESCE("Código", ''))) = v_codigo
       OR REGEXP_REPLACE(TRIM(UPPER(COALESCE("Código", ''))), '[^A-Z0-9]', '', 'g') = REGEXP_REPLACE(v_codigo, '[^A-Z0-9]', '', 'g')
     );

    IF v_total_floor_qty < v_quantidade THEN
      RAISE EXCEPTION 'ATOMIC_ERROR: Saldo insuficiente no Chão para SKU %. Necessário: %, Disponível: %.',
        v_codigo, v_quantidade, v_total_floor_qty;
    END IF;
  END IF;

  -- Check if a row already exists in this exact slot (posicao, nivel, profundidade, sku, id_palete)
  SELECT id, COALESCE("Quantidade", 0), COALESCE("Parte Tombada", 0), COALESCE("Parte Molhada", 0)
    INTO v_existing_id, v_existing_qty, v_existing_tomb, v_existing_molh
    FROM mapeamento
   WHERE LOWER(TRIM("Posição")) = LOWER(TRIM(v_posicao))
     AND COALESCE("Nível", 0) = v_nivel
     AND COALESCE("Profundidade", 1) = v_prof
     AND (
       TRIM(UPPER(COALESCE("Código", ''))) = v_codigo
       OR REGEXP_REPLACE(TRIM(UPPER(COALESCE("Código", ''))), '[^A-Z0-9]', '', 'g') = REGEXP_REPLACE(v_codigo, '[^A-Z0-9]', '', 'g')
     )
     AND COALESCE(TRIM("Id Palete"), '') = COALESCE(v_id_palete, '')
   LIMIT 1 FOR UPDATE;

  IF v_existing_id IS NOT NULL THEN
    -- Merge with existing row in slot
    UPDATE mapeamento SET
      "Quantidade"    = v_existing_qty + v_quantidade,
      "Parte Tombada" = v_existing_tomb + v_tombada,
      "Parte Molhada" = v_existing_molh + v_molhada,
      "Observação"    = COALESCE(v_observacao, "Observação")
    WHERE id = v_existing_id;
  ELSE
    -- Insert new row in slot
    INSERT INTO mapeamento (
      "Posição", "Código", "Quantidade", "Nível", "Profundidade",
      "Parte Tombada", "Parte Molhada", "Id Palete", "Observação"
    ) VALUES (
      v_posicao, v_codigo, v_quantidade, v_nivel, v_prof,
      v_tombada, v_molhada, v_id_palete, v_observacao
    );
  END IF;

  -- Consume from Chão (skip for Retrabalho)
  IF LOWER(TRIM(v_posicao)) != 'retrabalho' THEN
    v_remaining := v_quantidade;

    FOR r_floor IN (
      SELECT id, "Quantidade"
        FROM mapeamento
       WHERE (
         LOWER(TRIM(COALESCE("Posição", ''))) IN ('chão', 'chao', 's/p', 'não informado', '-', '')
         OR "Posição" IS NULL
         OR LOWER(TRIM("Posição")) LIKE 'chão%'
         OR LOWER(TRIM("Posição")) LIKE 'chao%'
       )
       AND (
         TRIM(UPPER(COALESCE("Código", ''))) = v_codigo
         OR REGEXP_REPLACE(TRIM(UPPER(COALESCE("Código", ''))), '[^A-Z0-9]', '', 'g') = REGEXP_REPLACE(v_codigo, '[^A-Z0-9]', '', 'g')
       )
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
  IF p_new_qty < 0 THEN
    RAISE EXCEPTION 'ATOMIC_ERROR: Quantidade negativa (%) não permitida.', p_new_qty;
  END IF;

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

  IF LOWER(TRIM(v_pos)) IN ('chão', 'chao', 'retrabalho', 's/p', 'não informado', '-', '') OR v_diff = 0 THEN
    RETURN;
  END IF;

  IF v_diff > 0 THEN
    -- Quantity INCREASED at position → consume from Chão
    SELECT COALESCE(SUM("Quantidade"), 0)
      INTO v_total_floor_qty
      FROM mapeamento
     WHERE (
       LOWER(TRIM(COALESCE("Posição", ''))) IN ('chão', 'chao', 's/p', 'não informado', '-', '')
       OR "Posição" IS NULL
       OR LOWER(TRIM("Posição")) LIKE 'chão%'
       OR LOWER(TRIM("Posição")) LIKE 'chao%'
     )
     AND (
       TRIM(UPPER(COALESCE("Código", ''))) = v_sku
       OR REGEXP_REPLACE(TRIM(UPPER(COALESCE("Código", ''))), '[^A-Z0-9]', '', 'g') = REGEXP_REPLACE(v_sku, '[^A-Z0-9]', '', 'g')
     );

    IF v_total_floor_qty < v_diff THEN
      RAISE EXCEPTION 'ATOMIC_ERROR: Saldo insuficiente no Chão para aumentar SKU % em % un. Disponível: %.',
        v_sku, v_diff, v_total_floor_qty;
    END IF;

    v_remaining := v_diff;
    FOR r_floor IN (
      SELECT id, "Quantidade"
        FROM mapeamento
       WHERE (
         LOWER(TRIM(COALESCE("Posição", ''))) IN ('chão', 'chao', 's/p', 'não informado', '-', '')
         OR "Posição" IS NULL
         OR LOWER(TRIM("Posição")) LIKE 'chão%'
         OR LOWER(TRIM("Posição")) LIKE 'chao%'
       )
       AND (
         TRIM(UPPER(COALESCE("Código", ''))) = v_sku
         OR REGEXP_REPLACE(TRIM(UPPER(COALESCE("Código", ''))), '[^A-Z0-9]', '', 'g') = REGEXP_REPLACE(v_sku, '[^A-Z0-9]', '', 'g')
       )
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
     WHERE (
       LOWER(TRIM(COALESCE("Posição", ''))) IN ('chão', 'chao', 's/p', 'não informado', '-', '')
       OR "Posição" IS NULL
       OR LOWER(TRIM("Posição")) LIKE 'chão%'
       OR LOWER(TRIM("Posição")) LIKE 'chao%'
     )
     AND (
       TRIM(UPPER(COALESCE("Código", ''))) = v_sku
       OR REGEXP_REPLACE(TRIM(UPPER(COALESCE("Código", ''))), '[^A-Z0-9]', '', 'g') = REGEXP_REPLACE(v_sku, '[^A-Z0-9]', '', 'g')
     )
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
--    Remove a row and return its quantity to Chão (or target pos).
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
    IF LOWER(TRIM(v_target_pos)) IN ('chão', 'chao', 's/p', 'não informado', '-', '') THEN
      SELECT id, "Quantidade" INTO v_floor_id, v_floor_qty
        FROM mapeamento
       WHERE (
         LOWER(TRIM(COALESCE("Posição", ''))) IN ('chão', 'chao', 's/p', 'não informado', '-', '')
         OR "Posição" IS NULL
         OR LOWER(TRIM("Posição")) LIKE 'chão%'
         OR LOWER(TRIM("Posição")) LIKE 'chao%'
       )
       AND (
         TRIM(UPPER(COALESCE("Código", ''))) = v_sku
         OR REGEXP_REPLACE(TRIM(UPPER(COALESCE("Código", ''))), '[^A-Z0-9]', '', 'g') = REGEXP_REPLACE(v_sku, '[^A-Z0-9]', '', 'g')
       )
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
   AND (TRIM(COALESCE("Posição", '')) NOT IN ('', 'Chão', 'Chao', 'S/P', 'NÃO INFORMADO', '-'))
   AND ("Código" IS NOT NULL AND TRIM("Código") != '');

GRANT EXECUTE ON FUNCTION rpc_add_to_position(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_update_quantity(bigint,int,int,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_delete_from_position(bigint,text,text,int,int,int) TO authenticated;
