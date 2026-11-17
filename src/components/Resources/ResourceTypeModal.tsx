// ============================================================
// NEXUS ERP — Resources / ResourceTypeModal.tsx
// Modal de Criação e Edição de Tipos de Recurso Personalizados
// Permite definir campos customizados e regras de vinculação
// ============================================================

"use client"

import React, { useState } from "react"
import type {
  ResourceType,
  ResourceCategory,
  ResourceField,
  ResourceFieldType,
  LinkageRule,
} from "./types"
import { RESOURCE_CATEGORY_META } from "./types"

interface ResourceTypeModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (typeData: Omit<ResourceType, "id" | "createdAt" | "updatedAt">) => void
  initialType?: ResourceType | null
}

export default function ResourceTypeModal({
  isOpen,
  onClose,
  onSave,
  initialType,
}: ResourceTypeModalProps) {
  const [name, setName] = useState(initialType?.name || "")
  const [category, setCategory] = useState<ResourceCategory>(initialType?.category || "custom")
  const [icon, setIcon] = useState(initialType?.icon || "🔷")
  const [color, setColor] = useState(initialType?.color || "#a78bfa")
  const [description, setDescription] = useState(initialType?.description || "")
  const [unitOfMeasure, setUnitOfMeasure] = useState(initialType?.unitOfMeasure || "un")

  // Campos Customizados
  const [fields, setFields] = useState<ResourceField[]>(initialType?.fields || [])
  const [newFieldLabel, setNewFieldLabel] = useState("")
  const [newFieldKey, setNewFieldKey] = useState("")
  const [newFieldType, setNewFieldType] = useState<ResourceFieldType>("text")
  const [newFieldUnit, setNewFieldUnit] = useState("")
  const [newFieldRequired, setNewFieldRequired] = useState(false)

  // Regras de Vinculação
  const [linkageRules, setLinkageRules] = useState<LinkageRule[]>(
    initialType?.linkageRules || [
      {
        id: "rule_default",
        name: "Regra Padrão de Armazenagem",
        allowedLocationTypes: ["drive_in", "custom_area", "floor"],
        requiresConfirmation: false,
      },
    ]
  )

  if (!isOpen) return null

  const handleAddField = () => {
    if (!newFieldLabel.trim()) return
    const key = newFieldKey.trim() || newFieldLabel.toLowerCase().replace(/\s+/g, "_")
    const newField: ResourceField = {
      id: `f_${Date.now()}`,
      label: newFieldLabel.trim(),
      key,
      type: newFieldType,
      unit: newFieldUnit.trim() || undefined,
      required: newFieldRequired,
      order: fields.length + 1,
    }
    setFields([...fields, newField])
    setNewFieldLabel("")
    setNewFieldKey("")
    setNewFieldUnit("")
    setNewFieldRequired(false)
  }

  const handleRemoveField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")

    onSave({
      name: name.trim(),
      slug,
      category,
      icon,
      color,
      description: description.trim() || undefined,
      unitOfMeasure: unitOfMeasure.trim() || undefined,
      fields,
      linkageRules,
      isBuiltIn: false,
    })

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xl text-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{icon}</span>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                {initialType ? "Editar Tipo de Recurso" : "Novo Tipo de Recurso"}
              </div>
              <h2 className="text-sm font-semibold text-slate-200">
                {name || "Definição de Tipo Customizado"}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Identificação Básica */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Nome do Tipo de Recurso *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Produto Quarentenado, Transpaleteira Especial"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Categoria Base
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const cat = e.target.value as ResourceCategory
                  setCategory(cat)
                  setIcon(RESOURCE_CATEGORY_META[cat].icon)
                  setColor(RESOURCE_CATEGORY_META[cat].color)
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
              >
                {Object.entries(RESOURCE_CATEGORY_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.icon} {meta.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ícone, Cor e Unidade */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Ícone (Emoji)
              </label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center text-base text-slate-200 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Cor de Destaque
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <span className="text-[10px] font-mono text-slate-400">{color}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Unidade Padrão
              </label>
              <input
                type="text"
                value={unitOfMeasure}
                onChange={(e) => setUnitOfMeasure(e.target.value)}
                placeholder="ex: un, kg, m²"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Descrição e Finalidade
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva a finalidade deste recurso na operação e armazenagem..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
            />
          </div>

          {/* Gerenciamento de Campos Dinâmicos */}
          <div className="space-y-2 p-3 bg-slate-950/70 rounded-xl border border-slate-800">
            <span className="text-xs font-bold text-amber-400 flex items-center justify-between">
              <span>Campos Customizados ({fields.length})</span>
            </span>

            {/* Lista de campos existentes */}
            {fields.length > 0 && (
              <div className="space-y-1">
                {fields.map((f) => (
                  <div
                    key={f.id}
                    className="p-1.5 bg-slate-900 border border-slate-800 rounded flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{f.label}</span>
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded font-mono">
                        {f.type} {f.unit ? `(${f.unit})` : ""}
                      </span>
                      {f.required && (
                        <span className="text-[9px] text-amber-400 font-bold">*Obrigatório</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveField(f.id)}
                      className="text-red-400 hover:text-red-300 px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Adicionar novo campo */}
            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800/80 items-end">
              <div className="space-y-0.5">
                <label className="text-[9px] text-slate-400">Nome do Campo</label>
                <input
                  type="text"
                  placeholder="Ex: Voltagem"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-xs text-slate-200"
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] text-slate-400">Tipo de Dado</label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as ResourceFieldType)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-1 py-1 text-xs text-slate-200"
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="select">Seleção</option>
                  <option value="boolean">Sim/Não</option>
                  <option value="date">Data</option>
                  <option value="textarea">Área de Texto</option>
                </select>
              </div>

              <div className="space-y-0.5">
                <label className="text-[9px] text-slate-400">Unidade (opt)</label>
                <input
                  type="text"
                  placeholder="Ex: V, kg"
                  value={newFieldUnit}
                  onChange={(e) => setNewFieldUnit(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-xs text-slate-200"
                />
              </div>

              <button
                type="button"
                onClick={handleAddField}
                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold"
              >
                + Adicionar
              </button>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-xs shadow-md shadow-amber-900/40"
            >
              Salvar Tipo de Recurso
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
