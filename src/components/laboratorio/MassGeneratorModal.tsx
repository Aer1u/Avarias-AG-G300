// ============================================================
// NEXUS ERP — laboratorio / MassGeneratorModal.tsx
// Modal de Geração em Massa e Importação de Planilha / CSV
// Gera centenas de drives organizados na grade ou importa lotes reais
// ============================================================

"use client"

import React, { useState, useMemo } from "react"
import type { MapObject } from "../MapLibrary/types"
import { generateMassDrives, parseCsvDrives, type MassGeneratorConfig } from "../MapLibrary/generator"
import { DEFAULT_G300_RULE } from "../MapLibrary/addressing"
import type { SideMode } from "../MapLibrary/addressing"

interface MassGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  onAddObjects: (objects: MapObject[]) => void
}

export default function MassGeneratorModal({
  isOpen,
  onClose,
  onAddObjects,
}: MassGeneratorModalProps) {
  const [tab, setTab] = useState<"generator" | "csv">("generator")

  // Estado do Gerador
  const [chaoCount, setChaoCount] = useState(3)
  const [blocksPerChao, setBlocksPerChao] = useState(2)
  const [drivesPerBlock, setDrivesPerBlock] = useState(16)
  const [prefix, setPrefix] = useState("G300")
  const [startChao, setStartChao] = useState(2)
  const [startDrive, setStartDrive] = useState(28)
  const [sideMode, setSideMode] = useState<SideMode>("G_D")
  const [defaultCapacity, setDefaultCapacity] = useState(16)

  // Estado do CSV
  const [csvText, setCsvText] = useState("")

  // Total de drives previstos no gerador
  const totalPreviewCount = chaoCount * blocksPerChao * drivesPerBlock

  // Pré-visualização em tempo real dos primeiros gerados
  const previewSample = useMemo(() => {
    if (tab !== "generator") return []
    const config: MassGeneratorConfig = {
      chaoCount,
      blocksPerChao,
      drivesPerBlock,
      startChaoNumber: startChao,
      startDriveNumber: startDrive,
      sideMode,
      addressRule: {
        ...DEFAULT_G300_RULE,
        prefix,
      },
      defaultCapacity,
      driveWidth: 50,
      driveHeight: 80,
      spacingX: 12,
      spacingY: 60,
      startX: 60,
      startY: 80,
    }
    return generateMassDrives(config).slice(0, 10)
  }, [tab, chaoCount, blocksPerChao, drivesPerBlock, prefix, startChao, startDrive, sideMode, defaultCapacity])

  if (!isOpen) return null

  const handleConfirmGenerate = () => {
    const config: MassGeneratorConfig = {
      chaoCount,
      blocksPerChao,
      drivesPerBlock,
      startChaoNumber: startChao,
      startDriveNumber: startDrive,
      sideMode,
      addressRule: {
        ...DEFAULT_G300_RULE,
        prefix,
      },
      defaultCapacity,
      driveWidth: 50,
      driveHeight: 80,
      spacingX: 12,
      spacingY: 60,
      startX: 80,
      startY: 80,
    }

    const generated = generateMassDrives(config)
    onAddObjects(generated)
    onClose()
  }

  const handleConfirmCsv = () => {
    if (!csvText.trim()) return
    const imported = parseCsvDrives(csvText, 80, 80)
    onAddObjects(imported)
    onClose()
  }

  const handleLoadSampleCsv = () => {
    const sample = `Codigo;Chao;Bloco;Lado;Capacidade
G300004G0281;004;1;G;16
G300004G0301;004;1;G;20
G300004G0321;004;1;G;16
G300004G0341;004;1;G;12
G300003G0281;003;1;G;16
G300003G0301;003;1;G;16
G300003G0321;003;1;G;20
G300002G0281;002;1;G;12
G300002G0301;002;1;G;16
G300002G0321;002;1;G;16`
    setCsvText(sample)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col text-slate-100 shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Geração & Importação em Massa de Estruturas
            </h3>
            <p className="text-xs text-slate-400">
              Crie dezenas ou centenas de drives de uma vez com padrão de endereçamento universal
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 pt-2 gap-2">
          <button
            onClick={() => setTab("generator")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              tab === "generator"
                ? "border-blue-500 text-blue-400 bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            ⚡ Gerador Automático por Regras
          </button>
          <button
            onClick={() => setTab("csv")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              tab === "csv"
                ? "border-blue-500 text-blue-400 bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📋 Importar Planilha / CSV
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {tab === "generator" ? (
            <>
              {/* Parâmetros do Gerador */}
              <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Prefixo Geral
                  </label>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200 uppercase"
                    placeholder="G300"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Quantidade de Chãos
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={chaoCount}
                    onChange={(e) => setChaoCount(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Chão Inicial
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={startChao}
                    onChange={(e) => setStartChao(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Blocos por Chão
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={blocksPerChao}
                    onChange={(e) => setBlocksPerChao(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Drives por Bloco
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={drivesPerBlock}
                    onChange={(e) => setDrivesPerBlock(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Drive Inicial
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={startDrive}
                    onChange={(e) => setStartDrive(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Convenção de Lados
                  </label>
                  <select
                    value={sideMode}
                    onChange={(e) => setSideMode(e.target.value as SideMode)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                  >
                    <option value="G_D">G / D (Padrão G300)</option>
                    <option value="par_impar">PAR / ÍMPAR</option>
                    <option value="E_D">E / D (Esquerda/Direita)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Capacidade Base
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={defaultCapacity}
                    onChange={(e) => setDefaultCapacity(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div className="flex items-end">
                  <div className="bg-blue-950/60 border border-blue-800/40 rounded p-2 text-center w-full">
                    <span className="text-[10px] text-blue-300 block">Total a Gerar:</span>
                    <span className="text-base font-bold text-white font-mono">{totalPreviewCount} drives</span>
                  </div>
                </div>
              </div>

              {/* Tabela de Pré-visualização dos Primeiros Exemplos */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Pré-visualização dos Primeiros Códigos Gerados
                </span>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2">Código Endereço</th>
                        <th className="p-2">Chão</th>
                        <th className="p-2">Bloco</th>
                        <th className="p-2">Lado</th>
                        <th className="p-2">Capacidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                      {previewSample.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="p-2 font-bold text-amber-400">{item.label}</td>
                          <td className="p-2">{String(item.props.chao)}</td>
                          <td className="p-2">{String(item.props.bloco)}</td>
                          <td className="p-2">{String(item.props.lado)}</td>
                          <td className="p-2">{String(item.props.capacity)} pallets</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Aba CSV */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-slate-400">
                    Cole os dados da sua planilha (Excel / CSV com ; ou vírgula)
                  </span>
                  <button
                    onClick={handleLoadSampleCsv}
                    className="text-[11px] text-blue-400 hover:text-blue-300 underline"
                  >
                    Carregar Exemplo de 10 Drives
                  </button>
                </div>
                <textarea
                  rows={10}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Codigo;Chao;Bloco;Lado;Capacidade&#10;G300004G0281;004;1;G;16&#10;G300004G0301;004;1;G;20..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500">
                  Formato aceito: <code className="text-slate-300 font-mono">Codigo;Chao;Bloco;Lado;Capacidade</code>. O sistema posicionará automaticamente na grade do armazém.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Rodapé com Ações */}
        <div className="p-4 border-t border-slate-800 flex justify-between items-center bg-slate-950/60">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Cancelar
          </button>

          {tab === "generator" ? (
            <button
              onClick={handleConfirmGenerate}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-1.5"
            >
              <span>Gerar {totalPreviewCount} Drives no Mapa</span>
              <span>→</span>
            </button>
          ) : (
            <button
              onClick={handleConfirmCsv}
              disabled={!csvText.trim()}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5"
            >
              <span>Importar para o Mapa</span>
              <span>→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
