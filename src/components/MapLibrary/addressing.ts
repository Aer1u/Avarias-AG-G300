// ============================================================
// NEXUS ERP — MapLibrary / addressing.ts
// Motor Universal de Endereçamento Logístico
// Suporta composição por templates, prefixos, blocos, lados (par/ímpar)
// e preservação estrita de códigos existentes (ex: G300004G0281)
// ============================================================

import type { AddressingRuleConfig } from "./modulesTypes"

export interface AddressSegments {
  prefix: string
  chaoOrCorredor: string | number
  bloco?: string | number
  lado?: string
  driveOuPosicao: string | number
}

// ── Padrão Pré-configurado G300 (Avarias) ────────────────────
export const DEFAULT_G300_RULE: AddressingRuleConfig = {
  id: "rule_g300",
  name: "Padrão Avarias G300",
  prefix: "G300",
  aisleLength: 3,
  sideType: "letra",
  blockDigits: 2,
  seqDigits: 3,
  separator: "",
  examplePreview: "G300004G0281",
}

// ── Formatador Universal de Endereço ────────────────────────
export function formatAddressCode(
  segments: AddressSegments,
  rule: AddressingRuleConfig = DEFAULT_G300_RULE
): string {
  const pfx = segments.prefix || rule.prefix || ""
  const chaoStr = String(segments.chaoOrCorredor).padStart(rule.aisleLength, "0")
  const ladoStr = segments.lado ? String(segments.lado).toUpperCase() : ""
  const blocoStr = segments.bloco !== undefined
    ? String(segments.bloco).padStart(rule.blockDigits, "0")
    : ""
  const seqStr = String(segments.driveOuPosicao).padStart(rule.seqDigits, "0")

  const sep = rule.separator || ""

  // Montagem conforme a regra
  const parts = [pfx, chaoStr, ladoStr, blocoStr, seqStr].filter(Boolean)
  return parts.join(sep)
}

// ── Decompositor / Parser Inteligente ───────────────────────
export function parseAddressCode(
  code: string,
  prefix: string = "G300"
): AddressSegments {
  const clean = code.trim().toUpperCase()

  // Caso especial padrão G300: ex G300004G0281
  // G300 (4 chars) + 004 (chão, 3 chars) + G (lado, 1 char) + 0281 (drive, 4 chars)
  if (clean.startsWith(prefix) && clean.length >= prefix.length + 8) {
    const afterPfx = clean.slice(prefix.length)
    const chao = afterPfx.slice(0, 3)
    const lado = afterPfx.slice(3, 4)
    const rest = afterPfx.slice(4)

    return {
      prefix,
      chaoOrCorredor: chao,
      lado,
      driveOuPosicao: rest,
    }
  }

  // Fallback genérico se houver hífen: ex RUA-01-PAR-D04
  if (clean.includes("-")) {
    const tokens = clean.split("-")
    return {
      prefix: tokens[0] || "",
      chaoOrCorredor: tokens[1] || "01",
      lado: tokens[2] || "",
      driveOuPosicao: tokens[tokens.length - 1] || "01",
    }
  }

  return {
    prefix: "",
    chaoOrCorredor: "01",
    driveOuPosicao: clean,
  }
}

// ── Gerador de Lado (Par / Ímpar / Letras / Direções) ────────
export type SideMode = "par_impar" | "G_D" | "E_D" | "custom"

export function resolveSide(
  index: number,
  mode: SideMode = "par_impar",
  customLeft = "E",
  customRight = "D"
): string {
  const isEven = index % 2 === 0

  switch (mode) {
    case "par_impar":
      return isEven ? "PAR" : "ÍMPAR"
    case "G_D":
      return isEven ? "G" : "D"
    case "E_D":
      return isEven ? "E" : "D"
    case "custom":
      return isEven ? customLeft : customRight
    default:
      return isEven ? "PAR" : "ÍMPAR"
  }
}
