// ============================================================
// NEXUS ERP — MapProperties / CompartmentOperationalCard.tsx
// Painel de Configuração de Compartimento (Armazenamento Aberto)
// Sem profundidade, sem nível e sem canais: funciona como espaço aberto.
// ============================================================

"use client"

import React, { useMemo } from "react"
import type { MapObject } from "../MapLibrary/types"
import { useSystemStore } from "../Systems/useSystemStore"

interface CompartmentOperationalCardProps {
  selectedObject: MapObject
  onUpdateObject: (partial: Partial<MapObject>) => void
  onUpdateProp: (key: string, value: unknown) => void
  allObjects?: MapObject[]
  workspaceId?: string
}

export default function CompartmentOperationalCard({
  selectedObject,
  onUpdateObject,
  onUpdateProp,
  allObjects = [],
  workspaceId,
}: CompartmentOperationalCardProps) {
  const props = selectedObject.props || {}
  const code = String(props.code || props.label || selectedObject.label || selectedObject.id.slice(0, 8))
  const responsible = String(props.responsible || "Supervisão Logística")
  const purpose = String(props.purpose || "Armazenamento Aberto")
  const observation = String(props.observation || "")

  const streetId = String(props.streetId || "")
  const streetName = String(props.streetName || "")
  const blocoId = String(props.blocoId || "")
  const bloco = String(props.bloco || "")

  const streetOptions = useMemo(() => {
    return allObjects.filter(
      (o) =>
        o.classification === "rua" ||
        o.classification === "circulacao" ||
        (o.category === "area" && (o.label || "").toLowerCase().includes("rua"))
    )
  }, [allObjects])

  const blockOptions = useMemo(() => {
    return allObjects.filter(
      (o) =>
        o.classification === "bloco" ||
        (o.category === "area" && (o.label || "").toLowerCase().includes("bloco"))
    )
  }, [allObjects])

  const parentAreaOptions = useMemo(() => {
    return allObjects.filter(
      (o) => (o.category === "area" || o.type === "floor") && o.id !== selectedObject.id
    )
  }, [allObjects, selectedObject.id])

  const handleSelectStreet = (stId: string) => {
    if (!stId) {
      onUpdateProp("streetId", undefined)
      onUpdateProp("streetName", undefined)
      return
    }
    const found = streetOptions.find((s) => s.id === stId)
    if (found) {
      onUpdateProp("streetId", found.id)
      onUpdateProp("streetName", found.label || found.id)
      if (found.parentId && !selectedObject.parentId) {
        onUpdateObject({ parentId: found.parentId })
      }
    }
  }

  const handleSelectBlock = (bId: string) => {
    if (!bId) {
      onUpdateProp("blocoId", undefined)
      onUpdateProp("bloco", undefined)
      return
    }
    const found = blockOptions.find((b) => b.id === bId)
    if (found) {
      onUpdateProp("blocoId", found.id)
      onUpdateProp("bloco", found.label || found.id)
    }
  }

  const { systems, linkStorageToSystem } = useSystemStore(workspaceId)
  const stockControlMode = String(props.stockControlMode || "livre") as "livre" | "vinculado_saldo"
  const stockSystemRef = String(props.stockSystemRef || "")

  const allowedCategories = String(props.allowedCategories || "Produtos Gerais, Paletes Avulsos, Triagem")
  const forbiddenCategories = String(props.forbiddenCategories || "")

  return (
    <div className="space-y-3.5 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-slate-100 text-xs">
      {/* 1. Identificação do Espaço Aberto */}
      <div className="space-y-2 pb-2.5 border-b border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
            Espaço Aberto · Compartimento
          </span>
          <span className="text-[9px] bg-amber-950/70 border border-amber-700/60 text-amber-300 font-mono px-2 py-0.5 rounded">
            Sem Nível / Prof.
          </span>
        </div>

        <p className="text-[10px] text-slate-400 leading-relaxed">
          Área de armazenamento aberto sem subdivisão em níveis ou profundidade. A visualização exibe a relação direta de paletes agrupados e itens livres.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Código / Identificador</label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                onUpdateProp("code", e.target.value)
                onUpdateProp("label", e.target.value)
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Nome / Etiqueta</label>
            <input
              type="text"
              value={String(selectedObject.label || "")}
              onChange={(e) => onUpdateObject({ label: e.target.value })}
              placeholder="Ex: Espaço Triagem 01"
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-[9px] text-slate-400 block mb-0.5">Finalidade do Espaço</label>
            <select
              value={purpose}
              onChange={(e) => onUpdateProp("purpose", e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200"
            >
              <option value="Armazenamento Aberto">Armazenamento Aberto</option>
              <option value="Chão / Não Alocados">Chão / Não Alocados</option>
              <option value="Triagem de Avarias">Triagem de Avarias</option>
              <option value="Quarentena Técnica">Quarentena Técnica</option>
              <option value="Pulmão de Entrada">Pulmão de Entrada</option>
              <option value="Área de Retrabalho">Área de Retrabalho</option>
              <option value="Staging de Expedição">Staging de Expedição</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] text-slate-400 block mb-0.5">Responsável Técnico</label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => onUpdateProp("responsible", e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* 2. Vínculo Estrutural & Localização */}
      <div className="space-y-2 p-2.5 bg-amber-950/20 rounded-lg border border-amber-800/40">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
            <span>🔗</span>
            <span>Localização & Vínculo Espacial</span>
          </span>
          {streetName && (
            <span className="text-[9px] bg-amber-900/60 text-amber-300 border border-amber-700/50 px-1.5 py-0.5 rounded font-mono">
              🛣️ {streetName}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-slate-300 font-medium flex items-center justify-between">
            <span>Rua / Corredor de Acesso</span>
            {streetId && (
              <button
                type="button"
                onClick={() => handleSelectStreet("")}
                className="text-[9px] text-red-400 hover:text-red-300"
              >
                Desvincular
              </button>
            )}
          </label>
          <select
            value={streetId}
            onChange={(e) => handleSelectStreet(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 font-medium focus:outline-none focus:border-amber-500"
          >
            <option value="">— Selecionar Rua no Mapa —</option>
            {streetOptions.map((st) => (
              <option key={st.id} value={st.id}>
                🛣️ {st.label || st.id} ({st.classification || "rua"})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-900/30">
          <div>
            <label className="text-[9px] text-slate-400 block mb-0.5">Bloco Estrutural</label>
            <select
              value={blocoId}
              onChange={(e) => handleSelectBlock(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-slate-200"
            >
              <option value="">— Selecionar Bloco —</option>
              {blockOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  🧱 {b.label || b.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] text-slate-400 block mb-0.5">Área / Galpão Pai</label>
            <select
              value={selectedObject.parentId || ""}
              onChange={(e) => onUpdateObject({ parentId: e.target.value || undefined })}
              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-slate-200"
            >
              <option value="">— Nível Raiz / Sem Pai —</option>
              {parentAreaOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.type === "floor" ? "🏢" : "📐"} {p.label || p.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(bloco || streetName || selectedObject.parentId) && (
          <div className="mt-1 p-1.5 bg-slate-950/70 rounded border border-slate-800/80 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
            <span className="text-amber-400">Hierarquia:</span>
            <span className="text-slate-300 truncate">
              {selectedObject.parentId ? "Galpão" : "Raiz"} ➔ {bloco ? bloco : "Geral"} ➔ {streetName || "Livre"} ➔ {code}
            </span>
          </div>
        )}
      </div>

      {/* 3. Regras & Observações */}
      <div className="space-y-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          Regras de Armazenamento Aberto
        </span>

        <div className="space-y-1.5">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">
              Itens / Categorias Permitidas
            </label>
            <input
              type="text"
              value={allowedCategories}
              onChange={(e) => onUpdateProp("allowedCategories", e.target.value)}
              placeholder="Ex: Produtos Gerais, Paletes Avulsos..."
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">
              Restrições / Proibições
            </label>
            <input
              type="text"
              value={forbiddenCategories}
              onChange={(e) => onUpdateProp("forbiddenCategories", e.target.value)}
              placeholder="Ex: Inflamáveis, Produtos Químicos..."
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-red-300 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">
              Observações Operacionais
            </label>
            <textarea
              rows={2}
              value={observation}
              onChange={(e) => onUpdateProp("observation", e.target.value)}
              placeholder="Notas sobre o uso deste espaço aberto..."
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 resize-none focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* 4. Controle de Acesso & Vínculo de Sistema */}
      <div
        className="space-y-2.5 p-2.5 rounded-lg border border-slate-700/60"
        style={{ background: stockControlMode === "vinculado_saldo" ? "rgba(16,30,54,0.85)" : "rgba(15,23,42,0.80)" }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5"
            style={{ color: stockControlMode === "vinculado_saldo" ? "#60a5fa" : "#94a3b8" }}
          >
            <span>🔐</span>
            <span>Vínculo com Sistema de Saldo</span>
          </span>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono border ${
              stockControlMode === "vinculado_saldo"
                ? "bg-blue-900/60 border-blue-700/50 text-blue-300"
                : "bg-slate-800/80 border-slate-700/50 text-slate-400"
            }`}
          >
            {stockControlMode === "vinculado_saldo" ? "Saldo Obrigatório" : "Livre"}
          </span>
        </div>

        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => onUpdateProp("stockControlMode", "livre")}
            className={`w-full flex items-start gap-2.5 p-2 rounded-lg border text-left transition-colors ${
              stockControlMode === "livre"
                ? "bg-slate-800/80 border-slate-600 ring-1 ring-slate-500/60"
                : "bg-slate-900/50 border-slate-800/60 hover:border-slate-700"
            }`}
          >
            <span
              className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                stockControlMode === "livre" ? "border-slate-400 bg-slate-400" : "border-slate-600 bg-transparent"
              }`}
            >
              {stockControlMode === "livre" && <span className="w-1.5 h-1.5 rounded-full bg-slate-950 block" />}
            </span>
            <div>
              <span className={`text-[11px] font-semibold block ${stockControlMode === "livre" ? "text-slate-200" : "text-slate-500"}`}>
                Livre — armazenamento aberto independente
              </span>
              <span className="text-[9px] text-slate-500 leading-tight">
                Permite alocar e gerenciar itens neste espaço aberto sem restrição de saldo externo.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onUpdateProp("stockControlMode", "vinculado_saldo")}
            className={`w-full flex items-start gap-2.5 p-2 rounded-lg border text-left transition-colors ${
              stockControlMode === "vinculado_saldo"
                ? "bg-blue-950/50 border-blue-700/60 ring-1 ring-blue-600/40"
                : "bg-slate-900/50 border-slate-800/60 hover:border-slate-700"
            }`}
          >
            <span
              className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                stockControlMode === "vinculado_saldo" ? "border-blue-400 bg-blue-400" : "border-slate-600 bg-transparent"
              }`}
            >
              {stockControlMode === "vinculado_saldo" && <span className="w-1.5 h-1.5 rounded-full bg-slate-950 block" />}
            </span>
            <div>
              <span className={`text-[11px] font-semibold block ${stockControlMode === "vinculado_saldo" ? "text-blue-300" : "text-slate-500"}`}>
                Vinculado ao Saldo — requer saldo no sistema
              </span>
              <span className="text-[9px] text-slate-500 leading-tight">
                Associa este espaço a um sistema de dados do workspace para rastreio de saldos.
              </span>
            </div>
          </button>
        </div>

        {stockControlMode === "vinculado_saldo" && (
          <div className="pt-1.5 border-t border-blue-900/40 space-y-1.5">
            <label className="text-[10px] text-blue-300 font-medium block">
              Sistema de Saldo Vinculado
            </label>
            <select
              value={stockSystemRef}
              onChange={(e) => {
                const chosenCode = e.target.value
                onUpdateProp("stockSystemRef", chosenCode)
                const foundSys = systems.find((s) => s.code === chosenCode || s.id === chosenCode)
                if (foundSys) {
                  linkStorageToSystem(foundSys.id, {
                    storageObjectId: selectedObject.id,
                    storageObjectLabel: String(selectedObject.label || code),
                    storageType: selectedObject.type,
                    role: "armazenamento",
                    stockControlMode: "vinculado_saldo",
                    permissions: {
                      allowInbound: true,
                      allowOutbound: true,
                      allowReturnToOrigin: true,
                    },
                    configuredAt: new Date().toISOString(),
                  })
                }
              }}
              className="w-full bg-blue-950/60 border border-blue-700/60 rounded px-2 py-1 text-xs text-blue-100 font-semibold focus:outline-none focus:border-blue-400"
            >
              <option value="">— Selecionar Sistema de Saldo —</option>
              {systems.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.icon} {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
