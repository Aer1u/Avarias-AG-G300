"use client"

import React, { useState, useEffect, useRef } from "react"
import { X, Plus, Box, Check, Search, Trash2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { MapeamentoConfig, MapeamentoItem } from "@/lib/mapeamentosStorage"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

export interface PalletItemRow {
  id: string
  sku: string
  descricao: string
  qty: number | ""
  customValues: Record<string, any>
}

export interface MapeamentoItemModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (items: MapeamentoItem[] | MapeamentoItem) => void | Promise<void>
  config: MapeamentoConfig
  posicao: string
  posicoesDisponiveis?: string[]
  nivelInicial: number
  profundidadeInicial: number
  itemParaEditar?: MapeamentoItem | null
  batchCoords?: { lvl: number; prof: number }[] | null
}

export function MapeamentoItemModal({
  isOpen,
  onClose,
  onSave,
  config,
  posicao,
  posicoesDisponiveis = [],
  nivelInicial,
  profundidadeInicial,
  itemParaEditar,
  batchCoords,
}: MapeamentoItemModalProps) {
  const [currentPosicao, setCurrentPosicao] = useState(posicao || posicoesDisponiveis[0] || "")
  const [destinationLevel, setDestinationLevel] = useState<number>(nivelInicial)
  const [destinationDepth, setDestinationDepth] = useState<number>(profundidadeInicial)

  const [items, setItems] = useState<PalletItemRow[]>([
    { id: "1", sku: "", descricao: "", qty: "", customValues: {} },
  ])

  // Busca na base_codigos
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null)
  const [searchResults, setSearchResults] = useState<{ codigo: string; descricao: string }[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const dropdownRefs = useRef<(HTMLTableCellElement | null)[]>([])

  useEffect(() => {
    if (isOpen) {
      if (itemParaEditar) {
        setCurrentPosicao(itemParaEditar.posicao)
        setDestinationLevel(itemParaEditar.nivel)
        setDestinationDepth(itemParaEditar.profundidade)
        setItems([
          {
            id: itemParaEditar.id,
            sku: itemParaEditar.sku,
            descricao: itemParaEditar.descricao || "",
            qty: itemParaEditar.quantidade,
            customValues: itemParaEditar.customValues || {},
          },
        ])
      } else {
        setCurrentPosicao(posicao || posicoesDisponiveis[0] || "")
        setDestinationLevel(nivelInicial)
        setDestinationDepth(profundidadeInicial)
        setItems([
          {
            id: Date.now().toString(),
            sku: "",
            descricao: "",
            qty: "",
            customValues: {},
          },
        ])
      }
      setActiveSearchIndex(null)
      setSearchResults([])
    }
  }, [isOpen, itemParaEditar, posicao, posicoesDisponiveis, nivelInicial, profundidadeInicial])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const isInside = dropdownRefs.current.some(ref => ref && ref.contains(target))
      if (!isInside) setActiveSearchIndex(null)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (!isOpen) return null

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now().toString() + "_" + Math.random().toString(36).substring(2, 5),
        sku: "",
        descricao: "",
        qty: "",
        customValues: {},
      },
    ])
  }

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const handleSearchSku = async (index: number, term: string) => {
    const upper = term.toUpperCase()
    setItems(prev =>
      prev.map((it, i) => (i === index ? { ...it, sku: upper } : it))
    )

    if (upper.trim().length < 2) {
      setSearchResults([])
      setActiveSearchIndex(null)
      return
    }

    try {
      setIsSearching(true)
      setActiveSearchIndex(index)
      const { data, error } = await supabase
        .from("base_codigos")
        .select("Código, Descrição")
        .or(`Código.ilike.%${upper}%,Descrição.ilike.%${upper}%`)
        .limit(8)

      if (!error && data) {
        setSearchResults(
          data.map((r: any) => ({
            codigo: r["Código"] || r.codigo || "",
            descricao: r["Descrição"] || r.descricao || "",
          }))
        )
      }
    } catch (err) {
      console.warn("Erro ao buscar SKU:", err)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectSku = (index: number, item: { codigo: string; descricao: string }) => {
    setItems(prev =>
      prev.map((it, i) =>
        i === index
          ? { ...it, sku: item.codigo, descricao: item.descricao }
          : it
      )
    )
    setActiveSearchIndex(null)
    setSearchResults([])
  }

  const handleChangeQty = (index: number, val: string) => {
    const num = val === "" ? "" : Math.max(1, Math.floor(Number(val)))
    setItems(prev =>
      prev.map((it, i) => (i === index ? { ...it, qty: num } : it))
    )
  }

  const handleSave = () => {
    const validItems = items.filter(
      i => i.sku.trim() !== "" && typeof i.qty === "number" && i.qty > 0
    )
    if (validItems.length === 0) {
      alert("Preencha ao menos um código e quantidade válida.")
      return
    }

    const isMix = validItems.length > 1
    const generatedPalletId = isMix
      ? "MIX-" + Math.random().toString(36).substring(2, 6).toUpperCase()
      : undefined

    const now = new Date().toISOString()
    const isBatch = !itemParaEditar && batchCoords && batchCoords.length > 1
    const targets = isBatch ? batchCoords : [{ lvl: destinationLevel, prof: destinationDepth }]

    const mapeamentoItemsToSave: MapeamentoItem[] = []

    targets.forEach(tgt => {
      validItems.forEach(item => {
        mapeamentoItemsToSave.push({
          id: itemParaEditar ? itemParaEditar.id : "item_" + Math.random().toString(36).substring(2, 9),
          mapeamentoId: config.id,
          posicao: currentPosicao,
          nivel: tgt.lvl,
          profundidade: tgt.prof,
          sku: item.sku.trim().toUpperCase(),
          descricao: item.descricao || "Item Mapeado",
          quantidade: Number(item.qty) || 1,
          idPalete: generatedPalletId || (itemParaEditar ? itemParaEditar.idPalete : undefined),
          customValues: item.customValues || {},
          criadoEm: itemParaEditar?.criadoEm || now,
          atualizadoEm: now,
        })
      })
    })

    onSave(mapeamentoItemsToSave)
    onClose()
  }

  const isMix = items.filter(i => i.sku.trim() !== "").length > 1

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 14 }}
          className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col relative z-10 max-h-[92vh] overflow-hidden"
        >
          {/* Header estilo G300 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                <Box size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    {itemParaEditar
                      ? "Editar Palete / Item"
                      : batchCoords && batchCoords.length > 1
                      ? `Mapear em Lote (${batchCoords.length} Células)`
                      : "Adicionar Palete na Posição"}
                  </h2>
                  {isMix && (
                    <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full uppercase">
                      Palete MIX
                    </span>
                  )}
                  {batchCoords && batchCoords.length > 1 && (
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase">
                      Lote: {batchCoords.length} Células
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {currentPosicao}
                  </span>
                  {batchCoords && batchCoords.length > 1 ? (
                    <>
                      <span>•</span>
                      <span>Aplicando em {batchCoords.length} células selecionadas</span>
                    </>
                  ) : (
                    <>
                      <span>•</span>
                      <span>Nível {destinationLevel}</span>
                      <span>•</span>
                      <span>Profundidade {destinationDepth}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Corpo com Tabela de Produtos (estilo G300 AddPalletModal) */}
          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
            <div className="w-full overflow-visible border border-slate-800 rounded-2xl bg-slate-950/40">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="text-left px-4 py-3 w-[45%]">Código SKU</th>
                    <th className="text-left px-4 py-3 w-[35%]">Descrição</th>
                    <th className="text-center px-3 py-3 w-[15%]">Quantidade</th>
                    <th className="w-10 px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((item, index) => {
                    const isActive = activeSearchIndex === index

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                        {/* Campo de Código com Busca Autocomplete */}
                        <td
                          className="px-3 py-2.5 relative"
                          ref={el => {
                            dropdownRefs.current[index] = el
                          }}
                        >
                          <div className="relative">
                            <input
                              type="text"
                              value={item.sku}
                              onChange={e => handleSearchSku(index, e.target.value)}
                              onFocus={() => {
                                if (item.sku.length >= 2) handleSearchSku(index, item.sku)
                              }}
                              placeholder="Buscar SKU (ex: 100234)..."
                              className="w-full h-9 px-3 rounded-xl border border-slate-700 bg-slate-800/90 text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
                            />
                            {isSearching && isActive && (
                              <div className="absolute right-3 top-2.5 text-blue-400 text-xs">
                                ...
                              </div>
                            )}

                            {/* Dropdown de Sugestões de SKU */}
                            {isActive && searchResults.length > 0 && (
                              <div className="absolute left-0 top-full mt-1.5 z-[999] w-[140%] max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                                <div className="p-1.5 max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-800">
                                  {searchResults.map((res, sIdx) => (
                                    <div
                                      key={sIdx}
                                      onClick={() => handleSelectSku(index, res)}
                                      className="p-2.5 hover:bg-blue-600/20 hover:border-blue-500/30 rounded-xl cursor-pointer transition-colors"
                                    >
                                      <p className="font-mono font-bold text-xs text-blue-400">
                                        {res.codigo}
                                      </p>
                                      <p className="text-[11px] text-slate-300 truncate mt-0.5">
                                        {res.descricao}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Descrição */}
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={item.descricao}
                            onChange={e =>
                              setItems(prev =>
                                prev.map((it, i) =>
                                  i === index ? { ...it, descricao: e.target.value } : it
                                )
                              )
                            }
                            placeholder="Descrição do produto..."
                            className="w-full h-9 px-3 rounded-xl border border-slate-700 bg-slate-800/60 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Quantidade */}
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={e => handleChangeQty(index, e.target.value)}
                            placeholder="Qtd"
                            className="w-full h-9 px-2 rounded-xl border border-slate-700 bg-slate-800/90 text-xs font-bold text-center text-white focus:outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Excluir linha */}
                        <td className="px-2 py-2.5 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                              title="Remover linha"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Botão + Produto (MIX) estilo G300 */}
            {!itemParaEditar && (
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full h-10 flex items-center justify-center gap-2 border border-dashed border-slate-700 hover:border-blue-500 text-slate-400 hover:text-blue-400 font-semibold text-xs uppercase rounded-xl transition-colors cursor-pointer"
              >
                <Plus size={15} /> + Adicionar Produto no Mesmo Palete (MIX)
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500">
              Total de itens: <strong className="text-slate-300">{items.length} produto(s)</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-2"
              >
                <Check size={16} /> Confirmar e Mapear {batchCoords && batchCoords.length > 1 ? `(${batchCoords.length} Células)` : ""}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
