"use client"

import React from "react"
import { Download, Edit2, Trash2, Eye } from "lucide-react"
import { MapeamentoConfig, MapeamentoItem } from "@/lib/mapeamentosStorage"

interface MapeamentoTableProps {
  activeConfig: MapeamentoConfig | null
  items: MapeamentoItem[]
  onOpenDriveIn: (posId: string) => void
  onEditItem: (item: MapeamentoItem) => void
  onDeleteItem: (itemId: string) => void
  onExportExcel: () => void
}

export function MapeamentoTable({
  activeConfig,
  items,
  onOpenDriveIn,
  onEditItem,
  onDeleteItem,
  onExportExcel,
}: MapeamentoTableProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Registros do Mapeamento: {activeConfig?.nome}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Total de {items.length} registros cadastrados neste mapeamento
          </p>
        </div>

        <button
          onClick={onExportExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors text-xs font-semibold cursor-pointer"
        >
          <Download size={13} /> Exportar Excel
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Posição</th>
              <th className="py-3 px-3">Slot (N/P)</th>
              <th className="py-3 px-3">Palete</th>
              <th className="py-3 px-4">Código SKU</th>
              <th className="py-3 px-4">Descrição</th>
              <th className="py-3 px-3 text-right">Qtd</th>
              {activeConfig?.camposPersonalizados.map(field => (
                <th key={field.id} className="py-3 px-3">
                  {field.nome}
                </th>
              ))}
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7 + (activeConfig?.camposPersonalizados.length || 0)}
                  className="py-12 text-center text-slate-400 text-xs"
                >
                  Nenhum item registrado neste mapeamento ainda.
                </td>
              </tr>
            ) : (
              items.map(it => (
                <tr
                  key={it.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                    <button
                      onClick={() => onOpenDriveIn(it.posicao)}
                      className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {it.posicao}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-mono">
                    N{it.nivel} · P{it.profundidade}
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                      {it.idPalete || "-"}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {it.sku}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                    {it.descricao || "-"}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {it.quantidade}
                  </td>
                  {activeConfig?.camposPersonalizados.map(field => (
                    <td key={field.id} className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {String(it.customValues?.[field.id] ?? "-")}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onEditItem(it)}
                        className="p-1 text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                        title="Editar item"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => onDeleteItem(it.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Excluir item"
                      >
                        <Trash2 size={13} />
                      </button>
                      <button
                        onClick={() => onOpenDriveIn(it.posicao)}
                        className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Ver na grade"
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
