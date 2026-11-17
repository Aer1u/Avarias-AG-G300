// ============================================================
// NEXUS ERP — MapToolbar / UniversalSearchSpotlight.tsx
// Pesquisa Universal e Geolocalização Interna de Espaços e Objetos
// Localiza qualquer elemento, centraliza a câmera, ajusta zoom e destaca
// ============================================================

"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import type { MapObject } from "../MapLibrary/types"

interface UniversalSearchSpotlightProps {
  isOpen: boolean
  onClose: () => void
  objects: MapObject[]
  onSelectAndLocate: (obj: MapObject) => void
}

export default function UniversalSearchSpotlight({
  isOpen,
  onClose,
  objects,
  onSelectAndLocate,
}: UniversalSearchSpotlightProps) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery("")
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Filtragem inteligente de múltiplos atributos
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // Exibe os primeiros itens mais relevantes por padrão
      return objects.slice(0, 12)
    }

    return objects
      .filter((obj) => {
        const label = (obj.label || "").toLowerCase()
        const code = String(obj.props.code || "").toLowerCase()
        const type = obj.type.toLowerCase()
        const category = obj.category.toLowerCase()
        const classification = (obj.classification || "").toLowerCase()
        const chao = String(obj.props.chao || "").toLowerCase()
        const bloco = String(obj.props.bloco || "").toLowerCase()
        const lado = String(obj.props.lado || "").toLowerCase()

        return (
          label.includes(q) ||
          code.includes(q) ||
          type.includes(q) ||
          category.includes(q) ||
          classification.includes(q) ||
          chao.includes(q) ||
          bloco.includes(q) ||
          lado.includes(q)
        )
      })
      .slice(0, 15)
  }, [query, objects])

  // Navegação por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % (results.length || 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + (results.length || 1)) % (results.length || 1))
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault()
        onSelectAndLocate(results[selectedIndex])
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, results, selectedIndex, onSelectAndLocate, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-24 p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl text-slate-100 shadow-2xl overflow-hidden flex flex-col">
        {/* Campo de Busca Principal */}
        <div className="p-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-950/60">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 shrink-0">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Pesquise drive (ex: G300004G0281), setor, chão, piso ou classificação..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
            ESC para fechar
          </span>
        </div>

        {/* Lista de Resultados */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {results.map((obj, idx) => {
            const isSelected = idx === selectedIndex
            const code = String(obj.props.code || obj.label || obj.id.slice(0, 8))
            const isArea = obj.category === "area" || obj.type === "delimited_area"

            return (
              <div
                key={obj.id}
                onClick={() => {
                  onSelectAndLocate(obj)
                  onClose()
                }}
                className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800/60 text-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                    isArea ? "bg-amber-950/80 text-amber-400 border border-amber-800/40" : "bg-slate-800 text-blue-400"
                  }`}>
                    {isArea ? "📐" : "📍"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs tracking-tight font-mono">
                        {code}
                      </span>
                      {obj.classification && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-sans">
                          {obj.classification}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] block ${isSelected ? "text-blue-100" : "text-slate-500"}`}>
                      {obj.props.chao ? `Chão ${obj.props.chao} • Bloco ${obj.props.bloco || "1"} • Lado ${obj.props.lado || "PAR"}` : obj.type}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] uppercase font-bold block ${isSelected ? "text-blue-200" : "text-slate-400"}`}>
                    Navegar →
                  </span>
                  <span className={`text-[9px] font-mono ${isSelected ? "text-blue-200" : "text-slate-500"}`}>
                    X:{Math.round(obj.x)} Y:{Math.round(obj.y)}
                  </span>
                </div>
              </div>
            )
          })}

          {results.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhuma estrutura ou região encontrada para &quot;{query}&quot;.
            </div>
          )}
        </div>

        {/* Rodapé do Spotlight */}
        <div className="p-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[10px] text-slate-500 px-4">
          <span>Use as setas ↑ ↓ para navegar e Enter para ir ao local</span>
          <span>{results.length} resultado(s)</span>
        </div>
      </div>
    </div>
  )
}
