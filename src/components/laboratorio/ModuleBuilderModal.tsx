// ============================================================
// NEXUS ERP — laboratorio / ModuleBuilderModal.tsx
// Construtor Visual de Módulos, Cadastros e Campos Personalizados
// Permite que a organização crie sua própria estrutura operacional
// ============================================================

"use client"

import React, { useState } from "react"
import type {
  BusinessModuleDefinition,
  CustomEntityDefinition,
  CustomFieldDefinition,
  FieldDataType,
} from "../MapLibrary/modulesTypes"

interface ModuleBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  modules: BusinessModuleDefinition[]
  onSaveModule: (module: BusinessModuleDefinition) => void
}

export default function ModuleBuilderModal({
  isOpen,
  onClose,
  modules,
  onSaveModule,
}: ModuleBuilderModalProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<string>(
    modules[0]?.id || "mod_avarias"
  )

  const activeModule = modules.find((m) => m.id === selectedModuleId) || modules[0]

  // Estado para criar novo campo
  const [newFieldLabel, setNewFieldLabel] = useState("")
  const [newFieldKey, setNewFieldKey] = useState("")
  const [newFieldType, setNewFieldType] = useState<FieldDataType>("text")
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [activeEntityId, setActiveEntityId] = useState<string>(
    activeModule?.entities[0]?.id || ""
  )

  if (!isOpen || !activeModule) return null

  const activeEntity =
    activeModule.entities.find((e) => e.id === activeEntityId) ||
    activeModule.entities[0]

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFieldLabel.trim() || !activeEntity) return

    const key =
      newFieldKey.trim() ||
      newFieldLabel
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "")

    const newField: CustomFieldDefinition = {
      id: `fld_${crypto.randomUUID().slice(0, 6)}`,
      key,
      label: newFieldLabel.trim(),
      dataType: newFieldType,
      isRequired: newFieldRequired,
      order: activeEntity.fields.length + 1,
    }

    const updatedEntity: CustomEntityDefinition = {
      ...activeEntity,
      fields: [...activeEntity.fields, newField],
    }

    const updatedModule: BusinessModuleDefinition = {
      ...activeModule,
      entities: activeModule.entities.map((ent) =>
        ent.id === activeEntity.id ? updatedEntity : ent
      ),
    }

    onSaveModule(updatedModule)
    setNewFieldLabel("")
    setNewFieldKey("")
    setNewFieldType("text")
    setNewFieldRequired(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col text-slate-100 shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white font-bold text-sm">
              🧱
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Construtor de Módulos & Cadastros Personalizados
              </h3>
              <p className="text-xs text-slate-400">
                Modele entidades, campos customizados e vincule-os aos elementos do mapa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Corpo: Módulos à esquerda, Cadastros e Campos ao centro */}
        <div className="flex-1 flex overflow-hidden">
          {/* Coluna 1: Lista de Módulos */}
          <div className="w-64 border-r border-slate-800 bg-slate-950/60 p-3 space-y-2 select-none">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block px-2">
              Módulos da Organização
            </span>
            <div className="space-y-1">
              {modules.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => {
                    setSelectedModuleId(mod.id)
                    setActiveEntityId(mod.entities[0]?.id || "")
                  }}
                  className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                    selectedModuleId === mod.id
                      ? "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <span className="text-base">{mod.icon}</span>
                  <div className="truncate">
                    <span className="block truncate">{mod.name}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {mod.entities.length} cadastro(s)
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Coluna 2: Entidades e Campos */}
          <div className="flex-1 flex flex-col p-5 overflow-y-auto space-y-5 text-xs">
            {/* Seletor de Cadastro / Entidade */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2">
                Cadastros de {activeModule.name}
              </span>
              <div className="flex gap-2">
                {activeModule.entities.map((ent) => (
                  <button
                    key={ent.id}
                    onClick={() => setActiveEntityId(ent.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors ${
                      activeEntity?.id === ent.id
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {ent.pluralName}
                  </button>
                ))}
              </div>
            </div>

            {/* Campos do Cadastro Ativo */}
            {activeEntity && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      Campos de {activeEntity.name}
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Vínculo com Mapa ativo:{" "}
                      <span className="text-emerald-400 font-semibold">Sim (Drive / Posição)</span>
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {activeEntity.fields.length} campos definidos
                  </span>
                </div>

                {/* Tabela de Campos Existentes */}
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Rótulo (Label)</th>
                        <th className="p-2.5">Identificador (Key)</th>
                        <th className="p-2.5">Tipo de Dado</th>
                        <th className="p-2.5">Obrigatório</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {activeEntity.fields.map((field) => (
                        <tr key={field.id} className="hover:bg-slate-900/40">
                          <td className="p-2.5 font-semibold text-white">{field.label}</td>
                          <td className="p-2.5 font-mono text-slate-400">{field.key}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-400 font-mono text-[10px]">
                              {field.dataType}
                            </span>
                          </td>
                          <td className="p-2.5">
                            {field.isRequired ? (
                              <span className="text-red-400 font-bold">Sim</span>
                            ) : (
                              <span className="text-slate-500">Opcional</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Formulário para Adicionar Novo Campo */}
                <form
                  onSubmit={handleAddField}
                  className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                    + Adicionar Campo Personalizado
                  </span>
                  <div className="grid grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">
                        Nome do Campo
                      </label>
                      <input
                        type="text"
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        placeholder="Ex: Foto do Pallet"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">
                        Chave (opcional)
                      </label>
                      <input
                        type="text"
                        value={newFieldKey}
                        onChange={(e) => setNewFieldKey(e.target.value)}
                        placeholder="foto_pallet"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">
                        Tipo de Dado
                      </label>
                      <select
                        value={newFieldType}
                        onChange={(e) => setNewFieldType(e.target.value as FieldDataType)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                      >
                        <option value="text">Texto</option>
                        <option value="number">Número Inteiro</option>
                        <option value="decimal">Número Decimal</option>
                        <option value="boolean">Booleano (Sim/Não)</option>
                        <option value="date">Data</option>
                        <option value="datetime">Data e Hora</option>
                        <option value="select">Seleção (Lista)</option>
                        <option value="location_ref">Vínculo com Mapa (Drive/Posição)</option>
                        <option value="image">Imagem</option>
                        <option value="file">Arquivo / Laudo</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-300 pb-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newFieldRequired}
                          onChange={(e) => setNewFieldRequired(e.target.checked)}
                          className="rounded border-slate-700 text-blue-600"
                        />
                        <span>Obrigatório</span>
                      </label>
                      <button
                        type="submit"
                        className="ml-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs"
                      >
                        Salvar Campo
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
