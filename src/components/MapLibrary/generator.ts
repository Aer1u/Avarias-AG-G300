// ============================================================
// NEXUS ERP — MapLibrary / generator.ts
// Motor de Geração e Importação em Massa de Estruturas Físicas
// Permite criar centenas de drives/posições com endereçamento dinâmico,
// lados pares/ímpares, capacidades individuais e layout automático.
// ============================================================

import type { MapObject } from "./types"
import { formatAddressCode, resolveSide, type SideMode } from "./addressing"
import type { AddressingRuleConfig } from "./modulesTypes"

export interface MassGeneratorConfig {
  chaoCount: number             // quantidade de chãos / corredores
  blocksPerChao: number         // blocos por chão
  drivesPerBlock: number        // drives por bloco
  startChaoNumber: number       // número inicial de chão (ex: 2 para Chão 002, 003, 004)
  startDriveNumber: number      // número inicial de drive (ex: 28)
  sideMode: SideMode            // "par_impar" | "G_D" | "E_D" | "custom"
  addressRule: AddressingRuleConfig
  defaultCapacity: number       // capacidade padrão (ex: 16 pallets)
  // Exceções de capacidade por índice ou regra
  capacityExceptions?: { indexOrModulo: number; capacity: number }[]
  // Geometria padrão no canvas
  driveWidth: number            // largura visual (ex: 50)
  driveHeight: number           // altura visual (ex: 80)
  spacingX: number              // espaçamento entre drives adjacentes (ex: 12)
  spacingY: number              // espaçamento entre chãos/ruas (ex: 60)
  startX: number
  startY: number
}

// ── Gerador Automático em Massa ─────────────────────────────
export function generateMassDrives(config: MassGeneratorConfig): MapObject[] {
  const generated: MapObject[] = []
  let globalIndex = 0

  const {
    chaoCount,
    blocksPerChao,
    drivesPerBlock,
    startChaoNumber,
    startDriveNumber,
    sideMode,
    addressRule,
    defaultCapacity,
    driveWidth,
    driveHeight,
    spacingX,
    spacingY,
    startX,
    startY,
  } = config

  for (let c = 0; c < chaoCount; c++) {
    const chaoNum = startChaoNumber + c
    const chaoY = startY + c * (driveHeight * 2 + spacingY)

    for (let b = 0; b < blocksPerChao; b++) {
      const blocoNum = b + 1

      for (let d = 0; d < drivesPerBlock; d++) {
        const driveSeq = startDriveNumber + (b * drivesPerBlock + d) * 2 // saltos pares/ímpares se aplicável
        const side = resolveSide(d, sideMode)

        // Calcula código com o padrão configurado
        const code = formatAddressCode(
          {
            prefix: addressRule.prefix,
            chaoOrCorredor: chaoNum,
            bloco: blocoNum,
            lado: side,
            driveOuPosicao: driveSeq,
          },
          addressRule
        )

        // Calcula capacidade individual permitindo exceções (não uniforme!)
        let capacity = defaultCapacity
        // Exemplo: se o índice for múltiplo ou configurado, altera
        if (config.capacityExceptions && config.capacityExceptions.length > 0) {
          const exc = config.capacityExceptions.find(
            (e) => e.indexOrModulo === globalIndex || globalIndex % e.indexOrModulo === 0
          )
          if (exc) capacity = exc.capacity
        } else {
          // Variação orgânica real: a cada 4 drives, varia entre 12, 16 e 20 pallets
          if (globalIndex % 5 === 0) capacity = 20
          else if (globalIndex % 3 === 0) capacity = 12
          else capacity = 16
        }

        // Distribuição visual em corredores (lado superior e lado inferior do chão)
        const isUpperSide = d % 2 === 0
        const colIndex = Math.floor(d / 2) + b * Math.ceil(drivesPerBlock / 2)
        const posX = startX + colIndex * (driveWidth + spacingX)
        const posY = isUpperSide ? chaoY : chaoY + driveHeight + 20

        const driveObject: MapObject = {
          id: `drive_${code}_${crypto.randomUUID().slice(0, 6)}`,
          type: "drive_in",
          category: "storage",
          x: posX,
          y: posY,
          width: driveWidth,
          height: driveHeight,
          rotation: isUpperSide ? 180 : 0,
          locked: false,
          visible: true,
          layerId: "storage",
          label: code,
          props: {
            code,
            name: `Drive ${code}`,
            chao: String(chaoNum).padStart(addressRule.aisleLength, "0"),
            bloco: String(blocoNum),
            lado: side,
            capacity,
            positions: Math.ceil(capacity / 4),
            levels: 4,
            currentOccupancy: Math.floor(Math.random() * (capacity + 1)), // ocupação simulada
            status: "operacional", // "operacional" | "bloqueado" | "manutencao"
            lanes: 1,
            depth: Math.ceil(capacity / 4),
          },
        }

        generated.push(driveObject)
        globalIndex++
      }
    }
  }

  return generated
}

// ── Parser de Importação CSV / Planilha ───────────────────────
export interface CsvDriveRow {
  code: string
  chao?: string
  bloco?: string
  lado?: string
  capacity?: number
  width?: number
  height?: number
}

export function parseCsvDrives(
  csvText: string,
  startX = 100,
  startY = 100
): MapObject[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  // Detecta se a 1ª linha é cabeçalho
  const firstLine = lines[0].toLowerCase()
  const hasHeader =
    firstLine.includes("codigo") ||
    firstLine.includes("code") ||
    firstLine.includes("drive") ||
    firstLine.includes("endereco")

  const dataLines = hasHeader ? lines.slice(1) : lines

  const imported: MapObject[] = []
  let col = 0
  let row = 0
  const maxCols = 10

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]
    // Separa por ponto-e-vírgula, vírgula ou tabulação
    const parts = line.split(/[;,\t]/).map((p) => p.trim())
    const code = parts[0]
    if (!code) continue

    const chao = parts[1] || ""
    const bloco = parts[2] || ""
    const lado = parts[3] || ""
    const capacity = parts[4] ? Number(parts[4]) : 16

    const dW = 50
    const dH = 80
    const x = startX + col * (dW + 14)
    const y = startY + row * (dH + 24)

    imported.push({
      id: `drive_${code}_${crypto.randomUUID().slice(0, 6)}`,
      type: "drive_in",
      category: "storage",
      x,
      y,
      width: dW,
      height: dH,
      rotation: 0,
      locked: false,
      visible: true,
      layerId: "storage",
      label: code,
      props: {
        code,
        name: `Drive ${code}`,
        chao,
        bloco,
        lado,
        capacity,
        positions: Math.ceil(capacity / 4),
        levels: 4,
        currentOccupancy: 0,
        status: "operacional",
        lanes: 1,
        depth: Math.ceil(capacity / 4),
      },
    })

    col++
    if (col >= maxCols) {
      col = 0
      row++
    }
  }

  return imported
}
