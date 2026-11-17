export type ClassificacaoPalete = "" | "Normal" | "Devolução";

export const CLASSIFICACAO_OPTIONS: { value: ClassificacaoPalete; label: string }[] = [
  { value: "", label: "Não definido" },
  { value: "Normal", label: "Normal" },
  { value: "Devolução", label: "Devolução" },
];

export const SQL_CLASSIFICACAO_MIGRATION = `ALTER TABLE public.mapeamento
  ADD COLUMN IF NOT EXISTS classificacao TEXT;`;

export function normalizeClassificacao(raw: unknown): ClassificacaoPalete {
  if (raw === null || raw === undefined) return "";
  const cleaned = String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!cleaned || cleaned === "-" || cleaned === "null" || cleaned === "undefined" || cleaned === "nao definido") {
    return "";
  }
  if (cleaned === "devolucao" || cleaned === "devoluçao" || cleaned.includes("devol")) {
    return "Devolução";
  }
  if (cleaned === "normal") {
    return "Normal";
  }
  return "";
}

export function extractRowClassificacao(row: unknown): ClassificacaoPalete {
  if (!row || typeof row !== "object") return "";
  const r = row as Record<string, unknown>;
  return normalizeClassificacao(
    r.classificacao ??
    r["classificacao"] ??
    r["Classificação"] ??
    r["Classificacao"] ??
    r.tipo_palete ??
    r["tipo_palete"]
  );
}

export function isDevolucao(rowOrVal: unknown): boolean {
  if (rowOrVal && typeof rowOrVal === "object") {
    return extractRowClassificacao(rowOrVal) === "Devolução";
  }
  return normalizeClassificacao(rowOrVal) === "Devolução";
}

export function normalizePalletId(rawId: unknown): string {
  if (rawId === null || rawId === undefined) return "";
  const s = String(rawId).trim().toUpperCase();
  if (
    !s ||
    s === "NAN" ||
    s === "-" ||
    s === "S/ID" ||
    s === "N/A" ||
    s === "NULL" ||
    s === "UNDEFINED"
  ) {
    return "";
  }
  return s;
}

export function isValidPalletId(rawId: unknown): boolean {
  return normalizePalletId(rawId) !== "";
}

export function normalizeCoord(rawCoord: unknown): string {
  if (rawCoord === null || rawCoord === undefined) return "";
  const s = String(rawCoord).trim().toUpperCase();
  if (!s || s === "-" || s === "NAN" || s === "NULL" || s === "UNDEFINED" || s === "N/A") {
    return "";
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    return String(Math.floor(Number(s)));
  }
  return s;
}

/**
 * REGRA A — Chave de identificação física do palete:
 * Combinação única de:
 *   ID do palete + Profundidade + Nível
 * Nunca agrupa apenas pelo ID.
 */
export function getPalletCountTripletKey(row: Record<string, unknown> | null | undefined): string | null {
  const palletId = normalizePalletId(row?.id_palete ?? row?.["Id Palete"]);
  if (!palletId) return null;
  const profKey = normalizeCoord(row?.profundidade ?? row?.["Profundidade"] ?? row?.pr);
  const nivelKey = normalizeCoord(row?.nivel ?? row?.["Nível"] ?? row?.nv);
  return `${palletId}::P:${profKey}::N:${nivelKey}`;
}

/**
 * REGRA A — Recalcula a contagem física de paletes (`paletes`: 1 ou 0)
 * em uma lista de registros, garantindo:
 *  - Para registros com ID do palete válido: apenas a primeira ocorrência da combinação
 *    (ID do palete + Profundidade + Nível) recebe paletes = 1; repetições recebem 0.
 *  - Para registros sem ID do palete válido: mantém a deduplicação física por
 *    (Posição + Nível + Profundidade) quando houver coordenadas, ou 1 por linha solta.
 *  - Registros vazios (is_empty / qty <= 0 / sem SKU) recebem 0 e não consomem chave.
 */
export function recomputePalletCounts<T extends Record<string, unknown>>(rows: T[]): T[] {
  const seenTriplets = new Set<string>();
  const seenLocationSlots = new Set<string>();

  return rows.map((row) => {
    if (!row || row.is_empty) {
      return { ...row, paletes: 0 };
    }

    const sku = String(row.produto ?? row.sku ?? row["Código"] ?? "").trim();
    const qty = Number(row.quantidade_total ?? row.quantidade ?? row["Quantidade"] ?? 0);
    if (!sku || sku === "-" || sku === "Posição Vazia" || isNaN(qty) || qty <= 0) {
      return { ...row, paletes: 0 };
    }

    const palletId = normalizePalletId(row.id_palete ?? row["Id Palete"]);
    const profKey = normalizeCoord(row.profundidade ?? row["Profundidade"] ?? row.pr);
    const nivelKey = normalizeCoord(row.nivel ?? row["Nível"] ?? row.nv);

    let isFirstOccurrence = false;

    if (palletId) {
      const tripletKey = `${palletId}::P:${profKey}::N:${nivelKey}`;
      if (!seenTriplets.has(tripletKey)) {
        seenTriplets.add(tripletKey);
        isFirstOccurrence = true;
      }
    } else {
      const posId = String(row.posicao ?? row["Posição"] ?? "").trim().toUpperCase();
      if (nivelKey !== "" || profKey !== "") {
        const slotKey = `${posId}::N:${nivelKey}::P:${profKey}`;
        if (!seenLocationSlots.has(slotKey)) {
          seenLocationSlots.add(slotKey);
          isFirstOccurrence = true;
        }
      } else {
        isFirstOccurrence = true;
      }
    }

    const nextPaletes = isFirstOccurrence ? 1 : 0;
    const isInvalidId = !palletId;

    return {
      ...row,
      paletes: nextPaletes,
      fracao_paletes: isInvalidId ? nextPaletes : (row.fracao_paletes ?? nextPaletes),
    };
  });
}

export function isMissingClassificacaoColumnError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  const code = String(e.code || "");
  const msg = String(e.message || e.details || e.hint || "").toLowerCase();
  return (
    (code === "PGRST204" || code === "42703" || msg.includes("schema cache") || msg.includes("does not exist")) &&
    msg.includes("classificacao")
  );
}
