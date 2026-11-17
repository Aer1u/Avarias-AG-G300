// ============================================================
// NEXUS ERP — MapLibrary / unitConverter.ts
// Motor Universal de Conversão de Unidades e Escala Real
// Separa rigorosamente dimensões físicas, escala visual do canvas e zoom.
// Unidade interna canônica de cálculo: METROS (m)
// ============================================================

import type { LengthUnit, PhysicalDimensions, MapObject } from "./types"

// Fatores de conversão para a unidade canônica interna (Metros)
const METERS_FACTOR: Record<LengthUnit, number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
}

// ── Converte qualquer medida para Metros ───────────────────────
export function toMeters(value: number, unit: LengthUnit): number {
  return value * (METERS_FACTOR[unit] || 1)
}

// ── Converte de Metros para a unidade desejada ───────────────
export function fromMeters(meters: number, targetUnit: LengthUnit): number {
  const factor = METERS_FACTOR[targetUnit] || 1
  const result = meters / factor
  // Arredonda para evitar dízimas de ponto flutuante
  if (targetUnit === "mm") return Math.round(result)
  if (targetUnit === "cm") return Math.round(result * 10) / 10
  return Math.round(result * 1000) / 1000 // m com 3 casas decimais (precisão milimétrica)
}

// ── Converte diretamente entre duas unidades ─────────────────
export function convertUnit(value: number, fromUnit: LengthUnit, toUnit: LengthUnit): number {
  if (fromUnit === toUnit) return value
  const meters = toMeters(value, fromUnit)
  return fromMeters(meters, toUnit)
}

// ── Converte Metros Reais para Pixels do Canvas ───────────────
export function realToPixels(meters: number, pixelsPerMeter: number): number {
  return Math.max(1, Math.round(meters * pixelsPerMeter))
}

// ── Converte Pixels do Canvas para Metros Reais ───────────────
export function pixelsToMeters(pixels: number, pixelsPerMeter: number): number {
  const ppm = Math.max(1, pixelsPerMeter)
  return Math.round((pixels / ppm) * 1000) / 1000
}

// ── Converte Pixels do Canvas para a Unidade Alvo ─────────────
export function pixelsToReal(pixels: number, pixelsPerMeter: number, targetUnit: LengthUnit): number {
  const meters = pixelsToMeters(pixels, pixelsPerMeter)
  return fromMeters(meters, targetUnit)
}

// ── Formata medida para exibição amigável ─────────────────────
export function formatMeasurement(value: number, unit: LengthUnit): string {
  if (unit === "mm") return `${Math.round(value)} mm`
  if (unit === "cm") return `${value.toFixed(1)} cm`
  return `${value.toFixed(2)} m`
}

// ── Garante e inicializa PhysicalDimensions para qualquer MapObject ──
export function ensurePhysicalDimensions(
  obj: Partial<MapObject>,
  pixelsPerMeter: number = 20
): PhysicalDimensions {
  if (obj.physicalDimensions) {
    return { ...obj.physicalDimensions }
  }

  const wPx = obj.width || 100
  const lPx = obj.height || 100
  const unit: LengthUnit = "m"

  const widthM = pixelsToMeters(wPx, pixelsPerMeter)
  const lengthM = pixelsToMeters(lPx, pixelsPerMeter)
  // Altura Z padrão estimada para estruturas (ex: 2.5m de altura padrão)
  const defaultHeightM = obj.category === "storage" ? 4.5 : obj.category === "equipment" ? 2.2 : 2.5

  return {
    width: widthM,
    length: lengthM,
    height: defaultHeightM,
    elevationZ: 0,
    unit,
    lockAspectRatio: false,
    minWidth: 0.1,
    maxWidth: 500,
    minLength: 0.1,
    maxLength: 500,
    minHeight: 0.1,
    maxHeight: 50,
  }
}
