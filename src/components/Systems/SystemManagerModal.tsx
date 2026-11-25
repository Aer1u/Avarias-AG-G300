// ============================================================
// NEXUS ERP — Systems / SystemManagerModal.tsx
// Modal de Gerenciamento de Sistemas de Saldo (Laboratório)
// ESCOPO: Mapeamento & Configuração
// ============================================================

"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Shield, Layers, Check, Trash2, Edit3, ArrowRight, AlertCircle, Building2, GitCompare, Package, MapPin } from "lucide-react"
import { useSystemStore } from "./useSystemStore"
import { BusinessSystem, StockControlMode, SystemStyle } from "./types"
import type { MapObject } from "../MapLibrary/types"
import SystemRecordsModal from "./SystemRecordsModal"
import SystemMappingModal from "./SystemMappingModal"
import SystemConfrontoModal from "./SystemConfrontoModal"
import { isOpenSystem, getSystemMappedStats, getLinkedStructuresForSystem } from "@/lib/systemVisuals"

interface SystemManagerModalProps {
  isOpen: boolean
  onClose: () => void
  allObjects?: MapObject[]
  workspaceId?: string
  onUpdateObject?: (id: string, partial: Partial<MapObject>) => void
}

export default function SystemManagerModal({
  isOpen,
  onClose,
  allObjects = [],
  workspaceId,
  onUpdateObject,
}: SystemManagerModalProps) {
  const { systems, addSystem, updateSystem, deleteSystem, linkStorageToSystem } = useSystemStore(workspaceId)
  const [selectedSystemId, setSelectedSystemId] = useState<string>(systems[0]?.id || "")
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Estados dos Sub-Modais Integrados (Registro · Mapeamento · Confronto)
  const [isRecordsOpen, setIsRecordsOpen] = useState(false)
  const [isMappingOpen, setIsMappingOpen] = useState(false)
  const [isConfrontoOpen, setIsConfrontoOpen] = useState(false)

  // Form State
  const [formData, setFormData] = useState<Partial<BusinessSystem>>({})

  if (!isOpen) return null

  const selectedSystem = systems.find((s) => s.id === selectedSystemId) || systems[0]
  const isSelectedOpen = isOpenSystem(selectedSystem)

  const handleStartCreate = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      icon: "📦",
      color: "#3b82f6",
      systemStyle: "completo",
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
    const open = isOpenSystem(sys)
    setFormData({
      ...sys,
      systemStyle: open ? "aberto" : "completo",
      defaultControlMode: open ? "livre" : "vinculado_saldo",
    })
    setIsEditing(true)
    setIsCreating(false)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.code) return

    const style: SystemStyle = formData.systemStyle === "aberto" ? "aberto" : "completo"
    const isFormOpen = style === "aberto"

    const originObj = !isFormOpen && formData.originStorageId
      ? allObjects.find((o) => o.id === formData.originStorageId)
      : undefined
    const originParticipant = !isFormOpen && originObj
      ? {
          storageObjectId: originObj.id,
          storageObjectLabel:
            formData.originStorageLabel || originObj.label || originObj.id,
          storageType: originObj.type || originObj.category || "compartment",
          role: "origem" as const,
          stockControlMode: (formData.defaultControlMode || "vinculado_saldo") as StockControlMode,
          permissions: {
            allowInbound: true,
            allowOutbound: true,
            allowReturnToOrigin: true,
          },
          configuredAt: new Date().toISOString(),
        }
      : null

    if (isCreating) {
      const created = addSystem({
        code: formData.code.toUpperCase().trim(),
        name: formData.name.trim(),
        description: formData.description || "",
        color: formData.color || "#3b82f6",
        icon: formData.icon || "📦",
        systemStyle: style,
        status: formData.status || "ativo",
        defaultControlMode: isFormOpen ? "livre" : (formData.defaultControlMode || "vinculado_saldo"),
        originStorageId: isFormOpen ? "" : (formData.originStorageId || ""),
        originStorageLabel: isFormOpen ? "" : (formData.originStorageLabel || originObj?.label || ""),
        responsible: formData.responsible || "",
        workspaceId: workspaceId || "workspace_default",
        participants: originParticipant ? [originParticipant] : [],
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
        systemStyle: style,
        status: formData.status,
        defaultControlMode: isFormOpen ? "livre" : formData.defaultControlMode,
        originStorageId: isFormOpen ? "" : formData.originStorageId,
        originStorageLabel: isFormOpen ? "" : (formData.originStorageLabel || originObj?.label || ""),
        responsible: formData.responsible,
      })
      if (originParticipant) {
        linkStorageToSystem(selectedSystem.id, originParticipant)
      }
      setIsEditing(false)
    }
  }

  const floorObjects = allObjects.filter(
    (o) =>
      o.type === "compartment" ||
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
                const openSys = isOpenSystem(sys)
                const linkedCount = getLinkedStructuresForSystem(sys, allObjects).length
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
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 shadow-sm relative"
                      style={{ backgroundColor: `${sys.color}25`, border: `1.5px solid ${sys.color}` }}
                    >
                      {sys.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: sys.color }}
                          />
                          <span className="truncate">{sys.name}</span>
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0">
                          {sys.code}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{sys.description}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Layers size={10} /> {linkedCount} estruturas
                        </span>
                        <span>•</span>
                        {openSys ? (
                          <span className="text-emerald-400 font-semibold">Sistema Livre</span>
                        ) : (
                          <span className="text-blue-400">Saldo Obrig.</span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
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

                {/* Estilo do Sistema */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                    Estilo do Sistema *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          systemStyle: "completo",
                          defaultControlMode: "vinculado_saldo",
                        })
                      }
                      className={`p-3 rounded-xl border text-left transition-all ${
                        (formData.systemStyle || "completo") === "completo"
                          ? "bg-blue-950/50 border-blue-500 ring-1 ring-blue-500/40"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">📋 Sistema com Saldo (Registros)</span>
                        {(formData.systemStyle || "completo") === "completo" && (
                          <Check size={14} className="text-blue-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                        Inclui <strong>Registros de Saldo</strong> (CHÃO/entradas), <strong>Mapeamento</strong> e <strong>Confronto</strong>.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          systemStyle: "aberto",
                          defaultControlMode: "livre",
                          originStorageId: "",
                          originStorageLabel: "",
                        })
                      }
                      className={`p-3 rounded-xl border text-left transition-all ${
                        formData.systemStyle === "aberto"
                          ? "bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500/40"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">🗺️ Sistema Livre (Sem Saldo)</span>
                        {formData.systemStyle === "aberto" && (
                          <Check size={14} className="text-emerald-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                        <strong>Sem registro de saldo</strong> nem origem no chão. Apenas <strong>Mapeamento</strong> e <strong>Confronto</strong>.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Objeto de Origem (CHÃO) — apenas para Sistema Completo */}
                {formData.systemStyle !== "aberto" ? (
                  <>
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
                                {f.type === "compartment" ? "📦" : "🏢"} {f.label || f.id} ({f.type === "compartment" ? "Compartimento" : f.classification || f.type})
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
                        <label className="text-[10px] text-slate-400 block mb-1">Controle de Saldo</label>
                        <div className="w-full bg-blue-950/40 border border-blue-800/60 rounded-lg px-2.5 py-1.5 text-xs text-blue-200 font-semibold">
                          🔒 Saldo Obrigatório (Com Registros)
                        </div>
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
                  </>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                    <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-[11px] text-emerald-200/90 leading-snug">
                      <strong className="text-emerald-300 block mb-0.5">Sistema Livre (Sem Registro de Saldo)</strong>
                      Não possui módulo de Registros nem saldo prévio. Qualquer Drive-In, canal ou área vinculado recebe itens livremente e alimenta o Confronto.
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Responsável Técnico / Setor</label>
                      <input
                        type="text"
                        placeholder="Ex: Equipe de Inventário / Conferência"
                        value={formData.responsible || ""}
                        onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                )}

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
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as "ativo" | "configuracao" | "inativo" })}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-white">{selectedSystem.name}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold border border-slate-700">
                          {selectedSystem.code}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            isSelectedOpen
                              ? "bg-emerald-950/70 border-emerald-700/60 text-emerald-300"
                              : "bg-blue-950/70 border-blue-700/60 text-blue-300"
                          }`}
                        >
                          {isSelectedOpen ? "Sistema Livre (Sem Saldo)" : "Sistema com Saldo"}
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
                  </div>
                </div>

                {/* ── MÓDULOS OPERACIONAIS DO SISTEMA ── */}
                <div className="p-3.5 bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-amber-950/40 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span>⚡</span>
                      <span>Módulos Operacionais deste Sistema</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {isSelectedOpen ? "Sistema Livre: sem registro de saldo (Mapeamento + Confronto)" : "Configuração completa com registros de saldo"}
                    </span>
                  </div>

                  <div className={`grid grid-cols-1 ${isSelectedOpen ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-2 pt-1`}>
                    {/* 1. Modal de Registro (oculto no Sistema Aberto) */}
                    {!isSelectedOpen && (
                      <button
                        type="button"
                        onClick={() => setIsRecordsOpen(true)}
                        className="p-3 rounded-xl bg-slate-900/90 hover:bg-blue-950/50 border border-slate-700/80 hover:border-blue-500/80 text-left transition-all group shadow-sm flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="p-1.5 rounded-lg bg-blue-950 text-blue-400 border border-blue-800/60 text-xs">
                              📋
                            </span>
                            <strong className="text-xs text-white group-hover:text-blue-300 transition-colors">
                              1. Registros
                            </strong>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            Lançamento e controle de saldos físicos, lotes e quantidades.
                          </p>
                        </div>
                        <span className="text-[10px] text-blue-400 font-bold mt-2 flex items-center gap-1">
                          Abrir Registros →
                        </span>
                      </button>
                    )}

                    {/* 2. Modal de Mapeamento */}
                    <button
                      type="button"
                      onClick={() => setIsMappingOpen(true)}
                      className="p-3 rounded-xl bg-slate-900/90 hover:bg-purple-950/50 border border-slate-700/80 hover:border-purple-500/80 text-left transition-all group shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="p-1.5 rounded-lg bg-purple-950 text-purple-400 border border-purple-800/60 text-xs">
                            🗺️
                          </span>
                          <strong className="text-xs text-white group-hover:text-purple-300 transition-colors">
                            {isSelectedOpen ? "1. Mapeamento" : "2. Mapeamento"}
                          </strong>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Vincular posições, Drives, Ruas e Áreas do mapa físico.
                        </p>
                      </div>
                      <span className="text-[10px] text-purple-400 font-bold mt-2 flex items-center gap-1">
                        Mapear Posições →
                      </span>
                    </button>

                    {/* 3. Modal de Confronto */}
                    <button
                      type="button"
                      onClick={() => setIsConfrontoOpen(true)}
                      className="p-3 rounded-xl bg-slate-900/90 hover:bg-amber-950/50 border border-slate-700/80 hover:border-amber-500/80 text-left transition-all group shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="p-1.5 rounded-lg bg-amber-950 text-amber-400 border border-amber-800/60 text-xs">
                            ⚖️
                          </span>
                          <strong className="text-xs text-white group-hover:text-amber-300 transition-colors">
                            {isSelectedOpen ? "2. Confronto" : "3. Confronto"}
                          </strong>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          {isSelectedOpen
                            ? "Confrontar o que está mapeado nas posições com relação importada."
                            : "Nomear relação (ex: A501), importar e conciliar em JSON."}
                        </p>
                      </div>
                      <span className="text-[10px] text-amber-400 font-bold mt-2 flex items-center gap-1">
                        Confrontar Saldo →
                      </span>
                    </button>
                  </div>
                </div>

                {/* Cartões Informativos de Parâmetros */}
                {isSelectedOpen ? (
                  (() => {
                    const stats = getSystemMappedStats(selectedSystem)
                    return (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                            <span>🗺️</span>
                            <span>Estilo & Identificação Visual</span>
                          </span>
                          <p className="text-sm font-semibold text-white flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/30 inline-block"
                              style={{ backgroundColor: selectedSystem.color }}
                            />
                            <span>Sistema Livre (Sem Registro de Saldo)</span>
                          </p>
                          <span className="text-[10px] text-slate-500">
                            Drives e canais vinculados recebem a cor acima para identificação imediata no mapa 2D e 3D.
                          </span>
                        </div>

                        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
                            <span>📦</span>
                            <span>Saldo Mapeado para Confronto</span>
                          </span>
                          <p className="text-sm font-semibold text-white font-mono">
                            {stats.totalUnits.toLocaleString("pt-BR")} un. · {stats.totalSkus} SKU(s)
                          </p>
                          <span className="text-[10px] text-slate-500">
                            {stats.occupiedSlotsCount} posição(ões) ocupada(s) em {stats.mappedObjectsCount} estrutura(s).
                          </span>
                        </div>
                      </div>
                    )
                  })()
                ) : (
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
                )}

                {/* Participantes: Objetos de Armazenamento & Canais Vinculados */}
                {(() => {
                  const linkedStructures = getLinkedStructuresForSystem(selectedSystem, allObjects)
                  return (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          <Layers size={14} className="text-blue-400" />
                          <span>Estruturas & Canais Vinculados ({linkedStructures.length})</span>
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Vincule por Drive/Área ou por Canal individual
                        </span>
                      </div>

                      {linkedStructures.length === 0 ? (
                        <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-xl text-center space-y-2">
                          <Layers size={24} className="mx-auto text-slate-600" />
                          <p className="text-xs text-slate-400">
                            Nenhuma estrutura ou canal vinculado a este sistema ainda.
                          </p>
                          <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                            Selecione um Drive-In, Canal ou Compartimento no mapa 2D ou abra{" "}
                            <strong className="text-slate-300">Mapeamento</strong> para vinculá-lo a este sistema.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {linkedStructures.map((entry) => (
                            <div
                              key={entry.storageObjectId}
                              className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-base shrink-0">
                                    {entry.isCompartment ? "📦" : entry.isOrigin ? "📍" : "📥"}
                                  </span>
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-200 truncate">
                                      {entry.storageObjectLabel}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono ml-2">
                                      ({entry.storageType})
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                                      !isSelectedOpen && entry.stockControlMode === "vinculado_saldo"
                                        ? "bg-blue-950/60 border-blue-800 text-blue-300"
                                        : "bg-emerald-950/50 border-emerald-800/60 text-emerald-300"
                                    }`}
                                  >
                                    {!isSelectedOpen && entry.stockControlMode === "vinculado_saldo"
                                      ? "Saldo Obrigatório"
                                      : "Livre (Sem Saldo)"}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {entry.totalUnits} un.
                                  </span>
                                </div>
                              </div>

                              {entry.isDrive && entry.linkedChannels.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pl-7">
                                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                                    Canais ({entry.linkedChannels.length}/{entry.totalChannelsCount}):
                                  </span>
                                  {entry.linkedChannels.map((ch) => (
                                    <span
                                      key={ch.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-[10px] text-slate-200 font-mono"
                                    >
                                      <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: selectedSystem.color }}
                                      />
                                      <span>{ch.name || ch.code}</span>
                                      {ch.occupiedSlots > 0 && (
                                        <span className="text-amber-300 font-bold">
                                          · {ch.occupiedSlots} 📦
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

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

      {/* ── SUB-MODAIS INTEGRADOS DO SISTEMA ── */}
      {selectedSystem && (
        <>
          {/* 1. Modal de Registros de Saldo (apenas sistema completo) */}
          {!isSelectedOpen && (
            <SystemRecordsModal
              isOpen={isRecordsOpen}
              onClose={() => setIsRecordsOpen(false)}
              system={selectedSystem}
              allObjects={allObjects}
            />
          )}

          {/* 2. Modal de Mapeamento de Posições Físicas */}
          <SystemMappingModal
            isOpen={isMappingOpen}
            onClose={() => setIsMappingOpen(false)}
            system={selectedSystem}
            allObjects={allObjects}
            workspaceId={workspaceId}
            onUpdateObject={onUpdateObject}
          />

          {/* 3. Modal de Confronto Analítico (com tabela JSON configurável) */}
          <SystemConfrontoModal
            isOpen={isConfrontoOpen}
            onClose={() => setIsConfrontoOpen(false)}
            system={selectedSystem}
          />
        </>
      )}
    </div>
  )
}
