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
          </div>

          {/* Campos Personalizados */}
          {/* Removido conforme solicitação */}

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
