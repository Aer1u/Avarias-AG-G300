// ============================================================
// NEXUS ERP — MapLibrary / MapLibraryPanel.tsx
// Painel lateral de biblioteca de elementos vetoriais autorais
// Permite buscar e adicionar qualquer elemento ao canvas
// ============================================================

"use client"

import React, { useState } from "react"
import type { MapCategory, MapElementDefinition } from "./types"
import { ALL_ELEMENTS, CATEGORY_META, ELEMENTS_BY_CATEGORY, searchElements } from "./registry"

interface MapLibraryPanelProps {
  onAddElement: (elemDef: MapElementDefinition) => void
}

const CATEGORIES: MapCategory[] = [
  "architectural",
  "storage",
  "equipment",
  "logistics",
  "orientation",
  "geometric",
]

export default function MapLibraryPanel({ onAddElement }: MapLibraryPanelProps) {
  const [activeCategory, setActiveCategory] = useState<MapCategory | "all">("all")
  const [search, setSearch] = useState("")

  const filteredElements = search.trim()
    ? searchElements(search)
    : activeCategory === "all"
    ? ALL_ELEMENTS
    : ELEMENTS_BY_CATEGORY.get(activeCategory) ?? []

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 border-r border-slate-800 text-slate-100 select-none overflow-hidden">
      {/* Cabeçalho */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Biblioteca Vetorial
          </h3>
          <p className="text-[11px] text-slate-500">
            {ALL_ELEMENTS.length} componentes autorais
          </p>
        </div>
        <span className="text-[10px] bg-blue-950/80 text-blue-400 border border-blue-800/40 px-2 py-0.5 rounded font-mono">
          Nativo 2D
        </span>
      </div>

      {/* Campo de Busca */}
      <div className="p-2.5 border-b border-slate-800/80">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar parede, porta-paletes, empilhadeira..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Tabs de Categorias */}
      {!search.trim() && (
        <div className="flex gap-1 p-2 overflow-x-auto border-b border-slate-800/80 no-scrollbar">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors ${
              activeCategory === "all"
                ? "bg-blue-600 text-white"
                : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            Todos ({ALL_ELEMENTS.length})
          </button>
          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat]
            const count = ELEMENTS_BY_CATEGORY.get(cat)?.length ?? 0
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                <span className="text-[10px] opacity-60">({count})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Lista / Grade de Elementos */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2.5">
        {filteredElements.map((elem) => {
          const Preview = elem.PreviewSVG
          return (
            <div
              key={elem.type}
              onClick={() => onAddElement(elem)}
              className="bg-slate-950/70 border border-slate-800/80 hover:border-blue-500/80 hover:bg-slate-800/40 rounded-xl p-2.5 flex flex-col items-center text-center cursor-pointer group transition-all"
              title={elem.description}
            >
              {/* Visualizador do SVG autoral */}
              <div className="w-full h-16 flex items-center justify-center bg-slate-900/60 rounded-lg p-1.5 mb-2 group-hover:scale-105 transition-transform">
                <Preview width={56} height={40} />
              </div>
              <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 line-clamp-1 transition-colors">
                {elem.label}
              </span>
              <span className="text-[10px] text-slate-500 line-clamp-1">
                {CATEGORY_META[elem.category]?.label}
              </span>
            </div>
          )
        })}

        {filteredElements.length === 0 && (
          <div className="col-span-2 py-8 text-center text-xs text-slate-500">
            Nenhum elemento encontrado.
          </div>
        )}
      </div>

      {/* Dica no rodapé do painel */}
      <div className="p-2.5 border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
        Clique no componente para inserir no centro do mapa
      </div>
    </div>
  )
}
