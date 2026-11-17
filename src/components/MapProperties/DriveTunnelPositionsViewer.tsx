// ============================================================
// NEXUS ERP — MapProperties / DriveTunnelPositionsViewer.tsx
// Visualizador e Inspetor Estrutural de Endereçamento do Drive-In
// Modo Mapeamento & Configuração: exibe o corte lateral com Níveis x
// Profundidades e resolução dos endereços padronizados por canal.
// ============================================================

"use client"

import React, { useState, useMemo } from "react"
import type { StructurePositionSlot, DimensionConfig, StorageChannel } from "../MapLibrary/dimensionsTypes"
import { generateDrivePositionsMatrix } from "../MapLibrary/dimensionManager"

interface DriveTunnelPositionsViewerProps {
  structureId: string
  structureCode: string
  levelsCount: number
  depthCount: number
  capacity: number
  levelsConfig: DimensionConfig
  depthConfig: DimensionConfig
  channels?: StorageChannel[]
  onSelectSlot?: (slot: StructurePositionSlot) => void
  onSelectChannel?: (channel: StorageChannel | null) => void
}

export default function DriveTunnelPositionsViewer({
  structureId,
  structureCode,
  levelsCount,
  depthCount,
  capacity,
  levelsConfig,
  depthConfig,
  channels = [],
  onSelectSlot,
  onSelectChannel,
}: DriveTunnelPositionsViewerProps) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    channels.length > 0 ? channels[0].id : null
  )

  const activeChannel = useMemo(() => {
    return channels.find((c) => c.id === selectedChannelId) || null
  }, [channels, selectedChannelId])

  // Código base do canal ou da estrutura
  const effectiveCode = activeChannel ? activeChannel.code : structureCode

  // Gera a matriz tridimensional de slots para mapeamento
  const matrix = useMemo(() => {
    return generateDrivePositionsMatrix(
      structureId,
      effectiveCode,
      levelsCount,
      depthCount,
      levelsConfig,
      depthConfig,
      0, // Zero ocupação operacional no modo Mapeamento
      [] // Zero ocorrências operacionais no modo Mapeamento
    )
  }, [
    structureId,
    effectiveCode,
    levelsCount,
    depthCount,
    levelsConfig,
    depthConfig,
  ])

  // Acha o slot selecionado
  const selectedSlot = useMemo(() => {
    for (const row of matrix) {
      for (const slot of row) {
        if (slot.id === selectedSlotId) return slot
      }
    }
    return null
  }, [matrix, selectedSlotId])

  return (
    <div className="space-y-2.5 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80 select-none">
      {/* Cabeçalho do Inspetor de Endereçamento */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Inspetor de Endereçamento Estrutural
          </span>
          <p className="text-[9px] text-slate-500">
            {activeChannel ? `${activeChannel.name} · ` : ""}
            {levelsCount} Níveis × {depthCount} Profundidades = {levelsCount * depthCount} posições nominais
          </p>
        </div>
        <span className="text-[9px] bg-slate-800 text-slate-300 font-mono px-1.5 py-0.5 rounded border border-slate-700/60">
          Modo Configuração
        </span>
      </div>

      {/* Seletor de Canais */}
      {channels.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-800/60">
          <span className="text-[9px] uppercase font-bold text-slate-400 shrink-0 mr-1">
            Canal:
          </span>
          {channels.map((chan) => {
            const isChanSelected = chan.id === selectedChannelId
            return (
              <button
                key={chan.id}
                onClick={() => {
                  setSelectedChannelId(chan.id)
                  onSelectChannel?.(chan)
                  setSelectedSlotId(null)
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors shrink-0 flex items-center gap-1 ${
                  isChanSelected
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <span>🏷️</span>
                <span>{chan.name}</span>
                <span className="text-[9px] opacity-75">({chan.capacity}v)</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Grid de Corte Lateral dos Endereços */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-block min-w-full">
          {/* Cabeçalho de Profundidade */}
          <div className="flex items-center gap-1 mb-1 pl-12 text-[9px] text-slate-500 font-mono">
            {Array.from({ length: depthCount }).map((_, dIdx) => {
              const item = depthConfig.items[dIdx]
              const idf = item ? item.identifier : String(dIdx + 1)
              return (
                <div key={dIdx} className="flex-1 text-center min-w-[34px]">
                  P.{idf}
                </div>
              )
            })}
          </div>

          {/* Linhas de Níveis */}
          <div className="space-y-1">
            {matrix.map((row, rIdx) => {
              const levelIdentifier = row[0]?.levelIdentifier || String(levelsCount - rIdx)
              return (
                <div key={rIdx} className="flex items-center gap-1">
                  {/* Identificador do Nível na Esquerda */}
                  <div className="w-11 text-right pr-1 text-[10px] font-bold text-slate-400 font-mono shrink-0">
                    Nív.{levelIdentifier}
                  </div>

                  {/* Células de Posição Estrutural */}
                  <div className="flex-1 flex gap-1">
                    {row.map((slot) => {
                      const isSelected = selectedSlotId === slot.id
                      return (
                        <button
                          key={slot.id}
                          onClick={() => {
                            setSelectedSlotId(slot.id)
                            onSelectSlot?.(slot)
                          }}
                          className={`flex-1 h-7 min-w-[34px] rounded border flex flex-col items-center justify-center transition-all bg-slate-950/70 border-slate-800 text-slate-400 hover:border-amber-500/60 hover:text-amber-300 ${
                            isSelected ? "ring-2 ring-amber-400 border-amber-500 text-amber-300 bg-amber-950/30 font-bold" : ""
                          }`}
                          title={`Posição Estrutural ${slot.positionCode}`}
                        >
                          <span className="text-[9px] font-mono leading-none">
                            {slot.depthIdentifier}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Indicação de Sentido da Entrada */}
          <div className="flex items-center justify-between text-[9px] text-amber-500/80 pt-1.5 px-1 border-t border-slate-800/60 mt-1.5">
            <span>⬇️ Entrada do Túnel (Vão Frontal)</span>
            <span>Fundo da Estrutura ⬆️</span>
          </div>
        </div>
      </div>

      {/* Detalhe da Posição Estrutural Inspecionada */}
      {selectedSlot && (
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[10px] space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Endereço Configurado:</span>
            <span className="font-mono font-bold text-amber-400 text-xs">{selectedSlot.positionCode}</span>
          </div>
          {activeChannel && (
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Canal Associado:</span>
              <span className="text-slate-200 font-medium">{activeChannel.name} ({activeChannel.code})</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Coordenadas de Armazenagem:</span>
            <span className="text-slate-300 font-mono">
              Nível {selectedSlot.levelIdentifier} · Profundidade {selectedSlot.depthIdentifier}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Destinação da Posição:</span>
            <span className="text-emerald-400 font-semibold uppercase text-[9px]">
              Posição Nominal Válida
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
