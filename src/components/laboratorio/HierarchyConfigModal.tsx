// ============================================================
// NEXUS ERP — laboratorio / HierarchyConfigModal.tsx
// Gerenciador de Hierarquia Física Configurável & Regras de Endereço
// ============================================================

"use client"

import React, { useState } from "react"
import type { HierarchyLevel, AddressingRuleConfig } from "../MapLibrary/modulesTypes"

interface HierarchyConfigModalProps {
  isOpen: boolean
  onClose: () => void
  hierarchy: HierarchyLevel[]
  addressRule: AddressingRuleConfig
  onSaveHierarchy: (levels: HierarchyLevel[]) => void
  onSaveAddressRule: (rule: AddressingRuleConfig) => void
}

export default function HierarchyConfigModal({
  isOpen,
  onClose,
  hierarchy,
  addressRule,
  onSaveHierarchy,
  onSaveAddressRule,
}: HierarchyConfigModalProps) {
  const [levels, setLevels] = useState<HierarchyLevel[]>(hierarchy)
  const [rule, setRule] = useState<AddressingRuleConfig>(addressRule)

  const [newLevelName, setNewLevelName] = useState("")

  if (!isOpen) return null

  const handleAddLevel = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLevelName.trim()) return

    const newLevel: HierarchyLevel = {
      id: `lvl_${crypto.randomUUID().slice(0, 6)}`,
      level: levels.length,
      name: newLevelName.trim(),
      pluralName: `${newLevelName.trim()}s`,
      canContainSublevels: true,
      icon: "📍",
      color: "#3b82f6",
    }

    const updated = [...levels, newLevel]
    setLevels(updated)
    onSaveHierarchy(updated)
    setNewLevelName("")
  }

  const handleRemoveLevel = (id: string) => {
    const updated = levels.filter((l) => l.id !== id)
    setLevels(updated)
    onSaveHierarchy(updated)
  }

  const handleSaveRule = () => {
    onSaveAddressRule(rule)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col text-slate-100 shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Hierarquia Física & Padrões de Endereçamento
            </h3>
            <p className="text-xs text-slate-400">
              Configure a estrutura espacial do armazém e a regra de composição dos códigos
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Seção 1: Hierarquia Configurável */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                1. Níveis Hierárquicos da Organização
              </span>
              <span className="text-[10px] text-slate-500">
                Sem estruturas fixas obrigatórias
              </span>
            </div>

            {/* Lista de Níveis */}
            <div className="space-y-2">
              {levels.map((lvl, idx) => (
                <div
                  key={lvl.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-400">
                      {idx}
                    </span>
                    <span className="text-sm">{lvl.icon}</span>
                    <div>
                      <span className="font-bold text-white text-xs">{lvl.name}</span>
                      <span className="text-[10px] text-slate-500 ml-2">
                        {lvl.canContainSublevels ? "Aceita subníveis" : "Nível terminal"}
                      </span>
                    </div>
                  </div>
                  {levels.length > 2 && (
                    <button
                      onClick={() => handleRemoveLevel(lvl.id)}
                      className="text-slate-500 hover:text-red-400 text-xs px-2 py-1"
                    >
                      Remover
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Adicionar Nível */}
            <form onSubmit={handleAddLevel} className="flex gap-2 pt-1">
              <input
                type="text"
                value={newLevelName}
                onChange={(e) => setNewLevelName(e.target.value)}
                placeholder="Ex: Sub-bloco, Prateleira, Gaiola..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs"
              >
                + Adicionar Nível
              </button>
            </form>
          </div>

          {/* Seção 2: Regra de Endereçamento Universal */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
              2. Padrão de Composição de Endereços
            </span>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  Prefixo Global (ex: G300)
                </label>
                <input
                  type="text"
                  value={rule.prefix}
                  onChange={(e) => setRule({ ...rule, prefix: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  Dígitos do Chão / Corredor
                </label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={rule.aisleLength}
                  onChange={(e) => setRule({ ...rule, aisleLength: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  Padrão de Lados
                </label>
                <select
                  value={rule.sideType}
                  onChange={(e) => setRule({ ...rule, sideType: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                >
                  <option value="letra">Letra (G / D - Padrão G300)</option>
                  <option value="par_impar">PAR / ÍMPAR</option>
                  <option value="livre">Sem distinção de lado</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  Separador entre Segmentos
                </label>
                <input
                  type="text"
                  value={rule.separator}
                  onChange={(e) => setRule({ ...rule, separator: e.target.value })}
                  placeholder="Vazio ou hífen -"
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200"
                />
              </div>

              <div className="col-span-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">Exemplo resultante:</span>
                  <span className="font-mono text-sm font-bold text-amber-400">
                    {rule.prefix}004G0281
                  </span>
                </div>
                <button
                  onClick={handleSaveRule}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs"
                >
                  Salvar Regra
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-3 border-t border-slate-800 flex justify-end bg-slate-950/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
