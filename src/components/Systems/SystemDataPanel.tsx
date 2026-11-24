// ============================================================
// NEXUS ERP — Systems / SystemDataPanel.tsx
// Painel de Edição de Dados dos Sistemas (Modo Visualização — ADM)
// ESCOPO: Registros · Mapeamento · Confronto
// ============================================================

"use client"

import React, { useState } from "react"
import { X, ChevronRight, Package, Map, GitCompare, Database, ArrowLeft } from "lucide-react"
import { useSystemStore } from "./useSystemStore"
import type { BusinessSystem } from "./types"
import type { MapObject } from "../MapLibrary/types"
import type { DimensionConfig } from "../MapLibrary/dimensionsTypes"
import SystemRecordsModal from "./SystemRecordsModal"
import SystemMappingModal from "./SystemMappingModal"
import SystemConfrontoModal from "./SystemConfrontoModal"
import { isOpenSystem } from "@/lib/systemVisuals"

interface SystemDataPanelProps {
  isOpen: boolean
  onClose: () => void
  allObjects?: MapObject[]
  workspaceId?: string
  levelsConfig?: DimensionConfig
  depthConfig?: DimensionConfig
}

export default function SystemDataPanel({
  isOpen,
  onClose,
  allObjects = [],
  workspaceId,
  levelsConfig,
  depthConfig,
}: SystemDataPanelProps) {
  const { systems } = useSystemStore(workspaceId)

  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null)
  const [isRecordsOpen, setIsRecordsOpen] = useState(false)
  const [isMappingOpen, setIsMappingOpen] = useState(false)
  const [isConfrontoOpen, setIsConfrontoOpen] = useState(false)

  if (!isOpen) return null

  const selectedSystem = systems.find((s) => s.id === selectedSystemId) || null
  const isSelectedOpen = isOpenSystem(selectedSystem)

  const handleClose = () => {
    setSelectedSystemId(null)
    onClose()
  }

  const handleSelectSystem = (sys: BusinessSystem) => {
    setSelectedSystemId(sys.id)
  }

  const handleBack = () => {
    setSelectedSystemId(null)
  }

  return (
    <>
      {/* Painel lateral deslizante */}
      <div className="fixed inset-0 z-[190] flex" onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}>
        {/* Overlay escuro */}
        <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

        {/* Painel */}
        <div className="w-full max-w-sm bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60 shrink-0">
            <div className="flex items-center gap-2">
              {selectedSystem && (
                <button
                  onClick={handleBack}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title="Voltar"
                >
                  <ArrowLeft size={15} />
                </button>
              )}
              <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center">
                <Database size={14} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white">
                  {selectedSystem ? selectedSystem.name : "Sistemas de Dados"}
                </h2>
                <p className="text-[10px] text-slate-500">
                  {selectedSystem ? "Escolha um módulo abaixo" : "Selecione um sistema para gerenciar"}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {!selectedSystem ? (
              // ── Lista de sistemas ────────────────────────────
              <>
                <p className="text-[10px] text-slate-500 px-1 pb-1">
                  {systems.length} sistema{systems.length !== 1 ? "s" : ""} disponíve{systems.length !== 1 ? "is" : "l"}
                </p>
                {systems.map((sys) => {
                  const openSys = isOpenSystem(sys)
                  return (
                    <button
                      key={sys.id}
                      onClick={() => handleSelectSystem(sys)}
                      className="w-full text-left p-3 rounded-xl border border-slate-800 hover:border-slate-600 bg-slate-900/60 hover:bg-slate-800/60 transition-all flex items-center gap-3 group"
                    >
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                        style={{
                          backgroundColor: `${sys.color}20`,
                          border: `1.5px solid ${sys.color}50`,
                        }}
                      >
                        {sys.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sys.color }} />
                          <span className="text-xs font-bold text-white truncate">{sys.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                            {sys.code}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">{sys.description}</p>
                        <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-600">
                          {openSys ? (
                            <span className="px-1.5 py-0.5 rounded font-semibold border bg-emerald-950/60 border-emerald-700/60 text-emerald-300">
                              Sistema Aberto
                            </span>
                          ) : (
                            <span
                              className={`px-1.5 py-0.5 rounded font-semibold border ${
                                sys.defaultControlMode === "vinculado_saldo"
                                  ? "bg-blue-950/60 border-blue-800/60 text-blue-400"
                                  : "bg-slate-800 border-slate-700 text-slate-500"
                              }`}
                            >
                              {sys.defaultControlMode === "vinculado_saldo" ? "Saldo Obrig." : "Livre"}
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold border ${
                              sys.status === "ativo"
                                ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-400"
                                : "bg-amber-950/60 border-amber-800/60 text-amber-400"
                            }`}
                          >
                            {sys.status === "ativo" ? "Ativo" : sys.status === "configuracao" ? "Em Config." : "Inativo"}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={15} className="text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
                    </button>
                  )
                })}

                {systems.length === 0 && (
                  <div className="p-8 text-center text-slate-500 space-y-2">
                    <Package size={28} className="mx-auto text-slate-700" />
                    <p className="text-xs">Nenhum sistema configurado.</p>
                    <p className="text-[10px] text-slate-600">
                      Ative o Modo Edição para criar sistemas.
                    </p>
                  </div>
                )}
              </>
            ) : (
              // ── Módulos do sistema selecionado ───────────────
              <div className="space-y-2">
                {/* Info do sistema */}
                <div
                  className="flex items-center gap-3 p-3 rounded-xl border"
                  style={{
                    backgroundColor: `${selectedSystem.color}14`,
                    borderColor: `${selectedSystem.color}45`,
                  }}
                >
                  <span className="text-2xl">{selectedSystem.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-white truncate">{selectedSystem.name}</p>
                      {isSelectedOpen && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
                          Aberto
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">{selectedSystem.code}</p>
                    {!isSelectedOpen && selectedSystem.originStorageLabel && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        📍 Origem: {selectedSystem.originStorageLabel}
                      </p>
                    )}
                    {isSelectedOpen && (
                      <p className="text-[10px] text-emerald-300/80 mt-0.5">
                        Sem registros · Mapeamento direto + Confronto
                      </p>
                    )}
                  </div>
                </div>

                {/* Divisória */}
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 pt-2">
                  Módulos Operacionais
                </p>

                {/* 1. Registros (apenas para sistemas completos) */}
                {!isSelectedOpen && (
                  <button
                    onClick={() => setIsRecordsOpen(true)}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-800 hover:border-blue-500/60 bg-slate-950/60 hover:bg-blue-950/20 transition-all group flex items-start gap-3"
                  >
                    <div className="p-2 rounded-lg bg-blue-950 border border-blue-800/60 shrink-0 group-hover:bg-blue-900 transition-colors">
                      <Package size={16} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                        1. Registros de Saldo
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                        Movimentação geral, lançamentos e controle de saldos físicos.
                      </p>
                    </div>
                    <ChevronRight size={15} className="text-blue-500/50 group-hover:text-blue-400 transition-colors shrink-0 mt-0.5" />
                  </button>
                )}

                {/* Mapeamento */}
                <button
                  onClick={() => setIsMappingOpen(true)}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-800 hover:border-purple-500/60 bg-slate-950/60 hover:bg-purple-950/20 transition-all group flex items-start gap-3"
                >
                  <div className="p-2 rounded-lg bg-purple-950 border border-purple-800/60 shrink-0 group-hover:bg-purple-900 transition-colors">
                    <Map size={16} className="text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                      {isSelectedOpen ? "1. Mapeamento de Posições" : "2. Mapeamento de Posições"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                      Vincular posições físicas, Drives, Ruas e Áreas ao sistema.
                    </p>
                  </div>
                  <ChevronRight size={15} className="text-purple-500/50 group-hover:text-purple-400 transition-colors shrink-0 mt-0.5" />
                </button>

                {/* Confronto */}
                <button
                  onClick={() => setIsConfrontoOpen(true)}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-800 hover:border-amber-500/60 bg-slate-950/60 hover:bg-amber-950/20 transition-all group flex items-start gap-3"
                >
                  <div className="p-2 rounded-lg bg-amber-950 border border-amber-800/60 shrink-0 group-hover:bg-amber-900 transition-colors">
                    <GitCompare size={16} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      {isSelectedOpen ? "2. Confronto Analítico" : "3. Confronto Analítico"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                      {isSelectedOpen
                        ? "Conciliar saldo mapeado nas posições com relação importada."
                        : "Importar e conciliar saldos físicos com inventário do sistema."}
                    </p>
                  </div>
                  <ChevronRight size={15} className="text-amber-500/50 group-hover:text-amber-400 transition-colors shrink-0 mt-0.5" />
                </button>

                {/* Info: saldo por posição */}
                {(selectedSystem.participants?.length ?? 0) > 0 && (
                  <div className="mt-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Posições Vinculadas ({selectedSystem.participants?.length})
                    </p>
                    <div className="space-y-1">
                      {selectedSystem.participants?.slice(0, 5).map((p) => (
                        <div
                          key={p.storageObjectId}
                          className="flex items-center justify-between text-[10px] py-1 border-b border-slate-800/60 last:border-0"
                        >
                          <span className="text-slate-300 font-mono truncate">{p.storageObjectLabel}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              p.stockControlMode === "vinculado_saldo"
                                ? "bg-blue-950 text-blue-400"
                                : "bg-slate-800 text-slate-500"
                            }`}
                          >
                            {p.stockControlMode === "vinculado_saldo" ? "Saldo" : "Livre"}
                          </span>
                        </div>
                      ))}
                      {(selectedSystem.participants?.length ?? 0) > 5 && (
                        <p className="text-[10px] text-slate-600 pt-1">
                          +{(selectedSystem.participants?.length ?? 0) - 5} mais posições...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modais (apenas quando um sistema está selecionado) */}
      {selectedSystem && (
        <>
          <SystemRecordsModal
            isOpen={isRecordsOpen}
            onClose={() => setIsRecordsOpen(false)}
            system={selectedSystem}
            allObjects={allObjects}
          />
          <SystemMappingModal
            isOpen={isMappingOpen}
            onClose={() => setIsMappingOpen(false)}
            system={selectedSystem}
            allObjects={allObjects}
            workspaceId={workspaceId}
            levelsConfig={levelsConfig}
            depthConfig={depthConfig}
          />
          <SystemConfrontoModal
            isOpen={isConfrontoOpen}
            onClose={() => setIsConfrontoOpen(false)}
            system={selectedSystem}
          />
        </>
      )}
    </>
  )
}
