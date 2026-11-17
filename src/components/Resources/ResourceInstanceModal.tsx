// ============================================================
// NEXUS ERP — Resources / ResourceInstanceModal.tsx
// Modal de Criação e Edição de Instâncias de Recurso
// Suporta campos dinâmicos conforme o Tipo de Recurso selecionado
// ============================================================

"use client"

import React, { useState, useEffect } from "react"
import type {
  ResourceInstance,
  ResourceType,
  ResourceStatus,
  ResourceField,
} from "./types"
import { RESOURCE_STATUS_META } from "./types"
import ProductBaseCodigoSelector from "./ProductBaseCodigoSelector"

interface ResourceInstanceModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (instanceData: Omit<ResourceInstance, "id" | "createdAt" | "updatedAt">) => void
  types: ResourceType[]
  initialInstance?: ResourceInstance | null
}

export default function ResourceInstanceModal({
  isOpen,
  onClose,
  onSave,
  types,
  initialInstance,
}: ResourceInstanceModalProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    initialInstance?.typeId || (types[0]?.id || "rt_produto")
  )
  const [code, setCode] = useState(initialInstance?.code || "")
  const [label, setLabel] = useState(initialInstance?.label || "")
  const [status, setStatus] = useState<ResourceStatus>(initialInstance?.status || "ativo")
  const [responsible, setResponsible] = useState(initialInstance?.responsible || "")
  const [notes, setNotes] = useState(initialInstance?.notes || "")
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>(
    initialInstance?.props || {}
  )

  const currentType = types.find((t) => t.id === selectedTypeId) || types[0]

  useEffect(() => {
    if (initialInstance) {
      setSelectedTypeId(initialInstance.typeId)
      setCode(initialInstance.code)
      setLabel(initialInstance.label)
      setStatus(initialInstance.status)
      setResponsible(initialInstance.responsible || "")
      setNotes(initialInstance.notes || "")
      setFieldValues(initialInstance.props || {})
    } else {
      setCode("")
      setLabel("")
      setStatus("ativo")
      setResponsible("")
      setNotes("")
      setFieldValues({})
    }
  }, [initialInstance, isOpen])

  if (!isOpen) return null

  const handleFieldValueChange = (key: string, val: unknown) => {
    setFieldValues((prev) => ({ ...prev, [key]: val }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !label.trim()) return

    onSave({
      typeId: selectedTypeId,
      code: code.trim(),
      label: label.trim(),
      status,
      responsible: responsible.trim() || undefined,
      notes: notes.trim() || undefined,
      props: fieldValues,
      linkedLocations: initialInstance?.linkedLocations || [],
    })

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg text-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{currentType?.icon || "🔷"}</span>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                {initialInstance ? "Editar Recurso" : "Novo Recurso Universal"}
              </div>
              <h2 className="text-sm font-semibold text-slate-200">
                {currentType ? currentType.name : "Recurso"}
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
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
          {/* Tipo de Recurso */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Tipo de Recurso
            </label>
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              disabled={!!initialInstance}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name} ({t.category})
                </option>
              ))}
            </select>
          </div>

          {/* Se for Produto, permite puxar diretamente da tabela base_codigos */}
          {(currentType?.category === "produto" || currentType?.id === "rt_produto") && (
            <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider flex items-center gap-1.5">
                  <span>📦</span>
                  <span>Puxar da Tabela base_codigos</span>
                </span>
                <span className="text-[9px] text-purple-400 font-mono">Catálogo Oficial</span>
              </div>
              <ProductBaseCodigoSelector
                onSelectProduct={(prod) => {
                  setCode(prod["Código"])
                  setLabel(prod["Descrição"])
                  setFieldValues((prev) => ({
                    ...prev,
                    sku: prod["Código"],
                    descricao: prod["Descrição"],
                    grade: prod.Grade || "",
                    tipo: prod.Tipo || "",
                  }))
                }}
                selectedCode={code}
                placeholder="Buscar SKU na base_codigos (ex: 1705-01, CM-500)..."
              />
            </div>
          )}

          {/* Código e Nome */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Código Técnico *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: SKU-1044, EMP-04"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Nome / Descrição *
              </label>
              <input
                type="text"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Leite Integral UHT 1L"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Status e Responsável */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Status Operacional
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ResourceStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
              >
                {Object.entries(RESOURCE_STATUS_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.icon} {meta.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Responsável
              </label>
              <input
                type="text"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder="Ex: Operador Carlos, Líder Logístico"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Campos Dinâmicos do Tipo */}
          {currentType && currentType.fields.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Atributos Específicos de {currentType.name}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {currentType.fields.map((field: ResourceField) => (
                  <div
                    key={field.id}
                    className={`space-y-1 ${field.type === "textarea" ? "col-span-2" : ""}`}
                  >
                    <label className="text-[10px] text-slate-400 font-medium">
                      {field.label} {field.unit && `(${field.unit})`}
                      {field.required && " *"}
                    </label>

                    {field.type === "select" ? (
                      <select
                        value={String(fieldValues[field.key] || "")}
                        onChange={(e) => handleFieldValueChange(field.key, e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="">— Selecione —</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "boolean" ? (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          checked={Boolean(fieldValues[field.key])}
                          onChange={(e) => handleFieldValueChange(field.key, e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700"
                        />
                        <span className="text-[11px] text-slate-300">Sim / Ativo</span>
                      </div>
                    ) : field.type === "textarea" ? (
                      <textarea
                        rows={2}
                        value={String(fieldValues[field.key] || "")}
                        onChange={(e) => handleFieldValueChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none resize-none"
                      />
                    ) : (
                      <input
                        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                        value={String(fieldValues[field.key] ?? "")}
                        onChange={(e) =>
                          handleFieldValueChange(
                            field.key,
                            field.type === "number" ? Number(e.target.value) : e.target.value
                          )
                        }
                        placeholder={field.placeholder}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observações Gerais */}
          <div className="space-y-1 pt-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Observações Gerais
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruções de armazenagem, manuseio ou restrições..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none resize-none"
            />
          </div>

          {/* Ações */}
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
              Salvar Recurso
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
