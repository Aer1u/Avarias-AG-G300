// ============================================================
// NEXUS ERP — Systems / SystemManagerModal.tsx
// Modal de Gerenciamento de Sistemas de Saldo (Laboratório)
// ESCOPO: Mapeamento & Configuração
// ============================================================

"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Shield, Layers, Check, Trash2, Edit3, ArrowRight, AlertCircle, Building2 } from "lucide-react"
import { useSystemStore } from "./useSystemStore"
import { BusinessSystem, StockControlMode } from "./types"
import type { MapObject } from "../MapLibrary/types"

interface SystemManagerModalProps {
  isOpen: boolean
  onClose: () => void
  allObjects?: MapObject[]
}

export default function SystemManagerModal({
  isOpen,
  onClose,
  allObjects = [],
}: SystemManagerModalProps) {
  const { systems, addSystem, updateSystem, deleteSystem, resetToDefaults } = useSystemStore()
  const [selectedSystemId, setSelectedSystemId] = useState<string>(systems[0]?.id || "sys_avarias_g300")
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Form State
  const [formData, setFormData] = useState<Partial<BusinessSystem>>({})

  if (!isOpen) return null

  const selectedSystem = systems.find((s) => s.id === selectedSystemId) || systems[0]

  const handleStartCreate = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      icon: "📦",
      color: "#3b82f6",
      status: "ativo",
      defaultControlMode: "vinculado_saldo",
      originStorageLabel: "",
      originStorageId: "",
      responsible: "",
      workspaceId: "workspace_default",
      participants: [],
      allowedMovementTypes: ["entrada", "transferencia", "baixa"],
    })
    setIsCreating(true)
    setIsEditing(false)
  }

  const handleStartEdit = (sys: BusinessSystem) => {
    setFormData({ ...sys })
    setIsEditing(true)
    setIsCreating(false)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.code) return

    if (isCreating) {
      const created = addSystem({
        code: formData.code.toUpperCase().trim(),
        name: formData.name.trim(),
        description: formData.description || "",
        color: formData.color || "#3b82f6",
        icon: formData.icon || "📦",
        status: formData.status || "ativo",
        defaultControlMode: formData.defaultControlMode || "vinculado_saldo",
        originStorageId: formData.originStorageId || "",
        originStorageLabel: formData.originStorageLabel || "",
        responsible: formData.responsible || "",
        workspaceId: "workspace_default",
        participants: [],
        allowedMovementTypes: formData.allowedMovementTypes || ["transferencia"],
      })
      setSelectedSystemId(created.id)
      setIsCreating(false)
    } else if (isEditing && selectedSystem) {
      updateSystem(selectedSystem.id, {
        name: formData.name,
        code: formData.code?.toUpperCase().trim(),
        description: formData.description,
        color: formData.color,
        icon: formData.icon,
        status: formData.status,
        defaultControlMode: formData.defaultControlMode,
        originStorageId: formData.originStorageId,
        originStorageLabel: formData.originStorageLabel,
        responsible: formData.responsible,
      })
      setIsEditing(false)
    }
  }

  const floorObjects = allObjects.filter(
    (o) =>
      o.type === "floor" ||
      o.category === "area" ||
      (o.label || "").toLowerCase().includes("chão") ||
      (o.label || "").toLowerCase().includes("chao")
  )

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400">
              <Shield size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Motor Central de Sistemas de Saldo
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/50">
                  Laboratório
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Configuração universal de sistemas de negócio, origens (CHÃO) e regras de preenchimento.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo: Duas Colunas */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Coluna Esquerda: Lista de Sistemas */}
          <div className="p-4 space-y-3 bg-slate-950/30 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Sistemas ({systems.length})
              </span>
              <button
                type="button"
                onClick={handleStartCreate}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase transition-colors"
              >
                <Plus size={12} /> Novo Sistema
              </button>
            </div>

            <div className="space-y-1.5">
              {systems.map((sys) => {
                const isSelected = sys.id === selectedSystem?.id && !isCreating
                return (
                  <button
                    key={sys.id}
                    type="button"
                    onClick={() => {
                      setSelectedSystemId(sys.id)
                      setIsCreating(false)
                      setIsEditing(false)
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                      isSelected
                        ? "bg-slate-800/90 border-blue-500/80 ring-1 ring-blue-500/50 shadow-md"
                        : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 shadow-sm"
                      style={{ backgroundColor: `${sys.color}25`, border: `1px solid ${sys.color}60` }}
                    >
                      {sys.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">{sys.name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {sys.code}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{sys.description}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Layers size={10} /> {sys.participants?.length || 0} objetos
                        </span>
                        <span>•</span>
                        <span className={sys.defaultControlMode === "vinculado_saldo" ? "text-blue-400" : "text-amber-400"}>
                          {sys.defaultControlMode === "vinculado_saldo" ? "Saldo Obrig." : "Livre"}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={resetToDefaults}
                className="text-[10px] text-slate-500 hover:text-slate-400 underline transition-colors"
              >
                Restaurar sistemas padrão do laboratório
              </button>
            </div>
          </div>

          {/* Coluna Direita: Detalhes ou Formulário de Edição */}
          <div className="col-span-2 p-5 overflow-y-auto custom-scrollbar bg-slate-900/60">
            {isCreating || isEditing ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{isCreating ? "Novo Sistema de Saldo" : "Editar Sistema de Saldo"}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false)
                      setIsEditing(false)
                    }}
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-400 block mb-1">Nome do Sistema *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Sistema de Avarias G300"
                      value={formData.name || ""}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Código Técnico *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: AVARIAS_G300"
                      value={formData.code || ""}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Descrição & Finalidade</label>
                  <textarea
                    rows={2}
                    placeholder="Descreva o ciclo deste sistema, quem administra e para que serve o saldo..."
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Objeto de Origem (CHÃO) */}
                <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-2">
                  <label className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                    <span>📍</span>
                    <span>Objeto de Armazenamento de Origem dos Saldos (ex: CHÃO)</span>
                  </label>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    É o objeto onde as entradas e avarias físicas são registradas antes de circularem para os Drives.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <select
                        value={formData.originStorageId || ""}
                        onChange={(e) => {
                          const chosen = floorObjects.find((o) => o.id === e.target.value)
                          setFormData({
                            ...formData,
                            originStorageId: e.target.value,
                            originStorageLabel: chosen?.label || chosen?.id || "",
                          })
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      >
                        <option value="">— Selecionar Objeto do Mapa —</option>
                        {floorObjects.map((f) => (
                          <option key={f.id} value={f.id}>
                            🏢 {f.label || f.id} ({f.classification || f.type})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Ou digite o nome (ex: CHÃO G300)..."
                        value={formData.originStorageLabel || ""}
                        onChange={(e) => setFormData({ ...formData, originStorageLabel: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Modo Padrão */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Modo de Preenchimento Padrão</label>
                    <select
                      value={formData.defaultControlMode || "vinculado_saldo"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          defaultControlMode: e.target.value as StockControlMode,
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="vinculado_saldo">Vinculado ao Saldo (Saldo Obrigatório)</option>
                      <option value="livre">Livre (sem verificação de saldo)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Responsável Técnico / Setor</label>
                    <input
                      type="text"
                      placeholder="Ex: Supervisão de Avarias"
                      value={formData.responsible || ""}
                      onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Ícone e Cor */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Ícone</label>
                    <input
                      type="text"
                      value={formData.icon || "📦"}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-center text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Cor de Destaque</label>
                    <input
                      type="color"
                      value={formData.color || "#3b82f6"}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full h-8 bg-slate-950 border border-slate-800 rounded-lg p-1 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Status</label>
                    <select
                      value={formData.status || "ativo"}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="configuracao">Em Configuração</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false)
                      setIsEditing(false)
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                  >
                    <Check size={14} /> Salvar Sistema
                  </button>
                </div>
              </form>
            ) : selectedSystem ? (
              <div className="space-y-5">
                {/* Cabeçalho do Sistema Selecionado */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-md"
                      style={{
                        backgroundColor: `${selectedSystem.color}25`,
                        border: `1.5px solid ${selectedSystem.color}80`,
                      }}
                    >
                      {selectedSystem.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">{selectedSystem.name}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold border border-slate-700">
                          {selectedSystem.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{selectedSystem.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(selectedSystem)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Editar Sistema"
                    >
                      <Edit3 size={15} />
                    </button>
                    {systems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remover sistema "${selectedSystem.name}"?`)) {
                            deleteSystem(selectedSystem.id)
                          }
                        }}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Remover Sistema"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Cartões Informativos de Parâmetros */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Origem */}
                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
                      <span>📍</span>
                      <span>Armazenamento de Origem (Entradas)</span>
                    </span>
                    <p className="text-sm font-semibold text-white">
                      {selectedSystem.originStorageLabel || "Não configurado"}
                    </p>
                    <span className="text-[10px] text-slate-500">
                      Onde as entradas deste sistema são geradas inicialmente.
                    </span>
                  </div>

                  {/* Política de Preenchimento */}
                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider flex items-center gap-1">
                      <span>🔐</span>
                      <span>Modo Padrão de Preenchimento</span>
                    </span>
                    <p className="text-sm font-semibold text-white">
                      {selectedSystem.defaultControlMode === "vinculado_saldo"
                        ? "Vinculado ao Saldo (Obrigatório)"
                        : "Livre (Preenchimento Direto)"}
                    </p>
                    <span className="text-[10px] text-slate-500">
                      Dita se posições exigem saldo prévio no módulo operacional.
                    </span>
                  </div>
                </div>

                {/* Participantes: Objetos de Armazenamento do Mapa */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Layers size={14} className="text-blue-400" />
                      <span>Objetos de Armazenamento Participantes ({selectedSystem.participants?.length || 0})</span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Vincule diretamente no painel lateral de cada Drive/Área
                    </span>
                  </div>

                  {(!selectedSystem.participants || selectedSystem.participants.length === 0) ? (
                    <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-xl text-center space-y-2">
                      <Layers size={24} className="mx-auto text-slate-600" />
                      <p className="text-xs text-slate-400">
                        Nenhum objeto de armazenamento vinculado diretamente a este sistema ainda.
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                        Selecione um Drive-In ou Área no mapa 2D e, na seção{" "}
                        <strong className="text-slate-300">🔐 Controle de Acesso a Preenchimento</strong>, vincule-o a este sistema.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedSystem.participants.map((p) => (
                        <div
                          key={p.storageObjectId}
                          className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">📦</span>
                            <div>
                              <span className="font-bold text-slate-200">{p.storageObjectLabel}</span>
                              <span className="text-[10px] text-slate-500 font-mono ml-2">
                                ({p.storageType})
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                                p.stockControlMode === "vinculado_saldo"
                                  ? "bg-blue-950/60 border-blue-800 text-blue-300"
                                  : "bg-slate-800 border-slate-700 text-slate-400"
                              }`}
                            >
                              {p.stockControlMode === "vinculado_saldo" ? "Saldo Obrigatório" : "Livre"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Papel: {p.role}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nota de Escopo */}
                <div className="p-3 bg-blue-950/20 border border-blue-800/30 rounded-xl flex items-start gap-2 text-[11px] text-blue-300">
                  <AlertCircle size={16} className="text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Ambiente de Configuração:</strong> As configurações acima definem como o mapa
                    e seus objetos interagem com este sistema. O módulo futuro de operação lerá essas
                    permissões para autorizar ou bloquear movimentações de mercadorias.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
