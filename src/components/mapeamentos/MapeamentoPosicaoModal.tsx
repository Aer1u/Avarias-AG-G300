"use client"

import React, { useState, useEffect } from "react"
import {
  X,
  Plus,
  Trash2,
  Warehouse,
  Sparkles,
  Save,
  Check,
} from "lucide-react"
import { motion } from "framer-motion"
import {
  MapeamentoConfig,
  MapeamentoPosicao,
} from "@/lib/mapeamentosStorage"

interface MapeamentoPosicaoModalProps {
  isOpen: boolean
  onClose: () => void
  config: MapeamentoConfig
  posicoesAtuais: MapeamentoPosicao[]
  onSavePosicao: (pos: MapeamentoPosicao) => Promise<void>
  onBulkSavePosicoes: (posicoes: MapeamentoPosicao[]) => Promise<void>
  onDeletePosicao: (posId: string) => Promise<void>
}

interface EditableRow {
  id: string
  codigo: string
  tipo: "chao" | "drive_in"
  setor: string
  capacidade: number
  nivelCount: number
  profundidadeCount: number
  isNew?: boolean
}

export function MapeamentoPosicaoModal({
  isOpen,
  onClose,
  config,
  posicoesAtuais,
  onBulkSavePosicoes,
  onDeletePosicao,
}: MapeamentoPosicaoModalProps) {
  const [rows, setRows] = useState<EditableRow[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [showBatchBar, setShowBatchBar] = useState(false)

  // Gerador rápido
  const [batchPrefix, setBatchPrefix] = useState("CHAO-")
  const [batchStart, setBatchStart] = useState(1)
  const [batchEnd, setBatchEnd] = useState(10)
  const [batchType, setBatchType] = useState<"chao" | "drive_in">("chao")
  const [batchSetor, setBatchSetor] = useState("Área de Chão")
  const [batchCap, setBatchCap] = useState(10)

  // Carrega posições na tabela
  useEffect(() => {
    if (isOpen) {
      if (posicoesAtuais.length > 0) {
        setRows(
          posicoesAtuais.map(p => ({
            id: p.id,
            codigo: p.codigo,
            tipo: p.tipo === "drive_in" ? "drive_in" : "chao",
            setor: p.setor || (p.tipo === "chao" ? "Área de Chão" : "Rua"),
            capacidade: p.capacidade || 10,
            nivelCount: p.nivelCount || (p.tipo === "drive_in" ? 3 : 1),
            profundidadeCount: p.profundidadeCount || (p.tipo === "drive_in" ? 4 : 10),
          }))
        )
      } else {
        // Inicia com 3 linhas vazias de exemplo para preenchimento rápido
        setRows([
          {
            id: "row_1",
            codigo: "CHAO-01",
            tipo: "chao",
            setor: "Área de Chão",
            capacidade: 10,
            nivelCount: 1,
            profundidadeCount: 10,
            isNew: true,
          },
          {
            id: "row_2",
            codigo: "CHAO-02",
            tipo: "chao",
            setor: "Área de Chão",
            capacidade: 10,
            nivelCount: 1,
            profundidadeCount: 10,
            isNew: true,
          },
        ])
      }
    }
  }, [isOpen, posicoesAtuais])

  if (!isOpen) return null

  const handleAddRow = () => {
    const nextNum = rows.length + 1
    const pad = String(nextNum).padStart(2, "0")
    setRows(prev => [
      ...prev,
      {
        id: "new_" + Math.random().toString(36).substring(2, 9),
        codigo: `CHAO-${pad}`,
        tipo: "chao",
        setor: "Área de Chão",
        capacidade: 10,
        nivelCount: 1,
        profundidadeCount: 10,
        isNew: true,
      },
    ])
  }

  const handleUpdateRow = (id: string, field: keyof EditableRow, value: any) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== id) return r
        const updated = { ...r, [field]: value }
        if (field === "tipo") {
          if (value === "chao") {
            updated.nivelCount = 1
            updated.profundidadeCount = updated.capacidade || 10
            if (updated.setor === "Rua 1F") updated.setor = "Área de Chão"
          } else {
            updated.nivelCount = 3
            updated.profundidadeCount = 4
            updated.capacidade = 12
            if (updated.setor === "Área de Chão") updated.setor = "Rua 1F"
          }
        }
        return updated
      })
    )
  }

  const handleRemoveRow = async (id: string) => {
    const existing = posicoesAtuais.find(p => p.id === id)
    if (existing) {
      await onDeletePosicao(id)
    }
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const handleGenerateBatch = () => {
    if (batchEnd < batchStart) {
      alert("O número final não pode ser menor que o inicial.")
      return
    }

    const newGenerated: EditableRow[] = []
    for (let i = batchStart; i <= batchEnd; i++) {
      const pad = String(i).padStart(2, "0")
      const code = `${batchPrefix}${pad}`
      newGenerated.push({
        id: "batch_" + Math.random().toString(36).substring(2, 9) + `_${i}`,
        codigo: code,
        tipo: batchType,
        setor: batchSetor,
        capacidade: batchCap,
        nivelCount: batchType === "drive_in" ? 3 : 1,
        profundidadeCount: batchType === "drive_in" ? 4 : batchCap,
        isNew: true,
      })
    }

    setRows(prev => [...prev, ...newGenerated])
    setShowBatchBar(false)
  }

  const handleSaveAll = async () => {
    const validRows = rows.filter(r => r.codigo.trim() !== "")
    if (validRows.length === 0) {
      alert("Adicione ao menos uma posição com código preenchido.")
      return
    }

    setIsSaving(true)
    try {
      const posicoesToSave: MapeamentoPosicao[] = validRows.map(r => ({
        id: r.id.startsWith("new_") || r.id.startsWith("batch_") || r.id.startsWith("row_")
          ? "pos_" + Math.random().toString(36).substring(2, 9)
          : r.id,
        mapeamentoId: config.id,
        codigo: r.codigo.trim().toUpperCase(),
        tipo: r.tipo,
        capacidade: Number(r.capacidade) || (r.tipo === "drive_in" ? 16 : 10),
        nivelCount: r.tipo === "drive_in" ? Number(r.nivelCount) || 3 : 1,
        profundidadeCount:
          r.tipo === "drive_in"
            ? Number(r.profundidadeCount) || 4
            : Number(r.capacidade) || 10,
        setor: r.setor.trim() || (r.tipo === "chao" ? "Área de Chão" : "Rua"),
        status: "Aberto",
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      }))

      await onBulkSavePosicoes(posicoesToSave)
      onClose()
    } catch (err) {
      console.error("Erro ao salvar posições:", err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header Superior */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Warehouse size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Cadastrar Posições do Mapeamento
                </h3>
                <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-mono">
                  {rows.length} posições
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Mapeamento: <strong className="text-slate-200">{config.nome}</strong> • Edite ou adicione posições diretamente na tabela.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBatchBar(!showBatchBar)}
              className="px-3 py-1.5 rounded-xl border border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles size={14} className="text-blue-400" />
              <span>Gerar Sequência</span>
            </button>

            <button
              onClick={handleAddRow}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Plus size={14} />
              <span>+ Adicionar Linha</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barra de Geração Rápida em Lote (Expansível) */}
        {showBatchBar && (
          <div className="p-4 bg-slate-950 border-b border-slate-800 shrink-0">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-bold text-blue-400 uppercase text-[11px] flex items-center gap-1">
                <Sparkles size={13} /> Gerar Várias:
              </span>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">Prefixo:</span>
                <input
                  type="text"
                  value={batchPrefix}
                  onChange={e => setBatchPrefix(e.target.value.toUpperCase())}
                  placeholder="CHAO-"
                  className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white font-mono text-xs uppercase"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">De:</span>
                <input
                  type="number"
                  min={1}
                  value={batchStart}
                  onChange={e => setBatchStart(Number(e.target.value))}
                  className="w-14 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">Até:</span>
                <input
                  type="number"
                  min={batchStart}
                  value={batchEnd}
                  onChange={e => setBatchEnd(Number(e.target.value))}
                  className="w-14 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">Tipo:</span>
                <select
                  value={batchType}
                  onChange={e => {
                    const t = e.target.value as "chao" | "drive_in"
                    setBatchType(t)
                    setBatchSetor(t === "chao" ? "Área de Chão" : "Rua 1F")
                    setBatchCap(t === "chao" ? 10 : 12)
                  }}
                  className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs cursor-pointer"
                >
                  <option value="chao">Chão / Blocado</option>
                  <option value="drive_in">Drive-In / Estante</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">Setor:</span>
                <input
                  type="text"
                  value={batchSetor}
                  onChange={e => setBatchSetor(e.target.value)}
                  className="w-28 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateBatch}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-xs ml-auto transition-colors cursor-pointer"
              >
                + Inserir na Tabela ({Math.max(0, batchEnd - batchStart + 1)})
              </button>
            </div>
          </div>
        )}

        {/* Tabela Editável de Posições */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] bg-slate-950/40">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 w-[28%]">Código da Posição *</th>
                <th className="py-2.5 px-3 w-[22%]">Tipo de Estrutura</th>
                <th className="py-2.5 px-3 w-[24%]">Setor / Rua / Área</th>
                <th className="py-2.5 px-3 w-[16%]">Capacidade (PTs)</th>
                <th className="py-2.5 px-3 w-10 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row, index) => (
                <tr key={row.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">
                    {index + 1}
                  </td>

                  {/* Código */}
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={row.codigo}
                      onChange={e => handleUpdateRow(row.id, "codigo", e.target.value.toUpperCase())}
                      placeholder="Ex: CHAO-01, 01F0011"
                      className="w-full h-8 px-2.5 bg-slate-800 border border-slate-700 rounded text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500 uppercase"
                    />
                  </td>

                  {/* Tipo */}
                  <td className="py-2 px-3">
                    <select
                      value={row.tipo}
                      onChange={e => handleUpdateRow(row.id, "tipo", e.target.value)}
                      className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="chao">Chão / Blocado (Solo)</option>
                      <option value="drive_in">Drive-In / Porta-Palete</option>
                    </select>
                  </td>

                  {/* Setor */}
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={row.setor}
                      onChange={e => handleUpdateRow(row.id, "setor", e.target.value)}
                      placeholder="Ex: Área de Chão, Rua 1F..."
                      className="w-full h-8 px-2.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </td>

                  {/* Capacidade */}
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={row.capacidade}
                      onChange={e => handleUpdateRow(row.id, "capacidade", Number(e.target.value))}
                      className="w-full h-8 px-2.5 bg-slate-800 border border-slate-700 rounded text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                    />
                  </td>

                  {/* Remover Linha */}
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors cursor-pointer"
                      title="Excluir posição"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Nenhuma posição nesta tabela. Clique em &quot;+ Adicionar Linha&quot; ou &quot;Gerar Sequência&quot; acima.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer com Botão de Salvar Tudo */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="px-3.5 py-2 rounded-xl border border-dashed border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Adicionar Nova Linha
            </button>
            <span className="text-[11px] text-slate-500">
              Preencha os códigos e clique em salvar para registrar no armazém.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isSaving || rows.length === 0}
              onClick={handleSaveAll}
              className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              {isSaving ? (
                <>Salvando...</>
              ) : (
                <>
                  <Save size={15} /> Salvar {rows.length} Posições
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
