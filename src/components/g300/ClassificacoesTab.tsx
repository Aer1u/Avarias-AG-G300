// =============================================================================
// SYSTEM: MÓDULO G300 (ESTOQUE, AVARIAS & DRIVE-IN)
// OWNER:  Workspace Admin G300 (Nível 3)
// SCOPE:  Sub-aba de Classificações (Regra B - Avaliação linha a linha)
// PURPOSE: Consulta, filtros, sumarização por SKU/Posição, exportação Excel/CSV/PDF
//          e atualização individual ou em lote da classificação dos paletes.
// =============================================================================

"use client"

import React, { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Tag,
  Package,
  Layers,
  MapPin,
  Search,
  Download,
  FileText,
  Printer,
  RefreshCw,
  Check,
  X,
} from "lucide-react"
import * as XLSX from "xlsx"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { saveSnapshot } from "@/lib/offlineDb"
import { syncManager } from "@/lib/syncManager"
import {
  ClassificacaoPalete,
  CLASSIFICACAO_OPTIONS,
  extractRowClassificacao,
  normalizeClassificacao,
  getPalletCountTripletKey,
  isMissingClassificacaoColumnError,
} from "@/lib/mapeamentoUtils"

export interface DevolucaoPrintPayload {
  rows: any[]
  classificacaoFilter: "todas" | "Devolução" | "Normal" | "Não definido"
  localFilter: "todos" | "drive" | "chao" | "retrabalho" | "quarentena"
  nivelFilter: string
  profFilter: string
  avariaFilter: "todos" | "molhado" | "tombado" | "sem_avaria"
  searchQuery: string
}

interface ClassificacoesTabProps {
  effectiveData: any[]
  data: any[]
  setData: React.Dispatch<React.SetStateAction<any[]>>
  search: string
  pendingChanges: any[]
  setPendingChanges: React.Dispatch<React.SetStateAction<any[]>>
  updatingClassificacaoId: string | null
  onUpdateRowClassificacao: (row: any, nextValue: ClassificacaoPalete) => Promise<void> | void
  onMissingClassificacaoColumn: () => void
  onVerNoMapa: (posId: string) => void
  onPrintDevolucoes: (payload: DevolucaoPrintPayload) => void
  fmtNum: (val: number, locale?: string) => string
}

export function ClassificacoesTab({
  effectiveData,
  data,
  setData,
  search,
  pendingChanges,
  setPendingChanges,
  updatingClassificacaoId,
  onUpdateRowClassificacao,
  onMissingClassificacaoColumn,
  onVerNoMapa,
  onPrintDevolucoes,
  fmtNum,
}: ClassificacoesTabProps) {
  const [devolucaoClassificacaoFilter, setDevolucaoClassificacaoFilter] = useState<
    "todas" | "Devolução" | "Normal" | "Não definido"
  >("todas")
  const [devolucaoSearch, setDevolucaoSearch] = useState("")
  const [devolucaoLocalFilter, setDevolucaoLocalFilter] = useState<
    "todos" | "drive" | "chao" | "retrabalho" | "quarentena"
  >("todos")
  const [devolucaoNivelFilter, setDevolucaoNivelFilter] = useState<string>("todos")
  const [devolucaoProfFilter, setDevolucaoProfFilter] = useState<string>("todos")
  const [devolucaoAvariaFilter, setDevolucaoAvariaFilter] = useState<
    "todos" | "molhado" | "tombado" | "sem_avaria"
  >("todos")
  const [selectedClassificacaoIds, setSelectedClassificacaoIds] = useState<Set<string>>(new Set())
  const [isUpdatingBulkClassificacao, setIsUpdatingBulkClassificacao] = useState(false)
  const [bulkClassificacaoFeedback, setBulkClassificacaoFeedback] = useState<{
    type: "success" | "error"
    msg: string
  } | null>(null)

  const devolucoesBaseRows = useMemo(() => {
    return effectiveData.filter(
      (item) => !item.is_empty && Number(item.quantidade_total || 0) > 0
    )
  }, [effectiveData])

  const devolucaoFilterOptions = useMemo(() => {
    const niveis = new Set<string>()
    const profs = new Set<string>()
    devolucoesBaseRows.forEach((r) => {
      const n =
        r.nivel !== undefined && r.nivel !== null && String(r.nivel).trim() !== ""
          ? String(r.nivel).trim()
          : ""
      const p =
        r.profundidade !== undefined &&
        r.profundidade !== null &&
        String(r.profundidade).trim() !== ""
          ? String(r.profundidade).trim()
          : ""
      if (n) niveis.add(n)
      if (p) profs.add(p)
    })
    return {
      niveis: Array.from(niveis).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)),
      profs: Array.from(profs).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)),
    }
  }, [devolucoesBaseRows])

  const filteredDevolucoes = useMemo(() => {
    const q1 = devolucaoSearch.trim().toLowerCase()
    const q2 = search.trim().toLowerCase()
    return devolucoesBaseRows.filter((item) => {
      const cls = extractRowClassificacao(item)
      if (devolucaoClassificacaoFilter === "Devolução" && cls !== "Devolução") return false
      if (devolucaoClassificacaoFilter === "Normal" && cls !== "Normal") return false
      if (devolucaoClassificacaoFilter === "Não definido" && cls !== "") return false

      const posUpper = String(item.posicao || "").trim().toUpperCase()
      const isRetrabalho = posUpper.includes("RETRABALHO")
      const isQuarentena = posUpper.includes("QUARENTENA")
      const isChao =
        !posUpper ||
        posUpper === "S/P" ||
        posUpper === "NÃO INFORMADO" ||
        posUpper === "-" ||
        posUpper === "CHÃO" ||
        posUpper === "CHAO" ||
        item.is_unallocated_source
      const isDrive = !isRetrabalho && !isQuarentena && !isChao

      if (devolucaoLocalFilter === "drive" && !isDrive) return false
      if (devolucaoLocalFilter === "chao" && !isChao) return false
      if (devolucaoLocalFilter === "retrabalho" && !isRetrabalho) return false
      if (devolucaoLocalFilter === "quarentena" && !isQuarentena) return false

      if (devolucaoNivelFilter !== "todos") {
        const nv = item.nivel !== undefined && item.nivel !== null ? String(item.nivel).trim() : ""
        if (nv !== devolucaoNivelFilter) return false
      }

      if (devolucaoProfFilter !== "todos") {
        const pr =
          item.profundidade !== undefined && item.profundidade !== null
            ? String(item.profundidade).trim()
            : ""
        if (pr !== devolucaoProfFilter) return false
      }

      const molh = Number(item.qtd_molhado || 0)
      const tomb = Number(item.qtd_tombada || 0)
      if (devolucaoAvariaFilter === "molhado" && molh <= 0) return false
      if (devolucaoAvariaFilter === "tombado" && tomb <= 0) return false
      if (devolucaoAvariaFilter === "sem_avaria" && (molh > 0 || tomb > 0)) return false

      if (q1 || q2) {
        const haystack = [
          item.id_palete,
          item.posicao,
          item.produto,
          item.descricao,
          item.profundidade,
          item.nivel,
          item.observacao,
          cls || "Não definido",
        ]
          .map((v) => String(v ?? ""))
          .join(" ")
          .toLowerCase()
        if (q1 && !haystack.includes(q1)) return false
        if (q2 && !haystack.includes(q2)) return false
      }

      return true
    })
  }, [
    devolucoesBaseRows,
    devolucaoClassificacaoFilter,
    devolucaoSearch,
    search,
    devolucaoLocalFilter,
    devolucaoNivelFilter,
    devolucaoProfFilter,
    devolucaoAvariaFilter,
  ])

  const selectableDevolucaoIds = useMemo(() => {
    return filteredDevolucoes
      .filter((r) => r && r.id !== undefined && r.id !== null)
      .map((r) => String(r.id))
  }, [filteredDevolucoes])

  const allFilteredClassificacoesSelected =
    selectableDevolucaoIds.length > 0 &&
    selectableDevolucaoIds.every((id) => selectedClassificacaoIds.has(id))

  const devolucoesStats = useMemo(() => {
    const totalLinhas = filteredDevolucoes.length
    const totalPecas = filteredDevolucoes.reduce((acc, r) => acc + (Number(r.quantidade_total) || 0), 0)
    const totalTombado = filteredDevolucoes.reduce((acc, r) => acc + (Number(r.qtd_tombada) || 0), 0)
    const totalMolhado = filteredDevolucoes.reduce((acc, r) => acc + (Number(r.qtd_molhado) || 0), 0)
    const skusSet = new Set(filteredDevolucoes.map((r) => String(r.produto || "").trim()).filter(Boolean))
    const posSet = new Set(filteredDevolucoes.map((r) => String(r.posicao || "Chão").trim() || "Chão"))
    const physicalTriplets = new Set(
      filteredDevolucoes.map((r) => {
        const tk = getPalletCountTripletKey(r)
        if (tk) return tk
        return `NOID::${String(r.posicao || "")}::P:${String(r.profundidade ?? "")}::N:${String(r.nivel ?? "")}::ROW:${String(r.id)}`
      })
    )
    return {
      totalLinhas,
      totalPecas,
      totalTombado,
      totalMolhado,
      skusDistintos: skusSet.size,
      posicoesDistintas: posSet.size,
      paletesFisicosUnicos: physicalTriplets.size,
    }
  }, [filteredDevolucoes])

  const devolucoesResumoPorSku = useMemo(() => {
    const map = new Map<
      string,
      {
        sku: string
        descricao: string
        linhas: number
        quantidade: number
        tombado: number
        molhado: number
        triplets: Set<string>
        posicoes: Set<string>
      }
    >()

    filteredDevolucoes.forEach((r) => {
      const sku = String(r.produto || "SEM CÓDIGO").trim() || "SEM CÓDIGO"
      if (!map.has(sku)) {
        map.set(sku, {
          sku,
          descricao: String(r.descricao || "-"),
          linhas: 0,
          quantidade: 0,
          tombado: 0,
          molhado: 0,
          triplets: new Set(),
          posicoes: new Set(),
        })
      }
      const entry = map.get(sku)!
      entry.linhas += 1
      entry.quantidade += Number(r.quantidade_total) || 0
      entry.tombado += Number(r.qtd_tombada) || 0
      entry.molhado += Number(r.qtd_molhado) || 0
      const tk =
        getPalletCountTripletKey(r) ||
        `NOID::${String(r.posicao || "")}::P:${String(r.profundidade ?? "")}::N:${String(r.nivel ?? "")}::ROW:${String(r.id)}`
      entry.triplets.add(tk)
      entry.posicoes.add(String(r.posicao || "Chão"))
      if (entry.descricao === "-" && r.descricao) entry.descricao = String(r.descricao)
    })

    return Array.from(map.values())
      .map((e) => ({
        sku: e.sku,
        descricao: e.descricao,
        linhas: e.linhas,
        quantidade: e.quantidade,
        tombado: e.tombado,
        molhado: e.molhado,
        paletesFisicos: e.triplets.size,
        posicoesCount: e.posicoes.size,
      }))
      .sort((a, b) => b.quantidade - a.quantidade || a.sku.localeCompare(b.sku))
  }, [filteredDevolucoes])

  const devolucoesResumoPorPosicao = useMemo(() => {
    const map = new Map<
      string,
      {
        posicao: string
        linhas: number
        quantidade: number
        tombado: number
        molhado: number
        triplets: Set<string>
        skus: Set<string>
      }
    >()

    filteredDevolucoes.forEach((r) => {
      const pos = String(r.posicao || "Chão").trim() || "Chão"
      if (!map.has(pos)) {
        map.set(pos, {
          posicao: pos,
          linhas: 0,
          quantidade: 0,
          tombado: 0,
          molhado: 0,
          triplets: new Set(),
          skus: new Set(),
        })
      }
      const entry = map.get(pos)!
      entry.linhas += 1
      entry.quantidade += Number(r.quantidade_total) || 0
      entry.tombado += Number(r.qtd_tombada) || 0
      entry.molhado += Number(r.qtd_molhado) || 0
      const tk =
        getPalletCountTripletKey(r) ||
        `NOID::${pos}::P:${String(r.profundidade ?? "")}::N:${String(r.nivel ?? "")}::ROW:${String(r.id)}`
      entry.triplets.add(tk)
      if (r.produto) entry.skus.add(String(r.produto))
    })

    return Array.from(map.values())
      .map((e) => ({
        posicao: e.posicao,
        linhas: e.linhas,
        quantidade: e.quantidade,
        tombado: e.tombado,
        molhado: e.molhado,
        paletesFisicos: e.triplets.size,
        skusUnicos: e.skus.size,
      }))
      .sort((a, b) => b.quantidade - a.quantidade || a.posicao.localeCompare(b.posicao))
  }, [filteredDevolucoes])

  const handleBulkUpdateClassificacao = async (nextValue: ClassificacaoPalete) => {
    if (selectedClassificacaoIds.size === 0 || isUpdatingBulkClassificacao) return

    const normalized = normalizeClassificacao(nextValue)
    const dbVal = normalized || null
    const selectedRows = devolucoesBaseRows.filter(
      (r) => r && r.id !== undefined && r.id !== null && selectedClassificacaoIds.has(String(r.id))
    )
    if (selectedRows.length === 0) return

    const tempIdSet = new Set<string>()
    const persistedRows: typeof selectedRows = []
    const persistedIdSet = new Set<string>()

    selectedRows.forEach((r) => {
      const idStr = String(r.id)
      if (idStr.startsWith("temp_") || idStr.startsWith("novo_")) {
        tempIdSet.add(idStr)
      } else {
        persistedRows.push(r)
        persistedIdSet.add(idStr)
      }
    })

    setIsUpdatingBulkClassificacao(true)
    setBulkClassificacaoFeedback(null)
    try {
      if (tempIdSet.size > 0 || pendingChanges.length > 0) {
        setPendingChanges((prev) =>
          prev.map((ch) => {
            const chId = String(ch.id)
            const payloadId = String(ch.payload?.id ?? "")
            if (tempIdSet.has(chId) || tempIdSet.has(payloadId) || persistedIdSet.has(payloadId)) {
              return {
                ...ch,
                payload: { ...ch.payload, classificacao: dbVal },
                audit: ch.audit ? { ...ch.audit, classificacao: dbVal } : ch.audit,
              }
            }
            return ch
          })
        )
      }

      if (persistedRows.length > 0) {
        const connected = await syncManager.checkRealConnection()
        if (!connected) {
          const updated = data.map((item) =>
            persistedIdSet.has(String(item.id)) ? { ...item, classificacao: normalized } : item
          )
          setData(updated)
          for (const row of persistedRows) {
            await syncManager.addOperation({
              type: "UPDATE_FIELD",
              table: "mapeamento",
              recordId: row.id,
              changes: { classificacao: dbVal },
              audit: {
                acao: "CLASSIFICACAO",
                sku: row.produto || "",
                posicao: row.posicao || "",
                id_palete: row.id_palete || null,
                classificacao: dbVal,
              },
            })
          }
          const snapshotToSave = updated
            .filter((i) => !i.is_empty)
            .map((item, idx) => ({
              id: item.id !== undefined && item.id !== null ? item.id : idx + 1,
              Posição: item.posicao,
              Código: item.produto,
              Quantidade: item.quantidade_total,
              Nível: item.nivel,
              Profundidade: item.profundidade,
              "Parte Tombada": item.qtd_tombada || 0,
              "Parte Molhada": item.qtd_molhado || 0,
              "Id Palete": item.id_palete || null,
              Observação: item.observacao || null,
              "Última Alteração": item.ultima_alteracao || null,
              classificacao: extractRowClassificacao(item) || null,
            }))
          await saveSnapshot("mapeamento", snapshotToSave)
        } else {
          const numericIds = persistedRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n))
          if (numericIds.length > 0) {
            const { error } = await supabase
              .from("mapeamento")
              .update({ classificacao: dbVal })
              .in("id", numericIds)

            if (error) {
              if (isMissingClassificacaoColumnError(error)) {
                onMissingClassificacaoColumn()
                setBulkClassificacaoFeedback({
                  type: "error",
                  msg: "Coluna 'classificacao' ausente no Supabase. Execute o SQL de migração no topo do Mapeamento.",
                })
                return
              }
              throw error
            }
          }

          setData((prev) =>
            prev.map((item) =>
              persistedIdSet.has(String(item.id)) ? { ...item, classificacao: normalized } : item
            )
          )
        }
      }

      const countUpdated = selectedRows.length
      const label = normalized || "Não definido"
      setSelectedClassificacaoIds(new Set())
      setBulkClassificacaoFeedback({
        type: "success",
        msg: `${countUpdated} ${countUpdated === 1 ? "item atualizado" : "itens atualizados"} para "${label}".`,
      })
      setTimeout(() => setBulkClassificacaoFeedback(null), 4000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBulkClassificacaoFeedback({
        type: "error",
        msg: "Erro ao atualizar classificação em lote: " + msg,
      })
    } finally {
      setIsUpdatingBulkClassificacao(false)
    }
  }

  const handleExportDevolucoesExcel = () => {
    if (filteredDevolucoes.length === 0) {
      alert("Nenhum registro encontrado para a classificação e filtros aplicados.")
      return
    }
    const rows = filteredDevolucoes.map((r) => ({
      ID: r.id_palete || "-",
      Profundidade: r.profundidade !== undefined && r.profundidade !== null && r.profundidade !== "" ? r.profundidade : "-",
      Nível: r.nivel !== undefined && r.nivel !== null && r.nivel !== "" ? r.nivel : "-",
      Classificação: extractRowClassificacao(r) || "Não definido",
      Posição: r.posicao || "Chão",
      Código: r.produto || "-",
      Descrição: r.descricao || "-",
      Quantidade: Number(r.quantidade_total) || 0,
      "Parte Tombada": Number(r.qtd_tombada) || 0,
      "Parte Molhada": Number(r.qtd_molhado) || 0,
      Observação: r.observacao || "-",
      "Última Alteração": r.ultima_alteracao ? String(r.ultima_alteracao) : "-",
    }))
    const skuSummaryRows = devolucoesResumoPorSku.map((s) => ({
      Código: s.sku,
      Descrição: s.descricao,
      "Registros (Regra B)": s.linhas,
      "Paletes Físicos (Regra A)": s.paletesFisicos,
      Posições: s.posicoesCount,
      "Quantidade Total": s.quantidade,
      "Parte Tombada": s.tombado,
      "Parte Molhada": s.molhado,
    }))
    const posSummaryRows = devolucoesResumoPorPosicao.map((p) => ({
      Posição: p.posicao,
      "SKUs Distintos": p.skusUnicos,
      "Registros (Regra B)": p.linhas,
      "Paletes Físicos (Regra A)": p.paletesFisicos,
      "Quantidade Total": p.quantidade,
      "Parte Tombada": p.tombado,
      "Parte Molhada": p.molhado,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wsSku = XLSX.utils.json_to_sheet(skuSummaryRows)
    const wsPos = XLSX.utils.json_to_sheet(posSummaryRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Registros")
    XLSX.utils.book_append_sheet(wb, wsSku, "Resumo_por_SKU")
    XLSX.utils.book_append_sheet(wb, wsPos, "Resumo_por_Posicao")
    const stamp = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")
    const slug = devolucaoClassificacaoFilter.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_")
    XLSX.writeFile(wb, `relatorio_classificacao_${slug}_g300_${stamp}.xlsx`)
  }

  const handleExportDevolucoesCsv = () => {
    if (filteredDevolucoes.length === 0) {
      alert("Nenhum registro encontrado para a classificação e filtros aplicados.")
      return
    }
    const headers = [
      "ID", "Profundidade", "Nível", "Classificação", "Posição", "Código",
      "Descrição", "Quantidade", "Parte Tombada", "Parte Molhada", "Observação", "Última Alteração",
    ]
    const esc = (v: any) => `"${String(v ?? "-").replace(/"/g, '""')}"`
    const lines = filteredDevolucoes.map((r) =>
      [
        esc(r.id_palete || "-"),
        esc(r.profundidade !== undefined && r.profundidade !== null && r.profundidade !== "" ? r.profundidade : "-"),
        esc(r.nivel !== undefined && r.nivel !== null && r.nivel !== "" ? r.nivel : "-"),
        esc(extractRowClassificacao(r) || "Não definido"),
        esc(r.posicao || "Chão"),
        esc(r.produto || "-"),
        esc(r.descricao || "-"),
        Number(r.quantidade_total) || 0,
        Number(r.qtd_tombada) || 0,
        Number(r.qtd_molhado) || 0,
        esc(r.observacao || "-"),
        esc(r.ultima_alteracao || "-"),
      ].join(";")
    )
    const csv = "\uFEFF" + headers.join(";") + "\n" + lines.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const stamp = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")
    const slug = devolucaoClassificacaoFilter.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_")
    a.href = url
    a.download = `relatorio_classificacao_${slug}_g300_${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const triggerPrintDevolucoes = () => {
    if (filteredDevolucoes.length === 0) {
      alert("Nenhum registro de devolução encontrado com os filtros aplicados.")
      return
    }
    onPrintDevolucoes({
      rows: [...filteredDevolucoes],
      classificacaoFilter: devolucaoClassificacaoFilter,
      localFilter: devolucaoLocalFilter,
      nivelFilter: devolucaoNivelFilter,
      profFilter: devolucaoProfFilter,
      avariaFilter: devolucaoAvariaFilter,
      searchQuery: devolucaoSearch,
    })
  }

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-500/30 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Tag size={13} className="text-amber-500" />
                Classificação
              </span>
              <select
                value={devolucaoClassificacaoFilter}
                onChange={(e) => setDevolucaoClassificacaoFilter(e.target.value as any)}
                aria-label="Selecionar classificação"
                className="h-7 px-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 outline-none cursor-pointer"
              >
                <option value="todas" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Todas</option>
                <option value="Devolução" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Devolução</option>
                <option value="Normal" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Normal</option>
                <option value="Não definido" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Não definido</option>
              </select>
            </div>
            <p className="text-3xl font-light text-slate-900 dark:text-white tracking-tight">
              {devolucoesStats.totalLinhas.toLocaleString("pt-BR")}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Linhas individuais retornadas (Regra B)</p>
          </div>

          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total de Peças</span>
              <Package size={16} className="text-blue-500" />
            </div>
            <p className="text-3xl font-light text-slate-900 dark:text-white tracking-tight">{fmtNum(devolucoesStats.totalPecas)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Soma na classificação filtrada</p>
          </div>

          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Paletes Físicos (Regra A)</span>
              <Layers size={16} className="text-emerald-500" />
            </div>
            <p className="text-3xl font-light text-slate-900 dark:text-white tracking-tight">{devolucoesStats.paletesFisicosUnicos}</p>
            <p className="text-[10px] text-slate-400 mt-1">Únicos por ID + Prof. + Nível</p>
          </div>

          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">SKUs e Posições</span>
              <MapPin size={16} className="text-slate-400" />
            </div>
            <p className="text-3xl font-light text-slate-900 dark:text-white tracking-tight">
              {devolucoesStats.skusDistintos} <span className="text-sm text-slate-400">/ {devolucoesStats.posicoesDistintas}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Tomb: {fmtNum(devolucoesStats.totalTombado)} • Molh: {fmtNum(devolucoesStats.totalMolhado)}
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={devolucaoSearch}
                onChange={(e) => setDevolucaoSearch(e.target.value)}
                placeholder="Filtrar por ID do palete, código, posição, descrição, observação..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportDevolucoesExcel}
                disabled={filteredDevolucoes.length === 0}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                <Download size={13} /> Excel (.xlsx)
              </button>
              <button
                onClick={handleExportDevolucoesCsv}
                disabled={filteredDevolucoes.length === 0}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                <FileText size={13} /> CSV
              </button>
              <button
                onClick={triggerPrintDevolucoes}
                disabled={filteredDevolucoes.length === 0}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                <Printer size={13} /> Imprimir (PDF)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Classificação</label>
              <select
                value={devolucaoClassificacaoFilter}
                onChange={(e) => setDevolucaoClassificacaoFilter(e.target.value as any)}
                className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="todas">Todas</option>
                <option value="Devolução">Devolução</option>
                <option value="Normal">Normal</option>
                <option value="Não definido">Não definido</option>
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Local</label>
              <select
                value={devolucaoLocalFilter}
                onChange={(e) => setDevolucaoLocalFilter(e.target.value as any)}
                className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="todos">Todos os Locais</option>
                <option value="drive">Drive-In</option>
                <option value="chao">Chão / S/P</option>
                <option value="retrabalho">Retrabalho</option>
                <option value="quarentena">Quarentena</option>
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Profundidade</label>
              <select
                value={devolucaoProfFilter}
                onChange={(e) => setDevolucaoProfFilter(e.target.value)}
                className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="todos">Todas</option>
                {devolucaoFilterOptions.profs.map((p) => (
                  <option key={p} value={p}>Prof. {p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nível</label>
              <select
                value={devolucaoNivelFilter}
                onChange={(e) => setDevolucaoNivelFilter(e.target.value)}
                className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="todos">Todos</option>
                {devolucaoFilterOptions.niveis.map((n) => (
                  <option key={n} value={n}>Nível {n}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Avaria</label>
              <select
                value={devolucaoAvariaFilter}
                onChange={(e) => setDevolucaoAvariaFilter(e.target.value as any)}
                className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="todos">Todas</option>
                <option value="molhado">Com Molhado</option>
                <option value="tombado">Com Tombado</option>
                <option value="sem_avaria">Sem Avaria</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setDevolucaoClassificacaoFilter("todas")
                  setDevolucaoSearch("")
                  setDevolucaoLocalFilter("todos")
                  setDevolucaoNivelFilter("todos")
                  setDevolucaoProfFilter("todos")
                  setDevolucaoAvariaFilter("todos")
                }}
                className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        </div>

        {filteredDevolucoes.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40">
                <div className="flex items-center gap-2">
                  <Package size={15} className="text-amber-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    Dados Sumarizados por Produto (SKU)
                  </h4>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">{devolucoesResumoPorSku.length} SKU(s)</span>
              </div>
              <div className="max-h-72 overflow-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/80 dark:bg-slate-900/95 sticky top-0 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Código</th>
                      <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">Linhas</th>
                      <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">PTs (A)</th>
                      <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right">Peças</th>
                      <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right">Tomb / Molh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {devolucoesResumoPorSku.map((s) => (
                      <tr
                        key={s.sku}
                        onClick={() => setDevolucaoSearch((prev) => (prev === s.sku ? "" : s.sku))}
                        className="hover:bg-amber-500/5 cursor-pointer transition-colors"
                        title="Clique para filtrar/desfiltrar este SKU"
                      >
                        <td className="px-4 py-2.5">
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{s.sku}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[180px] uppercase">{s.descricao}</div>
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">{s.linhas}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-medium text-slate-600 dark:text-slate-300">{s.paletesFisicos}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-900 dark:text-white">{fmtNum(s.quantidade)}</td>
                        <td className="px-4 py-2.5 text-right text-[11px] whitespace-nowrap">
                          <span className="text-rose-500 font-medium">{s.tombado > 0 ? fmtNum(s.tombado) : "-"}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-blue-500 font-medium">{s.molhado > 0 ? fmtNum(s.molhado) : "-"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40">
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="text-emerald-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    Dados Sumarizados por Posição / Local
                  </h4>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">{devolucoesResumoPorPosicao.length} local(is)</span>
              </div>
              <div className="max-h-72 overflow-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/80 dark:bg-slate-900/95 sticky top-0 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Posição / Local</th>
                      <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">SKUs</th>
                      <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">Linhas</th>
                      <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">PTs (A)</th>
                      <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right">Peças</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {devolucoesResumoPorPosicao.map((p) => (
                      <tr
                        key={p.posicao}
                        onClick={() => setDevolucaoSearch((prev) => (prev === p.posicao ? "" : p.posicao))}
                        className="hover:bg-emerald-500/5 cursor-pointer transition-colors"
                        title="Clique para filtrar/desfiltrar esta posição"
                      >
                        <td className="px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white">{p.posicao}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-slate-600 dark:text-slate-300">{p.skusUnicos}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">{p.linhas}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-medium text-slate-600 dark:text-slate-300">{p.paletesFisicos}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-900 dark:text-white">{fmtNum(p.quantidade)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-3xl md:rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl dark:shadow-slate-950/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Registros Individuais — Classificação: {devolucaoClassificacaoFilter === "todas" ? "Todas" : devolucaoClassificacaoFilter}
              </h4>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {bulkClassificacaoFeedback && (
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-semibold border",
                    bulkClassificacaoFeedback.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                  )}
                >
                  {bulkClassificacaoFeedback.msg}
                </span>
              )}
              {selectedClassificacaoIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    {selectedClassificacaoIds.size} selecionado{selectedClassificacaoIds.size > 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => setSelectedClassificacaoIds(new Set())}
                    className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white underline cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                IDs repetidos mantidos separadamente • {filteredDevolucoes.length} linha(s)
              </span>
            </div>
          </div>

          {filteredDevolucoes.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-2">
              <Tag size={32} className="mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Nenhum registro encontrado para a classificação &quot;{devolucaoClassificacaoFilter === "todas" ? "Todas" : devolucaoClassificacaoFilter}&quot;
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Selecione outra classificação nos cards acima ou ajuste os filtros. Você também pode editar o campo Classificação de qualquer item diretamente na tabela.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1090px] text-left">
                <thead className="bg-slate-50/90 dark:bg-slate-900/95 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="pl-4 pr-2 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredClassificacoesSelected}
                        disabled={selectableDevolucaoIds.length === 0 || isUpdatingBulkClassificacao}
                        onChange={() => {
                          setSelectedClassificacaoIds((prev) => {
                            const next = new Set(prev)
                            if (allFilteredClassificacoesSelected) {
                              selectableDevolucaoIds.forEach((id) => next.delete(id))
                            } else {
                              selectableDevolucaoIds.forEach((id) => next.add(id))
                            }
                            return next
                          })
                        }}
                        aria-label="Selecionar todos os registros filtrados"
                        title={allFilteredClassificacoesSelected ? "Desmarcar todos filtrados" : "Selecionar todos filtrados"}
                        className="h-4 w-4 rounded accent-amber-500 cursor-pointer disabled:opacity-40"
                      />
                    </th>
                    <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">ID</th>
                    <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">Prof.</th>
                    <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">Nível</th>
                    <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Classificação</th>
                    <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Posição</th>
                    <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Código</th>
                    <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Descrição</th>
                    <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right">Qtd</th>
                    <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right">Tomb.</th>
                    <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right">Molh.</th>
                    <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Observação</th>
                    <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Últ. Alt.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {filteredDevolucoes.map((row: any, idx: number) => {
                    const hasValidId = row && row.id !== undefined && row.id !== null
                    const rowIdStr = hasValidId ? String(row.id) : `idx_${idx}`
                    const isRowSelected = hasValidId && selectedClassificacaoIds.has(rowIdStr)
                    const rowClassif = extractRowClassificacao(row)
                    const posStr = String(row.posicao || "Chão")
                    const posUpper = posStr.toUpperCase()
                    const canOpenMap =
                      posStr &&
                      !["CHÃO", "CHAO", "S/P", "RETRABALHO", "QUARENTENA", "-"].includes(posUpper) &&
                      !posUpper.includes("RETRABALHO") &&
                      !posUpper.includes("QUARENTENA")

                    return (
                      <tr
                        key={rowIdStr}
                        className={cn(
                          "transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40",
                          isRowSelected && "bg-amber-500/5 dark:bg-amber-500/10"
                        )}
                      >
                        <td className="pl-4 pr-2 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isRowSelected}
                            disabled={!hasValidId || isUpdatingBulkClassificacao}
                            onChange={() => {
                              if (!hasValidId) return
                              setSelectedClassificacaoIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(rowIdStr)) next.delete(rowIdStr)
                                else next.add(rowIdStr)
                                return next
                              })
                            }}
                            aria-label={`Selecionar ${row.produto || rowIdStr}`}
                            className="h-4 w-4 rounded accent-amber-500 cursor-pointer disabled:opacity-30"
                          />
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">
                            {row.id_palete || "S/ ID"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs font-mono text-slate-700 dark:text-slate-300">
                          {row.profundidade !== undefined && row.profundidade !== null && row.profundidade !== "" ? row.profundidade : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs font-mono text-slate-700 dark:text-slate-300">
                          {row.nivel !== undefined && row.nivel !== null && row.nivel !== "" ? row.nivel : "-"}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <select
                            value={rowClassif}
                            disabled={updatingClassificacaoId === rowIdStr}
                            onChange={(e) => onUpdateRowClassificacao(row, e.target.value as ClassificacaoPalete)}
                            className={cn(
                              "text-[10px] font-bold rounded-lg px-2 py-1 border outline-none cursor-pointer",
                              rowClassif === "Devolução"
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
                                : rowClassif === "Normal"
                                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                            )}
                          >
                            {CLASSIFICACAO_OPTIONS.map((opt) => (
                              <option key={opt.value || "empty"} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {canOpenMap ? (
                            <button
                              onClick={() => onVerNoMapa(posStr)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                              title="Abrir posição no mapa"
                            >
                              <MapPin size={11} />
                              {posStr}
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{posStr}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{row.produto || "-"}</td>
                        <td className="px-3 py-2.5 max-w-[220px]">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block uppercase">{row.descricao || "-"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">{fmtNum(Number(row.quantidade_total) || 0)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-rose-500 font-medium whitespace-nowrap">
                          {Number(row.qtd_tombada) > 0 ? fmtNum(Number(row.qtd_tombada)) : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-blue-500 font-medium whitespace-nowrap">
                          {Number(row.qtd_molhado) > 0 ? fmtNum(Number(row.qtd_molhado)) : "-"}
                        </td>
                        <td className="px-3 py-2.5 max-w-[160px]">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">{row.observacao || "-"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-[10px] text-slate-400 whitespace-nowrap">
                          {row.ultima_alteracao ? String(row.ultima_alteracao) : "-"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {selectedClassificacaoIds.size > 0 && (
              <motion.div
                initial={{ y: 100, x: "-50%", opacity: 0 }}
                animate={{ y: 0, x: "-50%", opacity: 1 }}
                exit={{ y: 100, x: "-50%", opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed bottom-10 left-1/2 z-50 flex flex-wrap items-center gap-4 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-3xl px-6 py-4 ring-1 ring-white/10 max-w-[95vw]"
              >
                <div className="flex flex-col">
                  <span className="text-white text-base font-semibold tracking-tight">
                    {selectedClassificacaoIds.size} selecionado{selectedClassificacaoIds.size > 1 ? "s" : ""}
                  </span>
                  <span className="text-amber-400 text-[9px] font-semibold uppercase tracking-widest leading-none mt-0.5">
                    Alterar Classificação
                  </span>
                </div>

                <div className="h-8 w-px bg-slate-700/50 hidden sm:block" />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleBulkUpdateClassificacao("Devolução")}
                    disabled={isUpdatingBulkClassificacao}
                    className="h-10 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isUpdatingBulkClassificacao ? <RefreshCw size={14} className="animate-spin" /> : <Tag size={14} />}
                    Devolução
                  </button>

                  <button
                    onClick={() => handleBulkUpdateClassificacao("Normal")}
                    disabled={isUpdatingBulkClassificacao}
                    className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isUpdatingBulkClassificacao ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    Normal
                  </button>

                  <button
                    onClick={() => handleBulkUpdateClassificacao("")}
                    disabled={isUpdatingBulkClassificacao}
                    className="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    Não definido
                  </button>

                  <button
                    onClick={() => setSelectedClassificacaoIds(new Set())}
                    disabled={isUpdatingBulkClassificacao}
                    title="Limpar seleção"
                    className="h-10 w-10 bg-slate-800/80 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-700/50 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}

export function ClassificacoesPrintReport({
  payload,
  fmtNum,
}: {
  payload: DevolucaoPrintPayload
  fmtNum: (val: number, locale?: string) => string
}) {
  const { rows, classificacaoFilter, localFilter, nivelFilter, profFilter, avariaFilter, searchQuery } = payload
  if (!rows || rows.length === 0) return null

  return (
    <div className="hidden print:block print:bg-white print:text-black print:p-4 print:w-full font-sans">
      <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-4">
        <div>
          <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-black/60">
            AG G300 — Consulta por Classificação (Regra B)
          </p>
          <h1 className="text-lg font-bold uppercase tracking-tight">
            Relatório Individual — Classificação: {classificacaoFilter === "todas" ? "Todas" : classificacaoFilter}
          </h1>
          <p className="text-[9px] text-black/80 mt-0.5">
            Filtros aplicados: Classificação={classificacaoFilter === "todas" ? "Todas" : classificacaoFilter} • Local={localFilter.toUpperCase()} • Nível={nivelFilter === "todos" ? "Todos" : nivelFilter} • Prof.={profFilter === "todos" ? "Todas" : profFilter} • Avaria={avariaFilter}
            {searchQuery.trim() ? ` • Busca="${searchQuery.trim()}"` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-semibold uppercase">{new Date().toLocaleString("pt-BR")}</p>
          <p className="text-[10px] font-bold uppercase">
            {rows.length} Registros • {fmtNum(rows.reduce((s, r) => s + (Number(r.quantidade_total) || 0), 0))} Peças
          </p>
        </div>
      </div>

      <table className="w-full border-collapse border border-black text-[9px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-black p-1.5 text-left font-bold uppercase">ID</th>
            <th className="border border-black p-1.5 text-center font-bold uppercase">Prof.</th>
            <th className="border border-black p-1.5 text-center font-bold uppercase">Nível</th>
            <th className="border border-black p-1.5 text-left font-bold uppercase">Classificação</th>
            <th className="border border-black p-1.5 text-left font-bold uppercase">Posição</th>
            <th className="border border-black p-1.5 text-left font-bold uppercase">Código</th>
            <th className="border border-black p-1.5 text-left font-bold uppercase">Descrição</th>
            <th className="border border-black p-1.5 text-right font-bold uppercase">Qtd</th>
            <th className="border border-black p-1.5 text-right font-bold uppercase">Tomb.</th>
            <th className="border border-black p-1.5 text-right font-bold uppercase">Molh.</th>
            <th className="border border-black p-1.5 text-left font-bold uppercase">Observação</th>
            <th className="border border-black p-1.5 text-left font-bold uppercase">Últ. Alteração</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, idx: number) => (
            <tr key={row.id ?? idx} className="border border-black break-inside-avoid">
              <td className="border border-black p-1.5 font-bold">{row.id_palete || "-"}</td>
              <td className="border border-black p-1.5 text-center">{row.profundidade !== undefined && row.profundidade !== null && row.profundidade !== "" ? row.profundidade : "-"}</td>
              <td className="border border-black p-1.5 text-center">{row.nivel !== undefined && row.nivel !== null && row.nivel !== "" ? row.nivel : "-"}</td>
              <td className="border border-black p-1.5 font-semibold">{extractRowClassificacao(row) || "Não definido"}</td>
              <td className="border border-black p-1.5">{row.posicao || "Chão"}</td>
              <td className="border border-black p-1.5 font-bold">{row.produto || "-"}</td>
              <td className="border border-black p-1.5 text-[8px]">{row.descricao || "-"}</td>
              <td className="border border-black p-1.5 text-right font-bold">{fmtNum(Number(row.quantidade_total) || 0)}</td>
              <td className="border border-black p-1.5 text-right">{fmtNum(Number(row.qtd_tombada) || 0)}</td>
              <td className="border border-black p-1.5 text-right">{fmtNum(Number(row.qtd_molhado) || 0)}</td>
              <td className="border border-black p-1.5 text-[8px]">{row.observacao || "-"}</td>
              <td className="border border-black p-1.5 text-[8px]">{row.ultima_alteracao ? String(row.ultima_alteracao) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 pt-3 border-t border-black/30 flex justify-between text-[8px] uppercase text-black/70">
        <span>Listagem linha a linha (sem agrupamento por ID/Profundidade/Nível)</span>
        <span>Documento Interno — G300 Avarias</span>
      </div>
    </div>
  )
}

export default ClassificacoesTab
