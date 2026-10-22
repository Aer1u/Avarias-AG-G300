"use client"

import React, { useState, useEffect } from "react"
import { X, Plus, Trash2, Settings, Layers, Tag } from "lucide-react"
import { motion } from "framer-motion"
import { MapeamentoConfig, CustomField } from "@/lib/mapeamentosStorage"

interface MapeamentoConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: MapeamentoConfig) => void
  initialConfig?: MapeamentoConfig | null
}

export function MapeamentoConfigModal({
  isOpen,
  onClose,
  onSave,
  initialConfig,
}: MapeamentoConfigModalProps) {
  const [nome, setNome] = useState("")
  const [observacoes, setObservacoes] = useState("")
  const [campos, setCampos] = useState<CustomField[]>([])

  // Estado para novo campo customizado
  const [novoCampoNome, setNovoCampoNome] = useState("")
  const [novoCampoTipo, setNovoCampoTipo] = useState<CustomField["tipo"]>("text")
  const [novoCampoOpcoes, setNovoCampoOpcoes] = useState("")
  const [novoCampoObrigatorio, setNovoCampoObrigatorio] = useState(false)

  useEffect(() => {
    if (initialConfig) {
      setNome(initialConfig.nome || "")
      setObservacoes(initialConfig.observacoes || "")
      setCampos(initialConfig.camposPersonalizados || [])
    } else {
      setNome("")
      setObservacoes("")
      setCampos([
        {
          id: "tipo_item",
          nome: "Classificação / Tipo",
          tipo: "select",
          opcoes: ["Tipo A", "Tipo B", "Tipo C"],
          obrigatorio: false,
        },
      ])
    }
    setNovoCampoNome("")
    setNovoCampoOpcoes("")
    setNovoCampoTipo("text")
    setNovoCampoObrigatorio(false)
  }, [initialConfig, isOpen])

  if (!isOpen) return null

  const handleAddCampo = () => {
    if (!novoCampoNome.trim()) return
    const id = "cf_" + Date.now().toString(36)
    const opcoes =
      novoCampoTipo === "select"
        ? novoCampoOpcoes
            .split(/[,;\n]+/)
            .map(s => s.trim())
            .filter(Boolean)
        : undefined

    const novo: CustomField = {
      id,
      nome: novoCampoNome.trim(),
      tipo: novoCampoTipo,
      opcoes: opcoes && opcoes.length > 0 ? opcoes : ["Opção 1", "Opção 2"],
      obrigatorio: novoCampoObrigatorio,
    }

    setCampos([...campos, novo])
    setNovoCampoNome("")
    setNovoCampoOpcoes("")
    setNovoCampoTipo("text")
    setNovoCampoObrigatorio(false)
  }

  const handleRemoveCampo = (id: string) => {
    setCampos(campos.filter(c => c.id !== id))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return

    const now = new Date().toISOString()
    const configToSave: MapeamentoConfig = {
      id: initialConfig?.id || "map-" + Date.now().toString(36),
      nome: nome.trim(),
      descricao: initialConfig?.descricao || "",
      categoria: initialConfig?.categoria || "Geral",
      cor: initialConfig?.cor || "blue",
      icone: "Box",
      observacoes: observacoes.trim(),
      camposPersonalizados: campos,
      criadoEm: initialConfig?.criadoEm || now,
      atualizadoEm: now,
    }

    onSave(configToSave)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Settings size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                {initialConfig ? "Configurar Mapeamento" : "Criar Novo Mapeamento"}
              </h2>
              <p className="text-xs text-slate-400">
                Defina o nome e campos personalizados da sua grade.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Dados Principais */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Tag size={13} /> Dados Principais
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nome do Mapeamento <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Mapeamento de Embalagens, Avarias Linha Branca..."
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Observações Operacionais (opcional)
              </label>
              <input
                type="text"
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Instruções para os conferentes e equipe..."
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Campos Personalizados */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Layers size={13} /> Campos Personalizados do Mapeamento
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Além de Código, Descrição e Quantidade, defina dados adicionais para cada item mapeado.
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                {campos.length} campos
              </span>
            </div>

            {/* Lista de campos atuais */}
            <div className="space-y-2">
              {campos.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  Nenhum campo personalizado adicionado. Apenas os campos padrão serão usados.
                </div>
              ) : (
                campos.map(campo => (
                  <div
                    key={campo.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span className="font-semibold text-slate-200">{campo.nome}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-slate-400 uppercase">
                        {campo.tipo}
                      </span>
                      {campo.tipo === "select" && campo.opcoes && (
                        <span className="text-[10px] text-slate-500 truncate max-w-[200px]">
                          ({campo.opcoes.join(", ")})
                        </span>
                      )}
                      {campo.obrigatorio && (
                        <span className="text-[9px] font-semibold text-amber-400">Obrigatório</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCampo(campo.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Excluir campo"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Adicionar Novo Campo */}
            <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/40 space-y-3">
              <span className="text-[11px] font-semibold text-slate-300 block">
                + Adicionar Campo ao Mapeamento
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  placeholder="Nome do campo (ex: Lote, Fornecedor, Tipo...)"
                  value={novoCampoNome}
                  onChange={e => setNovoCampoNome(e.target.value)}
                  className="sm:col-span-6 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <select
                  value={novoCampoTipo}
                  onChange={e => setNovoCampoTipo(e.target.value as CustomField["tipo"])}
                  className="sm:col-span-3 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="select">Seleção (Select)</option>
                  <option value="date">Data</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddCampo}
                  className="sm:col-span-3 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus size={13} /> Adicionar
                </button>
              </div>

              {novoCampoTipo === "select" && (
                <div>
                  <input
                    type="text"
                    placeholder="Opções separadas por vírgula (Ex: Caixa, Grade, Avulso)"
                    value={novoCampoOpcoes}
                    onChange={e => setNovoCampoOpcoes(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chk_obrigatorio"
                  checked={novoCampoObrigatorio}
                  onChange={e => setNovoCampoObrigatorio(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0"
                />
                <label htmlFor="chk_obrigatorio" className="text-xs text-slate-400 cursor-pointer">
                  Campo obrigatório no preenchimento
                </label>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all cursor-pointer"
            >
              {initialConfig ? "Salvar Alterações" : "Criar Mapeamento"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
