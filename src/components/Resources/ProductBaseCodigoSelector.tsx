// ============================================================
// NEXUS ERP — Resources / ProductBaseCodigoSelector.tsx
// Componente de Seleção & Busca em Tempo Real na tabela base_codigos
// Integração direta com o catálogo de 400+ SKUs do sistema
// ============================================================

"use client"

import React, { useState, useEffect, useRef } from "react"
import { searchBaseCodigos, type BaseCodigoItem } from "./baseCodigosService"
import AddBaseCodigoModal from "./AddBaseCodigoModal"

interface ProductBaseCodigoSelectorProps {
  onSelectProduct: (product: BaseCodigoItem) => void
  selectedCode?: string
  placeholder?: string
}

export default function ProductBaseCodigoSelector({
  onSelectProduct,
  selectedCode = "",
  placeholder = "Buscar por SKU ou descrição (ex: 1705-01, ESPREMEDOR)...",
}: ProductBaseCodigoSelectorProps) {
  const [query, setQuery] = useState(selectedCode)
  const [results, setResults] = useState<BaseCodigoItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Busca inicial ou conforme o usuário digita
  useEffect(() => {
    let active = true
    setIsLoading(true)

    const timer = setTimeout(async () => {
      const res = await searchBaseCodigos(query, 12)
      if (active) {
        setResults(res.data)
        setIsLoading(false)
      }
    }, 180)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query])

  // Fecha dropdown se clicar fora
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

  const handleSelect = (item: BaseCodigoItem) => {
    setQuery(`${item["Código"]} — ${item["Descrição"]}`)
    setIsOpen(false)
    onSelectProduct(item)
  }

  const handleCreatedSuccess = (newItem: BaseCodigoItem) => {
    handleSelect(newItem)
  }

  return (
    <div ref={containerRef} className="relative w-full text-xs">
      {/* Campo de Busca */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          placeholder={placeholder}
          className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-sans"
        />
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          {isLoading && <span className="animate-spin text-slate-400 text-xs">⏳</span>}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-2 py-0.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-300 rounded text-[10px] font-bold flex items-center gap-1"
            title="Cadastrar novo SKU na tabela base_codigos"
          >
            <span>+</span>
            <span>Novo</span>
          </button>
        </div>
      </div>

      {/* Dropdown de Resultados da base_codigos */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#0e1626] border border-slate-700/80 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-800">
          <div className="p-2 bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between sticky top-0">
            <span>Resultados de base_codigos ({results.length})</span>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="text-purple-400 hover:text-purple-300 normal-case font-semibold text-[10px]"
            >
              + Cadastrar Produto
            </button>
          </div>

          {results.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-xs">
              <p>Nenhum produto encontrado na tabela base_codigos para "{query}".</p>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="mt-2 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold"
              >
                + Cadastrar "{query}" agora
              </button>
            </div>
          ) : (
            results.map((item, idx) => (
              <div
                key={`${item["Código"]}_${idx}`}
                onClick={() => handleSelect(item)}
                className="p-2.5 hover:bg-purple-950/40 cursor-pointer transition-colors flex items-center justify-between text-xs group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400">{item["Código"]}</span>
                    {item.Grade && (
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded font-mono">
                        Grade: {item.Grade}
                      </span>
                    )}
                    {item.Tipo && (
                      <span className="text-[9px] bg-blue-950 text-blue-300 border border-blue-800/40 px-1 rounded font-mono">
                        {item.Tipo}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-200 truncate mt-0.5 font-medium">
                    {item["Descrição"]}
                  </div>
                </div>

                <span className="text-purple-400 opacity-0 group-hover:opacity-100 text-xs transition-opacity shrink-0 ml-2">
                  Selecionar ➔
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal de Cadastrar Produto se não existir */}
      <AddBaseCodigoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleCreatedSuccess}
      />
    </div>
  )
}
