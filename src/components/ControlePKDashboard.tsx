"use client"

import React, { useMemo, useState } from "react"
import {
  FileText,
  Package,
  Boxes,
  Layers,
  Clock,
  Building2,
  CheckCircle2,
  LayoutGrid,
  Filter,
  X,
} from "lucide-react"
import { ControlePKRow, calculateDuration } from "./pkSpreadsheetParser"

interface ControlePKDashboardProps {
  rows: ControlePKRow[]
  loading: boolean
  periodLabel: string
}

function formatDurationReadable(avgSeconds: number | null): string {
  if (avgSeconds === null || !Number.isFinite(avgSeconds)) return "—"
  const rounded = Math.max(0, Math.round(avgSeconds))
  if (rounded < 60) return `${rounded}s`
  if (rounded < 3600) return `${Math.round(rounded / 60)} min`
  const hours = Math.floor(rounded / 3600)
  const mins = Math.round((rounded % 3600) / 60)
  if (mins === 60) return `${hours + 1}h`
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

function formatDurationClock(avgSeconds: number | null): string {
  if (avgSeconds === null || !Number.isFinite(avgSeconds)) return "—"
  const s = Math.max(0, Math.round(avgSeconds))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
}

function calcAverageSeconds(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((acc, v) => acc + v, 0) / values.length
}

function splitPeople(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export function ControlePKDashboard({
  rows,
  loading,
  periodLabel,
}: ControlePKDashboardProps) {
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("todas")
  const [selectedPessoa, setSelectedPessoa] = useState<string>("todas")
  const [selectedConferente, setSelectedConferente] = useState<string>("todos")
  const [selectedTipo, setSelectedTipo] = useState<string>("todos")

  // Dynamic filter options extracted from real Supabase rows
  const filterOptions = useMemo(() => {
    const empresas = new Map<string, string>()
    const pessoas = new Map<string, string>()
    const conferentes = new Map<string, string>()

    for (const r of rows) {
      const emp = r.empresa?.trim()
      if (emp) {
        const key = emp.toUpperCase()
        if (!empresas.has(key)) empresas.set(key, emp)
      }
      for (const p of splitPeople(r.pessoa)) {
        const key = p.toUpperCase()
        if (!pessoas.has(key)) pessoas.set(key, p)
      }
      for (const c of splitPeople(r.conferente)) {
        const key = c.toUpperCase()
        if (!conferentes.has(key)) conferentes.set(key, c)
      }
    }

    return {
      empresas: Array.from(empresas.values()).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
      pessoas: Array.from(pessoas.values()).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
      conferentes: Array.from(conferentes.values()).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    }
  }, [rows])

  const hasSecondaryFilter =
    selectedEmpresa !== "todas" ||
    selectedPessoa !== "todas" ||
    selectedConferente !== "todos" ||
    selectedTipo !== "todos"

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (selectedEmpresa !== "todas") {
        const emp = r.empresa?.trim().toUpperCase() || ""
        if (emp !== selectedEmpresa.toUpperCase()) return false
      }
      if (selectedPessoa !== "todas") {
        const rowPessoas = splitPeople(r.pessoa).map((p) => p.toUpperCase())
        if (!rowPessoas.includes(selectedPessoa.toUpperCase())) return false
      }
      if (selectedConferente !== "todos") {
        const rowConf = splitPeople(r.conferente).map((c) => c.toUpperCase())
        if (!rowConf.includes(selectedConferente.toUpperCase())) return false
      }
      if (selectedTipo !== "todos") {
        if ((r.tipo_de_embarque || "") !== selectedTipo) return false
      }
      return true
    })
  }, [
    rows,
    selectedEmpresa,
    selectedPessoa,
    selectedConferente,
    selectedTipo,
  ])

  const metrics = useMemo(() => {
    let totalNotas = 0
    let totalPecas = 0
    let totalSkus = 0

    const sepAll: number[] = []
    const confAll: number[] = []
    const embAll: number[] = []

    const byTipo: Record<
      "Simples" | "Normal" | "Complexa",
      { sep: number[]; conf: number[]; emb: number[]; count: number }
    > = {
      Simples: { sep: [], conf: [], emb: [], count: 0 },
      Normal: { sep: [], conf: [], emb: [], count: 0 },
      Complexa: { sep: [], conf: [], emb: [], count: 0 },
    }

    const companyMap = new Map<
      string,
      {
        empresa: string
        isUnknown: boolean
        avisos: number
        notas: number
        pecas: number
        skus: number
        simples: number
        normal: number
        complexa: number
      }
    >()

    for (const r of filteredRows) {
      const notasVal = Number(r.qtde_notas) || 0
      const pecasVal = Number(r.pecas) || 0
      const skusVal = Number(r.skus) || 0

      totalNotas += notasVal
      totalPecas += pecasVal
      totalSkus += skusVal

      const dSep = calculateDuration(r.inicio, r.final)
      const dConf = calculateDuration(
        r.conferencia_inicial,
        r.conferencia_final
      )
      const dEmb = calculateDuration(
        r.horario_inicio_embalagem,
        r.horario_final_embalagem
      )

      if (dSep) sepAll.push(dSep.totalSeconds)
      if (dConf) confAll.push(dConf.totalSeconds)
      if (dEmb) embAll.push(dEmb.totalSeconds)

      if (
        r.tipo_de_embarque === "Simples" ||
        r.tipo_de_embarque === "Normal" ||
        r.tipo_de_embarque === "Complexa"
      ) {
        const bucket = byTipo[r.tipo_de_embarque]
        bucket.count += 1
        if (dSep) bucket.sep.push(dSep.totalSeconds)
        if (dConf) bucket.conf.push(dConf.totalSeconds)
        if (dEmb) bucket.emb.push(dEmb.totalSeconds)
      }

      const rawEmp = r.empresa?.trim() || ""
      const isUnknown = !rawEmp
      const key = isUnknown ? "__SEM_EMPRESA__" : rawEmp.toUpperCase()
      const current = companyMap.get(key) || {
        empresa: isUnknown ? "Não informado" : rawEmp,
        isUnknown,
        avisos: 0,
        notas: 0,
        pecas: 0,
        skus: 0,
        simples: 0,
        normal: 0,
        complexa: 0,
      }
      current.avisos += 1
      current.notas += notasVal
      current.pecas += pecasVal
      current.skus += skusVal
      if (r.tipo_de_embarque === "Simples") current.simples += 1
      else if (r.tipo_de_embarque === "Normal") current.normal += 1
      else if (r.tipo_de_embarque === "Complexa") current.complexa += 1

      companyMap.set(key, current)
    }

    const avgSepSec = calcAverageSeconds(sepAll)
    const avgConfSec = calcAverageSeconds(confAll)
    const avgEmbSec = calcAverageSeconds(embAll)

    const hasAnyStage =
      avgSepSec !== null || avgConfSec !== null || avgEmbSec !== null
    const totalAvgSec = hasAnyStage
      ? (avgSepSec ?? 0) + (avgConfSec ?? 0) + (avgEmbSec ?? 0)
      : null

    const companiesSortedByAvisos = Array.from(companyMap.values()).sort(
      (a, b) => {
        if (a.isUnknown !== b.isUnknown) return a.isUnknown ? 1 : -1
        if (b.avisos !== a.avisos) return b.avisos - a.avisos
        return b.pecas - a.pecas
      }
    )

    const maxCompanyAvisos =
      companiesSortedByAvisos.length > 0
        ? Math.max(1, ...companiesSortedByAvisos.map((c) => c.avisos))
        : 1

    return {
      totalAvisos: filteredRows.length,
      totalNotas,
      totalPecas,
      totalSkus,
      avgSepSec,
      avgConfSec,
      avgEmbSec,
      totalAvgSec,
      sepCount: sepAll.length,
      confCount: confAll.length,
      embCount: embAll.length,
      companies: companiesSortedByAvisos,
      maxCompanyAvisos,
      tipoTimes: [
        {
          tipo: "Simples" as const,
          dotClass: "bg-emerald-400",
          count: byTipo.Simples.count,
          sep: calcAverageSeconds(byTipo.Simples.sep),
          conf: calcAverageSeconds(byTipo.Simples.conf),
          emb: calcAverageSeconds(byTipo.Simples.emb),
        },
        {
          tipo: "Normal" as const,
          dotClass: "bg-blue-400",
          count: byTipo.Normal.count,
          sep: calcAverageSeconds(byTipo.Normal.sep),
          conf: calcAverageSeconds(byTipo.Normal.conf),
          emb: calcAverageSeconds(byTipo.Normal.emb),
        },
        {
          tipo: "Complexa" as const,
          dotClass: "bg-amber-400",
          count: byTipo.Complexa.count,
          sep: calcAverageSeconds(byTipo.Complexa.sep),
          conf: calcAverageSeconds(byTipo.Complexa.conf),
          emb: calcAverageSeconds(byTipo.Complexa.emb),
        },
      ],
    }
  }, [filteredRows])

  return (
    <div className="space-y-4">
      {/* Cabeçalho da visão geral + filtros complementares */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Visão geral da operação
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Acompanhe os principais indicadores dos avisos e embarques ·{" "}
            <span className="font-mono text-slate-300">{periodLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mr-1">
            <Filter size={12} />
            <span>Filtros:</span>
          </div>

          <select
            value={selectedEmpresa}
            onChange={(e) => setSelectedEmpresa(e.target.value)}
            aria-label="Filtrar por empresa"
            className="bg-slate-900/90 text-slate-100 border border-white/[0.09] hover:border-white/20 focus:border-blue-500/60 rounded-lg px-3 py-2 text-xs outline-none cursor-pointer"
          >
            <option value="todas">Empresa (Todas)</option>
            {filterOptions.empresas.map((emp) => (
              <option key={emp} value={emp}>
                {emp}
              </option>
            ))}
          </select>

          <select
            value={selectedPessoa}
            onChange={(e) => setSelectedPessoa(e.target.value)}
            aria-label="Filtrar por pessoa responsável"
            className="bg-slate-900/90 text-slate-100 border border-white/[0.09] hover:border-white/20 focus:border-blue-500/60 rounded-lg px-3 py-2 text-xs outline-none cursor-pointer"
          >
            <option value="todas">Pessoa (Todas)</option>
            {filterOptions.pessoas.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={selectedConferente}
            onChange={(e) => setSelectedConferente(e.target.value)}
            aria-label="Filtrar por conferente"
            className="bg-slate-900/90 text-slate-100 border border-white/[0.09] hover:border-white/20 focus:border-blue-500/60 rounded-lg px-3 py-2 text-xs outline-none cursor-pointer"
          >
            <option value="todos">Conferente (Todos)</option>
            {filterOptions.conferentes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedTipo}
            onChange={(e) => setSelectedTipo(e.target.value)}
            aria-label="Filtrar por tipo de embarque"
            className="bg-slate-900/90 text-slate-100 border border-white/[0.09] hover:border-white/20 focus:border-blue-500/60 rounded-lg px-3 py-2 text-xs outline-none cursor-pointer"
          >
            <option value="todos">Tipo de embarque</option>
            <option value="Simples">Simples</option>
            <option value="Normal">Normal</option>
            <option value="Complexa">Complexa</option>
          </select>

          {hasSecondaryFilter && (
            <button
              type="button"
              onClick={() => {
                setSelectedEmpresa("todas")
                setSelectedPessoa("todas")
                setSelectedConferente("todos")
                setSelectedTipo("todos")
              }}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-semibold transition-colors cursor-pointer"
              title="Limpar filtros do dashboard"
            >
              <X size={12} />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. Indicadores gerais: avisos, notas, peças, SKUs e tempo médio */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        <div className="bg-[#1b2638]/85 border border-[#2c3a50] border-b-[3px] border-b-[#438cf5] rounded-xl p-4">
          <FileText size={16} className="text-sky-400" />
          <strong className="block text-2xl font-bold text-white font-mono mt-3 mb-1">
            {loading ? "..." : metrics.totalAvisos.toLocaleString("pt-BR")}
          </strong>
          <span className="text-xs text-[#aab6ca]">Avisos</span>
        </div>

        <div className="bg-[#1b2638]/85 border border-[#2c3a50] border-b-[3px] border-b-[#438cf5] rounded-xl p-4">
          <Package size={16} className="text-amber-400" />
          <strong className="block text-2xl font-bold text-white font-mono mt-3 mb-1">
            {loading ? "..." : metrics.totalNotas.toLocaleString("pt-BR")}
          </strong>
          <span className="text-xs text-[#aab6ca]">Notas</span>
        </div>

        <div className="bg-[#1b2638]/85 border border-[#2c3a50] border-b-[3px] border-b-[#438cf5] rounded-xl p-4">
          <Boxes size={16} className="text-orange-400" />
          <strong className="block text-2xl font-bold text-white font-mono mt-3 mb-1">
            {loading ? "..." : metrics.totalPecas.toLocaleString("pt-BR")}
          </strong>
          <span className="text-xs text-[#aab6ca]">Peças</span>
        </div>

        <div className="bg-[#1b2638]/85 border border-[#2c3a50] border-b-[3px] border-b-[#438cf5] rounded-xl p-4">
          <Layers size={16} className="text-emerald-400" />
          <strong className="block text-2xl font-bold text-white font-mono mt-3 mb-1">
            {loading ? "..." : metrics.totalSkus.toLocaleString("pt-BR")}
          </strong>
          <span className="text-xs text-[#aab6ca]">SKUs</span>
        </div>

        <div
          className="bg-[#1b2638]/85 border border-[#2c3a50] border-b-[3px] border-b-[#438cf5] rounded-xl p-4"
          title={`Soma dos tempos médios de Separação, Conferência e Embalagem (${formatDurationClock(metrics.totalAvgSec)})`}
        >
          <Clock size={16} className="text-indigo-400" />
          <strong className="block text-2xl font-bold text-white font-mono mt-3 mb-1">
            {loading ? "..." : formatDurationReadable(metrics.totalAvgSec)}
          </strong>
          <span className="text-xs text-[#aab6ca]">Tempo médio total</span>
        </div>
      </section>

      {/* 2. Ranking empresas com mais avisos + 3. Volume por empresa */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1b2638]/85 border border-[#2c3a50] rounded-xl p-4 sm:p-5 min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-white mb-4">
            <Building2 size={16} className="text-sky-400 shrink-0" />
            <span>Empresas com mais avisos</span>
          </h2>

          {metrics.companies.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              Nenhum dado encontrado para os filtros aplicados.
            </p>
          ) : (
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {metrics.companies.map((c) => {
                const widthPct = Math.max(
                  4,
                  Math.round((c.avisos / metrics.maxCompanyAvisos) * 100)
                )
                return (
                  <div
                    key={c.empresa}
                    className="grid grid-cols-[110px_1fr_42px] sm:grid-cols-[135px_1fr_48px] items-center gap-3 text-xs"
                  >
                    <span
                      className="text-slate-200 font-medium truncate"
                      title={c.empresa}
                    >
                      {c.empresa}
                    </span>
                    <div className="h-3 bg-[#303b4f] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${widthPct}%` }}
                        className="h-full bg-[#438cf5] rounded-full transition-all duration-500"
                      />
                    </div>
                    <span className="text-right font-mono font-semibold text-white">
                      {c.avisos.toLocaleString("pt-BR")}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-[#1b2638]/85 border border-[#2c3a50] rounded-xl p-4 sm:p-5 min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-white mb-4">
            <LayoutGrid size={16} className="text-emerald-400 shrink-0" />
            <span>Volume por empresa</span>
          </h2>

          {metrics.companies.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              Nenhum dado encontrado para os filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[#222f43] text-slate-200">
                    <th className="px-2.5 py-2.5 text-left font-semibold rounded-tl-md">
                      Empresa
                    </th>
                    <th className="px-2.5 py-2.5 text-left font-semibold">
                      Notas
                    </th>
                    <th className="px-2.5 py-2.5 text-left font-semibold">
                      Peças
                    </th>
                    <th className="px-2.5 py-2.5 text-left font-semibold rounded-tr-md">
                      SKUs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.companies.map((c) => (
                    <tr
                      key={c.empresa}
                      className="border-b border-[#303c50] last:border-0 hover:bg-white/[0.02]"
                    >
                      <td
                        className="px-2.5 py-2.5 font-medium text-white max-w-[180px] truncate"
                        title={c.empresa}
                      >
                        {c.empresa}
                      </td>
                      <td className="px-2.5 py-2.5 font-mono text-slate-200">
                        {c.notas.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-2.5 py-2.5 font-mono text-slate-200">
                        {c.pecas.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-2.5 py-2.5 font-mono text-slate-200">
                        {c.skus.toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* 4. Quantidade e percentual de embarques simples, normais e complexos por empresa */}
      <div className="bg-[#1b2638]/85 border border-[#2c3a50] rounded-xl p-4 sm:p-5 min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-white mb-4">
          <Package size={16} className="text-amber-400 shrink-0" />
          <span>Tipos de embarque por empresa</span>
        </h2>

        {metrics.companies.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">
            Nenhum dado encontrado para os filtros aplicados.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#222f43] text-slate-200">
                  <th className="px-3 py-2.5 text-left font-semibold rounded-tl-md">
                    Empresa
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Simples
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Normal
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold rounded-tr-md">
                    Complexa
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.companies.map((c) => {
                  const totalClassified = c.simples + c.normal + c.complexa
                  const pctSimples =
                    totalClassified > 0
                      ? Math.round((c.simples / totalClassified) * 100)
                      : 0
                  const pctNormal =
                    totalClassified > 0
                      ? Math.round((c.normal / totalClassified) * 100)
                      : 0
                  const pctComplexa =
                    totalClassified > 0
                      ? Math.round((c.complexa / totalClassified) * 100)
                      : 0

                  return (
                    <tr
                      key={c.empresa}
                      className="border-b border-[#303c50] last:border-0 hover:bg-white/[0.02]"
                    >
                      <td
                        className="px-3 py-3 font-medium text-white max-w-[200px] truncate"
                        title={c.empresa}
                      >
                        {c.empresa}
                      </td>
                      <td className="px-3 py-3 min-w-[140px]">
                        <div className="flex items-center justify-between gap-2 font-mono">
                          <span className="text-white font-semibold">
                            {pctSimples}%
                          </span>
                          <span className="text-[11px] text-[#aab6ca]">
                            {c.simples}{" "}
                            {c.simples === 1 ? "aviso" : "avisos"}
                          </span>
                        </div>
                        <div className="h-[7px] bg-[#303b4f] rounded-full mt-1.5 overflow-hidden">
                          <div
                            style={{ width: `${pctSimples}%` }}
                            className="h-full bg-[#32c48d] rounded-full transition-all duration-500"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3 min-w-[140px]">
                        <div className="flex items-center justify-between gap-2 font-mono">
                          <span className="text-white font-semibold">
                            {pctNormal}%
                          </span>
                          <span className="text-[11px] text-[#aab6ca]">
                            {c.normal} {c.normal === 1 ? "aviso" : "avisos"}
                          </span>
                        </div>
                        <div className="h-[7px] bg-[#303b4f] rounded-full mt-1.5 overflow-hidden">
                          <div
                            style={{ width: `${pctNormal}%` }}
                            className="h-full bg-[#438cf5] rounded-full transition-all duration-500"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3 min-w-[140px]">
                        <div className="flex items-center justify-between gap-2 font-mono">
                          <span className="text-white font-semibold">
                            {pctComplexa}%
                          </span>
                          <span className="text-[11px] text-[#aab6ca]">
                            {c.complexa}{" "}
                            {c.complexa === 1 ? "aviso" : "avisos"}
                          </span>
                        </div>
                        <div className="h-[7px] bg-[#303b4f] rounded-full mt-1.5 overflow-hidden">
                          <div
                            style={{ width: `${pctComplexa}%` }}
                            className="h-full bg-[#f3ad43] rounded-full transition-all duration-500"
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Tempo médio por etapa + 6. Comparação do tempo médio por tipo de embarque */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1b2638]/85 border border-[#2c3a50] rounded-xl p-4 sm:p-5 min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-white mb-4">
            <Clock size={16} className="text-sky-400 shrink-0" />
            <span>Tempo médio por etapa</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div
              className="text-center px-2 py-5 bg-[#222f45] rounded-xl border border-white/[0.04]"
              title={`Média exata: ${formatDurationClock(metrics.avgSepSec)} (${metrics.sepCount} registros)`}
            >
              <Package size={18} className="mx-auto text-sky-400" />
              <strong className="block text-xl sm:text-2xl font-bold text-white font-mono my-2.5">
                {formatDurationReadable(metrics.avgSepSec)}
              </strong>
              <span className="block text-xs text-[#aab6ca]">Separação</span>
              <span className="block text-[10px] font-mono text-slate-500 mt-1">
                {metrics.sepCount} medidos
              </span>
            </div>

            <div
              className="text-center px-2 py-5 bg-[#222f45] rounded-xl border border-white/[0.04]"
              title={`Média exata: ${formatDurationClock(metrics.avgConfSec)} (${metrics.confCount} registros)`}
            >
              <CheckCircle2 size={18} className="mx-auto text-emerald-400" />
              <strong className="block text-xl sm:text-2xl font-bold text-white font-mono my-2.5">
                {formatDurationReadable(metrics.avgConfSec)}
              </strong>
              <span className="block text-xs text-[#aab6ca]">Conferência</span>
              <span className="block text-[10px] font-mono text-slate-500 mt-1">
                {metrics.confCount} medidos
              </span>
            </div>

            <div
              className="text-center px-2 py-5 bg-[#222f45] rounded-xl border border-white/[0.04]"
              title={`Média exata: ${formatDurationClock(metrics.avgEmbSec)} (${metrics.embCount} registros)`}
            >
              <Boxes size={18} className="mx-auto text-amber-400" />
              <strong className="block text-xl sm:text-2xl font-bold text-white font-mono my-2.5">
                {formatDurationReadable(metrics.avgEmbSec)}
              </strong>
              <span className="block text-xs text-[#aab6ca]">Embalagem</span>
              <span className="block text-[10px] font-mono text-slate-500 mt-1">
                {metrics.embCount} medidos
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#1b2638]/85 border border-[#2c3a50] rounded-xl p-4 sm:p-5 min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-white mb-4">
            <LayoutGrid size={16} className="text-indigo-400 shrink-0" />
            <span>Tempo por tipo de embarque</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#222f43] text-slate-200">
                  <th className="px-3 py-2.5 text-left font-semibold rounded-tl-md">
                    Tipo
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Separação
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Conferência
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold rounded-tr-md">
                    Embalagem
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.tipoTimes.map((row) => (
                  <tr
                    key={row.tipo}
                    className="border-b border-[#303c50] last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-3 font-medium text-white whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${row.dotClass}`}
                        />
                        <span>{row.tipo}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          ({row.count})
                        </span>
                      </span>
                    </td>
                    <td
                      className="px-3 py-3 font-mono text-slate-200"
                      title={formatDurationClock(row.sep)}
                    >
                      {formatDurationReadable(row.sep)}
                    </td>
                    <td
                      className="px-3 py-3 font-mono text-slate-200"
                      title={formatDurationClock(row.conf)}
                    >
                      {formatDurationReadable(row.conf)}
                    </td>
                    <td
                      className="px-3 py-3 font-mono text-slate-200"
                      title={formatDurationClock(row.emb)}
                    >
                      {formatDurationReadable(row.emb)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
