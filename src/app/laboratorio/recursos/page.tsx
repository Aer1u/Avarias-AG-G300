// ============================================================
// NEXUS ERP — /laboratorio/recursos/page.tsx
// Rota de visualização dedicada do Motor Universal de Recursos
// ============================================================

"use client"

import React, { useState } from "react"
import Link from "next/link"
import ResourceEngineModal from "@/components/Resources/ResourceEngineModal"
import { useResourceStore } from "@/components/Resources/useResourceStore"
import { RESOURCE_CATEGORY_META, type ResourceCategory } from "@/components/Resources/types"

export default function RecursosPage() {
  const { types, instances, countsByCategory } = useResourceStore()
  const [isModalOpen, setIsModalOpen] = useState(true)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Topo de Navegação */}
      <header className="h-14 border-b border-slate-800 bg-slate-900 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/laboratorio/mapeamento"
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <span>◀</span>
            <span>Voltar ao Editor de Mapas</span>
          </Link>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-2">
            <span className="text-xl">🔷</span>
            <span className="text-sm font-bold text-slate-100">
              NEXUS ERP · Motor Universal de Recursos
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5"
          >
            <span>🔷</span>
            <span>Abrir Painel Completo</span>
          </button>
        </div>
      </header>

      {/* Visão de Visão Geral (Overview) */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            Contabilização & Alocação de Recursos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestão estrutural de Produtos, Embalagens, Equipamentos, Materiais, Documentos, Arquivos, Vagas e Unidades.
          </p>
        </div>

        {/* Grade de Categorias */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(RESOURCE_CATEGORY_META).map(([catKey, meta]) => {
            const count = countsByCategory[catKey as ResourceCategory] || 0
            const typeList = types.filter((t) => t.category === catKey)

            return (
              <div
                key={catKey}
                onClick={() => setIsModalOpen(true)}
                className="p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer group hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{meta.icon}</span>
                  <span
                    className="text-lg font-bold font-mono px-2.5 py-0.5 rounded-lg"
                    style={{
                      backgroundColor: `${meta.color}20`,
                      color: meta.color,
                      border: `1px solid ${meta.color}40`,
                    }}
                  >
                    {count}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-100 mt-3 group-hover:text-amber-400 transition-colors">
                  {meta.label}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{meta.description}</p>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{typeList.length} modelo(s) de tipo</span>
                  <span className="text-blue-400 group-hover:translate-x-0.5 transition-transform">
                    Gerenciar ➔
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Recursos Recentes */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200">
              Recursos Cadastrados Recentemente ({instances.length})
            </h2>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
            >
              Ver todos no Gerenciador ➔
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {instances.slice(0, 8).map((inst) => {
              const type = types.find((t) => t.id === inst.typeId)

              return (
                <div
                  key={inst.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{type?.icon || "🔷"}</span>
                    <span className="text-[10px] font-mono text-amber-400">{inst.code}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 truncate">{inst.label}</h4>
                  <div className="text-[10px] text-slate-400">
                    {inst.linkedLocations.length > 0 ? (
                      <span className="text-emerald-400">
                        📍 {inst.linkedLocations.length} local(is) vinculado(s)
                      </span>
                    ) : (
                      <span className="text-slate-500">Sem local vinculado</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Modal Interativo do Motor */}
      <ResourceEngineModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        allObjects={[]}
      />
    </div>
  )
}
