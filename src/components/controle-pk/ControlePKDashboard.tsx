"use client"

import React, { useMemo, useState } from "react"
import {
  Package,
  Clock,
  Award,
  ListOrdered,
  FileText,
  Box,
  Boxes,
  Layers,
  HelpCircle,
} from "lucide-react"
import {
  ControlePKRow,
  calculateDuration,
  formatDurationHuman,
  formatDurationDetailed,
} from "./pkSpreadsheetParser"

interface ControlePKDashboardProps {
  rows: ControlePKRow[]
  loading: boolean
  periodLabel: string
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, v) => a + v, 0) / values.length
}

const fmt = (n: number) => n.toLocaleString("pt-BR")

function splitPeople(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((i) => i.trim())
    .filter(Boolean)
}

function renderPeopleCell(raw: string | null | undefined) {
  const people = splitPeople(raw)
  if (people.length === 0) return "Não informado"
  if (people.length === 1) return people[0]
  return `${people.length} pessoas`
}

const companyColors: Record<string, string> = {
  "Logística Express": "#10b981",
  "NorteSul Transportes": "#f59e0b",
  "TransBrasil Cargo": "#38bdf8",
  "Não informado": "#64748b",
}

const METRIC_LABELS: Record<"avisos" | "notas" | "pecas" | "skus" | "solicitante", string> = {
  avisos: "Avisos",
  notas: "Notas",
  pecas: "Peças",
  skus: "SKUs",
  solicitante: "Solicitante",
}

interface RankItem {
  name: string
  avisos: number
  pecas: number
  avgSec: number
  efficiency: number
}

function buildRanking(
  rows: ControlePKRow[],
  getName: (r: ControlePKRow) => string | null | undefined,
  getStart: (r: ControlePKRow) => unknown,
  getEnd: (r: ControlePKRow) => unknown,
): RankItem[] {
  const map = new Map<string, { avisos: number; pecas: number; secs: number[] }>()

  for (const r of rows) {
    const rawName = getName(r)?.trim()
    if (!rawName || rawName.toLowerCase() === "não informado" || rawName === "—") continue
    const people = splitPeople(rawName)
    const dur = calculateDuration(getStart(r) as string, getEnd(r) as string)
    if (!dur || !dur.totalSeconds) continue

    for (const name of people) {
      if (!map.has(name)) map.set(name, { avisos: 0, pecas: 0, secs: [] })
      const o = map.get(name)!
      o.avisos += 1
      o.pecas += Number(r.pecas) || 0
      o.secs.push(dur.totalSeconds)
    }
  }

  const list = Array.from(map.entries()).map(([name, o]) => {
    const totalSec = o.secs.reduce((a, b) => a + b, 0)
    return {
      name,
      avisos: o.avisos,
      pecas: o.pecas,
      avgSec: totalSec / o.secs.length,
      perHour: totalSec > 0 ? o.pecas / (totalSec / 3600) : 0,
    }
  })

  const best = Math.max(...list.map((l) => l.perHour), 0)
  return list
    .sort((a, b) => b.perHour - a.perHour)
    .slice(0, 3)
    .map((l) => ({
      name: l.name,
      avisos: l.avisos,
      pecas: l.pecas,
      avgSec: l.avgSec,
      efficiency: best > 0 ? Math.round((l.perHour / best) * 100) : 0,
    }))
}

const rankStyles = [
  { num: "text-emerald-400", avatar: "bg-emerald-500/20 text-emerald-300", time: "text-emerald-300" },
  { num: "text-sky-400", avatar: "bg-sky-500/20 text-sky-300", time: "text-sky-300" },
  { num: "text-violet-300", avatar: "bg-violet-500/15 text-violet-300", time: "text-slate-300" },
]

function RankRow({
  item,
  index,
  subtitle,
}: {
  item: RankItem
  index: number
  subtitle: string
}) {
  const st = rankStyles[index] || rankStyles[2]
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`text-xs font-medium tabular-nums w-5 shrink-0 ${st.num}`}>#{index + 1}</span>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 ${st.avatar}`}>
          {item.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-normal text-slate-100 truncate">{item.name}</div>
          <div className="text-[11px] font-light text-slate-400">{subtitle}</div>
        </div>
      </div>
      <div className="text-right shrink-0 pl-3">
        <div className={`text-xs font-medium tabular-nums ${st.time}`}>{formatDurationDetailed(item.avgSec)}</div>
        <div className="text-[11px] font-light text-slate-500 tabular-nums">Eficiência {item.efficiency}%</div>
      </div>
    </div>
  )
}

function RankSection({
  title,
  accentClass,
  items,
  subtitleFor,
}: {
  title: string
  accentClass: string
  items: RankItem[]
  subtitleFor: (i: RankItem) => string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between pb-2.5 border-b border-white/[0.06]">
        <h4 className={`text-sm font-normal ${accentClass}`}>{title}</h4>
        <span className="text-[11px] font-light text-slate-500">Média por aviso</span>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs font-light text-slate-500">Sem registros suficientes neste período.</p>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {items.map((it, idx) => (
            <RankRow key={it.name} item={it} index={idx} subtitle={subtitleFor(it)} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ControlePKDashboard({ rows, periodLabel }: ControlePKDashboardProps) {
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("ALL")
  const [selectedEmbarque, setSelectedEmbarque] = useState<string>("ALL")
  const [currentMetric, setCurrentMetric] = useState<"avisos" | "notas" | "pecas" | "skus" | "solicitante">("pecas")
  const [activeTab, setActiveTab] = useState<"avisos" | "ranking">("avisos")

  const hasFilter = selectedEmpresa !== "ALL" || selectedEmbarque !== "ALL"

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (selectedEmpresa !== "ALL") {
        const emp = (r.empresa?.trim() || "Não informado").toUpperCase()
        const sol = (r.solicitante?.trim() || "Não informado").toUpperCase()
        if (emp !== selectedEmpresa.toUpperCase() && sol !== selectedEmpresa.toUpperCase()) return false
      }
      if (selectedEmbarque !== "ALL") {
        const tipo = (r.tipo_de_embarque?.trim() || "Não informado").toUpperCase()
        if (tipo !== selectedEmbarque.toUpperCase()) return false
      }
      return true
    })
  }, [rows, selectedEmpresa, selectedEmbarque])

  const metrics = useMemo(() => {
    const avisos = filteredRows.length
    let notas = 0
    let pecas = 0
    let skus = 0
    const sepAll: number[] = []
    const confAll: number[] = []
    const embAll: number[] = []

    const entityMap = new Map<string, { avisos: number; notas: number; pecas: number; skus: number; valor: number }>()
    const compCount: Record<string, number> = { Simples: 0, Normal: 0, Complexa: 0, "Não informado": 0 }

    for (const r of filteredRows) {
      const nNotas = Number(r.qtde_notas) || 0
      const nPecas = Number(r.pecas) || 0
      const nSkus = Number(r.skus) || 0
      notas += nNotas
      pecas += nPecas
      skus += nSkus

      const keyName =
        currentMetric === "solicitante"
          ? r.solicitante?.trim() || "Não informado"
          : r.empresa?.trim() || "Não informado"

      if (!entityMap.has(keyName)) {
        entityMap.set(keyName, { avisos: 0, notas: 0, pecas: 0, skus: 0, valor: 0 })
      }
      const eObj = entityMap.get(keyName)!
      eObj.avisos += 1
      eObj.notas += nNotas
      eObj.pecas += nPecas
      eObj.skus += nSkus
      eObj.valor += 1

      const dSep = calculateDuration(r.inicio, r.final)
      const dConf = calculateDuration(r.conferencia_inicial, r.conferencia_final)
      const dEmb = calculateDuration(r.horario_inicio_embalagem, r.horario_final_embalagem)

      if (dSep) sepAll.push(dSep.totalSeconds)
      if (dConf) confAll.push(dConf.totalSeconds)
      if (dEmb) embAll.push(dEmb.totalSeconds)

      const tipo = r.tipo_de_embarque?.trim()
      if (tipo && compCount[tipo] !== undefined) {
        compCount[tipo] += 1
      } else {
        compCount["Não informado"] += 1
      }
    }

    const avgSep = avg(sepAll)
    const avgConf = avg(confAll)
    const avgEmb = avg(embAll)
    const totalTime = (avgSep ?? 0) + (avgConf ?? 0) + (avgEmb ?? 0)

    const totalComp = Object.values(compCount).reduce((a, b) => a + b, 0)
    const safeTotal = totalComp > 0 ? totalComp : 1

    return {
      avisos,
      notas,
      pecas,
      skus,
      avgSep,
      avgConf,
      avgEmb,
      totalTime,
      entityMap,
      complexitySummary: {
        total: totalComp,
        Simples: { count: compCount["Simples"], pct: Math.round((compCount["Simples"] / safeTotal) * 100) },
        Normal: { count: compCount["Normal"], pct: Math.round((compCount["Normal"] / safeTotal) * 100) },
        Complexa: { count: compCount["Complexa"], pct: Math.round((compCount["Complexa"] / safeTotal) * 100) },
        "Não informado": { count: compCount["Não informado"], pct: Math.round((compCount["Não informado"] / safeTotal) * 100) },
      },
    }
  }, [filteredRows, currentMetric])

  const donutData = useMemo(() => {
    const items = Array.from(metrics.entityMap.entries()).map(([name, d]) => ({
      name,
      value: currentMetric === "solicitante" ? d.valor : d[currentMetric],
    }))
    const total = items.reduce((acc, cur) => acc + cur.value, 0)
    let cumulative = 0
    const totalCirc = 2 * Math.PI * 62
    const fallbackColors = ["#10b981", "#f59e0b", "#38bdf8", "#a78bfa", "#f472b6", "#64748b"]

    const slices = items.map((item, idx) => {
      const pct = total > 0 ? item.value / total : 0
      const len = pct * totalCirc
      const gap = items.length > 1 ? 4 : 0
      const visibleLen = Math.max(0, len - gap)
      const offset = cumulative
      cumulative += len
      const color = companyColors[item.name] || fallbackColors[idx % fallbackColors.length]
      return {
        ...item,
        pct: Math.round(pct * 100),
        color,
        visibleLen,
        strokeDasharray: `${visibleLen} ${totalCirc - visibleLen}`,
        strokeDashoffset: `-${offset}`,
      }
    })

    return { total, slices }
  }, [metrics.entityMap, currentMetric])

  const ranking = useMemo(
    () => ({
      separadores: buildRanking(filteredRows, (r) => r.pessoa, (r) => r.inicio, (r) => r.final),
      conferentes: buildRanking(
        filteredRows,
        (r) => r.conferente,
        (r) => r.conferencia_inicial,
        (r) => r.conferencia_final,
      ),
      embaladores: buildRanking(
        filteredRows,
        (r) => r.embalador,
        (r) => r.horario_inicio_embalagem,
        (r) => r.horario_final_embalagem,
      ),
    }),
    [filteredRows],
  )

  const complexityItems = [
    { key: "Simples" as const, label: "até 10 SKUs", Icon: Box, iconClass: "text-emerald-400", pctClass: "text-emerald-300", barClass: "bg-emerald-400" },
    { key: "Normal" as const, label: "11 a 20 SKUs", Icon: Boxes, iconClass: "text-sky-400", pctClass: "text-sky-300", barClass: "bg-sky-400" },
    { key: "Complexa" as const, label: "acima de 20 SKUs", Icon: Layers, iconClass: "text-rose-400", pctClass: "text-rose-300", barClass: "bg-rose-400" },
    { key: "Não informado" as const, label: "não definido", Icon: HelpCircle, iconClass: "text-slate-400", pctClass: "text-slate-400", barClass: "bg-slate-500" },
  ]

  return (
    <div className="w-full py-2 space-y-8">
      {/* Filtro ativo no dashboard */}
      {hasFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-sky-500/[0.08] text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-300">
            <span className="text-sky-300 font-normal">Filtro ativo</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-100 font-light">
              {selectedEmpresa !== "ALL" ? selectedEmpresa : "Todas as empresas"}
              {selectedEmbarque !== "ALL" ? ` · ${selectedEmbarque}` : ""}
            </span>
          </div>
          <button
            onClick={() => {
              setSelectedEmpresa("ALL")
              setSelectedEmbarque("ALL")
            }}
            className="text-xs font-normal text-sky-300 hover:text-white transition-colors cursor-pointer"
          >
            Limpar filtro
          </button>
        </div>
      )}

      {/* Grade superior aberta — alinhamento simétrico entre esquerda e direita */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:gap-10 items-stretch">
        {/* Coluna Esquerda: Empresas e Volumes */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/12 text-sky-400 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-normal text-white tracking-tight leading-snug">
                  Empresas e volumes
                </h2>
                <p className="text-xs font-light text-slate-400">
                  Consolidado real do período selecionado
                </p>
              </div>
            </div>
            <span className="text-xs font-light text-slate-400 shrink-0">
              Por <span className="text-sky-300 font-normal">{METRIC_LABELS[currentMetric]}</span>
            </span>
          </div>

          {/* 4 KPIs abertos — altura e alinhamento uniformes com a coluna direita */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6 border-b border-white/[0.06]">
            <div className="rounded-xl bg-emerald-500/[0.05] px-3.5 py-3">
              <span className="block text-xs font-normal text-emerald-300/90">Avisos</span>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-light text-white tracking-tight tabular-nums">{fmt(metrics.avisos)}</span>
                <span className="text-[11px] font-light text-slate-500">un</span>
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] px-3.5 py-3">
              <span className="block text-xs font-normal text-slate-300">Notas</span>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-light text-white tracking-tight tabular-nums">{fmt(metrics.notas)}</span>
                <span className="text-[11px] font-light text-slate-500">doc</span>
              </div>
            </div>
            <div className="rounded-xl bg-sky-500/[0.06] px-3.5 py-3">
              <span className="block text-xs font-normal text-sky-300/90">Peças</span>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-light text-sky-200 tracking-tight tabular-nums">{fmt(metrics.pecas)}</span>
                <span className="text-[11px] font-light text-slate-500">un</span>
              </div>
            </div>
            <div className="rounded-xl bg-violet-500/[0.06] px-3.5 py-3">
              <span className="block text-xs font-normal text-violet-300/90">SKUs</span>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-light text-violet-200 tracking-tight tabular-nums">{fmt(metrics.skus)}</span>
                <span className="text-[11px] font-light text-slate-500">cód</span>
              </div>
            </div>
          </div>

          {/* Participação no Montante */}
          <div className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-normal text-slate-100">Participação no montante</h3>
              <div className="flex flex-wrap items-center gap-1 bg-white/[0.03] p-1 rounded-lg">
                {(["avisos", "notas", "pecas", "skus", "solicitante"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setCurrentMetric(m)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      currentMetric === m
                        ? "bg-sky-500/20 text-sky-200 font-normal"
                        : "text-slate-400 font-light hover:text-slate-200"
                    }`}
                  >
                    {METRIC_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 py-1">
              <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 160 160">
                  <circle
                    cx="80"
                    cy="80"
                    fill="transparent"
                    r="62"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="10"
                  />
                  {donutData.slices
                    .filter((s) => s.visibleLen > 0)
                    .map((slice) => (
                      <circle
                        key={slice.name}
                        cx="80"
                        cy="80"
                        fill="transparent"
                        r="62"
                        stroke={slice.color}
                        strokeWidth={selectedEmpresa === slice.name ? "13" : "10"}
                        strokeDasharray={slice.strokeDasharray}
                        strokeDashoffset={slice.strokeDashoffset}
                        strokeLinecap="round"
                        onClick={() => {
                          if (currentMetric !== "solicitante") {
                            setSelectedEmpresa(selectedEmpresa === slice.name ? "ALL" : slice.name)
                          }
                        }}
                        className="transition-all duration-500 ease-out cursor-pointer hover:opacity-85"
                      />
                    ))}
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[11px] font-light text-slate-400">Total</span>
                  <span className="text-lg font-normal text-white tracking-tight tabular-nums">{fmt(donutData.total)}</span>
                  <span className="text-[11px] font-light text-sky-300">{METRIC_LABELS[currentMetric]}</span>
                </div>
              </div>

              <div className="flex-1 w-full max-h-44 overflow-y-auto divide-y divide-white/[0.04] pr-1">
                {donutData.slices.map((slice) => {
                  const isSelected = selectedEmpresa === slice.name
                  return (
                    <button
                      type="button"
                      key={slice.name}
                      onClick={() => {
                        if (currentMetric !== "solicitante") {
                          setSelectedEmpresa(isSelected ? "ALL" : slice.name)
                        }
                      }}
                      className={`w-full flex items-center justify-between py-2.5 px-2.5 rounded-lg transition-colors cursor-pointer text-left ${
                        isSelected ? "bg-sky-500/12" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                        <span className={`text-xs truncate ${isSelected ? "text-white font-normal" : "text-slate-200 font-light"}`}>
                          {slice.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs tabular-nums shrink-0 pl-2">
                        <span className="text-slate-300 font-light">{fmt(slice.value)}</span>
                        <span className="font-normal w-9 text-right" style={{ color: slice.color }}>
                          {slice.pct}%
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Coluna Direita: Desempenho Operacional */}
        <section className="flex flex-col gap-6 xl:border-l xl:border-white/[0.06] xl:pl-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-normal text-white tracking-tight leading-snug">
                  Desempenho operacional
                </h2>
                <p className="text-xs font-light text-slate-400">
                  Tempos médios e perfil dos embarques
                </p>
              </div>
            </div>
            <span className="text-xs font-light text-slate-400 shrink-0">Tempo médio</span>
          </div>

          {/* 4 Tempos — exatamente na mesma altura e alinhamento da coluna esquerda */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6 border-b border-white/[0.06]">
            <div className="rounded-xl bg-emerald-500/[0.06] px-3.5 py-3">
              <span className="block text-xs font-normal text-emerald-300/90">Separação</span>
              <div className="mt-1.5 text-2xl font-light text-white tracking-tight tabular-nums">
                {formatDurationHuman(metrics.avgSep)}
              </div>
              <span className="text-[11px] font-light text-slate-500">média por aviso</span>
            </div>
            <div className="rounded-xl bg-sky-500/[0.06] px-3.5 py-3">
              <span className="block text-xs font-normal text-sky-300/90">Conferência</span>
              <div className="mt-1.5 text-2xl font-light text-white tracking-tight tabular-nums">
                {formatDurationHuman(metrics.avgConf)}
              </div>
              <span className="text-[11px] font-light text-slate-500">validação</span>
            </div>
            <div className="rounded-xl bg-amber-500/[0.06] px-3.5 py-3">
              <span className="block text-xs font-normal text-amber-300/90">Embalagem</span>
              <div className="mt-1.5 text-2xl font-light text-white tracking-tight tabular-nums">
                {formatDurationHuman(metrics.avgEmb)}
              </div>
              <span className="text-[11px] font-light text-slate-500">etapa</span>
            </div>
            <div className="rounded-xl bg-indigo-500/[0.08] px-3.5 py-3">
              <span className="block text-xs font-normal text-indigo-300">Ciclo total</span>
              <div className="mt-1.5 text-2xl font-light text-indigo-100 tracking-tight tabular-nums">
                {formatDurationHuman(metrics.totalTime)}
              </div>
              <span className="text-[11px] font-light text-slate-500">soma média</span>
            </div>
          </div>

          {/* Distribuição por Complexidade */}
          <div className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-normal text-slate-100">Distribuição por complexidade</h3>
              <span className="text-xs font-light text-slate-400 tabular-nums">{metrics.complexitySummary.total} avisos</span>
            </div>
            <div className="space-y-2">
              {complexityItems.map(({ key, label, Icon, iconClass, pctClass, barClass }) => {
                const item = metrics.complexitySummary[key]
                if (!item || (item.count === 0 && key === "Não informado")) return null
                const isSel = selectedEmbarque === key
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedEmbarque(isSel ? "ALL" : key)}
                    className={`w-full text-left flex flex-col gap-1.5 cursor-pointer group px-3 py-2 -mx-3 rounded-xl transition-colors ${
                      isSel ? "bg-sky-500/10" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${iconClass}`} />
                        <span className="font-normal text-slate-100 group-hover:text-white transition-colors">{key}</span>
                        <span className="text-slate-500 font-light text-[11px]">· {label}</span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="text-slate-400 font-light">{item.count} avisos</span>
                        <span className={`${pctClass} font-normal w-8 text-right`}>{item.pct}%</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className={`${barClass} h-full rounded-full transition-all duration-700 ease-out`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Seção Inferior: Últimos Avisos / Ranking de Operadores */}
      <section className="pt-8 border-t border-white/[0.06] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/12 text-violet-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-normal text-white tracking-tight leading-snug">
                Últimos avisos separados
              </h3>
              <p className="text-xs font-light text-slate-400">
                Histórico recente e produtividade por etapa · {periodLabel}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center bg-white/[0.03] p-1 rounded-xl gap-1 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("avisos")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === "avisos"
                  ? "bg-sky-500/20 text-sky-200 font-normal"
                  : "text-slate-400 font-light hover:text-slate-200"
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Lista de avisos</span>
            </button>
            <button
              onClick={() => setActiveTab("ranking")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === "ranking"
                  ? "bg-emerald-500/20 text-emerald-200 font-normal"
                  : "text-slate-400 font-light hover:text-slate-200"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Ranking de operadores</span>
            </button>
          </div>
        </div>

        {activeTab === "avisos" ? (
          <div className="overflow-x-auto">
            {filteredRows.length === 0 ? (
              <p className="py-12 text-center text-xs font-light text-slate-500">
                Nenhum registro encontrado para os filtros selecionados.
              </p>
            ) : (
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-white/[0.06] text-slate-300 text-xs font-medium">
                    <th className="py-2 pr-2 font-medium whitespace-nowrap">Aviso</th>
                    <th className="py-2 px-2 font-medium whitespace-nowrap">Complexidade</th>
                    <th className="py-2 px-2 font-medium whitespace-nowrap">Empresa / Solicitante</th>
                    <th className="py-2 px-2 font-medium text-center whitespace-nowrap">Volume</th>
                    <th className="py-2 px-2 font-medium whitespace-nowrap">Separação</th>
                    <th className="py-2 px-2 font-medium whitespace-nowrap">Conferência</th>
                    <th className="py-2 px-2 font-medium whitespace-nowrap">Embalagem</th>
                    <th className="py-2 pl-2 font-medium text-right whitespace-nowrap">Ciclo total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredRows.slice(0, 15).map((r) => {
                    const durSep = calculateDuration(r.inicio, r.final)
                    const durConf = calculateDuration(r.conferencia_inicial, r.conferencia_final)
                    const durEmb = calculateDuration(r.horario_inicio_embalagem, r.horario_final_embalagem)
                    const totalSec =
                      (durSep?.totalSeconds || 0) + (durConf?.totalSeconds || 0) + (durEmb?.totalSeconds || 0)

                    const tipoEmb = r.tipo_de_embarque?.trim() || "Não definido"
                    const badgeColor =
                      tipoEmb === "Simples"
                        ? "bg-emerald-500/12 text-emerald-300"
                        : tipoEmb === "Complexa"
                          ? "bg-rose-500/12 text-rose-300"
                          : tipoEmb === "Normal"
                            ? "bg-sky-500/12 text-sky-300"
                            : "bg-white/[0.04] text-slate-400"

                    const sepCount = splitPeople(r.pessoa).length
                    const confCount = splitPeople(r.conferente).length
                    const embCount = splitPeople(r.embalador).length

                    return (
                      <tr key={r.id} className="hover:bg-white/[0.025] transition-colors">
                        <td className="py-1.5 pr-2 font-normal text-white tabular-nums whitespace-nowrap align-middle">{r.aviso}</td>
                        <td className="py-1.5 px-2 whitespace-nowrap align-middle">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-normal ${badgeColor}`}>
                            {tipoEmb}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 align-middle">
                          <div className="font-normal text-slate-100 leading-tight">{r.empresa || "Não informado"}</div>
                          <div className="text-[10px] font-light text-slate-400 leading-tight">{r.solicitante || "Não informado"}</div>
                        </td>
                        <td className="py-1.5 px-2 text-center tabular-nums whitespace-nowrap font-light align-middle">
                          <span className="text-slate-200">{r.qtde_notas ?? 0} nf</span>
                          <span className="text-slate-600 mx-1">·</span>
                          <span className="text-sky-300">{fmt(r.pecas)} un</span>
                          <span className="text-slate-600 mx-1">·</span>
                          <span className="text-violet-300">{r.skus} skus</span>
                        </td>
                        <td className="py-1.5 px-2 align-middle" title={r.pessoa || undefined}>
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-sky-500/18 text-sky-300 flex items-center justify-center font-medium text-[10px] tabular-nums shrink-0">
                              {sepCount > 0 ? sepCount : "—"}
                            </div>
                            <div>
                              <div className="text-slate-200 font-light leading-tight cursor-help">
                                {renderPeopleCell(r.pessoa)}
                              </div>
                              <div className="text-[10px] font-light text-slate-400 tabular-nums leading-tight">{durSep?.formatted || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 align-middle" title={r.conferente || undefined}>
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-emerald-500/18 text-emerald-300 flex items-center justify-center font-medium text-[10px] tabular-nums shrink-0">
                              {confCount > 0 ? confCount : "—"}
                            </div>
                            <div>
                              <div className="text-slate-200 font-light leading-tight cursor-help">
                                {renderPeopleCell(r.conferente)}
                              </div>
                              <div className="text-[10px] font-light text-slate-400 tabular-nums leading-tight">{durConf?.formatted || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 align-middle" title={r.embalador || undefined}>
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-violet-500/18 text-violet-300 flex items-center justify-center font-medium text-[10px] tabular-nums shrink-0">
                              {embCount > 0 ? embCount : "—"}
                            </div>
                            <div>
                              <div className="text-slate-200 font-light leading-tight cursor-help">
                                {renderPeopleCell(r.embalador)}
                              </div>
                              <div className="text-[10px] font-light text-slate-400 tabular-nums leading-tight">{durEmb?.formatted || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-1.5 pl-2 text-right tabular-nums text-emerald-300 font-normal whitespace-nowrap align-middle">
                          {totalSec > 0 ? formatDurationHuman(totalSec) : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="pt-2 grid grid-cols-1 lg:grid-cols-3 gap-10">
            <RankSection
              title="Top separadores"
              accentClass="text-emerald-300"
              items={ranking.separadores}
              subtitleFor={(i) => `${fmt(i.avisos)} avisos · ${fmt(i.pecas)} peças`}
            />
            <RankSection
              title="Top conferentes"
              accentClass="text-sky-300"
              items={ranking.conferentes}
              subtitleFor={(i) => `${fmt(i.avisos)} avisos conferidos`}
            />
            <RankSection
              title="Top embaladores"
              accentClass="text-violet-300"
              items={ranking.embaladores}
              subtitleFor={(i) => `${fmt(i.avisos)} avisos embalados`}
            />
          </div>
        )}
      </section>
    </div>
  )
}
