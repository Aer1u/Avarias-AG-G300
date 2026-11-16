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
import { ControlePKRow, calculateDuration } from "./pkSpreadsheetParser"

interface ControlePKDashboardProps {
  rows: ControlePKRow[]
  loading: boolean
  periodLabel: string
}

function formatDurationHuman(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec) || sec <= 0) return "—"
  const r = Math.round(sec)
  const h = Math.floor(r / 3600)
  const m = Math.round((r % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  if (m > 0) return `${m} min`
  return `${r}s`
}

function formatMinSec(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec) || sec <= 0) return "—"
  const r = Math.round(sec)
  const m = Math.floor(r / 60)
  const s = r % 60
  return `${m}m ${s.toString().padStart(2, "0")}s`
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
  "Logística Express": "#10B981",
  "NorteSul Transportes": "#F59E0B",
  "TransBrasil Cargo": "#3B82F6",
  "Não informado": "#89919e",
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
    // Handle multiple operators separated by comma in ranking if desired, or split them
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
  { num: "text-[#4edea3]", avatar: "bg-[#4edea3]/20 text-[#4edea3]", time: "text-[#4edea3]" },
  { num: "text-[#159BFF]", avatar: "bg-[#159BFF]/20 text-[#159BFF]", time: "text-[#9fcaff]" },
  { num: "text-[#bfc7d5]", avatar: "bg-[#273647] text-[#bfc7d5]", time: "text-[#bfc7d5]" },
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
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0d1c2d] border border-[#273647]/60">
      <div className="flex items-center gap-3">
        <span className={`text-xs font-mono font-bold ${st.num}`}>#{index + 1}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold ${st.avatar}`}>
          {item.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="text-xs font-medium text-[#d4e4fa]">{item.name}</div>
          <div className="text-[10px] text-[#89919e]">{subtitle}</div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-xs font-mono font-medium ${st.time}`}>{formatMinSec(item.avgSec)}</div>
        <div className="text-[9px] text-[#89919e]">Eficiência: {item.efficiency}%</div>
      </div>
    </div>
  )
}

function RankCard({
  title,
  dotClass,
  items,
  subtitleFor,
  className = "",
  gridClass = "flex flex-col gap-3 mt-3",
}: {
  title: string
  dotClass: string
  items: RankItem[]
  subtitleFor: (i: RankItem) => string
  className?: string
  gridClass?: string
}) {
  return (
    <div className={`bg-[#122131] rounded-xl p-4 border border-[#273647] ${className}`}>
      <div className="flex items-center justify-between pb-3 border-b border-[#273647]/50">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotClass}`}></span>
          <span className="text-xs font-semibold text-[#d4e4fa] uppercase tracking-wide">{title}</span>
        </div>
        <span className="text-[10px] text-[#89919e] font-mono">Média por aviso</span>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-[#89919e]">Sem registros na tabela do Supabase.</p>
      ) : (
        <div className={gridClass}>
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

  // Filter rows strictly from Supabase table rows
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

  // Compute metrics and aggregations strictly from Supabase rows
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

  // Donut chart calculation from database entities
  const donutData = useMemo(() => {
    const items = Array.from(metrics.entityMap.entries()).map(([name, d]) => ({
      name,
      value: currentMetric === "solicitante" ? d.valor : d[currentMetric],
    }))
    const total = items.reduce((acc, cur) => acc + cur.value, 0)
    let cumulative = 0
    const totalCirc = 2 * Math.PI * 62
    const fallbackColors = ["#10B981", "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899", "#64748b"]

    const slices = items.map((item, idx) => {
      const pct = total > 0 ? item.value / total : 0
      const len = pct * totalCirc
      const gap = items.length > 1 ? 5 : 0
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

  // Ranking calculation from filtered rows
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
    { key: "Simples" as const, label: "até 10 skus", Icon: Box, iconClass: "text-[#4edea3]", pctClass: "text-[#4edea3]", barClass: "bg-[#4edea3]" },
    { key: "Normal" as const, label: ">10 e <=20 skus", Icon: Boxes, iconClass: "text-[#159BFF]", pctClass: "text-[#9fcaff]", barClass: "bg-[#159BFF]" },
    { key: "Complexa" as const, label: ">20 skus", Icon: Layers, iconClass: "text-red-400", pctClass: "text-red-400", barClass: "bg-red-500" },
    { key: "Não informado" as const, label: "não definido / —", Icon: HelpCircle, iconClass: "text-[#89919e]", pctClass: "text-[#89919e]", barClass: "bg-[#89919e]" },
  ]

  return (
    <div className="w-full flex flex-col items-center px-2 sm:px-4 md:px-6 py-4">
      {/* Filter Status Indicator Banner */}
      {hasFilter && (
        <div className="w-full mb-4">
          <div className="bg-[#122131] border border-[#159BFF]/40 rounded-lg p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#159BFF] animate-pulse"></span>
              <span className="text-[#89919e]">Filtros ativos:</span>
              <span className="font-mono font-medium text-[#9fcaff]">
                Empresa: {selectedEmpresa} | Embarque: {selectedEmbarque}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedEmpresa("ALL")
                setSelectedEmbarque("ALL")
              }}
              className="text-xs text-[#89919e] hover:text-white underline cursor-pointer"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      )}

      {/* Main Container: Fluid full width */}
      <main className="w-full flex flex-col my-auto">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
          {/* Left Panel: Empresas e Volumes */}
          <div className="bg-[#0d1c2d] rounded-2xl p-5 md:p-6 flex flex-col justify-between gap-5 shadow-2xl relative overflow-hidden border border-[#273647]">
            <div className="absolute -top-24 -left-24 w-60 h-60 bg-[#159BFF]/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#122131] flex items-center justify-center text-[#9fcaff] shadow-sm border border-[#273647]">
                  <Package className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-base font-bold text-[#d4e4fa] tracking-tight">Empresas e Volumes</h2>
                  <p className="text-[11px] text-[#bfc7d5]">Dados reais da tabela Supabase</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[#bfc7d5] text-xs font-mono">
                <span className="text-[#4edea3]">●</span>
                <span>
                  Métrica: <strong className="text-white font-semibold uppercase">{currentMetric}</strong>
                </span>
              </div>
            </div>

            {/* 4 Cards de Indicadores Superiores */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 relative z-10">
              <div className="bg-[#122131] rounded-xl p-3 flex flex-col justify-between shadow-sm border border-[#273647]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#d4e4fa] tracking-wide uppercase">Avisos</span>
                  <span className="bg-[#4edea3]/10 text-[#4edea3] text-[9px] font-semibold px-1.5 py-0.5 rounded">Ativo</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-sm font-normal text-[#d4e4fa]">{fmt(metrics.avisos)}</span>
                  <span className="text-[#89919e] text-[10px]">un</span>
                </div>
              </div>
              <div className="bg-[#122131] rounded-xl p-3 flex flex-col justify-between shadow-sm border border-[#273647]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#d4e4fa] tracking-wide uppercase">Notas</span>
                  <span className="bg-[#273647] text-[#bfc7d5] text-[9px] font-semibold px-1.5 py-0.5 rounded">Doc</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-sm font-normal text-[#d4e4fa]">{fmt(metrics.notas)}</span>
                  <span className="text-[#89919e] text-[10px]">doc</span>
                </div>
              </div>
              <div className="bg-[#122131] rounded-xl p-3 flex flex-col justify-between shadow-sm border border-[#273647]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#d4e4fa] tracking-wide uppercase">Peças</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#159BFF]"></span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-sm font-normal text-[#9fcaff]">{fmt(metrics.pecas)}</span>
                  <span className="text-[#89919e] text-[10px]">un</span>
                </div>
              </div>
              <div className="bg-[#122131] rounded-xl p-3 flex flex-col justify-between shadow-sm border border-[#273647]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#d4e4fa] tracking-wide uppercase">SKUs</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d0bcff]"></span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-sm font-normal text-[#d0bcff]">{fmt(metrics.skus)}</span>
                  <span className="text-[#89919e] text-[10px]">cod</span>
                </div>
              </div>
            </div>

            {/* Participação no Montante */}
            <div className="bg-[#122131] rounded-xl p-4 flex flex-col gap-4 relative z-10 shadow-sm border border-[#273647] flex-1 justify-between">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-[#bfc7d5] uppercase tracking-wider font-semibold">Participação no Montante</span>
                <div className="inline-flex flex-wrap bg-[#0d1c2d] p-1 rounded-lg gap-1 border border-[#273647]">
                  {(["avisos", "notas", "pecas", "skus", "solicitante"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setCurrentMetric(m)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase transition-all cursor-pointer ${
                        currentMetric === m ? "bg-[#159BFF] text-[#003157]" : "text-[#bfc7d5] hover:text-[#d4e4fa]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
                <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                  <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 160 160">
                    <circle className="text-[#273647]" cx="80" cy="80" fill="transparent" r="62" stroke="currentColor" strokeWidth="16"></circle>
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
                          strokeWidth={selectedEmpresa === slice.name ? "20" : "16"}
                          strokeDasharray={slice.strokeDasharray}
                          strokeDashoffset={slice.strokeDashoffset}
                          strokeLinecap="butt"
                          onClick={() => {
                            if (currentMetric !== "solicitante") {
                              setSelectedEmpresa(selectedEmpresa === slice.name ? "ALL" : slice.name)
                            }
                          }}
                          className="transition-all duration-500 ease-out cursor-pointer hover:opacity-80"
                        />
                      ))}
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-[9px] uppercase tracking-wider text-[#89919e]">Total</span>
                    <span className="text-base font-semibold text-[#d4e4fa] tracking-tight">{fmt(donutData.total)}</span>
                    <span className="text-[9px] text-[#9fcaff] uppercase font-medium">{currentMetric}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full sm:w-60 shrink-0 max-h-40 overflow-y-auto custom-scrollbar">
                  {donutData.slices.map((slice) => {
                    const isSelected = selectedEmpresa === slice.name
                    return (
                      <div
                        key={slice.name}
                        onClick={() => {
                          if (currentMetric !== "solicitante") {
                            setSelectedEmpresa(isSelected ? "ALL" : slice.name)
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded bg-[#0d1c2d] hover:bg-[#1c2b3c] transition-colors cursor-pointer border ${
                          isSelected ? "border-[#9fcaff] ring-1 ring-[#9fcaff]/30" : "border-[#273647]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: slice.color }}></span>
                          <span className="text-xs text-[#d4e4fa] font-medium truncate max-w-[130px]">{slice.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <span className="text-[#d4e4fa] font-normal">{fmt(slice.value)}</span>
                          <span className="font-medium" style={{ color: slice.color }}>
                            ({slice.pct}%)
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Desempenho Operacional */}
          <div className="bg-[#0d1c2d] rounded-2xl p-5 md:p-6 flex flex-col justify-between gap-5 shadow-2xl relative overflow-hidden border border-[#273647]">
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-[#4edea3]/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#122131] flex items-center justify-center text-[#4edea3] shadow-sm border border-[#273647]">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-base font-bold text-[#d4e4fa] tracking-tight">Desempenho Operacional</h2>
                  <p className="text-[11px] text-[#bfc7d5]">Tempos reais da tabela Supabase</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[#bfc7d5] text-xs font-mono">
                <span>Tempo Médio</span>
              </div>
            </div>

            {/* 4 Cards de Indicadores de Tempo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 relative z-10">
              <div className="bg-[#122131] rounded-xl p-3 flex flex-col justify-between shadow-sm relative overflow-hidden border border-[#273647]">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#4edea3]"></div>
                <span className="text-xs font-bold text-[#d4e4fa] tracking-wide uppercase">Separação</span>
                <div className="mt-2 flex flex-col">
                  <span className="text-xs font-normal text-[#4edea3]">{formatDurationHuman(metrics.avgSep)}</span>
                  <span className="text-[#89919e] text-[9px] mt-0.5">Tempo médio</span>
                </div>
              </div>
              <div className="bg-[#122131] rounded-xl p-3 flex flex-col justify-between shadow-sm relative overflow-hidden border border-[#273647]">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#159BFF]"></div>
                <span className="text-xs font-bold text-[#d4e4fa] tracking-wide uppercase">Conferência</span>
                <div className="mt-2 flex flex-col">
                  <span className="text-xs font-normal text-[#9fcaff]">{formatDurationHuman(metrics.avgConf)}</span>
                  <span className="text-[#89919e] text-[9px] mt-0.5">Validação</span>
                </div>
              </div>
              <div className="bg-[#122131] rounded-xl p-3 flex flex-col justify-between shadow-sm relative overflow-hidden border border-[#273647]">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#89919e]"></div>
                <span className="text-xs font-bold text-[#d4e4fa] tracking-wide uppercase">Embalagem</span>
                <div className="mt-2 flex flex-col">
                  <span className="text-xs font-normal text-[#d4e4fa]">{formatDurationHuman(metrics.avgEmb)}</span>
                  <span className="text-[#89919e] text-[9px] mt-0.5">Etapa</span>
                </div>
              </div>
              <div className="rounded-xl p-3 flex flex-col justify-between shadow-sm relative overflow-hidden bg-gradient-to-b from-[#159BFF]/10 to-transparent border border-[#159BFF]/30 bg-[#122131]">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#159BFF]"></div>
                <span className="text-xs font-bold text-[#9fcaff] tracking-wide uppercase">Total Ciclo</span>
                <div className="mt-2 flex flex-col">
                  <span className="text-xs font-normal text-[#d4e4fa]">{formatDurationHuman(metrics.totalTime)}</span>
                  <span className="text-[#89919e] text-[9px] mt-0.5">Ciclo global</span>
                </div>
              </div>
            </div>

            {/* Distribuição por Complexidade */}
            <div className="bg-[#122131] rounded-xl p-4 flex flex-col gap-3 relative z-10 shadow-sm border border-[#273647] flex-1 justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#d4e4fa] tracking-wide uppercase">Distribuição por Complexidade</span>
                  <span className="text-[11px] text-[#89919e] font-normal">({metrics.complexitySummary.total} avisos)</span>
                </div>
              </div>
              <div className="flex flex-col gap-2.5 justify-center flex-1">
                {complexityItems.map(({ key, label, Icon, iconClass, pctClass, barClass }) => {
                  const item = metrics.complexitySummary[key]
                  if (!item || (item.count === 0 && key === "Não informado")) return null
                  const isSel = selectedEmbarque === key
                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedEmbarque(isSel ? "ALL" : key)}
                      className={`flex flex-col gap-1 cursor-pointer group p-2 rounded-lg transition-colors hover:bg-[#0d1c2d] border ${
                        isSel ? "bg-[#0d1c2d] border-[#9fcaff] ring-1 ring-[#9fcaff]/20" : "border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${iconClass}`} />
                          <span className="font-medium text-[#d4e4fa] group-hover:text-[#9fcaff] transition-colors text-[11px]">{key}</span>
                          <span className="text-[#89919e] text-[10px]">{label}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="text-[#bfc7d5] font-normal">{item.count} avisos</span>
                          <span className={`${pctClass} font-normal`}>{item.pct}%</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-[#0d1c2d] rounded-full overflow-hidden flex border border-[#273647]">
                        <div className={`${barClass} h-full rounded-full transition-all duration-700 ease-out`} style={{ width: `${item.pct}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Últimos Avisos / Ranking de Operadores */}
        <section className="mt-5 bg-[#0d1c2d] rounded-2xl p-5 md:p-6 shadow-2xl relative overflow-hidden border border-[#273647] text-[#d4e4fa]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#273647]/60">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#122131] flex items-center justify-center text-[#159BFF] shadow-sm border border-[#273647] shrink-0 mt-0.5">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-[#d4e4fa] tracking-tight">Últimos Avisos Separados</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#159BFF]/10 text-[#9fcaff] border border-[#159BFF]/30">Tempo Real</span>
                </div>
                <p className="text-xs text-[#89919e] mt-0.5">
                  Histórico recente ordenado por tipo de embarque e status operacional ({periodLabel})
                </p>
              </div>
            </div>

            <div className="inline-flex items-center bg-[#051424] p-1 rounded-xl border border-[#273647] gap-1 self-start md:self-auto">
              <button
                onClick={() => setActiveTab("avisos")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === "avisos" ? "bg-[#159BFF] text-[#003157] shadow-sm" : "text-[#bfc7d5] hover:text-[#d4e4fa]"
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Lista de Avisos</span>
              </button>
              <button
                onClick={() => setActiveTab("ranking")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === "ranking" ? "bg-[#159BFF] text-[#003157] shadow-sm" : "text-[#bfc7d5] hover:text-[#d4e4fa]"
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Ranking de Operadores</span>
              </button>
            </div>
          </div>

          {activeTab === "avisos" ? (
            <div className="overflow-x-auto mt-2">
              {filteredRows.length === 0 ? (
                <p className="py-12 text-center text-xs text-[#89919e]">Nenhum registro encontrado na tabela Supabase para os filtros selecionados.</p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#273647] text-[#89919e] font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-3 font-medium">Aviso / PK</th>
                      <th className="py-3 px-3 font-medium">Complexidade</th>
                      <th className="py-3 px-3 font-medium">Empresa / Solicitante</th>
                      <th className="py-3 px-3 font-medium text-center">Notas / Peças / SKUs</th>
                      <th className="py-3 px-3 font-medium">Operador Separação</th>
                      <th className="py-3 px-3 font-medium">Operador Conferência</th>
                      <th className="py-3 px-3 font-medium">Operador Embalagem</th>
                      <th className="py-3 px-3 font-medium text-right">Ciclo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#273647]/50">
                    {filteredRows.slice(0, 15).map((r) => {
                      const durSep = calculateDuration(r.inicio, r.final)
                      const durConf = calculateDuration(r.conferencia_inicial, r.conferencia_final)
                      const durEmb = calculateDuration(r.horario_inicio_embalagem, r.horario_final_embalagem)
                      const totalSec =
                        (durSep?.totalSeconds || 0) + (durConf?.totalSeconds || 0) + (durEmb?.totalSeconds || 0)

                      const tipoEmb = r.tipo_de_embarque?.trim() || "Não definido"
                      const badgeColor =
                        tipoEmb === "Simples"
                          ? "bg-[#4edea3]/10 text-[#4edea3] border-[#4edea3]/30"
                          : tipoEmb === "Complexa"
                            ? "bg-red-500/10 text-red-400 border-red-500/30"
                            : tipoEmb === "Normal"
                              ? "bg-[#159BFF]/10 text-[#159BFF] border-[#159BFF]/30"
                              : "bg-slate-500/10 text-slate-400 border-slate-500/30"

                      return (
                        <tr key={r.id} className="hover:bg-[#122131]/60 transition-colors group">
                          <td className="py-3 px-3 font-mono font-normal text-white">{r.aviso}</td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${badgeColor}`}>
                              <span className="w-1 h-1 rounded-full bg-current"></span>
                              {tipoEmb}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-[#d4e4fa]">{r.empresa || "Não informado"}</div>
                            <div className="text-[10px] text-[#89919e]">{r.solicitante || "Não informado"}</div>
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            <span className="text-[#d4e4fa]">{r.qtde_notas ?? 0} nf</span> <span className="text-[#89919e]">•</span>{" "}
                            <span className="text-[#9fcaff]">{fmt(r.pecas)} un</span> <span className="text-[#89919e]">•</span>{" "}
                            <span className="text-[#d0bcff]">{r.skus} skus</span>
                          </td>
                          <td className="py-3 px-3" title={r.pessoa || undefined}>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#159BFF]/20 text-[#159BFF] flex items-center justify-center font-semibold text-[10px]">
                                {splitPeople(r.pessoa).length > 0 ? splitPeople(r.pessoa).length : "—"}
                              </div>
                              <div>
                                <div className="text-[#d4e4fa] font-medium cursor-help">
                                  {renderPeopleCell(r.pessoa)}
                                </div>
                                <div className="text-[10px] text-[#89919e] font-mono">{durSep?.formatted || "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3" title={r.conferente || undefined}>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#4edea3]/20 text-[#4edea3] flex items-center justify-center font-semibold text-[10px]">
                                {splitPeople(r.conferente).length > 0 ? splitPeople(r.conferente).length : "—"}
                              </div>
                              <div>
                                <div className="text-[#d4e4fa] font-medium cursor-help">
                                  {renderPeopleCell(r.conferente)}
                                </div>
                                <div className="text-[10px] text-[#89919e] font-mono">{durConf?.formatted || "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3" title={r.embalador || undefined}>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#d0bcff]/20 text-[#d0bcff] flex items-center justify-center font-semibold text-[10px]">
                                {splitPeople(r.embalador).length > 0 ? splitPeople(r.embalador).length : "—"}
                              </div>
                              <div>
                                <div className="text-[#d4e4fa] font-medium cursor-help">
                                  {renderPeopleCell(r.embalador)}
                                </div>
                                <div className="text-[10px] text-[#89919e] font-mono">{durEmb?.formatted || "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-[#d4e4fa] font-medium">
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
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RankCard
                title="Top Separadores"
                dotClass="bg-[#4edea3]"
                items={ranking.separadores}
                subtitleFor={(i) => `${fmt(i.avisos)} avisos • ${fmt(i.pecas)} peças`}
              />
              <RankCard
                title="Top Conferentes"
                dotClass="bg-[#159BFF]"
                items={ranking.conferentes}
                subtitleFor={(i) => `${fmt(i.avisos)} avisos conferidos`}
              />
              <RankCard
                title="Top Embaladores"
                dotClass="bg-[#d0bcff]"
                items={ranking.embaladores}
                subtitleFor={(i) => `${fmt(i.avisos)} avisos embalados`}
                className="lg:col-span-2"
                gridClass="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3"
              />
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
